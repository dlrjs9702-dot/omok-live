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
});
