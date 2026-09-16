'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { JsonAccessStore, PostgresAccessStore, hashToken } = require('../lib/access-store');

function entryToken(html) {
  const token = html.match(/name="token" value="([^"]+)"/)?.[1];
  assert.ok(token);
  return token;
}

test('JSON nickname change keeps original identity and metadata, removes old secret and survives restart', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'omok-rename-store-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'keys.json');
  const store = new JsonAccessStore(file);
  await store.init();
  const issued = await store.create('옛 이름', 'original-secret-for-test');
  await store.setNote(issued.id, '관리자 개인 메모');
  const used = await store.validateAndRecord('original-secret-for-test');
  const changed = await store.renameAndRotateToken(issued.id, '새 이름', 'new-secret-for-test');
  assert.equal(changed.id, issued.id);
  assert.equal(changed.label, '새 이름');
  assert.equal(changed.adminNote, '관리자 개인 메모');
  assert.equal(changed.createdAt, issued.createdAt);
  assert.equal(changed.lastUsedAt, used.lastUsedAt);
  assert.equal(changed.useCount, used.useCount);
  assert.equal(changed.revokedAt, null);
  assert.equal(await store.validateAndRecord('original-secret-for-test'), null);
  const restarted = new JsonAccessStore(file);
  await restarted.init();
  assert.equal((await restarted.list()).length, 1);
  assert.equal((await restarted.list())[0].label, '새 이름');
  assert.equal((await restarted.validateAndRecord('new-secret-for-test')).id, issued.id);
  assert.equal(await restarted.renameAndRotateToken('does-not-exist', '뭔가', 'secret'), null);
  await restarted.revoke(issued.id);
  assert.equal(await restarted.renameAndRotateToken(issued.id, '불가능', 'secret'), null);
  assert.equal((await restarted.list())[0].label, '새 이름');
  assert.doesNotMatch(JSON.stringify(await restarted.list()), /tokenHash|original-secret|new-secret/);
});

test('PostgreSQL changes label and hashed secret in one active-only update without resetting historical fields', async () => {
  const store = new PostgresAccessStore('postgres://mock:mock@localhost:5432/mock');
  const calls = [];
  store.pool = { query: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ id: params[0], label: params[1], admin_note: '남은 메모', use_count: 10, created_at: new Date('2026-09-01T01:00:00Z'), last_used_at: new Date('2026-09-02T01:00:00Z'), revoked_at: null }] };
  }};
  const changed = await store.renameAndRotateToken('key-uuid', '바뀐 이름', 'new-super-secret');
  assert.match(calls[0].sql, /SET label = \$2, token_hash = \$3/);
  assert.match(calls[0].sql, /WHERE id = \$1 AND revoked_at IS NULL/);
  assert.match(calls[0].sql, /RETURNING .*created_at.*last_used_at.*use_count.*admin_note/);
  assert.deepEqual(calls[0].params, ['key-uuid', '바뀐 이름', hashToken('new-super-secret')]);
  assert.equal(changed.id, 'key-uuid');
  assert.equal(changed.label, '바뀐 이름');
  assert.equal(changed.adminNote, '남은 메모');
  assert.equal(changed.useCount, 10);
  assert.doesNotMatch(JSON.stringify(changed), /token_hash|tokenHash|new-super-secret/);
});

test('admin rename endpoint validates input, invalidates prior file and active session, and issues updated HTML', { timeout: 25000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'omok-rename-server-'));
  const freePort = await new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.on('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
  const base = `http://127.0.0.1:${freePort}`;
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(freePort), HOST: '127.0.0.1', DATA_DIR: dir, DATABASE_URL: '', ADMIN_PASSWORD: 'rename-test-password', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  proc.stdout.on('data', part => output += part.toString());
  proc.stderr.on('data', part => output += part.toString());
  t.after(async () => {
    proc.kill('SIGTERM');
    await new Promise(resolve => {
      if (proc.exitCode !== null) return resolve();
      proc.once('exit', resolve);
      setTimeout(resolve, 2000).unref();
    });
    await fs.rm(dir, { recursive: true, force: true });
  });
  let running = false;
  for (let n = 0; n < 100; n++) {
    if (proc.exitCode !== null) break;
    try { if ((await fetch(base + '/health')).ok) { running = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(running, `server start failed: ${output}`);
  async function request(route, method = 'GET', session, payload) {
    const headers = {};
    if (session) headers['X-Session-Token'] = session;
    if (payload !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(base + route, {
      method, headers, ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
    });
    return { status: response.status, data: await response.json() };
  }
  async function enter(html) {
    const response = await fetch(base + '/guest-entry', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: entryToken(html) }).toString(),
    });
    return { status: response.status, html: await response.text() };
  }
  const login = await request('/api/admin/login', 'POST', null, { password: 'rename-test-password' });
  assert.equal(login.status, 200);
  const admin = login.data.sessionToken;
  const issued = await request('/api/admin/keys', 'POST', admin, { label: '처음이름' });
  assert.equal(issued.status, 201);
  const id = issued.data.key.id;
  const beforeLogin = await enter(issued.data.html);
  assert.equal(beforeLogin.status, 200);
  const guestSession = beforeLogin.html.match(/data-session="([^"]+)"/)?.[1];
  assert.ok(guestSession);
  const route = `/api/admin/keys/${id}/rename`;
  assert.equal((await request(route, 'POST', null, { label: '불법' })).status, 401);
  assert.equal((await request(route, 'POST', guestSession, { label: '불법' })).status, 403);
  for (const invalid of [{ label: '' }, { label: ' ' }, { label: 123 }, { label: 'a'.repeat(41) }]) {
    assert.equal((await request(route, 'POST', admin, invalid)).status, 400);
  }
  assert.equal((await request('/api/session', 'GET', guestSession)).data.label, '처음이름');
  assert.equal((await request(`/api/admin/keys/${id}/note`, 'POST', admin, { note: '기존 관리 메모' })).status, 200);
  const before = (await request('/api/admin/keys', 'GET', admin)).data.keys.find(key => key.id === id);
  const renamed = await request(route, 'POST', admin, { label: '새로운이름' });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.data.key.id, id);
  assert.equal(renamed.data.key.label, '새로운이름');
  assert.equal(renamed.data.key.adminNote, '기존 관리 메모');
  assert.equal(renamed.data.key.createdAt, before.createdAt);
  assert.equal(renamed.data.key.lastUsedAt, before.lastUsedAt);
  assert.equal(renamed.data.key.useCount, before.useCount);
  assert.match(renamed.data.fileName, /새로운이름/);
  assert.match(renamed.data.html, /새로운이름 전용 입장 파일/);
  assert.notEqual(entryToken(renamed.data.html), entryToken(issued.data.html));
  assert.doesNotMatch(JSON.stringify(renamed.data.key), /token_hash|tokenHash|rawToken/);
  assert.equal((await request('/api/session', 'GET', guestSession)).data.authenticated, false);
  assert.equal((await enter(issued.data.html)).status, 403);
  const newLogin = await enter(renamed.data.html);
  assert.equal(newLogin.status, 200);
  assert.match(newLogin.html, /data-label="새로운이름"/);
  const after = (await request('/api/admin/keys', 'GET', admin)).data.keys;
  assert.equal(after.length, 1);
  assert.equal(after[0].id, id);
  assert.equal(after[0].label, '새로운이름');
  assert.equal(after[0].adminNote, '기존 관리 메모');
  assert.equal((await request(`/api/admin/keys/${id}/revoke`, 'POST', admin)).status, 200);
  assert.equal((await request(route, 'POST', admin, { label: '취소상태' })).status, 404);
  assert.equal((await request('/api/admin/keys/00000000-0000-4000-8000-000000000000/rename', 'POST', admin, { label: '없음' })).status, 404);
});

test('rename control is admin-only inside expandable guest key details and uses regenerated file', async () => {
  const app = await fs.readFile(path.join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(app, /renameBtn\.textContent = '닉네임 변경'/);
  assert.match(app, /detail\.appendChild\(renameBtn\)/);
  assert.match(app, /api\/admin\/keys\/\$\{id\}\/rename/);
  assert.match(app, /downloadEntryFile\(data\)/);
  assert.match(app, /기존 파일과 접속은 즉시 무효화됩니다/);
});
