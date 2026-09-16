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

test('two-player baseball API keeps secrets private, validates roles and resets the next round', { timeout: 25000 }, async t => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-center-baseball-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir,
      DATABASE_URL: '', ADMIN_PASSWORD: 'baseball-test-secret', NODE_ENV: 'test' },
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
  for (let i = 0; i < 90; i += 1) {
    if (proc.exitCode !== null) break;
    try { const res = await fetch(`${base}/health`); if (res.ok) { started = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(started, `test server failed to start: ${output}`);

  async function req(route, token, body, method = 'POST') {
    const headers = {};
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method, headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json() };
  }
  async function login() {
    const response = await req('/api/admin/login', null, { password: 'baseball-test-secret' });
    assert.equal(response.status, 200);
    return response.data.sessionToken;
  }
  const host = await login();
  const challenger = await login();
  const spectator = await login();
  const created = await req('/api/rooms', host, { gameType: 'baseball' });
  assert.equal(created.status, 201);
  assert.equal(created.data.state.gameType, 'baseball');
  const code = created.data.state.me.roomCode;
  assert.ok(code);
  assert.equal((await req('/api/rooms/join', challenger, { code })).status, 200);
  assert.equal((await req('/api/rooms/join', spectator, { code })).status, 200);
  assert.equal((await req('/api/room/choose-role', host, { choice: 'black' })).status, 200);
  const ready = await req('/api/room/choose-role', challenger, { choice: 'white' });
  assert.equal(ready.data.state.game.status, 'setup');
  assert.equal((await req('/api/room/set-secret', spectator, { secret: '987' })).status, 403);
  assert.equal((await req('/api/room/guess', spectator, { guess: '123' })).status, 403);
  assert.equal((await req('/api/room/set-secret', host, { secret: '012' })).status, 400);
  assert.equal((await req('/api/room/set-secret', host, { secret: '123' })).status, 200);
  assert.equal((await req('/api/room/set-secret', host, { secret: '456' })).status, 409);
  const other = await req('/api/room', challenger, undefined, 'GET');
  assert.equal(other.data.state.me.mySecret, null);
  assert.equal(Object.hasOwn(other.data.state.game, 'secrets'), false);
  assert.equal((await req('/api/room', spectator, undefined, 'GET')).data.state.me.mySecret, null);
  const both = await req('/api/room/set-secret', challenger, { secret: '456' });
  assert.equal(both.data.state.me.mySecret, '456');
  assert.equal(both.data.state.game.status, 'playing');
  assert.equal(both.data.state.game.turn, 'black');
  assert.equal((await req('/api/room/guess', challenger, { guess: '123' })).status, 409);
  assert.equal((await req('/api/room/guess', host, { guess: '112' })).status, 400);
  assert.equal((await req('/api/room/move', host, { x: 0, y: 0 })).status, 400);
  const first = await req('/api/room/guess', host, { guess: '124' });
  assert.equal(first.status, 200);
  assert.equal(first.data.state.game.guesses[0].strikes, 0);
  assert.equal(first.data.state.game.turn, 'white');
  const second = await req('/api/room/guess', challenger, { guess: '132' });
  assert.equal(second.status, 200);
  assert.deepEqual([second.data.state.game.guesses[1].strikes, second.data.state.game.guesses[1].balls], [1, 2]);
  const victory = await req('/api/room/guess', host, { guess: '456' });
  assert.equal(victory.data.state.game.status, 'finished');
  assert.equal(victory.data.state.game.winner, 'black');
  assert.equal((await req('/api/room/guess', challenger, { guess: '123' })).status, 409);
  const reset = await req('/api/room/next-round', spectator, {});
  assert.equal(reset.status, 200);
  assert.equal(reset.data.state.game.status, 'selecting');
  assert.equal(reset.data.state.game.round, 2);
  assert.equal(reset.data.state.game.moveCount, 0);
  assert.equal(reset.data.state.me.mySecret, null);
  assert.deepEqual(reset.data.state.game.ready, { black: false, white: false });
});
