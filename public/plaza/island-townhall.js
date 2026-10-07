// v1.10.41 관공서 확장 (IDEAS 「관공서 확장·대리석 앞마당·야간 조명」, 사용자 확정 2026-10-07): before the marble town hall a
// walled marble yard -- 1.3 m walls with posts and corners, a 3.2 m open gate between two lit pillars -- with grand lamps
// that keep the yard bright at night (two real lights over it, a pool of light under each lamp), and the mayor standing
// in the gate. He lets a player in for the rest of their visit once asked (the server keeps the leave, island-terrain
// TOWNHALL / server.js townhallPass); until then he blocks the gate. Every piece is a batch at its place (townhall.*:
// the Codex v2 models over these stand-ins). Placed in the hall's own frame (lx right, lz toward the plaza).
import * as THREE from '/vendor/three/three.module.js';
import { part, mergeColored, heightAt } from './island.js';

const T = globalThis.IslandTerrain;
const MARBLE = 0xece6dc; const TRIM = 0xd8cfc0; const GOLD = 0xe2b84a; const GLOW = 0xffe6b0;
const G = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 12), ball: new THREE.SphereGeometry(1, 12, 8) };
const SHAPES = { // [lit parts, glowing parts]
  wall: () => [[part(G.box, MARBLE, 1, 0.6, 0, { sx: 2, sy: 1.2, sz: 0.4 }), part(G.box, TRIM, 1, 1.25, 0, { sx: 2.04, sy: 0.1, sz: 0.46 })], []],
  post: () => [[part(G.box, MARBLE, 0, 0.85, 0, { sx: 0.6, sy: 1.7, sz: 0.6 }), part(G.box, TRIM, 0, 1.75, 0, { sx: 0.66, sy: 0.1, sz: 0.66 })], []],
  corner: () => [[part(G.box, MARBLE, 0, 0.9, 0, { sx: 0.8, sy: 1.8, sz: 0.8 }), part(G.box, TRIM, 0, 1.85, 0, { sx: 0.86, sy: 0.1, sz: 0.86 })], []],
  gatePillar: () => [[part(G.box, MARBLE, 0, 1.4, 0, { sx: 0.9, sy: 2.8, sz: 0.9 }), part(G.box, TRIM, 0, 2.85, 0, { sx: 0.96, sy: 0.1, sz: 0.96 })], [part(G.ball, GLOW, 0, 3.05, 0, { sx: 0.22, sy: 0.22, sz: 0.22 })]],
  planter: () => [[part(G.cyl, MARBLE, 0, 0.35, 0, { sx: 0.8, sy: 0.7, sz: 0.8 }), part(G.ball, 0x6fae5a, 0, 0.75, 0, { sx: 0.65, sy: 0.35, sz: 0.65 })], []],
  lampA: () => [[part(G.cyl, MARBLE, 0, 0.2, 0, { sx: 0.4, sy: 0.4, sz: 0.4 }), part(G.cyl, TRIM, 0, 2.5, 0, { sx: 0.12, sy: 4.4, sz: 0.12 })], [part(G.box, GLOW, 0, 4.85, 0, { sx: 0.5, sy: 0.6, sz: 0.5 })]],
  lampB: () => [[part(G.cyl, MARBLE, 0, 0.2, 0, { sx: 0.4, sy: 0.4, sz: 0.4 }), part(G.cyl, TRIM, 0, 2.6, 0, { sx: 0.12, sy: 4.8, sz: 0.12 }), part(G.box, GOLD, 0, 4.9, 0, { sx: 1.5, sy: 0.08, sz: 0.08 })], [part(G.box, GLOW, -0.7, 4.6, 0, { sx: 0.4, sy: 0.5, sz: 0.4 }), part(G.box, GLOW, 0.7, 4.6, 0, { sx: 0.4, sy: 0.5, sz: 0.4 })]],
};
const MAYOR_LINES = ['관공서에 무슨 용무로 오셨소?', '이곳은 섬의 살림을 돌보는 곳이오. 용건을 말씀해 보시오.', '어서 오시오. 시장이오. 무슨 일로 오셨소?', '관공서는 언제나 열려 있소. 다만 용무는 들어야겠소.'];

export function townhallYard({ scene, assets, solids, vcMat, makeCharacter, dressUp, makeTag, fitTag, hall = null }) {
  const TH = T.TOWNHALL; const Y = TH.yard; const at = T.townhallWorld; const ry = TH.ry;
  const y0 = heightAt(TH.x, TH.z);
  const group = new THREE.Group(); group.name = 'townhall-yard'; scene.add(group);
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true }); const made = [glowMat];
  const place = Object.fromEntries(Object.keys(SHAPES).map((k) => [k, []]));
  const R = { post: 0.4, corner: 0.5, gatePillar: 0.55, planter: 0.9, lampA: 0.45, lampB: 0.5 };
  const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const up = new THREE.Vector3(0, 1, 0);
  const put = (kind, lx, lz, turn = 0, sx = 1) => {
    const p = at(lx, lz); place[kind].push(m4.compose(new THREE.Vector3(p.x, heightAt(p.x, p.z), p.z), q.setFromAxisAngle(up, ry + turn), new THREE.Vector3(sx, 1, 1)).clone());
    if (R[kind]) solids.push({ ...p, r: R[kind] });
  };
  // a wall from (ax, az) to (bx, bz) in the hall's frame: 2 m panels stretched to fit, a post every third panel, walked round
  function wall(ax, az, bx, bz) {
    const len = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.round(len / 2)); const seg = len / n;
    const turn = Math.atan2(-(bz - az), bx - ax); // the panel's +x along the run (in the hall's frame, then the hall's turn)
    for (let k = 0; k < n; k += 1) {
      const t = k / n; put('wall', ax + (bx - ax) * t, az + (bz - az) * t, turn, seg / 2);
      if (k > 0 && k % 3 === 0) put('post', ax + (bx - ax) * t, az + (bz - az) * t);
    }
    for (let d = 0; d <= len; d += 0.5) { const t = d / len; solids.push({ ...at(ax + (bx - ax) * t, az + (bz - az) * t), r: 0.32 }); }
  }
  const gx = TH.gate.hw + 0.45; // the gate pillars' centres, ±2.05
  wall(-Y.hx, Y.z1, -gx - 0.45, Y.z1); wall(gx + 0.45, Y.z1, Y.hx, Y.z1); // the front, either side of the gate
  wall(-Y.hx, 6, -Y.hx, Y.z1); wall(Y.hx, Y.z1, Y.hx, 6); // the sides, back to the terrace's front corners
  put('corner', -Y.hx, Y.z1); put('corner', Y.hx, Y.z1);
  for (const s of [-1, 1]) put('gatePillar', s * gx, Y.z1);
  for (const s of [-1, 1]) { put('lampA', s * (Y.hx - 1.1), 9.6); put('lampA', s * (Y.hx - 1.1), 14.4); put('lampB', s * 3.8, Y.z1 + 1.6); put('planter', s * 4.6, 8.8); }

  // the marble floor of the yard and a band before the gate (vertex colours, on the ground), and the steps' landing
  const floor = mergeColored([part(G.box, MARBLE, 0, 0.02, (6 + Y.z1) / 2, { sx: Y.hx * 2, sy: 0.04, sz: Y.z1 - 6 + 0.2 }), part(G.box, TRIM, 0, 0.035, Y.z1 + 1.6, { sx: 9, sy: 0.07, sz: 2.6 }),
    ...[-1, 1].map((s) => part(G.box, TRIM, s * (Y.hx - 0.4), 0.035, (6 + Y.z1) / 2, { sx: 0.5, sy: 0.07, sz: Y.z1 - 6 })), part(G.box, TRIM, 0, 0.035, 6.3, { sx: Y.hx * 2, sy: 0.07, sz: 0.5 })]); // from under the terrace's front edge
  // v1.10.45: every top 3 cm from the next (marble 0.04, trims and the gate band 0.07) -- the band's top and the lamps'
  // pools of light were at one height and flickered in stripes
  made.push(floor);
  const floorMesh = new THREE.Mesh(floor, vcMat); const o = at(0, 0); floorMesh.position.set(o.x, y0, o.z); floorMesh.rotation.y = ry; floorMesh.receiveShadow = true; group.add(floorMesh);

  for (const [kind, list] of Object.entries(place)) {
    if (!list.length) continue;
    const [body, glow] = SHAPES[kind](); const procedural = [];
    for (const [parts, material] of [[body, vcMat], [glow, glowMat]]) {
      if (!parts.length) continue;
      const geo = mergeColored(parts); made.push(geo);
      const im = new THREE.InstancedMesh(geo, material, list.length); list.forEach((mm, i) => im.setMatrixAt(i, mm));
      im.computeBoundingSphere(); im.castShadow = material === vcMat; im.receiveShadow = true; group.add(im); procedural.push(im);
    }
    const p = at(0, 11);
    assets.batch(`townhall.${kind}`, [{ x: p.x, z: p.z, parent: group, procedural, matrices: list, colors: null, shadow: true }]);
  }

  // night: two real lights over the yard (characters and their clothes read as by day), a pool of light under each lamp
  const lights = [at(0, 10.2), at(0, 14.8)].map((p) => { const l = new THREE.PointLight(0xfff1dc, 0, 15, 1.1); l.position.set(p.x, y0 + 5.2, p.z); group.add(l); return l; });
  const poolGeo = new THREE.CircleGeometry(3.2, 28).rotateX(-Math.PI / 2); made.push(poolGeo);
  const poolMat = new THREE.MeshBasicMaterial({ color: 0xffe9c4, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); made.push(poolMat);
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, place.lampA.length + place.lampB.length);
  [...place.lampA, ...place.lampB].forEach((mm, i) => { const p = new THREE.Vector3().setFromMatrixPosition(mm); pools.setMatrixAt(i, m4.makeTranslation(p.x, p.y + 0.11, p.z)); });
  pools.computeBoundingSphere(); pools.visible = false; pools.renderOrder = 1; group.add(pools);
  let glows = []; let seen = -1; let nightOn = false;
  // the two real lights are in the scene only near the yard (every lit material pays for each light in view or not)
  const yardMid = at(0, 11); const nearYard = (p) => Math.hypot(p.x - yardMid.x, p.z - yardMid.z) < 45;
  function setNight(on) {
    nightOn = on;
    for (const l of lights) l.intensity = on ? 11 : 0;
    pools.visible = on; glowMat.color.setScalar(on ? 1 : 0.85);
    if (group.children.length !== seen) { seen = group.children.length; glows = []; group.traverse((x) => { for (const m of [].concat(x.material || [])) if (m.name === 'glow' && !glows.includes(m)) glows.push(m); }); }
    for (const m of glows) m.emissiveIntensity = on ? 2.4 : 0.15;
    moonlit(on);
  }
  // v1.10.45: at night the hall's pale marble keeps a little light of its own -- the sides, out of the yard's lights and
  // away from the moon, were a flat dark block; no extra light (each one costs every lit material)
  const WALL_NIGHT = new THREE.Color(0x4a5262); let hallMeshes = -1;
  function moonlit(on) {
    if (!hall) return;
    let n = 0; hall.traverse((x) => { if (x.isMesh) n += 1; }); hallMeshes = n;
    hall.traverse((x) => {
      for (const m of [].concat(x.material || [])) {
        if (!m.emissive || m.name === 'glow' || m.transparent) continue;
        if (!m.userData.dayEmissive) m.userData.dayEmissive = m.emissive.getHex();
        const pale = m.color && m.color.r + m.color.g + m.color.b > 1.9; // the marble, not the roof, the windows or the doors
        m.emissive.set(on && pale ? WALL_NIGHT : m.userData.dayEmissive);
      }
    });
  }

  // the mayor: the common character in his suit, side-parted hair and navy loafers, standing guard in the gate
  const gate = at(0, Y.z1); const out = at(0, Y.z1 + 1.4);
  // v1.10.45: he steps forward out of the gate, then aside along the outside of the wall (going straight to a spot inside
  // he walked through the gate pillar and the wall); back the same way
  const mid = at(-0.9, Y.z1 + 0.85); const aside = at(-gx - 1.35, Y.z1 + 0.85);
  const spec = { shirt: 0x1f2a44, hair: 0x2b2b2b, skin: 0xffdcbc };
  const mayor = makeCharacter(spec); mayor.animNames = { idle: 'GuardIdle' }; mayor.noTuck = true;
  mayor.root.position.set(gate.x, heightAt(gate.x, gate.z), gate.z); mayor.root.rotation.y = ry; scene.add(mayor.root);
  dressUp(mayor, { gender: 'male', hair: 'avatar_hair_8', outfit: 'npc_outfit_suit', shoes: 'avatar_shoes_5', dye: { avatar_shoes_5: '#1f2a44' } }, spec);
  mayor.tag = makeTag('시장', null); mayor.root.add(mayor.tag); fitTag(mayor);
  const gateSolid = { x: gate.x, z: gate.z, r: 1.7, gate: true }; solids.push(gateSolid); // open to whoever has his leave
  let pass = false; let bowed = false; let lineAt = 0; let leg = 1; let frames = 0;
  const setPass = (on) => { if (on && !pass) mayor.anim?.play('usher'); if (Boolean(on) !== pass) leg = 0; pass = Boolean(on); };
  function step(dt, me, animate) {
    const lit = nightOn && nearYard(me.root.position); if (lights[0].visible !== lit) for (const l of lights) l.visible = lit;
    if (hall && nightOn && (frames += 1) % 60 === 0) { let n = 0; hall.traverse((x) => { if (x.isMesh) n += 1; }); if (n !== hallMeshes) moonlit(true); } // the model came in
    const route = pass ? [mid, aside] : [mid, gate]; const p = mayor.root.position;
    let to = route[Math.min(leg, 1)]; let d = Math.hypot(to.x - p.x, to.z - p.z);
    if (d <= 0.05 && leg < 1) { leg = 1; to = route[1]; d = Math.hypot(to.x - p.x, to.z - p.z); } const busy = mayor.anim && mayor.anim.state !== 'idle' && mayor.anim.state !== 'walk';
    const moving = d > 0.05 && !busy; const speed = moving ? 1.6 : 0;
    if (moving) { const k = Math.min(1, (speed * dt) / d); p.x += (to.x - p.x) * k; p.z += (to.z - p.z) * k; p.y = heightAt(p.x, p.z); mayor.targetYaw = Math.atan2(to.x - p.x, to.z - p.z); }
    else if (leg >= 1) mayor.targetYaw = pass ? ry + Math.PI / 2 : ry; // in the gate facing out; aside, facing across it
    const near = Math.hypot(me.root.position.x - out.x, me.root.position.z - out.z) < 3;
    if (near && !bowed && !pass) { bowed = mayor.anim?.play('bow') ?? false; }
    if (!near) bowed = false;
    animate(mayor, dt, moving, speed);
  }
  const line = () => MAYOR_LINES[(lineAt++) % MAYOR_LINES.length];
  const dispose = () => { for (const x of made) x.dispose(); scene.remove(group); scene.remove(mayor.root); };
  return { group, mayor, door: { x: out.x, z: out.z, name: '말 걸기' }, gateSolid, isOpen: () => pass, setPass, setNight, step, line, dispose,
    debug: () => ({ pass, solidOpen: pass, lit: lights[0].visible, mayorAt: { x: +mayor.root.position.x.toFixed(2), z: +mayor.root.position.z.toFixed(2) }, gate: { x: gate.x, z: gate.z }, mid, aside, out, lights: lights.map((l) => l.intensity), pools: pools.visible, poolY: +(new THREE.Vector3().setFromMatrixPosition(m4.fromArray(pools.instanceMatrix.array)).y - y0).toFixed(2), wallGlow: hall ? (() => { let g = 0; hall.traverse((x) => { for (const m of [].concat(x.material || [])) if (m.emissive && m.emissive.getHex() === WALL_NIGHT.getHex()) g += 1; }); return g; })() : null, worn: Boolean(mayor.assetRoot), clip: mayor.anim?.clip || null, kinds: Object.fromEntries(Object.entries(place).map(([k, v]) => [k, v.length])) }) };
}
