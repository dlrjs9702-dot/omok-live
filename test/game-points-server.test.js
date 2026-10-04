'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');

// v1.7.3 common game points through the real server: entry fee at the start of a game (all or
// nothing), 80% to the winners / 20% burned, no fee for spectators or reconnects, refund of games
// a restart cut off, Go-Stop without an entry fee, and the operator point grant API.

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const PASSWORD = 'game-points-test';

async function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); });
  });
}

async function boot(t, dataDir) {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, DATABASE_URL: '', ADMIN_PASSWORD: PASSWORD, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', data => { logs += data.toString(); });
  child.stderr.on('data', data => { logs += data.toString(); });
  const stop = async () => {
    if (child.exitCode !== null) return;
    child.kill('SIGTERM');
    await new Promise(resolve => { child.once('exit', resolve); setTimeout(resolve, 2000).unref(); });
  };
  t.after(stop);
  for (let i = 0; i < 120 && child.exitCode === null; i += 1) {
    try { if ((await fetch(base + '/health')).ok) break; } catch {}
    await sleep(100);
  }
  let ip = 0;
  async function req(route, token, body, method = body === undefined ? 'GET' : 'POST') {
    const headers = { 'X-Forwarded-For': `10.77.${Math.floor(++ip / 200) % 200}.${ip % 200 + 1}` };
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }
  const admin = (await req('/api/admin/login', null, { password: PASSWORD })).data.sessionToken;
  assert.ok(admin, logs);
  async function enter(key) {
    const res = await fetch(base + '/guest-entry', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: key }).toString() });
    return (await res.text()).match(/data-session="([^"]+)"/)?.[1];
  }
  async function guest(label) {
    const issued = await req('/api/admin/keys', admin, { label });
    assert.equal(issued.status, 201);
    const key = issued.data.html.match(/name="token" value="([^"]+)"/)[1];
    return { label, key, id: issued.data.key.id, session: await enter(key) };
  }
  const balance = async person => (await req('/api/points', person.session)).data.balance;
  const room = async person => (await req('/api/room', person.session)).data.state;
  return { req, enter, guest, balance, room, admin, stop, base, logs: () => logs };
}

async function openRoom(fx, gameType, host, others) {
  const created = await fx.req('/api/rooms', host.session, { gameType });
  assert.equal(created.status, 201);
  const code = created.data.state.me.roomCode;
  for (const person of others) assert.equal((await fx.req('/api/rooms/join', person.session, { code })).status, 200);
  return code;
}

test('일반 게임(오델로): 시작 때 1,000P씩, 승자 1,600P(20% 소각), 중복 종료 1회, 재대결은 다시 1,000P', { timeout: 60000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-points-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const [a, b, watcher] = [await fx.guest('흑'), await fx.guest('백'), await fx.guest('관전')];
  await openRoom(fx, 'othello', a, [b, watcher]);
  assert.equal((await fx.req('/api/room/choose-role', watcher.session, { choice: 'spectator' })).status, 200);
  assert.equal((await fx.req('/api/room/choose-role', a.session, { choice: 'black' })).status, 200);
  assert.deepEqual([await fx.balance(a), await fx.balance(b)], [100_000, 100_000], '좌석 선택만으로는 차감 없음');
  assert.equal((await fx.req('/api/room/choose-role', b.session, { choice: 'white' })).status, 200);
  let state = await fx.room(a);
  assert.equal(state.game.status, 'playing');
  assert.deepEqual(state.points.entry && [state.points.entry.status, state.points.entry.pool], ['charged', 2_000]);
  assert.equal(state.points.policy, 'entry');
  assert.deepEqual([await fx.balance(a), await fx.balance(b), await fx.balance(watcher)], [99_000, 99_000, 100_000], '관전자는 무료');
  assert.equal(JSON.stringify(state).includes('guest:'), false, '포인트 계정 id 미노출');

  // 같은 판 재접속: 추가 차감 없음.
  await fx.req('/api/session/release', null, { sessionToken: b.session });
  await sleep(10);
  b.session = await fx.enter(b.key);
  assert.equal((await fx.room(b)).me.seat, 'white');
  assert.equal(await fx.balance(b), 99_000);

  // 종료 요청 중복·동시 → 보상 1회.
  await Promise.all([1, 2, 3].map(() => fx.req('/api/room/resign', b.session, {})));
  await Promise.all([fx.room(a), fx.room(b), fx.room(watcher)]);
  assert.deepEqual([await fx.balance(a), await fx.balance(b)], [100_600, 99_000], '승자 +1,600P(순 +600P)');
  state = await fx.room(a);
  assert.deepEqual([state.points.entry.status, state.points.entry.each, state.points.entry.burned], ['settled', 1_600, 400]);
  assert.ok(state.chat.messages.some(m => m.type === 'system' && m.text.includes('1,600P씩 지급') && m.text.includes('400P 소각')));
  const history = (await fx.req('/api/points/history', a.session)).data.items;
  assert.deepEqual(history.slice(0, 2).map(item => [item.reason, item.gameType, item.delta]), [['game_reward', 'othello', 1_600], ['game_entry', 'othello', -1_000]]);

  // 재대결: 버튼만으로는 차감 없음 → 새 판이 실제 시작될 때 다시 1,000P.
  await Promise.all([fx.req('/api/room/next-round', a.session, {}), fx.req('/api/room/next-round', b.session, {})]);
  assert.deepEqual([await fx.balance(a), await fx.balance(b)], [100_600, 99_000]);
  assert.equal((await fx.req('/api/room/choose-role', a.session, { choice: 'black' })).status, 200);
  assert.equal((await fx.req('/api/room/choose-role', b.session, { choice: 'white' })).status, 200);
  assert.deepEqual([await fx.balance(a), await fx.balance(b)], [99_600, 98_000]);

  // 자진 이탈: 환불 없음, 엔진(일시정지 → 종료) 결과대로 상대 승리.
  assert.equal((await fx.req('/api/room/leave', b.session, {})).status, 200);
  assert.equal((await fx.req('/api/room/end-game', a.session, {})).status, 200);
  await fx.room(a);
  assert.deepEqual([await fx.balance(a), await fx.balance(b)], [101_200, 98_000], '떠난 사람 환불 없음');
});

test('참가비 부족: 한 명이라도 1,000P 미만이면 시작하지 않고(자리 유지·아무도 차감 안 됨) 충전 후 시작된다', { timeout: 60000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-points-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const [a, poor] = [await fx.guest('가'), await fx.guest('부족')];
  await openRoom(fx, 'connect4', a, [poor]);
  assert.equal((await fx.req('/api/test/points-spend', poor.session, { balance: 999 })).data.balance, 999);
  assert.equal((await fx.req('/api/room/choose-role', a.session, { choice: 'black' })).status, 200);
  const blocked = await fx.req('/api/room/choose-role', poor.session, { choice: 'white' });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.data.error, 'INSUFFICIENT_POINTS');
  assert.match(blocked.data.message, /부족/);
  assert.match(blocked.data.message, /부족$|: 부족/);
  assert.equal(/999|100,000|잔액/.test(blocked.data.message), false, '다른 사람 잔액은 알리지 않음');
  let state = await fx.room(a);
  assert.equal(state.game.status, 'selecting');
  assert.equal(state.players.white?.label, '부족', '자리는 유지');
  assert.equal(state.points.entry, null);
  assert.deepEqual([await fx.balance(a), await fx.balance(poor)], [100_000, 999]);
  assert.ok(state.chat.messages.some(m => m.type === 'system' && m.text.includes('부족')));
  assert.equal((await fx.req('/api/points/attendance', poor.session, {})).data.granted, true);
  assert.equal((await fx.req('/api/room/choose-role', poor.session, { choice: 'white' })).status, 200);
  state = await fx.room(a);
  assert.equal(state.game.status, 'playing');
  assert.deepEqual([await fx.balance(a), await fx.balance(poor)], [99_000, 49_999]);
});

test('다인·팀전: 동시 시작은 1회 차감, 4인 3승자 1,066P씩(잔여 소각), 2:2 승리팀 1,600P씩', { timeout: 60000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-points-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const people = [await fx.guest('일'), await fx.guest('이'), await fx.guest('삼'), await fx.guest('사')];
  await openRoom(fx, 'davinci', people[0], people.slice(1));
  for (const [i, person] of people.entries()) assert.equal((await fx.req('/api/room/choose-role', person.session, { choice: String(i + 1) })).status, 200);
  const starts = await Promise.all([1, 2, 3, 4].map(() => fx.req('/api/room/start-davinci', people[0].session, {})));
  assert.equal(starts.filter(item => item.status === 200).length, 1, JSON.stringify(starts.map(item => item.status)));
  assert.deepEqual(await Promise.all(people.map(fx.balance)), [99_000, 99_000, 99_000, 99_000], '동시 시작 요청에도 1,000P 한 번');
  assert.equal((await fx.req('/api/room/resign', people[3].session, {})).status, 200);
  await fx.room(people[0]);
  assert.deepEqual(await Promise.all(people.map(fx.balance)), [100_066, 100_066, 100_066, 99_000], '3,200P ÷ 3 = 1,066P, 2P 추가 소각');
  assert.equal((await fx.room(people[0])).points.entry.burned, 802);

  const team = [await fx.guest('흑1'), await fx.guest('백1'), await fx.guest('흑2'), await fx.guest('백2')];
  await openRoom(fx, 'omok2v2', team[0], team.slice(1));
  for (const [i, person] of team.entries()) assert.equal((await fx.req('/api/room/choose-role', person.session, { choice: String(i + 1) })).status, 200);
  assert.equal((await fx.room(team[0])).game.status, 'playing');
  assert.equal((await fx.req('/api/room/resign', team[0].session, {})).status, 200); // 흑팀(1·3번) 기권
  await fx.room(team[0]);
  assert.deepEqual(await Promise.all(team.map(fx.balance)), [99_000, 100_600, 99_000, 100_600], '승리팀(2·4번) 1,600P씩');
});

test('고스톱은 참가비 없음, 서버 재시작으로 끝나지 못한 판은 재시작 때 1회 환불', { timeout: 60000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-points-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  let fx = await boot(t, dir);
  const [a, b] = [await fx.guest('가'), await fx.guest('나')];
  await openRoom(fx, 'gostop', a, [b]);
  for (const [i, person] of [a, b].entries()) assert.equal((await fx.req('/api/room/choose-role', person.session, { choice: String(i + 1) })).status, 200);
  const started = await fx.req('/api/room/start-gostop', a.session, {});
  assert.equal(started.status, 200, JSON.stringify(started.data));
  assert.equal((await fx.room(a)).points.policy, 'settlement');
  // no entry fee: nobody's history has a game_entry row (the deal itself may already move a special bonus between them)
  for (const person of [a, b]) assert.ok(!(await fx.req('/api/points/history', person.session)).data.items.some((item) => item.reason === 'game_entry'), '고스톱은 1,000P 참가비 없음');
  const afterGostop = [await fx.balance(a), await fx.balance(b)];
  assert.equal((await fx.req('/api/room/leave', a.session, {})).status, 200);
  assert.equal((await fx.req('/api/room/leave', b.session, {})).status, 200);

  await openRoom(fx, 'othello', a, [b]);
  assert.equal((await fx.req('/api/room/choose-role', a.session, { choice: 'black' })).status, 200);
  assert.equal((await fx.req('/api/room/choose-role', b.session, { choice: 'white' })).status, 200);
  assert.deepEqual([await fx.balance(a), await fx.balance(b)], afterGostop.map((n) => n - 1_000));
  await fx.stop(); // 진행 중인 판이 서버와 함께 사라진다

  fx = await boot(t, dir);
  assert.match(fx.logs(), /참가 포인트 환불: 재시작으로 끝나지 못한 게임 1판/);
  a.session = await fx.enter(a.key);
  b.session = await fx.enter(b.key);
  assert.deepEqual([await fx.balance(a), await fx.balance(b)], afterGostop, '전액 환불');
  const items = (await fx.req('/api/points/history', a.session)).data.items;
  assert.deepEqual([items[0].reason, items[0].gameType, items[0].delta], ['game_refund', 'othello', 1_000]);
  await fx.stop();
  fx = await boot(t, dir);
  a.session = await fx.enter(a.key);
  assert.equal(await fx.balance(a), afterGostop[0], '두 번째 재시작에서는 다시 환불하지 않음');
});

test('관리자 포인트 지급 API: 10,000P 단위·사유 필수·관리자만·요청 1회·원장/내역 기록', { timeout: 60000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-points-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const target = await fx.guest('홍길동');
  const intruder = await fx.guest('일반');
  const grant = (token, body, id = target.id) => fx.req(`/api/admin/keys/${id}/points`, token, { requestId: crypto.randomUUID(), category: 'event', ...body });
  let expected = 100_000;
  for (const amount of [10_000, 50_000, 100_000, 30_000]) {
    const result = await grant(fx.admin, { amount });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.deepEqual([result.data.applied, result.data.label, result.data.balanceBefore, result.data.balanceAfter], [true, '홍길동', expected, expected + amount]);
    expected += amount;
  }
  for (const amount of [15_000, 0, -10_000, 'abc', 1e12]) assert.equal((await grant(fx.admin, { amount })).status, 400, String(amount));
  assert.equal((await grant(fx.admin, { amount: 10_000, category: '' })).status, 400, '사유 필수');
  assert.equal((await grant(fx.admin, { amount: 10_000, requestId: 'x' })).status, 400);
  assert.equal((await grant(intruder.session, { amount: 10_000 })).status, 403, '일반 사용자 불가');
  assert.equal((await grant(null, { amount: 10_000 })).status, 401);
  assert.equal((await grant(fx.admin, { amount: 10_000 }, crypto.randomUUID())).status, 404, '없는 계정');
  // 같은 확인 요청이 두 번(연타·재시도) 와도 1회.
  const requestId = crypto.randomUUID();
  const twice = await Promise.all([1, 2].map(() => grant(fx.admin, { amount: 50_000, category: 'correction', requestId })));
  assert.deepEqual(twice.map(item => item.status), [200, 200]);
  assert.equal(twice.filter(item => item.data.applied).length, 1);
  expected += 50_000;
  assert.equal(await fx.balance(target), expected, '소각 없이 전액');
  const memo = await grant(fx.admin, { amount: 10_000, category: 'other', memo: '서버 점검\n보상' });
  assert.equal(memo.status, 200);
  const items = (await fx.req('/api/points/history', target.session)).data.items;
  assert.deepEqual([items[0].reason, items[0].detail, items[0].memo, items[0].delta], ['admin_grant', 'other', '서버 점검 보상', 10_000]);
  assert.deepEqual([items[1].reason, items[1].detail, items[1].balanceBefore, items[1].balanceAfter], ['admin_grant', 'correction', expected - 50_000, expected]);
  assert.equal(await fx.balance(intruder), 100_000, '다른 계정 영향 없음');
  assert.equal(JSON.stringify(items).includes(PASSWORD) || JSON.stringify(items).includes(fx.admin), false, '비밀값 미노출');
  // 권한 취소된 계정에는 지급하지 않는다.
  assert.equal((await fx.req(`/api/admin/keys/${intruder.id}/revoke`, fx.admin, {})).status, 200);
  assert.equal((await grant(fx.admin, { amount: 10_000 }, intruder.id)).status, 404);
});

// ---- v1.7.6 recovery paths (PR #53 review follow-up) ------------------------------------------
async function connect4Pair(fx) {
  const [a, b] = [await fx.guest('가'), await fx.guest('나')];
  await openRoom(fx, 'connect4', a, [b]);
  assert.equal((await fx.req('/api/room/choose-role', a.session, { choice: 'black' })).status, 200);
  return [a, b];
}
const reasons = async (fx, person) => (await fx.req('/api/points/history?limit=10', person.session)).data.items.map(item => item.reason);

test('참가비 COMMIT 직후 오류: 재시도해도 이중 차감되지 않는다(즉시 복구, 복구 실패 시 정기 정리)', { timeout: 60000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-points-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const [a, b] = await connect4Pair(fx);

  // 1) 저장은 됐는데 응답이 실패: 시작은 취소되고 같은 참가비를 바로 환불한다.
  assert.equal((await fx.req('/api/test/points-fault', a.session, { chargeAfterCommit: 1 })).status, 200);
  const failed = await fx.req('/api/room/choose-role', b.session, { choice: 'white' });
  assert.equal(failed.status, 503);
  assert.equal(failed.data.error, 'POINTS_UNAVAILABLE');
  assert.equal((await fx.room(a)).game.status, 'selecting');
  assert.deepEqual([await fx.balance(a), await fx.balance(b)], [100_000, 100_000], '차감이 남지 않는다');
  assert.deepEqual((await reasons(fx, b)).slice(0, 2), ['game_refund', 'game_entry']);
  assert.equal((await fx.req('/api/room/choose-role', b.session, { choice: 'white' })).status, 200, '재시도 성공');
  assert.deepEqual([await fx.balance(a), await fx.balance(b)], [99_000, 99_000], '재시도는 1,000P 한 번만');
  assert.equal((await fx.req('/api/test/points-sweep', a.session, {})).data.refunded, 0, '진행 중인 판의 참가비는 정리 대상이 아니다');
  assert.deepEqual([await fx.balance(a), await fx.balance(b)], [99_000, 99_000]);
});

test('참가비 오류 뒤 즉시 환불도 실패하면 잔액이 묶이지만 정기 정리가 한 번만 환불한다', { timeout: 60000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-points-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const [a, b] = await connect4Pair(fx);
  assert.equal((await fx.req('/api/test/points-fault', a.session, { chargeAfterCommit: 1, refundFail: 1 })).status, 200);
  assert.equal((await fx.req('/api/room/choose-role', b.session, { choice: 'white' })).status, 503);
  assert.deepEqual([await fx.balance(a), await fx.balance(b)], [99_000, 99_000], '복구가 실패한 동안 묶여 있다');
  assert.equal((await fx.req('/api/room/choose-role', b.session, { choice: 'white' })).status, 200);
  assert.deepEqual([await fx.balance(a), await fx.balance(b)], [98_000, 98_000], '새 참가비(다른 id)는 별개');
  assert.equal((await fx.req('/api/test/points-sweep', a.session, {})).data.refunded, 1, '고아 참가비만 환불');
  assert.deepEqual([await fx.balance(a), await fx.balance(b)], [99_000, 99_000], '최종적으로 참가비는 한 번');
  assert.equal((await fx.req('/api/test/points-sweep', a.session, {})).data.refunded, 0, '반복 정리는 추가로 주지 않는다');
  assert.deepEqual([await fx.balance(a), await fx.balance(b)], [99_000, 99_000]);
});

test('만료된 방의 환불이 DB 오류로 실패해도 재시도로 한 번 환불된다(그동안 고아 정리가 끼어들지 않는다)', { timeout: 60000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-points-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const [a, b] = await connect4Pair(fx);
  assert.equal((await fx.req('/api/room/choose-role', b.session, { choice: 'white' })).status, 200);
  assert.deepEqual([await fx.balance(a), await fx.balance(b)], [99_000, 99_000]);
  assert.equal((await fx.req('/api/test/points-fault', a.session, { refundFail: 1 })).status, 200);
  assert.equal((await fx.req('/api/test/expire-room', a.session, {})).status, 200);
  await sleep(300);
  assert.deepEqual([await fx.balance(a), await fx.balance(b)], [99_000, 99_000], '첫 환불은 실패');
  assert.equal((await fx.req('/api/test/points-sweep', a.session, {})).data.refunded, 0, '재시도 중인 참가비는 고아가 아니다');
  for (let i = 0; i < 40 && await fx.balance(a) !== 100_000; i += 1) await sleep(250);
  assert.deepEqual([await fx.balance(a), await fx.balance(b)], [100_000, 100_000], '재시도로 환불');
  await sleep(300);
  assert.deepEqual([await fx.balance(a), await fx.balance(b)], [100_000, 100_000], '한 번만');
  assert.equal((await reasons(fx, a)).filter(reason => reason === 'game_refund').length, 1);
});

test('관리자 지급: 접속 중인 대상에게 pointsChanged가 가고, 제한은 대상이 달라도 전체 분당 20회', { timeout: 60000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-points-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const people = [await fx.guest('하나'), await fx.guest('둘'), await fx.guest('셋')];
  const grant = (person, extra = {}) => fx.req(`/api/admin/keys/${person.id}/points`, fx.admin, { requestId: crypto.randomUUID(), category: 'event', amount: 10_000, ...extra });

  // 대상의 로비 SSE에 pointsChanged가 도착한다(다른 사람에게는 가지 않는다).
  const listen = async (person) => {
    const controller = new AbortController();
    const seen = { text: '' };
    const res = await fetch(fx.base + '/api/lobby/events', { headers: { 'X-Session-Token': person.session }, signal: controller.signal });
    (async () => { try { for await (const chunk of res.body) seen.text += Buffer.from(chunk).toString(); } catch {} })();
    t.after(() => controller.abort());
    return seen;
  };
  const [target, other] = [await listen(people[0]), await listen(people[1])];
  await sleep(300);
  assert.equal(target.text.includes('pointsChanged'), false);
  assert.equal((await grant(people[0])).status, 200);
  for (let i = 0; i < 30 && !target.text.includes('event: pointsChanged'); i += 1) await sleep(100);
  assert.ok(target.text.includes('event: pointsChanged'), '대상에게 갱신 이벤트');
  await sleep(200);
  assert.equal(other.text.includes('event: pointsChanged'), false, '다른 사용자에게는 보내지 않는다');
  // 같은 요청 id 재전송은 지급도 이벤트도 다시 만들지 않는다.
  const same = crypto.randomUUID();
  assert.equal((await grant(people[2], { requestId: same })).data.applied, true);
  const before = target.text.length;
  assert.equal((await grant(people[0], { requestId: same })).status, 409);

  // 전체 20회: 이미 성공 2건 + 여기서 18건 = 20건, 대상이 달라도 21번째는 429.
  for (let i = 0; i < 17; i += 1) assert.equal((await grant(people[i % 3])).status, 200, `${i}`);
  const limited = await grant(people[1]);
  assert.equal(limited.status, 429);
  assert.equal(limited.data.error, 'GRANT_RATE_LIMIT');
  assert.ok(before <= target.text.length);
});
