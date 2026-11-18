'use strict';
// 362 떨어진 나뭇가지 더 (사용자 「1A 2A」): a twig spot (twig_branch, twig_bundle) gives 1~3 a pick (2 on average) and is back in
// 1 h; still 60 spots. The house's repairs and the week's upkeep ask for twigs most
const test = require('node:test');
const assert = require('node:assert/strict');
const Gather = require('../lib/island-gather');
const E = require('../lib/island-events');

test('나뭇가지 줍기: 한 번에 1~3개(평균 2), 1시간 뒤 다시, 자리 60개 그대로', () => {
  for (const k of ['twig_branch', 'twig_bundle']) {
    assert.deepEqual(Gather.KINDS[k].pick, [1, 3]); assert.equal(Gather.KINDS[k].regrowMs, 3600000); assert.equal(E.REGEN_MS[k], 3600000);
    const def = E.TYPES[k]; assert.deepEqual([E.pickQty(def, 0), E.pickQty(def, 0.34), E.pickQty(def, 0.67), E.pickQty(def, 0.9999), E.pickQty(def, 1)], [1, 2, 3, 3, 3]);
    let sum = 0; const N = 3000; const seen = new Set(); for (let i = 0; i < N; i += 1) { const q = E.pickQty(def, (i + 0.5) / N); seen.add(q); sum += q; }
    assert.deepEqual([...seen].sort(), [1, 2, 3]); assert.ok(Math.abs(sum / N - 2) < 0.01, `평균 ${sum / N}`);
  }
  assert.equal(E.RESOURCE_COUNTS.twig_branch + E.RESOURCE_COUNTS.twig_bundle, 60, '자리 60개');
  assert.equal(E.pickQty(E.TYPES.stone_small, 0.9), 1, '작은 돌은 그대로 1개');
});
