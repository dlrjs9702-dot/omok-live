// v1.10.0 게임 아일랜드 지형: the walkable island around the central plaza. A natural coastline (bays, a cape, beaches,
// north cliffs, a harbour with a pier and a breakwater), water that starts at the plaza fountain and winds to the sea in
// four streams with small bridges where the walks cross them, curved walks to each area, hills, woods and a pond.
// Everything is generated once from fixed numbers (no assets, no randomness between visits) so every player walks the
// same island; the map board draws the same shapes. Later land reclamation changes coastR() and the map follows.
import * as THREE from '/vendor/three/three.module.js';

// v1.10.7: the island's shape lives in island-terrain.js (loaded before the app; the server uses the same file).
const T = globalThis.IslandTerrain;
export const { coastR, PLAZA_R, AREAS, SPOTS, COTTAGES, RESERVED_LOTS, STATUE_SPOTS, SPAWN, walkable, ISLAND_RADIUS, nature } = T;
const { RIVER_WIDE, riverExtra, BUILDINGS, TAU, wrap, smooth, lerp, coastDist, cliffAt, PLAZA_H, POND, STREAMS, STREAM_HALF, streamCurves, walkCurves, streamDist, walkDist, PADS, land, ground, bridges, onBridge, deckAt, bayR, PIER, BREAKWATER } = T;

// v1.10.73 길 3단계: 마을 길 (the hall, the shop street, and the climb and harbour walks within TOWN_R of the plaza),
// 산책로 (the ring, those two walks beyond the town), 오솔길 (the nature area, the gazebo)
const TOWN_R = 32;
const tierAt = (wi, x, z) => walkCurves[wi].tier || (wi <= 1 ? 'town' : wi <= 3 ? (Math.hypot(x, z) < TOWN_R ? 'town' : 'walk') : wi === 5 ? 'walk' : 'trail');
const plazaDist = T.inPlaza ? (x, z) => { const P = T.dalmaru.PLAZA; return Math.max(Math.abs(x - P.x) - P.hw, P.d0 - z, z - P.d1); } : (x, z) => Math.hypot(x, z) - PLAZA_R; // (달마루섬: 대청마당 is a rectangle)
const offPath = (x, z) => plazaDist(x, z) < 0.6 || (!T.inPlaza && Math.hypot(x, z + 44) < 9.4) || onBridge(x, z) || streamDist(x, z) < STREAM_HALF + 0.5 || T.inTownhall(x, z, 0.5);
// (문제 기록 2회차 2 「자전거가 땅을 파고 들어가」: a 마을 길 is paved with 4 cm slabs laid 1 cm over the ground -- one stands on
// them, the bike's wheels too, not 5 cm into them: the height everyone stands at (this module's heightAt) has the paving on)
export const PAVE_TOP = 0.05; const PAVE_LIFT = 0.01;
const paveSegs = []; walkCurves.forEach((w, wi) => { const half = Math.max(1, Math.round(w.w - 0.4)) / 2; for (let i = 1; i < w.pts.length; i += 1) { const [ax, az] = w.pts[i - 1]; const [bx, bz] = w.pts[i]; if (tierAt(wi, (ax + bx) / 2, (az + bz) / 2) === 'town') paveSegs.push({ ax, az, bx, bz, half }); } });
export function paveLift(x, z) {
  for (const s of paveSegs) {
    if (x < Math.min(s.ax, s.bx) - s.half || x > Math.max(s.ax, s.bx) + s.half || z < Math.min(s.az, s.bz) - s.half || z > Math.max(s.az, s.bz) + s.half) continue;
    const dx = s.bx - s.ax; const dz = s.bz - s.az; const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / (dx * dx + dz * dz || 1)));
    if (Math.hypot(x - s.ax - dx * t, z - s.az - dz * t) <= s.half) return offPath(x, z) ? 0 : PAVE_TOP;
  }
  return 0;
}
export const heightAt = (x, z) => T.heightAt(x, z) + paveLift(x, z);

// v1.10.13 환경 비주얼: one way to build the island's static things out of simple parts. Every part (a box, a cone, a
// roof slab...) is placed and coloured, then all of a thing's parts become ONE geometry with vertex colours, drawn with
// one shared material -- a cottage with doors, windows, a chimney and planters is a single draw call, and a tree kind is
// one instanced mesh. Colours are the island's palette (soft, high roughness, no metal).
const _m = new THREE.Matrix4(); const _q = new THREE.Quaternion(); const _e = new THREE.Euler(); const _v = new THREE.Vector3(); const _s = new THREE.Vector3();
// A part: geometry, colour, where (x, y, z), turn (rx, ry, rz), size (sx, sy, sz); `shade` darkens toward the bottom
// ([bottom factor, top factor] over the part's own height) for a soft painted roundness without lights to spare.
export function part(geo, color, x = 0, y = 0, z = 0, { rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, shade = null } = {}) {
  return { geo, color, matrix: _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)).clone(), shade };
}
export function mergeColored(parts, extra = null) { // `extra`: one more matrix for every part (turning a whole group)
  const ready = []; let count = 0;
  for (const p of parts) {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(p.matrix); if (extra) g.applyMatrix4(extra);
    ready.push({ g, p }); count += g.attributes.position.count;
  }
  const pos = new Float32Array(count * 3); const nor = new Float32Array(count * 3); const col = new Float32Array(count * 3);
  const c = new THREE.Color(); let o = 0;
  for (const { g, p } of ready) {
    const P = g.attributes.position; const N = g.attributes.normal; c.set(p.color);
    let y0 = Infinity; let y1 = -Infinity;
    if (p.shade) for (let i = 0; i < P.count; i += 1) { y0 = Math.min(y0, P.getY(i)); y1 = Math.max(y1, P.getY(i)); }
    for (let i = 0; i < P.count; i += 1) {
      const k = (o + i) * 3;
      pos[k] = P.getX(i); pos[k + 1] = P.getY(i); pos[k + 2] = P.getZ(i);
      nor[k] = N.getX(i); nor[k + 1] = N.getY(i); nor[k + 2] = N.getZ(i);
      const f = p.shade ? p.shade[0] + (p.shade[1] - p.shade[0]) * ((P.getY(i) - y0) / ((y1 - y0) || 1)) : 1;
      col[k] = c.r * f; col[k + 1] = c.g * f; col[k + 2] = c.b * f;
    }
    o += P.count; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

// Shapes shared by every build (made once).
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  cone4: new THREE.ConeGeometry(0.5, 1, 4),
  ball: new THREE.SphereGeometry(0.5, 10, 8),
  blob: new THREE.IcosahedronGeometry(0.5, 1),
};
G.cone4.rotateY(Math.PI / 4); // a square pyramid whose sides line up with the walls
// A gable: the triangle under a pitched roof, `span` wide (along z) and `rise` tall, as a 1-thick slab along x.
const gableGeo = (() => { const s = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)]); const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.rotateY(Math.PI / 2); g.translate(-0.5, 0, 0); return g; })();
// A hip roof over 1 x 1 with a ridge of `ridge` (0..1) along x: two trapezoids and two triangles.
function hipGeo(ridge) {
  const r = ridge / 2; const v = [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5], [-r, 1, 0], [r, 1, 0]];
  const f = [[3, 2, 5], [3, 5, 4], [1, 0, 4], [1, 4, 5], [2, 1, 5], [0, 3, 4]];
  const pos = []; for (const t of f) for (const i of t) pos.push(...v[i]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
const hipGeos = new Map(); const hip = (ridge) => { const k = Math.round(ridge * 20) / 20; if (!hipGeos.has(k)) hipGeos.set(k, hipGeo(k)); return hipGeos.get(k); };

// A building on level ground: footprint w (x) by d (z, the front faces +z), walls h tall, standing on a stone plinth
// that reaches a little below ground (no gap or buried corner on gentle ground). Options make the variety:
//   roof: 'gable' (ridge across, gables on the sides) | 'front' (ridge front-to-back, gable facing the street) |
//         'hip' | 'flat'; rise, overhang; door (x offset); windows: [[x, yFrac, face]] ('f' front, 'b' back, 'l', 'r');
//   chimney: x; porch: true; shutters: colour; awning: [colour, colour]; planters: true; lamp: true; trim: colour.
export function building(spec) {
  const { w, d, h, wall, roof, roofColor, rise = 1.2, ov = 0.28, door = 0, doorColor = 0x8a5a3b, windows = [], chimney = null, porch = false,
    shutters = null, awning = null, planters = false, lamp = false, trim = 0xfffaf0, plinth = 0xd8cfc0, base = 0.22 } = spec;
  const P = [];
  const top = base + h;
  P.push(part(G.box, plinth, 0, base / 2 - 0.25, 0, { sx: w + 0.3, sy: base + 0.5, sz: d + 0.3 }));
  P.push(part(G.box, wall, 0, base + h / 2, 0, { sx: w, sy: h, sz: d, shade: [0.9, 1.02] }));
  P.push(part(G.box, trim, 0, top - 0.06, 0, { sx: w + 0.08, sy: 0.12, sz: d + 0.08 }));
  // roof
  if (roof === 'gable' || roof === 'front') {
    const along = roof === 'gable'; // ridge along x
    const span = along ? d : w; const len = along ? w : d;
    const hs = span / 2 + ov; const L = Math.hypot(hs, rise); const a = Math.atan2(rise, hs);
    for (const side of [-1, 1]) {
      const c = hs / 2 * side;
      if (along) P.push(part(G.box, roofColor, 0, top + rise / 2 + 0.05, c, { rx: side * a, sx: len + ov * 2, sy: 0.14, sz: L, shade: [0.92, 1.05] }));
      else P.push(part(G.box, roofColor, c, top + rise / 2 + 0.05, 0, { rz: -side * a, sx: L, sy: 0.14, sz: len + ov * 2, shade: [0.92, 1.05] }));
    }
    if (along) P.push(part(gableGeo, wall, 0, top, 0, { sx: w * 0.999, sy: rise, sz: d }));
    else P.push(part(gableGeo, wall, 0, top, 0, { ry: Math.PI / 2, sx: d * 0.999, sy: rise, sz: w }));
  } else if (roof === 'hip') {
    P.push(part(hip(Math.max(0, (w - d) / (w + ov * 2))), roofColor, 0, top, 0, { sx: w + ov * 2, sy: rise, sz: d + ov * 2, shade: [0.92, 1.05] }));
  } else { // flat with a low parapet
    P.push(part(G.box, roofColor, 0, top + 0.1, 0, { sx: w + 0.2, sy: 0.2, sz: d + 0.2 }));
  }
  if (chimney != null) { P.push(part(G.box, 0xb9a48f, chimney, top + rise * 0.75, -d * 0.18, { sx: 0.38, sy: rise * 0.9, sz: 0.38 })); P.push(part(G.box, 0x8f7f70, chimney, top + rise * 1.22, -d * 0.18, { sx: 0.48, sy: 0.08, sz: 0.48 })); }
  // door with a frame and a step
  const fz = d / 2;
  P.push(part(G.box, trim, door, base + 0.78, fz + 0.01, { sx: 1.05, sy: 1.6, sz: 0.06 }));
  P.push(part(G.box, doorColor, door, base + 0.74, fz + 0.04, { sx: 0.85, sy: 1.46, sz: 0.06 }));
  P.push(part(G.ball, 0xf6d36b, door + 0.28, base + 0.75, fz + 0.09, { sx: 0.1, sy: 0.1, sz: 0.1 }));
  P.push(part(G.box, plinth, door, base - 0.05, fz + 0.32, { sx: 1.2, sy: 0.18, sz: 0.5 }));
  if (porch) { // a little roof over the door on two posts
    P.push(part(G.box, roofColor, door, base + 1.82, fz + 0.5, { rx: 0.22, sx: 1.6, sy: 0.1, sz: 1.05 }));
    for (const px of [-0.7, 0.7]) P.push(part(G.cyl, trim, door + px, base + 0.88, fz + 0.88, { sx: 0.09, sy: 1.8, sz: 0.09 }));
  }
  if (awning) for (let k = 0; k < 6; k += 1) P.push(part(G.box, awning[k % 2], -w / 2 + w / 12 + (k * w) / 6, base + h * 0.82, fz + 0.4, { rx: 0.35, sx: w / 6, sy: 0.08, sz: 0.9 }));
  // windows: a white frame, the glass, a cross; shutters on either side if asked
  for (const [wx, yf, face = 'f'] of windows) {
    const wy = base + h * yf;
    const put = (lx, ly, lz, o) => (face === 'f' ? [lx, ly, fz + lz, o] : face === 'b' ? [-lx, ly, -fz - lz, o] : face === 'r' ? [w / 2 + lz, ly, -lx, { ...o, ry: Math.PI / 2 }] : [-w / 2 - lz, ly, lx, { ...o, ry: Math.PI / 2 }]);
    const add = (geo, color, lx, ly, lz, o) => { const [x, y, z, oo] = put(lx, ly, lz, o); P.push(part(geo, color, x, y, z, oo)); };
    add(G.box, trim, wx, wy, 0.01, { sx: 0.74, sy: 0.74, sz: 0.06 });
    add(G.box, 0xa9d8f0, wx, wy, 0.03, { sx: 0.58, sy: 0.58, sz: 0.04 });
    add(G.box, trim, wx, wy, 0.05, { sx: 0.06, sy: 0.58, sz: 0.03 }); add(G.box, trim, wx, wy, 0.05, { sx: 0.58, sy: 0.06, sz: 0.03 });
    add(G.box, trim, wx, wy - 0.4, 0.08, { sx: 0.84, sy: 0.07, sz: 0.16 }); // the sill
    if (shutters) for (const s of [-1, 1]) add(G.box, shutters, wx + s * 0.5, wy, 0.03, { sx: 0.22, sy: 0.72, sz: 0.04 });
    if (planters && face === 'f') { add(G.box, 0xb98b62, wx, wy - 0.52, 0.18, { sx: 0.7, sy: 0.18, sz: 0.24 }); for (let k = 0; k < 3; k += 1) add(G.ball, [0xff9ec7, 0xffe27a, 0xff8f8f][k], wx - 0.22 + k * 0.22, wy - 0.4, 0.2, { sx: 0.16, sy: 0.16, sz: 0.16 }); }
  }
  if (lamp) { P.push(part(G.box, 0x4d4d4d, door + 0.75, base + 1.55, fz + 0.08, { sx: 0.12, sy: 0.24, sz: 0.12 })); P.push(part(G.ball, 0xfff1b8, door + 0.75, base + 1.42, fz + 0.14, { sx: 0.16, sy: 0.2, sz: 0.16 })); }
  return mergeColored(P);
}
// Small outdoor things built the same way: a mailbox, a fence run, a planter, a bench, a sign post.
export function props(list) {
  const P = [];
  for (const [kind, x, z, ry = 0, a = 1] of list) {
    const q = (lx, ly, lz) => [x + Math.cos(ry) * lx + Math.sin(ry) * lz, ly, z - Math.sin(ry) * lx + Math.cos(ry) * lz];
    const at = (geo, color, lx, ly, lz, o = {}) => { const [px, py, pz] = q(lx, ly, lz); P.push(part(geo, color, px, py, pz, { ...o, ry: ry + (o.ry || 0) })); };
    if (kind === 'mailbox') { at(G.box, 0x8a5a3b, 0, 0.45, 0, { sx: 0.1, sy: 0.9, sz: 0.1 }); at(G.box, a === 1 ? 0xe2574c : 0x5fa3d9, 0, 0.98, 0, { sx: 0.26, sy: 0.24, sz: 0.4 }); at(G.box, 0xffd166, 0.15, 1.08, -0.12, { sx: 0.03, sy: 0.16, sz: 0.06 }); }
    else if (kind === 'fence') { const n = Math.max(2, Math.round(a / 0.55)); for (let k = 0; k <= n; k += 1) at(G.box, 0xf3ead8, -a / 2 + (k * a) / n, 0.32, 0, { sx: 0.09, sy: 0.64, sz: 0.09 }); for (const y of [0.24, 0.48]) at(G.box, 0xf3ead8, 0, y, 0, { sx: a, sy: 0.06, sz: 0.05 }); }
    else if (kind === 'planter') { at(G.box, 0xb98b62, 0, 0.18, 0, { sx: 0.8, sy: 0.36, sz: 0.5 }); for (let k = 0; k < 4; k += 1) at(G.ball, [0xff9ec7, 0xffe27a, 0xffffff, 0xc4a5ff][(k + a) % 4], -0.27 + k * 0.18, 0.42, (k % 2) * 0.1 - 0.05, { sx: 0.2, sy: 0.18, sz: 0.2 }); at(G.blob, 0x6fbf5e, 0, 0.4, 0, { sx: 0.7, sy: 0.25, sz: 0.4 }); }
    else if (kind === 'bench') { at(G.box, 0xc58b5a, 0, 0.48, 0, { sx: 1.5, sy: 0.1, sz: 0.48 }); at(G.box, 0xc58b5a, 0, 0.78, -0.22, { sx: 1.5, sy: 0.38, sz: 0.08 }); for (const lx of [-0.6, 0.6]) at(G.box, 0x6b5a4a, lx, 0.24, 0, { sx: 0.09, sy: 0.48, sz: 0.44 }); }
    else if (kind === 'stepstone') at(G.cyl, 0xd8d0c2, 0, 0.03, 0, { sx: 0.7 * a, sy: 0.08, sz: 0.55 * a });
  }
  return P.length ? mergeColored(P) : null;
}

// v1.10.13: the water's pattern -- soft lighter ripples and a few small glints on transparent-free mid blue, drawn once.
function waterTexture() {
  const size = 128; const c = document.createElement('canvas'); c.width = size; c.height = size; const g = c.getContext('2d');
  g.fillStyle = '#74c2e3'; g.fillRect(0, 0, size, size);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let k = 0; k < 34; k += 1) { // ripples: short soft arcs across the flow
    const x = rnd() * size; const y = rnd() * size; const w = 10 + rnd() * 26;
    g.strokeStyle = `rgba(190, 232, 248, ${0.14 + rnd() * 0.2})`; g.lineWidth = 1.5 + rnd() * 2;
    for (const dy of [0, size, -size]) { g.beginPath(); g.ellipse(x, y + dy, w, 2.5 + rnd() * 2, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
  }
  for (let k = 0; k < 10; k += 1) { const x = rnd() * size; const y = rnd() * size; g.fillStyle = 'rgba(255, 255, 255, 0.6)'; g.beginPath(); g.ellipse(x, y, 2.2, 0.9, 0, 0, Math.PI * 2); g.fill(); } // sun glints
  for (let k = 0; k < 18; k += 1) { const x = rnd() * size; const y = rnd() * size; g.fillStyle = 'rgba(70, 150, 190, 0.25)'; g.beginPath(); g.ellipse(x, y, 8 + rnd() * 10, 3, 0, 0, Math.PI * 2); g.fill(); } // deeper patches
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildIsland(scene, { mat, mesh, solids, assets = null, software = false }) {
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };

  // v1.10.29 계절 바닥: the ground follows the four season zones (island-terrain seasonZoneAt / zoneSeason) like the
  // models on it -- each zone's grass and walks take the colours of that season's ground tiles (360 refinement v2
  // ground_tile_<season>: `ground` for grass, `earth` for walks) and move with the zones each day; the neutral plaza
  // keeps the island's own green. Near a zone's edge a vertex mixes the seasons of the ground around it (9 samples
  // within SEASON_BLEND), so the seasons meet in a soft band instead of a line. Only colours change: heights, walks and
  // collision stay as they are. Each painted mesh keeps its base colours and its zone weights (worked out once).
  const SEASON_GROUND = { spring: [0xc0e0a4, 0xddc39c, 0.55, 0.3], summer: [0xacd497, 0xd9be95, 0.35, 0.2], autumn: [0xe9d7a8, 0xd4b890, 0.6, 0.3], winter: [0xeff4fa, 0xe5e7eb, 0.8, 0.55] }; // [ground, earth, ground share, earth share]
  const SEASON_BLEND = 5;
  const painted = []; // { attr, base, weights (5 per vertex: plaza, zones 0-3), kind: [target (0 ground, 1 earth), share] per vertex }
  function seasonal(attr, at, kind) {
    const n = attr.count; const weights = new Float32Array(n * 5); const kinds = new Float32Array(n * 2);
    for (let i = 0; i < n; i += 1) {
      const [x, z] = at(i);
      for (let k = 0; k < 9; k += 1) { const a = (k / 8) * TAU; const r = k === 8 ? 0 : SEASON_BLEND; weights[i * 5 + 1 + T.seasonZoneAt(x + Math.cos(a) * r, z + Math.sin(a) * r)] += 1 / 9; }
      // (문제 기록 「배경이 안 이어져」: the season-less plaza is paved over -- its samples no longer pull the ground just outside
      // it back to plain green; that ground takes its own zone's season up to the paving's edge)
      const zoned = weights[i * 5 + 1] + weights[i * 5 + 2] + weights[i * 5 + 3] + weights[i * 5 + 4]; if (zoned > 0 && weights[i * 5] > 0) { for (let zone = 1; zone <= 4; zone += 1) weights[i * 5 + zone] /= zoned; weights[i * 5] = 0; }
      const [t, share] = kind(i); kinds[i * 2] = t; kinds[i * 2 + 1] = share;
    }
    painted.push({ attr, base: attr.array.slice(), weights, kinds });
  }
  let paintedDay = null;
  const tc = new THREE.Color();
  function setSeasonDay(day) {
    if (day === paintedDay) return;
    paintedDay = day;
    const looks = [0, 1, 2, 3].map((zone) => SEASON_GROUND[T.zoneSeason(zone, day)]);
    const targets = looks.map((l) => [0, 1].map((t) => tc.set(l[t]).toArray()));
    for (const { attr, base, weights, kinds } of painted) {
      const out = attr.array;
      for (let i = 0; i < attr.count; i += 1) {
        const t = kinds[i * 2]; const share = kinds[i * 2 + 1];
        for (let ch = 0; ch < 3; ch += 1) {
          const b = base[i * 3 + ch]; let v = b;
          if (share > 0) for (let zone = 0; zone < 4; zone += 1) { const w = weights[i * 5 + 1 + zone]; if (w) v += w * share * looks[zone][2 + t] * (targets[zone][t][ch] - b); }
          out[i * 3 + ch] = v;
        }
      }
      attr.needsUpdate = true;
    }
  }

  // Terrain: one mesh with vertex colours (grass, sand by the sea, rock on the cliffs).
  // v1.10.73 숲 바닥: how wooded a spot is (the trees within 6 m), for the darker floor and the ground cover
  const treeBuckets = new Map();
  for (const t of nature().trees) { const k = `${Math.floor(t.x / 8)},${Math.floor(t.z / 8)}`; if (!treeBuckets.has(k)) treeBuckets.set(k, []); treeBuckets.get(k).push(t); }
  function forestAt(x, z) {
    let f = 0; const bx = Math.floor(x / 8); const bz = Math.floor(z / 8);
    for (let a = -1; a <= 1; a += 1) for (let b = -1; b <= 1; b += 1) for (const t of treeBuckets.get(`${bx + a},${bz + b}`) || []) { const d = Math.hypot(t.x - x, t.z - z); if (d < 6) f += 1 - d / 6; }
    return Math.min(1, f / 2);
  }
  // B 48 바닥 질감 (assets 48 ground-v1): small repeating grey grains -- grass blades, soil and gravel, sand -- multiplied
  // into the ground's own colours at 35% (the colours, seasons and forest floor stay theirs), by world position; the
  // paths' grass edge is a tufted mask instead of a straight line. Grey set + mask only: about 120 KB on the GPU.
  const groundTex = (() => {
    const loader = new THREE.TextureLoader();
    const t = (file, srgb, clampV = false) => { const x = keep(loader.load(`/assets/island/ground-v1/${file}.png`)); x.wrapS = THREE.RepeatWrapping; x.wrapT = clampV ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping; x.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; return x; }; // (no anisotropic filtering: costly on a software renderer or a weak phone)
    return { grass: t('ground.grass_gray', true), soil: t('ground.soil_gray', true), sand: t('ground.sand_gray', true), edge: t('ground.grass_soil_edge_mask', false, true) };
  })();
  const GRAIN = 0.5; // how strongly the grains show
  const grainOn = { value: software ? 0 : GRAIN }; // (none on a software renderer: SwiftShader, llvmpipe -- no GPU) // (0 on the lowest quality tier: a slow device -- or a software renderer -- skips the samples)
  const grained = (material, path) => {
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, { tGrass: { value: groundTex.grass }, tSoil: { value: groundTex.soil }, tSand: { value: groundTex.sand }, tEdge: { value: groundTex.edge }, uGrain: grainOn });
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
attribute vec2 aGround; varying vec2 vGround; varying vec2 vGroundXZ;`).replace('#include <begin_vertex>', `#include <begin_vertex>
vGround = aGround; vGroundXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D tGrass; uniform sampler2D tSoil; uniform sampler2D tSand; uniform sampler2D tEdge; uniform float uGrain; varying vec2 vGround; varying vec2 vGroundXZ;`).replace('#include <color_fragment>', `#include <color_fragment>
if (uGrain > 0.0) {
vec3 gGrass = texture2D(tGrass, vGroundXZ / 2.4).rgb / 0.611; // (each over its own mean: the colours keep their brightness, only the grain shows)${path ? `
float gCover = texture2D(tEdge, vGround).a; // the path: x along it, y across (1 at its grass edge)
diffuseColor.rgb *= mix(vec3(1.0), mix(texture2D(tSoil, vGroundXZ / 1.4).rgb / 0.319, gGrass, gCover), uGrain);
diffuseColor.a *= 1.0 - 0.85 * gCover * step(0.001, vGround.y); // the island's grass shows through in tufts
}` : `
vec3 gGrain = mix(mix(vec3(1.0), gGrass, vGround.x), texture2D(tSand, vGroundXZ / 1.4).rgb / 0.701, vGround.y);
diffuseColor.rgb *= mix(vec3(1.0), gGrain, uGrain);
}`}`);
    };
    material.customProgramCacheKey = () => (path ? 'ground-path' : 'ground');
    return material;
  };
  const SIZE = T.GROUND?.size ?? 250; const SEG = T.GROUND?.seg ?? 125; // (달마루섬 미리보기: its own, larger ground)
  const geo = keep(new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG)); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position; const colors = new Float32Array(pos.count * 3);
  const grass = new THREE.Color(0x9fd67f); const grass2 = new THREE.Color(0x8cc96c); const sand = new THREE.Color(0xf1dfae);
  const rock = new THREE.Color(0xb7ad9e); const wet = new THREE.Color(0xd8c48f); const c = new THREE.Color();
  const grassy = new Float32Array(pos.count); // v1.10.29: how much of a vertex is grass (the season paints that part)
  const grains = new Float32Array(pos.count * 2); // B 48: the grass and the sand share of a vertex (its grains)
  const forestFloor = new THREE.Color(0x6f8a4c); // v1.10.73 숲 바닥: darker, mossy ground under the trees
  // 문제 기록 1 「배경이 안 이어져」 (사진: 대청마당 박석이 곧은 선으로 끝나고 바로 겨울 눈 바닥): a gravel apron round the
  // paving, 1.5 m sure and then ragged out to about 4 m, the season painting it only a little -- paving, gravel, the season
  const PLZ = T.dalmaru?.PLAZA; const gravel = new THREE.Color(0xd6cbb2);
  const apronAt = (x, z) => { if (!PLZ) return 0; const out = Math.hypot(Math.max(0, Math.abs(x - PLZ.x) - PLZ.hw), Math.max(0, PLZ.d0 - z, z - PLZ.d1)); return out <= 0 || z < PLZ.d0 ? 0 : 1 - smooth(1.5, 3.4 + 1.1 * Math.sin(x * 0.83) * Math.cos(z * 0.67), out); };
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i); const z = pos.getZ(i); const h = ground(x, z); pos.setY(i, h);
    const cd = coastDist(x, z); const cliff = cliffAt(x, z); let g = 1; let sd = 0;
    c.copy(grass).lerp(grass2, 0.5 + 0.5 * Math.sin(x * 0.21 + z * 0.17) * Math.cos(z * 0.13));
    const woods = forestAt(x, z); if (woods > 0) c.lerp(forestFloor, 0.55 * woods);
    const apron = apronAt(x, z); if (apron > 0) { c.lerp(gravel, 0.85 * apron); g *= 1 - 0.8 * apron; }
    if (cd < 8 && cliff < 0.5) { const a = smooth(8, 4, cd); c.lerp(cd < 2.5 ? wet : sand, a); g *= 1 - a; sd = a; }
    if (cliff > 0.4 && cd < 4) { const a = smooth(4, 1, cd); c.lerp(rock, a); g *= 1 - a; sd *= 1 - a; }
    if (h < -0.4) { c.copy(wet); g = 0; sd = 1; }
    colors.set([c.r, c.g, c.b], i * 3); grassy[i] = g; grains[i * 2] = g; grains[i * 2 + 1] = sd;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geo.setAttribute('aGround', new THREE.BufferAttribute(grains, 2)); geo.computeVertexNormals();
  seasonal(geo.attributes.color, (i) => [pos.getX(i), pos.getZ(i)], (i) => [0, grassy[i]]);
  const terrain = new THREE.Mesh(geo, keep(grained(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), false)));
  terrain.receiveShadow = true; scene.add(terrain);

  // Sea and the pond and streams (flat water a little under the banks).
  // v1.10.13 흐르는 물: the streams carry a soft pattern of light ripples and a few sun glints that drifts from the
  // plaza out to the sea (the texture's offset, moved each frame -- no simulation, no reflections). The fountain's
  // channels share it; the pond drifts very slowly.
  const flowTex = keep(waterTexture()); flowTex.wrapS = THREE.RepeatWrapping; flowTex.wrapT = THREE.RepeatWrapping;
  const water = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, map: flowTex, roughness: 0.55, metalness: 0 }));
  const pondTex = keep(flowTex.clone()); pondTex.needsUpdate = true; pondTex.repeat.set(2.5, 2.5);
  const pondWater = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, map: pondTex, roughness: 0.55, metalness: 0 }));
  const sea = new THREE.Mesh(keep(new THREE.PlaneGeometry(900, 900)), mat(0x6cbfe2, { roughness: 0.3 }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -0.6; sea.receiveShadow = true; scene.add(sea);
  const pond = new THREE.Mesh(keep(new THREE.CircleGeometry(POND.r + 0.6, 40)), pondWater);
  pond.rotation.x = -Math.PI / 2; pond.position.set(POND.x, land(POND.x, POND.z) - 0.45, POND.z); scene.add(pond);
  const ribbon = (pts, width, yOf, material, lift = 0) => { // a flat strip along a line, following the ground
    const v = []; const idx = [];
    const uv = []; let run = 0; // v1.10.13: u across, v along (every 6 units one texture length) -- the flow follows it
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[Math.max(0, i - 1)]; const b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0]; const dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1;
      const nx = -dz / l; const nz = dx / l; const [x, z] = pts[i]; const y = yOf(x, z) + lift; const wd = typeof width === 'function' ? width(x, z) : width; // v1.10.47: a width along the line
      if (i) run += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
      v.push(x + nx * wd / 2, y, z + nz * wd / 2, x - nx * wd / 2, y, z - nz * wd / 2);
      uv.push(0, run / 6, 1, run / 6);
      if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } // counter-clockwise from above
    }
    const g = keep(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, material); m.receiveShadow = true; scene.add(m); return m;
  };
  for (const s of streamCurves) ribbon(s.filter(([x, z]) => coastDist(x, z) > -1.5), (x, z) => (STREAM_HALF + riverExtra(x, z)) * 2 + 0.6, T.streamWaterHeight, water); // ends where it meets the sea
  // In the plaza the fountain's water runs out along shallow channels toward each stream.
  for (const s of STREAMS) {
    const [ex, ez] = s[0]; const a = Math.atan2(ez, ex);
    ribbon([[Math.cos(a) * 3.2, Math.sin(a) * 3.2], [Math.cos(a) * 10, Math.sin(a) * 10], [ex, ez]], 0.7, (x, z) => land(x, z), water, 0.05);
  }

  // Walks: sandy paths over the grass (not drawn on bridges), the paved plaza and the paved square before the hall.
  // v1.10.13: each walk a band whose middle is the path colour and whose sides blend into the grass and sink to the
  // ground (no flat board with a cut edge), with a faint mottling along it; the areas differ a little in colour --
  // pale paving to the hall, warm stone on the shop street, earth up the hill and in the woods, sand to the harbour.
  const paveMat = mat(0xf3e6c8);
  // (the three tiers -- tierAt above -- one colour each)
  const TIER_COLOR = { town: 0xe7e1d3, walk: 0xe6d8bd, trail: 0xcdb48c };
  const pathMat = keep(grained(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), true));
  const grassEdge = new THREE.Color(0xa7d483);
  const plazaPaving = new THREE.Color(0xf3e6c8);
  const pathStrip = (pts, width, base) => {
    const v = []; const col = []; const idx = []; const gr = []; let along = 0; const c0 = new THREE.Color(base); const cm = new THREE.Color(); const ce = new THREE.Color(); const cols = 4;
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[Math.max(0, i - 1)]; const b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0]; const dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1;
      const nx = -dz / l; const nz = dx / l; const [x, z] = pts[i]; if (i) along += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
      const mottle = 0.94 + 0.08 * Math.sin(x * 0.7 + z * 0.4) * Math.cos(z * 0.53 - x * 0.2);
      const plazaBlend = 1 - smooth(-1, 6, plazaDist(x, z));
      const halfWidth = width / 2 * (1 + 0.35 * plazaBlend);
      cm.copy(c0).multiplyScalar(mottle).lerp(plazaPaving, plazaBlend);
      ce.copy(cm).lerp(grassEdge, 0.55 * (1 - plazaBlend));
      for (const [o, c] of [[-(halfWidth + 0.35), ce], [-(halfWidth - 0.25), cm], [halfWidth - 0.25, cm], [halfWidth + 0.35, ce]]) {
        const px = x + nx * o; const pz = z + nz * o; v.push(px, T.meshGroundHeight(px, pz) + 0.008, pz); col.push(c.r, c.g, c.b); gr.push(along / 3, c === ce ? 1 - plazaBlend : 0); // (B 48: the edge mask's x along, y across)
      }
      if (i) for (let k = 0; k < cols - 1; k += 1) { const p = (i - 1) * cols + k; const n = i * cols + k; idx.push(p, n + 1, n, p, p + 1, n + 1); }
    }
    const g = keep(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aGround', new THREE.Float32BufferAttribute(gr, 2)); g.setIndex(idx); g.computeVertexNormals();
    seasonal(g.attributes.color, (i) => [v[i * 3], v[i * 3 + 2]], (i) => (i % cols === 0 || i % cols === cols - 1 ? [0, 0.55] : [1, 1])); // v1.10.29: edges are half grass
    const m = new THREE.Mesh(g, pathMat); m.receiveShadow = true; scene.add(m); return m;
  };
  for (const [wi, w] of walkCurves.entries()) {
    let run = []; let tier = null;
    const flush = () => { if (run.length > 1) pathStrip(run, tier === 'trail' ? w.w * 0.6 : w.w, TIER_COLOR[tier]); run = run.slice(-1); };
    for (const p of w.pts) {
      // (문제 기록 3회차 19 「보이는 각도에 따라 흙이 보이기도 하고 아니기도」: a walk's band ran on under 대청마당's paving and the
      // hall's yard, the two fighting for the same height -- it ends 0.2 m under their rim)
      if (onBridge(p[0], p[1]) || streamDist(p[0], p[1]) < STREAM_HALF + 0.4 || plazaDist(p[0], p[1]) < -0.2 || T.inTownhall(p[0], p[1], -0.2)) { flush(); run = []; continue; }
      const t = tierAt(wi, p[0], p[1]); if (tier && t !== tier) flush(); tier = t; run.push(p);
    }
    flush();
  }
  // v1.10.13: every building off the plaza gets a short path from its door to the nearest walk (doors no longer open
  // onto bare grass a few steps away from the path), in that walk's colour.
  for (const b of BUILDINGS) {
    if (b.kind === 'cottage' || b.kind === 'hall' || b.kind === 'facade' || plazaDist(b.x, b.z) < 3) continue; // cottages have stepping stones; the hall its square
    const dx = b.face[0] - b.x; const dz = b.face[1] - b.z; const l = Math.hypot(dx, dz) || 1;
    const door = [b.x + (dx / l) * 2.4, b.z + (dz / l) * 2.4];
    let best = null;
    walkCurves.forEach((w, wi) => w.pts.forEach(([x, z]) => { const d = Math.hypot(x - door[0], z - door[1]); if (!best || d < best.d) best = { d, x, z, wi, w: w.w }; }));
    if (!best || best.d < best.w / 2 + 0.6 || best.d > 9) continue;
    const end = [best.x - ((best.x - door[0]) / best.d) * (best.w / 2 - 0.3), best.z - ((best.z - door[1]) / best.d) * (best.w / 2 - 0.3)];
    const n = Math.max(2, Math.ceil(Math.hypot(end[0] - door[0], end[1] - door[1]) / 0.8));
    const pts = Array.from({ length: n + 1 }, (_, k) => [door[0] + ((end[0] - door[0]) * k) / n, door[1] + ((end[1] - door[1]) * k) / n]);
    if (pts.some(([x, z]) => streamDist(x, z) < STREAM_HALF + 0.4)) continue;
    pathStrip(pts, 1.7, TIER_COLOR[tierAt(best.wi, best.x, best.z)]);
  }
  // (문제 기록 3회차 20 「길이랑 마당이 따로 놀아」: the 게임관 stood 3 m off 대청마당 across the grass, its square apart -- a hall
  // by the terrace walks onto it: a paved way from its door to the paving's edge, 0.3 m under it)
  if (T.inPlaza) for (const [id] of Object.entries(T.SPOTS).filter(([, x]) => x.kind === 'hall')) {
    const door = T.facilityDoor(id); const P = T.dalmaru.PLAZA; if (!door) continue;
    const s = T.SPOTS[id]; const fl = Math.hypot(s.face[0] - s.x, s.face[1] - s.z) || 1; const d = { x: door.x - ((s.face[0] - s.x) / fl) * 1.5, z: door.z - ((s.face[1] - s.z) / fl) * 1.5 }; // (from its steps' foot)
    const ex = Math.max(P.x - P.hw + 0.3, Math.min(P.x + P.hw - 0.3, d.x)); const ez = Math.max(P.d0 + 0.3, Math.min(P.d1 - 0.3, d.z)); const l = Math.hypot(ex - d.x, ez - d.z);
    if (l < 0.5 || l > 8) continue;
    const n = Math.max(2, Math.ceil(l / 0.8)); pathStrip(Array.from({ length: n + 1 }, (_, k) => [d.x + ((ex - d.x) * k) / n, d.z + ((ez - d.z) * k) / n]), 3.2, TIER_COLOR.town);
  }
  const disc = (x, z, r, material, lift = 0.04, seg = 48) => { const m = new THREE.Mesh(keep(new THREE.CircleGeometry(r, seg)), material); m.rotation.x = -Math.PI / 2; m.position.set(x, land(x, z) + lift, z); m.receiveShadow = true; scene.add(m); return m; };
  if (T.inPlaza) { // 대청마당 (달마루섬): one paved terrace, a band round the fountain
    // (묶음 1, assets 59: 박석 -- one 6 m tile repeated over it; the disc, ring, kerbs, channels and gardens are plaza-scene's)
    const P = T.dalmaru.PLAZA; const tex = keep(new THREE.TextureLoader().load(`/assets/island/plaza-v1/plaza_pave${software ? '_low' : ''}.webp`));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.repeat.set((P.hw * 2) / 6, (P.d1 - P.d0) / 6);
    const pave = new THREE.Mesh(keep(new THREE.PlaneGeometry(P.hw * 2, P.d1 - P.d0)), keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }))); pave.rotation.x = -Math.PI / 2; pave.position.set(P.x, P.h + 0.03, (P.d0 + P.d1) / 2); pave.receiveShadow = true; scene.add(pave);
  } else {
  disc(0, 0, PLAZA_R, paveMat, 0.03, 64);
  const rim = new THREE.Mesh(keep(new THREE.RingGeometry(PLAZA_R - 0.4, PLAZA_R, 64)), mat(0xe2cfa6)); rim.rotation.x = -Math.PI / 2; rim.position.y = PLAZA_H + 0.045; scene.add(rim);
  disc(0, -44, 9, paveMat, 0.05);
  const band = (x, z, r0, r1, color, lift) => { const m = new THREE.Mesh(keep(new THREE.RingGeometry(r0, r1, 64)), mat(color)); m.rotation.x = -Math.PI / 2; m.position.set(x, land(x, z) + lift, z); m.receiveShadow = true; scene.add(m); };
  band(0, 0, 6.6, 7.1, 0xe6d3ab, 0.04); band(0, 0, 11.3, 11.7, 0xe6d3ab, 0.04); band(0, 0, 3.6, 4.1, 0xd9c49a, 0.04); // paving rings
  band(0, -44, 3, 3.5, 0xd9c49a, 0.06); band(0, -44, 6.8, 7.2, 0xe6d3ab, 0.06);
  disc(0, -44, 1.6, mat(0x6aa9e8), 0.065, 32); // an inlaid emblem in front of the hall
  }

  // Bridges: an arched wooden deck with rails.
  // v1.10.29: the bridge model (prop.bridge) is fitted to each bridge's logical deck -- its length 2 x half, its width w
  // and its arch deckAt (what feet walk on, island-terrain): every vertex keeps its height above the model's own deck
  // (BRIDGE.top, the model's plank tops, about 0.57 in the middle to 0.32 at the ends) on top of the game's.
  const plank = mat(0xc58b5a); const post = mat(0x8a5a3b);
  const BRIDGE_SCALE = 1.3; // prop.bridge's scale (island-assets.js)
  const BRIDGE = { half: 1.63, side: 0.8, top: (x) => 0.57 - 0.25 * (x / 1.5) ** 2 }; // the model: deck ends, post line, plank tops
  for (const b of bridges) {
    const g = new THREE.Group(); g.position.set(b.x, 0, b.z); g.rotation.y = Math.atan2(b.ux, b.uz); scene.add(g);
    const visual = new THREE.Group(); g.add(visual);
    for (let k = -5; k <= 5; k += 1) {
      const u = (k / 5) * b.half; const y = deckAt({ b, u }) - 0.08;
      const p = mesh(keep(new THREE.BoxGeometry(b.w, 0.16, (b.half * 2) / 11 + 0.05)), plank, 0, y, u, visual); p.rotation.x = -Math.atan(-0.7 * u / (b.half * b.half));
    }
    for (const side of [-1, 1]) for (let k = -2; k <= 2; k += 1) {
      const u = (k / 2) * (b.half - 0.2); mesh(keep(new THREE.CylinderGeometry(0.08, 0.09, 0.9, 8)), post, side * (b.w / 2 - 0.1), deckAt({ b, u }) + 0.4, u, visual);
    }
    const r0 = deckAt({ b, u: -b.half }); const r1 = deckAt({ b, u: b.half }); // (2회차 4: a bridge whose ends meet different banks slopes, its rails with it)
    for (const side of [-1, 1]) { const rail = mesh(keep(new THREE.BoxGeometry(0.1, 0.1, Math.hypot(b.half * 2, r1 - r0))), post, side * (b.w / 2 - 0.1), Math.max(b.deck, (r0 + r1) / 2) + 0.9, 0, visual); rail.rotation.x = -Math.atan2(r1 - r0, b.half * 2); rail.castShadow = false; }
    if (b.model) { // (달마루섬 윤슬다리: its own model, whose arched deck is the one walked on -- deckAt)
      const h = new THREE.Group(); h.position.set(b.x, b.base, b.z); h.rotation.y = Math.atan2(-b.uz, b.ux); h.scale.x = (b.half * 2) / 50; scene.add(h); assets?.attach(b.model, h, visual); continue;
    }
    // in the bridge's frame (z along it, the entry turns the model's length onto z and sizes it by `scale`)
    g.userData.fit = (v) => {
      const zm = v.z / BRIDGE_SCALE; const u = Math.max(-b.half, Math.min(b.half, zm * (b.half / BRIDGE.half)));
      v.set(v.x * ((b.w / 2) / (BRIDGE.side * BRIDGE_SCALE)), v.y - BRIDGE_SCALE * BRIDGE.top(zm) + deckAt({ b, u }), (zm * b.half) / BRIDGE.half);
    };
    assets?.attach('prop.bridge', g, visual);
  }

  // Harbour: pier on posts, a few boats, the breakwater and its lighthouse. (달마루섬 미리보기: not there -- 달끝나루 comes in step 2)
  const pier = new THREE.Group(); pier.position.set(PIER.x, 0, PIER.z); pier.rotation.y = Math.atan2(PIER.ux, PIER.uz); scene.add(pier);
  const pierDeck = mesh(keep(new THREE.BoxGeometry(PIER.w, 0.2, PIER.half * 2)), plank, 0, PIER.deck - 0.1, 0, pier);
  const pierPosts = new THREE.Group(); pier.add(pierPosts);
  for (let u = -PIER.half + 1; u <= PIER.half; u += 3) for (const s of [-1, 1]) mesh(keep(new THREE.CylinderGeometry(0.14, 0.14, 2.2, 8)), post, s * (PIER.w / 2 - 0.15), -0.6, u, pierPosts);
  // v1.10.29: the pier's planked deck model (2 x 2.375, its top 0.245 over its base) in segments along the pier, its top
  // on the deck the game walks on (PIER.deck), and a post model for each procedural post, its cap a little over the deck
  if (assets) {
    const n = Math.round((PIER.half * 2) / 2.375); const len = (PIER.half * 2) / n;
    for (let k = 0; k < n; k += 1) { const seg = new THREE.Group(); seg.position.set(0, PIER.deck - 0.245, -PIER.half + (k + 0.5) * len); seg.scale.set(PIER.w / 2, 1, len / 2.375); pier.add(seg); assets.attach('prop.pierDeck', seg, pierDeck); }
    for (const p of pierPosts.children) { const h = new THREE.Group(); h.position.set(p.position.x, PIER.deck + 0.25 - 1.88, p.position.z); pier.add(h); assets.attach('prop.pierPost', h, pierPosts); }
  }
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
  // v1.10.11: where the trees, flowers, bushes, rocks, fence posts and lamps stand comes from island-terrain.js (the
  // server keeps events clear of them too)
  const { trees, flowers, bushes, tufts, rocks, posts, lampSpots } = nature();
  const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const v3 = new THREE.Vector3(); const sc = new THREE.Vector3(); const tint = new THREE.Color();
  // One instanced mesh per square of the island (CELL units), so whatever is off screen (or outside the shadow area
  // around the player) is skipped as a whole instead of drawing every tree on the island every frame. `color(item)`
  // gives each copy its own slight tint (one draw call, no two trees exactly alike).
  // v1.10.13: the island's small nature (trees, bushes, flowers, grass, stones) is not instanced but baked: every copy
  // of every kind in a CELL square goes into one static mesh (one for things that cast shadows, one for the rest), with
  // its tint in the vertex colours -- a few dozen draw calls for the whole island's greenery instead of one per kind
  // per square. Still culled square by square when off screen.
  const baked = new Map(); // `${cx},${cz},${shadow}` -> [{ geometry, matrix, color }]
  // v1.10.17: a list given a `target` (registry ids, e.g. ['nature.tree.round', 'nature.tree']) that has a model to load
  // is kept apart and handed to `assets.batch`, which shows the model for its copies near the player (asset-loader.js).
  // v1.10.18: such a list is not baked but drawn as one InstancedMesh per square (its tint per copy) -- the same one draw
  // call per square -- so the loader can take single copies out of it: the near ones become models, the rest stay.
  // Placement, sizes and turns are exactly the procedural ones, so where things stand, the circles round them and the
  // islanders' routes stay as they were.
  const groups = []; // { target, cells: [{ x, z, parent, procedural: [InstancedMesh], matrices, colors, shadow }] }
  // v1.10.29 `extra`: [[geometry, material, shadow]] more procedural meshes drawn with the same matrices (a lamp's bulb,
  // its geometry already lifted onto the pole) -- a model replaces all of them together.
  const instanced = (geometry, material, list, place, { shadow = true, cell = 40, color = null, target = null, extra = [], parent = scene } = {}) => { // v1.10.73 parent: a group shown by quality
    const g = target && assets?.wants(target) ? { target, cells: [] } : null;
    if (material === natureMat && !g) {
      for (const item of list) {
        place(item, 0);
        const key = `${Math.floor(item.x / cell)},${Math.floor(item.z / cell)},${shadow ? 1 : 0}`;
        if (!baked.has(key)) baked.set(key, []);
        baked.get(key).push({ geometry, matrix: m4.clone(), color: color ? color(item, tint).clone() : null });
      }
      return;
    }
    keep(geometry);
    const cells = new Map();
    for (const item of list) { const key = `${Math.floor(item.x / cell)},${Math.floor(item.z / cell)}`; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(item); }
    for (const [key, items] of cells) {
      const im = new THREE.InstancedMesh(geometry, material, items.length);
      const matrices = []; const colors = [];
      items.forEach((item, i) => {
        place(item, i); im.setMatrixAt(i, m4);
        if (color) { const c = color(item, tint); im.setColorAt(i, c); colors.push(c.clone()); }
        matrices.push(m4.clone());
      });
      im.computeBoundingSphere(); im.castShadow = shadow; im.receiveShadow = true; parent.add(im);
      const more = extra.map(([geo, mat2, cast]) => { keep(geo); const e = new THREE.InstancedMesh(geo, mat2, items.length); matrices.forEach((mm, i) => e.setMatrixAt(i, mm)); e.computeBoundingSphere(); e.castShadow = cast; parent.add(e); return e; });
      if (g) { const [cx, cz] = key.split(',').map(Number); g.cells.push({ x: (cx + 0.5) * cell, z: (cz + 0.5) * cell, parent, procedural: [im, ...more], matrices, colors: color ? colors : null, shadow }); }
    }
    if (g) groups.push(g);
  };
  const setM = (x, y, z, s, sy = s, ry = 0) => { q.setFromAxisAngle(v3.set(0, 1, 0), ry); m4.compose(v3.set(x, y, z), q, sc.set(s, sy, s)); };
  // v1.10.13 환경 비주얼: a few kinds of each thing, each kind one merged shape (island.js `part`/`mergeColored`) with
  // soft top-to-bottom shading, every copy turned, sized and tinted a little differently. Which kind stands where comes
  // from its position (not the seeded placement), so trees stay where they were -- their circles, events and the
  // islanders' paths are unchanged.
  const hash = (x, z, k = 0) => { const v = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };
  const natureMat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  // (문제 기록 3회차 8: the scattered pieces on the ground as drawn -- the 2 m mesh, not the formula, which on the ridge's slopes
  // stood metres off it -- and the small ones only where they sit: T.settledSpot)
  const onMesh = (x, z) => T.meshGroundHeight(x, z); const settled = (p) => T.settledSpot(p.x, p.z);
  const SH = [0.72, 1.06]; // shaded underside, sunlit top
  const trunk = (h, r, color = 0x9b6b47) => part(new THREE.CylinderGeometry(r * 0.75, r, h, 7), color, 0, h / 2, 0, { shade: [0.75, 1] });
  const crown = (geo, color, x, y, z, s, sy = s) => part(geo, color, x, y, z, { sx: s, sy, sz: s, shade: SH });
  const SPH = new THREE.SphereGeometry(0.5, 8, 6); const CONE = new THREE.ConeGeometry(0.5, 1, 7);
  const TREE_KINDS = [ // [name, share, parts]
    ['round', 0.3, [trunk(1.5, 0.27), crown(SPH, 0x76c267, 0, 2.05, 0, 2.5, 2.2), crown(SPH, 0x86cf74, 0.45, 2.75, 0.25, 1.7, 1.5)]],
    ['tiered', 0.18, [trunk(1.6, 0.25), crown(SPH, 0x6fbd62, 0, 1.85, 0, 2.6, 1.6), crown(SPH, 0x7fc86d, -0.1, 2.6, 0.05, 2.0, 1.4), crown(SPH, 0x93d47e, 0.05, 3.2, 0, 1.25, 1.0)]],
    ['pine', 0.16, [trunk(1.1, 0.22, 0x8a5f40), crown(CONE, 0x4f9e63, 0, 1.6, 0, 2.3, 1.7), crown(CONE, 0x5aab6c, 0, 2.45, 0, 1.8, 1.5), crown(CONE, 0x67b876, 0, 3.2, 0, 1.25, 1.3)]],
    ['tall', 0.12, [trunk(2.0, 0.2), crown(SPH, 0x6cbf66, 0, 3.0, 0, 1.7, 3.0)]],
    ['blossom', 0.06, [trunk(1.4, 0.24, 0x8f5f45), crown(SPH, 0xf6b8cf, 0, 2.05, 0, 2.4, 2.0), crown(SPH, 0xfbd0de, -0.4, 2.7, 0.2, 1.5, 1.3)]],
    ['fruit', 0.06, [trunk(1.4, 0.26), crown(SPH, 0x6fbf5e, 0, 2.05, 0, 2.4, 2.1), ...[[0.9, 1.7, 0.6], [-0.7, 2.3, 0.8], [0.3, 2.6, -0.95], [-0.9, 1.8, -0.4]].map(([x, y, z]) => crown(SPH, 0xf2994a, x, y, z, 0.26))]],
    ['sapling', 0.08, [trunk(0.9, 0.11), crown(SPH, 0x8ad27a, 0, 1.15, 0, 0.95, 0.9)]],
    ['stump', 0.04, [part(new THREE.CylinderGeometry(0.42, 0.5, 0.45, 9), 0xa9774f, 0, 0.22, 0, { shade: [0.8, 1] }), part(new THREE.CylinderGeometry(0.36, 0.36, 0.02, 9), 0xe8c99a, 0, 0.455, 0), crown(SPH, 0x7cbf5c, 0.55, 0.12, 0.2, 0.45, 0.3)]],
  ];
  // v1.10.77: the kind comes from island-terrain (one rule with the server's fruit trees); a fruit-kind tree that is not
  // a harvest tree (no free spot at its trunk) is drawn plain, so no tree shows fruit that cannot be picked
  const kindOf = (t) => { const name = globalThis.IslandTerrain.treeKind(t); const k = TREE_KINDS.findIndex(([n]) => n === name); return name === 'fruit' ? 0 : Math.max(0, k); };
  // 묶음 5 각진 자연물 (assets 63): about a third of the round, tiered, pine and young trees stand as the angular ones (its
  // place, size and turn as before -- the circle round it and the islanders' routes the same; the tall and the blossom
  // stay, each season keeping every kind), never two of a kind side by side as a rule of the hash
  const ANGULAR_TREES = ['block', 'stack', 'spire'];
  const angularTree = (t) => ['round', 'tiered', 'pine', 'sapling'].includes(globalThis.IslandTerrain.treeKind(t)) && hash(t.x, t.z, 40) < 0.34 ? ANGULAR_TREES[Math.min(2, Math.floor(hash(t.x, t.z, 41) * 3))] : null;
  // v1.10.29: stumps come in two models (short, tall), each stump's from its place
  TREE_KINDS.forEach(([name, , parts], k) => {
    const all = trees.filter((t) => kindOf(t) === k && !angularTree(t) && !globalThis.IslandTerrain.harvestTrees().some(h => h.x === t.x && h.z === t.z));
    const splits = name === 'stump' ? [0, 1].map((v) => [all.filter((t) => (hash(t.x, t.z, 18) < 0.5 ? 0 : 1) === v), [`nature.tree.stump.${v}`, 'nature.tree.stump', 'nature.tree']]) : [[all, [`nature.tree.${name}`, 'nature.tree']]];
    const geo = mergeColored(parts);
    for (const [list, target] of splits) {
      if (!list.length) continue;
      instanced(geo, natureMat, list, (t) => setM(t.x, onMesh(t.x, t.z) - 0.05, t.z, t.s * (0.9 + hash(t.x, t.z, 1) * 0.2), t.s * (0.85 + hash(t.x, t.z, 2) * 0.35), hash(t.x, t.z, 3) * TAU),
        { cell: 60, color: (t, c) => c.setHSL(0.02 * (hash(t.x, t.z, 4) - 0.5), 0.12, 0.9 + hash(t.x, t.z, 5) * 0.14), target });
    }
  });
  const facet = (geo, color, x, y, z, s, sy = s) => part(geo, color, x, y, z, { sx: s, sy, sz: s, shade: SH });
  const BOX = new THREE.BoxGeometry(1, 1, 1); const OCT = new THREE.OctahedronGeometry(0.5, 0);
  const ANGULAR_STAND = { block: [trunk(1.6, 0.22), facet(BOX, 0x6fae4f, 0, 2.6, 0, 2.2, 1.9)], stack: [trunk(1.4, 0.2), facet(BOX, 0xc0504d, 0, 2.0, 0, 1.6, 0.9), facet(BOX, 0xd0645a, 0, 2.9, 0, 1.2, 0.9)], spire: [trunk(1.2, 0.18), facet(OCT, 0x4f8f5a, 0, 2.7, 0, 1.4, 3.2)] };
  for (const name of ANGULAR_TREES) {
    const list = trees.filter((t) => angularTree(t) === name && !globalThis.IslandTerrain.harvestTrees().some(h => h.x === t.x && h.z === t.z)); if (!list.length) continue;
    instanced(mergeColored(ANGULAR_STAND[name]), natureMat, list, (t) => setM(t.x, onMesh(t.x, t.z) - 0.05, t.z, t.s * (0.9 + hash(t.x, t.z, 1) * 0.2), t.s * (0.85 + hash(t.x, t.z, 2) * 0.35), hash(t.x, t.z, 3) * TAU),
      { cell: 60, color: (t, c) => c.setHSL(0.02 * (hash(t.x, t.z, 4) - 0.5), 0.12, 0.9 + hash(t.x, t.z, 5) * 0.14), target: [`angular.tree_${name}`] });
  }
  for (const t of globalThis.IslandTerrain.harvestTrees()) {
    const root=new THREE.Group(); root.position.set(t.x,ground(t.x,t.z),t.z); root.rotation.y=t.yaw; scene.add(root);
    const fallback=new THREE.Mesh(keep(mergeColored(TREE_KINDS[0][2])),natureMat); root.add(fallback); assets.attach('tree.harvest',root,fallback);
  }
  for (const t of trees) solids.push({ nature: true, x: t.x, z: t.z, r: globalThis.IslandTerrain.harvestTrees().some(h => h.x === t.x && h.z === t.z) ? 0.5 * t.s : 0.75 * t.s }); // (문제 기록 13: a fruit tree's trunk, not 0.2 -- one walked into it)

  // Flowers: one mesh, each a little bloom with its colour per copy.
  const flowerColors = [0xff9ec7, 0xffe27a, 0xffffff, 0xc4a5ff, 0xff8f8f];
  const bloom = mergeColored([part(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 4), 0x5f9e4f, 0, 0.11, 0), part(new THREE.SphereGeometry(0.5, 6, 3), 0xffffff, 0, 0.24, 0, { sx: 0.24, sy: 0.14, sz: 0.24 })]);
  // v1.10.29: each colour its own model (nature.flower.<colour>: tulip, daisy, wildflowers, lavender, poppy), never one
  // model tinted -- a tint would colour the leaves too. Without models the five lists bake together as one did.
  for (let k = 0; k < flowerColors.length; k += 1) {
    instanced(bloom, natureMat, flowers.filter((f) => f.c === k && settled(f)), (f) => setM(f.x, onMesh(f.x, f.z), f.z, 0.8 + hash(f.x, f.z) * 0.5, undefined, hash(f.z, f.x) * TAU), { shadow: false, cell: 60, color: (f, c) => c.set(flowerColors[f.c]), target: [`nature.flower.${k}`, 'nature.flower'] });
  }
  // Bushes: round clusters of a few blobs (two shapes), darker underneath, each tinted a little.
  const BUSH_KINDS = [
    [crown(SPH, 0x6fbf5e, 0, 0.42, 0, 1.6, 1.05), crown(SPH, 0x7cc86a, 0.55, 0.35, 0.25, 1.05, 0.8), crown(SPH, 0x83cf6c, -0.5, 0.32, -0.15, 0.95, 0.7)],
    [crown(SPH, 0x66b85a, 0, 0.36, 0, 1.3, 0.85), crown(SPH, 0x74c463, 0.6, 0.3, 0, 1.0, 0.7), crown(SPH, 0x7cc86a, -0.55, 0.28, 0.2, 0.95, 0.65), crown(SPH, 0x8ad27a, 0.05, 0.62, 0.1, 0.8, 0.55)],
  ];
  const bushKind = (b) => { const h = hash(b.x, b.z, 6); return h < 0.34 ? 0 : h < 0.67 ? 1 : 2; }; // (묶음 5: the third the angular bush)
  instanced(mergeColored([facet(OCT, 0x6fae4f, 0, 0.5, 0, 1.3, 1.1), facet(BOX, 0x7cbc5c, 0.35, 0.35, 0.1, 0.7, 0.6)]), natureMat, bushes.filter((b) => bushKind(b) === 2),
    (b) => setM(b.x, onMesh(b.x, b.z) - 0.04, b.z, b.s * 0.95, b.s * (0.8 + hash(b.x, b.z, 7) * 0.3), hash(b.x, b.z, 8) * TAU), { cell: 60, color: (b, c) => c.setHSL(0.02 * (hash(b.x, b.z, 9) - 0.5), 0.1, 0.88 + hash(b.x, b.z, 10) * 0.16), target: ['angular.bush'] });
  BUSH_KINDS.forEach((parts, k) => instanced(mergeColored(parts), natureMat, bushes.filter((b) => bushKind(b) === k),
    (b) => setM(b.x, onMesh(b.x, b.z) - 0.04, b.z, b.s * 0.95, b.s * (0.8 + hash(b.x, b.z, 7) * 0.3), hash(b.x, b.z, 8) * TAU), { cell: 60, color: (b, c) => c.setHSL(0.02 * (hash(b.x, b.z, 9) - 0.5), 0.1, 0.88 + hash(b.x, b.z, 10) * 0.16), target: [`nature.bush.${k}`, 'nature.bush'] }));
  for (const b of bushes) solids.push({ nature: true, x: b.x, z: b.z, r: 0.75 * b.s });
  // Grass: small clumps of soft blades (not spikes), lighter at the tips.
  const blade = (rx, rz, h) => part(new THREE.ConeGeometry(0.05, h, 3, 1, true), 0x7cbf5c, Math.sin(rz) * h * 0.25, h / 2, -Math.sin(rx) * h * 0.25, { rx, rz, shade: [0.7, 1.15] });
  const clump = keep(mergeColored([blade(0, 0, 0.42), blade(0.35, 0.3, 0.34), blade(-0.3, -0.35, 0.32)]));
  // v1.10.31 잡초 채집: the island's tufts are the weeds now -- drawn by the scene from the server's list (pulled ones
  // gone, new ones grown at midnight), with this shape when the weed model is not there (plaza-scene setWeeds)
  void tufts;

  const pebble = keep(mergeColored([part(new THREE.IcosahedronGeometry(1, 0), 0xffffff, 0, 0, 0, { shade: [0.8, 1.05] })])); // white, tinted per copy
  // v1.10.20: three rock shapes for models (round, wide, tall), each rock's from its place; without models the three
  // lists bake together exactly as one did
  // v1.10.32 해안 돌: about half the rocks on the beaches (not the cliffs) are a low cluster of shore stones (04 pack),
  // lying along the shoreline, in the same places -- nothing new to walk round
  const shoreStones = (r) => cliffAt(r.x, r.z) < 0.4 && hash(r.x, r.z, 31) < 0.5;
  // 묶음 5: the purple crystal heap at three places (the inland rocks lowest by their hash), and some inland rocks angular
  const inland = rocks.filter((r) => !shoreStones(r)); const crystals = new Set(inland.slice().sort((a, b) => hash(a.x, a.z, 43) - hash(b.x, b.z, 43)).slice(0, 3));
  const ANGULAR_ROCKS = ['rock_lump', 'rock_small', 'rock_block'];
  const angularRock = (r) => (crystals.has(r) ? 'rock_stack' : hash(r.x, r.z, 41) < 0.3 ? ANGULAR_ROCKS[Math.min(2, Math.floor(hash(r.x, r.z, 42) * 3))] : null);
  for (const name of [...ANGULAR_ROCKS, 'rock_stack']) instanced(pebble, natureMat, inland.filter((r) => angularRock(r) === name && settled(r)), (r) => setM(r.x, onMesh(r.x, r.z) + (name === 'rock_stack' ? 0 : 0.1), r.z, r.s, r.s * 0.7, r.r),
    { cell: 60, color: (r, c) => c.set(name === 'rock_stack' ? 0x9b7fd6 : name === 'rock_block' ? 0xd99a9a : 0xb8b0a4), target: [`angular.${name}`] });
  for (let k = 0; k < 3; k += 1) {
    instanced(pebble, natureMat, rocks.filter((r) => settled(r) && !shoreStones(r) && !angularRock(r) && Math.min(2, Math.floor(hash(r.x, r.z, 17) * 3)) === k), (r) => setM(r.x, onMesh(r.x, r.z) + 0.1, r.z, r.s, r.s * 0.7, r.r),
      { cell: 60, color: (r, c) => c.set(0xb8b0a4).offsetHSL(0, 0, (hash(r.x, r.z, 13) - 0.5) * 0.12), target: [`nature.rock.${k}`, 'nature.rock'] });
  }
  instanced(pebble, natureMat, rocks.filter(shoreStones), (r) => setM(r.x, onMesh(r.x, r.z) + 0.1, r.z, r.s, r.s * 0.7, -(Math.atan2(r.z, r.x) + Math.PI / 2)),
    { cell: 60, color: (r, c) => c.set(0xb8b0a4).offsetHSL(0, 0, (hash(r.x, r.z, 13) - 0.5) * 0.12), target: ['nature.shoreStones', 'nature.rock.1', 'nature.rock'] });
  instanced(new THREE.CylinderGeometry(0.08, 0.1, 1, 6), post, posts, (p) => setM(p.x, onMesh(p.x, p.z) + 0.5, p.z, 1));
  // 묶음 5: reeds on the river's and the lake's banks (decoration -- nothing to walk round), cliff pieces on the cliff
  // edges facing the sea (walked round: there is no going over the edge anyway)
  const Dm = T.dalmaru;
  if (Dm?.riverDist) {
    const reeds = []; const cliffs = [];
    for (let x = -160; x < 160; x += 2) for (let z = -160; z < 200; z += 2) {
      if (coastDist(x, z) < 3 || walkDist(x, z) < 1.4 || onBridge(x, z) || hash(x, z, 44) > 0.4) continue;
      const r = Dm.riverDist(x, z); const l = Dm.lakeDist(x, z); if ((r > 0.2 && r < 1.6) || (l > 0.2 && l < 1.6)) reeds.push({ x: x + (hash(x, z, 45) - 0.5), z: z + (hash(x, z, 46) - 0.5), k: Math.min(3, Math.floor(hash(x, z, 47) * 4)) });
    }
    for (let a = 0; a < TAU; a += TAU / 220) {
      for (let rad = 60; rad < 200; rad += 1.5) { const x = Math.cos(a) * rad; const z = Math.sin(a) * rad; const cd = coastDist(x, z); if (cd > 1.2 && cd < 2.6 && cliffAt(x, z) > 0.7 && walkDist(x, z) > 3 && !cliffs.some((c) => Math.hypot(c.x - x, c.z - z) < 14)) { cliffs.push({ x, z, yaw: -a + Math.PI / 2, k: cliffs.length % 2 }); break; } }
    }
    const reedGeo = mergeColored([part(new THREE.CylinderGeometry(0.02, 0.03, 0.55, 4), 0x7a9a4a, 0, 0.27, 0), part(new THREE.CylinderGeometry(0.02, 0.03, 0.45, 4), 0x86a656, 0.08, 0.22, 0.04)]);
    for (let k = 0; k < 4; k += 1) instanced(reedGeo, natureMat, reeds.filter((r) => r.k === k), (r) => setM(r.x, onMesh(r.x, r.z) - 0.02, r.z, 1, 1, hash(r.x, r.z, 48) * TAU), { shadow: false, cell: 60, target: [`angular.grass_${'abcd'[k]}`] });
    for (let k = 0; k < 2; k += 1) instanced(mergeColored([facet(BOX, 0x8f8a7c, 0, 0.8, 0, 2.4, 1.6)]), natureMat, cliffs.filter((c) => c.k === k), (c) => setM(c.x, ground(c.x, c.z) - 0.2, c.z, 1, 1, c.yaw), { cell: 60, target: [`angular.cliff_${'ab'[k]}`] });
    for (const c of cliffs) solids.push({ nature: true, x: c.x, z: c.z, r: 1.2 });
  }

  // The edges of the walks and the stream banks: a soft scatter of pebbles, grass and a few flowers instead of a cut
  // line (decoration only -- nothing here is walked around). Spaced from each curve, so they follow every walk.
  const edgeStones = []; const edgeTiles = []; const edgeSeason = []; const edgeFlowers = [];
  const busy = (x, z) => T.inTownhall(x, z, 2) || Math.hypot(x, z) < PLAZA_R + 1.5 || Math.hypot(x, z + 44) < 10 || onBridge(x, z) || BUILDINGS.some((s) => Math.hypot(x - s.x, z - s.z) < 4.5);
  const along = (pts, step, fn) => { let acc = 0; for (let i = 1; i < pts.length; i += 1) { const [x0, z0] = pts[i - 1]; const [x1, z1] = pts[i]; const l = Math.hypot(x1 - x0, z1 - z0); acc += l; if (acc < step) continue; acc = 0; fn(x1, z1, (x1 - x0) / (l || 1), (z1 - z0) / (l || 1), i); } };
  // v1.10.73: the walks' own edges are the path tiers below (the stream banks keep their soft scatter)
  // (달마루섬: its rivers -- straight runs, cut into half-metre points -- the scatter on the bank's top, past its cut)
  const banks = T.dalmaru ? T.dalmaru.RIVERS.map((r) => ({ half: r.w / 2 + 2.05, rock: r.w / 2 - 0.6, pts: r.pts.slice(1).flatMap(([x1, z1], k) => { const [x0, z0] = r.pts[k]; const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.5)); return Array.from({ length: n }, (_, j) => [x0 + ((x1 - x0) * (j + 1)) / n, z0 + ((z1 - z0) * (j + 1)) / n]); }) }))
    : streamCurves.map((pts) => ({ pts, half: STREAM_HALF, rock: 0.75 }));
  banks.forEach(({ pts: st, half }, si) => along(st, 1.1, (x, z, dx, dz, i) => {
    if (coastDist(x, z) < 3) return;
    for (const side of [-1, 1]) {
      const h = hash(x, z + side, si + 7); const off = half + 0.35 + hash(x, z, i) * 0.7; const px = x - dz * off * side; const pz = z + dx * off * side;
      if (busy(px, pz) || walkDist(px, pz) < 0.3 || (T.dalmaru && !walkable(px, pz))) continue;
      if (h < 0.35) edgeStones.push({ x: px, z: pz, s: 0.14 + hash(px, pz) * 0.18 });
      else if (h < 0.6) {
        if (hash(px, pz, 37) < 0.06) edgeSeason.push({ x: px, z: pz, s: 0.18, r: -Math.atan2(dz, dx), v: 2 });
        else edgeStones.push({ x: px, z: pz, s: 0.16 });
      }
      else if (h < 0.8) edgeFlowers.push({ x: px, z: pz, c: Math.floor(h * 50) % 5 });
    }
  }));
  const bendRocks = [];
  banks.forEach(({ pts: st, rock }) => { for (let i = 6; i < st.length - 6; i += 3) { // (rock: how far out from the middle, on the outer bank)
    const [ax, az] = st[i - 3]; const [bx, bz] = st[i]; const [cx, cz] = st[i + 3];
    const turn = Math.abs(wrap(Math.atan2(cz - bz, cx - bx) - Math.atan2(bz - az, bx - ax)));
    if (turn < 0.16 || coastDist(bx, bz) < 4 || bendRocks.some((r) => Math.hypot(r.x - bx, r.z - bz) < 12) || bridges.some((b) => Math.hypot(b.x - bx, b.z - bz) < 5)) continue;
    const l = Math.hypot(cx - ax, cz - az) || 1; const side = wrap(Math.atan2(cz - bz, cx - bx) - Math.atan2(bz - az, bx - ax)) > 0 ? -1 : 1; // the outer bank
    bendRocks.push({ x: bx - ((cz - az) / l) * rock * side, z: bz + ((cx - ax) / l) * rock * side, s: 0.32 + hash(bx, bz) * 0.15, along: -Math.atan2(cz - az, cx - ax) });
  } });
  // v1.10.32 강둑 돌: the stones on the outer bank of each bend are the made bank stones (04 pack), along the stream
  const bedAt = (T.dalmaru ? ground : land); // (달마루섬: the river's own bed)
  instanced(pebble, natureMat, bendRocks, (r) => setM(r.x, Math.max(-0.58, bedAt(r.x, r.z) - 0.45) + 0.05, r.z, r.s, r.s * 0.7, r.along), { cell: 60, color: (r, c) => c.set(0xb8b0a4), target: 'nature.riverBank' });
  const foam = keep(new THREE.MeshStandardMaterial({ color: 0xe9f7ff, roughness: 0.6, transparent: true, opacity: 0.55, depthWrite: false }));
  // 달마루섬 5단계 폭포: at each pool a sheet from the ridge's lip (the steepest way up from the pool) down to its water,
  // the river's water texture running down it, foam where it lands and a little spray
  let fallTex = null; const falls = [];
  if (T.dalmaru) {
    fallTex = keep(flowTex.clone()); fallTex.needsUpdate = true; fallTex.repeat.set(1.5, 3);
    const fallMat = keep(new THREE.MeshStandardMaterial({ color: 0xe6f6ff, map: fallTex, roughness: 0.3, metalness: 0, transparent: true, opacity: 0.88, side: THREE.DoubleSide }));
    const sprayMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, transparent: true, opacity: 0.35, depthWrite: false }));
    const puffGeo = keep(new THREE.SphereGeometry(0.7, 10, 8)); const ringGeo = keep(new THREE.RingGeometry(1.2, 2.6, 24).rotateX(-Math.PI / 2)); const SEA_Y = T.dalmaru.SEA;
    const pondMat = keep(new THREE.MeshStandardMaterial({ color: 0x7ec8e8, map: fallTex, roughness: 0.25, metalness: 0, transparent: true, opacity: 0.9 }));
    for (const F of T.dalmaru.FALLS) { // (the fall's way and lip: dalmaru-terrain FALLS, the pond over it with them -- 2회차 18)
      const p = F.pool; const { ux, uz, lip } = F; const top = F.pond.y - 0.03; const vx = -uz; /* (the sheet starts at the pond's water) */ const vz = ux; const hw = p.hw || 2.2; const foot = p.r - 1.2; const big = hw / 2.2;
      const pond = new THREE.Mesh(keep(new THREE.CircleGeometry(F.pond.r + 0.25, 28).rotateX(-Math.PI / 2)), pondMat); pond.position.set(F.pond.x, F.pond.y, F.pond.z); pond.name = 'headPond'; scene.add(pond); // (the sheet in front of the cliff, from where it has risen all the way -- from p.r + 3.4 it lay inside the steep face)
      const pos = []; for (const [d, y] of [[foot, SEA_Y + 0.02], [lip, top + 0.05]]) for (const side of [-1, 1]) pos.push(p.x + ux * d + vx * hw * side, y, p.z + uz * d + vz * hw * side);
      const g = keep(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2)); g.setIndex([0, 1, 2, 2, 1, 3]); g.computeVertexNormals();
      const sheet = new THREE.Mesh(g, fallMat); sheet.name = 'waterfall'; scene.add(sheet);
      const ring = new THREE.Mesh(ringGeo, foam); ring.position.set(p.x + ux * (foot - 1), SEA_Y + 0.03, p.z + uz * (foot - 1)); ring.scale.set(big, 1, big); scene.add(ring);
      const n = Math.round(big); const puffs = []; for (let k = -n; k <= n; k += 1) { const m = new THREE.Mesh(puffGeo, sprayMat); m.position.set(p.x + ux * (foot - 0.8) + vx * k * 1.3, SEA_Y + 0.5, p.z + uz * (foot - 0.8) + vz * k * 1.3); m.userData.s = Math.sqrt(big); scene.add(m); puffs.push(m); }
      falls.push({ sheet, puffs });
    }
  }
  instanced(new THREE.RingGeometry(0.85, 1.25, 16).rotateX(-Math.PI / 2), foam, bendRocks, (r) => setM(r.x, Math.max(-0.58, bedAt(r.x, r.z) - 0.45) + 0.02, r.z, r.s * 1.1, 1, r.x), { shadow: false, cell: 60 });
  instanced(pebble, natureMat, edgeStones, (r) => setM(r.x, onMesh(r.x, r.z) + 0.02, r.z, r.s, r.s * 0.55, r.x * 3), { shadow: false, cell: 60, color: (r, c) => c.set(0xcfc6b6).offsetHSL(0, 0, (hash(r.x, r.z, 14) - 0.5) * 0.14) });
  // v1.10.73 마을 환경정비사업 ① 길 3단계 (IDEAS #future-path-tiers): laid along each walk's one centre line instead of the
  // random kerb tiles, pebbles and flowers -- 마을 길 (the hall, the shop street, and the walks within TOWN_R of the plaza):
  // marble slabs with a terrazzo slab here and there and a continuous marble border on both sides; 산책로 (the ring and
  // the walks beyond the town): an edge band that breaks into the grass; 오솔길 (the nature area, the gazebo): stepping
  // stones. A junction outside the plaza is one round disc; where the town's walk turns into a 산책로 a pair of planters
  // marks the way in. Decoration only: nothing here is walked round (the kerbs' old rule).
  const pathParts = { slab: [], terrazzo: [], border: [], edge: [], step: [], disc: [], planter: [] };
  const opening = (wi, x, z, pad) => walkCurves.some((o, oi) => oi !== wi && o.pts.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < o.w / 2 + pad)); // another walk joins here
  // junctions: where one walk meets another outside the plaza (joins and crossings), one disc each
  walkCurves.forEach((w, wi) => w.pts.forEach(([x, z]) => {
    if (offPath(x, z) || pathParts.disc.some((d) => Math.hypot(d.x - x, d.z - z) < 7)) return;
    const other = walkCurves.findIndex((o, oi) => oi > wi && o.pts.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < 0.9));
    if (other >= 0) pathParts.disc.push({ x, z, town: tierAt(wi, x, z) === 'town' || tierAt(other, x, z) === 'town' });
  }));
  const buskDisc = T.dalmaru?.PLACES.busk ? [{ x: T.dalmaru.PLACES.busk.x, z: T.dalmaru.PLACES.busk.z, s: 1.2 }] : []; // (거리 악단 자리: a town disc 6 m across)
  const nearDisc = (x, z, r) => pathParts.disc.some((d) => Math.hypot(d.x - x, d.z - z) < r);
  walkCurves.forEach((w, wi) => {
    let s = 0; let n = 0; let was = null;
    for (let i = 1; i < w.pts.length; i += 1) {
      const [x0, z0] = w.pts[i - 1]; const [x1, z1] = w.pts[i]; const l = Math.hypot(x1 - x0, z1 - z0); if (!l) continue;
      const dx = (x1 - x0) / l; const dz = (z1 - z0) / l; const r = -Math.atan2(dz, dx);
      for (; s <= l; s += 0.9, n += 1) {
        const x = x0 + dx * s; const z = z0 + dz * s; const tier = tierAt(wi, x, z);
        if (was && was !== tier && (was === 'town' || tier === 'town')) for (const side of [-1, 1]) { const o = w.w / 2 + 0.9; pathParts.planter.push({ x: x - dz * o * side, z: z + dx * o * side, r }); }
        was = tier;
        if (offPath(x, z) || nearDisc(x, z, 2.2)) continue;
        if (tier === 'town') {
          const cols = Math.max(1, Math.round(w.w - 0.4)); // 3.2 m: three 1 m slabs and the borders
          for (let c = 0; c < cols; c += 1) {
            const o = c - (cols - 1) / 2; const px = x - dz * o; const pz = z + dx * o;
            (c === (cols >> 1) && n % 8 === 4 ? pathParts.terrazzo : pathParts.slab).push({ x: px, z: pz, r: r + (hash(pz, px, 4) < 0.5 ? 0 : Math.PI), v: Math.floor(hash(px, pz, 5) * 2) }); // two slabs, either way round
          }
          for (const side of [-1, 1]) {
            const o = cols / 2 + 0.15; const px = x - dz * o * side; const pz = z + dx * o * side;
            if (!opening(wi, px, pz, 0.4) && walkable(px, pz)) pathParts.border.push({ x: px, z: pz, r });
          }
        } else if (tier === 'walk') {
          for (const side of [-1, 1]) {
            const o = w.w / 2 + 0.05; const px = x - dz * o * side; const pz = z + dx * o * side;
            if (!opening(wi, px, pz, 0.3) && walkable(px, pz)) pathParts.edge.push({ x: px, z: pz, r: side > 0 ? r : r + Math.PI, v: Math.floor(hash(px, pz, 6) * 2) });
          }
        } else {
          const o = (hash(x, z, 8) - 0.5) * 0.5; pathParts.step.push({ x: x - dz * o, z: z + dx * o, r: hash(x, z, 9) * TAU, v: Math.floor(hash(x, z, 7) * 2), s: 0.92 + hash(z, x, 3) * 0.16 });
        }
      }
      s -= l;
    }
  });
  // (달마루섬: a walk is one tier end to end -- the planters mark a 산책로 or 오솔길 where it leaves a town walk, 4.2 m in)
  if (T.dalmaru) walkCurves.forEach((w, wi) => { if (w.tier === 'town') return; for (const end of [0, w.pts.length - 1]) {
    const [ex, ez] = w.pts[end]; if (!walkCurves.some((o, oi) => oi !== wi && o.tier === 'town' && o.pts.some(([ox, oz]) => Math.hypot(ox - ex, oz - ez) < o.w / 2 + 0.9))) continue;
    const [nx, nz] = w.pts[end ? Math.max(0, end - 4) : Math.min(w.pts.length - 1, 4)]; const l = Math.hypot(nx - ex, nz - ez) || 1; const dx = (nx - ex) / l; const dz = (nz - ez) / l;
    const x = ex + dx * 4.2; const z = ez + dz * 4.2; // (past the junction's disc: none within 3.4 of one)
    for (const side of [-1, 1]) { const o = w.w / 2 + 0.9; const px = x - dz * o * side; const pz = z + dx * o * side; if (walkable(px, pz)) pathParts.planter.push({ x: px, z: pz, r: -Math.atan2(dz, dx) }); }
  } });
  const onGround = (x, z) => T.meshGroundHeight(x, z);
  // (문제 기록 2회차 3 「길이 군데군데 파인 곳이 많아」: laid flat at its middle's height, a 1 m slab on a slope had its
  // uphill half under the grass -- each piece now leans with the ground under it, PAVE_LIFT over it)
  const tilt = new THREE.Quaternion(); const yawQ = new THREE.Quaternion(); const nUp = new THREE.Vector3(); const Y = new THREE.Vector3(0, 1, 0);
  // (a 5 m disc: its slope read 1 m apart, and raised by the most the ground rises over that plane within its round)
  const placeFlat = (lift, { e = 0.5, round = 0 } = {}) => (p) => {
    const g0 = onGround(p.x, p.z); const gx = (onGround(p.x + e, p.z) - onGround(p.x - e, p.z)) / (2 * e); const gz = (onGround(p.x, p.z + e) - onGround(p.x, p.z - e)) / (2 * e);
    let over = 0; for (let k = 0; round && k < 32; k += 1) for (const f of [0.5, 1]) { const x = p.x + Math.cos((k / 32) * TAU) * round * f; const z = p.z + Math.sin((k / 32) * TAU) * round * f; over = Math.max(over, onGround(x, z) - g0 - gx * (x - p.x) - gz * (z - p.z)); }
    tilt.setFromUnitVectors(Y, nUp.set(-gx, 1, -gz).normalize()); yawQ.setFromAxisAngle(Y, p.r ?? 0); q.copy(tilt).multiply(yawQ);
    const s = p.s ?? 1; m4.compose(v3.set(p.x, g0 + PAVE_LIFT + lift + over, p.z), q, sc.set(s, 1, s));
  };
  // Without a piece's model (switched off, not registered) nothing stands in: the walk strips above already show each
  // tier's colour, and thousands of merged stand-ins slowed the island's start on a software-rendered runner
  const none = keep(mergeColored([part(G.box, 0xe9e3d5, 0, -0.5, 0, { sx: 0.01, sy: 0.01, sz: 0.01 })])); // under the ground
  const PATH_CELL = 120; // big cells: the pieces are many and flat, so fewer draws matter more than finer culling
  const lay = (id, list, place, { shadow = false, parent = scene } = {}) => { if (list.length && assets?.wants(id)) instanced(none, natureMat, list, place, { shadow, cell: PATH_CELL, target: id, parent }); };
  // ponytail: two variants of each (of the made three or four) -- each variant is a draw per cell; add more if the
  // pattern reads repetitive on a real GPU
  for (let k = 0; k < 2; k += 1) lay(`path.town.slab.${'ab'[k]}`, pathParts.slab.filter((p) => p.v === k), placeFlat(0));
  lay('path.town.terrazzo.a', pathParts.terrazzo, placeFlat(0));
  lay('path.town.border.straight', pathParts.border, placeFlat(0));
  for (let k = 0; k < 2; k += 1) lay(`path.walk.edge.${'ac'[k]}`, pathParts.edge.filter((p) => p.v === k), placeFlat(0));
  for (let k = 0; k < 2; k += 1) lay(`path.trail.step.${'ab'[k]}`, pathParts.step.filter((p) => p.v === k), placeFlat(0));
  const onDisc = placeFlat(0.01, { e: 1, round: 2.5 });
  lay('path.junction.disc.town', pathParts.disc.filter((d) => d.town), onDisc);
  lay('path.junction.disc.town', buskDisc, placeFlat(0.02, { e: 1.5, round: 3 })); // (over the walk's slabs where it meets them)
  lay('path.junction.disc.walk', pathParts.disc.filter((d) => !d.town), onDisc);
  lay('path.gate.planter', pathParts.planter.filter((p) => walkable(p.x, p.z) && !offPath(p.x, p.z) && !nearDisc(p.x, p.z, 3.4)), placeFlat(0), { shadow: true });
  instanced(bloom, natureMat, edgeFlowers, (f) => setM(f.x, onMesh(f.x, f.z), f.z, 0.5, undefined, f.x), { shadow: false, cell: 60, color: (f, c) => c.set(flowerColors[f.c]) });

  const nm = new THREE.Matrix3(); const pv = new THREE.Vector3(); const nv = new THREE.Vector3();
  for (const [key, copies] of baked) {
    let count = 0; for (const c of copies) count += c.geometry.attributes.position.count;
    const pos = new Float32Array(count * 3); const nor = new Float32Array(count * 3); const col = new Float32Array(count * 3);
    let o = 0;
    for (const { geometry, matrix, color } of copies) {
      const P = geometry.attributes.position.array; const N = geometry.attributes.normal.array; const C = geometry.attributes.color.array;
      nm.getNormalMatrix(matrix);
      const r = color ? color.r : 1; const g = color ? color.g : 1; const b = color ? color.b : 1;
      for (let i = 0; i < P.length; i += 3) {
        pv.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(matrix); nv.set(N[i], N[i + 1], N[i + 2]).applyMatrix3(nm).normalize();
        pos[o] = pv.x; pos[o + 1] = pv.y; pos[o + 2] = pv.z; nor[o] = nv.x; nor[o + 1] = nv.y; nor[o + 2] = nv.z;
        col[o] = C[i] * r; col[o + 1] = C[i + 1] * g; col[o + 2] = C[i + 2] * b; o += 3;
      }
    }
    const geo = keep(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, natureMat); m.castShadow = key.split(',')[2] === '1'; m.receiveShadow = true; scene.add(m);
  }

  // Lamps along the main walks, benches beside them.
  // v1.10.29: placed on the ground (the pole and the bulb lifted in their geometry), so the lamp model (prop.lamp, the
  // plaza's too) can take their place
  const lampBulb = mat(0xfff3c2, { emissive: 0xffe08a, emissiveIntensity: 0.6 }); // v1.10.38: orange in October (plaza-scene)
  instanced(new THREE.CylinderGeometry(0.08, 0.11, 2.6, 8).translate(0, 1.3, 0), mat(0x4d6b5c), lampSpots, (p) => setM(p.x, onMesh(p.x, p.z), p.z, 1),
    { target: 'prop.lamp', extra: [[new THREE.SphereGeometry(0.24, 12, 9).translate(0, 2.72, 0), lampBulb, false]] });
  for (const p of lampSpots) solids.push({ nature: true, x: p.x, z: p.z, r: 0.3 }); // (instanced like the trees: mapCheck counts them as drawn)
  // v1.10.29 지면 레이어: low flat drifts of the zone's season -- spring petals, summer clover, autumn leaves, winter
  // snow (deco.layer.*: three shapes) -- on level open grass inside the zones only (not the plaza, walks, water, banks,
  // shores, bridges, building yards or the pond), from fixed spots. Decoration: nothing to walk round or pick up.
  // Without a model nothing is drawn (the procedural stand-in is a speck under the ground).
  const LAYERS = ['sparse', 'cluster', 'edge'];
  if (assets && LAYERS.some((v) => assets.wants(`deco.layer.${v}`))) {
    const spots = [];
    for (let gx = -120; gx <= 120; gx += 7) for (let gz = -120; gz <= 120; gz += 7) {
      const x = gx + (hash(gx, gz, 21) - 0.5) * 5; const z = gz + (hash(gz, gx, 22) - 0.5) * 5;
      if (hash(x, z, 23) > 0.42 || Math.hypot(x, z) < T.SEASON_NEUTRAL_R + 3 || !walkable(x, z) || coastDist(x, z) < 6 || cliffAt(x, z) > 0.2) continue;
      if (walkDist(x, z) < 3.5 || streamDist(x, z) < STREAM_HALF + 2 || onBridge(x, z) || BUILDINGS.some((b) => Math.hypot(x - b.x, z - b.z) < 6) || Math.hypot(x - POND.x, z - POND.z) < POND.r + 3) continue;
      const h = ground(x, z); if ([[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]].some(([dx, dz]) => Math.abs(ground(x + dx, z + dz) - h) > 0.12)) continue; // level ground only
      spots.push({ x, z, v: Math.min(2, Math.floor(hash(x, z, 24) * 3)), r: hash(x, z, 25) * TAU });
    }
    const speck = keep(mergeColored([part(G.box, 0x9fd67f, 0, -0.5, 0, { sx: 0.01, sy: 0.01, sz: 0.01 })]));
    spots.push(...edgeSeason);
    LAYERS.forEach((v, k) => instanced(speck, natureMat, spots.filter((p) => p.v === k), (p) => setM(p.x, onMesh(p.x, p.z) + 0.005, p.z, p.s ?? 1, p.s ?? 1, p.r), { shadow: false, cell: 60, target: `deco.layer.${v}` }));
  }
  let coverCount = null;
  // v1.10.73 마을 환경정비사업 ② 땅 다듬기 (IDEAS #future-ground-cover): by quality tier -- 0 the ground's colours only
  // (the woods' floor is painted darker under the trees above), 1 + flat cover (open grass: its zone's season --
  // petals, clover, leaves, snow; under the trees: moss), 2 + low plants near the woods (ferns, shrubs, flower clumps).
  // Never a tuft of grass (the weeds you pull look like that). Off the walks, water, banks, shores, yards, the plaza and
  // the pond, on level ground, from fixed spots; decoration only. With the models off nothing is drawn.
  const coverFlat = new THREE.Group(); const coverLow = new THREE.Group(); scene.add(coverFlat, coverLow);
  const COVER = ['ground.season', 'ground.moss', 'ground.fern', 'ground.shrub', 'ground.flowers'];
  if (assets && COVER.some((id) => assets.wants(id))) {
    const flat = { season: [], moss: [] }; const low = { fern: [], shrub: [], flowers: [] };
    for (let gx = -118; gx <= 118; gx += 3.5) for (let gz = -118; gz <= 118; gz += 3.5) {
      const x = gx + (hash(gx, gz, 41) - 0.5) * 2.6; const z = gz + (hash(gz, gx, 42) - 0.5) * 2.6;
      if (Math.hypot(x, z) < T.SEASON_NEUTRAL_R + 3 || !walkable(x, z) || coastDist(x, z) < 5 || cliffAt(x, z) > 0.2) continue;
      if (walkDist(x, z) < 3 || streamDist(x, z) < STREAM_HALF + 1.6 || onBridge(x, z) || T.inTownhall(x, z, 2) || BUILDINGS.some((b) => Math.hypot(x - b.x, z - b.z) < 6) || Math.hypot(x - POND.x, z - POND.z) < POND.r + 2.5) continue;
      const h = ground(x, z); if ([[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]].some(([dx, dz]) => Math.abs(ground(x + dx, z + dz) - h) > 0.12)) continue;
      const woods = forestAt(x, z); const r = hash(x, z, 43) * TAU; const s = 0.85 + hash(z, x, 44) * 0.4; const k = hash(x, z, 45);
      if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 1.3)) continue; // not on a trunk
      if (woods > 0.25) {
        if (k < 0.5) flat.moss.push({ x, z, r, s: s * 1.3 });
        else if (k < 0.78) low.fern.push({ x, z, r, s });
        else if (k < 0.88) low.shrub.push({ x, z, r, s: s * 0.9 });
      } else if (k < 0.45) flat.season.push({ x, z, r, s: s * 1.2 });
      else if (k < 0.52 && woods > 0.05) low.flowers.push({ x, z, r, s });
    }
    const speck = keep(mergeColored([part(G.box, 0x9fd67f, 0, -0.5, 0, { sx: 0.01, sy: 0.01, sz: 0.01 })])); // under the ground: nothing without a model
    const lay = (list, id, parent) => instanced(speck, natureMat, list, (p) => setM(p.x, onMesh(p.x, p.z) + 0.005, p.z, p.s, p.s, p.r), { shadow: false, cell: PATH_CELL, target: id, parent });
    lay(flat.season, 'ground.season', coverFlat); lay(flat.moss, 'ground.moss', coverFlat);
    lay(low.fern, 'ground.fern', coverLow); lay(low.shrub, 'ground.shrub', coverLow); lay(low.flowers, 'ground.flowers', coverLow);
    coverCount = { season: flat.season.length, moss: flat.moss.length, fern: low.fern.length, shrub: low.shrub.length, flowers: low.flowers.length };
  }
  const setCoverQuality = (tier) => { coverFlat.visible = tier >= 1; coverLow.visible = tier >= 2; grainOn.value = tier >= 1 && !software ? GRAIN : 0; }; // (B 48: the grain from tier 1)
  for (const g of groups) assets.batch(g.target, [...g.cells.values()]);

  // v1.10.29 원경 (섬 밖 원경 결정 2026-10-05): far land, mountain ridges, a peak, a glacier and ice floes out at sea, well
  // past the coast (about 300-330 from the plaza) so they never stand in front of the island or its buildings; they
  // only rise over the horizon, pale with distance (the entries' haze). Not land anyone can reach.
  const FAR = [['sea.glacier', 0, -320], ['sea.floe', -80, -280], ['sea.floe', 85, -272], ['sea.ridgeSoft', 235, -225], ['sea.coastLong', 318, 75],
    ['sea.coastCove', -215, 245], ['sea.peak', -300, 95], ['sea.ridgeRugged', -305, -115]];
  for (const [id, x, z] of FAR) {
    const holder = new THREE.Group(); holder.position.set(x, -1.1, z); holder.rotation.y = Math.atan2(-x, -z); scene.add(holder); // its length across the view
    assets?.attach(id, holder, new THREE.Group());
  }

  // The map board's picture: the island as it is (coast, water, walks, areas) and where I am.
  // The island's shapes (sea, shore, grass, walks, water, plaza, harbour, bridges) at a scale `s` around a centre.
  // 달마루섬 미리보기: the new island's map drawn once from its ground (1 dot per 2 m): sand by the sea, grass, the cliff
  // rock, fresh water -- then its walks, 대청마당 and bridges on top
  let landImage = null;
  function dalmaruLand() {
    if (landImage) return landImage;
    const D = T.dalmaru; const N = 200; const cv = document.createElement('canvas'); cv.width = N; cv.height = N; const g = cv.getContext('2d'); const img = g.createImageData(N, N);
    const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
    const SEA_C = rgb(0x7fcbe9); const SAND = rgb(0xf1dfae); const GRASS = rgb(0x9fd67f); const ROCK = rgb(0xb7ad9e); const FRESH = rgb(0x5fb4e0);
    for (let j = 0; j < N; j += 1) for (let i = 0; i < N; i += 1) {
      const x = -200 + i * 2 + 1; const z = -200 + j * 2 + 1; const cd = D.coastDist(x, z);
      const c = cd < 0 ? SEA_C : D.isWater(x, z) ? FRESH : cliffAt(x, z) > 0.5 ? ROCK : cd < 4 ? SAND : GRASS;
      img.data.set([...c, 255], (j * N + i) * 4);
    }
    g.putImageData(img, 0, 0); landImage = cv; return cv;
  }
  function drawGround(ctx, w, h, X, Z, s) {
    ctx.fillStyle = '#7fcbe9'; ctx.fillRect(-2 * w, -2 * h, 5 * w, 5 * h); // the sea (wide enough for a turned minimap)
    if (T.MAP === 'dalmaru') {
      ctx.imageSmoothingEnabled = true; ctx.drawImage(dalmaruLand(), X(-200), Z(-200), 400 * s, 400 * s);
      for (const wk of walkCurves) { ctx.beginPath(); wk.pts.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z)))); ctx.strokeStyle = '#e8d2a2'; ctx.lineWidth = (wk.w + 1) * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }
      const P = T.dalmaru.PLAZA; ctx.fillStyle = '#f3e6c8'; ctx.fillRect(X(P.x - P.hw), Z(P.d0), P.hw * 2 * s, (P.d1 - P.d0) * s); ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = 2; ctx.strokeRect(X(P.x - P.hw), Z(P.d0), P.hw * 2 * s, (P.d1 - P.d0) * s);
      for (const b of bridges) { ctx.beginPath(); ctx.moveTo(X(b.x - b.ux * b.half), Z(b.z - b.uz * b.half)); ctx.lineTo(X(b.x + b.ux * b.half), Z(b.z + b.uz * b.half)); ctx.strokeStyle = '#b07a4f'; ctx.lineWidth = b.w * s; ctx.stroke(); }
      return;
    }
    const shore = (grow) => { ctx.beginPath(); for (let i = 0; i <= 180; i += 1) { const a = (i / 180) * TAU; const R = coastR(a) + grow; const px = X(Math.cos(a) * R); const pz = Z(Math.sin(a) * R); if (i) ctx.lineTo(px, pz); else ctx.moveTo(px, pz); } ctx.closePath(); };
    shore(0); ctx.fillStyle = '#f1dfae'; ctx.fill();
    shore(-5); ctx.fillStyle = '#9fd67f'; ctx.fill();
    const line = (pts, width, color) => { ctx.beginPath(); pts.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z)))); ctx.strokeStyle = color; ctx.lineWidth = width * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); };
    for (const wk of walkCurves) line(wk.pts, wk.w + 1, '#e8d2a2');
    for (const st of streamCurves) line(st, STREAM_HALF * 2 + 1, '#5fb4e0');
    line(RIVER_WIDE.pts, RIVER_WIDE.half * 2 - 2, '#5fb4e0'); // v1.10.47 the widened reach by the inner river stop
    ctx.beginPath(); ctx.arc(X(POND.x), Z(POND.z), POND.r * s, 0, TAU); ctx.fillStyle = '#5fb4e0'; ctx.fill();
    ctx.beginPath(); ctx.arc(X(0), Z(0), PLAZA_R * s, 0, TAU); ctx.fillStyle = '#f3e6c8'; ctx.fill(); ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = 2; ctx.stroke();
    line([[PIER.x - PIER.ux * PIER.half, PIER.z - PIER.uz * PIER.half], [PIER.x + PIER.ux * PIER.half, PIER.z + PIER.uz * PIER.half]], PIER.w, '#b07a4f');
    line([[BREAKWATER.x - BREAKWATER.ux * BREAKWATER.half, BREAKWATER.z - BREAKWATER.uz * BREAKWATER.half], [BREAKWATER.x + BREAKWATER.ux * BREAKWATER.half, BREAKWATER.z + BREAKWATER.uz * BREAKWATER.half]], BREAKWATER.w, '#a39b8e');
    for (const b of bridges) line([[b.x - b.ux * b.half, b.z - b.uz * b.half], [b.x + b.ux * b.half, b.z + b.uz * b.half]], b.w, '#b07a4f');
    const train = globalThis.IslandTrain;
    if (train) {
      for (const [id, L] of Object.entries(train.LINES)) {
        const { xs, zs } = L.route; const pts = []; for (let i = 0; i < xs.length; i += 4) pts.push([xs[i], zs[i]]);
        ctx.setLineDash([3 * s, 2 * s]); line(pts, 1.6, id === 'outer' ? 'rgba(70,140,210,.85)' : 'rgba(220,160,55,.85)'); ctx.setLineDash([]);
      }
      for (const st of Object.values(train.STATIONS)) { ctx.beginPath(); ctx.arc(X(st.entry[0]), Z(st.entry[1]), Math.max(3, 2.6 * s), 0, TAU); ctx.fillStyle = '#2f6fc0'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
    }
  }
  // (문제 기록 3회차 14 「안내 지도가 너무 지저분해. 크게 확대해서 볼 수 있게」) `view` { zoom, x, z }: closer in round a point
  // (the 안내 지도 window: wheel, drag, pinch). The names stay one size however close, each above its dot -- below,
  // right or left of it when that is taken, left out when all are (closer in, there is room). Returns the scale and centre it drew at.
  function drawMap(ctx, w, h, me, view = {}) {
    const zoom = view.zoom || 1; const cx = view.x || 0; const cz = view.z || 0; const u = Math.min(w, h);
    const s = (u / (T.MAP === 'dalmaru' ? 380 : 236)) * zoom; /* (달마루섬: about twice across) */ const X = (x) => w / 2 + (x - cx) * s; const Z = (z) => h / 2 + (z - cz) * s;
    drawGround(ctx, w, h, X, Z, s);
    const font = (k) => `800 ${Math.round(u / k)}px Pretendard, "Malgun Gothic", system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const taken = []; const free = (x, y, bw, bh) => !taken.some((r) => Math.abs(r.x - x) < (r.w + bw) / 2 && Math.abs(r.y - y) < (r.h + bh) / 2);
    const label = (text, px, pz, k, color, off) => {
      ctx.font = font(k); const bw = ctx.measureText(text).width + u / 60; const bh = u / k * 1.3;
      const side = bw / 2 + off * 0.7;
      const at = [[px, pz - off], [px, pz + off], [px + side, pz], [px - side, pz]].find(([x, y]) => free(x, y, bw, bh)); if (!at) return;
      const [x, y] = at; taken.push({ x, y, w: bw, h: bh });
      ctx.lineWidth = u / 110; ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
    };
    const dots = Object.values(AREAS).map((a) => [X(a.x), Z(a.z), a.label]);
    for (const [px, pz] of dots) { ctx.beginPath(); ctx.arc(px, pz, u / 70, 0, TAU); ctx.fillStyle = '#5b4632'; ctx.fill(); }
    if (me) { // mine first: never the one left out
      const mx = X(me.x); const mz = Z(me.z);
      ctx.beginPath(); ctx.arc(mx, mz, u / 46, 0, TAU); ctx.fillStyle = '#e8443c'; ctx.fill(); ctx.lineWidth = u / 160; ctx.strokeStyle = '#fff'; ctx.stroke();
      taken.push({ x: mx, y: mz, w: u / 23, h: u / 23 }); label('현재 위치', mx, mz, 34, '#b3261e', u / 22);
    }
    for (const [px, pz] of dots) taken.push({ x: px, y: pz, w: u / 35, h: u / 35 }); // (no name over another's dot)
    for (const [px, pz, text] of dots) label(text, px, pz, 30, '#3d2f22', u / 24);
    return { s, x: cx, z: cz };
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
      const lw = ctx.measureText(p.name).width; const lh = (size / 15) * 2; // (묶음 1: by each name's own width and a stroked line's height -- 「관공서」 and 「말 걸기」 touched)
      if (labels.some(([lx, lz, w]) => Math.abs(lx - px) < (w + lw) / 2 + 4 && Math.abs(lz - pz) < lh)) continue; // the dot only when names would overlap
      labels.push([px, pz, lw]);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.strokeText(p.name, px, pz - size / 18); ctx.fillStyle = '#3d2f22'; ctx.fillText(p.name, px, pz - size / 18);
    }
    ctx.font = `900 ${Math.round(size / 9)}px Pretendard, "Malgun Gothic", system-ui, sans-serif`;
    let shown = 0;
    for (const m of markers) { // v1.10.11 events: a red 「!」, only for what lies inside this round map (never beyond it)
      if (Math.hypot(m.x - me.x, m.z - me.z) > MINI_RANGE - 2) continue;
      shown += 1;
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
    return { turn, shown };
  }

  function step(clock, lessMotion = false) { if (lessMotion) clock = 0; flowTex.offset.y = -clock * 0.16; if (fallTex) { fallTex.offset.y = clock * 0.9; falls.forEach((w) => w.puffs.forEach((m, k) => m.scale.setScalar((m.userData.s || 1) * (0.8 + 0.25 * Math.sin(clock * 3 + k * 2.1))))); } foam.opacity = 0.45 + Math.sin(clock * 2.2) * 0.12; pondTex.offset.set(clock * 0.006, clock * 0.004); boats.forEach((b, i) => { b.position.y = -0.55 + Math.sin(clock * 1.3 + i) * 0.06; b.rotation.z = Math.sin(clock * 0.9 + i * 2) * 0.05; }); }
  function dispose() { disposables.forEach((d) => d.dispose?.()); }
  return { waterMotion: () => ({ flow: flowTex.offset.toArray(), pond: pondTex.offset.toArray(), foam: foam.opacity, falls: falls.length, fall: fallTex ? fallTex.offset.y : null }), groundCover: () => ({ ...coverCount, flat: coverFlat.visible, low: coverLow.visible }), setQuality: setCoverQuality, edgeDecor: { stones: edgeStones.length, tiles: pathParts.border.length, paths: Object.fromEntries(Object.entries(pathParts).map(([k, v]) => [k, v.length])), flowers: edgeFlowers.length, seasonal: edgeSeason.length, grass: 0 }, drawMap, drawMinimap, step, dispose, setSeasonDay, lampBulb, weedGeometry: clump, natureMaterial: natureMat, bridges: bridges.map(({ x, z, ux, uz, half, w }) => ({ x, z, ux, uz, half, w })), pier: { x: PIER.x, z: PIER.z, half: PIER.half } };
}
