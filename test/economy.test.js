const test = require('node:test');
const assert = require('node:assert/strict');
const Economy = require('../lib/economy');
const Items = require('../lib/island-items');

// v1.10.91 경제 값 관리 (IDEAS #future-admin-console ②, 사용자 2026-10-18)
test('경제 값: 범위 안만, 변경 이력(이전·이후), 기본값으로, 판매가에 바로 반영', () => {
  assert.ok(Economy.DEFS.some((d) => d.key === 'item:weed' && d.def === 310));
  assert.equal(Economy.DEFS.filter((d) => d.group === '물고기 판매가').length, 21);
  assert.deepEqual(Economy.change(null, { 'item:weed': 0 }, '관리자', 1), { error: 'RANGE', key: 'item:weed' });
  assert.deepEqual(Economy.change(null, { 'item:weed': 3101 }, '관리자', 1), { error: 'RANGE', key: 'item:weed' });
  assert.equal(Economy.change(null, { 'nope': 1 }, '관리자', 1).error, 'UNKNOWN');
  assert.equal(Economy.change(null, {}, '관리자', 1).error, 'EMPTY');
  let saved = Economy.change(null, { 'item:weed': 400, 'errand:find': 2500 }, '관리자', 1000).saved;
  assert.deepEqual(saved.values, { 'item:weed': 400, 'errand:find': 2500 });
  assert.deepEqual(saved.history.map((h) => [h.key, h.before, h.after]), [['errand:find', 2000, 2500], ['item:weed', 310, 400]]);
  Items.setPriceHook(Economy.priceOf); Economy.load(saved);
  try {
    assert.equal(Items.priceOf('weed', Date.parse('2026-12-01T00:00:00+09:00')), 400);
    assert.equal(Items.priceOf('herb'), Items.ITEMS.herb.price); // untouched: its own price
    assert.equal(Economy.value('errand:find'), 2500); assert.equal(Economy.value('errand:deliver'), 1500);
    assert.equal(Items.sellAt([{ entryId: 'a', itemId: 'weed', qty: 3 }], 'office', 0, null, Date.parse('2026-12-01T00:00:00+09:00')).paid, 1200);
    saved = Economy.change(saved, { 'item:weed': null }, '관리자', 2000).saved; Economy.load(saved); // back to the default
    assert.equal(Items.priceOf('weed', Date.parse('2026-12-01T00:00:00+09:00')), 310);
    assert.deepEqual(saved.history[0], { at: 2000, by: '관리자', key: 'item:weed', label: '생활 자원 판매가 · 잡초', before: 400, after: 310 });
    assert.equal(Economy.view(saved).defs.find((d) => d.key === 'errand:find').changed, true);
    Economy.load({ values: { 'item:weed': -5, 'item:herb': 'x' } }); assert.equal(Economy.value('item:weed'), 310); // a bad saved value is ignored
  } finally { Economy.load(null); Items.setPriceHook(null); }
});
