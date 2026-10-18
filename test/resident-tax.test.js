'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JsonPointStore, PostgresPointStore, taxSplit, TAX_DEBT_MAX } = require('../lib/point-store');
const { testDatabase } = require('../test-support/pg-database');
const { boot } = require('../test-support/test-server');
const T = require('../public/plaza/island-terrain');

// v1.10.86 주민세 (사용자 2026-10-17): each day 3% of wallet + deposit, at least 20,000P, from every account; the wallet
// first, then the deposit; what is left is owed, up to 200,000P; owing makes a 체납자 (the title, the striped outfit) until
// it is paid at the 민원 창구.
test('주민세 계산: 3%·최소 2만·지갑 먼저·예금 다음·모자라면 체납', () => {
  assert.deepEqual(taxSplit(1000000, 0), { tax: 30000, fromWallet: 30000, fromDeposit: 0, owed: 0 });
  assert.deepEqual(taxSplit(100000, 0), { tax: 20000, fromWallet: 20000, fromDeposit: 0, owed: 0 });
  assert.deepEqual(taxSplit(5000, 10000), { tax: 20000, fromWallet: 5000, fromDeposit: 10000, owed: 5000 });
  assert.equal(TAX_DEBT_MAX, 200000);
});

async function storeBehaves(store) {
  const U = 'guest:00000000-0000-4000-8000-0000000000c1';
  await store.ensureAccount(U); // 30,000 to start (initialGrant)
  const first = await store.taxCollect(U, '2026-10-17');
  assert.deepEqual([first.applied, first.fromWallet, first.debt], [true, 20000, 0]);
  assert.equal((await store.taxCollect(U, '2026-10-17')).applied, false, '하루 한 번');
  const second = await store.taxCollect(U, '2026-10-18'); // 10,000 left: 10,000 owed
  assert.deepEqual([second.fromWallet, second.owed, second.debt], [10000, 10000, 10000]);
  for (let d = 19; d < 40; d += 1) await store.taxCollect(U, `2026-10-${d}`);
  assert.equal((await store.taxDebts())[U], TAX_DEBT_MAX, '체납은 최대 20만');
  assert.equal((await store.taxPay(U, 'pay-0001')).applied, false, '낼 포인트가 없으면 그대로');
  const R = await store.bankMove(U, 0, 'x', Date.now()).catch((e) => e); assert.ok(R instanceof RangeError);
  // paid from the deposit alone, then the same request sent again: nothing taken twice (Codex review)
  const V = 'guest:00000000-0000-4000-8000-0000000000c2'; const day = Date.parse('2026-11-01T12:00:00+09:00');
  await store.ensureAccount(V); await store.noteVisit(V, day); await store.bankMove(V, 30000, 'v-in-0001', day);
  await store.taxCollect(V, '2026-11-01'); await store.taxCollect(V, '2026-11-02'); // 20,000; then 10,400 (with a day's interest) + 9,600 owed
  assert.equal((await store.taxDebts())[V], 9600);
  await store.claimAttendance(V, day); const w = (await store.getAccount(V)).balance; await store.bankMove(V, w, 'v-in-0002', day);
  const paid = await store.taxPay(V, 'v-pay-0001', day); assert.deepEqual([paid.applied, paid.paid, paid.debt], [true, 9600, 0]);
  const before = await store.bankView(V, day);
  assert.equal((await store.taxPay(V, 'v-pay-0001', day)).applied, false);
  assert.deepEqual(await store.bankView(V, day), before);
}

test('주민세 저장소: JSON·PostgreSQL 같은 동작(하루 한 번·체납 상한)', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tax-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const json = new JsonPointStore(path.join(dir, 'points.json'), { initialGrant: 30000 }); await json.init();
  await storeBehaves(json);
  const database = await testDatabase(); t.after(() => database.stop());
  const pg = new PostgresPointStore(database.url, { initialGrant: 30000 }); t.after(() => pg.pool.end()); await pg.init(); await pg.init();
  await storeBehaves(pg);
});

test('주민세 서버: 전 계정 징수, 체납자 칭호·줄무늬 옷, 세금 창구 납부로 풀림', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tax-server-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const rich = await server.enter(await server.issue('부자')); const poor = await server.enter(await server.issue('빈털터리'));
  const sleeper = await server.issue('잠수'); // never comes in: still taxed (every account)
  const balance = async (who) => (await req('/api/points', who)).data.balance;
  const start = await balance(rich);
  assert.equal((await req('/api/test/tax', rich, { day: '2026-10-20' })).status, 200);
  assert.equal(await balance(rich), start - Math.max(20000, Math.floor(start * 0.03)));
  assert.equal((await req('/api/skins', rich)).data.delinquent, false, '낼 수 있으면 체납 아님');
  for (let d = 21; await balance(poor) > 0; d += 1) await req('/api/test/tax', rich, { day: `2026-10-${d}` }); // poor runs dry
  await req('/api/test/tax', rich, { day: '2026-10-30' }); // and owes a day
  const skins = (await req('/api/skins', poor)).data;
  assert.equal(skins.delinquent, true); assert.equal(skins.debt, 20000);
  assert.equal(skins.avatar.look.outfit, 'avatar_outfit_2'); assert.equal(skins.avatar.look.prisoner, true); assert.equal(skins.avatar.title, null);
  assert.ok(sleeper.id);
  // paying: at the 세금 창구 only
  const admin = (await req('/api/admin/login', null, { password: 'look-test' })).data.sessionToken;
  const poorKey = (await req('/api/admin/keys', admin)).data.keys.find((k) => k.label === '빈털터리');
  const granted = await req(`/api/admin/keys/${poorKey.id}/points`, admin, { amount: 50000, category: 'other', memo: '시험', requestId: require('node:crypto').randomUUID() });
  assert.equal(granted.status, 200, JSON.stringify(granted.data));
  assert.equal((await req('/api/island/tax', poor, { requestId: 'tax-pay-0001' })).data.error, 'TOO_FAR');
  const door = T.facilityDoor('townhall'); await req('/api/plaza/state', poor, { x: door.x, z: door.z, yaw: 0 });
  assert.equal((await req('/api/island/townhall/enter', poor, {})).status, 200);
  const desk = T.roomWorld(T.TOWNHALL_ROOM.tax.lx, T.TOWNHALL_ROOM.tax.lz); await req('/api/plaza/state', poor, { x: desk.x, z: desk.z, yaw: 0 });
  const owed = (await req('/api/island/tax', poor)).data; assert.equal(owed.debt, 20000);
  const paid = (await req('/api/island/tax', poor, { requestId: 'tax-pay-0002' })).data;
  assert.deepEqual([paid.paid, paid.debt], [20000, 0]);
  assert.equal((await req('/api/skins', poor)).data.delinquent, false, '다 내면 풀림');
});
