'use strict';
// 1.10.375 N2a-1 별마루섬 (notes docs/island-expansion-20261115.md 「별마루섬 호랑이」; assets 136 · 152 · 152c · 157): where the island's still
// pieces stand -- the fence round it 4 m in from its coast (2.4 m a piece, 152c's three kinds mixed in, a corner post where it turns, the
// people's gate where the walk from 별마루다리 crosses it, none over the creek's mouth or on a cliff), the swamps (off the walks, the camp,
// the peak and the creek) with reeds and 152c's pieces round them, 우레's rock below the lookout, the camp's fire, benches and stools, and
// 157's spring cave at the creek's head. Written to public/plaza/isle2-props.js (made once here: the server starts without working it out).
// node tools/isle2-props.cjs [--check]  (--check: fails when the file is not what this makes -- test/isle2-props.test.js)
const fs = require('node:fs'); const path = require('node:path');
const ROOT = path.join(__dirname, '..'); const OUT = path.join(ROOT, 'public/plaza/isle2-props.js');
const T = require(path.join(ROOT, 'public/plaza/island-terrain.js')); require(path.join(ROOT, 'public/plaza/island-train.js'));
const D = T.dalmaru; const I = D.NEW_ISLE;
const hash = (a, b, k) => { const v = Math.sin(a * 127.1 + b * 311.7 + k * 74.7) * 43758.5453; return v - Math.floor(v); };
const r2 = (v) => Math.round(v * 100) / 100; const r3 = (v) => Math.round(v * 1000) / 1000;
const SRC = JSON.parse(fs.readFileSync(path.join(__dirname, 'isle2-props-sources.json'), 'utf8')); /* (from the asset folders, outside the repo: 152 swamp_a/b/c's outlines -- the swamp meshes are not in the game, island.js draws them -- and 157's solids.json) */
const toWorld = (x, z, yaw, u, v) => [x + u * Math.cos(yaw) + v * Math.sin(yaw), z - u * Math.sin(yaw) + v * Math.cos(yaw)];

// ---- the fence: the contour IN m in from the coast, every 2.4 m ----
const IN = 4; const SEG = 2.4; const ring = [];
for (let k = 0; k < 720; k += 1) {
  const a = (k / 720) * Math.PI * 2; const ux = Math.cos(a); const uz = Math.sin(a); let s = 0;
  for (; s < 260; s += 2) if (D.newIsleCoast(I.x + ux * s, I.z + uz * s) <= IN) break;
  let lo = Math.max(0, s - 2); let hi = s; for (let n = 0; n < 12; n += 1) { const m = (lo + hi) / 2; if (D.newIsleCoast(I.x + ux * m, I.z + uz * m) <= IN) hi = m; else lo = m; }
  ring.push([I.x + ux * hi, I.z + uz * hi]);
}
const pts = [ring[0]]; { let acc = 0; for (let k = 1; k <= ring.length; k += 1) { const a = ring[k - 1]; const b = ring[k % ring.length]; const d = Math.hypot(b[0] - a[0], b[1] - a[1]); let t0 = 0; while (acc + d - t0 >= SEG) { const t = t0 + (SEG - acc); pts.push([a[0] + (b[0] - a[0]) * (t / d), a[1] + (b[1] - a[1]) * (t / d)]); t0 = t; acc = 0; } acc += d - t0; } }
const steep = (x, z) => D.slopeAt(x, z) > 0.9; const wet = (x, z) => D.creekDist(x, z) < 3 || D.inCreek(x, z);
const segs = [];
for (let i = 0; i < pts.length; i += 1) {
  const a = pts[i]; const b = pts[(i + 1) % pts.length]; const mx = (a[0] + b[0]) / 2; const mz = (a[1] + b[1]) / 2; const tx = (b[0] - a[0]) / SEG; const tz = (b[1] - a[1]) / SEG;
  let nx = tz; let nz = -tx; if (nx * (mx - I.x) + nz * (mz - I.z) < 0) { nx = -nx; nz = -nz; }
  /* (1.10.397 사용자 결정 54 A, 검토 isle2-fence-bridge-whale fence-gaps: by the creek and at a cliff's ends the pieces left out stood on walkable
     ground -- one walked in round the fence; a piece any of whose points is walkable stands too, but none over the creek's water (its middle in
     it): the creek's way stays, the banks fenced -- in and out by the two gates only) */
  const keep = ![a, b, [mx, mz]].some(([x, z]) => steep(x, z) || wet(x, z)) || (!D.inCreek(mx, mz) && [a, b, [mx, mz]].some(([x, z]) => T.walkable(x, z)));
  segs.push({ i, x: mx, z: mz, yaw: Math.atan2(-nx, -nz), keep, walk: T.walkDist(mx, mz) });
}
const gate = segs.filter((s) => s.keep).sort((p, q) => p.walk - q.walk)[0]; /* (the walk from 별마루다리: the only one it crosses) */
/* (1.10.389 N3-a 부두 문: the second gate, the piece nearest the 별마루섬 부두's gangway foot (its float 7.2 m west of it) -- a gate's 12 m round
   is the tigers' safe ground (lib/island-tigers reads the gates off this list)) */
const DOCK2 = D.PLACES.dock2; const dockGate = DOCK2 ? segs.filter((s) => s.keep && s !== gate).sort((p, q) => Math.hypot(p.x - DOCK2.x - 7.2, p.z - DOCK2.z) - Math.hypot(q.x - DOCK2.x - 7.2, q.z - DOCK2.z))[0] : null;
/* (1.10.394 N4-c, assets 163 fence_gate_wide, notes n4-plan §5-4: the taxi's way onto 별마루섬 -- the walk's gate and the two pieces either
   side of it (the old #181 · #183) one 7.2 m gate in the middle one's place and turn, its 4.4 m between the posts; kind 5 so the others keep theirs) */
/* (1.10.408 assets 171 fence_gate_road, 결정 67-1 A: the car gate 5.4 m and a people's wicket 1.2 m each side, 12 m across -- two pieces either side
   of it out (#180 · #181 · #183 · #184), kind 6 on the end of KINDS so the others keep theirs; fence_gate_wide (5) unused, kept for now) */
const wideOff = new Set([1, 2].flatMap((k) => [segs[(gate.i + segs.length - k) % segs.length], segs[(gate.i + k) % segs.length]]));
const KINDS = ['fence_segment', 'fence_palisade_b', 'fence_palisade_e', 'fence_stonewall', 'fence_gate', 'fence_gate_wide', 'fence_gate_road', 'fence_palisade_tall', 'fence_wicket' /* (1.10.413 S1: the camp's ring, below) */];
const FENCE = segs.filter((s) => s.keep && !wideOff.has(s)).map((s) => { const h = hash(s.x, s.z, 3); const kind = s === gate ? 6 : s === dockGate ? 4 : h < 0.07 ? 1 : h < 0.14 ? 2 : h < 0.2 ? 3 : 0; return [r2(s.x), r2(s.z), r3(s.yaw), kind]; });
const CORNERS = []; for (let i = 0; i < segs.length; i += 1) { const p = segs[(i + segs.length - 1) % segs.length]; const s = segs[i]; if (p.keep !== s.keep) { CORNERS.push([r2(pts[i][0]), r2(pts[i][1])]); continue; } /* (a run's end, by a cliff or the creek: its post) */ if (!p.keep || !s.keep) continue; let turn = Math.abs(s.yaw - p.yaw); turn = Math.min(turn, Math.PI * 2 - turn); if (turn > (10 * Math.PI) / 180) CORNERS.push([r2(pts[i][0]), r2(pts[i][1])]); }

// ---- the warning board (152b/152e sign_tiger): outside the gate, beside the walk, facing whoever comes over 별마루다리 ----
const SIGN = (() => { const nx = -Math.sin(gate.yaw); const nz = -Math.cos(gate.yaw); const tx = Math.cos(gate.yaw); const tz = -Math.sin(gate.yaw);
  /* (1.10.408 assets 171: past the road gate's wings (±6.0) -- at ±3.2 its board stood square before the south wicket (lx 3.1 ~ 4.3); off the taxi's road) */
  for (const [side, out] of [[6.4, 2.6], [-6.4, 2.6], [7.2, 2.6], [-7.2, 2.6], [6.4, 3.4], [-6.4, 3.4], [7.2, 3.4], [-7.2, 3.4]]) { const x = gate.x + nx * out + tx * side; const z = gate.z + nz * out + tz * side; if (T.walkable(x, z) && T.walkDist(x, z) > 0.6 && !T.onBridge?.(x, z) && !(T.roadDist && T.roadDist(x, z) < 3.9 + 1.2)) return [r2(x), r2(z), r3(gate.yaw)]; }
  return null; })();
// ---- 136's two signs (1.10.377): the reserve's board just inside the gate beside the walk, facing whoever comes in (its title); the trail
// post at the camp's edge by the walk from the bridge, its three arrows turned to point nearest the camp, the lookout and 별마루다리 ----
const SIGN_RESERVE = (() => { const nx = Math.sin(gate.yaw); const nz = Math.cos(gate.yaw); const tx = Math.cos(gate.yaw); const tz = -Math.sin(gate.yaw);
  for (const side of [3.2, -3.2, 3.8, -3.8, 4.6, -4.6, 5.4, -5.4]) { const x = gate.x + nx * 4 + tx * side; const z = gate.z + nz * 4 + tz * side; if (T.walkable(x, z) && T.walkDist(x, z) > 0.9 && D.newIsleCoast(x, z) > IN + 0.5 && !(T.roadDist && T.roadDist(x, z) < 3.9 + 1.2)) return [r2(x), r2(z), r3(gate.yaw)]; } /* (1.10.395: off the taxi's road in -- its band and the board's half) */
  return null; })();
const SIGN_TRAIL = (() => {
  const B = T.ISLE2_BRIDGE_HEAD; let at = null;
  for (let a = 0; a < 360; a += 3) { const ang = (a * Math.PI) / 180; const x = I.camp.x + Math.cos(ang) * (I.camp.r - 4); const z = I.camp.z + Math.sin(ang) * (I.camp.r - 4); const wd = T.walkDist(x, z); if (wd < 1.4 || wd > 3 || !T.walkable(x, z)) continue; const d = Math.hypot(x - B.x, z - B.z); if (!at || d < at.d) at = { x, z, d }; }
  if (!at) return null;
  const dest = [[I.camp.x, I.camp.z], [I.peak.x, I.peak.z], [B.x, B.z]]; const NAMES = [D.NAMES.camp, '전망대', D.NAMES.newBridge]; const ARROWS = [[1, 0], [-0.866, -0.5], [0.574, 0.819]];
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]; let best = null;
  for (let deg = 0; deg < 360; deg += 1) { const yaw = (deg * Math.PI) / 180; const c = Math.cos(yaw); const n = Math.sin(yaw);
    for (const p of perms) { let err = 0; ARROWS.forEach(([u, v], i) => { const wx = u * c + v * n; const wz = -u * n + v * c; const [gx, gz] = dest[p[i]]; let d = Math.atan2(wx, wz) - Math.atan2(gx - at.x, gz - at.z); while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; err += Math.abs(d); }); if (!best || err < best.err) best = { err, yaw, p }; } }
  return [r2(at.x), r2(at.z), r3(best.yaw), best.p.map((k) => NAMES[k])]; })();
// ---- the spring cave (157): its README's place ----
const CAVE = { x: 363, z: 176, yaw: 0.942 };
const caveSolids = SRC.caveSolids;

// ---- the camp (136): the fire in its middle, two benches facing it, three stools round it ----
const C = I.camp; const CAMP = [[C.x, C.z, 0, 0]];
for (const [ang, kind, d] of [[0.3, 1, 2.6], [Math.PI + 0.3, 1, 2.6], [1.9, 2, 2.3], [4.2, 2, 2.3], [5.3, 2, 2.4]]) { const x = C.x + Math.cos(ang) * d; const z = C.z + Math.sin(ang) * d; const yaw = Math.atan2(-(C.x - x), -(C.z - z)); CAMP.push([r2(x), r2(z), r3(yaw), kind]); } /* (each one's -Z, the way a seat faces, toward the fire) */
const CAMP_KINDS = ['campfire', 'log_bench', 'log_stool'];
/* ---- 1.10.413 S1 the camp's tall palisade (assets 174, 사용자 결정 72 · 검토 safe-zones-visible §2-1): a ring round the camp, the pieces' middles
   camp.ring.r out, +Z (their inside) to the camp; a people's wicket (1.2 m, tigers 1.5 ~ 1.8 m across) on each walk that crosses it -- the middle of
   its run on the walk, found along the ring every 1/8° -- and between two wickets the palisade evenly, as near 6° (2.4 m) a piece as whole pieces go.
   On the end of FENCE: kinds 7 · 8 on the end of KINDS (the others keep theirs); fence_wicket is not a fence_gate -- no 12 m round it (§3 물음 2 A) ---- */
const CAMP_FENCE = (() => {
  const RR = C.ring.r; const at = (a) => [C.x + Math.cos(a) * RR, C.z + Math.sin(a) * RR]; const N = 2880; const on = []; for (let k = 0; k < N; k += 1) on.push(T.walkDist(...at((k / N) * Math.PI * 2)) < 0.5);
  const wk = []; let s = -1; for (let k = 0; k < N * 2; k += 1) { const w = on[k % N]; if (w && s < 0) s = k; if (!w && s >= 0) { if (s < N && !(s === 0 && on[N - 1])) wk.push((((s + k - 1) / 2) % N) / N * Math.PI * 2); s = -1; } }
  wk.sort((p, q) => p - q);
  /* (each wicket slid along the ring -- both edges of its 1.2 m kept 0.2 m inside the walk (it crosses slanting: tried, not by the run's length) -- so
     every arc between two takes its whole pieces as near 2.4 m apart as may be: a log's end never on its neighbour's (2.25 m put them 2 cm apart).
     Tried every 0.1° for the first; the others then as near their arcs' even spacing as they may; the evenest kept, then the least slid) */
  const step = (Math.PI * 2) / C.ring.n; const ns = wk.map((a, i) => Math.max(1, Math.round(((wk[(i + 1) % wk.length] - a + Math.PI * 2) % (Math.PI * 2) || Math.PI * 2) / step)));
  { const d = Math.PI / 1800; const fits = (a) => [-0.6, 0, 0.6].every((u) => { const ang = a + u / RR; return T.walkDist(C.x + Math.cos(ang) * RR, C.z + Math.sin(ang) * RR) < -0.2; });
    const room = wk.map((a) => { let lo = 0; while (lo > -0.1 && fits(a + lo - d)) lo -= d; let hi = 0; while (hi < 0.1 && fits(a + hi + d)) hi += d; return [lo, hi]; });
    const spanOf = (xs, i) => { const j = (i + 1) % wk.length; return (wk[j] + xs[j] - wk[i] - xs[i] + Math.PI * 4) % (Math.PI * 2) || Math.PI * 2; };
    let best = null;
    for (let x0 = room[0][0]; x0 <= room[0][1] + 1e-9; x0 += d) { const xs = [x0];
      for (let i = 1; i < wk.length; i += 1) xs.push(Math.max(room[i][0], Math.min(room[i][1], ns[i - 1] * step - (wk[i] - wk[i - 1]) + xs[i - 1])));
      const dev = Math.max(...wk.map((_, i) => Math.abs(spanOf(xs, i) / ns[i] - step))); const m = Math.max(...xs.map(Math.abs));
      if (!best || dev < best.dev - 1e-6 || (Math.abs(dev - best.dev) <= 1e-6 && m < best.m)) best = { dev, m, xs }; }
    if (best) best.xs.forEach((x, i) => { wk[i] += x; }); }
  const out = []; const piece = (a, kind) => out.push([r2(C.x + Math.cos(a) * RR), r2(C.z + Math.sin(a) * RR), r3(Math.atan2(-Math.cos(a), -Math.sin(a))), kind]);
  wk.forEach((a, i) => { piece(a, 8); const span = (wk[(i + 1) % wk.length] - a + Math.PI * 2) % (Math.PI * 2) || Math.PI * 2; for (let j = 1; j < ns[i]; j += 1) piece(a + (span * j) / ns[i], 7); });
  return out; })();

// ---- 우레's rock (152b): below the lookout, seen from the walk -- 4~9 m off it, flat, nothing on it ----
/* (from the walks and the ground alone -- nature() keeps its trees off these pieces (isle2Props.near), so nothing here may read it back) */
const clearOf = (x, z) => D.creekDist(x, z) > 6 && Math.hypot(x - CAVE.x, z - CAVE.z) > 14;
let ROCK = null; { let best = Infinity; for (let x = I.peak.x - 50; x <= I.peak.x + 50; x += 2) for (let z = I.peak.z - 50; z <= I.peak.z + 50; z += 2) {
  const dp = Math.hypot(x - I.peak.x, z - I.peak.z); if (dp < 16 || dp > 45) continue; const wd = T.walkDist(x, z); if (wd < 4 || wd > 9 || D.slopeAt(x, z) > 0.3 || !T.walkable(x, z) || !clearOf(x, z, 2.2)) continue;
  const score = Math.abs(dp - 28) + Math.abs(wd - 6); if (score < best) { best = score; ROCK = [r2(x), r2(z)]; } }
  const g = [0, 0]; let w = Infinity; for (let a = 0; a < 64; a += 1) { const ang = (a / 64) * Math.PI * 2; const d = T.walkDist(ROCK[0] + Math.cos(ang) * 5, ROCK[1] + Math.sin(ang) * 5); if (d < w) { w = d; g[0] = Math.cos(ang); g[1] = Math.sin(ang); } }
  ROCK.push(r3(Math.atan2(-g[0], -g[1]))); } /* (its -Z -- the way 우레 lies facing -- toward the walk) */

// ---- the swamps (152): off the walks, the camp, the peak, the creek, the coast; 40 m apart; their outlines in the world ----
const SWAMP_KINDS = ['swamp_a', 'swamp_b', 'swamp_c']; const SIZE = [3.1, 4.3, 5.9];
const outlineOf = (k) => { const o = SRC.swampOutlines[SWAMP_KINDS[k]]; const out = []; for (let i = 0; i < o.length; i += 2) out.push([o[i], o[i + 1]]); return out; };
const cands = []; for (let x = I.x - I.r; x <= I.x + I.r; x += 4) for (let z = I.z - I.r; z <= I.z + I.r; z += 4) {
  if (D.newIsleCoast(x, z) < 14 || D.slopeAt(x, z) > 0.22 || D.creekDist(x, z) < 8 || Math.hypot(x - C.x, z - C.z) < C.r + 14 || Math.hypot(x - I.peak.x, z - I.peak.z) < 22 || Math.hypot(x - T.ANCIENT.x, z - T.ANCIENT.z) < 28 || Math.hypot(x - CAVE.x, z - CAVE.z) < 18 || (ROCK && Math.hypot(x - ROCK[0], z - ROCK[1]) < 12)) continue;
  cands.push({ x, z, h: hash(x, z, 9) }); }
cands.sort((p, q) => p.h - q.h); const SWAMPS = []; const SWAMP_OUTLINES = [];
for (const c of cands) {
  if (SWAMPS.length >= 6) break; const kind = SWAMPS.length % 3; const yaw = hash(c.x, c.z, 11) * Math.PI * 2; const ol = outlineOf(kind).map(([u, v]) => toWorld(c.x, c.z, yaw, u, v));
  if (ol.some(([x, z]) => T.walkDist(x, z) < 4 || D.slopeAt(x, z) > 0.3 || !T.walkable(x, z))) continue; if (T.walkDist(c.x, c.z) < 6 + SIZE[kind]) continue;
  if (SWAMPS.some(([x, z]) => Math.hypot(x - c.x, z - c.z) < 40)) continue;
  SWAMPS.push([c.x, c.z, r3(yaw), kind]); SWAMP_OUTLINES.push(ol.map(([x, z]) => [r2(x), r2(z)]));
}
// reeds (3~5 a swamp, just outside its outline) and 152c's pieces (lilies on the pool, the rest at the edge; one heap of stones a second swamp)
const REED_KINDS = ['reeds_a', 'reeds_b', 'reeds_c']; const DECO_KINDS = ['swamp_lily_a', 'swamp_lily_b', 'swamp_fungus', 'swamp_grass_a', 'swamp_grass_b', 'swamp_planks', 'swamp_stones'];
const REEDS = []; const DECO = [];
SWAMPS.forEach(([sx, sz, syaw], s) => {
  const ol = SWAMP_OUTLINES[s]; const n = 3 + Math.floor(hash(sx, sz, 21) * 3); const step = Math.floor(ol.length / n);
  for (let k = 0; k < n; k += 1) { const [x, z] = ol[(k * step + s) % ol.length]; const dx = x - sx; const dz = z - sz; const d = Math.hypot(dx, dz) || 1; REEDS.push([r2(x + (dx / d) * 0.6), r2(z + (dz / d) * 0.6), r3(hash(x, z, 23) * Math.PI * 2), Math.floor(hash(x, z, 24) * 3)]); }
  const lilies = 1 + Math.floor(hash(sx, sz, 25) * 2); for (let k = 0; k < lilies; k += 1) { const a = hash(sx, sz, 26 + k) * Math.PI * 2; DECO.push([r2(sx + Math.cos(a) * 0.7), r2(sz + Math.sin(a) * 0.7), r3(a), k % 2]); }
  const edge = [2, 3, 4, 5].filter((_, k) => hash(sx, sz, 30 + k) < 0.6); if (s % 2 === 1) edge.push(6);
  edge.forEach((kind, k) => { const [x, z] = ol[(Math.floor(ol.length / 2) + k * 3 + s) % ol.length]; const dx = x - sx; const dz = z - sz; const d = Math.hypot(dx, dz) || 1; const out = kind === 6 ? 1.6 : 0.9; DECO.push([r2(x + (dx / d) * out), r2(z + (dz / d) * out), r3(hash(x, z, 33) * Math.PI * 2), kind]); });
});

// ---- what blocks: each kind's circles [x, z, r] in its own frame (README boxes as circles), and its stand-in box [w, h, d, z] ----
const segCircles = (r, zc = 0) => [-1.05, -0.7, -0.35, 0, 0.35, 0.7, 1.05].map((x) => [x, zc, r]);
const CIRCLES = {
  fence_segment: segCircles(0.22), fence_palisade_b: segCircles(0.38), fence_palisade_e: segCircles(0.42, 0.15), fence_stonewall: segCircles(0.28, 0.03),
  fence_gate: [[-1.05, 0, 0.2], [1.05, 0, 0.2]], /* (the people's way between: a body 0.45 round -- 0.8 m to go through, the leaf's 1 m opening) */
  fence_gate_wide: [[-2.4, 0, 0.2], [2.4, 0, 0.2], [-2.75, 0, 0.22], [-3.1, 0, 0.22], [-3.45, 0, 0.22], [2.75, 0, 0.22], [3.1, 0, 0.22], [3.45, 0, 0.22]], /* (assets 163 solids.json: its posts and wings -- the leaves block nothing) */
  fence_gate_road: [[-4.5, 0, 0.2], [-2.9, 0, 0.2], [2.9, 0, 0.2], [4.5, 0, 0.2], [-5.9, 0, 0.22], [-5.55, 0, 0.22], [-5.2, 0, 0.22], [-4.85, 0, 0.22], [4.85, 0, 0.22], [5.2, 0, 0.22], [5.55, 0, 0.22], [5.9, 0, 0.22]], /* (assets 171 gate-solids.json: posts and wings -- leaves and wickets block nothing) */
  fence_palisade_tall: segCircles(0.22), fence_wicket: [[-0.8, 0, 0.2], [0.8, 0, 0.2], [-1.05, 0, 0.22], [1.05, 0, 0.22]], /* (assets 174: as fence_segment; the wicket's posts and wings -- 1.2 m between, its leaf blocks nothing) */
  fence_corner: [[0, 0, 0.2]], sign_tiger: [[-0.85, 0, 0.15], [0.85, 0, 0.15]], sign_reserve: [[-0.66, 0.12, 0.17], [0.66, 0.12, 0.17]], sign_trail: [[0, 0.15, 0.18]] /* (136 README's solids) */, tiger_rock: [[-0.5, 0, 0.95], [0.5, 0, 0.95]], swamp_stones: [[0, -0.4, 0.66], [0, 0.4, 0.66]],
  campfire: [[0, 0, 0.6]], log_bench: [[-0.45, 0.05, 0.22], [0.45, 0.05, 0.22]], log_stool: [[0, 0, 0.25]],
  spring_cave: [...caveSolids.rock, ...caveSolids.water],
};
const BOXES = {
  fence_segment: [2.5, 1.6, 0.5, 0], fence_palisade_b: [2.5, 1.6, 0.8, 0], fence_palisade_e: [2.5, 1.5, 0.95, 0.15], fence_stonewall: [2.5, 1.4, 0.6, 0.03], fence_gate: null, fence_gate_wide: null, fence_gate_road: null, fence_palisade_tall: [2.5, 3.5, 0.5, 0], fence_wicket: null /* (assets 174: open in the middle -- drawn as the gates') */,
  fence_corner: [0.42, 2.08, 0.42, 0], sign_tiger: [1.9, 2.33, 0.2, 0], tiger_rock: [3.0, 0.98, 2.0, 0], swamp_stones: [1.34, 0.53, 1.77, 0], campfire: [1.22, 0.36, 1.22, 0], log_bench: [1.62, 0.48, 0.46, 0.05], log_stool: [0.52, 0.42, 0.52, 0],
};
const CAVE_BOXES = caveSolids.rockBoxes;

const data = { FENCE: [...FENCE, ...CAMP_FENCE], CORNERS, SIGN, SIGN_RESERVE, SIGN_TRAIL, CAVE, CAMP, ROCK, SWAMPS, SWAMP_OUTLINES, REEDS, DECO };
const text = `// 1.10.375 N2a-1 별마루섬's still pieces -- MADE by tools/isle2-props.cjs (do not edit: run it again). The fence round the island (${FENCE.length} pieces of
// 2.4 m, [x, z, yaw, kind of FENCE_KINDS]; the gate where the walk from 별마루다리 crosses it), its corner posts, 157's spring cave, the camp's
// fire / benches / stools, 우레's rock, the swamps (their outlines in the world: a bike inside is slowed) with reeds and 152c's pieces. CIRCLES
// what blocks of each kind in its own frame [x, z, r] (rotation.y = yaw, as forest156), BOXES the stand-ins drawn without the model [w, h, d, z].
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Isle2Props = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';
  const FENCE_KINDS = ${JSON.stringify(KINDS)}; const CAMP_KINDS = ${JSON.stringify(CAMP_KINDS)}; const SWAMP_KINDS = ${JSON.stringify(SWAMP_KINDS)}; const REED_KINDS = ${JSON.stringify(REED_KINDS)}; const DECO_KINDS = ${JSON.stringify(DECO_KINDS)};
  const DATA = ${JSON.stringify(data)};
  const CIRCLES = ${JSON.stringify(CIRCLES)};
  const BOXES = ${JSON.stringify(BOXES)}; const CAVE_BOXES = ${JSON.stringify(CAVE_BOXES)};
  const circlesAt = (kind, x, z, yaw = 0, s = 1) => { const c = Math.cos(yaw); const n = Math.sin(yaw); return (CIRCLES[kind] || []).map(([u, v, r]) => ({ x: x + (u * c + v * n) * s, z: z + (-u * n + v * c) * s, r: r * s })); };
  // every circle of every piece, in the world (the island's solids)
  let all = null;
  function solids() {
    if (all) return all; all = [];
    for (const [x, z, yaw, k] of DATA.FENCE) all.push(...circlesAt(FENCE_KINDS[k], x, z, yaw));
    for (const [x, z] of DATA.CORNERS) all.push(...circlesAt('fence_corner', x, z, 0));
    for (const [x, z, yaw, k] of DATA.CAMP) all.push(...circlesAt(CAMP_KINDS[k], x, z, yaw));
    if (DATA.ROCK) all.push(...circlesAt('tiger_rock', DATA.ROCK[0], DATA.ROCK[1], DATA.ROCK[2]));
    if (DATA.SIGN) all.push(...circlesAt('sign_tiger', DATA.SIGN[0], DATA.SIGN[1], DATA.SIGN[2]));
    if (DATA.SIGN_RESERVE) all.push(...circlesAt('sign_reserve', DATA.SIGN_RESERVE[0], DATA.SIGN_RESERVE[1], DATA.SIGN_RESERVE[2]));
    if (DATA.SIGN_TRAIL) all.push(...circlesAt('sign_trail', DATA.SIGN_TRAIL[0], DATA.SIGN_TRAIL[1], DATA.SIGN_TRAIL[2]));
    for (const [x, z, yaw, k] of DATA.DECO) if (DECO_KINDS[k] === 'swamp_stones') all.push(...circlesAt('swamp_stones', x, z, yaw));
    all.push(...circlesAt('spring_cave', DATA.CAVE.x, DATA.CAVE.z, DATA.CAVE.yaw));
    return all;
  }
  // in a swamp (a bike there slowed): inside any outline
  const inPoly = (x, z, p) => { let inside = false; for (let i = 0, j = p.length - 1; i < p.length; j = i, i += 1) { const [xi, zi] = p[i]; const [xj, zj] = p[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside; } return inside; };
  const inSwamp = (x, z) => DATA.SWAMPS.some(([sx, sz], i) => Math.hypot(x - sx, z - sz) < 7 && inPoly(x, z, DATA.SWAMP_OUTLINES[i]));
  return Object.freeze({ ...DATA, FENCE_KINDS, CAMP_KINDS, SWAMP_KINDS, REED_KINDS, DECO_KINDS, CIRCLES, BOXES, CAVE_BOXES, circlesAt, solids, inSwamp });
});
`;
if (process.argv.includes('--check')) { const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : ''; if (now !== text) { console.error('isle2-props.js is stale: run node tools/isle2-props.cjs'); process.exit(1); } console.log('isle2-props ok'); }
else { fs.writeFileSync(OUT, text); console.log(`fence ${FENCE.length} (gate at ${r2(gate.x)},${r2(gate.z)} walk ${r2(gate.walk)}), corners ${CORNERS.length}, swamps ${SWAMPS.length}, reeds ${REEDS.length}, deco ${DECO.length}, rock ${JSON.stringify(ROCK)}, camp ${CAMP.length}`); }
