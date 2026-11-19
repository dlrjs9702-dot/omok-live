'use strict';
// 1.10.369 막혔을 때 빠져나오기 on 별마루섬 (총괄): the islanders' walk grid ends at ±200 m, so on 별마루섬 every point read as blocked and the
// move always went to 대청마당. There a point is free when off the island's own solids (isle2Clear, shared with the screen check); none
// free within 15 m: its bridge head.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain.js');
require('../public/plaza/island-train.js');
const U = require('../lib/island-unstuck');

test('별마루섬 막힘: 숲속에서 가까운 빈 자리를 찾고(나무 막힘에서 1.2 m), 본섬은 그대로 아님, 다리 머리는 별마루섬 쪽', () => {
  const n = T.nature(); const tree = n.forest.big.find((o) => T.isle2Zone(o.x, o.z) === 'deep');
  assert.ok(tree, '숲속 큰 나무'); assert.equal(T.onIsle2(tree.x, tree.z), true); assert.equal(T.isle2Clear(tree.x, tree.z), false, '줄기 위는 막힘');
  const spot = U.nearestFree({ x: tree.x, z: tree.z, ok: (x, z) => T.walkable(x, z) && T.isle2Clear(x, z) });
  assert.ok(spot, '15 m 안 빈 자리'); assert.ok(Math.hypot(spot.x - tree.x, spot.z - tree.z) <= 15);
  for (const o of T.natureSolids()) assert.ok(Math.hypot(o.x - spot.x, o.z - spot.z) >= o.r + 1.2 - 1e-9, '막힘에서 떨어진 자리');
  assert.equal(T.onIsle2(0, 0), false); assert.equal(T.isle2Clear(0, 0), false, '본섬은 이 도움 함수가 아님');
  const B = T.ISLE2_BRIDGE_HEAD; assert.equal(T.onIsle2(B.x, B.z), true);
  const head = U.nearestFree({ x: B.x, z: B.z, ok: (x, z) => T.walkable(x, z) && T.isle2Clear(x, z) }); assert.ok(head && Math.hypot(head.x - B.x, head.z - B.z) <= 15, '다리 머리 둘레 빈 자리');
});

test('막힘에서 나온 자리는 열린 곳(369 검토 #7): 별마루섬은 빈 칸으로 길까지 이어지고, 본섬은 주민 격자의 큰 덩어리', () => {
  const B = T.ISLE2_BRIDGE_HEAD; assert.equal(T.isle2Open(B.x, B.z), true, '다리 머리는 길로 이어짐');
  // a point walled in: inside 별지기 느티's trunk ring is no way out
  const A = T.ANCIENT; assert.equal(T.isle2Open(A.x, A.z), false, '줄기 안은 열린 곳이 아님');
  const tree = T.nature().forest.big.find((o) => T.isle2Zone(o.x, o.z) === 'deep');
  const spot = U.nearestFree({ x: tree.x, z: tree.z, ok: (x, z) => T.walkable(x, z) && T.isle2Open(x, z) }); assert.ok(spot, '숲속에서도 열린 자리');
  const N = require('../public/plaza/island-npcs.js'); const S = T.SPAWN; const sp = U.nearestFree({ x: S.x, z: S.z, ok: (x, z) => N.open(x, z) }); assert.ok(sp, '대청마당 둘레는 큰 덩어리');
});
