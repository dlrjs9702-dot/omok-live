'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

test('Yut Nori, Dots and Boxes, and Land King use protected multiplayer room actions', { timeout: 30000 }, async t => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-center-new-games-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir,
      DATABASE_URL: '', ADMIN_PASSWORD: 'new-games-test-password', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  proc.stdout.on('data', chunk => output += chunk.toString());
  proc.stderr.on('data', chunk => output += chunk.toString());
  t.after(async () => {
    proc.kill('SIGTERM');
    await new Promise(resolve => { if (proc.exitCode !== null) resolve(); else { proc.once('exit', resolve); setTimeout(resolve, 2000).unref(); } });
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  let started = false;
  for (let i = 0; i < 100; i += 1) {
    if (proc.exitCode !== null) break;
    try { if ((await fetch(`${base}/health`)).ok) { started = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(started, `Server did not start: ${output}`);

  async function req(route, token, body, method = 'POST') {
    const headers = {};
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(base + route, { method, headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  async function login() {
    const response = await req('/api/admin/login', null, { password: 'new-games-test-password' });
    assert.equal(response.status, 200);
    return response.data.sessionToken;
  }

  const yHost = await login();
  const yPlayer = await login();
  const yWatcher = await login();
  const yRoom = await req('/api/rooms', yHost, { gameType: 'yut', visibility: 'public' });
  assert.equal(yRoom.status, 201);
  assert.equal((await req('/api/rooms/public/join', yPlayer, { roomId: (await req('/api/rooms/public', yPlayer, undefined, 'GET')).data.rooms.find(room => room.gameType === 'yut').id })).status, 200);
  assert.equal((await req('/api/rooms/join', yWatcher, { code: yRoom.data.state.me.roomCode })).status, 200);
  await req('/api/room/choose-role', yHost, { choice: 'black' });
  const yStarted = await req('/api/room/choose-role', yPlayer, { choice: 'white' });
  assert.equal(yStarted.data.state.game.status, 'playing');
  assert.equal((await req('/api/room/throw-yut', yWatcher, {})).status, 403);
  assert.equal((await req('/api/room/throw-yut', yPlayer, {})).status, 409);
  const thrown = await req('/api/room/throw-yut', yHost, {});
  assert.equal(thrown.status, 200);
  assert.equal(thrown.data.state.game.phase, 'move');
  const pieceId = thrown.data.state.game.legalMoves[0].pieceId;
  assert.equal((await req('/api/room/move-yut', yHost, { pieceId })).status, 200);

  await req('/api/room/leave', yPlayer, {});
  await req('/api/room/leave', yWatcher, {});
  const dHost = yHost;
  const dPlayer = yPlayer;
  const dWatcher = yWatcher;
  const dRoom = await req('/api/rooms', dHost, { gameType: 'dots', visibility: 'private' });
  assert.equal((await req('/api/rooms/join', dPlayer, { code: dRoom.data.state.me.roomCode })).status, 200);
  assert.equal((await req('/api/rooms/join', dWatcher, { code: dRoom.data.state.me.roomCode })).status, 200);
  await req('/api/room/choose-role', dHost, { choice: 'black' });
  const dStarted = await req('/api/room/choose-role', dPlayer, { choice: 'white' });
  assert.equal(dStarted.data.state.game.legalEdges.length, 40);
  assert.equal((await req('/api/room/move', dWatcher, { x: 0, y: 0 })).status, 403);
  assert.equal((await req('/api/room/move', dPlayer, { x: 0, y: 0 })).status, 409);
  const firstLine = await req('/api/room/move', dHost, { x: 0, y: 0 });
  assert.equal(firstLine.status, 200);
  assert.equal(firstLine.data.state.game.turn, 'white');
  assert.equal(firstLine.data.state.game.legalEdges.length, 39);
  assert.equal((await req('/api/room/move', dPlayer, { x: 0, y: 0 })).status, 409);

  await req('/api/room/leave', dHost, {});
  await req('/api/room/leave', dPlayer, {});
  await req('/api/room/leave', dWatcher, {});
  const cHost = dHost;
  const cPlayer = dPlayer;
  const cWatcher = dWatcher;
  const cRoom = await req('/api/rooms', cHost, { gameType: 'cityking', visibility: 'public' });
  assert.equal(cRoom.status, 201);
  const cityRoomId = (await req('/api/rooms/public', cPlayer, undefined, 'GET')).data.rooms.find(room => room.gameType === 'cityking').id;
  assert.equal((await req('/api/rooms/public/join', cPlayer, { roomId: cityRoomId })).status, 200);
  assert.equal((await req('/api/rooms/join', cWatcher, { code: cRoom.data.state.me.roomCode })).status, 200);
  await req('/api/room/choose-role', cHost, { choice: 'black' });
  const cStarted = await req('/api/room/choose-role', cPlayer, { choice: 'white' });
  assert.equal(cStarted.data.state.game.status, 'playing');
  assert.equal((await req('/api/room/roll-city', cWatcher, {})).status, 403);
  assert.equal((await req('/api/room/roll-city', cPlayer, {})).status, 409);
  const cityRoll = await req('/api/room/roll-city', cHost, {});
  assert.equal(cityRoll.status, 200);
  assert.ok(cityRoll.data.state.game.lastRoll.total >= 2);

  const health = await req('/health', null, undefined, 'GET');
  assert.equal(health.data.version, '1.6.22');
  assert.ok(health.data.games.includes('yut'));
  assert.ok(health.data.games.includes('dots'));
  assert.ok(health.data.games.includes('cityking'));
});
