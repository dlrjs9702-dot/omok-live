'use strict';
// 1.10.350 체납 불이익 강화 (notes tax-bill-design 끝, 사용자 2026-11-17): while owing -- no stock orders, no 벼룩시장 listing, no taxi
// 자유이용권 (the den: island-den-server); the tax essay 5 lines, 3 more for each passed while the debt goes on (30 at most), 5 again once
// all is paid
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { boot } = require('../test-support/test-server');
const T = require('../public/plaza/island-terrain');
const X = require('../public/plaza/island-taxi');
const J = require('../public/plaza/island-jail');
const Cast = require('../public/plaza/island-cast');

test('구치소장 호감도 (184A): 체납으로 갇힌 첫날 -1, 연속 날마다 하나씩 더, 하루 -5까지, 같은 날은 한 번', () => {
  const run = []; let last = null; let r = 0;
  for (const day of ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']) { const t = J.taxJailTake(last, r, day); run.push(t.take); last = day; r = t.run; }
  assert.deepEqual(run, [1, 2, 3, 4, 5, 5, 5]);
  assert.equal(J.taxJailTake('2026-11-07', 7, '2026-11-07').take, 0, '같은 날 두 번째는 없음');
  assert.deepEqual(J.taxJailTake('2026-11-05', 4, '2026-11-08'), { run: 1, take: 1 }, '하루 건너뛰면 처음부터');
});

test('체납 불이익: 주식 주문·벼룩시장 올리기·택시 자유이용권은 막힘(한 번 타기는 됨), 반성문 5줄 → 하루 3줄씩 늘어 30줄까지, 다 내면 5줄', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'arrears-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('체납이'));
  await req('/api/test/points-credit', a, { amount: 100000 }); await req('/api/test/jail', a, { debt: 30000 }); /* (its first day: not jailed yet -- free to walk to a stop) */
  const rid = () => crypto.randomUUID();
  const expect3 = async (fn, want, msg) => { let got; for (let k = 0; k < 20; k += 1) { got = await fn(); if (got === want) return; await new Promise((r) => { setTimeout(r, 100); }); } assert.equal(got, want, msg); };
  // the refusals
  const stocks = (await req('/api/island/stocks', a)).data; const code = (stocks.companies || []).find((c) => c.status !== 'gone')?.code;
  const order = await req('/api/island/stocks/order', a, { code, side: 'buy', qty: 1, requestId: rid() }); assert.equal(order.data.error, 'IN_ARREARS', JSON.stringify(order.data)); assert.match(order.data.message || order.data.error, /체납|IN_ARREARS/);
  assert.equal((await req('/api/island/flea/list', a, { entryId: 'x', price: 100, requestId: rid() })).data.error, 'IN_ARREARS');
  const stop = X.stopOf('plaza'); await req('/api/plaza/state', a, { x: stop.x, z: stop.z, yaw: 0 });
  const pass = await req('/api/island/taxi', a, { from: 'plaza', pay: 'pass' }); assert.equal(pass.data.error, 'IN_ARREARS', JSON.stringify(pass.data));
  // the essay: 5, then 8 (one passed in this debt), 30 at most; all paid -- 5 again
  const gate = T.facilityDoor('jail'); await req('/api/test/jail', a, { veteran: true });
  const jailed = async () => { await req('/api/plaza/leave', a, {}); await req('/api/test/jail', a, { passedDay: '2000-01-01' }); return (await req('/api/plaza/state', a, { x: gate.x, z: gate.z, yaw: 0 })).data.jail?.inmate; };
  const essay = async () => { let s = (await req('/api/island/jail/start', a, {})).data; const count = s.count; for (;;) { await new Promise((r) => { setTimeout(r, 900); }); /* (1.10.350: the chat's 6 in 5 s -- the longer essay paced as typed) */ const r = (await req('/api/lobby/chat', a, { text: s.sentence })).data.jail; if (r.passed) return count; s = r; } };
  // (184A) the warden: 3 points, then the first day taken in for tax -1; the same day again nothing more; never below 0
  const W = Cast.keeperN('warden'); const wardenPts = async () => (await req('/api/test/affinity', a, { n: W, delta: 1 })).data.points - 1;
  await req('/api/test/affinity', a, { n: W, delta: 2 });
  assert.equal(await jailed(), true); await expect3(wardenPts, 2);
  assert.equal(await jailed(), true); await new Promise((r) => { setTimeout(r, 300); }); await expect3(wardenPts, 3, '같은 날 다시 갇혀도 더 안 줄어듦 (조회가 +1씩 올린 만큼만)');
  assert.equal(await essay(), 5, '처음 5줄');
  assert.equal(await jailed(), true); assert.equal(await essay(), 8, '체납이 이어지면 다음 날 8줄 (184A: 친해도 줄지 않음)');
  await req('/api/test/jail', a, { taxEssays: 9 }); assert.equal(await jailed(), true); assert.equal((await req('/api/island/jail/start', a, {})).data.count, 30, '30줄까지');
  await req('/api/test/jail', a, { debt: 0 }); /* (paid off -- the 세금 창구's payment resets it the same way: server /api/island/tax) */
  await req('/api/test/jail', a, { debt: 30000 }); assert.equal(await jailed(), true); assert.equal((await req('/api/island/jail/start', a, {})).data.count, 5, '다 내면 다시 5줄');
});
