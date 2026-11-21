'use strict';
// 1.10.403 Codex 검토 391~400 (notes docs/codex-review-391-400.md): the fixes that can be checked without a server
const test = require('node:test'); const assert = require('node:assert/strict');
const F = require('../lib/island-festival.js'); const S = require('../lib/island-storehouse.js');

test('Codex 15 창고: 옛 창고(seq 없음)의 마지막 s1을 꺼내도 다음 넣기는 s1이 아님', () => {
  const old = [{ entryId: 's1', itemId: 'fish_carp', qty: 1, meta: { sizes: [40] } }];
  const t = S.take(old, [], 's1', 1, 24, 'fish_carp'); assert.equal(t.items.length, 0); assert.equal(t.seq, 1, '꺼낼 때도 번호를 남김');
  const bag = [{ entryId: 'b', itemId: 'fish_carp', qty: 1, meta: { sizes: [55] } }];
  const p = S.put(t.items, bag, 'b', 1, 10, t.seq); assert.equal(p.items[0].entryId, 's2');
  assert.equal(S.take(p.items, [], 's1', 1, 24, 'fish_carp').error, 'MISSING', '옛 화면의 s1로는 다른 개체가 안 나옴');
}); const Cal = require('../public/plaza/island-calendar');

test('Codex 8 요리 도장: 새날 저장이 먼저 와도 어제 횟수가 남아, 늦게 온 어제 요청은 다시 못 받음', () => {
  const fest = { id: 'x', start: '2026-11-20', end: '2026-11-26', tasks: { harvest: { perDay: 3, stamps: 1 }, cook: { perDay: 1, stamps: 2 } } };
  const open = Cal.taskOpen; Cal.taskOpen = () => true;
  try {
    const yday = Date.UTC(2026, 10, 20, 14, 50); const today = Date.UTC(2026, 10, 21, 3);
    const a = F.award(fest, {}, 'cook', yday, 2); assert.equal(a.added, 2); /* (yesterday's one cooking stamp) */
    const b = F.award(fest, a.doc, 'harvest', today); /* (today's saved first) */
    assert.equal(b.doc.days[Cal.dayOf(yday)].cook, 1, '어제 횟수 남음');
    assert.equal(F.award(fest, b.doc, 'cook', yday + 60000, 2).error, 'TASK_DONE', '늦게 온 어제 요리는 다시 못 받음');
    assert.equal(F.award(fest, b.doc, 'cook', today, 2).added, 2, '오늘 요리는 받음');
    /* (days outside the festival are not kept) */
    assert.deepEqual(Object.keys(F.award(fest, { days: { '2026-11-01': { cook: 1 } } }, 'harvest', today).doc.days), [Cal.dayOf(today)]);
  } finally { Cal.taskOpen = open; }
});
