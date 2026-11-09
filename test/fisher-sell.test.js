'use strict';
// v1.10.291 물고기도 백화점 1층에서 (사용자 「물결 말고」, notes docs/fish-sell-mall-20261109.md): fish are sold at the 백화점's
// 노점 (mall:stall) with the 상인's things, at their own prices -- 물결 buys none any more (place 'fisher' refused), and
// far from the 노점, TOO_FAR. (v1.10.228 to 290: by 물결 where she was that day.)
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');
const T = require('../public/plaza/island-terrain');
const Store = require('../public/plaza/island-store');
const Quests = require('../lib/island-quests');
const Items = require('../lib/island-items');

test('물고기 팔기: 백화점 1층 노점에서 약재와 함께, 물결 곁에서는 못 팖, 노점에서 멀면 TOO_FAR', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fisher-sell-')); rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */
  const { req, issue, enter } = await boot(t, dir);
  const a = await enter(await issue('노점손님'));
  const stand = (p) => req('/api/plaza/state', a, { x: p.x, z: p.z, yaw: 0, moving: false });
  for (const [itemId, qty] of [['fish_goby', 2], ['herb', 1], ['wallet', 1]]) assert.equal((await req('/api/test/island/give', a, { itemId, qty })).status, 200);
  // 물결: no more
  await stand(Quests.STORIES.fisher.at); assert.equal((await req('/api/island/sell', a, { place: 'fisher', requestId: 'fisher-sell-a-0000' })).status, 400);
  // in the 백화점 but by the 잡화점, not the 노점: too far
  await stand(T.facilityDoor('store')); assert.equal((await req('/api/island/store/enter', a, {})).status, 200);
  await stand(Store.sectorPoint('mall:store')); assert.equal((await req('/api/island/sell', a, { place: 'merchant', requestId: 'fisher-sell-b-0000' })).data.error, 'TOO_FAR');
  // at the 노점: the fish and the herb, the wallet left (관공서's)
  await stand(Store.sectorPoint('mall:stall'));
  const before = (await req('/api/points', a)).data.balance;
  const sold = await req('/api/island/sell', a, { place: 'merchant', requestId: 'fisher-sell-c-0000' }); assert.equal(sold.status, 200, JSON.stringify(sold.data));
  const fish = sold.data.sold.find((s) => s.itemId === 'fish_goby'); const herb = sold.data.sold.find((s) => s.itemId === 'herb');
  assert.equal(fish?.qty, 2); assert.equal(herb?.qty, 1); assert.equal(sold.data.sold.length, 2);
  assert.equal(sold.data.paid, fish.qty * fish.price + herb.qty * herb.price); assert.equal(herb.price, Items.ITEMS.herb.price);
  assert.equal((await req('/api/points', a)).data.balance, before + sold.data.paid);
  assert.deepEqual(sold.data.bag.items.map((i) => i.itemId), ['wallet']);
});
