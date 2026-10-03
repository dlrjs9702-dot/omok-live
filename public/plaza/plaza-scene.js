// v1.8.8 3D 광장 로비 V1: a small daytime village square that is the lobby's hub. Self-made primitive models only,
// no external assets. Kept apart from the RPG scene (public/rpg/rpg-scene.js): the two share Three.js, nothing else.
// The scene knows facility ids and names only; what a facility opens is the caller's `onInteract(id)`.
import * as THREE from '/vendor/three/three.module.js';
import { buildIsland, heightAt, walkable, SPOTS, STATUE_SPOTS, RESERVED_LOTS, SPAWN, PLAZA_R } from './island.js?v=1.10.2';

const TAU = Math.PI * 2;
const SPEED = 5.2; // units per second (v1.10.0: the island is about 40 seconds of walking across)
const REACH = 2.4; // how close to a facility's door counts as "near"
// v1.9.6 player collision (plaza only): every character is the same circle at its feet on the ground (hair, capes and
// halos do not make it bigger). Close to a facility's door the circle shrinks so a crowd can never block an entrance.
const PLAYER_R = 0.45;
const DOOR_PLAYER_R = 0.28;
const DOOR_ZONE = 2.6;
const SEPARATE_STEP = 0.06; // already overlapping (network lag): drift apart this much per frame, never a jump

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
  scene.fog = new THREE.Fog(0xd7efff, 70, 175); // far enough that the climbing tower reads from the plaza
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 180); // nothing is drawn past the fog

  scene.add(new THREE.HemisphereLight(0xfff4dc, 0x8cc970, 1.05));
  const sun = new THREE.DirectionalLight(0xfff0d2, 1.75);
  sun.position.set(-9, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 80 }); // follows the player
  sun.shadow.bias = -0.0006;
  scene.add(sun); scene.add(sun.target);

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

  // v1.9.2 avatar parts: the 3D model of every avatar item (ids are lib/skins.js's), added onto a character.
  // ponytail: one hand-built part per item; a data-driven part kit is worth it only past a few dozen items
  const tint = (part, color) => { part.traverse((o) => { if (o.isMesh) o.material = mat(color); }); };
  const AVATAR_PARTS = {
    avatar_hair_1: (c) => { tint(c.hairCap, 0x7a4a2a); for (const s of [-1, 1]) { const t = mesh(new THREE.SphereGeometry(0.17, 14, 10), mat(0x7a4a2a), s * 0.55, -0.15, -0.05, c.head); t.scale.y = 1.6; mesh(new THREE.SphereGeometry(0.07, 10, 8), mat(0xff7aa2), s * 0.5, 0.08, -0.02, c.head); } },
    avatar_hair_2: (c) => { tint(c.hairCap, 0x2b1d14); for (let i = 0; i < 12; i += 1) { const a = (i / 12) * TAU; mesh(new THREE.SphereGeometry(0.17, 12, 10), mat(0x2b1d14), Math.cos(a) * 0.45, 0.32 + Math.sin(i * 1.7) * 0.06, Math.sin(a) * 0.4 - 0.05, c.head); } },
    avatar_hair_3: (c) => { tint(c.hairCap, 0xc0703a); const tail = mesh(new THREE.CapsuleGeometry(0.11, 0.42, 6, 10), mat(0xc0703a), 0, 0.05, -0.58, c.head); tail.rotation.x = 0.5; mesh(new THREE.SphereGeometry(0.07, 10, 8), mat(0xffd23f), 0, 0.26, -0.5, c.head); },
    avatar_hair_4: (c) => { tint(c.hairCap, 0x2f3b52); for (let i = 0; i < 7; i += 1) { const a = (i / 7) * TAU; const cone = mesh(new THREE.ConeGeometry(0.1, 0.4, 8), mat(0x2f3b52), Math.cos(a) * 0.3, 0.55, Math.sin(a) * 0.3 - 0.05, c.head); cone.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); } },
    avatar_hair_5: (c) => { c.hairCap.visible = false; [0xff6b6b, 0xffd23f, 0x6be38a, 0x5fb0ff, 0xb48aff].forEach((col, i) => { const seg = mesh(new THREE.SphereGeometry(0.56, 24, 14, (i / 5) * TAU, TAU / 5, 0, Math.PI * 0.55), mat(col), 0, 0.04, -0.03, c.head); seg.rotation.x = -0.25; }); },
    avatar_hair_6: (c) => { tint(c.hairCap, 0x2a2a6a); const back = mesh(new THREE.SphereGeometry(0.5, 22, 14), mat(0x2a2a6a), 0, -0.22, -0.28, c.head); back.scale.set(1.08, 1.25, 0.6); /* long hair falling behind */ for (let i = 0; i < 6; i += 1) { const a = (i / 6) * TAU; mesh(new THREE.OctahedronGeometry(0.06), mat(0xffe28a, { emissive: 0xffd24a, emissiveIntensity: 0.9 }), Math.cos(a) * 0.5, 0.35 + (i % 2) * 0.12, Math.sin(a) * 0.45 - 0.05, c.head); } },
    avatar_outfit_1: (c) => { c.setShirt(0xfff6dc); mesh(new THREE.CylinderGeometry(0.33, 0.36, 0.34, 18), mat(0x3f74c8), 0, 0.62, 0, c.body); for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.07, 0.42, 0.06), mat(0x3f74c8), s * 0.17, 0.92, 0.27, c.body); },
    avatar_outfit_2: (c) => { c.setShirt(0xffffff); for (let k = 0; k < 3; k += 1) { const ring = mesh(new THREE.TorusGeometry(0.335, 0.035, 8, 26), mat(0xff6b6b), 0, 0.66 + k * 0.14, 0, c.body); ring.rotation.x = Math.PI / 2; ring.scale.y = 0.85; } },
    avatar_outfit_3: (c) => { c.setShirt(0xffd6e0); mesh(new THREE.ConeGeometry(0.52, 0.55, 20, 1, true), mat(0x5a8fd8, { side: THREE.DoubleSide }), 0, 0.55, 0, c.body); mesh(new THREE.BoxGeometry(0.06, 0.28, 0.04), mat(0xe83c5a), 0.08, 0.86, 0.3, c.body); },
    avatar_outfit_4: (c) => { c.setShirt(0xe8edf5); mesh(new THREE.BoxGeometry(0.26, 0.2, 0.08), mat(0xff8a3d), 0, 0.85, 0.28, c.body); mesh(new THREE.BoxGeometry(0.36, 0.28, 0.2), mat(0xd0d6e2), 0, 0.88, -0.32, c.body); const ring = mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 24), mat(0xb8c2d4), 0, 1.12, 0, c.body); ring.rotation.x = Math.PI / 2; },
    avatar_outfit_5: (c) => { c.setShirt(0xfff6dc); const cape = mesh(new THREE.PlaneGeometry(0.8, 0.9, 4, 4), mat(0xb8243a, { side: THREE.DoubleSide }), 0, 0.72, -0.32, c.body); cape.rotation.x = 0.18; c.cape = cape; const collar = mesh(new THREE.TorusGeometry(0.3, 0.07, 8, 24), mat(0xffd23f, { metalness: 0.4, roughness: 0.4 }), 0, 1.12, 0, c.body); collar.rotation.x = Math.PI / 2; },
    avatar_hat_1: (c) => { mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.05, 28), mat(0xe8c56a), 0, 0.42, 0, c.head); mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.32, 22), mat(0xe8c56a), 0, 0.6, 0, c.head); mesh(new THREE.CylinderGeometry(0.505, 0.505, 0.08, 22), mat(0xe83c5a), 0, 0.5, 0, c.head); },
    avatar_hat_2: (c) => { for (const s of [-1, 1]) { const ear = mesh(new THREE.ConeGeometry(0.17, 0.34, 4), mat(0x4a3326), s * 0.33, 0.55, 0, c.head); ear.rotation.z = -s * 0.3; const inner = mesh(new THREE.ConeGeometry(0.09, 0.2, 4), mat(0xffb3c8), s * 0.33, 0.52, 0.06, c.head); inner.rotation.z = -s * 0.3; } },
    avatar_hat_3: (c) => { const cols = [0xff8fb8, 0xffd23f, 0xffffff, 0xb48aff, 0x7be0a0]; for (let i = 0; i < 10; i += 1) { const a = (i / 10) * TAU; mesh(new THREE.SphereGeometry(0.09, 10, 8), mat(cols[i % 5]), Math.cos(a) * 0.45, 0.38, Math.sin(a) * 0.45, c.head); } },
    avatar_hat_4: (c) => { const gold = mat(0xffd23f, { metalness: 0.5, roughness: 0.35 }); mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.16, 20, 1, true), gold, 0, 0.55, 0, c.head); for (let i = 0; i < 5; i += 1) { const a = (i / 5) * TAU; mesh(new THREE.ConeGeometry(0.07, 0.18, 6), gold, Math.cos(a) * 0.28, 0.72, Math.sin(a) * 0.28, c.head); } mesh(new THREE.SphereGeometry(0.06, 10, 8), mat(0xe83c5a), 0, 0.56, 0.3, c.head); },
    avatar_hat_5: (c) => { const halo = mesh(new THREE.TorusGeometry(0.36, 0.05, 10, 32), mat(0xffe28a, { emissive: 0xffd24a, emissiveIntensity: 1.1 }), 0, 0.8, 0, c.head); halo.rotation.x = Math.PI / 2; halo.castShadow = false; c.halo = halo; },
  };

  // Name tag over a character: the nickname (with a small gold 「챔피언」 mark for this week's climbing champion,
  // v1.9.5) and, on its own line, the title (a legend's name). Small and layered so both fit without a banner.
  function makeTag(name, title, champion = false) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = title ? 168 : 104;
    const c = canvas.getContext('2d'); c.textAlign = 'center'; c.textBaseline = 'middle';
    const font = (px) => `800 ${px}px Pretendard, "Malgun Gothic", system-ui, sans-serif`;
    c.font = font(54); const nameW = Math.min(360, c.measureText(name).width);
    c.font = font(34); const pillW = champion ? c.measureText('챔피언').width + 34 : 0;
    const gap = champion ? 14 : 0; const total = Math.min(500, nameW + gap + pillW + 48);
    c.fillStyle = 'rgba(30,24,20,.62)'; c.beginPath(); c.roundRect((512 - total) / 2, 8, total, 88, 44); c.fill();
    const left = (512 - (nameW + gap + pillW)) / 2;
    c.font = font(54); c.fillStyle = '#ffffff'; c.fillText(name, left + nameW / 2, 54, 360);
    if (champion) {
      const px = left + nameW + gap;
      const g = c.createLinearGradient(px, 0, px + pillW, 0); g.addColorStop(0, '#ffd86b'); g.addColorStop(1, '#f0b429');
      c.fillStyle = g; c.beginPath(); c.roundRect(px, 30, pillW, 48, 24); c.fill();
      c.font = font(34); c.fillStyle = '#4a2a00'; c.fillText('챔피언', px + pillW / 2, 55);
    }
    if (title) { const t = `\u300a${title}\u300b`; c.font = font(38); c.fillStyle = '#ffd86b'; c.strokeStyle = 'rgba(40,28,10,.85)'; c.lineWidth = 7; c.strokeText(t, 256, 134, 480); c.fillText(t, 256, 134, 480); }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));
    sprite.scale.set(2.2, (2.2 * canvas.height) / 512, 1); sprite.renderOrder = 2;
    return sprite;
  }
  // v1.10.2 말풍선: a chat message over its sender for a few seconds (both lines wrap at the bubble's width).
  const BUBBLE_MS = 5500;
  function makeBubble(text) {
    const font = '700 40px Pretendard, "Malgun Gothic", system-ui, sans-serif';
    const c0 = document.createElement('canvas').getContext('2d'); c0.font = font;
    const lines = []; let line = ''; let cut = false;
    for (const ch of String(text)) {
      if (c0.measureText(line + ch).width > 420 && line) { lines.push(line); line = ''; if (lines.length === 2) { cut = true; break; } }
      line += ch;
    }
    if (!cut && line) lines.push(line);
    if (cut) lines[1] = `${lines[1].slice(0, -1)}…`; // two lines at most
    const width = Math.min(480, Math.max(...lines.map((l) => c0.measureText(l).width)) + 56);
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 60 + lines.length * 50;
    const c = canvas.getContext('2d'); const left = (512 - width) / 2; const bodyH = canvas.height - 26;
    c.fillStyle = 'rgba(255,255,255,.96)'; c.strokeStyle = 'rgba(60,48,36,.35)'; c.lineWidth = 3;
    c.beginPath(); c.roundRect(left, 4, width, bodyH, 26); c.moveTo(244, bodyH + 2); c.lineTo(256, canvas.height - 4); c.lineTo(270, bodyH + 2); c.fill(); c.stroke();
    c.fillStyle = '#2b2220'; c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle';
    lines.forEach((l, i) => c.fillText(l, 256, 4 + 30 + i * 50));
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false, depthTest: false, transparent: true }));
    sprite.scale.set(2.6, (2.6 * canvas.height) / 512, 1); sprite.renderOrder = 3;
    sprite.userData = { text: String(text), until: performance.now() + BUBBLE_MS };
    return sprite;
  }
  function say(c, text) {
    if (!c) return;
    disposeTag(c.bubble);
    c.bubble = makeBubble(text);
    c.bubble.position.y = (c.tag ? c.tag.position.y + c.tag.scale.y / 2 : 2.4) + 0.25 + c.bubble.scale.y / 2;
    c.root.add(c.bubble);
  }
  function stepBubble(c, now) {
    const b = c?.bubble; if (!b) return;
    const left = b.userData.until - now;
    if (left <= 0) { disposeTag(b); c.bubble = null; return; }
    b.material.opacity = Math.min(1, left / 600);
  }
  const disposeTag = (tag) => { if (!tag) return; tag.material.map.dispose(); tag.material.dispose(); tag.parent?.remove(tag); };
  const disposeCharacter = (c) => { disposeTag(c.tag); disposeTag(c.bubble); c.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); c.root.parent?.remove(c.root); };


  // v1.10.0 게임 아일랜드: the island itself (terrain, sea, streams, bridges, walks, woods, harbour) comes from island.js;
  // here is the raised central plaza: the fountain whose water runs off into the streams, benches, lamps, flower beds
  // and the two empty plinths kept for the donation statues.
  const island = buildIsland(scene, { mat, mesh, solids });
  const PH = heightAt(0, 0);
  const fountain = new THREE.Group(); fountain.position.y = PH; scene.add(fountain);
  mesh(new THREE.CylinderGeometry(2.9, 3.1, 0.6, 44), mat(0xeae3d6), 0, 0.3, 0, fountain);
  mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.1, 44), mat(0x86d0f0, { roughness: 0.2, metalness: 0.1 }), 0, 0.56, 0, fountain);
  mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.5, 20), mat(0xeae3d6), 0, 1.2, 0, fountain);
  mesh(new THREE.CylinderGeometry(1.1, 0.6, 0.35, 28), mat(0xf1ebe0), 0, 1.95, 0, fountain);
  mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.06, 28), mat(0x86d0f0, { roughness: 0.2 }), 0, 2.1, 0, fountain);
  for (let k = 0; k < 4; k += 1) { // a spout on the rim over each channel
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const spout = mesh(new THREE.BoxGeometry(0.5, 0.18, 0.7), mat(0xd9d0c0), Math.cos(a) * 3, 0.5, Math.sin(a) * 3, fountain); spout.rotation.y = -a;
  }
  const drops = [];
  for (let i = 0; i < 8; i += 1) {
    const d = mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(0xc8ecff, { roughness: 0.1, transparent: true, opacity: 0.85 }), 0, 2.3, 0, fountain);
    d.castShadow = false; d.userData.phase = i / 8; drops.push(d);
  }
  solids.push({ x: 0, z: 0, r: 3.4 });
  const plazaBusy = (x, z, gap) => [...Object.values(SPOTS), ...STATUE_SPOTS].some((s) => Math.hypot(s.x - x, s.z - z) < gap);
  for (const a of [0.38, -0.38, Math.PI - 0.38, Math.PI + 0.38]) { // benches facing the fountain, clear of the channels
    const bench = new THREE.Group(); scene.add(bench);
    bench.position.set(Math.cos(a) * 5, PH, Math.sin(a) * 5); bench.rotation.y = Math.atan2(-bench.position.x, -bench.position.z);
    mesh(new THREE.BoxGeometry(1.7, 0.12, 0.55), mat(0xc58b5a), 0, 0.5, 0, bench);
    mesh(new THREE.BoxGeometry(1.7, 0.45, 0.1), mat(0xc58b5a), 0, 0.8, -0.25, bench);
    for (const x of [-0.7, 0.7]) mesh(new THREE.BoxGeometry(0.1, 0.5, 0.5), mat(0x6b5a4a), x, 0.25, 0, bench);
    solids.push({ x: bench.position.x, z: bench.position.z, r: 0.9 });
  }
  const lamps = [];
  for (let k = 0; k < 8; k += 1) {
    const a = Math.PI / 8 + (k * Math.PI) / 4; const x = Math.cos(a) * 12; const z = Math.sin(a) * 12;
    if (plazaBusy(x, z, 3)) continue;
    mesh(new THREE.CylinderGeometry(0.08, 0.11, 2.6, 10), mat(0x4d6b5c), x, PH + 1.3, z);
    lamps.push(mesh(new THREE.SphereGeometry(0.26, 16, 12), mat(0xfff3c2, { emissive: 0xffe08a, emissiveIntensity: 0.6 }), x, PH + 2.75, z));
    solids.push({ x, z, r: 0.35 });
  }
  const flowerColors = [0xff9ec7, 0xffe27a, 0xffffff, 0xc4a5ff, 0xff8f8f];
  for (let i = 0; i < 12; i += 1) { // beds along the plaza rim, between the walks and channels
    const a = Math.PI / 4 + ((i % 4) * Math.PI) / 2 + (i < 4 ? 0.3 : i < 8 ? -0.3 : 0.62);
    const bx = Math.cos(a) * (PLAZA_R - 2.2); const bz = Math.sin(a) * (PLAZA_R - 2.2);
    if (plazaBusy(bx, bz, 3.4)) continue;
    mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.3, 20), mat(0xb98b62), bx, PH + 0.15, bz);
    mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.06, 20), mat(0x6b4f3a), bx, PH + 0.31, bz);
    for (let k = 0; k < 9; k += 1) {
      const fa = k * 2.4; const fr = 0.2 + (k % 3) * 0.22;
      const f = mesh(new THREE.SphereGeometry(0.12, 8, 6), mat(flowerColors[(i + k) % flowerColors.length]), bx + Math.cos(fa) * fr, PH + 0.45, bz + Math.sin(fa) * fr);
      f.castShadow = false;
    }
    solids.push({ x: bx, z: bz, r: 1.1 });
  }
  for (const st of STATUE_SPOTS) { // 기부 동상 자리: an empty round plinth with a laurel ring (the statues come later)
    mesh(new THREE.CylinderGeometry(1.2, 1.35, 0.5, 24), mat(0xe9e2d4), st.x, PH + 0.25, st.z);
    mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.9, 20), mat(0xf4efe6), st.x, PH + 0.95, st.z);
    const ring = mesh(new THREE.TorusGeometry(0.62, 0.07, 8, 26), mat(0x8fbf6a), st.x, PH + 1.41, st.z); ring.rotation.x = Math.PI / 2;
    solids.push({ x: st.x, z: st.z, r: 1.3 });
  }

  // Name signs: a canvas sprite over each facility.
  const textures = [];
  const sign = (text, parent, y) => {
    const font = '800 52px Pretendard, "Malgun Gothic", system-ui, sans-serif';
    const probe = document.createElement('canvas').getContext('2d'); probe.font = font;
    const canvas = document.createElement('canvas'); canvas.width = Math.max(320, Math.ceil(probe.measureText(text).width) + 80); canvas.height = 112; // long names get a wider sign
    const c = canvas.getContext('2d');
    c.fillStyle = '#fffaf0'; c.strokeStyle = '#8a6a4a'; c.lineWidth = 8;
    c.beginPath(); c.roundRect(6, 6, canvas.width - 12, 100, 40); c.fill(); c.stroke();
    c.fillStyle = '#4a3828'; c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, canvas.width / 2, 60);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));
    sprite.scale.set((2.3 * canvas.width) / 320, 0.8, 1); sprite.position.y = y;
    parent.add(sprite);
    return sprite;
  };

  // v1.10.2 미니맵: a small round map in the top-right corner of the island view (redrawn about 8 times a second).
  const minimap = document.createElement('canvas'); minimap.className = 'islandMinimap'; minimap.width = 176; minimap.height = 176;
  minimap.setAttribute('role', 'img'); minimap.setAttribute('aria-label', '미니맵');
  host.append(minimap);
  let minimapAt = 0; let minimapTurn = 0; let mapMarkers = []; // markers: future nearby events (none yet)
  function refreshMinimap(now) {
    if (now - minimapAt < 120) return;
    minimapAt = now;
    const places = Object.entries(doors).map(([, d]) => ({ x: d.x, z: d.z, name: d.name }));
    minimapTurn = island.drawMinimap(minimap.getContext('2d'), minimap.width, { x: me.root.position.x, z: me.root.position.z }, camYaw, places, mapMarkers);
  }

  // The map board's picture (redrawn as I walk; the window version draws into the caller's canvas).
  const mapCanvas = document.createElement('canvas'); mapCanvas.width = 640; mapCanvas.height = 470;
  const mapTexture = new THREE.CanvasTexture(mapCanvas); mapTexture.colorSpace = THREE.SRGBColorSpace; textures.push(mapTexture);
  let mapDrawnAt = null;
  function refreshMapBoard() {
    const p = me.root.position;
    if (mapDrawnAt && Math.hypot(mapDrawnAt.x - p.x, mapDrawnAt.z - p.z) < 1.5) return;
    mapDrawnAt = { x: p.x, z: p.z };
    island.drawMap(mapCanvas.getContext('2d'), mapCanvas.width, mapCanvas.height, mapDrawnAt); mapTexture.needsUpdate = true;
  }

  // Facilities: each faces its walk or the fountain; the door point is where "near" is measured.
  const facilityRoots = [];
  const npcs = []; // ponytail: NPCs only idle-breathe; real NPC behaviour is a later plaza version
  const doors = {};
  // v1.10.2: the gazebo stays as a place to sit in the nature area; chat is an overlay now, not a facility.
  for (const facility of [...facilities, { id: 'chat', name: '', decor: true }]) {
    const spot = SPOTS[facility.id];
    if (!spot || (facility.decor && facilities.some((f) => f.id === facility.id))) continue;
    const { x, z } = spot;
    const root = new THREE.Group(); root.position.set(x, heightAt(x, z), z); root.rotation.y = Math.atan2(spot.face[0] - x, spot.face[1] - z);
    scene.add(root);
    if (!facility.decor) { root.userData.facility = facility.id; facilityRoots.push(root); }
    const toCentre = new THREE.Vector2(Math.sin(root.rotation.y), Math.cos(root.rotation.y)); // the way the front faces
    let depth = 0;
    // a point in this facility's own frame (lx right, lz toward the front) in world coordinates
    const at = (lx, lz) => ({ x: x + Math.cos(root.rotation.y) * lx + Math.sin(root.rotation.y) * lz, z: z - Math.sin(root.rotation.y) * lx + Math.cos(root.rotation.y) * lz });
    const boxSolids = (cx, cz, w, d, r = 1.2) => { // fill a rectangle with circles that stay inside its edges
      for (let lx = -w / 2 + r * 0.85; lx <= w / 2 - r * 0.85 + 1e-6; lx += Math.max(0.1, Math.min(1.7, w - r * 1.7))) {
        for (let lz = -d / 2 + r * 0.85; lz <= d / 2 - r * 0.85 + 1e-6; lz += Math.max(0.1, Math.min(1.7, d - r * 1.7))) solids.push({ ...at(cx + lx, cz + lz), r });
      }
    };
    if (spot.kind === 'hall') { // v1.10.1 게임관: the island's landmark -- a columned hall with a dome and two towers
      depth = 10; const w = 15; const h = 6.2;
      const wall = mat(spot.wall); const trim = mat(0xfff6e6); const roofM = mat(spot.roof); const gold = mat(0xf6c945, { metalness: 0.5, roughness: 0.35 });
      mesh(new THREE.BoxGeometry(w + 1.2, 0.5, depth + 2.6), mat(0xe9dcc4), 0, 0.25, 0.7, root); // terrace
      for (let k = 0; k < 3; k += 1) mesh(new THREE.BoxGeometry(6.4 - k * 0.6, 0.17, 0.5), mat(0xefe4cf), 0, 0.085 + k * 0.17, depth / 2 + 2.2 - k * 0.45, root); // steps
      mesh(new THREE.BoxGeometry(w, h, depth), wall, 0, 0.5 + h / 2, 0, root);
      mesh(new THREE.BoxGeometry(w + 0.4, 0.35, depth + 0.4), trim, 0, 0.5 + h, 0, root); // cornice
      const roof = mesh(new THREE.ConeGeometry(Math.max(w, depth) * 0.74, 2.2, 4), roofM, 0, 0.5 + h + 1.25, 0, root); roof.rotation.y = Math.PI / 4; roof.scale.z = depth / w;
      const dome = mesh(new THREE.SphereGeometry(2.6, 28, 16, 0, TAU, 0, Math.PI / 2), mat(0x7ec4e8, { roughness: 0.4 }), 0, 0.5 + h + 1.4, 0, root); dome.scale.y = 1.1;
      mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.5, 28), trim, 0, 0.5 + h + 1.3, 0, root);
      mesh(new THREE.SphereGeometry(0.35, 14, 10), gold, 0, 0.5 + h + 4.45, 0, root);
      for (const sx of [-1, 1]) { // side towers with flags
        const tx = sx * (w / 2 + 0.6);
        mesh(new THREE.CylinderGeometry(1.35, 1.5, h + 2.6, 18), trim, tx, 0.5 + (h + 2.6) / 2, -depth / 2 + 1.6, root);
        mesh(new THREE.ConeGeometry(1.7, 2.4, 18), roofM, tx, 0.5 + h + 2.6 + 1.2, -depth / 2 + 1.6, root);
        mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), mat(0x4a3828), tx, 0.5 + h + 5, -depth / 2 + 1.6, root);
        const flag = mesh(new THREE.PlaneGeometry(0.9, 0.55), mat(sx < 0 ? 0x26272e : 0xfafafa, { side: THREE.DoubleSide }), tx + 0.45, 0.5 + h + 5.4, -depth / 2 + 1.6, root); flag.castShadow = false;
        solids.push({ ...at(tx, -depth / 2 + 1.6), r: 1.6 });
      }
      for (const cx of [-5.4, -3.4, -1.5, 1.5, 3.4, 5.4]) mesh(new THREE.CylinderGeometry(0.32, 0.36, h - 0.4, 14), trim, cx, 0.5 + (h - 0.4) / 2, depth / 2 + 1.25, root); // the colonnade
      mesh(new THREE.BoxGeometry(12.4, 0.6, 1.4), trim, 0, 0.5 + h - 0.1, depth / 2 + 0.95, root);
      const pediment = mesh(new THREE.CylinderGeometry(1.6, 1.6, 12.6, 3), roofM, 0, 0.5 + h + 0.75, depth / 2 + 0.95, root); pediment.rotation.set(0, 0, Math.PI / 2); pediment.scale.set(1, 1, 0.6);
      const b = mesh(new THREE.SphereGeometry(0.62, 20, 14), mat(0x26272e, { roughness: 0.35 }), -0.7, 0.5 + h + 1.3, depth / 2 + 1.6, root); b.scale.z = 0.5;
      const ws = mesh(new THREE.SphereGeometry(0.62, 20, 14), mat(0xfafafa, { roughness: 0.35 }), 0.7, 0.5 + h + 1.3, depth / 2 + 1.6, root); ws.scale.z = 0.5;
      mesh(new THREE.BoxGeometry(2.2, 3.4, 0.1), mat(0x8a5a3b), 0, 0.5 + 1.7, depth / 2 + 0.03, root); // the big door
      for (const sx of [-0.55, 0.55]) mesh(new THREE.SphereGeometry(0.1, 8, 6), gold, sx, 0.5 + 1.8, depth / 2 + 0.12, root);
      for (const wx of [-5.6, -3.2, 3.2, 5.6]) for (const wy of [2.1, 4.4]) mesh(new THREE.BoxGeometry(1.1, 1.3, 0.08), mat(0xbfe9ff, { roughness: 0.2, emissive: 0x6fb7e0, emissiveIntensity: 0.15 }), wx, 0.5 + wy, depth / 2 + 0.03, root);
      sign(facility.name, root, 0.5 + h + 5.6);
      boxSolids(0, 0.7, w + 1.2, depth + 2.6);
      for (const cx of [-5.4, -3.4, -1.5, 1.5, 3.4, 5.4]) solids.push({ ...at(cx, depth / 2 + 1.25), r: 0.4 });
    } else if (spot.kind === 'tower') { // v1.10.1 등반 도전: a tall stone tower on the hill, a landmark from anywhere on the island
      depth = 6.4;
      const stone = mat(0xd8d0c2); const band = mat(0xb8ae9e); const roofM = mat(0x6f8fd8);
      let y = 0;
      for (const [r0, r1, hh] of [[3.2, 3.4, 4], [2.8, 3.1, 5], [2.4, 2.75, 5], [2.1, 2.35, 4]]) { // tapering stages with bands between
        mesh(new THREE.CylinderGeometry(r0, r1, hh, 22), stone, 0, y + hh / 2, 0, root); y += hh;
        mesh(new THREE.CylinderGeometry(r0 + 0.2, r0 + 0.2, 0.35, 22), band, 0, y, 0, root);
        for (let k = 0; k < 4; k += 1) { const a = (k / 4) * TAU + Math.PI / 4 + y; mesh(new THREE.BoxGeometry(0.5, 0.9, 0.12), mat(0x3d4a63), Math.sin(a) * (r0 + 0.02), y - hh / 2, Math.cos(a) * (r0 + 0.02), root).rotation.y = a; }
      }
      const ring = mesh(new THREE.TorusGeometry(2.6, 0.12, 8, 30), band, 0, y - 1.6, 0, root); ring.rotation.x = Math.PI / 2; // the balcony rail
      mesh(new THREE.ConeGeometry(2.7, 3.6, 22), roofM, 0, y + 1.8, 0, root);
      mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), mat(0x4a3828), 0, y + 4.6, 0, root);
      const flag = mesh(new THREE.PlaneGeometry(1.3, 0.8), mat(0xe83c46, { side: THREE.DoubleSide }), 0.65, y + 5.3, 0, root); flag.castShadow = false;
      mesh(new THREE.BoxGeometry(1.4, 2.3, 0.2), mat(0x6b4a33), 0, 1.15, 3.25, root); // the door
      const arch = mesh(new THREE.TorusGeometry(0.72, 0.12, 8, 16, Math.PI), band, 0, 2.3, 3.32, root); arch.castShadow = false;
      sign(facility.name, root, 4.3);
      solids.push({ x, z, r: 3.5 });
    } else if (spot.kind === 'shop' || spot.kind === 'house' || spot.kind === 'office') {
      const w = 3.2; const h = 2.4; depth = 2.7;
      mesh(new THREE.BoxGeometry(w, h, depth), mat(spot.wall), 0, h / 2, 0, root);
      const roof = mesh(new THREE.ConeGeometry(Math.max(w, depth) * 0.82, 1.7, 4), mat(spot.roof), 0, h + 0.85, 0, root);
      roof.rotation.y = Math.PI / 4; roof.scale.z = depth / w;
      const k = 1;
      mesh(new THREE.BoxGeometry(0.95 * k, 1.45 * k, 0.08), mat(0x8a5a3b), 0, 0.72 * k, depth / 2 + 0.02, root);
      mesh(new THREE.SphereGeometry(0.06 * k, 8, 6), mat(0xf6d36b), 0.3 * k, 0.75 * k, depth / 2 + 0.08, root);
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
      sign(facility.name, root, h + (spot.kind === 'house' ? 2.8 : 2.25)); // above the roof ornaments
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
    } else if (spot.kind === 'mapboard') { // v1.10.0 안내 지도: the island drawn on a board, with where I am
      depth = 0.3;
      for (const px of [-1.5, 1.5]) mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.8, 10), mat(0x8a5a3b), px, 1.4, 0, root);
      mesh(new THREE.BoxGeometry(3.3, 2.5, 0.14), mat(0x8a5a3b), 0, 1.85, 0, root);
      const face = mesh(new THREE.PlaneGeometry(3, 2.2), new THREE.MeshBasicMaterial({ map: mapTexture }), 0, 1.85, 0.08, root); face.castShadow = false;
      const roofBar = mesh(new THREE.BoxGeometry(3.6, 0.16, 0.5), mat(0x6b4f3a), 0, 3.18, 0, root); roofBar.rotation.x = 0.1;
      sign(facility.name, root, 3.8);
      solids.push({ x, z, r: 1.7 });
    } else if (spot.kind === 'gate') { // v1.9.4: a stone gate in front of a little mountain with a flag on top
      depth = 1.2;
      const stone = mat(0xb8b0a4);
      for (const px of [-1.4, 1.4]) mesh(new THREE.BoxGeometry(0.55, 2.6, 0.7), stone, px, 1.3, 0, root);
      mesh(new THREE.BoxGeometry(3.6, 0.5, 0.85), mat(0x8a6a4a), 0, 2.85, 0, root);
      const hill = mesh(new THREE.ConeGeometry(2.6, 4.2, 7), mat(0x7cb46a), 0, 2.1, -2.3, root); hill.rotation.y = 0.3;
      mesh(new THREE.ConeGeometry(0.9, 0.9, 7), mat(0xf4f7fb), 0, 3.95, -2.3, root); // snow cap
      mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), mat(0x4a3828), 0, 4.75, -2.3, root);
      const flag = mesh(new THREE.PlaneGeometry(0.6, 0.38), mat(0xe83c46, { side: THREE.DoubleSide }), 0.3, 5.1, -2.3, root); flag.castShadow = false;
      sign(facility.name, root, 3.6);
      solids.push({ x: x - Math.sin(root.rotation.y) * 2.3, z: z - Math.cos(root.rotation.y) * 2.3, r: 2.4 });
      for (const px of [-1.4, 1.4]) solids.push({ x: x + Math.cos(root.rotation.y) * px, z: z - Math.sin(root.rotation.y) * px, r: 0.45 });
    } else if (spot.kind === 'gazebo') { // a small round gazebo with a bench inside
      depth = 2.4;
      for (let k = 0; k < 6; k += 1) { const a = (k * TAU) / 6; mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 8), mat(0xffffff), Math.cos(a) * 1.4, 1.1, Math.sin(a) * 1.4, root); }
      mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.15, 24), mat(0xe8d8bf), 0, 0.08, 0, root);
      mesh(new THREE.ConeGeometry(1.95, 1.1, 24), mat(0x7cc4b5), 0, 2.75, 0, root);
      mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.4, 20), mat(0xc58b5a), 0, 0.35, 0, root);
      if (!facility.decor) sign(facility.name, root, 3.9);
      solids.push({ x, z, r: 1.7 });
    } else if (spot.kind === 'npc') { // the attendance keeper: a friendly villager next to a stamp stand
      depth = 0.9;
      const npc = makeCharacter({ shirt: 0xffb86b, hair: 0x5b3a29, skin: 0xffdcbc, hat: 0x6bc4a6 });
      npc.root.position.set(-0.7, 0, 0); root.add(npc.root); npc.root.userData.npc = npc; npc.home = { x, z, yaw: root.rotation.y, id: facility.id };
      mesh(new THREE.BoxGeometry(1.0, 0.95, 0.7), mat(0xc58b5a), 0.7, 0.48, 0, root);
      mesh(new THREE.BoxGeometry(1.1, 0.08, 0.8), mat(0xffe9b8), 0.7, 0.99, 0, root);
      mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.16, 16), mat(0xe2574c), 0.7, 1.12, 0, root);
      sign(facility.name, root, 2.9);
      solids.push({ x, z, r: 1.2 });
      npcs.push(npc);
    }
    const reach = depth / 2 + 1.3;
    const out = Math.max(1.4, reach) + (spot.kind === 'hall' ? 2.6 : 0); // the hall's door point is past its terrace steps
    if (!facility.decor) doors[facility.id] = { x: x + toCentre.x * out, z: z + toCentre.y * out, name: facility.name };
  }

  // v1.10.1: the shop street's reserved lot (외형 변경 시설 comes later): a low fence around levelled ground, no entrance yet.
  for (const lot of RESERVED_LOTS) {
    const g = new THREE.Group(); g.position.set(lot.x, heightAt(lot.x, lot.z), lot.z); g.rotation.y = Math.atan2(lot.face[0] - lot.x, lot.face[1] - lot.z); scene.add(g);
    const dirt = mesh(new THREE.BoxGeometry(6.5, 0.06, 5.5), mat(0xd9c49a), 0, 0.03, 0, g); dirt.castShadow = false;
    for (let k = 0; k <= 12; k += 1) {
      const t = k / 12; const px = -3.4 + t * 6.8;
      for (const pz of [-2.9, 2.9]) { if (pz > 0 && Math.abs(px) < 1.2) continue; mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 6), mat(0xc58b5a), px, 0.4, pz, g); }
    }
    for (const pz of [-2.9, 2.9]) for (const side of [-1, 1]) { const rail = mesh(new THREE.BoxGeometry(pz > 0 ? 2.2 : 6.8, 0.08, 0.06), mat(0xc58b5a), pz > 0 ? side * 2.3 : 0, 0.62, pz, g); if (pz < 0 && side > 0) rail.visible = false; }
    for (const [cx, cz] of [[-1.8, -1], [-1.1, -1.4], [2, 0.6]]) mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), mat(0xb98b62), cx, 0.3, cz, g);
    solids.push({ x: lot.x, z: lot.z, r: 3.2 });
  }

  // The player's character: a big head on a short body.
  const ME_BASE = { shirt: 0x7cb8ff, hair: 0x4a3326, skin: 0xffe0c4 };
  let me = makeCharacter(ME_BASE);
  me.root.position.set(SPAWN.x + (Math.random() - 0.5) * 3, 0, SPAWN.z + Math.random() * 0.8); // the plaza, a little apart from whoever arrived just before
  me.root.position.y = heightAt(me.root.position.x, me.root.position.z);
  scene.add(me.root);
  // v1.9.2: wear an avatar look and show a name tag; the character is rebuilt in place (position and facing kept).
  function setAvatar({ look = {}, name = '', title = null, champion = false } = {}) {
    const old = me; me = makeCharacter({ ...ME_BASE, look });
    me.root.position.copy(old.root.position); me.root.rotation.y = old.root.rotation.y; me.targetYaw = old.targetYaw;
    disposeCharacter(old); scene.add(me.root);
    if (name) { me.tag = makeTag(name, title, champion); me.tag.position.y = 2.75; me.root.add(me.tag); }
    me.look = look; me.title = title; me.champion = Boolean(champion);
  }

  // v1.9.3 V3: everyone else in the plaza. The server's snapshots move a target; each frame the character glides
  // toward it (so ~7 updates a second still look smooth) and plays the same walk/idle animation as mine.
  const others = new Map(); // id -> { c, target: { x, z, yaw, moving }, key }
  const OTHER_BASE = { shirt: 0x7cb8ff, hair: 0x4a3326, skin: 0xffe0c4 };
  function setOthers(list) {
    const seen = new Set();
    for (const p of list || []) {
      if (!p?.id) continue;
      seen.add(p.id);
      const key = JSON.stringify([p.look || {}, p.name, p.title || null, Boolean(p.champion)]);
      let o = others.get(p.id);
      if (o && o.key !== key) { // a new look or title: rebuild in place
        const pos = o.c.root.position.clone(); const yaw = o.c.root.rotation.y; disposeCharacter(o.c);
        o.c = makeCharacter({ ...OTHER_BASE, look: p.look || {} }); o.c.root.position.copy(pos); o.c.root.rotation.y = yaw; o.key = key;
        o.c.tag = makeTag(p.name || '', p.title || null, p.champion); o.c.tag.position.y = 2.75; o.c.root.add(o.c.tag); scene.add(o.c.root);
      }
      if (!o) {
        const c = makeCharacter({ ...OTHER_BASE, look: p.look || {} });
        c.root.position.set(p.x, heightAt(p.x, p.z), p.z); c.root.rotation.y = p.yaw;
        c.tag = makeTag(p.name || '', p.title || null, p.champion); c.tag.position.y = 2.75; c.root.add(c.tag); scene.add(c.root);
        o = { c, key, champion: Boolean(p.champion) }; others.set(p.id, o);
      }
      // v1.9.9: how fast they were walking between the last two snapshots, so my collision can look a little ahead
      const now = performance.now(); const prev = o.target; const gap = prev ? (now - o.targetAt) / 1000 : 0;
      o.vel = p.moving && prev && gap > 0.02 && gap < 1 ? { x: (p.x - prev.x) / gap, z: (p.z - prev.z) / gap } : { x: 0, z: 0 };
      const speed = Math.hypot(o.vel.x, o.vel.z); if (speed > SPEED * 1.3) { o.vel.x *= (SPEED * 1.3) / speed; o.vel.z *= (SPEED * 1.3) / speed; }
      o.target = { x: p.x, z: p.z, yaw: p.yaw, moving: Boolean(p.moving) }; o.targetAt = now; o.champion = Boolean(p.champion);
    }
    for (const [id, o] of others) if (!seen.has(id)) { disposeCharacter(o.c); others.delete(id); }
  }
  // v1.9.6: the server moved me out of someone (it saw an overlap my screen did not): glide there, through tryMove.
  let correction = null;
  function correctTo(x, z) {
    const d = Math.hypot(x - me.root.position.x, z - me.root.position.z);
    if (d > 0.3) { me.root.position.set(x, heightAt(x, z), z); correction = null; } // the server's word, at once (a short hop)
    else if (d > 0.05) correction = { x, z };
  }
  function stepCorrection(dt) {
    if (!correction) return;
    const p = me.root.position; const k = Math.min(1, dt * 8);
    const nx = p.x + (correction.x - p.x) * k; const nz = p.z + (correction.z - p.z) * k;
    tryMove(nx, nz);
    if (Math.hypot(correction.x - p.x, correction.z - p.z) < 0.05) correction = null;
  }
  function stepOthers(dt) {
    stepCorrection(dt);
    for (const o of others.values()) {
      const p = o.c.root.position; const t = o.target; const k = Math.min(1, dt * 9);
      const dist = Math.hypot(t.x - p.x, t.z - p.z);
      if (dist > 6) { p.x = t.x; p.z = t.z; } else { p.x += (t.x - p.x) * k; p.z += (t.z - p.z) * k; } // a far jump (reconnect) snaps
      // v1.9.9: their glide never sinks into my character (the server already keeps the real positions apart; a late
      // snapshot would otherwise draw them inside me for a moment). Moving apart is never held back.
      const m = me.root.position; const dx = p.x - m.x; const dz = p.z - m.z; const d = Math.hypot(dx, dz);
      const min = playerRadiusAt(m.x, m.z) + playerRadiusAt(p.x, p.z);
      if (dist <= 6 && d < min && d < o.drawnGap - 1e-4) {
        const ux = d > 1e-4 ? dx / d : 0; const uz = d > 1e-4 ? dz / d : 1; const keep = Math.min(min, o.drawnGap);
        p.x = m.x + ux * keep; p.z = m.z + uz * keep;
      }
      o.drawnGap = Math.hypot(p.x - m.x, p.z - m.z);
      p.y = heightAt(p.x, p.z);
      o.c.targetYaw = t.yaw;
      animate(o.c, dt, t.moving || dist > 0.05);
    }
  }
  const pose = () => ({ x: me.root.position.x, z: me.root.position.z, yaw: me.root.rotation.y, moving: keys.size > 0 && !isBlocked() });

  function makeCharacter({ shirt, hair, skin, hat = null, look = {} }) {
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
    const parts = { head, body, hairCap, setShirt: (color) => { torso.material = mat(color); tint(armL, color); tint(armR, color); } };
    for (const slot of ['outfit', 'hair', 'hat']) AVATAR_PARTS[look[slot]]?.(parts);
    for (const ex of [-0.17, 0.17]) {
      const eye = mesh(new THREE.SphereGeometry(0.065, 12, 10), mat(0x2b2220, { roughness: 0.3 }), ex, -0.02, 0.48, head); eye.scale.y = 1.35; eye.castShadow = false;
      const cheek = mesh(new THREE.SphereGeometry(0.08, 12, 8), mat(0xffa6a6), ex * 1.55, -0.16, 0.42, head); cheek.scale.set(1, 0.6, 0.4); cheek.castShadow = false;
    }
    if (hat) {
      mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 24), mat(hat), 0, 0.36, 0, head);
      mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.34, 20), mat(hat), 0, 0.55, 0, head);
    }
    return { root, body, head, legL, legR, armL, armR, cape: parts.cape || null, halo: parts.halo || null, yaw: 0, phase: 0, lean: 0, roll: 0, hop: 0, headYaw: 0 };
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
  // v1.10.2 시점 회전: dragging with the left button turns the camera around my character (a press that hardly moves
  // stays a click on a facility). The arrow keys follow the view, so ↑ always walks into the screen.
  let camYaw = 0; let drag = null; let dragged = false;
  const DRAG_START = 5; const DRAG_TURN = 0.008; // pixels before a press becomes a drag, radians per pixel
  const onDown = (event) => { if (event.button !== 0) return; drag = { x: event.clientX, y: event.clientY, id: event.pointerId }; dragged = false; };
  const onClick = (event) => { if (dragged) { dragged = false; return; } if (isBlocked()) return; const id = facilityAt(event); if (id) interact(id); };
  const onMove = (event) => {
    if (drag && drag.id === event.pointerId && !isBlocked()) {
      const dx = event.clientX - drag.x;
      if (!dragged && Math.hypot(dx, event.clientY - drag.y) >= DRAG_START) { dragged = true; renderer.domElement.setPointerCapture?.(event.pointerId); }
      if (dragged) { camYaw -= (event.clientX - (drag.lastX ?? drag.x)) * DRAG_TURN; drag.lastX = event.clientX; renderer.domElement.style.cursor = 'grabbing'; return; }
    }
    renderer.domElement.style.cursor = !isBlocked() && facilityAt(event) ? 'pointer' : 'grab';
  };
  const onUp = (event) => { if (drag?.id === event.pointerId) { drag = null; renderer.domElement.style.cursor = 'grab'; } };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);
  renderer.domElement.addEventListener('pointercancel', onUp);
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
  // The radius of a character standing at (x, z): smaller near any facility's door.
  const playerRadiusAt = (x, z) => {
    for (const door of Object.values(doors)) if (Math.hypot(door.x - x, door.z - z) < DOOR_ZONE) return DOOR_PLAYER_R;
    return PLAYER_R;
  };
  // Other players as circles where they are drawn right now (their glide toward the server's position). Kept in one
  // function so a spatial grid can replace the plain loop if the plaza ever holds many people.
  function otherCircles() {
    const out = [];
    for (const o of others.values()) {
      const p = o.c.root.position; out.push({ x: p.x, z: p.z, r: playerRadiusAt(p.x, p.z) }); // where they are drawn
      const t = o.target; // and where the server last had them (ahead of the drawing while they move), so lag cannot open a gap
      if (t && Math.hypot(t.x - p.x, t.z - p.z) > 0.05) out.push({ x: t.x, z: t.z, r: playerRadiusAt(t.x, t.z) });
      // v1.9.9: and, while they walk, where they are by now (the snapshot is already old when it arrives). On a slow PC
      // two people walking at each other otherwise each stop against the other's old spot and end up drawn overlapping.
      if (t?.moving && o.vel && (o.vel.x || o.vel.z)) {
        const ahead = Math.min(0.35, (performance.now() - o.targetAt) / 1000 + 0.12);
        const ax = t.x + o.vel.x * ahead; const az = t.z + o.vel.z * ahead;
        out.push({ x: ax, z: az, r: playerRadiusAt(ax, az) });
      }
    }
    return out;
  }
  // Move from (px, pz) toward (nx, nz) without walking into another player: a step into someone is projected onto
  // the contact circle, which drops the part of the step that points into them and keeps the part along the contact
  // -- so a head-on push stops and anything at an angle slides past. Nobody is pushed; only my step changes.
  function collidePlayers(px, pz, nx, nz) {
    const mine = playerRadiusAt(nx, nz);
    for (const o of otherCircles()) {
      const min = mine + o.r;
      let dx = nx - o.x; let dz = nz - o.z; let d = Math.hypot(dx, dz);
      if (d >= min) continue;
      const bx = px - o.x; const bz = pz - o.z; const before = Math.hypot(bx, bz);
      if (before < min - 0.01) { // already overlapping (lag): ease apart a little, back toward the side I came from
        const ux = before > 1e-4 ? bx / before : (d > 1e-4 ? dx / d : 1); const uz = before > 1e-4 ? bz / before : (d > 1e-4 ? dz / d : 0);
        const target = Math.min(min, before + SEPARATE_STEP);
        nx = o.x + ux * target; nz = o.z + uz * target;
        continue;
      }
      // the step would end past their centre (or on it): stop at the contact on my side, never on the far side
      if (d < 1e-4 || dx * bx + dz * bz <= 0) { dx = bx; dz = bz; d = before || 1; }
      nx = o.x + (dx / d) * min; nz = o.z + (dz / d) * min;
    }
    return [nx, nz];
  }

  // v1.10.0: hundreds of trees and lamps on the island, so the solids are looked up in a coarse grid.
  const GRID = 8; const grid = new Map();
  for (const s of solids) {
    for (let gx = Math.floor((s.x - s.r) / GRID); gx <= Math.floor((s.x + s.r) / GRID); gx += 1) {
      for (let gz = Math.floor((s.z - s.r) / GRID); gz <= Math.floor((s.z + s.r) / GRID); gz += 1) {
        const key = `${gx},${gz}`; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(s);
      }
    }
  }
  const solidsNear = (x, z) => grid.get(`${Math.floor(x / GRID)},${Math.floor(z / GRID)}`) || [];
  const pushOut = (nx, nz) => {
    for (const s of solidsNear(nx, nz)) {
      const dx = nx - s.x; const dz = nz - s.z; const dist = Math.hypot(dx, dz); const min = s.r + 0.45;
      if (dist < min && dist > 1e-6) { nx = s.x + (dx / dist) * min; nz = s.z + (dz / dist) * min; }
    }
    return [nx, nz];
  };
  const tryMove = (nx, nz) => {
    const p = me.root.position;
    [nx, nz] = collidePlayers(p.x, p.z, nx, nz);
    [nx, nz] = pushOut(nx, nz);
    if (!walkable(nx, nz)) { // the sea, a stream, the pond or a cliff edge: slide along it if one axis still works
      if (walkable(nx, p.z)) nz = p.z; else if (walkable(p.x, nz)) nx = p.x; else return;
    }
    p.x = nx; p.z = nz; p.y = heightAt(nx, nz);
  };
  const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

  let overview = false; // tests and support: the whole island from above
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const OFFSET = new THREE.Vector3(0, 7.4, 10.8);
  function placeCamera(snap) {
    const p = me.root.position;
    scene.fog.far = overview ? 2000 : 175; if (camera.far !== (overview ? 600 : 180)) { camera.far = overview ? 600 : 180; camera.updateProjectionMatrix(); }
    if (overview) { camera.position.set(0, 230, 40); camera.lookAt(0, 0, 0); return; }
    const sin = Math.sin(camYaw); const cos = Math.cos(camYaw); // the low quarter view, turned by dragging (v1.10.2)
    const want = new THREE.Vector3(p.x + sin * OFFSET.z, p.y + OFFSET.y, p.z + cos * OFFSET.z); // v1.10.0: follow the player across the island
    const look = new THREE.Vector3(p.x - sin * 2.4, p.y + 1.3, p.z - cos * 2.4);
    if (snap) { camPos.copy(want); camLook.copy(look); } else { camPos.lerp(want, 0.08); camLook.lerp(look, 0.1); }
    camera.position.copy(camPos); camera.lookAt(camLook);
  }

  let running = false; let raf = 0; let last = 0; let clock = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const real = (now - (last || now)) / 1000; const dt = Math.min(0.05, real); last = now; clock += dt;
    step(dt);
    renderer.render(scene, camera);
    adaptQuality(Math.min(real, 1)); // real time, so a very slow PC steps down after 3 seconds, not 3 seconds of capped frames
  }
  // A slow PC steps the picture down instead of stuttering: first a lower pixel ratio, then no shadows.
  let quality = 2; let slowTime = 0; let sampled = 0;
  function adaptQuality(dt) {
    if (quality === 0) return;
    sampled += dt; slowTime += dt > 1 / 35 ? dt : 0;
    if (sampled < 3) return;
    if (slowTime / sampled > 0.5) {
      quality -= 1;
      if (quality === 1) renderer.setPixelRatio(1);
      else { renderer.shadowMap.enabled = false; sun.castShadow = false; mats.forEach((m) => { m.needsUpdate = true; }); }
      resize();
    }
    sampled = 0; slowTime = 0;
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
      const sin = Math.sin(camYaw); const cos = Math.cos(camYaw); // keys are relative to the view
      const wx = ix * cos + iz * sin; const wz = -ix * sin + iz * cos;
      tryMove(me.root.position.x + wx * SPEED * dt, me.root.position.z + wz * SPEED * dt);
      me.targetYaw = Math.atan2(wx, wz);
    }
    animate(me, dt, moving);
    stepOthers(dt);
    const now = performance.now(); stepBubble(me, now); for (const o of others.values()) stepBubble(o.c, now);
    for (const npc of npcs) { // the keeper turns to a player who comes close and waves
      const close = near === npc.home.id;
      npc.lookAt = close ? Math.atan2(me.root.position.x - npc.home.x, me.root.position.z - npc.home.z) - npc.home.yaw : null;
      npc.waving = close;
      animate(npc, dt, false);
    }
    // Nearest facility within reach: hint + the head turns toward it.
    let best = null; let bestD = REACH;
    for (const [id, door] of Object.entries(doors)) {
      const d = Math.hypot(door.x - me.root.position.x, door.z - me.root.position.z);
      if (d < bestD) { best = id; bestD = d; }
    }
    if (best !== near) { near = best; onNear?.(near ? { id: near, name: doors[near].name } : null); }
    me.lookAt = near ? Math.atan2(doors[near].x - me.root.position.x, doors[near].z - me.root.position.z) : null;
    sun.position.set(me.root.position.x - 9, me.root.position.y + 18, me.root.position.z + 8); sun.target.position.copy(me.root.position);
    island.step(clock); refreshMapBoard(); refreshMinimap(performance.now());
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
    if (c.waving) { c.armR.rotation.z = 2.5 + Math.sin(clock * 9) * 0.35; c.armR.rotation.x = 0; }
    c.body.position.y = (moving ? Math.abs(Math.sin(c.phase)) * 0.07 : 0) + hopT * 0.28;
    c.body.rotation.x = c.lean; c.body.rotation.z = c.roll;
    c.body.scale.y = 1 + (moving ? 0 : Math.sin(clock * 2.2) * 0.012);
    // the head turns toward a nearby facility (limited), and nods on interaction
    const wantHead = c.lookAt != null ? THREE.MathUtils.clamp(angleTo(c.root.rotation.y, c.lookAt), -0.7, 0.7) : 0;
    c.headYaw += (wantHead - c.headYaw) * Math.min(1, dt * 6);
    c.head.rotation.y = c.headYaw; c.head.rotation.x = -hopT * 0.25;
    if (c.cape) c.cape.rotation.x = 0.18 + c.lean * 2.2 + Math.sin(clock * 7 + c.phase) * (moving ? 0.08 : 0.02); // the cape trails when walking
    if (c.halo) c.halo.position.y = 0.8 + Math.sin(clock * 2.4) * 0.04;
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
    for (const o of others.values()) disposeCharacter(o.c); others.clear();
    window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur);
    renderer.domElement.removeEventListener('click', onClick); renderer.domElement.removeEventListener('pointermove', onMove);
    renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointerup', onUp); renderer.domElement.removeEventListener('pointercancel', onUp);
    scene.traverse((o) => { if (o.isMesh) o.geometry.dispose(); if (o.isSprite) o.material.dispose(); });
    mats.forEach((m) => m.dispose()); textures.forEach((t) => t.dispose()); island.dispose();
    renderer.dispose(); renderer.domElement.remove(); minimap.remove();
  }
  // For tests and support: where things are, and a way to stand at a facility's door.
  function debug() {
    const p = me.root.position;
    const screenOf = (id) => {
      const root = facilityRoots.find((r) => r.userData.facility === id);
      if (!root) return null;
      const v = new THREE.Vector3(root.position.x, root.position.y + 1.8, root.position.z).project(camera); // low on the building: a tall tower's middle can be off screen
      const rect = renderer.domElement.getBoundingClientRect();
      return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
    };
    return { x: p.x, z: p.z, yaw: me.root.rotation.y, near, running, quality, doors: { ...doors }, screenOf, place: (id) => { const d = doors[id]; if (d) { tryMove(d.x, d.z); placeCamera(true); } }, look: me.look || {}, title: me.title || null, champion: Boolean(me.champion), tag: Boolean(me.tag),
      teleport: (x, z) => { me.root.position.set(x, heightAt(x, z), z); correction = null; placeCamera(true); },
      bubble: me.bubble?.userData.text || null, render: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }, camYaw, minimap: { turn: minimapTurn, markers: mapMarkers.length }, walkable, heightAt, bridges: island.bridges, pier: island.pier, spawn: SPAWN, overview: (on) => { overview = Boolean(on); placeCamera(true); }, radiusAt: playerRadiusAt, others: [...others].map(([id, o]) => ({ id, x: o.c.root.position.x, z: o.c.root.position.z, tag: Boolean(o.c.tag), champion: Boolean(o.champion), bubble: o.c.bubble?.userData.text || null })) };
  }
  // The island map in a window (안내 지도): drawn into the caller's canvas with where I stand now.
  const drawMap = (canvas) => island.drawMap(canvas.getContext('2d'), canvas.width, canvas.height, { x: me.root.position.x, z: me.root.position.z });
  // v1.10.2: a chat message over someone's head ('me' or another player's id)
  const speak = (id, text) => say(id === 'me' ? me : others.get(id)?.c, text);
  const setMapMarkers = (list) => { mapMarkers = Array.isArray(list) ? list.filter((m) => Number.isFinite(m?.x) && Number.isFinite(m?.z)) : []; minimapAt = 0; };
  return { start, stop, dispose, debug, interact, setAvatar, setOthers, pose, correctTo, drawMap, speak, setMapMarkers };
}
