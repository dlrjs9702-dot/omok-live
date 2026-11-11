#!/usr/bin/env node
'use strict';
// v1.10.310 덩굴 (assets 112 vine_strands · vine_drape; notes graphics-island-wide 「G4b」, 사용자 11-08 「A~H 다 넣되」): where vines
// hang -- the tops of the island's steep faces (cliffs, the cuts round 관공서·백화점, banks), worked out once here (a scan of
// the drawn ground: 0.4 s, too long for a phone's start) and written to public/plaza/island-vines.js; test/island-vines.test.js
// works it out again and asks for the same list, so a change of the ground says to run this again:
//   node tools/vine-spots.js
// A spot: standable ground whose drop within 1.5 m is 2.2 m or more (a face of 56° or more -- a gentler bank's vine half lay on
// its grass in the first photos); strands (1.6 m long) or, by its place, three in ten a drape (0.76 m, 2.4 m wide) -- off 대청마당, the stairs, the bridges, 관공서's yard, the taxi's road (its band and 10 m round its
// stops: notes taxi-road-keepout) and 6 m round every door; 5 m apart, the deepest first, at most MAX. The vine hangs from
// the edge (0.6 m out over the drop), its top at the top's height, its face out over the drop. Nothing about it blocks.
const fs = require('node:fs');
const path = require('node:path');
const MAX = 160; const STEP = 2; const R = 200; const GAP = 5; const OUT = 0.6;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [Math.SQRT1_2, Math.SQRT1_2], [-Math.SQRT1_2, Math.SQRT1_2], [Math.SQRT1_2, -Math.SQRT1_2], [-Math.SQRT1_2, -Math.SQRT1_2]];
const H = { strands: 1.6, drape: 0.76 };
const lineDist = (x, z, pts) => { let best = Infinity; for (let i = 1; i < pts.length; i += 1) { const [ax, az] = pts[i - 1]; const [bx, bz] = pts[i]; const dx = bx - ax; const dz = bz - az; const l2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return best; };
function compute(T, X) {
  const h = (x, z) => (T.meshGroundHeight ? T.meshGroundHeight(x, z) : T.heightAt(x, z));
  const route = X.ROUTE; const stops = [route[0], route.at(-1)]; const doors = Object.values(T.SPOTS || {}).map((s) => s.face || [s.x, s.z]);
  const found = [];
  for (let x = -R; x <= R; x += STEP) for (let z = -R; z <= R; z += STEP) {
    if (Math.hypot(x, z) > R || !T.walkable(x, z) || (T.inPlaza && T.inPlaza(x, z, 2)) || T.onStairs?.(x, z) || T.onBridge?.(x, z) || T.inTownhall?.(x, z, 2) || T.walkDist(x, z) < 0.5) continue;
    if (lineDist(x, z, route) < 0.85 + 3.2 + 1.2 || stops.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 10 + 1.2) || doors.some(([dx, dz]) => Math.hypot(x - dx, z - dz) < 6)) continue;
    const top = h(x, z); let drop = 0; let dir = null;
    for (const d of DIRS) { const v = top - h(x + d[0] * 1.5, z + d[1] * 1.5); if (v > drop) { drop = v; dir = d; } }
    if (drop >= 2.2) found.push({ x, z, top, drop, dir });
  }
  found.sort((a, b) => b.drop - a.drop || a.x - b.x || a.z - b.z);
  const kept = [];
  for (const f of found) { if (kept.length >= MAX) break; if (kept.some((k) => Math.hypot(k.x - f.x, k.z - f.z) < GAP)) continue; kept.push(f); }
  const r2 = (v) => Math.round(v * 100) / 100;
  const hash = (x, z) => { const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return v - Math.floor(v); };
  return kept.map((f) => { const kind = hash(f.x, f.z) < 0.7 ? 'strands' : 'drape'; return [kind, r2(f.x + f.dir[0] * OUT), r2(f.top - H[kind] + 0.02), r2(f.z + f.dir[1] * OUT), r2(Math.atan2(f.dir[0], f.dir[1]))]; });
}
function source(list) {
  return `// v1.10.310 덩굴: where the island's vines hang -- made by tools/vine-spots.js (do not edit: run it again after the ground changes;
// test/island-vines.test.js checks). Each [kind, x, y (its origin: the bottom), z, yaw (its face out over the drop)]. Browser and node.
(function (root, list) {
  const api = Object.freeze({ SPOTS: Object.freeze(list) });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandVines = api;
}(typeof self !== 'undefined' ? self : this, ${JSON.stringify(list)}));
`;
}
module.exports = { compute, source };
if (require.main === module) {
  const T = require('../public/plaza/island-terrain.js'); const X = require('../public/plaza/island-taxi.js');
  const list = compute(T, X); fs.writeFileSync(path.join(__dirname, '..', 'public', 'plaza', 'island-vines.js'), source(list));
  console.log(`${list.length} vines (${list.filter((v) => v[0] === 'strands').length} strands)`);
}
