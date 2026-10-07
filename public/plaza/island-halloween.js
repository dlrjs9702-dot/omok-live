// v1.10.38 섬 전체 할로윈 꾸미기 (IDEAS, 사용자 확정 2026-10-07): in October the whole island dresses up, not just
// the plaza -- small jack-o'-lanterns along the walks and at the doors, hay bales and scarecrows in the fields,
// cauldrons, bunting between the walks' lamps and string lights round the plaza, bats circling and will-o'-wisps in
// the woods, a full moon and stars, and every lamp lit orange. Cute, never scary. Everything is in one group shown only
// while it is October (plaza-scene setHalloween). Each kind is one instanced batch (assets.batch, halloween.*: the
// Codex decor pack replaces the stand-in shapes drawn here at the same matrices); light is only glowing colour.
import * as THREE from '/vendor/three/three.module.js';
import { part, mergeColored, heightAt, walkable } from './island.js';

const T = globalThis.IslandTerrain;
const ORANGE = 0xf08a24; const PURPLE = 0x6b3fa0; const NIGHT_INK = 0x2a2340; const HAY = 0xd9b25a; const STEM = 0x5d7a3a;
const GLOW = 0xffb347; const GLOW_PURPLE = 0xb46cff;
const G = { ball: new THREE.SphereGeometry(1, 14, 10), box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 10), cone: new THREE.ConeGeometry(1, 1, 10), tri: new THREE.CircleGeometry(1, 3) };

// the stand-in shapes: [body parts (lit), glow parts (unlit, bright)], origin on the ground, front -z like the models
function pumpkinParts(x, y, z, s, flat = 1, face = 'smile') {
  const body = [part(G.ball, ORANGE, x, y + 0.2 * s * flat, z, { sx: 0.24 * s, sy: 0.2 * s * flat, sz: 0.24 * s, shade: [0.7, 1.05] }), part(G.cyl, STEM, x, y + 0.42 * s * flat, z, { sx: 0.03 * s, sy: 0.08 * s, sz: 0.03 * s })];
  const fz = z - 0.235 * s; const fy = y + 0.2 * s * flat;
  const glow = [part(G.ball, GLOW, x - 0.07 * s, fy + 0.05 * s, fz, { sx: 0.05 * s, sy: face === 'wink' ? 0.018 * s : 0.05 * s, sz: 0.03 * s }), part(G.ball, GLOW, x + 0.07 * s, fy + 0.05 * s, fz, { sx: 0.05 * s, sy: 0.05 * s, sz: 0.03 * s }), part(G.ball, GLOW, x, fy - 0.06 * s, fz, { sx: face === 'wink' ? 0.06 * s : 0.12 * s, sy: 0.04 * s, sz: 0.03 * s })];
  return [body, glow];
}
const join = (...sets) => [sets.flatMap((p) => p[0]), sets.flatMap((p) => p[1])];
function hayParts(top = true) {
  const body = [part(G.box, HAY, 0, 0.27, 0, { sx: 1.0, sy: 0.54, sz: 0.6, shade: [0.75, 1.05] }), part(G.box, 0x8a6a3a, -0.25, 0.27, 0, { sx: 0.04, sy: 0.56, sz: 0.62 }), part(G.box, 0x8a6a3a, 0.25, 0.27, 0, { sx: 0.04, sy: 0.56, sz: 0.62 })];
  return top ? join([body, []], pumpkinParts(0.2, 0.54, 0, 0.8)) : [body, []];
}
// a 4 m string from its left end along +x, sagging 0.4 in the middle (bunting and string lights: segments placed end to end)
const sag = (t) => -0.4 * 4 * t * (1 - t);
function stringParts(kind) {
  const body = []; const glow = [];
  for (let k = 0; k < 8; k += 1) { const t0 = k / 8; const t1 = (k + 1) / 8; const a = [t0 * 4, sag(t0)]; const b = [t1 * 4, sag(t1)]; body.push(part(G.box, NIGHT_INK, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0, { rz: Math.atan2(b[1] - a[1], b[0] - a[0]), sx: 0.52, sy: 0.02, sz: 0.02 })); }
  for (let k = 0; k < (kind === 'lights' ? 8 : 7); k += 1) {
    const t = (k + 0.5) / (kind === 'lights' ? 8 : 7); const x = t * 4; const y = sag(t);
    if (kind === 'lights') glow.push(part(G.ball, k % 2 ? GLOW_PURPLE : GLOW, x, y - 0.08, 0, { sx: 0.07, sy: 0.09, sz: 0.07 }));
    else body.push(part(G.tri, k % 2 ? PURPLE : ORANGE, x, y - 0.13, 0, { rz: -Math.PI / 2, sx: 0.16, sy: 0.16, sz: 1 }), part(G.tri, k % 2 ? PURPLE : ORANGE, x, y - 0.13, 0, { rz: -Math.PI / 2, ry: Math.PI, sx: 0.16, sy: 0.16, sz: 1 }));
  }
  return [body, glow];
}
const SHAPES = {
  pumpkinA: () => pumpkinParts(0, 0, 0, 1.6),
  pumpkinB: () => pumpkinParts(0, 0, 0, 1.75, 0.75, 'wink'),
  stack: () => join(pumpkinParts(-0.12, 0, 0.04, 1.7), pumpkinParts(0.18, 0, -0.02, 1.4, 0.85), pumpkinParts(0.02, 0.48, 0, 1.25)),
  hay: () => hayParts(true),
  scarecrow: () => join([[
    part(G.cyl, 0x8a6a3a, 0, 0.8, 0, { sx: 0.05, sy: 1.6, sz: 0.05 }), part(G.cyl, 0x8a6a3a, 0, 1.25, 0, { rz: Math.PI / 2, sx: 0.04, sy: 1.2, sz: 0.04 }),
    part(G.box, 0x7a8fb0, 0, 1.12, 0, { sx: 0.5, sy: 0.5, sz: 0.26 }), part(G.box, 0xb5654a, 0, 0.86, -0.135, { sx: 0.16, sy: 0.14, sz: 0.01 }),
    part(G.cone, HAY, -0.6, 1.2, 0, { rz: Math.PI / 2, sx: 0.07, sy: 0.14, sz: 0.07 }), part(G.cone, HAY, 0.6, 1.2, 0, { rz: -Math.PI / 2, sx: 0.07, sy: 0.14, sz: 0.07 }),
    part(G.cyl, 0xe0c27a, 0, 1.79, 0, { sx: 0.34, sy: 0.03, sz: 0.34 }), part(G.cone, 0xe0c27a, 0, 1.9, 0, { sx: 0.17, sy: 0.22, sz: 0.17 }),
  ], []], pumpkinParts(0, 1.36, 0, 1.6)),
  cauldron: () => [[
    part(G.ball, NIGHT_INK, 0, 0.38, 0, { sx: 0.4, sy: 0.32, sz: 0.4, shade: [0.6, 1.1] }), part(G.cyl, 0x3a3150, 0, 0.62, 0, { sx: 0.36, sy: 0.06, sz: 0.36 }),
    ...[0, 1, 2].map((k) => part(G.cyl, 0x3a3150, Math.cos((k * Math.PI * 2) / 3) * 0.26, 0.08, Math.sin((k * Math.PI * 2) / 3) * 0.26, { sx: 0.035, sy: 0.16, sz: 0.035 })),
    part(G.cyl, 0x8a6a3a, 0.15, 0.78, 0.05, { rz: -0.5, sx: 0.025, sy: 0.5, sz: 0.025 }),
  ], [part(G.cyl, GLOW_PURPLE, 0, 0.655, 0, { sx: 0.32, sy: 0.01, sz: 0.32 })]],
  broom: () => join(hayParts(false).map((p, i) => (i ? p : p.map((q) => ({ ...q, matrix: q.matrix.clone().premultiply(new THREE.Matrix4().makeScale(0.6, 0.8, 0.8)) })))), [[
    part(G.cyl, 0x8a6a3a, 0.05, 0.85, 0, { rz: 0.35, sx: 0.025, sy: 1.0, sz: 0.025 }), part(G.cone, HAY, -0.13, 1.38, 0, { rz: 0.35 + Math.PI, sx: 0.11, sy: 0.3, sz: 0.11 }),
  ], []]),
  bunting: () => stringParts('bunting'),
  lights: () => stringParts('lights'),
};

export function halloweenDecor({ scene, assets, solids, vcMat, PH, plazaLamps, benches, spots, lampModel }) {
  const group = new THREE.Group(); group.visible = false; group.name = 'halloween-decor'; scene.add(group);
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const made = []; const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const up = new THREE.Vector3(0, 1, 0);
  const place = { pumpkinA: [], pumpkinB: [], stack: [], hay: [], scarecrow: [], cauldron: [], broom: [], bunting: [], lights: [] };
  const R = { pumpkinA: 0.25, pumpkinB: 0.25, stack: 0.35, hay: 0.55, scarecrow: 0.35, cauldron: 0.45, broom: 0.35 };
  const free = (x, z, r) => solids.every((s) => Math.hypot(s.x - x, s.z - z) > s.r + r + 0.15);
  const open = (x, z, r) => walkable(x, z) && T.walkDist(x, z) > r + 0.3 && T.streamDist(x, z) > T.STREAM_HALF + r + 0.4 && !T.onBridge(x, z) && free(x, z, r);
  function put(kind, x, z, ry, y = heightAt(x, z), solid = true) {
    const s = new THREE.Vector3(1, 1, 1);
    place[kind].push(m4.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(up, ry), s).clone());
    if (solid && R[kind]) solids.push({ x, z, r: R[kind], hw: true }); // walked round only in October (plaza-scene solidsNear)
  }
  // the nearest open ground round a wanted spot (rings out to 5 m)
  function fit(kind, x, z, ry) {
    const r = R[kind];
    for (let d = 0; d <= 5; d += 0.5) for (let k = 0; k < (d ? 12 : 1); k += 1) { const a = (k / 12) * Math.PI * 2; const px = x + Math.cos(a) * d; const pz = z + Math.sin(a) * d; if (open(px, pz, r)) { put(kind, px, pz, ry); return true; } }
    return false;
  }

  // doors: cottages and facilities (spots worked out where they are built)
  for (const s of spots) put(s.kind, s.x, s.z, s.ry, s.y ?? heightAt(s.x, s.z)); // laid out against the walls, clear of the yard's fences and mailbox
  // the plaza: a pumpkin at each end of each bench, two cauldrons
  for (const b of benches) { const ry = Math.atan2(-b.x, -b.z); for (const side of [-1, 1]) put(side < 0 ? 'pumpkinA' : 'pumpkinB', b.x + Math.cos(ry) * 1.15 * side, b.z - Math.sin(ry) * 1.15 * side, ry + Math.PI, PH); }
  for (const [x, z] of [[7.6, -2.8], [-7.6, 2.8]]) if (free(x, z, R.cauldron)) put('cauldron', x, z, Math.atan2(x, z), PH);
  // the walks: a small jack-o'-lantern every few metres, sides taking turns, kept off the plaza, water, bridges and lamps
  let n = 0;
  for (const w of T.walkCurves) for (let i = 4; i < w.pts.length - 1; i += 10) {
    const [x, z] = w.pts[i]; const [x2, z2] = w.pts[i + 1]; const l = Math.hypot(x2 - x, z2 - z) || 1;
    if (Math.hypot(x, z) < T.PLAZA_R + 6) continue;
    const side = n % 2 ? 1 : -1; const off = w.w / 2 + 0.7;
    const px = x - ((z2 - z) / l) * off * side; const pz = z + ((x2 - x) / l) * off * side;
    if (!walkable(px, pz) || T.streamDist(px, pz) < T.STREAM_HALF + 1 || T.onBridge(px, pz) || !free(px, pz, 0.25)) continue;
    put(n % 3 === 2 ? 'pumpkinB' : 'pumpkinA', px, pz, Math.atan2(x - px, z - pz) + Math.PI); n += 1; // facing the walk
  }
  // the fields: a scarecrow and a hay bale in each flower field, a witch's broom in the nature area, a cauldron by the pond
  for (const [x, z] of [[-34, 58], [-58, 30], [20, 40], [-22, -30], [58, 22], [-6, 44]]) { const ry = Math.atan2(-x, -z) + Math.PI; if (fit('scarecrow', x, z, ry)) fit('hay', x + 1.8, z + 0.6, ry + 0.4); }
  fit('broom', -46, 50, 0.6); fit('broom', -60, -24, 2.1); fit('hay', -44, 40, 1.2);
  fit('cauldron', T.POND.x + T.POND.r + 1.8, T.POND.z, Math.PI / 2);
  // strings: lights from lamp to lamp round the plaza, bunting between each walk's neighbouring lamps
  const string = (kind, a, b, ya, yb) => {
    const dx = b.x - a.x; const dz = b.z - a.z; const L = Math.hypot(dx, dz); const segs = Math.max(1, Math.round(L / 4)); const ry = Math.atan2(-dz, dx);
    for (let k = 0; k < segs; k += 1) {
      const t = k / segs; const len = L / segs; const y0 = ya + (yb - ya) * t; const y1 = ya + (yb - ya) * ((k + 1) / segs);
      const rot = new THREE.Matrix4().makeRotationY(ry).multiply(new THREE.Matrix4().makeRotationZ(Math.atan2(y1 - y0, len)));
      place[kind].push(new THREE.Matrix4().makeTranslation(a.x + dx * t, y0, a.z + dz * t).multiply(rot).multiply(new THREE.Matrix4().makeScale(Math.hypot(len, y1 - y0) / 4, 1, 1)));
    }
  };
  const ring = [...plazaLamps].sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  ring.forEach((a, i) => { const b = ring[(i + 1) % ring.length]; if (Math.hypot(b.x - a.x, b.z - a.z) < 19) string('lights', a, b, PH + 2.35, PH + 2.35); });
  for (const l of plazaLamps) { const d = Math.hypot(l.x, l.z); string('lights', l, { x: (l.x / d) * 3.1, z: (l.z / d) * 3.1 }, PH + 2.35, PH + 2.2); } // and down to the pedestal's rim
  const walkLamps = T.nature().lampSpots;
  for (let i = 0; i + 1 < walkLamps.length; i += 1) { const a = walkLamps[i]; const b = walkLamps[i + 1]; const L = Math.hypot(b.x - a.x, b.z - a.z); if (L > 6 && L < 14) string('bunting', a, b, heightAt(a.x, a.z) + 2.1, heightAt(b.x, b.z) + 2.1); }

  // each kind: one instanced batch, stand-in body + glow drawn with the same matrices until its model comes
  const kinds = {};
  for (const [kind, list] of Object.entries(place)) {
    if (!list.length) continue;
    const [body, glow] = SHAPES[kind]();
    const procedural = [];
    for (const [parts, material, shadow] of [[body, vcMat, kind !== 'bunting' && kind !== 'lights'], [glow, glowMat, false]]) {
      if (!parts.length) continue;
      const geo = mergeColored(parts); made.push(geo);
      const im = new THREE.InstancedMesh(geo, material, list.length); list.forEach((mm, i) => im.setMatrixAt(i, mm));
      im.computeBoundingSphere(); im.castShadow = shadow; im.receiveShadow = true; group.add(im); procedural.push(im);
    }
    const cx = list.reduce((s, mm) => s + mm.elements[12], 0) / list.length; const cz = list.reduce((s, mm) => s + mm.elements[14], 0) / list.length;
    kinds[kind] = list.length;
    assets.batch(`halloween.${kind}`, [{ x: cx, z: cz, parent: group, procedural, matrices: list, colors: null, shadow: kind !== 'bunting' && kind !== 'lights' }]);
  }

  // every lamp lit orange: a glowing shade over each lamp model's lantern (the stand-in lamps' own bulbs turn orange)
  const lampAt = [...plazaLamps.map((p) => [p.x, PH, p.z]), ...walkLamps.map((p) => [p.x, heightAt(p.x, p.z), p.z])];
  const shadeGeo = new THREE.BoxGeometry(0.34, 0.44, 0.34); made.push(shadeGeo);
  const shadeMat = new THREE.MeshBasicMaterial({ color: 0xffa040 });
  const shades = new THREE.InstancedMesh(shadeGeo, shadeMat, lampAt.length); lampAt.forEach(([x, y, z], i) => shades.setMatrixAt(i, m4.makeTranslation(x, y + 2.445, z)));
  shades.computeBoundingSphere(); shades.castShadow = false; shades.visible = false; group.add(shades);

  // will-o'-wisps: little orange lights drifting low among the woods' trees
  const trees = T.nature().trees.filter((t, i) => i % 9 === 0 && Math.hypot(t.x, t.z) > T.PLAZA_R + 8).slice(0, 48);
  const wispGeo = new THREE.SphereGeometry(0.13, 8, 6); made.push(wispGeo);
  const wispMat = new THREE.MeshBasicMaterial({ color: 0xffc070 }); const wisps = new THREE.InstancedMesh(wispGeo, wispMat, trees.length);
  const wispAt = trees.map((t, i) => ({ x: t.x + 1.4 * Math.cos(i), z: t.z + 1.4 * Math.sin(i), y: heightAt(t.x, t.z) + 1.1, p: i * 1.7 }));
  wisps.frustumCulled = false; group.add(wisps);
  // bats -- v1.10.46: flocks that cross the island and are gone (they circled three fixed spots, which read as bats
  // hanging in the air; with the PC's reduced motion they even stood still). FLOCKS of PER fly a straight way past
  // somewhere within 15 m of the camera, 6-11 m up, at BAT_SPEED, a loose V, then a pause before the next; always moving, reduced motion too.
  const batGeo = mergeColored([part(G.ball, NIGHT_INK, 0, 0, 0, { sx: 0.09, sy: 0.08, sz: 0.12 }), part(G.tri, 0x3a3150, -0.17, 0, 0, { rx: -Math.PI / 2, rz: Math.PI, sx: 0.17, sy: 0.12, sz: 1 }), part(G.tri, 0x3a3150, 0.17, 0, 0, { rx: -Math.PI / 2, sx: 0.17, sy: 0.12, sz: 1 }), part(G.ball, GLOW, -0.035, 0.03, -0.1, { sx: 0.018, sy: 0.018, sz: 0.01 }), part(G.ball, GLOW, 0.035, 0.03, -0.1, { sx: 0.018, sy: 0.018, sz: 0.01 })]); made.push(batGeo);
  const FLOCKS = 3; const PER = 5; const BAT_SPEED = 6.5; const BAT_RUN = 95; // m/s, half the way's length
  const bats = new THREE.InstancedMesh(batGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }), FLOCKS * PER); bats.frustumCulled = false; group.add(bats);
  const flights = Array.from({ length: FLOCKS }, (_, f) => ({ f, start: null, from: null, dir: null, y: 0, dur: 0, next: f * 9 + Math.random() * 6 }));
  const wing = Array.from({ length: FLOCKS * PER }, (_, i) => ({ side: (i % PER - (PER - 1) / 2) * 1.7 + (Math.random() - 0.5) * 0.6, back: Math.abs(i % PER - (PER - 1) / 2) * 1.3 + Math.random() * 0.8, bob: Math.random() * 6, flap: Math.random() }));
  let through = null; // tests: the next flocks' way over this point
  function launch(fl, clock, near) {
    const a = Math.random() * Math.PI * 2; const c = through || { x: near.x + (Math.random() - 0.5) * 30, z: near.z + (Math.random() - 0.5) * 30 }; // close by: dark on the night sky, far ones are specks
    fl.dir = { x: Math.sin(a), z: Math.cos(a) }; fl.from = { x: c.x - fl.dir.x * BAT_RUN, z: c.z - fl.dir.z * BAT_RUN };
    fl.y = PH + 6 + Math.random() * 5; fl.start = clock; fl.dur = (2 * BAT_RUN) / BAT_SPEED; fl.next = clock + fl.dur + 8 + Math.random() * 18;
  }
  // v1.10.46: the bat model drawn instanced, as the Codex pack suggests -- its Flap sampled once into POSES poses, each of
  // its meshes (body, left wing, right wing) one InstancedMesh: 3 draws for every bat, no mixer per bat
  const POSES = 32; let batParts = null; // [{ im, poses: Matrix4[] }]
  const batTemplate = new THREE.Group(); batTemplate.visible = false; group.add(batTemplate);
  const dropParts = () => { for (const p of batParts || []) { group.remove(p.im); p.im.dispose(); } batParts = null; };
  assets.attach('halloween.bat', batTemplate, new THREE.Group(), (entry) => {
    dropParts(); bats.visible = true;
    const holder = batTemplate.children[batTemplate.children.length - 1]; // the model (a LOD of High and Low)
    const src = entry && holder ? (holder.isLOD ? holder.levels[0].object : holder) : null; if (!src) return;
    const clip = src.animations?.[0]; const mixer = clip ? new THREE.AnimationMixer(src) : null; mixer?.clipAction(clip).play();
    const meshes = []; src.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const inv = new THREE.Matrix4();
    batParts = meshes.map((m) => ({ im: new THREE.InstancedMesh(m.geometry, m.material, FLOCKS * PER), poses: [] }));
    for (let k = 0; k < POSES; k += 1) {
      mixer?.setTime(clip ? (k / POSES) * clip.duration : 0); holder.updateMatrixWorld(true); inv.copy(holder.matrixWorld).invert();
      meshes.forEach((m, i) => batParts[i].poses.push(inv.clone().multiply(m.matrixWorld)));
    }
    mixer?.stopAllAction();
    for (const p of batParts) { p.im.frustumCulled = false; p.im.castShadow = false; group.add(p.im); }
    bats.visible = false;
  });
  const batAt = wing; // tests: how many bats
  const UP = new THREE.Vector3(0, 1, 0); const ZERO = new THREE.Matrix4().makeScale(0, 0, 0); const bm = new THREE.Matrix4(); const bq = new THREE.Quaternion(); const bv = new THREE.Vector3(); const one = new THREE.Vector3(1, 1, 1);
  let batsFlying = 0; const batSeen = []; // tests: where the flying ones are
  let lastClock = null; let seen = -1; const GLOW_LIT = 2.6;
  // the full moon and the stars, round wherever the camera is (not in the fog)
  const sky = new THREE.Group(); group.add(sky);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff1c8, fog: false })); moon.position.set(-70, 120, -300); sky.add(moon);
  const starPos = []; let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 500; i += 1) { const a = rnd() * Math.PI * 2; const e = 0.12 + rnd() * 1.4; const r = 340; starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3)); made.push(starGeo);
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })); sky.add(stars);
  for (const o of [moon, stars]) { o.frustumCulled = false; o.renderOrder = -1; }

  function step(clock, camera, still) {
    if (!group.visible) return;
    if (group.children.length !== seen) { // models came (or went): their `glow` lit brighter at night (the files' materials, shared)
      seen = group.children.length;
      group.traverse((o) => { for (const m of [].concat(o.material || [])) if (m.name === 'glow' && m.emissiveIntensity !== GLOW_LIT) m.emissiveIntensity = GLOW_LIT; });
    }
    shades.visible = lampModel(); // the lamps' orange shades go over lamp models only (the stand-in lamps have their own bulbs)
    sky.position.copy(camera.position);
    const t = still ? 0 : clock;
    wispAt.forEach((w, i) => { wisps.setMatrixAt(i, m4.makeTranslation(w.x + Math.sin(t * 0.4 + w.p) * 0.8, w.y + Math.sin(t * 0.9 + w.p) * 0.35, w.z + Math.cos(t * 0.33 + w.p) * 0.8)); });
    wisps.instanceMatrix.needsUpdate = true;
    lastClock = clock; batsFlying = 0; batSeen.length = 0;
    for (const fl of flights) {
      if (fl.start === null || clock > fl.start + fl.dur) { fl.start = null; if (clock >= fl.next) launch(fl, clock, camera.position); }
      const u = fl.start === null ? -1 : (clock - fl.start) * BAT_SPEED; const ry = fl.dir ? Math.atan2(-fl.dir.x, -fl.dir.z) : 0; // its front (-z) along the way
      for (let k = 0; k < PER; k += 1) {
        const i = fl.f * PER + k; const w = wing[i];
        if (u < 0) { bats.setMatrixAt(i, ZERO); for (const p of batParts || []) p.im.setMatrixAt(i, ZERO); continue; }
        batsFlying += 1;
        const d = u - w.back; const x = fl.from.x + fl.dir.x * d + fl.dir.z * w.side; const z = fl.from.z + fl.dir.z * d - fl.dir.x * w.side;
        const y = Math.max(fl.y, heightAt(x, z) + 7) + Math.sin(clock * 1.7 + w.bob) * 0.5 + Math.sin(clock * 0.6 + w.bob) * 0.8; // over the hills too
        batSeen.push({ x: +x.toFixed(1), y: +y.toFixed(1), z: +z.toFixed(1) }); bv.set(x, y, z); bq.setFromAxisAngle(UP, ry + Math.sin(clock * 0.9 + w.bob) * 0.25); // a little weaving
        if (batParts) {
          bm.compose(bv, bq, one); const pose = Math.floor(((clock * 2.5 + w.flap) % 1) * POSES) % POSES;
          for (const p of batParts) p.im.setMatrixAt(i, m4.multiplyMatrices(bm, p.poses[pose]));
        } else {
          const flap = 0.35 + 0.65 * Math.abs(Math.sin(clock * 11 + i));
          bats.setMatrixAt(i, bm.compose(bv, bq, bv.clone().set(1.6 * flap, 1.6, 1.6)));
        }
      }
    }
    bats.instanceMatrix.needsUpdate = true; for (const p of batParts || []) p.im.instanceMatrix.needsUpdate = true;
  }
  const setOn = (on) => { group.visible = on; };
  const dispose = () => { dropParts(); for (const g of made) g.dispose(); glowMat.dispose(); shadeMat.dispose(); wispMat.dispose(); scene.remove(group); };
  const launchBats = (at = null) => { through = at; for (const f of flights) { f.next = 0; f.start = null; } }; // tests: every flock off now
  return { group, step, setOn, dispose, launchBats, debug: () => ({ shown: group.visible, batModels: batParts ? FLOCKS * PER : 0, batsFlapping: batParts ? FLOCKS * PER : 0, batsFlying, batSeen: batSeen.slice(), batInstanced: batParts ? batParts.length : 0, flights: flights.map((f) => ({ on: f.start !== null, from: f.from, dir: f.dir, y: f.y })), kinds: { ...kinds }, wisps: wispAt.length, bats: batAt.length, lamps: lampAt.length, shades: shades.visible, moon: sky.children.includes(moon) }) };
}
