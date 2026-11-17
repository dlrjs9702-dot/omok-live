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

test('체납 불이익: 주식 주문·벼룩시장 올리기·택시 자유이용권은 막힘(한 번 타기는 됨), 반성문 5줄 → 하루 3줄씩 늘어 30줄까지, 다 내면 5줄', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'arrears-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('체납이'));
  await req('/api/test/points-credit', a, { amount: 100000 }); await req('/api/test/jail', a, { debt: 30000 }); /* (its first day: not jailed yet -- free to walk to a stop) */
  const rid = () => crypto.randomUUID();
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
  assert.equal(await jailed(), true); assert.equal(await essay(), 5, '처음 5줄');
  assert.equal(await jailed(), true); assert.equal(await essay(), 8, '체납이 이어지면 다음 날 8줄');
  await req('/api/test/jail', a, { taxEssays: 9 }); assert.equal(await jailed(), true); assert.equal((await req('/api/island/jail/start', a, {})).data.count, 30, '30줄까지');
  await req('/api/test/jail', a, { debt: 0 }); /* (paid off -- the 세금 창구's payment resets it the same way: server /api/island/tax) */
  await req('/api/test/jail', a, { debt: 30000 }); assert.equal(await jailed(), true); assert.equal((await req('/api/island/jail/start', a, {})).data.count, 5, '다 내면 다시 5줄');
});
