'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');

// v1.7.15 common point-reward events through the real server: the server clock and the registered
// definition decide everything; the account gets each event once (concurrent requests, another tab,
// a restart); the ledger records event_reward with the event's name; nothing in the request can pick the amount.

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const PASSWORD = 'event-reward-test';
const REWARD = 100_000;
const HOUR = 3_600_000;

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
    const headers = { 'X-Forwarded-For': `10.88.${Math.floor(++ip / 200) % 200}.${ip % 200 + 1}` };
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
  return { req, enter, guest, balance, admin, stop, logs: () => logs };
}

let counter = 0;
function definition(over = {}) {
  const now = Date.now();
  return {
    id: `test_event_${process.pid}_${++counter}`, title: '테스트 기념 이벤트', headline: '테스트 헤드라인', message: '테스트 메시지입니다.', rewardPoints: REWARD,
    startAt: new Date(now - HOUR).toISOString(), endAt: new Date(now + HOUR).toISOString(), buttonLabel: '100,000P 받기', note: '오늘 하루 · 계정당 1회',
    successMessage: '포인트를 받았습니다!', active: true, ...over,
  };
}
async function register(fx, person, over = {}, audience = 'self') {
  const event = definition(over);
  const res = await fx.req('/api/test/events', person.session, { event, audience });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  return event;
}

test('기간 중 최초 수령: +100,000P 전액, 잔액·원장·내역이 서버 기준으로 일치한다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'event-reward-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const me = await fx.guest('수령자');
  const event = await register(fx, me);
  const before = await fx.balance(me);

  const listed = await fx.req('/api/events', me.session);
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.data.events.map(item => [item.id, item.claimed, item.rewardPoints]), [[event.id, false, REWARD]], '활성·미수령');

  const claimed = await fx.req(`/api/events/${event.id}/claim`, me.session, {});
  assert.equal(claimed.status, 200, JSON.stringify(claimed.data));
  assert.deepEqual([claimed.data.claimed, claimed.data.granted, claimed.data.amount, claimed.data.balance], [true, true, REWARD, before + REWARD]);
  assert.equal(await fx.balance(me), before + REWARD);

  const history = (await fx.req('/api/points/history?limit=5', me.session)).data;
  const row = history.items[0];
  assert.deepEqual([row.reason, row.delta, row.balanceBefore, row.balanceAfter, row.memo, row.detail], ['event_reward', REWARD, before, before + REWARD, event.title, 'event']);
  assert.ok(!JSON.stringify(history).includes(event.id), '내역 응답에 계정·원장·멱등 키는 나오지 않는다');

  const after = await fx.req('/api/events', me.session);
  assert.deepEqual(after.data.events.map(item => [item.id, item.claimed]), [[event.id, true]], '수령 뒤에는 claimed');
});

test('이미 받은 계정의 재요청·새로고침·재시도는 정상 응답이며 추가 지급이 없다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'event-reward-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const me = await fx.guest('재요청');
  const event = await register(fx, me);
  const first = await fx.req(`/api/events/${event.id}/claim`, me.session, {});
  const balance = first.data.balance;
  for (let i = 0; i < 3; i += 1) {
    const again = await fx.req(`/api/events/${event.id}/claim`, me.session, {});
    assert.equal(again.status, 200);
    assert.deepEqual([again.data.claimed, again.data.granted, again.data.amount, again.data.balance], [true, false, 0, balance]);
  }
  assert.equal(await fx.balance(me), balance);
  const rows = (await fx.req('/api/points/history?limit=50', me.session)).data.items.filter(item => item.reason === 'event_reward');
  assert.equal(rows.length, 1, '원장에 이벤트 지급은 1행');
});

test('동시 요청(버튼 연타·여러 탭)은 정확히 한 번만 지급한다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'event-reward-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const me = await fx.guest('연타');
  const event = await register(fx, me);
  const before = await fx.balance(me);
  const results = await Promise.all(Array.from({ length: 12 }, () => fx.req(`/api/events/${event.id}/claim`, me.session, {})));
  assert.ok(results.every(item => item.status === 200), JSON.stringify(results.map(item => item.status)));
  assert.equal(results.filter(item => item.data.granted).length, 1);
  assert.equal(await fx.balance(me), before + REWARD);
  const rows = (await fx.req('/api/points/history?limit=50', me.session)).data.items.filter(item => item.reason === 'event_reward');
  assert.equal(rows.length, 1);
});

test('서버를 다시 시작해도(재접속) 받은 기록이 남아 다시 지급하지 않는다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'event-reward-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const me = await fx.guest('재시작');
  const event = await register(fx, me);
  await fx.req(`/api/events/${event.id}/claim`, me.session, {});
  const paid = await fx.balance(me);
  await fx.stop();

  const fx2 = await boot(t, dir);
  const session = await fx2.enter(me.key);
  assert.ok(session);
  const again = { ...me, session };
  await register(fx2, again, { ...event });
  const listed = await fx2.req('/api/events', session);
  assert.deepEqual(listed.data.events.map(item => [item.id, item.claimed]), [[event.id, true]], '재접속 뒤에도 수령 완료로 보인다');
  const retry = await fx2.req(`/api/events/${event.id}/claim`, session, {});
  assert.deepEqual([retry.status, retry.data.granted, retry.data.balance], [200, false, paid]);
});

test('기간이 아니거나 없는 이벤트는 지급하지 않고 목록에도 나오지 않는다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'event-reward-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const me = await fx.guest('기간');
  const now = Date.now();
  const ended = await register(fx, me, { startAt: new Date(now - 3 * HOUR).toISOString(), endAt: new Date(now - HOUR).toISOString() });
  const upcoming = await register(fx, me, { startAt: new Date(now + HOUR).toISOString(), endAt: new Date(now + 3 * HOUR).toISOString() });
  const off = await register(fx, me, { active: false });
  const before = await fx.balance(me);

  assert.deepEqual((await fx.req('/api/events', me.session)).data.events, [], '열려 있는 이벤트만 조회된다');
  const expectations = [[ended.id, 409, 'EVENT_ENDED'], [upcoming.id, 409, 'EVENT_NOT_STARTED'], [off.id, 404, 'EVENT_NOT_FOUND'], ['no_such_event', 404, 'EVENT_NOT_FOUND']];
  for (const [id, status, code] of expectations) {
    const res = await fx.req(`/api/events/${id}/claim`, me.session, {});
    assert.deepEqual([res.status, res.data.error], [status, code], id);
  }
  assert.equal(await fx.balance(me), before, '어느 경우에도 잔액 변화 없음');
  assert.equal((await fx.req('/api/events/BAD%20ID/claim', me.session, {})).status, 404);
  assert.equal((await fx.req(`/api/events/${ended.id}/claim`, null, {})).status, 401, '인증 없으면 401');
  assert.equal((await fx.req('/api/events', null)).status, 401);
});

test('클라이언트가 금액을 보내도 서버의 이벤트 정의 금액만 지급한다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'event-reward-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const me = await fx.guest('변조');
  const event = await register(fx, me);
  const before = await fx.balance(me);
  const res = await fx.req(`/api/events/${event.id}/claim?rewardPoints=99999999&amount=99999999`, me.session,
    { rewardPoints: 10_000_000, amount: 10_000_000, delta: 10_000_000, eventId: 'other', userId: 'admin', title: '조작' });
  assert.equal(res.status, 200);
  assert.deepEqual([res.data.granted, res.data.amount, res.data.title], [true, REWARD, event.title]);
  assert.equal(await fx.balance(me), before + REWARD);
});

test('한 계정의 이벤트 수령은 다른 계정에 영향이 없고, 각자 1회씩 받는다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'event-reward-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const a = await fx.guest('가');
  const b = await fx.guest('나');
  const event = await register(fx, a, {}, 'all'); // 모든 계정에 보이는 이벤트
  const beforeB = await fx.balance(b);
  const claimA = await fx.req(`/api/events/${event.id}/claim`, a.session, {});
  assert.equal(claimA.data.granted, true);
  assert.equal(await fx.balance(b), beforeB, '가의 수령은 나의 잔액을 바꾸지 않는다');
  assert.deepEqual((await fx.req('/api/events', b.session)).data.events.map(item => [item.id, item.claimed]), [[event.id, false]]);
  const claimB = await fx.req(`/api/events/${event.id}/claim`, b.session, {});
  assert.deepEqual([claimB.data.granted, claimB.data.balance], [true, beforeB + REWARD]);

  const secret = await register(fx, a); // 가에게만 보이는 테스트 이벤트
  assert.equal((await fx.req(`/api/events/${secret.id}/claim`, b.session, {})).status, 404);
});

test('다른 포인트 기능은 그대로: 출석 +50,000P, 관리자 지급, 이벤트와 함께 내역에 남는다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'event-reward-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const me = await fx.guest('회귀');
  const event = await register(fx, me);
  const start = await fx.balance(me);
  assert.equal((await fx.req('/api/points/attendance', me.session, {})).data.granted, true);
  await fx.req(`/api/events/${event.id}/claim`, me.session, {});
  const grant = await fx.req(`/api/admin/keys/${me.id}/points`, fx.admin, { requestId: crypto.randomUUID(), amount: 10_000, category: 'event' });
  assert.equal(grant.status, 200);
  assert.equal(await fx.balance(me), start + 50_000 + REWARD + 10_000);
  const reasons = (await fx.req('/api/points/history?limit=10', me.session)).data.items.map(item => item.reason);
  for (const reason of ['daily_attendance', 'event_reward', 'admin_grant']) assert.ok(reasons.includes(reason), reason);
});
