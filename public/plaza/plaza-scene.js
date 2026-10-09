// v1.8.8 3D 광장 로비 V1: a small daytime village square that is the lobby's hub. Self-made primitive models only,
// no external assets. Kept apart from the RPG scene (public/rpg/rpg-scene.js): the two share Three.js, nothing else.
// The scene knows facility ids and names only; what a facility opens is the caller's `onInteract(id)`.
import * as THREE from '/vendor/three/three.module.js';
import { buildIsland, building, props, part, mergeColored, heightAt, walkable, SPOTS, COTTAGES, STATUE_SPOTS, RESERVED_LOTS, SPAWN, PLAZA_R } from './island.js';
import { halloweenDecor } from './island-halloween.js';
import { townhallYard } from './island-townhall.js';
import { trainScene } from './island-train-scene.js';
import { createOcclusion } from './occlusion.js';
import { cameraEase, cameraDistance, cameraSkyAim } from './camera-motion.js';

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

  const hemi = new THREE.HemisphereLight(0xfff4dc, 0x8cc970, 1.05); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d2, 1.75);
  sun.position.set(-9, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 80 }); // follows the player
  sun.shadow.bias = -0.0006;
  const SUN_OFF = new THREE.Vector3(-9, 18, 8); const SUN_U = new THREE.Vector3().crossVectors(SUN_OFF, new THREE.Vector3(0, 1, 0)).normalize(); const SUN_V = new THREE.Vector3().crossVectors(SUN_U, SUN_OFF).normalize(); // across the light
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
  // v1.10.35 (사용자 2026-10-06 「이름표·말풍선이 위로 쏠림」): the tag stands just over the top of the head -- the model's
  // own height once it is worn (a hat counted), the procedural one's before -- and the chat bubble just over the tag.
  // It was a fixed 2.53 over the feet, well over the common character's head, with the bubble 0.25 higher again.
  const TAG_GAP = 0.12;
  const FAR_TAG = 45; // v1.10.37: past this a player's chat bubble is not drawn (the name tag is)
  function fitTag(c) {
    if (!c?.tag) return;
    c.tag.position.y = c.headTop + TAG_GAP;
    if (c.bubble) c.bubble.position.y = bubbleY(c);
  }
  const bubbleY = (c) => (c.tag ? c.tag.position.y + c.tag.scale.y : c.headTop) + 0.08 + c.bubble.scale.y / 2; // over the whole tag (it stands on its bottom)
  // v1.10.34: an event visitor's mark -- a yellow star with 「!」, nothing like a player's name tag (the owner of a lost
  // thing wore a 「?」 tag that read as someone logged in)
  // v1.10.37 연계 퀘스트: a request to report back -- a green round mark with 「✓」 (the yellow star is a new request)
  function makeCheckMark() {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
    const c = canvas.getContext('2d');
    c.beginPath(); c.arc(64, 66, 52, 0, TAU); c.fillStyle = '#4ade80'; c.fill(); c.lineWidth = 6; c.strokeStyle = '#15803d'; c.stroke();
    c.beginPath(); c.moveTo(38, 68); c.lineTo(57, 87); c.lineTo(92, 46); c.lineWidth = 13; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#ffffff'; c.stroke();
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));
    sprite.center.set(0.5, 0); sprite.scale.set(0.75, 0.75, 1); sprite.renderOrder = 2; sprite.userData.mark = 'check';
    return sprite;
  }
  function makeStarMark() {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
    const c = canvas.getContext('2d');
    c.beginPath();
    for (let k = 0; k < 10; k += 1) { const r = k % 2 ? 26 : 58; const a = -Math.PI / 2 + (k * Math.PI) / 5; c.lineTo(64 + Math.cos(a) * r, 68 + Math.sin(a) * r); }
    c.closePath(); c.fillStyle = '#facc15'; c.fill(); c.lineJoin = 'round'; c.lineWidth = 6; c.strokeStyle = '#a16207'; c.stroke();
    c.fillStyle = '#4a2a00'; c.font = '900 52px Pretendard, "Malgun Gothic", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', 64, 72);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));
    sprite.center.set(0.5, 0); sprite.scale.set(0.75, 0.75, 1); sprite.renderOrder = 2; sprite.userData.mark = 'star';
    return sprite;
  }
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
    lines.forEach((l, i) => c.fillText(l, 256, 4 + bodyH / 2 - (lines.length - 1) * 25 + i * 50)); // v1.10.45: centred in the body (it sat 12 px high)
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
    c.bubble.position.y = bubbleY(c);
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
  // v1.10.36 10월 할로윈 (IDEAS, 사용자 확정 2026-10-06): all October (Asia/Seoul) the island is at night -- the sky, the
  // fog and the light; the seasons, their zones and the plaza stay as they are -- and the fountain gives its place to a
  // pedestal with a jack-o'-lantern bigger than it, lit from inside (an orange light on what is near, a slow candle
  // flicker; held still when the PC asks for less motion). Its footprint is the fountain's, so walking is unchanged.
  // The 2026-10-06 Halloween pack's models (landmark.halloween.*) replace the stand-in drawn here.
  const halloween = new THREE.Group(); halloween.position.y = PH; halloween.visible = false; scene.add(halloween);
  const pedestal = new THREE.Group(); halloween.add(pedestal);
  const pedestalLook = new THREE.Group(); pedestal.add(pedestalLook);
  mesh(new THREE.CylinderGeometry(3.05, 3.17, 1.05, 40), mat(0x4a3f52), 0, 0.525, 0, pedestalLook);
  const lantern = new THREE.Group(); lantern.position.y = 1.05; lantern.rotation.y = Math.PI; halloween.add(lantern); // its face (model front -z) toward the plaza's way in
  const lanternLook = new THREE.Group(); lantern.add(lanternLook);
  const pumpkin = mesh(new THREE.SphereGeometry(2.9, 32, 20), mat(0xe8782a), 0, 2.45, 0, lanternLook); pumpkin.scale.set(1.18, 0.82, 1.1);
  mesh(new THREE.CylinderGeometry(0.28, 0.4, 0.9, 10), mat(0x5d7a3a), 0, 4.75, 0, lanternLook);
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff8a1f, emissiveIntensity: 1.6, roughness: 1 });
  for (const [x, y, sx, sy] of [[-1, 3, 0.55, 0.5], [1, 3, 0.55, 0.5], [0, 1.85, 1.5, 0.4]]) { const cut = mesh(new THREE.SphereGeometry(1, 12, 8), glowMat, x, y, -3.0, lanternLook); cut.scale.set(sx, sy, 0.12); cut.castShadow = false; }
  const lanternGlows = [glowMat]; // the model's own `glow` material joins when it comes (lights the cut face)
  assets.attach('landmark.halloween.pedestal', pedestal, pedestalLook);
  assets.attach('landmark.halloween.lantern', lantern, lanternLook, (entry) => { if (!entry) return; lantern.traverse((o) => { for (const m of [].concat(o.material || [])) { if (m.name === 'glow' && !lanternGlows.includes(m)) { m.emissive?.set(0xff8a1f); lanternGlows.push(m); } if (m.name === 'accent') { m.emissive?.set(0x5a2206); m.emissiveIntensity = 0.7; } } }); }); // the shell lit a little from inside
  const candle = new THREE.PointLight(0xff9a3c, 0, 26, 1.6); candle.position.set(0, 3.6, 0); halloween.add(candle);
  const lessMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const DAY = { background: 0xbfe6ff, fog: 0xd7efff, sky: 0xfff4dc, ground: 0x8cc970, hemi: 1.05, sun: 0xfff0d2, sunI: 1.75 };
  const NIGHT = { background: 0x0d1630, fog: 0x231a3d, sky: 0x6a5fa8, ground: 0x23304a, hemi: 0.6, sun: 0x9fb4ff, sunI: 0.55 }; // v1.10.38: a purple haze
  let night = null; let halloweenOverride = null;
  const lampModel = () => lamps.length > 0 && !lamps[0].parent.visible; // v1.10.38: the lamp model stands in place of the stand-in
  const isHalloween = globalThis.IslandTerrain.isHalloween; // October, Asia/Seoul
  function setHalloween(on) {
    if (night === on) return; night = on;
    const L = on ? NIGHT : DAY;
    scene.background.set(L.background); scene.fog.color.set(L.fog);
    hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi;
    sun.color.set(L.sun); sun.intensity = L.sunI;
    halloween.visible = on; fountain.visible = !on; candle.intensity = on ? 38 : 0;
    assets.setNight(on);
    // v1.10.38: the whole island dressed up, and every lamp orange
    for (const m of [...lamps.map((l) => l.material), island.lampBulb]) { m.color.set(on ? 0xffc27a : 0xfff3c2); m.emissive.set(on ? 0xff8a1f : 0xffe08a); }
    island.lampBulb.emissiveIntensity = on ? 1.6 : 0.6;
    decor.setOn(on); yard.setNight(on);
  }
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
  const hwSpots = []; // v1.10.38 섬 전체 할로윈: October's door decorations, laid out with the buildings
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
    } else if (spot.kind === 'townhall') { // v1.10.41 관공서 확장: the marble hall (15 x 10, 6.2 high) on its terrace, steps to the yard
      depth = 12.6; const w = 15; const h = 6.2;
      const marble = mat(0xf2ede4); const trim = mat(0xdcd3c4); const roofM = mat(spot.roof);
      mesh(new THREE.BoxGeometry(16.2, 0.5, 12.6), trim, 0, 0.25, 0, visual); // the terrace
      for (let k = 0; k < 3; k += 1) mesh(new THREE.BoxGeometry(6 - k * 0.4, 0.17, 0.35), trim, 0, 0.085 + k * 0.17, 7.2 - k * 0.35, visual); // the steps
      mesh(new THREE.BoxGeometry(w, h, 10), marble, 0, 0.5 + h / 2, -0.6, visual);
      for (const cx of [-5, -3, -1, 1, 3, 5]) mesh(new THREE.CylinderGeometry(0.34, 0.38, h - 0.3, 14), marble, cx, 0.5 + (h - 0.3) / 2, 5.4, visual); // the colonnade
      const ped = mesh(new THREE.ConeGeometry(8.6, 1.8, 4), roofM, 0, 0.5 + h + 0.9, -0.6, visual); ped.rotation.y = Math.PI / 4; ped.scale.z = 0.72;
      mesh(new THREE.CylinderGeometry(1.4, 1.6, 1.2, 8), marble, 0, 0.5 + h + 2.2, -0.6, visual); // the lantern dome's drum
      mesh(new THREE.SphereGeometry(1.4, 16, 10, 0, TAU, 0, Math.PI / 2), mat(0x5f8f7f), 0, 0.5 + h + 2.8, -0.6, visual);
      sign(facility.name, root, 12.6);
      boxSolids(0, -0.6, w, 10, 1.4); boxSolids(0, 0, 16.2, 12.6, 0.8); // the hall, and its terrace (the steps are the way up)
      // v1.10.45: the grid above left gaps a character could slip through (0.8 circles 1.7 apart), so the terrace and the
      // steps are also walled round their edges with circles that overlap (one never gets past the foot of the steps)
      const edge = (cx, cz, ew, ed) => { for (const [ax, az, bx, bz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) { const len = Math.hypot((bx - ax) * ew, (bz - az) * ed) / 2; for (let d = 0; d < len; d += 0.5) { const t = d / len; solids.push({ ...at(cx + (ax + (bx - ax) * t) * (ew / 2 - 0.3), cz + (az + (bz - az) * t) * (ed / 2 - 0.3)), r: 0.5 }); } } };
      edge(0, 0, 16.2, 12.6); edge(0, 6.85, 6, 1.1);
    } else if (spot.kind === 'shop' || spot.kind === 'house' || spot.kind === 'office') {
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
      const npcSpec = { shirt: 0xffb86b, hair: 0x5b3a29, skin: 0xffdcbc, hat: 0x6bc4a6 };
      const npc = makeCharacter(npcSpec);
      npc.root.position.set(-0.7, 0, 0); root.add(npc.root); assets.dress([`character.${facility.id}`, 'character.npc'], npc); dressUp(npc, { gender: 'female' }, npcSpec); npc.root.userData.npc = npc; npc.home = { x, z, yaw: root.rotation.y, id: facility.id };
      mesh(new THREE.BoxGeometry(1.0, 0.95, 0.7), mat(0xc58b5a), 0.7, 0.48, 0, visual);
      mesh(new THREE.BoxGeometry(1.1, 0.08, 0.8), mat(0xffe9b8), 0.7, 0.99, 0, visual);
      mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.16, 16), mat(0xe2574c), 0.7, 1.12, 0, visual);
      sign(facility.name, root, 2.9);
      solids.push({ x, z, r: 1.2 });
      npcs.push(npc);
    } else if (spot.kind === 'stall') { // v1.10.10 상점가 상인: a trader behind a market stall with crates of produce
      depth = 1.3;
      const npcSpec = { shirt: 0x6bbf73, hair: 0x6b4a2b, skin: 0xffdcbc, hat: 0xf2c14e };
      const npc = makeCharacter(npcSpec);
      npc.root.position.set(0, 0, -0.85); root.add(npc.root); assets.dress([`character.${facility.id}`, 'character.npc'], npc); dressUp(npc, { gender: 'male' }, npcSpec); npc.root.userData.npc = npc; npc.home = { x, z, yaw: root.rotation.y, id: facility.id };
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
      const npcSpec = { shirt: 0x3f5f8f, hair: 0xd9d4cc, skin: 0xffdcbc, hat: 0x2b2b2b };
      const npc = makeCharacter(npcSpec);
      npc.root.position.set(0, 0, -0.75); root.add(npc.root); assets.dress([`character.${facility.id}`, 'character.npc'], npc); dressUp(npc, { gender: 'male' }, npcSpec); npc.root.userData.npc = npc; npc.home = { x, z, yaw: root.rotation.y, id: facility.id };
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
    if (!facility.decor) doors[facility.id] = { ...globalThis.IslandTerrain.facilityDoor(facility.id), name: facility.name };
    // v1.10.38: October's pumpkins either side of a building's door (the hall's on its terrace)
    const hwRy = root.rotation.y + Math.PI;
    if (spot.kind === 'hall') for (const lx of [-4.2, 4.2]) hwSpots.push({ kind: 'stack', ...at(lx, 6.3), y: root.position.y + 0.5, ry: hwRy });
    else if (spot.kind === 'townhall') for (const lx of [-3.4, 3.4]) hwSpots.push({ kind: 'stack', ...at(lx, 7.9), ry: hwRy }); // v1.10.41: either side of the steps
    else if (['house', 'shop', 'office'].includes(spot.kind)) hwSpots.push({ kind: 'stack', ...at(-1.3, depth / 2 + 0.5), ry: hwRy }, { kind: 'pumpkinA', ...at(1.3, depth / 2 + 0.45), ry: hwRy + 0.3 });
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
    const hwRy = g.rotation.y + Math.PI; // v1.10.38: pumpkins by the door, a hay bale in a yard without a planter there
    hwSpots.push({ kind: 'stack', ...local(door - 0.85, look.d / 2 + 0.45), ry: hwRy }, { kind: 'pumpkinB', ...local(door + 0.8, look.d / 2 + 0.4), ry: hwRy - 0.3 });
    if (look.planters) hwSpots.push({ kind: 'hay', ...local(-look.w / 2 + 0.3, look.d / 2 + 1.6), ry: hwRy + Math.PI / 2 });
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
  const train = trainScene({ scene, assets, solids, vcMat, sign }); // v1.10.47 관광열차 (its steps are walked round)
  const firstYardSolid = solids.length;
  const yard = townhallYard({ scene, assets, solids, vcMat, makeCharacter, dressUp, makeTag, fitTag, hall: buildingRoots.find((r) => r.userData.facility === 'townhall') }); // v1.10.41
  buildingSolids.push(...solids.slice(firstYardSolid).filter(s => !s.gate));
  buildingRoots.push(yard.group);
  doors.mayor = yard.door;
  const decor = halloweenDecor({ scene, assets, solids, vcMat, PH, plazaLamps: PROPS.lamps, benches: PROPS.benches, spots: hwSpots, lampModel }); // v1.10.38
  // v1.10.5 기부 동상: last week's 1st (gold) and 2nd (silver) donors stand on the two plinths, in the look they had
  // when the week closed, with a small plate. Rebuilt only when the server sends a different pair.
  let statueList = []; let statueKey = '[]'; const statueRoots = []; const statueChars = [];
  const STATUE_SIZE = 2.6; // v1.10.30: the 1st donor's statue, in player heights (the 2nd is 70% of it)
  function setStatues(list) {
    const next = (Array.isArray(list) ? list : []).filter((s) => s && (s.rank === 1 || s.rank === 2)).slice(0, 2);
    const key = JSON.stringify(next.map(({ rank, name, look, title }) => [rank, name, look, title]));
    if (key === statueKey) return;
    statueKey = key; statueList = next;
    for (const c of statueChars.splice(0)) { occlusion.remove(c.root); assets.release(c); const i = buildingRoots.indexOf(c.root); if (i >= 0) buildingRoots.splice(i, 1); }
    for (const r of statueRoots.splice(0)) { r.traverse((o) => { if (o.isMesh) o.geometry.dispose(); if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } }); r.parent?.remove(r); }
    // v1.10.30 기부 동상 (사용자 결정 2026-10-05): the donors as they look -- their own colours, hair, clothes and face, the
    // common-rig character when they have it (no gold or silver any more) -- at landmark size: the 1st STATUE_SIZE times
    // a player, the 2nd 70% of that, waving, frozen. Over everyone's heads they never stand in the way (the plinth's
    // circle is the walking limit); one that hides me from the camera fades like a building.
    for (const st of next) {
      const spot = STATUE_SPOTS[st.rank - 1]; if (!spot) continue;
      const size = st.rank === 1 ? STATUE_SIZE : STATUE_SIZE * 0.7;
      const c = makeCharacter({ ...ME_BASE, look: st.look || {} });
      c.root.position.set(spot.x, PH + 1.4, spot.z); c.root.rotation.y = Math.atan2(-spot.x, -spot.z) + 0.35; c.root.scale.setScalar(size);
      c.armR.rotation.z = 2.4; // a wave, frozen (the procedural character)
      scene.add(c.root); statueRoots.push(c.root); statueChars.push(c); c.root.userData.building = true; buildingRoots.push(c.root);
      dressUp(c, st.look || {});
      const plate = makeTag(`${st.rank}위 ${st.name}`, null); plate.position.set(spot.x, PH + 1.5 + 2.35 * size, spot.z); scene.add(plate); statueRoots.push(plate);
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
    disposeCharacter(old); scene.add(me.root); assets.dress('character.player', me); dressUp(me, look);
    if (name) { me.tag = makeTag(name, title, champion, hoguking); me.root.add(me.tag); fitTag(me); }
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
        o.c = makeCharacter({ ...OTHER_BASE, look: p.look || {} }); o.c.player = true; o.c.root.position.copy(pos); o.c.root.rotation.y = yaw; o.key = key;
        o.c.tag = makeTag(p.name || '', p.title || null, p.champion, p.hoguking); o.c.tag.material.fog = false; o.c.root.add(o.c.tag); fitTag(o.c); scene.add(o.c.root); assets.dress('character.player', o.c); dressUp(o.c, p.look || {});
      }
      if (!o) {
        const c = makeCharacter({ ...OTHER_BASE, look: p.look || {} }); c.player = true; // v1.10.37: seen from far (asset-loader wearMaterial)
        c.root.position.set(p.x, heightAt(p.x, p.z), p.z); c.root.rotation.y = p.yaw;
        c.tag = makeTag(p.name || '', p.title || null, p.champion, p.hoguking); c.tag.material.fog = false; c.root.add(c.tag); fitTag(c); scene.add(c.root); assets.dress('character.player', c); dressUp(c, p.look || {});
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
      setCarry(o.c, p.carry || null); // v1.10.32 운반
      // v1.10.44: their act -- sitting (the clips, on their seat), or a new wave or cheer
      if (p.act === 'sit' && p.seat) { takenSeats.set(p.seat, p.id); if (o.act !== 'sit') { o.c.anim?.play('sitDown'); o.c.anim?.loop?.('sitIdle'); o.c.tailTucked = true; o.c.tuckTail?.(true); } }
      else if (o.act === 'sit') { o.c.anim?.release?.(); o.c.anim?.play('standUp'); o.c.tailTucked = false; o.c.tuckTail?.(false); }
      if (['gather','pickup','pickFruit'].includes(o.act) && !['gather','pickup','pickFruit'].includes(p.act)) { o.c.anim?.finishOnce?.(); assets.letGo(o.c,'fruit'); }
      if (['gather','pickup','pickFruit'].includes(p.act) && p.actN !== o.actN) { o.c.anim?.play(p.act,{ms:p.actMs,hold:true,elapsed:Math.max(0,(Date.now()+serverOffset-p.actAt)/1000)}); if (p.actTarget) o.c.root.rotation.y=Math.atan2(p.actTarget.x-p.x,p.actTarget.z-p.z); }
      if (['wave', 'cheer', 'nod', 'clap', 'bow'].includes(p.act) && p.actN !== o.actN) o.c.anim?.play(p.act);
      for (const [seat, id] of takenSeats) if (id === p.id && (p.act !== 'sit' || p.seat !== seat)) takenSeats.delete(seat);
      o.collect = p.actTarget ? {target:p.actTarget,at:p.actAt} : null; o.act = p.act || null; o.actN = p.actN || 0; o.seat = p.seat || null;
      // v1.10.47: riding the train -- drawn on their seat by the same clock (the server only says which train and seat)
      const ride = p.ride && Number.isInteger(p.ride.id) && Number.isInteger(p.ride.seat) && R.TRAINS.some((t) => t.id === p.ride.id) && R.SEATS[p.ride.seat] ? { id: p.ride.id, seat: p.ride.seat } : null;
      if (ride && !o.ride) { o.c.anim?.loop?.('rideLook') || o.c.anim?.loop?.('sitIdle'); o.c.noTuck = true; o.c.tailTucked = true; o.c.tuckTail?.(true); }
      if (!ride && o.ride) { o.c.noTuck = false; o.c.anim?.release?.(); o.c.tailTucked = false; o.c.tuckTail?.(false); }
      o.ride = ride; o.platform = p.platform || null;
    }
    for (const [id, o] of others) if (!seen.has(id)) { disposeCharacter(o.c); others.delete(id); for (const [seat, who] of takenSeats) if (who === id) takenSeats.delete(seat); }
  }
  // v1.9.6: the server moved me out of someone (it saw an overlap my screen did not): glide there, through tryMove.
  let correction = null;
  function correctTo(x, z) {
    if (liftRide || riding) return;
    if (platform) { const q = R.platformClamp(platform.line, platform.station, x, z); me.root.position.set(q.x, q.y, q.z); correction = null; return; }
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
      if (!warped && !o.platform && !o.ride && !platform && !riding && d < min && d < o.drawnGap - 1e-4) {
        const ux = d > 1e-4 ? dx / d : 0; const uz = d > 1e-4 ? dz / d : 1; const keep = Math.min(min, o.drawnGap);
        p.x = m.x + ux * keep; p.z = m.z + uz * keep; f.nudge(p.x, p.z);
      }
      o.drawnGap = Math.hypot(p.x - m.x, p.z - m.z);
      p.y = heightAt(p.x, p.z);
      // facing: the way they are drawn walking, and the server's facing once they stand
      o.c.targetYaw = f.speed > 0.8 && f.heading != null ? f.heading : at.yaw;
      if (o.collect && ['gather','pickup','pickFruit'].includes(o.act)) {
        o.c.targetYaw=Math.atan2(o.collect.target.x-p.x,o.collect.target.z-p.z);
        const t=(Date.now()+serverOffset-o.collect.at)/1000;
        if(o.act==='pickFruit' && t>=0.98 && t<1.48 && !o.c.holding?.fruit) assets.hold(o.c,'prop.harvest.fruit',0,{key:'fruit'});
        if(t>=1.48) assets.letGo(o.c,'fruit');
      }
      if (o.act === 'sit') { const s = SEATS.find((x) => x.id === o.seat); if (s) { p.x = s.x; p.z = s.z; p.y = heightAt(s.x, s.z) + SEAT_LIFT; o.c.targetYaw = s.yaw; } } // v1.10.44
      if (o.platform && !o.ride) { const q = R.platformClamp(o.platform.line, o.platform.station, p.x, p.z); p.set(q.x, q.y, q.z); animate(o.c, dt, f.speed > .4, f.speed); continue; }
      if (o.ride) { const q = R.seatAt(o.ride.id, o.ride.seat, trainNow()); p.set(q.x, q.y, q.z); o.c.root.rotation.y = q.yaw; o.c.targetYaw = q.yaw; animate(o.c, dt, false, 0); continue; } // v1.10.47
      animate(o.c, dt, o.act !== 'sit' && f.speed > 0.4, o.act === 'sit' ? 0 : f.speed);
    }
  }
  const pose = () => ({ x: liftRide?.to.x ?? me.root.position.x, z: liftRide?.to.z ?? me.root.position.z, yaw: me.root.rotation.y, moving: keys.size > 0 && !isBlocked() && !riding && !liftRide, act: myAct.act, actN: myAct.n, seat: myAct.seat }); // v1.10.44 act

  // v1.10.30 공통 캐릭터: put a character in the common-rig look (island-assets wardrobeOf -> asset-loader wear) --
  // a player by their look (gender, the items worn, face, dyes), a keeper, visitor or islander in its own colours
  // (`spec`: the procedural colours it is made with) and a gender. Without a part for something worn (or without the
  // models) the procedural character stays as it is.
  function dressUp(c, look = {}, spec = null) {
    const hexOf = (n) => `#${Number(n).toString(16).padStart(6, '0')}`; // (called while the scene is still being built)
    const plan = globalThis.IslandAssets?.wardrobeOf?.(look, spec ? { tint: { shirt: hexOf(spec.shirt), hair: hexOf(spec.hair) }, hat: spec.hat ? hexOf(spec.hat) : null } : {});
    if (plan) assets.wear(c, plan);
  }
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
    // headTop: the top of the head (a hat or a halo counted) over the feet; a worn model measures its own (onWorn)
    const c = { root, body, head, legL, legR, armL, armR, cape: parts.cape || null, halo: parts.halo || null, yaw: 0, phase: 0, lean: 0, roll: 0, hop: 0, headYaw: 0,
      headTop: hat || look.hat ? 2.45 : 2.12 };
    c.onWorn = () => fitTag(c);
    return c;
  }

  // Input: arrows move, Space interacts; both Space and a click on a facility call `interact`.
  const keys = new Set();
  const isTyping = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  const isBlocked = () => Boolean(blocked?.()) || !running;
  const onKeyDown = (event) => {
    if (isBlocked() || isTyping(event.target)) return;
    if (event.code === 'Space' && event.target.closest?.('button')) return;
    if (event.key.startsWith('Arrow')) { keys.add(event.key); event.preventDefault(); return; }
    if (event.key === 'Escape' && gather?.waitServer) { endGather(false); event.preventDefault(); return; }
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
      for (let o = hit.object; o; o = o.parent) if (o.userData.facility) return o.userData.facility === 'townhall' ? null : o.userData.facility; // v1.10.45: the town hall only by SPACE at its door, in the yard (past the mayor)
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
  // v1.10.40 하늘 보기 카메라 (IDEAS 2026-10-07): W / dragging up now looks up toward the sky, as far as SKY_MAX past the
  // default view (the camera comes down toward the ground, then its aim lifts above me); S / dragging down looks down
  // from higher up, PITCH_MAX as before. Still the same orbit round my character, never free flight.
  const PITCH_MAX = (15 * Math.PI) / 180; const SKY_MAX = (45 * Math.PI) / 180; const DRAG_PITCH = 0.004; // radians per pixel up or down
  const YAW_SPEED = 1.9; const PITCH_SPEED = 0.55; const CAM_RAMP = 0.25; // radians per second at full speed
  let camPitch = 0; let yawGoal = 0; let pitchGoal = 0; let camHeld = 0; let camDt = 0;
  const clampPitch = (v) => Math.max(-SKY_MAX, Math.min(PITCH_MAX, v)); // - toward the sky, + from higher up
  function turnCamera(dt) {
    if (camKeys.size && !isBlocked()) {
      camHeld = Math.min(CAM_RAMP, camHeld + dt); const speed = 0.35 + (0.65 * camHeld) / CAM_RAMP;
      if (camKeys.has('KeyA')) yawGoal += YAW_SPEED * speed * dt; // A turns like dragging left, D like dragging right
      if (camKeys.has('KeyD')) yawGoal -= YAW_SPEED * speed * dt;
      if (camKeys.has('KeyW')) pitchGoal -= PITCH_SPEED * speed * dt; // W: up toward the sky, like dragging up
      if (camKeys.has('KeyS')) pitchGoal += PITCH_SPEED * speed * dt;
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
        pitchGoal = clampPitch(pitchGoal + (event.clientY - (drag.lastY ?? drag.y)) * DRAG_PITCH); drag.lastY = event.clientY; // dragging up: toward the sky
        renderer.domElement.style.cursor = 'grabbing'; return;
      }
    }
    renderer.domElement.style.cursor = !isBlocked() && canInteract(facilityAt(event)) ? 'pointer' : 'grab';
  };
  const onUp = (event) => { if (drag?.id === event.pointerId) { drag = null; renderer.domElement.style.cursor = 'grab'; } };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);
  renderer.domElement.addEventListener('pointercancel', onUp);
  renderer.domElement.addEventListener('click', onClick);
  renderer.domElement.addEventListener('pointermove', onMove);

  // v1.10.11 공용 이벤트: what the server says lies near me -- a small object (or an NPC) at each, a short 「SPACE · 줍기」
  // when I stand by it, a click on it does the same, and a 「!」 on the minimap. Keys: `ev:<kind>:<id>`.
  // v1.10.31 잡초 채집 (IDEAS 「잡초 채집」, 사용자 확정 2026-10-05): the island's weeds as the server lists them, drawn
  // square by square (one instanced batch: the weed model, or the old tuft shape without it). Only the one nearest me
  // within WEED_REACH is offered (a soft ring round it, 「SPACE · 잡초 뽑기」); pulling plays GatherWeed for about a
  // second -- moving, a window opening or leaving the island in that time calls it off -- and only the server's answer
  // takes the weed away (for everyone: removeWeeds).
  const WEED_CELL = 30; const WEED_GRID = 4; const WEED_REACH = 1.6; const WEED_MS = 900; const NOTHING = new THREE.Matrix4().makeScale(0, 0, 0);
  let weedCells = []; const weedById = new Map(); let weedGrid = new Map(); let weedKey = null; let gather = null;
  const weedRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.4, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff7c2, transparent: true, opacity: 0.85, depthWrite: false }));
  weedRing.visible = false; weedRing.renderOrder = 1; scene.add(weedRing);
  const gridKey = (x, z) => `${Math.floor(x / WEED_GRID)},${Math.floor(z / WEED_GRID)}`;
  function setWeeds(list) {
    if (weedCells.length) { assets.unbatch(weedCells); for (const c of weedCells) { scene.remove(c.procedural[0]); c.procedural[0].dispose(); } }
    weedCells = []; weedById.clear(); weedGrid = new Map();
    if (weedKey) { delete eventDoors[weedKey]; weedKey = null; }
    const byCell = new Map();
    for (const [id, x, z] of list || []) { const k = `${Math.floor(x / WEED_CELL)},${Math.floor(z / WEED_CELL)}`; if (!byCell.has(k)) byCell.set(k, []); byCell.get(k).push({ id, x, z }); }
    const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const up = new THREE.Vector3(0, 1, 0); const v = new THREE.Vector3(); const sc = new THREE.Vector3();
    for (const [k, items] of byCell) {
      const im = new THREE.InstancedMesh(island.weedGeometry, island.natureMaterial, items.length);
      const [cx, cz] = k.split(',').map(Number);
      const cell = { x: (cx + 0.5) * WEED_CELL, z: (cz + 0.5) * WEED_CELL, parent: scene, procedural: [im], matrices: [], colors: null, shadow: false };
      items.forEach((w, i) => {
        const h = Math.abs(Math.sin(w.x * 12.9898 + w.z * 78.233) * 43758.5453) % 1; const size = 0.85 + h * 0.35;
        m4.compose(v.set(w.x, heightAt(w.x, w.z), w.z), q.setFromAxisAngle(up, h * TAU), sc.set(size, size, size));
        im.setMatrixAt(i, m4); cell.matrices.push(m4.clone());
        weedById.set(w.id, { cell, i, x: w.x, z: w.z });
        const g = gridKey(w.x, w.z); if (!weedGrid.has(g)) weedGrid.set(g, []); weedGrid.get(g).push(w.id);
      });
      im.computeBoundingSphere(); im.receiveShadow = true; scene.add(im); weedCells.push(cell);
    }
    if (weedCells.length) assets.batch('nature.grass', weedCells);
  }
  // a weed's copy moved (lifted while pulled) or gone (NOTHING)
  function weedMatrix(w, matrix) { w.cell.procedural[0].setMatrixAt(w.i, matrix); w.cell.procedural[0].instanceMatrix.needsUpdate = true; w.cell.matrices[w.i] = matrix.clone(); assets.refill(w.cell); }
  function removeWeeds(ids) {
    for (const id of ids || []) {
      const w = weedById.get(id); if (!w) continue;
      if (gather?.id === id && !gather.pending) endGather(false);
      weedMatrix(w, NOTHING); weedById.delete(id);
      const g = weedGrid.get(gridKey(w.x, w.z)); if (g) g.splice(g.indexOf(id), 1);
      if (weedKey === `weed:${id}`) { delete eventDoors[weedKey]; weedKey = null; }
    }
  }
  function nearestWeed() {
    const p = me.root.position; let best = null; let bestD = WEED_REACH;
    for (let gx = -1; gx <= 1; gx += 1) for (let gz = -1; gz <= 1; gz += 1) {
      for (const id of weedGrid.get(`${Math.floor(p.x / WEED_GRID) + gx},${Math.floor(p.z / WEED_GRID) + gz}`) || []) {
        const w = weedById.get(id); const d = Math.hypot(w.x - p.x, w.z - p.z); if (d < bestD) { best = id; bestD = d; }
      }
    }
    return best;
  }
  function stepWeeds(dt) {
    const id = gather?.kind === 'weed' ? gather.id : nearestWeed(); const key = id ? `weed:${id}` : null;
    if (key !== weedKey) { if (weedKey) delete eventDoors[weedKey]; weedKey = key; if (key) { const w = weedById.get(id); eventDoors[key] = { x: w.x, z: w.z, name: '잡초 · 뽑기', resource: true }; } }
    const w = id && weedById.get(id);
    let selected = w; let nearest = w ? Math.hypot(w.x-me.root.position.x,w.z-me.root.position.z) : WEED_REACH;
    let resourceKey = null;
    for (const [k,d] of Object.entries(eventDoors)) if (d.resource && !k.startsWith('weed:')) { const dist = Math.hypot(d.x-me.root.position.x,d.z-me.root.position.z); if (dist<nearest) { nearest=dist; selected=d; resourceKey=k; } }
    if (resourceKey && weedKey) { delete eventDoors[weedKey]; weedKey=null; }
    weedRing.visible = Boolean(selected); weedRing.scale.setScalar(selected?.tree ? 2.5 : 1);
    if (selected) { const p=selected.tree || selected; weedRing.position.set(p.x,heightAt(p.x,p.z)+0.04,p.z); }
    stepGather(dt);
  }
  // v1.10.40 채집 상호작용 공통 시스템 (IDEAS 잡초 채집 후속 확정 2026-10-07): one gathering at a time, any kind --
  // { kind, id, ms, anim, at, onStep(t), onDone(ok) }. While it runs I stay where I stand (the arrows do nothing, step()),
  // the camera still turns; it ends done after `ms`, or called off by a window, leaving the island or endGather(false).
  function startGather({ kind, id = null, ms, anim = 'gather', at = null, onStep = null, waitServer = false, onDone }) {
    if (gather) return false;
    gather = { kind, id, ms, anim, t: 0, startedAt: performance.now(), onStep, onDone, waitServer, pending: false };
    if (at) { me.targetYaw = Math.atan2(at.x - me.root.position.x, at.z - me.root.position.z); if(waitServer) me.root.rotation.y=me.targetYaw; }
    if (anim && !me.anim?.play(anim, waitServer ? { ms, hold: true } : {})) me.hop = 1;
    return true;
  }
  function stepGather(dt) {
    if (!gather) return;
    if (isBlocked()) { endGather(false); return; }
    if (gather.waitServer && me.anim && me.anim.state !== gather.anim) me.anim.play(gather.anim,{ms:gather.ms,hold:true,elapsed:gather.t});
    if (gather.pending) return;
    gather.t = gather.waitServer ? (performance.now()-gather.startedAt)/1000 : gather.t+dt;
    if (gather.waitServer) me.anim?.seekOnce?.(gather.t);
    gather.onStep?.(gather.t);
    if (gather.t * 1000 >= gather.ms) endGather(true);
  }
  function endGather(done) { const g = gather; if (!g) return;
    if (done && g.waitServer) { g.pending = true; g.onDone(true); return; }
    gather = null; if (g.waitServer) { me.anim?.finishOnce?.(); assets.letGo(me,'fruit'); }
    g.onDone(done);
  }
  function finishGather(ok = false) { const g = gather; if (!g?.waitServer) return false; gather=null; me.anim?.finishOnce?.(); assets.letGo(me,'fruit'); if (!ok) g.onDone(false); return true; }
  function gatherResource(ev, spec, done) {
    if (spec.pos) { me.root.position.set(spec.pos.x,heightAt(spec.pos.x,spec.pos.z),spec.pos.z); correction=null; }
    const at = ev.tree || {x:ev.x,z:ev.z};
    return startGather({kind:'resource',id:ev.id,ms:spec.ms,anim:spec.anim,at,waitServer:true,
      onStep:t => { if (!ev.tree) return; if (t>=0.98 && t<1.48 && !me.holding?.fruit) assets.hold(me,'prop.harvest.fruit',0,{key:'fruit'}); if (t>=1.48) assets.letGo(me,'fruit'); },
      onDone:done});
  }
  // v1.10.42 낚시 (IDEAS ①, Codex 12): a cast on the gathering system (I stay put, the camera turns). The server picked
  // the fish and the bite; here only what shows -- FishCast (the bobber lands at its cast_line, 0.48 s), FishWait until the
  // bite, then FishBite with the bobber bobbing under a 「!」 for the bite's window; FishCatch (the rod let go at 0.42 s,
  // the fish in the hand at 0.68 s) or FishMiss. The line runs from the rod's tip (FISH_TIP in the rod's own space).
  const FISH_TIP = new THREE.Vector3(0.08, 1.38, 0);
  const FISH_HOLD = { default: { at: [0, 0, -0.12], rot: [0, Math.PI / 2, 0] }, giant_tuna: { at: [0.18, -0.12, -0.14], rot: [0, Math.PI / 2, 0] } };
  let fishing = null;
  const fishLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xf4f1ea, transparent: true, opacity: 0.85 }));
  fishLine.frustumCulled = false; fishLine.visible = false; scene.add(fishLine);
  const bobberHolder = new THREE.Group(); bobberHolder.visible = false; scene.add(bobberHolder);
  const bobberLook = new THREE.Group(); bobberHolder.add(bobberLook);
  mesh(new THREE.SphereGeometry(0.06, 10, 8), mat(0xe2574c), 0, 0.03, 0, bobberLook); mesh(new THREE.SphereGeometry(0.06, 10, 8, 0, TAU, Math.PI / 2, Math.PI / 2), mat(0xffffff), 0, 0.03, 0, bobberLook);
  assets.attach('fishing.bobber', bobberHolder, bobberLook);
  // where the water is from here: the nearest open water round me (sea), a few metres out
  function waterFrom(x, z) {
    const T = globalThis.IslandTerrain; let best = null;
    for (let k = 0; k < 24; k += 1) {
      const a = (k / 24) * TAU; const wx = x + Math.sin(a) * 5; const wz = z + Math.cos(a) * 5;
      if (T.walkable(wx, wz) || T.coastDist(wx, wz) > -0.5) continue;
      const cd = T.coastDist(wx, wz); if (!best || cd < best.cd) best = { x: wx, z: wz, cd, yaw: a };
    }
    return best;
  }
  function fishBegin({ biteIn, window: biteMs }, onEnd) {
    const water = waterFrom(me.root.position.x, me.root.position.z); if (!water || fishing) return false;
    const ok = startGather({ kind: 'fish', ms: Infinity, anim: 'fishCast', at: water, onDone: () => fishStop(false) });
    if (!ok) return false;
    fishing = { t: 0, start: performance.now(), phase: 'cast', water, biteAt: biteIn / 1000, biteEnd: biteIn / 1000 + biteMs / 1000, onEnd, landed: false };
    me.noTuck = true; assets.hold(me, 'fishing.rod', 0, { key: 'rod' });
    return true;
  }
  function fishStop(release = true) {
    const f = fishing; if (!f) return; fishing = null;
    fishLine.visible = false; bobberHolder.visible = false; if (f.mark) { disposeTag(f.mark); f.mark = null; }
    assets.letGo(me, 'rod'); assets.letGo(me, 'catch'); me.noTuck = false; me.anim?.release?.();
    if (release && gather?.kind === 'fish') { gather.onDone = () => {}; endGather(false); }
    f.onEnd?.();
  }
  // the server's answer: the fish (species) or none (missed)
  function fishResult(species) {
    const f = fishing; if (!f) return;
    f.phase = species ? 'catch' : 'miss'; f.t0 = f.t; f.species = species;
    me.anim?.release?.(); me.anim?.play(species ? 'fishCatch' : 'fishMiss');
    if (f.mark) { disposeTag(f.mark); f.mark = null; }
  }
  function stepFishing(dt) {
    const f = fishing; if (!f) return;
    f.t = (performance.now() - f.start) / 1000; // real time: the bite is the server's, a slow frame rate must not show it late
    const sea = SEA_Y + 0.02;
    if (f.phase === 'cast' && f.t >= 0.48 && !f.landed) { f.landed = true; bobberHolder.visible = true; fishLine.visible = true; bobberHolder.position.set(f.water.x, sea, f.water.z); }
    if (f.phase === 'cast' && f.t >= 1.0) { f.phase = 'wait'; me.anim?.loop?.('fishWait'); }
    if (f.phase === 'wait' && f.t >= f.biteAt) { f.phase = 'bite'; me.anim?.play('fishBite'); me.anim?.loop?.('fishReel'); f.mark = makeStarMark(); f.mark.position.set(0, 0.7, 0); bobberHolder.add(f.mark); }
    if (f.phase === 'bite' && f.t >= f.biteEnd + 0.8) fishResult(null); // nobody pulled: it got away
    if (f.phase === 'catch') {
      const t = f.t - f.t0;
      if (t >= 0.42 && !f.dropped) { f.dropped = true; assets.letGo(me, 'rod'); fishLine.visible = false; bobberHolder.visible = false; }
      if (t >= 0.68 && !f.held) { f.held = true; const fit = FISH_HOLD[f.species] || FISH_HOLD.default; assets.hold(me, `fish.${f.species}`, 0, { key: 'catch', at: fit.at, rot: fit.rot }); }
      if (t >= 2.4) fishStop();
    }
    if (f.phase === 'miss' && f.t - f.t0 >= 0.9) fishStop();
    // the bobber rides the water; at the bite it dips and jerks
    if (bobberHolder.visible) bobberHolder.position.y = sea + (f.phase === 'bite' ? -0.06 + Math.sin(clock * 22) * 0.05 : Math.sin(clock * 2.2) * 0.015);
    if (fishLine.visible) {
      const rod = me.holding?.rod?.object; const from = new THREE.Vector3();
      if (rod) rod.localToWorld(from.copy(FISH_TIP)); else from.set(me.root.position.x, me.root.position.y + 1.6, me.root.position.z);
      const to = bobberHolder.position.clone().setY(bobberHolder.position.y + 0.08);
      const pts = fishLine.geometry.attributes.position; pts.setXYZ(0, from.x, from.y, from.z); pts.setXYZ(1, to.x, to.y, to.z); pts.needsUpdate = true; fishLine.geometry.computeBoundingSphere();
    }
  }
  // start pulling a weed (the app has told the server); `done(true)` after about a second, `done(false)` when called off
  function gatherWeed(id, done) {
    const w = weedById.get(id); if (!w) return false;
    const matrix = w.cell.matrices[w.i].clone();
    return startGather({ kind: 'weed', id, ms: WEED_MS, at: w, waitServer: true,
      onStep: (t) => { const g = weedById.get(id); if (g) weedMatrix(g, new THREE.Matrix4().makeTranslation(0, Math.min(1, (t * 1000) / WEED_MS) * 0.18, 0).multiply(matrix)); }, // the weed gives a little
      onDone: (ok) => { const g = weedById.get(id); if (g && !ok) weedMatrix(g, matrix); done(ok); } }); // let go: back as it was
  }
  const eventDoors = {}; // key -> { x, z, name } (only what I can act on)
  const eventObjs = new Map(); // key -> { root, npc }
  const EVENT_REACH = 1.9;
  // v1.10.31: each find shows its interaction-prop model (2026-10-05 packs) over this procedural look -- the trash as a
  // can and a bottle on the shore, paper on the grass
  const EVENT_PROPS = { beach_trash: [['prop.event.trash_can', 0.12, 0], ['prop.event.trash_bottle', -0.2, -0.1]], grass_trash: [['prop.event.paper_litter', 0, 0]], herb: [['prop.event.herb', 0, 0]],
    berry: [['prop.event.berry', 0, 0]], mushroom: [['prop.event.mushroom', 0, 0]], coin: [['prop.event.coin', 0, 0]], wallet: [['prop.event.wallet', 0, 0]], lost_item: [['prop.event.lost_item', 0, 0]], candy: [['halloween.candyBag', 0, 0]] }; // v1.10.39 사탕 주머니
  // v1.10.32: some finds come in two looks, each event its own (from its id: the same on every screen and in the hands)
  const twoLooks = (id, a, b) => ([...String(id)].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 2 ? b : a);
  const lostProp = (id) => twoLooks(id, 'prop.event.lost_item', 'prop.event.lost_pouch');
  function eventModel(kind, root, eventId) {
    const visual = new THREE.Group(); root.add(visual);
    const looks = kind === 'lost_item' ? [[lostProp(eventId), 0, 0]] : kind === 'berry' ? [[twoLooks(eventId, 'prop.event.berry', 'prop.event.fruit'), 0, 0]] : EVENT_PROPS[kind];
    for (const [id, x, z] of looks || []) { const h = new THREE.Group(); h.position.set(x, 0, z); root.add(h); assets.attach(id, h, visual); if (kind === 'coin') { h.position.y = 0.2; root.userData.spin = h; } }
    const add = (geo, color, x, y, z, extra) => mesh(geo, mat(color, extra), x, y, z, visual);
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
    } else if (kind === 'candy') { // v1.10.39: an orange cloth bag with sweets peeping out (the model replaces it)
      add(new THREE.SphereGeometry(0.17, 12, 9), 0xf08a24, 0, 0.17, 0);
      for (let k = 0; k < 3; k += 1) add(new THREE.SphereGeometry(0.06, 8, 6), k % 2 ? 0xb46cff : 0xfff1c8, Math.cos(k * 2.1) * 0.07, 0.36, Math.sin(k * 2.1) * 0.07);
    } else if (kind === 'mushroom') {
      for (const [mx, mz, s] of [[0, 0, 1], [0.22, 0.12, 0.7], [-0.18, 0.15, 0.6]]) {
        add(new THREE.CylinderGeometry(0.04 * s, 0.05 * s, 0.18 * s, 8), 0xf6efe0, mx, 0.09 * s, mz);
        add(new THREE.SphereGeometry(0.13 * s, 12, 8, 0, TAU, 0, Math.PI / 2), 0xd8453a, mx, 0.17 * s, mz);
      }
    } else if (kind === 'coin') {
      const coin = add(new THREE.CylinderGeometry(0.16, 0.16, 0.035, 18), 0xf6c945, 0, 0.35, 0, { metalness: 0.6, roughness: 0.3, emissive: 0x6b4d00, emissiveIntensity: 0.25 });
      coin.rotation.x = Math.PI / 2; root.userData.spin ||= coin;
    } else if (kind === 'wallet') {
      add(new THREE.BoxGeometry(0.34, 0.06, 0.24), 0x7a4b2a, 0, 0.04, 0);
      add(new THREE.BoxGeometry(0.34, 0.02, 0.1), 0x5e3920, 0, 0.08, 0.07);
    } else if (kind === 'lost_item') { // a little teddy bear
      add(new THREE.SphereGeometry(0.16, 12, 10), 0xc68a55, 0, 0.16, 0);
      add(new THREE.SphereGeometry(0.12, 12, 10), 0xc68a55, 0, 0.38, 0);
      for (const ex of [-0.08, 0.08]) add(new THREE.SphereGeometry(0.045, 8, 6), 0xa86f3f, ex, 0.48, 0);
    }
  }
  // v1.10.32 운반·전달 (CarryIdle / Receive): a lost thing picked up stays in the hands -- in front of the chest, the arms
  // holding it over standing, walking or running -- until it is given back; others see it in theirs (the server's
  // `carry`). Giving it back: the owner turns to me, I hand it over (Give), they take it in their hand (Receive), and
  // only then do they go with it.
  // the thing as drawn without its model (a teddy, or a pouch), in front of the chest until the model takes its place
  function lostThing(id) {
    const g = new THREE.Group(); const add = (geo, color, x, y, z) => mesh(geo, mat(color), x, y, z, g);
    if (lostProp(id) === 'prop.event.lost_pouch') { add(new THREE.SphereGeometry(0.17, 12, 10), 0x6f9a7c, 0, 0.15, 0).scale.set(1, 0.9, 0.75); add(new THREE.CylinderGeometry(0.05, 0.08, 0.08, 10), 0xf1e6c8, 0, 0.31, 0); }
    else { add(new THREE.SphereGeometry(0.16, 12, 10), 0xc68a55, 0, 0.16, 0); add(new THREE.SphereGeometry(0.12, 12, 10), 0xc68a55, 0, 0.38, 0); for (const ex of [-0.08, 0.08]) add(new THREE.SphereGeometry(0.045, 8, 6), 0xa86f3f, ex, 0.48, 0); }
    g.traverse((m) => { if (m.isMesh) m.castShadow = false; });
    return g;
  }
  function setCarry(c, id) {
    if ((c.carryId || null) === (id || null)) return;
    if (c.carryStand) { c.carryStand.removeFromParent(); c.carryStand = null; }
    c.carryId = id || null; c.carrying = Boolean(id);
    if (!id) { assets.letGo(c, 'carry'); return; }
    c.carryStand = lostThing(id); c.carryStand.position.set(0, 0.6, 0.38); c.root.add(c.carryStand);
    assets.hold(c, lostProp(id), null, { key: 'carry', bone: 'Chest', at: [0, -0.4, -0.32], proc: [0, 0.6, 0.38], stand: c.carryStand });
  }
  const returning = new Set(); let carriedOwner = null; let lastReturn = null; // lastReturn: the steps, for tests
  function returnLost(id) {
    returning.add(id); const o = eventObjs.get(`ev:lost_owner:${id}`);
    const t0 = performance.now(); lastReturn = { id, steps: [['give', 0]] }; const step = (name) => lastReturn?.id === id && lastReturn.steps.push([name, Math.round(performance.now() - t0)]);
    if (!o?.npc) { setCarry(me, null); return; }
    o.leaving = true; delete eventDoors[`ev:lost_owner:${id}`];
    const p = me.root.position; const q = o.root.position;
    me.targetYaw = Math.atan2(q.x - p.x, q.z - p.z); o.root.rotation.y = Math.atan2(p.x - q.x, p.z - q.z) - o.npc.root.rotation.y; o.npc.home.yaw = o.root.rotation.y;
    if (!me.anim?.play('give')) me.hop = 1;
    o.npc.anim?.play('receive');
    setTimeout(() => { // Give's release, Receive's grip: into the owner's hand
      if (!o.root.parent) return;
      const stand = me.carryStand; me.carryStand = null; me.carryId = null; me.carrying = false;
      if (stand?.parent) { o.npc.root.add(stand); stand.position.set(0.32, 0.8, 0.3); }
      assets.handOver(me, o.npc, 'carry'); step('received');
    }, 700);
    setTimeout(() => { if (o.root.parent) removeEvent(`ev:lost_owner:${id}`, o); returning.delete(id); step('gone'); }, 2100);
  }
  function removeEvent(key, o) {
    scene.remove(o.root); facilityRoots.splice(facilityRoots.indexOf(o.root), 1);
    if (o.npc) { npcs.splice(npcs.indexOf(o.npc), 1); disposeCharacter(o.npc); }
    o.root.traverse((m) => { if (m.isMesh) m.geometry.dispose(); });
    eventObjs.delete(key); delete eventDoors[key];
  }
  let questScenes = null;
  function prepareQuestScenes() {
    if (questScenes) return questScenes;
    const holder = (id, x, z, y = heightAt(x, z)) => {
      const root = new THREE.Group(); root.position.set(x, y, z); scene.add(root);
      const fallback = new THREE.Group(); root.add(fallback); assets.attach(id, root, fallback); return root;
    };
    // Account-local scenery follows the same weekly server document as the existing stories.
    const T = globalThis.IslandTerrain;
    questScenes = { empty: holder('quest.flowerbed_empty', 8, 39), bloom: holder('quest.flowerbed_bloom', 8, 39),
      frame: holder('quest.photo_frame', 7, 39), boat: holder('sea.boat', T.PIER.x + 4, T.PIER.z + T.PIER.half + 5, -0.6), departure: null, departurePending: false };
    questScenes.bloom.visible = false; questScenes.frame.visible = false; questScenes.boat.visible = false;
    return questScenes;
  }
  let questDepartureHeld = false;
  function holdQuestDeparture(on) {
    questDepartureHeld = Boolean(on);
    if (!on && questScenes?.departurePending) {
      questScenes.departurePending = false; questScenes.departure = lessMotion?.matches ? null : 0;
      questScenes.boat.visible = !lessMotion?.matches;
    }
  }
  function stepQuestScenes(dt) {
    if (!questScenes || questScenes.departure === null) return;
    questScenes.departure += dt;
    const T = globalThis.IslandTerrain; const t = questScenes.departure;
    questScenes.boat.position.set(T.PIER.x + 4 + t * 0.4, -0.6, T.PIER.z + T.PIER.half + 5 + t * 2);
    if (t >= 8) { questScenes.boat.visible = false; questScenes.departure = null; }
  }
  function setEvents(list) {
    const seen = new Set(); let carried = null;
    for (const ev of list || []) {
      if (!ev?.id || !Number.isFinite(ev.x) || !Number.isFinite(ev.z)) continue;
      if (ev.kind === 'carrying') { if (!returning.has(ev.id)) carried = ev; continue; }
      const key = `ev:${ev.kind}:${ev.id}`; seen.add(key);
      if (!eventObjs.has(key)) {
        const root = new THREE.Group(); root.position.set(ev.x, heightAt(ev.x, ev.z), ev.z); root.rotation.y = (ev.x * 7 + ev.z * 3) % TAU; scene.add(root);
        let npc = null;
        if (ev.kind === 'quest_npc') { // v1.10.37 연계 퀘스트: the islander with a story, standing at their place, facing the plaza
          const QUEST_LOOKS = { granny: [{ gender: 'female', outfit: 'avatar_outfit_9', hat: 'avatar_hat_1', hairColor: '#b9b8b4' }, { shirt: 0x8fbf6a, hair: 0xb9b8b4, skin: 0xffe0c4, hat: 0xe2c27a }],
            fisher: [{ gender: 'male', outfit: 'avatar_outfit_11', hat: 'avatar_hat_6' }, { shirt: 0xf2c94c, hair: 0x4a3326, skin: 0xffd6b0, hat: 0x34507e }],
            kid: [{ gender: 'male', outfit: 'avatar_outfit_16', hat: 'avatar_hat_14' }, { shirt: 0xf08a24, hair: 0x6b4a2b, skin: 0xffe0c4, hat: 0xf08a24 }] }; // v1.10.39: in a pumpkin costume
          const [look, spec] = QUEST_LOOKS[ev.story] || QUEST_LOOKS.granny;
          npc = makeCharacter(spec); root.rotation.y = Math.atan2(-ev.x, -ev.z);
          root.add(npc.root); npc.home = { x: ev.x, z: ev.z, yaw: root.rotation.y, id: key }; dressUp(npc, look, spec);
          if (ev.story === 'kid') { npc.root.scale.setScalar(0.72); assets.hold(npc, 'halloween.candyBasket', 0, { key: 'basket' }); } // a child, the candy basket in hand
          if (ev.story === 'granny') assets.hold(npc, 'quest.watering_can', 0, { key: 'questTool' });
          if (ev.story === 'fisher') assets.hold(npc, 'quest.fishing_rod', 0, { key: 'questTool' });
          npcs.push(npc);
        } else if (ev.kind === 'quest_spot') { // where a step asks me to go: only on the map
        } else if (ev.kind === 'photo' || ev.kind === 'lost_owner') { // a visitor: a tourist with a camera, or someone who lost something
          const spec = ev.kind === 'photo' ? { shirt: 0xffd166, hair: 0x2b2b2b, skin: 0xffdcbc, hat: 0xff8a5c } : { shirt: 0x9ad0ff, hair: 0x8b5a2b, skin: 0xffe0c4 };
          npc = makeCharacter(spec);
          root.add(npc.root); npc.home = { x: ev.x, z: ev.z, yaw: root.rotation.y, id: key }; assets.dress(['character.visitor', 'character.islander'], npc); dressUp(npc, { gender: ev.kind === 'photo' ? 'female' : 'male' }, spec);
          if (ev.kind === 'photo') { const cam = mesh(new THREE.BoxGeometry(0.26, 0.18, 0.12), mat(0x2b2b2b), 0.32, 1.05, 0.28, root); const h = new THREE.Group(); h.position.copy(cam.position); root.add(h); assets.attach('prop.event.camera', h, cam); } // the tourist's camera
          if (ev.kind === 'photo') assets.hold(npc, 'quest.camera_bag', 0, { key: 'cameraBag', bone: 'Chest', at: [0.28, -0.5, -0.12], proc: [0.28, 0.65, 0.1] });
          // what they want, at a glance: the tourist's camera; the owner of a lost thing a yellow star 「!」 (v1.10.34)
          if (ev.kind !== 'photo') { npc.tag = makeStarMark(); npc.root.add(npc.tag); } else { npc.tag = makeTag('📷', null); npc.tag.scale.multiplyScalar(0.7); npc.root.add(npc.tag); } fitTag(npc);
          npcs.push(npc);
        } else if (ev.kind === 'berry' && ev.tree) { root.position.set(ev.tree.x,heightAt(ev.tree.x,ev.tree.z),ev.tree.z); root.rotation.y=ev.tree.yaw; const h=new THREE.Group(); root.add(h); const fallback=new THREE.Group(); for(const a of [[.74,1.3,0],[.37,1.42,.64086],[-.37,1.3,.64086],[-.74,1.42,0],[-.37,1.3,-.64086],[.37,1.42,-.64086]]) mesh(new THREE.SphereGeometry(.09,6,4),mat(0xfbbf24),...a,fallback); h.add(fallback); assets.attach('tree.fruitLayer',h,fallback); root.userData.fruit=h; } else { eventModel(ev.kind, root, ev.id); root.traverse((m) => { if (m.isMesh) m.castShadow = false; }); } // small props: no shadow to draw
        root.userData.facility = key; facilityRoots.push(root);
        eventObjs.set(key, { root, npc });
      }
      if (ev.verb) eventDoors[key] = { x: ev.x, z: ev.z, name: ev.resource ? `${ev.name} · ${ev.verb}` : ev.verb, resource: ev.resource, tree: ev.tree }; else delete eventDoors[key];
      const o = eventObjs.get(key);
      o.root.userData.facility = ev.verb ? key : null;
      if (o.root.userData.fruit) o.root.userData.fruit.visible = ev.available !== false;
      if (ev.kind === 'quest_npc' && ['granny', 'fisher'].includes(ev.story)) {
        const s = prepareQuestScenes();
        if (ev.story === 'granny') { s.empty.visible = !ev.done; s.bloom.visible = Boolean(ev.done); s.frame.visible = Boolean(ev.done); }
        if (ev.story === 'fisher') {
          if (o.done === false && ev.done) { s.departurePending = questDepartureHeld; s.departure = questDepartureHeld || lessMotion?.matches ? null : 0; s.boat.visible = questDepartureHeld || !lessMotion?.matches; }
          else if (!ev.done) { s.departure = null; s.departurePending = false; s.boat.visible = true; const T = globalThis.IslandTerrain; s.boat.position.set(T.PIER.x + 4, -0.6, T.PIER.z + T.PIER.half + 5); }
          else if (s.departure === null && !s.departurePending) s.boat.visible = false;
        }
        o.done = Boolean(ev.done);
      }
      if (ev.kind === 'quest_npc' && o.mark !== (ev.mark || null)) { // its mark follows the story: new, ready, or none under way
        o.mark = ev.mark || null; disposeTag(o.npc.tag); o.npc.tag = null;
        if (o.mark) { o.npc.tag = o.mark === 'ready' ? makeCheckMark() : makeStarMark(); o.npc.root.add(o.npc.tag); fitTag(o.npc); }
      }
    }
    for (const [key, o] of eventObjs) if (!seen.has(key) && !o.leaving) removeEvent(key, o); // one being handed its thing goes after
    if (!returning.size) setCarry(me, carried?.id || null);
    carriedOwner = carried ? { x: carried.x, z: carried.z } : null;
    mapMarkers = [...eventObjs.keys()].filter((key) => (key.startsWith('ev:quest_npc:') ? eventObjs.get(key).mark : (key.startsWith('ev:photo:') || key.startsWith('ev:lost_owner:')) && eventDoors[key] || key.startsWith('ev:lost_item:') || key.startsWith('ev:quest_spot:'))).map((key) => ({ x: eventObjs.get(key).root.position.x, z: eventObjs.get(key).root.position.z }))
      .concat(carriedOwner ? [carriedOwner] : []); // whose it is: where to take it
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
      scene.add(c.root); assets.dress('character.islander', c); dressUp(c, { gender: n % 2 ? 'female' : 'male' }, r.look);
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
  function canInteract(id) {
    if (!running || typeof id !== 'string') return false;
    const door = doorOf(id);
    if (!door || door.plain) return false;
    if (id === 'fish:spot') return Boolean(fishing || globalThis.IslandTerrain.canFish(me.root.position.x, me.root.position.z));
    if (id.startsWith('player:')) {
      const other = others.get(id.slice(7));
      if (!other) return false;
      return Math.hypot(other.c.root.position.x - me.root.position.x, other.c.root.position.z - me.root.position.z) < 2.2;
    }
    if (id.startsWith('seat:') && takenSeats.has(id.slice(5))) return false;
    if ((riding || platform) && !id.startsWith('train:')) return false;
    const reach = id.startsWith('train:enter:') ? 2.6 : id.startsWith('seat:') ? 1.6 : id.startsWith('player:') ? 2.2 : door.resource || id.startsWith('weed:') ? WEED_REACH : eventDoors[id] ? EVENT_REACH : REACH;
    return Math.hypot(door.x - me.root.position.x, door.z - me.root.position.z) < reach;
  }
  function interact(id) {
    if (!canInteract(id)) return;
    if (!id.startsWith('weed:') && !eventDoors[id]?.resource) keys.clear();
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
      if (o.ride || o.platform) continue;
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
  const solidsNear = (x, z) => { const list = grid.get(`${Math.floor(x / GRID)},${Math.floor(z / GRID)}`) || []; return list.some((o) => (o.hw && !night) || (o.gate && yard.isOpen())) ? list.filter((o) => !(o.hw && !night) && !(o.gate && yard.isOpen())) : list; }; // v1.10.41: the mayor's gate, open once he has let me in // v1.10.38: October's decorations only in October
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
    if (platform) { const q = R.platformClamp(platform.line, platform.station, nx, nz); p.set(q.x, q.y, q.z); return; }
    [nx, nz] = collidePlayers(p.x, p.z, nx, nz);
    [nx, nz] = pushOut(nx, nz);
    if (!walkable(nx, nz)) { // the sea, a stream, the pond or a cliff edge: slide along it if one axis still works
      if (walkable(nx, p.z)) nz = p.z; else if (walkable(p.x, nz)) nx = p.x; else return;
    }
    p.x = nx; p.z = nz; p.y = heightAt(nx, nz);
  };
  const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

  let overview = false; let riding = null; // initialize before the first camera placement
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const OFFSET = new THREE.Vector3(0, 7.4, 10.8);
  const CAM_DIST = Math.hypot(OFFSET.y, OFFSET.z); const CAM_ELEV = Math.atan2(OFFSET.y, OFFSET.z); // the default view: 13.1 away, 34.4° up
  const CAM_MIN = 4; const CAM_CLEAR = 1.0; const CAM_OVER = 7.5; let camDist = CAM_DIST;
  function placeCamera(snap) {
    const p = me.root.position;
    // The wide sea lobes must still show the island from the carriage.
    scene.fog.far = overview ? 2000 : riding ? 600 : 175;
    const far = overview ? 1100 : riding ? 650 : VIEW_FAR;
    if (camera.far !== far) { camera.far = far; camera.updateProjectionMatrix(); }
    if (overview) { camera.position.set(20, 550, -45); camera.lookAt(20, 0, -45); return; }
    const sin = Math.sin(camYaw); const cos = Math.cos(camYaw); // the low quarter view, turned by dragging (v1.10.2)
    // v1.10.21: tilted by camPitch around the same distance; pulled in toward me while the camera would stand inside a
    // building or house (never closer than CAM_MIN) -- and if even that is inside one (my back to a big building's
    // front), lifted to CAM_OVER above me, over its walls; always at least CAM_CLEAR above the ground under it
    // v1.10.40: toward the sky the camera comes down to SKY_LOW above the level of my head, and what is left of the tilt
    // lifts its aim (the look point raised as far as that angle) -- the sky and the moon above, me at the bottom
    const SKY_LOW = 0.1; const lift = Math.max(0, SKY_LOW - (CAM_ELEV + camPitch));
    const elev = Math.max(SKY_LOW, CAM_ELEV + camPitch); const at = (d) => ({ x: p.x + sin * Math.cos(elev) * d, z: p.z + cos * Math.cos(elev) * d });
    const inside = (c) => buildingSolids.some((s) => Math.hypot(c.x - s.x, c.z - s.z) < s.r + 0.6);
    const dist = cameraDistance(CAM_DIST, CAM_MIN, (d) => inside(at(d)));
    camDist = snap ? dist : camDist + (dist - camDist) * cameraEase(dist < camDist ? 0.25 : 0.05, camDt); // in quickly, back out gently
    const c = at(camDist); const over = inside(c) ? p.y + CAM_OVER : -Infinity;
    const want = new THREE.Vector3(c.x, Math.max(p.y + Math.sin(elev) * camDist, heightAt(c.x, c.z) + CAM_CLEAR, over), c.z); // v1.10.0: follow the player across the island
    const lookY = p.y + 1.3 + Math.tan(lift) * (camDist * Math.cos(elev) + 2.4);
    const look = new THREE.Vector3(p.x - sin * 2.4, cameraSkyAim(lookY, p.y + Math.sin(elev) * camDist, want.y, lift), p.z - cos * 2.4);
    if (snap) { camPos.copy(want); camLook.copy(look); } else { camPos.lerp(want, cameraEase(0.08, camDt)); camLook.lerp(look, cameraEase(0.1, camDt)); }
    camPos.y = Math.max(camPos.y, heightAt(camPos.x, camPos.z) + CAM_CLEAR); // easing never dips it into a slope either
    camera.position.copy(camPos); camera.lookAt(camLook);
    fadeInWay(p);
  }
  // v1.10.21: a building or house between the camera and me is drawn see-through, so no view loses my character
  const occlusion = createOcclusion(camera);
  function fadeInWay(p) { occlusion.update(buildingRoots, p, clock); }

  let running = false; let raf = 0; let last = 0; let clock = 0;
  let seasonCheckedAt = -Infinity; let seasonOverride = null; // tests may hold a season day (debug().setSeasonDay)
  let halloweenCheckedAt = -Infinity; // v1.10.36: October's night, checked every few seconds by the server clock
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
  function resetFrameSample() { last = 0; sampled = 0; slowTime = 0; }
  document.addEventListener('visibilitychange', resetFrameSample);
  function adaptQuality(dt) {
    if (document.hidden) { sampled = 0; slowTime = 0; return; }
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
    if (quality > 0 && !overview && seaFree()) { whale(); seaLast = clock; }
  }

  // v1.10.32 해상 볼거리 (IDEAS 「섬 밖 원경·해상 풍경 확장」 후보): now and then, never something to do -- a small boat
  // crossing out at sea, a few gulls flying by over the water, a pod of dolphins leaping in a row (a splash going in and
  // coming out), a lone splash. Out at sea only (past the coast, never by the harbour), and where the default camera
  // shows it -- it looks down over the island, so the horizon is above the picture: a place is kept only if it falls
  // inside the picture (the sights come nearer and lower instead of the camera changing). At most two at a time and
  // never two starting together (the whale counts too); none on the lowest quality or the overview map. One set of
  // holders, made once and reused.
  const SEA = { boat: [80, 160], gulls: [45, 100], dolphins: [70, 140], splash: [35, 80] };
  const seaNext = Object.fromEntries(Object.entries(SEA).map(([k, [a, b]]) => [k, 30 + Math.random() * (b - a) + a / 2]));
  const seaActive = new Map(); let seaLast = -Infinity; let seaPool = null; const seaShown = {};
  const seaFree = () => seaActive.size < 2 && clock - seaLast > 12;
  function seaHolders() {
    if (seaPool) return seaPool;
    const make = (id, n) => Array.from({ length: n }, () => { const h = new THREE.Group(); h.visible = false; scene.add(h); assets.attach(id, h, new THREE.Group()); return h; });
    seaPool = { boat: make('sea.boat', 1), gulls: make('sea.gull', 7), dolphins: make('sea.dolphin', 3) };
    return seaPool;
  }
  // a spot out at sea, `d` from me, at least `clear` past the coast (and off the harbour), seen by the camera at height y
  const seen = new THREE.Vector3();
  const inPicture = (x, y, z) => { seen.set(x, y, z).project(camera); return seen.z < 1 && Math.abs(seen.x) < 0.88 && seen.y > -0.55 && seen.y < 0.82; };
  const seaRay = new THREE.Raycaster(); const ndc = new THREE.Vector2(); const level = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const hitAt = new THREE.Vector3();
  function seaSpot(dMin, dMax, clear, above = 0) { // `above`: the height over the sea it will be seen at
    const T = globalThis.IslandTerrain; const p = me.root.position;
    level.constant = -SEA_Y;
    for (let k = 0; k < 80; k += 1) { // a point of the picture's upper part, down onto that height
      seaRay.setFromCamera(ndc.set((Math.random() - 0.5) * 1.7, 0.05 + Math.random() * 0.75), camera);
      if (!seaRay.ray.intersectPlane(level, hitAt)) continue;
      const { x, z } = hitAt; const d = Math.hypot(x - p.x, z - p.z);
      if (d < dMin || d > dMax || T.coastDist(x, z) > -clear || Math.hypot(x - T.PIER.x, z - T.PIER.z) < 30 || Math.hypot(x - T.BREAKWATER.x, z - T.BREAKWATER.z) < 30) continue;
      if (above && !inPicture(x, SEA_Y + above, z)) continue;
      return { x, z, a: Math.atan2(x - p.x, z - p.z) };
    }
    return null;
  }
  function seaSight(kind) {
    const T = globalThis.IslandTerrain; const pool = seaHolders();
    if (kind === 'splash') { const at = seaSpot(18, 45, 8); if (!at) return false; assets.once('sea.splash', { parent: scene, x: at.x, y: SEA_Y, z: at.z }); seaShown.splash = (seaShown.splash || 0) + 1; return true; }
    if (seaActive.has(kind)) return false;
    if (kind === 'boat') { // across the view, along the horizon
      const mid = seaSpot(22, 60, 12, 1.5); if (!mid) return false;
      const e = 0.5; const gx = T.coastDist(mid.x + e, mid.z) - T.coastDist(mid.x - e, mid.z); const gz = T.coastDist(mid.x, mid.z + e) - T.coastDist(mid.x, mid.z - e);
      const gl = Math.hypot(gx, gz) || 1; const dir = { x: -gz / gl, z: gx / gl }; // along the shore
      const L = 35; const side = Math.random() < 0.5 ? 1 : -1;
      const from = { x: mid.x - dir.x * L * side, z: mid.z - dir.z * L * side }; const to = { x: mid.x + dir.x * L * side, z: mid.z + dir.z * L * side };
      if (T.coastDist(from.x, from.z) > -6 || T.coastDist(to.x, to.z) > -6) return false;
      const h = pool.boat[0]; h.visible = true; h.scale.setScalar(2.2); h.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
      seaActive.set(kind, { t: 0, dur: (2 * L) / 1.3, step(s) { const u = s.t / s.dur; h.position.set(from.x + (to.x - from.x) * u, SEA_Y - 0.1 + Math.sin(s.t * 1.3) * 0.08, from.z + (to.z - from.z) * u); h.rotation.z = Math.sin(s.t * 0.9) * 0.05; }, end() { h.visible = false; } });
    } else if (kind === 'gulls') { // v1.10.46: a few flying by over the sea, across the picture, and gone (they wheeled round one spot)
      const c = seaSpot(16, 45, 8, 4); if (!c) return false; // over the sea, low enough to be in the picture
      const T = globalThis.IslandTerrain; const p = me.root.position; const L = 36; const SPEED = 5.5;
      let dir = null; // across the line of sight, a way whose both ends are still over the sea
      for (const turn of [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2]) for (const sign of Math.random() < 0.5 ? [1, -1] : [-1, 1]) {
        if (dir) break; const a = c.a + sign * (Math.PI / 2) + turn; const d = { x: Math.sin(a), z: Math.cos(a) };
        if ([-1, -0.5, 0.5, 1].every((k) => T.coastDist(c.x + d.x * L * k, c.z + d.z * L * k) < -1)) dir = d;
      }
      if (!dir) return false;
      const n = 4 + Math.floor(Math.random() * 3);
      const birds = pool.gulls.slice(0, n).map((h, i) => ({ h, side: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (1.2 + Math.random() * 0.8), back: Math.ceil(i / 2) * (1.4 + Math.random()) + Math.random() * 0.6, y: 3 + Math.random() * 2, ph: Math.random() * TAU }));
      for (const b of birds) b.h.visible = true;
      const back = Math.max(...birds.map((b) => b.back));
      seaActive.set(kind, { t: 0, dur: (2 * L + back) / SPEED, step(s) {
        for (const b of birds) {
          const u = s.t * SPEED - L - b.back; const sway = Math.sin(s.t * 0.7 + b.ph);
          b.h.position.set(c.x + dir.x * u + dir.z * b.side, b.y + Math.sin(s.t * 0.45 + b.ph) * 0.7, c.z + dir.z * u - dir.x * b.side); // rising and gliding down
          b.h.rotation.set(Math.sin(s.t * 0.45 + b.ph + 1.2) * 0.12, Math.atan2(dir.x, dir.z) + sway * 0.12, sway * 0.2); // its front +z along the way, banking a little
        }
      }, end() { for (const b of birds) b.h.visible = false; } });
    } else if (kind === 'dolphins') { // two or three leaping one after another
      const at = seaSpot(18, 40, 8); if (!at) return false;
      const n = 2 + Math.floor(Math.random() * 2); const heading = Math.random() * TAU; const fwd = { x: Math.sin(heading), z: Math.cos(heading) };
      const pod = pool.dolphins.slice(0, n).map((h, i) => ({ h, delay: i * 0.45, side: (i - (n - 1) / 2) * 1.6, splashed: 0 }));
      const LEAP = 1.15; const GAP = 0.7; const LEAPS = 3; const RUN = 4.5;
      seaActive.set(kind, { t: 0, dur: LEAPS * (LEAP + GAP) + 1.2, step(s) {
        for (const d of pod) {
          const t = s.t - d.delay; const k = Math.floor(t / (LEAP + GAP)); const u = (t - k * (LEAP + GAP)) / LEAP;
          const inAir = t >= 0 && k < LEAPS && u <= 1; d.h.visible = inAir;
          if (!inAir) continue;
          const along = (k + u) * RUN; const y = SEA_Y - 0.5 + Math.sin(u * Math.PI) * 1.9;
          d.h.position.set(at.x + fwd.x * along - fwd.z * d.side, y, at.z + fwd.z * along + fwd.x * d.side);
          d.h.rotation.set(-Math.cos(u * Math.PI) * 0.9, heading, 0); // nose up going out, down going in
          const edge = u < 0.08 ? k * 2 + 1 : u > 0.92 ? k * 2 + 2 : 0; // a splash going out and coming back in
          if (edge && edge > d.splashed) { d.splashed = edge; assets.once('sea.splash', { parent: scene, x: d.h.position.x, y: SEA_Y, z: d.h.position.z }); }
        }
      }, end() { for (const d of pod) d.h.visible = false; } });
    }
    seaShown[kind] = (seaShown[kind] || 0) + 1;
    return true;
  }
  function stepSea(dt) {
    for (const [kind, s] of seaActive) { s.t += dt; if (s.t >= s.dur) { s.end(); seaActive.delete(kind); } else s.step(s); }
    if (quality === 0 || overview) return;
    for (const [kind, [a, b]] of Object.entries(SEA)) {
      if (clock < seaNext[kind]) continue;
      seaNext[kind] = clock + a + Math.random() * (b - a);
      if (seaFree() && seaSight(kind)) seaLast = clock;
    }
  }
  function step(dt) {
    let ix = 0; let iz = 0;
    if (sitting && !isBlocked() && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].some((k) => keys.has(k))) standUp(); // v1.10.44: an arrow stands me up
    if (!isBlocked() && !gather && !riding && !liftRide) { // v1.10.40: gathering holds me in place (the keys stay pressed for after); v1.10.47 so does the train
      if (keys.has('ArrowLeft')) ix -= 1; if (keys.has('ArrowRight')) ix += 1;
      if (keys.has('ArrowUp')) iz -= 1; if (keys.has('ArrowDown')) iz += 1;
    } else if (isBlocked()) keys.clear();
    turnCamera(camDt); // v1.10.21
    const moving = ix !== 0 || iz !== 0;
    if (moving) {
      const len = Math.hypot(ix, iz); ix /= len; iz /= len;
      const sin = Math.sin(camYaw); const cos = Math.cos(camYaw); // keys are relative to the view
      const wx = ix * cos + iz * sin; const wz = -ix * sin + iz * cos;
      tryMove(me.root.position.x + wx * SPEED * dt, me.root.position.z + wz * SPEED * dt);
      me.targetYaw = Math.atan2(wx, wz);
    }
    stepPlatform(); stepRide(); stepQuestScenes(dt);
    animate(me, dt, moving);
    stepOthers(dt);
    stepWanderers(dt);
    const now = performance.now(); stepBubble(me, now); for (const o of others.values()) stepBubble(o.c, now);
    // v1.10.37 원거리 (사용자 2026-10-07 「말풍선은 숨겨도 이름표는 보이게」): far off the bubble goes, the name tag stays --
    // out of the fog like the figure, even where its place is only roughly right
    for (const o of others.values()) { const far = Math.hypot(o.c.root.position.x - me.root.position.x, o.c.root.position.z - me.root.position.z) > FAR_TAG; if (o.c.bubble) o.c.bubble.visible = !far; }
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
      if (d < (door.resource ? WEED_REACH : EVENT_REACH) && d < bestD + 1) { best = id; bestD = d - 1; }
    }
    // v1.10.47 관광열차: on board, SPACE gets off at a stop (between stops the hint says which comes next); by a stop's
    // boarding spot, SPACE gets on the train standing there (or the hint says when the next one comes)
    for (const k of Object.keys(eventDoors)) if (k.startsWith('train:')) delete eventDoors[k];
    if (best && !doorOf(best)) best = null;
    if (riding) {
      const st = R.trainAt(riding.id, trainNow()); const m = me.root.position;
      eventDoors['train:ride'] = st.held ? { x: m.x, z: m.z, name: '안전 대기', plain: true } : st.stop && st.wait > .7 && st.wait <= R.DWELL - .7 ? { x: m.x, z: m.z, name: `내리기 · ${R.stationOf(st.stop).name}` } : st.stop ? { x: m.x, z: m.z, name: `정차 중 · ${R.stationOf(st.stop).name}`, plain: true } : { x: m.x, z: m.z, name: `다음 정류장 · ${R.stationOf(st.next).name} ${Math.ceil(st.eta)}초`, plain: true };
      best = 'train:ride';
    } else if (platform) {
      const dock = R.docked(trainNow(), platform.station).find((d) => d.line === platform.line);
      const m = me.root.position;
      const key = dock && !liftRide ? 'train:board' : 'train:platform';
      eventDoors[key] = { x: m.x, z: m.z, plain: Boolean(liftRide), name: liftRide ? '승강기' : dock ? R.LINES[platform.line].name + ' 타기' : R.LINES[platform.line].name + ' · 도착 ' + (R.nextAt(platform.station, trainNow())[platform.line] === null ? '대기' : R.nextAt(platform.station, trainNow())[platform.line] + '초') };
      best = key;
    } else if (!gather && !fishing && !liftRide) {
      const m = me.root.position;
      for (const [id, st] of Object.entries(R.STATIONS)) {
        if (Math.hypot(st.entry[0] - m.x, st.entry[1] - m.z) > 2.6) continue;
        eventDoors['train:enter:' + id] = { x: st.entry[0], z: st.entry[1], name: st.name + ' 승강기' };
        best = 'train:enter:' + id; break;
      }
    }
    // v1.10.44: a free seat right by me (SPACE · 앉기), or another player beside me (SPACE · 인사) when nothing else is near
    for (const k of Object.keys(eventDoors)) if (k.startsWith('seat:') || k.startsWith('player:')) delete eventDoors[k];
    if (best && !doorOf(best)) best = null; // the one picked above may have been last frame's seat or player
    if (!best && !gather && !fishing) {
      const m = me.root.position; let seat = null; let sd = 1.6;
      for (const s of SEATS) { const d = Math.hypot(s.x - m.x, s.z - m.z); if (d < sd && !takenSeats.has(s.id)) { seat = s; sd = d; } }
      if (seat) { eventDoors[`seat:${seat.id}`] = { x: seat.x, z: seat.z, name: '앉기' }; best = `seat:${seat.id}`; }
      else {
        let who = null; let wd = 2.2;
        for (const [id, o] of others) { const d = Math.hypot(o.c.root.position.x - m.x, o.c.root.position.z - m.z); if (d < wd) { who = [id, o]; wd = d; } }
        if (who) { eventDoors[`player:${who[0]}`] = { x: who[1].c.root.position.x, z: who[1].c.root.position.z, name: '인사' }; best = `player:${who[0]}`; }
      }
    }
    // v1.10.42 낚시: by the water with nothing else near -- SPACE casts; while fishing it pulls in (or stops before the bite)
    if (fishing || (!best && !gather && globalThis.IslandTerrain.canFish(me.root.position.x, me.root.position.z))) {
      const w = fishing ? fishing.water : waterFrom(me.root.position.x, me.root.position.z);
      if (w) { eventDoors['fish:spot'] = { x: w.x, z: w.z, name: fishing ? (fishing.phase === 'bite' ? '당기기' : '그만하기') : '낚시' }; best = 'fish:spot'; } else delete eventDoors['fish:spot'];
    } else delete eventDoors['fish:spot'];
    if (best !== near || (best && doorOf(best)?.name !== nearName)) { near = best; nearName = near ? doorOf(near).name : null; onNear?.(near ? { id: near, name: nearName, plain: Boolean(doorOf(near).plain) } : null); }
    me.lookAt = near ? Math.atan2(doorOf(near).x - me.root.position.x, doorOf(near).z - me.root.position.z) : null;
    for (const o of eventObjs.values()) { const spin = o.root.userData.spin; if (spin) { if (spin.isMesh) spin.rotation.z = clock * 2.4; else spin.rotation.y = clock * 2.4; spin.position.y = (spin.isMesh ? 0.35 : 0.2) + Math.sin(clock * 2) * 0.05; } }
    stepWeeds(dt); // v1.10.31
    stepFishing(dt); // v1.10.42
    if (photoMode) hideForPhoto(); // v1.10.43 (bubbles are shown again by their own updates)
    // v1.10.46: the shadow's square moves in whole texels of its map across the light (it followed me smoothly, so the
    // edges of every shadow crawled as I walked -- seen on the town hall's marble)
    const texel = (sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.x; const at = me.root.position;
    const a = at.dot(SUN_U); const b = at.dot(SUN_V);
    sun.target.position.copy(at).addScaledVector(SUN_U, Math.round(a / texel) * texel - a).addScaledVector(SUN_V, Math.round(b / texel) * texel - b);
    sun.position.copy(sun.target.position).add(SUN_OFF);
    assets.update(me.root.position.x, me.root.position.z); // v1.10.17: near squares of registered nature show their model
    assets.tick(dt, me.root.position.x, me.root.position.z); // v1.10.29: one-off clips (the whale) and the falling flakes
    for (const c of statueChars) if (c.anim && !c.frozen) { c.anim.play('wave'); c.anim.update(0.7, 0); c.frozen = true; c.root.userData.occlusionRevision = (c.root.userData.occlusionRevision || 0) + 1; } // v1.10.30: a statue's wave, set once
    stepWhale(); stepSea(dt); // v1.10.32: the sea's other sights
    // v1.10.27: the season day by the server clock, checked every few seconds -- at 00:00 KST every season moves one zone
    // clockwise and the models swap in place for whoever is on the island (their files are already in the resource cache)
    if (clock - seasonCheckedAt > 2 && seasonOverride === null) { seasonCheckedAt = clock; setSeasonDay(globalThis.IslandTerrain.seasonDay(Date.now() + serverOffset)); }
    island.step(clock); refreshMapBoard(); refreshMinimap(performance.now());
    drops.forEach((d) => { const t = (clock * 0.7 + d.userData.phase) % 1; const a = d.userData.phase * TAU; d.position.set(Math.cos(a) * t * 1.4, 2.3 + Math.sin(t * Math.PI) * 0.9 - t * 1.6, Math.sin(a) * t * 1.4); });
    lamps.forEach((l, i) => { l.material.emissiveIntensity = (night ? 1.7 : 0.55) + Math.sin(clock * 1.5 + i) * 0.05; });
    if (clock - halloweenCheckedAt > 5) { halloweenCheckedAt = clock; setHalloween(halloweenOverride ?? isHalloween(Date.now() + serverOffset)); }
    decor.step(clock, camera, Boolean(lessMotion?.matches));
    yard.step(dt, me, animate); // v1.10.41 the mayor
    train.step(trainNow()); // v1.10.47 the three trains, where the server clocks have them
    if (night) { // a candle inside: slow, small changes; still when less motion is asked
      const f = lessMotion?.matches ? 1 : 0.88 + Math.sin(clock * 2.3) * 0.06 + Math.sin(clock * 5.1 + 1.3) * 0.04;
      candle.intensity = 38 * f; for (const m of lanternGlows) m.emissiveIntensity = 1.6 * f;
    }
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
    if (c.carrying) { c.armL.rotation.set(-1.15, 0, -0.35); c.armR.rotation.set(-1.15, 0, 0.35); } // v1.10.32: holding it in front
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
  function stop() {
    setPhotoMode(false); if (gather?.waitServer) endGather(false);
    if (questScenes && (questScenes.departurePending || questScenes.departure !== null)) { questScenes.departurePending = false; questScenes.departure = null; questScenes.boat.visible = false; }
    questDepartureHeld = false; running = false; cancelAnimationFrame(raf); keys.clear();
    near = null; nearName = null; onNear?.(null);
  }
  const disposeWanderers = () => { clearTimeout(wanderersTimer); for (const w of wanderers) disposeCharacter(w.c); wanderers.length = 0; };
  function dispose() {
    stop(); observer.disconnect();
    document.removeEventListener('visibilitychange', resetFrameSample);
    occlusion.dispose(); assets.dispose();
    for (const o of others.values()) disposeCharacter(o.c); others.clear(); disposeWanderers();
    window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur);
    renderer.domElement.removeEventListener('click', onClick); renderer.domElement.removeEventListener('pointermove', onMove);
    renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointerup', onUp); renderer.domElement.removeEventListener('pointercancel', onUp);
    scene.traverse((o) => { if (o.isMesh) o.geometry.dispose(); if (o.isSprite) o.material.dispose(); });
    mats.forEach((m) => m.dispose()); vcMat.dispose(); textures.forEach((t) => t.dispose()); island.dispose(); decor.dispose(); yard.dispose(); train.dispose();
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
    return { x: p.x, z: p.z, yaw: me.root.rotation.y, near, running, quality, webgl, assets: assets.debug(), holdQuality: (tier) => { qualityHeld = true; quality = tier; assets.setQuality(tier); }, setSeasonDay: (d) => { seasonOverride = d; setSeasonDay(d ?? globalThis.IslandTerrain.seasonDay(Date.now() + serverOffset)); }, seasonDay: () => globalThis.IslandTerrain.seasonDay(Date.now() + serverOffset), gait: me.anim?.state ?? null, doors: { ...doors }, screenOf, place: (id) => { const d = doorOf(id); if (d) { tryMove(d.x, d.z); placeCamera(true); } }, look: me.look || {}, title: me.title || null, champion: Boolean(me.champion), hoguking: Boolean(me.hoguking), statues: statueList.map(({ rank, name }) => ({ rank, name })), wardrobe: me.wardrobe || null, statueSizes: statueChars.map((c) => +c.root.scale.x.toFixed(2)), whale: () => whale(true), sea: { show: (kind) => seaSight(kind), inPicture, active: () => [...seaActive.keys()], shown: () => ({ ...seaShown }), at: () => (seaPool ? Object.fromEntries(Object.entries(seaPool).map(([k, hs]) => [k, hs.filter((h) => h.visible).map((h) => ({ x: +h.position.x.toFixed(1), y: +h.position.y.toFixed(1), z: +h.position.z.toFixed(1) }))])) : {}) }, carry: { mine: me.carryId || null, arms: Boolean(me.carrying), held: Boolean(me.carryStand?.parent || me.holding?.carry), on: me.holding?.carry?.object?.parent?.name || (me.carryStand?.parent ? 'stand' : null), others: [...others.values()].filter((o) => o.c.carryId).length }, gather: gather ? { kind: gather.kind, id: gather.id, t: gather.t, pending:gather.pending } : null, weeds: { count: weedById.size, near: weedKey, gathering: gather?.kind === 'weed' ? gather.id : null, at: (id) => { const w = weedById.get(id); return w ? { x: w.x, z: w.z } : null; } }, tag: Boolean(me.tag), wornColors: me.wornColors || null, farSight: () => [...others.values()].map((o) => ({ tag: Boolean(o.c.tag?.visible && o.c.tag.material.fog === false), bubble: o.c.bubble ? o.c.bubble.visible : null, clear: (o.c.wearMats || []).every((r) => r.material.fog === false) && (o.c.wearMats || []).length > 0 })), resources: () => [...eventObjs].filter(([k,o])=>o.root.userData.fruit).map(([key,o])=>({key,fruit:o.root.userData.fruit.visible,x:o.root.position.x,z:o.root.position.z})), resourceRing:()=>({visible:weedRing.visible,x:weedRing.position.x,z:weedRing.position.z}), questScenes: () => questScenes ? { flower: questScenes.bloom.visible ? 'bloom' : 'empty', frame: questScenes.frame.visible, boat: questScenes.boat.visible, departing: questScenes.departure !== null } : null, quests: () => [...eventObjs].filter(([k]) => k.startsWith('ev:quest_npc:')).map(([k, o]) => ({ id: k.split(':')[2], mark: o.mark ?? null, worn: Boolean(o.npc?.assetRoot) })), fishBiteNow: () => { if (fishing && (fishing.phase === 'wait' || fishing.phase === 'cast')) { fishing.biteAt = fishing.t; fishing.biteEnd = fishing.t + 1.5; } }, fishing: () => (fishing ? { phase: fishing.phase, rod: Boolean(me.holding?.rod?.object), held: Boolean(me.holding?.catch?.object), line: fishLine.visible, bobber: bobberHolder.visible, clip: me.anim?.clip || null } : null), canFish: () => globalThis.IslandTerrain.canFish(me.root.position.x, me.root.position.z), photo: () => ({ on: photoMode, hidden: photoHidden.size }), act: () => ({ ...myAct, tail: Boolean(me.tailTucked), sitting: Boolean(sitting), clip: me.anim?.clip || null, lift: +(me.root.position.y - heightAt(me.root.position.x, me.root.position.z)).toFixed(2) }), takenSeats: () => Object.fromEntries(takenSeats), seats: SEATS, othersActs: () => [...others].map(([id, o]) => ({ id, act: o.act, seat: o.seat, clip: o.c.anim?.clip || null, lift: +(o.c.root.position.y - heightAt(o.c.root.position.x, o.c.root.position.z)).toFixed(2) })), townhall: () => yard.debug(), train: () => ({ ...train.debug(), shift: trainShift, platform, lifting: Boolean(liftRide), riding: riding ? { id: riding.id, seat: riding.seat } : null, y: +me.root.position.y.toFixed(2), othersRiding: [...others.values()].filter((o) => o.ride).length }), halloween: { decor: () => decor.debug(), launchBats: (at) => decor.launchBats(at), on: () => night, set: (v) => { halloweenOverride = v; halloweenCheckedAt = -Infinity; }, fountain: () => fountain.visible, candle: () => candle.intensity, glows: () => lanternGlows.length, glass: () => assets.debug().glass, background: () => scene.background.getHex() }, tagLayout: me.tag ? { headTop: me.headTop, bottom: me.tag.position.y, top: me.tag.position.y + me.tag.scale.y, rows: me.tag.userData.rows, bubbleBottom: me.bubble ? me.bubble.position.y - me.bubble.scale.y / 2 : null } : null,
      teleport: (x, z) => { me.root.position.set(x, heightAt(x, z), z); correction = null; placeCamera(true); },
      bubble: me.bubble?.userData.text || null, render: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }, camYaw, minimap: { turn: minimapTurn, markers: minimapShown }, events: Object.fromEntries(Object.entries(eventDoors).map(([k, d]) => [k, { ...d }])), events: [...eventObjs.keys()], lastReturn, wanderers: wanderers.map(({ n, c, w }) => ({ n, x: w.x, y: c.root.position.y, z: w.z, visible: c.root.visible, speed: w.speed, grounded: Math.abs(c.root.position.y - heightAt(w.x, w.z)) < 1e-4, walkable: walkable(w.x, w.z), clear: walkers.clear(w.x, w.z), bx: w.bx, bz: w.bz, baseClear: walkers.clear(w.bx, w.bz) && walkable(w.bx, w.bz), off: Math.hypot(w.x - w.bx, w.z - w.bz), resyncs: walkers.resyncs() })), wandererR: IslandNpcs?.WALKER.R, wandererSep: IslandNpcs?.WALKER.SEP, serverNow: () => Date.now() + serverOffset, markers: mapMarkers.map((m) => ({ ...m })), walkable, heightAt, bridges: island.bridges, pier: island.pier, spawn: SPAWN, overview: (on) => { overview = Boolean(on); placeCamera(true); }, setCamYaw: (y) => { camYaw = y; yawGoal = y; placeCamera(true); }, camPitch, pitchGoal, pitchMax: PITCH_MAX, skyMax: SKY_MAX, camDist, setCamPitch: (v) => { camPitch = clampPitch(v); pitchGoal = camPitch; placeCamera(true); },
      camera: { x: camera.position.x, y: camera.position.y, z: camera.position.z, clear: camera.position.y - heightAt(camera.position.x, camera.position.z),faded: occlusion.debug().faded, occlusion: occlusion.debug(), inBuilding: camera.position.y < me.root.position.y + CAM_OVER - 0.05 && buildingSolids.some((s) => Math.hypot(camera.position.x - s.x, camera.position.z - s.z) < s.r) }, radiusAt: playerRadiusAt, others: [...others].map(([id, o]) => ({ id, x: o.c.root.position.x, z: o.c.root.position.z, tag: Boolean(o.c.tag), champion: Boolean(o.champion), hoguking: Boolean(o.hoguking), bubble: o.c.bubble?.userData.text || null, look: o.look || {} })) };
  }
  // The island map in a window (안내 지도): drawn into the caller's canvas with where I stand now.
  const drawMap = (canvas) => island.drawMap(canvas.getContext('2d'), canvas.width, canvas.height, { x: me.root.position.x, z: me.root.position.z });
  // v1.10.2: a chat message over someone's head ('me' or another player's id)
  const speak = (id, text) => say(id === 'me' ? me : others.get(id)?.c, text);
  const setStatuesPublic = (list) => setStatues(list);
  const setEventsPublic = (list) => setEvents(list);
  // v1.10.31: an event's motion when the server took it (pick up, give back, a photo), the weed in hand
  const playMine = (name) => Boolean(me.anim?.play(name));
  const holdWeed = () => assets.hold(me, 'prop.weedRooted', 900);
  const holdBasket = () => assets.hold(me, 'prop.event.basket', 1400); // v1.10.32: picking herbs, berries, mushrooms
  const setMapMarkers = (list) => { mapMarkers = Array.isArray(list) ? list.filter((m) => Number.isFinite(m?.x) && Number.isFinite(m?.z)) : []; minimapAt = 0; };
  const setTownhallPass = (on) => yard.setPass(on); const mayorLine = () => yard.line(); // v1.10.41
  const fishingNow = () => (fishing ? fishing.phase : null); // v1.10.42
  // v1.10.44 앉기·이모트 (IDEAS ④): a seat on a plaza bench (the server keeps who sits), a wave or a cheer -- each sent with
  // my pose (act, a count telling a new wave from the last), played on everyone's screen with the same clips
  const SEATS = globalThis.IslandTerrain.plazaProps().seats;
  // v1.10.46: SEATS 0.18 ahead of the bench's middle (island-terrain): a cape (0.41 behind the hips at most) clears its back
  // v1.10.45: SitIdle has the hips 0.38 up and the seat of the body 0.26 up; the bench's seat (at its 0.85 size) is 0.54
  // up -- lifted by the difference, I sit on it instead of in it
  const SEAT_LIFT = 0.28;
  const myAct = { act: null, n: 0, seat: null }; let sitting = null; const takenSeats = new Map(); // seat -> other player id
  // v1.10.47 관광열차: on board (the server gave me train k's seat), I sit on it wherever the train is -- the arrows do nothing,
  // the camera turns as ever; SPACE at a stop gets off (app: /api/island/train/alight) onto that stop's boarding spot
  const R = globalThis.IslandTrain; let platform = null; let liftRide = null; let trainChangedAt = 0; let trainShift = 0; // tests only: the server moved the trains' clock
  const trainNow = () => Date.now() + serverOffset + trainShift;
  function board(id, seat) {
    if (riding || !R.TRAINS.some((t) => t.id === id) || !R.SEATS[seat]) return false;
    if (sitting) standUp(); if (gather) endGather(false); if (fishing) fishStop?.();
    trainChangedAt = Date.now(); platform = null; liftRide = null; riding = { id, seat, at: Date.now(), from: me.root.position.clone() }; keys.clear(); me.anim?.play?.('sitDown'); me.anim?.loop?.('rideLook') || me.anim?.loop?.('sitIdle'); // RideLookAround: seated, looking about
    me.noTuck = true; me.tailTucked = true; me.tuckTail?.(true); stepRide();
    return true;
  }
  function alight(spot) {
    if (!riding) return false; trainChangedAt = Date.now(); riding = null; me.noTuck = false;
    if (!spot) { const m = me.root.position; spot = Object.values(R.STATIONS).map((s) => ({ x: s.entry[0], z: s.entry[1] })).sort((a, b) => Math.hypot(a.x - m.x, a.z - m.z) - Math.hypot(b.x - m.x, b.z - m.z))[0]; } // the server lost my ride (a restart): off at the nearest stop
    me.anim?.release?.(); me.tailTucked = false; me.tuckTail?.(false);
    if (spot?.platform) { me.anim?.play?.('standUp'); setPlatform(spot); return true; }
    if (spot && Number.isFinite(spot.x) && Number.isFinite(spot.z)) { me.root.position.set(spot.x, heightAt(spot.x, spot.z), spot.z); correction = null; placeCamera(true); }
    return true;
  }
  function stepRide() {
    if (!riding) return;
    const q = R.seatAt(riding.id, riding.seat, trainNow());
    const u = Math.min(1, (Date.now() - riding.at) / 450);
    if (u < 1 && riding.from) me.root.position.lerpVectors(riding.from, new THREE.Vector3(q.x, q.y, q.z), u); else me.root.position.set(q.x, q.y, q.z);
    me.root.rotation.y = q.yaw; me.targetYaw = q.yaw;
  }
  function setPlatform(result) {
    trainChangedAt = Date.now(); const prev = platform; platform = result.platform || null;
    if (sitting) standUp(); if (gather) endGather(false); if (fishing) fishStop();
    const station = platform?.station || prev?.station || result.stop;
    const target = platform ? R.platformSpot(platform.line, platform.station, platform.slot) : { x: result.x, y: heightAt(result.x, result.z), z: result.z };
    const from = me.root.position.clone(); const lift = R.liftOf(station);
    liftRide = { station, from, to: target, lift, start: Date.now(), ms: Math.abs(from.y - target.y) > 1 ? 1800 : 450 };
    keys.clear(); correction = null; me.anim?.release?.();
  }
  function stepPlatform() {
    if (liftRide) {
      const r = liftRide; const u = Math.min(1, (Date.now() - r.start) / r.ms);
      const target = new THREE.Vector3(r.to.x, r.to.y, r.to.z);
      if (r.ms < 1000) me.root.position.lerpVectors(r.from, target, u);
      else if (u < 0.2) me.root.position.lerpVectors(r.from, new THREE.Vector3(r.lift.x, r.from.y, r.lift.z), u / 0.2);
      else if (u < 0.8) me.root.position.set(r.lift.x, THREE.MathUtils.lerp(r.from.y, r.to.y, (u - 0.2) / 0.6), r.lift.z);
      else me.root.position.lerpVectors(new THREE.Vector3(r.lift.x, r.to.y, r.lift.z), target, (u - 0.8) / 0.2);
      train.liftAt?.(r.station, me.root.position.y); if (u === 1) liftRide = null;
    } else if (platform && !riding) {
      const q = R.platformClamp(platform.line, platform.station, me.root.position.x, me.root.position.z); me.root.position.set(q.x, q.y, q.z);
    }
  }
  function sit(seatId) {
    const s = SEATS.find((x) => x.id === seatId); if (!s || gather || fishing) return false;
    if (!startGather({ kind: 'sit', ms: Infinity, anim: 'sitDown', onDone: () => standUp(false) })) return false;
    sitting = { seat: s, t: 0, from: { x: me.root.position.x, z: me.root.position.z } };
    me.root.position.set(s.x, heightAt(s.x, s.z) + SEAT_LIFT, s.z); me.root.rotation.y = s.yaw; me.targetYaw = s.yaw;
    me.anim?.loop?.('sitIdle'); me.tailTucked = true; me.tuckTail?.(true); myAct.act = 'sit'; myAct.seat = s.id;
    return true;
  }
  function standUp(release = true) {
    if (!sitting) return; const s = sitting.seat; sitting = null;
    myAct.act = null; myAct.seat = null; me.tailTucked = false; me.tuckTail?.(false); me.anim?.release?.(); me.anim?.play('standUp');
    me.root.position.set(s.x + Math.sin(s.yaw) * 1.0, heightAt(s.x, s.z), s.z + Math.cos(s.yaw) * 1.0); // a step forward, off the bench
    if (release && gather?.kind === 'sit') { gather.onDone = () => {}; endGather(false); }
    onInteract?.('seat:stand');
  }
  function emote(kind) { if (gather || fishing || me.carrying || !['wave', 'cheer', 'nod', 'clap', 'bow'].includes(kind)) return false; me.anim?.play(kind) || (me.hop = 1); myAct.act = kind; const n = ++myAct.n; setTimeout(() => { if (myAct.n === n && myAct.act === kind) myAct.act = null; }, kind === 'clap' ? 1800 : 1500); return true; }
  // v1.10.43 기념사진 모드 (IDEAS ③): I stay put (the camera turns, up to the sky), every name tag and bubble hidden; the
  // shot is the canvas alone (no page UI), drawn and read in the same task, saved as a PNG on the PC (nothing uploaded)
  let photoMode = false; const photoHidden = new Set();
  function setPhotoMode(on) {
    if (on === photoMode) return true;
    if (on) {
      if (gather || fishing) return false;
      if (!startGather({ kind: 'photo', ms: Infinity, anim: null, onDone: () => setPhotoMode(false) })) return false;
      photoMode = true; return true;
    }
    photoMode = false; for (const o of photoHidden) o.visible = true; photoHidden.clear();
    if (gather?.kind === 'photo') { gather.onDone = () => {}; endGather(false); }
    onPhotoEnd?.();
    return true;
  }
  let onPhotoEnd = null;
  const hideForPhoto = () => scene.traverse((o) => { if (o.isSprite && o.visible) { o.visible = false; photoHidden.add(o); } });
  const photoPose = (on = true) => { if (!on) return me.anim?.release?.(); me.targetYaw = Math.atan2(camera.position.x - me.root.position.x, camera.position.z - me.root.position.z); return me.anim?.loop?.('photo'); }; // turned to the camera, held through the countdown and the shot
  function capture() { if (!photoMode) return Promise.resolve(null); hideForPhoto(); renderer.render(scene, camera); return new Promise((resolve) => renderer.domElement.toBlob(resolve, 'image/png')); }
  return { canInteract, holdQuestDeparture, trainDocked: (station) => R.docked(trainNow(), station), trainChangedAt: () => trainChangedAt, setPlatform, platform: () => platform, board, alight, riding: () => (riding ? { ...riding } : null), setTrainService: (snapshot) => R.setService(snapshot), setTrainShift: (ms) => { trainShift = Number(ms) || 0; }, sit, standUp, emote, setPhotoMode: (on, onEnd = null) => { if (on) onPhotoEnd = onEnd; return setPhotoMode(on); }, photoPose, capture, fishBegin, fishResult, fishStop, fishingNow, setTownhallPass, mayorLine, start, stop, dispose, debug, interact, setAvatar, setOthers, pose, correctTo, drawMap, speak, setMapMarkers, setStatues: setStatuesPublic, setEvents: setEventsPublic, setServerTime, setWeeds, removeWeeds, gatherWeed, gatherResource, finishGather, holdWeed, holdBasket, returnLost, playMine,
    lostName: (id) => (lostProp(id) === 'prop.event.lost_pouch' ? '작은 주머니' : '곰 인형') }; // v1.10.34: what the owner lost (its look)
}
