'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');

// v1.6.99: recovery after a refresh / dropped page / new entry with the same key.
// - A page's pagehide release is deferred (SESSION_RELEASE_GRACE_MS), so a refresh resumes the
//   same session, seat and room; an unused release still frees the key afterwards.
// - A new entry with the same key puts a dropped player back into the room they were in:
//   seated or spectating, in a waiting, playing or finished game (an explicit 접속 종료 or a
//   voluntary leave keeps the old behaviour).
// - A seat left voluntarily does not block the next round, and a turn clock is not restarted
//   by someone else's reconnect.

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); });
  });
}

async function serverFixture(t) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reconnect-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir,
      DATABASE_URL: '', ADMIN_PASSWORD: 'conn-drop-test', NODE_ENV: 'test', SESSION_RELEASE_GRACE_MS: '1200' },
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
  // A live room SSE stream (what an open game page holds); close() is the page going away.
  async function stream(token) {
    const controller = new AbortController();
    const res = await fetch(base + '/api/room/events', { headers: { 'X-Session-Token': token }, signal: controller.signal });
    assert.equal(res.status, 200);
    const reader = res.body.getReader();
    reader.read().catch(() => {});
    return { close: async () => { controller.abort(); await sleep(150); } };
  }
  async function enterRaw(key) {
    const res = await fetch(base + '/guest-entry', { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: key }).toString() });
    return { status: res.status, session: (await res.text()).match(/data-session="([^"]+)"/)?.[1] || null };
  }
  return { req, enter, enterRaw, guest, stream };
}


const room = async (req, token) => (await req('/api/room', token, undefined, 'GET')).data.state;
const release = (req, token) => req('/api/session/release', null, { sessionToken: token });

async function othello(fx, labels = ['가', '나']) {
  const [a, b] = [await fx.guest(labels[0]), await fx.guest(labels[1])];
  const created = await fx.req('/api/rooms', a.session, { gameType: 'othello' });
  assert.equal(created.status, 201);
  const code = created.data.state.me.roomCode;
  assert.equal((await fx.req('/api/rooms/join', b.session, { code })).status, 200);
  assert.equal((await fx.req('/api/room/choose-role', a.session, { choice: 'black' })).status, 200);
  assert.equal((await fx.req('/api/room/choose-role', b.session, { choice: 'white' })).status, 200);
  return { a, b, code };
}

// v1.10.29: on a reload the old page's beacon may arrive after the new page's first heartbeat; the new page may then
// be quiet for longer than the grace (a slow PC preparing resources) -- it must keep its session. The page's own
// release (the tab really closed) still frees it.
test('새로고침: 이전 페이지의 해제 요청이 새 페이지 heartbeat보다 늦게 와도 세션 유지, 같은 페이지의 해제는 그대로 해제', { timeout: 30000 }, async t => {
  const fx = await serverFixture(t);
  const a = await fx.guest('늦은해제');
  assert.equal((await fx.req('/api/session/heartbeat', a.session, { page: 'old' })).status, 200);
  assert.equal((await fx.req('/api/session/heartbeat', a.session, { page: 'new' })).status, 200); // the reloaded page
  assert.equal((await fx.req('/api/session/release', null, { sessionToken: a.session, page: 'old' })).status, 200); // late
  await sleep(1600); // longer than the release grace, no request meanwhile
  assert.equal((await fx.req('/api/session/heartbeat', a.session, { page: 'new' })).status, 200, '새 페이지의 세션은 유지');
  assert.equal((await fx.req('/api/session/release', null, { sessionToken: a.session, page: 'new' })).status, 200); // closed
  await sleep(1600);
  assert.equal((await fx.req('/api/session/heartbeat', a.session, { page: 'new' })).status, 401, '닫힌 페이지의 세션은 해제');
});

test('새로고침: pagehide 해제 요청 뒤 같은 세션으로 이어 가면 좌석·판·차례가 그대로다', { timeout: 30000 }, async t => {
  const fx = await serverFixture(t);
  const { a, b } = await othello(fx);
  const first = (await room(fx.req, a.session)).game;
  const move = first.legalMoves?.[0] || { x: 2, y: 3 };
  assert.equal((await fx.req('/api/room/move', a.session, move)).status, 200);
  const before = await room(fx.req, b.session);
  const page = await fx.stream(b.session);
  // The page is refreshed: its stream closes and pagehide asks to release the session...
  await page.close();
  assert.equal((await release(fx.req, b.session)).status, 200);
  // ...and the reloaded page resumes the same token from sessionStorage.
  assert.equal((await fx.req('/api/session/heartbeat', b.session, {})).status, 200);
  const resumed = await fx.stream(b.session);
  await sleep(1600); // longer than the release grace
  assert.equal((await fx.req('/api/session/heartbeat', b.session, {})).status, 200, '재개한 세션은 해제되지 않는다');
  const after = await room(fx.req, b.session);
  assert.equal(after.me.seat, 'white');
  assert.equal(after.game.status, 'playing');
  assert.equal(after.game.turn, before.game.turn);
  assert.deepEqual(after.game.board, before.game.board);
  assert.equal(after.game.paused, false);
  assert.equal(after.players.white.connected, true);
  assert.equal(Object.values(after.participants || {}).filter(p => p.label === '나').length || 1, 1);
  await resumed.close();
});

test('닫힌 탭: 해제 요청 뒤 이어 가지 않으면 유예 후 해제되고, 같은 입장키는 유예 중에도 바로 다시 들어온다', { timeout: 30000 }, async t => {
  const fx = await serverFixture(t);
  const { b } = await othello(fx);
  // Closed tab: nobody resumes the session.
  const page = await fx.stream(b.session);
  await page.close();
  await release(fx.req, b.session);
  await sleep(1700);
  assert.equal((await fx.req('/api/session/heartbeat', b.session, {})).status, 401);
  // Opening the entry file again right after a close (still inside the grace) is not "이미 사용 중".
  const { a: c, b: d } = await othello(fx, ['다', '라']);
  const other = await fx.stream(d.session);
  await other.close();
  await release(fx.req, d.session);
  const again = await fx.enterRaw(d.key);
  assert.equal(again.status, 200);
  assert.equal((await fx.req('/api/session/heartbeat', d.session, {})).status, 401, '이전 세션은 넘겨준다');
  const state = await room(fx.req, again.session);
  assert.equal(state.me.seat, 'white');
  assert.equal(state.players.white.connected, true);
  assert.ok(c.session);
  // A live session on another device still blocks the key as before.
  assert.equal((await fx.enterRaw(d.key)).status, 409);
});

test('재입장: 관전자는 관전자로, 종료된 판의 참가자는 원래 좌석으로 돌아온다(중복 참가자 없음)', { timeout: 30000 }, async t => {
  const fx = await serverFixture(t);
  const { a, b, code } = await othello(fx);
  const spectator = await fx.guest('관전');
  assert.equal((await fx.req('/api/rooms/join', spectator.session, { code })).status, 200);
  const watching = await room(fx.req, spectator.session);
  assert.equal(watching.me.choice, 'spectator');
  // Spectator's page drops and the session expires; opening the entry file again.
  await release(fx.req, spectator.session); await sleep(1500);
  spectator.session = await fx.enter(spectator.key);
  let state = await room(fx.req, spectator.session);
  assert.equal(state?.me.choice, 'spectator');
  assert.equal(state.me.seat, null);
  assert.equal(state.players.black.label, '가');
  assert.equal(state.me.isHost, false);
  // The match finishes; the white player then drops and comes back.
  assert.equal((await fx.req('/api/room/resign', a.session, {})).status, 200);
  await release(fx.req, b.session); await sleep(1500);
  b.session = await fx.enter(b.key);
  state = await room(fx.req, b.session);
  assert.equal(state?.game.status, 'finished');
  assert.equal(state.me.seat, 'white');
  assert.equal(state.players.white.connected, true);
  const labels = Object.values(state.participants || {}).map(p => p.label);
  if (labels.length) assert.equal(labels.filter(label => label === '나').length, 1);
  // Host stays host, and the rematch opens a fresh round for everyone.
  assert.equal((await room(fx.req, a.session)).me.isHost, true);
  assert.equal((await fx.req('/api/room/rematch', b.session, {})).status, 200);
  state = await room(fx.req, a.session);
  assert.equal(state.game.status, 'selecting');
  assert.equal(state.game.winner ?? null, null);
  assert.equal(state.game.endReason ?? null, null);
});

test('다음 판: 스스로 나간 자리는 비워지고, 연결만 끊긴 자리는 돌아올 때까지 유지된다', { timeout: 40000 }, async t => {
  const fx = await serverFixture(t);
  const [a, b, c] = [await fx.guest('일'), await fx.guest('이'), await fx.guest('삼')];
  const created = await fx.req('/api/rooms', a.session, { gameType: 'bingo' });
  const code = created.data.state.me.roomCode;
  for (const g of [b, c]) assert.equal((await fx.req('/api/rooms/join', g.session, { code })).status, 200);
  // Waiting room: a seated player who leaves frees the seat right away.
  assert.equal((await fx.req('/api/room/choose-role', c.session, { choice: '3' })).status, 200);
  assert.equal((await fx.req('/api/room/leave', c.session, {})).status, 200);
  let state = await room(fx.req, a.session);
  assert.equal(state.players['3'], null);
  assert.equal((await fx.req('/api/rooms/join', c.session, { code })).status, 200);
  for (const [g, seat] of [[a, '1'], [b, '2'], [c, '3']]) assert.equal((await fx.req('/api/room/choose-role', g.session, { choice: seat })).status, 200);
  assert.equal((await fx.req('/api/room/start-bingo', a.session, {})).status, 200);
  assert.equal((await room(fx.req, a.session)).game.status, 'playing');
  // 3 leaves for good (paused -> ended); 2 only drops.
  assert.equal((await fx.req('/api/room/leave', c.session, {})).status, 200);
  assert.equal((await fx.req('/api/room/end-game', a.session, {})).status, 200);
  assert.equal((await room(fx.req, a.session)).game.status, 'finished');
  await release(fx.req, b.session); await sleep(1500);
  assert.equal((await fx.req('/api/room/rematch', a.session, {})).status, 200);
  state = await room(fx.req, a.session);
  assert.equal(state.game.status, 'selecting');
  assert.equal(state.players['3'], null, '나간 사람의 자리는 비워짐');
  assert.equal(state.players['2']?.label, '이', '끊긴 사람의 자리는 유지');
  b.session = await fx.enter(b.key);
  state = await room(fx.req, b.session);
  assert.equal(state.me.seat, '2');
  assert.equal(state.players['2'].connected, true);
});

test('차례 시계: 다른 참가자의 새로고침으로 일시정지된 동안 멈추고 60초로 초기화되지 않는다', { timeout: 30000 }, async t => {
  const fx = await serverFixture(t);
  const { a, b } = await othello(fx);
  const pageA = await fx.stream(a.session);
  const pageB = await fx.stream(b.session);
  const timerOf = async () => (await room(fx.req, a.session)).me.actionTimer;
  const first = await timerOf();
  assert.ok(first?.deadlineAt, '흑 차례 시계');
  await sleep(1500); // black has used some of the turn
  await pageB.close(); // white refreshes: the room pauses
  assert.equal((await room(fx.req, a.session)).game.paused, true);
  await sleep(800);
  const back = await fx.stream(b.session);
  const resumed = await timerOf();
  assert.equal((await room(fx.req, a.session)).game.paused, false);
  const shift = resumed.deadlineAt - first.deadlineAt;
  // Frozen during the pause (~0.8s), not restarted: a restart would move it by ~2.3s+.
  assert.ok(shift >= 500 && shift < 1800, `deadline shift ${shift}ms`);
  await back.close(); await pageA.close();
});

test('클라이언트: 게스트 세션은 탭의 sessionStorage로 새로고침 뒤 이어지고, 만료·접속 종료 때 지워진다', () => {
  const root = path.resolve(__dirname, '..');
  const lock = require('node:fs').readFileSync(path.join(root, 'public', 'session-lock.js'), 'utf8');
  const app = require('node:fs').readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  const html = require('node:fs').readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  assert.match(lock, /sessionStorage\.setItem\(STORAGE_KEY/);
  assert.match(lock, /document\.body\.dataset\.session = token;/);
  assert.match(lock, /if \(res\.status === 401\) \{ stop\(\); try \{ sessionStorage\.removeItem\(STORAGE_KEY\)/);
  assert.match(app, /function expireSession\([^)]*\) \{\n    try \{ sessionStorage\.removeItem\('gameCenterGuestSession'\); \} catch \{\}/);
  // session-lock.js must run before app.js reads document.body.dataset.session.
  assert.ok(html.indexOf('/session-lock.js') < html.indexOf('/app.js'));
  // Stale HTTP responses still never overwrite a newer SSE snapshot (v1.6.84).
  assert.match(app, /function isStaleRoomState\(next\)/);
  assert.match(app, /if \(isStaleRoomState\(parsed\)\) return;/);
});
