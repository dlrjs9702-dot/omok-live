'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');

// v1.10.9 작명소: a paid nickname change -- Korean letters, digits and spaces only, unique across the game center with
// every space removed, 100,000P, 24 hours between changes, nothing taken when refused, one charge per request.
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const PASSWORD = 'nickname-test';

async function boot(t, dir) {
  const port = await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, DATABASE_URL: '', ADMIN_PASSWORD: PASSWORD, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', d => { logs += d; });
  child.stderr.on('data', d => { logs += d; });
  const stop = async () => {
    if (child.exitCode !== null) return;
    child.kill('SIGTERM');
    await new Promise(resolve => { child.once('exit', resolve); setTimeout(resolve, 4000).unref(); });
  };
  t.after(stop);
  for (let i = 0; i < 120 && child.exitCode === null; i += 1) {
    try { if ((await fetch(base + '/health')).ok) break; } catch {}
    await sleep(100);
  }
  let ip = 0;
  async function req(route, token, body) {
    const headers = { 'X-Forwarded-For': `10.66.${Math.floor(++ip / 200) % 200}.${ip % 200 + 1}` };
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }
  const admin = (await req('/api/admin/login', null, { password: PASSWORD })).data.sessionToken;
  assert.ok(admin, logs);
  const issue = async (label) => {
    const issued = await req('/api/admin/keys', admin, { label });
    return { id: issued.data.key.id, key: issued.data.html.match(/name="token" value="([^"]+)"/)[1] };
  };
  const enter = async ({ key }) => {
    const res = await fetch(base + '/guest-entry', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: key }).toString() });
    return (await res.text()).match(/data-session="([^"]+)"/)?.[1];
  };
  const release = (session) => req('/api/session/release', session, {});
  return { req, issue, enter, release, stop, logs: () => logs };
}

test('작명소: 형식·중복(공백 무시)·같은 이름·대기·잔액 부족은 차감 없이 거절, 성공은 한 번만 차감하고 바로 반영', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nickname-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir);
  const { req } = server;
  const [a, b, c] = [await server.issue('가나'), await server.issue('이 건'), await server.issue('다라')];
  const sa = await server.enter(a); const sb = await server.enter(b); const sc = await server.enter(c);
  assert.ok(sa && sb && sc, server.logs());
  const balance = async (s) => (await req('/api/donation', s)).data.balance;
  const rename = (s, name, requestId = crypto.randomUUID()) => req('/api/nickname', s, { name, requestId });
  const start = await balance(sa);
  assert.equal(start, 100_000);
  for (const bad of ['abc', '건!', '', '   ', '가나다라마바사아자차카타파']) assert.equal((await rename(sa, bad)).status, 400, bad);
  for (const taken of ['이건', ' 이  건 ', '관리 자']) assert.equal((await rename(sa, taken)).data.error, 'NAME_TAKEN', taken);
  assert.equal((await rename(sa, '가 나')).data.error, 'SAME_NAME');
  assert.equal(await balance(sa), start, '거절은 차감 없음');

  const requestId = crypto.randomUUID();
  const done = await rename(sa, ' 새 이름', requestId);
  assert.equal(done.status, 200, JSON.stringify(done.data));
  assert.equal(done.data.name, ' 새 이름', '입력한 공백 유지');
  assert.equal(await balance(sa), start - 100_000);
  assert.equal((await rename(sa, ' 새 이름', requestId)).status, 200, '같은 요청 재전송은 성공 응답');
  assert.equal(await balance(sa), start - 100_000, '한 번만 차감');
  assert.equal((await req('/api/nickname', sa)).data.name, ' 새 이름', '접속 중 세션에 바로 반영');
  assert.equal((await rename(sb, '새이름')).data.error, 'NAME_TAKEN', '바뀐 이름도 중복 판정');
  const wait = await rename(sa, '또 다른 이름');
  assert.equal(wait.data.error, 'NICKNAME_COOLDOWN'); assert.ok(wait.data.until);
  assert.equal(await balance(sa), start - 100_000, '대기 중 차감 없음');
  assert.ok((await req('/api/nickname', sa)).data.until);
  await req('/api/logout', sa, {}); // log out, then in again with the same entry file
  const again = await server.enter(a);
  assert.ok(again, '같은 입장 파일로 다시 접속');
  assert.equal((await req('/api/nickname', again)).data.name, ' 새 이름', '다시 접속해도 새 이름');

  // too few points: nothing taken
  assert.equal((await req('/api/donation', sc, { amount: 50_000, requestId: crypto.randomUUID() })).status, 200);
  assert.equal((await rename(sc, '부족')).data.error, 'INSUFFICIENT_POINTS');
  assert.equal(await balance(sc), 50_000);

  // two people asking for the same new name at the same moment: one gets it
  const both = await Promise.all([rename(sb, '동시 이름'), rename(sc, '동시이름')]);
  assert.deepEqual(both.map((r) => r.status).sort(), [200, 409], JSON.stringify(both.map((r) => r.data)));
});
