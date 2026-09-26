'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { JsonAccessStore, PostgresAccessStore, hashToken } = require('../lib/access-store');

async function tempStore(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'entry-reissue-v1610-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'keys.json');
  const store = new JsonAccessStore(file);
  await store.init();
  return { file, store };
}

test('JSON reissue preserves identity, nickname, memo and usage across restart while revoking old token', async t => {
  const { file, store } = await tempStore(t);
  const oldToken = 'old-secret-123456789012345678901234567890';
  const nextToken = 'new-secret-123456789012345678901234567890';
  const created = await store.create('우성', oldToken);
  await store.setNote(created.id, '개인 컴퓨터');
  const before = await store.validateAndRecord(oldToken);
  assert.equal(before.useCount, 1);
  const rotated = await store.rotateToken(created.id, nextToken);
  assert.equal(rotated.id, created.id);
  assert.equal(rotated.label, '우성');
  assert.equal(rotated.adminNote, '개인 컴퓨터');
  assert.equal(rotated.useCount, 1);
  assert.equal(rotated.createdAt, created.createdAt);
  assert.equal(rotated.lastUsedAt, before.lastUsedAt);
  assert.equal(rotated.revokedAt, null);
  assert.equal(await store.validateAndRecord(oldToken), null);
  const restarted = new JsonAccessStore(file);
  await restarted.init();
  assert.equal(await restarted.validateAndRecord(oldToken), null);
  const used = await restarted.validateAndRecord(nextToken);
  assert.equal(used.id, created.id);
  assert.equal(used.adminNote, '개인 컴퓨터');
  assert.equal(used.useCount, 2);
  assert.equal((await restarted.list()).length, 1);
  assert.ok(!(Object.keys((await restarted.list())[0]).includes('tokenHash')));
  const revoked = await restarted.revoke(created.id);
  assert.ok(revoked.revokedAt);
  assert.equal(await restarted.rotateToken(created.id, 'another-fresh-secret'), null);
  assert.equal(await restarted.validateAndRecord(nextToken), null);
  await restarted.restore(created.id);
  assert.equal((await restarted.validateAndRecord(nextToken)).id, created.id);
  assert.equal(await restarted.rotateToken('missing', 'never-issued'), null);
});

test('PostgreSQL rotation hashes replacement secret, atomically updates the active row and returns no secret', async () => {
  const calls = [];
  const store = new PostgresAccessStore('postgres://mock:mock@localhost:5432/mock');
  store.pool = { query: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ id: params[0], label: '기존 닉네임', admin_note: '관리자 전용', created_at: new Date('2026-09-01T00:00:00Z'), use_count: 14, revoked_at: null }] };
  }};
  const freshToken = 'raw-private-entry-token';
  const updated = await store.rotateToken('row-uuid', freshToken);
  assert.match(calls[0].sql, /UPDATE guest_access_keys SET token_hash = \$2/);
  assert.match(calls[0].sql, /WHERE id = \$1 AND revoked_at IS NULL/);
  assert.match(calls[0].sql, /RETURNING .*admin_note/);
  assert.deepEqual(calls[0].params, ['row-uuid', hashToken(freshToken)]);
  assert.equal(updated.id, 'row-uuid');
  assert.equal(updated.label, '기존 닉네임');
  assert.equal(updated.adminNote, '관리자 전용');
  assert.equal(updated.useCount, 14);
  assert.doesNotMatch(JSON.stringify(updated), /token|hash|secret/i);
});

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.on('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}

async function startServer(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'entry-reissue-server-'));
  const port = await getFreePort();
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir,
      DATABASE_URL: '', ADMIN_PASSWORD: 'test-reissue-password', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  proc.stdout.on('data', chunk => output += chunk.toString());
  proc.stderr.on('data', chunk => output += chunk.toString());
  t.after(async () => {
    proc.kill('SIGTERM');
    await new Promise(resolve => {
      if (proc.exitCode !== null) return resolve();
      proc.once('exit', resolve);
      setTimeout(resolve, 2000).unref();
    });
    await fs.rm(dir, { recursive: true, force: true });
  });
  let alive = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (proc.exitCode !== null) break;
    try { if ((await fetch(base + '/health')).ok) { alive = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(alive, `server did not start: ${output}`);
  async function req(route, method = 'GET', session, data) {
    const headers = {};
    if (session) headers['X-Session-Token'] = session;
    if (data !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, {
      method, headers, ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    });
    return { status: res.status, data: await res.json() };
  }
  async function enter(fileHtml) {
    const token = fileHtml.match(/name="token" value="([^"]+)"/)?.[1];
    assert.ok(token, 'entry HTML should contain its private token');
    const res = await fetch(base + '/guest-entry', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    });
    return { status: res.status, html: await res.text(), token };
  }
  return { req, enter };
}

test('only administrator can reissue: old entry and active session are invalidated, replacement works', { timeout: 25000 }, async t => {
  const { req, enter } = await startServer(t);
  const login = await req('/api/admin/login', 'POST', null, { password: 'test-reissue-password' });
  assert.equal(login.status, 200);
  const admin = login.data.sessionToken;
  const issued = await req('/api/admin/keys', 'POST', admin, { label: '지희' });
  assert.equal(issued.status, 201);
  const key = issued.data.key;
  const original = await enter(issued.data.html);
  assert.equal(original.status, 200);
  const guestSession = original.html.match(/data-session="([^"]+)"/)?.[1];
  assert.ok(guestSession);
  assert.equal((await req('/api/admin/keys/' + key.id + '/reissue', 'POST', guestSession)).status, 403);
  assert.equal((await req('/api/admin/keys/' + key.id + '/reissue', 'POST')).status, 401);
  const memo = await req(`/api/admin/keys/${key.id}/note`, 'POST', admin, { note: '첫 발급' });
  assert.equal(memo.status, 200);
  const before = (await req('/api/admin/keys', 'GET', admin)).data.keys.find(k => k.id === key.id);
  const reissued = await req(`/api/admin/keys/${key.id}/reissue`, 'POST', admin);
  assert.equal(reissued.status, 200);
  assert.equal(reissued.data.ok, true);
  assert.equal(reissued.data.key.id, key.id);
  assert.equal(reissued.data.key.label, key.label);
  assert.equal(reissued.data.key.adminNote, '첫 발급');
  assert.equal(reissued.data.key.createdAt, before.createdAt);
  assert.equal(reissued.data.key.useCount, before.useCount);
  assert.equal(reissued.data.fileName, issued.data.fileName);
  assert.notEqual(reissued.data.html, issued.data.html);
  assert.notEqual(reissued.data.html.match(/name="token" value="([^"]+)"/)[1], original.token);
  assert.doesNotMatch(JSON.stringify(reissued.data.key), /tokenHash|token_hash|rawToken/);
  assert.equal((await req('/api/session', 'GET', guestSession)).data.authenticated, false);
  assert.equal((await enter(issued.data.html)).status, 403);
  const replacement = await enter(reissued.data.html);
  assert.equal(replacement.status, 200);
  const replacementSession = replacement.html.match(/data-session="([^"]+)"/)?.[1];
  assert.ok(replacementSession);
  assert.equal((await req('/api/session', 'GET', replacementSession)).data.authenticated, true);
  const list = (await req('/api/admin/keys', 'GET', admin)).data.keys;
  assert.equal(list.length, 1);
  assert.equal(list[0].label, key.label);
  assert.equal(list[0].adminNote, '첫 발급');
  assert.doesNotMatch(JSON.stringify(list), /tokenHash|token_hash|rawToken/);
  assert.equal((await req(`/api/admin/keys/${key.id}/revoke`, 'POST', admin)).status, 200);
  assert.equal((await req(`/api/admin/keys/${key.id}/reissue`, 'POST', admin)).status, 404);
  assert.equal((await req(`/api/admin/keys/${key.id}/restore`, 'POST', admin)).status, 200);
  assert.equal((await req(`/api/admin/keys/${key.id}/reissue`, 'POST', admin)).status, 200);
  assert.equal((await req('/api/admin/keys/11111111-1111-4111-8111-111111111111/reissue', 'POST', admin)).status, 404);
});

test('administrator guest-key list exposes a visible reissue button and confirms invalidation', async () => {
  const app = await fs.readFile(path.join(__dirname, '..', 'public/app.js'), 'utf8');
  const html = await fs.readFile(path.join(__dirname, '..', 'public/index.html'), 'utf8');
  assert.match(app, /reissueBtn\.textContent = '재발급'/);
  assert.match(app, /actions\.append\(detailBtn, memoBtn, reissueBtn, revokeBtn\)/);
  assert.match(app, /confirm\(`\$\{label\} 입장파일을 재발급할까요\?/);
  assert.match(app, /api\/admin\/keys\/\$\{id\}\/reissue/);
  assert.match(html, /재발급 시 기존 파일과 접속은 즉시 무효화됩니다/);
  assert.match(html, /app\.js\?v=1\.6\.82/);
});
