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

test('administrator sees per-person online, game and spectator status without leaking private game data', { timeout: 25000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-center-presence-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir,
      DATABASE_URL: '', ADMIN_PASSWORD: 'presence-test-password', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  proc.stdout.on('data', chunk => output += chunk.toString());
  proc.stderr.on('data', chunk => output += chunk.toString());
  t.after(async () => {
    proc.kill('SIGTERM');
    await new Promise(resolve => { if (proc.exitCode !== null) resolve(); else { proc.once('exit', resolve); setTimeout(resolve, 2000).unref(); } });
    await fs.rm(dir, { recursive: true, force: true });
  });
  let started = false;
  for (let i = 0; i < 90; i += 1) {
    if (proc.exitCode !== null) break;
    try { const res = await fetch(base + '/health'); if (res.ok) { started = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(started, `test server failed: ${output}`);
  async function req(route, token, body, method = 'POST') {
    const headers = {};
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json() };
  }
  const adminLogin = await req('/api/admin/login', null, { password: 'presence-test-password' });
  const admin = adminLogin.data.sessionToken;
  assert.equal(adminLogin.status, 200);
  async function makeGuest(label) {
    const issued = await req('/api/admin/keys', admin, { label });
    assert.equal(issued.status, 201);
    const guestToken = issued.data.html.match(/name="token" value="([^"]+)"/)[1];
    const res = await fetch(base + '/guest-entry', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: guestToken }).toString(),
    });
    assert.equal(res.status, 200);
    const session = (await res.text()).match(/data-session="([^"]+)"/)[1];
    return { keyId: issued.data.key.id, session };
  }
  const a = await makeGuest('우성');
  const b = await makeGuest('지희');
  const c = await makeGuest('민지');
  const offline = await req('/api/admin/keys', admin, { label: '접속 안 한 사람' });
  assert.equal(offline.status, 201);
  assert.equal((await req('/api/admin/presence', null, undefined, 'GET')).status, 401);
  assert.equal((await req('/api/admin/presence', a.session, undefined, 'GET')).status, 403);
  const before = await req('/api/admin/presence', admin, undefined, 'GET');
  assert.equal(before.status, 200);
  assert.deepEqual(before.data.counts, { online: 4, playing: 0, spectating: 0, waiting: 4, offline: 1 });
  assert.equal(before.data.entries.find(row => row.label === '우성').status, 'lobby');
  assert.equal(before.data.entries.find(row => row.label === '접속 안 한 사람').status, 'offline');
  const created = await req('/api/rooms', a.session, { gameType: 'baseball' });
  assert.equal(created.status, 201);
  const code = created.data.state.me.roomCode;
  const waiting = await req('/api/admin/presence', admin, undefined, 'GET');
  assert.equal(waiting.data.entries.find(row => row.label === '우성').status, 'room-waiting');
  assert.equal(waiting.data.entries.find(row => row.label === '우성').game, '숫자야구');
  assert.equal((await req('/api/rooms/join', b.session, { code })).status, 200);
  assert.equal((await req('/api/rooms/join', c.session, { code })).status, 200);
  assert.equal((await req('/api/room/choose-role', a.session, { choice: 'black' })).status, 200);
  assert.equal((await req('/api/room/choose-role', b.session, { choice: 'white' })).status, 200);
  const setup = await req('/api/admin/presence', admin, undefined, 'GET');
  assert.equal(setup.data.entries.find(row => row.label === '우성').status, 'preparing');
  assert.equal(setup.data.entries.find(row => row.label === '민지').status, 'room-waiting');
  assert.equal((await req('/api/room/set-secret', a.session, { secret: '123' })).status, 200);
  assert.equal((await req('/api/room/set-secret', b.session, { secret: '456' })).status, 200);
  const live = await req('/api/admin/presence', admin, undefined, 'GET');
  assert.deepEqual(live.data.counts, { online: 4, playing: 2, spectating: 1, waiting: 1, offline: 1 });
  const player = live.data.entries.find(row => row.label === '우성');
  assert.equal(player.status, 'playing');
  assert.equal(player.role, '선공');
  assert.equal(player.opponent, '지희');
  assert.equal(live.data.entries.find(row => row.label === '민지').status, 'spectating');
  assert.equal(live.data.entries.find(row => row.label === '관리자').status, 'lobby');
  const serialized = JSON.stringify(live.data);
  assert.doesNotMatch(serialized, /"sessionToken"|"roomCode"|"secrets"|"mySecret"|"tokenHash"/);
  assert.doesNotMatch(serialized, /123|456/);
  assert.equal((await req('/api/room/guess', a.session, { guess: '456' })).status, 200);
  const ended = await req('/api/admin/presence', admin, undefined, 'GET');
  assert.equal(ended.data.counts.playing, 0);
  assert.equal(ended.data.entries.find(row => row.label === '우성').status, 'finished');
  assert.equal((await req('/api/logout', c.session, {})).status, 200);
  const after = await req('/api/admin/presence', admin, undefined, 'GET');
  assert.equal(after.data.entries.find(row => row.label === '민지').online, false);
  assert.equal(after.data.counts.offline, 2);
  assert.equal((await req('/api/admin/keys/' + a.keyId + '/revoke', admin, {})).status, 200);
  const revoked = await req('/api/admin/presence', admin, undefined, 'GET');
  assert.equal(revoked.data.entries.some(row => row.label === '우성'), false);
});

test('presence dashboard is administrator-only and refreshes while in lobby', async () => {
  const html = await fs.readFile(path.join(__dirname, '..', 'public/index.html'), 'utf8');
  const app = await fs.readFile(path.join(__dirname, '..', 'public/app.js'), 'utf8');
  const server = await fs.readFile(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(html, /id="adminPresencePanel" class="card adminPresencePanel hidden"/);
  assert.ok(html.indexOf('id="adminPresencePanel"') < html.indexOf('id="adminPanel"'));
  assert.match(app, /adminPresencePanel\.classList\.toggle\('hidden', sessionRole !== 'admin'\)/);
  assert.match(app, /setInterval\(\(\) => \{[\s\S]*?\}, 12000\)/);
  assert.match(server, /pathname === '\/api\/admin\/presence'[\s\S]*?requireAdmin\(req, res\)/);
});
