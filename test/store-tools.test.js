'use strict';
// 문제 기록 5회차 10-①: a tool at the 잡화점 is bought one at a time -- a bike once, not while one is in the bag; v1.10.221
// 도구 닳기: a rod or a net three of a kind (the sturdy ones too), counted inside the buy (two at once: one)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');
const T = require('../public/plaza/island-terrain');
const S = require('../public/plaza/island-store');
const I = require('../lib/island-items');

test('잡화점 도구: 하나씩, 낚싯대·잠자리채는 종류마다 3개까지(동시에 사도), 자전거는 한 대', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'store-tools-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const shopper = async (label) => {
    const a = await server.enter(await server.issue(label));
    const key = (await req('/api/admin/keys', server.admin)).data.keys.find((k) => k.label === label);
    await req(`/api/admin/keys/${key.id}/points`, server.admin, { amount: 100000, category: 'other', memo: '시험', requestId: require('node:crypto').randomUUID() });
    const door = T.facilityDoor('store'); await req('/api/plaza/state', a, { x: door.x, z: door.z, yaw: 0 });
    assert.equal((await req('/api/island/store/enter', a, {})).status, 200); return a;
  };
  const a = await shopper('도구손님');
  let n = 0; const buy = async (who, itemId, qty = 1) => { const w = S.standFor(itemId); await req('/api/plaza/state', who, { x: w.x, z: w.z, yaw: 0 }); n += 1; return req('/api/island/store/buy', who, { itemId, qty, requestId: `tool-${n}-00000000` }); };
  assert.equal((await buy(a, 'fishing_rod', 5)).data.error, 'BAD_QTY', '5개는 안 됨');
  for (const id of ['fishing_rod', 'fishing_rod_sturdy', 'fishing_rod']) { const r = await buy(a, id); assert.equal(r.status, 200, `${id} ${JSON.stringify(r.data)}`); }
  const fourth = await buy(a, 'fishing_rod_sturdy'); assert.deepEqual([fourth.status, fourth.data.error], [409, 'TOOL_MAX'], '네 번째는 거절');
  const rods = ((await req('/api/island/bag', a)).data.items || []).filter((e) => e.tool === 'fishing_rod');
  assert.deepEqual(rods.map((e) => [e.itemId, e.uses, e.usesMax]), [['fishing_rod', 30, 30], ['fishing_rod_sturdy', 80, 80], ['fishing_rod', 30, 30]], '하나씩 칸, 새것은 가득');
  assert.equal((await buy(a, 'bugnet')).status, 200, '잠자리채는 따로 셈');
  // two at once with two already: one goes in
  const b = await shopper('동시손님');
  for (const id of ['bugnet', 'bugnet_sturdy']) assert.equal((await buy(b, id)).status, 200);
  const w = S.standFor('bugnet'); await req('/api/plaza/state', b, { x: w.x, z: w.z, yaw: 0 });
  const both = await Promise.all([1, 2].map((k) => req('/api/island/store/buy', b, { itemId: 'bugnet', qty: 1, requestId: `twin-${k}-000000000` })));
  assert.deepEqual(both.map((r) => r.status).sort(), [200, 409], JSON.stringify(both.map((r) => r.data)));
  assert.equal(((await req('/api/island/bag', b)).data.items || []).filter((e) => e.tool === 'bugnet').length, 3);
  // a bike still once; the 소모품 five at a time
  assert.equal((await buy(a, 'bike_mint')).status, 200); assert.equal((await buy(a, 'bike_mint')).data.error, 'ALREADY_HAVE');
  assert.equal((await buy(a, 'bait', 5)).status, 200, '소모품은 그대로 5개');
});

test('도구 닳기: 가장 낡은 것부터 하나씩, 0이면 부러져 빠짐, 전에 산 것은 가득', () => {
  let bag = [{ entryId: 'a', itemId: 'bugnet', qty: 1, meta: null }, { entryId: 'b', itemId: 'bugnet_sturdy', qty: 1, meta: { uses: 2 } }, { entryId: 'c', itemId: 'weed', qty: 4, meta: null }];
  let w = I.wearTool(bag, 'bugnet'); assert.deepEqual([w.worn.itemId, w.worn.uses, w.worn.broke], ['bugnet_sturdy', 1, false], '가장 낡은 튼튼한 것');
  w = I.wearTool(w.entries, 'bugnet'); assert.deepEqual([w.worn.itemId, w.worn.uses, w.worn.broke, w.worn.name], ['bugnet_sturdy', 0, true, '튼튼한 잠자리채']);
  bag = w.entries; assert.deepEqual(bag.map((e) => e.itemId), ['bugnet', 'weed'], '부러진 것은 가방에서 빠짐');
  w = I.wearTool(bag, 'bugnet'); assert.equal(w.worn.uses, 29, '전에 산 것(meta 없음)은 30에서');
  assert.equal(I.wearTool(bag, 'fishing_rod'), null, '낚싯대 없음');
  assert.equal(I.bagView(w.entries).items[0].uses, 29);
});
