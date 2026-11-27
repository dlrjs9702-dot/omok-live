// v1.10.271 섬 택시 (gamecenter-notes docs/taxi-20261104.md): the two stops (a little roofed bench, its sign), a taxi standing at
// each, and every ride's taxi on the road by the shared clock (island-taxi.js) -- mine and everyone's, the same on each screen.
// The model (assets 99: its doors open as one gets in or out, its wheels roll) or, till it comes, a yellow stand-in.
import * as THREE from '/vendor/three/three.module.js';

const T = globalThis.IslandTerrain; const X = globalThis.IslandTaxi;
const SEAT = X.SEAT; // (island-taxi.js: the rider's root on the car's floor, v1.10.286)

export function taxiScene({ scene, assets, mark = null, tag = null }) { /* (294 7 tag: a name tag maker -- the stop's 「돌아오는 중」) */ // (v1.10.285 mark: a little 「빵」 over a car passing someone -- no sound)
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
    const sign = new THREE.Group(); h.add(sign); assets.attach('taxi.roof_sign', sign, new THREE.Group()); /* (1.10.423 다듬기 164 ⑦: the roof's 택시 mark -- in the car file's own frame) */
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
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false }); made.push(depthOnly); /* (403: a see-through car's depth, drawn first) */
  // 1.10.340 133A: a car see-through (its own copies of the materials -- the model's are shared by every car), solid again after
  function ghostCar(rec, on) {
    if (Boolean(rec.ghost) === Boolean(on)) return; rec.ghost = Boolean(on);
    const meshes = []; rec.h.traverse((o) => { if (!o.isMesh || o.userData.depthOnly || o === rec.horn || o === rec.ask || rec.horn?.children?.includes(o) || rec.ask?.children?.includes(o)) return; meshes.push(o); });
    for (const o of meshes) {
      if (!o.userData.ownMat) { o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone(); o.userData.ownMat = true; for (const m of [].concat(o.material)) made.push(m); }
      for (const m of [].concat(o.material)) { m.transparent = rec.ghost; m.opacity = rec.ghost ? 0.4 : 1; m.depthWrite = !rec.ghost; m.needsUpdate = true; }
      /* (1.10.403 문제 기록 ④, notes issues-taxi-resident-20261122: see-through without depth its inner faces showed through -- seats, the far side --
         flickering as they sorted. Its depth first, no colour, after every solid thing (renderOrder: the one it goes by already drawn, seen
         through it) and before the see-through: then only its nearest face shows, at 0.4) */
      if (rec.ghost && !o.userData.depthTwin) { const d = new THREE.Mesh(o.geometry, depthOnly); d.userData.depthOnly = true; d.castShadow = false; d.receiveShadow = false; d.renderOrder = 10; o.add(d); o.userData.depthTwin = d; }
      if (o.userData.depthTwin) o.userData.depthTwin.visible = rec.ghost;
    }
  }
  for (const st of stops) st.standing.h.visible = false; /* (1.10.391 N4-a: the four cars below stand there -- the stop's own one no longer) */
  // 1.10.392 N4-b the road stops' signs (assets 163 taxi_stop_sign, 결정 41-3 A: its `plate` both faces -- one picture, the back's u turned
  // round -- the stop's name); a stand-in post and board till it comes
  function plateWords(text) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#fff6e3'; x.fillRect(0, 0, 512, 256); x.strokeStyle = '#8a6b45'; x.lineWidth = 10; x.strokeRect(5, 5, 502, 246);
    x.fillStyle = '#4a3828'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '800 64px sans-serif'; x.fillText('🚕 택시', 256, 82); let px = 58; do { x.font = `700 ${px}px sans-serif`; px -= 2; } while (x.measureText(text).width > 470 && px > 20); x.fillText(text, 256, 178);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; made.push(tex); return tex; }
  /* (1.10.410 사용자 결정 65-3 A: a sign and a mark on both sides of the road at every stop -- a car stands on its own way's side) */
  const roadSigns = Object.keys(X.ROADSTOPS || {}).flatMap((id) => [1, -1].map((side) => [id, side])).map(([id, side]) => {
    const at = X.curbOf(id, side).sign; const g = new THREE.Group(); g.position.set(at.x, groundY(at.x, at.z), at.z); g.rotation.y = at.yaw; group.add(g);
    const fb = new THREE.Group(); piece(fb, wood, 0.12, 2.3, 0.12, 0, 1.15, 0); piece(fb, cream, 0.95, 0.5, 0.06, 0, 2.0, 0); g.add(fb);
    const words = plateWords(X.labelOf(id)); const face = new THREE.MeshStandardMaterial({ map: words, roughness: 0.85 }); made.push(face);
    assets.attach('taxi.stop_sign', g, fb, (entry) => { if (!entry) return; g.traverse((o) => { if (o.isMesh && [].concat(o.material).some((m) => m?.name === 'stop_plate')) o.material = face; }); });
    return { id, side, g, at };
  });
  /* (1.10.399 assets 168, 에셋 검사 2회차 「길에서 표지 옆면만 · 종점 벤치~첫 차」: where one stands to get in, every place -- a round taxi mark in the
     ground (read from any side; off the car's way: past the curb); at a terminal a lane of 1 m tiles from the bench's front to the mark, its
     chevrons to the car. Walked over (no solids); a flat stand-in till the models come) */
  const markMat = new THREE.MeshStandardMaterial({ color: 0xf0be43, roughness: 0.8 }); made.push(markMat);
  const marks = X.PLACE_IDS().flatMap((id) => (X.ROADSTOPS?.[id] ? [1, -1].map((s) => X.boardOf(id, s)) : [X.boardOf(id)])).map((at) => {
    const g = new THREE.Group(); g.position.set(at.x, groundY(at.x, at.z), at.z); group.add(g);
    const fb = new THREE.Group(); piece(fb, markMat, 0.9, 0.03, 0.9, 0, 0.015, 0); g.add(fb); assets.attach('taxi.stop_mark', g, fb); return g;
  });
  /* (399 에셋 검사 2회차 「택시 대기 자리 빛」: a warm pool round each mark at night -- drawn, no real light) */
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd38a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); made.push(glowMat);
  const glowGeo = new THREE.CircleGeometry(1.0, 20).rotateX(-Math.PI / 2); made.push(glowGeo);
  const markGlows = marks.map((g) => { const m = new THREE.Mesh(glowGeo, glowMat); m.position.set(g.position.x, g.position.y + 0.05, g.position.z); m.visible = false; group.add(m); return m; });
  const lanes = [];
  for (const st of stops) {
    const out = st.s.out; const sh = st.s.shelter; const dx = out.x - sh.x; const dz = out.z - sh.z; const len = Math.hypot(dx, dz) || 1; const ux = dx / len; const uz = dz / len;
    const S = { x: sh.x + ux * 0.45, z: sh.z + uz * 0.45 }; const E = { x: out.x - ux * 0.46, z: out.z - uz * 0.46 }; const L = Math.hypot(E.x - S.x, E.z - S.z); if (L < 0.3) continue;
    const n = Math.max(1, Math.round(L));
    for (let k = 0; k < n; k += 1) { const x = S.x + ((k + 0.5) / n) * (E.x - S.x); const z = S.z + ((k + 0.5) / n) * (E.z - S.z);
      const g = new THREE.Group(); g.position.set(x, groundY(x, z), z); /* (the model 4 cm into the ground already) */ g.rotation.y = Math.atan2(-ux, -uz); g.scale.z = L / n; group.add(g);
      const fb = new THREE.Group(); piece(fb, markMat, 0.5, 0.05, 1, 0, 0.025, 0); g.add(fb); assets.attach('taxi.lane', g, fb); lanes.push(g); }
  }
  const moving = new Map(); // (1.10.391 N4-a) car id -> its record: the four cars, standing in their places or out on a ride
  let night = false;
  // each frame: `rides` [{ key, ride }] I know of and `fleet` { cars } the server's (391: two a stop -- standing in a place, or out on a
  // ride: there, then staying in a place there or back empty to one at home; IslandTaxi.carAt) -- a stop with none standing says when one comes
  const live = new Set(); const rideOf = new Map(); const standCount = {}; /* (1.10.353 재사용 ③: kept between frames, emptied each) */
  const startFleet = X.createFleet(0).cars; /* (till the server's comes: two standing at each stop) */
  const sm = (k) => { const t = Math.min(1, Math.max(0, k)); return t * t * (3 - 2 * t); };
  function step(now, rides, people = [], fleet = {}) { // (v1.10.285 people: [{ x, z }] on foot -- a running car within 2 m of one honks)
    live.clear(); rideOf.clear(); for (const k in standCount) delete standCount[k];
    const cars = Array.isArray(fleet?.cars) ? fleet.cars : startFleet;
    for (const { ride } of rides) if (ride?.car) rideOf.set(ride.car, ride);
    for (const c of cars) {
      const known = rideOf.get(c.id); let ride = c.ride || null; if (!ride && known && !X.rideOver(known, now)) ride = known; /* (just taken: before the server's fleet says so) */
      if (ride && known && known.startedAt === ride.startedAt) ride = { ...ride, warp: known.warp ?? ride.warp, side: known.side ?? ride.side, ghost: known.ghost ?? ride.ghost, blockedAt: known.blockedAt ?? ride.blockedAt }; /* (my own ride's clock: fresher) */
      let rec = moving.get(c.id); if (!rec) { rec = car(); moving.set(c.id, rec); }
      let p = ride ? X.carAt(ride, now) : null;
      if (ride && !p) { const home = ride.stay ? X.toOf(ride) : ride.from; const side = ride.stay && X.ROADSTOPS?.[home] ? X.arriveSide(ride.from, home) : undefined; /* (1.10.399 · 1.10.434 Codex P2-19: preserve arrival side at road stops) */ p = { ...X.placeOf(home, ride.park || 0, side), phase: 'wait', d: 0 }; } /* (in its place, before the server says so) */
      if (!ride) { const q = X.placeOf(c.at, c.place, c.curb); standCount[c.at] = (standCount[c.at] || 0) + 1;
        if (c.pulledAt && c.place === 0 && now - c.pulledAt < 2000) { const f = X.placeOf(c.at, 1); const k = sm((now - c.pulledAt) / 2000); p = { x: f.x + (q.x - f.x) * k, z: f.z + (q.z - f.z) * k, yaw: q.yaw, phase: 'wait', d: k * X.BACK }; } /* (the one behind pulling up) */
        else p = { ...q, phase: 'wait', d: 0 }; }
      if (ride) live.add(c.id);
      placeCar(rec, p); rec.running = Boolean(ride) && ['start', 'run', 'stop', 'back'].includes(p.phase); rec.out = Boolean(ride); rec.rate = ride ? X.rateOf(ride, now) : 1; rec.waitMs = ride?.blockedAt ? Math.max(0, now - ride.blockedAt) : 0;
      if (!ride) { if (rec.horn) rec.horn.visible = false; if (rec.ask) rec.ask.visible = false; ghostCar(rec, false); continue; }
      /* (317 A2: 「빵」 once the server has had it waiting for someone in front -- no sound; 1.10.340 133A: after 1 s, with 「비켜 주세요~」) */
      if (mark && rec.running && rec.waitMs >= 1000) { if (!rec.horn) { rec.horn = mark(); rec.horn.position.y = 3.4; /* (317: over the rider's name) */ rec.h.add(rec.horn); } if (tag && !rec.ask) { rec.ask = tag('비켜 주세요~'); rec.ask.position.y = 4.3; rec.h.add(rec.ask); } rec.hornUntil = now + 600; }
      if (rec.horn) rec.horn.visible = rec.hornUntil > now; if (rec.ask) rec.ask.visible = rec.hornUntil > now;
      ghostCar(rec, X.ghostAt(ride, now)); /* (133A: no room aside -- see-through going by) */
    }
    for (const st of stops) {
      const away = !standCount[st.id];
      const left = away ? Math.max(1, Math.ceil(X.etaAt({ cars }, st.id, now) / 1000)) : 0; st.sign.userData.say(left ? `${st.s.sign} · 약 ${left}초` : st.s.sign);
      const say = left ? `🚕 돌아오는 중 · ${left}초` : ''; /* (294: big, over the stop -- the sign's seconds were too small to read) */
      if (tag && say !== st.said) { st.said = say; if (st.label) { group.remove(st.label); st.label.traverse((o) => { o.material?.map?.dispose?.(); o.material?.dispose?.(); }); st.label = null; } if (say) { st.label = tag(say); st.label.position.set(st.s.shelter.x, groundY(st.s.shelter.x, st.s.shelter.z) + 3.7, st.s.shelter.z); group.add(st.label); } }
    }
    for (const rec of moving.values()) for (const m of rec.lights) m.emissiveIntensity = night ? 1.2 : 0;
    lamp.emissiveIntensity = night ? 1.2 : 0; for (const m of markGlows) m.visible = night; /* (399) */
  }
  // where a rider sits in a ride's car now (their pose then: seated, facing the car's way)
  function seatOf(ride, now) {
    const p = X.poseAt(ride, now); const c = Math.cos(p.yaw); const s = Math.sin(p.yaw);
    return { x: p.x + SEAT.x * c + SEAT.z * s, y: groundY(p.x, p.z) + SEAT.y, z: p.z - SEAT.x * s + SEAT.z * c, yaw: p.yaw, phase: p.phase, k: p.k, pose: p };
  }
  const setNight = (on) => { night = Boolean(on); };
  const dispose = () => { scene.remove(group); for (const m of made) m.dispose?.(); };
  // (v1.10.285) the cars on their way or parked after a ride: where, which way, running or not, honking -- they block and others step aside
  const cars = () => [...moving.entries()].filter(([, r]) => r.out).map(([key, r]) => ({ key, x: r.h.position.x, z: r.h.position.z, yaw: r.h.rotation.y, running: Boolean(r.running), horn: Boolean(r.horn?.visible), ask: Boolean(r.ask?.visible), ghost: Boolean(r.ghost), rate: r.rate ?? 1, waitMs: r.waitMs || 0 })); /* (317: its pace -- 0 standing for someone, a little creeping by; 391: the cars out) */
  return { group, step, seatOf, setNight, dispose, cars, stops: () => stops.map((st) => ({ id: st.id, x: st.s.x, z: st.s.z, standing: Boolean(standCount[st.id]), count: standCount[st.id] || 0, away: !standCount[st.id], label: st.said || '' })), /* (294; 391: how many stand there) */ moving: () => [...moving.entries()].filter(([, r]) => r.out).map(([k]) => k), roadSigns: () => roadSigns.map((s) => ({ id: s.id, x: +s.at.x.toFixed(2), z: +s.at.z.toFixed(2), model: s.g.children.length > 1 })), /* (392) */ floorMarks: () => ({ marks: marks.length, lanes: lanes.length }), /* (399) */ parked: () => [...moving.entries()].filter(([, r]) => !r.out).map(([k, r]) => ({ id: k, x: +r.h.position.x.toFixed(2), z: +r.h.position.z.toFixed(2) })) };
}
