'use strict';
// 파도 치는 바닷가 (gamecenter-notes docs/shore-waves-design-20261025.md ①): the shore map, read by the ground's and the sea's
// shaders -- R how far from the sea's edge (the line where the ground meets the sea's height; land +, water -, ±12 m over
// 0..255: the wash runs up the same distance on a steep beach as on a flat one), G how deep the sea is there (0..3 m),
// B what the shore is (255 sand, 128 rock and cliff, 64 built: 물가 거리's rail, the pier, the dock)
const SEA = -0.6; const RANGE = 12;

function buildShoreMap(T, res = 1024, box = null) { // (box { x0, z0, size }: another square than the ground's -- N1 new island's)
  const size = box?.size ?? T.GROUND.size; const x0 = box?.x0 ?? -size / 2; const z0 = box?.z0 ?? -size / 2; const cell = size / res; const n = res * res;
  const h = new Float32Array(n);
  for (let j = 0; j < res; j += 1) for (let i = 0; i < res; i += 1) h[j * res + i] = T.meshGroundHeight(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell);
  // two-pass chamfer distance (in texels) to the other side of the sea's height, each side
  const dist = (inside) => {
    const d = new Float32Array(n); for (let k = 0; k < n; k += 1) d[k] = inside(k) ? 1e6 : 0;
    const relax = (k, k2, w) => { if (d[k2] + w < d[k]) d[k] = d[k2] + w; };
    for (let j = 0; j < res; j += 1) for (let i = 0; i < res; i += 1) { const k = j * res + i; if (!d[k]) continue; if (i) relax(k, k - 1, 1); if (j) { relax(k, k - res, 1); if (i) relax(k, k - res - 1, 1.4142); if (i < res - 1) relax(k, k - res + 1, 1.4142); } }
    for (let j = res - 1; j >= 0; j -= 1) for (let i = res - 1; i >= 0; i -= 1) { const k = j * res + i; if (!d[k]) continue; if (i < res - 1) relax(k, k + 1, 1); if (j < res - 1) { relax(k, k + res, 1); if (i < res - 1) relax(k, k + res + 1, 1.4142); if (i) relax(k, k + res - 1, 1.4142); } }
    return d;
  };
  // (the sea only: a lake, a river or a pond under the sea's height is fresh water -- calm, no wash -- 검토: 거울호수에 파도)
  const sea = new Uint8Array(n); for (let j = 0; j < res; j += 1) for (let i = 0; i < res; i += 1) { const k = j * res + i; sea[k] = h[k] < SEA && T.coastDist(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell) < 2 ? 1 : 0; }
  const land = dist((k) => !sea[k]); const water = dist((k) => sea[k]);
  const built = [...(T.WATERFRONT?.rails || []).map((r) => [r.x, r.z, 4]), ...(T.PIER ? [[T.PIER.x, T.PIER.z, (T.PIER.half || 8) + 2]] : []), ...(T.DOCK?.rects || []).map((r) => [r.x, r.z, (r.half || 3) + 2])];
  // (문제 기록 5회차, 물가 거리: the wash ran over the street's paving between its rails -- a painted walk by the sea is
  // built shore too, to its edge and a metre more: no wash over it, as the design's 인공 물가)
  const walks = T.dalmaru ? require('../../public/plaza/island-paths').paintedWalks(T).curves : [];
  const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax; const dz = bz - az; const l = dx * dx + dz * dz || 1; const u = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l)); return Math.hypot(px - ax - u * dx, pz - az - u * dz); };
  // (1.10.360: each walk piece in the 8 m cells it reaches -- every pixel by the sea asked all the island's pieces, a fifth of the
  // maps' build; the same answer)
  const GRID = 8; const grid = new Map();
  for (const w of walks) for (let s = 1; s < w.pts.length; s += 1) {
    const [ax, az] = w.pts[s - 1]; const [bx, bz] = w.pts[s]; const reach = w.w / 2 + 1; const seg = [ax, az, bx, bz, reach];
    for (let cx = Math.floor((Math.min(ax, bx) - reach) / GRID); cx <= Math.floor((Math.max(ax, bx) + reach) / GRID); cx += 1) for (let cz = Math.floor((Math.min(az, bz) - reach) / GRID); cz <= Math.floor((Math.max(az, bz) + reach) / GRID); cz += 1) { const key = cx * 100003 + cz; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(seg); }
  }
  const onWalk = (x, z) => (grid.get(Math.floor(x / GRID) * 100003 + Math.floor(z / GRID)) || []).some(([ax, az, bx, bz, reach]) => segDist(x, z, ax, az, bx, bz) <= reach)
    || (T.roadDist ? T.roadDist(x, z) <= T.ROAD.half + 1 : false); /* (T1 고침, 문제 기록 11-18 「인도까지 바닷물이 올라와」: the taxi road's lanes and walks, a metre more, built shore -- no wash) */
  const out = new Uint8Array(n * 3);
  for (let j = 0; j < res; j += 1) for (let i = 0; i < res; i += 1) {
    const k = j * res + i; const x = x0 + (i + 0.5) * cell; const z = z0 + (j + 0.5) * cell;
    const sd = (sea[k] ? -water[k] : land[k]) * cell; // (metres: + on land)
    out[k * 3] = Math.round((Math.max(-1, Math.min(1, sd / RANGE)) * 0.5 + 0.5) * 255);
    out[k * 3 + 1] = sea[k] ? Math.round(Math.max(0, Math.min(1, (SEA - h[k]) / 3)) * 255) : 0;
    out[k * 3 + 2] = Math.abs(sd) > RANGE ? 0 : built.some(([bx, bz, r]) => Math.hypot(bx - x, bz - z) < r) || (sd > -2 && onWalk(x, z)) ? 64 : T.cliffAt(x, z) > 0.4 ? 128 : 255;
  }
  return out;
}
module.exports = { buildShoreMap, SHORE_RANGE: RANGE };
