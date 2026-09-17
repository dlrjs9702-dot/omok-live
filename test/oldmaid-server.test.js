'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

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

test('Old Maid server protects hands, authorizes shuffles/draws and restores state on reconnect', { timeout: 30000 }, async t => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-center-oldmaid-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir,
      DATABASE_URL: '', ADMIN_PASSWORD: 'oldmaid-test-secret', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  proc.stdout.on('data', chunk => { output += chunk.toString(); });
  proc.stderr.on('data', chunk => { output += chunk.toString(); });
  t.after(async () => {
    proc.kill('SIGTERM');
    await new Promise(resolve => { if (proc.exitCode !== null) resolve(); else { proc.once('exit', resolve); setTimeout(resolve, 2000).unref(); } });
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  let started = false;
  for (let i = 0; i < 100; i++) {
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
    const r = await req('/api/admin/login', null, { password: 'oldmaid-test-secret' });
    assert.equal(r.status, 200);
    return r.data.sessionToken;
  }
  const host = await login();
  const other = await login();
  const spectator = await login();
  const created = await req('/api/rooms', host, { gameType: 'oldmaid' });
  assert.equal(created.status, 201);
  const code = created.data.state.me.roomCode;
  assert.equal((await req('/api/room/choose-role', host, { choice: '1' })).status, 200);
  assert.equal((await req('/api/room/start-oldmaid', host, {})).status, 409);
  assert.equal((await req('/api/rooms/join', other, { code })).status, 200);
  assert.equal((await req('/api/rooms/join', spectator, { code })).status, 200);
  assert.equal((await req('/api/room/choose-role', other, { choice: '2' })).status, 200);
  assert.equal((await req('/api/room/choose-role', spectator, { choice: 'spectator' })).status, 200);
  assert.equal((await req('/api/room/start-oldmaid', other, {})).status, 403);
  const startedGame = await req('/api/room/start-oldmaid', host, {});
  assert.equal(startedGame.status, 200);
  const g = startedGame.data.state.game;
  assert.equal(g.status, 'playing');
  assert.equal(g.seatOrder.length, 2);
  assert.equal(g.counts['1'] + g.counts['2'] + g.discardedPairs * 2, 53);
  assert.equal(JSON.stringify(g).includes('"hands"'), false);
  assert.equal(JSON.stringify(g).includes('"rank"'), false);
  const hostView = (await req('/api/room', host, undefined, 'GET')).data.state;
  const otherView = (await req('/api/room', other, undefined, 'GET')).data.state;
  const spectatorView = (await req('/api/room', spectator, undefined, 'GET')).data.state;
  assert.equal(hostView.me.myOldMaidHand.length, g.counts['1']);
  assert.equal(otherView.me.myOldMaidHand.length, g.counts['2']);
  assert.equal(spectatorView.me.myOldMaidHand, null);
  assert.equal(JSON.stringify(spectatorView.game).includes('"rank"'), false);
  assert.equal(JSON.stringify(hostView.game).includes('"hands"'), false);
  assert.equal((await req('/api/room/shuffle-oldmaid', spectator, { expectedRevision: g.revision })).status, 403);
  assert.equal((await req('/api/room/draw-oldmaid', spectator, { targetSeat: g.target, index: 0, expectedRevision: g.revision })).status, 403);
  assert.equal((await req('/api/room/shuffle-oldmaid', host, { expectedRevision: -1 })).status, 409);
  const targetToken = g.target === '1' ? host : other;
  const actorToken = g.turn === '1' ? host : other;
  const shuffled = await req('/api/room/shuffle-oldmaid', targetToken, { expectedRevision: g.revision });
  assert.equal(shuffled.status, 200);
  assert.equal(shuffled.data.state.game.revision, g.revision + 1);
  const stale = await req('/api/room/draw-oldmaid', actorToken, { targetSeat: g.target, index: 0, expectedRevision: g.revision });
  assert.equal(stale.status, 409);
  const refreshed = (await req('/api/room', targetToken, undefined, 'GET')).data.state;
  assert.deepEqual(refreshed.me.myOldMaidHand, shuffled.data.state.me.myOldMaidHand);
  assert.equal(refreshed.game.revision, g.revision + 1);
  const badTarget = await req('/api/room/draw-oldmaid', actorToken, { targetSeat: g.turn, index: 0, expectedRevision: refreshed.game.revision });
  assert.equal(badTarget.status, 409);
  const drawn = await req('/api/room/draw-oldmaid', actorToken, { targetSeat: g.target, index: 0, expectedRevision: refreshed.game.revision });
  assert.equal(drawn.status, 200);
  assert.equal(drawn.data.state.game.moveCount, 1);
  assert.equal(drawn.data.state.game.revision, g.revision + 2);
  assert.equal((await req('/api/room/draw-oldmaid', actorToken, { targetSeat: g.target, index: 0, expectedRevision: refreshed.game.revision })).status, 409);
  const after = (await req('/api/room', spectator, undefined, 'GET')).data.state;
  assert.equal(JSON.stringify(after.game).includes('"hands"'), false);
  assert.equal(JSON.stringify(after.game).includes('"rank"'), false);
  assert.equal(after.game.history.length, 1);
  assert.equal((await req('/api/room/move', actorToken, { x: 0, y: 0 })).status, 400);
  assert.equal((await req('/api/room/resign', actorToken, {})).status, 400);
});
