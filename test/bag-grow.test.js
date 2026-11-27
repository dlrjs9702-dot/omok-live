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
  const view = I.bagView(e, Date.now(), null, cap); assert.deepEqual(view.sections.fish, { used: 3, slots: 16 }); assert.deepEqual(view.boxes, { fish: 2, insect: 30 }); /* (430: each kind's room) */
  assert.deepEqual(view.items.map((x) => ('box' in x ? x.box : '-')), ['-', 'fish', 'fish', null, 'insect']); assert.equal(view.items[1].grade, 'common');
  assert.deepEqual(I.sellAt(e, ['merchant', 'fisher'], 0).keep.map((x) => x.itemId), ['bread']); // (모두 팔기: the boxes and the bag)
  assert.deepEqual(I.takeFromBag(e, 'fish_goby', 1, true).filter((x) => x.itemId === 'fish_goby').flatMap((x) => x.meta.sizes), [20, 25]); // (the museum: the biggest, from the bag here)
  const fishId = e[1].entryId; assert.equal(I.releaseFromBox(e, fishId).length, e.length - 1); assert.equal(I.releaseFromBox(e, 'b'), null); // (놓아주기: a box's only)
  /* (1.10.430 인벤토리 2차: the old boxes are their kinds' rooms -- every entry ordered together; 정리 by kind: fish, insects, then 기타) */
  const all = e.map((x) => x.entryId);
  assert.deepEqual(I.reorderBag(e, [...all].reverse()).map((x) => x.entryId), [...all].reverse());
  assert.equal(I.reorderBag(e, all.slice(1)), null); // (every entry once)
  assert.deepEqual(I.sortBag(e).map((x) => I.sectionOf(x.itemId)), ['fish', 'fish', 'fish', 'insect', 'etc']);
  assert.deepEqual(I.addToBag([], 'fish_goby', 2, 'x', { sizes: [20, 25] }, 16).map((x) => [x.qty, x.meta.sizes]), [[1, [20]], [1, [25]]]); // (no box: 362 one a slot in the bag too)
  // 가방에서 옮기기 (총괄 #447; 430: the kind's room is one now -- it only marks whole entries for the old box while it has room, in place)
  const before = [{ entryId: 'b', itemId: 'bread', qty: 1 }, { entryId: 'g', itemId: 'fish_goby', qty: 3, meta: { sizes: [30, 25, 20] } }, { entryId: 'l', itemId: 'insect_ladybird', qty: 4 }];
  const f = I.fillBox(before, 'fish', { bag: 16, fish: 2, insect: 0 }); assert.equal(f.moved, 3);
  assert.deepEqual(f.entries.map((x) => [x.itemId, x.qty, x.meta?.box || '-']), [['bread', 1, '-'], ['fish_goby', 3, 'fish'], ['insect_ladybird', 4, '-']]);
  assert.equal(I.fillBox(f.entries, 'fish', { bag: 16, fish: 2, insect: 0 }), null); // (nothing left to mark)
  assert.deepEqual(I.fillBox(before, 'insect', { bag: 16, fish: 0, insect: 30 }).entries.filter((x) => x.meta?.box).map((x) => x.qty), [4]); assert.equal(I.fillBox(before, 'insect', 16), null); // (none bought)
  const two = [{ entryId: 'insect_ladybird:1', itemId: 'insect_ladybird', qty: I.STACK_MAX }, { entryId: 'insect_ladybird', itemId: 'insect_ladybird', qty: 3 }];
  const g = I.fillBox(two, 'insect', { bag: 16, fish: 0, insect: 1 }); assert.equal(g.moved, I.STACK_MAX);
  const ids = g.entries.map((x) => x.entryId); assert.equal(new Set(ids).size, ids.length, ids.join());
  assert.deepEqual(g.entries.map((x) => [x.qty, x.meta?.box || '-']), [[I.STACK_MAX, 'insect'], [3, '-']]);
});

test('물고기 통 사기·놓아주기: 1층에서만, 50 → 100 → 200(362), 값은 한 번씩, 잡은 물고기는 통으로', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'keepnet-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('통손님')); await req('/api/test/points-credit', a, { amount: 4000000 });
  const bag = async () => (await req('/api/island/bag', a)).data;
  assert.deepEqual((await bag()).boxGrow, { fish: { slots: 50, price: 300000 }, insect: { slots: 50, price: 300000 }, gather: { slots: 50, price: 300000 }, material: { slots: 50, price: 300000 } }); assert.deepEqual((await bag()).boxes, { fish: 0, insect: 0 }); /* (430: 채집 바구니 · 재료 상자 too) */
  assert.equal((await req('/api/island/box/grow', a, { kind: 'fish' })).data.error, 'TOO_FAR');
  await req('/api/plaza/state', a, { ...T.facilityDoor('store'), yaw: 0, moving: false }); assert.equal((await req('/api/island/store/enter', a, {})).status, 200);
  assert.equal((await req('/api/island/box/grow', a, { kind: 'shoe' })).data.error, 'BAD_BOX');
  // Codex 291~300 #2: the size asked for -- sent again (no answer, two presses) it is ok at no charge; never the step after it
  const balance = async () => (await req('/api/skins', a)).data.balance;
  assert.equal((await req('/api/island/box/grow', a, { kind: 'fish', to: 50 })).data.slots, 50); const paid30 = await balance();
  const again = await req('/api/island/box/grow', a, { kind: 'fish', to: 50 }); assert.deepEqual([again.status, again.data.slots, again.data.already], [200, 50, true]); assert.equal(await balance(), paid30);
  assert.equal((await req('/api/island/box/grow', a, { kind: 'fish', to: 200 })).data.error, 'STALE_BOX'); assert.equal(await balance(), paid30);
  assert.equal((await req('/api/island/box/grow', a, { kind: 'fish', to: 100 })).data.slots, 100);
  for (const n of [200]) { const g = await req('/api/island/box/grow', a, { kind: 'fish' }); assert.equal(g.data.slots, n, JSON.stringify(g.data)); } /* (a page from before `to`: the next step) */
  assert.equal((await req('/api/island/box/grow', a, { kind: 'fish' })).data.error, 'BOX_TOP'); assert.equal((await bag()).boxGrow.fish, null);
  { /* (362 광석 값 사용자 1A: the 잡화점 sells the ores and the stone at three times what the merchant pays) */
    const list = (await req('/api/island/store/ores', a)).data.ores; assert.deepEqual(list.find((o) => o.id === 'ore_iron'), { id: 'ore_iron', name: '철광석', icon: '🟤', price: 1650 }); /* (379 결정 8 A: the merchant's 550 x3) */ assert.equal(list.find((o) => o.id === 'stone').price, 300);
    assert.ok(list.some((o) => o.id === 'ore_obsidian') && !list.some((o) => o.id.startsWith('gem_')), '366: 새 광석은 팔고 보석은 안 팖');
    assert.equal((await req('/api/island/store/ores', a, { itemId: 'gem_ruby', qty: 1, requestId: crypto.randomUUID() })).data.error, 'BAD_REQUEST', '보석은 못 삼');
    const before = await balance(); const r = await req('/api/island/store/ores', a, { itemId: 'ore_iron', qty: 5, requestId: crypto.randomUUID() }); assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(await balance(), before - 5 * 1650); /* (379) */ assert.equal(r.data.bag.items.filter((x) => x.itemId === 'ore_iron').reduce((n, x) => n + x.qty, 0), 5);
    /* (1.10.370 개수 칸: any count 1~99 -- 37 bought, 100 or 2.5 refused) */
    const r37 = await req('/api/island/store/ores', a, { itemId: 'stone', qty: 37, requestId: crypto.randomUUID() }); assert.equal(r37.status, 200, JSON.stringify(r37.data)); assert.equal(r37.data.qty, 37);
    for (const qty of [100, 2.5, 0]) assert.equal((await req('/api/island/store/ores', a, { itemId: 'stone', qty, requestId: crypto.randomUUID() })).data.error, 'BAD_QTY', String(qty));
    assert.equal((await req('/api/island/store/ores', a, { itemId: 'bread', qty: 1, requestId: crypto.randomUUID() })).data.error, 'BAD_REQUEST', '재료만');
    /* (사용자 「물고기 곤충은 제외, 집 만들기 … 재료들에만」: the `shop: true` materials -- the repair's and upkeep's, the ores; no fish, insect or 채집물) */
    const ids = list.map((o) => o.id); for (const id of ['stone', 'twig', 'branch', 'weed', 'compost', 'ore_granite', 'ore_gold']) assert.ok(ids.includes(id), id);
    assert.ok(ids.every((id) => !id.startsWith('fish_') && !id.startsWith('insect_') && !['herb', 'berry', 'mushroom'].includes(id)), ids.join()); assert.equal(list.find((o) => o.id === 'compost').price, 2790);
    assert.equal((await req('/api/island/store/ores', a, { itemId: 'fish_goby', qty: 1, requestId: crypto.randomUUID() })).data.error, 'BAD_REQUEST', '물고기 안 팖');
  }
  assert.equal((await req('/api/test/island/give', a, { itemId: 'fish_goby', qty: 1 })).data.applied, true);
  const fish = (await bag()).items.find((x) => x.itemId === 'fish_goby'); assert.equal(fish.box, 'fish');
  assert.equal((await req('/api/island/box/release', a, { entryId: 'nope' })).status, 409);
  const r = await req('/api/island/box/release', a, { entryId: fish.entryId }); assert.equal(r.status, 200); assert.equal(r.data.bag.items.some((x) => x.itemId === 'fish_goby'), false);
  assert.deepEqual((await bag()).boxes, { fish: 200, insect: 0 });
  assert.equal((await req('/api/island/box/fill', a, { kind: 'insect' })).status, 409); // (no 곤충 채집통)
});

test('옛 가방 늘리기 거절(433 Codex P1-4) · 내 순서: 잡화점에서 옛 24/32칸 결제는 막고, 통 구매로 늘림; 순서는 내가 정한 대로', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'baggrow-')); rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('가방손님'));
  await req('/api/test/points-credit', a, { amount: 400000 });
  const bag = async () => (await req('/api/island/bag', a)).data;
  /* (1.10.430 인벤토리 2차 · 1.10.433 P1-4: the 채집물 room 10 -- old bag/grow retired before charging; 채집 바구니 grows gather to 50) */
  assert.deepEqual((await bag()).sections.gather, { used: 0, slots: 10 }); assert.equal((await bag()).grow, null);
  assert.equal((await req('/api/island/bag/grow', a, {})).data.error, 'TOO_FAR'); // (not in the 잡화점)
  const ids = ['herb', 'berry', 'mushroom', 'mushroom_blue', 'branch', 'twig', 'clover_four', 'weed', 'harvest', 'stone'];
  for (const itemId of ids) assert.equal((await req('/api/test/island/give', a, { itemId, qty: 1 })).data.applied, true, itemId);
  assert.equal((await req('/api/test/island/give', a, { itemId: 'mushroom_glow', qty: 1 })).data.reason, 'full');
  assert.equal((await req('/api/test/island/give', a, { itemId: 'bread', qty: 1 })).data.applied, true, '기타는 제 칸');
  await req('/api/plaza/state', a, { ...T.facilityDoor('store'), yaw: 0, moving: false });
  assert.equal((await req('/api/island/store/enter', a, {})).status, 200);
  const balance = async () => (await req('/api/skins', a)).data.balance; const start = await balance();
  const retired = await req('/api/island/bag/grow', a, {}); assert.equal(retired.status, 409); assert.equal(retired.data.error, 'BAG_RETIRED'); assert.equal(await balance(), start, '결제 전 거절');
  const g1 = await req('/api/island/box/grow', a, { kind: 'gather', to: 50 }); assert.equal(g1.status, 200, JSON.stringify(g1.data)); assert.deepEqual([g1.data.slots, g1.data.next], [50, 100]);
  assert.equal((await bag()).sections.gather.slots, 50); assert.deepEqual((await bag()).boxGrow.gather, { slots: 100, price: 800000 }); assert.equal(await balance(), start - 300000);
  assert.equal((await req('/api/test/island/give', a, { itemId: 'mushroom_glow', qty: 1 })).data.applied, true); // (the 11th fits: the basket)
  // 내 순서: the last first; one left out -- turned away, the bag as it was
  const now = (await bag()).items.map((e) => e.entryId);
  const order = [now.at(-1), ...now.slice(0, -1)];
  const r = await req('/api/island/bag/order', a, { ids: order }); assert.equal(r.status, 200); assert.deepEqual(r.data.bag.items.map((e) => e.entryId), order);
  assert.deepEqual((await bag()).items.map((e) => e.entryId), order);
  const stale = await req('/api/island/bag/order', a, { ids: order.slice(1) }); assert.equal(stale.status, 409); assert.equal(stale.data.error, 'STALE_ORDER');
  // 정리: the materials (herb …) before the rest (bread …)
  const sorted = (await req('/api/island/bag/order', a, { sort: true })).data.bag.items.map((e) => e.itemId);
  assert.ok(sorted.indexOf('herb') < sorted.indexOf('bread'));
  // after a restart: still 50 for a, 10 for another account
  await server.stop(); const again = await boot(t, dir); const b = await again.enter(await again.issue('가방손님2'));
  assert.equal((await again.req('/api/island/bag', b)).data.sections.gather.slots, 10); // (another account: its own)
});
