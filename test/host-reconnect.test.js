'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');

async function freePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}

async function serverFixture(t) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'host-reconnect-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir,
      DATABASE_URL: '', ADMIN_PASSWORD: 'host-reconnect-test', NODE_ENV: 'test' },
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
    try {
      if ((await fetch(base + '/health')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, logs);

  async function req(route, token, body, method = 'POST') {
    const headers = {};
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(base + route, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, data };
  }

  const login = await req('/api/admin/login', null, { password: 'host-reconnect-test' });
  assert.equal(login.status, 200);
  const admin = login.data.sessionToken;

  async function enter(key) {
    const response = await fetch(base + '/guest-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: key }).toString(),
    });
    assert.equal(response.status, 200);
    return (await response.text()).match(/data-session="([^"]+)"/)[1];
  }

  async function guest(label) {
    const issued = await req('/api/admin/keys', admin, { label });
    assert.equal(issued.status, 201);
    const key = issued.data.html.match(/name="token" value="([^"]+)"/)[1];
    return { key, session: await enter(key) };
  }

  return { req, enter, guest };
}

test('a guest host keeps room access and host-only setup after reconnecting before role selection', { timeout: 35000 }, async t => {
  const { req, enter, guest } = await serverFixture(t);
  const host = await guest('방장');
  const created = await req('/api/rooms', host.session, { gameType: 'bingo' });
  assert.equal(created.status, 201);
  const roomCode = created.data.state.me.roomCode;

  assert.equal((await req('/api/session/release', null, { sessionToken: host.session })).status, 200);
  host.session = await enter(host.key);

  const restored = await req('/api/room', host.session, undefined, 'GET');
  assert.equal(restored.status, 200);
  assert.equal(restored.data.state.me.isHost, true);
  assert.equal(restored.data.state.me.roomCode, roomCode);
  assert.equal(restored.data.state.game.status, 'selecting');
  assert.equal((await req('/api/room/set-bingo-target', host.session, { targetLines: 2 })).status, 200);
});

test('host and player seats reconnect in a non-numbered game, preserving server-side roles', { timeout: 35000 }, async t => {
  const { req, enter, guest } = await serverFixture(t);
  const host = await guest('방장');
  const player = await guest('플레이어');
  const created = await req('/api/rooms', host.session, { gameType: 'omok', visibility: 'public' });
  assert.equal(created.status, 201);
  const roomId = (await req('/api/rooms/public', player.session, undefined, 'GET')).data.rooms[0].id;
  assert.equal((await req('/api/rooms/public/join', player.session, { roomId })).status, 200);
  assert.equal((await req('/api/room/choose-role', host.session, { choice: 'black' })).status, 200);
  assert.equal((await req('/api/room/choose-role', player.session, { choice: 'white' })).status, 200);

  assert.equal((await req('/api/session/release', null, { sessionToken: host.session })).status, 200);
  host.session = await enter(host.key);
  const restoredHost = (await req('/api/room', host.session, undefined, 'GET')).data.state;
  assert.equal(restoredHost.me.isHost, true);
  assert.equal(restoredHost.me.seat, 'black');

  assert.equal((await req('/api/session/release', null, { sessionToken: player.session })).status, 200);
  player.session = await enter(player.key);
  const restoredPlayer = (await req('/api/room', player.session, undefined, 'GET')).data.state;
  assert.equal(restoredPlayer.me.isHost, false);
  assert.equal(restoredPlayer.me.seat, 'white');
});
