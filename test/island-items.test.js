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
