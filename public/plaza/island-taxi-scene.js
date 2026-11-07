// v1.10.271 섬 택시 (gamecenter-notes docs/taxi-20261104.md): the two stops (a little roofed bench, its sign), a taxi standing at
// each, and every ride's taxi on the road by the shared clock (island-taxi.js) -- mine and everyone's, the same on each screen.
// The model (assets 99: its doors open as one gets in or out, its wheels roll) or, till it comes, a yellow stand-in.
import * as THREE from '/vendor/three/three.module.js';

const T = globalThis.IslandTerrain; const X = globalThis.IslandTaxi;
const SEAT = { x: 0, y: 0.1, z: -0.12 }; // (assets 99: the one back seat, [0, 0.10, 0.12] in the model's own frame -- turned round here)

export function taxiScene({ scene, assets }) {
  const group = new THREE.Group(); group.name = 'taxi'; scene.add(group);
  const made = []; const box = new THREE.BoxGeometry(1, 1, 1); made.push(box);
  const mat = (color, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...extra }); made.push(m); return m; };
  const yellow = mat(0xf2c230); const cream = mat(0xfff4d2); const wood = mat(0x9a6b45); const roofMat = mat(0x3f7d68); const lamp = mat(0xfff3c2, { emissive: 0xffd36b, emissiveIntensity: 0 });
  const piece = (g, m, sx, sy, sz, x, y, z) => { const o = new THREE.Mesh(box, m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  function carStandIn() { const g = new THREE.Group(); piece(g, yellow, 1.7, 0.9, 3.2, 0, 0.75, 0); piece(g, cream, 1.5, 0.7, 1.8, 0, 1.55, -0.2); piece(g, lamp, 0.5, 0.18, 0.3, 0, 2.0, -0.2); return g; }
  function stopStandIn() { const g = new THREE.Group(); for (const x of [-1.2, 1.2]) piece(g, wood, 0.12, 2.3, 0.12, x, 1.15, -0.4); piece(g, roofMat, 2.9, 0.12, 1.4, 0, 2.35, 0); piece(g, wood, 2.2, 0.12, 0.5, 0, 0.5, -0.2); return g; }
  // a stop's sign: its words on a board over the bench, both sides
  function signOf(text) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
    x.fillStyle = '#fff6e3'; x.fillRect(0, 0, 512, 96); x.strokeStyle = '#8a6b45'; x.lineWidth = 6; x.strokeRect(3, 3, 506, 90);
    x.fillStyle = '#4a3828'; x.font = '700 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 50);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; made.push(tex); const m = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }); made.push(m);
    const plane = new THREE.PlaneGeometry(2.6, 0.49); made.push(plane); const o = new THREE.Mesh(plane, m); o.position.y = 2.75; return o;
  }
  const groundY = (x, z) => T.heightAt(x, z);
  function car() {
    const h = new THREE.Group(); group.add(h); const rec = { h, doors: [], wheels: [], lights: [] };
    assets.attach('taxi.car', h, carStandIn(), (entry) => {
      rec.doors = []; rec.wheels = []; rec.lights = []; if (!entry) return;
      h.traverse((o) => { if (o.name === 'door_L') rec.doors.push({ o, side: -1, yaw0: o.rotation.y }); /* (the bench's side: only that door opens, 0 -> -70°) */ if (/wheel/i.test(o.name) && !/mesh/i.test(o.name)) rec.wheels.push(o); if (o.material && /glow/.test(o.material.name || '')) rec.lights.push(o.material); });
    });
    return rec;
  }
  // a car where a ride's pose says: on the ground (the bridge's arch too), its lean, its doors open while one gets in or out
  function placeCar(rec, pose) {
    rec.h.position.set(pose.x, groundY(pose.x, pose.z), pose.z); rec.h.rotation.set(pose.pitch || 0, pose.yaw, pose.roll || 0, 'YXZ');
    const open = pose.phase === 'enter' || pose.phase === 'exit' ? Math.sin(Math.PI * Math.min(1, Math.max(0, pose.k))) : 0;
    for (const d of rec.doors) d.o.rotation.y = d.yaw0 + d.side * open * 1.22;
    for (const w of rec.wheels) w.rotation.x = -(pose.d || 0) / 0.32;
  }
  const stops = Object.keys(X.STOPS).map((id) => {
    const s = X.stopOf(id); const shelter = new THREE.Group(); shelter.position.set(s.shelter.x, groundY(s.shelter.x, s.shelter.z), s.shelter.z); shelter.rotation.y = s.shelter.yaw; group.add(shelter);
    assets.attach('taxi.stop', shelter, stopStandIn()); shelter.add(signOf(s.sign));
    const standing = car(); placeCar(standing, { x: s.x, z: s.z, yaw: s.yaw, phase: 'wait', d: 0 });
    return { id, s, standing };
  });
  const moving = new Map(); // key (mine: 'me'; another's: their id) -> car
  let night = false;
  // each frame: `rides` [{ key, ride }] -- a car for each on its way, the standing ones away while one leaves or arrives there
  function step(now, rides) {
    const live = new Set();
    for (const { key, ride } of rides) {
      const p = X.poseAt(ride, now); if (p.phase === 'done') continue; live.add(key);
      let rec = moving.get(key); if (!rec) { rec = car(); moving.set(key, rec); }
      placeCar(rec, p);
    }
    for (const [key, rec] of moving) if (!live.has(key)) { group.remove(rec.h); moving.delete(key); }
    for (const st of stops) {
      const busy = rides.some(({ ride }) => { const p = X.poseAt(ride, now); if (p.phase === 'done') return false; return (ride.from === st.id && now - ride.startedAt < X.ENTER + 2000) || Math.hypot(p.x - st.s.x, p.z - st.s.z) < 6; });
      st.standing.h.visible = !busy;
    }
    for (const rec of [...moving.values(), ...stops.map((s) => s.standing)]) for (const m of rec.lights) m.emissiveIntensity = night ? 1.2 : 0;
    lamp.emissiveIntensity = night ? 1.2 : 0;
  }
  // where a rider sits in a ride's car now (their pose then: seated, facing the car's way)
  function seatOf(ride, now) {
    const p = X.poseAt(ride, now); const c = Math.cos(p.yaw); const s = Math.sin(p.yaw);
    return { x: p.x + SEAT.x * c + SEAT.z * s, y: groundY(p.x, p.z) + SEAT.y, z: p.z - SEAT.x * s + SEAT.z * c, yaw: p.yaw, phase: p.phase, k: p.k, pose: p };
  }
  const setNight = (on) => { night = Boolean(on); };
  const dispose = () => { scene.remove(group); for (const m of made) m.dispose?.(); };
  return { group, step, seatOf, setNight, dispose, stops: () => stops.map((st) => ({ id: st.id, x: st.s.x, z: st.s.z, standing: st.standing.h.visible })), moving: () => [...moving.keys()] };
}
