'use strict';
// 1.10.367 N1b 별마루섬 숲 다듬기 (gamecenter-notes docs/byeolmaru-forest-n1b-20261118.md §1·2·8, assets 156): the three layers'
// counts, 별지기 느티's clearing, nothing of the forest on a walk, and its solids in the one list the server and the screens use
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const T = require('../public/plaza/island-terrain.js');
require('../public/plaza/island-train.js');
const F = require('../public/plaza/forest156.js');

test('별마루섬 숲: 큰 나무 150·이끼 바위 60·통나무 24·고사리 420, 모두 별마루섬 위, 길 위에는 아무것도 없음', () => {
  const f = T.nature().forest;
  assert.equal(f.big.length, 150); assert.equal(f.mossy.length, 60); assert.equal(f.fallen.length, 24); assert.equal(f.ferns.length, 420);
  assert.deepEqual(new Set(f.big.map((o) => o.kind)), new Set(['tree_big_fir', 'tree_big_pine', 'tree_big_oak']));
  for (const o of [...f.big, ...f.mossy, ...f.fallen, ...f.ferns]) { assert.equal(o.isle2, true); assert.ok(T.dalmaru.newIsleCoast(o.x, o.z) > 4, `${o.kind} ${o.x},${o.z} 섬 안`); }
  for (const o of [...f.big, ...f.mossy, ...f.fallen]) for (const c of F.circlesAt(o.kind, o.x, o.z, o.yaw, o.s)) assert.ok(T.walkDist(c.x, c.z) > c.r + 1, `${o.kind} ${c.x.toFixed(1)},${c.z.toFixed(1)} 길에서 떨어짐`);
  for (const o of f.big) assert.ok(T.walkDist(o.x, o.z) > 5, `큰 나무 ${o.x.toFixed(1)},${o.z.toFixed(1)}: 숲길 가장자리는 트임`);
  const I = T.dalmaru.NEW_ISLE; for (const o of f.big) assert.ok(Math.hypot(o.x - I.camp.x, o.z - I.camp.z) > I.camp.r + 14 && Math.hypot(o.x - I.peak.x, o.z - I.peak.z) > 24, '캠핑장·봉우리 빈터');
  assert.deepEqual(T.nature(), T.nature(), '같은 섬은 같은 숲');
});

test('별지기 느티(§8): 다리 머리 근처, 18 m 안에는 다른 나무·덤불·바위·큰 나무 없음, 막힘은 156 solids.json 그대로 natureSolids에', () => {
  const n = T.nature(); const A = T.ANCIENT;
  assert.deepEqual({ x: n.forest.ancient.x, z: n.forest.ancient.z }, { x: A.x, z: A.z }); assert.equal(A.name, '별지기 느티');
  const within = (l) => l.filter((o) => Math.hypot(o.x - A.x, o.z - A.z) < 18).length;
  for (const k of ['trees', 'bushes', 'rocks', 'logs']) assert.equal(within(n[k]), 0, k);
  for (const k of ['big', 'mossy', 'fallen', 'ferns']) assert.equal(within(n.forest[k]), 0, k);
  const solids = T.natureSolids(); const mine = F.circlesAt('tree_ancient', A.x, A.z, A.yaw, 1);
  assert.equal(mine.length, 185); for (const c of mine) assert.ok(solids.some((s) => s.x === c.x && s.z === c.z && s.r === c.r));
  assert.ok(T.walkDist(A.x, A.z) > 18, '뿌리가 숲길에 닿지 않음'); for (const c of mine) assert.ok(T.walkDist(c.x, c.z) > c.r + 1, `뿌리 끝 ${c.x.toFixed(1)},${c.z.toFixed(1)} 길에서 1 m 넘게`); assert.equal(T.AREAS.ancient.label, '별지기 느티');
  const s = A.sign; assert.ok(T.walkable(s.x, s.z) && solids.every((o) => Math.hypot(o.x - s.x, o.z - s.z) > o.r + 1.5), '표지판 자리는 비어 있음');
  // the source of forest156.js: assets 156's solids.json (its trunk 3.55 m, 88 root boxes -- the arches among them overhead)
  assert.equal(F.ANCIENT_TRUNK_R, 3.55); assert.equal(F.ANCIENT_BOXES.length, 88); assert.ok(F.ANCIENT_BOXES.some((b) => b[7] === false), '아치(지나가는 뿌리)');
});

test('별마루섬 숲 파일: 등록부의 forest.* 모두 public에 있고 4계절, 큰 나무·느티는 Low도', () => {
  const R = require('../public/plaza/island-assets.js').REGISTRY;
  const ids = Object.keys(R).filter((id) => id.startsWith('forest.'));
  assert.equal(ids.length, 14);
  for (const id of ids) for (const url of [...Object.values(R[id].seasons), ...Object.values(R[id].low?.seasons || {})]) assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', url)), url);
  for (const id of ['forest.tree_big_fir', 'forest.tree_big_pine', 'forest.tree_big_oak', 'forest.tree_ancient']) assert.ok(R[id].low, `${id} Low`);
  assert.equal(R['forest.fern_wide'].hideFar, 25); assert.equal(R['forest.clump_mixed'].shadows, false);
});
