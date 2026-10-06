'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../lib/island-items');

// v1.10.33 섬 제초 요청: for one Seoul day the town hall pays weeds three times (900P); before and after, 300P. The bag
// shows the price of the moment, the sale pays it, weeds stay outside the daily limit.
test('제초 요청: 2026-10-06 하루만 잡초 3배(900P), 전후는 300P, 가방 표시와 정산이 같은 값', () => {
  const at = (iso) => Date.parse(iso);
  assert.equal(I.priceOf('weed', at('2026-10-05T23:59:59+09:00')), 300);
  assert.equal(I.priceOf('weed', at('2026-10-06T00:00:00+09:00')), 900);
  assert.equal(I.priceOf('weed', at('2026-10-06T23:59:59+09:00')), 900);
  assert.equal(I.priceOf('weed', at('2026-10-07T00:00:00+09:00')), 300);
  assert.equal(I.priceOf('trash', at('2026-10-06T12:00:00+09:00')), 500); // only weeds
  const bag = [{ entryId: 'a', itemId: 'weed', qty: 10 }, { entryId: 'b', itemId: 'trash', qty: 2 }];
  const noon = at('2026-10-06T12:00:00+09:00');
  assert.equal(I.bagView(bag, noon).items.find((e) => e.itemId === 'weed').price, 900);
  const sale = I.sellAt(bag, 'office', I.DAILY_CAP, null, noon); // the day's limit already reached: weeds still sell
  assert.equal(sale.paid, 9000); assert.equal(sale.uncappedPaid, 9000);
  assert.equal(I.sellAt(bag, 'office', 0, null, at('2026-10-07T09:00:00+09:00')).paid, 3000 + 1000);
});
