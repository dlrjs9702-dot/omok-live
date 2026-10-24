'use strict';
// 섬 땅 전체를 지도 그림으로 2 (gamecenter-notes docs/terrain-paint-design-20261025.md): what the ground is made of, at each
// texel of the island's ground -- built here once, read by the ground's shader (island.js). Weights 0..255, the rest is
// grass (its colour, and the seasons over it, stay the ground's own):
//   cover-a  R forest floor (under trees), G bare earth (steep slopes, worn by doors and benches), B sand (the shore)
//   cover-b  R rock (cliffs, the steepest slopes), G darker grass (patches), B clover and flowers (round the flower beds)
//   gravel (round 대청마당's paving) goes into path-b's B
const SEA = -0.6;
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
// value noise: smooth, the same every build
const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
function noise(x, z) {
  const i = Math.floor(x); const j = Math.floor(z); const fx = x - i; const fz = z - j; const ux = fx * fx * (3 - 2 * fx); const uz = fz * fz * (3 - 2 * fz);
  return (hash(i, j) * (1 - ux) + hash(i + 1, j) * ux) * (1 - uz) + (hash(i, j + 1) * (1 - ux) + hash(i + 1, j + 1) * ux) * uz;
}

function buildCoverMaps(T, res = 1024) {
  const size = T.GROUND.size; const x0 = -size / 2; const z0 = -size / 2; const cell = size / res; const n = res * res;
  const P = T.dalmaru.PLAZA; const plazaDist = (x, z) => Math.max(Math.abs(x - P.x) - P.hw, P.d0 - z, z - P.d1);
  const h = new Float32Array(n);
  for (let j = 0; j < res; j += 1) for (let i = 0; i < res; i += 1) h[j * res + i] = T.meshGroundHeight(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell);
  // trees in 8 m buckets (as island.js forestAt)
  const buckets = new Map(); for (const t of T.nature().trees) { const k = `${Math.floor(t.x / 8)},${Math.floor(t.z / 8)}`; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(t); }
  const forestAt = (x, z) => { let f = 0; const bx = Math.floor(x / 8); const bz = Math.floor(z / 8); for (let a = -1; a <= 1; a += 1) for (let b = -1; b <= 1; b += 1) for (const t of buckets.get(`${bx + a},${bz + b}`) || []) { const d = Math.hypot(t.x - x, t.z - z); if (d < 6) f += 1 - d / 6; } return Math.min(1, f / 2); };
  // worn ground: before each door, bench, board and keeper (1.4 m, frayed)
  const V = T.VILLAGE || {}; const worn = [];
  for (const id of Object.keys(T.SPOTS)) { const d = T.facilityDoor(id); if (d) worn.push([d.x, d.z, 1.6]); }
  for (const c of T.COTTAGES) { const l = Math.hypot(c.face[0] - c.x, c.face[1] - c.z) || 1; worn.push([c.x + ((c.face[0] - c.x) / l) * 3.6, c.z + ((c.face[1] - c.z) / l) * 3.6, 1.3]); }
  for (const b of [...(T.WATERFRONT?.benches || []), ...(V.buskBenches || [])]) worn.push([b.x, b.z, 1.3]);
  for (const k of ['mailbox', 'guide', 'busker', 'painter', 'librarian', 'grandpa', 'electrician', 'builder']) if (V[k]?.x !== undefined) worn.push([V[k].x, V[k].z, 1.2]);
  const wornAt = (x, z) => { let w = 0; for (const [wx, wz, r] of worn) { const d = Math.hypot(wx - x, wz - z); if (d < r + 1) w = Math.max(w, 1 - smooth(r * 0.55, r + 0.6 * noise(x * 2.1, z * 2.1), d)); } return w; };
  const flowers = T.nature().flowers || [];
  const flowerAt = (x, z) => { let f = 0; for (const p of flowers) { const d = Math.hypot(p.x - x, p.z - z); if (d < 2.6) f = Math.max(f, 1 - smooth(1.2, 2.4, d + 0.5 * noise(x * 1.7, z * 1.7))); } return f; };
  const apronAt = (x, z) => { const out = Math.hypot(Math.max(0, Math.abs(x - P.x) - P.hw), Math.max(0, P.d0 - z, z - P.d1)); return out <= 0 || z < P.d0 ? 0 : 1 - smooth(1.5, 3.4 + 1.1 * Math.sin(x * 0.83) * Math.cos(z * 0.67), out); };
  const a = new Uint8Array(n * 3); const b = new Uint8Array(n * 3); const gravel = new Uint8Array(n);
  const put = (arr, k, c, v) => { arr[k * 3 + c] = Math.round(Math.max(0, Math.min(1, v)) * 255); };
  for (let j = 0; j < res; j += 1) for (let i = 0; i < res; i += 1) {
    const k = j * res + i; const x = x0 + (i + 0.5) * cell; const z = z0 + (j + 0.5) * cell;
    if (plazaDist(x, z) < -0.3) continue; // (paved)
    const hx = (h[j * res + Math.min(res - 1, i + 1)] - h[j * res + Math.max(0, i - 1)]) / (2 * cell); const hz = (h[Math.min(res - 1, j + 1) * res + i] - h[Math.max(0, j - 1) * res + i]) / (2 * cell);
    const slope = Math.hypot(hx, hz); const cd = T.coastDist(x, z); const cliff = T.cliffAt(x, z); const n1 = noise(x * 0.9, z * 0.9);
    const sand = cd < 9 && cliff < 0.5 ? smooth(8.5, 4, cd + (n1 - 0.5) * 1.6) : h[k] < SEA - 0.3 ? 1 : 0;
    // (검토 2차 1: rock only where the ground is near upright -- the slopes keep their grass, a thin band of earth at the steepest)
    const rock = Math.max(cliff > 0.4 && cd < 3.5 ? smooth(3.5, 0.5, cd + (n1 - 0.5)) : 0, smooth(1.9, 2.8, slope + (n1 - 0.5) * 0.3));
    // (동산 다듬기 검토: a terrace's and a ledge's banks show some earth, the ledge a little rock at its steepest)
    const bank = (T.dalmaru.BRUSHES || []).find((br) => (br.kind === 'terrace' || br.kind === 'ledge') && Math.hypot(x - br.x, z - br.z) < br.r);
    const bankSoil = bank ? smooth(0.55, 1.0, slope + (n1 - 0.5) * 0.3) * 0.75 : 0;
    const bankRock = bank?.kind === 'ledge' ? smooth(0.95, 1.15, slope + (n1 - 0.5) * 0.3) * 0.6 : 0;
    const rockAll = Math.max(rock, bankRock);
    const soil = Math.max(smooth(1.15, 1.9, slope + (n1 - 0.5) * 0.25) * (1 - rock) * 0.8, bankSoil * (1 - bankRock), wornAt(x, z)) * (1 - sand);
    const forest = forestAt(x, z) * (1 - sand) * (1 - rock);
    // (검토 2차 2: darker grass in patches from a turned and warped noise -- no grid in it)
    const u = x * 0.8 - z * 0.6; const v = x * 0.6 + z * 0.8; const wx = noise(u * 0.05 + 3.1, v * 0.05) * 9; const wz = noise(u * 0.05, v * 0.05 - 5.7) * 9;
    const dark = 0.7 * smooth(0.52, 0.78, noise((u + wx) * 0.09, (v + wz) * 0.09) * 0.75 + noise((v - wz) * 0.31 + 1.7, (u + wx) * 0.31) * 0.25) * (1 - sand) * (1 - rock) * (1 - forest);
    put(a, k, 0, forest); put(a, k, 1, soil); put(a, k, 2, sand); put(b, k, 0, rockAll); put(b, k, 1, dark); put(b, k, 2, flowerAt(x, z) * (1 - sand));
    gravel[k] = Math.round(apronAt(x, z) * 255);
  }
  return { a, b, gravel };
}
module.exports = { buildCoverMaps };
