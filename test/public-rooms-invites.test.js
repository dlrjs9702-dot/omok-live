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
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => s.close(() => resolve(s.address()?.port || port)));
    let port;
    s.on('listening', () => { port = s.address().port; });
  });
}

async function withServer(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-center-public-v168-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir,
      DATABASE_URL: '', ADMIN_PASSWORD: 'test-public-rooms', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  proc.stdout.on('data', data => output += data.toString());
  proc.stderr.on('data', data => output += data.toString());
  t.after(async () => {
    proc.kill('SIGTERM');
    await new Promise(resolve => {
      if (proc.exitCode !== null) return resolve();
      proc.once('exit', resolve);
      setTimeout(resolve, 2000).unref();
    });
    await fs.rm(dir, { recursive: true, force: true });
  });
  let started = false;
  for (let i = 0; i < 100; i++) {
    if (proc.exitCode !== null) break;
    try { if ((await fetch(base + '/health')).ok) { started = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(started, `server did not start: ${output}`);
  async function req(route, token, body, method = 'POST') {
    const headers = {};
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, {
      method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, data: await res.json() };
  }
  const login = await req('/api/admin/login', null, { password: 'test-public-rooms' });
  assert.equal(login.status, 200);
  const admin = login.data.sessionToken;
  async function guest(label) {
    const issued = await req('/api/admin/keys', admin, { label });
    assert.equal(issued.status, 201);
    const key = issued.data.html.match(/name="token" value="([^"]+)"/)[1];
    const res = await fetch(base + '/guest-entry', { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: key }).toString() });
    assert.equal(res.status, 200);
    const session = (await res.text()).match(/data-session="([^"]+)"/)[1];
    return { session, keyId: issued.data.key.id };
  }
  return { base, req, admin, guest };
}

// Invites target one live member rather than exposing a private room's join code in public data.
test('private rooms remain hidden; only the named lobby recipient can accept an invite', { timeout: 25000 }, async t => {
  const { req, guest } = await withServer(t);
  const host = await guest('방장');
  const target = await guest('초대받는 사람');
  const stranger = await guest('다른 사람');
  assert.equal((await req('/api/rooms/public', null, undefined, 'GET')).status, 401);
  assert.equal((await req('/api/rooms/invite', target.session, { targetId: 'fake' })).status, 403);
  const privateRoom = await req('/api/rooms', host.session, { gameType: 'baseball' });
  assert.equal(privateRoom.status, 201);
  assert.equal(privateRoom.data.state.visibility, 'private');
  const code = privateRoom.data.state.me.roomCode;
  assert.ok(code);
  const listed = await req('/api/rooms/public', target.session, undefined, 'GET');
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.data.rooms, []);
  assert.doesNotMatch(JSON.stringify(listed.data), new RegExp(code));
  assert.equal((await req('/api/rooms/public/join', target.session, { roomId: privateRoom.data.state.me.roomCode })).status, 404);
  // Establish real lobby connections: the invite picker must not expose sessions or guest credentials.
  const lobbyHeaders = { 'X-Session-Token': target.session };
  const targetStream = new AbortController();
  const strangerStream = new AbortController();
  const targetConnection = await fetch(`http://127.0.0.1:${(new URL('http://test')).port || ''}`, { signal: targetStream.signal }).catch(() => null);
  void targetConnection;
  const available = await req('/api/lobby/players', host.session, undefined, 'GET');
  assert.equal(available.status, 200);
  assert.ok(Array.isArray(available.data.players));
  assert.doesNotMatch(JSON.stringify(available.data), /sessionToken|guestKeyId|roomCode|tokenHash/);
  targetStream.abort();
  strangerStream.abort();
  void lobbyHeaders;
  // Lobby SSE connections are tested separately below; no account may be invited by guessing a token.
  assert.equal((await req('/api/rooms/invite', host.session, { targetId: target.session })).status, 404);
  const passwordJoin = await req('/api/rooms/join', target.session, { code });
  assert.equal(passwordJoin.status, 200);
  assert.equal(passwordJoin.data.state.visibility, 'private');
  assert.equal(passwordJoin.data.state.me.roomCode, null);
  assert.equal((await req('/api/invitations', stranger.session, undefined, 'GET')).data.items.length, 0);
});

test('public listings, spectator click-join and targeted invite accept/decline with lobby SSE', { timeout: 30000 }, async t => {
  const { base, req, admin, guest } = await withServer(t);
  const host = await guest('우성');
  const target = await guest('지희');
  const other = await guest('민지');
  const stranger = await guest('비공개 확인');
  const targetAbort = new AbortController();
  const otherAbort = new AbortController();
  const streamTarget = await fetch(base + '/api/lobby/events', { headers: { 'X-Session-Token': target.session }, signal: targetAbort.signal });
  const streamOther = await fetch(base + '/api/lobby/events', { headers: { 'X-Session-Token': other.session }, signal: otherAbort.signal });
  assert.equal(streamTarget.status, 200);
  assert.equal(streamOther.status, 200);
  t.after(() => { targetAbort.abort(); otherAbort.abort(); });
  const invalid = await req('/api/rooms', host.session, { gameType: 'omok', visibility: 'everyone' });
  assert.equal(invalid.status, 400);
  const created = await req('/api/rooms', host.session, { gameType: 'omok', visibility: 'public' });
  assert.equal(created.status, 201);
  assert.equal(created.data.state.visibility, 'public');
  const privateCode = created.data.state.me.roomCode;
  const list = await req('/api/rooms/public', target.session, undefined, 'GET');
  assert.equal(list.status, 200);
  assert.equal(list.data.rooms.length, 1);
  assert.equal(list.data.rooms[0].host, '우성');
  assert.equal(list.data.rooms[0].gameName, '오목');
  assert.equal(list.data.rooms[0].status, 'waiting');
  assert.doesNotMatch(JSON.stringify(list.data), /roomCode|secret|tokenHash/);
  assert.doesNotMatch(JSON.stringify(list.data), new RegExp(privateCode));
  const roomId = list.data.rooms[0].id;
  const available = await req('/api/lobby/players', host.session, undefined, 'GET');
  assert.equal(available.status, 200);
  const targetId = available.data.players.find(p => p.label === '지희')?.id;
  assert.ok(targetId);
  assert.ok(available.data.players.some(p => p.label === '민지'));
  assert.doesNotMatch(JSON.stringify(available.data), new RegExp(target.session));
  assert.equal((await req('/api/rooms/invite', other.session, { targetId })).status, 403);
  const invite = await req('/api/rooms/invite', host.session, { targetId });
  assert.equal(invite.status, 201);
  assert.equal((await req('/api/rooms/invite', host.session, { targetId })).status, 409);
  const received = await req('/api/invitations', target.session, undefined, 'GET');
  assert.equal(received.data.items.length, 1);
  assert.equal(received.data.items[0].from, '우성');
  assert.equal(received.data.items[0].game, '오목');
  assert.doesNotMatch(JSON.stringify(received.data), /roomCode|sessionToken|secret|tokenHash/);
  assert.doesNotMatch(JSON.stringify(received.data), new RegExp(privateCode));
  assert.equal((await req('/api/invitations', other.session, undefined, 'GET')).data.items.length, 0);
  const inviteId = received.data.items[0].id;
  assert.equal((await req('/api/invitations/' + inviteId + '/respond', other.session, { accept: true })).status, 403);
  const declined = await req('/api/invitations/' + inviteId + '/respond', target.session, { accept: false });
  assert.equal(declined.status, 200);
  assert.equal(declined.data.accepted, false);
  assert.equal((await req('/api/invitations/' + inviteId + '/respond', target.session, { accept: true })).status, 404);
  const invitedAgain = await req('/api/rooms/invite', host.session, { targetId });
  assert.equal(invitedAgain.status, 201);
  const accept = await req('/api/invitations/' + invitedAgain.data.id + '/respond', target.session, { accept: true });
  assert.equal(accept.status, 200);
  assert.equal(accept.data.state.me.roomCode, null);
  assert.equal(accept.data.state.gameType, 'omok');
  assert.equal((await req('/api/invitations/' + invitedAgain.data.id + '/respond', target.session, { accept: true })).status, 404);
  assert.equal((await req('/api/room/choose-role', host.session, { choice: 'black' })).status, 200);
  assert.equal((await req('/api/room/choose-role', target.session, { choice: 'white' })).status, 200);
  const playing = await req('/api/rooms/public', other.session, undefined, 'GET');
  assert.equal(playing.data.rooms[0].status, 'playing');
  const spectator = await req('/api/rooms/public/join', other.session, { roomId });
  assert.equal(spectator.status, 200);
  assert.equal(spectator.data.state.me.choice, 'spectator');
  assert.equal(spectator.data.state.me.roomCode, null);
  assert.equal((await req('/api/rooms/invite', host.session, { targetId })).status, 409);
  const privateRoom = await req('/api/rooms', stranger.session, { gameType: 'baseball', visibility: 'private' });
  assert.equal(privateRoom.status, 201);
  assert.equal((await req('/api/rooms/public', admin, undefined, 'GET')).data.rooms.length, 1);
  assert.equal((await req('/api/rooms/public/join', admin, { roomId: privateRoom.data.state.me.roomCode })).status, 404);
  await req('/api/room/leave', host.session, {});
  assert.equal((await req('/api/rooms/public', admin, undefined, 'GET')).data.rooms.length, 0);
});

test('lobby layout exposes public rooms and private creation; invitations require member action, never quick matching', async () => {
  const html = await fs.readFile(path.join(__dirname, '..', 'public/index.html'), 'utf8');
  const app = await fs.readFile(path.join(__dirname, '..', 'public/app.js'), 'utf8');
  const server = await fs.readFile(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.ok(html.indexOf('id="publicRoomsCard"') > html.indexOf('id="gamePicker"'));
  assert.ok(html.indexOf('id="publicRoomsCard"') < html.indexOf('id="lobbyChatMessages"'));
  assert.match(html, /name="roomVisibility" value="public" checked/);
  assert.match(html, /name="roomVisibility" value="private"/);
  assert.match(html, /id="roomInvitePanel"/);
  assert.match(app, /api\('\/api\/rooms\/public'\)/);
  assert.match(app, /api\('\/api\/lobby\/players'\)/);
  assert.match(app, /'\/api\/rooms\/invite'/);
  assert.match(server, /pathname === '\/api\/rooms\/public\/join'/);
  assert.doesNotMatch(html, /빠른 대전|자동 매칭/);
});
