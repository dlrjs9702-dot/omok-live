// v1.8.8 3D 광장 로비 V1: a small daytime village square that is the lobby's hub. Self-made primitive models only,
// no external assets. Kept apart from the RPG scene (public/rpg/rpg-scene.js): the two share Three.js, nothing else.
// The scene knows facility ids and names only; what a facility opens is the caller's `onInteract(id)`.
import * as THREE from '/vendor/three/three.module.js';

const TAU = Math.PI * 2;
const SPEED = 5.2; // units per second: centre to any facility in about two seconds
const BOUND = 16.5; // walkable radius
const REACH = 2.4; // how close to a facility's door counts as "near"

// Facility layout around the fountain (angle 0 = straight ahead of the spawn point, away from the camera).
const LAYOUT = {
  games: { angle: 0, radius: 11.5, kind: 'hall', wall: 0xffe3b3, roof: 0xf08a6b },
  shop: { angle: -0.95, radius: 11, kind: 'shop', wall: 0xd9f0ff, roof: 0x6aa9e8 },
  records: { angle: 0.95, radius: 11, kind: 'house', wall: 0xf3e2ff, roof: 0x9b7fd6 },
  board: { angle: -1.9, radius: 10, kind: 'board' },
  missions: { angle: 1.9, radius: 10, kind: 'board', tint: 0x8fd18a },
  attendance: { angle: -2.7, radius: 8.5, kind: 'npc' },
  chat: { angle: 2.7, radius: 9, kind: 'gazebo' },
};

export function createPlaza(host, { facilities, onInteract, onNear, blocked }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (error) {
    return null; // no WebGL: the caller keeps the classic lobby
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'plazaCanvas';
  host.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfe6ff);
  scene.fog = new THREE.Fog(0xd7efff, 34, 70);
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 140);

  scene.add(new THREE.HemisphereLight(0xfff4dc, 0x8cc970, 1.05));
  const sun = new THREE.DirectionalLight(0xfff0d2, 1.75);
  sun.position.set(-9, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 60 });
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  const mats = new Map(); // one material per colour
  const mat = (color, extra = {}) => {
    const key = `${color}:${JSON.stringify(extra)}`;
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra }));
    return mats.get(key);
  };
  const mesh = (geometry, material, x = 0, y = 0, z = 0, parent = scene) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const solids = []; // {x, z, r}: what the character walks around

  // Ground: grass island, a few soft mounds, the paved centre and a curved walking loop with spokes.
  const ground = mesh(new THREE.CircleGeometry(60, 64), mat(0x9fd67f));
  ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
  for (const [x, z, s, c] of [[-14, -12, 4.5, 0x93cd74], [15, -10, 5, 0x97d17a], [-16, 9, 4, 0x93cd74], [14, 12, 4.2, 0x97d17a], [0, -20, 6, 0x91cb72]]) {
    const mound = mesh(new THREE.SphereGeometry(s, 24, 12), mat(c), x, -s * 0.78, z);
    mound.scale.y = 0.55; mound.castShadow = false;
  }
  const flat = (geometry, color, y, x = 0, z = 0, rot = 0) => {
    const m = mesh(geometry, mat(color), x, y, z);
    m.rotation.x = -Math.PI / 2; m.rotation.z = rot; m.castShadow = false;
    return m;
  };
  flat(new THREE.CircleGeometry(5.6, 48), 0xf3e6c8, 0.02);
  flat(new THREE.RingGeometry(5.6, 5.9, 48), 0xe2cfa6, 0.025);
  flat(new THREE.RingGeometry(8.1, 9.5, 64), 0xefdcb4, 0.02);
  for (const id of Object.keys(LAYOUT)) { // spokes from the centre to each facility, slightly bent
    const { angle, radius } = LAYOUT[id];
    const len = radius - 6.2;
    const mid = 5.6 + len / 2;
    flat(new THREE.PlaneGeometry(1.5, len), 0xefdcb4, 0.021, Math.sin(angle) * -mid, Math.cos(angle) * -mid, angle);
  }

  // Centre landmark: a round fountain with bobbing water drops.
  const fountain = new THREE.Group(); scene.add(fountain);
  mesh(new THREE.CylinderGeometry(2.5, 2.7, 0.55, 40), mat(0xeae3d6), 0, 0.27, 0, fountain);
  mesh(new THREE.CylinderGeometry(2.25, 2.25, 0.1, 40), mat(0x86d0f0, { roughness: 0.2, metalness: 0.1 }), 0, 0.52, 0, fountain);
  mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.5, 20), mat(0xeae3d6), 0, 1.2, 0, fountain);
  mesh(new THREE.CylinderGeometry(1.1, 0.6, 0.35, 28), mat(0xf1ebe0), 0, 1.95, 0, fountain);
  mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.06, 28), mat(0x86d0f0, { roughness: 0.2 }), 0, 2.1, 0, fountain);
  const drops = [];
  for (let i = 0; i < 8; i += 1) {
    const d = mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(0xc8ecff, { roughness: 0.1, transparent: true, opacity: 0.85 }), 0, 2.3, 0, fountain);
    d.castShadow = false; d.userData.phase = i / 8; drops.push(d);
  }
  solids.push({ x: 0, z: 0, r: 3.0 });

  // Benches and lamps around the fountain, trees and flower beds on the outer ring.
  for (let i = 0; i < 4; i += 1) {
    const a = Math.PI / 4 + (i * TAU) / 4;
    const bench = new THREE.Group(); scene.add(bench);
    bench.position.set(Math.sin(a) * 4.6, 0, Math.cos(a) * 4.6); bench.rotation.y = a + Math.PI;
    mesh(new THREE.BoxGeometry(1.7, 0.12, 0.55), mat(0xc58b5a), 0, 0.5, 0, bench);
    mesh(new THREE.BoxGeometry(1.7, 0.45, 0.1), mat(0xc58b5a), 0, 0.8, -0.25, bench);
    for (const x of [-0.7, 0.7]) mesh(new THREE.BoxGeometry(0.1, 0.5, 0.5), mat(0x6b5a4a), x, 0.25, 0, bench);
    solids.push({ x: bench.position.x, z: bench.position.z, r: 0.9 });
  }
  const lamps = [];
  for (const a of [-2.3, -1.425, -0.475, 0.475, 1.425, 2.3]) { // between the paths to the facilities
    const x = -Math.sin(a) * 7.2; const z = -Math.cos(a) * 7.2;
    mesh(new THREE.CylinderGeometry(0.08, 0.11, 2.6, 10), mat(0x4d6b5c), x, 1.3, z);
    lamps.push(mesh(new THREE.SphereGeometry(0.26, 16, 12), mat(0xfff3c2, { emissive: 0xffe08a, emissiveIntensity: 0.6 }), x, 2.75, z));
    solids.push({ x, z, r: 0.35 });
  }
  const tree = (x, z, s = 1) => {
    mesh(new THREE.CylinderGeometry(0.22 * s, 0.3 * s, 1.4 * s, 10), mat(0xa9774f), x, 0.7 * s, z);
    mesh(new THREE.SphereGeometry(1.25 * s, 20, 14), mat(0x76c267), x, 2.1 * s, z);
    mesh(new THREE.SphereGeometry(0.85 * s, 18, 12), mat(0x86cf74), x + 0.55 * s, 2.7 * s, z + 0.3 * s);
    solids.push({ x, z, r: 0.75 * s });
  };
  const facilityAngles = Object.values(LAYOUT).map((f) => f.angle);
  for (let i = 0; i < 22; i += 1) {
    const a = (i * TAU) / 22 + 0.07;
    const gap = Math.min(...facilityAngles.map((f) => Math.abs(Math.atan2(Math.sin(a - f), Math.cos(a - f)))));
    if (gap < 0.32) continue; // keep the view of each facility open
    const r = 15.5 + (i % 3) * 1.3;
    tree(Math.sin(a) * -r, Math.cos(a) * -r, 0.85 + (i % 4) * 0.12);
  }
  const flowerColors = [0xff9ec7, 0xffe27a, 0xffffff, 0xc4a5ff, 0xff8f8f];
  for (let i = 0; i < 8; i += 1) {
    const a = (i * TAU) / 8 + TAU / 16;
    const bx = Math.sin(a) * 10.4; const bz = Math.cos(a) * 10.4;
    const gap = Math.min(...facilityAngles.map((f) => Math.abs(Math.atan2(Math.sin(a - f - Math.PI), Math.cos(a - f - Math.PI)))));
    if (gap < 0.42) continue;
    mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.3, 20), mat(0xb98b62), bx, 0.15, bz);
    mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.06, 20), mat(0x6b4f3a), bx, 0.31, bz);
    for (let k = 0; k < 9; k += 1) {
      const fa = k * 2.4; const fr = 0.2 + (k % 3) * 0.22;
      const f = mesh(new THREE.SphereGeometry(0.12, 8, 6), mat(flowerColors[(i + k) % flowerColors.length]), bx + Math.cos(fa) * fr, 0.45, bz + Math.sin(fa) * fr);
      f.castShadow = false;
    }
    solids.push({ x: bx, z: bz, r: 1.1 });
  }

  // Name signs: a canvas sprite over each facility.
  const textures = [];
  const sign = (text, parent, y) => {
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 112;
    const c = canvas.getContext('2d');
    c.fillStyle = '#fffaf0'; c.strokeStyle = '#8a6a4a'; c.lineWidth = 8;
    c.beginPath(); c.roundRect(6, 6, 308, 100, 40); c.fill(); c.stroke();
    c.fillStyle = '#4a3828'; c.font = '800 52px Pretendard, "Malgun Gothic", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 160, 60);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));
    sprite.scale.set(2.3, 0.8, 1); sprite.position.y = y;
    parent.add(sprite);
    return sprite;
  };

  // Facilities: each faces the fountain; the door point is where "near" is measured.
  const facilityRoots = [];
  const npcs = []; // ponytail: NPCs only idle-breathe; real NPC behaviour is a later plaza version
  const doors = {};
  for (const facility of facilities) {
    const spot = LAYOUT[facility.id];
    if (!spot) continue;
    const x = -Math.sin(spot.angle) * spot.radius; const z = -Math.cos(spot.angle) * spot.radius;
    const root = new THREE.Group(); root.position.set(x, 0, z); root.rotation.y = Math.atan2(-x, -z);
    root.userData.facility = facility.id; scene.add(root); facilityRoots.push(root);
    const toCentre = new THREE.Vector2(-x, -z).normalize();
    let depth = 0;
    if (spot.kind === 'hall' || spot.kind === 'shop' || spot.kind === 'house') {
      const w = spot.kind === 'hall' ? 4.4 : 3.2; const h = spot.kind === 'hall' ? 2.9 : 2.4; depth = spot.kind === 'hall' ? 3.4 : 2.7;
      mesh(new THREE.BoxGeometry(w, h, depth), mat(spot.wall), 0, h / 2, 0, root);
      const roof = mesh(new THREE.ConeGeometry(Math.max(w, depth) * 0.82, 1.7, 4), mat(spot.roof), 0, h + 0.85, 0, root);
      roof.rotation.y = Math.PI / 4; roof.scale.z = depth / w;
      mesh(new THREE.BoxGeometry(0.95, 1.45, 0.08), mat(0x8a5a3b), 0, 0.72, depth / 2 + 0.02, root);
      mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(0xf6d36b), 0.3, 0.75, depth / 2 + 0.08, root);
      for (const wx of [-w * 0.3, w * 0.3]) {
        mesh(new THREE.CircleGeometry(0.32, 20), mat(0xbfe9ff, { roughness: 0.2, emissive: 0x6fb7e0, emissiveIntensity: 0.15 }), wx, h * 0.62, depth / 2 + 0.02, root);
      }
      if (spot.kind === 'shop') { // a striped awning
        for (let k = 0; k < 6; k += 1) {
          const strip = mesh(new THREE.BoxGeometry(w / 6, 0.08, 0.9), mat(k % 2 ? 0xffffff : 0xff8aa8), -w / 2 + w / 12 + (k * w) / 6, h * 0.86, depth / 2 + 0.4, root);
          strip.rotation.x = 0.35;
        }
      }
      if (spot.kind === 'house') { // the records hall carries a trophy
        mesh(new THREE.CylinderGeometry(0.3, 0.18, 0.5, 16), mat(0xf6c945, { metalness: 0.5, roughness: 0.35 }), 0, h + 2.0, 0, root);
        mesh(new THREE.CylinderGeometry(0.1, 0.22, 0.25, 12), mat(0xf6c945, { metalness: 0.5, roughness: 0.35 }), 0, h + 1.65, 0, root);
      }
      if (spot.kind === 'hall') { // the game hall: a big black-and-white stone pair on the roof
        const b = mesh(new THREE.SphereGeometry(0.45, 24, 16), mat(0x26272e, { roughness: 0.35 }), -0.45, h + 1.85, 0, root); b.scale.y = 0.55;
        const wst = mesh(new THREE.SphereGeometry(0.45, 24, 16), mat(0xfafafa, { roughness: 0.35 }), 0.45, h + 1.85, 0, root); wst.scale.y = 0.55;
      }
      sign(facility.name, root, h + ({ hall: 2.45, house: 2.8 }[spot.kind] || 2.25)); // above the roof ornaments
      solids.push({ x, z, r: Math.max(w, depth) * 0.62 });
    } else if (spot.kind === 'board') { // a notice board on two posts, papers pinned on it
      depth = 0.3;
      for (const px of [-1.25, 1.25]) mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.6, 10), mat(0x8a5a3b), px, 1.3, 0, root);
      mesh(new THREE.BoxGeometry(2.8, 1.6, 0.16), mat(spot.tint || 0xc58b5a), 0, 1.75, 0, root);
      mesh(new THREE.BoxGeometry(3.1, 0.18, 0.4), mat(0x8a5a3b), 0, 2.65, 0, root);
      const paper = [0xffffff, 0xfff3b0, 0xd7f0ff, 0xffd9e6];
      for (let k = 0; k < 5; k += 1) {
        const p = mesh(new THREE.PlaneGeometry(0.55, 0.5), mat(paper[k % 4]), -0.95 + k * 0.47, 1.7 + (k % 2 ? 0.25 : -0.2), 0.09, root);
        p.rotation.z = (k % 2 ? 1 : -1) * 0.06; p.castShadow = false;
      }
      sign(facility.name, root, 3.4);
      solids.push({ x, z, r: 1.5 });
    } else if (spot.kind === 'gazebo') { // a small round gazebo with a bench inside
      depth = 2.4;
      for (let k = 0; k < 6; k += 1) { const a = (k * TAU) / 6; mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 8), mat(0xffffff), Math.cos(a) * 1.4, 1.1, Math.sin(a) * 1.4, root); }
      mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.15, 24), mat(0xe8d8bf), 0, 0.08, 0, root);
      mesh(new THREE.ConeGeometry(1.95, 1.1, 24), mat(0x7cc4b5), 0, 2.75, 0, root);
      mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.4, 20), mat(0xc58b5a), 0, 0.35, 0, root);
      sign(facility.name, root, 3.9);
      solids.push({ x, z, r: 1.7 });
    } else if (spot.kind === 'npc') { // the attendance keeper: a friendly villager next to a stamp stand
      depth = 0.9;
      const npc = makeCharacter({ shirt: 0xffb86b, hair: 0x5b3a29, skin: 0xffdcbc, hat: 0x6bc4a6 });
      npc.root.position.set(-0.7, 0, 0); root.add(npc.root); npc.root.userData.npc = npc;
      mesh(new THREE.BoxGeometry(1.0, 0.95, 0.7), mat(0xc58b5a), 0.7, 0.48, 0, root);
      mesh(new THREE.BoxGeometry(1.1, 0.08, 0.8), mat(0xffe9b8), 0.7, 0.99, 0, root);
      mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.16, 16), mat(0xe2574c), 0.7, 1.12, 0, root);
      sign(facility.name, root, 2.9);
      solids.push({ x, z, r: 1.2 });
      npcs.push(npc);
    }
    const reach = depth / 2 + 1.3;
    doors[facility.id] = { x: x + toCentre.x * (Math.max(1.4, reach) + (spot.kind === 'hall' ? 0.3 : 0)), z: z + toCentre.y * (Math.max(1.4, reach) + (spot.kind === 'hall' ? 0.3 : 0)), name: facility.name };
  }

  // The player's character: a big head on a short body.
  const me = makeCharacter({ shirt: 0x7cb8ff, hair: 0x4a3326, skin: 0xffe0c4 });
  me.root.position.set(0, 0, 7.4);
  scene.add(me.root);

  function makeCharacter({ shirt, hair, skin, hat = null }) {
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const limb = (r, len, color, x, y, z, parent) => {
      const pivot = new THREE.Group(); pivot.position.set(x, y, z); parent.add(pivot);
      mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat(color), 0, -len / 2 - r * 0.5, 0, pivot);
      return pivot;
    };
    const legL = limb(0.13, 0.22, 0x5b6b8c, -0.16, 0.5, 0, body);
    const legR = limb(0.13, 0.22, 0x5b6b8c, 0.16, 0.5, 0, body);
    const torso = mesh(new THREE.CapsuleGeometry(0.33, 0.28, 8, 16), mat(shirt), 0, 0.8, 0, body);
    torso.scale.z = 0.85;
    const armL = limb(0.09, 0.3, shirt, -0.42, 1.0, 0, body);
    const armR = limb(0.09, 0.3, shirt, 0.42, 1.0, 0, body);
    const head = new THREE.Group(); head.position.set(0, 1.5, 0); body.add(head);
    mesh(new THREE.SphereGeometry(0.52, 28, 20), mat(skin), 0, 0, 0, head);
    const hairCap = mesh(new THREE.SphereGeometry(0.55, 28, 16, 0, TAU, 0, Math.PI * 0.55), mat(hair), 0, 0.04, -0.03, head);
    hairCap.rotation.x = -0.25;
    for (const ex of [-0.17, 0.17]) {
      const eye = mesh(new THREE.SphereGeometry(0.065, 12, 10), mat(0x2b2220, { roughness: 0.3 }), ex, -0.02, 0.48, head); eye.scale.y = 1.35; eye.castShadow = false;
      const cheek = mesh(new THREE.SphereGeometry(0.08, 12, 8), mat(0xffa6a6), ex * 1.55, -0.16, 0.42, head); cheek.scale.set(1, 0.6, 0.4); cheek.castShadow = false;
    }
    if (hat) {
      mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 24), mat(hat), 0, 0.36, 0, head);
      mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.34, 20), mat(hat), 0, 0.55, 0, head);
    }
    return { root, body, head, legL, legR, armL, armR, yaw: 0, phase: 0, lean: 0, roll: 0, hop: 0, headYaw: 0 };
  }

  // Input: arrows move, Space interacts; both Space and a click on a facility call `interact`.
  const keys = new Set();
  const isTyping = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  const isBlocked = () => Boolean(blocked?.()) || !running;
  const onKeyDown = (event) => {
    if (isBlocked() || isTyping(event.target)) return;
    if (event.key.startsWith('Arrow')) { keys.add(event.key); event.preventDefault(); return; }
    if (event.code === 'Space' && (event.target === document.body || host.contains(event.target))) {
      event.preventDefault();
      if (!event.repeat && near) interact(near);
    }
  };
  const onKeyUp = (event) => keys.delete(event.key);
  const onBlur = () => keys.clear();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const facilityAt = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    for (const hit of raycaster.intersectObjects(facilityRoots, true)) {
      for (let o = hit.object; o; o = o.parent) if (o.userData.facility) return o.userData.facility;
    }
    return null;
  };
  const onClick = (event) => { if (isBlocked()) return; const id = facilityAt(event); if (id) interact(id); };
  const onMove = (event) => { renderer.domElement.style.cursor = !isBlocked() && facilityAt(event) ? 'pointer' : ''; };
  renderer.domElement.addEventListener('click', onClick);
  renderer.domElement.addEventListener('pointermove', onMove);

  let near = null;
  function interact(id) {
    keys.clear();
    const door = doors[id];
    if (door) me.targetYaw = Math.atan2(door.x - me.root.position.x, door.z - me.root.position.z); // turn to face it
    me.hop = 1;
    onInteract?.(id);
  }

  // Movement with circle collisions.
  const tryMove = (nx, nz) => {
    const d = Math.hypot(nx, nz);
    if (d > BOUND) { nx *= BOUND / d; nz *= BOUND / d; }
    for (const s of solids) {
      const dx = nx - s.x; const dz = nz - s.z; const dist = Math.hypot(dx, dz); const min = s.r + 0.45;
      if (dist < min && dist > 1e-6) { nx = s.x + (dx / dist) * min; nz = s.z + (dz / dist) * min; }
    }
    me.root.position.x = nx; me.root.position.z = nz;
  };
  const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const OFFSET = new THREE.Vector3(0, 7.4, 10.8);
  function placeCamera(snap) {
    const p = me.root.position;
    const want = new THREE.Vector3(p.x * 0.85, 0, p.z * 0.85 + 0).add(OFFSET); // trail softly, keep the square in view
    const look = new THREE.Vector3(p.x * 0.85, 1.3, p.z * 0.85 - 2.4);
    if (snap) { camPos.copy(want); camLook.copy(look); } else { camPos.lerp(want, 0.08); camLook.lerp(look, 0.1); }
    camera.position.copy(camPos); camera.lookAt(camLook);
  }

  let running = false; let raf = 0; let last = 0; let clock = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; clock += dt;
    step(dt);
    renderer.render(scene, camera);
  }
  function step(dt) {
    let ix = 0; let iz = 0;
    if (!isBlocked()) {
      if (keys.has('ArrowLeft')) ix -= 1; if (keys.has('ArrowRight')) ix += 1;
      if (keys.has('ArrowUp')) iz -= 1; if (keys.has('ArrowDown')) iz += 1;
    } else keys.clear();
    const moving = ix !== 0 || iz !== 0;
    if (moving) {
      const len = Math.hypot(ix, iz); ix /= len; iz /= len;
      tryMove(me.root.position.x + ix * SPEED * dt, me.root.position.z + iz * SPEED * dt);
      me.targetYaw = Math.atan2(ix, iz);
    }
    animate(me, dt, moving);
    for (const npc of npcs) animate(npc, dt, false);
    // Nearest facility within reach: hint + the head turns toward it.
    let best = null; let bestD = REACH;
    for (const [id, door] of Object.entries(doors)) {
      const d = Math.hypot(door.x - me.root.position.x, door.z - me.root.position.z);
      if (d < bestD) { best = id; bestD = d; }
    }
    if (best !== near) { near = best; onNear?.(near ? { id: near, name: doors[near].name } : null); }
    me.lookAt = near ? Math.atan2(doors[near].x - me.root.position.x, doors[near].z - me.root.position.z) : null;
    drops.forEach((d) => { const t = (clock * 0.7 + d.userData.phase) % 1; const a = d.userData.phase * TAU; d.position.set(Math.cos(a) * t * 1.4, 2.3 + Math.sin(t * Math.PI) * 0.9 - t * 1.6, Math.sin(a) * t * 1.4); });
    lamps.forEach((l, i) => { l.material.emissiveIntensity = 0.55 + Math.sin(clock * 1.5 + i) * 0.05; });
    placeCamera(false);
  }
  function animate(c, dt, moving) {
    const yaw = c.root.rotation.y;
    const target = c.targetYaw ?? yaw;
    const turn = angleTo(yaw, target);
    const rate = Math.min(1, dt * 12);
    c.root.rotation.y = yaw + turn * rate;
    c.roll += (THREE.MathUtils.clamp(-turn * 0.25, -0.18, 0.18) - c.roll) * Math.min(1, dt * 10); // lean into a turn
    c.lean += ((moving ? 0.14 : 0) - c.lean) * Math.min(1, dt * 8); // lean forward while walking
    if (moving) c.phase += dt * SPEED * 2.1; else c.phase *= Math.max(0, 1 - dt * 8);
    const swing = Math.sin(c.phase) * (moving ? 0.65 : 0);
    c.legL.rotation.x = swing; c.legR.rotation.x = -swing;
    const idle = moving ? 0 : Math.sin(clock * 2.2 + (c === me ? 0 : 1.7)) * 0.05;
    c.armL.rotation.x = -swing * 0.9 + idle; c.armR.rotation.x = swing * 0.9 - idle;
    c.hop = Math.max(0, c.hop - dt * 2.8);
    const hopT = c.hop > 0 ? Math.sin((1 - c.hop) * Math.PI) : 0;
    c.armL.rotation.z = -hopT * 1.1; c.armR.rotation.z = hopT * 1.1; // a little cheer when interacting
    c.body.position.y = (moving ? Math.abs(Math.sin(c.phase)) * 0.07 : 0) + hopT * 0.28;
    c.body.rotation.x = c.lean; c.body.rotation.z = c.roll;
    c.body.scale.y = 1 + (moving ? 0 : Math.sin(clock * 2.2) * 0.012);
    // the head turns toward a nearby facility (limited), and nods on interaction
    const wantHead = c.lookAt != null ? THREE.MathUtils.clamp(angleTo(c.root.rotation.y, c.lookAt), -0.7, 0.7) : 0;
    c.headYaw += (wantHead - c.headYaw) * Math.min(1, dt * 6);
    c.head.rotation.y = c.headYaw; c.head.rotation.x = -hopT * 0.25;
  }

  const resize = () => {
    const w = host.clientWidth || 1; const h = host.clientHeight || 1;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize); observer.observe(host);
  resize(); placeCamera(true);

  function start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); keys.clear(); }
  function dispose() {
    stop(); observer.disconnect();
    window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur);
    renderer.domElement.removeEventListener('click', onClick); renderer.domElement.removeEventListener('pointermove', onMove);
    scene.traverse((o) => { if (o.isMesh) o.geometry.dispose(); if (o.isSprite) o.material.dispose(); });
    mats.forEach((m) => m.dispose()); textures.forEach((t) => t.dispose());
    renderer.dispose(); renderer.domElement.remove();
  }
  // For tests and support: where things are, and a way to stand at a facility's door.
  function debug() {
    const p = me.root.position;
    const screenOf = (id) => {
      const root = facilityRoots.find((r) => r.userData.facility === id);
      if (!root) return null;
      const v = new THREE.Vector3(); new THREE.Box3().setFromObject(root).getCenter(v); v.project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
    };
    return { x: p.x, z: p.z, yaw: me.root.rotation.y, near, running, doors: { ...doors }, screenOf, place: (id) => { const d = doors[id]; if (d) { tryMove(d.x, d.z); placeCamera(true); } } };
  }
  return { start, stop, dispose, debug, interact };
}
