// v1.10.271 섬 택시 (gamecenter-notes docs/taxi-20261104.md): the two stops (a little roofed bench, its sign), a taxi standing at
// each, and every ride's taxi on the road by the shared clock (island-taxi.js) -- mine and everyone's, the same on each screen.
// The model (assets 99: its doors open as one gets in or out, its wheels roll) or, till it comes, a yellow stand-in.
import * as THREE from '/vendor/three/three.module.js';

const T = globalThis.IslandTerrain; const X = globalThis.IslandTaxi;
const SEAT = X.SEAT; // (island-taxi.js: the rider's root on the car's floor, v1.10.286)

export function taxiScene({ scene, assets, mark = null }) { // (v1.10.285 mark: a little 「빵」 over a car passing someone -- no sound)
  const group = new THREE.Group(); group.name = 'taxi'; scene.add(group);
  const made = []; const box = new THREE.BoxGeometry(1, 1, 1); made.push(box);
  const mat = (color, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...extra }); made.push(m); return m; };
  const yellow = mat(0xf2c230); const cream = mat(0xfff4d2); const wood = mat(0x9a6b45); const roofMat = mat(0x3f7d68); const lamp = mat(0xfff3c2, { emissive: 0xffd36b, emissiveIntensity: 0 });
  const piece = (g, m, sx, sy, sz, x, y, z) => { const o = new THREE.Mesh(box, m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  function carStandIn() { const g = new THREE.Group(); piece(g, yellow, 1.7, 0.9, 3.2, 0, 0.75, 0); piece(g, cream, 1.5, 0.7, 1.8, 0, 1.55, -0.2); piece(g, lamp, 0.5, 0.18, 0.3, 0, 2.0, -0.2); return g; }
  function stopStandIn() { const g = new THREE.Group(); for (const x of [-1.2, 1.2]) piece(g, wood, 0.12, 2.3, 0.12, x, 1.15, -0.4); piece(g, roofMat, 2.9, 0.12, 1.4, 0, 2.35, 0); piece(g, wood, 2.2, 0.12, 0.5, 0, 0.5, -0.2); return g; }
  // a stop's sign: its words on a board over the bench, both sides
  // (294 7: drawn again with the seconds left while its car is away -- `o.userData.say(text)`)
  function signOf(text) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; made.push(tex); const m = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }); made.push(m);
    let shown = null; const say = (t) => { if (t === shown) return; shown = t; x.fillStyle = '#fff6e3'; x.fillRect(0, 0, 512, 96); x.strokeStyle = '#8a6b45'; x.lineWidth = 6; x.strokeRect(3, 3, 506, 90);
      x.fillStyle = '#4a3828'; let px = 40; do { x.font = `700 ${px}px sans-serif`; px -= 2; } while (x.measureText(t).width > 480 && px > 14); /* (294: the seconds too -- shrunk to fit the board) */ x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, 256, 50); tex.needsUpdate = true; };
    say(text); const plane = new THREE.PlaneGeometry(2.6, 0.49); made.push(plane); const o = new THREE.Mesh(plane, m); o.position.y = 2.75; o.userData.say = say; return o;
  }
  const groundY = (x, z) => T.heightAt(x, z);
  function car() {
    const h = new THREE.Group(); group.add(h); const rec = { h, doors: [], wheels: [], lights: [] };
    const fallback = carStandIn(); h.add(fallback); /* (v1.10.285: in the scene -- attach only hides it once the model is in; it never showed) */
    assets.attach('taxi.car', h, fallback, (entry) => {
      rec.doors = []; rec.wheels = []; rec.lights = []; if (!entry) return;
      h.traverse((o) => { if (o.name === 'door_L') rec.doors.push({ o, side: -1, yaw0: o.rotation.y }); /* (the bench's side: only that door opens, 0 -> -70°) */ if (/wheel/i.test(o.name) && !/mesh/i.test(o.name)) rec.wheels.push(o); if (o.material && /glow/.test(o.material.name || '')) rec.lights.push(o.material); });
    });
    return rec;
  }
  // a car where a ride's pose says: on the ground (the bridge's arch too), its lean, its doors open while one gets in or out
  function placeCar(rec, pose) {
    rec.h.position.set(pose.x, groundY(pose.x, pose.z), pose.z); rec.h.rotation.set(pose.pitch || 0, pose.yaw, pose.roll || 0, 'YXZ');
    const open = X.doorOf(pose.phase, Math.min(1, Math.max(0, pose.k || 0))); /* (assets 99 motions.json: TaxiEnter opens 0~0.14 and shuts 0.86~1, TaxiExit 0~0.12 and 0.80~1) */
    for (const d of rec.doors) d.o.rotation.y = d.yaw0 + d.side * open * 1.22;
    for (const w of rec.wheels) w.rotation.x = -(pose.d || 0) / 0.32;
  }
  const stops = Object.keys(X.STOPS).map((id) => {
    const s = X.stopOf(id); const shelter = new THREE.Group(); shelter.position.set(s.shelter.x, groundY(s.shelter.x, s.shelter.z), s.shelter.z); shelter.rotation.y = s.shelter.yaw; group.add(shelter);
    const fallback = stopStandIn(); shelter.add(fallback); assets.attach('taxi.stop', shelter, fallback); const sign = signOf(s.sign); shelter.add(sign);
    const standing = car(); placeCar(standing, { x: s.x, z: s.z, yaw: s.yaw, phase: 'wait', d: 0 });
    return { id, s, standing, sign };
  });
  const moving = new Map(); // (294 7) stop id -> its car while out (there, the turn, back)
  let night = false;
  // each frame: `rides` [{ key, ride }] I know of and `out` { stopId: ride } the server's -- one car a stop (294 7): on its ride, then
  // empty back the same road (IslandTaxi.carAt) -- the standing one away till it is in its place again, its sign the seconds left
  function step(now, rides, people = [], out = {}) { // (v1.10.285 people: [{ x, z }] on foot -- a running car within 2 m of one honks)
    const live = new Set(); const byStop = { ...out }; for (const { ride } of rides) if (!byStop[ride.from] || byStop[ride.from].startedAt <= ride.startedAt) byStop[ride.from] = ride;
    for (const [key, ride] of Object.entries(byStop)) {
      const p = X.carAt(ride, now); if (!p) continue; live.add(key);
      let rec = moving.get(key); if (!rec) { rec = car(); moving.set(key, rec); }
      placeCar(rec, p); rec.running = ['start', 'run', 'stop', 'back'].includes(p.phase);
      if (mark && rec.running && people.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < 2)) { if (!rec.horn) { rec.horn = mark(); rec.horn.position.y = 2.6; rec.h.add(rec.horn); } rec.hornUntil = now + 1200; }
      if (rec.horn) rec.horn.visible = rec.hornUntil > now;
    }
    for (const [key, rec] of moving) if (!live.has(key)) { group.remove(rec.h); moving.delete(key); } /* (in its place: the standing one again) */
    for (const st of stops) {
      const away = live.has(st.id); st.standing.h.visible = !away;
      const left = away ? Math.max(1, Math.ceil((X.backOf(byStop[st.id]) - now) / 1000)) : 0; st.sign.userData.say(left ? `${st.s.sign} · 약 ${left}초` : st.s.sign);
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
  // (v1.10.285) the cars on their way or parked after a ride: where, which way, running or not, honking -- they block and others step aside
  const cars = () => [...moving.entries()].map(([key, r]) => ({ key, x: r.h.position.x, z: r.h.position.z, yaw: r.h.rotation.y, running: Boolean(r.running), horn: Boolean(r.horn?.visible) }));
  return { group, step, seatOf, setNight, dispose, cars, stops: () => stops.map((st) => ({ id: st.id, x: st.s.x, z: st.s.z, standing: st.standing.h.visible, away: [...moving.keys()].includes(st.id) })), /* (294) */ moving: () => [...moving.keys()] };
}
