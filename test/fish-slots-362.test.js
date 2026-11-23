'use strict';
// 362 물고기 통 크기·가방 물고기 한 칸 (gamecenter-notes docs/fish-keepnet-20261109.md 끝, 사용자 「1A 2A 3A 4A」): the boxes 50 -> 100 -> 200
// at 30만·80만·200만P, one bought before stepped up free; in the bag a fish is one a slot with its size; the old stacks split once --
// into the bag, the fish box, what still has no room left stacked; no fish lost
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../lib/island-items');
const Economy = require('../lib/economy');

const fish = 'fish_goby'; const otherFish = 'fish_anchovy';
const count = (entries, id) => entries.filter((e) => e.itemId === id).reduce((n, e) => n + e.qty, 0);
const sizes = (entries, id) => entries.filter((e) => e.itemId === id).flatMap((e) => I.sizesOf(e)).sort((a, b) => b - a);

test('통 값·크기: 50·100·200칸, 30만·80만·200만P, 물고기 통과 곤충 채집통 같음', () => {
  assert.deepEqual(I.BOX_GROW, [50, 100, 200]);
  for (const k of ['keepnet', 'bugbox']) assert.deepEqual([50, 100, 200].map((n) => Economy.value(`${k}:${n}`)), [300000, 800000, 2000000]);
  for (const old of [30, 60, 90, 120]) for (const k of ['keepnet', 'bugbox']) assert.equal(Economy.value(`${k}:${old}`), null);
});

test('이미 산 통: 무료로 한 단계씩 -- 30 → 50, 60·90 → 100, 120 → 200, 안 산 사람 0', () => {
  const kept = { a: 30, b: 60, c: 90, d: 120, e: 50, f: 0 };
  I.setBoxHook((account) => kept[account]);
  try { assert.deepEqual(Object.keys(kept).map((a) => I.boxOf(a, 'fish')), [50, 100, 100, 200, 50, 0]); } finally { I.setBoxHook(null); }
});

test('가방 물고기 한 칸: 한 마리마다 자기 칸·크기, 칸이 모자라면 안 들어감; 곤충은 그대로 겹침', () => {
  let bag = I.addToBag([], fish, 3, 'c1', { sizes: [10, 12, 11] }, { bag: 4, fish: 0, insect: 0 });
  assert.equal(bag.length, 3); assert.ok(bag.every((e) => e.qty === 1 && I.sizesOf(e).length === 1)); assert.deepEqual(sizes(bag, fish), [12, 11, 10]);
  bag = I.addToBag(bag, fish, 1, 'c2', { size: 9 }, { bag: 4, fish: 0, insect: 0 }); assert.equal(bag.length, 4);
  assert.equal(I.addToBag(bag, fish, 1, 'c3', { size: 8 }, { bag: 4, fish: 0, insect: 0 }), null, '가방이 차면 안 들어감');
  assert.equal(new Set(bag.map((e) => e.entryId)).size, 4, '칸 번호 겹치지 않음');
  const insect = `insect_${Object.keys(require('../lib/island-insects').SPECIES)[0]}`;
  const ib = I.addToBag(I.addToBag([], insect, 2, 'i1', null, 16), insect, 3, 'i2', null, 16); assert.equal(ib.length, 1); assert.equal(ib[0].qty, 5);
  // the box first, then the bag one a slot
  const both = I.addToBag([], fish, 3, 'c4', { sizes: [20, 21, 22] }, { bag: 8, fish: 1, insect: 0 }); assert.equal(both.filter((e) => I.inBox(e) === 'fish').length, 1); assert.equal(both.filter((e) => !I.inBox(e)).length, 2);
});

test('옛 묶음 나누기: 가방에 자리 있으면 한 칸씩, 크기 그대로, 다시 해도 그대로', () => {
  const old = [{ entryId: fish, itemId: fish, qty: 3, meta: { sizes: [15, 13, 11] } }, { entryId: 'net', itemId: 'fishing_rod', qty: 1, meta: null }];
  const out = I.splitFish(old, { bag: 8, fish: 0, insect: 0 });
  assert.deepEqual([out.split, out.toBox, out.left], [3, 0, 0]); assert.equal(out.entries.filter((e) => e.itemId === fish).length, 3);
  assert.deepEqual(sizes(out.entries, fish), [15, 13, 11]); assert.equal(count(out.entries, 'fishing_rod'), 1);
  assert.equal(new Set(out.entries.map((e) => e.entryId)).size, out.entries.length);
  assert.equal(I.splitFish(out.entries, { bag: 8, fish: 0, insect: 0 }), null, '두 번째는 할 일 없음');
});

test('옛 묶음 나누기: 가방이 모자라면 물고기 통으로, 통도 차면 남는 것만 겹쳐 둠 -- 잃는 물고기 없음, 칸 수 넘지 않음', () => {
  const old = [{ entryId: 'a', itemId: fish, qty: 5, meta: { sizes: [30, 25, 20, 15, 10] } }, { entryId: 'b', itemId: otherFish, qty: 4, meta: { sizes: [9, 8, 7, 6], bought: true } }, { entryId: 'r', itemId: 'fishing_rod', qty: 1 }];
  // (1.10.430 인벤토리 2차: the fish room 4 -- the rod in its own; two stacks take 2, so 2 more: the first stack's two biggest out, its rest
  // and the second stack kept as stacks)
  const cap = { tool: 8, fish: 4, boxes: { fish: 0 } };
  const out = I.splitFish(old, cap);
  assert.equal(count(out.entries, fish) + count(out.entries, otherFish), 9, '모두 그대로');
  assert.deepEqual(sizes(out.entries, fish), [30, 25, 20, 15, 10]); assert.deepEqual(sizes(out.entries, otherFish), [9, 8, 7, 6]);
  assert.ok(I.usedIn(out.entries, 'fish') <= cap.fish, '물고기 칸 넘지 않음'); assert.equal(count(out.entries, 'fishing_rod'), 1);
  assert.ok(out.left > 0); assert.equal(out.split + out.left, 9);
  assert.ok(out.entries.filter((e) => e.itemId === otherFish).every((e) => e.meta.bought), '산 것 표시 그대로');
  assert.equal(new Set(out.entries.map((e) => e.entryId)).size, out.entries.length);
  assert.equal(I.splitFish(out.entries, cap), null, '자리가 없으면 다시 해도 그대로');
  // when room comes (the box grows): the rest goes on
  const more = I.splitFish(out.entries, { bag: 4, fish: 50, insect: 0 }); assert.equal(more.left, 0); assert.equal(count(more.entries, fish) + count(more.entries, otherFish), 9);
});

test('서버 옮기기(JSON 저장소): 겹친 물고기 가진 계정만 찾고, 한 번 나누면 다음엔 할 일 없음', async () => {
  const fs = require('node:fs/promises'); const os = require('node:os'); const path = require('node:path'); const { JsonPointStore } = require('../lib/point-store');
  const A = 'guest:00000000-0000-4000-8000-00000000000a'; const B = 'guest:00000000-0000-4000-8000-00000000000b'; const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fish362-')); const store = new JsonPointStore(path.join(dir, 'points.json'), { initialGrant: 1000 }); await store.init();
  store.data.island = { bags: { [A]: [{ entryId: fish, itemId: fish, qty: 3, meta: { sizes: [15, 13, 11] } }], [B]: [{ entryId: 'g1', itemId: fish, qty: 1, meta: { sizes: [9] } }] }, days: {} };
  assert.deepEqual(await store.fishStackOwners(), [A]);
  assert.deepEqual(await store.islandFishSplit(A), { split: 3, toBox: 0, left: 0 });
  assert.deepEqual(await store.fishStackOwners(), []); assert.equal(await store.islandFishSplit(A), null);
  assert.deepEqual((await store.islandBag(A)).items.map((e) => [e.qty, e.sizes]), [[1, [15]], [1, [13]], [1, [11]]]);
  await fs.rm(dir, { recursive: true, force: true });
});

test('나눈 뒤 팔기·주기: 작은 것부터 여러 칸에서, 남는 겹침과 섞여도', () => {
  const bag = [{ entryId: 'x1', itemId: fish, qty: 1, meta: { sizes: [30] } }, { entryId: 'x2', itemId: fish, qty: 1, meta: { sizes: [12] } }, { entryId: 'x3', itemId: fish, qty: 2, meta: { sizes: [20, 8] } }];
  const after = I.takeFromBag(bag, fish, 2); assert.deepEqual(sizes(after, fish), [30, 20]);
  const big = I.takeFromBag(bag, fish, 1, true); assert.deepEqual(sizes(big, fish), [20, 12, 8]);
});
