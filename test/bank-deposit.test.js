'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JsonPointStore, PostgresPointStore, bankAccrue } = require('../lib/point-store');
const { testDatabase } = require('../test-support/pg-database');
const { boot } = require('../test-support/test-server');
const T = require('../public/plaza/island-terrain');

// v1.10.85 관공서 예금 창구 (사용자 2026-10-17): 4% a day, compounding at each Seoul midnight, no cap, in and out freely,
// no loans; the wallet and the deposit kept apart; each request once.
test('예금 이자: 자정마다 4% 복리, 같은 날은 그대로, 안전한 수 범위에서 멈춤', () => {
  assert.equal(bankAccrue(100000, '2026-10-17', '2026-10-17'), 100000);
  assert.equal(bankAccrue(100000, '2026-10-16', '2026-10-17'), 104000);
  assert.equal(bankAccrue(100000, '2026-10-15', '2026-10-17'), 108160);
  assert.equal(bankAccrue(10, '2026-10-16', '2026-10-17'), 10); // 0.4P rounds down
  assert.equal(bankAccrue(0, '2026-01-01', '2026-10-17'), 0);
  assert.equal(bankAccrue(1e15, '2026-01-01', '2027-01-01'), Number.MAX_SAFE_INTEGER);
});

async function storeBehaves(store) {
  const U = 'guest:00000000-0000-4000-8000-0000000000b1';
  const day1 = Date.parse('2026-10-17T12:00:00+09:00'); const day3 = Date.parse('2026-10-19T09:00:00+09:00');
  assert.deepEqual(await store.bankView(U, day1), { balance: 100000, deposit: 0, rate: 0.04 });
  assert.equal((await store.bankMove(U, 150000, 'req-in-0001', day1)).reason, 'insufficient');
  assert.deepEqual(await store.bankMove(U, 60000, 'req-in-0002', day1), { applied: true, balance: 40000, deposit: 60000, rate: 0.04 });
  assert.equal((await store.bankMove(U, 60000, 'req-in-0002', day1)).applied, false, '같은 요청은 한 번');
  assert.deepEqual(await store.bankView(U, day1), { balance: 40000, deposit: 60000, rate: 0.04 });
  assert.deepEqual(await store.bankView(U, day3), { balance: 40000, deposit: 64896, rate: 0.04 }); // 60000 → 62400 → 64896
  assert.equal((await store.bankMove(U, -70000, 'req-out-0001', day3)).reason, 'insufficient');
  assert.deepEqual(await store.bankMove(U, -64896, 'req-out-0002', day3), { applied: true, balance: 104896, deposit: 0, rate: 0.04 });
  assert.equal((await store.getAccount(U)).balance, 104896);
}

test('예금 저장소: JSON·PostgreSQL 같은 동작(맡기기·이자·찾기·부족·한 번만)', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bank-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const json = new JsonPointStore(path.join(dir, 'points.json'), { initialGrant: 100000 }); await json.init();
  await storeBehaves(json);
  const database = await testDatabase(); t.after(() => database.stop());
  const pg = new PostgresPointStore(database.url, { initialGrant: 100000 }); t.after(() => pg.pool.end()); await pg.init(); await pg.init();
  await storeBehaves(pg);
});

test('예금 API: 관공서 안 예금 창구에서만, 맡기기·찾기·포인트 내역', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bank-server-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('예금손님'));
  const stand = (x, z) => req('/api/plaza/state', a, { x, z, yaw: 0, moving: false });
  const door = T.facilityDoor('townhall'); const R = T.TOWNHALL_ROOM;
  await stand(door.x, door.z);
  assert.equal((await req('/api/island/bank', a)).data.error, 'TOO_FAR', '실내 창구가 아니면 안 됨');
  assert.equal((await req('/api/island/townhall/enter', a, {})).status, 200);
  const desk = T.roomWorld(R.desk.lx, R.desk.lz); const bank = T.roomWorld(R.bank.lx, R.bank.lz);
  await stand(desk.x - 2, desk.z);
  assert.equal((await req('/api/island/bank', a)).data.error, 'TOO_FAR', '민원 창구 쪽 끝은 멀다');
  await stand(bank.x, bank.z);
  const view = (await req('/api/island/bank', a)).data;
  assert.equal(view.deposit, 0); assert.equal(view.rate, 0.04);
  assert.equal((await req('/api/island/bank', a, { amount: 1.5, requestId: 'bank-bad-01' })).status, 400);
  const put = (await req('/api/island/bank', a, { amount: 30000, requestId: 'bank-in-0001' })).data;
  assert.deepEqual([put.applied, put.balance, put.deposit], [true, view.balance - 30000, 30000]);
  assert.equal((await req('/api/island/bank', a, { amount: -40000, requestId: 'bank-out-001' })).data.error, 'INSUFFICIENT');
  const took = (await req('/api/island/bank', a, { amount: -10000, requestId: 'bank-out-002' })).data;
  assert.deepEqual([took.balance, took.deposit], [view.balance - 20000, 20000]);
  const history = JSON.stringify((await req('/api/points/history', a)).data);
  assert.ok(history.includes('bank_deposit') && history.includes('bank_withdraw'));
});

// Codex review: the counted day never goes back (a late request from before midnight), and a move past a safe number on
// either side is refused rather than losing points
test('예금 경계: 늦게 온 전날 요청이 기준일을 되돌리지 않음, 안전한 수를 넘는 이동은 거절', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bank-edge-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const store = new JsonPointStore(path.join(dir, 'points.json'), { initialGrant: 100000 }); await store.init();
  const U = 'guest:00000000-0000-4000-8000-0000000000b2';
  const d1 = Date.parse('2026-10-17T23:59:00+09:00'); const d2 = Date.parse('2026-10-18T00:01:00+09:00');
  await store.bankMove(U, 10000, 'edge-in-0001', d1);
  assert.equal((await store.bankView(U, d2)).deposit, 10400);
  await store.bankMove(U, 1, 'edge-in-late', d1); // arrives late, dated the day before
  assert.equal((await store.bankView(U, d2)).deposit, 10401, '그 자정 이자를 다시 세지 않음');
  store.data.accounts[U].deposit = Number.MAX_SAFE_INTEGER - 1;
  const r = await store.bankMove(U, 5, 'edge-in-0002', d2);
  assert.deepEqual([r.applied, r.reason], [false, 'limit']);
});
