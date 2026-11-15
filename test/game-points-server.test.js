'use strict';
const rmAtExit = require('../test-support/rm-at-exit');
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

const freePort = require('../test-support/free-port'); // v1.10.77: one port per test, never shared across parallel files

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

// (G-포인트: a game against each other is friendly unless made with 「내기 1,000P」 -- these rooms bet; 고스톱 settles)
async function openRoom(fx, gameType, host, others, stakes = gameType !== 'gostop') {
  const created = await fx.req('/api/rooms', host.session, { gameType, ...(stakes ? { stakes: true } : {}) });
  assert.equal(created.status, 201);
  const code = created.data.state.me.roomCode;
  for (const person of others) assert.equal((await fx.req('/api/rooms/join', person.session, { code })).status, 200);
  return code;
}

test('일반 게임(오델로): 시작 때 1,000P씩, 승자 1,600P(20% 소각), 중복 종료 1회, 재대결은 다시 1,000P', { timeout: 60000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-points-'));
  rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */
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

test('G-포인트: 겨루는 판은 기본 친선(차감·지급 없음, 전적은 남음), 파티·협동은 포인트·전적 없음, 내기는 겨루는 판만', { timeout: 60000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-points-'));
  rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */
  const fx = await boot(t, dir);
  const [a, b, c] = [await fx.guest('친선흑'), await fx.guest('친선백'), await fx.guest('파티')];
  await openRoom(fx, 'othello', a, [b], false);
  assert.equal((await fx.req('/api/room/choose-role', a.session, { choice: 'black' })).status, 200);
  assert.equal((await fx.req('/api/room/choose-role', b.session, { choice: 'white' })).status, 200);
  let state = await fx.room(a);
  assert.deepEqual([state.game.status, state.points.policy, state.points.entryFee, state.points.entry], ['playing', 'friendly', 0, null]);
  await fx.req('/api/room/resign', b.session, {});
  await fx.room(a);
  assert.deepEqual([await fx.balance(a), await fx.balance(b)], [100_000, 100_000], '친선: 포인트 그대로');
  const records = (await fx.req('/api/records/me', a.session)).data;
  assert.equal(records.total?.wins ?? records.wins, 1, `친선도 전적은 남음 ${JSON.stringify(records).slice(0, 300)}`);
  for (const p of [a, b]) await fx.req('/api/room/leave', p.session, {});
  assert.equal((await fx.req('/api/rooms', c.session, { gameType: 'pictionary', stakes: true })).status, 400, '파티 게임엔 내기 없음');
  assert.equal((await fx.req('/api/rooms', c.session, { gameType: 'gostop', stakes: true })).status, 400, '고스톱은 점당 정산');
  assert.equal((await fx.req('/api/rooms', c.session, { gameType: 'pictionary' })).data.state.points.policy, 'none');
});

test('참가비 부족: 한 명이라도 1,000P 미만이면 시작하지 않고(자리 유지·아무도 차감 안 됨) 충전 후 시작된다', { timeout: 60000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-points-'));
  rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */
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
  assert.deepEqual([await fx.balance(a), await fx.balance(poor)], [99_000, 29_999]); // (출석 30,000)
});

test('다인·팀전: 동시 시작은 1회 차감, 4인 3승자 1,066P씩(잔여 소각), 2:2 승리팀 1,600P씩', { timeout: 60000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-points-'));
  rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */
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
  rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */
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
