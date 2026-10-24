'use strict';
// 파도 치는 바닷가 (gamecenter-notes docs/shore-waves-design-20261025.md ①): the shore map, read by the ground's and the sea's
// shaders -- R how far from the sea's edge (the line where the ground meets the sea's height; land +, water -, ±12 m over
// 0..255: the wash runs up the same distance on a steep beach as on a flat one), G how deep the sea is there (0..3 m),
// B what the shore is (255 sand, 128 rock and cliff, 64 built: 물가 거리's rail, the pier, the dock)
const SEA = -0.6; const RANGE = 12;

function buildShoreMap(T, res = 1024) {
  const size = T.GROUND.size; const x0 = -size / 2; const z0 = -size / 2; const cell = size / res; const n = res * res;
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
  const built = [...(T.WATERFRONT?.rails || []).map((r) => [r.x, r.z, 3]), ...(T.PIER ? [[T.PIER.x, T.PIER.z, (T.PIER.half || 8) + 2]] : []), ...(T.DOCK?.rects || []).map((r) => [r.x, r.z, (r.half || 3) + 2])];
  const out = new Uint8Array(n * 3);
  for (let j = 0; j < res; j += 1) for (let i = 0; i < res; i += 1) {
    const k = j * res + i; const x = x0 + (i + 0.5) * cell; const z = z0 + (j + 0.5) * cell;
    const sd = (sea[k] ? -water[k] : land[k]) * cell; // (metres: + on land)
    out[k * 3] = Math.round((Math.max(-1, Math.min(1, sd / RANGE)) * 0.5 + 0.5) * 255);
    out[k * 3 + 1] = sea[k] ? Math.round(Math.max(0, Math.min(1, (SEA - h[k]) / 3)) * 255) : 0;
    out[k * 3 + 2] = Math.abs(sd) > RANGE ? 0 : built.some(([bx, bz, r]) => Math.hypot(bx - x, bz - z) < r) ? 64 : T.cliffAt(x, z) > 0.4 ? 128 : 255;
  }
  return out;
}
module.exports = { buildShoreMap, SHORE_RANGE: RANGE };
