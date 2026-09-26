// 잿빛 원정 3D scene: primitive, self-made models only (no external assets). Owns every Three.js
// object it creates and releases all of them in dispose(), so leaving the room leaves nothing
// running or allocated.
import * as THREE from '/vendor/three/three.module.js';

const CLASS_COLOR = { guardian: 0x60a5fa, hunter: 0x4ade80, arcanist: 0xc084fc };
const SEAT_COLOR = { 1: 0xfacc15, 2: 0x38bdf8, 3: 0xf472b6, 4: 0xa3e635 };
const MOB_STYLE = {
  grunt: { color: 0xa16207, scale: 1 }, archer: { color: 0x15803d, scale: 0.95 }, charger: { color: 0xb45309, scale: 1.1 },
  caster: { color: 0x7c3aed, scale: 1 }, swarm: { color: 0x64748b, scale: 0.6 }, brute: { color: 0x475569, scale: 1.9 },
  wolf: { color: 0xe7e5e4, scale: 0.9 }, boss: { color: 0xb91c1c, scale: 2.6 },
};
const EL_COLOR = { fire: 0xfb923c, frost: 0x7dd3fc, shock: 0xfde047, phys: 0xe2e8f0 };

export function createScene(canvasHost) {
  const disposables = new Set();
  const track = (thing) => { disposables.add(thing); return thing; };
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (error) {
    return null; // no WebGL: the caller shows a notice
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvasHost.append(renderer.domElement);
  renderer.domElement.className = 'rpgCanvas';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f1a);
  scene.fog = new THREE.Fog(0x0b0f1a, 34, 70);
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.5, 200);
  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x1a1208, 0.85));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.6);
  sun.position.set(-10, 24, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 70 });
  scene.add(sun);

  // Shared geometry/material pools (created once, disposed on exit).
  const geo = {
    capsule: track(new THREE.CapsuleGeometry(0.42, 0.7, 4, 12)), head: track(new THREE.SphereGeometry(0.28, 16, 12)),
    box: track(new THREE.BoxGeometry(1, 1, 1)), sphere: track(new THREE.SphereGeometry(0.5, 16, 12)), cone: track(new THREE.ConeGeometry(0.5, 1, 14)),
    cyl: track(new THREE.CylinderGeometry(0.5, 0.5, 1, 16)), ring: track(new THREE.RingGeometry(0.62, 0.8, 32)), disc: track(new THREE.CircleGeometry(1, 40)),
    torus: track(new THREE.TorusGeometry(0.35, 0.05, 8, 20, Math.PI)), octa: track(new THREE.OctahedronGeometry(0.5)), dodeca: track(new THREE.DodecahedronGeometry(0.6)),
    plane: track(new THREE.PlaneGeometry(1, 1)),
  };
  const matCache = new Map();
  const mat = (color, opts = {}) => {
    const key = `${color}:${JSON.stringify(opts)}`;
    if (!matCache.has(key)) matCache.set(key, track(new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, ...opts })));
    return matCache.get(key);
  };
  const basic = (color, opts = {}) => {
    const key = `b${color}:${JSON.stringify(opts)}`;
    if (!matCache.has(key)) matCache.set(key, track(new THREE.MeshBasicMaterial({ color, ...opts })));
    return matCache.get(key);
  };
  const mesh = (g, m, { shadow = true } = {}) => { const o = new THREE.Mesh(g, m); o.castShadow = shadow; o.receiveShadow = false; return o; };

  const world = new THREE.Group();
  scene.add(world);
  let roomGroup = null;
  let roomKey = null;
  let lastBounds = null;
  let door = null;
  let chest = null;
  const players = new Map();
  const mobs = new Map();
  const projectiles = new Map();
  const hazards = new Map();
  const spawns = [];
  const effects = [];
  const clock = { now: 0 };

  function disposeObject(obj) {
    obj.traverse?.((child) => {
      if (child.geometry && !Object.values(geo).includes(child.geometry)) child.geometry.dispose();
      if (child.material && child.userData.ownMaterial) child.material.dispose();
    });
    obj.parent?.remove(obj);
  }

  // ---- room -------------------------------------------------------------------------------

  function floorTexture(kind) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = kind === 'boss' ? '#2a1414' : kind === 'treasure' ? '#2a2412' : '#1c2130';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = kind === 'boss' ? 'rgba(248,113,113,.18)' : 'rgba(148,163,184,.16)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 256; i += 64) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke(); }
    for (let i = 0; i < 40; i += 1) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; ctx.fillRect(Math.random() * 256, Math.random() * 256, 12, 12); }
    const tex = track(new THREE.CanvasTexture(c));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function buildRoom(room) {
    const key = `${room.layoutId}:${room.kind}:${room.index}`;
    if (key === roomKey) return;
    if (roomGroup) disposeObject(roomGroup);
    roomKey = key;
    roomGroup = new THREE.Group();
    world.add(roomGroup);
    const b = room.bounds;
    const tex = floorTexture(room.kind);
    const floorMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
    const wallMat = mat(room.kind === 'boss' ? 0x3f1d1d : 0x334155, { roughness: 0.9 });
    let floor;
    if (b.type === 'rect') {
      tex.repeat.set(b.w / 4, b.h / 4);
      floor = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), floorMat);
      const h = 1.4; const t = 0.8;
      for (const [x, z, w, d] of [[0, -b.h / 2 - t / 2, b.w + t * 2, t], [0, b.h / 2 + t / 2, b.w + t * 2, t], [-b.w / 2 - t / 2, 0, t, b.h], [b.w / 2 + t / 2, 0, t, b.h]]) {
        const wall = mesh(geo.box, wallMat); wall.scale.set(w, h, d); wall.position.set(x, h / 2, z); wall.receiveShadow = true; roomGroup.add(wall);
      }
    } else {
      tex.repeat.set(b.r / 2, b.r / 2);
      floor = new THREE.Mesh(new THREE.CircleGeometry(b.r, 64), floorMat);
      const segments = 36;
      for (let i = 0; i < segments; i += 1) {
        const a = (i / segments) * Math.PI * 2;
        const wall = mesh(geo.box, wallMat); wall.scale.set(2 * Math.PI * (b.r + 0.4) / segments + 0.05, 1.4, 0.8);
        wall.position.set(Math.sin(a) * (b.r + 0.4), 0.7, -Math.cos(a) * (b.r + 0.4)); wall.rotation.y = -a; roomGroup.add(wall);
      }
    }
    floor.userData.ownMaterial = true;
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    roomGroup.add(floor);
    for (const o of room.obstacles) {
      if (o.type === 'circle') {
        const pillar = mesh(geo.cyl, mat(0x64748b)); pillar.scale.set(o.r * 2, 3, o.r * 2); pillar.position.set(o.x, 1.5, o.z); pillar.receiveShadow = true; roomGroup.add(pillar);
        const cap = mesh(geo.cyl, mat(0x94a3b8)); cap.scale.set(o.r * 2.4, 0.3, o.r * 2.4); cap.position.set(o.x, 3.1, o.z); roomGroup.add(cap);
      } else {
        const block = mesh(geo.box, mat(0x475569)); block.scale.set(o.w, 1.6, o.d); block.position.set(o.x, 0.8, o.z); block.receiveShadow = true; roomGroup.add(block);
      }
    }
    // Exit door on the top wall (opens once the room is cleared).
    const topZ = b.type === 'rect' ? -b.h / 2 - 0.4 : -b.r - 0.4;
    door = new THREE.Group();
    const frameMat = mat(0x78716c);
    for (const x of [-1.6, 1.6]) { const post = mesh(geo.box, frameMat); post.scale.set(0.5, 3, 0.9); post.position.set(x, 1.5, 0); door.add(post); }
    const lintel = mesh(geo.box, frameMat); lintel.scale.set(3.7, 0.5, 0.9); lintel.position.set(0, 3.1, 0); door.add(lintel);
    const gate = mesh(geo.box, mat(0x7f1d1d, { emissive: 0x220000 })); gate.scale.set(2.7, 2.8, 0.3); gate.position.set(0, 1.4, 0); gate.name = 'gate'; door.add(gate);
    door.position.set(0, 0, topZ);
    roomGroup.add(door);
    chest = null;
    if (room.chest) {
      chest = new THREE.Group();
      const base = mesh(geo.box, mat(0x92400e)); base.scale.set(1.6, 0.8, 1); base.position.y = 0.4; chest.add(base);
      const lid = mesh(geo.box, mat(0xb45309)); lid.scale.set(1.7, 0.35, 1.1); lid.position.y = 0.95; lid.name = 'lid'; chest.add(lid);
      const lock = mesh(geo.box, mat(0xfbbf24, { emissive: 0x6b4c00 })); lock.scale.set(0.25, 0.3, 0.1); lock.position.set(0, 0.7, 0.52); chest.add(lock);
      chest.position.set(0, 0, -1.5);
      roomGroup.add(chest);
    }
    lastBounds = b;
    fitCamera(b);
  }

  function fitCamera(b) {
    const w = b.type === 'rect' ? b.w : b.r * 2;
    const h = b.type === 'rect' ? b.h : b.r * 2;
    const span = Math.max(h * 1.05, w / Math.max(camera.aspect, 0.8) * 0.95);
    const distance = span / (2 * Math.tan((camera.fov * Math.PI / 180) / 2)) * 1.05;
    const tilt = 0.93; // radians from horizontal: a steep quarter view, never rotated by the player
    camera.position.set(0, Math.sin(tilt) * distance, Math.cos(tilt) * distance + h * 0.06);
    camera.lookAt(0, 0, h * 0.06);
  }

  function setRoomState(room) {
    if (door) {
      const gate = door.getObjectByName('gate');
      const target = room.cleared ? 3.6 : 1.4;
      gate.position.y += (target - gate.position.y) * 0.08;
      gate.material = room.cleared ? mat(0x14532d, { emissive: 0x0a3d1f }) : mat(0x7f1d1d, { emissive: 0x220000 });
    }
    if (chest) { const lid = chest.getObjectByName('lid'); lid.rotation.x += ((room.chestOpen ? -1.1 : 0) - lid.rotation.x) * 0.1; lid.position.z = room.chestOpen ? -0.3 : 0; }
  }

  // ---- characters -------------------------------------------------------------------------

  function hpBar(width, color) {
    const group = new THREE.Group();
    const back = new THREE.Mesh(geo.plane, basic(0x111827, { transparent: true, opacity: 0.85, depthTest: false }));
    back.scale.set(width, 0.14, 1);
    const fill = new THREE.Mesh(geo.plane, basic(color, { depthTest: false }));
    fill.scale.set(width, 0.1, 1); fill.position.z = 0.001;
    back.renderOrder = 10; fill.renderOrder = 11;
    group.add(back, fill);
    group.userData = { fill, width };
    return group;
  }

  function setBar(bar, share) {
    const { fill, width } = bar.userData;
    const s = Math.max(0.001, Math.min(1, share));
    fill.scale.x = width * s; fill.position.x = -width * (1 - s) / 2;
  }

  function makePlayer(cls, seat) {
    const g = new THREE.Group();
    const bodyMat = mat(CLASS_COLOR[cls] || 0xffffff);
    const body = mesh(geo.capsule, bodyMat); body.position.y = 0.8; g.add(body);
    const head = mesh(geo.head, mat(0xf5d0a9)); head.position.y = 1.65; g.add(head);
    if (cls === 'guardian') {
      const shield = mesh(geo.box, mat(0x94a3b8, { metalness: 0.6 })); shield.scale.set(0.12, 0.8, 0.6); shield.position.set(-0.5, 0.9, -0.1); g.add(shield);
      const sword = mesh(geo.box, mat(0xe5e7eb, { metalness: 0.8 })); sword.scale.set(0.08, 0.08, 1.1); sword.position.set(0.5, 0.95, -0.45); sword.name = 'weapon'; g.add(sword);
      const helm = mesh(geo.cyl, mat(0x64748b, { metalness: 0.5 })); helm.scale.set(0.62, 0.22, 0.62); helm.position.y = 1.82; g.add(helm);
    } else if (cls === 'hunter') {
      const hood = mesh(geo.cone, mat(0x166534)); hood.scale.set(0.7, 0.6, 0.7); hood.position.y = 1.95; g.add(hood);
      const bow = mesh(geo.torus, mat(0x92400e)); bow.scale.set(1.3, 1.3, 1.3); bow.rotation.set(0, Math.PI / 2, Math.PI / 2); bow.position.set(0.45, 0.95, -0.35); bow.name = 'weapon'; g.add(bow);
      const quiver = mesh(geo.cyl, mat(0x78350f)); quiver.scale.set(0.2, 0.6, 0.2); quiver.position.set(-0.25, 1.1, 0.35); quiver.rotation.x = 0.3; g.add(quiver);
    } else {
      const hat = mesh(geo.cone, mat(0x581c87)); hat.scale.set(0.8, 0.9, 0.8); hat.position.y = 2.1; g.add(hat);
      const staff = mesh(geo.cyl, mat(0x78350f)); staff.scale.set(0.07, 1.7, 0.07); staff.position.set(0.5, 0.9, -0.2); g.add(staff);
      const orb = mesh(geo.sphere, mat(0xe9d5ff, { emissive: 0xa855f7, emissiveIntensity: 1.2 })); orb.scale.setScalar(0.3); orb.position.set(0.5, 1.8, -0.2); orb.name = 'weapon'; g.add(orb);
    }
    const ring = new THREE.Mesh(geo.ring, basic(SEAT_COLOR[seat] || 0xffffff, { transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.name = 'ring'; g.add(ring);
    const shield = new THREE.Mesh(geo.sphere, basic(0x93c5fd, { transparent: true, opacity: 0.22 })); shield.scale.setScalar(2.2); shield.position.y = 0.9; shield.visible = false; shield.name = 'shield'; g.add(shield);
    const bar = hpBar(1.2, 0x22c55e); bar.position.y = 2.55; bar.name = 'bar'; g.add(bar);
    const revive = hpBar(1.2, 0x38bdf8); revive.position.y = 2.8; revive.visible = false; revive.name = 'revive'; g.add(revive);
    world.add(g);
    return g;
  }

  function makeMob(kind, flags) {
    const style = MOB_STYLE[kind] || MOB_STYLE.grunt;
    const g = new THREE.Group();
    const own = new THREE.MeshStandardMaterial({ color: style.color, roughness: 0.6, emissive: 0x000000 });
    const inner = new THREE.Group(); inner.name = 'inner'; g.add(inner);
    const part = (geometry, material, sx, sy, sz, x, y, z) => { const m = mesh(geometry, material); m.scale.set(sx, sy, sz); m.position.set(x, y, z); inner.add(m); return m; };
    if (kind === 'grunt') { part(geo.box, own, 0.9, 1.0, 0.7, 0, 0.6, 0); part(geo.sphere, own, 0.6, 0.6, 0.6, 0, 1.35, 0); part(geo.box, mat(0x44403c), 0.12, 0.12, 0.8, 0.5, 0.8, -0.4); }
    else if (kind === 'archer') { part(geo.cone, own, 0.7, 1.4, 0.7, 0, 0.7, 0); part(geo.sphere, mat(0x86efac), 0.45, 0.45, 0.45, 0, 1.55, 0); part(geo.torus, mat(0x3f6212), 1.1, 1.1, 1.1, 0.45, 0.9, -0.3).rotation.set(0, Math.PI / 2, Math.PI / 2); }
    else if (kind === 'charger') { part(geo.box, own, 0.9, 0.8, 1.6, 0, 0.55, 0); part(geo.box, own, 0.6, 0.55, 0.5, 0, 0.7, -0.95); for (const x of [-0.25, 0.25]) part(geo.cone, mat(0xfef3c7), 0.14, 0.45, 0.14, x, 0.9, -1.25).rotation.x = -1.2; }
    else if (kind === 'caster') { part(geo.cone, own, 0.9, 1.5, 0.9, 0, 0.75, 0); part(geo.sphere, mat(0xd8b4fe), 0.4, 0.4, 0.4, 0, 1.6, 0); part(geo.sphere, mat(0xf0abfc, { emissive: 0xc026d3, emissiveIntensity: 1.3 }), 0.3, 0.3, 0.3, 0.55, 1.4, -0.3).name = 'orb'; }
    else if (kind === 'swarm') { part(geo.octa, own, 0.7, 0.5, 0.7, 0, 0.9, 0); for (const x of [-0.45, 0.45]) part(geo.box, mat(0x334155), 0.6, 0.04, 0.3, x, 0.95, 0).name = 'wing'; }
    else if (kind === 'brute') { part(geo.dodeca, own, 1.4, 1.5, 1.2, 0, 1.2, 0); part(geo.sphere, own, 0.8, 0.7, 0.8, 0, 2.2, -0.1); for (const x of [-0.95, 0.95]) part(geo.box, own, 0.45, 1.2, 0.45, x, 0.9, 0); }
    else if (kind === 'wolf') { part(geo.box, own, 0.5, 0.5, 1.1, 0, 0.5, 0); part(geo.box, own, 0.4, 0.4, 0.45, 0, 0.7, -0.65); part(geo.cone, own, 0.12, 0.25, 0.12, 0, 0.55, 0.65).rotation.x = 1.3; }
    else if (kind === 'boss') {
      part(geo.dodeca, own, 1.6, 1.7, 1.4, 0, 1.5, 0); part(geo.sphere, mat(0x7f1d1d), 0.95, 0.85, 0.95, 0, 2.7, -0.2);
      for (const x of [-0.45, 0.45]) { part(geo.cone, mat(0xfde68a), 0.2, 0.7, 0.2, x, 3.3, -0.2).rotation.z = x > 0 ? -0.4 : 0.4; part(geo.sphere, mat(0xfff7ed, { emissive: 0xf97316, emissiveIntensity: 2 }), 0.14, 0.1, 0.1, x * 0.6, 2.8, -0.9); }
      for (const x of [-1.25, 1.25]) part(geo.box, own, 0.55, 1.6, 0.55, x, 1.3, 0);
      part(geo.box, mat(0xfbbf24, { metalness: 0.8 }), 1.1, 0.25, 1.1, 0, 3.15, -0.2);
    }
    inner.scale.setScalar(style.scale > 1.5 ? style.scale / 1.6 : style.scale);
    if (kind === 'boss') inner.scale.setScalar(1.25);
    g.userData.own = own;
    g.traverse(child => { if (child.material === own) child.userData.ownMaterial = true; });
    if (flags.el || flags.bo) {
      const aura = new THREE.Mesh(geo.ring, basic(flags.bo ? 0xef4444 : 0xfbbf24, { transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
      aura.rotation.x = -Math.PI / 2; aura.position.y = 0.04; aura.scale.setScalar(flags.bo ? 3.2 : 2.2); aura.name = 'aura'; g.add(aura);
    }
    if (!flags.al) { const bar = hpBar(flags.bo ? 0 : flags.el ? 1.8 : 1, flags.el ? 0xfbbf24 : 0xef4444); bar.position.y = kind === 'brute' ? 3.4 : kind === 'swarm' ? 1.6 : 2.3; bar.name = 'bar'; bar.visible = !flags.bo; g.add(bar); }
    world.add(g);
    return g;
  }

  // ---- projectiles, hazards, fx -------------------------------------------------------------

  function makeProjectile(kind, owner) {
    const style = {
      arrow: [geo.cyl, mat(0xfef3c7, { emissive: 0x4d3b00 }), [0.08, 0.9, 0.08], true], bolt: [geo.sphere, basic(0xd8b4fe), [0.4, 0.4, 0.4]],
      fire: [geo.sphere, basic(0xfb923c), [0.75, 0.75, 0.75]], pierce: [geo.cyl, basic(0xa7f3d0), [0.16, 1.6, 0.16], true], bomb: [geo.sphere, mat(0x292524, { emissive: 0x7c2d12 }), [0.45, 0.45, 0.45]],
      shard: [geo.cone, basic(0xbae6fd), [0.2, 0.5, 0.2], true], thorn: [geo.cone, basic(0x84cc16), [0.25, 0.7, 0.25], true],
    }[kind] || [geo.sphere, basic(owner === 'm' ? 0xef4444 : 0xffffff), [0.3, 0.3, 0.3]];
    const m = new THREE.Mesh(style[0], style[1]);
    m.scale.set(...style[2]);
    m.userData.lie = Boolean(style[3]);
    const g = new THREE.Group(); g.add(m); g.position.y = 1;
    world.add(g);
    return g;
  }

  function hazardMesh(h) {
    const friendly = h.o === 'p';
    const color = friendly ? 0xfbbf24 : h.el === 'fire' ? 0xf97316 : 0xef4444;
    let shape;
    if (h.k === 'circle') shape = new THREE.CircleGeometry(h.r, 48);
    else if (h.k === 'ring') shape = new THREE.RingGeometry(h.r2, h.r, 64);
    else if (h.k === 'cone') { const arc = h.arc * Math.PI / 180; shape = new THREE.CircleGeometry(h.r, 40, Math.PI / 2 - arc / 2, arc); }
    else { shape = new THREE.PlaneGeometry(h.w, h.len); shape.translate(0, h.len / 2, 0); }
    const g = new THREE.Group();
    const area = new THREE.Mesh(shape, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    const fill = new THREE.Mesh(shape, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
    const edge = new THREE.LineLoop(new THREE.EdgesGeometry(shape), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
    for (const part of [area, fill, edge]) { part.userData.ownMaterial = true; part.rotation.x = -Math.PI / 2; g.add(part); }
    area.position.y = 0.05; fill.position.y = 0.06; edge.position.y = 0.07;
    g.userData = { fill, area, total: Math.max(0.2, h.f), kind: h.k };
    // Cones and lines point along the monster's facing (0 = screen up).
    if (h.k === 'cone' || h.k === 'line') g.rotation.y = -(h.a || 0);
    g.position.set(h.x, 0, h.z);
    world.add(g);
    return g;
  }

  function addEffect(obj, life, update) { world.add(obj); effects.push({ obj, born: clock.now, life, update }); }

  function nova(x, z, r, el) {
    const m = new THREE.Mesh(geo.ring, new THREE.MeshBasicMaterial({ color: EL_COLOR[el] || 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    m.userData.ownMaterial = true; m.rotation.x = -Math.PI / 2; m.position.set(x, 0.12, z);
    addEffect(m, 0.4, (o, k) => { const s = r * (0.3 + 0.8 * k); o.scale.setScalar(s); o.material.opacity = 0.9 * (1 - k); });
  }

  function swing(x, z, a, r, arc, heavy) {
    const arcRad = arc * Math.PI / 180;
    const shape = new THREE.RingGeometry(r * 0.35, r, 32, 1, Math.PI / 2 - arcRad / 2, arcRad);
    const m = new THREE.Mesh(shape, new THREE.MeshBasicMaterial({ color: heavy ? 0x93c5fd : 0xf8fafc, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    m.userData.ownMaterial = true; m.rotation.x = -Math.PI / 2;
    const g = new THREE.Group(); g.add(m); g.rotation.y = -a; g.position.set(x, 0.5, z);
    addEffect(g, 0.18, (o, k) => { m.material.opacity = 0.55 * (1 - k); });
  }

  function lightning(points) {
    const verts = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const [ax, az] = points[i]; const [bx, bz] = points[i + 1];
      const steps = 5;
      for (let s = 0; s < steps; s += 1) {
        const t0 = s / steps; const t1 = (s + 1) / steps; const j = s === steps - 1 ? 0 : 0.35;
        verts.push(ax + (bx - ax) * t0, 1.1, az + (bz - az) * t0, ax + (bx - ax) * t1 + (Math.random() - 0.5) * j, 1.1, az + (bz - az) * t1 + (Math.random() - 0.5) * j);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const line = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 1 }));
    line.userData.ownMaterial = true;
    addEffect(line, 0.25, (o, k) => { o.material.opacity = 1 - k; });
  }

  function burst(x, z, color, count = 10, height = 1) {
    for (let i = 0; i < count; i += 1) {
      const m = new THREE.Mesh(geo.box, basic(color, { transparent: true, opacity: 1 }));
      const a = Math.random() * Math.PI * 2; const v = 2 + Math.random() * 3;
      m.scale.setScalar(0.12 + Math.random() * 0.1); m.position.set(x, height, z);
      const vx = Math.sin(a) * v; const vz = Math.cos(a) * v; const vy = 2 + Math.random() * 3;
      addEffect(m, 0.6, (o, k, dt) => { o.position.x += vx * dt; o.position.z += vz * dt; o.position.y = height + vy * k * 0.6 - 3 * k * k; o.rotation.x += dt * 8; });
    }
  }

  function column(x, z, color) {
    const m = new THREE.Mesh(geo.cyl, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false }));
    m.userData.ownMaterial = true; m.position.set(x, 2, z);
    addEffect(m, 0.9, (o, k) => { o.scale.set(1.4 * (1 - k * 0.5), 4 + k * 3, 1.4 * (1 - k * 0.5)); o.material.opacity = 0.5 * (1 - k); });
  }

  // ---- sync with interpolated game state -----------------------------------------------------

  function syncPlayers(list, meSeat, classes) {
    const seen = new Set();
    for (const p of list) {
      seen.add(p.s);
      let obj = players.get(p.s);
      if (!obj) { obj = makePlayer(classes[p.s], p.s); players.set(p.s, obj); }
      obj.position.set(p.x, 0, p.z);
      obj.rotation.y = -p.a;
      const down = p.st === 'down';
      obj.rotation.z = down ? Math.PI / 2.4 : 0;
      obj.position.y = down ? 0.3 : 0;
      obj.getObjectByName('shield').visible = p.sh > 0;
      const bar = obj.getObjectByName('bar'); setBar(bar, p.hp / p.mh); bar.quaternion.copy(camera.quaternion).premultiply(obj.quaternion.clone().invert());
      const revive = obj.getObjectByName('revive'); revive.visible = down && p.rv > 0; if (revive.visible) { setBar(revive, p.rv); revive.quaternion.copy(bar.quaternion); }
      const ring = obj.getObjectByName('ring'); ring.scale.setScalar(p.s === meSeat ? 1.25 + Math.sin(clock.now * 5) * 0.05 : 1);
      obj.traverse(child => { if (child.isMesh && child.name !== 'ring' && child.name !== 'shield' && child.parent?.name !== 'bar' && child.parent?.name !== 'revive') child.visible = !(p.d && Math.floor(clock.now * 30) % 2); });
      const weapon = obj.getObjectByName('weapon');
      if (weapon && p.swingAt) { const k = Math.min(1, (clock.now - p.swingAt) / 0.2); weapon.rotation.y = k < 1 ? Math.sin(k * Math.PI) * 1.2 : 0; }
    }
    for (const [seat, obj] of players) if (!seen.has(seat)) { disposeObject(obj); players.delete(seat); }
  }

  function syncMobs(list) {
    const seen = new Set();
    for (const m of list) {
      seen.add(m.i);
      let obj = mobs.get(m.i);
      if (!obj) { obj = makeMob(m.k, m); obj.userData.born = clock.now; mobs.set(m.i, obj); }
      obj.position.set(m.x, 0, m.z);
      obj.rotation.y = -m.a;
      const inner = obj.getObjectByName('inner');
      const age = clock.now - obj.userData.born;
      const grow = Math.min(1, age / 0.3);
      inner.position.y = m.k === 'swarm' ? Math.sin(clock.now * 9 + m.i) * 0.2 : 0;
      obj.scale.setScalar(grow);
      const own = obj.userData.own;
      const flash = obj.userData.hitAt && clock.now - obj.userData.hitAt < 0.1;
      own.emissive.setHex(flash ? 0xffffff : m.fr ? 0x1e3a8a : m.bu ? 0x7c2d12 : m.st === 'w' ? (Math.floor(clock.now * 12) % 2 ? 0x7f1d1d : 0x000000) : m.sn ? 0x4d3b00 : 0x000000);
      own.color.setHex(m.fr ? 0x93c5fd : (MOB_STYLE[m.k] || MOB_STYLE.grunt).color);
      if (m.sl && !m.fr) own.color.lerp(new THREE.Color(0x7dd3fc), 0.35);
      const bar = obj.getObjectByName('bar');
      if (bar) { setBar(bar, m.hp / m.mh); bar.quaternion.copy(camera.quaternion).premultiply(obj.quaternion.clone().invert()); }
      const aura = obj.getObjectByName('aura'); if (aura) aura.rotation.z = clock.now;
      for (const wing of inner.children.filter(c => c.name === 'wing')) wing.rotation.z = Math.sin(clock.now * 20) * 0.6 * Math.sign(wing.position.x);
    }
    for (const [mid, obj] of mobs) if (!seen.has(mid)) { burst(obj.position.x, obj.position.z, 0x9ca3af, 8); disposeObject(obj); mobs.delete(mid); }
  }

  function syncProjectiles(list) {
    const seen = new Set();
    for (const pr of list) {
      seen.add(pr.i);
      let obj = projectiles.get(pr.i);
      if (!obj) { obj = makeProjectile(pr.k, pr.o); projectiles.set(pr.i, obj); }
      obj.position.set(pr.x, 1, pr.z);
      obj.rotation.y = -pr.a;
      const inner = obj.children[0];
      if (inner.userData.lie) inner.rotation.x = -Math.PI / 2;
    }
    for (const [pid, obj] of projectiles) if (!seen.has(pid)) { disposeObject(obj); projectiles.delete(pid); }
  }

  function syncHazards(list) {
    const seen = new Set();
    for (const h of list) {
      seen.add(h.i);
      let obj = hazards.get(h.i);
      if (!obj) { obj = hazardMesh(h); hazards.set(h.i, obj); }
      const { fill, area, total } = obj.userData;
      if (h.fired) {
        const k = Math.min(1, (clock.now - (obj.userData.firedAt ??= clock.now)) / 0.3);
        fill.scale.setScalar(1); fill.material.opacity = 0.75 * (1 - k); area.material.opacity = 0.3 * (1 - k); fill.material.color.setHex(0xfff7ed);
      } else {
        const progress = 1 - Math.max(0, h.f) / total;
        if (obj.userData.kind === 'line') fill.scale.set(1, Math.max(0.01, progress), 1);
        else fill.scale.setScalar(Math.max(0.01, progress));
      }
    }
    for (const [hid, obj] of hazards) if (!seen.has(hid)) { disposeObject(obj); hazards.delete(hid); }
  }

  function syncSpawns(list) {
    while (spawns.length > list.length) disposeObject(spawns.pop());
    list.forEach((s, i) => {
      if (!spawns[i]) {
        const g = new THREE.Group();
        const disc = new THREE.Mesh(geo.disc, new THREE.MeshBasicMaterial({ color: s.k === 'boss' ? 0xef4444 : 0xa855f7, transparent: true, opacity: 0.35, depthWrite: false }));
        disc.userData.ownMaterial = true; disc.rotation.x = -Math.PI / 2; g.add(disc);
        const pillar = new THREE.Mesh(geo.cyl, new THREE.MeshBasicMaterial({ color: 0xc084fc, transparent: true, opacity: 0.25, depthWrite: false }));
        pillar.userData.ownMaterial = true; pillar.scale.set(0.8, 2.5, 0.8); pillar.position.y = 1.25; g.add(pillar);
        world.add(g); spawns[i] = g;
      }
      const g = spawns[i];
      g.position.set(s.x, 0.04, s.z);
      const k = 1 - Math.max(0, Math.min(1, s.f / 0.9));
      g.children[0].scale.setScalar((s.k === 'boss' ? 3 : 0.9) * (0.4 + k * 0.6));
      g.children[1].material.opacity = 0.15 + 0.3 * k;
      g.rotation.y = clock.now * 3;
    });
  }

  function onFx(event, localPos) {
    if (event.k === 'nova') nova(event.x, event.z, event.r, event.el);
    else if (event.k === 'swing') { const p = localPos(event.s); if (p) swing(p.x, p.z, event.a, event.r, event.arc, event.heavy); const obj = players.get(event.s); if (obj) obj.userData.swingAt = clock.now; }
    else if (event.k === 'chain') lightning(event.pts);
    else if (event.k === 'dmg') { const obj = [...mobs.values()].find(o => Math.hypot(o.position.x - event.x, o.position.z - event.z) < 0.8); if (obj) obj.userData.hitAt = clock.now; if (event.c) burst(event.x, event.z, 0xfde047, 5, 1.2); }
    else if (event.k === 'die' && event.boss) { burst(event.x, event.z, 0xf97316, 40, 2); column(event.x, event.z, 0xf97316); }
    else if (event.k === 'level') { const p = localPos(event.s); if (p) { column(p.x, p.z, 0xfde047); burst(p.x, p.z, 0xfde047, 16, 1.5); } }
    else if (event.k === 'revive') { const p = localPos(event.s); if (p) column(p.x, p.z, 0x38bdf8); }
    else if (event.k === 'item') { const p = localPos(event.s); if (p) burst(p.x, p.z, 0xc084fc, 14, 1.4); }
    else if (event.k === 'dash') { const p = localPos(event.s); if (p) burst(p.x, p.z, 0xe2e8f0, 6, 0.4); }
  }

  function update(view, dt) {
    clock.now += dt;
    if (view.room) { buildRoom(view.room); setRoomState(view.room); }
    for (const p of view.players) { const obj = players.get(p.s); p.swingAt = obj?.userData.swingAt; }
    syncPlayers(view.players, view.me, view.classes);
    syncMobs(view.mobs);
    syncProjectiles(view.projectiles);
    syncHazards(view.hazards);
    syncSpawns(view.spawns);
    for (let i = effects.length - 1; i >= 0; i -= 1) {
      const e = effects[i];
      const k = (clock.now - e.born) / e.life;
      if (k >= 1) { disposeObject(e.obj); effects.splice(i, 1); continue; }
      e.update(e.obj, k, dt);
    }
  }

  function render() { renderer.render(scene, camera); }

  function resize(width, height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    if (lastBounds) fitCamera(lastBounds);
  }

  // Screen position of a world point (for the HTML overlay: names, damage numbers).
  function project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    return { x: (v.x + 1) / 2 * rect.width, y: (1 - v.y) / 2 * rect.height, visible: v.z < 1 };
  }

  function dispose() {
    for (const obj of [...players.values(), ...mobs.values(), ...projectiles.values(), ...hazards.values(), ...spawns]) disposeObject(obj);
    for (const e of effects) disposeObject(e.obj);
    if (roomGroup) disposeObject(roomGroup);
    for (const thing of disposables) thing.dispose?.();
    renderer.dispose();
    renderer.forceContextLoss?.();
    renderer.domElement.remove();
    players.clear(); mobs.clear(); projectiles.clear(); hazards.clear(); spawns.length = 0; effects.length = 0; disposables.clear(); matCache.clear();
  }

  return { update, render, resize, project, onFx, dispose, stats: () => ({ players: players.size, mobs: mobs.size, projectiles: projectiles.size, hazards: hazards.size, effects: effects.length, geometries: renderer.info.memory.geometries }) };
}
