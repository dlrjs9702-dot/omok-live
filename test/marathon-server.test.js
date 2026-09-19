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
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); });
  });
}

async function serverFixture(t) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'marathon-test-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir,
      DATABASE_URL: '', ADMIN_PASSWORD: 'marathon-test-password', NODE_ENV: 'test' },
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
  const login = await req('/api/admin/login', null, { password: 'marathon-test-password' });
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

test('marathon individual mode: roll, answer correctly, and win by reaching 30', { timeout: 30000 }, async t => {
  const { req, guest } = await serverFixture(t);
  const a = await guest('마A');
  const b = await guest('마B');
  assert.equal((await req('/api/rooms', a.session, { gameType: 'marathon', visibility: 'public' })).status, 201);
  const rid = (await req('/api/rooms/public', b.session, undefined, 'GET')).data.rooms[0].id;
  assert.equal((await req('/api/rooms/public/join', b.session, { roomId: rid })).status, 200);
  assert.equal((await req('/api/room/choose-role', a.session, { choice: '1' })).status, 200);
  assert.equal((await req('/api/room/choose-role', b.session, { choice: '2' })).status, 200);
  assert.equal((await req('/api/room/start-marathon', a.session, {})).status, 200);
  let state = (await req('/api/room', a.session, undefined, 'GET')).data.state;
  assert.equal(state.game.status, 'playing');
  assert.equal(state.game.mode, 'individual');
  assert.equal(state.game.turnGroup, '1');
  assert.equal(state.game.currentRoller, '1');

  // b (not the current roller) cannot roll out of turn.
  assert.equal((await req('/api/room/roll-marathon', b.session, { expectedPhaseId: state.game.phaseId })).status, 409);

  const rolled = await req('/api/room/roll-marathon', a.session, { expectedPhaseId: state.game.phaseId });
  assert.equal(rolled.status, 200);
  state = rolled.data.state;
  assert.equal(state.game.phase, 'mission');
  assert.ok(state.game.mission);
  assert.equal(state.game.mission.answer, undefined); // never exposed to any client

  // Only the acting group (seat 1, "group 1" in individual mode) may answer.
  assert.equal((await req('/api/room/answer-marathon', b.session, { answer: 'wrong', expectedPhaseId: state.game.phaseId })).status, 409);

  // A wrong answer from the right seat is accepted as a submission (not rejected outright) and
  // keeps the mission open for retry within the time limit.
  const wrong = await req('/api/room/answer-marathon', a.session, { answer: '__definitely-wrong__', expectedPhaseId: state.game.phaseId });
  assert.equal(wrong.status, 200);
  assert.equal(wrong.data.state.game.phase, 'mission');
  // Full-length play to an actual win/penalty-chain is exercised directly against the engine in
  // test/marathon.test.js (missions are randomly generated content, impractical to script blind
  // over HTTP); this test covers the HTTP wiring: room actions, turn/mission gating, hidden answer.
});

test('marathon team mode (2v2): self-selected seats map to teams, and any teammate may answer', { timeout: 30000 }, async t => {
  const { req, guest, admin } = await serverFixture(t);
  const a = await guest('마A');
  const b = await guest('마B');
  const c = await guest('마C');
  const d = await guest('마D');
  assert.equal((await req('/api/rooms', a.session, { gameType: 'marathon', visibility: 'public' })).status, 201);
  const rid = (await req('/api/rooms/public', admin, undefined, 'GET')).data.rooms[0].id;
  for (const p of [b, c, d]) assert.equal((await req('/api/rooms/public/join', p.session, { roomId: rid })).status, 200);

  assert.equal((await req('/api/room/set-marathon-config', b.session, { mode: 'team', teamLayout: '2v2' })).status, 403); // host only
  assert.equal((await req('/api/room/set-marathon-config', a.session, { mode: 'team', teamLayout: '2v2' })).status, 200);

  // Seats 1 & 3 self-select into team A; seats 2 & 4 into team B (odd/even mapping).
  assert.equal((await req('/api/room/choose-role', a.session, { choice: '1' })).status, 200);
  assert.equal((await req('/api/room/choose-role', b.session, { choice: '2' })).status, 200);
  assert.equal((await req('/api/room/choose-role', c.session, { choice: '3' })).status, 200);
  assert.equal((await req('/api/room/choose-role', d.session, { choice: '4' })).status, 200);
  // Only exactly 4 seats exist for the 2v2 layout -- seat 5/6 must not even be choosable.
  assert.equal((await req('/api/room/choose-role', a.session, { choice: '5' })).status, 400);

  assert.equal((await req('/api/room/start-marathon', a.session, {})).status, 200);
  let state = (await req('/api/room', a.session, undefined, 'GET')).data.state;
  assert.equal(state.game.mode, 'team');
  assert.deepEqual(state.game.groups.A, ['1', '3']);
  assert.deepEqual(state.game.groups.B, ['2', '4']);
  assert.equal(state.game.turnGroup, 'A');
  assert.equal(state.game.currentRoller, '1');

  const rolled = await req('/api/room/roll-marathon', a.session, { expectedPhaseId: state.game.phaseId });
  assert.equal(rolled.status, 200);
  state = rolled.data.state;
  assert.equal(state.game.phase, 'mission');
  assert.equal(state.game.mission.group, 'A');

  // Seat 3 (a's own teammate) may answer even though seat 1 rolled -- confirms team collaboration.
  const wrong = await req('/api/room/answer-marathon', c.session, { answer: '__wrong__', expectedPhaseId: state.game.phaseId });
  assert.equal(wrong.status, 200);
  assert.equal(wrong.data.state.game.phase, 'mission'); // wrong answer keeps the mission open for retry
  // The opposing team (seat 2) cannot answer team A's mission.
  assert.equal((await req('/api/room/answer-marathon', b.session, { answer: '__wrong__', expectedPhaseId: state.game.phaseId })).status, 409);
});

test('marathon: a disconnected teammate loses as a team; the other fully-connected team wins', { timeout: 30000 }, async t => {
  const { req, guest, admin } = await serverFixture(t);
  const a = await guest('마A');
  const b = await guest('마B');
  const c = await guest('마C');
  const d = await guest('마D');
  assert.equal((await req('/api/rooms', a.session, { gameType: 'marathon', visibility: 'public' })).status, 201);
  const rid = (await req('/api/rooms/public', admin, undefined, 'GET')).data.rooms[0].id;
  for (const p of [b, c, d]) assert.equal((await req('/api/rooms/public/join', p.session, { roomId: rid })).status, 200);
  assert.equal((await req('/api/room/set-marathon-config', a.session, { mode: 'team', teamLayout: '2v2' })).status, 200);
  for (const [p, choice] of [[a, '1'], [b, '2'], [c, '3'], [d, '4']]) {
    assert.equal((await req('/api/room/choose-role', p.session, { choice })).status, 200);
  }
  assert.equal((await req('/api/room/start-marathon', a.session, {})).status, 200);

  // Seat 3 (team A, a's teammate) disconnects -- team A should be the loser as a whole, even
  // though seat 1 (a) is still connected.
  assert.equal((await req('/api/logout', c.session, {})).status, 200);
  const paused = (await req('/api/room', a.session, undefined, 'GET')).data.state;
  assert.equal(paused.game.paused, true);
  assert.deepEqual(paused.game.disconnectedSeats, ['3']);

  const ended = await req('/api/room/end-game', a.session, {});
  assert.equal(ended.status, 200);
  const finished = ended.data.state.game;
  assert.equal(finished.status, 'finished');
  assert.equal(finished.endReason, 'disconnect');
  // Team B (seats 2 & 4, both still connected) wins as a whole; team A (seat 3 disconnected) loses,
  // even though team A's OTHER member (seat 1 / a) is still connected -- team-unit resolution.
  assert.equal(finished.winner, 'B');
});

test('marathon individual mode: resigning (v1.6.49) ends the match immediately and credits every other seat', { timeout: 30000 }, async t => {
  const { req, guest, admin } = await serverFixture(t);
  const a = await guest('마A');
  const b = await guest('마B');
  const c = await guest('마C');
  assert.equal((await req('/api/rooms', a.session, { gameType: 'marathon', visibility: 'public' })).status, 201);
  const rid = (await req('/api/rooms/public', admin, undefined, 'GET')).data.rooms[0].id;
  for (const p of [b, c]) assert.equal((await req('/api/rooms/public/join', p.session, { roomId: rid })).status, 200);
  for (const [p, choice] of [[a, '1'], [b, '2'], [c, '3']]) {
    assert.equal((await req('/api/room/choose-role', p.session, { choice })).status, 200);
  }
  assert.equal((await req('/api/room/start-marathon', a.session, {})).status, 200);

  const resigned = await req('/api/room/resign', a.session, {});
  assert.equal(resigned.status, 200);
  const finished = resigned.data.state.game;
  assert.equal(finished.status, 'finished');
  assert.equal(finished.endReason, 'resign');
  assert.deepEqual([...finished.winner].sort(), ['2', '3']);
});

test('marathon team mode: one teammate resigning loses the whole team, matching the disconnect-team-loss rule', { timeout: 30000 }, async t => {
  const { req, guest, admin } = await serverFixture(t);
  const a = await guest('마A');
  const b = await guest('마B');
  const c = await guest('마C');
  const d = await guest('마D');
  assert.equal((await req('/api/rooms', a.session, { gameType: 'marathon', visibility: 'public' })).status, 201);
  const rid = (await req('/api/rooms/public', admin, undefined, 'GET')).data.rooms[0].id;
  for (const p of [b, c, d]) assert.equal((await req('/api/rooms/public/join', p.session, { roomId: rid })).status, 200);
  assert.equal((await req('/api/room/set-marathon-config', a.session, { mode: 'team', teamLayout: '2v2' })).status, 200);
  for (const [p, choice] of [[a, '1'], [b, '2'], [c, '3'], [d, '4']]) {
    assert.equal((await req('/api/room/choose-role', p.session, { choice })).status, 200);
  }
  assert.equal((await req('/api/room/start-marathon', a.session, {})).status, 200);

  // Seat 1 (team A) resigns -- team A loses as a whole, team B (seats 2 & 4) wins, even though
  // seat 3 (a's teammate) never resigned or disconnected -- same team-unit rule as disconnect.
  const resigned = await req('/api/room/resign', a.session, {});
  assert.equal(resigned.status, 200);
  const finished = resigned.data.state.game;
  assert.equal(finished.status, 'finished');
  assert.equal(finished.endReason, 'resign');
  assert.equal(finished.winner, 'B');
});
