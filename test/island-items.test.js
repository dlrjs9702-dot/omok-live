'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../lib/island-items');

// v1.10.33 섬 제초 요청: for one Seoul day the town hall pays weeds three times; before and after, the plain price. The
// bag shows the price of the moment and the sale pays it. v1.10.35 경제 기준(통합): weeds 200P, no daily limit at all.
test('제초 요청: 2026-10-06 하루만 잡초 3배, 전후는 기본값, 가방 표시와 정산이 같은 값', () => {
  const at = (iso) => Date.parse(iso);
  assert.equal(I.priceOf('weed', at('2026-10-05T23:59:59+09:00')), 310); // v1.10.89: 310P
  assert.equal(I.priceOf('weed', at('2026-10-06T00:00:00+09:00')), 930);
  assert.equal(I.priceOf('weed', at('2026-10-06T23:59:59+09:00')), 930);
  assert.equal(I.priceOf('weed', at('2026-10-07T00:00:00+09:00')), 310);
  assert.equal(I.priceOf('trash', at('2026-10-06T12:00:00+09:00')), 1000); // only weeds
  const bag = [{ entryId: 'a', itemId: 'weed', qty: 10 }, { entryId: 'b', itemId: 'trash', qty: 2 }];
  const noon = at('2026-10-06T12:00:00+09:00');
  assert.equal(I.bagView(bag, noon).items.find((e) => e.itemId === 'weed').price, 930);
  assert.equal(I.sellAt(bag, 'office', 0, null, noon).paid, 9300 + 2000);
  assert.equal(I.sellAt(bag, 'office', 0, null, at('2026-10-07T09:00:00+09:00')).paid, 3100 + 2000);
});

test('잡초 총량·집계(v1.10.90): 전날 뽑은 양으로 목표, 넘치면 시듦, 뽑기·납품 계정별 합계', () => {
  const W = require('../lib/island-weeds'); const { weedTotals } = require('../lib/point-store');
  assert.deepEqual([0, 279, 280, 699, 700, 1800].map(W.targetFor), [5160, 5160, 4300, 4300, 3440, 3440]); // (잡초 2배, 2026-10-21; 1104 E: 2,800 -> 4,300 as the land grew)
  const state = { removed: {}, added: [] }; const gone = W.wilt(9, 280, state);
  assert.equal(new Set(gone).size, 280); assert.deepEqual(W.wilt(9, 280, state), gone, '같은 날은 같은 선택');
  const at = (h) => `2026-10-17T0${h}:00:00.000Z`;
  const rows = weedTotals([{ kind: 'island_weed', userId: 'a', at: at(1) }, { kind: 'island_weed', userId: 'a', at: at(2) }, { kind: 'island_weed', userId: 'b', at: at(3) },
    { kind: 'island_sale', place: 'office', userId: 'b', at: at(4), sold: [{ itemId: 'weed', qty: 5 }, { itemId: 'trash', qty: 2 }] }, { kind: 'island_sale', place: 'merchant', userId: 'a', at: at(5), sold: [{ itemId: 'weed', qty: 9 }] },
    { kind: 'island_weed', userId: 'a', at: '2026-10-18T01:00:00.000Z' }], '2026-10-17T00:00:00.000Z', '2026-10-18T00:00:00.000Z');
  assert.deepEqual(rows.pulls.map((r) => [r.userId, r.total]).sort(), [['a', 2], ['b', 1]]);
  assert.deepEqual(rows.submits.map((r) => [r.userId, r.total]), [['b', 5]]);
});

test('경제 기준(통합): 아일랜드 정산에 하루 한도가 없다', () => {
  const bag = [{ entryId: 'h', itemId: 'herb', qty: 99 }, { entryId: 'm', itemId: 'mushroom', qty: 99 }];
  const sale = I.sellAt(bag, 'merchant', 10_000_000, null);
  assert.equal(sale.paid, 99 * 4000 + 99 * 1500);
  assert.deepEqual([sale.keep, sale.capped], [[], false]);
});

test('가방: 가득 찬 스택 뒤 빈 칸 사용·다중 스택 정산·부분 여유·실패 원상 보존', () => {
  const original = [{ entryId: 'berry', itemId: 'berry', qty: 99 },
    { entryId: 'berry:1', itemId: 'berry', qty: 98 }];
  const saved = structuredClone(original);
  const bag = I.addToBag(original, 'berry', 99, 'new');
  assert.deepEqual(bag.map(e => e.qty), [99, 99, 98]);
  assert.equal(new Set(bag.map(e => e.entryId)).size, 3);
  assert.deepEqual(original, saved);
  assert.equal(I.sellAt(bag, 'merchant', 0).paid, 296000);
  assert.deepEqual(I.sellAt(bag, 'merchant', 0).keep, []);
  assert.deepEqual(I.takeFromBag(bag, 'berry', 100).map(e => e.qty), [98, 98]);
  const full = Array.from({ length: 16 }, (_, i) => ({ entryId: `b${i}`, itemId: 'berry', qty: i ? 99 : 98 }));
  const snapshot = structuredClone(full);
  assert.equal(I.addToBag(full, 'berry', 2, 'fail'), null);
  assert.deepEqual(full, snapshot, 'failed partial fill cannot mutate the original');
  assert.equal(I.addToBag(full, 'berry', 1, 'last')[0].qty, 99);
  assert.equal(I.addToBag([{ entryId: 'weed', itemId: 'weed', qty: 999 }], 'weed', 1, 'w')[1].qty, 1);
  const wallets = I.addToBag([], 'wallet', 2, 'wallets', { eventId: 'owner' });
  assert.equal(wallets.length, 2);
  assert.deepEqual(wallets.map(e => e.qty), [1, 1]);
});

test('만료 분실물: 가방 수령 장소와 실제 관공서 정산 기준이 같고 활성 의뢰는 유지', () => {
  const bag = [{ entryId: 'active', itemId: 'lost', qty: 1, meta: { eventId: 'active-event' } },
    { entryId: 'expired', itemId: 'lost', qty: 1, meta: { eventId: 'expired-event' } }];
  assert.deepEqual(I.bagView(bag, Date.now(), ['active-event']).items.map(e => e.at), ['owner', 'office']);
  const sale = I.sellAt(bag, 'office', 0, ['active-event']);
  assert.equal(sale.paid, 10000);
  assert.deepEqual(sale.keep, [bag[0]]);
  assert.equal(I.bagView(sale.keep, Date.now(), ['active-event']).items[0].at, 'owner');
});

test('골라 팔기 (1.10.356): 고른 것만, 고른 개수만, 물고기는 작은 것부터, 안 사는 것·고르지 않은 것은 그대로', () => {
  const now = Date.parse('2026-11-18T12:00:00+09:00');
  const bag = [{ entryId: 'w', itemId: 'weed', qty: 10 }, { entryId: 't', itemId: 'trash', qty: 3 }, { entryId: 'b', itemId: 'bait', qty: 2 }];
  const all = I.sellAt(bag, 'office', 0, null, now); const one = I.sellPicked(bag, [{ entryId: 'w', qty: 4 }], 'office', 0, null, now);
  assert.equal(one.paid, 4 * I.priceOf('weed', now)); assert.deepEqual(one.sold, [{ itemId: 'weed', qty: 4, price: I.priceOf('weed', now) }]);
  assert.deepEqual(one.keep.map((e) => [e.entryId, e.qty]), [['w', 6], ['t', 3], ['b', 2]], '나머지는 제자리');
  assert.ok(all.paid > one.paid);
  const none = I.sellPicked(bag, [{ entryId: 'b', qty: 2 }], 'office', 0, null, now); assert.equal(none.paid, 0); assert.deepEqual(none.keep.map((e) => [e.entryId, e.qty]), [['w', 10], ['t', 3], ['b', 2]], '안 사는 것은 그대로');
  const over = I.sellPicked(bag, [{ entryId: 't', qty: 99 }, { entryId: 'zz', qty: 1 }], 'office', 0, null, now); assert.equal(over.sold.find((s) => s.itemId === 'trash').qty, 3, '가진 만큼만');
  // a fish's picked ones: its smallest sizes; the rest keep theirs
  const fish = [{ entryId: 'f', itemId: 'fish_crucian_carp', qty: 3, meta: { sizes: [30, 12, 20] } }];
  const f = I.sellPicked(fish, [{ entryId: 'f', qty: 2 }], ['merchant', 'fisher'], 0, null, now); assert.equal(f.sold.reduce((n, s) => n + s.qty, 0), 2);
  assert.deepEqual(f.keep.map((e) => [e.qty, e.meta.sizes]), [[1, [30]]], '큰 것이 남음');
  // the day's limit still stops it: what it stopped stays
  const capped = I.sellPicked([{ entryId: 't', itemId: 'trash', qty: 5 }], [{ entryId: 't', qty: 5 }], 'office', 0, null, now, 2500); assert.equal(capped.sold[0].qty, 2); assert.equal(capped.capped, true); assert.deepEqual(capped.keep.map((e) => e.qty), [3]);
});