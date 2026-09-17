'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { JsonAnnouncementStore, PostgresAnnouncementStore } = require('../lib/announcement-store');

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

test('announcement JSON storage survives reinitialization and supports edits and deletion', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-center-notices-store-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'announcements.json');
  const store = new JsonAnnouncementStore(file);
  await store.init();
  const created = await store.create('제목', '한글 본문\n둘째 줄');
  const pinned = await store.create('고정 제목', '항상 먼저 표시', true);
  assert.equal((await store.list()).length, 2);
  assert.equal((await store.list())[0].id, pinned.id);
  assert.equal((await store.list())[0].pinned, true);
  const again = new JsonAnnouncementStore(file);
  await again.init();
  assert.equal((await again.list()).find(item => item.id === created.id).body, '한글 본문\n둘째 줄');
  assert.equal((await again.update(created.id, '수정', '변경된 내용', true)).title, '수정');
  const third = new JsonAnnouncementStore(file);
  await third.init();
  assert.equal((await third.list()).find(item => item.id === created.id).body, '변경된 내용');
  assert.equal((await third.list()).find(item => item.id === created.id).pinned, true);
  assert.equal(await third.remove(created.id), true);
  assert.equal(await third.remove(created.id), false);
  assert.equal(await third.remove(pinned.id), true);
  assert.equal((await third.list()).length, 0);
});

test('release seeding is idempotent and pins the latest nickname-change notice', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-center-notices-seed-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const store = new JsonAnnouncementStore(path.join(dir, 'announcements.json'));
  await store.init();
  await store.create('닉네임 변경안내', '관리자가 닉네임을 변경할 수 있습니다.');
  const releases = [
    { key: 'v9.9.8', title: '[업데이트] v9.9.8 닉네임 변경 추가', body: '변경 내용', publishedAt: '2026-08-31T00:00:00Z' },
    { key: 'v9.9.9', title: '[업데이트] v9.9.9 테스트', body: '변경 내용', publishedAt: '2026-09-01T00:00:00Z' },
  ];
  await store.seedReleases(releases);
  await store.seedReleases(releases);
  const items = await store.list();
  assert.equal(items.length, 3);
  assert.equal(items[0].title, '닉네임 변경안내');
  assert.equal(items[0].pinned, true);
  assert.equal(items.filter(item => item.releaseKey === 'v9.9.9').length, 1);
  assert.equal(items.find(item => item.releaseKey === 'v9.9.8').pinned, false);
});

test('PostgreSQL announcement storage migrates pin metadata and uses pinned ordering', async () => {
  const store = new PostgresAnnouncementStore('postgres://example.invalid/db');
  const calls = [];
  store.pool = {
    async query(sql, params = []) {
      calls.push({ sql: String(sql), params });
      if (/SELECT id, release_key/.test(sql)) return { rowCount: 0, rows: [] };
      if (/RETURNING \*/.test(sql)) return { rowCount: 1, rows: [{ id: params[0], title: params[1], body: params[2], pinned: params[3], created_at: new Date(), updated_at: new Date() }] };
      return { rowCount: 0, rows: [] };
    },
  };
  await store.init();
  const created = await store.create('고정 공지', '내용', true);
  assert.equal(created.pinned, true);
  await store.update(created.id, '수정 공지', '수정 내용', false);
  await store.list();
  await store.seedReleases([{ key: 'v9.9.9', title: '[업데이트] v9.9.9 테스트', body: '내용', publishedAt: '2026-09-01T00:00:00Z' }]);
  const sql = calls.map(call => call.sql).join('\n');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS announcements_release_key_idx/);
  assert.match(sql, /ORDER BY pinned DESC, created_at DESC/);
  assert.match(sql, /ON CONFLICT DO NOTHING/);
  assert.match(sql, /title LIKE '%닉네임%변경%안내%'/);
});

test('announcement API permits members to read but only admins to create/update/delete', { timeout: 25000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-center-notices-api-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir,
      DATABASE_URL: '', ADMIN_PASSWORD: 'notice-test-password', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  proc.stdout.on('data', chunk => output += chunk.toString());
  proc.stderr.on('data', chunk => output += chunk.toString());
  t.after(async () => {
    proc.kill('SIGTERM');
    await new Promise(resolve => { if (proc.exitCode !== null) resolve(); else { proc.once('exit', resolve); setTimeout(resolve, 2000).unref(); } });
    await fs.rm(dir, { recursive: true, force: true });
  });
  let started = false;
  for (let i = 0; i < 90; i += 1) {
    if (proc.exitCode !== null) break;
    try { const response = await fetch(base + '/health'); if (response.ok) { started = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(started, `test server failed to start: ${output}`);
  async function request(route, token, body, method = 'POST') {
    const headers = {};
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json() };
  }
  const login = await request('/api/admin/login', null, { password: 'notice-test-password' });
  assert.equal(login.status, 200);
  const admin = login.data.sessionToken;
  const guestKey = await request('/api/admin/keys', admin, { label: '공지 읽는 게스트' });
  assert.equal(guestKey.status, 201);
  const guestToken = guestKey.data.html.match(/name="token" value="([^"]+)"/)[1];
  const entered = await fetch(base + '/guest-entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: guestToken }).toString(),
  });
  assert.equal(entered.status, 200);
  const guestSession = (await entered.text()).match(/data-session="([^"]+)"/)[1];
  assert.equal((await request('/api/announcements', null, undefined, 'GET')).status, 401);
  assert.equal((await request('/api/announcements', guestSession, undefined, 'GET')).status, 200);
  assert.equal((await request('/api/announcements', guestSession, { title: '해킹', body: '불허' })).status, 403);
  assert.equal((await request('/api/announcements', admin, { title: ' ', body: '내용' })).status, 400);
  assert.equal((await request('/api/announcements', admin, { title: '제목', body: 'x'.repeat(3001) })).status, 400);
  const created = await request('/api/announcements', admin, { title: '업데이트 안내', body: '오목과 숫자야구\n즐겁게 이용해 주세요.', pinned: true });
  assert.equal(created.status, 201);
  const id = created.data.item.id;
  assert.ok(id);
  const reader = await request('/api/announcements', guestSession, undefined, 'GET');
  assert.equal(reader.data.items[0].title, '업데이트 안내');
  assert.equal(reader.data.items[0].body, '오목과 숫자야구\n즐겁게 이용해 주세요.');
  assert.equal(reader.data.items[0].pinned, true);
  assert.equal((await request('/api/announcements/' + id, guestSession, { title: '무단 수정', body: '거부' }, 'PUT')).status, 403);
  assert.equal((await request('/api/announcements/' + id, guestSession, undefined, 'DELETE')).status, 403);
  const edited = await request('/api/announcements/' + id, admin, { title: '수정된 공지', body: '최종 안내', pinned: false }, 'PUT');
  assert.equal(edited.status, 200);
  assert.equal(edited.data.item.title, '수정된 공지');
  assert.equal(edited.data.item.pinned, false);
  const removed = await request('/api/announcements/' + id, admin, undefined, 'DELETE');
  assert.equal(removed.status, 200);
  assert.equal((await request('/api/announcements', guestSession, undefined, 'GET')).data.items.length, 0);
  assert.equal((await request('/api/announcements/' + id, admin, undefined, 'DELETE')).status, 404);
});

test('lobby has top notice tab and all guidance and game rules are closed by default', async () => {
  const html = await fs.readFile(path.join(__dirname, '..', 'public/index.html'), 'utf8');
  const app = await fs.readFile(path.join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.ok(html.indexOf('id="announcementsCard"') > html.indexOf('id="lobbyView"'));
  assert.ok(html.indexOf('id="announcementsCard"') < html.indexOf('class="lobbyTopGrid"'));
  assert.match(html, /id="announcementTab"/);
  assert.match(html, /id="announcementForm" class="noticeForm hidden"/);
  assert.match(html, /id="announcementPinned" type="checkbox"/);
  assert.equal((html.match(/class="gameRuleDetails"/g) || []).length, 0);
  assert.equal((html.match(/data-game-option=/g) || []).length, 10);
  assert.match(html, /id="gameRulesDisclosure" class="helpDisclosure"/);
  assert.match(html, /id="gameRulesSelect"/);
  assert.equal((html.match(/class="helpDisclosure"/g) || []).length, 3);
  assert.doesNotMatch(html, /class="(?:helpDisclosure|gameRuleDetails)" open/);
  assert.match(app, /announcementAddBtn\.classList\.toggle\('hidden', sessionRole !== 'admin'\)/);
  assert.match(app, /title\.textContent = item\.title/);
  assert.match(app, /body\.textContent = item\.body/);
  assert.match(app, /announcementPinned\.checked = item\?\.pinned === true/);
  assert.match(app, /pin\.textContent = '고정'/);
});
