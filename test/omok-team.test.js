'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');
const team = require('../lib/games/omok2v2');
const { getGame, listGames } = require('../lib/games');

async function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); });
  });
}

async function serverFixture(t) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'team-omok-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir,
      DATABASE_URL: '', ADMIN_PASSWORD: 'team-test-password', NODE_ENV: 'test' },
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
  const login = await req('/api/admin/login', null, { password: 'team-test-password' });
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
  return { req, enter, admin, guest };
}

test('team engine reuses regular omok with strict 1-2-3-4 turns and team victories', () => {
  assert.equal(getGame('omok2v2'), team);
  assert.ok(listGames().some(g => g.id === 'omok2v2'));
  assert.equal(team.colorForSeat('1'), 'black');
  assert.equal(team.colorForSeat('3'), 'black');
  assert.equal(team.colorForSeat('2'), 'white');
  assert.equal(team.colorForSeat('4'), 'white');
  const game = team.create();
  team.start(game);
  assert.equal(game.nextSeat, '1');
  assert.equal(team.applyMove(game, 0, 0, '2', 'now').legal, false);
  const moves = [ ['1',0,0], ['2',14,14], ['3',1,0], ['4',14,13],
    ['1',2,0], ['2',14,12], ['3',3,0], ['4',14,11], ['1',4,0] ];
  for (const [seat, x, y] of moves) {
    const actual = team.applyMove(game, x, y, seat, 'now');
    assert.equal(actual.legal, true, JSON.stringify(actual));
  }
  assert.equal(game.status, 'finished');
  assert.equal(game.winner, 'black');
  assert.equal(team.publicState(game).lastMove.playerSeat, '1');
  team.reset(game);
  assert.equal(game.status, 'selecting');
  assert.equal(game.nextSeat, null);
  assert.equal(game.paused, false);
});

test('team room accepts four distinct seats, pauses, resumes and protects turns', { timeout: 35000 }, async t => {
  const { req, guest, enter, admin } = await serverFixture(t);
  const a = await guest('하나');
  const b = await guest('둘');
  const c = await guest('셋');
  const d = await guest('넷');
  const spectator = await guest('관전자');
  const created = await req('/api/rooms', a.session, { gameType: 'omok2v2', visibility: 'public' });
  assert.equal(created.status, 201);
  const roomId = (await req('/api/rooms/public', admin, undefined, 'GET')).data.rooms[0].id;
  const list = await req('/api/rooms/public', b.session, undefined, 'GET');
  assert.equal(list.data.rooms[0].maxPlayers, 4);
  assert.equal(list.data.rooms[0].playerCount, 0);
  assert.doesNotMatch(JSON.stringify(list.data), /roomCode|guestKeyId|sessionToken/);
  for (const person of [b,c,d]) assert.equal((await req('/api/rooms/public/join', person.session, { roomId })).status, 200);
  assert.equal((await req('/api/room/choose-role', a.session, { choice: 'black' })).status, 400);
  assert.equal((await req('/api/room/choose-role', a.session, { choice: '1' })).status, 200);
  assert.equal((await req('/api/room/choose-role', b.session, { choice: '1' })).status, 409);
  assert.equal((await req('/api/room/choose-role', b.session, { choice: '2' })).status, 200);
  assert.equal((await req('/api/room/choose-role', c.session, { choice: '3' })).status, 200);
  assert.equal((await req('/api/room', a.session, undefined, 'GET')).data.state.game.status, 'selecting');
  assert.equal((await req('/api/room/choose-role', d.session, { choice: '4' })).status, 200);
  let game = (await req('/api/room', a.session, undefined, 'GET')).data.state;
  assert.equal(game.game.status, 'playing');
  assert.equal(game.game.nextSeat, '1');
  assert.equal(game.maxPlayers, 4);
  assert.equal(game.players['4'].label, '넷');
  assert.equal((await req('/api/room/choose-role', d.session, { choice: '1' })).status, 409);
  const watching = await req('/api/rooms/public/join', spectator.session, { roomId });
  assert.equal(watching.status, 200);
  assert.equal(watching.data.state.me.choice, 'spectator');
  assert.equal((await req('/api/room/move', spectator.session, {x:0,y:0})).status, 403);
  assert.equal((await req('/api/room/move', b.session, {x:0,y:0})).status, 409);
  assert.equal((await req('/api/room/move', a.session, {x:0,y:0})).status, 200);
  assert.equal((await req('/api/room/move', a.session, {x:1,y:0})).status, 409);
  assert.equal((await req('/api/room/move', c.session, {x:1,y:0})).status, 409);
  assert.equal((await req('/api/room/leave', c.session, {})).status, 200);
  game = (await req('/api/room', a.session, undefined, 'GET')).data.state;
  assert.equal(game.game.paused, true);
  assert.deepEqual(game.game.disconnectedSeats, ['3']);
  assert.equal((await req('/api/rooms/public', spectator.session, undefined, 'GET')).data.rooms[0].status, 'paused');
  assert.equal((await req('/api/room/move', b.session, {x:14,y:14})).data.error, 'GAME_PAUSED');
  // v1.6.40: end-game no longer requires the host -- any connected seat may end a paused game --
  // but a spectator still may not, and it still only works while actually paused.
  assert.equal((await req('/api/room/end-game', spectator.session, {})).status, 403);
  assert.equal((await req('/api/rooms/public/join', c.session, { roomId })).status, 200);
  game = (await req('/api/room', a.session, undefined, 'GET')).data.state;
  assert.equal(game.game.paused, false);
  assert.equal(game.game.nextSeat, '2');
  assert.equal((await req('/api/room/end-game', a.session, {})).data.error, 'NOT_PAUSED');
  assert.equal((await req('/api/room/move', b.session, {x:14,y:14})).status, 200);
  assert.equal((await req('/api/logout', d.session, {})).status, 200);
  assert.equal((await req('/api/room', a.session, undefined, 'GET')).data.state.game.paused, true);
  const originalSession = d.session;
  d.session = await enter(d.key);
  assert.notEqual(d.session, originalSession);
  const recovered = await req('/api/room', d.session, undefined, 'GET');
  assert.equal(recovered.data.state.me.seat, '4');
  assert.equal((await req('/api/room', a.session, undefined, 'GET')).data.state.game.paused, false);
  const moves = [ [c,1,0], [d,14,13], [a,2,0], [b,14,12], [c,3,0], [d,14,11], [a,4,0] ];
  for (const [person,x,y] of moves) assert.equal((await req('/api/room/move', person.session, {x,y})).status, 200);
  const finished = (await req('/api/room', spectator.session, undefined, 'GET')).data.state;
  assert.equal(finished.game.status, 'finished');
  assert.equal(finished.game.winner, 'black');
  assert.equal((await req('/api/room/next-round', spectator.session, {})).status, 200);
  const reset = (await req('/api/room', a.session, undefined, 'GET')).data.state;
  assert.equal(reset.game.status, 'selecting');
  assert.equal(reset.game.nextSeat, null);
  assert.equal(reset.players['1'], null);
  assert.equal(reset.players['4'], null);
  assert.equal((await req('/api/room/choose-role', a.session, {choice:'1'})).status, 200);
  assert.equal((await req('/api/room/choose-role', b.session, {choice:'2'})).status, 200);
  assert.equal((await req('/api/room/choose-role', c.session, {choice:'3'})).status, 200);
  assert.equal((await req('/api/room/choose-role', d.session, {choice:'4'})).status, 200);
  assert.equal((await req('/api/room/leave', c.session, {})).status, 200);
  // v1.6.40: connection-drop handling -- any connected participant (b here, not the host a) can
  // end a paused game. Team games resolve by whole team: seat 3 (black) disconnected, so black
  // loses and white (the still-connected team, including b's own teammate d) wins -- recorded as
  // a real finish, not a no-result draw.
  assert.equal((await req('/api/room/end-game', b.session, {})).status, 200);
  const stopped = (await req('/api/room', b.session, undefined, 'GET')).data.state;
  assert.equal(stopped.game.status, 'finished');
  assert.equal(stopped.game.winner, 'white');
  assert.equal(stopped.game.endReason, 'disconnect');
  assert.deepEqual(stopped.game.disconnectedAtEnd, ['3']);
  assert.equal(stopped.game.paused, false);
  assert.deepEqual(stopped.game.disconnectedSeats, []);
  // The ending is final: it can't be triggered twice (seat 3 here left the room outright via
  // /api/room/leave above, so a fresh guest-entry for them lands back in the lobby, not this
  // already-finished room -- a true reconnect-after-end scenario, where the disconnected seat's
  // *session* survives and comes back rather than leaving outright, is covered for a 2-seat game
  // in "a paused 2-seat game...").
  assert.equal((await req('/api/room/end-game', a.session, {})).data.error, 'NOT_PAUSED');
});

test('team and Bingo modes share numbered seats without changing team turn controls', async () => {
  const html = await fs.readFile(path.resolve(__dirname, '../public/index.html'), 'utf8');
  const app = await fs.readFile(path.resolve(__dirname, '../public/app.js'), 'utf8');
  assert.doesNotMatch(html, /data-game="omok2v2"/);
  assert.match(html, /name="omokMode" value="2v2"/);
  assert.match(app, /omokMode\(\) === '2v2' \? 'omok2v2'/);
  assert.match(html, /id="teamRoleButtons"/);
  assert.match(html, /id="teamPlayers"/);
  assert.match(html, /id="standardPlayers"/);
  assert.match(html, /id="endGameBtn"/);
  assert.match(app, /state\.game\.nextSeat !== seat/);
  assert.match(html, /data-game="bingo"/);
  assert.match(app, /teamRoleButtons\.classList\.toggle\('hidden', !numbered\)/);
  assert.match(html, /v=1\.6\.72/);
});
