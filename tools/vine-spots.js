#!/usr/bin/env node
'use strict';
// v1.10.310 덩굴 (assets 112 vine_strands · vine_drape; notes graphics-island-wide 「G4b」, 사용자 11-08 「A~H 다 넣되」): where vines
// hang -- down the island's steep faces (the cliffs, the cuts round 관공서·백화점), worked out once here (a scan of the drawn
// ground: under a second, too long for a phone's start) and written to public/plaza/island-vines.js; test/island-vines.test.js
// works it out again and asks for the same list, so a change of the ground says to run this again:
//   node tools/vine-spots.js
// (총괄 #460: hung down the face, not stood on its top -- 2.2 times the model, a few side by side on a face, more of them)
// A face: from standable ground the drawn ground falls 2.2 m or more within 1.5 m (56° or steeper) -- off 대청마당, the stairs,
// the bridges, 관공서's yard, the taxi's road (its band and 10 m round its stops: notes taxi-road-keepout) and 6 m round every
// door; faces 6 m apart, the deepest first, at most FACES. On each, strands side by side along its edge (by its place, three in
// ten a single drape instead); each vine's top where the face begins, its length laid along the face (the straight line from
// there down to where the ground is that far, tilted back as the face is), 12 cm off it -- one that would cut into the rock
// or stand more than 45 cm off the face anywhere along it is left out. Nothing about it blocks.
const fs = require('node:fs');
const path = require('node:path');
const FACES = 160; const STEP = 2; const R = 200; const GAP = 6; const S = 2.2; const OFF = 0.12;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [Math.SQRT1_2, Math.SQRT1_2], [-Math.SQRT1_2, Math.SQRT1_2], [Math.SQRT1_2, -Math.SQRT1_2], [-Math.SQRT1_2, -Math.SQRT1_2]];
const H = { strands: 1.6, drape: 0.76 }; // (the models' own lengths, assets 112 README)
const ALONG = { strands: [-1.65, -0.55, 0.55, 1.65], drape: [0] }; // (strands 0.26 m wide x2.2: a little apart)
const lineDist = (x, z, pts) => { let best = Infinity; for (let i = 1; i < pts.length; i += 1) { const [ax, az] = pts[i - 1]; const [bx, bz] = pts[i]; const dx = bx - ax; const dz = bz - az; const l2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return best; };
function compute(T, X) {
  const h = (x, z) => (T.meshGroundHeight ? T.meshGroundHeight(x, z) : T.heightAt(x, z));
  const route = X.ROUTE; const stops = [route[0], route.at(-1)]; const doors = Object.values(T.SPOTS || {}).map((s) => s.face || [s.x, s.z]);
  const clear = (x, z) => T.walkable(x, z) && !(T.inPlaza && T.inPlaza(x, z, 2)) && !T.onStairs?.(x, z) && !T.onBridge?.(x, z) && !T.inTownhall?.(x, z, 2) && T.walkDist(x, z) >= 0.5
    && lineDist(x, z, route) >= 0.85 + 3.2 + 1.2 && stops.every(([sx, sz]) => Math.hypot(x - sx, z - sz) >= 10 + 1.2) && doors.every(([dx, dz]) => Math.hypot(x - dx, z - dz) >= 6);
  const found = [];
  for (let x = -R; x <= R; x += STEP) for (let z = -R; z <= R; z += STEP) {
    if (Math.hypot(x, z) > R || !clear(x, z)) continue;
    const top = h(x, z); let drop = 0; let dir = null;
    for (const d of DIRS) { const v = top - h(x + d[0] * 1.5, z + d[1] * 1.5); if (v > drop) { drop = v; dir = d; } }
    if (drop >= 2.2) found.push({ x, z, drop, dir });
  }
  found.sort((a, b) => b.drop - a.drop || a.x - b.x || a.z - b.z);
  const faces = [];
  for (const f of found) { if (faces.length >= FACES) break; if (faces.some((k) => Math.hypot(k.x - f.x, k.z - f.z) < GAP)) continue; faces.push(f); }
  const r2 = (v) => Math.round(v * 100) / 100;
  const hash = (x, z) => { const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return v - Math.floor(v); };
  // one vine down the face from (x, z) along dir -- its origin (bottom), yaw, tilt -- or null
  const hang = (x, z, [ux, uz], len) => {
    const at = (d) => h(x + ux * d, z + uz * d); const h0 = at(0);
    let s0 = null; for (let d = 0; d <= 2; d += 0.05) if (h0 - at(d) >= 0.05) { s0 = d; break; } // (where the face begins)
    if (s0 === null) return null; const yT = at(s0);
    let dB = null; for (let d = s0 + 0.1; d <= s0 + 4; d += 0.05) if (Math.hypot(d - s0, yT - at(d)) >= len) { dB = d; break; }
    if (dB === null) return null; const yB = at(dB); const run = dB - s0; const fall = yT - yB;
    if (fall < len * 0.7) return null; // (a steep face only: not laid out over a slope)
    const n = [fall / len, run / len]; // (out and up, off the face)
    for (let k = 1; k < 10; k += 1) { const f = k / 10; const d = s0 + run * f; const y = yT - fall * f; const gap = (y - at(d)) * n[1] + 0; if (gap + OFF < -0.02 || gap > 0.45) return null; } // (not into the rock, not far off it)
    return { x: x + ux * (dB + n[0] * OFF), y: yB + n[1] * OFF, z: z + uz * (dB + n[0] * OFF), tilt: Math.atan2(run, fall) };
  };
  const out = [];
  for (const f of faces) {
    const kind = hash(f.x, f.z) < 0.7 ? 'strands' : 'drape'; const yaw = Math.atan2(f.dir[0], f.dir[1]); const tx = f.dir[1]; const tz = -f.dir[0];
    for (const a of ALONG[kind]) {
      const x = f.x + tx * a; const z = f.z + tz * a; if (!clear(x, z)) continue;
      const v = hang(x, z, f.dir, H[kind] * S); if (v && kind === 'drape' && v.tilt > 0.35) continue; /* (땅·길: a 5 m wide drape on a leaning face lay on it -- 총괄 #460 사진) */ if (v) out.push([kind, r2(v.x), r2(v.y), r2(v.z), r2(yaw), r2(v.tilt), S]);
    }
  }
  return out;
}
function source(list) {
  return `// v1.10.310 덩굴: where the island's vines hang -- made by tools/vine-spots.js (do not edit: run it again after the ground changes;
// test/island-vines.test.js checks). Each [kind, x, y, z (its origin: the bottom), yaw (its face out over the drop), tilt (its top
// back toward the face, rad), size]. Browser and node.
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
  console.log(`${list.length} vines (${list.filter((v) => v[0] === 'strands').length} strands) on ${new Set(list.map((v) => `${Math.round(v[1] / 8)},${Math.round(v[3] / 8)}`)).size} faces`);
}
