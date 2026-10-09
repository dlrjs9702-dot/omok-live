'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../lib/island-items');

// v1.10.33 섬 제초 요청: for one Seoul day the town hall pays weeds three times; before and after, the plain price. The
// bag shows the price of the moment and the sale pays it. v1.10.35 경제 기준(통합): weeds 200P, no daily limit at all.
test('제초 요청: 2026-10-06 하루만 잡초 3배, 전후는 기본값, 가방 표시와 정산이 같은 값', () => {
  const at = (iso) => Date.parse(iso);
  assert.equal(I.priceOf('weed', at('2026-10-05T23:59:59+09:00')), 200);
  assert.equal(I.priceOf('weed', at('2026-10-06T00:00:00+09:00')), 600);
  assert.equal(I.priceOf('weed', at('2026-10-06T23:59:59+09:00')), 600);
  assert.equal(I.priceOf('weed', at('2026-10-07T00:00:00+09:00')), 200);
  assert.equal(I.priceOf('trash', at('2026-10-06T12:00:00+09:00')), 1000); // only weeds
  const bag = [{ entryId: 'a', itemId: 'weed', qty: 10 }, { entryId: 'b', itemId: 'trash', qty: 2 }];
  const noon = at('2026-10-06T12:00:00+09:00');
  assert.equal(I.bagView(bag, noon).items.find((e) => e.itemId === 'weed').price, 600);
  assert.equal(I.sellAt(bag, 'office', 0, null, noon).paid, 6000 + 2000);
  assert.equal(I.sellAt(bag, 'office', 0, null, at('2026-10-07T09:00:00+09:00')).paid, 2000 + 2000);
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
