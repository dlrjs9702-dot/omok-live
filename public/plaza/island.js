// v1.10.0 게임 아일랜드 지형: the walkable island around the central plaza. A natural coastline (bays, a cape, beaches,
// north cliffs, a harbour with a pier and a breakwater), water that starts at the plaza fountain and winds to the sea in
// four streams with small bridges where the walks cross them, curved walks to each area, hills, woods and a pond.
// Everything is generated once from fixed numbers (no assets, no randomness between visits) so every player walks the
// same island; the map board draws the same shapes. Later land reclamation changes coastR() and the map follows.
import * as THREE from '/vendor/three/three.module.js';

// v1.10.7: the island's shape lives in island-terrain.js (loaded before the app; the server uses the same file).
const T = globalThis.IslandTerrain;
export const { coastR, PLAZA_R, AREAS, SPOTS, COTTAGES, RESERVED_LOTS, STATUE_SPOTS, SPAWN, heightAt, walkable, ISLAND_RADIUS, nature } = T;
const { BUILDINGS, TAU, wrap, smooth, lerp, coastDist, cliffAt, PLAZA_H, POND, STREAMS, STREAM_HALF, streamCurves, walkCurves, streamDist, walkDist, PADS, land, ground, bridges, onBridge, deckAt, bayR, PIER, BREAKWATER } = T;

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

export function buildIsland(scene, { mat, mesh, solids, assets = null }) {
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
  const SIZE = 250; const SEG = 125;
  const geo = keep(new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG)); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position; const colors = new Float32Array(pos.count * 3);
  const grass = new THREE.Color(0x9fd67f); const grass2 = new THREE.Color(0x8cc96c); const sand = new THREE.Color(0xf1dfae);
  const rock = new THREE.Color(0xb7ad9e); const wet = new THREE.Color(0xd8c48f); const c = new THREE.Color();
  const grassy = new Float32Array(pos.count); // v1.10.29: how much of a vertex is grass (the season paints that part)
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i); const z = pos.getZ(i); const h = ground(x, z); pos.setY(i, h);
    const cd = coastDist(x, z); const cliff = cliffAt(x, z); let g = 1;
    c.copy(grass).lerp(grass2, 0.5 + 0.5 * Math.sin(x * 0.21 + z * 0.17) * Math.cos(z * 0.13));
    if (cd < 8 && cliff < 0.5) { const a = smooth(8, 4, cd); c.lerp(cd < 2.5 ? wet : sand, a); g *= 1 - a; }
    if (cliff > 0.4 && cd < 4) { const a = smooth(4, 1, cd); c.lerp(rock, a); g *= 1 - a; }
    if (h < -0.4) { c.copy(wet); g = 0; }
    colors.set([c.r, c.g, c.b], i * 3); grassy[i] = g;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geo.computeVertexNormals();
  seasonal(geo.attributes.color, (i) => [pos.getX(i), pos.getZ(i)], (i) => [0, grassy[i]]);
  const terrain = new THREE.Mesh(geo, keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })));
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
      const nx = -dz / l; const nz = dx / l; const [x, z] = pts[i]; const y = yOf(x, z) + lift;
      if (i) run += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
      v.push(x + nx * width / 2, y, z + nz * width / 2, x - nx * width / 2, y, z - nz * width / 2);
      uv.push(0, run / 6, 1, run / 6);
      if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } // counter-clockwise from above
    }
    const g = keep(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, material); m.receiveShadow = true; scene.add(m); return m;
  };
  for (const s of streamCurves) ribbon(s.filter(([x, z]) => coastDist(x, z) > -1.5), STREAM_HALF * 2 + 0.6, (x, z) => Math.max(-0.58, land(x, z) - 0.45), water); // ends where it meets the sea
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
  const WALK_COLORS = [0xefe4cc, 0xe8d6b4, 0xdcc59a, 0xefdcb4, 0xd9c391, 0xe8d6ad, 0xdcc59a];
  const pathMat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  const grassEdge = new THREE.Color(0xa7d483);
  const pathStrip = (pts, width, base) => {
    const v = []; const col = []; const idx = []; const c0 = new THREE.Color(base); const cm = new THREE.Color(); const ce = new THREE.Color(); const cols = 4;
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[Math.max(0, i - 1)]; const b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0]; const dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1;
      const nx = -dz / l; const nz = dx / l; const [x, z] = pts[i];
      const mottle = 0.94 + 0.08 * Math.sin(x * 0.7 + z * 0.4) * Math.cos(z * 0.53 - x * 0.2);
      cm.copy(c0).multiplyScalar(mottle); ce.copy(cm).lerp(grassEdge, 0.55);
      for (const [o, lift, c] of [[-(width / 2 + 0.35), 0.0, ce], [-(width / 2 - 0.25), 0.06, cm], [width / 2 - 0.25, 0.06, cm], [width / 2 + 0.35, 0.0, ce]]) {
        const px = x + nx * o; const pz = z + nz * o; v.push(px, ground(px, pz) + lift + 0.01, pz); col.push(c.r, c.g, c.b);
      }
      if (i) for (let k = 0; k < cols - 1; k += 1) { const p = (i - 1) * cols + k; const n = i * cols + k; idx.push(p, n + 1, n, p, p + 1, n + 1); }
    }
    const g = keep(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    seasonal(g.attributes.color, (i) => [v[i * 3], v[i * 3 + 2]], (i) => (i % cols === 0 || i % cols === cols - 1 ? [0, 0.55] : [1, 1])); // v1.10.29: edges are half grass
    const m = new THREE.Mesh(g, pathMat); m.receiveShadow = true; scene.add(m); return m;
  };
  for (const [wi, w] of walkCurves.entries()) {
    let run = [];
    const flush = () => { if (run.length > 1) pathStrip(run, w.w, WALK_COLORS[wi % WALK_COLORS.length]); run = []; };
    for (const p of w.pts) { if (onBridge(p[0], p[1]) || streamDist(p[0], p[1]) < STREAM_HALF + 0.4) flush(); else run.push(p); }
    flush();
  }
  // v1.10.13: every building off the plaza gets a short path from its door to the nearest walk (doors no longer open
  // onto bare grass a few steps away from the path), in that walk's colour.
  for (const b of BUILDINGS) {
    if (b.kind === 'cottage' || b.kind === 'hall' || Math.hypot(b.x, b.z) < PLAZA_R + 3) continue; // cottages have stepping stones; the hall its square
    const dx = b.face[0] - b.x; const dz = b.face[1] - b.z; const l = Math.hypot(dx, dz) || 1;
    const door = [b.x + (dx / l) * 2.4, b.z + (dz / l) * 2.4];
    let best = null;
    walkCurves.forEach((w, wi) => w.pts.forEach(([x, z]) => { const d = Math.hypot(x - door[0], z - door[1]); if (!best || d < best.d) best = { d, x, z, wi, w: w.w }; }));
    if (!best || best.d < best.w / 2 + 0.6 || best.d > 9) continue;
    const end = [best.x - ((best.x - door[0]) / best.d) * (best.w / 2 - 0.3), best.z - ((best.z - door[1]) / best.d) * (best.w / 2 - 0.3)];
    const n = Math.max(2, Math.ceil(Math.hypot(end[0] - door[0], end[1] - door[1]) / 0.8));
    const pts = Array.from({ length: n + 1 }, (_, k) => [door[0] + ((end[0] - door[0]) * k) / n, door[1] + ((end[1] - door[1]) * k) / n]);
    if (pts.some(([x, z]) => streamDist(x, z) < STREAM_HALF + 0.4)) continue;
    pathStrip(pts, 1.7, WALK_COLORS[best.wi % WALK_COLORS.length]);
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
    for (const side of [-1, 1]) { const rail = mesh(keep(new THREE.BoxGeometry(0.1, 0.1, b.half * 2)), post, side * (b.w / 2 - 0.1), b.deck + 0.9, 0, visual); rail.castShadow = false; }
    // in the bridge's frame (z along it, the entry turns the model's length onto z and sizes it by `scale`)
    g.userData.fit = (v) => {
      const zm = v.z / BRIDGE_SCALE; const u = Math.max(-b.half, Math.min(b.half, zm * (b.half / BRIDGE.half)));
      v.set(v.x * ((b.w / 2) / (BRIDGE.side * BRIDGE_SCALE)), v.y - BRIDGE_SCALE * BRIDGE.top(zm) + deckAt({ b, u }), (zm * b.half) / BRIDGE.half);
    };
    assets?.attach('prop.bridge', g, visual);
  }

  // Harbour: pier on posts, a few boats, the breakwater and its lighthouse.
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
  const instanced = (geometry, material, list, place, { shadow = true, cell = 40, color = null, target = null, extra = [] } = {}) => {
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
      im.computeBoundingSphere(); im.castShadow = shadow; im.receiveShadow = true; scene.add(im);
      const more = extra.map(([geo, mat2, cast]) => { keep(geo); const e = new THREE.InstancedMesh(geo, mat2, items.length); matrices.forEach((mm, i) => e.setMatrixAt(i, mm)); e.computeBoundingSphere(); e.castShadow = cast; scene.add(e); return e; });
      if (g) { const [cx, cz] = key.split(',').map(Number); g.cells.push({ x: (cx + 0.5) * cell, z: (cz + 0.5) * cell, parent: scene, procedural: [im, ...more], matrices, colors: color ? colors : null, shadow }); }
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
  const kindOf = (t) => { let r = hash(t.x, t.z); for (let k = 0; k < TREE_KINDS.length; k += 1) { r -= TREE_KINDS[k][1]; if (r <= 0) return k; } return 0; };
  // v1.10.29: stumps come in two models (short, tall), each stump's from its place
  TREE_KINDS.forEach(([name, , parts], k) => {
    const all = trees.filter((t) => kindOf(t) === k);
    const splits = name === 'stump' ? [0, 1].map((v) => [all.filter((t) => (hash(t.x, t.z, 18) < 0.5 ? 0 : 1) === v), [`nature.tree.stump.${v}`, 'nature.tree.stump', 'nature.tree']]) : [[all, [`nature.tree.${name}`, 'nature.tree']]];
    const geo = mergeColored(parts);
    for (const [list, target] of splits) {
      if (!list.length) continue;
      instanced(geo, natureMat, list, (t) => setM(t.x, ground(t.x, t.z) - 0.05, t.z, t.s * (0.9 + hash(t.x, t.z, 1) * 0.2), t.s * (0.85 + hash(t.x, t.z, 2) * 0.35), hash(t.x, t.z, 3) * TAU),
        { cell: 60, color: (t, c) => c.setHSL(0.02 * (hash(t.x, t.z, 4) - 0.5), 0.12, 0.9 + hash(t.x, t.z, 5) * 0.14), target });
    }
  });
  for (const t of trees) solids.push({ x: t.x, z: t.z, r: 0.75 * t.s });

  // Flowers: one mesh, each a little bloom with its colour per copy.
  const flowerColors = [0xff9ec7, 0xffe27a, 0xffffff, 0xc4a5ff, 0xff8f8f];
  const bloom = mergeColored([part(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 4), 0x5f9e4f, 0, 0.11, 0), part(new THREE.SphereGeometry(0.5, 6, 3), 0xffffff, 0, 0.24, 0, { sx: 0.24, sy: 0.14, sz: 0.24 })]);
  // v1.10.29: each colour its own model (nature.flower.<colour>: tulip, daisy, wildflowers, lavender, poppy), never one
  // model tinted -- a tint would colour the leaves too. Without models the five lists bake together as one did.
  for (let k = 0; k < flowerColors.length; k += 1) {
    instanced(bloom, natureMat, flowers.filter((f) => f.c === k), (f) => setM(f.x, ground(f.x, f.z), f.z, 0.8 + hash(f.x, f.z) * 0.5, undefined, hash(f.z, f.x) * TAU), { shadow: false, cell: 60, color: (f, c) => c.set(flowerColors[f.c]), target: [`nature.flower.${k}`, 'nature.flower'] });
  }
  // Bushes: round clusters of a few blobs (two shapes), darker underneath, each tinted a little.
  const BUSH_KINDS = [
    [crown(SPH, 0x6fbf5e, 0, 0.42, 0, 1.6, 1.05), crown(SPH, 0x7cc86a, 0.55, 0.35, 0.25, 1.05, 0.8), crown(SPH, 0x83cf6c, -0.5, 0.32, -0.15, 0.95, 0.7)],
    [crown(SPH, 0x66b85a, 0, 0.36, 0, 1.3, 0.85), crown(SPH, 0x74c463, 0.6, 0.3, 0, 1.0, 0.7), crown(SPH, 0x7cc86a, -0.55, 0.28, 0.2, 0.95, 0.65), crown(SPH, 0x8ad27a, 0.05, 0.62, 0.1, 0.8, 0.55)],
  ];
  BUSH_KINDS.forEach((parts, k) => instanced(mergeColored(parts), natureMat, bushes.filter((b) => (hash(b.x, b.z, 6) < 0.5 ? 0 : 1) === k),
    (b) => setM(b.x, ground(b.x, b.z) - 0.04, b.z, b.s * 0.95, b.s * (0.8 + hash(b.x, b.z, 7) * 0.3), hash(b.x, b.z, 8) * TAU), { cell: 60, color: (b, c) => c.setHSL(0.02 * (hash(b.x, b.z, 9) - 0.5), 0.1, 0.88 + hash(b.x, b.z, 10) * 0.16), target: [`nature.bush.${k}`, 'nature.bush'] }));
  for (const b of bushes) solids.push({ x: b.x, z: b.z, r: 0.75 * b.s });
  // Grass: small clumps of soft blades (not spikes), lighter at the tips.
  const blade = (rx, rz, h) => part(new THREE.ConeGeometry(0.05, h, 3, 1, true), 0x7cbf5c, Math.sin(rz) * h * 0.25, h / 2, -Math.sin(rx) * h * 0.25, { rx, rz, shade: [0.7, 1.15] });
  const clump = mergeColored([blade(0, 0, 0.42), blade(0.35, 0.3, 0.34), blade(-0.3, -0.35, 0.32)]);
  instanced(clump, natureMat, tufts, (t) => setM(t.x, ground(t.x, t.z), t.z, t.s, t.s, t.r), { shadow: false, cell: 60, color: (t, c) => c.setHSL(0.03 * (hash(t.x, t.z, 11) - 0.5), 0.15, 0.85 + hash(t.x, t.z, 12) * 0.25), target: 'nature.grass' });

  const pebble = keep(mergeColored([part(new THREE.IcosahedronGeometry(1, 0), 0xffffff, 0, 0, 0, { shade: [0.8, 1.05] })])); // white, tinted per copy
  // v1.10.20: three rock shapes for models (round, wide, tall), each rock's from its place; without models the three
  // lists bake together exactly as one did
  for (let k = 0; k < 3; k += 1) {
    instanced(pebble, natureMat, rocks.filter((r) => Math.min(2, Math.floor(hash(r.x, r.z, 17) * 3)) === k), (r) => setM(r.x, ground(r.x, r.z) + 0.1, r.z, r.s, r.s * 0.7, r.r),
      { cell: 60, color: (r, c) => c.set(0xb8b0a4).offsetHSL(0, 0, (hash(r.x, r.z, 13) - 0.5) * 0.12), target: [`nature.rock.${k}`, 'nature.rock'] });
  }
  instanced(new THREE.CylinderGeometry(0.08, 0.1, 1, 6), post, posts, (p) => setM(p.x, ground(p.x, p.z) + 0.5, p.z, 1));

  // The edges of the walks and the stream banks: a soft scatter of pebbles, grass and a few flowers instead of a cut
  // line (decoration only -- nothing here is walked around). Spaced from each curve, so they follow every walk.
  const edgeStones = []; const edgeGrass = []; const edgeFlowers = [];
  const busy = (x, z) => Math.hypot(x, z) < PLAZA_R + 1.5 || Math.hypot(x, z + 44) < 10 || onBridge(x, z) || BUILDINGS.some((s) => Math.hypot(x - s.x, z - s.z) < 4.5);
  const along = (pts, step, fn) => { let acc = 0; for (let i = 1; i < pts.length; i += 1) { const [x0, z0] = pts[i - 1]; const [x1, z1] = pts[i]; const l = Math.hypot(x1 - x0, z1 - z0); acc += l; if (acc < step) continue; acc = 0; fn(x1, z1, (x1 - x0) / (l || 1), (z1 - z0) / (l || 1), i); } };
  walkCurves.forEach((w, wi) => along(w.pts, 1.3, (x, z, dx, dz, i) => {
    for (const side of [-1, 1]) {
      const h = hash(x + side, z, wi); const off = w.w / 2 + 0.1 + hash(z, x, i) * 0.45; const px = x - dz * off * side; const pz = z + dx * off * side;
      if (busy(px, pz) || !walkable(px, pz) || streamDist(px, pz) < STREAM_HALF + 0.6) continue;
      if (h < 0.2) edgeStones.push({ x: px, z: pz, s: 0.1 + hash(px, pz) * 0.1 }); else if (h < 0.66) edgeGrass.push({ x: px, z: pz, s: 0.7 + hash(pz, px) * 0.4, r: h * 20 }); else if (h < 0.82) edgeFlowers.push({ x: px, z: pz, c: Math.floor(h * 50) % 5 });
    }
  }));
  streamCurves.forEach((st, si) => along(st, 1.1, (x, z, dx, dz, i) => {
    if (coastDist(x, z) < 3) return;
    for (const side of [-1, 1]) {
      const h = hash(x, z + side, si + 7); const off = STREAM_HALF + 0.35 + hash(x, z, i) * 0.7; const px = x - dz * off * side; const pz = z + dx * off * side;
      if (busy(px, pz) || walkDist(px, pz) < 0.3) continue;
      if (h < 0.35) edgeStones.push({ x: px, z: pz, s: 0.14 + hash(px, pz) * 0.18 }); else if (h < 0.8) edgeGrass.push({ x: px, z: pz, s: 0.9 + hash(pz, px) * 0.6, r: h * 20 });
    }
  }));
  const bendRocks = [];
  streamCurves.forEach((st) => { for (let i = 6; i < st.length - 6; i += 3) {
    const [ax, az] = st[i - 3]; const [bx, bz] = st[i]; const [cx, cz] = st[i + 3];
    const turn = Math.abs(wrap(Math.atan2(cz - bz, cx - bx) - Math.atan2(bz - az, bx - ax)));
    if (turn < 0.16 || coastDist(bx, bz) < 4 || bendRocks.some((r) => Math.hypot(r.x - bx, r.z - bz) < 12) || bridges.some((b) => Math.hypot(b.x - bx, b.z - bz) < 5)) continue;
    const l = Math.hypot(cx - ax, cz - az) || 1; const side = wrap(Math.atan2(cz - bz, cx - bx) - Math.atan2(bz - az, bx - ax)) > 0 ? -1 : 1; // the outer bank
    bendRocks.push({ x: bx - ((cz - az) / l) * 0.75 * side, z: bz + ((cx - ax) / l) * 0.75 * side, s: 0.32 + hash(bx, bz) * 0.15 });
  } });
  instanced(pebble, natureMat, bendRocks, (r) => setM(r.x, Math.max(-0.58, land(r.x, r.z) - 0.45) + 0.05, r.z, r.s, r.s * 0.7, r.x), { cell: 60, color: (r, c) => c.set(0xb8b0a4) });
  const foam = keep(new THREE.MeshStandardMaterial({ color: 0xe9f7ff, roughness: 0.6, transparent: true, opacity: 0.55, depthWrite: false }));
  instanced(new THREE.RingGeometry(0.85, 1.25, 16).rotateX(-Math.PI / 2), foam, bendRocks, (r) => setM(r.x, Math.max(-0.58, land(r.x, r.z) - 0.45) + 0.02, r.z, r.s * 1.1, 1, r.x), { shadow: false, cell: 60 });
  instanced(pebble, natureMat, edgeStones, (r) => setM(r.x, ground(r.x, r.z) + 0.02, r.z, r.s, r.s * 0.55, r.x * 3), { shadow: false, cell: 60, color: (r, c) => c.set(0xcfc6b6).offsetHSL(0, 0, (hash(r.x, r.z, 14) - 0.5) * 0.14) });
  instanced(clump, natureMat, edgeGrass, (t) => setM(t.x, ground(t.x, t.z), t.z, t.s, t.s, t.r), { shadow: false, cell: 60, color: (t, c) => c.setHSL(0.03 * (hash(t.x, t.z, 15) - 0.5), 0.15, 0.85 + hash(t.x, t.z, 16) * 0.25) });
  instanced(bloom, natureMat, edgeFlowers, (f) => setM(f.x, ground(f.x, f.z), f.z, 0.8, undefined, f.x), { shadow: false, cell: 60, color: (f, c) => c.set(flowerColors[f.c]) });

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
  instanced(new THREE.CylinderGeometry(0.08, 0.11, 2.6, 8).translate(0, 1.3, 0), mat(0x4d6b5c), lampSpots, (p) => setM(p.x, ground(p.x, p.z), p.z, 1),
    { target: 'prop.lamp', extra: [[new THREE.SphereGeometry(0.24, 12, 9).translate(0, 2.72, 0), mat(0xfff3c2, { emissive: 0xffe08a, emissiveIntensity: 0.6 }), false]] });
  for (const p of lampSpots) solids.push({ x: p.x, z: p.z, r: 0.3 });
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
    LAYERS.forEach((v, k) => instanced(speck, natureMat, spots.filter((p) => p.v === k), (p) => setM(p.x, ground(p.x, p.z) + 0.005, p.z, 1, 1, p.r), { shadow: false, cell: 60, target: `deco.layer.${v}` }));
  }
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

  function step(clock) { flowTex.offset.y = -clock * 0.16; foam.opacity = 0.45 + Math.sin(clock * 2.2) * 0.12; pondTex.offset.set(clock * 0.006, clock * 0.004); boats.forEach((b, i) => { b.position.y = -0.55 + Math.sin(clock * 1.3 + i) * 0.06; b.rotation.z = Math.sin(clock * 0.9 + i * 2) * 0.05; }); }
  function dispose() { disposables.forEach((d) => d.dispose?.()); }
  return { drawMap, drawMinimap, step, dispose, setSeasonDay, bridges: bridges.map(({ x, z, ux, uz, half, w }) => ({ x, z, ux, uz, half, w })), pier: { x: PIER.x, z: PIER.z, half: PIER.half } };
}
