'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');

// v1.6.40: connection-drop handling, generalized from the omok2v2-only pause/end-game mechanism
// to every game. This file exercises the two structurally distinct cases the user confirmed:
// a plain 2-seat game (single opponent disconnects -> normal win/loss) and a 3+ player
// free-for-all (any one seat disconnecting -> all still-connected seats recorded as wins).
// The omok2v2 team-unit case is covered in test/omok-team.test.js, next to the rest of its suite.

async function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); });
  });
}

async function serverFixture(t) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'conn-drop-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir,
      DATABASE_URL: '', ADMIN_PASSWORD: 'conn-drop-test', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', data => logs += data.toString());
  child.stderr.on('data', data => logs += data.toString());
  t.after(async () => {
    child.kill('SIGTERM');
    await new Promise(resolve => {
      if (child.exitCode !== null) return resolve();
      child.once('exit', resolve);
      setTimeout(resolve, 2000).unref();
    });
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) break;
    try { if ((await fetch(base + '/health')).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, logs);
  async function req(route, token, body, method = 'POST') {
    const headers = {};
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method, headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json() };
  }
  const login = await req('/api/admin/login', null, { password: 'conn-drop-test' });
  assert.equal(login.status, 200);
  const admin = login.data.sessionToken;
  async function enter(key) {
    const res = await fetch(base + '/guest-entry', { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: key }).toString() });
    assert.equal(res.status, 200);
    return (await res.text()).match(/data-session="([^"]+)"/)[1];
  }
  async function guest(label) {
    const issued = await req('/api/admin/keys', admin, { label });
    assert.equal(issued.status, 201);
    const key = issued.data.html.match(/name="token" value="([^"]+)"/)[1];
    return { key, session: await enter(key) };
  }
  return { req, enter, guest };
}

test('a paused 2-seat game (othello): any connected participant can end it, and a later reconnect does not overturn the result', { timeout: 35000 }, async t => {
  const { req, enter, guest } = await serverFixture(t);
  const a = await guest('가');
  const b = await guest('나');
  assert.equal((await req('/api/rooms', a.session, { gameType: 'othello', visibility: 'public' })).status, 201);
  const rid = (await req('/api/rooms/public', b.session, undefined, 'GET')).data.rooms[0].id;
  assert.equal((await req('/api/rooms/public/join', b.session, { roomId: rid })).status, 200);
  assert.equal((await req('/api/room/choose-role', a.session, { choice: 'black' })).status, 200);
  assert.equal((await req('/api/room/choose-role', b.session, { choice: 'white' })).status, 200);
  let state = (await req('/api/room', a.session, undefined, 'GET')).data.state;
  assert.equal(state.game.status, 'playing');
  assert.equal(state.game.paused, false);

  // b's connection drops (session fully expires, the same signal a genuine network drop produces).
  assert.equal((await req('/api/logout', b.session, {})).status, 200);
  state = (await req('/api/room', a.session, undefined, 'GET')).data.state;
  assert.equal(state.game.paused, true);
  assert.deepEqual(state.game.disconnectedSeats, ['white']);

  // a (the only one left) can end it without anyone else's approval.
  const ended = await req('/api/room/end-game', a.session, {});
  assert.equal(ended.status, 200);
  state = (await req('/api/room', a.session, undefined, 'GET')).data.state;
  assert.equal(state.game.status, 'finished');
  assert.equal(state.game.winner, 'black');
  assert.equal(state.game.endReason, 'disconnect');
  assert.deepEqual(state.game.disconnectedAtEnd, ['white']);
  assert.equal(state.game.paused, false);

  // Idempotent: it can't be triggered a second time.
  assert.equal((await req('/api/room/end-game', a.session, {})).data.error, 'NOT_PAUSED');

  // b reconnects afterward. Guest-entry only auto-rejoins a room that is still 'playing' (there is
  // nothing left to resume once a match is finished), so b lands back in the lobby -- that is
  // correct, pre-existing behavior, not something this feature changes. What matters here is that
  // the already-recorded result stays exactly as it was when checked from a's still-connected view.
  b.session = await enter(b.key);
  const afterReconnect = (await req('/api/room', b.session, undefined, 'GET')).data.state;
  assert.equal(afterReconnect, null);
  const stillFinished = (await req('/api/room', a.session, undefined, 'GET')).data.state;
  assert.equal(stillFinished.game.status, 'finished');
  assert.equal(stillFinished.game.winner, 'black');
});

test('a spectator cannot end a paused game', { timeout: 35000 }, async t => {
  const { req, guest } = await serverFixture(t);
  const a = await guest('가');
  const b = await guest('나');
  const spectator = await guest('관전');
  assert.equal((await req('/api/rooms', a.session, { gameType: 'connect4', visibility: 'public' })).status, 201);
  const rid = (await req('/api/rooms/public', b.session, undefined, 'GET')).data.rooms[0].id;
  assert.equal((await req('/api/rooms/public/join', b.session, { roomId: rid })).status, 200);
  assert.equal((await req('/api/rooms/public/join', spectator.session, { roomId: rid })).status, 200);
  assert.equal((await req('/api/room/choose-role', a.session, { choice: 'black' })).status, 200);
  assert.equal((await req('/api/room/choose-role', b.session, { choice: 'white' })).status, 200);
  assert.equal((await req('/api/logout', b.session, {})).status, 200);
  assert.equal((await req('/api/room', a.session, undefined, 'GET')).data.state.game.paused, true);
  assert.equal((await req('/api/room/end-game', spectator.session, {})).data.error, 'SPECTATOR');
});

test('a 3+ player free-for-all (bingo): ending a paused match records every still-connected seat as a win', { timeout: 35000 }, async t => {
  const { req, guest } = await serverFixture(t);
  const a = await guest('가');
  const b = await guest('나');
  const c = await guest('다');
  assert.equal((await req('/api/rooms', a.session, { gameType: 'bingo', visibility: 'public' })).status, 201);
  const rid = (await req('/api/rooms/public', b.session, undefined, 'GET')).data.rooms[0].id;
  assert.equal((await req('/api/rooms/public/join', b.session, { roomId: rid })).status, 200);
  assert.equal((await req('/api/rooms/public/join', c.session, { roomId: rid })).status, 200);
  assert.equal((await req('/api/room/choose-role', a.session, { choice: '1' })).status, 200);
  assert.equal((await req('/api/room/choose-role', b.session, { choice: '2' })).status, 200);
  assert.equal((await req('/api/room/choose-role', c.session, { choice: '3' })).status, 200);
  assert.equal((await req('/api/room/start-bingo', a.session, {})).status, 200);
  let state = (await req('/api/room', a.session, undefined, 'GET')).data.state;
  assert.equal(state.game.status, 'playing');

  // c's connection drops -- a and b are both still connected and both still mid-match.
  assert.equal((await req('/api/logout', c.session, {})).status, 200);
  state = (await req('/api/room', a.session, undefined, 'GET')).data.state;
  assert.equal(state.game.paused, true);
  assert.deepEqual(state.game.disconnectedSeats, ['3']);

  const ended = await req('/api/room/end-game', b.session, {});
  assert.equal(ended.status, 200);
  state = (await req('/api/room', a.session, undefined, 'GET')).data.state;
  assert.equal(state.game.status, 'finished');
  // Per the user's confirmed rule: every still-connected seat (both 1 and 2, not just the one
  // who clicked end-game) is recorded as a win; the disconnected seat 3 is the only loss.
  assert.deepEqual([...state.game.winner].sort(), ['1', '2']);
  assert.equal(state.game.endReason, 'disconnect');
  assert.deepEqual(state.game.disconnectedAtEnd, ['3']);
});
