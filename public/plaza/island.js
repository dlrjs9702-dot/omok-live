// v1.10.0 게임 아일랜드 지형: the walkable island around the central plaza. A natural coastline (bays, a cape, beaches,
// north cliffs, a harbour with a pier and a breakwater), water that starts at the plaza fountain and winds to the sea in
// four streams with small bridges where the walks cross them, curved walks to each area, hills, woods and a pond.
// Everything is generated once from fixed numbers (no assets, no randomness between visits) so every player walks the
// same island; the map board draws the same shapes. Later land reclamation changes coastR() and the map follows.
import * as THREE from '/vendor/three/three.module.js';

const TAU = Math.PI * 2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const bump = (d, w) => Math.exp(-((d / w) ** 2));
const smooth = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
const lerp = (a, b, t) => a + (b - a) * t;

// --- shape ---------------------------------------------------------------------------------------------------------
// Distance from the centre to the shore in direction th (x east, z south). About 200 across: ~40 s of straight walking.
export function coastR(th) {
  return 100 + 7 * Math.sin(3 * th + 0.6) + 5 * Math.sin(5 * th + 2) + 3 * Math.sin(8 * th + 0.3)
    - 17 * bump(wrap(th - Math.PI / 2), 0.2) // the harbour bay (south)
    + 12 * bump(wrap(th + Math.PI / 4), 0.13) // a cape (north-east)
    - 9 * bump(wrap(th - Math.PI), 0.22) // a west bay
    + 7 * bump(wrap(th + 2.4), 0.15);
}
const coastDist = (x, z) => coastR(Math.atan2(z, x)) - Math.hypot(x, z); // > 0 on land
const cliffAt = (x, z) => smooth(0.35, 0, Math.abs(wrap(Math.atan2(z, x) + Math.PI / 2 + 0.1)) - 0.55); // the north coast

export const PLAZA_R = 16; // the raised central plaza (flat top), ramps down to 22
const PLAZA_H = 1;
const HILLS = [[-60, -30, 7, 15], [-12, -82, 4, 13], [26, -76, 5, 12], [-24, 68, 3, 9], [72, 30, 3, 10], [-82, 16, 2.5, 9]];
const POND = { x: -50, z: 44, r: 8 };

// Areas (the map labels them; buildings and walks are placed around them).
export const AREAS = {
  plaza: { x: 0, z: 0, label: '중앙광장' },
  hall: { x: 0, z: -48, label: '게임관' },
  shops: { x: 50, z: -2, label: '상점가' },
  nature: { x: -46, z: 46, label: '자연 구역' },
  climb: { x: -60, z: -30, label: '등반 도전' },
  harbor: { x: 6, z: 92, label: '선착장' },
};

// Facility spots: position and the point the front faces. `kind` picks the model in plaza-scene.
export const SPOTS = {
  games: { x: 0, z: -58, face: [0, -40], kind: 'hall', wall: 0xffe3b3, roof: 0xf08a6b },
  records: { x: -20, z: -48, face: [-6, -42], kind: 'house', wall: 0xf3e2ff, roof: 0x9b7fd6 },
  missions: { x: 13, z: -46, face: [0, -42], kind: 'board', tint: 0x8fd18a },
  shop: { x: 42, z: -8, face: [42, 4], kind: 'shop', wall: 0xd9f0ff, roof: 0x6aa9e8 }, // 게임 스킨 상점
  avatar: { x: 55, z: -8, face: [55, 4], kind: 'shop', wall: 0xffe4ef, roof: 0xe87a9e }, // 캐릭터 스킨 상점
  board: { x: -10, z: -6, face: [0, 0], kind: 'board' },
  attendance: { x: 10, z: -6, face: [0, 0], kind: 'npc' },
  map: { x: -11, z: 6, face: [0, 2], kind: 'mapboard' },
  chat: { x: -18, z: 27, face: [-4, 22], kind: 'gazebo' },
  climb: { x: -59, z: -28, face: [-44, -19], kind: 'tower' }, // a tall tower on the hill, seen from far away
  admin: { x: 24, z: 15, face: [14, 6], kind: 'office', wall: 0xe4e7ec, roof: 0x7b8794 },
};
export const RESERVED_LOTS = [{ x: 49, z: 11, face: [49, 0] }]; // the shop street's next building (외형 변경 시설, later)
export const STATUE_SPOTS = [{ x: 12, z: 5 }, { x: 5.5, z: 12.5 }]; // 기부 동상 자리 (rules not decided yet: plinths only)
export const SPAWN = { x: 0, z: 8 };

// Streams: from the plaza edge toward the sea on the four diagonals, winding more the further they go.
function makeStream(a0, phase) {
  const pts = [];
  for (let r = PLAZA_R + 1; ; r += 2) {
    const a = a0 + 0.26 * smooth(PLAZA_R, 50, r) * Math.sin(r * 0.085 + phase);
    const x = Math.cos(a) * r; const z = Math.sin(a) * r;
    pts.push([x, z]);
    if (coastDist(x, z) < -5) break;
  }
  return pts;
}
const STREAMS = [makeStream(Math.PI / 4, 0.4), makeStream((3 * Math.PI) / 4, 2.1), makeStream((-3 * Math.PI) / 4, 4.0), makeStream(-Math.PI / 4, 5.3)];
const STREAM_HALF = 1.25;

// Walks (centre lines); the ring links the areas without crossing the plaza.
const ring = [];
for (let i = 0; i < 24; i += 1) { const a = (i / 24) * TAU; const r = 34 + 3 * Math.sin(3 * a + 1); ring.push([Math.cos(a) * r, Math.sin(a) * r]); }
ring.push(ring[0]);
const WALKS = [
  { w: 3.2, pts: [[0, -15], [3, -23], [-3, -32], [0, -41]] }, // to the hall
  { w: 3.2, pts: [[15, 1], [25, 4], [35, -1], [47, 2], [60, -1], [73, 3]] }, // the shop street
  { w: 3, pts: [[-15, -2], [-25, -5], [-35, -13], [-44, -19], [-52, -24]] }, // up to the climb
  { w: 3.2, pts: [[0, 15], [-3, 25], [4, 37], [0, 51], [4, 65], [2, 78], [5, 86]] }, // down to the harbour
  { w: 2.6, pts: [[-2, 32], [-14, 37], [-27, 41], [-36, 47], [-40, 56]] }, // into the nature area
  { w: 2.4, pts: ring },
  { w: 2.4, pts: [[-6, 31], [-12, 28], [-16, 30]] }, // to the gazebo
];

// --- geometry helpers -------------------------------------------------------------------------------------------------
function catmull(pts, step = 0.8) { // a smooth curve through the points, sampled about every `step`
  const out = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[Math.max(0, i - 1)]; const p1 = pts[i]; const p2 = pts[i + 1]; const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k += 1) {
      const t = k / n; const t2 = t * t; const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
const streamCurves = STREAMS.map((s) => catmull(s, 1));
const walkCurves = WALKS.map((w) => ({ w: w.w, pts: catmull(w.pts, 0.8) }));
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax; const dz = bz - az; const l = dx * dx + dz * dz;
  const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l)) : 0;
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
function lineDist(px, pz, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i]; const b = pts[i + 1];
    if (Math.abs(px - a[0]) > best + 3 && Math.abs(px - b[0]) > best + 3) continue;
    best = Math.min(best, segDist(px, pz, a[0], a[1], b[0], b[1]));
  }
  return best;
}
const streamDist = (x, z) => { let d = Infinity; for (const s of streamCurves) d = Math.min(d, lineDist(x, z, s)); return d; };
const walkDist = (x, z) => { let d = Infinity; for (const w of walkCurves) d = Math.min(d, lineDist(x, z, w.pts) - w.w / 2); return d; };

// Ground before water is cut in: plateau, hills, north cliffs, beaches; flat pads under buildings and squares.
function rawLand(x, z) {
  const r = Math.hypot(x, z);
  let h = 0;
  for (const [hx, hz, hh, hw] of HILLS) h += hh * bump(Math.hypot(x - hx, z - hz), hw);
  h += 0.35 * Math.sin(x * 0.08) * Math.cos(z * 0.07); // a gentle roll so the grass is never flat
  h = lerp(PLAZA_H, h, smooth(PLAZA_R, PLAZA_R + 6, r)); // the plaza sits a little higher
  const cd = coastDist(x, z); const cliff = cliffAt(x, z);
  h += cliff * 4.2 * smooth(30, 6, cd) * smooth(-1, 1.5, cd);
  const shore = lerp(7, 1.4, cliff);
  if (cd < shore) h = lerp(-0.95, h, Math.max(0, cd) / shore);
  if (cd < 0) h = -0.95 + cd * 0.45;
  return h;
}
const PADS = [[0, -44, 9.5], ...RESERVED_LOTS.map((l) => [l.x, l.z, 5]), ...Object.values(SPOTS).filter((s) => Math.hypot(s.x, s.z) > PLAZA_R + 4).map((s) => [s.x, s.z, s.kind === 'hall' ? 11 : 4.5])]
  .map(([x, z, r]) => ({ x, z, r, h: rawLand(x, z) }));
function land(x, z) {
  let h = rawLand(x, z);
  for (const p of PADS) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r + 5) h = lerp(p.h, h, smooth(p.r, p.r + 5, d)); }
  return h;
}
function ground(x, z) {
  let h = land(x, z);
  const sd = streamDist(x, z);
  if (sd < STREAM_HALF + 1.4) h = lerp(h - 1, h, smooth(STREAM_HALF - 0.3, STREAM_HALF + 1.4, sd));
  const pd = Math.hypot(x - POND.x, z - POND.z);
  if (pd < POND.r + 2) h = lerp(h - 1, h, smooth(POND.r - 0.5, POND.r + 2, pd));
  return h;
}

// Bridges where a walk crosses a stream (found from the curves, so moving a walk moves its bridge).
const bridges = [];
for (const walk of walkCurves) {
  let run = null;
  walk.pts.forEach(([x, z], i) => {
    const d = streamDist(x, z);
    if (d < STREAM_HALF + 0.8) { if (!run || d < run.d) run = { d, i, x, z, w: walk.w }; }
    else if (run) { addBridge(run, walk.pts); run = null; }
  });
  if (run) addBridge(run, walk.pts);
}
function addBridge(run, pts) {
  if (bridges.some((b) => Math.hypot(b.x - run.x, b.z - run.z) < 4)) return;
  const a = pts[Math.max(0, run.i - 2)]; const b = pts[Math.min(pts.length - 1, run.i + 2)];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / len; const uz = (b[1] - a[1]) / len;
  const half = 3.3; const ends = (land(run.x - ux * half, run.z - uz * half) + land(run.x + ux * half, run.z + uz * half)) / 2;
  bridges.push({ x: run.x, z: run.z, ux, uz, half, w: Math.max(2.6, run.w), deck: Math.max(ends, ground(run.x, run.z) + 0.9) + 0.1 });
}
function onBridge(x, z) {
  for (const b of bridges) {
    const dx = x - b.x; const dz = z - b.z; const u = dx * b.ux + dz * b.uz; const v = -dx * b.uz + dz * b.ux;
    if (Math.abs(u) <= b.half && Math.abs(v) <= b.w / 2) return { b, u };
  }
  return null;
}
const deckAt = (hit) => hit.b.deck + 0.35 * (1 - (hit.u / hit.b.half) ** 2);

// Harbour: a pier straight out into the bay and a stone breakwater with a lighthouse.
const bayR = coastR(Math.PI / 2);
const PIER = { x: 5, z: bayR - 6, ux: 0, uz: 1, half: 13, w: 3, deck: 0.45 };
PIER.x += PIER.ux * PIER.half; PIER.z += PIER.uz * PIER.half;
const bwA = Math.PI / 2 - 0.42; const bwBase = coastR(bwA) - 4;
const BREAKWATER = { x: Math.cos(bwA) * bwBase, z: Math.sin(bwA) * bwBase, ux: Math.cos(bwA + 0.35), uz: Math.sin(bwA + 0.35), half: 12, w: 3.4, deck: 0.7 };
BREAKWATER.x += BREAKWATER.ux * BREAKWATER.half; BREAKWATER.z += BREAKWATER.uz * BREAKWATER.half;
const inRect = (r, x, z, grow = 0) => { const dx = x - r.x; const dz = z - r.z; return Math.abs(dx * r.ux + dz * r.uz) <= r.half + grow && Math.abs(-dx * r.uz + dz * r.ux) <= r.w / 2 + grow; };

// --- what the characters use ------------------------------------------------------------------------------------------
export function heightAt(x, z) {
  const hit = onBridge(x, z);
  if (hit) return deckAt(hit);
  if (inRect(PIER, x, z)) return PIER.deck;
  if (inRect(BREAKWATER, x, z)) return BREAKWATER.deck;
  return Math.max(ground(x, z), -0.6);
}
// Where a character may stand: land above the waterline, not in a stream or the pond (bridges, the pier and the
// breakwater are fine), not over a cliff edge.
export function walkable(x, z) {
  if (inRect(PIER, x, z) || inRect(BREAKWATER, x, z) || onBridge(x, z)) return true;
  const cd = coastDist(x, z);
  if (cd < 2.2 + cliffAt(x, z) * 1.2) return false;
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.2) return false;
  return streamDist(x, z) > STREAM_HALF + 0.25;
}
export const ISLAND_RADIUS = 130; // the server's outer bound for positions

// --- building the scene -----------------------------------------------------------------------------------------------
export function buildIsland(scene, { mat, mesh, solids }) {
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };

  // Terrain: one mesh with vertex colours (grass, sand by the sea, rock on the cliffs).
  const SIZE = 250; const SEG = 125;
  const geo = keep(new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG)); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position; const colors = new Float32Array(pos.count * 3);
  const grass = new THREE.Color(0x9fd67f); const grass2 = new THREE.Color(0x8cc96c); const sand = new THREE.Color(0xf1dfae);
  const rock = new THREE.Color(0xb7ad9e); const wet = new THREE.Color(0xd8c48f); const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i); const z = pos.getZ(i); const h = ground(x, z); pos.setY(i, h);
    const cd = coastDist(x, z); const cliff = cliffAt(x, z);
    c.copy(grass).lerp(grass2, 0.5 + 0.5 * Math.sin(x * 0.21 + z * 0.17) * Math.cos(z * 0.13));
    if (cd < 8 && cliff < 0.5) c.lerp(cd < 2.5 ? wet : sand, smooth(8, 4, cd));
    if (cliff > 0.4 && cd < 4) c.lerp(rock, smooth(4, 1, cd));
    if (h < -0.4) c.copy(wet);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })));
  terrain.receiveShadow = true; scene.add(terrain);

  // Sea and the pond and streams (flat water a little under the banks).
  const water = mat(0x7cc8e6, { roughness: 0.25, metalness: 0.05 });
  const sea = new THREE.Mesh(keep(new THREE.PlaneGeometry(900, 900)), mat(0x6cbfe2, { roughness: 0.3 }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -0.6; sea.receiveShadow = true; scene.add(sea);
  const pond = new THREE.Mesh(keep(new THREE.CircleGeometry(POND.r + 0.6, 40)), water);
  pond.rotation.x = -Math.PI / 2; pond.position.set(POND.x, land(POND.x, POND.z) - 0.45, POND.z); scene.add(pond);
  const ribbon = (pts, width, yOf, material, lift = 0) => { // a flat strip along a line, following the ground
    const v = []; const idx = [];
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[Math.max(0, i - 1)]; const b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0]; const dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1;
      const nx = -dz / l; const nz = dx / l; const [x, z] = pts[i]; const y = yOf(x, z) + lift;
      v.push(x + nx * width / 2, y, z + nz * width / 2, x - nx * width / 2, y, z - nz * width / 2);
      if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } // counter-clockwise from above
    }
    const g = keep(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, material); m.receiveShadow = true; scene.add(m); return m;
  };
  for (const s of streamCurves) ribbon(s.filter(([x, z]) => coastDist(x, z) > -1.5), STREAM_HALF * 2 + 0.6, (x, z) => Math.max(-0.58, land(x, z) - 0.45), water); // ends where it meets the sea
  // In the plaza the fountain's water runs out along shallow channels toward each stream.
  for (const s of STREAMS) {
    const [ex, ez] = s[0]; const a = Math.atan2(ez, ex);
    ribbon([[Math.cos(a) * 3.2, Math.sin(a) * 3.2], [Math.cos(a) * 10, Math.sin(a) * 10], [ex, ez]], 0.7, (x, z) => land(x, z), mat(0x86d0f0, { roughness: 0.2 }), 0.05);
  }

  // Walks: sandy paths over the grass (not drawn on bridges), the paved plaza and the paved square before the hall.
  const pathMat = mat(0xefdcb4); const paveMat = mat(0xf3e6c8);
  for (const w of walkCurves) {
    let run = [];
    const flush = () => { if (run.length > 1) ribbon(run, w.w, (x, z) => ground(x, z), pathMat, 0.06); run = []; };
    for (const p of w.pts) { if (onBridge(p[0], p[1]) || streamDist(p[0], p[1]) < STREAM_HALF + 0.4) flush(); else run.push(p); }
    flush();
  }
  const disc = (x, z, r, material, lift = 0.04, seg = 48) => { const m = new THREE.Mesh(keep(new THREE.CircleGeometry(r, seg)), material); m.rotation.x = -Math.PI / 2; m.position.set(x, land(x, z) + lift, z); m.receiveShadow = true; scene.add(m); return m; };
  disc(0, 0, PLAZA_R, paveMat, 0.03, 64);
  const rim = new THREE.Mesh(keep(new THREE.RingGeometry(PLAZA_R - 0.4, PLAZA_R, 64)), mat(0xe2cfa6)); rim.rotation.x = -Math.PI / 2; rim.position.y = PLAZA_H + 0.045; scene.add(rim);
  disc(0, -44, 9, paveMat, 0.05);
  const band = (x, z, r0, r1, color, lift) => { const m = new THREE.Mesh(keep(new THREE.RingGeometry(r0, r1, 64)), mat(color)); m.rotation.x = -Math.PI / 2; m.position.set(x, land(x, z) + lift, z); m.receiveShadow = true; scene.add(m); };
  band(0, 0, 6.6, 7.1, 0xe6d3ab, 0.04); band(0, 0, 11.3, 11.7, 0xe6d3ab, 0.04); band(0, 0, 3.6, 4.1, 0xd9c49a, 0.04); // paving rings
  band(0, -44, 3, 3.5, 0xd9c49a, 0.06); band(0, -44, 6.8, 7.2, 0xe6d3ab, 0.06);
  disc(0, -44, 1.6, mat(0x6aa9e8), 0.065, 32); // an inlaid emblem in front of the hall

  // Bridges: an arched wooden deck with rails.
  const plank = mat(0xc58b5a); const post = mat(0x8a5a3b);
  for (const b of bridges) {
    const g = new THREE.Group(); g.position.set(b.x, 0, b.z); g.rotation.y = Math.atan2(b.ux, b.uz); scene.add(g);
    for (let k = -5; k <= 5; k += 1) {
      const u = (k / 5) * b.half; const y = deckAt({ b, u }) - 0.08;
      const p = mesh(keep(new THREE.BoxGeometry(b.w, 0.16, (b.half * 2) / 11 + 0.05)), plank, 0, y, u, g); p.rotation.x = -Math.atan(-0.7 * u / (b.half * b.half));
    }
    for (const side of [-1, 1]) for (let k = -2; k <= 2; k += 1) {
      const u = (k / 2) * (b.half - 0.2); mesh(keep(new THREE.CylinderGeometry(0.08, 0.09, 0.9, 8)), post, side * (b.w / 2 - 0.1), deckAt({ b, u }) + 0.4, u, g);
    }
    for (const side of [-1, 1]) { const rail = mesh(keep(new THREE.BoxGeometry(0.1, 0.1, b.half * 2)), post, side * (b.w / 2 - 0.1), b.deck + 0.9, 0, g); rail.castShadow = false; }
  }

  // Harbour: pier on posts, a few boats, the breakwater and its lighthouse.
  const pier = new THREE.Group(); pier.position.set(PIER.x, 0, PIER.z); pier.rotation.y = Math.atan2(PIER.ux, PIER.uz); scene.add(pier);
  mesh(keep(new THREE.BoxGeometry(PIER.w, 0.2, PIER.half * 2)), plank, 0, PIER.deck - 0.1, 0, pier);
  for (let u = -PIER.half + 1; u <= PIER.half; u += 3) for (const s of [-1, 1]) mesh(keep(new THREE.CylinderGeometry(0.14, 0.14, 2.2, 8)), post, s * (PIER.w / 2 - 0.15), -0.6, u, pier);
  const bw = new THREE.Group(); bw.position.set(BREAKWATER.x, 0, BREAKWATER.z); bw.rotation.y = Math.atan2(BREAKWATER.ux, BREAKWATER.uz); scene.add(bw);
  mesh(keep(new THREE.BoxGeometry(BREAKWATER.w, 1.6, BREAKWATER.half * 2)), mat(0xc9c2b6), 0, BREAKWATER.deck - 0.8, 0, bw);
  for (let u = -BREAKWATER.half; u <= BREAKWATER.half; u += 2.2) for (const s of [-1, 1]) { const st = mesh(keep(new THREE.DodecahedronGeometry(0.7)), mat(0xb3ab9d), s * (BREAKWATER.w / 2 + 0.3), -0.3, u + s * 0.6, bw); st.rotation.set(u, s, u * 0.5); }
  const lh = new THREE.Group(); lh.position.set(0, BREAKWATER.deck, BREAKWATER.half - 1.3); bw.add(lh);
  for (let k = 0; k < 4; k += 1) mesh(keep(new THREE.CylinderGeometry(0.95 - k * 0.12, 1.05 - k * 0.12, 1.5, 18)), mat(k % 2 ? 0xe8443c : 0xffffff), 0, 0.75 + k * 1.5, 0, lh);
  mesh(keep(new THREE.CylinderGeometry(0.75, 0.75, 0.9, 14)), mat(0xfff3c2, { emissive: 0xffe08a, emissiveIntensity: 0.7 }), 0, 6.45, 0, lh);
  mesh(keep(new THREE.ConeGeometry(0.95, 0.9, 14)), mat(0xe8443c), 0, 7.35, 0, lh);
  solids.push({ x: BREAKWATER.x + BREAKWATER.ux * (BREAKWATER.half - 1.3), z: BREAKWATER.z + BREAKWATER.uz * (BREAKWATER.half - 1.3), r: 1.2 });
  const boats = [];
  for (const [bx, bz, col] of [[-6, bayR + 6, 0xff8a65], [14, bayR + 12, 0x5fb0ff], [-12, bayR + 15, 0xffd23f]]) {
    const boat = new THREE.Group(); boat.position.set(bx, -0.55, bz); boat.rotation.y = bx * 0.2; scene.add(boat);
    const hull = mesh(keep(new THREE.CylinderGeometry(0.9, 0.55, 0.7, 12, 1, false, 0, Math.PI)), mat(col), 0, 0.2, 0, boat); hull.rotation.set(Math.PI / 2, 0, Math.PI / 2); hull.scale.set(1, 2.6, 1);
    mesh(keep(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6)), post, 0, 1.3, 0.3, boat);
    const sail = mesh(keep(new THREE.PlaneGeometry(1, 1.4)), mat(0xfffaf0, { side: THREE.DoubleSide }), 0.02, 1.5, -0.2, boat); sail.rotation.y = Math.PI / 2;
    boats.push(boat);
  }

  // Instanced nature: trees, flowers, rocks, fence posts. Placement is fixed (seeded) and keeps walks, water, the
  // plaza and every building clear.
  let seed = 0x1a2b3c;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const clearOf = (x, z, walkGap) => {
    if (!walkable(x, z) || coastDist(x, z) < 6) return false;
    if (Math.hypot(x, z) < PLAZA_R + 7) return false;
    if (walkDist(x, z) < walkGap || streamDist(x, z) < STREAM_HALF + 2) return false;
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 2.5 || Math.hypot(x, z + 44) < 11) return false;
    for (const s of Object.values(SPOTS)) if (Math.hypot(x - s.x, z - s.z) < (s.kind === 'hall' ? 13 : 7)) return false;
    if (x > 30 && x < 80 && z > -16 && z < 17) return false; // the shop street stays open
    return true;
  };
  const trees = [];
  const woods = [[-48, 44, 22, 46], [30, -62, 20, 30], [-72, 6, 16, 22], [70, 40, 16, 20], [-30, -66, 16, 20]];
  for (const [wx, wz, wr, n] of woods) for (let k = 0, tries = 0; k < n && tries < n * 12; tries += 1) {
    const a = rnd() * TAU; const r = Math.sqrt(rnd()) * wr; const x = wx + Math.cos(a) * r; const z = wz + Math.sin(a) * r;
    if (clearOf(x, z, 3) && trees.every((t) => Math.hypot(t.x - x, t.z - z) > 3.2)) { trees.push({ x, z, s: 0.8 + rnd() * 0.55 }); k += 1; }
  }
  for (let tries = 0; trees.length < 260 && tries < 6000; tries += 1) { // and scattered everywhere else
    const a = rnd() * TAU; const r = 24 + rnd() * 80; const x = Math.cos(a) * r; const z = Math.sin(a) * r;
    if (clearOf(x, z, 4) && trees.every((t) => Math.hypot(t.x - x, t.z - z) > 6)) trees.push({ x, z, s: 0.75 + rnd() * 0.5 });
  }
  const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const v3 = new THREE.Vector3(); const sc = new THREE.Vector3();
  // One instanced mesh per 40-unit square of the island, so whatever is off screen (or outside the shadow area around
  // the player) is skipped as a whole instead of drawing every tree on the island every frame.
  const instanced = (geometry, material, list, place, { shadow = true } = {}) => {
    keep(geometry);
    const cells = new Map();
    for (const item of list) { const key = `${Math.floor(item.x / 40)},${Math.floor(item.z / 40)}`; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(item); }
    for (const items of cells.values()) {
      const im = new THREE.InstancedMesh(geometry, material, items.length);
      items.forEach((item, i) => { place(item, i); im.setMatrixAt(i, m4); });
      im.computeBoundingSphere(); im.castShadow = shadow; im.receiveShadow = true; scene.add(im);
    }
  };
  const setM = (x, y, z, s, sy = s, ry = 0) => { q.setFromAxisAngle(v3.set(0, 1, 0), ry); m4.compose(v3.set(x, y, z), q, sc.set(s, sy, s)); };
  instanced(new THREE.CylinderGeometry(0.22, 0.3, 1.4, 8), mat(0xa9774f), trees, (t) => setM(t.x, ground(t.x, t.z) + 0.7 * t.s, t.z, t.s));
  instanced(new THREE.SphereGeometry(1.25, 9, 7), mat(0x76c267), trees, (t) => setM(t.x, ground(t.x, t.z) + 2.1 * t.s, t.z, t.s));
  instanced(new THREE.SphereGeometry(0.85, 8, 6), mat(0x86cf74), trees, (t) => setM(t.x + 0.5 * t.s, ground(t.x, t.z) + 2.7 * t.s, t.z + 0.3 * t.s, t.s));
  for (const t of trees) solids.push({ x: t.x, z: t.z, r: 0.75 * t.s });

  const flowers = []; const flowerColors = [0xff9ec7, 0xffe27a, 0xffffff, 0xc4a5ff, 0xff8f8f];
  for (const [fx, fz, fr, n] of [[-34, 58, 9, 120], [-58, 30, 6, 60], [20, 40, 6, 50], [-22, -30, 5, 40], [58, 22, 5, 40], [-6, 44, 4, 30]]) {
    for (let k = 0; k < n; k += 1) { const a = rnd() * TAU; const r = Math.sqrt(rnd()) * fr; const x = fx + Math.cos(a) * r; const z = fz + Math.sin(a) * r; if (walkable(x, z) && walkDist(x, z) > 0.6) flowers.push({ x, z, c: k % 5 }); }
  }
  flowerColors.forEach((col, ci) => {
    const list = flowers.filter((f) => f.c === ci);
    instanced(new THREE.SphereGeometry(0.13, 5, 3), mat(col), list, (f) => setM(f.x, ground(f.x, f.z) + 0.16, f.z, 1), { shadow: false });
  });
  // Bushes along the walks and around the woods, and grass tufts everywhere, so open ground never looks bare.
  const bushes = [];
  for (const w of walkCurves) for (let i = 3; i < w.pts.length; i += 5) {
    if (rnd() < 0.45) continue;
    const [x, z] = w.pts[i]; const [x2, z2] = w.pts[Math.max(0, i - 1)]; const l = Math.hypot(x - x2, z - z2) || 1;
    const side = rnd() < 0.5 ? -1 : 1; const off = w.w / 2 + 1.3 + rnd() * 1.2;
    const bx = x + side * (-(z - z2) / l) * off; const bz = z + side * ((x - x2) / l) * off;
    if (clearOf(bx, bz, 0.9) && Math.hypot(bx, bz) > PLAZA_R + 3) bushes.push({ x: bx, z: bz, s: 0.6 + rnd() * 0.5 });
  }
  for (let tries = 0; bushes.length < 420 && tries < 5000; tries += 1) {
    const a = rnd() * TAU; const r = 26 + rnd() * 76; const x = Math.cos(a) * r; const z = Math.sin(a) * r;
    if (clearOf(x, z, 1.5)) bushes.push({ x, z, s: 0.55 + rnd() * 0.6 });
  }
  instanced(new THREE.SphereGeometry(0.9, 7, 5), mat(0x6fbf5e), bushes, (b) => setM(b.x, ground(b.x, b.z) + 0.35 * b.s, b.z, b.s, b.s * 0.75));
  instanced(new THREE.SphereGeometry(0.6, 6, 4), mat(0x83cf6c), bushes, (b) => setM(b.x + 0.45 * b.s, ground(b.x, b.z) + 0.5 * b.s, b.z - 0.2 * b.s, b.s, b.s * 0.8));
  for (const b of bushes) solids.push({ x: b.x, z: b.z, r: 0.75 * b.s });
  const tufts = [];
  for (let tries = 0; tufts.length < 1400 && tries < 9000; tries += 1) {
    const a = rnd() * TAU; const r = PLAZA_R + 5 + rnd() * 85; const x = Math.cos(a) * r; const z = Math.sin(a) * r;
    if (walkable(x, z) && coastDist(x, z) > 7 && walkDist(x, z) > 0.4 && PADS.every((p) => Math.hypot(x - p.x, z - p.z) > p.r)) tufts.push({ x, z, s: 0.6 + rnd() * 0.7, r: rnd() * 6 });
  }
  instanced(new THREE.ConeGeometry(0.16, 0.5, 4), mat(0x7cbf5c), tufts, (t) => setM(t.x, ground(t.x, t.z) + 0.2 * t.s, t.z, t.s, t.s, t.r), { shadow: false });

  const rocks = [];
  for (let tries = 0; rocks.length < 90 && tries < 4000; tries += 1) {
    const a = rnd() * TAU; const x = Math.cos(a) * (coastR(a) - 2 - rnd() * 5); const z = Math.sin(a) * (coastR(a) - 2 - rnd() * 5);
    if (Math.abs(wrap(a - Math.PI / 2)) < 0.5) continue; // keep the harbour beach clear
    rocks.push({ x, z, s: 0.5 + rnd() * (cliffAt(x, z) > 0.4 ? 1.6 : 0.8), r: rnd() * 6 });
  }
  instanced(new THREE.DodecahedronGeometry(1), mat(0xb8b0a4), rocks, (r) => setM(r.x, ground(r.x, r.z) + 0.1, r.z, r.s, r.s * 0.7, r.r));
  const posts = []; // a low fence along the top of the north cliffs
  for (let a = -Math.PI; a < Math.PI; a += 0.035) {
    const R = coastR(a) - 3.6; const x = Math.cos(a) * R; const z = Math.sin(a) * R;
    if (cliffAt(x, z) > 0.55) posts.push({ x, z });
  }
  instanced(new THREE.CylinderGeometry(0.08, 0.1, 1, 6), post, posts, (p) => setM(p.x, ground(p.x, p.z) + 0.5, p.z, 1));

  // Lamps along the main walks, benches beside them.
  const lampSpots = [];
  for (const w of walkCurves.slice(0, 5)) for (let i = 8; i < w.pts.length - 4; i += 14) {
    const [x, z] = w.pts[i]; const [x2, z2] = w.pts[i + 1]; const l = Math.hypot(x2 - x, z2 - z) || 1;
    const lx = x - ((z2 - z) / l) * (w.w / 2 + 0.8); const lz = z + ((x2 - x) / l) * (w.w / 2 + 0.8);
    if (walkable(lx, lz) && streamDist(lx, lz) > STREAM_HALF + 1.5) lampSpots.push({ x: lx, z: lz });
  }
  instanced(new THREE.CylinderGeometry(0.08, 0.11, 2.6, 8), mat(0x4d6b5c), lampSpots, (p) => setM(p.x, ground(p.x, p.z) + 1.3, p.z, 1));
  instanced(new THREE.SphereGeometry(0.24, 12, 9), mat(0xfff3c2, { emissive: 0xffe08a, emissiveIntensity: 0.6 }), lampSpots, (p) => setM(p.x, ground(p.x, p.z) + 2.72, p.z, 1), { shadow: false });
  for (const p of lampSpots) solids.push({ x: p.x, z: p.z, r: 0.3 });

  // The map board's picture: the island as it is (coast, water, walks, areas) and where I am.
  // The island's shapes (sea, shore, grass, walks, water, plaza, harbour, bridges) at a scale `s` around a centre.
  function drawGround(ctx, w, h, X, Z, s) {
    ctx.fillStyle = '#7fcbe9'; ctx.fillRect(-2 * w, -2 * h, 5 * w, 5 * h); // the sea (wide enough for a turned minimap)
    const shore = (grow) => { ctx.beginPath(); for (let i = 0; i <= 180; i += 1) { const a = (i / 180) * TAU; const R = coastR(a) + grow; const px = X(Math.cos(a) * R); const pz = Z(Math.sin(a) * R); if (i) ctx.lineTo(px, pz); else ctx.moveTo(px, pz); } ctx.closePath(); };
    shore(0); ctx.fillStyle = '#f1dfae'; ctx.fill();
    shore(-5); ctx.fillStyle = '#9fd67f'; ctx.fill();
    const line = (pts, width, color) => { ctx.beginPath(); pts.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z)))); ctx.strokeStyle = color; ctx.lineWidth = width * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); };
    for (const wk of walkCurves) line(wk.pts, wk.w + 1, '#e8d2a2');
    for (const st of streamCurves) line(st, STREAM_HALF * 2 + 1, '#5fb4e0');
    ctx.beginPath(); ctx.arc(X(POND.x), Z(POND.z), POND.r * s, 0, TAU); ctx.fillStyle = '#5fb4e0'; ctx.fill();
    ctx.beginPath(); ctx.arc(X(0), Z(0), PLAZA_R * s, 0, TAU); ctx.fillStyle = '#f3e6c8'; ctx.fill(); ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = 2; ctx.stroke();
    line([[PIER.x - PIER.ux * PIER.half, PIER.z - PIER.uz * PIER.half], [PIER.x + PIER.ux * PIER.half, PIER.z + PIER.uz * PIER.half]], PIER.w, '#b07a4f');
    line([[BREAKWATER.x - BREAKWATER.ux * BREAKWATER.half, BREAKWATER.z - BREAKWATER.uz * BREAKWATER.half], [BREAKWATER.x + BREAKWATER.ux * BREAKWATER.half, BREAKWATER.z + BREAKWATER.uz * BREAKWATER.half]], BREAKWATER.w, '#a39b8e');
    for (const b of bridges) line([[b.x - b.ux * b.half, b.z - b.uz * b.half], [b.x + b.ux * b.half, b.z + b.uz * b.half]], b.w, '#b07a4f');
  }
  function drawMap(ctx, w, h, me) {
    const s = Math.min(w, h) / 236; const X = (x) => w / 2 + x * s; const Z = (z) => h / 2 + z * s;
    drawGround(ctx, w, h, X, Z, s);
    ctx.font = `800 ${Math.round(w / 28)}px Pretendard, "Malgun Gothic", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const area of Object.values(AREAS)) {
      ctx.beginPath(); ctx.arc(X(area.x), Z(area.z), w / 70, 0, TAU); ctx.fillStyle = '#5b4632'; ctx.fill();
      ctx.lineWidth = w / 120; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.strokeText(area.label, X(area.x), Z(area.z) - w / 26); ctx.fillStyle = '#3d2f22'; ctx.fillText(area.label, X(area.x), Z(area.z) - w / 26);
    }
    if (me) {
      ctx.beginPath(); ctx.arc(X(me.x), Z(me.z), w / 46, 0, TAU); ctx.fillStyle = '#e8443c'; ctx.fill(); ctx.lineWidth = w / 160; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.font = `800 ${Math.round(w / 34)}px Pretendard, "Malgun Gothic", system-ui, sans-serif`; ctx.lineWidth = w / 110; ctx.strokeStyle = '#fff';
      ctx.strokeText('현재 위치', X(me.x), Z(me.z) + w / 22); ctx.fillStyle = '#b3261e'; ctx.fillText('현재 위치', X(me.x), Z(me.z) + w / 22);
    }
  }

  // v1.10.2 미니맵: the ground around me (about 80 m across), turned with the camera so the way I look is always up,
  // the places nearby with upright short names, my position, and a small 「N」 on the rim pointing north. `markers`
  // ({ x, z }) are drawn as 「!」 -- kept for nearby events later.
  const MINI_RANGE = 40;
  function drawMinimap(ctx, size, me, viewYaw, places = [], markers = []) {
    const s = size / (MINI_RANGE * 2); const c = size / 2;
    const fx = -Math.sin(viewYaw); const fz = -Math.cos(viewYaw); // where the camera looks, on the ground
    const turn = -Math.PI / 2 - Math.atan2(fz, fx); // rotate the map so that direction points up
    const cos = Math.cos(turn); const sin = Math.sin(turn);
    const at = (x, z) => { const dx = (x - me.x) * s; const dz = (z - me.z) * s; return [c + dx * cos - dz * sin, c + dx * sin + dz * cos]; };
    ctx.save(); ctx.clearRect(0, 0, size, size);
    ctx.beginPath(); ctx.arc(c, c, c - 2, 0, TAU); ctx.clip();
    ctx.save(); ctx.translate(c, c); ctx.rotate(turn);
    drawGround(ctx, size, size, (x) => (x - me.x) * s, (z) => (z - me.z) * s, s);
    ctx.restore();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.round(size / 15)}px Pretendard, "Malgun Gothic", system-ui, sans-serif`;
    const labels = [];
    for (const p of places) {
      if (Math.hypot(p.x - me.x, p.z - me.z) > MINI_RANGE * 1.1) continue;
      const [px, pz] = at(p.x, p.z);
      ctx.beginPath(); ctx.arc(px, pz, size / 45, 0, TAU); ctx.fillStyle = '#5b4632'; ctx.fill();
      if (labels.some(([lx, lz]) => Math.abs(lx - px) < size / 3 && Math.abs(lz - pz) < size / 12)) continue; // the dot only when names would overlap
      labels.push([px, pz]);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.strokeText(p.name, px, pz - size / 18); ctx.fillStyle = '#3d2f22'; ctx.fillText(p.name, px, pz - size / 18);
    }
    ctx.font = `900 ${Math.round(size / 9)}px Pretendard, "Malgun Gothic", system-ui, sans-serif`;
    for (const m of markers) { // future events: a red 「!」 at the place
      const [mx, mz] = at(m.x, m.z);
      ctx.beginPath(); ctx.arc(mx, mz, size / 18, 0, TAU); ctx.fillStyle = '#e8443c'; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText('!', mx, mz + 1);
    }
    // me: the view always points up
    ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, size * 0.3, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(c, c - size * 0.075); ctx.lineTo(c - size * 0.045, c + size * 0.04); ctx.lineTo(c + size * 0.045, c + size * 0.04); ctx.closePath();
    ctx.fillStyle = '#e8443c'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore();
    ctx.beginPath(); ctx.arc(c, c, c - 2, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,250,240,.95)'; ctx.stroke();
    const north = -Math.PI / 2 + turn; const nx = c + Math.cos(north) * (c - 13); const nz = c + Math.sin(north) * (c - 13); // north on the rim
    ctx.beginPath(); ctx.arc(nx, nz, 10, 0, TAU); ctx.fillStyle = 'rgba(255,250,240,.95)'; ctx.fill();
    ctx.font = `900 ${Math.round(size / 13)}px Pretendard, "Malgun Gothic", system-ui, sans-serif`; ctx.fillStyle = '#b3261e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', nx, nz + 1);
    return turn;
  }

  function step(clock) { boats.forEach((b, i) => { b.position.y = -0.55 + Math.sin(clock * 1.3 + i) * 0.06; b.rotation.z = Math.sin(clock * 0.9 + i * 2) * 0.05; }); }
  function dispose() { disposables.forEach((d) => d.dispose?.()); }
  return { drawMap, drawMinimap, step, dispose, bridges: bridges.map(({ x, z, ux, uz, half, w }) => ({ x, z, ux, uz, half, w })), pier: { x: PIER.x, z: PIER.z, half: PIER.half } };
}
