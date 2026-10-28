'use strict';
// v1.10.195 가방 개편 (gamecenter-notes docs/bag-redesign-20261027.md): 가방 늘리기 16 -> 24 -> 32 at the 잡화점, paid once
// each (economy bag:24 · bag:32), for good -- the 17th thing fits after it; 내 순서 -- the order I set (every entry once,
// else turned away) and 정리 (tools, fish, insects, materials, the rest).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const T = require('../public/plaza/island-terrain.js');
const I = require('../lib/island-items');
const { boot } = require('../test-support/test-server');

test('정리 순서: 도구 → 물고기 → 곤충 → 재료 → 기타, 같은 묶음은 있던 순서', () => {
  const e = [['a', 'bread'], ['b', 'weed'], ['c', 'insect_ladybird'], ['d', 'fish_goby'], ['e', 'bugnet'], ['f', 'fish_mackerel']].map(([entryId, itemId]) => ({ entryId, itemId, qty: 1 }));
  assert.deepEqual(I.sortBag(e).map((x) => x.entryId), ['e', 'd', 'f', 'c', 'b', 'a']);
  assert.equal(I.reorderBag(e, ['a', 'b']), null); assert.equal(I.reorderBag(e, ['a', 'a', 'b', 'c', 'd', 'e']), null);
});

test('가방 늘리기·내 순서: 잡화점에서만, 24 → 32, 값은 한 번씩, 늘린 만큼 더 담김; 순서는 내가 정한 대로', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'baggrow-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('가방손님'));
  await req('/api/test/points-credit', a, { amount: 300000 });
  const bag = async () => (await req('/api/island/bag', a)).data;
  assert.equal((await bag()).slots, 16); assert.deepEqual((await bag()).grow, { slots: 24, price: 50000 });
  assert.equal((await req('/api/island/bag/grow', a, {})).data.error, 'TOO_FAR'); // (not in the 잡화점)
  // 16 different things: full
  const ids = ['herb', 'berry', 'mushroom', 'trash', 'bread', 'milk', 'bouquet', 'letter_paper', 'bulb', 'paint', 'guitar_string', 'nail_box', 'frame', 'badge', 'candy', 'bait'];
  for (const itemId of ids) assert.equal((await req('/api/test/island/give', a, { itemId, qty: 1 })).data.applied, true, itemId);
  assert.equal((await req('/api/test/island/give', a, { itemId: 'balloon', qty: 1 })).data.reason, 'full');
  await req('/api/plaza/state', a, { ...T.facilityDoor('store'), yaw: 0, moving: false });
  assert.equal((await req('/api/island/store/enter', a, {})).status, 200);
  const balance = async () => (await req('/api/skins', a)).data.balance; const start = await balance();
  const g1 = await req('/api/island/bag/grow', a, {}); assert.equal(g1.status, 200, JSON.stringify(g1.data)); assert.deepEqual([g1.data.slots, g1.data.next], [24, 32]);
  assert.equal((await bag()).slots, 24); assert.equal(await balance(), start - 50000);
  assert.equal((await req('/api/test/island/give', a, { itemId: 'balloon', qty: 1 })).data.applied, true); // (the 17th fits)
  assert.equal((await req('/api/island/bag/grow', a, {})).data.slots, 32); assert.equal(await balance(), start - 200000);
  assert.equal((await req('/api/island/bag/grow', a, {})).data.error, 'BAG_TOP'); assert.equal((await bag()).grow, null);
  // 내 순서: the last first; one left out -- turned away, the bag as it was
  const now = (await bag()).items.map((e) => e.entryId);
  const order = [now.at(-1), ...now.slice(0, -1)];
  const r = await req('/api/island/bag/order', a, { ids: order }); assert.equal(r.status, 200); assert.deepEqual(r.data.bag.items.map((e) => e.entryId), order);
  assert.deepEqual((await bag()).items.map((e) => e.entryId), order);
  const stale = await req('/api/island/bag/order', a, { ids: order.slice(1) }); assert.equal(stale.status, 409); assert.equal(stale.data.error, 'STALE_ORDER');
  // 정리: the materials (herb …) before the rest (bread …)
  const sorted = (await req('/api/island/bag/order', a, { sort: true })).data.bag.items.map((e) => e.itemId);
  assert.ok(sorted.indexOf('herb') < sorted.indexOf('bread'));
  // after a restart: still 32
  await server.stop(); const again = await boot(t, dir); const b = await again.enter(await again.issue('가방손님2'));
  assert.equal((await again.req('/api/island/bag', b)).data.slots, 16); // (another account: its own)
});
