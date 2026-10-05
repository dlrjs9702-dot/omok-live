// v1.8.8 3D 광장 로비 V1: a small daytime village square that is the lobby's hub. Self-made primitive models only,
// no external assets. Kept apart from the RPG scene (public/rpg/rpg-scene.js): the two share Three.js, nothing else.
// The scene knows facility ids and names only; what a facility opens is the caller's `onInteract(id)`.
import * as THREE from '/vendor/three/three.module.js';
import { buildIsland, building, props, part, mergeColored, heightAt, walkable, SPOTS, COTTAGES, STATUE_SPOTS, RESERVED_LOTS, SPAWN, PLAZA_R } from './island.js';

const TAU = Math.PI * 2;
const SPEED = 5.2; // units per second (v1.10.0: the island is about 40 seconds of walking across)
const REACH = 2.4; // how close to a facility's door counts as "near"
// v1.9.6 player collision (plaza only): every character is the same circle at its feet on the ground (hair, capes and
// halos do not make it bigger). Close to a facility's door the circle shrinks so a crowd can never block an entrance.
const PLAYER_R = 0.45;
const DOOR_PLAYER_R = 0.28;
const DOOR_ZONE = 2.6;
const SEPARATE_STEP = 0.06; // already overlapping (network lag): drift apart this much per frame, never a jump
// v1.10.16: the procedural character's soles are this far above its root (leg pivot 0.5, capsule bottom 0.085); the
// walking islanders are lowered by it so their feet are on the ground, not just their root.
const FOOT_LIFT = 0.085;
// v1.10.8: how other people move on my screen (an interpolation buffer and a follower; public/plaza/remote-motion.js,
// loaded before the app like island-terrain.js)
const { createTrack, createFollower } = globalThis.RemoteMotion;
const IslandNpcs = globalThis.IslandNpcs; // v1.10.12 배회 NPC (public/plaza/island-npcs.js)
// v1.10.15 고품질 에셋 파이프라인 (public/plaza/asset-pipeline.js, island-assets.js; loaded before the app)
const AssetPipeline = globalThis.AssetPipeline;
// The registered island models, plus -- in automated browser tests only, like gc.testClassic -- entries a test puts in
// localStorage gc.testIslandAssets (null removes a registered one).
function islandAssetRegistry() {
  const registry = { ...(globalThis.IslandAssets?.REGISTRY || {}) };
  try { if (navigator.webdriver) Object.assign(registry, JSON.parse(localStorage.getItem('gc.testIslandAssets') || '{}')); } catch {}
  return registry;
}

// v1.10.23 Mac Chrome 구형 로비 노출 수정: the island's WebGL renderer, made more forgivingly, and a failure that says
// why. A context is first asked for with the island's preferred settings, then -- if that fails (some GPUs and
// drivers, e.g. a Mac switching graphics, refuse a particular setting) -- with Chrome's defaults, then without
// antialiasing on the low-power GPU. Each try that fails leaves no context behind, and there are at most three.
// Errors carry a `code` for the caller (app.js shows its error screen, never the classic lobby, and reports it):
//   webgl-unavailable  the browser gives no WebGL2 at all (hardware acceleration off, GPU blocked)
//   webgl-context      WebGL2 exists but no context with any of the settings
//   init               the island failed while being built
const RENDERER_TRIES = [
  { antialias: true, powerPreference: 'high-performance' },
  { antialias: true },
  { antialias: false, powerPreference: 'low-power' },
];
const coded = (error, code, extra = {}) => Object.assign(error instanceof Error ? error : new Error(String(error)), { code: error?.code || code, ...extra });
function createRenderer() {
  let gpu = '';
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe) throw coded(new Error('WebGL2 unavailable'), 'webgl-unavailable');
  try { const ext = probe.getExtension('WEBGL_debug_renderer_info'); gpu = String(probe.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER) || ''); } catch {}
  probe.getExtension('WEBGL_lose_context')?.loseContext(); // give the probe's context back before asking for the real one
  const errors = [];
  for (const [attempt, options] of RENDERER_TRIES.entries()) {
    try { return { renderer: new THREE.WebGLRenderer(options), attempt, gpu }; } catch (error) { errors.push(error?.message || String(error)); }
  }
  throw coded(new Error(`WebGL context: ${errors.join(' | ')}`), 'webgl-context', { gpu });
}

export function createPlaza(host, options) {
  const made = createRenderer();
  try { return buildPlaza(host, options, made); } catch (error) {
    made.renderer.dispose(); made.renderer.domElement.remove();
    throw coded(error, 'init', { gpu: made.gpu });
  }
}

function buildPlaza(host, { facilities, onInteract, onNear, blocked, startAt }, made) {
  const { renderer } = made;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'plazaCanvas';
  host.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfe6ff);
  scene.fog = new THREE.Fog(0xd7efff, 70, 175); // far enough that the climbing tower reads from the plaza
  // v1.10.29: the camera reaches VIEW_FAR so the far scenery at sea (haze, no fog: asset-loader) shows over the
  // horizon; the island itself still fades into the fog by 175 exactly as before
  const VIEW_FAR = 420;
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, VIEW_FAR);

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
  // v1.10.15: a target registered in island-assets.js swaps its procedural look for its model once that has loaded;
  // unregistered, switched off or failed targets keep the procedural one. Nothing registered (now) loads nothing.
  const assets = AssetPipeline.createLazyAssets({
    registry: islandAssetRegistry(), off: window.GameBoot?.manifest?.assetsOff || [],
    importLoader: () => import('./asset-loader.js'),
    // v1.10.27: the season day (island-terrain.js seasonDay: every zone's season), corrected to the server clock below
    options: { assetUrl: (path) => window.GameBoot?.assetUrl(path) ?? path, walkSpeed: SPEED, tier: 2, day: globalThis.IslandTerrain.seasonDay(Date.now()) },
  });
  const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }); // v1.10.13: every merged build (island.js)
  const STONE = new THREE.CylinderGeometry(0.5, 0.5, 1, 9);

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
  // v1.10.5: 「호구왕」 (this week's top donor) is a second small mark, in its own colour.
  // v1.10.29 (사용자 결정 2026-10-05): the marks (챔피언, 호구왕) are no longer after the name but on their own row right
  // under it, side by side; the title's row comes below them. The tag stands on its bottom edge (sprite centre at the
  // bottom), so a taller tag grows upward and never into the head; the chat bubble goes on top of it (say()).
  const TAG_Y = 2.53; // the tag's bottom over a character's feet
  function makeTag(name, title, champion = false, hoguking = false) {
    const pills = [champion && { text: '챔피언', from: '#ffd86b', to: '#f0b429', ink: '#4a2a00' }, hoguking && { text: '호구왕', from: '#c4a5ff', to: '#8b5cf6', ink: '#ffffff' }].filter(Boolean);
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 104 + (pills.length ? 58 : 0) + (title ? 64 : 0);
    const c = canvas.getContext('2d'); c.textAlign = 'center'; c.textBaseline = 'middle';
    const font = (px) => `800 ${px}px Pretendard, "Malgun Gothic", system-ui, sans-serif`;
    c.font = font(54); const nameW = Math.min(440, c.measureText(name).width);
    const total = Math.min(504, nameW + 48);
    c.fillStyle = 'rgba(30,24,20,.62)'; c.beginPath(); c.roundRect((512 - total) / 2, 8, total, 88, 44); c.fill();
    c.fillStyle = '#ffffff'; c.fillText(name, 256, 54, nameW);
    let y = 104;
    if (pills.length) {
      c.font = font(34); for (const p of pills) p.w = c.measureText(p.text).width + 34;
      let left = (512 - (pills.reduce((n, p) => n + p.w, 0) + 12 * (pills.length - 1))) / 2;
      for (const p of pills) {
        const g = c.createLinearGradient(left, 0, left + p.w, 0); g.addColorStop(0, p.from); g.addColorStop(1, p.to);
        c.fillStyle = g; c.beginPath(); c.roundRect(left, y + 2, p.w, 48, 24); c.fill();
        c.fillStyle = p.ink; c.fillText(p.text, left + p.w / 2, y + 27);
        left += p.w + 12;
      }
      y += 58;
    }
    if (title) { const t = `\u300a${title}\u300b`; c.font = font(38); c.fillStyle = '#ffd86b'; c.strokeStyle = 'rgba(40,28,10,.85)'; c.lineWidth = 7; c.strokeText(t, 256, y + 30, 480); c.fillText(t, 256, y + 30, 480); }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));
    sprite.center.set(0.5, 0); sprite.scale.set(2.2, (2.2 * canvas.height) / 512, 1); sprite.renderOrder = 2;
    sprite.userData.rows = { marks: pills.map((p) => p.text), title: Boolean(title) }; // tests: what the rows under the name hold
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
    c.bubble.position.y = (c.tag ? c.tag.position.y + c.tag.scale.y : 2.4) + 0.25 + c.bubble.scale.y / 2; // over the whole tag (it stands on its bottom)
    c.root.add(c.bubble);
  }
  function stepBubble(c, now) {
    const b = c?.bubble; if (!b) return;
    const left = b.userData.until - now;
    if (left <= 0) { disposeTag(b); c.bubble = null; return; }
    b.material.opacity = Math.min(1, left / 600);
  }
  const disposeTag = (tag) => { if (!tag) return; tag.material.map.dispose(); tag.material.dispose(); tag.parent?.remove(tag); };
  const disposeCharacter = (c) => { assets.release(c); disposeTag(c.tag); disposeTag(c.bubble); c.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); c.root.parent?.remove(c.root); };


  // v1.10.0 게임 아일랜드: the island itself (terrain, sea, streams, bridges, walks, woods, harbour) comes from island.js;
  // here is the raised central plaza: the fountain whose water runs off into the streams, benches, lamps, flower beds
  // and the two empty plinths kept for the donation statues.
  const island = buildIsland(scene, { mat, mesh, solids, assets });
  // v1.10.29: a season day moves the models (assets) and the ground's colours (island) together
  const setSeasonDay = (day) => { assets.setDay(day); island.setSeasonDay(day); };
  island.setSeasonDay(globalThis.IslandTerrain.seasonDay(Date.now()));
  const PH = heightAt(0, 0);
  const fountain = new THREE.Group(); fountain.position.y = PH; scene.add(fountain);
  mesh(new THREE.CylinderGeometry(2.9, 3.1, 0.6, 44), mat(0xeae3d6), 0, 0.3, 0, fountain);
  mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.1, 44), mat(0x86d0f0, { roughness: 0.45 }), 0, 0.56, 0, fountain); // v1.10.13: no metal shine
  mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.5, 20), mat(0xeae3d6), 0, 1.2, 0, fountain);
  mesh(new THREE.CylinderGeometry(1.1, 0.6, 0.35, 28), mat(0xf1ebe0), 0, 1.95, 0, fountain);
  mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.06, 28), mat(0x86d0f0, { roughness: 0.45 }), 0, 2.1, 0, fountain);
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
  const PROPS = globalThis.IslandTerrain.plazaProps(); // v1.10.16: placed in island-terrain.js, shared with the islanders' routes
  // v1.10.17: each plaza prop is a gameplay holder (place, facing; its circle is the shared plazaProps one) with its
  // procedural look in a `visual` group, which a registered model (prop.bench / prop.lamp / prop.planter) replaces
  const propHolder = (x, z, ry = 0) => { const holder = new THREE.Group(); holder.position.set(x, PH, z); holder.rotation.y = ry; scene.add(holder); const visual = new THREE.Group(); holder.add(visual); return [holder, visual]; };
  for (const b of PROPS.benches) { // benches facing the fountain, clear of the channels
    const [bench, visual] = propHolder(b.x, b.z, Math.atan2(-b.x, -b.z));
    mesh(new THREE.BoxGeometry(1.7, 0.12, 0.55), mat(0xc58b5a), 0, 0.5, 0, visual);
    mesh(new THREE.BoxGeometry(1.7, 0.45, 0.1), mat(0xc58b5a), 0, 0.8, -0.25, visual);
    for (const x of [-0.7, 0.7]) mesh(new THREE.BoxGeometry(0.1, 0.5, 0.5), mat(0x6b5a4a), x, 0.25, 0, visual);
    solids.push(b);
    assets.attach('prop.bench', bench, visual);
  }
  const lamps = [];
  for (const lamp of PROPS.lamps) {
    const [holder, visual] = propHolder(lamp.x, lamp.z);
    mesh(new THREE.CylinderGeometry(0.08, 0.11, 2.6, 10), mat(0x4d6b5c), 0, 1.3, 0, visual);
    lamps.push(mesh(new THREE.SphereGeometry(0.26, 16, 12), mat(0xfff3c2, { emissive: 0xffe08a, emissiveIntensity: 0.6 }), 0, 2.75, 0, visual));
    solids.push(lamp);
    assets.attach('prop.lamp', holder, visual);
  }
  const flowerColors = [0xff9ec7, 0xffe27a, 0xffffff, 0xc4a5ff, 0xff8f8f];
  for (const bed of PROPS.beds) { // beds along the plaza rim, between the walks and channels
    const { i } = bed;
    const [holder, visual] = propHolder(bed.x, bed.z, Math.atan2(-bed.x, -bed.z)); // v1.10.20: facing the fountain (a planter model lies along the rim)
    mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.3, 20), mat(0xb98b62), 0, 0.15, 0, visual);
    mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.06, 20), mat(0x6b4f3a), 0, 0.31, 0, visual);
    for (let k = 0; k < 9; k += 1) {
      const fa = k * 2.4; const fr = 0.2 + (k % 3) * 0.22;
      const f = mesh(new THREE.SphereGeometry(0.12, 8, 6), mat(flowerColors[(i + k) % flowerColors.length]), Math.cos(fa) * fr, 0.45, Math.sin(fa) * fr, visual);
      f.castShadow = false;
    }
    solids.push(bed);
    assets.attach('prop.planter', holder, visual);
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
  let minimapAt = 0; let minimapTurn = 0; let minimapShown = 0; let mapMarkers = []; // markers: the events near me (v1.10.11)
  function refreshMinimap(now) {
    if (now - minimapAt < 120) return;
    minimapAt = now;
    const places = Object.entries(doors).map(([, d]) => ({ x: d.x, z: d.z, name: d.name }));
    ({ turn: minimapTurn, shown: minimapShown } = island.drawMinimap(minimap.getContext('2d'), minimap.width, { x: me.root.position.x, z: me.root.position.z }, camYaw, places, mapMarkers));
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
  const firstBuildingSolid = solids.length; // v1.10.21: the facilities' and houses' circles, kept for the camera
  const facilityRoots = []; const buildingRoots = [];
  const npcs = []; // ponytail: NPCs only idle-breathe; real NPC behaviour is a later plaza version
  const doors = {};
  let mapFace = null; // v1.10.29: places the map picture on the board's look (procedural or model)
  // v1.10.2: the gazebo stays as a place to sit in the nature area; chat is an overlay now, not a facility.
  for (const facility of [...facilities, { id: 'chat', name: '', decor: true }]) {
    const spot = SPOTS[facility.id];
    if (!spot || (facility.decor && facilities.some((f) => f.id === facility.id))) continue;
    const { x, z } = spot;
    const root = new THREE.Group(); root.position.set(x, heightAt(x, z), z); root.rotation.y = Math.atan2(spot.face[0] - x, spot.face[1] - z);
    scene.add(root); root.userData.building = true; buildingRoots.push(root); // v1.10.21: faded when it hides me
    // v1.10.15: `root` is the gameplay object (place, facing, sign, keeper; collision and door are worked out from the
    // spot below); `visual` is only the procedural look, the part a registered model replaces.
    const visual = new THREE.Group(); root.add(visual);
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
      // v1.10.29: the terrace and its steps are the hall's ground (its collision and the way up), so they stay under the
      // hall model too, which stands on the terrace (facility.games offset)
      mesh(new THREE.BoxGeometry(w + 1.2, 0.5, depth + 2.6), mat(0xe9dcc4), 0, 0.25, 0.7, root); // terrace
      for (let k = 0; k < 3; k += 1) mesh(new THREE.BoxGeometry(6.4 - k * 0.6, 0.17, 0.5), mat(0xefe4cf), 0, 0.085 + k * 0.17, depth / 2 + 2.2 - k * 0.45, root); // steps
      mesh(new THREE.BoxGeometry(w, h, depth), wall, 0, 0.5 + h / 2, 0, visual);
      mesh(new THREE.BoxGeometry(w + 0.4, 0.35, depth + 0.4), trim, 0, 0.5 + h, 0, visual); // cornice
      const roof = mesh(new THREE.ConeGeometry(Math.max(w, depth) * 0.74, 2.2, 4), roofM, 0, 0.5 + h + 1.25, 0, visual); roof.rotation.y = Math.PI / 4; roof.scale.z = depth / w;
      const dome = mesh(new THREE.SphereGeometry(2.6, 28, 16, 0, TAU, 0, Math.PI / 2), mat(0x7ec4e8, { roughness: 0.4 }), 0, 0.5 + h + 1.4, 0, visual); dome.scale.y = 1.1;
      mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.5, 28), trim, 0, 0.5 + h + 1.3, 0, visual);
      mesh(new THREE.SphereGeometry(0.35, 14, 10), gold, 0, 0.5 + h + 4.45, 0, visual);
      for (const sx of [-1, 1]) { // side towers with flags
        const tx = sx * (w / 2 + 0.6);
        mesh(new THREE.CylinderGeometry(1.35, 1.5, h + 2.6, 18), trim, tx, 0.5 + (h + 2.6) / 2, -depth / 2 + 1.6, visual);
        mesh(new THREE.ConeGeometry(1.7, 2.4, 18), roofM, tx, 0.5 + h + 2.6 + 1.2, -depth / 2 + 1.6, visual);
        mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), mat(0x4a3828), tx, 0.5 + h + 5, -depth / 2 + 1.6, visual);
        const flag = mesh(new THREE.PlaneGeometry(0.9, 0.55), mat(sx < 0 ? 0x26272e : 0xfafafa, { side: THREE.DoubleSide }), tx + 0.45, 0.5 + h + 5.4, -depth / 2 + 1.6, visual); flag.castShadow = false;
        solids.push({ ...at(tx, -depth / 2 + 1.6), r: 1.6 });
      }
      for (const cx of [-5.4, -3.4, -1.5, 1.5, 3.4, 5.4]) mesh(new THREE.CylinderGeometry(0.32, 0.36, h - 0.4, 14), trim, cx, 0.5 + (h - 0.4) / 2, depth / 2 + 1.25, visual); // the colonnade
      mesh(new THREE.BoxGeometry(12.4, 0.6, 1.4), trim, 0, 0.5 + h - 0.1, depth / 2 + 0.95, visual);
      const pediment = mesh(new THREE.CylinderGeometry(1.6, 1.6, 12.6, 3), roofM, 0, 0.5 + h + 0.75, depth / 2 + 0.95, visual); pediment.rotation.set(0, 0, Math.PI / 2); pediment.scale.set(1, 1, 0.6);
      const b = mesh(new THREE.SphereGeometry(0.62, 20, 14), mat(0x26272e, { roughness: 0.35 }), -0.7, 0.5 + h + 1.3, depth / 2 + 1.6, visual); b.scale.z = 0.5;
      const ws = mesh(new THREE.SphereGeometry(0.62, 20, 14), mat(0xfafafa, { roughness: 0.35 }), 0.7, 0.5 + h + 1.3, depth / 2 + 1.6, visual); ws.scale.z = 0.5;
      mesh(new THREE.BoxGeometry(2.2, 3.4, 0.1), mat(0x8a5a3b), 0, 0.5 + 1.7, depth / 2 + 0.03, visual); // the big door
      for (const sx of [-0.55, 0.55]) mesh(new THREE.SphereGeometry(0.1, 8, 6), gold, sx, 0.5 + 1.8, depth / 2 + 0.12, visual);
      for (const wx of [-5.6, -3.2, 3.2, 5.6]) for (const wy of [2.1, 4.4]) mesh(new THREE.BoxGeometry(1.1, 1.3, 0.08), mat(0xbfe9ff, { roughness: 0.2, emissive: 0x6fb7e0, emissiveIntensity: 0.15 }), wx, 0.5 + wy, depth / 2 + 0.03, visual);
      sign(facility.name, root, 0.5 + h + 5.6);
      boxSolids(0, 0.7, w + 1.2, depth + 2.6);
      for (const cx of [-5.4, -3.4, -1.5, 1.5, 3.4, 5.4]) solids.push({ ...at(cx, depth / 2 + 1.25), r: 0.4 });
    } else if (spot.kind === 'tower') { // v1.10.1 등반 도전: a tall stone tower on the hill, a landmark from anywhere on the island
      depth = 6.4;
      const stone = mat(0xd8d0c2); const band = mat(0xb8ae9e); const roofM = mat(0x6f8fd8);
      let y = 0;
      for (const [r0, r1, hh] of [[3.2, 3.4, 4], [2.8, 3.1, 5], [2.4, 2.75, 5], [2.1, 2.35, 4]]) { // tapering stages with bands between
        mesh(new THREE.CylinderGeometry(r0, r1, hh, 22), stone, 0, y + hh / 2, 0, visual); y += hh;
        mesh(new THREE.CylinderGeometry(r0 + 0.2, r0 + 0.2, 0.35, 22), band, 0, y, 0, visual);
        for (let k = 0; k < 4; k += 1) { const a = (k / 4) * TAU + Math.PI / 4 + y; mesh(new THREE.BoxGeometry(0.5, 0.9, 0.12), mat(0x3d4a63), Math.sin(a) * (r0 + 0.02), y - hh / 2, Math.cos(a) * (r0 + 0.02), visual).rotation.y = a; }
      }
      const ring = mesh(new THREE.TorusGeometry(2.6, 0.12, 8, 30), band, 0, y - 1.6, 0, visual); ring.rotation.x = Math.PI / 2; // the balcony rail
      mesh(new THREE.ConeGeometry(2.7, 3.6, 22), roofM, 0, y + 1.8, 0, visual);
      mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), mat(0x4a3828), 0, y + 4.6, 0, visual);
      const flag = mesh(new THREE.PlaneGeometry(1.3, 0.8), mat(0xe83c46, { side: THREE.DoubleSide }), 0.65, y + 5.3, 0, visual); flag.castShadow = false;
      mesh(new THREE.BoxGeometry(1.4, 2.3, 0.2), mat(0x6b4a33), 0, 1.15, 3.25, visual); // the door
      const arch = mesh(new THREE.TorusGeometry(0.72, 0.12, 8, 16, Math.PI), band, 0, 2.3, 3.32, visual); arch.castShadow = false;
      sign(facility.name, root, 4.3);
      solids.push({ x, z, r: 3.5 });
    } else if (spot.kind === 'shop' || spot.kind === 'house' || spot.kind === 'office' || spot.kind === 'townhall') {
      // v1.10.13: one merged build per facility (island.js `building`): a level body on a stone plinth, a real pitched
      // or hip roof lined up with the walls (the old roof was a square cone squashed along its diagonal -- it looked
      // crooked), framed door and windows; each facility its own silhouette. Footprint and door are unchanged.
      const w = 3.2; const h = 2.4; depth = 2.7;
      const looks = {
        shop: { roof: 'front', rise: 1.35, windows: [[-1.08, 0.6], [1.08, 0.6], [0, 0.55, 'l'], [0, 0.55, 'r']], awning: [0xffffff, 0xff8aa8], planters: true },
        avatar: { roof: 'gable', rise: 1.05, chimney: 0.9, windows: [[-1.08, 0.6], [1.08, 0.6], [0, 0.55, 'l'], [0, 0.55, 'r']], awning: [0xffffff, 0xff8aa8], shutters: 0xe87a9e },
        records: { roof: 'front', rise: 1.7, windows: [[-1.08, 0.62], [1.08, 0.62], [-0.6, 0.55, 'l'], [0.6, 0.55, 'l'], [-0.6, 0.55, 'r'], [0.6, 0.55, 'r']], porch: true },
        admin: { roof: 'hip', rise: 0.85, windows: [[-1.08, 0.6], [1.08, 0.6], [0, 0.55, 'r']], lamp: true },
        townhall: { roof: 'hip', rise: 1.0, windows: [[-1.12, 0.6], [1.12, 0.6], [-0.6, 0.55, 'l'], [0.6, 0.55, 'l'], [-0.6, 0.55, 'r'], [0.6, 0.55, 'r']], lamp: true },
      };
      const bodyMesh = new THREE.Mesh(building({ w, d: depth, h, wall: spot.wall, roofColor: spot.roof, ...looks[facility.id] }), vcMat);
      bodyMesh.castShadow = true; bodyMesh.receiveShadow = true; visual.add(bodyMesh);
      if (spot.kind === 'townhall') { // v1.10.10 관공서: two columns by the door and a flag on the roof
        for (const px of [-0.75, 0.75]) mesh(new THREE.CylinderGeometry(0.12, 0.14, h * 0.9, 12), mat(0xfffaf0), px, h * 0.45, depth / 2 + 0.25, visual);
        mesh(new THREE.BoxGeometry(2.0, 0.14, 0.6), mat(0xfffaf0), 0, h * 0.92, depth / 2 + 0.2, visual);
        mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.6, 8), mat(0x8a8f99), w * 0.32, h + 1.4, 0, visual);
        mesh(new THREE.PlaneGeometry(0.62, 0.4), mat(0x5fb0ff, { side: THREE.DoubleSide }), w * 0.32 + 0.32, h + 1.95, 0, visual);
      }
      if (spot.kind === 'house') { // the records hall carries a trophy
        mesh(new THREE.CylinderGeometry(0.3, 0.18, 0.5, 16), mat(0xf6c945, { metalness: 0.25, roughness: 0.5 }), 0, h + 2.5, 0, visual);
        mesh(new THREE.CylinderGeometry(0.1, 0.22, 0.25, 12), mat(0xf6c945, { metalness: 0.25, roughness: 0.5 }), 0, h + 2.15, 0, visual);
      }
      sign(facility.name, root, h + (spot.kind === 'house' ? 3.3 : 2.5)); // above the roof ornaments
      solids.push({ x, z, r: Math.max(w, depth) * 0.62 });
      footing(root, w + 0.6, depth + 0.6);
    } else if (spot.kind === 'board') { // a notice board on two posts, papers pinned on it
      depth = 0.3;
      for (const px of [-1.25, 1.25]) mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.6, 10), mat(0x8a5a3b), px, 1.3, 0, visual);
      mesh(new THREE.BoxGeometry(2.8, 1.6, 0.16), mat(spot.tint || 0xc58b5a), 0, 1.75, 0, visual);
      mesh(new THREE.BoxGeometry(3.1, 0.18, 0.4), mat(0x8a5a3b), 0, 2.65, 0, visual);
      const paper = [0xffffff, 0xfff3b0, 0xd7f0ff, 0xffd9e6];
      for (let k = 0; k < 5; k += 1) {
        const p = mesh(new THREE.PlaneGeometry(0.55, 0.5), mat(paper[k % 4]), -0.95 + k * 0.47, 1.7 + (k % 2 ? 0.25 : -0.2), 0.09, visual);
        p.rotation.z = (k % 2 ? 1 : -1) * 0.06; p.castShadow = false;
      }
      sign(facility.name, root, 3.4);
      solids.push({ x, z, r: 1.5 });
    } else if (spot.kind === 'donation') { // v1.10.5 기부함: a wooden chest with a coin slot and a gold band
      depth = 0.9;
      mesh(new THREE.BoxGeometry(1.2, 0.9, 0.8), mat(0xa06a3f), 0, 0.45, 0, visual);
      mesh(new THREE.BoxGeometry(1.26, 0.12, 0.86), mat(0xf6c945, { metalness: 0.5, roughness: 0.35 }), 0, 0.6, 0, visual);
      const lid = mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 16, 1, false, 0, Math.PI), mat(0x8a5a3b), 0, 0.9, 0, visual); lid.rotation.z = Math.PI / 2;
      mesh(new THREE.BoxGeometry(0.42, 0.04, 0.08), mat(0x2b2220), 0, 1.31, 0, visual); // the slot
      mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 16), mat(0xffd23f, { metalness: 0.6, roughness: 0.3 }), 0.3, 1.32, 0.1, visual).rotation.x = 0.4;
      sign(facility.name, root, 2.3);
      solids.push({ x, z, r: 0.95 });
    } else if (spot.kind === 'mapboard') { // v1.10.0 안내 지도: the island drawn on a board, with where I am
      depth = 0.3;
      for (const px of [-1.5, 1.5]) mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.8, 10), mat(0x8a5a3b), px, 1.4, 0, visual);
      mesh(new THREE.BoxGeometry(3.3, 2.5, 0.14), mat(0x8a5a3b), 0, 1.85, 0, visual);
      const face = mesh(new THREE.PlaneGeometry(3, 2.2), new THREE.MeshBasicMaterial({ map: mapTexture }), 0, 1.85, 0.08, root); face.castShadow = false;
      // v1.10.29: on the board model the picture fills its blank panel (`Map_Panel`: centre (0, 1.60, -0.13), 2.20 x 1.23,
      // facing the model's front -z, turned to +z by the entry), the map cropped top and bottom to the panel's shape
      mapFace = (entry) => {
        const k = entry ? entry.scale ?? 1 : 1;
        face.scale.set(entry ? (2.2 * k) / 3 : 1, entry ? (1.23 * k) / 2.2 : 1, 1); face.position.set(0, entry ? 1.6 * k : 1.85, entry ? 0.13 * k + 0.012 : 0.08);
        const crop = entry ? (mapCanvas.width / mapCanvas.height) / (2.2 / 1.23) : 1; mapTexture.repeat.set(1, crop); mapTexture.offset.set(0, (1 - crop) / 2);
      };
      const roofBar = mesh(new THREE.BoxGeometry(3.6, 0.16, 0.5), mat(0x6b4f3a), 0, 3.18, 0, visual); roofBar.rotation.x = 0.1;
      sign(facility.name, root, 3.8);
      solids.push({ x, z, r: 1.7 });
    } else if (spot.kind === 'gate') { // v1.9.4: a stone gate in front of a little mountain with a flag on top
      depth = 1.2;
      const stone = mat(0xb8b0a4);
      for (const px of [-1.4, 1.4]) mesh(new THREE.BoxGeometry(0.55, 2.6, 0.7), stone, px, 1.3, 0, visual);
      mesh(new THREE.BoxGeometry(3.6, 0.5, 0.85), mat(0x8a6a4a), 0, 2.85, 0, visual);
      const hill = mesh(new THREE.ConeGeometry(2.6, 4.2, 7), mat(0x7cb46a), 0, 2.1, -2.3, visual); hill.rotation.y = 0.3;
      mesh(new THREE.ConeGeometry(0.9, 0.9, 7), mat(0xf4f7fb), 0, 3.95, -2.3, visual); // snow cap
      mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), mat(0x4a3828), 0, 4.75, -2.3, visual);
      const flag = mesh(new THREE.PlaneGeometry(0.6, 0.38), mat(0xe83c46, { side: THREE.DoubleSide }), 0.3, 5.1, -2.3, visual); flag.castShadow = false;
      sign(facility.name, root, 3.6);
      solids.push({ x: x - Math.sin(root.rotation.y) * 2.3, z: z - Math.cos(root.rotation.y) * 2.3, r: 2.4 });
      for (const px of [-1.4, 1.4]) solids.push({ x: x + Math.cos(root.rotation.y) * px, z: z - Math.sin(root.rotation.y) * px, r: 0.45 });
    } else if (spot.kind === 'gazebo') { // a small round gazebo with a bench inside
      depth = 2.4;
      for (let k = 0; k < 6; k += 1) { const a = (k * TAU) / 6; mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 8), mat(0xffffff), Math.cos(a) * 1.4, 1.1, Math.sin(a) * 1.4, visual); }
      mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.15, 24), mat(0xe8d8bf), 0, 0.08, 0, visual);
      mesh(new THREE.ConeGeometry(1.95, 1.1, 24), mat(0x7cc4b5), 0, 2.75, 0, visual);
      mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.4, 20), mat(0xc58b5a), 0, 0.35, 0, visual);
      if (!facility.decor) sign(facility.name, root, 3.9);
      solids.push({ x, z, r: 1.7 });
    } else if (spot.kind === 'npc') { // the attendance keeper: a friendly villager next to a stamp stand
      depth = 0.9;
      const npc = makeCharacter({ shirt: 0xffb86b, hair: 0x5b3a29, skin: 0xffdcbc, hat: 0x6bc4a6 });
      npc.root.position.set(-0.7, 0, 0); root.add(npc.root); assets.dress([`character.${facility.id}`, 'character.npc'], npc); npc.root.userData.npc = npc; npc.home = { x, z, yaw: root.rotation.y, id: facility.id };
      mesh(new THREE.BoxGeometry(1.0, 0.95, 0.7), mat(0xc58b5a), 0.7, 0.48, 0, visual);
      mesh(new THREE.BoxGeometry(1.1, 0.08, 0.8), mat(0xffe9b8), 0.7, 0.99, 0, visual);
      mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.16, 16), mat(0xe2574c), 0.7, 1.12, 0, visual);
      sign(facility.name, root, 2.9);
      solids.push({ x, z, r: 1.2 });
      npcs.push(npc);
    } else if (spot.kind === 'stall') { // v1.10.10 상점가 상인: a trader behind a market stall with crates of produce
      depth = 1.3;
      const npc = makeCharacter({ shirt: 0x6bbf73, hair: 0x6b4a2b, skin: 0xffdcbc, hat: 0xf2c14e });
      npc.root.position.set(0, 0, -0.85); root.add(npc.root); assets.dress([`character.${facility.id}`, 'character.npc'], npc); npc.root.userData.npc = npc; npc.home = { x, z, yaw: root.rotation.y, id: facility.id };
      const wood = mat(0xb07a4f);
      mesh(new THREE.BoxGeometry(2.0, 0.9, 0.8), wood, 0, 0.45, 0.1, visual); // the counter
      for (const [lx, color] of [[-0.6, 0x8fd16b], [0, 0xe2574c], [0.6, 0xc9a27a]]) { // herbs, berries, mushrooms
        mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), mat(0xc58b5a), lx, 0.99, 0.1, visual);
        for (let k = 0; k < 4; k += 1) mesh(new THREE.SphereGeometry(0.08, 8, 6), mat(color), lx - 0.12 + (k % 2) * 0.24, 1.12, 0.0 + Math.floor(k / 2) * 0.2, visual);
      }
      for (const px of [-0.95, 0.95]) mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 8), wood, px, 1.15, -0.25, visual);
      for (let k = 0; k < 5; k += 1) { // a striped awning over the stall
        const strip = mesh(new THREE.BoxGeometry(0.42, 0.06, 1.3), mat(k % 2 ? 0xffffff : 0x6bbf73), -0.84 + k * 0.42, 2.25, 0.05, visual);
        strip.rotation.x = 0.22;
      }
      sign(facility.name, root, 3.0);
      solids.push({ ...at(0, 0.1), r: 1.1 }, { ...at(0, -0.85), r: 0.45 });
      npcs.push(npc);
    } else if (spot.kind === 'desk') { // v1.10.9 작명소: a name-giver behind a folding desk set out in the street
      depth = 1.2;
      const npc = makeCharacter({ shirt: 0x3f5f8f, hair: 0xd9d4cc, skin: 0xffdcbc, hat: 0x2b2b2b });
      npc.root.position.set(0, 0, -0.75); root.add(npc.root); assets.dress([`character.${facility.id}`, 'character.npc'], npc); npc.root.userData.npc = npc; npc.home = { x, z, yaw: root.rotation.y, id: facility.id };
      const wood = mat(0xb07a4f);
      mesh(new THREE.BoxGeometry(1.6, 0.07, 0.8), wood, 0, 0.78, 0.1, visual); // the desk top
      for (const [lx, lz] of [[-0.7, -0.22], [0.7, -0.22], [-0.7, 0.42], [0.7, 0.42]]) mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.76, 8), wood, lx, 0.38, lz, visual);
      mesh(new THREE.BoxGeometry(0.62, 0.012, 0.42), mat(0xfffaf0), -0.15, 0.82, 0.15, visual); // a sheet of paper
      mesh(new THREE.BoxGeometry(0.22, 0.05, 0.16), mat(0x2b2b2b), 0.48, 0.835, 0.05, visual); // the ink stone
      const brush = mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.34, 8), mat(0x8a5a3b), 0.25, 0.84, 0.3, visual); brush.rotation.z = Math.PI / 2;
      const pole = mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8), mat(0x8a5a3b), 0.95, 1.1, -0.35, visual);
      pole.castShadow = false;
      const cloth = mesh(new THREE.PlaneGeometry(0.42, 1.1), mat(0xfff3d6, { side: THREE.DoubleSide }), 0.95, 1.5, -0.33, visual); cloth.position.x = 0.73;
      sign(facility.name, root, 2.7);
      solids.push({ ...at(0, 0.1), r: 0.95 }, { ...at(0, -0.75), r: 0.45 });
      npcs.push(npc);
    }
    assets.attach(`facility.${facility.id}`, root, visual, spot.kind === 'mapboard' ? (entry) => mapFace?.(entry) : null);
    const reach = depth / 2 + 1.3;
    const out = Math.max(1.4, reach) + (spot.kind === 'hall' ? 2.6 : 0); // the hall's door point is past its terrace steps
    if (!facility.decor) doors[facility.id] = { x: x + toCentre.x * out, z: z + toCentre.y * out, name: facility.name };
  }

  // v1.10.1: the shop street's reserved lot (외형 변경 시설 comes later): a low fence around levelled ground, no entrance yet.
  for (const lot of RESERVED_LOTS) {
    const g = new THREE.Group(); g.position.set(lot.x, heightAt(lot.x, lot.z), lot.z); g.rotation.y = Math.atan2(lot.face[0] - lot.x, lot.face[1] - lot.z); scene.add(g); g.userData.building = true; buildingRoots.push(g);
    const dirt = mesh(new THREE.BoxGeometry(6.5, 0.06, 5.5), mat(0xd9c49a), 0, 0.03, 0, g); dirt.castShadow = false;
    for (let k = 0; k <= 12; k += 1) {
      const t = k / 12; const px = -3.4 + t * 6.8;
      for (const pz of [-2.9, 2.9]) { if (pz > 0 && Math.abs(px) < 1.2) continue; mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 6), mat(0xc58b5a), px, 0.4, pz, g); }
    }
    for (const pz of [-2.9, 2.9]) for (const side of [-1, 1]) { const rail = mesh(new THREE.BoxGeometry(pz > 0 ? 2.2 : 6.8, 0.08, 0.06), mat(0xc58b5a), pz > 0 ? side * 2.3 : 0, 0.62, pz, g); if (pz < 0 && side > 0) rail.visible = false; }
    for (const [cx, cz] of [[-1.8, -1], [-1.1, -1.4], [2, 0.6]]) mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), mat(0xb98b62), cx, 0.3, cz, g);
    solids.push({ x: lot.x, z: lot.z, r: 3.2 });
  }

  // v1.10.13 생활 마을: the islanders' cottages (island-terrain COTTAGES). A few shared parts in different combinations
  // -- roof kind and pitch, proportions, door place, windows, shutters, chimney, porch, planters, lamp -- so no two are
  // the same house in another colour; each with a mailbox, a short side fence and stepping stones out to the walk.
  // Decoration only: walked around like any building, nothing to open.
  // v1.10.29 접지: stones (and a touch of the season) round a building's plinth, the door side left open
  // (deco.foundation: 3.58 x 2.73, sized to the plinth); decoration only, under the building's own circles
  function footing(parent, w, d) {
    const holder = new THREE.Group(); holder.scale.set(w / 3.58, 1, d / 2.73); parent.add(holder);
    assets.attach('deco.foundation', holder, new THREE.Group());
  }
  const allStones = []; // v1.10.29: every yard's stepping stones, one batch (prop.steppingStone) after the houses
  const FENCE_SEG = 1.35; // v1.10.29: one fence model's length on the island (the 2.25 m model at the entry's scale 0.6)
  const COTTAGE_LOOKS = [
    { w: 3.4, d: 2.8, h: 2.3, wall: 0xfff1d6, roofColor: 0xd9705a, roof: 'gable', rise: 1.15, chimney: 1.0, porch: true, shutters: 0x6aa9e8, planters: true },
    { w: 3.0, d: 3.0, h: 2.2, wall: 0xe8f4e4, roofColor: 0x5f9e7a, roof: 'hip', rise: 1.2, lamp: true, door: -0.55 },
    { w: 3.8, d: 2.6, h: 2.0, wall: 0xf6e0e8, roofColor: 0x8f6fb8, roof: 'front', rise: 1.5, porch: true, planters: true },
    { w: 3.2, d: 2.7, h: 2.6, wall: 0xdcecff, roofColor: 0x4f7fb0, roof: 'gable', rise: 1.0, chimney: -0.9, shutters: 0xffffff, door: 0.5 },
    { w: 2.8, d: 2.6, h: 2.1, wall: 0xfff8e8, roofColor: 0xc9894f, roof: 'front', rise: 1.3, lamp: true, planters: true },
    { w: 3.6, d: 3.0, h: 2.2, wall: 0xf3e4cf, roofColor: 0x7a8f5a, roof: 'hip', rise: 1.1, chimney: 1.0, porch: true, door: -0.6 },
    { w: 3.0, d: 2.6, h: 2.4, wall: 0xffe7d1, roofColor: 0xd96a6a, roof: 'gable', rise: 1.25, shutters: 0x7bbf8a, lamp: true },
    { w: 3.4, d: 2.8, h: 2.3, wall: 0xe4ecf2, roofColor: 0x6a7f99, roof: 'front', rise: 1.4, chimney: -0.8, planters: true, door: 0.55 },
    { w: 3.0, d: 2.8, h: 2.2, wall: 0xfbefd9, roofColor: 0xb5654a, roof: 'hip', rise: 1.0, porch: true, shutters: 0x5f9e7a },
  ];
  for (const c of COTTAGES) {
    const look = COTTAGE_LOOKS[c.style % COTTAGE_LOOKS.length];
    const door = look.door || 0; const side = door > 0 ? -1 : 1; const ww = look.w / 2 - 0.62;
    const windows = door ? [[side * ww, 0.6], [0, 0.55, 'l'], [0, 0.55, 'r'], [0, 0.58, 'b']] : [[-ww, 0.6], [ww, 0.6], [0, 0.55, 'l'], [0, 0.55, 'r']];
    const g = new THREE.Group(); const y0 = heightAt(c.x, c.z); g.position.set(c.x, y0, c.z); g.rotation.y = Math.atan2(c.face[0] - c.x, c.face[1] - c.z); scene.add(g); g.userData.building = true; buildingRoots.push(g);
    const visual = new THREE.Group(); g.add(visual); // v1.10.15: the look only; the solids below stay the house's
    const body = new THREE.Mesh(building({ ...look, windows }), vcMat); body.castShadow = true; body.receiveShadow = true; visual.add(body);
    // the yard: a mailbox by the way out, a short fence along each side, stepping stones to the walk
    const toWalk = Math.hypot(c.face[0] - c.x, c.face[1] - c.z) - 1.6;
    // v1.10.29: the house model replaces only the house (`visual`); the yard stays, and each fence run is a row of
    // fence models (prop.fence) -- segments of about FENCE_SEG, stretched a little to fill the run exactly
    // the mailbox is its own model too (prop.mailbox.<0 blue | 1 red>, the procedural one's colour)
    if (!look.planters) { const yardMesh = new THREE.Mesh(props([['planter', -look.w / 2 + 0.2, look.d / 2 + 0.9, 0, c.style]]), vcMat); yardMesh.castShadow = true; yardMesh.receiveShadow = true; g.add(yardMesh); }
    const box = new THREE.Group(); box.position.set(look.w / 2 + 0.5, 0, look.d / 2 + 1.5); g.add(box);
    const boxLook = new THREE.Mesh(props([['mailbox', 0, 0, 0, c.style % 2]]), vcMat); boxLook.castShadow = true; box.add(boxLook);
    assets.attach(`prop.mailbox.${c.style % 2}`, box, boxLook);
    footing(g, look.w + 0.6, look.d + 0.6);
    for (const [fx, fz, len] of [[-look.w / 2 - 0.9, 0.4, look.d + 1.6], [look.w / 2 + 0.9, -0.6, look.d - 0.4]]) {
      const n = Math.max(1, Math.round(len / FENCE_SEG)); const stretch = len / n / FENCE_SEG;
      for (let k = 0; k < n; k += 1) {
        const seg = new THREE.Group(); seg.position.set(fx, 0, fz - len / 2 + ((k + 0.5) * len) / n); seg.rotation.y = Math.PI / 2; seg.scale.x = stretch; g.add(seg);
        const look2 = new THREE.Mesh(props([['fence', 0, 0, 0, FENCE_SEG]]), vcMat); look2.castShadow = true; look2.receiveShadow = true; seg.add(look2);
        assets.attach('prop.fence', seg, look2);
      }
    }
    for (let z = look.d / 2 + 0.95; z < toWalk; z += 0.8) {
      const lx = door + Math.sin(z * 3.1) * 0.12;
      const wx = c.x + Math.sin(g.rotation.y) * z + Math.cos(g.rotation.y) * lx; const wz = c.z + Math.cos(g.rotation.y) * z - Math.sin(g.rotation.y) * lx;
      allStones.push({ x: wx, z: wz, y: heightAt(wx, wz) + 0.03, ry: g.rotation.y + z });
    }
    assets.attach([`cottage.${c.style % COTTAGE_LOOKS.length}`, 'cottage'], g, visual);
    // walked around: the house, the two fences and the mailbox
    const local = (lx, lz) => ({ x: c.x + Math.cos(g.rotation.y) * lx + Math.sin(g.rotation.y) * lz, z: c.z - Math.sin(g.rotation.y) * lx + Math.cos(g.rotation.y) * lz });
    for (let lx = -look.w / 2 + 0.7; lx <= look.w / 2 - 0.69; lx += 0.75) for (let lz = -look.d / 2 + 0.7; lz <= look.d / 2 - 0.69; lz += 0.75) solids.push({ ...local(lx, lz), r: 0.95 });
    for (const [fx, z0, len] of [[-look.w / 2 - 0.9, 0.4 - (look.d + 1.6) / 2, look.d + 1.6], [look.w / 2 + 0.9, -0.6 - (look.d - 0.4) / 2, look.d - 0.4]]) for (let t = 0; t <= len; t += 0.6) solids.push({ ...local(fx, z0 + t), r: 0.22 });
    solids.push({ ...local(look.w / 2 + 0.5, look.d / 2 + 1.5), r: 0.3 });
  }

  { // v1.10.29: the yards' stepping stones, one instanced batch (each stone placed and turned; the model replaces them)
    const geo = mergeColored([part(STONE, 0xddd5c6, 0, 0, 0, { sx: 0.62, sy: 0.08, sz: 0.5 })]);
    const im = new THREE.InstancedMesh(geo, vcMat, allStones.length); const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const up = new THREE.Vector3(0, 1, 0); const one = new THREE.Vector3(1, 1, 1);
    const matrices = allStones.map((st, i) => { m.compose(new THREE.Vector3(st.x, st.y, st.z), q.setFromAxisAngle(up, st.ry), one); im.setMatrixAt(i, m); return m.clone(); });
    im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im);
    if (allStones.length) assets.batch('prop.steppingStone', [{ x: 0, z: 0, parent: scene, procedural: [im], matrices, colors: null, shadow: false }]);
  }
  assets.ambient(scene); // v1.10.29 the seasonal falling flakes round me

  const buildingSolids = solids.slice(firstBuildingSolid); // facilities, keepers' stands, the reserved lot, the houses
  // v1.10.5 기부 동상: last week's 1st (gold) and 2nd (silver) donors stand on the two plinths, in the look they had
  // when the week closed, with a small plate. Rebuilt only when the server sends a different pair.
  let statueList = []; let statueKey = '[]'; const statueRoots = [];
  function setStatues(list) {
    const next = (Array.isArray(list) ? list : []).filter((s) => s && (s.rank === 1 || s.rank === 2)).slice(0, 2);
    const key = JSON.stringify(next.map(({ rank, name, look, title }) => [rank, name, look, title]));
    if (key === statueKey) return;
    statueKey = key; statueList = next;
    for (const r of statueRoots.splice(0)) { r.traverse((o) => { if (o.isMesh) o.geometry.dispose(); if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } }); r.parent?.remove(r); }
    for (const st of next) {
      const spot = STATUE_SPOTS[st.rank - 1]; if (!spot) continue;
      const c = makeCharacter({ shirt: 0xffffff, hair: 0xffffff, skin: 0xffffff, look: st.look || {} });
      const metal = mat(st.rank === 1 ? 0xf3c64a : 0xc9d1dc, { metalness: 0.75, roughness: 0.3 });
      c.root.traverse((o) => { if (o.isMesh) o.material = metal; });
      c.root.position.set(spot.x, PH + 1.4, spot.z); c.root.rotation.y = Math.atan2(-spot.x, -spot.z) + 0.35; c.root.scale.setScalar(1.15);
      c.armR.rotation.z = 2.4; // a wave, frozen
      scene.add(c.root); statueRoots.push(c.root);
      const plate = makeTag(`${st.rank}위 ${st.name}`, null); plate.position.set(spot.x, PH + 4.08, spot.z); scene.add(plate); statueRoots.push(plate);
    }
  }

  // The player's character: a big head on a short body.
  const ME_BASE = { shirt: 0x7cb8ff, hair: 0x4a3326, skin: 0xffe0c4 };
  let me = makeCharacter(ME_BASE);
  me.root.position.set(SPAWN.x + (Math.random() - 0.5) * 3, 0, SPAWN.z + Math.random() * 0.8); // the plaza, a little apart from whoever arrived just before
  me.root.position.y = heightAt(me.root.position.x, me.root.position.z);
  scene.add(me.root); assets.dress('character.player', me);
  // v1.9.2: wear an avatar look and show a name tag; the character is rebuilt in place (position and facing kept).
  function setAvatar({ look = {}, name = '', title = null, champion = false, hoguking = false } = {}) {
    const old = me; me = makeCharacter({ ...ME_BASE, look });
    me.root.position.copy(old.root.position); me.root.rotation.y = old.root.rotation.y; me.targetYaw = old.targetYaw;
    disposeCharacter(old); scene.add(me.root); assets.dress('character.player', me);
    if (name) { me.tag = makeTag(name, title, champion, hoguking); me.tag.position.y = TAG_Y; me.root.add(me.tag); }
    me.look = look; me.title = title; me.champion = Boolean(champion); me.hoguking = Boolean(hoguking);
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
      const key = JSON.stringify([p.look || {}, p.name, p.title || null, Boolean(p.champion), Boolean(p.hoguking)]);
      let o = others.get(p.id);
      if (o && o.key !== key) { // a new look or title: rebuild in place
        const pos = o.c.root.position.clone(); const yaw = o.c.root.rotation.y; disposeCharacter(o.c);
        o.c = makeCharacter({ ...OTHER_BASE, look: p.look || {} }); o.c.root.position.copy(pos); o.c.root.rotation.y = yaw; o.key = key;
        o.c.tag = makeTag(p.name || '', p.title || null, p.champion, p.hoguking); o.c.tag.position.y = TAG_Y; o.c.root.add(o.c.tag); scene.add(o.c.root); assets.dress('character.player', o.c);
      }
      if (!o) {
        const c = makeCharacter({ ...OTHER_BASE, look: p.look || {} });
        c.root.position.set(p.x, heightAt(p.x, p.z), p.z); c.root.rotation.y = p.yaw;
        c.tag = makeTag(p.name || '', p.title || null, p.champion, p.hoguking); c.tag.position.y = TAG_Y; c.root.add(c.tag); scene.add(c.root); assets.dress('character.player', c);
        o = { c, key, champion: Boolean(p.champion), track: createTrack(), follow: createFollower({ maxSpeed: SPEED * 1.6 }) }; others.set(p.id, o);
      }
      // v1.10.8: every pose goes into their track (stamped with the server time it was taken); the newest one and its
      // walking speed also feed my collision's look-ahead (v1.9.9)
      const now = performance.now();
      if (o.track.push({ t: p.t, x: p.x, z: p.z, yaw: p.yaw, moving: Boolean(p.moving) }, now)) {
        const latest = o.track.latest(); o.vel = latest.vel;
        const speed = Math.hypot(o.vel.x, o.vel.z); if (speed > SPEED * 1.3) { o.vel.x *= (SPEED * 1.3) / speed; o.vel.z *= (SPEED * 1.3) / speed; }
        o.target = { x: p.x, z: p.z, yaw: p.yaw, moving: Boolean(p.moving) }; o.targetAt = now;
      }
      o.champion = Boolean(p.champion); o.hoguking = Boolean(p.hoguking); o.look = p.look || {};
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
    const now = performance.now();
    for (const o of others.values()) {
      // v1.10.8: drawn a little in the past between two real poses (even speed however the updates arrive), walking
      // on through a short gap, a changed path blended in by how far off it is, a warp at once (remote-motion.js)
      const p = o.c.root.position; const at = o.track.at(now); const f = o.follow;
      if (!at) continue;
      f.step(at, dt);
      const warped = Math.hypot(f.x - p.x, f.z - p.z) > 6;
      p.x = f.x; p.z = f.z;
      // v1.9.9: their glide never sinks into my character (the server already keeps the real positions apart; a late
      // snapshot would otherwise draw them inside me for a moment). Moving apart is never held back.
      const m = me.root.position; const dx = p.x - m.x; const dz = p.z - m.z; const d = Math.hypot(dx, dz);
      const min = playerRadiusAt(m.x, m.z) + playerRadiusAt(p.x, p.z);
      if (!warped && d < min && d < o.drawnGap - 1e-4) {
        const ux = d > 1e-4 ? dx / d : 0; const uz = d > 1e-4 ? dz / d : 1; const keep = Math.min(min, o.drawnGap);
        p.x = m.x + ux * keep; p.z = m.z + uz * keep; f.nudge(p.x, p.z);
      }
      o.drawnGap = Math.hypot(p.x - m.x, p.z - m.z);
      p.y = heightAt(p.x, p.z);
      // facing: the way they are drawn walking, and the server's facing once they stand
      o.c.targetYaw = f.speed > 0.8 && f.heading != null ? f.heading : at.yaw;
      animate(o.c, dt, f.speed > 0.4, f.speed);
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
    if (look.gender === 'female') { // v1.10.3: the chosen base body; avatar items still replace hair and clothes
      if (!look.outfit) { parts.setShirt(0xff9fbf); mesh(new THREE.ConeGeometry(0.46, 0.42, 18, 1, true), mat(0xf26d9a, { side: THREE.DoubleSide }), 0, 0.52, 0, body); }
      if (!look.hair) {
        const back = mesh(new THREE.SphereGeometry(0.5, 20, 14), mat(hair), 0, -0.2, -0.26, head); back.scale.set(1.06, 1.2, 0.62);
        for (const s of [-1, 1]) { const lock = mesh(new THREE.CapsuleGeometry(0.12, 0.42, 6, 10), mat(hair), s * 0.48, -0.32, -0.04, head); lock.rotation.z = s * 0.12; }
      }
    }
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
    // v1.10.21: W/A/S/D turn the camera (the physical keys, so a Korean input mode works too); the arrows still walk
    if (CAM_KEYS.has(event.code) && !event.ctrlKey && !event.metaKey && !event.altKey) { camKeys.add(event.code); event.preventDefault(); return; }
    if (event.code === 'Space' && (event.target === document.body || host.contains(event.target))) {
      event.preventDefault();
      if (!event.repeat && near) interact(near);
    }
  };
  const onKeyUp = (event) => { keys.delete(event.key); camKeys.delete(event.code); };
  const onBlur = () => { keys.clear(); camKeys.clear(); };
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
  // v1.10.21 카메라 회전 확장 (IDEAS 2026-10-05): the camera turns round my character (yaw) and tilts a little (pitch)
  // -- mouse drag and W/A/S/D move one shared goal, and what is drawn eases toward it, so switching between them never
  // jumps. Pitch is 0 at the default quarter view, + from higher up, held within ±PITCH_MAX (never straight down, never
  // level with the ground). A held key turns at a speed that builds up over CAM_RAMP seconds and stops on release.
  const CAM_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']); const camKeys = new Set();
  const PITCH_MAX = (15 * Math.PI) / 180; const DRAG_PITCH = 0.004; // radians per pixel up or down
  const YAW_SPEED = 1.9; const PITCH_SPEED = 0.55; const CAM_RAMP = 0.25; // radians per second at full speed
  let camPitch = 0; let yawGoal = 0; let pitchGoal = 0; let camHeld = 0; let camDt = 0;
  const clampPitch = (v) => Math.max(-PITCH_MAX, Math.min(PITCH_MAX, v));
  function turnCamera(dt) {
    if (camKeys.size && !isBlocked()) {
      camHeld = Math.min(CAM_RAMP, camHeld + dt); const speed = 0.35 + (0.65 * camHeld) / CAM_RAMP;
      if (camKeys.has('KeyA')) yawGoal += YAW_SPEED * speed * dt; // A turns like dragging left, D like dragging right
      if (camKeys.has('KeyD')) yawGoal -= YAW_SPEED * speed * dt;
      if (camKeys.has('KeyW')) pitchGoal += PITCH_SPEED * speed * dt; // W: from higher up, like dragging up
      if (camKeys.has('KeyS')) pitchGoal -= PITCH_SPEED * speed * dt;
    } else { camHeld = 0; if (isBlocked()) camKeys.clear(); }
    pitchGoal = clampPitch(pitchGoal);
    const ease = 1 - Math.exp(-dt * 14);
    camYaw += (yawGoal - camYaw) * ease; camPitch = clampPitch(camPitch + (pitchGoal - camPitch) * ease);
  }
  const onDown = (event) => { if (event.button !== 0) return; drag = { x: event.clientX, y: event.clientY, id: event.pointerId }; dragged = false; };
  const onClick = (event) => { if (dragged) { dragged = false; return; } if (isBlocked()) return; const id = facilityAt(event); if (id) interact(id); };
  const onMove = (event) => {
    if (drag && drag.id === event.pointerId && !isBlocked()) {
      const dx = event.clientX - drag.x;
      if (!dragged && Math.hypot(dx, event.clientY - drag.y) >= DRAG_START) { dragged = true; renderer.domElement.setPointerCapture?.(event.pointerId); }
      if (dragged) {
        yawGoal -= (event.clientX - (drag.lastX ?? drag.x)) * DRAG_TURN; drag.lastX = event.clientX;
        pitchGoal = clampPitch(pitchGoal - (event.clientY - (drag.lastY ?? drag.y)) * DRAG_PITCH); drag.lastY = event.clientY; // dragging up: from higher up
        renderer.domElement.style.cursor = 'grabbing'; return;
      }
    }
    renderer.domElement.style.cursor = !isBlocked() && facilityAt(event) ? 'pointer' : 'grab';
  };
  const onUp = (event) => { if (drag?.id === event.pointerId) { drag = null; renderer.domElement.style.cursor = 'grab'; } };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);
  renderer.domElement.addEventListener('pointercancel', onUp);
  renderer.domElement.addEventListener('click', onClick);
  renderer.domElement.addEventListener('pointermove', onMove);

  // v1.10.11 공용 이벤트: what the server says lies near me -- a small object (or an NPC) at each, a short 「SPACE · 줍기」
  // when I stand by it, a click on it does the same, and a 「!」 on the minimap. Keys: `ev:<kind>:<id>`.
  const eventDoors = {}; // key -> { x, z, name } (only what I can act on)
  const eventObjs = new Map(); // key -> { root, npc }
  const EVENT_REACH = 1.9;
  function eventModel(kind, root) {
    const add = (geo, color, x, y, z, extra) => mesh(geo, mat(color, extra), x, y, z, root);
    if (kind === 'beach_trash' || kind === 'grass_trash') {
      const can = add(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 10), 0xc9d1d9, 0, 0.1, 0); can.rotation.z = Math.PI / 2;
      add(new THREE.DodecahedronGeometry(0.14), 0xf3f0e8, 0.25, 0.1, 0.15);
      const bottle = add(new THREE.CylinderGeometry(0.06, 0.08, 0.32, 10), kind === 'beach_trash' ? 0x6fc3a8 : 0x9aa5b1, -0.22, 0.08, -0.1); bottle.rotation.set(Math.PI / 2, 0, 0.6);
    } else if (kind === 'herb') {
      for (let k = 0; k < 5; k += 1) { const leaf = add(new THREE.ConeGeometry(0.06, 0.42, 5), 0x4fbf6a, Math.cos(k * 1.26) * 0.09, 0.2, Math.sin(k * 1.26) * 0.09); leaf.rotation.set(Math.sin(k) * 0.4, 0, Math.cos(k) * 0.4); }
      add(new THREE.SphereGeometry(0.07, 10, 8), 0xd9fbe4, 0, 0.45, 0, { emissive: 0x8ff0b0, emissiveIntensity: 0.8 });
    } else if (kind === 'berry') {
      add(new THREE.SphereGeometry(0.32, 8, 6), 0x5aa94f, 0, 0.3, 0);
      for (let k = 0; k < 7; k += 1) add(new THREE.SphereGeometry(0.07, 8, 6), 0xd83a4a, Math.cos(k) * 0.26, 0.3 + Math.sin(k * 2) * 0.12, Math.sin(k) * 0.26);
    } else if (kind === 'mushroom') {
      for (const [mx, mz, s] of [[0, 0, 1], [0.22, 0.12, 0.7], [-0.18, 0.15, 0.6]]) {
        add(new THREE.CylinderGeometry(0.04 * s, 0.05 * s, 0.18 * s, 8), 0xf6efe0, mx, 0.09 * s, mz);
        add(new THREE.SphereGeometry(0.13 * s, 12, 8, 0, TAU, 0, Math.PI / 2), 0xd8453a, mx, 0.17 * s, mz);
      }
    } else if (kind === 'coin') {
      const coin = add(new THREE.CylinderGeometry(0.16, 0.16, 0.035, 18), 0xf6c945, 0, 0.35, 0, { metalness: 0.6, roughness: 0.3, emissive: 0x6b4d00, emissiveIntensity: 0.25 });
      coin.rotation.x = Math.PI / 2; root.userData.spin = coin;
    } else if (kind === 'wallet') {
      add(new THREE.BoxGeometry(0.34, 0.06, 0.24), 0x7a4b2a, 0, 0.04, 0);
      add(new THREE.BoxGeometry(0.34, 0.02, 0.1), 0x5e3920, 0, 0.08, 0.07);
    } else if (kind === 'lost_item') { // a little teddy bear
      add(new THREE.SphereGeometry(0.16, 12, 10), 0xc68a55, 0, 0.16, 0);
      add(new THREE.SphereGeometry(0.12, 12, 10), 0xc68a55, 0, 0.38, 0);
      for (const ex of [-0.08, 0.08]) add(new THREE.SphereGeometry(0.045, 8, 6), 0xa86f3f, ex, 0.48, 0);
    }
  }
  function setEvents(list) {
    const seen = new Set();
    for (const ev of list || []) {
      if (!ev?.id || !Number.isFinite(ev.x) || !Number.isFinite(ev.z)) continue;
      const key = `ev:${ev.kind}:${ev.id}`; seen.add(key);
      if (!eventObjs.has(key)) {
        const root = new THREE.Group(); root.position.set(ev.x, heightAt(ev.x, ev.z), ev.z); root.rotation.y = (ev.x * 7 + ev.z * 3) % TAU; scene.add(root);
        let npc = null;
        if (ev.kind === 'photo' || ev.kind === 'lost_owner') { // a visitor: a tourist with a camera, or someone who lost something
          npc = makeCharacter(ev.kind === 'photo' ? { shirt: 0xffd166, hair: 0x2b2b2b, skin: 0xffdcbc, hat: 0xff8a5c } : { shirt: 0x9ad0ff, hair: 0x8b5a2b, skin: 0xffe0c4 });
          root.add(npc.root); npc.home = { x: ev.x, z: ev.z, yaw: root.rotation.y, id: key }; assets.dress(['character.visitor', 'character.islander'], npc);
          if (ev.kind === 'photo') mesh(new THREE.BoxGeometry(0.26, 0.18, 0.12), mat(0x2b2b2b), 0.32, 1.05, 0.28, root);
          npc.tag = makeTag(ev.kind === 'photo' ? '📷' : '?', null); npc.tag.scale.multiplyScalar(0.7); npc.tag.position.y = 2.44; npc.root.add(npc.tag); // what they want, at a glance
          npcs.push(npc);
        } else { eventModel(ev.kind, root); root.traverse((m) => { if (m.isMesh) m.castShadow = false; }); } // small props: no shadow to draw
        root.userData.facility = key; facilityRoots.push(root);
        eventObjs.set(key, { root, npc });
      }
      if (ev.verb) eventDoors[key] = { x: ev.x, z: ev.z, name: ev.verb }; else delete eventDoors[key];
    }
    for (const [key, o] of eventObjs) {
      if (seen.has(key)) continue;
      scene.remove(o.root); facilityRoots.splice(facilityRoots.indexOf(o.root), 1);
      if (o.npc) { npcs.splice(npcs.indexOf(o.npc), 1); disposeCharacter(o.npc); }
      o.root.traverse((m) => { if (m.isMesh) m.geometry.dispose(); });
      eventObjs.delete(key); delete eventDoors[key];
    }
    mapMarkers = [...eventObjs.keys()].filter((key) => eventDoors[key] || key.startsWith('ev:lost_item:')).map((key) => ({ x: eventObjs.get(key).root.position.x, z: eventObjs.get(key).root.position.z }));
    minimapAt = 0;
  }
  const doorOf = (id) => doors[id] || eventDoors[id];

  // v1.10.12 배회 NPC: islanders strolling between stopping places on the walks. Where each is comes from the shared
  // round (island-npcs.js) at the server's clock, so every screen agrees and nothing is sent; the drawing goes through
  // the same follower as other people (remote-motion.js), which also lets one step around me instead of through me.
  const wanderers = []; // { n, c, w } -- w: the islander's walker state (island-npcs.js createWalkers)
  let walkers = null;
  let serverOffset = 0; let clockRtt = Infinity; // server ms minus my ms, from the quickest answer seen
  function setServerTime(serverMs, sentAt, receivedAt) {
    const rtt = receivedAt - sentAt;
    if (!Number.isFinite(serverMs) || rtt < 0 || rtt > clockRtt * 1.5 + 50) return;
    clockRtt = Math.min(clockRtt, rtt); serverOffset = serverMs + rtt / 2 - receivedAt;
  }
  const wanderersTimer = setTimeout(() => { // after the first frames: the islanders' map takes a moment to work out
    if (!IslandNpcs) return;
    // v1.10.16: walked through the scene's own collision circles and ground (the route grid is only the long plan)
    walkers = IslandNpcs.createWalkers({ walkable, solidsNear });
    for (let n = 0; n < IslandNpcs.COUNT; n += 1) {
      const r = IslandNpcs.round(n);
      const c = makeCharacter(r.look); c.groundedWalk = true;
      // starts where its round has it now, not at the origin walking over to it
      const w = walkers.add(n, Date.now() + serverOffset);
      c.root.position.set(w.x, heightAt(w.x, w.z), w.z);
      scene.add(c.root); assets.dress('character.islander', c);
      wanderers.push({ n, c, w });
    }
  }, 400);
  function stepWanderers(dt) {
    if (!walkers) return;
    const m = me.root.position;
    // v1.10.16: the shared round, stepped around solids, each other and people (island-npcs.js createWalkers): me,
    // other players and event visitors are circles to give way to
    const people = [{ x: m.x, z: m.z, r: playerRadiusAt(m.x, m.z) }];
    for (const o of others.values()) people.push({ x: o.c.root.position.x, z: o.c.root.position.z, r: playerRadiusAt(o.c.root.position.x, o.c.root.position.z) });
    for (const o of eventObjs.values()) if (o.npc) people.push({ x: o.root.position.x, z: o.root.position.z, r: PLAYER_R });
    walkers.step(Date.now() + serverOffset, dt, people);
    for (const { c, w } of wanderers) {
      c.root.position.set(w.x, heightAt(w.x, w.z), w.z); // the exact ground (slopes, bridge decks) every frame
      c.root.visible = Math.hypot(w.x - m.x, w.z - m.z) < 85;
      if (!c.root.visible) continue;
      c.targetYaw = w.speed > 0.4 && w.heading != null ? w.heading : w.pose.yaw;
      c.lookAt = w.pose.moving ? null : Math.sin(clock * 0.35 + w.n * 1.7) * 0.6; // standing: looking about
      animate(c, dt, w.speed > 0.3, w.speed);
    }
  }

  let near = null; let nearName = null;
  function interact(id) {
    keys.clear();
    const door = doorOf(id);
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
    for (const o of eventObjs.values()) if (o.npc) out.push({ x: o.root.position.x, z: o.root.position.z, r: PLAYER_R }); // v1.10.11: event NPCs stand like people
    for (const { c, w } of wanderers) if (c.root.visible && playerRadiusAt(w.x, w.z) === PLAYER_R) out.push({ x: w.x, z: w.z, r: PLAYER_R }); // v1.10.12: and the islanders (never at a door: an islander passing by never blocks an entrance)
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
  // v1.10.16: each circle is listed in every cell from which a character (radius up to 0.5) could touch it -- listed
  // only where the circle itself lies, one standing just across a cell edge from it was not checked against it.
  const GRID = 8; const grid = new Map();
  for (const s of solids) {
    const reach = s.r + 0.5;
    for (let gx = Math.floor((s.x - reach) / GRID); gx <= Math.floor((s.x + reach) / GRID); gx += 1) {
      for (let gz = Math.floor((s.z - reach) / GRID); gz <= Math.floor((s.z + reach) / GRID); gz += 1) {
        const key = `${gx},${gz}`; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(s);
      }
    }
  }
  const solidsNear = (x, z) => grid.get(`${Math.floor(x / GRID)},${Math.floor(z / GRID)}`) || [];
  const pushOutRadius = (nx, nz, radius) => {
    // A move can be inside two nearby circles (for example a fence next to a tree), so settle a few times.
    for (let pass = 0; pass < 3; pass += 1) {
      let changed = false;
      for (const s of solidsNear(nx, nz)) {
        let dx = nx - s.x; let dz = nz - s.z; let dist = Math.hypot(dx, dz); const min = s.r + radius;
        if (dist >= min) continue;
        if (dist < 1e-6) { dx = 1; dz = 0; dist = 1; }
        nx = s.x + (dx / dist) * min; nz = s.z + (dz / dist) * min; changed = true;
      }
      if (!changed) break;
    }
    return [nx, nz];
  };
  const pushOut = (nx, nz) => pushOutRadius(nx, nz, PLAYER_R);

  // v1.10.7 당일 위치: today's last spot from the server (already on standable ground there); out of a tree, a lamp or
  // a building it may have been put into since, and the plaza if that still leaves it somewhere one cannot stand.
  if (startAt && Number.isFinite(startAt.x) && Number.isFinite(startAt.z)) {
    const [sx, sz] = pushOut(startAt.x, startAt.z);
    if (walkable(sx, sz)) me.root.position.set(sx, heightAt(sx, sz), sz);
  }
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
  const CAM_DIST = Math.hypot(OFFSET.y, OFFSET.z); const CAM_ELEV = Math.atan2(OFFSET.y, OFFSET.z); // the default view: 13.1 away, 34.4° up
  const CAM_MIN = 4; const CAM_CLEAR = 1.0; const CAM_OVER = 7.5; let camDist = CAM_DIST;
  function placeCamera(snap) {
    const p = me.root.position;
    scene.fog.far = overview ? 2000 : 175; if (camera.far !== (overview ? 600 : VIEW_FAR)) { camera.far = overview ? 600 : VIEW_FAR; camera.updateProjectionMatrix(); }
    if (overview) { camera.position.set(0, 230, 40); camera.lookAt(0, 0, 0); return; }
    const sin = Math.sin(camYaw); const cos = Math.cos(camYaw); // the low quarter view, turned by dragging (v1.10.2)
    // v1.10.21: tilted by camPitch around the same distance; pulled in toward me while the camera would stand inside a
    // building or house (never closer than CAM_MIN) -- and if even that is inside one (my back to a big building's
    // front), lifted to CAM_OVER above me, over its walls; always at least CAM_CLEAR above the ground under it
    const elev = CAM_ELEV + camPitch; const at = (d) => ({ x: p.x + sin * Math.cos(elev) * d, z: p.z + cos * Math.cos(elev) * d });
    const inside = (c) => buildingSolids.some((s) => Math.hypot(c.x - s.x, c.z - s.z) < s.r + 0.6);
    let dist = CAM_DIST;
    while (dist > CAM_MIN && inside(at(dist))) dist -= 0.5;
    camDist = snap ? dist : camDist + (dist - camDist) * (dist < camDist ? 0.25 : 0.05); // in quickly, back out gently
    const c = at(camDist); const over = inside(c) ? p.y + CAM_OVER : -Infinity;
    const want = new THREE.Vector3(c.x, Math.max(p.y + Math.sin(elev) * camDist, heightAt(c.x, c.z) + CAM_CLEAR, over), c.z); // v1.10.0: follow the player across the island
    const look = new THREE.Vector3(p.x - sin * 2.4, p.y + 1.3, p.z - cos * 2.4);
    if (snap) { camPos.copy(want); camLook.copy(look); } else { camPos.lerp(want, 0.08); camLook.lerp(look, 0.1); }
    camPos.y = Math.max(camPos.y, heightAt(camPos.x, camPos.z) + CAM_CLEAR); // easing never dips it into a slope either
    camera.position.copy(camPos); camera.lookAt(camLook);
    fadeInWay(p);
  }
  // v1.10.21: a building or house between the camera and me is drawn see-through, so no view loses my character
  const sightRay = new THREE.Raycaster(); sightRay.camera = camera;
  const sightDir = new THREE.Vector3(); const ghosts = new Map(); let faded = new Set();
  const ghost = (m) => { let g = ghosts.get(m); if (!g) { g = m.clone(); g.transparent = true; g.opacity = 0.3; g.depthWrite = false; ghosts.set(m, g); } return g; };
  const swapGhost = (o, on) => {
    if (!o.isMesh) return;
    if (on && !o.userData.solidMat) { o.userData.solidMat = o.material; o.material = Array.isArray(o.material) ? o.material.map(ghost) : ghost(o.material); }
    if (!on && o.userData.solidMat) { o.material = o.userData.solidMat; delete o.userData.solidMat; }
  };
  function fadeInWay(p) {
    sightDir.set(p.x, p.y + 1.0, p.z).sub(camera.position); const far = sightDir.length();
    sightRay.set(camera.position, sightDir.normalize()); sightRay.far = far;
    const now = new Set();
    for (const hit of sightRay.intersectObjects(buildingRoots.filter((r) => r.position.distanceToSquared(p) < 900), true)) {
      if (hit.object.isSprite) continue; // a sign alone hides nothing
      let o = hit.object; while (o.parent && !o.userData.building) o = o.parent;
      now.add(o);
    }
    for (const r of faded) if (!now.has(r)) r.traverse((o) => swapGhost(o, false));
    for (const r of now) r.traverse((o) => swapGhost(o, true)); // every frame, so a model attached meanwhile fades too
    faded = now;
  }

  let running = false; let raf = 0; let last = 0; let clock = 0;
  let seasonCheckedAt = -Infinity; let seasonOverride = null; // tests may hold a season day (debug().setSeasonDay)
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const real = (now - (last || now)) / 1000; const dt = Math.min(0.05, real); last = now; clock += dt;
    camDt = Math.min(0.25, real); // v1.10.21: turning keeps to the clock on a slow PC (the animation step is capped)
    step(dt);
    renderer.render(scene, camera);
    adaptQuality(Math.min(real, 1)); // real time, so a very slow PC steps down after 3 seconds, not 3 seconds of capped frames
  }
  // A slow PC steps the picture down instead of stuttering: first a lower pixel ratio, then no shadows.
  // v1.10.15 tiers: 2 high (pixel ratio up to 1.5, shadows, registered LOD distances), 1 medium (pixel ratio 1, LOD
  // switches nearer), 0 low (no shadows, nearer still) -- the model LOD part is asset-pipeline.js `lodDistance`.
  let quality = 2; let slowTime = 0; let sampled = 0; let qualityHeld = false; // tests may hold a tier (debug().holdQuality)
  function adaptQuality(dt) {
    if (quality === 0 || qualityHeld) return;
    sampled += dt; slowTime += dt > 1 / 35 ? dt : 0;
    if (sampled < 3) return;
    if (slowTime / sampled > 0.5) {
      quality -= 1;
      if (quality === 1) renderer.setPixelRatio(1);
      else { renderer.shadowMap.enabled = false; sun.castShadow = false; mats.forEach((m) => { m.needsUpdate = true; }); }
      assets.setQuality(quality);
      resize();
    }
    sampled = 0; slowTime = 0;
  }
  // v1.10.29 고래 (해상 풍경 결정 2026-10-05): now and then -- every WHALE_EVERY seconds or so -- a whale breaches once
  // out at sea in front of me (sea.whale, BreachOnce: up out of the water, over and down, then gone), with a splash
  // (sea.splash, SplashOnce) where it breaks the surface and where it falls back. Only on open sea well off the coast,
  // the harbour and the breakwater; nothing to interact with. Tests can call one now (debug().whale()).
  const WHALE_EVERY = [55, 120]; const SEA_Y = -0.6; let whaleAt = 40 + Math.random() * 40;
  function whale(force = false) {
    const T = globalThis.IslandTerrain; const p = me.root.position;
    for (let k = 0; k < 16; k += 1) {
      const a = camYaw + Math.PI + (Math.random() - 0.5) * 1.3; const d = 22 + Math.random() * 23; // in front of the camera, close enough to be in the picture
      const x = p.x + Math.sin(a) * d; const z = p.z + Math.cos(a) * d;
      if (T.coastDist(x, z) > -14 || Math.hypot(x - T.PIER.x, z - T.PIER.z) < 25 || Math.hypot(x - T.BREAKWATER.x, z - T.BREAKWATER.z) < 25) continue;
      const splash = (at) => assets.once('sea.splash', { parent: scene, x: at.x, y: SEA_Y, z: at.z });
      assets.once('sea.whale', { parent: scene, x, y: SEA_Y, z, ry: Math.random() * TAU }, { onCross: splash });
      return true;
    }
    return false;
  }
  function stepWhale() {
    if (clock < whaleAt) return;
    whaleAt = clock + WHALE_EVERY[0] + Math.random() * (WHALE_EVERY[1] - WHALE_EVERY[0]);
    if (quality > 0 && !overview) whale();
  }
  function step(dt) {
    let ix = 0; let iz = 0;
    if (!isBlocked()) {
      if (keys.has('ArrowLeft')) ix -= 1; if (keys.has('ArrowRight')) ix += 1;
      if (keys.has('ArrowUp')) iz -= 1; if (keys.has('ArrowDown')) iz += 1;
    } else keys.clear();
    turnCamera(camDt); // v1.10.21
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
    stepWanderers(dt);
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
    for (const [id, door] of Object.entries(eventDoors)) { // v1.10.11: an event right by me comes first
      const d = Math.hypot(door.x - me.root.position.x, door.z - me.root.position.z);
      if (d < EVENT_REACH && d < bestD + 1) { best = id; bestD = d - 1; }
    }
    if (best !== near || (best && doorOf(best)?.name !== nearName)) { near = best; nearName = near ? doorOf(near).name : null; onNear?.(near ? { id: near, name: nearName } : null); }
    me.lookAt = near ? Math.atan2(doorOf(near).x - me.root.position.x, doorOf(near).z - me.root.position.z) : null;
    for (const o of eventObjs.values()) { const spin = o.root.userData.spin; if (spin) { spin.rotation.z = clock * 2.4; spin.position.y = 0.35 + Math.sin(clock * 2) * 0.05; } }
    sun.position.set(me.root.position.x - 9, me.root.position.y + 18, me.root.position.z + 8); sun.target.position.copy(me.root.position);
    assets.update(me.root.position.x, me.root.position.z); // v1.10.17: near squares of registered nature show their model
    assets.tick(dt, me.root.position.x, me.root.position.z); // v1.10.29: one-off clips (the whale) and the falling flakes
    stepWhale();
    // v1.10.27: the season day by the server clock, checked every few seconds -- at 00:00 KST every season moves one zone
    // clockwise and the models swap in place for whoever is on the island (their files are already in the resource cache)
    if (clock - seasonCheckedAt > 2 && seasonOverride === null) { seasonCheckedAt = clock; setSeasonDay(globalThis.IslandTerrain.seasonDay(Date.now() + serverOffset)); }
    island.step(clock); refreshMapBoard(); refreshMinimap(performance.now());
    drops.forEach((d) => { const t = (clock * 0.7 + d.userData.phase) % 1; const a = d.userData.phase * TAU; d.position.set(Math.cos(a) * t * 1.4, 2.3 + Math.sin(t * Math.PI) * 0.9 - t * 1.6, Math.sin(a) * t * 1.4); });
    lamps.forEach((l, i) => { l.material.emissiveIntensity = 0.55 + Math.sin(clock * 1.5 + i) * 0.05; });
    placeCamera(false);
  }
  // v1.10.8: the gait follows how fast the character is drawn moving (`speed`): it blends from standing to walking
  // and, faster than a walk (someone catching up), toward a run -- never a sudden switch.
  function animate(c, dt, moving, speed = moving ? SPEED : 0) {
    const yaw = c.root.rotation.y;
    const target = c.targetYaw ?? yaw;
    const turn = angleTo(yaw, target);
    const rate = Math.min(1, dt * 12);
    c.root.rotation.y = yaw + turn * rate;
    if (c.anim) { c.anim.update(dt, speed); return; } // v1.10.15: a registered model -- Idle/Walk/Run from the same speed
    c.roll += (THREE.MathUtils.clamp(-turn * 0.25, -0.18, 0.18) - c.roll) * Math.min(1, dt * 10); // lean into a turn
    c.gait = (c.gait || 0) + (Math.min(1.7, Math.max(0, speed) / SPEED) - (c.gait || 0)) * Math.min(1, dt * 7);
    const walk = Math.min(1, c.gait); const run = Math.max(0, Math.min(1, (c.gait - 1.1) / 0.5));
    c.lean += ((0.14 * walk + 0.1 * run) - c.lean) * Math.min(1, dt * 8); // lean forward while walking, more running
    if (speed > 0.2) c.phase += dt * speed * 2.1; else c.phase *= Math.max(0, 1 - dt * 8); // the stride matches the ground
    const swing = Math.sin(c.phase) * (0.65 * walk + 0.25 * run);
    c.legL.rotation.x = swing; c.legR.rotation.x = -swing;
    const idle = (1 - walk) * Math.sin(clock * 2.2 + (c === me ? 0 : 1.7)) * 0.05;
    c.armL.rotation.x = -swing * 0.9 + idle; c.armR.rotation.x = swing * 0.9 - idle;
    c.hop = Math.max(0, c.hop - dt * 2.8);
    const hopT = c.hop > 0 ? Math.sin((1 - c.hop) * Math.PI) : 0;
    c.armL.rotation.z = -hopT * 1.1; c.armR.rotation.z = hopT * 1.1; // a little cheer when interacting
    if (c.waving) { c.armR.rotation.z = 2.5 + Math.sin(clock * 9) * 0.35; c.armR.rotation.x = 0; }
    // Islanders keep their feet visually planted: their root already follows exact terrain height, so only a tiny
    // pelvis bob remains. Player/remote-player animation keeps the existing livelier bounce.
    const bodyBob = c.groundedWalk ? 0.012 : 0.07;
    c.body.position.y = Math.abs(Math.sin(c.phase)) * bodyBob * walk * (1 + run * 0.6) + hopT * 0.28 - (c.groundedWalk ? FOOT_LIFT : 0);
    c.body.rotation.x = c.lean; c.body.rotation.z = c.roll;
    c.body.scale.y = 1 + (1 - walk) * Math.sin(clock * 2.2) * 0.012;
    // the head turns toward a nearby facility (limited), and nods on interaction
    const wantHead = c.lookAt != null ? THREE.MathUtils.clamp(angleTo(c.root.rotation.y, c.lookAt), -0.7, 0.7) : 0;
    c.headYaw += (wantHead - c.headYaw) * Math.min(1, dt * 6);
    c.head.rotation.y = c.headYaw; c.head.rotation.x = -hopT * 0.25;
    if (c.cape) c.cape.rotation.x = 0.18 + c.lean * 2.2 + Math.sin(clock * 7 + c.phase) * (0.02 + 0.06 * walk); // the cape trails when walking
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
  const disposeWanderers = () => { clearTimeout(wanderersTimer); for (const w of wanderers) disposeCharacter(w.c); wanderers.length = 0; };
  function dispose() {
    stop(); observer.disconnect();
    assets.dispose();
    for (const o of others.values()) disposeCharacter(o.c); others.clear(); disposeWanderers();
    window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur);
    renderer.domElement.removeEventListener('click', onClick); renderer.domElement.removeEventListener('pointermove', onMove);
    renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointerup', onUp); renderer.domElement.removeEventListener('pointercancel', onUp);
    scene.traverse((o) => { if (o.isMesh) o.geometry.dispose(); if (o.isSprite) o.material.dispose(); });
    mats.forEach((m) => m.dispose()); vcMat.dispose(); textures.forEach((t) => t.dispose()); island.dispose();
    renderer.dispose(); renderer.domElement.remove(); minimap.remove();
  }
  // For tests and support: where things are, and a way to stand at a facility's door.
  function debug() {
    const p = me.root.position;
    const webgl = { attempt: made.attempt, gpu: made.gpu }; // v1.10.23: which renderer try succeeded
    const screenOf = (id) => {
      const root = facilityRoots.find((r) => r.userData.facility === id);
      if (!root) return null;
      const v = new THREE.Vector3(root.position.x, root.position.y + 1.8, root.position.z).project(camera); // low on the building: a tall tower's middle can be off screen
      const rect = renderer.domElement.getBoundingClientRect();
      return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
    };
    return { x: p.x, z: p.z, yaw: me.root.rotation.y, near, running, quality, webgl, assets: assets.debug(), holdQuality: (tier) => { qualityHeld = true; quality = tier; assets.setQuality(tier); }, setSeasonDay: (d) => { seasonOverride = d; setSeasonDay(d ?? globalThis.IslandTerrain.seasonDay(Date.now() + serverOffset)); }, seasonDay: () => globalThis.IslandTerrain.seasonDay(Date.now() + serverOffset), gait: me.anim?.state ?? null, doors: { ...doors }, screenOf, place: (id) => { const d = doors[id]; if (d) { tryMove(d.x, d.z); placeCamera(true); } }, look: me.look || {}, title: me.title || null, champion: Boolean(me.champion), hoguking: Boolean(me.hoguking), statues: statueList.map(({ rank, name }) => ({ rank, name })), whale: () => whale(true), tag: Boolean(me.tag), tagLayout: me.tag ? { bottom: me.tag.position.y, top: me.tag.position.y + me.tag.scale.y, rows: me.tag.userData.rows, bubbleBottom: me.bubble ? me.bubble.position.y - me.bubble.scale.y / 2 : null } : null,
      teleport: (x, z) => { me.root.position.set(x, heightAt(x, z), z); correction = null; placeCamera(true); },
      bubble: me.bubble?.userData.text || null, render: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }, camYaw, minimap: { turn: minimapTurn, markers: minimapShown }, events: Object.fromEntries(Object.entries(eventDoors).map(([k, d]) => [k, { ...d }])), eventKeys: [...eventObjs.keys()], wanderers: wanderers.map(({ n, c, w }) => ({ n, x: w.x, y: c.root.position.y, z: w.z, visible: c.root.visible, speed: w.speed, grounded: Math.abs(c.root.position.y - heightAt(w.x, w.z)) < 1e-4, walkable: walkable(w.x, w.z), clear: walkers.clear(w.x, w.z), bx: w.bx, bz: w.bz, baseClear: walkers.clear(w.bx, w.bz) && walkable(w.bx, w.bz), off: Math.hypot(w.x - w.bx, w.z - w.bz), resyncs: walkers.resyncs() })), wandererR: IslandNpcs?.WALKER.R, wandererSep: IslandNpcs?.WALKER.SEP, serverNow: () => Date.now() + serverOffset, markers: mapMarkers.map((m) => ({ ...m })), walkable, heightAt, bridges: island.bridges, pier: island.pier, spawn: SPAWN, overview: (on) => { overview = Boolean(on); placeCamera(true); }, setCamYaw: (y) => { camYaw = y; yawGoal = y; placeCamera(true); }, camPitch, pitchGoal, pitchMax: PITCH_MAX, camDist, setCamPitch: (v) => { camPitch = clampPitch(v); pitchGoal = camPitch; placeCamera(true); },
      camera: { x: camera.position.x, y: camera.position.y, z: camera.position.z, clear: camera.position.y - heightAt(camera.position.x, camera.position.z),faded: faded.size, inBuilding: camera.position.y < me.root.position.y + CAM_OVER - 0.05 && buildingSolids.some((s) => Math.hypot(camera.position.x - s.x, camera.position.z - s.z) < s.r) }, radiusAt: playerRadiusAt, others: [...others].map(([id, o]) => ({ id, x: o.c.root.position.x, z: o.c.root.position.z, tag: Boolean(o.c.tag), champion: Boolean(o.champion), hoguking: Boolean(o.hoguking), bubble: o.c.bubble?.userData.text || null, look: o.look || {} })) };
  }
  // The island map in a window (안내 지도): drawn into the caller's canvas with where I stand now.
  const drawMap = (canvas) => island.drawMap(canvas.getContext('2d'), canvas.width, canvas.height, { x: me.root.position.x, z: me.root.position.z });
  // v1.10.2: a chat message over someone's head ('me' or another player's id)
  const speak = (id, text) => say(id === 'me' ? me : others.get(id)?.c, text);
  const setStatuesPublic = (list) => setStatues(list);
  const setEventsPublic = (list) => setEvents(list);
  const setMapMarkers = (list) => { mapMarkers = Array.isArray(list) ? list.filter((m) => Number.isFinite(m?.x) && Number.isFinite(m?.z)) : []; minimapAt = 0; };
  return { start, stop, dispose, debug, interact, setAvatar, setOthers, pose, correctTo, drawMap, speak, setMapMarkers, setStatues: setStatuesPublic, setEvents: setEventsPublic, setServerTime };
}
