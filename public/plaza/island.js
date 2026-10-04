// v1.10.0 게임 아일랜드 지형: the walkable island around the central plaza. A natural coastline (bays, a cape, beaches,
// north cliffs, a harbour with a pier and a breakwater), water that starts at the plaza fountain and winds to the sea in
// four streams with small bridges where the walks cross them, curved walks to each area, hills, woods and a pond.
// Everything is generated once from fixed numbers (no assets, no randomness between visits) so every player walks the
// same island; the map board draws the same shapes. Later land reclamation changes coastR() and the map follows.
import * as THREE from '/vendor/three/three.module.js';

// v1.10.7: the island's shape lives in island-terrain.js (loaded before the app; the server uses the same file).
const T = globalThis.IslandTerrain;
export const { coastR, PLAZA_R, AREAS, SPOTS, RESERVED_LOTS, STATUE_SPOTS, SPAWN, heightAt, walkable, ISLAND_RADIUS, nature } = T;
const { TAU, wrap, smooth, lerp, coastDist, cliffAt, PLAZA_H, POND, STREAMS, STREAM_HALF, streamCurves, walkCurves, streamDist, walkDist, PADS, land, ground, bridges, onBridge, deckAt, bayR, PIER, BREAKWATER } = T;

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
  // v1.10.11: where the trees, flowers, bushes, rocks, fence posts and lamps stand comes from island-terrain.js (the
  // server keeps events clear of them too)
  const { trees, flowers, bushes, tufts, rocks, posts, lampSpots } = nature();
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

  const flowerColors = [0xff9ec7, 0xffe27a, 0xffffff, 0xc4a5ff, 0xff8f8f];
  flowerColors.forEach((col, ci) => {
    const list = flowers.filter((f) => f.c === ci);
    instanced(new THREE.SphereGeometry(0.13, 5, 3), mat(col), list, (f) => setM(f.x, ground(f.x, f.z) + 0.16, f.z, 1), { shadow: false });
  });
  instanced(new THREE.SphereGeometry(0.9, 7, 5), mat(0x6fbf5e), bushes, (b) => setM(b.x, ground(b.x, b.z) + 0.35 * b.s, b.z, b.s, b.s * 0.75));
  instanced(new THREE.SphereGeometry(0.6, 6, 4), mat(0x83cf6c), bushes, (b) => setM(b.x + 0.45 * b.s, ground(b.x, b.z) + 0.5 * b.s, b.z - 0.2 * b.s, b.s, b.s * 0.8));
  for (const b of bushes) solids.push({ x: b.x, z: b.z, r: 0.75 * b.s });
  instanced(new THREE.ConeGeometry(0.16, 0.5, 4), mat(0x7cbf5c), tufts, (t) => setM(t.x, ground(t.x, t.z) + 0.2 * t.s, t.z, t.s, t.s, t.r), { shadow: false });

  instanced(new THREE.DodecahedronGeometry(1), mat(0xb8b0a4), rocks, (r) => setM(r.x, ground(r.x, r.z) + 0.1, r.z, r.s, r.s * 0.7, r.r));
  instanced(new THREE.CylinderGeometry(0.08, 0.1, 1, 6), post, posts, (p) => setM(p.x, ground(p.x, p.z) + 0.5, p.z, 1));

  // Lamps along the main walks, benches beside them.
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

  function step(clock) { boats.forEach((b, i) => { b.position.y = -0.55 + Math.sin(clock * 1.3 + i) * 0.06; b.rotation.z = Math.sin(clock * 0.9 + i * 2) * 0.05; }); }
  function dispose() { disposables.forEach((d) => d.dispose?.()); }
  return { drawMap, drawMinimap, step, dispose, bridges: bridges.map(({ x, z, ux, uz, half, w }) => ({ x, z, ux, uz, half, w })), pier: { x: PIER.x, z: PIER.z, half: PIER.half } };
}
