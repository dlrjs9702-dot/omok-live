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
    server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); });
  });
}

async function startServer(dataDir, port) {
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, DATABASE_URL: '', ADMIN_PASSWORD: 'gostop-test', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  proc.stdout.on('data', chunk => { output += chunk; });
  proc.stderr.on('data', chunk => { output += chunk; });
  for (let i = 0; i < 100; i += 1) {
    if (proc.exitCode !== null) break;
    try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return proc; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`server failed: ${output}`);
}

async function stopServer(proc) {
  if (proc.exitCode !== null) return;
  proc.kill('SIGTERM');
  await new Promise(resolve => { proc.once('exit', resolve); setTimeout(resolve, 3000).unref(); });
}

test('포인트·출석·고스톱 서버 흐름: 정산 1회·비공개 손패·잔액 보존·0P 시작 차단', { timeout: 60_000 }, async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gostop-server-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  let proc = await startServer(dataDir, port);
  t.after(async () => { await stopServer(proc); await fs.rm(dataDir, { recursive: true, force: true }); });

  let ipCounter = 0;
  async function req(route, token, body, method = 'POST') {
    const headers = { 'X-Forwarded-For': `10.77.0.${(ipCounter = (ipCounter % 250) + 1)}` };
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    let data = {};
    try { data = await res.json(); } catch {}
    return { status: res.status, data };
  }
  const admin = (await req('/api/admin/login', null, { password: 'gostop-test' })).data.sessionToken;
  async function enter(html) {
    const token = html.match(/name="token" value="([^"]+)"/)[1];
    const res = await fetch(base + '/guest-entry', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-For': '10.78.0.1' },
      body: new URLSearchParams({ token }).toString() });
    assert.equal(res.status, 200);
    return (await res.text()).match(/data-session="([^"]+)"/)[1];
  }
  async function makeGuest(label) {
    const issued = await req('/api/admin/keys', admin, { label });
    assert.equal(issued.status, 201);
    return { keyId: issued.data.key.id, session: await enter(issued.data.html) };
  }
  const a = await makeGuest('건');
  const b = await makeGuest('지희');
  const c = await makeGuest('관전자');

  // 1) 최초 100,000P · 출석 +50,000P · 같은 날 중복 차단.
  let points = await req('/api/points', a.session, undefined, 'GET');
  assert.equal(points.data.balance, 100_000);
  assert.equal(points.data.attendance.claimed, false);
  const claims = await Promise.all([1, 2, 3].map(() => req('/api/points/attendance', a.session, {})));
  assert.equal(claims.filter(item => item.data.granted).length, 1);
  points = await req('/api/points', a.session, undefined, 'GET');
  assert.deepEqual([points.data.balance, points.data.attendance.claimed], [150_000, true]);
  assert.equal((await req('/api/points', null, undefined, 'GET')).status, 401);

  // 2) 입장파일 재발급·닉네임 변경 후에도 같은 포인트(재지급 없음).
  const reissued = await req(`/api/admin/keys/${a.keyId}/reissue`, admin, {});
  assert.equal(reissued.status, 200);
  a.session = await enter(reissued.data.html);
  assert.equal((await req(`/api/admin/keys/${a.keyId}/rename`, admin, { label: '건2' })).status, 200);
  a.session = await enter((await req(`/api/admin/keys/${a.keyId}/reissue`, admin, {})).data.html);
  assert.equal((await req('/api/points', a.session, undefined, 'GET')).data.balance, 150_000);

  // 3) 방 생성·점당 선택(방장만)·시작.
  const created = await req('/api/rooms', a.session, { gameType: 'gostop' });
  assert.equal(created.status, 201);
  const code = created.data.state.me.roomCode;
  assert.equal((await req('/api/rooms/join', b.session, { code })).status, 200);
  assert.equal((await req('/api/rooms/join', c.session, { code })).status, 200);
  assert.equal((await req('/api/room/choose-role', a.session, { choice: '1' })).status, 200);
  assert.equal((await req('/api/room/choose-role', b.session, { choice: '2' })).status, 200);
  assert.equal((await req('/api/room/choose-role', c.session, { choice: 'spectator' })).status, 200);
  assert.equal((await req('/api/room/set-gostop-stake', b.session, { pointsPerScore: 50 })).status, 403);
  assert.equal((await req('/api/room/set-gostop-stake', a.session, { pointsPerScore: 30 })).status, 409);
  assert.equal((await req('/api/room/set-gostop-stake', a.session, { pointsPerScore: 50 })).status, 200);
  assert.equal((await req('/api/room/start-gostop', b.session, {})).status, 403);
  const started = await req('/api/room/start-gostop', a.session, {});
  assert.equal(started.status, 200);
  const g0 = started.data.state.game;
  assert.equal(g0.mode, 'matgo');
  assert.equal(g0.pointsPerScore, 50);

  // 4) 비공개 손패: 각자 자기 패만, 관전자는 아무 손패도 받지 않는다.
  const view = async session => (await req('/api/room', session, undefined, 'GET')).data.state;
  const [va, vb, vc] = await Promise.all([view(a.session), view(b.session), view(c.session)]);
  const handA = va.me.myGostopHand.map(item => item.id);
  const handB = vb.me.myGostopHand.map(item => item.id);
  assert.equal(handA.length + handB.length >= 19, true);
  for (const id of handA) { assert.equal(JSON.stringify(vb).includes(`"${id}"`), false, `상대 손패 ${id} 노출`); assert.equal(JSON.stringify(vc).includes(`"${id}"`), false); }
  for (const id of handB) assert.equal(JSON.stringify(va).includes(`"${id}"`), false);
  assert.equal(vc.me.myGostopHand, null);
  assert.equal(vc.game.seats['1'].handCount, handA.length);

  // 5) 조작 방지: 남의 차례·없는 패·관전자 행동은 거부, 클라이언트가 보낸 금액은 무시.
  const turn = va.game.turn;
  const [mine, other] = turn === '1' ? [a, b] : [b, a];
  const otherHand = (turn === '1' ? handB : handA);
  assert.equal((await req('/api/room/gostop-play', other.session, { cardId: otherHand[0] })).status, 409);
  assert.equal((await req('/api/room/gostop-play', mine.session, { cardId: otherHand[0] })).status, 409);
  assert.equal((await req('/api/room/gostop-play', c.session, { cardId: handA[0] })).status, 403);

  // 5.5) 재접속: 게임 중 입장파일 재발급으로 세션이 끊겨도 다시 들어오면 손패·진행 상태가 그대로.
  const beforeReconnect = await view(a.session);
  a.session = await enter((await req(`/api/admin/keys/${a.keyId}/reissue`, admin, {})).data.html);
  const afterReconnect = await view(a.session);
  assert.equal(afterReconnect.me.seat, '1');
  assert.deepEqual(afterReconnect.me.myGostopHand, beforeReconnect.me.myGostopHand);
  for (const key of ['floor', 'turn', 'phase', 'deckCount', 'nagariStreak', 'pointsPerScore']) assert.deepEqual(afterReconnect.game[key], beforeReconnect.game[key], key);
  assert.deepEqual(afterReconnect.game.seats, beforeReconnect.game.seats);
  // 끊긴 동안 일시정지됐을 수 있으니 재접속 반영(일시정지 해제)까지 기다린다.
  for (let i = 0; i < 20 && (await view(a.session)).game.paused; i += 1) await new Promise(resolve => setTimeout(resolve, 100));

  // 6) 끝까지 진행(무작위 합법 행동) → 정산 1회, 포인트 총량 보존.
  const sessionOf = { get 1() { return a.session; }, 2: b.session };
  let state = await view(a.session);
  for (let step = 0; step < 200 && state.game.status === 'playing'; step += 1) {
    const g = state.game;
    const actor = sessionOf[g.turn];
    const me = await view(actor);
    let result;
    if (g.phase === 'play') {
      const hand = me.me.myGostopHand;
      result = hand.length
        ? await req('/api/room/gostop-play', actor, { cardId: hand[0].id, bomb: hand[0].bomb, amount: 99_999_999, score: 999 })
        : await req('/api/room/gostop-flip', actor, {});
    } else if (g.phase === 'choose-floor' || g.phase === 'choose-flip') result = await req('/api/room/gostop-choose', actor, { cardId: g.choice.options[0] });
    else if (g.phase === 'gukjin') result = await req('/api/room/gostop-gukjin', actor, { asPi: true });
    else if (g.phase === 'go-stop') result = await req('/api/room/gostop-decide', actor, { choice: 'stop' });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    state = await view(a.session);
  }
  assert.notEqual(state.game.status, 'playing');
  const balanceA = (await req('/api/points', a.session, undefined, 'GET')).data.balance;
  const balanceB = (await req('/api/points', b.session, undefined, 'GET')).data.balance;
  assert.equal(balanceA + balanceB, 250_000, '포인트 총량 보존');
  assert.equal(state.game.settlement.status, 'done');
  if (state.game.status === 'finished') {
    const paid = state.game.settlement.transfers.reduce((sum, item) => sum + item.paid, 0);
    assert.equal(Math.abs(balanceA - 150_000), paid);
    assert.equal(state.game.result.losers[0].amount, state.game.settlement.transfers[0].requested);
    assert.ok(state.me.pointBalance === balanceA);
  } else {
    assert.equal(state.game.result.kind, 'nagari');
    assert.equal(balanceA, 150_000);
  }
  // 재수신·다음 판 준비가 반복돼도 재정산 없음.
  await view(a.session); await view(b.session);
  assert.equal((await req('/api/room/next-round', a.session, {})).status, 200);
  assert.equal((await req('/api/points', a.session, undefined, 'GET')).data.balance, balanceA);
  assert.equal((await req('/api/points', b.session, undefined, 'GET')).data.balance, balanceB);

  // 7) 재시작 후 잔액 유지 + 0P 사용자는 시작 불가(관전은 가능).
  await stopServer(proc);
  const file = path.join(dataDir, 'points.json');
  const saved = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(saved.accounts[`guest:${a.keyId}`].balance, balanceA);
  saved.accounts[`guest:${b.keyId}`].balance = 0; // simulate a player who lost everything
  await fs.writeFile(file, JSON.stringify(saved));
  proc = await startServer(dataDir, port);
  const admin2 = (await req('/api/admin/login', null, { password: 'gostop-test' })).data.sessionToken;
  const reenter = async keyId => enter((await req(`/api/admin/keys/${keyId}/reissue`, admin2, {})).data.html);
  a.session = await reenter(a.keyId); b.session = await reenter(b.keyId);
  assert.equal((await req('/api/points', a.session, undefined, 'GET')).data.balance, balanceA);
  const room2 = await req('/api/rooms', a.session, { gameType: 'gostop' });
  assert.equal((await req('/api/rooms/join', b.session, { code: room2.data.state.me.roomCode })).status, 200);
  await req('/api/room/choose-role', a.session, { choice: '1' });
  await req('/api/room/choose-role', b.session, { choice: '2' });
  const blocked = await req('/api/room/start-gostop', a.session, {});
  assert.equal(blocked.status, 409);
  assert.equal(blocked.data.error, 'NO_POINTS');
  assert.match(blocked.data.message, /0P/);
});
