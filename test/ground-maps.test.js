'use strict';
// 섬 땅 지도 그림 (gamecenter-notes docs/terrain-paint-design-20261025.md): the ground's maps in the repository are what the
// island's data and rules make now -- the walks or the ground's rules changed without building them again
// (node tools/maps/build-ground-maps.js) fails here; and every door, bridge end and stair foot stands on a painted walk
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('../public/plaza/island-terrain.js');

const ON = T.MAP === 'dalmaru';
test('땅 지도 그림: 들어 있는 PNG = 지금 섬 자료로 다시 만든 것(바이트까지)', { skip: !ON && '달마루섬 전용' }, () => {
  const { buildAll, OUT } = require('../tools/maps/build-ground-maps.js');
  for (const [name, bytes] of Object.entries(buildAll())) assert.ok(Buffer.compare(fs.readFileSync(path.join(OUT, name)), bytes) === 0, `${name}: run node tools/maps/build-ground-maps.js`);
});

test('땅에 칠하는 길: 길 그림은 칠할 수 있는 곳에만, 갈림길은 결 없는 판석 자리', { skip: !ON && '달마루섬 전용' }, () => {
  globalThis.IslandTerrain = T; const P = require('../public/plaza/island-paths.js');
  const { curves, paintable } = P.paintedWalks(T);
  assert.ok(curves.length > 30 && curves.every((c) => c.pts.slice(0, -1).every(([x, z]) => paintable(x, z)))); // (a hall's way ends on the paving's rim)
  const { a, b, box } = P.buildPathMaps(T, 1024); /* (the game's own resolution: a trail is 1.4 m wide) */ const cell = box.size / box.res;
  const at = (x, z) => { const i = Math.floor((x - box.x0) / cell); const j = Math.floor((z - box.z0) / cell); return { inside: a[(j * box.res + i) * 3], tier: b[(j * box.res + i) * 3], join: b[(j * box.res + i) * 3 + 1] }; };
  // every walk is painted along its middle (its own tier, or a wider walk's where the two run together)
  for (const c of curves) for (const [x, z] of c.pts.filter((_, k) => k % 7 === 3)) { const v = at(x, z); assert.ok(v.inside > 127 && v.tier > 0, `${c.tier} ${x.toFixed(1)},${z.toFixed(1)}`); }
  const joins = P.junctionsOf(curves); assert.ok(joins.length >= 8);
  for (const j of joins) assert.ok(at(j.x, j.z).join > 200);
  // (위에서 찍기 검사, as the picture itself: no walk painted ending in the air) from 대청마당's paving and its rim, over painted
  // ground -- bridges, stairs and paved yards count as walked on, as the island draws them -- every door, bridge end and stair
  // foot is reached
  const D = T.dalmaru; const PL = D.PLAZA; const res = box.res; const seen = new Uint8Array(res * res); const queue = [];
  const xy = (k) => [box.x0 + ((k % res) + 0.5) * cell, box.z0 + (Math.floor(k / res) + 0.5) * cell];
  const open = (k) => { const [x, z] = xy(k); return a[k * 3] > 110 || T.onBridge(x, z) || T.inTownhall(x, z, 0) || Math.max(Math.abs(x - PL.x) - PL.hw, PL.d0 - z, z - PL.d1) < 0.5; };
  for (let k = 0; k < res * res; k += 1) { const [x, z] = xy(k); if (Math.max(Math.abs(x - PL.x) - PL.hw, PL.d0 - z, z - PL.d1) < 0) { seen[k] = 1; queue.push(k); } }
  for (let q = 0; q < queue.length; q += 1) { const k = queue[q]; const i = k % res; for (const n of [k - 1, k + 1, k - res, k + res]) if (n >= 0 && n < res * res && Math.abs((n % res) - i) <= 1 && !seen[n] && open(n)) { seen[n] = 1; queue.push(n); } }
  const reached = (x, z, r = 2.5) => { for (let dz = -r; dz <= r; dz += cell) for (let dx = -r; dx <= r; dx += cell) { const i = Math.floor((x + dx - box.x0) / cell); const j = Math.floor((z + dz - box.z0) / cell); if (i >= 0 && j >= 0 && i < res && j < res && seen[j * res + i]) return true; } return false; };
  const B = typeof T.bridges === 'function' ? T.bridges() : T.bridges; const S = T.STAIRS;
  const places = [...Object.keys(T.SPOTS).map((id) => [`문:${id}`, T.facilityDoor(id)]).filter(([, d]) => d), ...B.flatMap((b, n) => [-1, 1].map((s) => [`다리${n + 1}`, { x: b.x + b.ux * b.half * s, z: b.z + b.uz * b.half * s }])), ['계단 발치', { x: S.x + S.nx * 1.7, z: S.z + S.nz * 1.7 }]];
  assert.deepEqual(places.filter(([, p]) => !reached(p.x, p.z)).map(([n, p]) => `${n}(${Math.round(p.x)},${Math.round(p.z)})`), []);
});
