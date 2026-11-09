'use strict';
// v1.10.195 가방 개편 (gamecenter-notes docs/bag-redesign-20261027.md): 가방 늘리기 16 -> 24 -> 32 at the 잡화점, paid once
// each (economy bag:24 · bag:32), for good -- the 17th thing fits after it; 내 순서 -- the order I set (every entry once,
// else turned away) and 정리 (tools, fish, insects, materials, the rest).
const rmAtExit = require('../test-support/rm-at-exit');
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

// v1.10.297 물고기 통·곤충 채집통 (notes docs/fish-keepnet-20261109.md): a catch in its box first (a fish one a slot with its
// size, insects stacked), the bag once full; selling, the museum's biggest and 놓아주기 take from the box; the bag's own order
test('물고기 통·곤충 채집통: 통 먼저, 가득 차면 가방, 팔기·박물관·놓아주기, 순서·정리는 가방만', () => {
  const cap = { bag: 16, fish: 2, insect: 30 };
  let e = I.addToBag([{ entryId: 'b', itemId: 'bread', qty: 1 }], 'fish_goby', 1, 'c1', { size: 20 }, cap);
  e = I.addToBag(e, 'fish_goby', 1, 'c2', { size: 25 }, cap);
  assert.deepEqual(e.slice(1).map((x) => [x.qty, x.meta.box, x.meta.sizes]), [[1, 'fish', [20]], [1, 'fish', [25]]]); // (one a slot, never stacked)
  e = I.addToBag(e, 'fish_goby', 1, 'c3', { size: 30 }, cap); assert.deepEqual([e[3].meta.box, e[3].meta.sizes], [undefined, [30]]); // (the box full: the bag)
  e = I.addToBag(e, 'insect_ladybird', 3, 'c4', null, cap); e = I.addToBag(e, 'insect_ladybird', 2, 'c5', null, cap);
  assert.deepEqual(e.filter((x) => x.meta?.box === 'insect').map((x) => x.qty), [5]); // (stacked by kind)
  const view = I.bagView(e, Date.now(), null, cap); assert.equal(view.slots, 16); assert.deepEqual(view.boxes, { fish: 2, insect: 30 });
  assert.deepEqual(view.items.map((x) => ('box' in x ? x.box : '-')), ['-', 'fish', 'fish', null, 'insect']); assert.equal(view.items[1].grade, 'common');
  assert.deepEqual(I.sellAt(e, ['merchant', 'fisher'], 0).keep.map((x) => x.itemId), ['bread']); // (모두 팔기: the boxes and the bag)
  assert.deepEqual(I.takeFromBag(e, 'fish_goby', 1, true).filter((x) => x.itemId === 'fish_goby').flatMap((x) => x.meta.sizes), [20, 25]); // (the museum: the biggest, from the bag here)
  const fishId = e[1].entryId; assert.equal(I.releaseFromBox(e, fishId).length, e.length - 1); assert.equal(I.releaseFromBox(e, 'b'), null); // (놓아주기: a box's only)
  const bagIds = e.filter((x) => !x.meta?.box).map((x) => x.entryId);
  assert.deepEqual(I.reorderBag(e, [...bagIds].reverse()).map((x) => x.entryId), [...[...bagIds].reverse(), ...e.filter((x) => x.meta?.box).map((x) => x.entryId)]);
  assert.equal(I.reorderBag(e, e.map((x) => x.entryId)), null); // (the boxes' entries are not the bag's to order)
  assert.deepEqual(I.sortBag(e).slice(-3).map((x) => x.meta?.box), ['fish', 'fish', 'insect']);
  assert.deepEqual(I.addToBag([], 'fish_goby', 2, 'x', { sizes: [20, 25] }, 16).map((x) => x.qty), [2]); // (no box: as before)
  // 가방에서 옮기기 (총괄 #447): what the bag held before -- into the box as far as it has room, the biggest first
  const before = [{ entryId: 'b', itemId: 'bread', qty: 1 }, { entryId: 'g', itemId: 'fish_goby', qty: 3, meta: { sizes: [30, 25, 20] } }, { entryId: 'l', itemId: 'insect_ladybird', qty: 4 }];
  const f = I.fillBox(before, 'fish', { bag: 16, fish: 2, insect: 0 }); assert.equal(f.moved, 2);
  assert.deepEqual(f.entries.map((x) => [x.itemId, x.qty, x.meta?.box || '-', x.meta?.sizes || null]), [['bread', 1, '-', null], ['fish_goby', 1, '-', [20]], ['insect_ladybird', 4, '-', null], ['fish_goby', 1, 'fish', [30]], ['fish_goby', 1, 'fish', [25]]]);
  assert.equal(I.fillBox(f.entries, 'fish', { bag: 16, fish: 2, insect: 0 }), null); // (full: nothing moved)
  assert.deepEqual(I.fillBox(before, 'insect', { bag: 16, fish: 0, insect: 30 }).entries.filter((x) => x.meta?.box).map((x) => x.qty), [4]); assert.equal(I.fillBox(before, 'insect', 16), null); // (none bought)
});

test('물고기 통 사기·놓아주기: 1층에서만, 30 → 60 → 90 → 120, 값은 한 번씩, 잡은 물고기는 통으로', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'keepnet-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('통손님')); await req('/api/test/points-credit', a, { amount: 4000000 });
  const bag = async () => (await req('/api/island/bag', a)).data;
  assert.deepEqual((await bag()).boxGrow, { fish: { slots: 30, price: 200000 }, insect: { slots: 30, price: 200000 } }); assert.deepEqual((await bag()).boxes, { fish: 0, insect: 0 });
  assert.equal((await req('/api/island/box/grow', a, { kind: 'fish' })).data.error, 'TOO_FAR');
  await req('/api/plaza/state', a, { ...T.facilityDoor('store'), yaw: 0, moving: false }); assert.equal((await req('/api/island/store/enter', a, {})).status, 200);
  assert.equal((await req('/api/island/box/grow', a, { kind: 'shoe' })).data.error, 'BAD_BOX');
  for (const n of [30, 60, 90, 120]) { const g = await req('/api/island/box/grow', a, { kind: 'fish' }); assert.equal(g.data.slots, n, JSON.stringify(g.data)); }
  assert.equal((await req('/api/island/box/grow', a, { kind: 'fish' })).data.error, 'BOX_TOP'); assert.equal((await bag()).boxGrow.fish, null);
  assert.equal((await req('/api/test/island/give', a, { itemId: 'fish_goby', qty: 1 })).data.applied, true);
  const fish = (await bag()).items.find((x) => x.itemId === 'fish_goby'); assert.equal(fish.box, 'fish');
  assert.equal((await req('/api/island/box/release', a, { entryId: 'nope' })).status, 409);
  const r = await req('/api/island/box/release', a, { entryId: fish.entryId }); assert.equal(r.status, 200); assert.equal(r.data.bag.items.some((x) => x.itemId === 'fish_goby'), false);
  assert.deepEqual((await bag()).boxes, { fish: 120, insect: 0 });
  assert.equal((await req('/api/island/box/fill', a, { kind: 'insect' })).status, 409); // (no 곤충 채집통)
});

test('가방 늘리기·내 순서: 잡화점에서만, 24 → 32, 값은 한 번씩, 늘린 만큼 더 담김; 순서는 내가 정한 대로', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'baggrow-')); rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */
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
