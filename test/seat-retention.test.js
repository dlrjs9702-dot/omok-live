'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');

// IDEAS backlog 6: a seated player whose page merely dropped or refreshed keeps the seat through the next round
// (the rematch) and gets it back on re-entry; only an explicit 접속 종료 (logout) gives the seat up once that match ended.

async function freePort() {
  const s = net.createServer();
  await new Promise(resolve => s.listen(0, '127.0.0.1', resolve));
  const { port } = s.address();
  await new Promise(resolve => s.close(resolve));
  return port;
}

async function serverFixture(t) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seat-retention-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, DATABASE_URL: '', ADMIN_PASSWORD: 'seat-test',
      NODE_ENV: 'test', SESSION_RELEASE_GRACE_MS: '1000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', data => { logs += data; });
  child.stderr.on('data', data => { logs += data; });
  t.after(async () => {
    child.kill('SIGTERM');
    await new Promise(resolve => { if (child.exitCode !== null) return resolve(); child.once('exit', resolve); setTimeout(resolve, 2000).unref(); });
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  let ready = false;
  for (let i = 0; i < 120 && child.exitCode === null; i += 1) {
    try { if ((await fetch(base + '/health')).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, logs);
  let ip = 1;
  async function req(route, token, body, method = 'POST') {
    const headers = { 'X-Forwarded-For': `10.98.0.${ip++}` };
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json() };
  }
  const admin = (await req('/api/admin/login', null, { password: 'seat-test' })).data.sessionToken;
  async function enter(key) {
    const res = await fetch(base + '/guest-entry', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-For': `10.99.0.${ip++}` },
      body: new URLSearchParams({ token: key }).toString() });
    assert.equal(res.status, 200);
    return (await res.text()).match(/data-session="([^"]+)"/)[1];
  }
  async function guest(label) {
    const issued = await req('/api/admin/keys', admin, { label });
    const key = issued.data.html.match(/name="token" value="([^"]+)"/)[1];
    return { key, session: await enter(key) };
  }
  return { req, enter, guest };
}

// Three players seated 1/2/3 in a started bingo match; `c` (seat 3) then loses the connection the given way.
async function threeInAMatch(t, dropVia) {
  const fx = await serverFixture(t);
  const { req, guest } = fx;
  const a = await guest('가'); const b = await guest('나'); const c = await guest('다');
  assert.equal((await req('/api/rooms', a.session, { gameType: 'bingo', visibility: 'public' })).status, 201);
  const rid = (await req('/api/rooms/public', b.session, undefined, 'GET')).data.rooms[0].id;
  for (const who of [b, c]) assert.equal((await req('/api/rooms/public/join', who.session, { roomId: rid })).status, 200);
  for (const [who, seat] of [[a, '1'], [b, '2'], [c, '3']]) assert.equal((await req('/api/room/choose-role', who.session, { choice: seat })).status, 200);
  assert.equal((await req('/api/room/start-bingo', a.session, {})).status, 200);
  await dropVia(fx, c);
  let state = (await req('/api/room', a.session, undefined, 'GET')).data.state;
  assert.equal(state.game.paused, true);
  assert.deepEqual(state.game.disconnectedSeats, ['3']);
  assert.equal((await req('/api/room/end-game', b.session, {})).status, 200); // the others end the paused match
  assert.equal((await req('/api/room/next-round', a.session, {})).status, 200); // and start the next round (rematch)
  state = (await req('/api/room', a.session, undefined, 'GET')).data.state;
  assert.equal(state.game.status, 'selecting');
  return { ...fx, a, b, c, nextRound: state };
}

test('a refresh/dropped page keeps its seat through the next round and gets it back on re-entry', { timeout: 40_000 }, async t => {
  const { req, enter, c, nextRound } = await threeInAMatch(t, async ({ req: request }, player) => {
    assert.equal((await request('/api/session/release', null, { sessionToken: player.session })).status, 200); // pagehide
    await new Promise(resolve => setTimeout(resolve, 1700)); // past the 1 s release grace
  });
  assert.ok(nextRound.players['3'], '다른 참가자 화면에서도 3번 좌석은 끊긴 사람 몫으로 남아 있다');
  const back = await enter(c.key);
  const mine = (await req('/api/room', back, undefined, 'GET')).data.state;
  assert.equal(mine?.me?.seat, '3', '끊겼다 돌아온 사람은 다음 판에서도 같은 좌석');
});

test('an explicit logout gives the seat up once that match has ended (existing rule)', { timeout: 40_000 }, async t => {
  const { req, enter, a, c, nextRound } = await threeInAMatch(t, async ({ req: request }, player) => {
    assert.equal((await request('/api/logout', player.session, {})).status, 200);
  });
  // PR #76 review: a null room state for the returning session alone would pass the check below, so the seat itself is
  // checked in the room as the other players see it.
  assert.equal(nextRound.players['3'], null, '다른 참가자 화면에서 3번 좌석이 실제로 비었다');
  const back = await enter(c.key);
  const mine = (await req('/api/room', back, undefined, 'GET')).data.state;
  assert.notEqual(mine?.me?.seat, '3', '접속 종료한 사람의 좌석은 다음 판에 비워진다');
  assert.equal((await req('/api/room', a.session, undefined, 'GET')).data.state.players['3'], null, '다시 들어온 뒤에도 좌석은 비어 있다');
});
