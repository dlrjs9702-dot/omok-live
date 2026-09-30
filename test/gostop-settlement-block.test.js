'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

// IDEAS backlog 4: the next hand of 고스톱·맞고 must not start until the finished hand's points are settled.
test('고스톱 정산이 실패하는 동안 다음 판은 시작되지 않고, 복구 뒤 정산은 한 번만 반영된다', { timeout: 40_000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gostop-settle-block-'));
  const port = await freePort();
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, DATABASE_URL: '', ADMIN_PASSWORD: 'gostop-test', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  proc.stdout.on('data', data => { output += data; });
  proc.stderr.on('data', data => { output += data; });
  t.after(async () => { proc.kill('SIGTERM'); await new Promise(resolve => proc.once('exit', resolve)); await fs.rm(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i += 1) {
    try { if ((await fetch(`${base}/health`)).ok) break; } catch {}
    if (proc.exitCode !== null) throw new Error(output);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  let ip = 1;
  async function api(route, token, body, method = 'POST') {
    const res = await fetch(base + route, {
      method,
      headers: { 'X-Forwarded-For': `10.96.0.${ip++}`, ...(token ? { 'X-Session-Token': token } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, data: await res.json() };
  }
  const admin = (await api('/api/admin/login', null, { password: 'gostop-test' })).data.sessionToken;
  const people = [];
  for (let i = 1; i <= 2; i += 1) {
    const issued = await api('/api/admin/keys', admin, { label: `참가자${i}` });
    const entry = await fetch(`${base}/guest-entry`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-For': `10.97.0.${i}` },
      body: new URLSearchParams({ token: issued.data.html.match(/name="token" value="([^"]+)"/)[1] }).toString() });
    people.push((await entry.text()).match(/data-session="([^"]+)"/)[1]);
  }
  const code = (await api('/api/rooms', people[0], { gameType: 'gostop' })).data.state.me.roomCode;
  assert.equal((await api('/api/rooms/join', people[1], { code })).status, 200);
  for (let i = 0; i < 2; i += 1) assert.equal((await api('/api/room/choose-role', people[i], { choice: String(i + 1) })).status, 200);
  assert.equal((await api('/api/test/gostop-fixture', people[0], { fixture: 'go-bak' })).status, 200);
  assert.equal((await api('/api/room/gostop-decide', people[0], { choice: 'go' })).status, 200);
  assert.equal((await api('/api/room/gostop-play', people[1], { cardId: 'm03-ribbon' })).status, 200);
  const balance = async i => (await api('/api/points', people[i], undefined, 'GET')).data.balance;
  const before = [await balance(0), await balance(1)];

  const round = (await api('/api/room', people[0], undefined, 'GET')).data.state.game.round;

  // The winner stops while every settlement attempt fails (more failures than the automatic retries can use up).
  assert.equal((await api('/api/test/points-fault', admin, { settleFail: 20 })).status, 200);
  await api('/api/room/gostop-decide', people[1], { choice: 'stop' });
  assert.deepEqual([await balance(0), await balance(1)], before, '실패한 정산은 포인트를 옮기지 않는다');

  // The next hand is refused (503), however often it is asked.
  for (let i = 0; i < 2; i += 1) {
    const blocked = await api('/api/room/next-round', people[0], {});
    assert.equal(blocked.status, 503, JSON.stringify(blocked.data));
  }
  assert.deepEqual([await balance(0), await balance(1)], before);

  // v1.7.32: opening the room still works during the failure (it used to answer 503 too, so a refresh showed nothing):
  // the finished hand is shown with its settlement not done yet, and no points moved.
  for (const person of people) {
    const view = await api('/api/room', person, undefined, 'GET');
    assert.equal(view.status, 200, JSON.stringify(view.data));
    assert.deepEqual([view.data.state.game.status, view.data.state.game.round], ['finished', round]);
    assert.notEqual(view.data.state.game.settlement?.status, 'done');
  }
  assert.deepEqual([await balance(0), await balance(1)], before);

  // Once the fault clears, the finished hand (still the same round, never replaced) settles exactly once.
  assert.equal((await api('/api/test/points-fault', admin, { settleFail: 0 })).status, 200);
  const finished = (await api('/api/room', people[0], undefined, 'GET')).data.state.game;
  assert.deepEqual([finished.status, finished.round, finished.settlement?.status], ['finished', round, 'done']);
  const after = [await balance(0), await balance(1)];
  assert.ok(after[1] > before[1] && after[0] < before[0], '승자(2번 자리)에게 정산되었다');
  assert.ok(after[0] + after[1] < before[0] + before[1], '소각분만큼 총량이 줄었다');

  const next = await api('/api/room/next-round', people[0], {});
  assert.equal(next.status, 200, JSON.stringify(next.data));
  assert.equal(next.data.state.game.round, round + 1);
  assert.deepEqual([await balance(0), await balance(1)], after, '다음 판을 시작해도 추가 정산 없음(이중 정산 없음)');
});
