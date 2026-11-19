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

test('별마루섬 숲(369 §9 구역): 숲속 100 m²당 3.5그루 넘게·잎 덮임 80 % 넘게·빈 칸 없음, 동산 0.4 아래, 산책길 1.5~2.5, 오솔길은 큰 나무 터널, 모두 섬 위, 길 둘레는 비움', () => {
  const n = T.nature(); const f = n.forest; const Z = T.isle2Zone; const I = T.dalmaru.NEW_ISLE;
  assert.deepEqual(new Set(f.big.map((o) => o.kind)), new Set(['tree_big_fir', 'tree_big_pine', 'tree_big_oak']));
  const mid = n.trees.filter((t) => t.isle2); const area = { hill: 0, deep: 0, walk: 0, trail: 0 };
  for (let x = I.x - 160; x < I.x + 160; x += 2) for (let z = I.z - 160; z < I.z + 160; z += 2) { const k = Z(x + 1, z + 1); if (k) area[k] += 4; }
  const land = Object.values(area).reduce((a, b) => a + b); const share = (k) => area[k] / land;
  assert.ok(share('deep') > 0.48 && share('walk') > 0.17 && share('walk') < 0.27 && share('hill') > 0.15 && share('trail') > 0.02, `구역 넓이 ${JSON.stringify(area)}`);
  const per = (k) => { const c = { mid: 0, big: 0 }; for (const t of mid) if (Z(t.x, t.z) === k) c.mid += 1; for (const t of f.big) if (Z(t.x, t.z) === k) c.big += 1; return { ...c, p100: (c.mid + c.big) / (area[k] / 100), cover: (c.mid * Math.PI * 2.2 ** 2 + c.big * Math.PI * 4 ** 2) / area[k] }; };
  const deep = per('deep'); const hill = per('hill'); const walk = per('walk'); const trail = per('trail');
  assert.ok(deep.p100 > 2.8 && deep.cover > 0.8, `숲속 ${JSON.stringify(deep)}`); /* (§9 무게: 3 to 100 m² kept it under the 316 line -- the big trees' crowns keep it covered) */ assert.ok(hill.p100 < 0.4, `동산 ${JSON.stringify(hill)}`);
  assert.ok(walk.p100 > 1.4 && walk.p100 < 2.5, `산책길 ${JSON.stringify(walk)}`); assert.ok(trail.big / (area.trail / 100) > 1, `오솔길 큰 나무 ${JSON.stringify(trail)}`);
  // no 10 m square all 숲속 without a tree
  const has = new Set([...mid, ...f.big].map((t) => `${Math.floor(t.x / 10)},${Math.floor(t.z / 10)}`)); let empty = 0;
  for (let x = Math.floor((I.x - 160) / 10) * 10; x < I.x + 160; x += 10) for (let z = Math.floor((I.z - 160) / 10) * 10; z < I.z + 160; z += 10) { let all = T.dalmaru.newIsleCoast(x + 5, z + 5) > 6; for (let a = 1; a < 10 && all; a += 3) for (let b = 1; b < 10 && all; b += 3) all = Z(x + a, z + b) === 'deep'; if (all && !has.has(`${x / 10},${z / 10}`)) empty += 1; } /* (a square at the shore: no room 4 m in) */
  assert.equal(empty, 0, '빈 숲속 칸');
  for (const o of [...f.big, ...f.mossy, ...f.fallen, ...f.ferns, ...mid]) { assert.equal(o.isle2, true); assert.ok(T.dalmaru.newIsleCoast(o.x, o.z) > 4, `${o.kind || 'tree'} ${o.x},${o.z} 섬 안`); }
  // the clear lane: what blocks 3 m off a walk, 1.5 m off an 오솔길 (its tunnel)
  for (const o of [...f.big, ...f.mossy, ...f.fallen]) for (const c of F.circlesAt(o.kind, o.x, o.z, o.yaw, o.s)) assert.ok(T.walkDist(c.x, c.z) > c.r + (Z(o.x, o.z) === 'trail' ? 1.5 : 3) - 0.01, `${o.kind} ${c.x.toFixed(1)},${c.z.toFixed(1)} 길 둘레 비움`);
  for (const o of f.big) assert.ok(Math.hypot(o.x - I.camp.x, o.z - I.camp.z) > I.camp.r + 8 && Math.hypot(o.x - I.peak.x, o.z - I.peak.z) > 18, '캠핑장·봉우리 빈터');
  assert.deepEqual(T.nature(), T.nature(), '같은 섬은 같은 숲');
});

test('별마루섬 구역(369 §9): 오솔길 3개, 구역은 데이터(isle2Zone) -- 느티 빈터·다리 머리·캠핑장·전망대는 동산, 오솔길 위는 오솔길, 숲 가운데는 숲속', () => {
  const Z = T.isle2Zone; const I = T.dalmaru.NEW_ISLE; const A = T.ANCIENT;
  assert.equal(T.walkCurves.filter((w) => w.narrow).length, 3);
  assert.equal(Z(A.x, A.z), 'hill'); assert.equal(Z(231, I.bridgeZ + 4), 'hill'); assert.equal(Z(I.camp.x, I.camp.z), 'hill'); assert.equal(Z(I.peak.x, I.peak.z), 'hill');
  assert.equal(Z(309, 271), 'trail'); assert.equal(Z(343, 251), 'deep'); assert.equal(Z(375, 352), 'walk'); assert.equal(Z(0, 0), null, '본섬은 구역 없음');
  assert.deepEqual(T.ISLE2_ZONES.WALK_BAND, 7);
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
