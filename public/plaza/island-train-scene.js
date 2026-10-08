// v1.10.48: figure-eight glass rail, 28 offshore supports, two platforms/lifts and four real carriages.
// Access piers pass below the rail; upper walkways stay beside the doors.
import * as THREE from '/vendor/three/three.module.js';
import { part, mergeColored } from './island.js';

const T = globalThis.IslandTerrain; const R = globalThis.IslandTrain;
const G = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 10) };
const FRAME = 0xeef2ea; const SAGE = 0x9db8a4; const DECK = 0xd9cfbf; const TEAL = 0x6fc3c0;

export function trainScene({ scene, assets, solids, vcMat, sign }) {
  const group = new THREE.Group(); group.name = 'train'; scene.add(group);
  const made = [];
  const glass = new THREE.MeshStandardMaterial({ color: 0xd6f3f1, transparent: true, opacity: 0.3, roughness: 0.08, metalness: 0, depthWrite: false }); made.push(glass);
  const line = new THREE.MeshStandardMaterial({ color: TEAL, roughness: 0.6, metalness: 0 }); made.push(line);
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9d4cc, roughness: 0.5, metalness: 0.2 }); made.push(steel);

  // the rails: a glass plate (1.2 wide, its top the rail's height) with a pale teal running line on it and the outline
  function beam(route, offset, half, top, bottom) { // a box section following a line, `offset` across it
    const { xs, zs, ys, S } = route; const n = S.length; const pos = new Float32Array(n * 4 * 3); const idx = [];
    for (let i = 0; i < n; i += 1) {
      const a = Math.max(0, i - 1); const b = Math.min(n - 1, i + 1); const yaw = Math.atan2(xs[b] - xs[a], zs[b] - zs[a]);
      const cx = xs[i] + Math.cos(yaw) * offset; const cz = zs[i] - Math.sin(yaw) * offset;
      [[-half, top], [half, top], [half, bottom], [-half, bottom]].forEach(([w, h], k) => { pos.set([cx + Math.cos(yaw) * w, ys[i] + h, cz - Math.sin(yaw) * w], (i * 4 + k) * 3); });
      if (i < n - 1) for (let k = 0; k < 4; k += 1) { const p = i * 4 + k; const q = i * 4 + ((k + 1) % 4); idx.push(p, q, p + 4, q, q + 4, p + 4); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); made.push(g);
    return g;
  }
  const pillarAt = R.PILLARS;
  for (const L of Object.values(R.LINES)) {
    const r = L.route;
    const plate = new THREE.Mesh(beam(r, 0, 0.6, 0, -0.2), glass); plate.renderOrder = 1; group.add(plate);
    for (const o of [-0.6, 0.6]) group.add(new THREE.Mesh(beam(r, o, 0.035, 0.05, -0.2), line));
    group.add(new THREE.Mesh(beam(r, 0, 0.12, R.SURFACE, 0.001), line));
  }

  const pillars = new THREE.InstancedMesh(G.cyl, steel, pillarAt.length);
  const m4 = new THREE.Matrix4(); const q0 = new THREE.Quaternion();
  pillarAt.forEach((p, i) => { const h = p.top - p.foot; pillars.setMatrixAt(i, m4.compose(new THREE.Vector3(p.x, p.foot + h / 2, p.z), q0, new THREE.Vector3(0.22, h, 0.22))); });
  pillars.computeBoundingSphere(); pillars.castShadow = true; group.add(pillars);

  // the platforms (3.4 x 5.4, origin on the deck): a stand-in deck with a rail on its far side and a canopy
  for (const p of R.PLATFORMS) {
    const holder = new THREE.Group(); holder.position.set(p.x, p.y, p.z); holder.rotation.y = p.yaw; if (p.mirror) holder.scale.x = -1; group.add(holder);
    const visual = new THREE.Group(); holder.add(visual);
    const geo = mergeColored([part(G.box, DECK, 0, -0.1, 0, { sx: 3.4, sy: 0.2, sz: 5.4 }), part(G.box, SAGE, -1.65, 0.55, 0, { sx: 0.08, sy: 1.1, sz: 5.4 }),
      ...[-2.5, 2.5].map((z) => part(G.box, FRAME, -1.6, 1.3, z, { sx: 0.12, sy: 2.6, sz: 0.12 })), part(G.box, FRAME, -0.9, 2.65, 0, { sx: 1.6, sy: 0.1, sz: 5.4 })]); made.push(geo);
    const body = new THREE.Mesh(geo, vcMat); body.castShadow = true; body.receiveShadow = true; visual.add(body);
    assets.attach('train.platform', holder, visual);
  }
  // each station: a glass lift beside its entrance, as high as its highest platform, and a walkway from it to each platform
  const lifts = Object.entries(R.STATIONS).map(([id, st]) => {
    const plats = R.PLATFORMS.filter((p) => p.station === id);
    const lift = R.liftOf(id); const lx = lift.x; const lz = lift.z; const ground = lift.y;
    // Low access pier passes under the raised rail; the upper walkway stays on the door side.
    const [ex, ez] = st.entry; const accessLength = Math.hypot(lx - ex, lz - ez);
    const access = new THREE.Group(); access.position.set((ex + lx) / 2, ground, (ez + lz) / 2); access.rotation.y = Math.atan2(lx - ex, lz - ez); group.add(access);
    const ag = mergeColored([part(G.box, DECK, 0, -.1, 0, { sx: 1.8, sy: .2, sz: accessLength }),
      ...[-.85, .85].map(x => part(G.box, FRAME, x, .5, 0, { sx: .06, sy: .06, sz: accessLength }))]); made.push(ag); access.add(new THREE.Mesh(ag, vcMat));
    const top = Math.max(...plats.map((p) => p.y)) + 2.6;
    const cx = plats.reduce((a, p) => a + p.x, 0) / plats.length; const cz = plats.reduce((a, p) => a + p.z, 0) / plats.length;
    const d = Math.hypot(cx - lx, cz - lz) || 1; const ux = (cx - lx) / d; const uz = (cz - lz) / d;
    const holder = new THREE.Group(); holder.position.set(lx, ground, lz); holder.rotation.y = Math.atan2(ux, uz); group.add(holder);
    const H = top - ground;
    const parts = [part(G.box, SAGE, 0, 0.1, 0, { sx: 2.4, sy: 0.2, sz: 2.4 }), part(G.box, FRAME, 0, H, 0, { sx: 2.5, sy: 0.18, sz: 2.5 }),
      ...[[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]].map(([x, z]) => part(G.box, FRAME, x, H / 2, z, { sx: 0.14, sy: H, sz: 0.14 }))];
    // the walkways, level with each platform: from the lift out to the platform's near side (in the lift's own frame)
    const c = Math.cos(holder.rotation.y); const s = Math.sin(holder.rotation.y);
    for (const p of plats) {
      const wx = p.x - lx; const wz = p.z - lz; const wl = Math.hypot(wx, wz) || 1; const reach = Math.max(1.4, wl - 1.6);
      const midK = 1.2 + (reach - 1.2) / 2; const mx = (wx / wl) * midK; const mz = (wz / wl) * midK;
      const lxl = mx * c - mz * s; const lzl = mx * s + mz * c;
      parts.push(part(G.box, DECK, lxl, p.y - ground - 0.1, lzl, { sx: 1.6, sy: 0.2, sz: Math.max(0.2, reach - 1.2), ry: Math.atan2(wx, wz) - holder.rotation.y }));
    }
    const geo = mergeColored(parts); made.push(geo);
    const body = new THREE.Mesh(geo, vcMat); body.castShadow = true; holder.add(body);
    const shaft = new THREE.Mesh(G.box, glass); shaft.scale.set(2.2, H - 0.2, 2.2); shaft.position.y = H / 2; holder.add(shaft);
    const cabin = new THREE.Group(); holder.add(cabin);
    const cg = mergeColored([part(G.box, DECK, 0, 0.08, 0, { sx: 2, sy: 0.16, sz: 2 }), part(G.box, FRAME, 0, 2.4, 0, { sx: 2, sy: 0.08, sz: 2 })]); made.push(cg); cabin.add(new THREE.Mesh(cg, vcMat));
    sign?.(st.name, holder, H + 1.1);
    if (T.walkable(lx, lz)) solids.push({ x: lx, z: lz, r: 1.45 });
    return { id, x: lx, z: lz, top, ground, cabin };
  });

  // the trains: the carriage (stand-in: a sage frame, glass all round, four seats facing forward), doors open while it stands
  function carVisual() {
    const v = new THREE.Group();
    const parts = [part(G.box, 0x6b7480, 0, 0.2, 0, { sx: 1.0, sy: 0.3, sz: 3.6 }), part(G.box, FRAME, 0, 0.5, 0, { sx: 3.12, sy: 0.12, sz: 4.52 }),
      part(G.box, SAGE, 0, 3.32, 0, { sx: 3.12, sy: 0.12, sz: 4.52 }),
      ...[[-1.5, -2.2], [1.5, -2.2], [-1.5, 2.2], [1.5, 2.2]].map(([x, z]) => part(G.box, FRAME, x, 1.9, z, { sx: 0.1, sy: 2.8, sz: 0.1 })),
      ...R.SEATS.map(([x, , z]) => part(G.box, SAGE, x, 0.9, z + 0.05, { sx: 0.8, sy: 0.12, sz: 0.6 })),
      ...R.SEATS.map(([x, , z]) => part(G.box, SAGE, x, 1.3, z + 0.38, { sx: 0.8, sy: 0.7, sz: 0.1 }))];
    const geo = mergeColored(parts); made.push(geo);
    const body = new THREE.Mesh(geo, vcMat); body.castShadow = true; v.add(body);
    const shell = new THREE.Mesh(G.box, glass); shell.scale.set(3.0, 2.7, 4.4); shell.position.y = 1.9; shell.renderOrder = 2; v.add(shell);
    return v;
  }
  const trains = R.TRAINS.map((t) => {
    const h = new THREE.Group(); group.add(h); if (R.LINES[t.line].side > 0) h.scale.x = -1;
    const rec = { id: t.id, h, mixer: null, open: null, close: null, opened: false, wheels: [] };
    assets.attach('train.car', h, carVisual(), (entry) => { // the model: its door clips and its wheels
      for (const a of rec.actions || []) a.mixer.stopAllAction(); rec.actions = []; rec.mixer = null; rec.opened = false; rec.wheels = [];
      if (!entry) return;
      h.traverse((o) => {
        if (/^Wheel_[LR]_[FB]$/.test(o.name)) rec.wheels.push(o);
        if (!o.animations?.length) return;
        const mixer = new THREE.AnimationMixer(o); const actions = { mixer };
        for (const [key, name] of [['open', 'DoorOpen'], ['close', 'DoorClose']]) {
          const clip = o.animations.find((c) => c.name === name); if (!clip) continue;
          const action = mixer.clipAction(clip); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; actions[key] = action;
        }
        rec.actions.push(actions); rec.mixer = mixer;
      });
    });
    return rec;
  });

  let last = null;
  function step(ms) {
    const dt = last === null ? 0 : Math.min(0.2, Math.max(0, (ms - last) / 1000)); last = ms;
    for (const rec of trains) {
      const car = R.carOf(rec.id, ms);
      rec.h.position.set(car.x, car.y, car.z); rec.h.rotation.y = car.carYaw;
      for (const w of rec.wheels) w.rotation.x = -car.s / 0.18; // rolled as far as it has come (a wheel 0.18 in radius)
      const open = Boolean(car.stop) && car.wait > 0.7; // open as it arrives, closed 0.7 s before it leaves
      for (const a of rec.actions || []) { if (open !== rec.opened) { (open ? a.close : a.open)?.stop(); (open ? a.open : a.close)?.reset().play(); } a.mixer.update(dt); }
      rec.opened = open;
    }
  }
  const dispose = () => { for (const rec of trains) for (const a of rec.actions || []) a.mixer.stopAllAction(); for (const x of made) x.dispose(); scene.remove(group); };
  return { group, step, dispose, liftAt: (id, y) => { const lift = lifts.find((l) => l.id === id); if (lift) lift.cabin.position.y = Math.max(0, y - lift.ground); }, debug: () => ({ pillars: pillarAt.length, platforms: R.PLATFORMS.length, lifts: lifts.length, cars: trains.map((t) => ({ id: t.id, x: +t.h.position.x.toFixed(1), y: +t.h.position.y.toFixed(1), z: +t.h.position.z.toFixed(1), model: Boolean(t.mixer), mixers: (t.actions || []).length, wheels: t.wheels.length, opened: t.opened })) }) };
}
