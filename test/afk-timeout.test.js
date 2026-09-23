'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');

// A seat that's still connected but sits on its own turn for a full minute is folded into the
// exact same pause/end-game mechanism as a genuine connection drop (server.js syncGamePause).
// AFK_TIMEOUT_MS/AFK_TICK_MS are overridable via env purely so this test doesn't have to wait a
// real minute; production always uses the 60s/5s defaults.

async function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); });
  });
}

async function serverFixture(t, extraEnv = {}) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'afk-timeout-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir,
      DATABASE_URL: '', ADMIN_PASSWORD: 'afk-timeout-test', NODE_ENV: 'test',
      AFK_TIMEOUT_MS: '250', AFK_TICK_MS: '80', ...extraEnv },
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
  for (let i = 0; i < 120; i += 1) {
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
    let data = {};
    try { data = await res.json(); } catch {}
    return { status: res.status, data };
  }
  async function login() {
    const r = await req('/api/admin/login', null, { password: 'afk-timeout-test' });
    assert.equal(r.status, 200);
    return r.data.sessionToken;
  }
  return { req, login };
}

test('a connected seat that sits on its own turn past the AFK timeout is paused exactly like a disconnect', { timeout: 30000 }, async t => {
  const { req, login } = await serverFixture(t);
  const a = await login();
  const b = await login();
  assert.equal((await req('/api/rooms', a, { gameType: 'othello', visibility: 'public' })).status, 201);
  const rid = (await req('/api/rooms/public', b, undefined, 'GET')).data.rooms[0].id;
  assert.equal((await req('/api/rooms/public/join', b, { roomId: rid })).status, 200);
  assert.equal((await req('/api/room/choose-role', a, { choice: 'black' })).status, 200);
  assert.equal((await req('/api/room/choose-role', b, { choice: 'white' })).status, 200);
  let state = (await req('/api/room', a, undefined, 'GET')).data.state;
  assert.equal(state.game.status, 'playing');
  assert.equal(state.game.turn, 'black');
  assert.equal(state.game.paused, false);

  // Nobody acts. Neither seat disconnects -- both sessions stay fully alive throughout.
  await new Promise(resolve => setTimeout(resolve, 700));
  state = (await req('/api/room', b, undefined, 'GET')).data.state;
  assert.equal(state.game.paused, true);
  assert.deepEqual(state.game.disconnectedSeats, ['black']);

  // The idle seat is still fully connected, yet is blocked exactly like a real disconnect would
  // block it -- move is rejected with the same GAME_PAUSED code a dropped opponent produces.
  const blocked = await req('/api/room/move', a, { x: 2, y: 3 });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.data.error, 'GAME_PAUSED');

  // The other (fully responsive) side can end it at any time, exactly as with a disconnect --
  // no separate confirmation state, no need to have clicked "wait" first.
  const ended = await req('/api/room/end-game', b, {});
  assert.equal(ended.status, 200);
  state = (await req('/api/room', b, undefined, 'GET')).data.state;
  assert.equal(state.game.status, 'finished');
  assert.equal(state.game.winner, 'white');
  assert.equal(state.game.endReason, 'disconnect');
  assert.deepEqual(state.game.disconnectedAtEnd, ['black']);
  assert.equal(state.game.paused, false);
});

test('a free-for-all numbered-seat game (bingo) gets the same AFK pause for whichever seat is up', { timeout: 30000 }, async t => {
  const { req, login } = await serverFixture(t);
  const a = await login();
  const b = await login();
  const c = await login();
  assert.equal((await req('/api/rooms', a, { gameType: 'bingo', visibility: 'public' })).status, 201);
  const rid = (await req('/api/rooms/public', b, undefined, 'GET')).data.rooms[0].id;
  assert.equal((await req('/api/rooms/public/join', b, { roomId: rid })).status, 200);
  assert.equal((await req('/api/rooms/public/join', c, { roomId: rid })).status, 200);
  assert.equal((await req('/api/room/choose-role', a, { choice: '1' })).status, 200);
  assert.equal((await req('/api/room/choose-role', b, { choice: '2' })).status, 200);
  assert.equal((await req('/api/room/choose-role', c, { choice: '3' })).status, 200);
  assert.equal((await req('/api/room/start-bingo', a, {})).status, 200);
  let state = (await req('/api/room', a, undefined, 'GET')).data.state;
  assert.equal(state.game.status, 'playing');
  const idleSeat = state.game.turn;
  assert.ok(['1', '2', '3'].includes(idleSeat));

  await new Promise(resolve => setTimeout(resolve, 700));
  state = (await req('/api/room', a, undefined, 'GET')).data.state;
  assert.equal(state.game.paused, true);
  assert.deepEqual(state.game.disconnectedSeats, [idleSeat]);

  const otherSeat = ['1', '2', '3'].find(s => s !== idleSeat);
  const otherToken = { '1': a, '2': b, '3': c }[otherSeat];
  const ended = await req('/api/room/end-game', otherToken, {});
  assert.equal(ended.status, 200);
  state = (await req('/api/room', otherToken, undefined, 'GET')).data.state;
  assert.equal(state.game.status, 'finished');
  assert.deepEqual(state.game.disconnectedAtEnd, [idleSeat]);
});

test('Twenty Questions skips an idle challenger turn instead of pausing the whole room', { timeout: 30000 }, async t => {
  const { req, login } = await serverFixture(t);
  const a = await login();
  const b = await login();
  const cToken = await login();
  assert.equal((await req('/api/rooms', a, { gameType: 'twentyquestions', visibility: 'public' })).status, 201);
  const rid = (await req('/api/rooms/public', b, undefined, 'GET')).data.rooms[0].id;
  assert.equal((await req('/api/rooms/public/join', b, { roomId: rid })).status, 200);
  assert.equal((await req('/api/rooms/public/join', cToken, { roomId: rid })).status, 200);
  assert.equal((await req('/api/room/choose-role', a, { choice: '1' })).status, 200);
  assert.equal((await req('/api/room/choose-role', b, { choice: '2' })).status, 200);
  assert.equal((await req('/api/room/choose-role', cToken, { choice: '3' })).status, 200);
  assert.equal((await req('/api/room/twenty-start', a, { mode: 'individual', totalRounds: 1 })).status, 200);
  assert.equal((await req('/api/room/twenty-secret', a, { secret: '정답' })).status, 200);

  let state = (await req('/api/room', a, undefined, 'GET')).data.state;
  assert.equal(state.game.turnSeat, '2');
  assert.equal(state.game.questionsUsed, 0);

  await new Promise(resolve => setTimeout(resolve, 700));

  state = (await req('/api/room', a, undefined, 'GET')).data.state;
  assert.equal(state.game.turnSeat, '3');
  assert.equal(state.game.questionsUsed, 0);
  assert.ok(state.chat.messages.some(row => row.type === 'system' && /입력 시간이 지나 다음 도전자로/.test(row.text)));
  const nextAction = await req('/api/room/twenty-question', cToken, { question: '다음 도전자 질문' });
  assert.equal(nextAction.status, 200);
  assert.equal(nextAction.data.state.game.pendingQuestion.seat, '3');
});

test('liar, pictionary and marathon are exempt from the AFK watch (they already run their own phase-deadline tick)', { timeout: 30000 }, async t => {
  const { req, login } = await serverFixture(t);
  const tokens = [await login(), await login(), await login()];
  const created = await req('/api/rooms', tokens[0], { gameType: 'liar' });
  assert.equal(created.status, 201);
  const code = created.data.state.me.roomCode;
  for (let i = 1; i < 3; i += 1) assert.equal((await req('/api/rooms/join', tokens[i], { code })).status, 200);
  for (let i = 0; i < 3; i += 1) assert.equal((await req('/api/room/choose-role', tokens[i], { choice: String(i + 1) })).status, 200);
  assert.equal((await req('/api/room/start-liar', tokens[0], {})).status, 200);
  let state = (await req('/api/room', tokens[0], undefined, 'GET')).data.state;
  assert.equal(state.game.status, 'playing');

  // Long past the (overridden, 250ms) AFK timeout -- liar's own hint deadline is a much longer,
  // non-overridden 60s, so nobody has actually failed to respond by liar's own rules yet. The AFK
  // watch must not jump in and pause it anyway.
  await new Promise(resolve => setTimeout(resolve, 700));
  state = (await req('/api/room', tokens[0], undefined, 'GET')).data.state;
  assert.equal(state.game.status, 'playing');
  assert.equal(state.game.paused, false);
  assert.deepEqual(state.game.disconnectedSeats, []);
});
