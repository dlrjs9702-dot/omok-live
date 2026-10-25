'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JsonPointStore, PostgresPointStore, taxSplit, taxIssue, taxDueOf, kstDate, TAX_DEBT_MAX } = require('../lib/point-store');
const { testDatabase } = require('../test-support/pg-database');
const { boot } = require('../test-support/test-server');
const T = require('../public/plaza/island-terrain');

// v1.10.86 주민세 (사용자 2026-10-17): each day 3% of wallet + deposit, at least 20,000P, from every account; up to 200,000P
// owed; owing makes a 체납자 (the title, the striped outfit) until it is paid at the 민원 창구.
// 고지서 (gamecenter-notes docs/tax-bill-design-20261025.md, 사용자 「고지서 + 창구 납부」): the day's tax is a bill -- nothing
// taken -- paid at the 세금 창구 by its due day (issued + 3), owed (체납) from the midnight after; 자동이체 (off unless turned
// on) takes it as before and bills the rest; bills and 체납 together within 200,000P.
test('주민세 계산: 3%·최소 2만, 고지서(자동이체 꺼짐: 안 뺌·켬: 지갑 → 예금, 나머지 고지서), 상한, 기한 3일', () => {
  assert.deepEqual(taxSplit(1000000, 0), { tax: 30000, fromWallet: 30000, fromDeposit: 0, owed: 0 });
  assert.deepEqual(taxSplit(5000, 10000), { tax: 20000, fromWallet: 5000, fromDeposit: 10000, owed: 5000 });
  assert.deepEqual(taxIssue(1000000, 0, 0, 0, false), { tax: 30000, fromWallet: 0, fromDeposit: 0, bill: 30000 });
  assert.deepEqual(taxIssue(5000, 10000, 0, 0, true), { tax: 20000, fromWallet: 5000, fromDeposit: 10000, bill: 5000 });
  assert.equal(taxIssue(0, 0, 190000, 5000, false).bill, 5000, '고지서 + 체납 20만까지');
  assert.equal(taxIssue(0, 0, 150000, 50000, false).bill, 0);
  assert.equal(taxDueOf('2026-10-30'), '2026-11-02'); assert.equal(TAX_DEBT_MAX, 200000);
});

async function storeBehaves(store) {
  const U = 'guest:00000000-0000-4000-8000-0000000000c1'; const at = (day) => Date.parse(`${day}T12:00:00+09:00`);
  await store.ensureAccount(U); // 30,000 to start (initialGrant)
  const first = await store.taxCollect(U, '2026-10-17');
  assert.deepEqual([first.applied, first.fromWallet, first.bill, first.debt], [true, 0, 20000, 0]);
  assert.deepEqual(first.bills, [{ day: '2026-10-17', amount: 20000, due: '2026-10-20' }]);
  assert.equal((await store.getAccount(U)).balance, 30000, '고지서만, 돈은 그대로');
  assert.equal((await store.taxCollect(U, '2026-10-17')).applied, false, '하루 한 장');
  await store.taxCollect(U, '2026-10-18'); // a second bill: 40,000 billed, 30,000 had
  assert.equal((await store.taxBillPay(U, 'u-pay-0001', at('2026-10-18'), { days: null })).reason, 'insufficient', '나눠 낼 수 없음');
  const one = await store.taxBillPay(U, 'u-pay-0002', at('2026-10-18'), { days: ['2026-10-17'] });
  assert.deepEqual([one.applied, one.paid, one.balance, one.bills.map((b) => b.day)], [true, 20000, 10000, ['2026-10-18']]);
  assert.equal((await store.taxBillPay(U, 'u-pay-0002', at('2026-10-18'), { days: ['2026-10-18'] })).applied, false, '같은 요청은 한 번');
  assert.equal((await store.taxBills(U)).bills.length, 1);
  // past its due day (10-21): owed from the next midnight on
  assert.equal((await store.taxCollect(U, '2026-10-21')).debt, 0, '기한 날까지는 체납 아님');
  const late = await store.taxCollect(U, '2026-10-22'); assert.deepEqual([late.overdue, late.debt], [20000, 20000]);
  assert.equal((await store.taxDebts())[U], 20000);
  for (let k = 1; k < 40; k += 1) await store.taxCollect(U, kstDate(at('2026-10-22') + k * 86400000));
  const capped = await store.taxBills(U); assert.equal(capped.debt, TAX_DEBT_MAX, '체납은 최대 20만'); assert.deepEqual(capped.bills, [], '상한이면 고지서 없음');
  const cell = await store.taxPay(U, 'pay-0001'); assert.deepEqual([cell.applied, cell.paid, cell.debt], [true, 10000, 190000], '구치소의 체납 납부는 그대로(있는 만큼)');
  const R = await store.bankMove(U, 0, 'x', Date.now()).catch((e) => e); assert.ok(R instanceof RangeError);
  // 자동이체: taken as before from the deposit, the rest billed; that bill paid from the deposit alone, the same request
  // again: nothing taken twice (Codex review)
  const V = 'guest:00000000-0000-4000-8000-0000000000c2'; const day = at('2026-11-01');
  await store.ensureAccount(V); await store.noteVisit(V, day); await store.bankMove(V, 30000, 'v-in-0001', day);
  assert.equal((await store.taxBills(V)).auto, false, '처음엔 꺼짐'); assert.equal((await store.taxAuto(V, true)).auto, true);
  const a1 = await store.taxCollect(V, '2026-11-01'); assert.deepEqual([a1.fromDeposit, a1.bill], [20000, 0]);
  const a2 = await store.taxCollect(V, '2026-11-02'); assert.deepEqual([a2.fromDeposit, a2.bill, a2.debt], [10400, 9600, 0], '부족분은 고지서(바로 체납 아님)');
  await store.claimAttendance(V, day); const w = (await store.getAccount(V)).balance; await store.bankMove(V, w, 'v-in-0002', day);
  const paid = await store.taxBillPay(V, 'v-pay-0001', at('2026-11-02')); assert.deepEqual([paid.applied, paid.paid, paid.bills], [true, 9600, []]);
  const before = await store.bankView(V, at('2026-11-02'));
  assert.equal((await store.taxBillPay(V, 'v-pay-0001', at('2026-11-02'))).applied, false);
  assert.deepEqual(await store.bankView(V, at('2026-11-02')), before);
  assert.equal((await store.taxAuto(V, false)).auto, false);
}

test('주민세 저장소: JSON·PostgreSQL 같은 동작(고지서 하루 한 장·납부 전부 또는 거절·기한 지나면 체납·상한·자동이체)', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tax-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const json = new JsonPointStore(path.join(dir, 'points.json'), { initialGrant: 30000 }); await json.init();
  await storeBehaves(json);
  const database = await testDatabase(); t.after(() => database.stop());
  const pg = new PostgresPointStore(database.url, { initialGrant: 30000 }); t.after(() => pg.pool.end()); await pg.init(); await pg.init();
  await storeBehaves(pg);
});

test('주민세 서버: 전 계정 고지서, 우체통 편지, 기한 지나면 체납자 칭호·줄무늬 옷, 세금 창구 「모두 내기」로 풀림, 예금 창구 자동이체', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tax-server-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const rich = await server.enter(await server.issue('부자')); const poor = await server.enter(await server.issue('빈털터리'));
  const sleeper = await server.issue('잠수'); // never comes in: still billed (every account)
  const balance = async (who) => (await req('/api/points', who)).data.balance;
  const start = await balance(rich);
  assert.equal((await req('/api/test/tax', rich, { day: '2026-10-20' })).status, 200);
  assert.equal(await balance(rich), start, '자동으로 빠지지 않음');
  const bill = (await req('/api/island/tax', rich)).data; assert.deepEqual(bill.bills, [{ day: '2026-10-20', amount: Math.max(20000, Math.floor(start * 0.03)), due: '2026-10-23' }]);
  assert.equal((await req('/api/skins', rich)).data.delinquent, false, '고지서는 체납 아님');
  const mail = (await req('/api/island/mail', rich)).data.letters.find((l) => l.id === 'tax-2026-10-20');
  assert.equal(mail.from, 'office'); assert.match(mail.text, /주민세 고지서 · 10월 20일분 · .*10월 23일까지/);
  assert.ok(sleeper.id);
  // past the due day: owed
  await req('/api/test/tax', rich, { day: '2026-10-24' });
  const skins = (await req('/api/skins', poor)).data;
  assert.equal(skins.delinquent, true); assert.equal(skins.debt, 20000);
  assert.equal(skins.avatar.look.outfit, 'avatar_outfit_2'); assert.equal(skins.avatar.look.prisoner, true); assert.equal(skins.avatar.title, null);
  // paying: at the 세금 창구 only, all of it (the 체납 and the new bill)
  const admin = (await req('/api/admin/login', null, { password: 'look-test' })).data.sessionToken;
  const poorKey = (await req('/api/admin/keys', admin)).data.keys.find((k) => k.label === '빈털터리');
  const granted = await req(`/api/admin/keys/${poorKey.id}/points`, admin, { amount: 50000, category: 'other', memo: '시험', requestId: require('node:crypto').randomUUID() });
  assert.equal(granted.status, 200, JSON.stringify(granted.data));
  assert.equal((await req('/api/island/tax', poor, { requestId: 'tax-pay-0001', all: true })).data.error, 'TOO_FAR');
  const door = T.facilityDoor('townhall'); await req('/api/plaza/state', poor, { x: door.x, z: door.z, yaw: 0 });
  assert.equal((await req('/api/island/townhall/enter', poor, {})).status, 200);
  const desk = T.roomWorld(T.TOWNHALL_ROOM.tax.lx, T.TOWNHALL_ROOM.tax.lz); await req('/api/plaza/state', poor, { x: desk.x, z: desk.z, yaw: 0 });
  const owed = (await req('/api/island/tax', poor)).data; assert.deepEqual([owed.debt, owed.bills.map((b) => b.day)], [20000, ['2026-10-24']]);
  const paid = (await req('/api/island/tax', poor, { requestId: 'tax-pay-0002', all: true })).data;
  assert.deepEqual([paid.paid, paid.debt, paid.bills], [40000, 0, []]);
  assert.equal((await req('/api/skins', poor)).data.delinquent, false, '다 내면 풀림');
  // 자동이체 at the 예금 창구 (off at first)
  const bank = T.roomWorld(T.TOWNHALL_ROOM.bank.lx, T.TOWNHALL_ROOM.bank.lz); await req('/api/plaza/state', poor, { x: bank.x, z: bank.z, yaw: 0 });
  assert.equal((await req('/api/island/bank', poor)).data.taxAuto, false);
  assert.equal((await req('/api/island/bank', poor, { taxAuto: true })).data.taxAuto, true);
  const before = await balance(poor); await req('/api/test/tax', rich, { day: '2026-10-25' });
  assert.equal(await balance(poor), before - 20000, '자동이체: 그날 빠짐');
});
