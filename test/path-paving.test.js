'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain');

// 문제 기록 2회차 3 「길이 군데군데 파인 곳이 많아」: the 마을 길's slabs (1 m, 4 cm, island.js laid every 0.9 m along, one
// per metre across) and the junction discs (5 m) lean with the ground mesh under them, 1 cm over it -- nowhere on one may
// the ground come up through its top (laid flat, 343 of 898 slabs had grass showing, up to 11 cm)
const g = (x, z) => T.meshGroundHeight(x, z);
const lean = (px, pz, top, e = 0.5, round = 0) => {
  const gx = (g(px + e, pz) - g(px - e, pz)) / (2 * e); const gz = (g(px, pz + e) - g(px, pz - e)) / (2 * e); const g0 = g(px, pz);
  let over = 0; for (let k = 0; round && k < 32; k += 1) for (const f of [0.5, 1]) { const x = px + Math.cos((k / 32) * Math.PI * 2) * round * f; const z = pz + Math.sin((k / 32) * Math.PI * 2) * round * f; over = Math.max(over, g(x, z) - g0 - gx * (x - px) - gz * (z - pz)); }
  return (x, z) => g0 + top + over + gx * (x - px) + gz * (z - pz);
};
const offPath = (x, z) => T.onBridge(x, z) || T.streamDist(x, z) < T.STREAM_HALF + 0.5 || T.inTownhall(x, z, 0.5) || (T.inPlaza && T.inPlaza(x, z));
test('마을 길 돌판·갈림길 원판: 땅이 위로 솟아 나온 곳이 없다', { skip: !T.dalmaru }, () => {
  const bad = []; let slabs = 0;
  T.walkCurves.forEach((w) => {
    if (w.tier !== 'town') return; let s = 0;
    for (let i = 1; i < w.pts.length; i += 1) {
      const [x0, z0] = w.pts[i - 1]; const [x1, z1] = w.pts[i]; const l = Math.hypot(x1 - x0, z1 - z0); if (!l) continue; const dx = (x1 - x0) / l; const dz = (z1 - z0) / l;
      for (; s <= l; s += 0.9) {
        const cx = x0 + dx * s; const cz = z0 + dz * s; const cols = Math.max(1, Math.round(w.w - 0.4)); if (offPath(cx, cz)) continue;
        for (let c = 0; c < cols; c += 1) {
          const o = c - (cols - 1) / 2; const px = cx - dz * o; const pz = cz + dx * o; const top = lean(px, pz, 0.05); slabs += 1;
          for (const a of [-0.45, 0, 0.45]) for (const b of [-0.45, 0, 0.45]) { const qx = px + dx * a - dz * b; const qz = pz + dz * a + dx * b; if (g(qx, qz) > top(qx, qz)) bad.push(`slab ${px.toFixed(1)},${pz.toFixed(1)} +${(g(qx, qz) - top(qx, qz)).toFixed(3)}`); }
        }
      }
      s -= l;
    }
  });
  // the junctions: where one walk meets another (as island.js finds them, one disc within 7 m), 4 cm thick, 2.5 m round
  const discs = [];
  T.walkCurves.forEach((w, wi) => w.pts.forEach(([x, z]) => {
    if (offPath(x, z) || discs.some((d) => Math.hypot(d.x - x, d.z - z) < 7)) return;
    if (T.walkCurves.some((o, oi) => oi > wi && o.pts.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < 0.9))) discs.push({ x, z });
  }));
  // (each disc as laid: its slope read over 1 m, 1 cm higher than a slab, raised over the most the ground rises in its round)
  for (const d of discs) { const top = lean(d.x, d.z, 0.06, 1, 2.5); for (let r = 0.5; r <= 2.4; r += 0.6) for (let a = 0; a < 12; a += 1) { const qx = d.x + Math.cos(a / 2) * r; const qz = d.z + Math.sin(a / 2) * r; if (g(qx, qz) > top(qx, qz)) { bad.push(`disc ${d.x.toFixed(1)},${d.z.toFixed(1)} +${(g(qx, qz) - top(qx, qz)).toFixed(3)}`); r = 9; break; } } }
  assert.ok(slabs > 500 && discs.length > 5, `${slabs} slabs, ${discs.length} discs`); assert.deepEqual([...new Set(bad)].slice(0, 20), []);
});
