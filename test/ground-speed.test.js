'use strict';
// 문제 기록 5회차 6 (사용자 「길 빠르게 + 숲·덤불만 느리게」): walks and 대청마당 +15%, the woods, bushes and beach -15%, grass
// as it was, and nothing off the island
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain');
const Paths = require('../public/plaza/island-paths');
const G = require('../public/plaza/ground-speed');

test('땅 속도: 길·대청마당 빠르게, 숲·덤불·모래사장 느리게, 풀밭 그대로, 섬 밖 1', () => {
  const f = (x, z) => G.factorAt(T, x, z, Paths);
  const P = T.dalmaru.PLAZA; assert.equal(f(P.x, (P.d0 + P.d1) / 2), G.FAST, '대청마당');
  const walk = Paths.paintedWalks(T).curves.find((w) => w.tier === 'town'); const [x, z] = walk.pts[Math.floor(walk.pts.length / 2)];
  assert.equal(f(x, z), G.FAST, '마을 길 한가운데');
  // the woods: half way between two trees 6 m or less apart
  const trees = T.nature().trees; let mid = null;
  for (const a of trees) { const b = trees.find((o) => o !== a && Math.hypot(a.x - o.x, a.z - o.z) <= 6); if (b && f((a.x + b.x) / 2, (a.z + b.z) / 2) !== G.FAST) { mid = [(a.x + b.x) / 2, (a.z + b.z) / 2]; break; } }
  assert.equal(f(...mid), G.SLOW, '숲');
  // the beach: land just off the sea, off any walk
  let beach = null; const half = T.GROUND.size / 2; // (on the grid's cell centres)
  for (let bx = -half + G.CELL / 2; bx < half && !beach; bx += G.CELL) for (let bz = -half + G.CELL / 2; bz < half && !beach; bz += G.CELL) { const cd = T.dalmaru.coastDist(bx, bz); if (cd > 1 && cd < 3 && !T.dalmaru.isWater(bx, bz) && f(bx, bz) !== G.FAST) beach = [bx, bz]; }
  assert.equal(f(...beach), G.SLOW, '모래사장');
  assert.ok([1, G.SLOW].includes(f(-60, 60)) || f(-60, 60) === G.FAST);
  assert.equal(f(5000, 5000), 1, '지도 밖'); assert.equal(G.factorAt({}, 0, 0, Paths), 1, '달마루섬이 아니면');
  // grass: somewhere open (no walk, no woods, no shore)
  let open = 0; for (let x0 = -150; x0 < 150; x0 += 7) for (let z0 = -150; z0 < 150; z0 += 7) if (T.dalmaru.coastDist(x0, z0) > 10 && f(x0, z0) === 1) open += 1;
  assert.ok(open > 50, `풀밭이 대부분 그대로 (${open})`);
});

test('땅 속도(검토): 땅 지도의 숲 바닥·모래가 칠해진 곳이 느린 곳 — 보이는 땅 = 느려지는 땅', () => {
  const { buildCoverMaps } = require('../tools/maps/ground-cover');
  const n = Math.ceil(T.GROUND.size / G.CELL); const x0 = -T.GROUND.size / 2; const a = buildCoverMaps(T, n).a;
  const cover = (x, z) => { const i = Math.floor((x - x0) / G.CELL); const j = Math.floor((z - x0) / G.CELL); if (i < 0 || j < 0 || i >= n || j >= n) return null; const k = (j * n + i) * 3; return { forest: a[k] / 255, sand: a[k + 2] / 255 }; };
  let forest = 0; let sand = 0; let wrong = 0;
  for (let j = 0; j < n; j += 1) for (let i = 0; i < n; i += 1) {
    const x = x0 + (i + 0.5) * G.CELL; const z = x0 + (j + 0.5) * G.CELL; const c = cover(x, z); const f = G.factorAt(T, x, z, Paths, cover);
    if (f === G.FAST) continue; // (a walk over all)
    if (c.forest > 0.5) { forest += 1; if (f !== G.SLOW) wrong += 1; }
    if (c.sand > 0.5) { sand += 1; if (f !== G.SLOW) wrong += 1; }
  }
  assert.ok(forest > 100 && sand > 100, `숲 ${forest}, 모래 ${sand}`); assert.equal(wrong, 0);
});
