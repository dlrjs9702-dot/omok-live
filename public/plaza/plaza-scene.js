// v1.8.8 3D 광장 로비 V1: a small daytime village square that is the lobby's hub. Self-made primitive models only,
// no external assets. Kept apart from the RPG scene (public/rpg/rpg-scene.js): the two share Three.js, nothing else.
// The scene knows facility ids and names only; what a facility opens is the caller's `onInteract(id)`.
import * as THREE from '/vendor/three/three.module.js';
import './remote-motion.js'; // an older page may not include the classic dependency script
import { buildIsland, building, props, part, mergeColored, heightAt, walkable, SPOTS, COTTAGES, STATUE_SPOTS, RESERVED_LOTS, SPAWN, PLAZA_R } from './island.js';
import { halloweenDecor } from './island-halloween.js';
import { townhallYard } from './island-townhall.js';
import { trainScene } from './island-train-scene.js';
import { createOcclusion } from './occlusion.js';
import { cameraEase, cameraSkyAim } from './camera-motion.js';

const TAU = Math.PI * 2;
// v1.10.79 이동 3단계 (assets 36): 느리게 걷기 1.0 / 걷기 4.2 / 뛰기 6.2 units per second. Shift (or the phone's 걸음
// button) tapped switches the two walks; held 0.3 s it runs until let go, then the walk it was comes back.
const SPEED = 4.2; const SLOW_SPEED = 1; const RUN_SPEED = 6.2; const RUN_HOLD_MS = 300;
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
// directly imported too, so an older page can load the current scene)
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
// CI 3차: automated tests draw the island lighter -- no antialiasing, half the pixels. Headless Chrome draws WebGL in
// software and composites it by reading every frame back (GLES2::ReadPixels): the page's main thread waits out the whole
// frame, 0.5 s here and seconds on the CI runner, and a test's page.evaluate waited behind it (the bicycle stairs poll
// past 10 s). Off: 0.48 -> 0.33 s a frame, then half the pixels 0.17 s. Only navigator.webdriver; people see no change.
const TEST_DRAW = typeof navigator !== 'undefined' && Boolean(navigator.webdriver);
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
    try { return { renderer: new THREE.WebGLRenderer(TEST_DRAW ? { ...options, antialias: false } : options), attempt, gpu }; } catch (error) { errors.push(error?.message || String(error)); }
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TEST_DRAW ? 0.5 : 1.5)); // (automated tests: 0.5 -- the CI runner draws in software, TEST_DRAW; a phone profile is 2.75)
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
  function makeTag(name, title, champion = false, hoguking = false, delinquent = false) {
    const pills = delinquent ? [{ text: '체납자', from: '#ef4444', to: '#7f1d1d', ink: '#ffffff' }] // v1.10.86: over every other title while owing
      : [champion && { text: '챔피언', from: '#ffd86b', to: '#f0b429', ink: '#4a2a00' }, hoguking && { text: '호구왕', from: '#c4a5ff', to: '#8b5cf6', ink: '#ffffff' }].filter(Boolean);
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
  const island = buildIsland(scene, { mat, mesh, solids, assets, software: /swiftshader|llvmpipe|softpipe|software/i.test(made.gpu || '') }); // (B 48: no ground grain without a GPU)
  // v1.10.29: a season day moves the models (assets) and the ground's colours (island) together
  const setSeasonDay = (day) => { assets.setDay(day); island.setSeasonDay(day); };
  island.setSeasonDay(globalThis.IslandTerrain.seasonDay(Date.now()));
  const PLAZA_C = globalThis.IslandTerrain.PLAZA_C || { x: 0, z: 0 }; // (달마루섬: 대청마당's middle)
  const PH = heightAt(PLAZA_C.x, PLAZA_C.z);
  // 달마루섬 미리보기 (dalmaru-island.js): the new island with its walks and buildings, but what the server places --
  // the islanders, events, statues, plants, other players -- and the train, the old town hall's yard and the seasons'
  // decorations stay away until the server has the new island too (step 5)
  const fountain = new THREE.Group(); fountain.position.set(PLAZA_C.x, PH, PLAZA_C.z); scene.add(fountain);
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
  solids.push({ x: PLAZA_C.x, z: PLAZA_C.z, r: 3.4 }); // (the fountain)
  // v1.10.36 10월 할로윈 (IDEAS, 사용자 확정 2026-10-06): all October (Asia/Seoul) the island is at night -- the sky, the
  // fog and the light; the seasons, their zones and the plaza stay as they are -- and the fountain gives its place to a
  // pedestal with a jack-o'-lantern bigger than it, lit from inside (an orange light on what is near, a slow candle
  // flicker; held still when the PC asks for less motion). Its footprint is the fountain's, so walking is unchanged.
  // The 2026-10-06 Halloween pack's models (landmark.halloween.*) replace the stand-in drawn here.
  const halloween = new THREE.Group(); halloween.position.set(PLAZA_C.x, PH, PLAZA_C.z); halloween.visible = false; scene.add(halloween); // (on the fountain's place)
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
  // v1.10.90 섬 시간대 (IDEAS #future-admin-console ①, 사용자 확정): morning, day, evening and night, by Seoul's clock
  // (자동) or held at one by the administrator; Halloween's decorations follow October alone, its purple only tints the night
  const LIGHTS = {
    morning: { background: 0xffd9c2, fog: 0xffe6d6, sky: 0xffe1c7, ground: 0x9cc77a, hemi: 0.95, sun: 0xffc9a0, sunI: 1.35 },
    day: DAY,
    evening: { background: 0xf29a73, fog: 0xe8a58c, sky: 0xffb08a, ground: 0x6a6a5a, hemi: 0.8, sun: 0xff9a5c, sunI: 1.0 },
    night: { background: 0x0b1530, fog: 0x16233f, sky: 0x5a6fa8, ground: 0x1f2c44, hemi: 0.6, sun: 0x9fb4ff, sunI: 0.55 },
  };
  const phaseAt = (ms) => { const h = new Date(ms + 9 * 3600000).getUTCHours(); return h >= 6 && h < 10 ? 'morning' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'evening' : 'night'; };
  let timeMode = 'auto'; let lightKey = null; let decorOn = null; let phase = 'day';
  let night = null; let halloweenOverride = null;
  const lampModel = () => lamps.length > 0 && !lamps[0].parent.visible; // v1.10.38: the lamp model stands in place of the stand-in
  const isHalloween = globalThis.IslandTerrain.isHalloween; // October, Asia/Seoul
  function setIsland(halloweenOn, now) {
    // (every few seconds) the decorations, then the light of this time of day
    phase = halloweenOverride != null ? (halloweenOverride ? 'night' : 'day') : timeMode === 'auto' ? phaseAt(now) : timeMode;
    if (decorOn !== halloweenOn) { decorOn = halloweenOn; halloween.visible = halloweenOn; decor.setOn(halloweenOn); }
    const winterOn = !halloweenOn && (decorMode === 'winter' || (decorMode === 'auto' && globalThis.IslandTerrain.isWinterFest(now))); setWinter(winterOn);
    fountain.visible = !halloweenOn && !winterOn; // (the pumpkin or the tree stands on the fountain's spot)
    const dark = phase === 'night'; const lit = dark || phase === 'evening'; const wet = weatherKind === 'rain' && !indoors; const key = `${phase}:${halloweenOn}:${wet}`;
    if (lightKey === key) return; lightKey = key; night = dark;
    const L = dark && halloweenOn ? NIGHT : LIGHTS[phase];
    scene.background.set(L.background); scene.fog.color.set(L.fog);
    hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi;
    sun.color.set(L.sun); sun.intensity = L.sunI;
    if (wet) { const grey = new THREE.Color(0x6b7785); scene.background.lerp(grey, 0.45); scene.fog.color.lerp(grey, 0.45); hemi.intensity *= 0.66; sun.intensity *= 0.4; } // A4 날씨: a grey, dim rainy sky
    candle.intensity = halloweenOn ? (dark ? 38 : 12) : 0;
    assets.setNight(dark);
    // v1.10.38: in October every lamp glows orange; the lamps are lit from the evening on
    for (const m of [...lamps.map((l) => l.material), island.lampBulb]) { m.color.set(halloweenOn ? 0xffc27a : 0xfff3c2); m.emissive.set(halloweenOn ? 0xff8a1f : 0xffe08a); }
    island.lampBulb.emissiveIntensity = lit ? 1.6 : 0.6;
    yard.setNight(dark);
  }
  // A4 날씨 (lib/island-weather.js): the server's kind for everyone -- rain (snow in the winter zone, by where I stand) as
  // falling particles round me (fewer on a lower quality tier), a rainbow arc over the north sea for half an hour after
  let weatherKind = 'clear'; let weatherFx = null;
  // (bugs 9, 사용자 2026-10-19 「실내에서 눈이나 비가 와」) indoors -- the 민원실, the 백화점, and any room to come (달마루섬's
  // cliff fronts, my house): every space but the island, set in one place (setSpace) -- no rain, snow, falling leaves,
  // rainbow or rainy sky in there
  let indoors = false;
  function setWeather(kind) { if (!['clear', 'rain', 'rainbow'].includes(kind) || kind === weatherKind) return; weatherKind = kind; lightKey = null; halloweenCheckedAt = -Infinity; }
  function prepareWeather() {
    if (weatherFx) return weatherFx;
    const N = 900; const make = (color, size) => { const g = new THREE.BufferGeometry(); const pos = new Float32Array(N * 3); for (let i = 0; i < N; i += 1) { pos[i * 3] = (Math.random() - 0.5) * 44; pos[i * 3 + 1] = Math.random() * 22; pos[i * 3 + 2] = (Math.random() - 0.5) * 44; } g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const p = new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.75, depthWrite: false, fog: false })); p.frustumCulled = false; p.visible = false; scene.add(p); return p; };
    const bow = { visible: false };
    // rain: short streaks (two points a drop); snow: soft flakes
    const streaks = () => { const g = new THREE.BufferGeometry(); const pos = new Float32Array(N * 6); for (let i = 0; i < N; i += 1) { const x = (Math.random() - 0.5) * 44; const y = Math.random() * 22; const z = (Math.random() - 0.5) * 44; pos.set([x, y, z, x + 0.04, y + 0.7, z], i * 6); } g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xc9dcff, transparent: true, opacity: 0.55, depthWrite: false, fog: false })); l.frustumCulled = false; l.visible = false; scene.add(l); return l; };
    weatherFx = { rain: streaks(), snow: make(0xffffff, 0.32), bow, N };
    return weatherFx;
  }
  function stepWeather(dt) {
    if (weatherKind === 'clear' && !weatherFx) return;
    const fx = prepareWeather(); const p = me.root.position;
    if (indoors) { fx.rain.visible = false; fx.snow.visible = false; document.getElementById('plazaRainbow')?.classList.remove('on'); return; }
    const snowy = weatherKind === 'rain' && globalThis.IslandTerrain.seasonAt(p.x, p.z, Date.now() + serverOffset) === 'winter';
    fx.rain.visible = weatherKind === 'rain' && !snowy; fx.snow.visible = snowy; fx.bow.visible = false; document.getElementById('plazaRainbow')?.classList.toggle('on', weatherKind === 'rainbow'); // (the camera looks down: the rainbow is a band over the top of the view)
    const pts = fx.rain.visible ? fx.rain : fx.snow.visible ? fx.snow : null; if (!pts) return;
    const count = [200, 450, fx.N][quality] ?? fx.N; const per = snowy ? 1 : 2; pts.geometry.setDrawRange(0, count * per);
    pts.position.set(p.x, p.y, p.z); const a = pts.geometry.attributes.position.array; const fall = snowy ? 1.6 : 18; const t = performance.now() / 1000;
    for (let i = 0; i < count * per; i += 1) { a[i * 3 + 1] -= fall * dt; if (snowy) a[i * 3] += Math.sin(t + i) * 0.4 * dt; }
    for (let d = 0; d < count; d += 1) { const k = d * per * 3 + 1; if (a[k] < -1) for (let j = 0; j < per; j += 1) a[k + j * 3] += 22; }
    pts.geometry.attributes.position.needsUpdate = true;
  }
  // A5 관리자: the season arrangement held (a day) or turning (null), and the event decorations by date or by hand -- the
  // decorations no longer bring the night with them (that is the time of day's)
  let decorMode = 'auto';
  function setIslandLook({ seasonHold: day = null, decor = 'auto' } = {}) {
    if (['auto', 'halloween', 'winter', 'off'].includes(decor) && decor !== decorMode) { decorMode = decor; halloweenCheckedAt = -Infinity; }
    const held = Number.isInteger(day) ? day : null; if (held !== seasonHold) { seasonHold = held; if (held !== null && seasonOverride === null) setSeasonDay(held); else seasonCheckedAt = -Infinity; }
  }
  // B 46 겨울 축제: built the first time it is shown -- the tree and its base on the fountain's spot, the props where the
  // pack's layout puts them (plaza ground), the snow on every plaza bench and lamp (in the prop's own frame, its 0.85)
  let winterFx = null; let winterOn = false;
  function setWinter(on) {
    if (on === winterOn) return; winterOn = on;
    if (on && !winterFx) {
      const group = new THREE.Group(); group.position.set(PLAZA_C.x, PH, PLAZA_C.z); scene.add(group); const overlays = []; // (the plaza's middle)
      const put = (file, x, y, z, ry = 0, parent = group, s = 1) => { const root = new THREE.Group(); root.position.set(x, y, z); root.rotation.y = ry; root.scale.setScalar(s); parent.add(root); const stand = new THREE.Group(); root.add(stand); assets.attach(`winter.${file}`, root, stand); return root; };
      put('landmark_winter_base', 0, 0, 0); put('landmark_winter_tree', 0, 0.12, 0);
      for (const [f, x, y, z, ry] of [['snowman_classic', -8, 0, -6, 0], ['snowman_little', -9.7, 0, -6.5, 0], ['sleigh', 8, 0, 5.5, -0.6], ['candy_cane', -9, 0, 5.8, 0], ['candy_cane', 9, 0, -6, 0], ['snow_pile_round', -9, 0, -7.8, 0], ['snow_pile_long', 9, 0, 7, 0], ['gift_box_red', 8, 0, 4, 0], ['gift_box_green', 9.1, 0, 4.2, 0.3], ['gift_box_blue', 7.4, 0, 5.3, -0.2]]) put(f, x, y, z, ry); // (the pack's garland, wreath and string lights hang on a rail this plaza does not have: left out -- the lamps' own ribbons say it)
      for (const h of benchHolders) overlays.push(put('bench_snow', 0, 0.625 * 0.85 + 0.052, -0.04 * 0.85, 0, h, 0.85));
      for (const h of lampHolders) overlays.push(put('lamp_winter', 0, 1.5025 * 0.85, -0.14 * 0.85, 0, h, 0.85));
      winterFx = { group, overlays };
    }
    if (winterFx) { winterFx.group.visible = on; for (const o of winterFx.overlays) o.visible = on; }
  }
  // B 45 꽃·나무 심기: each plant at its spot as its stage's model (a flower's colour from the bud on), the fertilizer's mark
  // by it; a stage that changed swaps the model in place (the server's list, refreshed by the page)
  const plants = new Map(); // id -> { root, key, data }
  const plantModel = (p) => (p.kind === 'tree' ? `plant.tree_stage${p.stage}` : p.stage < 2 ? `plant.flower_stage${p.stage}` : `plant.flower_stage${p.stage}_${p.color}`);
  function setPlants(list) {
    const seen = new Set();
    for (const p of Array.isArray(list) ? list : []) {
      seen.add(p.id); const key = `${plantModel(p)}:${p.fertilized}`; const had = plants.get(p.id); if (had?.key === key) { had.data = p; continue; }
      if (had) scene.remove(had.root);
      const root = new THREE.Group(); root.position.set(p.x, heightAt(p.x, p.z), p.z); root.rotation.y = (p.x * 7.3 + p.z * 3.1) % (Math.PI * 2); scene.add(root);
      const stand = new THREE.Group(); const h = p.kind === 'tree' ? [0.4, 1, 2, 4.9][p.stage] : [0.04, 0.17, 0.32, 0.39][p.stage];
      mesh(new THREE.CylinderGeometry(p.kind === 'tree' ? 0.12 * (p.stage + 1) : 0.15, 0.18, h, 8), mat(p.kind === 'tree' ? 0x4f8a3c : ({ red: 0xe04848, yellow: 0xf2c94c, white: 0xf5f5f0, pink: 0xf48fb1, purple: 0x9b6bd6 })[p.color] || 0x6aa84f), 0, h / 2, 0, stand);
      root.add(stand); assets.attach(plantModel(p), root, stand);
      if (p.fertilized) { const mark = new THREE.Group(); mark.position.y = p.kind === 'flower' ? 0.037 : 0; root.add(mark); assets.attach('plant.fertilized_mark', mark, new THREE.Group()); }
      plants.set(p.id, { root, key, data: p });
    }
    for (const [id, had] of plants) if (!seen.has(id)) { scene.remove(had.root); plants.delete(id); }
  }
  const nearestPlant = (r = 2) => { const p = me.root.position; let best = null; let bd = r; for (const { data } of plants.values()) { const d = Math.hypot(data.x - p.x, data.z - p.z); if (d < bd) { bd = d; best = data; } } return best; };
  function setTimeMode(mode) { if (['auto', 'morning', 'day', 'evening', 'night'].includes(mode)) { timeMode = mode; halloweenCheckedAt = -Infinity; } }
  const PROPS = globalThis.IslandTerrain.plazaProps(); // v1.10.16: placed in island-terrain.js, shared with the islanders' routes
  // v1.10.17: each plaza prop is a gameplay holder (place, facing; its circle is the shared plazaProps one) with its
  // procedural look in a `visual` group, which a registered model (prop.bench / prop.lamp / prop.planter) replaces
  const benchHolders = []; const lampHolders = []; // (B 46: the winter overlays sit on these)
  const propHolder = (x, z, ry = 0) => { const holder = new THREE.Group(); holder.position.set(x, PH, z); holder.rotation.y = ry; scene.add(holder); const visual = new THREE.Group(); holder.add(visual); return [holder, visual]; };
  for (const b of PROPS.benches) { // benches facing the fountain, clear of the channels
    const [bench, visual] = propHolder(b.x, b.z, b.yaw ?? Math.atan2(PLAZA_C.x - b.x, PLAZA_C.z - b.z)); // (문제 기록 ①: its own facing, the one its seat has -- not the old island's middle)
    mesh(new THREE.BoxGeometry(1.7, 0.12, 0.55), mat(0xc58b5a), 0, 0.5, 0, visual);
    mesh(new THREE.BoxGeometry(1.7, 0.45, 0.1), mat(0xc58b5a), 0, 0.8, -0.25, visual);
    for (const x of [-0.7, 0.7]) mesh(new THREE.BoxGeometry(0.1, 0.5, 0.5), mat(0x6b5a4a), x, 0.25, 0, visual);
    solids.push(b);
    assets.attach('prop.bench', bench, visual); benchHolders.push(bench);
  }
  const lamps = [];
  for (const lamp of PROPS.lamps) {
    const [holder, visual] = propHolder(lamp.x, lamp.z);
    mesh(new THREE.CylinderGeometry(0.08, 0.11, 2.6, 10), mat(0x4d6b5c), 0, 1.3, 0, visual);
    lamps.push(mesh(new THREE.SphereGeometry(0.26, 16, 12), mat(0xfff3c2, { emissive: 0xffe08a, emissiveIntensity: 0.6 }), 0, 2.75, 0, visual));
    solids.push(lamp);
    assets.attach('prop.lamp', holder, visual); lampHolders.push(holder);
  }
  const flowerColors = [0xff9ec7, 0xffe27a, 0xffffff, 0xc4a5ff, 0xff8f8f];
  for (const bed of PROPS.beds) { // beds along the plaza rim, between the walks and channels
    const { i } = bed;
    const [holder, visual] = propHolder(bed.x, bed.z, Math.atan2(PLAZA_C.x - bed.x, PLAZA_C.z - bed.z)); // v1.10.20: facing the fountain (a planter model lies along the rim)
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
  // A-7: the contest winner's plinth, the same as the donation ones -- there (and in the way) only while a winner stands on it
  const contestPlinth = new THREE.Group(); scene.add(contestPlinth); contestPlinth.visible = false;
  { const cs = globalThis.IslandTerrain.CONTEST_STATUE;
    mesh(new THREE.CylinderGeometry(1.2, 1.35, 0.5, 24), mat(0xe9e2d4), cs.x, PH + 0.25, cs.z, contestPlinth);
    mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.9, 20), mat(0xf4efe6), cs.x, PH + 0.95, cs.z, contestPlinth);
    const ring = mesh(new THREE.TorusGeometry(0.62, 0.07, 8, 26), mat(0xd9a520), cs.x, PH + 1.41, cs.z, contestPlinth); ring.rotation.x = Math.PI / 2;
    solids.push({ x: cs.x, z: cs.z, r: 1.3, off: () => !contestPlinth.visible }); }
  // A-7: the winter festival's things on the plaza are walked round while they are out
  for (const [x, z, r] of [[-8, -6, 0.6], [-9.7, -6.5, 0.4], [8, 5.5, 1.1], [-9, 5.8, 0.2], [9, -6, 0.2], [-9, -7.8, 0.7], [9, 7, 0.9], [8, 4, 0.35], [9.1, 4.2, 0.35], [7.4, 5.3, 0.35]]) solids.push({ x: PLAZA_C.x + x, z: PLAZA_C.z + z, r, off: () => !winterOn });

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
    const places = Object.entries(doors).filter(([id, d]) => !id.startsWith('room:') && (!id.startsWith('home:') || d.mine)).map(([, d]) => ({ x: d.x, z: d.z, name: d.mapName || d.name })); // (v1.10.84: the map says 관공서, the hint 관공서 들어가기)
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
    } else if (spot.kind === 'facade') { // 달마루섬 2단계: 관공서·백화점 set against 영웅마루 (assets 55 facade.*: 30 x 14, 4.6 out of the cliff)
      const F = globalThis.IslandTerrain.FACADE; depth = F.d;
      mesh(new THREE.BoxGeometry(F.w, 14, F.d), mat(facility.id === 'store' ? 0xd9c9ad : 0xf2ede4), 0, 7, F.d / 2, visual);
      mesh(new THREE.BoxGeometry(4, 5, 0.1), mat(0x8a5a3b), 0, 2.5, F.d + 0.05, visual); // the door
      sign(facility.name, root, 15.4);
      boxSolids(0, F.d / 2, F.w, F.d, 1.1);
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
    } else if (spot.kind === 'shop' || spot.kind === 'house' || spot.kind === 'office' || spot.kind === 'mall') { // (v1.10.92 mall: the 백화점, 24 x 14 m)
      // v1.10.13: one merged build per facility (island.js `building`): a level body on a stone plinth, a real pitched
      // or hip roof lined up with the walls (the old roof was a square cone squashed along its diagonal -- it looked
      // crooked), framed door and windows; each facility its own silhouette. Footprint and door are unchanged.
      const big = spot.kind === 'mall'; const w = big ? 23.6 : 3.2; const h = big ? 8 : 2.4; depth = big ? 13.6 : 2.7;
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
      if (big) boxSolids(0, 0, w, depth, 2.2); else solids.push({ x, z, r: Math.max(w, depth) * 0.62 });
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

  // 달마루섬 2단계 (assets 55): 초승등대, 달끝나루, 배 타는 곳, the ridge's stairs, and 물가 거리's railing, lamps and benches
  // -- each a holder with a plain stand-in until its model comes; what one cannot walk through is solid
  const pieces = []; // (달마루섬's structures, for mapCheck)
  function dalmaruStructures() {
    const T = globalThis.IslandTerrain; if (!T.STRUCTURES) return;
    const S = T.STRUCTURES;
    const piece = (id, x, y, z, yaw, fallback, walked = false) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; scene.add(g); g.add(fallback); assets.attach(id, g, fallback); g.userData.piece = id; g.userData.walked = walked; pieces.push(g); return g; };
    const box = (w, h, d, color, oz = 0) => { const g = new THREE.Group(); mesh(new THREE.BoxGeometry(w, h, d), mat(color), 0, h / 2, oz, g); return g; };
    const L = S.lighthouse; piece('dalmaru.lighthouse_choseung', L.x, heightAt(L.x, L.z), L.z, 0, box(4, 14, 4, 0xf4f1ea));
    solids.push(...T.structureSolids()); // (the shared circles: the islanders' routes keep off them too)
    piece('dalmaru.pier_dalkkeut', S.pier.x, S.pier.y, S.pier.z, S.pier.yaw, box(3.6, 0.2, 20, 0xc58b5a, 10), true);
    piece('dalmaru.dock_boat', S.dock.x, S.dock.y, S.dock.z, S.dock.yaw, box(12, 0.15, 3, 0xc58b5a), true);
    // the stairs: its model runs along local -x from its foot; the low wall on its open side (and its back, the stone
    // under the steps) are walked round, its ends are open
    const st = T.STAIRS; const stairs = new THREE.Group(); const flights = new THREE.Group(); stairs.add(flights);
    for (let u = 0; u < st.len; u += 1) { const y = T.heightAt(st.x + st.ux * (u + 0.5) + st.nx * 1.7, st.z + st.uz * (u + 0.5) + st.nz * 1.7) - S.stairs.base; mesh(new THREE.BoxGeometry(1, Math.max(0.1, y), 3), mat(0xc9bfae), -(u + 0.5), y / 2, 1.7, flights); }
    stairs.position.set(S.stairs.x, S.stairs.base, S.stairs.z); stairs.rotation.y = S.stairs.yaw; scene.add(stairs); assets.attach('dalmaru.stairs_ridge', stairs, flights);
    // (묶음 1: its sides each in one face, under the steps' edge -- each step showed its own side, a row of planks)
    const side = new THREE.Shape(); side.moveTo(0, 0);
    for (let u = 0; u <= st.len + 1e-6; u += 0.5) side.lineTo(-u, Math.max(0, T.heightAt(st.x + st.ux * u + st.nx * 1.7, st.z + st.uz * u + st.nz * 1.7) - S.stairs.base - 0.05));
    side.lineTo(-st.len, 0); side.lineTo(0, 0);
    const sideGeo = new THREE.ShapeGeometry(side); const sideMat = mat(0xc9bfae, { side: THREE.DoubleSide });
    for (const z of [st.w1 + 0.04, st.w0 - 0.04]) mesh(sideGeo, sideMat, 0, 0, z, stairs); // (and its cliff side: the stairs run straight, the cliff curves away from their middle)
    // 영웅마루's niches: the frame stands out of the cliff, its foot walked round; an empty one says what it waits for
    for (const [k, n] of (T.NICHES || []).entries()) {
      const g = piece('dalmaru.niche_hero', n.x, heightAt(n.x, n.z), n.z, n.yawToCentre, box(0.85, 1.28, 0.22, 0xcfc6b6, 0.04)); g.scale.setScalar(n.m);
      if (!n.now) { const s = sign('곧 새겨질 자리', g, 0.45); s.scale.multiplyScalar(2.2 / n.m); }
      void k;
    }
    // 툇마루섬: the players' houses (묶음 4 내 집) -- the board at the way in says where one applies (assets: the notice board's look)
    const I = T.dalmaru.ISLE; const post = new THREE.Group(); mesh(new THREE.BoxGeometry(2.2, 1.2, 0.12), mat(0xe9d8b4), 0, 1.5, 0, post); for (const x of [-0.9, 0.9]) mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), mat(0x8a6a48), x, 0.8, 0, post);
    const board = piece('dalmaru.isle_sign', I.x - 4, heightAt(I.x - 4, I.z - 7.3), I.z - 7.3, 0, post); sign('툇마루섬 · 집터는 관공서에서 신청', board, 2.7); // (2회차 15: beside the trunk walk, clear of the cross walk)
    // 묶음 1 대청마당 바닥 (assets 59): the disc, ring and kerbs walked over, just above the paving (the kerbs one batch);
    // the channels and gardens walked round (dalmaru-island's pavingSolids)
    if (T.paving) {
      const V = T.paving(); const y = T.dalmaru.PLAZA.h + 0.035; const none = () => new THREE.Group();
      piece('plaza.medallion', V.disc.x, y, V.disc.z, 0, none(), true); piece('plaza.band_ring', V.disc.x, y, V.disc.z, 0, none(), true);
      for (const k of V.corners) piece('plaza.curb_corner', k.x, y - 0.015, k.z, k.yaw, none(), true);
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(3.98, 0.14, 0.36).translate(0, 0.07, 0), mat(0xc9bfae), V.curbs.length); const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const up = new THREE.Vector3(0, 1, 0); const one = new THREE.Vector3(1, 1, 1);
      const matrices = V.curbs.map((k, i) => { m4.compose(new THREE.Vector3(k.x, y - 0.015, k.z), q.setFromAxisAngle(up, k.yaw), one); im.setMatrixAt(i, m4); return m4.clone(); });
      im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im);
      assets.batch('plaza.curb', [{ x: V.disc.x, z: V.disc.z, parent: scene, procedural: [im], matrices, colors: null, shadow: false }]);
      for (const ch of V.channels) piece(ch.end ? 'plaza.channel_end' : 'plaza.channel', ch.x, y, ch.z, ch.yaw, ch.end ? box(2, 0.34, 2, 0xd8d0c2) : box(4, 0.2, 1.3, 0xd8d0c2));
      for (const g of V.gardens) piece(`plaza.garden_${g.kind}`, g.x, heightAt(g.x, g.z), g.z, 0, g.kind === 'round' ? box(6, 0.45, 6, 0x9fbf7f) : box(10, 0.45, 3.6, 0x9fbf7f));
    }
    const W = T.WATERFRONT;
    for (const r of W.rails) { piece('dalmaru.rail_waterfront', r.x, heightAt(r.x, r.z), r.z, r.yaw, box(4.2, 1, 0.15, 0x8a6a48)); }
    for (const l of W.lamps) { piece('dalmaru.lamp_waterfront', l.x, heightAt(l.x, l.z), l.z, 0, box(0.2, 4.4, 0.2, 0x4d5560)); }
    for (const b of W.benches) { piece('dalmaru.bench_waterfront', b.x, heightAt(b.x, b.z), b.z, b.yaw, box(1.8, 0.5, 0.5, 0xc58b5a)); }
  }
  const buildingSolids = solids.slice(firstBuildingSolid); // facilities, keepers' stands, the reserved lot, the houses
  const train = trainScene({ scene, assets, solids, vcMat, sign }); // v1.10.47 관광열차 (its steps are walked round)
  const firstYardSolid = solids.length;
  const yard = townhallYard({ scene, assets, solids, vcMat, makeCharacter, dressUp, makeTag, fitTag, hall: buildingRoots.find((r) => r.userData.facility === 'townhall') }); // v1.10.41
  buildingSolids.push(...solids.slice(firstYardSolid).filter(s => !s.gate));
  yard.group.userData.building = true; yard.group.userData.occlusionAt = buildingRoots.find((r) => r.userData.facility === 'townhall')?.position; buildingRoots.push(yard.group); // (문제 기록 7: its walls fade too)
  doors.mayor = yard.door;
  dalmaruStructures(); // 달마루섬 2단계
  const decor = halloweenDecor({ scene, assets, solids, vcMat, PH, plazaLamps: PROPS.lamps, benches: PROPS.benches, spots: hwSpots, lampModel, keepClear: yard.route }); // v1.10.38
  // v1.10.5 기부 동상: last week's 1st (gold) and 2nd (silver) donors stand on the two plinths, in the look they had
  // when the week closed, with a small plate. Rebuilt only when the server sends a different pair.
  let statueList = []; let statueKey = '[]'; const statueRoots = []; const statueChars = [];
  const STATUE_SIZE = 2.6; // v1.10.30: the 1st donor's statue, in player heights (the 2nd is 70% of it)
  // 달마루섬 3단계 (docs/dalmaru-implementation-20261019.md 3): 영웅마루's niches (assets 55 niche.hero, 14·10·10·7·7·7·7 m) --
  // the 1st donor in the middle one, the 2nd and the contest winner either side, the rest 「곧 새겨질 자리」. Each statue
  // is the player as they look, frozen in a wave, then baked into one still mesh of one stone (one draw); a new carving
  // raises a little dust. The old plaza's plinths are not on this island.
  const NICHES = globalThis.IslandTerrain.NICHES || null;
  // 문제 기록 10 (2026-10-21 「원래처럼 색도 있는 동상으로」): the baked statue keeps each part's colour (its vertex colour
  // times its material's), a fifth of the way to stone -- still one mesh, one draw
  const STATUE_STONE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  const STONE_TINT = new THREE.Color(0xd8d0c2); const STONE_MIX = 0.2; const STATUE_LIFT = 0.006; // (a player's units)
  const weekLabel = (week) => { const m = /W(\d+)$/.exec(String(week || '')); return m ? `제 ${Number(m[1])}주 ` : '이번 주 '; };
  function bakeStone(c) { // the frozen model as one mesh in its root's frame
    c.root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(c.root.matrixWorld).invert(); const m = new THREE.Matrix4(); const v = new THREE.Vector3(); const col = new THREE.Color(); const geos = [];
    (c.assetRoot || c.body).traverseVisible((o) => {
      if (!o.isMesh || !o.geometry?.attributes.position) return;
      const src = o.geometry; const pos = src.attributes.position; const vc = src.attributes.color; const out = new Float32Array(pos.count * 3); const rgb = new Float32Array(pos.count * 3); const nout = new Float32Array(pos.count * 3); m.multiplyMatrices(inv, o.matrixWorld);
      const mats = [].concat(o.material); const matOf = (i) => { const g = src.groups.find((x) => i >= x.start && i < x.start + x.count); return mats[g?.materialIndex ?? 0] || mats[0]; };
      // the model's own (smooth) normals carried through the pose -- normals worked out afresh on the unshared triangles were
      // per face and made the hair and clothes a faceted patchwork once they had colours; hair and clothes also sit a few
      // millimetres off the skin so the layers never show through each other
      const nrm = src.attributes.normal; const lift = new Float32Array(pos.count).fill(STATUE_LIFT); const n0 = new THREE.Vector3(); const w = new THREE.Vector3();
      for (let k = 0; k < (src.index ? src.index.count : pos.count); k += 1) if (matOf(k)?.name === 'skin') lift[src.index ? src.index.getX(k) : k] = 0;
      const skin = (vec, i) => { if (o.isSkinnedMesh) o.applyBoneTransform(i, vec); return vec.applyMatrix4(m); };
      for (let i = 0; i < pos.count; i += 1) {
        v.fromBufferAttribute(pos, i); if (nrm) { w.copy(v).addScaledVector(n0.fromBufferAttribute(nrm, i), 1e-3); skin(w, i); }
        skin(v, i); if (nrm) { w.sub(v).normalize(); v.addScaledVector(w, lift[i]); nout.set([w.x, w.y, w.z], i * 3); }
        out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
      }
      const n = src.index ? src.index.count : pos.count; const tint = new Float32Array(n * 3); // (by index position: groups count indices)
      for (let k = 0; k < n; k += 1) { const i = src.index ? src.index.getX(k) : k; col.set(matOf(k)?.color ?? 0xffffff); if (vc) col.multiply({ r: vc.getX(i), g: vc.getY(i), b: vc.getZ(i) }); col.lerp(STONE_TINT, STONE_MIX); tint.set([col.r, col.g, col.b], k * 3); }
      let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(out, 3)); g.setAttribute('color', new THREE.BufferAttribute(rgb, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nout, 3)); if (src.index) { g.setIndex(src.index.clone()); g = g.toNonIndexed(); }
      g.attributes.color.array.set(tint); if (!nrm) g.computeVertexNormals(); geos.push(g);
    });
    if (!geos.length) return null;
    const join = (name) => { const all = new Float32Array(geos.reduce((n, g) => n + g.attributes[name].array.length, 0)); let at = 0; for (const g of geos) { all.set(g.attributes[name].array, at); at += g.attributes[name].array.length; } return new THREE.BufferAttribute(all, 3); }; // (no addon fetched for this -- an island without models loads none)
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', join('position')); geometry.setAttribute('color', join('color')); geometry.setAttribute('normal', join('normal')); for (const g of geos) g.dispose();
    const stone = new THREE.Mesh(geometry, STATUE_STONE); stone.castShadow = true; stone.receiveShadow = true;
    if (c.assetRoot) c.assetRoot.visible = false; c.body.visible = false; c.root.add(stone); return stone;
  }
  // 문제 기록 10 「이름이 너무 작아 멀리선 안 보여」: a statue's plate is twice a name tag near it and grows with the distance
  // past that, so it keeps about the same size on screen from anywhere 영웅마루 is seen; the fog does not swallow it
  // 문제 기록 2회차 7·17 (사용자 2026-10-21 「안내 문구는 정면에서만 보이는 명판(간판)으로, 어디서나 보이는 이름표는 필요
  // 없어」): a statue's name is a plaque on its plinth's front -- carved letters on a stone board, read from in front only
  // (v1.10.115's name tag that grew with the distance is gone). h: the board's height (m); facing yaw (its front, +z)
  const statuePlates = [];
  function plaque(text, x, y, z, yaw, h) {
    const font = '800 64px Pretendard, "Malgun Gothic", system-ui, sans-serif';
    const probe = document.createElement('canvas').getContext('2d'); probe.font = font;
    const canvas = document.createElement('canvas'); canvas.width = Math.max(512, Math.ceil(probe.measureText(text).width) + 96); canvas.height = 128;
    const c = canvas.getContext('2d'); c.fillStyle = '#d9d2c2'; c.fillRect(0, 0, canvas.width, canvas.height); c.strokeStyle = '#9c927e'; c.lineWidth = 10; c.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    c.fillStyle = '#3d362c'; c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, canvas.width / 2, 68);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
    const w = (h * canvas.width) / canvas.height; const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 })); face.position.z = 0.03; g.add(face);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.05), mat(0xb8ad97)));
    g.userData.plaque = text; g.userData.w = +w.toFixed(2); statuePlates.push(g); return g;
  }
  let carvings = []; // the dust of a new carving (2.5 s)
  function carveDust(spot) {
    const n = 70; const pos = new Float32Array(n * 3); const vel = [];
    for (let i = 0; i < n; i += 1) { pos.set([spot.x + (Math.random() - 0.5) * spot.m * 0.5, heightAt(spot.x, spot.z) + Math.random() * spot.m * 0.8, spot.z + Math.random() * 1.5], i * 3); vel.push([(Math.random() - 0.5) * 1.2, -0.4 - Math.random(), (Math.random() - 0.2) * 1.2]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xe9e2d4, size: 0.45, transparent: true, opacity: 0.85, depthWrite: false })); scene.add(pts);
    carvings.push({ pts, vel, t: 0 });
  }
  function stepCarvings(dt) {
    carvings = carvings.filter((d) => {
      d.t += dt; const a = d.pts.geometry.attributes.position.array;
      for (let i = 0; i < d.vel.length; i += 1) { a[i * 3] += d.vel[i][0] * dt; a[i * 3 + 1] += d.vel[i][1] * dt; a[i * 3 + 2] += d.vel[i][2] * dt; }
      d.pts.geometry.attributes.position.needsUpdate = true; d.pts.material.opacity = 0.85 * Math.max(0, 1 - d.t / 2.5);
      if (d.t < 2.5) return true; scene.remove(d.pts); d.pts.geometry.dispose(); d.pts.material.dispose(); return false;
    });
  }
  let statueWeek = null;
  function setStatues(list, week = statueWeek) {
    statueWeek = week;
    const next = [...(Array.isArray(list) ? list : []).filter((s) => s && !s.contest && (s.rank === 1 || s.rank === 2)).slice(0, 2), ...(Array.isArray(list) ? list : []).filter((s) => s?.contest).slice(0, 1)]; // (A4: and the contest's winner)
    const key = JSON.stringify(next.map(({ rank, name, look, title }) => [rank, name, look, title]));
    if (key === statueKey) return;
    const carved = NICHES && statueKey !== '[]' ? new Set(next.map((s) => JSON.stringify([s.rank, s.name, s.contest]))) : null; const before = new Set(statueList.map((s) => JSON.stringify([s.rank, s.name, s.contest])));
    statueKey = key; statueList = next;
    for (const c of statueChars.splice(0)) { occlusion.remove(c.root); assets.release(c); const i = buildingRoots.indexOf(c.root); if (i >= 0) buildingRoots.splice(i, 1); }
    statuePlates.length = 0;
    for (const r of statueRoots.splice(0)) { r.traverse((o) => { if (o.isMesh) o.geometry.dispose(); if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } }); r.parent?.remove(r); }
    // v1.10.30 기부 동상 (사용자 결정 2026-10-05): the donors as they look -- their own colours, hair, clothes and face, the
    // common-rig character when they have it (no gold or silver any more) -- at landmark size: the 1st STATUE_SIZE times
    // a player, the 2nd 70% of that, waving, frozen. Over everyone's heads they never stand in the way (the plinth's
    // circle is the walking limit); one that hides me from the camera fades like a building.
    contestPlinth.visible = !NICHES && next.some((st) => st.contest);
    if (NICHES) { // 영웅마루
      next.forEach((st) => {
        const spot = NICHES[st.contest ? 2 : st.rank - 1]; if (!spot) return;
        const c = makeCharacter({ ...ME_BASE, look: st.look || {} }); const y = heightAt(spot.x, spot.z) + spot.m * 0.07;
        c.root.position.set(spot.x + Math.sin(spot.yawToCentre) * spot.m * 0.02, y, spot.z + Math.cos(spot.yawToCentre) * spot.m * 0.02); c.root.rotation.y = spot.yawToCentre; c.root.scale.setScalar(spot.m * 0.3);
        c.armR.rotation.z = 2.4; c.stoneStatue = true; c.bornAt = performance.now();
        scene.add(c.root); statueRoots.push(c.root); statueChars.push(c); dressUp(c, st.look || {});
        const plate = plaque(st.contest ? `🏆 주말 섬 대회 우승 ${st.name}` : `${weekLabel(statueWeek)}기부 ${st.rank}위 ${st.name}`, spot.x + Math.sin(spot.yawToCentre) * 1.6, heightAt(spot.x, spot.z) + 0.9, spot.z + Math.cos(spot.yawToCentre) * 1.6, spot.yawToCentre, 0.7); scene.add(plate); statueRoots.push(plate);
        if (carved && !before.has(JSON.stringify([st.rank, st.name, st.contest]))) carveDust(spot);
      });
      return;
    }
    for (const st of next) {
      const spot = st.contest ? globalThis.IslandTerrain.CONTEST_STATUE : STATUE_SPOTS[st.rank - 1]; if (!spot) continue;
      const size = st.contest ? STATUE_SIZE * 0.6 : st.rank === 1 ? STATUE_SIZE : STATUE_SIZE * 0.7;
      const c = makeCharacter({ ...ME_BASE, look: st.look || {} });
      const walk = globalThis.IslandTerrain.walkCurves.flatMap((w) => w.pts).reduce((p, q) => (Math.hypot(q[0] - spot.x, q[1] - spot.z) < Math.hypot(p[0] - spot.x, p[1] - spot.z) ? q : p)); // (toward the walk it is seen from -- not the old island's middle)
      c.root.position.set(spot.x, PH + 1.4, spot.z); c.root.rotation.y = Math.atan2(walk[0] - spot.x, walk[1] - spot.z) + 0.35; c.root.scale.setScalar(size);
      c.armR.rotation.z = 2.4; // a wave, frozen (the procedural character)
      scene.add(c.root); statueRoots.push(c.root); statueChars.push(c); c.root.userData.building = true; buildingRoots.push(c.root);
      dressUp(c, st.look || {});
      const face = Math.atan2(walk[0] - spot.x, walk[1] - spot.z); // (toward the walk, as the statue)
      const plate = plaque(st.contest ? `🏆 ${st.label || '주말 섬 대회'} 우승 ${st.name}` : `${st.rank}위 ${st.name}`, spot.x + Math.sin(face) * 0.97, PH + 0.95, spot.z + Math.cos(face) * 0.97, face, 0.32); scene.add(plate); statueRoots.push(plate);
    }
  }

  // The player's character: a big head on a short body.
  const ME_BASE = { shirt: 0x7cb8ff, hair: 0x4a3326, skin: 0xffe0c4 };
  let me = makeCharacter(ME_BASE);
  me.root.position.set(SPAWN.x + (Math.random() - 0.5) * 3, 0, SPAWN.z + Math.random() * 0.8); // the plaza, a little apart from whoever arrived just before
  me.root.position.y = heightAt(me.root.position.x, me.root.position.z);
  scene.add(me.root); assets.dress('character.player', me);
  // v1.9.2: wear an avatar look and show a name tag; the character is rebuilt in place (position and facing kept).
  function setAvatar({ look = {}, name = '', title = null, champion = false, hoguking = false, delinquent = false } = {}) {
    const old = me; me = makeCharacter({ ...ME_BASE, look });
    me.tailTucked = old.tailTucked; me.noTuck = old.noTuck;
    me.root.position.copy(old.root.position); me.root.rotation.y = old.root.rotation.y; me.targetYaw = old.targetYaw;
    disposeCharacter(old); scene.add(me.root); assets.dress('character.player', me); dressUp(me, look);
    if (name) { me.tag = makeTag(name, delinquent ? null : title, champion, hoguking, delinquent); me.root.add(me.tag); fitTag(me); }
    me.look = look; me.title = title; me.champion = Boolean(champion); me.hoguking = Boolean(hoguking);
  }

  // v1.10.89 상점 미리보기 (사용자 2026-10-17): my character in a look (mine with one item changed) on its own small canvas
  // -- a second renderer of its own (the island's is not touched), the same asset cache and wardrobe as on the island;
  // it turns slowly in Idle. Stood where I stand (the wardrobe's near/far band is measured from there), in its own scene.
  let tryOnView = null;
  function tryOn(canvas, look) {
    if (tryOnView?.canvas !== canvas) {
      tryOnClose();
      const phone = window.matchMedia?.('(pointer: coarse)').matches; // (bugs 12: a phone -- pixel ratio 1, no antialias, not turning by itself, drawn when it changes)
      let r; try { r = new THREE.WebGLRenderer({ canvas, antialias: !phone, alpha: true }); } catch { return false; }
      r.outputColorSpace = renderer.outputColorSpace; r.toneMapping = renderer.toneMapping; r.toneMappingExposure = renderer.toneMappingExposure;
      r.setPixelRatio(phone ? 1 : Math.min(2, window.devicePixelRatio || 1)); r.setSize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height, false);
      const s = new THREE.Scene(); s.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 2.4));
      const sun = new THREE.DirectionalLight(0xffffff, 1.8); sun.position.set(2, 5, 4); s.add(sun); s.add(sun.target);
      const cam = new THREE.PerspectiveCamera(30, (canvas.clientWidth || canvas.width) / (canvas.clientHeight || canvas.height), 0.1, 50);
      // 3-1 꾸미기 창: it turns by itself until it is turned by hand (tryOnPose), zooms, and walks on the spot or stands
      const v = tryOnView = { canvas, renderer: r, scene: s, camera: cam, sun, c: null, key: '', yaw: 0.4, auto: !phone, dist: 5.4, walk: false, last: performance.now(), raf: 0, phone, dirty: true, drawnAt: -Infinity };
      const loop = (now) => {
        if (tryOnView !== v) return; if (!canvas.isConnected) { tryOnClose(); return; }
        const dt = Math.min(0.1, (now - v.last) / 1000); v.last = now; if (v.auto) v.yaw += dt * 0.7;
        const w = canvas.clientWidth; const h = canvas.clientHeight; // (the window's layout can change: phone turned, window resized)
        if (w && h && (w !== v.w || h !== v.h)) { v.w = w; v.h = h; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); v.dirty = true; }
        if (v.phone && !v.auto && !v.walk && !v.dirty && now - v.drawnAt < 500) { v.raf = requestAnimationFrame(loop); return; } // (a late model shows within half a second)
        if (v.c?.model) { // (묶음 2 가구 창고: a piece of furniture, framed by its size once it is in)
          v.c.root.rotation.y = v.yaw; const b = new THREE.Box3().setFromObject(v.c.root); const size = b.isEmpty() ? 1 : Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
          const p = v.c.root.position; const d = 1.2 + size * 2.2 * (v.dist / 5.4); const y = b.isEmpty() ? 0.5 : (b.min.y + b.max.y) / 2; cam.position.set(p.x, y + d * 0.25, p.z + d); cam.lookAt(p.x, y, p.z);
        } else if (v.c) {
          v.c.root.rotation.y = v.yaw; v.c.targetYaw = v.yaw;
          if (v.c.anim) v.c.anim.update(dt, v.walk ? SLOW_SPEED * 1.6 : 0); else animate(v.c, dt, v.walk, v.walk ? SLOW_SPEED * 1.6 : 0);
          const p = v.c.root.position; cam.position.set(p.x, 1.05 + v.dist * 0.05, p.z + v.dist); cam.lookAt(p.x, 1.05, p.z);
        }
        r.render(s, cam); v.drawnAt = now; v.dirty = false; v.raf = requestAnimationFrame(loop);
      };
      v.raf = requestAnimationFrame(loop);
    }
    const v = tryOnView; const key = JSON.stringify(look || {});
    if (key !== v.key) {
      v.key = key; v.dirty = true; if (v.c?.model) v.c.root.removeFromParent(); else if (v.c) disposeCharacter(v.c);
      const p = me.root.position;
      if (look?.model) { const root = new THREE.Group(); const stand = new THREE.Group(); mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), mat(0xcfc4b0), 0, 0.4, 0, stand); root.add(stand); root.position.set(p.x, 0, p.z); v.scene.add(root); assets.attach(look.model, root, stand); v.c = { root, model: look.model }; }
      else { v.c = makeCharacter({ ...ME_BASE, look }); v.c.root.position.set(p.x, 0, p.z); v.scene.add(v.c.root); dressUp(v.c, look || {}); }
      v.camera.position.set(p.x, 1.3, p.z + 5.4); v.camera.lookAt(p.x, 1.05, p.z); v.sun.position.set(p.x + 2, 5, p.z + 4); v.sun.target.position.set(p.x, 1, p.z);
    }
    return true;
  }
  // 3-1: the preview turned by hand (yaw: a view -- 0 its back to me, π its face; turn: a drag), zoomed (zoom: + nearer),
  // walking on the spot or standing (walk)
  function tryOnPose({ yaw = null, turn = 0, zoom = 0, walk = null } = {}) {
    const v = tryOnView; if (!v) return null;
    v.dirty = true;
    if (yaw != null) { v.yaw = yaw; v.auto = false; }
    if (turn) { v.yaw += turn; v.auto = false; }
    if (zoom) v.dist = Math.max(2.6, Math.min(8, v.dist - zoom));
    if (walk != null) v.walk = Boolean(walk);
    return { yaw: v.yaw, auto: v.auto, dist: v.dist, walk: v.walk };
  }
  // 3-1 꾸미기 창 「착용 전 → 착용 후」: a still picture of me in a look (a small renderer of its own, kept), facing the
  // front; `done(url)` comes at once and again once the models are in (they load a moment later)
  let shotView = null;
  function tryOnShot(look, done, { w = 150, h = 190 } = {}) {
    if (!shotView) {
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      let r; try { r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch { return false; }
      r.outputColorSpace = renderer.outputColorSpace; r.toneMapping = renderer.toneMapping; r.toneMappingExposure = renderer.toneMappingExposure; r.setSize(w, h, false);
      const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 2.4)); const sun = new THREE.DirectionalLight(0xffffff, 1.8); sun.position.set(2, 5, 4); sc.add(sun);
      const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 50); cam.position.set(0, 1.3, 5.2); cam.lookAt(0, 1.0, 0);
      shotView = { canvas, renderer: r, scene: sc, camera: cam, seq: 0 };
    }
    const v = shotView; const seq = ++v.seq;
    if (v.c) { v.scene.remove(v.c.root); disposeCharacter(v.c); } // (one look at a time on its little stage)
    const c = v.c = makeCharacter({ ...ME_BASE, look }); c.root.position.set(0, 0, 0); v.scene.add(c.root); dressUp(c, look || {});
    const take = () => { if (v.seq !== seq) return; v.renderer.render(v.scene, v.camera); done(v.canvas.toDataURL('image/png')); };
    take(); setTimeout(take, 1600);
    return true;
  }
  function tryOnClose() {
    const v = tryOnView; if (!v) return; tryOnView = null; cancelAnimationFrame(v.raf);
    if (v.c?.model) v.c.root.removeFromParent(); else if (v.c) disposeCharacter(v.c); v.renderer.dispose(); v.renderer.forceContextLoss?.();
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
      const key = JSON.stringify([p.look || {}, p.name, p.title || null, Boolean(p.champion), Boolean(p.hoguking), Boolean(p.delinquent)]);
      let o = others.get(p.id);
      if (o && o.key !== key) { // a new look or title: rebuild in place
        const pos = o.c.root.position.clone(); const yaw = o.c.root.rotation.y; const tucked = o.c.tailTucked; const noTuck = o.c.noTuck; disposeCharacter(o.c);
        o.c = makeCharacter({ ...OTHER_BASE, look: p.look || {} }); o.c.player = true; o.c.tailTucked = tucked; o.c.noTuck = noTuck; o.c.root.position.copy(pos); o.c.root.rotation.y = yaw; o.key = key;
        o.c.tag = makeTag(p.name || '', p.title || null, p.champion, p.hoguking, p.delinquent); o.c.tag.material.fog = false; o.c.root.add(o.c.tag); fitTag(o.c); scene.add(o.c.root); assets.dress('character.player', o.c); dressUp(o.c, p.look || {});
      }
      if (!o) {
        const c = makeCharacter({ ...OTHER_BASE, look: p.look || {} }); c.player = true; // v1.10.37: seen from far (asset-loader wearMaterial)
        c.root.position.set(p.x, heightAt(p.x, p.z), p.z); c.root.rotation.y = p.yaw;
        c.tag = makeTag(p.name || '', p.title || null, p.champion, p.hoguking, p.delinquent); c.tag.material.fog = false; c.root.add(c.tag); fitTag(c); scene.add(c.root); assets.dress('character.player', c); dressUp(c, p.look || {});
        o = { c, key, champion: Boolean(p.champion), track: createTrack(), follow: createFollower({ maxSpeed: 12 }) } /* (the fastest anyone goes: a bike with Shift, 2026-10-21) */; others.set(p.id, o);
      }
      // v1.10.8: every pose goes into their track (stamped with the server time it was taken); the newest one and its
      // walking speed also feed my collision's look-ahead (v1.9.9)
      const now = performance.now();
      if (o.track.push({ t: p.t, x: p.x, z: p.z, yaw: p.yaw, moving: Boolean(p.moving) }, now)) {
        const latest = o.track.latest(); o.vel = latest.vel;
        const speed = Math.hypot(o.vel.x, o.vel.z); const cap = RUN_SPEED * 1.1; if (speed > cap) { o.vel.x *= cap / speed; o.vel.z *= cap / speed; }
        o.target = { x: p.x, z: p.z, yaw: p.yaw, moving: Boolean(p.moving) }; o.targetAt = now;
      }
      o.champion = Boolean(p.champion); o.hoguking = Boolean(p.hoguking); o.look = p.look || {};
      setCarry(o.c, p.carry || null); // v1.10.32 운반
      // v1.10.44: their act -- sitting (the clips, on their seat), or a new wave or cheer
      if (p.act === 'sit' && p.seat) { takenSeats.set(p.seat, p.id); if (o.act !== 'sit') { o.c.anim?.play('sitDown'); o.c.anim?.loop?.('sitIdle'); o.c.tailTucked = true; o.c.tuckTail?.(true); } }
      else if (o.act === 'sit') { o.c.anim?.release?.(); if (!o.c.anim?.play('sitDown', { reverse: true })) o.c.anim?.play('standUp'); o.c.tailTucked = false; o.c.tuckTail?.(false); }
      if (['gather','pickup','pickFruit'].includes(o.act) && !['gather','pickup','pickFruit'].includes(p.act)) { o.c.anim?.finishOnce?.(); assets.letGo(o.c,'fruit'); }
      if (['gather','pickup','pickFruit'].includes(p.act) && p.actN !== o.actN) { o.c.anim?.play(p.act,{ms:p.actMs,hold:true,elapsed:Math.max(0,(Date.now()+serverOffset-p.actAt)/1000)}); if (p.actTarget) o.c.root.rotation.y=Math.atan2(p.actTarget.x-p.x,p.actTarget.z-p.z); }
      if (['wave', 'cheer', 'nod', 'clap', 'bow'].includes(p.act) && p.actN !== o.actN) o.c.anim?.play(p.act);
      remoteFish(o, p); // v1.10.89
      if (p.act?.startsWith('show:') && p.act !== o.act) playShow(o.c, p.act.slice(5)); // v1.10.92 잡화점: their firework, balloon or bubbles
      for (const [seat, id] of takenSeats) if (id === p.id && (p.act !== 'sit' || p.seat !== seat)) takenSeats.delete(seat);
      o.collect = p.actTarget ? {target:p.actTarget,at:p.actAt} : null; o.act = p.act || null; o.actN = p.actN || 0; o.seat = p.seat || null;
      // v1.10.47: riding the train -- drawn on their seat by the same clock (the server only says which train and seat)
      const ride = p.ride && Number.isInteger(p.ride.id) && Number.isInteger(p.ride.seat) && R.TRAINS.some((t) => t.id === p.ride.id) && R.SEATS[p.ride.seat] ? { id: p.ride.id, seat: p.ride.seat } : null;
      if (ride && !o.ride) { o.c.anim?.loop?.('rideLook') || o.c.anim?.loop?.('sitIdle'); o.c.noTuck = true; o.c.tailTucked = true; o.c.tuckTail?.(true); }
      if (!ride && o.ride) { o.c.noTuck = false; o.c.anim?.release?.(); o.c.tailTucked = false; o.c.tuckTail?.(false); }
      o.ride = ride; o.platform = p.platform || null; o.space = p.space || 'island'; o.home = p.home || null; // v1.10.84 (묶음 4: which house)
      o.pet = p.pet || null; // B 47 반려동물
      o.bike = ['mint', 'red', 'sky', 'butter'].includes(p.bike) && (p.space || 'island') === 'island' ? p.bike : null; o.space = p.space || 'island'; // (자전거)
    }
    for (const [id, o] of others) if (!seen.has(id)) { disposeCharacter(o.c); others.delete(id); for (const [seat, who] of takenSeats) if (who === id) takenSeats.delete(seat); }
  }
  // v1.9.6: the server moved me out of someone (it saw an overlap my screen did not): glide there, through tryMove.
  let correction = null;
  function correctTo(x, z) {
    if (liftRide || riding) return;
    if (platform) { const q = R.platformClamp(platform.line, platform.station, x, z); me.root.position.set(q.x, q.y, q.z); correction = null; return; }
    const d = Math.hypot(x - me.root.position.x, z - me.root.position.z);
    if (mySpace === 'townhall') { const q = globalThis.IslandTerrain.roomClamp(x, z); if (d > 0.3) { me.root.position.set(q.x, ROOM.y, q.z); correction = null; } else if (d > 0.05) correction = q; return; } // v1.10.84
    if (mySpace === 'store' || mySpace === 'furniture' || mySpace === 'petshop' || mySpace === 'home') { const R = mySpace === 'store' ? STORE : mySpace === 'furniture' ? FURN : mySpace === 'petshop' ? PETS : homeRoom; const q = R.clamp(x, z); if (d > 0.3) { me.root.position.set(q.x, R.ROOM.y, q.z); correction = null; } else if (d > 0.05) correction = q; return; } // v1.10.92, 묶음 2
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
    stepCorrection(dt); stepRising();
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
      p.y = o.space === 'townhall' ? ROOM.y : o.space === 'store' ? STORE.ROOM.y : o.space === 'furniture' ? FURN.ROOM.y : o.space === 'petshop' ? PETS.ROOM.y : o.space === 'home' ? HOME.ROOM.y : heightAt(p.x, p.z);
      o.c.root.visible = o.space === mySpace && (mySpace !== 'home' || o.home === homeHere?.lot?.id); // v1.10.84: the 민원실 and the island never show each other (묶음 4: nor two houses)
      // facing: the way they are drawn walking, and the server's facing once they stand
      o.c.targetYaw = f.speed > 0.8 && f.heading != null ? f.heading : at.yaw;
      if (o.collect && ['gather','pickup','pickFruit'].includes(o.act)) {
        o.c.targetYaw=Math.atan2(o.collect.target.x-p.x,o.collect.target.z-p.z);
        const t=(Date.now()+serverOffset-o.collect.at)/1000;
        if(o.act==='pickFruit' && t>=0.98 && t<1.48 && !o.c.holding?.fruit) assets.hold(o.c,'prop.harvest.fruit',0,{key:'fruit'});
        if(t>=1.48) assets.letGo(o.c,'fruit');
      }
      if (o.act === 'sit') { const s = SEATS.find((x) => x.id === o.seat); if (s) { p.x = s.x; p.z = s.z; p.y = (s.y ?? heightAt(s.x, s.z)) + SEAT_LIFT; o.c.targetYaw = s.yaw; } } // v1.10.44 (B 44: a room seat has its floor)
      if (o.platform && !o.ride) { const q = R.platformClamp(o.platform.line, o.platform.station, p.x, p.z); p.set(q.x, q.y, q.z); animate(o.c, dt, f.speed > .4, f.speed); continue; }
      if (o.ride) { const q = R.seatAt(o.ride.id, o.ride.seat, trainNow()); p.set(q.x, q.y, q.z); o.c.root.rotation.y = q.yaw; o.c.targetYaw = q.yaw; animate(o.c, dt, false, 0); continue; } // v1.10.47
      animate(o.c, dt, o.act !== 'sit' && f.speed > 0.4, o.act === 'sit' ? 0 : f.speed);
      bikeOf(o.c, o.bike, f.speed, dt); // (자전거: theirs too)
    }
  }
  // CI 3차 검토: t never goes back (the server keeps the newest pose by it) -- a better clock reading can move serverOffset back
  let poseT = 0; const poseClock = () => (poseT = Math.max(poseT + 1, Math.round(Date.now() + serverOffset)));
  const pose = () => ({ t: Number.isFinite(clockRtt) ? poseClock() : undefined, x: liftRide?.to.x ?? me.root.position.x, z: liftRide?.to.z ?? me.root.position.z, yaw: me.root.rotation.y, moving: keys.size > 0 && !isBlocked() && !riding && !liftRide, act: myAct.act, actN: myAct.n, seat: myAct.seat, bike: cycling }); // v1.10.44 act, 자전거

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
    for (const slot of ['outfit', 'hair', 'hat']) {
      AVATAR_PARTS[look[slot]]?.(parts);
      if (slot === 'hair') {
        const color = look.hair ? look.dye?.[look.hair] : look.hairColor;
        const original = hairCap.material.color.getHex();
        if (color) head.traverse((o) => { if (o.isMesh && o.material.color?.getHex() === original) tint(o, color); });
      }
    }
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
  // v1.10.62 모바일: a touch stick (app.js) walks like the arrows, relative to the view ({x, y}: right / toward me, -1..1)
  const keys = new Set(); let stick = null;
  const shifts = new Set(); let pace = 'walk'; let paceDownAt = 0; let paceRun = false; let paceTimer = 0;
  const paceDown = () => { if (paceDownAt) return; paceDownAt = performance.now(); clearTimeout(paceTimer); paceTimer = setTimeout(() => { if (paceDownAt) paceRun = true; }, RUN_HOLD_MS); };
  const paceUp = () => { if (!paceDownAt) return; if (!paceRun && !cycling) pace = pace === 'walk' ? 'slow' : 'walk'; /* (on a bike Shift only speeds up) */ shifts.clear(); paceDownAt = 0; paceRun = false; clearTimeout(paceTimer); };
  const paceSpeed = () => (cycling ? (paceRun || shifts.size ? BIKE_FAST : BIKE_SPEED) : paceRun ? RUN_SPEED : pace === 'slow' ? SLOW_SPEED : SPEED);
  // 자전거 (gamecenter-notes docs/bicycle-20261020.md, assets 61): B (or the phone's button) gets on and off one of the
  // bikes in my bag; 9 m/s, 12 while Shift is held (the phone: the 뛰기 button) (사용자 2026-10-21); off by itself indoors, on stairs and on the
  // train, among people (3 within 5 m) -- on a bridge it rides on (문제 기록 2회차 6); bumping into
  // something just stops it. Everyone sees it (the pose's `bike`, the colour). Under a rider: the frame, two wheels
  // turning with the ground and the crank turning with BikeRide (one turn a loop, its rate the speed / 4).
  const BIKE_SPEED = 9; const BIKE_FAST = 12; const BIKE = { wheelR: 0.24, front: [0, 0.24, -0.42], rear: [0, 0.24, 0.42], crank: [0, 0.27, 0.02] };
  let bikes = []; let cycling = null; let onBike = null; // (the colours in my bag; the one I ride; the app's ear)
  function bikeWhy() { // why not here, or null
    if (mySpace !== 'island') return '실내에서는 자전거에서 내려요.';
    if (riding || platform || liftRide) return '열차에서는 자전거에서 내려요.';
    const T = globalThis.IslandTerrain; const p = me.root.position;
    if (T.onStairs?.(p.x, p.z)) return '계단에서는 자전거에서 내려요.';
    let near = 0; for (const o of others.values()) if ((o.space || 'island') === 'island' && Math.hypot(o.c.root.position.x - p.x, o.c.root.position.z - p.z) < 5) near += 1;
    return near >= 3 ? '사람이 많은 곳이라 자전거에서 내려요.' : null;
  }
  // off by itself where it may not go: every frame, and at once when I am put somewhere (a warp or a door) -- a frame can be
  // seconds away while a new place's models come in
  function bikeCheck() { if (!cycling) return; const why = bikeWhy(); if (why) { cycling = null; onBike?.(false, why); } }
  function setBikes(list) { bikes = (list || []).filter((c) => ['mint', 'red', 'sky', 'butter'].includes(c)); if (cycling && !bikes.includes(cycling)) cycling = null; }
  function toggleBike(color = null) { // -> 'on' | 'off' | the reason not
    if (cycling) { cycling = null; return 'off'; }
    if (!bikes.length) return '자전거가 없어요. 잡화점에서 살 수 있어요.';
    const why = bikeWhy(); if (why) return why;
    if (sitting) standUp();
    cycling = color && bikes.includes(color) ? color : bikes[0]; return 'on';
  }
  function bikeOf(c, color, speed, dt) { // a rider's bike (or none), turning as it goes
    if (c.bike && c.bike.color !== color) { c.bike.group.removeFromParent(); c.bike = null; if (c.anim?.held?.startsWith('bike')) c.anim.release(); }
    if (!color) return;
    if (!c.bike) {
      const group = new THREE.Group(); group.rotation.y = Math.PI; c.root.add(group); // (its front -Z, as the character's model)
      const part = (id, at, stand) => { const root = new THREE.Group(); root.position.set(...at); group.add(root); const f = new THREE.Group(); stand(f); root.add(f); assets.attach(id, root, f); return root; };
      part(`bike.frame__${color}`, [0, 0, 0], (f) => mesh(new THREE.BoxGeometry(0.12, 0.5, 0.8), mat(0x6fcf9f), 0, 0.5, 0, f));
      const wheel = (at) => part('bike.wheel', at, (f) => { const m = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 16), mat(0x333333), 0, 0, 0, f); m.rotation.z = Math.PI / 2; });
      c.bike = { color, group, front: wheel(BIKE.front), rear: wheel(BIKE.rear), crank: part('bike.crank', BIKE.crank, (f) => mesh(new THREE.BoxGeometry(0.3, 0.05, 0.05), mat(0x555555), 0, 0, 0, f)) };
    }
    const b = c.bike; const ride = speed > 0.4;
    // (문제 기록 2회차 2: on a slope the front wheel went into the ground -- the bike leans with the ground under its two
    // wheels and stands at their middle height; the rider's root is level, facing +z)
    {
      const p = c.root.position; const yaw = c.root.rotation.y; const half = Math.abs(BIKE.front[2]); const sx = Math.sin(yaw) * half; const sz = Math.cos(yaw) * half;
      const hf = heightAt(p.x + sx, p.z + sz); const hr = heightAt(p.x - sx, p.z - sz);
      b.group.rotation.x = -Math.atan2(hf - hr, half * 2); b.group.position.y = (hf + hr) / 2 - p.y; b.pitch = b.group.rotation.x;
    }
    for (const w of [b.front, b.rear]) w.rotation.x -= (speed / BIKE.wheelR) * dt;
    if (c.anim) { c.anim.loop(ride ? 'bikeRide' : 'bikeIdle', ride ? speed / 4 : 1); b.crank.rotation.x = ride ? -2 * Math.PI * c.anim.heldTime() : -1.5 * Math.PI; }
    else b.crank.rotation.x -= ride ? speed / 4 * 2 * Math.PI * dt : 0;
  }
  const isTyping = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  const isBlocked = () => Boolean(blocked?.()) || !running;
  const onKeyDown = (event) => {
    if (isBlocked() || isTyping(event.target)) return;
    if (event.code === 'Space' && event.target.closest?.('button')) return;
    if (event.key.startsWith('Arrow')) { keys.add(event.key); event.preventDefault(); return; }
    if (event.key === 'Shift') { if (!event.repeat) { shifts.add(event.code); paceDown(); } return; } // (Codex: either Shift, until both are up)
    if (event.key === 'Escape' && actLocked()) actLock = 0; // v1.10.89: Esc lets a motion's hold go too (Codex review)
    if (event.key === 'Escape' && gather?.waitServer) { endGather(false); event.preventDefault(); return; }
    // v1.10.21: W/A/S/D turn the camera (the physical keys, so a Korean input mode works too); the arrows still walk
    if (CAM_KEYS.has(event.code) && !event.ctrlKey && !event.metaKey && !event.altKey) { camKeys.add(event.code); event.preventDefault(); return; }
    // 문제 기록 9: Q nearer, E further -- a wheel notch's step, kept the same way (gc.islandZoom); held, it goes on
    if ((event.code === 'KeyQ' || event.code === 'KeyE') && !event.ctrlKey && !event.metaKey && !event.altKey && (event.target === document.body || host.contains(event.target))) { event.preventDefault(); setZoom(zoomDist * Math.exp((event.code === 'KeyQ' ? -100 : 100) * 0.0012)); return; }
    if (event.code === 'KeyB' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && (event.target === document.body || host.contains(event.target))) { event.preventDefault(); const r = toggleBike(); onBike?.(r === 'on', r === 'on' || r === 'off' ? null : r); return; } // (자전거)
    if (event.code === 'KeyR' && grab && !event.repeat) { event.preventDefault(); turnGrab(); return; } // (2회차 11: turn the held piece)
    if (event.code === 'Space' && (event.target === document.body || host.contains(event.target))) {
      event.preventDefault();
      if (!event.repeat) actDown(); // (2회차 11: held before a piece of my house it grabs it -- actUp on the key's release)
    }
  };
  const onKeyUp = (event) => { if (event.code === 'Space') actUp(); keys.delete(event.key); camKeys.delete(event.code); if (event.key === 'Shift') { shifts.delete(event.code); if (!shifts.size) paceUp(); } };
  const onBlur = () => { keys.clear(); camKeys.clear(); paceDownAt = 0; paceRun = false; clearTimeout(paceTimer); };
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
    const ease = lessMotion?.matches ? 1 : 1 - Math.exp(-dt * 14);
    camYaw += (yawGoal - camYaw) * ease; camPitch = clampPitch(camPitch + (pitchGoal - camPitch) * ease);
  }
  // v1.10.62 확대·축소: the wheel on a PC (down = farther), two fingers on a phone (apart = closer) -- a pinch ends the
  // one-finger turn, and the press does not count as a tap on a facility
  const pinch = new Map(); let pinchFrom = null; // touch pointer id -> {x, y}; the span and zoom when the second finger came
  const pinchSpan = () => { const [a, b] = [...pinch.values()]; return Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)); };
  const onWheel = (event) => { if (isBlocked()) return; event.preventDefault(); setZoom(zoomDist * Math.exp(event.deltaY * 0.0012)); };
  const onDown = (event) => {
    if (event.pointerType === 'touch') {
      pinch.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch.size === 2) { pinchFrom = { span: pinchSpan(), zoom: zoomDist }; drag = null; dragged = true; return; }
    }
    if (event.button !== 0 || pinch.size > 1) return; drag = { x: event.clientX, y: event.clientY, id: event.pointerId }; dragged = false;
  };
  const onClick = (event) => { if (dragged) { dragged = false; return; } if (isBlocked()) return; const id = facilityAt(event); if (id) interact(id); };
  const onMove = (event) => {
    if (pinch.has(event.pointerId)) {
      pinch.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinchFrom && pinch.size >= 2) { if (!isBlocked()) setZoom(pinchFrom.zoom * pinchFrom.span / pinchSpan()); return; }
    }
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
  const onUp = (event) => {
    if (pinch.delete(event.pointerId) && pinch.size < 2) pinchFrom = null;
    if (drag?.id === event.pointerId) { drag = null; renderer.domElement.style.cursor = 'grab'; }
  };
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
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
  const WEED_CELL = 30; const WEED_GRID = 4; const WEED_REACH = 1.6; const WEED_MS = 1400; const WEED_LIFT = 620; /* v1.10.89 assets 37: 1.4 s, the weed comes up at the clip's lift event (0.62 s) */ const NOTHING = new THREE.Matrix4().makeScale(0, 0, 0);
  let weedCells = []; const weedById = new Map(); let weedGrid = new Map(); let weedKey = null; let gather = null;
  const weedRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.4, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff7c2, transparent: true, opacity: 0.85, depthWrite: false }));
  weedRing.visible = false; weedRing.renderOrder = 1; scene.add(weedRing);
  const gridKey = (x, z) => `${Math.floor(x / WEED_GRID)},${Math.floor(z / WEED_GRID)}`;
  // v1.10.90 잡초 게시판 (IDEAS #future-weed-board): a notice board by the town hall's gate, off the path (the farm sign's
  // model, its face toward the plaza); SPACE opens the rankings (app.js)
  let weedBoard = null;
  function prepareWeedBoard() {
    if (weedBoard) return;
    const T = globalThis.IslandTerrain; const p = T.townhallWorld(-5, T.TOWNHALL.yard.z1 + 2.5);
    const root = new THREE.Group(); root.position.set(p.x, heightAt(p.x, p.z), p.z); root.rotation.y = Math.atan2(p.x, p.z); scene.add(root); // its face (-z) toward the plaza
    const post = new THREE.Group(); mesh(new THREE.BoxGeometry(1.4, 0.7, 0.08), mat(0xe9d8b4), 0, 1.29, 0, post); mesh(new THREE.BoxGeometry(0.1, 1.3, 0.1), mat(0x8a6a48), 0, 0.65, 0, post);
    root.add(post); assets.attach('farm.sign', root, post);
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 228; const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2f5a2a'; ctx.textAlign = 'center'; ctx.font = 'bold 58px sans-serif'; ctx.fillText('🌱 잡초 게시판', 256, 100); ctx.font = '32px sans-serif'; ctx.fillStyle = '#4a3020'; ctx.fillText('오늘 뽑은 순위 · 납품 순위', 256, 170);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 0.6), new THREE.MeshBasicMaterial({ map: texture, transparent: true })); face.position.set(0, 1.29, -0.0995); face.rotation.y = Math.PI; root.add(face);
    const d = { x: p.x - Math.sin(root.rotation.y) * 1.2, z: p.z - Math.cos(root.rotation.y) * 1.2 };
    eventDoors.weedboard = { x: d.x, z: d.z, name: '잡초 게시판' };
    weedBoard = { root, door: d };
  }
  function setWeeds(list) {
    prepareWeedBoard();
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
        const w = weedById.get(id); if (!w) continue; const d = Math.hypot(w.x - p.x, w.z - p.z); if (d < bestD) { best = id; bestD = d; }
      }
    }
    return best;
  }
  function stepWeeds(dt) {
    // (문제 기록 2회차 공통 오류: the weed being pulled can leave the list -- a whole new list after the weeds grew or
    // wilted, or taken while the pull was waiting on the server -- and its id pointed at nothing)
    if (gather?.kind === 'weed' && !weedById.has(gather.id) && !gather.pending) endGather(false);
    const id = gather?.kind === 'weed' ? (weedById.has(gather.id) ? gather.id : null) : nearestWeed(); const key = id ? `weed:${id}` : null;
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
  // v1.10.89 행동 중 이동 잠금 (IDEAS #future-action-move-lock): a one-off motion (an emote, standing up, a hand-over, a
  // pick-up) holds me where I stand until its clip has played out -- the arrows stay pressed and move me the moment it
  // ends. The clip's own length (a short default without one), never past 3 s; a window, Esc or leaving lets go at once.
  let actLock = 0;
  const actLocked = () => performance.now() < actLock;
  // standing up: on the seat while the clip plays, then a short glide out (another move, a door or a ride cancels it)
  let rising = null;
  function stepRising() {
    if (!rising) return; if (rising.space !== mySpace || sitting || me.root.position.distanceTo(rising.last || rising.from) > 0.05) { rising = null; return; } // (moved by something else meanwhile)
    const u = (performance.now() - rising.at) / 350; if (u < 0) return;
    const k = Math.min(1, u); me.root.position.lerpVectors(rising.from, rising.to, k * k * (3 - 2 * k)); rising.last = me.root.position.clone(); if (k >= 1) rising = null;
  }
  function lockForClip(played) { actLock = performance.now() + Math.min(3000, (played && me.anim?.onceLeft?.() * 1000) || 900); }
  function startGather({ kind, id = null, ms, anim = 'gather', at = null, onStep = null, waitServer = false, onDone }) {
    if (gather) return false;
    gather = { kind, id, ms, anim, t: 0, startedAt: performance.now(), onStep, onDone, waitServer, pending: false };
    if (at) { me.targetYaw = Math.atan2(at.x - me.root.position.x, at.z - me.root.position.z); if(waitServer) me.root.rotation.y=me.targetYaw; }
    if (anim && !me.anim?.play(anim, waitServer ? { ms, hold: true } : {})) me.hop = 1;
    return true;
  }
  function stepGather(dt) {
    if (!gather) return;
    if (isBlocked() && !(gather.kind === 'sit' && sitting?.seat.counter)) { endGather(false); return; } // (A-7: a window's chair keeps me seated while its window is open)
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
    if (T.dalmaru && ['river', 'lake', 'pool'].includes(T.fishWater(x, z))) { // (달마루섬: rivers, 거울호수, pools -- the ground cut below the sea's level, the surface at it)
      const D = T.dalmaru;
      for (let k = 0; k < 24; k += 1) for (const r of [1.6, 2.4, 3.2]) {
        const a = (k / 24) * TAU; const wx = x + Math.sin(a) * r; const wz = z + Math.cos(a) * r; const g = D.ground(wx, wz);
        if (D.isWater(wx, wz) && D.coastDist(wx, wz) >= 0 && !T.onBridge(wx, wz) && (!best || g < best.cd)) best = { x: wx, z: wz, cd: g, yaw: a, y: D.SEA };
      }
      if (best) return best;
    }
    if (T.fishWater?.(x, z) === 'river') { // v1.10.90 강 낚시: the nearest point of the stream, the float at its surface
      for (let k = 0; k < 24; k += 1) for (const r of [1.6, 2.4, 3.2]) {
        const a = (k / 24) * TAU; const wx = x + Math.sin(a) * r; const wz = z + Math.cos(a) * r; const d = T.streamDist(wx, wz);
        if (d < T.STREAM_HALF * .7 && !T.onBridge(wx, wz) && (!best || d < best.cd)) best = { x: wx, z: wz, cd: d, yaw: a, y: T.streamWaterHeight(wx, wz) };
      }
      if (best) return best;
    }
    for (let k = 0; k < 24; k += 1) {
      const a = (k / 24) * TAU; const wx = x + Math.sin(a) * 5; const wz = z + Math.cos(a) * 5;
      if (T.walkable(wx, wz) || T.coastDist(wx, wz) > -0.5) continue;
      const cd = T.coastDist(wx, wz); if (!best || cd < best.cd) best = { x: wx, z: wz, cd, yaw: a };
    }
    return best;
  }
  // v1.10.89 원격 낚시 (IDEAS #future-remote-action-animation): my phase goes out as the act 'fish:<phase>' (the server
  // takes it only while it holds my cast, and names the catch itself); the others play the same rod and clips
  function fishAct(phase) { if (phase) { myAct.act = `fish:${phase}`; myAct.seat = null; } else if (myAct.act?.startsWith('fish:')) myAct.act = null; }
  // v1.10.92 잡화점 놀이 물건: used from the bag, seen by everyone near -- a firework bursts over me, bubbles float up round
  // me, a balloon in my hand for a while. Small particles of their own (nothing kept on the server but the act).
  const shows = [];
  const SHOW_COLORS = [0xff6b6b, 0xffd166, 0x06d6a0, 0x4cc9f0, 0xc77dff, 0xffffff];
  function playShow(c, kind) {
    if (!c?.root) return;
    if (kind === 'balloon') { assets.hold(c, 'good.balloon', 0, { key: 'balloon', at: [0, -0.015, 0] }); shows.push({ c, kind, t: 0, life: 30, parts: [] }); return; }
    const n = kind === 'firework' ? 36 : 14; const parts = [];
    for (let i = 0; i < n; i += 1) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(kind === 'firework' ? 0.07 : 0.11, 8, 6), new THREE.MeshBasicMaterial({ color: kind === 'firework' ? SHOW_COLORS[i % SHOW_COLORS.length] : 0xcfe9ff, transparent: true, opacity: kind === 'firework' ? 1 : 0.55 }));
      const p = c.root.position; m.position.set(p.x, p.y + (kind === 'firework' ? 4.2 : 1.2), p.z); scene.add(m);
      const a = (i / n) * Math.PI * 2; const up = kind === 'firework' ? (Math.random() - 0.3) * 3 : 0.5 + Math.random() * 0.6;
      parts.push({ m, v: kind === 'firework' ? new THREE.Vector3(Math.cos(a) * 3, up, Math.sin(a) * 3) : new THREE.Vector3(Math.cos(a) * 0.4, up, Math.sin(a) * 0.4), delay: kind === 'bubbles' ? Math.random() * 3 : 0 });
    }
    shows.push({ c, kind, t: 0, life: kind === 'firework' ? 2.4 : 5, parts });
  }
  function stepShows(dt) {
    for (let i = shows.length - 1; i >= 0; i -= 1) {
      const s = shows[i]; s.t += dt;
      for (const p of s.parts) { if (s.t < p.delay) { p.m.visible = false; continue; } p.m.visible = true; p.m.position.addScaledVector(p.v, dt); if (s.kind === 'firework') p.v.y -= 2.2 * dt; p.m.material.opacity = Math.max(0, (s.kind === 'firework' ? 1 : 0.55) * (1 - (s.t - p.delay) / (s.life - p.delay))); }
      if (s.t >= s.life) { for (const p of s.parts) { scene.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); } if (s.kind === 'balloon') assets.letGo(s.c, 'balloon'); shows.splice(i, 1); }
    }
  }
  // B 47 함께하는 섬: the 우체통 east of the plaza (always; a letter's notice is the app's), the birthday corner north-west
  // (banner with today's names drawn on, balloons, a cake) only on someone's birthday, and a cheer's confetti over them
  let together = null;
  function prepareTogether() {
    if (together) return together;
    const V = globalThis.IslandTerrain.VILLAGE;
    const holder = (parent, x, y, z, yaw, id, fallback) => { const root = new THREE.Group(); root.position.set(x, y, z); root.rotation.y = yaw; parent.add(root); root.add(fallback); assets.attach(id, root, fallback); return root; };
    const box = (w, h, d, color) => { const g = new THREE.Group(); mesh(new THREE.BoxGeometry(w, h, d), mat(color), 0, h / 2, 0, g); return g; };
    const M = V.mailbox; holder(scene, M.x, heightAt(M.x, M.z), M.z, M.yaw, 'together.mailbox', box(0.55, 1.4, 0.5, 0xc0392b));
    eventDoors.mailbox = { x: M.x - Math.sin(M.yaw) * 1.1, z: M.z - Math.cos(M.yaw) * 1.1, name: '우체통' };
    const MU = globalThis.IslandTerrain.MUSEUM; holder(scene, MU.x, heightAt(MU.x, MU.z), MU.z, MU.yaw, 'together.museum_exterior', box(9, 5, 7, 0xe8dcc4)); // B 47 박물관 (the outside)
    eventDoors.museum = { x: MU.x - Math.sin(MU.yaw) * 4.9, z: MU.z - Math.cos(MU.yaw) * 4.9, name: '섬 박물관' }; // (lib/island-together.js museumDoor, the server's)
    const B = V.birthday; const corner = new THREE.Group(); corner.position.set(B.x, heightAt(B.x, B.z), B.z); corner.rotation.y = B.yaw; corner.visible = false; scene.add(corner);
    holder(corner, 0, 0, 0, 0, 'together.birthday_banner', box(3.2, 2.3, 0.1, 0xf6d6e0));
    for (const x of [-2.1, 2.1]) holder(corner, x, 0, 0.1, 0, 'together.birthday_balloons', box(0.6, 2, 0.4, 0xff8fab));
    holder(corner, 0, 0, -1.3, 0, 'together.birthday_cake', box(0.5, 0.5, 0.5, 0xfff1e6));
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 192;
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.5), new THREE.MeshBasicMaterial({ map: texture, transparent: true })); label.position.set(0, 1.62, -0.24); label.rotation.y = Math.PI; corner.add(label);
    together = { corner, canvas, texture, names: [] };
    return together;
  }
  // B 47 안내 주민: always by the spawn (talking to her teaches again); while a guide step points somewhere, an arrow on
  // the ground a little ahead of me turns toward it (gone once I am there)
  let guide = null;
  function prepareGuide() {
    if (guide) return guide;
    const G = globalThis.IslandTerrain.VILLAGE.guide;
    const c = makeCharacter({ shirt: 0x4f9d8a, hair: 0x5a3a28, skin: 0xffdcbc }); c.root.position.set(G.x, heightAt(G.x, G.z), G.z); c.root.rotation.y = G.yaw + Math.PI; scene.add(c.root);
    assets.dress(['character.guide', 'character.npc'], c); dressUp(c, { gender: 'female' }, { shirt: 0x4f9d8a });
    c.home = { x: G.x, z: G.z, yaw: G.yaw + Math.PI, id: 'guide' }; npcs.push(c);
    eventDoors.guide = { x: G.x - Math.sin(G.yaw) * 1.2, z: G.z - Math.cos(G.yaw) * 1.2, name: '안내 주민' };
    const arrow = new THREE.Group(); arrow.visible = false; scene.add(arrow);
    const fallback = new THREE.Group(); const cone = mesh(new THREE.ConeGeometry(0.25, 0.6, 12), mat(0xffd166), 0, 0.05, 0, fallback); cone.rotation.x = -Math.PI / 2; arrow.add(fallback); assets.attach('together.guide_arrow', arrow, fallback);
    guide = { c, arrow, target: null };
    return guide;
  }
  function setGuideTarget(target) { prepareGuide().target = target && Number.isFinite(target.x) ? { x: target.x, z: target.z } : null; }
  function stepGuideArrow() {
    if (!guide) return; const t = guide.target; const p = me.root.position;
    const dx = t ? t.x - p.x : 0; const dz = t ? t.z - p.z : 0; const d = Math.hypot(dx, dz);
    guide.arrow.visible = Boolean(t) && d > 3 && !photoMode; if (!guide.arrow.visible) return;
    const x = p.x + (dx / d) * 1.6; const z = p.z + (dz / d) * 1.6; guide.arrow.position.set(x, heightAt(x, z) + 0.05, z); guide.arrow.rotation.y = Math.atan2(-dx, -dz); // (its front, -Z, toward the place)
  }
  // 묶음 5 보이는 곤충 (docs/insects-visible-20261020.md, assets 62 insects-v1): the server's insects where they live, each
  // moving its own way about its spot on the server's clock (so every screen sees much the same) -- butterflies and
  // dragonflies round it in the air (now and then settling or hovering), a firefly drifting and glowing, a cicada or a
  // beetle on its tree's trunk, a grasshopper hopping about, a ladybird or a snail creeping round its flower; drawn near
  // me only; run or ridden at, it flies off (app.js tells the server: gone for everyone); with a 잠자리채, walked up to,
  // SPACE catches it (the net swung, app.js)
  const INSECT_FLY = new Set(['butterfly_cabbage', 'butterfly_blue', 'butterfly_swallowtail', 'dragonfly_red', 'dragonfly_emperor']);
  const INSECT_TREE = new Set(['cicada', 'rhinoceros_beetle', 'stag_beetle']);
  const INSECT_NEAR = 40; const INSECT_SCARE = 5; const INSECT_REACH = 2;
  let insectList = []; const insectShown = new Map(); let insectNet = false; let onInsectScare = null;
  function setInsects(list, net) { if (Array.isArray(list)) insectList = list; if (net !== undefined) insectNet = Boolean(net); }
  function insectsGone(ids) { const gone = new Set(ids || []); insectList = insectList.filter((b) => !gone.has(b.id)); for (const id of gone) { const h = insectShown.get(id); if (h && !h.flee) h.flee = { t: 0, x: Math.random() - 0.5, z: Math.random() - 0.5 }; } }
  const insectHash = (id, k) => { let h = 2166136261; for (const ch of `${id}:${k}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 10000) / 10000; };
  function insectHolder(species) {
    const c = { root: new THREE.Group(), mixer: null, actions: {}, want: 'Rest', now: null, gone: false,
      play(name) { c.want = name; if (!c.mixer || c.now === name) return; const next = c.actions[name] || c.actions.Rest || c.actions.Crawl; if (!next) return; next.reset().fadeIn(0.15).play(); c.actions[c.now]?.fadeOut(0.15); c.now = name; },
      dispose() { c.gone = true; c.root.removeFromParent(); } };
    scene.add(c.root); assets.creature([`insect.${species}`], c); return c;
  }
  // where the insect is now, its facing and its clip (t: seconds on the server's clock)
  function insectPose(b, t) {
    const ph = insectHash(b.id, 1) * TAU; const g = heightAt(b.x, b.z);
    if (INSECT_FLY.has(b.species) || b.species === 'firefly') {
      const dragon = b.species.startsWith('dragonfly'); const cycle = 14; const at = (t + ph * 3) % cycle;
      if (!dragon && b.species !== 'firefly' && at > cycle - 4) return { x: b.x, y: g + 0.32, z: b.z, yaw: ph, clip: 'Rest' }; // (a butterfly on its flower)
      const hover = dragon && at % 6 > 4.5; const a = ph + (t - (hover ? (at % 6) - 4.5 : 0)) * (dragon ? 1.4 : b.species === 'firefly' ? 0.35 : 0.8); const R = b.species === 'firefly' ? 1.6 : 1.4;
      return { x: b.x + Math.cos(a) * R, y: g + (b.species === 'firefly' ? 0.9 : 1.1) + Math.sin(t * 1.7 + ph) * 0.3, z: b.z + Math.sin(a) * R, yaw: Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI, clip: hover ? 'Rest' : 'Fly' };
    }
    if (INSECT_TREE.has(b.species)) { const r = (b.r || 0.3) + 0.06; const up = 1.3 + insectHash(b.id, 2) * 0.5 + Math.max(0, Math.sin(t * 0.3 + ph)) * 0.25; return { x: b.x + Math.cos(ph) * r, y: g + up, z: b.z + Math.sin(ph) * r, trunk: ph, clip: Math.cos(t * 0.3 + ph) > 0.2 && Math.sin(t * 0.3 + ph) > 0 ? 'Crawl' : 'Rest' }; }
    if (b.species === 'grasshopper') { const k = Math.floor((t + ph) / 5); const u = ((t + ph) % 5) / 0.6; const spot = (n) => ({ x: b.x + (insectHash(b.id, 10 + (n % 7)) - 0.5) * 1.6, z: b.z + (insectHash(b.id, 20 + (n % 7)) - 0.5) * 1.6 }); const p0 = spot(k - 1); const p1 = spot(k); const hop = u < 1; const q = hop ? { x: p0.x + (p1.x - p0.x) * u, z: p0.z + (p1.z - p0.z) * u } : p1; return { x: q.x, y: heightAt(q.x, q.z), z: q.z, yaw: Math.atan2(p1.x - p0.x, p1.z - p0.z) + Math.PI, clip: hop ? 'Hop' : 'Rest' }; }
    const a = ph + t * (b.species === 'snail' ? 0.05 : 0.18); const R = 0.35; // (the creepers, round their flower or tuft)
    return { x: b.x + Math.cos(a) * R, y: g + (b.type === 'flower' ? 0.24 : 0.02), z: b.z + Math.sin(a) * R, yaw: Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI, clip: 'Crawl' };
  }
  function stepInsects(dt, moving) {
    const m = me.root.position; const t = (Date.now() + serverOffset) / 1000; const near = INSECT_NEAR * (quality === 0 ? 0.6 : 1);
    const want = mySpace === 'island' ? insectList.filter((b) => Math.hypot(b.x - m.x, b.z - m.z) < near) : [];
    const ids = new Set(want.map((b) => b.id));
    for (const [id, h] of insectShown) if (!ids.has(id) && !h.flee) { h.c.dispose(); insectShown.delete(id); }
    const fast = moving && (paceRun || cycling);
    for (const b of want) {
      let h = insectShown.get(b.id); if (!h) { h = { c: insectHolder(b.species), b }; insectShown.set(b.id, h); }
      const q = insectPose(b, t); h.c.root.position.set(q.x, q.y, q.z);
      if (q.trunk !== undefined) h.c.root.rotation.set(Math.PI / 2, Math.atan2(Math.cos(q.trunk), Math.sin(q.trunk)), 0, 'YXZ'); // (stood up on the trunk, -Z up, its belly to the bark)
      else h.c.root.rotation.set(0, q.yaw, 0, 'YXZ');
      h.c.play(q.clip);
      if (b.species === 'firefly') { h.glow ||= (() => { let found = null; h.c.root.traverse((o) => { for (const mm of [].concat(o.material || [])) if (mm.name === 'glow') found = mm; }); return found; })(); if (h.glow) h.glow.emissiveIntensity = 1.2 + Math.sin(t * 3 + insectHash(b.id, 3) * 6) * 1.0; }
      if (fast && !h.scared && Math.hypot(q.x - m.x, q.z - m.z) < INSECT_SCARE) { h.scared = true; onInsectScare?.(b.id); }
    }
    for (const [id, h] of insectShown) { // flying off (scared, or caught by someone else): up and away, then gone
      if (!h.flee) continue; h.flee.t += dt; const p = h.c.root.position; p.y += dt * 2.4; p.x += h.flee.x * dt * 4; p.z += h.flee.z * dt * 4; h.c.root.rotation.set(0, Math.atan2(h.flee.x, h.flee.z) + Math.PI, 0); h.c.play('Fly');
      if (h.flee.t > 1.4) { h.c.dispose(); insectShown.delete(id); }
    }
  }
  // the insect nearest me within reach (not flying off) -- the catch prompt's
  function nearInsect() { const m = me.root.position; let best = null; let bd = INSECT_REACH; for (const [, h] of insectShown) { if (h.flee) continue; const p = h.c.root.position; const d = Math.hypot(p.x - m.x, p.z - m.z); if (d < bd) { bd = d; best = h; } } return best; }
  // caught (by me): the net swung, a cheer, the insect gone at once
  function insectSwing(id) {
    assets.hold(me, 'together.tool_bugnet', 0, { key: 'bugnet', at: [-0.06507324, -0.046534647, 0], rot: [0, 0, -0.95] });
    const h = insectShown.get(id); if (h) { h.c.dispose(); insectShown.delete(id); } insectList = insectList.filter((b) => b.id !== id);
    me.anim?.play('cheer'); setTimeout(() => assets.letGo(me, 'bugnet'), 1400);
  }
  // B 47 반려동물: one small animal walks a little behind and beside its owner (me or another player), Walk while it
  // catches up, Sit when the owner sits, Idle otherwise; its name over it. Far off (a door, a ride) it is simply there.
  const pets = new Map(); let myPet = null;
  function setMyPet(want) { myPet = want?.kind ? { kind: want.kind, coat: want.coat || null, name: want.name || '' } : null; }
  function petHolder(kind, coat = null) { // (play: the clip to show, crossfaded once the model is in; dispose: away)
    const c = { root: new THREE.Group(), mixer: null, actions: {}, want: 'Idle', now: null, gone: false,
      play(name) { c.want = name; if (!c.mixer || c.now === name) return; const next = c.actions[name] || c.actions.Idle; if (!next) return; next.reset().fadeIn(0.2).play(); c.actions[c.now]?.fadeOut(0.2); c.now = name; },
      dispose() { c.gone = true; c.root.removeFromParent(); } };
    scene.add(c.root); assets.creature([...(coat ? [`pet.${kind}__${coat}`] : []), `together.pet_${kind}`], c); return c;
  }
  let petClock = 0;
  function stepPets() {
    const now = performance.now(); const dt = Math.min(0.5, (now - (petClock || now)) / 1000); petClock = now; // (real time: a slow or hidden frame does not leave it behind)
    const want = new Map([['me', myPet], ...[...others].map(([id, o]) => [id, o.pet])]);
    for (const [key, p] of pets) { const w = want.get(key); if (!w || w.kind !== p.kind || w.name !== p.name || (w.coat || null) !== p.coat) { p.c.dispose(); pets.delete(key); } }
    for (const [key, w] of want) {
      const owner = key === 'me' ? me : others.get(key)?.c; if (!w || !owner?.root) continue;
      let p = pets.get(key);
      if (!p) { p = { c: petHolder(w.kind, w.coat || null), kind: w.kind, name: null, coat: w.coat || null }; const o = owner.root.position; p.c.root.position.set(o.x + 0.8, heightAt(o.x + 0.8, o.z), o.z); pets.set(key, p); }
      // (문제 기록 2회차 10: a named pet wears a name tag as the players do -- mine and others', changed when renamed)
      if ((w.name || null) !== p.name) { p.tag?.removeFromParent(); p.name = w.name || null; p.tag = p.name ? makeTag(p.name, null) : null; if (p.tag) { p.tag.scale.multiplyScalar(0.7); p.tag.position.y = 1.15; p.c.root.add(p.tag); } }
      const yaw = owner.root.rotation.y; const fx = Math.sin(yaw); const fz = Math.cos(yaw); // (game yaw 0 faces +z)
      const tx = owner.root.position.x - fx * 0.9 + fz * 0.6; const tz = owner.root.position.z - fz * 0.9 - fx * 0.6;
      const r = p.c.root.position; const dx = tx - r.x; const dz = tz - r.z; const d = Math.hypot(dx, dz);
      if (d > 12) r.set(tx, heightAt(tx, tz), tz);
      else if (d > 0.2) { const step = Math.min(d, Math.max(2.5, d * 3) * dt); r.x += (dx / d) * step; r.z += (dz / d) * step; r.y = Math.max(owner.root.position.y - 0.05, heightAt(r.x, r.z)); p.c.root.rotation.y = Math.atan2(-dx, -dz); } // (its front, -Z, the way it goes)
      const sat = key === 'me' ? Boolean(sitting) : Boolean(others.get(key)?.seat);
      p.c.play(d > 0.3 ? 'Walk' : sat ? 'Sit' : 'Idle');
    }
  }
  function setBirthdays(names) {
    const t = prepareTogether(); t.names = (names || []).slice(0, 4); t.corner.visible = t.names.length > 0; if (!t.names.length) return;
    const ctx = t.canvas.getContext('2d'); ctx.clearRect(0, 0, 1024, 192); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#b8325a'; ctx.font = 'bold 84px sans-serif'; ctx.fillText(`🎂 ${t.names.map((n) => `${n}님`).join(' · ')} 생일 축하해요`, 512, 96, 1000); t.texture.needsUpdate = true;
  }
  function birthdayCheer(toId) { // confetti over the one cheered (the pack's burst, popping up and away) and the firework's sparks
    const c = toId === 'me' ? me : others.get(toId)?.c; if (!c?.root) return; // ('me': the app knows my id)
    playShow(c, 'firework');
    const root = new THREE.Group(); root.position.copy(c.root.position); root.position.y += 2.2; scene.add(root); const fallback = new THREE.Group(); root.add(fallback); assets.attach('together.confetti_burst', root, fallback);
    const t0 = performance.now(); const tick = () => { const k = (performance.now() - t0) / 1800; if (k >= 1) { scene.remove(root); return; } root.scale.setScalar(0.4 + k); root.position.y += 0.004; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  }
  function useShow(kind) { playShow(me, kind); myAct.act = `show:${kind}`; myAct.seat = null; const n = ++myAct.n; setTimeout(() => { if (myAct.n === n && myAct.act === `show:${kind}`) myAct.act = null; }, 8000); } // (8 s: a slow screen nearby still gets it)
  function remoteFish(o, p) {
    const was = o.act?.startsWith('fish:') ? o.act.slice(5) : null; const now = p.act?.startsWith('fish:') ? p.act.slice(5) : null;
    if (was === now) return;
    const c = o.c;
    if (!now) { clearTimeout(o.fishTimer); assets.letGo(c, 'rod'); assets.letGo(c, 'catch'); c.noTuck = false; c.anim?.release?.(); return; }
    if (!was) { c.noTuck = true; assets.hold(c, 'fishing.rod', 0, { key: 'rod' }); const w = waterFrom(p.x, p.z); if (w) c.root.rotation.y = Math.atan2(w.x - p.x, w.z - p.z); }
    if (now === 'cast') c.anim?.play('fishCast');
    else if (now === 'wait') c.anim?.loop?.('fishWait');
    else if (now === 'reel') { c.anim?.play('fishBite'); c.anim?.loop?.('fishReel'); }
    else if (now === 'miss') { c.anim?.release?.(); c.anim?.play('fishMiss'); }
    else if (now === 'catch') {
      c.anim?.release?.(); c.anim?.play('fishCatch'); clearTimeout(o.fishTimer);
      o.fishTimer = setTimeout(() => { if (o.act !== 'fish:catch') return; assets.letGo(c, 'rod');
        o.fishTimer = setTimeout(() => { if (o.act !== 'fish:catch' || !p.fish) return; const fit = FISH_HOLD[p.fish] || FISH_HOLD.default; assets.hold(c, `fish.${p.fish}`, 0, { key: 'catch', at: fit.at, rot: fit.rot }); }, 260); }, 420);
    }
  }
  function fishBegin({ biteIn, window: biteMs }, onEnd) {
    const water = waterFrom(me.root.position.x, me.root.position.z); if (!water || fishing) return false;
    const ok = startGather({ kind: 'fish', ms: Infinity, anim: 'fishCast', at: water, onDone: () => fishStop(false) });
    if (!ok) return false;
    fishing = { t: 0, start: performance.now(), phase: 'cast', water, biteAt: biteIn / 1000, biteEnd: biteIn / 1000 + biteMs / 1000, onEnd, landed: false };
    fishAct('cast');
    me.noTuck = true; assets.hold(me, 'fishing.rod', 0, { key: 'rod' });
    return true;
  }
  function fishStop(release = true) {
    const f = fishing; if (!f) return; fishing = null; fishAct(null);
    fishLine.visible = false; bobberHolder.visible = false; if (f.mark) { disposeTag(f.mark); f.mark = null; }
    assets.letGo(me, 'rod'); assets.letGo(me, 'catch'); me.noTuck = false; me.anim?.release?.();
    if (release && gather?.kind === 'fish') { gather.onDone = () => {}; endGather(false); }
    f.onEnd?.();
  }
  // the server's answer: the fish (species) or none (missed)
  function fishResult(species) {
    const f = fishing; if (!f) return;
    f.phase = species ? 'catch' : 'miss'; f.t0 = f.t; f.species = species; fishAct(f.phase);
    me.anim?.release?.(); me.anim?.play(species ? 'fishCatch' : 'fishMiss');
    if (f.mark) { disposeTag(f.mark); f.mark = null; }
  }
  function stepFishing(dt) {
    const f = fishing; if (!f) return;
    f.t = (performance.now() - f.start) / 1000; // real time: the bite is the server's, a slow frame rate must not show it late
    const sea = (f.water.y ?? SEA_Y) + 0.02; // (a river's own surface, v1.10.90)
    if (f.phase === 'cast' && f.t >= 0.48 && !f.landed) { f.landed = true; bobberHolder.visible = true; fishLine.visible = true; bobberHolder.position.set(f.water.x, sea, f.water.z); }
    if (f.phase === 'cast' && f.t >= 1.0) { f.phase = 'wait'; me.anim?.loop?.('fishWait'); fishAct('wait'); }
    if (f.phase === 'wait' && f.t >= f.biteAt) { f.phase = 'bite'; fishAct('reel'); me.anim?.play('fishBite'); me.anim?.loop?.('fishReel'); f.mark = makeStarMark(); f.mark.position.set(0, 0.7, 0); bobberHolder.add(f.mark); }
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
      onStep: (t) => { const g = weedById.get(id); if (g) weedMatrix(g, new THREE.Matrix4().makeTranslation(0, Math.min(1, Math.max(0, t * 1000 - WEED_LIFT) / (WEED_MS - WEED_LIFT)) * 0.18, 0).multiply(matrix)); }, // the weed gives, from the lift on
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
    if (!o?.npc) { setCarry(me, null); returning.delete(id); return; }
    o.leaving = true; delete eventDoors[`ev:lost_owner:${id}`];
    const p = me.root.position; const q = o.root.position;
    me.targetYaw = Math.atan2(q.x - p.x, q.z - p.z); o.root.rotation.y = Math.atan2(p.x - q.x, p.z - q.z) - o.npc.root.rotation.y; if (o.resident != null) {
      o.npc.returnYaw = Math.atan2(p.x-q.x,p.z-q.z);
    } else o.npc.home.yaw = o.root.rotation.y;
    const gave = me.anim?.play('give'); if (!gave) me.hop = 1; lockForClip(gave);
    o.npc.anim?.play('receive');
    o.giveTimer = setTimeout(() => { // Give's release, Receive's grip: into the owner's hand
      if (!o.root.parent) { returning.delete(id); return; }
      const stand = me.carryStand; me.carryStand = null; me.carryId = null; me.carrying = false;
      if (stand?.parent) { o.receivedStand = stand; o.npc.root.add(stand); stand.position.set(0.32, 0.8, 0.3); }
      assets.handOver(me, o.npc, 'carry'); step('received');
      // Begin the owner's hold after the actual handover: a delayed Give timer must
      // not consume Receive's visible time on a busy or backgrounded page.
      o.receiveTimer = setTimeout(() => { if (o.root.parent) removeEvent(`ev:lost_owner:${id}`, o); returning.delete(id); step('gone'); }, 1400);
    }, 700);
  }
  function removeEvent(key, o) {
    clearTimeout(o.giveTimer); clearTimeout(o.receiveTimer);
    scene.remove(o.root); const rootIndex=facilityRoots.indexOf(o.root); if(rootIndex>=0) facilityRoots.splice(rootIndex,1);
    if (o.resident != null) {
      const c=o.npc;
      if(c?.residentKey===key) {
        delete c.residentKey; delete c.returnYaw; delete c.talkYaw; c.waving=false; c.lookAt=null;
        delete c.root.userData.facility; const index=facilityRoots.indexOf(c.root); if(index>=0) facilityRoots.splice(index,1);
        disposeTag(c.tag); c.tag=null; assets.letGo(c,'cameraBag'); assets.letGo(c,'carry');
        o.receivedStand?.removeFromParent(); c.anim?.release?.();
      }
    } else if (o.npc) { const index=npcs.indexOf(o.npc); if(index>=0) npcs.splice(index,1); disposeCharacter(o.npc); }
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
  // v1.10.80 농부 밭 (IDEAS #future-island-minigames C안): the same field on every screen -- the week's stage from the
  // server (setFarm, app.js asks /api/island/farm), the helpers' names on the sign's face (its board 1.34 x 0.6 m at
  // [0, 1.29, -0.0995], assets 26 README)
  let farm = null;
  function prepareFarm() {
    if (farm) return farm;
    const F = globalThis.IslandTerrain.FARM;
    const place = (id, x, z, fallback, yaw = 0) => {
      const root = new THREE.Group(); root.position.set(x, heightAt(x, z), z); root.rotation.y = yaw; scene.add(root);
      root.add(fallback); assets.attach(id, root, fallback); return root;
    };
    const soil = (h) => { const g = new THREE.Group(); mesh(new THREE.BoxGeometry(F.w, h, F.d), mat(0x8a5a3b), 0, h / 2, 0, g); return g; };
    const fields = [0, 1, 2, 3].map((s) => place(`farm.field.${s}`, F.x, F.z, soil(0.08 + s * 0.04)));
    const post = new THREE.Group(); mesh(new THREE.BoxGeometry(1.4, 0.7, 0.08), mat(0xe9d8b4), 0, 1.29, 0, post); mesh(new THREE.BoxGeometry(0.1, 1.3, 0.1), mat(0x8a6a48), 0, 0.65, 0, post);
    const sign = place('farm.sign', F.sign.x, F.sign.z, post); // its face (-z) toward the lane
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 228;
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 0.6), new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
    face.position.set(0, 1.29, -0.0995); face.rotation.y = Math.PI; sign.add(face);
    farm = { fields, canvas, texture, stage: -1, names: null };
    setFarm({ stage: 0, names: [] });
    return farm;
  }
  // v1.10.93 마을 공동 진행도 (assets 39): the mural (one of four stages shown -- this week's helpers), the painter's easel and
  // the busker's stage; once someone helped the busker this week, he plays (a cheer now and then) for everyone
  let village = null;
  function prepareVillage() {
    if (village) return village;
    const V = globalThis.IslandTerrain.VILLAGE;
    const place = (id, at, fallback) => { const root = new THREE.Group(); root.position.set(at.x, heightAt(at.x, at.z), at.z); root.rotation.y = at.yaw || 0; scene.add(root); root.add(fallback); assets.attach(id, root, fallback); return root; };
    const board = (s) => { const g = new THREE.Group(); mesh(new THREE.BoxGeometry(4, 2.4, 0.2), mat(0xf3ead8), 0, 1.2, 0, g); if (s) mesh(new THREE.BoxGeometry(3.6 * s / 3, 1.5, 0.05), mat(0x6aa9e8), -1.8 + 1.8 * s / 3, 1.43, -0.13, g); return g; };
    const murals = [0, 1, 2, 3].map((s) => place(`village.mural.${s}`, V.mural, board(s)));
    const easel = new THREE.Group(); mesh(new THREE.BoxGeometry(0.8, 1.0, 0.06), mat(0xf3ead8), 0, 1.1, 0, easel); place('village.easel', V.easel, easel);
    const stage = new THREE.Group(); mesh(new THREE.BoxGeometry(3, 0.21, 2), mat(0xb07a4f), 0, 0.105, 0, stage); place('village.busk_stage', V.busk, stage);
    // A2b: the lamps (broken, or mended -- one more per helper of the week), the stepping stones on the stream (their parent at the
    // water, assets 39 README: streamWaterHeight - 0.23), the electrician's toolbox and the book cart (out once the librarian was helped)
    const post = (lit) => { const g = new THREE.Group(); mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.8, 8), mat(0x56606a), 0, 1.4, 0, g); mesh(new THREE.SphereGeometry(0.22, 12, 8), mat(lit ? 0xfff3c2 : 0x8a8f96), 0, 2.85, 0, g); return g; };
    const lamps = V.lamps.map((at) => ({ broken: place('village.lamp_broken', at, post(false)), fixed: place('village.lamp_fixed', at, post(true)) }));
    const rock = (n) => { const g = new THREE.Group(); for (let i = 0; i < n; i += 1) mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.3, 10), mat(0x9a958c), -2.4 + i * 1.2, 0.12, 0, g); return g; };
    const stones = [0, 2, 4, 5].map((n, s) => { const root = place(`village.stepstones.${s}`, V.stones, rock(n)); root.position.y = globalThis.IslandTerrain.streamWaterHeight(V.stones.x, V.stones.z) - 0.23; return root; });
    const box = new THREE.Group(); mesh(new THREE.BoxGeometry(0.6, 0.35, 0.35), mat(0xc0392b), 0, 0.18, 0, box); place('village.toolbox', V.toolbox, box);
    const table = new THREE.Group(); mesh(new THREE.BoxGeometry(1.1, 0.7, 1.1), mat(0x9a6b45), 0, 0.35, 0, table); place('village.table_omok', V.omokTable, table); // A2c (always there)
    const cartBox = new THREE.Group(); mesh(new THREE.BoxGeometry(1.2, 0.9, 0.6), mat(0x8a5a3b), 0, 0.45, 0, cartBox); const cart = place('village.bookcart', V.bookcart, cartBox); cart.visible = false;
    village = { murals, mural: -1, busk: false, cheerAt: 0, lamps, lit: 0, stones, stone: 0, cart };
    return village;
  }
  function setVillage(view) {
    const v = prepareVillage(); const stage = Math.max(0, Math.min(3, Number(view?.mural) || 0));
    v.murals.forEach((root, s) => { root.visible = s === stage; }); v.mural = stage; v.busk = Boolean(view?.busk);
    const lit = Math.max(0, Math.min(3, Number(view?.lamps) || 0)); v.lamps.forEach((l, i) => { l.fixed.visible = i < lit; l.broken.visible = i >= lit; }); v.lit = lit;
    const stone = Math.max(0, Math.min(3, Number(view?.stones) || 0)); v.stones.forEach((root, s) => { root.visible = s === stone; }); v.stone = stone;
    v.cart.visible = Boolean(view?.books);
  }
  function stepVillage(dt) { // the busker plays once helped this week
    if (!village?.busk) return; village.cheerAt -= dt; if (village.cheerAt > 0) return; village.cheerAt = 4 + Math.random() * 3;
    const o = eventObjs.get('ev:quest_npc:busker'); if (o?.npc && !talkView) o.npc.anim?.play?.('cheer');
  }
  function setFarm(view) {
    if (view?.village) setVillage(view.village); // (v1.10.93: the village comes with the farm's answer)
    const f = prepareFarm(); const stage = Math.max(0, Math.min(3, Number(view?.stage) || 0)); const names = (view?.names || []).slice(0, 8);
    f.fields.forEach((root, s) => { root.visible = s === stage; }); f.stage = stage;
    // v1.10.89 밭 수확: a grown field is harvested from its middle (SPACE · 밭 · 수확), until I have this week's
    const F = globalThis.IslandTerrain.FARM;
    if (stage === 3 && !view?.harvested) eventDoors['farm:harvest'] = { x: F.x, z: F.z, name: '밭 · 수확', resource: true }; else delete eventDoors['farm:harvest'];
    const key = names.join('|'); if (f.names === key) return; f.names = key;
    const ctx = f.canvas.getContext('2d'); ctx.clearRect(0, 0, 512, 228);
    ctx.fillStyle = '#4a3020'; ctx.textAlign = 'center'; ctx.font = 'bold 34px sans-serif'; ctx.fillText('이번 주 밭을 지켜 준 사람들', 256, 46);
    ctx.font = '28px sans-serif';
    const lines = names.length ? [names.slice(0, 4).join(' · '), names.slice(4).join(' · ')].filter(Boolean) : ['아직 없어요 — 농부를 도와주세요!'];
    lines.forEach((line, i) => ctx.fillText(line, 256, 110 + i * 46, 492));
    f.texture.needsUpdate = true;
  }
  // v1.10.84 관공서 실내 — 1층 민원실 (IDEAS 2026-10-07, IslandTerrain.TOWNHALL_ROOM): its own room far off the island. In
  // through the hall's door (SPACE · 관공서 들어가기), the counter's clerk takes what the hall took outside before (SPACE ·
  // 민원 창구), the door at the front goes back out (SPACE · 나가기). The server moves me in and out (setSpace).
  const ROOM = globalThis.IslandTerrain.TOWNHALL_ROOM; let mySpace = 'island'; let room = null; let roomHidden = [];
  const roomAt = (lx, lz) => globalThis.IslandTerrain.roomWorld(lx, lz);
  function buildRoom() {
    if (room) return room;
    // B 44 민원실 넓히기 (assets 44): the 28 x 18 m marble hall, the 민원·세금·예금 desks 9 m apart each with its clerk, 18 marble
    // seats (sat on like the plaza's benches), the lobby props; each piece has a plain stand-in until its model is in
    const g = new THREE.Group(); g.position.set(ROOM.x, ROOM.y, ROOM.z); scene.add(g);
    const L = ROOM.layout;
    mesh(new THREE.BoxGeometry(90, 0.2, 90), mat(0x2a2f3a), 0, -0.4, 0, g); // the dark around it (no island here)
    const put = (id, lx, y, lz, yaw, stand) => { const root = new THREE.Group(); root.position.set(lx, y, lz); root.rotation.y = yaw; g.add(root); const fallback = new THREE.Group(); root.add(fallback); stand?.(fallback); assets.attach(id, root, fallback); return root; };
    put('townhall3.townhall_interior', 0, 0, 0, Math.PI, (f) => { mesh(new THREE.BoxGeometry(ROOM.w, 0.2, ROOM.d), mat(0xf2efe8), 0, -0.1, 0, f); const wall = mat(0xf2efe8); mesh(new THREE.BoxGeometry(ROOM.w, 3.2, 0.3), wall, 0, 1.6, ROOM.d / 2, f); for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.3, 3.2, ROOM.d), wall, s * ROOM.w / 2, 1.6, 0, f); });
    const SHIRT = { civil: 0x3f7d68, tax: 0x7f1d1d, bank: 0xb45309, rename: 0x4c3a8f };
    const clerks = L.desks.map((d) => {
      put(`townhall3.desk_${d.id === 'rename' ? 'civil' : d.id}`, d.lx, /* (개명 신청: the 민원 desk's model again) */ 0, d.lz, Math.PI, (f) => mesh(new THREE.BoxGeometry(3.4, 1.05, 1.1), mat(0xd9d4c8), 0, 0.525, 0, f));
      const c = makeCharacter({ shirt: SHIRT[d.id], hair: 0x2b2b2b, skin: 0xffdcbc }); c.root.position.set(d.lx, 0, d.keeper); g.add(c.root);
      assets.dress([`character.clerk_${d.id}`, 'character.npc'], c); dressUp(c, { gender: d.id === 'tax' ? 'male' : 'female', outfit: 'npc_outfit_suit' }, { shirt: SHIRT[d.id] });
      const id = d.id === 'civil' ? 'room:desk' : `room:${d.id}`; return Object.assign(c, { home: { x: ROOM.x + d.lx, z: ROOM.z + d.keeper, yaw: 0, id } });
    });
    for (const c of globalThis.IslandTerrain.COUNTERS) put('townhall3.chair_marble', c.lx, 0, c.lz, 0, (f) => mesh(new THREE.BoxGeometry(1.1, 0.54, 1.1), mat(0xd9d4c8), 0, 0.27, 0, f)); // A-7: the customer's chair at each window, toward its clerk
    for (const [, lx, lz, yaw] of L.seats.filter(([id]) => id.startsWith('desk.'))) put('townhall3.chair_marble', lx, 0, lz, yaw + Math.PI, (f) => mesh(new THREE.BoxGeometry(1.1, 0.54, 1.1), mat(0xd9d4c8), 0, 0.27, 0, f)); // (a seat's yaw faces the sitter's way; the chair's front is -z)
    for (const [file, lx, y, lz, yaw] of L.props) put(`townhall3.${file}`, lx, y, lz, yaw, (f) => mesh(new THREE.BoxGeometry(0.5, 0.8, 0.5), mat(0xd9d4c8), 0, 0.4, 0, f));
    for (const { lx } of L.desks) { const light = new THREE.PointLight(0xffe7bc, 22, 16, 1.2); light.position.set(lx, 4, -1); g.add(light); } // a lit hall at any hour
    room = { group: g, clerks }; npcs.push(...clerks);
    return room;
  }
  doors['room:exit'] = { ...roomAt(ROOM.exit.lx, ROOM.exit.lz), name: '나가기' };
  // (A-7: the three windows -- 민원 v1.10.84, 예금 v1.10.85, 세금 v1.10.86 -- open from their customer's chair, not from a spot)
  if (doors.townhall) { doors.townhall.mapName = doors.townhall.name; doors.townhall.name = '관공서 들어가기'; }
  // v1.10.92 잡화점 (IslandStore, assets 41): its room far off the island like the 민원실 -- the keeper behind the counter,
  // the goods where the manifest stands them; SPACE by a good buys it (the price on the prompt), by the door goes out
  const STORE = globalThis.IslandStore; let store = null; let goodsPrices = {};
  function buildStore() {
    if (store) return store;
    const g = new THREE.Group(); g.position.set(STORE.ROOM.x, STORE.ROOM.y, STORE.ROOM.z); g.rotation.y = Math.PI; scene.add(g); // (turned half round: its door toward the camera)
    mesh(new THREE.BoxGeometry(90, 0.2, 90), mat(0x2a2f3a), 0, -0.4, 0, g); // the dark around it
    const shell = new THREE.Group(); g.add(shell); const fallback = new THREE.Group(); shell.add(fallback);
    mesh(new THREE.BoxGeometry(STORE.ROOM.w, 0.2, STORE.ROOM.d), mat(0xeadfc8), 0, -0.1, 0, fallback);
    for (const f of STORE.FIXTURES) mesh(new THREE.BoxGeometry(f.w, 1.0, f.d), mat(0xc9955c), f.x, 0.5, f.z, fallback);
    assets.attach('mall.interior', shell, fallback);
    for (const s of STORE.SHELF) { const at = new THREE.Group(); at.position.set(s.at[0], s.at[1], s.at[2]); at.rotation.y = s.yaw; g.add(at); const v = new THREE.Group(); mesh(new THREE.BoxGeometry(0.14, 0.18, 0.1), mat(0xd8c3a0), 0, 0.09, 0, v); at.add(v); assets.attach(`good.${s.id}`, at, v); }
    // a keeper in every sector (the 잡화 keeper and the 변신 keeper their own models, the rest the shop keepers' look)
    const SHIRTS = { game: 0x6aa9e8, clothes: 0xe87a9e, hair: 0xd98b5f, accessories: 0xc9a14a, surgery: 0x5fa39a, dye: 0x9b7fd6, transform: 0x5b3f8f, store: 0xf3e6c8, stall: 0x6bbf73 };
    const keepers = STORE.SECTORS.map((s, i) => {
      const k = makeCharacter({ shirt: SHIRTS[s.id], hair: [0x3d2b1f, 0x6b4a2b, 0x2b2b2b][i % 3], skin: 0xffdcbc });
      k.root.position.set(s.keeper[0], 0, s.keeper[1]); k.root.rotation.y = s.keeper[2] + Math.PI; g.add(k.root);
      assets.dress([s.id === 'store' ? 'character.storekeeper' : s.id === 'transform' ? 'character.transformer' : 'character.npc'], k); dressUp(k, { gender: i % 2 ? 'female' : 'male' }, { shirt: SHIRTS[s.id] });
      if (s.stall) { const root = new THREE.Group(); root.position.set(s.stall[0], 0, s.stall[1]); root.rotation.y = -Math.PI / 2; g.add(root); const v = new THREE.Group(); root.add(v); mesh(new THREE.BoxGeometry(2.0, 0.9, 0.8), mat(0xb07a4f), 0, 0.45, 0.1, v); assets.attach('facility.trader', root, v); } // (the island's stall model, its front toward the hall)
      const w = STORE.world(s.keeper[0], s.keeper[1]); k.home = { x: w.x, z: w.z, yaw: 0, id: s.place }; return k;
    });
    for (const [lx, lz] of [[-9, -4], [0, -4], [9, -4], [-9, 4], [0, 4], [9, 4]]) { const light = new THREE.PointLight(0xfff1d6, 14, 16, 1.2); light.position.set(lx, 3.6, lz); g.add(light); }
    liftAt(g, STORE.LIFT); // (묶음 2: up to the 가구점)
    store = { group: g, keepers }; npcs.push(...keepers);
    return store;
  }
  doors['store:exit'] = { ...STORE.world(STORE.ROOM.exit.lx, STORE.ROOM.exit.lz), name: '나가기' };
  // 묶음 2 가구점 (IslandFurniture, assets 57): the 2nd floor, its own room far off like the 1st (turned half round the
  // same way) -- four zones on their rugs, a plinth for each of the day's pieces with its price, what hangs on the back
  // wall, the wide place for a wall tank, the always-on-sale ones by the counter; the lift on each floor between them
  const FURN = globalThis.IslandFurniture; let furniture = null; let furnitureState = null;
  function liftAt(g, L) { const root = new THREE.Group(); root.position.set(L.lx, 0, L.lz); root.rotation.y = L.yaw; g.add(root); const v = new THREE.Group(); mesh(new THREE.BoxGeometry(2.1, 3.2, 1.9), mat(0xb8b2a6), 0, 1.6, -0.95, v); root.add(v); assets.attach('mall.elevator', root, v); }
  const PETS = globalThis.IslandPetShop; let petshop = null; let petshopState = null;
  doors['lift:1'] = { ...STORE.world(...STORE.LIFT.stand), name: '승강기 · 2층 가구점 · 3층 펫샵' };
  doors['lift:2'] = { ...FURN.world(...FURN.LIFT.stand), name: '승강기 · 1층 · 3층 펫샵' };
  doors['lift:3'] = { ...PETS.world(...PETS.LIFT.stand), name: '승강기 · 1층 · 2층 가구점' };
  // 묶음 2-2 펫샵 (IslandPetShop, assets 60): the 3rd floor, its fenced yard and what stands, the eight pets of the day
  // walking the rounds IslandPetShop works out (the server's too) -- one taken is gone from the yard
  function buildPetshop() {
    if (petshop) return petshop;
    const g = new THREE.Group(); g.position.set(PETS.ROOM.x, PETS.ROOM.y, PETS.ROOM.z); g.rotation.y = Math.PI; scene.add(g);
    mesh(new THREE.BoxGeometry(90, 0.2, 90), mat(0x2a2f3a), 0, -0.4, 0, g); // the dark around it
    const put = (id, lx, y, lz, yaw, stand) => { const root = new THREE.Group(); root.position.set(lx, y, lz); root.rotation.y = yaw; g.add(root); const fallback = new THREE.Group(); root.add(fallback); stand?.(fallback); assets.attach(id, root, fallback); return root; };
    put('petshop.floor3', 0, 0, 0, 0, (f) => { mesh(new THREE.BoxGeometry(PETS.ROOM.w, 0.2, PETS.ROOM.d), mat(0xe8f1ea), 0, -0.1, 0, f); mesh(new THREE.BoxGeometry(PETS.ROOM.w, 4, 0.3), mat(0xcfe8dc), 0, 2, PETS.ROOM.d / 2, f); });
    put('petshop.playpen', PETS.PEN.lx, 0, PETS.PEN.lz, 0, (f) => mesh(new THREE.BoxGeometry(PETS.PEN.w, 0.03, PETS.PEN.d), mat(0x9fcf8a), 0, 0.015, 0, f));
    for (const p of PETS.PROPS) { const root = put(p.id, p.x, p.id === 'petshop.sign' ? 3.1 : 0, p.z, p.yaw, p.w ? (f) => mesh(new THREE.BoxGeometry(p.w, 1, p.d), mat(0xd9c3a0), 0, 0.5, 0, f) : null); if (p.id === 'petshop.sign') sign('펫샵', root, 0.4); }
    const k = makeCharacter({ shirt: 0x5fa39a, hair: 0x6b4a2b, skin: 0xffdcbc }); const [kx, kz, ky] = PETS.COUNTER_KEEPER; k.root.position.set(kx, 0, kz); k.root.rotation.y = ky; g.add(k.root);
    assets.dress(['character.npc'], k); dressUp(k, { gender: 'male' }, { shirt: 0x5fa39a });
    liftAt(g, PETS.LIFT);
    for (const [lx, lz] of [[-9, -4], [0, -4], [9, -4], [-9, 4], [0, 4], [9, 4]]) { const light = new THREE.PointLight(0xfff1d6, 14, 16, 1.2); light.position.set(lx, 3.6, lz); g.add(light); }
    petshop = { group: g, pets: new Map(), keeper: k };
    if (petshopState) setPetshop(petshopState);
    return petshop;
  }
  function setPetshop(state) {
    petshopState = state || null; if (!petshop) return;
    const want = new Map((state?.pets || []).filter((p) => !p.sold).map((p) => [p.slot, p]));
    for (const [slot, h] of petshop.pets) { const w = want.get(slot); if (!w || w.kind !== h.kind || w.coat !== h.coat || state.day !== h.day) { h.c.dispose(); petshop.pets.delete(slot); } }
    for (const [slot, p] of want) if (!petshop.pets.has(slot)) { const c = petHolder(p.kind, p.coat); petshop.pets.set(slot, { c, kind: p.kind, coat: p.coat, day: state.day }); }
  }
  function stepPetshop() { // each where its round has it now (the server's clock), walking or standing
    if (!petshop || mySpace !== 'petshop' || !petshopState) return; const ms = Date.now() + serverOffset;
    for (const [slot, h] of petshop.pets) { const q = PETS.petAt(petshopState.day, slot, ms); h.c.root.position.set(q.x, PETS.ROOM.y, q.z); h.c.root.rotation.y = q.yaw; h.c.play(q.moving ? 'Walk' : 'Idle'); }
  }
  function buildFurniture() {
    if (furniture) return furniture;
    const g = new THREE.Group(); g.position.set(FURN.ROOM.x, FURN.ROOM.y, FURN.ROOM.z); g.rotation.y = Math.PI; scene.add(g);
    mesh(new THREE.BoxGeometry(90, 0.2, 90), mat(0x2a2f3a), 0, -0.4, 0, g); // the dark around it
    const put = (id, lx, y, lz, yaw, stand) => { const root = new THREE.Group(); root.position.set(lx, y, lz); root.rotation.y = yaw; g.add(root); const fallback = new THREE.Group(); root.add(fallback); stand?.(fallback); assets.attach(id, root, fallback); return root; };
    put('mall.floor2', 0, 0, 0, 0, (f) => { mesh(new THREE.BoxGeometry(FURN.ROOM.w, 0.2, FURN.ROOM.d), mat(0xd9c3a0), 0, -0.1, 0, f); mesh(new THREE.BoxGeometry(FURN.ROOM.w, 4, 0.3), mat(0xf2ede4), 0, 2, FURN.ROOM.d / 2, f); });
    for (const [zone, [x, z]] of Object.entries(FURN.ZONES)) put(`shop.rug_zone__${zone}`, x, 0, z + 0.35, 0, (f) => mesh(new THREE.BoxGeometry(4, 0.02, 4), mat(0xe6d6b8), 0, 0.01, 0, f));
    const plinths = {};
    for (const s of [...FURN.SLOTS, ...FURN.BASE_SLOTS]) {
      if (s.plinth === false) { plinths[s.id] = { root: put('shop.price_stand', s.lx, 1.0, s.lz - 0.9, 0), top: 0 }; continue; }
      const small = Boolean(s.good); put(small ? 'shop.plinth_s' : 'shop.plinth_l', s.lx, 0, s.lz, 0, (f) => mesh(new THREE.BoxGeometry(small ? 1.2 : 2.4, 0.14, small ? 1.2 : 2.4), mat(0xcfc4b0), 0, 0.07, 0, f));
      plinths[s.id] = { root: put('shop.price_stand', s.lx, 0.14, s.lz - (small ? 0.5 : 1.1), 0), top: 0.14 };
    }
    put('shop.checkout', FURN.CHECKOUT.lx, 0, FURN.CHECKOUT.lz, FURN.CHECKOUT.yaw, (f) => mesh(new THREE.BoxGeometry(1.9, 1.0, 0.7), mat(0xb07a4f), 0, 0.5, 0, f));
    const k = makeCharacter({ shirt: 0x8a6a48, hair: 0x3d2b1f, skin: 0xffdcbc }); const [kx, kz, ky] = FURN.CHECKOUT.keeper; k.root.position.set(kx, 0, kz); k.root.rotation.y = ky; g.add(k.root);
    assets.dress(['character.npc'], k); dressUp(k, { gender: 'female' }, { shirt: 0x8a6a48 });
    liftAt(g, FURN.LIFT);
    const board = put('mall.floor2_sign', 0, 3.1, FURN.ROOM.d / 2 - 0.2, 0); sign('가구점', board, 0.4);
    for (const [lx, lz] of [[-9, -4], [0, -4], [9, -4], [-9, 4], [0, 4], [9, 4]]) { const light = new THREE.PointLight(0xfff1d6, 14, 16, 1.2); light.position.set(lx, 3.6, lz); g.add(light); }
    furniture = { group: g, plinths, shown: {}, put, keeper: k };
    if (furnitureState) setFurniture(furnitureState);
    return furniture;
  }
  // the day's display from the server (app.js): each place its piece -- or, sold, the 「다시 들어와요」 box -- and its price
  function setFurniture(state) {
    furnitureState = state ? { ...state, items: Object.fromEntries([...(state.display || []), ...(state.base || [])].map((d) => [d.slot, d])) } : null;
    if (!furniture || !furnitureState) return;
    for (const s of [...FURN.SLOTS, ...FURN.BASE_SLOTS]) {
      const d = furnitureState.items[s.id]; const key = d ? `${d.id}:${d.sold ? 'sold' : 'on'}` : ''; const was = furniture.shown[s.id];
      if (was?.key === key) continue;
      if (was) { was.root.removeFromParent(); was.tag?.removeFromParent(); }
      if (!d) { delete furniture.shown[s.id]; continue; }
      const P = furniture.plinths[s.id]; const good = FURN.good(d.id);
      const root = d.sold ? furniture.put('shop.sold_sign', s.lx, P.top, s.lz, 0, (f) => mesh(new THREE.BoxGeometry(0.6, 0.5, 0.3), mat(0xcfb58a), 0, 0.25, 0, f))
        : furniture.put(good.model, s.lx, P.top, s.lz, s.yaw, (f) => mesh(new THREE.BoxGeometry(1, 0.8, 0.6), mat(0xc9a77c), 0, 0.4, 0, f));
      const tag = sign(d.sold ? '팔렸어요' : `${Number(d.price).toLocaleString('ko-KR')}P`, P.root, 0.55); tag.scale.multiplyScalar(0.4);
      furniture.shown[s.id] = { key, root, tag };
    }
  }
  // 묶음 4 내 집 (IslandHome, assets 58): on 툇마루섬 each lot's house (its roof, the owner's name over the door) or the
  // empty lot's sign; inside, one room far off (put where the house's own is) -- its floor and wallpaper, the pieces where
  // the owner put them, the tanks' fish swimming and bubbling (the insect case's insect still), a frame's photo card, the
  // owner's pets that stay home roaming, the seats sat on; the 꾸미기 창 shows a piece where it would go (green or red)
  const HOME = globalThis.IslandHome; const homesShown = new Map(); let homeRoomV = null; let homeHere = null; let homeGhostV = null;
  const homeRoom = { ROOM: HOME.ROOM, clamp: (x, z) => (homeHere?.lot ? HOME.clamp(homeHere.lot, x, z, homeHere.home.pieces, homeHere.home.stage) : { x, z }) };
  const homesGroup = new THREE.Group(); scene.add(homesGroup);
  function setHomes(lots) { // the server's lots (app.js: /api/home, again on SSE 'homes')
    for (const l of lots || []) {
      const lot = HOME.lotById(l.id); if (!lot) continue;
      const key = `${l.owner}:${l.roof}:${l.mine}:${l.visit}:${l.stage}:${l.building}`; const was = homesShown.get(l.id); if (was?.key === key) continue;
      if (was) { was.root.removeFromParent(); occlusion.remove(was.root); const k = buildingRoots.indexOf(was.root); if (k >= 0) buildingRoots.splice(k, 1); }
      const root = new THREE.Group(); root.position.set(lot.x, heightAt(lot.x, lot.z), lot.z); root.rotation.y = lot.yaw; homesGroup.add(root); // (the model's front, -Z, toward the walk)
      const f = new THREE.Group(); root.add(f); const d = HOME.doorOf(lot, l.owner !== null ? HOME.stageOf(l.stage).n : 2); const who = l.owner || '이웃';
      if (l.owner !== null) {
        const st = HOME.stageOf(l.stage); const w = { 1: [4.4, 2.6, 3.8], 2: [6, 3.2, 5], 3: [9.4, 3.6, 6.6] }[st.n]; // (묶음 4-2: the 오두막 first, then the 작은 집, the 큰 집)
        mesh(new THREE.BoxGeometry(w[0], w[1], w[2]), mat(0xe9dcc4), 0, w[1] / 2, 0, f); assets.attach(`home.${st.house}__${HOME.ROOFS.includes(l.roof) ? l.roof : 'red'}`, root, f);
        if (l.building) { const b = new THREE.Group(); b.position.set(-2.2, 0, -3.2); root.add(b); const bf = new THREE.Group(); b.add(bf); mesh(new THREE.BoxGeometry(2.4, 1.2, 0.1), mat(0xf2c94c), 0, 0.9, 0, bf); assets.attach('home.build_sign', b, bf); sign('공사 중 · 내일 완성', b, 2.1).scale.multiplyScalar(0.5); } // (that day only: 「집 넓히기」)
        // (문제 기록 2회차 5: the plate stood 2.6 m out whatever the house -- inside the 큰 집's front wall, the name cut; now
        // 0.6 m before each stage's front, and a long name shortened with …)
        const plate = new THREE.Group(); plate.position.set(1.1, 0, -(w[2] / 2 + 0.6)); root.add(plate); assets.attach('home.nameplate', plate, new THREE.Group());
        const name = [...who].length > 8 ? `${[...who].slice(0, 7).join('')}…` : who;
        sign(l.mine ? '내 집' : `${name}의 집`, plate, 2.4).scale.multiplyScalar(0.55); plate.userData.plate = l.mine ? '내 집' : `${name}의 집`;
        doors[`home:${l.id}`] = { x: d.x, z: d.z, mine: l.mine, mapName: '내 집', name: l.mine ? '내 집 들어가기' : l.visit === 'none' ? `${who}의 집 · 손님을 받지 않아요` : `${who}의 집 구경하기`, plain: !l.mine && l.visit === 'none' };
      } else {
        assets.attach('home.lot_sign', root, f); sign('빈 집터', root, 2.0).scale.multiplyScalar(0.5);
        doors[`home:${l.id}`] = { x: d.x, z: d.z, name: '빈 집터 · 관공서 민원 창구에서 신청해요', plain: true };
      }
      homesShown.set(l.id, { key, root, owned: l.owner !== null, stage: l.owner !== null ? HOME.stageOf(l.stage).n : null }); if (l.owner !== null) buildingRoots.push(root); // (faded when it stands between the camera and me, like the other buildings)
    }
  }
  function buildHomeRoom() {
    if (homeRoomV) return homeRoomV;
    const g = new THREE.Group(); g.rotation.y = Math.PI; scene.add(g); // (turned half round like the 백화점's floors: the doorway toward the camera)
    mesh(new THREE.BoxGeometry(90, 0.2, 90), mat(0x2a2f3a), 0, -0.4, 0, g); // the dark around it
    // (the room itself, its floor and wallpaper: layers set by the house's stage -- setHome)
    for (const lx of [-2, 2]) { const light = new THREE.PointLight(0xfff1d6, 10, 12, 1.2); light.position.set(lx, 2.8, 0); g.add(light); }
    homeRoomV = { group: g, layers: {}, pieces: new Map(), pets: [] };
    return homeRoomV;
  }
  const homeLayer = (kind, id, scale = 1, stand = null) => { const R = homeRoomV; const key = `${id}:${scale}`; if (R.layers[kind]?.key === key) return; R.layers[kind]?.root.removeFromParent(); const root = new THREE.Group(); root.scale.set(scale, 1, scale); if (kind === 'room') root.position.y = 0.02; /* (문제 기록 2회차 14: the room's floor 2 cm under the 4 cm boards -- they hid its skirting and stood out as a raised slab) */ R.group.add(root); const f = new THREE.Group(); root.add(f); stand?.(f); assets.attach(id, root, f); R.layers[kind] = { key, root }; };
  const roomStand = (st) => (f) => { const wall = mat(0xf2ede4); mesh(new THREE.BoxGeometry(st.w, 0.2, st.d), mat(0xd9c3a0), 0, -0.1, 0, f); mesh(new THREE.BoxGeometry(st.w, 3, 0.2), wall, 0, 1.5, st.d / 2, f); for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.2, 3, st.d), wall, s * st.w / 2, 1.5, 0, f); for (const b of st.fixed) mesh(new THREE.BoxGeometry(b.x1 - b.x0, 2.3, b.z1 - b.z0), wall, (b.x0 + b.x1) / 2, 1.15, (b.z0 + b.z1) / 2, f); };
  const pieceKey = (p) => `${homeHere.home.stage || 2}:${p.id}:${p.x}:${p.z}:${p.rot}:${p.photo || ''}:${(homeHere.home.tanks[p.uid] || []).map((f) => f.fid).join(',')}`;
  const BACK = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // (a piece's back, +Z as made, after rot quarters -- IslandHome)
  function hungAt(p) { // a hung piece drawn flat against its wall (it is placed on the 0.25 m steps, within 0.2 of it)
    const s = HOME.SIZE[HOME.shapeOf(p.id)]; if (!HOME.HUNG.has(HOME.shapeOf(p.id)) || !s) return { x: p.x, z: p.z };
    const [bx, bz] = BACK[p.rot]; const { hx, hz } = HOME.stageOf(homeHere?.home.stage);
    return bz === 1 ? { x: p.x, z: hz - s[1] / 2 } : bx === 1 ? { x: hx - s[1] / 2, z: p.z } : bx === -1 ? { x: -hx + s[1] / 2, z: p.z } : { x: p.x, z: p.z };
  }
  const swimTo = (T, bottom) => { if (T.cylinder) { const r = Math.sqrt(Math.random()) * (T.max[0] - T.min[0]) * 0.45; const a = Math.random() * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * r, bottom ? T.min[1] : T.min[1] + Math.random() * (T.max[1] - T.min[1]), Math.sin(a) * r); } return new THREE.Vector3(T.min[0] + Math.random() * (T.max[0] - T.min[0]), bottom ? T.min[1] : T.min[1] + Math.random() * (T.max[1] - T.min[1]), T.min[2] + Math.random() * (T.max[2] - T.min[2])); };
  function drawPiece(p, ghost = false) {
    const shape = HOME.shapeOf(p.id); const good = globalThis.IslandFurniture?.good(p.id); const s = HOME.SIZE[shape] || [1, 1, 1]; const T = HOME.TANKS[shape];
    const root = new THREE.Group(); const at = hungAt(p); root.position.set(at.x, 0.04, at.z); root.rotation.y = (p.rot * Math.PI) / 2; homeRoomV.group.add(root);
    const f = new THREE.Group(); root.add(f); mesh(new THREE.BoxGeometry(s[0], s[2], s[1]), mat(0xc9a77c), 0, s[2] / 2, 0, f);
    if (good) assets.attach(good.model, root, f);
    const v = { root, key: ghost ? '' : pieceKey(p), swim: [], bubbles: [] };
    if (shape === 'picture_frame' && p.photo) { // a photo card in the frame: the place and 「기념사진」 (the shot itself stays on the PC)
      const c = document.createElement('canvas'); c.width = 256; c.height = 200; const x = c.getContext('2d'); const sky = x.createLinearGradient(0, 0, 0, 200); sky.addColorStop(0, '#9fd3f0'); sky.addColorStop(1, '#f6e7c8'); x.fillStyle = sky; x.fillRect(0, 0, 256, 200);
      x.fillStyle = '#3d2b1f'; x.font = '700 30px Pretendard, "Malgun Gothic", sans-serif'; x.textAlign = 'center'; x.fillText(homeHere.photos[p.photo] || '', 128, 110); x.font = '500 20px Pretendard, "Malgun Gothic", sans-serif'; x.fillText('기념사진', 128, 150);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; textures.push(tex);
      const card = new THREE.Mesh(new THREE.PlaneGeometry(s[0] * 0.78, s[2] * 0.72), new THREE.MeshBasicMaterial({ map: tex })); card.rotation.y = Math.PI; card.position.set(0, s[2] / 2 + 1.1, -s[1] / 2 - 0.005); root.add(card); // (the frame hangs at the height made; its face is -Z)
    }
    for (const fish of ghost || !T ? [] : homeHere.home.tanks[p.uid] || []) {
      const fr = new THREE.Group(); root.add(fr); const fb = new THREE.Group(); fr.add(fb); mesh(new THREE.BoxGeometry(0.16, 0.06, 0.05), mat(0x9fb8c8), 0, 0, 0, fb);
      if (T.insects) { assets.attach(`together.${fish.itemId}`, fr, fb); fr.position.set(0, T.min[1], 0); continue; } // (the insect sits)
      assets.attach(`fish.${fish.itemId.slice(5)}`, fr, fb); fr.scale.setScalar(T.fishScale || 1);
      const bottom = HOME.BOTTOM.has(fish.itemId); fr.position.copy(swimTo(T, bottom)); v.swim.push({ root: fr, T, bottom, to: swimTo(T, bottom), speed: 0.12 + Math.random() * 0.12, phase: Math.random() * 6 });
    }
    if (T && !T.insects && !ghost) for (let k = 0; k < 4; k += 1) { const b = mesh(new THREE.SphereGeometry(0.025, 6, 4), mat(0xeaf6ff, { transparent: true, opacity: 0.6 }), T.min[0] * 0.6, T.min[1] + Math.random() * (T.max[1] - T.min[1]), 0, root); b.castShadow = false; v.bubbles.push(b); }
    return v;
  }
  function setHome(inside) { // the house I am in (app.js: /api/home/inside), null when out -- the room laid out again as it is now
    homeGhost(null);
    for (let i = SEATS.length - 1; i >= 0; i -= 1) if (String(SEATS[i].id).startsWith('home:')) SEATS.splice(i, 1);
    delete doors['home:exit'];
    homeHere = inside?.home ? { lot: HOME.lotById(inside.home.lot), home: inside.home, mine: Boolean(inside.mine), photos: inside.photos || {} } : null;
    if (!homeHere?.lot) { homeHere = null; if (homeRoomV) { for (const h of homeRoomV.pets) h.c.dispose(); homeRoomV.pets = []; } return; }
    const R = buildHomeRoom(); const { lot, home } = homeHere; const r = HOME.roomOf(lot); R.group.position.set(r.x, HOME.ROOM.y - 0.04, r.z); // (the floor's layer, 4 cm, under my feet)
    const st = HOME.stageOf(home.stage); const en = HOME.entryOf(home.stage); const e = HOME.world(lot, en[0], en[1] - 0.6); doors['home:exit'] = { x: e.x, z: e.z, name: '나가기' };
    // (the floor and wallpaper made for each room's size -- assets 58 _s1 9 x 9, as named 12 x 12, _s3 16 x 13)
    const [fk, fv] = String(home.floor).split('__'); homeLayer('room', `home.${st.room}`, 1, roomStand(st)); homeLayer('floor', `home.floor_${fk}${st.tile}__${fv}`); homeLayer('wall', `home.wallpaper${st.tile}__${home.wall}`);
    const want = new Map(home.pieces.map((p) => [p.uid, p]));
    for (const [uid, v] of R.pieces) { const p = want.get(uid); if (!p || v.key !== pieceKey(p) || R.lot !== lot.id) { v.root.removeFromParent(); R.pieces.delete(uid); } }
    R.lot = lot.id;
    for (const p of home.pieces) if (!R.pieces.has(p.uid)) R.pieces.set(p.uid, drawPiece(p));
    SEATS.push(...HOME.allSeatsOf(lot, home).map((s) => ({ ...s, name: '앉기' }))); // (the 큰 집's window seat too)
    if (inside.pets) { // (the pets: only when the server sends them -- a placing keeps those roaming)
      for (const h of R.pets) h.c.dispose(); R.pets = [];
      for (const p of inside.pets.slice(0, 12)) { const c = petHolder(p.kind, p.coat); const q = homeSpot(); c.root.position.set(q.x, HOME.ROOM.y, q.z); R.pets.push({ c, to: null, wait: Math.random() * 3 }); }
    }
  }
  const homeSpot = () => { const { hx, hz } = HOME.stageOf(homeHere.home.stage); const w = HOME.world(homeHere.lot, (Math.random() - 0.5) * (hx - 0.5) * 2, (Math.random() - 0.5) * (hz - 0.5) * 2); return HOME.clamp(homeHere.lot, w.x, w.z, homeHere.home.pieces, homeHere.home.stage); };
  // 문제 기록 2회차 11 (사용자 「꾸미기가 너무 어려워. 캐릭터로 직접 밀고 당기기, 돌리기」, assets 64): in my house, held
  // SPACE (the phone: the 상호작용 button held) before a piece grabs it -- forward pushes it, back pulls it, a 0.5 m step at a
  // time (the same checks as placing it: the room, the walls, the other pieces), R (the phone: 돌리기) turns it a quarter;
  // SPACE again lets go. The hands 0.32 m before me on its near side; the server keeps each step (app.js /api/home/place).
  const GRAB_HOLD_MS = 450; const GRAB_STEP = 0.5; const GRAB_SPEED = 0.9; const HAND = 0.32;
  let grab = null; let grabDownAt = 0; let onHomeMove = null; let onGrab = null; // (grabDownAt: when the button went down before a piece -- a time, not a timer: slow frames held timers back)
  const pieceOf = (uid) => homeHere?.home.pieces.find((p) => p.uid === uid) || null;
  function grabCandidate() {
    if (mySpace !== 'home' || !homeHere?.mine || !homeRoomV || grab) return null;
    const p = me.root.position; const yaw = me.root.rotation.y; const ahead = HOME.local(homeHere.lot, p.x + Math.sin(yaw) * 0.7, p.z + Math.cos(yaw) * 0.7);
    let best = null; let bd = 0.6;
    for (const piece of homeHere.home.pieces) {
      if (HOME.HUNG.has(HOME.shapeOf(piece.id))) continue; const b = HOME.boxOf(piece); if (!b) continue;
      const d = Math.hypot(Math.max(b.x0 - ahead.lx, 0, ahead.lx - b.x1), Math.max(b.z0 - ahead.lz, 0, ahead.lz - b.z1)); if (d < bd) { bd = d; best = piece; }
    }
    return best;
  }
  function standAtGrab() { // me on the held piece's near side, facing it
    const piece = pieceOf(grab.uid); const b = HOME.boxOf(piece); const cx = (b.x0 + b.x1) / 2; const cz = (b.z0 + b.z1) / 2; const half = grab.axis[0] ? (b.x1 - b.x0) / 2 : (b.z1 - b.z0) / 2;
    const w = HOME.world(homeHere.lot, cx - grab.axis[0] * (half + HAND), cz - grab.axis[1] * (half + HAND)); const yaw = Math.atan2(-grab.axis[0], -grab.axis[1]); // (local axes run against the world's: HOME.local)
    me.root.position.set(w.x, HOME.ROOM.y, w.z); me.root.rotation.y = yaw; me.targetYaw = yaw; grab.base = { x: w.x, z: w.z }; grab.acc = 0;
  }
  function startGrab(piece = grabCandidate()) {
    if (!piece) return false;
    const yaw = me.root.rotation.y; const a = HOME.local(homeHere.lot, me.root.position.x + Math.sin(yaw), me.root.position.z + Math.cos(yaw)); const o = HOME.local(homeHere.lot, me.root.position.x, me.root.position.z);
    const dx = a.lx - o.lx; const dz = a.lz - o.lz; const axis = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
    grab = { uid: piece.uid, axis, base: null, acc: 0, blocked: null }; standAtGrab(); me.anim?.loop('furnGrab'); onGrab?.(true); return true;
  }
  function endGrab() { if (!grab) return; grab = null; if (me.anim?.held?.startsWith('furn')) me.anim.release(); onGrab?.(false); }
  function moveHeld(next) { // the piece to its new place on my screen at once (the server told by the app)
    const why = HOME.placeError(next, homeHere.home.pieces.filter((p) => p.uid !== next.uid), homeHere.home.stage); if (why) return why;
    const home = { ...homeHere.home, pieces: homeHere.home.pieces.map((p) => (p.uid === next.uid ? next : p)) };
    setHome({ home, mine: true, photos: homeHere.photos }); onHomeMove?.(next); return null;
  }
  function stepGrab(dt, wx, wz) { // wx, wz: the way the keys or the stick point (world), 0 when none
    const piece = pieceOf(grab.uid); if (!piece || mySpace !== 'home') { endGrab(); return; }
    const yaw = me.root.rotation.y; const fx = Math.sin(yaw); const fz = Math.cos(yaw); const f = wx * fx + wz * fz;
    if (Math.abs(f) < 0.35) { me.anim?.loop('furnGrab'); grab.acc = 0; me.root.position.set(grab.base.x, HOME.ROOM.y, grab.base.z); return; }
    const dir = Math.sign(f); me.anim?.loop(dir > 0 ? 'furnPush' : 'furnPull', 1);
    grab.acc = Math.max(-GRAB_STEP, Math.min(GRAB_STEP, grab.acc + dir * GRAB_SPEED * dt));
    if (Math.abs(grab.acc) >= GRAB_STEP - 1e-6) {
      const next = { ...piece, x: piece.x + grab.axis[0] * GRAB_STEP * dir, z: piece.z + grab.axis[1] * GRAB_STEP * dir };
      const why = moveHeld(next); if (why) { grab.blocked = why; grab.acc = 0; me.anim?.loop('furnGrab'); } else { grab.blocked = null; standAtGrab(); }
    } else me.root.position.set(grab.base.x + fx * grab.acc, HOME.ROOM.y, grab.base.z + fz * grab.acc);
  }
  function turnGrab() {
    const piece = grab && pieceOf(grab.uid); if (!piece) return null;
    const why = moveHeld({ ...piece, rot: (piece.rot + 1) % 4 }); if (why) { grab.blocked = why; return why; }
    me.anim?.play('furnTurn'); standAtGrab(); return null;
  }
  // the phone's 상호작용 button: held before a piece it grabs, a tap does what a tap did (and lets go of a held one)
  function actDown() { if (grab) { endGrab(); return; } if (grabCandidate()) { grabDownAt = performance.now(); return; } if (!isBlocked() && near) interact(near); }
  function actUp() { if (!grabDownAt) return; const held = performance.now() - grabDownAt >= GRAB_HOLD_MS; grabDownAt = 0; if (held) startGrab(); else if (!isBlocked() && near) interact(near); }
  function stepGrabHold() { if (grabDownAt && performance.now() - grabDownAt >= GRAB_HOLD_MS) { grabDownAt = 0; startGrab(); } } // (held on: grabbed without waiting for the release)
  function stepHome(dt) {
    if (mySpace !== 'home' || !homeRoomV || !homeHere) return;
    for (const v of homeRoomV.pieces.values()) {
      for (const f of v.swim) {
        const p = f.root.position; const d = p.distanceTo(f.to); if (d < 0.04) { f.to = swimTo(f.T, f.bottom); continue; }
        // (the head forward: a fish's front is -Z like every model -- 문제 기록 3회차 12 「뒤로만 움직여」; the tail's wag)
        p.lerp(f.to, Math.min(1, (f.speed * dt) / d)); f.root.rotation.y = Math.atan2(f.to.x - p.x, f.to.z - p.z) + Math.PI + Math.sin(clock * 9 + f.phase) * 0.18;
      }
      for (const b of v.bubbles) { const T = HOME.TANKS[HOME.shapeOf(homeHere.home.pieces.find((x) => v.root === homeRoomV.pieces.get(x.uid)?.root)?.id)]; if (!T) continue; b.position.y += dt * 0.25; if (b.position.y > T.max[1]) b.position.y = T.min[1]; }
    }
    for (const h of homeRoomV.pets) { // slowly about the floor, now and then a rest
      if (h.wait > 0) { h.wait -= dt; continue; }
      if (!h.to) { h.to = homeSpot(); h.c.play('Walk'); }
      const p = h.c.root.position; const dx = h.to.x - p.x; const dz = h.to.z - p.z; const d = Math.hypot(dx, dz);
      if (d < 0.1) { h.to = null; h.wait = 2 + Math.random() * 5; h.c.play(Math.random() < 0.4 ? 'Sit' : 'Idle'); continue; }
      const q = homeRoom.clamp(p.x + (dx / d) * Math.min(d, 0.7 * dt), p.z + (dz / d) * Math.min(d, 0.7 * dt));
      if (Math.hypot(q.x - p.x, q.z - p.z) < 1e-4) { h.to = null; continue; } // (a piece in the way: elsewhere)
      p.x = q.x; p.z = q.z; h.c.root.rotation.y = Math.atan2(dx, dz);
    }
  }
  function homeGhost(p) { // -> why not (Korean) or null; the placed piece hides while its ghost shows
    if (homeGhostV) { homeGhostV.root.removeFromParent(); homeGhostV.mark.removeFromParent(); if (homeGhostV.hid) homeGhostV.hid.visible = true; homeGhostV = null; }
    if (!p || !homeRoomV || !homeHere) return null;
    const why = HOME.placeError(p, homeHere.home.pieces.filter((x) => x.uid !== p.uid), homeHere.home.stage); const b = HOME.boxOf(p); if (!b) return why;
    const hid = homeRoomV.pieces.get(p.uid)?.root || null; if (hid) hid.visible = false;
    const v = drawPiece(p, true); const mark = mesh(new THREE.BoxGeometry(b.x1 - b.x0, 0.03, b.z1 - b.z0), mat(why ? 0xe05050 : 0x4fbf6f, { transparent: true, opacity: 0.55 }), (b.x0 + b.x1) / 2, 0.06, (b.z0 + b.z1) / 2, homeRoomV.group); mark.castShadow = false;
    homeGhostV = { root: v.root, mark, hid }; return why;
  }
  // each sector's spot carries its old facility id (the shop's window and the server's place check stay the same)
  for (const s of STORE.SECTORS) doors[s.place] = { ...STORE.world(s.interact[0], s.interact[1]), name: s.name };
  if (doors.store) { doors.store.mapName = '백화점'; doors.store.name = '백화점 들어가기'; }
  function setGoodsPrices(prices) { goodsPrices = { ...(prices || {}) }; }
  function setSpace(space, x, z) { // the server moved me (in or out): there at once, the camera with me
    mySpace = ['townhall', 'store', 'furniture', 'petshop', 'home'].includes(space) ? space : 'island';
    if (mySpace === 'home') buildHomeRoom(); else if (homeHere) setHome(null); // (묶음 4: out of a house, its pets go)
    indoors = mySpace !== 'island'; lightKey = null; // (bugs 9: the weather stays outside)
    if (mySpace === 'townhall') buildRoom();
    if (mySpace === 'store') buildStore();
    if (mySpace === 'furniture') buildFurniture();
    if (mySpace === 'petshop') buildPetshop();
    if (petshop) for (const h of petshop.pets.values()) h.c.root.visible = mySpace === 'petshop'; // (the yard's pets stand in the world: only on the 3rd floor)
    // the island is not drawn while I am inside (IDEAS: no terrain, trees or sea in the room) -- only what is drawn now
    // is put away, and comes back as it was; the lights stay (they light the room too), people show by their space
    if (mySpace !== 'island' && !roomHidden.length) { const people = new Set([me.root, ...[...others.values()].map((o) => o.c.root)]); const here = mySpace === 'store' ? store.group : mySpace === 'furniture' ? furniture.group : mySpace === 'petshop' ? petshop.group : mySpace === 'home' ? homeRoomV.group : room.group; roomHidden = scene.children.filter((o) => o.visible && !o.isLight && o !== here && !people.has(o)); for (const o of roomHidden) o.visible = false; }
    if (mySpace !== 'island' && roomHidden.length) { for (const r of [room, store, furniture, petshop, homeRoomV]) if (r) r.group.visible = r.group === ({ store, furniture, petshop, townhall: room, home: homeRoomV })[mySpace]?.group; } // (from floor to floor: the one I am on)
    if (mySpace === 'island') { for (const o of roomHidden) o.visible = true; roomHidden = []; if (room) room.group.visible = true; if (store) store.group.visible = true; if (furniture) furniture.group.visible = true; if (petshop) petshop.group.visible = true; if (homeRoomV) homeRoomV.group.visible = true; }
    keys.clear(); me.root.position.set(x, mySpace === 'townhall' ? ROOM.y : mySpace === 'store' ? STORE.ROOM.y : mySpace === 'furniture' ? FURN.ROOM.y : mySpace === 'petshop' ? PETS.ROOM.y : mySpace === 'home' ? HOME.ROOM.y : heightAt(x, z), z); me.targetYaw = mySpace !== 'island' ? Math.PI : me.root.rotation.y;
    if (mySpace !== 'island') me.root.rotation.y = Math.PI;
    placeCamera(true); return true;
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
  let lastResidentEvents = [];
  function setEvents(list) {
    lastResidentEvents = list || [];
    const seen = new Set(); let carried = null;
    for (const ev of list || []) {
      if (!ev?.id || !Number.isFinite(ev.x) || !Number.isFinite(ev.z)) continue;
      if (ev.kind === 'carrying') { if (!returning.has(ev.id)) carried = ev; continue; }
      const key = `ev:${ev.kind}:${ev.id}`; seen.add(key);
      const resident = ['photo','lost_owner'].includes(ev.kind) && Number.isInteger(ev.resident) && ev.resident>=0 && ev.resident<IslandNpcs.COUNT ? ev.resident : null;
      const borrowed = resident == null ? null : wanderers.find(w=>w.n===resident)?.c;
      // Never create a replacement while the initial ten characters load, or interrupt an actual handover.
      if (resident != null && (!borrowed || (borrowed.residentKey && borrowed.residentKey!==key && eventObjs.get(borrowed.residentKey)?.leaving))) continue;
      if (!eventObjs.has(key)) {
        const root = new THREE.Group(); root.position.set(ev.x, heightAt(ev.x, ev.z), ev.z); root.rotation.y = (ev.x * 7 + ev.z * 3) % TAU; scene.add(root);
        let npc = null;
        if (ev.kind === 'quest_npc') { // v1.10.37 연계 퀘스트: the islander with a story, standing at their place, facing the plaza
          const QUEST_LOOKS = { granny: [{ gender: 'female', outfit: 'avatar_outfit_9', hat: 'avatar_hat_1', hairColor: '#b9b8b4' }, { shirt: 0x8fbf6a, hair: 0xb9b8b4, skin: 0xffe0c4, hat: 0xe2c27a }],
            fisher: [{ gender: 'male', outfit: 'avatar_outfit_11', hat: 'avatar_hat_6' }, { shirt: 0xf2c94c, hair: 0x4a3326, skin: 0xffd6b0, hat: 0x34507e }],
            farmer: [{ gender: 'male', outfit: 'avatar_outfit_1', hat: 'avatar_hat_1' }, { shirt: 0x6b8f3a, hair: 0x4a3326, skin: 0xffd6b0, hat: 0xe2c27a }], // v1.10.80 (until his model is in)
            kid: [{ gender: 'male', outfit: 'avatar_outfit_16', hat: 'avatar_hat_14' }, { shirt: 0xf08a24, hair: 0x6b4a2b, skin: 0xffe0c4, hat: 0xf08a24 }] }; // v1.10.39: in a pumpkin costume
          const [look, spec] = QUEST_LOOKS[ev.story] || [{gender:'female',outfit:'avatar_outfit_16',hat:'avatar_hat_1'},{shirt:0xffd166,hair:0x2b2b2b,skin:0xffdcbc,hat:0xff8a5c}];
          npc = makeCharacter(spec); root.rotation.y = Math.atan2(PLAZA_C.x - ev.x, PLAZA_C.z - ev.z); // (facing 대청마당, not the old island's middle)
          root.add(npc.root); npc.home = { x: ev.x, z: ev.z, yaw: root.rotation.y, id: key };
          if (ev.story === 'farmer') { assets.dress(['character.farmer'], npc); assets.hold(npc, 'farm.mallet', 0, { key: 'questTool', at: [0, -0.18, -0.025] }); prepareFarm(); } // v1.10.80 his own model, the mallet in hand
          else if (['painter', 'stationmaster', 'busker', 'electrician', 'builder', 'librarian', 'grandpa'].includes(ev.story)) { assets.dress([`character.${ev.story === 'grandpa' ? 'gazebo_grandpa' : ev.story}`, 'character.npc'], npc); if (ev.story === 'busker') assets.hold(npc, 'village.guitar', 0, { key: 'questTool', at: [0, -0.505, 0] }); prepareVillage(); } // v1.10.93 assets 39
          else dressUp(npc, look, spec);
          if (ev.story === 'kid') { npc.root.scale.setScalar(0.72); assets.hold(npc, 'halloween.candyBasket', 0, { key: 'basket' }); } // a child, the candy basket in hand
          if (ev.story === 'granny') assets.hold(npc, 'quest.watering_can', 0, { key: 'questTool' });
          if (['photographer','photomemory'].includes(ev.story)) assets.hold(npc,'quest.camera_bag',0,{key:'questTool',bone:'Chest',at:[0.28,-0.5,-0.12],proc:[0.28,0.65,0.1]});
          if (ev.story === 'fisher') assets.hold(npc, 'quest.fishing_rod', 0, { key: 'questTool' });
          npcs.push(npc);
        } else if (ev.kind === 'quest_spot') { // where a step asks me to go: only on the map
        } else if (ev.kind === 'photo' || ev.kind === 'lost_owner') { // a visitor: a tourist with a camera, or someone who lost something
          const spec = ev.kind === 'photo' ? { shirt: 0xffd166, hair: 0x2b2b2b, skin: 0xffdcbc, hat: 0xff8a5c } : { shirt: 0x9ad0ff, hair: 0x8b5a2b, skin: 0xffe0c4 };
          npc = borrowed || makeCharacter(spec);
          if (borrowed) {
            const previous=eventObjs.get(npc.residentKey); if(previous) removeEvent(npc.residentKey,previous);
            npc.residentKey=key; npc.root.userData.facility=key; facilityRoots.push(npc.root);
            root.rotation.y=Number.isFinite(ev.yaw)?ev.yaw:0;
          } else {
            root.add(npc.root); npc.home = { x: ev.x, z: ev.z, yaw: root.rotation.y, id: key };
            assets.dress(['character.visitor', 'character.islander'], npc); dressUp(npc, { gender: ev.kind === 'photo' ? 'female' : 'male' }, spec);
          }
          if (ev.kind === 'photo') { const cam = mesh(new THREE.BoxGeometry(0.26, 0.18, 0.12), mat(0x2b2b2b), 0.32, 1.05, 0.28, root); const h = new THREE.Group(); h.position.copy(cam.position); root.add(h); assets.attach('prop.event.camera', h, cam); } // the tourist's camera
          if (ev.kind === 'photo') assets.hold(npc, 'quest.camera_bag', 0, { key: 'cameraBag', bone: 'Chest', at: [0.28, -0.5, -0.12], proc: [0.28, 0.65, 0.1] });
          // what they want, at a glance: the tourist's camera; the owner of a lost thing a yellow star 「!」 (v1.10.34)
          if (ev.kind !== 'photo') { npc.tag = makeStarMark(); npc.root.add(npc.tag); } else { npc.tag = makeTag('📷', null); npc.tag.scale.multiplyScalar(0.7); npc.root.add(npc.tag); } fitTag(npc);
          if (!borrowed) npcs.push(npc);
        } else if (ev.kind === 'berry' && ev.tree) { root.position.set(ev.tree.x,heightAt(ev.tree.x,ev.tree.z),ev.tree.z); root.rotation.y=ev.tree.yaw; const h=new THREE.Group(); root.add(h); const fallback=new THREE.Group(); for(const a of [[.74,1.3,0],[.37,1.42,.64086],[-.37,1.3,.64086],[-.74,1.42,0],[-.37,1.3,-.64086],[.37,1.42,-.64086]]) mesh(new THREE.SphereGeometry(.09,6,4),mat(0xfbbf24),...a,fallback); h.add(fallback); assets.attach('tree.fruitLayer',h,fallback); root.userData.fruit=h; } else { eventModel(ev.kind, root, ev.id); root.traverse((m) => { if (m.isMesh) m.castShadow = false; }); } // small props: no shadow to draw
        root.userData.facility = key; facilityRoots.push(root);
        eventObjs.set(key, { root, npc, resident });
      }
      if (ev.verb) eventDoors[key] = { x: ev.x, z: ev.z, name: ev.resource ? `${ev.name} · ${ev.verb}` : ev.verb, resource: ev.resource, tree: ev.tree }; else delete eventDoors[key];
      const o = eventObjs.get(key);
      o.root.userData.facility = ev.verb ? key : null;
      if(o.resident != null) o.npc.root.userData.facility=ev.verb?key:null;
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
      if (ev.kind === 'quest_npc') o.requested = Boolean(ev.requested); // retain an accepted resident position independently of the head mark
      if (ev.kind === 'quest_npc' && o.mark !== (ev.mark || null)) { // its mark follows the story: new, ready, or none under way
        o.mark = ev.mark || null; disposeTag(o.npc.tag); o.npc.tag = null;
        if (o.mark) { o.npc.tag = o.mark === 'ready' ? makeCheckMark() : makeStarMark(); o.npc.root.add(o.npc.tag); fitTag(o.npc); }
      }
    }
    if(questScenes) {
      if(!(list||[]).some(e=>e.kind==='quest_npc'&&e.story==='granny')) { questScenes.empty.visible=true;questScenes.bloom.visible=false;questScenes.frame.visible=false; }
      if(!(list||[]).some(e=>e.kind==='quest_npc'&&e.story==='fisher')) { questScenes.boat.visible=false;questScenes.departure=null;questScenes.departurePending=false; }
    }
    for (const [key, o] of eventObjs) if (!seen.has(key) && !o.leaving) removeEvent(key, o); // one being handed its thing goes after
    if (!returning.size) setCarry(me, carried?.id || null);
    carriedOwner = carried ? { x: carried.x, z: carried.z } : null;
    mapMarkers = [...eventObjs.keys()].filter((key) => (key.startsWith('ev:quest_npc:') ? (eventObjs.get(key).mark || eventObjs.get(key).requested) : (key.startsWith('ev:photo:') || key.startsWith('ev:lost_owner:')) && eventDoors[key] || key.startsWith('ev:lost_item:') || key.startsWith('ev:quest_spot:'))).map((key) => ({ x: eventObjs.get(key).root.position.x, z: eventObjs.get(key).root.position.z }))
      .concat(carriedOwner ? [carriedOwner] : []); // whose it is: where to take it
    minimapAt = 0;
  }
  const doorOf = (id) => doors[id] || eventDoors[id];

  // v1.10.12 배회 NPC: islanders strolling between stopping places on the walks. Where each is comes from the shared
  // round (island-npcs.js) at the server's clock, so every screen agrees and nothing is sent; the drawing goes through
  // the same follower as other people (remote-motion.js), which also lets one step around me instead of through me.
  const wanderers = []; // { n, c, w } -- w: the islander's walker state (island-npcs.js createWalkers)
  let walkers = null;
  let residentStates = [];
  function setResidents(list) {
    if (!Array.isArray(list) || list.length !== IslandNpcs.COUNT) return;
    if (!list.every((s,n)=>s?.n===n && Number.isFinite(s.delay) && s.delay>=0 &&
      (!s.hold || (typeof s.hold.eventId==='string' && Number.isFinite(s.hold.x) && Number.isFinite(s.hold.z) && Number.isFinite(s.hold.yaw))))) return;
    residentStates = list.map(s=>({...s,hold:s.hold?{...s.hold}:null}));
  }
  function residentPose(n,ms) {
    const o=[...eventObjs.values()].find(o=>o.resident===n && o.leaving);
    // Keep the recipient visible until the actual delayed Give/Receive timers finish on this screen.
    if(o) return {x:o.root.position.x,z:o.root.position.z,yaw:o.npc.returnYaw??o.root.rotation.y,moving:false,held:true};
    return IslandNpcs.residentAt(n,ms,residentStates[n]);
  }
  let serverOffset = 0; let clockRtt = Infinity; // server ms minus my ms, from the quickest answer seen
  function setServerTime(serverMs, sentAt, receivedAt) {
    const rtt = receivedAt - sentAt;
    if (!Number.isFinite(serverMs) || rtt < 0 || rtt > clockRtt * 1.5 + 50) return;
    clockRtt = Math.min(clockRtt, rtt); serverOffset = serverMs + rtt / 2 - receivedAt;
  }
  const wanderersTimer = setTimeout(() => { // after the first frames: the islanders' map takes a moment to work out
    if (!IslandNpcs) return;
    // v1.10.16: walked through the scene's own collision circles and ground (the route grid is only the long plan)
    walkers = IslandNpcs.createWalkers({ walkable, solidsNear, poseAt:residentPose });
    for (let n = 0; n < IslandNpcs.COUNT; n += 1) {
      const r = IslandNpcs.round(n);
      const c = makeCharacter(r.look); c.groundedWalk = true;
      // starts where its round has it now, not at the origin walking over to it
      const w = walkers.add(n, Date.now() + serverOffset);
      c.root.position.set(w.x, heightAt(w.x, w.z), w.z);
      scene.add(c.root); assets.dress('character.islander', c); dressUp(c, { gender: n % 2 ? 'female' : 'male' }, r.look);
      wanderers.push({ n, c, w });
    }
    setEvents(lastResidentEvents);
  }, 400);
  function stepWanderers(dt) {
    if (!walkers) return;
    const m = me.root.position;
    // v1.10.16: the shared round, stepped around solids, each other and people (island-npcs.js createWalkers): me,
    // other players and event visitors are circles to give way to
    const people = [{ x: m.x, z: m.z, r: playerRadiusAt(m.x, m.z) }];
    for (const o of others.values()) people.push({ x: o.c.root.position.x, z: o.c.root.position.z, r: playerRadiusAt(o.c.root.position.x, o.c.root.position.z) });
    for (const o of eventObjs.values()) if (o.npc && o.resident == null) people.push({ x: o.root.position.x, z: o.root.position.z, r: PLAYER_R });
    walkers.step(Date.now() + serverOffset, dt, people);
    for (const { c, w } of wanderers) {
      c.root.position.set(w.x, heightAt(w.x, w.z), w.z); // the exact ground (slopes, bridge decks) every frame
      c.root.visible = Math.hypot(w.x - m.x, w.z - m.z) < 85;
      if (!c.root.visible) continue;
      if (w.pose.held) {
        const hold=residentStates[w.n]?.hold;
        if(hold?.returning && c.returnYaw==null && c.returnEmote!==hold.eventId) {
          c.returnEmote=hold.eventId; c.anim?.play('receive');
        }
        const close=Boolean(c.residentKey && near===c.residentKey);
        c.targetYaw=c.returnYaw??c.talkYaw??(!w.arrived && w.speed>.3 && w.heading!=null ? w.heading : w.pose.yaw); // v1.10.73: facing the way while walking to the place
        c.lookAt=close && c.returnYaw==null && c.talkYaw==null ? Math.atan2(m.x-w.x,m.z-w.z)-c.targetYaw : null; // in a talk the body already faces me: no head turn on top
        c.waving=close && c.returnYaw==null && w.arrived;
        animate(c,dt,!w.arrived && w.speed>.3,w.speed); continue;
      }
      c.waving=false; delete c.returnEmote;
      c.targetYaw = c.talkYaw ?? c.chatYaw ?? (w.speed > 0.4 && w.heading != null ? w.heading : w.pose.yaw); // (v1.10.91: turned to me in a talk; A-6: to the one they chat with)
      c.lookAt = c.talkYaw != null || c.chatYaw != null || w.pose.moving || lessMotion?.matches ? null : Math.sin(clock * 0.35 + w.n * 1.7) * 0.6; // standing: looking about
      animate(c, dt, w.speed > 0.3, w.speed);
    }
    if ((chatCheck -= dt) <= 0) { chatCheck = 0.25; chatter(); }
    const now = performance.now(); for (const { c } of wanderers) stepBubble(c, now);
  }
  // A-6 주민끼리 수다: two islanders standing at the same stop (within CHAT_R) face each other and trade lines over their
  // heads (IslandCast.chatLine, by the server clock's 3-second slots: the same on every screen). A talk with me comes first.
  const CHAT_R = 3.2; let chatCheck = 0;
  function chatter() {
    const slot = Math.floor((Date.now() + serverOffset) / 3000);
    const free = wanderers.filter(({ c, w }) => c.root.visible && !w.pose.moving && !w.pose.held && c.talkYaw == null && w.speed < 0.2);
    const paired = new Set();
    for (let i = 0; i < free.length; i += 1) for (let j = i + 1; j < free.length; j += 1) {
      const A = free[i]; const B = free[j];
      if (paired.has(A.n) || paired.has(B.n) || Math.hypot(A.w.x - B.w.x, A.w.z - B.w.z) > CHAT_R) continue;
      paired.add(A.n); paired.add(B.n);
      A.c.chatYaw = Math.atan2(B.w.x - A.w.x, B.w.z - A.w.z); B.c.chatYaw = Math.atan2(A.w.x - B.w.x, A.w.z - B.w.z);
      const [a, b] = A.n < B.n ? [A, B] : [B, A]; const line = globalThis.IslandCast?.chatLine(a.n, b.n, slot);
      const speaker = line && (line.who === a.n ? a : b);
      if (speaker && speaker.c.chatSlot !== slot) { speaker.c.chatSlot = slot; say(speaker.c, line.text); }
    }
    for (const { n, c } of wanderers) if (!paired.has(n)) delete c.chatYaw;
  }

  let near = null; let nearName = null;
  function canInteract(id) {
    if (!running || typeof id !== 'string') return false;
    const door = doorOf(id);
    if (!door || door.plain) return false;
    const actor=eventObjs.get(id);
    if(actor?.resident!=null && !wanderers.find(w=>w.n===actor.resident)?.w.arrived) return false;
    if (id === 'fish:spot') return Boolean(fishing || globalThis.IslandTerrain.canFish(me.root.position.x, me.root.position.z));
    if (id.startsWith('player:')) {
      const other = others.get(id.slice(7));
      if (!other) return false;
      return Math.hypot(other.c.root.position.x - me.root.position.x, other.c.root.position.z - me.root.position.z) < 2.2;
    }
    if (id.startsWith('seat:') && takenSeats.has(id.slice(5))) return false;
    if ((riding || platform) && !id.startsWith('train:')) return false;
    const reach = id.startsWith('train:enter:') ? 2.6 : id.startsWith('seat:') ? 1.6 : id.startsWith('player:') || id.startsWith('resident:') ? 2.2 : door.resource || id.startsWith('weed:') ? WEED_REACH : eventDoors[id] ? EVENT_REACH : REACH;
    return Math.hypot(door.x - me.root.position.x, door.z - me.root.position.z) < reach;
  }
  function interact(id) {
    if (photoMode || !canInteract(id)) return; // (v1.10.81: nothing started or finished from the photo mode)
    if (cycling) { cycling = null; onBike?.(false, null); } // (자전거: off to do it)
    if (!id.startsWith('weed:') && !eventDoors[id]?.resource) keys.clear();
    const door = doorOf(id);
    if (door) me.targetYaw = Math.atan2(door.x - me.root.position.x, door.z - me.root.position.z); // turn to face it
    lastTalk = door ? { id, x: door.x, z: door.z } : null; // who a talk that follows is with (talkCamera)
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
    for (const o of eventObjs.values()) if (o.npc && o.resident == null) out.push({ x: o.root.position.x, z: o.root.position.z, r: PLAYER_R }); // v1.10.11: event NPCs stand like people
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
  // v1.10.93 마을 소품 (the mural, easel, stage, lamps, toolbox, book cart): solid from the start, as the grid is made once
  // -- A-7: the book cart only while it is out (the librarian's ask; it stood unseen in the town hall's yard)
  for (const v of globalThis.IslandTerrain.villageSolids()) solids.push({ x: v.x, z: v.z, r: v.r * 0.8, ...(v === globalThis.IslandTerrain.VILLAGE.bookcart ? { off: () => !village?.cart?.visible } : {}) });
  prepareTogether(); prepareGuide(); // B 47: the 우체통 and the guide resident (their solids are village ones)
  // 묶음 4: a house stands in the way, an empty lot does not -- 4-2: as big as its stage (the 오두막 one circle, the 작은 집
  // 6 x 5 m two, the 큰 집 9.4 x 6.6 m and its veranda six; house-local x, z (front -z), r)
  const HOUSE_CIRCLES = { 1: [[0, 0.2, 2.2]], 2: [[-1.5, 0.3, 2.5], [1.5, 0.3, 2.5]], 3: [[-3.2, 1.2, 3], [0, 1.2, 3], [3.2, 1.2, 3], [-3.3, -2.3, 2.3], [0, -2.3, 2.3], [3.3, -2.3, 2.3]] };
  for (const lot of HOME.LOTS) for (const [st, list] of Object.entries(HOUSE_CIRCLES)) for (const [lx, lz, r] of list) { const c = Math.cos(lot.yaw); const s = Math.sin(lot.yaw); solids.push({ x: lot.x + lx * c + lz * s, z: lot.z - lx * s + lz * c, r, off: () => !homesShown.get(lot.id)?.owned || homesShown.get(lot.id).stage !== Number(st) }); }
  const GRID = 8; const grid = new Map();
  for (const s of solids) {
    const reach = s.r + 0.5;
    for (let gx = Math.floor((s.x - reach) / GRID); gx <= Math.floor((s.x + reach) / GRID); gx += 1) {
      for (let gz = Math.floor((s.z - reach) / GRID); gz <= Math.floor((s.z + reach) / GRID); gz += 1) {
        const key = `${gx},${gz}`; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(s);
      }
    }
  }
  // v1.10.41: the mayor's gate, open once he has let me in; v1.10.38: October's decorations only while they are out (A-7:
  // by the decorations, not the night -- v1.10.90 parted them); A-7: what is not there now (`off`) is not in the way
  const blocksNow = (o) => !((o.hw && !decorOn) || (o.gate && yard.isOpen()) || o.off?.());
  const solidsNear = (x, z) => { const list = grid.get(`${Math.floor(x / GRID)},${Math.floor(z / GRID)}`) || []; return list.every(blocksNow) ? list : list.filter(blocksNow); };
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
    if (mySpace === 'townhall') { [nx, nz] = collidePlayers(p.x, p.z, nx, nz); const q = globalThis.IslandTerrain.roomClamp(nx, nz); p.set(q.x, ROOM.y, q.z); return; } // v1.10.84
    if (mySpace === 'store' || mySpace === 'furniture' || mySpace === 'petshop' || mySpace === 'home') { const R = mySpace === 'store' ? STORE : mySpace === 'furniture' ? FURN : mySpace === 'petshop' ? PETS : homeRoom; [nx, nz] = collidePlayers(p.x, p.z, nx, nz); const q = R.clamp(nx, nz); p.set(q.x, R.ROOM.y, q.z); return; } // v1.10.92, 묶음 2
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
  const CAM_CLEAR = 1.0; let camDist = CAM_DIST;
  // 문제 기록 7 (2026-10-21 「카메라는 직접 조작해서 보이게」): no lift over walls any more (a building in the way is
  // see-through); the camera keeps CAM_CLEAR over gentle ground only -- ground rising CAM_STEEP..+3 m above my feet
  // (a cliff, the ridge) lets go of it smoothly and the camera stays where it is, the ground seen through from inside
  const CAM_STEEP = 3;
  const camFloor = (x, z, py, y) => { const h = heightAt(x, z); const g = h + CAM_CLEAR; if (g <= y) return y; const w = Math.max(0, Math.min(1, (py + CAM_STEEP + 3 - h) / 3)); return y + (g - y) * w; }; // (the ground's own rise, not the camera's: it let go from 2 m up, behind the 백화점)
  // v1.10.62 확대·축소 (사용자 2026-10-11): how far the camera stands is the player's own choice -- the mouse wheel on a PC,
  // two fingers apart / together on a phone -- and nothing else changes it (it no longer comes in by a building: there it
  // rises over the walls at the same distance, so things keep their size). Kept per browser. A later interaction camera
  // (IDEAS 몰입형 카메라: in behind my character for a talk) is meant to ease to its own view and back to this one.
  const ZOOM_MIN = 6; const ZOOM_MAX = 26;
  let zoomDist = CAM_DIST;
  try { const saved = Number(localStorage.getItem('gc.islandZoom')); if (saved >= ZOOM_MIN && saved <= ZOOM_MAX) zoomDist = saved; } catch {}
  function setZoom(d) {
    zoomDist = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, d));
    try { localStorage.setItem('gc.islandZoom', zoomDist.toFixed(2)); } catch {}
  }
  // v1.10.63 몰입형 대화 카메라 (IDEAS 2026-10-11): while a resident talks, the camera eases (about half a second) in
  // behind my shoulder toward them, both turned to each other; a quest taken or done, a reward or a big choice gets a
  // two-shot from the side. Closing the talk eases back to the player's own view (zoomDist untouched). Reduced motion:
  // the views switch without the glide.
  let lastTalk = null; let talkView = null;
  // (사용자 2026-10-12) the camera frames the one I talk to where they really stand (their figure, not the spot of the
  // talk), and they turn to me for the talk: an event visitor's body (put back after), a walking islander by talkYaw
  // (apart from the hand-over's returnYaw); a shop keeper already turns its head
  let talkTurned = null; const TALK_GAP = 1.6;
  const talkFigure = (id) => {
    const o = eventObjs.get(id);
    if (o?.npc) return o.resident != null ? o.npc.root : o.root;
    if (id.startsWith('player:')) return others.get(id.slice(7))?.c.root || null;
    if (id.startsWith('resident:')) return wanderers.find((w) => w.n === Number(id.slice(9)))?.c.root || null; // v1.10.91
    if (id === 'mayor') return yard.mayor.root;
    return npcs.find((n) => n.home?.id === id)?.root || null;
  };
  function untalk() {
    const t = talkTurned; talkTurned = null;
    if (!t) return;
    if (t.walker) delete t.walker.talkYaw;
    else if (!t.o.leaving) { t.o.root.rotation.y = t.yaw; if (t.o.npc.home) t.o.npc.home.yaw = t.homeYaw; }
  }
  function talkCamera(mode) {
    talkView = null; untalk();
    const t = lastTalk; const p = me.root.position;
    if (!mode || !t || overview || riding) return false;
    const figure = talkFigure(t.id); const at = figure?.getWorldPosition(new THREE.Vector3()) || { x: t.x, z: t.z };
    if (Math.hypot(at.x - p.x, at.z - p.z) > 6) return false;
    // stepping back only from a person standing loose on the island (a gate or a counter keeps its own spot and reach)
    talkView = { id: t.id, x: at.x, z: at.z, shot: mode === 'shot', step: Boolean(figure) && (eventObjs.has(t.id) || t.id.startsWith('player:') || t.id.startsWith('resident:')) };
    me.targetYaw = Math.atan2(at.x - p.x, at.z - p.z);
    const toMe = Math.atan2(p.x - at.x, p.z - at.z);
    const o = eventObjs.get(t.id);
    const walker = t.id.startsWith('resident:') ? wanderers.find((w) => w.n === Number(t.id.slice(9)))?.c : null; // v1.10.91
    if (walker) { walker.talkYaw = toMe; talkTurned = { walker }; }
    else if (o?.npc && !o.leaving && o.resident != null) { o.npc.talkYaw = toMe; talkTurned = { walker: o.npc }; }
    else if (o?.npc && !o.leaving) {
      talkTurned = { o, yaw: o.root.rotation.y, homeYaw: o.npc.home?.yaw };
      o.root.rotation.y = toMe - o.npc.root.rotation.y; if (o.npc.home) o.npc.home.yaw = o.root.rotation.y;
    }
    return true;
  }
  function talkPose(p) {
    const t = talkView; const dx = t.x - p.x; const dz = t.z - p.z; const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len; const uz = dz / len; const rx = uz; const rz = -ux; // toward them, and to my right
    const ty = heightAt(t.x, t.z);
    let c; let look;
    if (t.shot) { // the moment itself: wider, from further behind and to the side -- both of us, their face toward me
      c = { x: p.x - ux * 3.4 + rx * 2.6, z: p.z - uz * 3.4 + rz * 2.6, y: p.y + 2.9 };
      look = new THREE.Vector3((p.x + t.x * 2) / 3, (p.y + ty * 2) / 3 + 0.9, (p.z + t.z * 2) / 3); // faces above the bubble
    } else { // behind me, past my right shoulder: their face and upper body in the picture, my head at the side
      c = { x: p.x - ux * 2.7 + rx * 2.4, z: p.z - uz * 2.7 + rz * 2.4, y: p.y + 2.3 };
      look = new THREE.Vector3(t.x - rx * 0.5, ty + 1.0, t.z - rz * 0.5); // aimed low: their face sits above the speech bubble
    }
    return { want: new THREE.Vector3(c.x, camFloor(c.x, c.z, p.y, c.y), c.z), look };
  }
  function placeCamera(snap) {
    const p = me.root.position;
    // The wide sea lobes must still show the island from the carriage.
    scene.fog.far = overview ? 2000 : riding ? 600 : 175;
    const far = overview ? 1100 : riding ? 650 : VIEW_FAR;
    if (camera.far !== far) { camera.far = far; camera.updateProjectionMatrix(); }
    if (overview) { camera.position.set(20, 550, -45); camera.lookAt(20, 0, -45); return; }
    const sin = Math.sin(camYaw); const cos = Math.cos(camYaw); // the low quarter view, turned by dragging (v1.10.2)
    // v1.10.21: tilted by camPitch around the same distance (문제 기록 7: inside a building it stays -- the building fades)
    // v1.10.40: toward the sky the camera comes down to SKY_LOW above the level of my head, and what is left of the tilt
    // lifts its aim (the look point raised as far as that angle) -- the sky and the moon above, me at the bottom
    const SKY_LOW = 0.1; const lift = Math.max(0, SKY_LOW - (CAM_ELEV + camPitch));
    const elev = Math.max(SKY_LOW, CAM_ELEV + camPitch); const at = (d) => ({ x: p.x + sin * Math.cos(elev) * d, z: p.z + cos * Math.cos(elev) * d });
    const dist = zoomDist; // v1.10.62: the player's zoom, never pulled in
    snap ||= Boolean(lessMotion?.matches);
    camDist = snap ? dist : camDist + (dist - camDist) * cameraEase(0.2, camDt);
    const c = at(camDist);
    const orbitY = p.y + Math.sin(elev) * camDist;
    const want = new THREE.Vector3(c.x, camFloor(c.x, c.z, p.y, orbitY), c.z); // v1.10.0: follow the player across the island
    const lookY = p.y + 1.3 + Math.tan(lift) * (camDist * Math.cos(elev) + 2.4);
    const look = new THREE.Vector3(p.x - sin * 2.4, cameraSkyAim(lookY, p.y + Math.sin(elev) * camDist, want.y, lift), p.z - cos * 2.4);
    if (talkView) { const v = talkPose(p); want.copy(v.want); look.copy(v.look); }
    if (snap) { camPos.copy(want); camLook.copy(look); } else { camPos.lerp(want, cameraEase(0.08, camDt)); camLook.lerp(look, cameraEase(0.1, camDt)); }
    camPos.y = camFloor(camPos.x, camPos.z, p.y, camPos.y); // easing never dips it into a gentle slope either
    camera.position.copy(camPos); camera.lookAt(camLook);
    fadeInWay(p);
  }
  // v1.10.21: a building or house between the camera and me is drawn see-through, so no view loses my character --
  // 문제 기록 2회차 1 (사용자 2026-10-21 「건물 가려지면 투명화되는 거 섬에선 그러지 마」): not out on the island any more
  // (the camera turned by hand finds the view); inside (the 백화점, a house, the 민원실) as before
  const occlusion = createOcclusion(camera);
  function fadeInWay(p) { occlusion.update(mySpace === 'island' ? [] : buildingRoots, p, clock); }

  let running = false; let raf = 0; let last = 0; let clock = 0;
  let seasonCheckedAt = -Infinity; let seasonOverride = null; // tests may hold a season day (debug().setSeasonDay)
  let seasonHold = null; // A5 계절 고정: the administrator's held day (null: by the date)
  let halloweenCheckedAt = -Infinity; // v1.10.36: October's night, checked every few seconds by the server clock
  // (bugs 12: a window over nearly all of the island -- 꾸미기·가방·게시판 -- the island drawn twice a second under it, not
  // every frame beside the window's own 3D picture; it still steps: places, sounds, the server)
  let coverCheckedAt = -Infinity; let covered = false; let drawnAt = -Infinity; let draws = 0;
  const windowCovers = () => { const d = document.querySelector('dialog[open]'); if (!d) return false; const r = d.getBoundingClientRect(); return r.width * r.height >= 0.6 * window.innerWidth * window.innerHeight; };
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const real = (now - (last || now)) / 1000; const dt = Math.min(0.05, real); last = now; clock += dt;
    camDt = Math.min(0.25, real); // v1.10.21: turning keeps to the clock on a slow PC (the animation step is capped)
    step(dt);
    if (now - coverCheckedAt > 250) { coverCheckedAt = now; covered = windowCovers(); }
    if (covered && now - drawnAt < 500) return;
    renderer.render(scene, camera); drawnAt = now; draws += 1;
    if (covered) return; // (the quality is measured on frames drawn every frame)
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
      if (quality === 1) renderer.setPixelRatio(TEST_DRAW ? 0.5 : 1);
      else { renderer.shadowMap.enabled = false; sun.castShadow = false; mats.forEach((m) => { m.needsUpdate = true; }); }
      assets.setQuality(quality); island.setQuality(quality); // v1.10.73: the ground cover by tier
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
    if (isBlocked()) actLock = 0;
    if (sitting && !photoMode && !isBlocked() && (stick || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].some((k) => keys.has(k)))) standUp(); // v1.10.44: an arrow stands me up
    if (!isBlocked() && !gather && !actLocked() && !riding && !liftRide && !photoMode) { // v1.10.40: gathering holds me in place (the keys stay pressed for after); v1.10.47 so does the train
      if (keys.has('ArrowLeft')) ix -= 1; if (keys.has('ArrowRight')) ix += 1;
      if (keys.has('ArrowUp')) iz -= 1; if (keys.has('ArrowDown')) iz += 1;
      if (stick) { ix += stick.x; iz += stick.y; }
    } else if (isBlocked()) keys.clear();
    turnCamera(camDt); // v1.10.21
    const moving = ix !== 0 || iz !== 0;
    if (moving) {
      const len = Math.hypot(ix, iz); ix /= len; iz /= len;
      const sin = Math.sin(camYaw); const cos = Math.cos(camYaw); // keys are relative to the view
      const wx = ix * cos + iz * sin; const wz = -ix * sin + iz * cos;
      if (grab) stepGrab(dt, wx, wz); else { const v = paceSpeed(); tryMove(me.root.position.x + wx * v * dt, me.root.position.z + wz * v * dt);
        me.targetYaw = Math.atan2(wx, wz); }
    } else if (grab) { stepGrab(dt, 0, 0);
    } else if (talkView?.step) { // (사용자 2026-10-12) standing right against them, I step back to a talking distance so the
      // camera behind me sees their face past my head (still within reach of the talk: EVENT_REACH 1.9)
      const p = me.root.position; const d = Math.hypot(talkView.x - p.x, talkView.z - p.z);
      if (d > 0.01 && d < TALK_GAP - 0.02) { const s = Math.min(TALK_GAP - d, 2.2 * dt) / d; tryMove(p.x - (talkView.x - p.x) * s, p.z - (talkView.z - p.z) * s); }
    }
    stepPlatform(); stepRide(); stepQuestScenes(dt); stepGrabHold();
    bikeCheck();
    animate(me, dt, moving && !grab, moving && !grab ? paceSpeed() : 0); // (holding a piece: the furniture clips, stepGrab)
    bikeOf(me, cycling, moving ? paceSpeed() : 0, dt);
    stepOthers(dt);
    stepWanderers(dt);
    const now = performance.now(); stepBubble(me, now); for (const o of others.values()) stepBubble(o.c, now);
    // v1.10.37 원거리 (사용자 2026-10-07 「말풍선은 숨겨도 이름표는 보이게」): far off the bubble goes, the name tag stays --
    // out of the fog like the figure, even where its place is only roughly right
    for (const o of others.values()) { const far = Math.hypot(o.c.root.position.x - me.root.position.x, o.c.root.position.z - me.root.position.z) > FAR_TAG; if (o.c.bubble) o.c.bubble.visible = !far; }
    for (const npc of npcs) { // the keeper turns to a player who comes close and waves
      const close = near === npc.home.id && !(talkView && talkView.id === npc.home.id); // in a talk: the body faces me (talkCamera)
      npc.lookAt = close ? Math.atan2(me.root.position.x - npc.home.x, me.root.position.z - npc.home.z) - npc.home.yaw : null;
      npc.waving = close;
      // v1.10.79 (assets 36): a small greeting when I come up (not again within 20 s), and now and then a look around
      // while nobody is there -- only over its plain idle, never over another clip it is playing
      if (close && !npc.wasClose && clock - (npc.greetedAt ?? -99) > 20 && npc.anim?.state === 'idle' && npc.anim.play('greet')) npc.greetedAt = clock;
      else if (!close && npc.anim?.state === 'idle' && clock > (npc.lookNext ??= clock + 10 + Math.random() * 20)) { npc.anim.play('look'); npc.lookNext = clock + 20 + Math.random() * 25; }
      npc.wasClose = close;
      animate(npc, dt, false);
    }
    stepGuideArrow(); stepInsects(dt, moving); stepPets(); stepPetshop(); stepHome(dt); // B 47, 묶음 2-2, 묶음 4
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
    // (묶음 3: a weed beside someone to talk to -- the one I face is talked to first; the weed is pulled facing it)
    const facing = (x, z) => { const m = me.root.position; const d = Math.hypot(x - m.x, z - m.z) || 1; return ((x - m.x) * Math.sin(me.root.rotation.y) + (z - m.z) * Math.cos(me.root.rotation.y)) / d > 0.5; };
    if (best && eventDoors[best]?.resource) for (const [id, door] of Object.entries(eventDoors)) if (!door.resource && !door.plain && door.name?.startsWith('말 걸기') && Math.hypot(door.x - me.root.position.x, door.z - me.root.position.z) < EVENT_REACH && facing(door.x, door.z)) { best = id; break; }
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
    // v1.10.92 잡화점: in the store, the good nearest me (within reach) is what SPACE buys
    for (const k of Object.keys(eventDoors)) if (k.startsWith('good:')) delete eventDoors[k];
    if (best && !doorOf(best)) best = null; // (last frame's good, picked above)
    if (mySpace === 'store' && !best) { const s = STORE.goodAt(me.root.position.x, me.root.position.z); if (s) { const w = STORE.world(s.at[0], s.at[2]); const g = goodsPrices[s.id]; const on = Boolean(g?.price) && !s.soon; eventDoors[`good:${s.id}`] = { x: w.x, z: w.z, name: on ? `${g.name} · ${Number(g.price).toLocaleString('ko-KR')}P` : `${g?.name || '물건'} · 곧 판매`, plain: !on }; /* (prices: the server's, app.js) */ best = `good:${s.id}`; } }
    for (const k of Object.keys(eventDoors)) if (k.startsWith('furn:') || k.startsWith('adopt:')) delete eventDoors[k];
    if (best && !doorOf(best)) best = null;
    if (mySpace === 'petshop' && !best && petshopState && petshop) { const m = me.root.position; let pick = null; let pd = PETS.REACH; for (const [slot, h] of petshop.pets) { const d = Math.hypot(h.c.root.position.x - m.x, h.c.root.position.z - m.z); if (d < pd) { pd = d; pick = slot; } } const p = pick && petshopState.pets.find((x) => x.slot === pick); if (p) { const h = petshop.pets.get(pick).c.root.position; eventDoors[`adopt:${pick}`] = { x: h.x, z: h.z, name: `${p.name} · ${Number(p.price).toLocaleString('ko-KR')}P` }; best = `adopt:${pick}`; } }
    if (mySpace === 'furniture' && !best && furnitureState) { const s = FURN.placeAt(me.root.position.x, me.root.position.z); const d = s && furnitureState.items[s.id]; if (d) { const w = FURN.world(s.lx, s.lz); eventDoors[`furn:${s.id}`] = { x: w.x, z: w.z, name: d.sold ? '팔렸어요 · 내일 새 가구가 들어와요' : `${d.name} · ${Number(d.price).toLocaleString('ko-KR')}P`, plain: d.sold }; best = `furn:${s.id}`; } }
    for (const k of Object.keys(eventDoors)) if (k.startsWith('tank:') || k.startsWith('frame:')) delete eventDoors[k];
    if (best && !doorOf(best)) best = null;
    if (mySpace === 'home' && !best && homeHere?.mine) { // (묶음 4) the tank, insect case or frame by me
      const { lx, lz } = HOME.local(homeHere.lot, me.root.position.x, me.root.position.z); let pick = null; let pd = 1.0;
      for (const p of homeHere.home.pieces) { const shape = HOME.shapeOf(p.id); if (!HOME.TANKS[shape] && shape !== 'picture_frame') continue; const b = HOME.boxOf(p); const d = Math.hypot(Math.max(b.x0 - lx, 0, lx - b.x1), Math.max(b.z0 - lz, 0, lz - b.z1)); if (d < pd) { pd = d; pick = p; } }
      if (pick) { const shape = HOME.shapeOf(pick.id); const w = HOME.world(homeHere.lot, pick.x, pick.z); const key = `${shape === 'picture_frame' ? 'frame' : 'tank'}:${pick.uid}`; eventDoors[key] = { x: w.x, z: w.z, name: shape === 'picture_frame' ? '액자 · 기념사진 걸기' : shape === 'insect_case' ? '곤충 상자 · 넣고 꺼내기' : '수조 · 물고기 넣고 꺼내기' }; best = key; }
    }
    for (const k of Object.keys(eventDoors)) if (k.startsWith('insect:')) delete eventDoors[k];
    if (best && !doorOf(best)) best = null;
    if (mySpace === 'island' && (!best || (insectNet && best === weedKey)) && !gather && !fishing) { const h = nearInsect(); if (h) { const p = h.c.root.position; eventDoors[`insect:${h.b.id}`] = insectNet ? { x: p.x, z: p.z, name: `잡기 · ${h.b.name}` } : { x: p.x, z: p.z, name: `${h.b.name} · 잠자리채가 있으면 잡을 수 있어요`, plain: true }; best = `insect:${h.b.id}`; } } // (묶음 5; with a net, a bug by me before a weed by me -- the weed stays, the bug flies off)
    // v1.10.44: a free seat right by me (SPACE · 앉기), or another player beside me (SPACE · 인사) when nothing else is near
    for (const k of Object.keys(eventDoors)) if (k.startsWith('seat:') || k.startsWith('player:') || k.startsWith('resident:')) delete eventDoors[k];
    if (best && !doorOf(best)) best = null; // the one picked above may have been last frame's seat or player
    if ((!best || eventDoors[best]?.resource) && !gather && !fishing) { // v1.10.91 주민 대화: an islander by me (not one an event holds) talks -- A-6: walking too
      const m = me.root.position; let who = null; let wd = 2.2; const overWeed = Boolean(best); // (묶음 3: over a weed only the one I face)
      for (const { n, c, w } of wanderers) { if ((w.pose.held && !residentStates[n]?.hold?.eventId?.startsWith('talk:')) || !c.root.visible) continue; /* (in someone else's talk: the server says with whom) */ const d = Math.hypot(w.x - m.x, w.z - m.z); if (d < wd && (!overWeed || facing(w.x, w.z))) { who = { n, w }; wd = d; } }
      if (who) { eventDoors[`resident:${who.n}`] = { x: who.w.x, z: who.w.z, name: `말 걸기 · ${globalThis.IslandCast?.WALKERS[who.n]?.name || '주민'}` }; best = `resident:${who.n}`; }
    }
    if (!best && !gather && !fishing) {
      const m = me.root.position; let seat = null; let sd = 1.6;
      for (const s of SEATS) { const d = Math.hypot(s.x - m.x, s.z - m.z); if (d < sd && !takenSeats.has(s.id)) { seat = s; sd = d; } }
      const busyCounter = !seat && SEATS.find((s) => s.counter && takenSeats.has(s.id) && Math.hypot(s.x - m.x, s.z - m.z) < 1.6); // (A-7)
      if (seat) { eventDoors[`seat:${seat.id}`] = { x: seat.x, z: seat.z, name: seat.counter ? `앉아서 ${seat.name} 업무` : '앉기' }; best = `seat:${seat.id}`; }
      else if (busyCounter) { eventDoors[`seat:${busyCounter.id}`] = { x: busyCounter.x, z: busyCounter.z, name: '다른 분이 업무 중이에요', plain: true }; best = `seat:${busyCounter.id}`; }
      else {
        let who = null; let wd = 2.2;
        for (const [id, o] of others) { const d = Math.hypot(o.c.root.position.x - m.x, o.c.root.position.z - m.z); if (d < wd) { who = [id, o]; wd = d; } }
        if (who) { eventDoors[`player:${who[0]}`] = { x: who[1].c.root.position.x, z: who[1].c.root.position.z, name: '인사' }; best = `player:${who[0]}`; }
      }
    }
    // v1.10.42 낚시: by the water with nothing else near -- SPACE casts; while fishing it pulls in (or stops before the bite)
    if (fishing || (!best && !gather && mySpace === 'island' && globalThis.IslandTerrain.canFish(me.root.position.x, me.root.position.z))) {
      const w = fishing ? fishing.water : waterFrom(me.root.position.x, me.root.position.z);
      if (w) { eventDoors['fish:spot'] = { x: w.x, z: w.z, name: fishing ? (fishing.phase === 'bite' ? '당기기' : '그만하기') : '낚시' }; best = 'fish:spot'; } else delete eventDoors['fish:spot'];
    } else delete eventDoors['fish:spot'];
    // (2회차 11: holding a piece, the hint says how to let go and turn it -- not the seat or tank in front)
    if (grab) { eventDoors['grab:hold'] = { x: me.root.position.x, z: me.root.position.z, name: grab.blocked ? `${grab.blocked} · 놓기` : '가구 놓기 · R 돌리기' }; best = 'grab:hold'; } else delete eventDoors['grab:hold'];
    // (문제 기록 3회차 공통 오류 「reading 'name' at step」: best may still be last frame's grab:hold or fish:spot, taken
    // away just above when the piece was let go or the line pulled in)
    if (best && !doorOf(best)) best = null;
    if (best !== near || (best && doorOf(best)?.name !== nearName)) { near = best; nearName = near ? doorOf(near).name : null; onNear?.(near ? { id: near, name: nearName, plain: Boolean(doorOf(near).plain) } : null); }
    me.lookAt = near && !talkView ? Math.atan2(doorOf(near).x - me.root.position.x, doorOf(near).z - me.root.position.z) : null;
    const ambientClock = lessMotion?.matches ? 0 : clock;
    for (const o of eventObjs.values()) { const spin = o.root.userData.spin; if (spin) { if (spin.isMesh) spin.rotation.z = ambientClock * 2.4; else spin.rotation.y = ambientClock * 2.4; spin.position.y = (spin.isMesh ? 0.35 : 0.2) + Math.sin(ambientClock * 2) * 0.05; } }
    stepWeeds(dt); // v1.10.31
    stepFishing(dt); // v1.10.42
    stepVillage(dt); // v1.10.93
    stepWeather(dt); // A4 날씨
    stepShows(dt); // v1.10.92
    if (photoMode) hideForPhoto(); // v1.10.43 (bubbles are shown again by their own updates)
    // v1.10.46: the shadow's square moves in whole texels of its map across the light (it followed me smoothly, so the
    // edges of every shadow crawled as I walked -- seen on the town hall's marble)
    const texel = (sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.x; const at = me.root.position;
    const a = at.dot(SUN_U); const b = at.dot(SUN_V);
    sun.target.position.copy(at).addScaledVector(SUN_U, Math.round(a / texel) * texel - a).addScaledVector(SUN_V, Math.round(b / texel) * texel - b);
    sun.position.copy(sun.target.position).add(SUN_OFF);
    assets.update(me.root.position.x, me.root.position.z); // v1.10.17: near squares of registered nature show their model
    assets.tick(dt, me.root.position.x, me.root.position.z, Boolean(lessMotion?.matches) || indoors); // one-off actions keep playing; ambient flakes stop (and none fall indoors)
    for (const c of statueChars) if (c.anim && !c.frozen) { c.anim.play('wave'); c.anim.update(0.7, 0); c.frozen = true; c.root.userData.occlusionRevision = (c.root.userData.occlusionRevision || 0) + 1; } // v1.10.30: a statue's wave, set once
    for (const c of statueChars) if (c.stoneStatue) { // (달마루섬: then one stone -- the model once frozen, or the drawn one if no model came; again if a model comes later)
      const src = c.assetRoot && c.frozen ? c.assetRoot : !c.assetRoot && performance.now() - c.bornAt > 4000 ? c.body : null;
      if (src && c.stoneOf !== src) { if (c.stone) { c.root.remove(c.stone); c.stone.geometry.dispose(); } c.stone = bakeStone(c); c.stoneOf = src; }
    }
    if (carvings.length) stepCarvings(dt);
    stepWhale(); stepSea(dt); // v1.10.32: the sea's other sights
    // v1.10.27: the season day by the server clock, checked every few seconds -- at 00:00 KST every season moves one zone
    // clockwise and the models swap in place for whoever is on the island (their files are already in the resource cache)
    if (clock - seasonCheckedAt > 2 && seasonOverride === null && seasonHold === null) { seasonCheckedAt = clock; setSeasonDay(globalThis.IslandTerrain.seasonDay(Date.now() + serverOffset)); }
    island.step(clock, Boolean(lessMotion?.matches)); refreshMapBoard(); refreshMinimap(performance.now());
    drops.forEach((d) => { const t = (ambientClock * 0.7 + d.userData.phase) % 1; const a = d.userData.phase * TAU; d.position.set(Math.cos(a) * t * 1.4, 2.3 + Math.sin(t * Math.PI) * 0.9 - t * 1.6, Math.sin(a) * t * 1.4); });
    lamps.forEach((l, i) => { l.material.emissiveIntensity = (night ? 1.7 : 0.55) + Math.sin(ambientClock * 1.5 + i) * 0.05; });
    if (clock - halloweenCheckedAt > 5) { halloweenCheckedAt = clock; setIsland(halloweenOverride ?? (decorMode === 'halloween' ? true : decorMode === 'auto' ? isHalloween(Date.now() + serverOffset) : false), Date.now() + serverOffset); } // (A5: the administrator's decorations)
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
    if (c.anim) { c.anim.update(dt, speed, { reduceIdle: Boolean(lessMotion?.matches) }); return; } // gait and explicit actions keep playing
    c.roll += (THREE.MathUtils.clamp(-turn * 0.25, -0.18, 0.18) - c.roll) * Math.min(1, dt * 10); // lean into a turn
    c.gait = (c.gait || 0) + (Math.min(1.7, Math.max(0, speed) / SPEED) - (c.gait || 0)) * Math.min(1, dt * 7);
    const walk = Math.min(1, c.gait); const run = Math.max(0, Math.min(1, (c.gait - 1.1) / 0.5));
    c.lean += ((0.14 * walk + 0.1 * run) - c.lean) * Math.min(1, dt * 8); // lean forward while walking, more running
    if (speed > 0.2) c.phase += dt * speed * 2.1; else c.phase *= Math.max(0, 1 - dt * 8); // the stride matches the ground
    const swing = Math.sin(c.phase) * (0.65 * walk + 0.25 * run);
    c.legL.rotation.x = swing; c.legR.rotation.x = -swing;
    const ambientClock = lessMotion?.matches ? 0 : clock;
    const idle = lessMotion?.matches ? 0 : (1 - walk) * Math.sin(clock * 2.2 + (c === me ? 0 : 1.7)) * 0.05;
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
    c.body.scale.y = 1 + (1 - walk) * Math.sin(ambientClock * 2.2) * 0.012;
    // the head turns toward a nearby facility (limited), and nods on interaction
    const wantHead = c.lookAt != null ? THREE.MathUtils.clamp(angleTo(c.root.rotation.y, c.lookAt), -0.7, 0.7) : 0;
    c.headYaw += (wantHead - c.headYaw) * Math.min(1, dt * 6);
    c.head.rotation.y = c.headYaw; c.head.rotation.x = -hopT * 0.25;
    if (c.cape) c.cape.rotation.x = 0.18 + c.lean * 2.2 + Math.sin(ambientClock * 7 + c.phase) * (lessMotion?.matches ? 0.06 * walk : 0.02 + 0.06 * walk);
    if (c.halo) c.halo.position.y = 0.8 + Math.sin(ambientClock * 2.4) * 0.04;
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
    tryOnClose(); stop(); observer.disconnect();
    document.removeEventListener('visibilitychange', resetFrameSample);
    for(const [key,o] of [...eventObjs]) removeEvent(key,o);
    returning.clear();
    occlusion.dispose(); assets.dispose();
    for (const o of others.values()) disposeCharacter(o.c); others.clear(); disposeWanderers();
    window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur);
    renderer.domElement.removeEventListener('click', onClick); renderer.domElement.removeEventListener('pointermove', onMove);
    renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('wheel', onWheel); renderer.domElement.removeEventListener('pointerup', onUp); renderer.domElement.removeEventListener('pointercancel', onUp);
    scene.traverse((o) => { if (o.isMesh) o.geometry.dispose(); if (o.isSprite) o.material.dispose(); });
    mats.forEach((m) => m.dispose()); vcMat.dispose(); textures.forEach((t) => t.dispose()); island.dispose(); decor.dispose(); yard.dispose(); train.dispose();
    renderer.dispose(); renderer.domElement.remove(); minimap.remove();
  }
  // 달마루섬 2단계 자동 검사 (docs/dalmaru-implementation-20261019.md 0. 원칙): what is drawn blocks and what blocks is drawn
  // (「보이는 것 = 막는 것」), nothing floats over or sinks into the ground, and every door, house and landmark can be
  // walked to from the first spot (1 m cells: walkable, clear of every circle by a body's half width, no step over 0.9 m)
  function mapCheck() {
    const T = globalThis.IslandTerrain; scene.updateMatrixWorld(true);
    const live = solids.filter(blocksNow); const box = new THREE.Box3(); const boxes = [];
    scene.traverseVisible((o) => {
      if (!o.isMesh || o.isInstancedMesh || (o.material?.transparent && o.material.depthWrite === false)) return; // (not the nature's batches, the walks' strips)
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); if (box.max.x - box.min.x > 60 || box.max.z - box.min.z > 60) return; boxes.push(box.clone());
    });
    const r1 = (v) => Math.round(v * 10) / 10; /* (묶음 1: drawn = standing 0.15 m over the ground -- a plaza channel's bank is 0.17) */
    const unseen = live.filter((s) => !s.nature && !s.batch && !s.hw && !boxes.some((b) => s.x > b.min.x - 0.3 && s.x < b.max.x + 0.3 && s.z > b.min.z - 0.3 && s.z < b.max.z + 0.3 && b.max.y > heightAt(s.x, s.z) + 0.15)).map((s) => [r1(s.x), r1(s.z), s.r]);
    const things = [...buildingRoots.filter((r) => !r.userData.occlusionAt /* (the yard: a group laid out in world coordinates, its own place the origin) */).map((r) => [r.userData.facility || 'house', r]), ...pieces.map((g) => [g.userData.piece, g])].filter(([, r]) => r.visible && r.parent);
    const unblocked = []; const floating = []; const sunk = [];
    for (const [name, root] of things) {
      box.setFromObject(root); if (box.isEmpty()) continue;
      const walked = root.userData.walked;
      if (!walked && !live.some((s) => s.x > box.min.x - s.r && s.x < box.max.x + s.r && s.z > box.min.z - s.r && s.z < box.max.z + s.r)) unblocked.push(name);
      if (walked || name.includes('stairs')) continue;
      const g = [[box.min.x, box.min.z], [box.max.x, box.min.z], [box.min.x, box.max.z], [box.max.x, box.max.z], [(box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2]].map(([x, z]) => T.meshGroundHeight(x, z));
      const y = root.position.y;
      if (y - Math.min(...g) > 1.2 && y - g[4] > 0.4) floating.push([name, r1(y - Math.min(...g))]);
      if (Math.max(...g) - y > 2.2 && SPOTS[root.userData.facility]?.kind !== 'facade' && !name.includes('niche')) sunk.push([name, r1(Math.max(...g) - y)]);
    }
    // walk the island from the first spot
    const R = Math.ceil(T.ISLAND_RADIUS); const W = R * 2 + 1; const seen = new Uint8Array(W * W); const hAt = new Float32Array(W * W);
    const ok = (x, z) => T.walkable(x, z) && !solidsNear(x, z).some((o) => !o.gate && blocksNow(o) && Math.hypot(o.x - x, o.z - z) < o.r + 0.3); // (the mayor's gate: opened by him, not the map)
    const idx = (i, j) => (j + R) * W + (i + R);
    const s0 = [Math.round(T.SPAWN.x), Math.round(T.SPAWN.z)]; const queue = [s0]; seen[idx(...s0)] = 1; hAt[idx(...s0)] = heightAt(...s0);
    for (let q = 0; q < queue.length; q += 1) {
      const [i, j] = queue[q]; const h = hAt[idx(i, j)];
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di; const b = j + dj; if (Math.abs(a) > R || Math.abs(b) > R) continue; const k = idx(a, b); if (seen[k]) continue;
        if (!ok(a, b)) { seen[k] = 2; continue; }
        const hb = heightAt(a, b); if (Math.abs(hb - h) > 0.9) continue; // (a cliff, not a step: maybe reached another way)
        seen[k] = 1; hAt[k] = hb; queue.push([a, b]);
      }
    }
    const reached = (x, z, near = 1.5) => { for (let i = Math.floor(x - near); i <= Math.ceil(x + near); i += 1) for (let j = Math.floor(z - near); j <= Math.ceil(z + near); j += 1) if (Math.abs(i) <= R && Math.abs(j) <= R && seen[idx(i, j)] === 1 && Math.hypot(i - x, j - z) <= near) return true; return false; };
    const targets = [...Object.entries(doors).filter(([id, d]) => !id.startsWith('room:') && Math.hypot(d.x, d.z) < T.ISLAND_RADIUS).map(([id, d]) => [id, d.x, d.z]), ...COTTAGES.map((c, k) => [`house${k}`, c.x + (c.face[0] - c.x) * 0.45, c.z + (c.face[1] - c.z) * 0.45])];
    if (T.STRUCTURES) {
      const S = T.STRUCTURES; const st = T.STAIRS;
      targets.push(['lighthouse', S.lighthouse.x + 5, S.lighthouse.z - 1], ['pierEnd', T.PIER.x + T.PIER.ux * 8, T.PIER.z + T.PIER.uz * 8], ['dock', T.DOCK.x, T.DOCK.z], ['isle', T.dalmaru.ISLE.x, T.dalmaru.ISLE.z], ['stairsTop', st.x + st.ux * 34 + st.nx * 1.7, st.z + st.uz * 34 + st.nz * 1.7], ['ridge', st.x + st.ux * 35 - st.nx * 8, st.z + st.uz * 35 - st.nz * 8]);
      for (const [id, st] of Object.entries(globalThis.IslandTrain?.STATIONS || {})) if (st.entry) targets.push([`station:${id}`, ...st.entry]);
      for (const k of ['MUSEUM', 'FARM', 'CONTEST_STATUE']) { const p = T[k]; targets.push([k, p.x + (k === 'MUSEUM' ? -Math.sin(p.yaw) * 6 : 0), p.z + (k === 'MUSEUM' ? -Math.cos(p.yaw) * 6 : k === 'FARM' ? -4 : 0)]); }
    }
    const unreachable = targets.filter(([, x, z]) => !reached(x, z)).map(([name, x, z]) => [name, r1(x), r1(z)]);
    return { solids: live.length, unseen, unblocked, floating, sunk, reachedCells: queue.length, unreachable };
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
    return { home: () => (homeHere ? { lot: homeHere.lot.id, stage: homeHere.home.stage || 2, room: homeRoomV?.layers.room?.key || null, pieces: homeRoomV ? [...homeRoomV.pieces.keys()] : [], fish: homeRoomV ? [...homeRoomV.pieces.values()].reduce((n, v) => n + v.swim.length, 0) : 0, pets: homeRoomV?.pets.length || 0, seats: SEATS.filter((s) => String(s.id).startsWith('home:')).length } : null), homes: () => Object.fromEntries([...homesShown].map(([k, v]) => [k, v.key])), draws, covered, grab: () => (grab ? { uid: grab.uid, axis: grab.axis, blocked: grab.blocked, clip: me.anim?.held || null } : null), grabCandidate: () => grabCandidate()?.uid || null, mapCheck, cycling, speedNow: () => paceSpeed(), faceYaw: (y) => { me.root.rotation.y = y; me.targetYaw = y; }, bikeWheels: () => (me.bike ? [me.bike.front, me.bike.rear].map((w) => { const q = w.getWorldPosition(new THREE.Vector3()); return +(q.y - BIKE.wheelR - heightAt(q.x, q.z)).toFixed(3); }) : null), bikes: () => bikes, othersBikes: () => Object.fromEntries([...others].map(([id, o]) => [id, o.bike || null])), petshop: () => (petshop ? [...petshop.pets.keys()] : null), furniture: () => (furniture ? Object.fromEntries(Object.entries(furniture.shown).map(([k, v]) => [k, v.key])) : null), carveStatues: (list, week) => { if (list) { statueKey = '[]'; statueList = []; setStatues(list, week); } return statueChars.map((c) => ({ stone: Boolean(c.stone), x: c.root.position.x, z: c.root.position.z })); }, blocksAt: (x, z) => solidsNear(x, z).filter(blocksNow).some((o) => Math.hypot(o.x - x, o.z - z) < o.r), hwAt: () => { const o = solids.find((s) => s.hw && !solids.some((t) => t !== s && !t.hw && Math.hypot(t.x - s.x, t.z - s.z) < t.r + s.r)); return o ? { x: o.x, z: o.z, decorOn } : null; }, contestPlinth: () => contestPlinth.visible, /* A-7 */ x: p.x, z: p.z, yaw: me.root.rotation.y, near, talkView: talkView ? { id: talkView.id, shot: talkView.shot } : null, running, quality, webgl, assets: assets.debug(), environment: { edgeDecor: island.edgeDecor, groundCover: island.groundCover(), water: island.waterMotion?.(), ambient: { bodyScale: me.body.scale.y, arms: [me.armL.rotation.x, me.armR.rotation.x], drops: drops.slice(0, 3).map(d => d.position.toArray()), lamps: lamps.slice(0, 3).map(l => l.material.emissiveIntensity) } }, setAvatar, holdQuality: (tier) => { qualityHeld = tier !== null; if (tier !== null) { quality = tier; assets.setQuality(tier); island.setQuality(tier); } resetFrameSample(); }, setSeasonDay: (d) => { seasonOverride = d; setSeasonDay(d ?? globalThis.IslandTerrain.seasonDay(Date.now() + serverOffset)); }, seasonDay: () => globalThis.IslandTerrain.seasonDay(Date.now() + serverOffset), gait: me.anim?.state ?? null, doors: Object.fromEntries(Object.entries(doors).filter(([id]) => !id.startsWith('room:'))) /* (the 민원실's doors are not on the island) */, screenOf, place: (id) => { const d = doorOf(id); if (d) { tryMove(d.x, d.z); placeCamera(true); } }, look: me.look || {}, title: me.title || null, champion: Boolean(me.champion), hoguking: Boolean(me.hoguking), statues: statueList.map(({ rank, name }) => ({ rank, name })), wardrobe: me.wardrobe || null, transformation: me.transformation || null, nativeRig: me.nativeRig || null, bodyUrl: me.bodyUrl || null, space: mySpace, farm: () => (farm ? { stage: farm.stage, names: farm.names } : null), plants: () => [...plants.values()].map(({ data, key }) => ({ id: data.id, stage: data.stage, key })), islandLook: () => ({ seasonHold, decorMode, winter: winterOn, fountain: fountain.visible }), insects: () => [...insectShown].map(([id, h]) => ({ id, species: h.b.species, x: h.c.root.position.x, z: h.c.root.position.z, flee: Boolean(h.flee), model: Boolean(h.c.mixer) })), insectList: () => insectList.map((b) => b.id), pets: () => [...pets].map(([key, p]) => ({ key, kind: p.kind, name: p.name, tag: Boolean(p.tag), clip: p.c.now, loaded: Boolean(p.c.mixer), x: +p.c.root.position.x.toFixed(2), z: +p.c.root.position.z.toFixed(2) })), guide: () => ({ arrow: Boolean(guide?.arrow.visible), target: guide?.target || null, door: eventDoors.guide || null }), together: () => ({ birthday: Boolean(together?.corner.visible), names: together?.names || [], mailbox: Boolean(eventDoors.mailbox) }), weather: () => ({ indoors, flakes: Object.values(assets.ambientCounts?.() || {}).reduce((a, b) => a + b, 0), kind: weatherKind, rain: Boolean(weatherFx?.rain.visible), snow: Boolean(weatherFx?.snow.visible), bow: Boolean(document.getElementById('plazaRainbow')?.classList.contains('on')) }), village: (view) => { if (view) setVillage(view); return village ? { mural: village.mural, busk: village.busk, lamps: village.lit, stones: village.stone, books: village.cart.visible } : null; }, pace: (paceRun ? "run" : pace), statueSizes: statueChars.map((c) => +c.root.scale.x.toFixed(2)), statueLook: () => ({ colors: statueChars.map((c) => { const a = c.stone?.geometry.attributes.color?.array; const seen = new Set(); if (a) for (let i = 0; i < a.length; i += 3) seen.add(`${Math.round(a[i] * 10)},${Math.round(a[i + 1] * 10)},${Math.round(a[i + 2] * 10)}`); return seen.size; }), plates: statuePlates.map((p) => ({ w: p.userData.w, text: p.userData.plaque, sprite: Boolean(p.isSprite) })) }), whale: () => whale(true), sea: { show: (kind) => seaSight(kind), inPicture, active: () => [...seaActive.keys()], shown: () => ({ ...seaShown }), at: () => (seaPool ? Object.fromEntries(Object.entries(seaPool).map(([k, hs]) => [k, hs.filter((h) => h.visible).map((h) => ({ x: +h.position.x.toFixed(1), y: +h.position.y.toFixed(1), z: +h.position.z.toFixed(1) }))])) : {}) }, carry: { mine: me.carryId || null, arms: Boolean(me.carrying), held: Boolean(me.carryStand?.parent || me.holding?.carry), on: me.holding?.carry?.object?.parent?.name || (me.carryStand?.parent ? 'stand' : null), others: [...others.values()].filter((o) => o.c.carryId).length }, gather: gather ? { kind: gather.kind, id: gather.id, t: gather.t, pending:gather.pending } : null, weeds: { count: weedById.size, near: weedKey, gathering: gather?.kind === 'weed' ? gather.id : null, at: (id) => { const w = weedById.get(id); return w ? { x: w.x, z: w.z } : null; } }, tag: Boolean(me.tag), wornColors: me.wornColors || null, farSight: () => [...others.entries()].map(([id, o]) => ({ id, tag: Boolean(o.c.tag?.visible && o.c.tag.material.fog === false), bubble: o.c.bubble ? o.c.bubble.visible : null, clear: (o.c.wearMats || []).every((r) => r.material.fog === false) && (o.c.wearMats || []).length > 0 })), resources: () => [...eventObjs].filter(([k,o])=>o.root.userData.fruit).map(([key,o])=>({key,fruit:o.root.userData.fruit.visible,x:o.root.position.x,z:o.root.position.z})), resourceRing:()=>({visible:weedRing.visible,x:weedRing.position.x,z:weedRing.position.z}), questScenes: () => questScenes ? { flower: questScenes.bloom.visible ? 'bloom' : 'empty', frame: questScenes.frame.visible, boat: questScenes.boat.visible, departing: questScenes.departure !== null } : null, quests: () => [...eventObjs].filter(([k]) => k.startsWith('ev:quest_npc:')).map(([k, o]) => ({ id: k.split(':')[2], mark: o.mark ?? null, worn: Boolean(o.npc?.assetRoot) })), fishBiteNow: (sec = 1.5) => { if (fishing && (fishing.phase === 'wait' || fishing.phase === 'cast' || fishing.phase === 'bite')) { fishing.biteAt = fishing.t; fishing.biteEnd = fishing.t + sec; } }, fishing: () => (fishing ? { phase: fishing.phase, rod: Boolean(me.holding?.rod?.object), held: Boolean(me.holding?.catch?.object), line: fishLine.visible, bobber: bobberHolder.visible, at: { x: bobberHolder.position.x, z: bobberHolder.position.z }, clip: me.anim?.clip || null } : null), canFish: () => globalThis.IslandTerrain.canFish(me.root.position.x, me.root.position.z), photo: () => ({ on: photoMode, hidden: photoHidden.size }), act: () => ({ ...myAct, tail: Boolean(me.tailTucked), sitting: Boolean(sitting), clip: me.anim?.clip || null, lift: +(me.root.position.y - heightAt(me.root.position.x, me.root.position.z)).toFixed(2) }), takenSeats: () => Object.fromEntries(takenSeats), seats: SEATS, othersActs: () => [...others].map(([id, o]) => ({ id, act: o.act, seat: o.seat, clip: o.c.anim?.clip || null, lift: +(o.c.root.position.y - heightAt(o.c.root.position.x, o.c.root.position.z)).toFixed(2) })), townhall: () => yard.debug(), sightBlock: () => { const to = me.root.position.clone(); to.y += 1; const d = to.clone().sub(camera.position); const far = d.length(); const rc = new THREE.Raycaster(camera.position.clone(), d.normalize(), 0, far); rc.camera = camera; return rc.intersectObjects(scene.children, true).filter((h) => h.object.visible && !h.object.isSprite).slice(0, 6).map((h) => { let o = h.object; const path = []; while (o && o !== scene) { path.push(o.userData.piece || o.userData.facility || o.name || o.type); o = o.parent; } return { at: +h.distance.toFixed(1), path: path.slice(0, 5).join("<"), faded: Boolean(h.object.material?.transparent) }; }); }, train: () => ({ ...train.debug(), shift: trainShift, platform, lifting: Boolean(liftRide), riding: riding ? { id: riding.id, seat: riding.seat } : null, y: +me.root.position.y.toFixed(2), othersRiding: [...others.values()].filter((o) => o.ride).length }), halloween: { decor: () => decor.debug(), launchBats: (at) => decor.launchBats(at), on: () => night, set: (v) => { halloweenOverride = v; halloweenCheckedAt = -Infinity; }, fountain: () => fountain.visible, candle: () => candle.intensity, glows: () => lanternGlows.length, glass: () => assets.debug().glass, background: () => scene.background.getHex() }, tagLayout: me.tag ? { headTop: me.headTop, bottom: me.tag.position.y, top: me.tag.position.y + me.tag.scale.y, rows: me.tag.userData.rows, bubbleBottom: me.bubble ? me.bubble.position.y - me.bubble.scale.y / 2 : null } : null,
      // (tests) by islander n and talking to them at once -- the server still checks I stand by them
      talkResident: (n) => { const o = wanderers.find((w) => w.n === n); if (!o) return false; const at = residentPose(n, Date.now() + serverOffset); const x = at.x + 1.1; const z = at.z; /* (by where the server has them -- a slow screen draws a walker behind) */ me.root.position.set(x, heightAt(x, z), z); correction = null; lastTalk = { id: `resident:${n}`, x: o.w.x, z: o.w.z }; onInteract?.(`resident:${n}`); return true; },
      tryOn: () => (tryOnView?.c ? { worn: tryOnView.c.wardrobe || null, model: Boolean(tryOnView.c.assetRoot) } : null), actLocked: actLocked(), emote: (k) => emote(k), standUpNow: () => standUp(), time: () => ({ mode: timeMode, phase }), setTime: (m) => setTimeMode(m), setWeather: (k) => setWeather(k), teleport: (x, z) => { me.root.position.set(x, heightAt(x, z), z); correction = null; placeCamera(true); bikeCheck(); },
      bubble: me.bubble?.userData.text || null, render: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }, camYaw, minimap: { turn: minimapTurn, markers: minimapShown }, events: Object.fromEntries(Object.entries(eventDoors).map(([k, d]) => [k, { ...d }])), events: [...eventObjs.keys()], lastReturn, residentReservations:residentStates.map(s=>({...s,hold:s.hold?{...s.hold}:null})), eventResidents:[...eventObjs].filter(([,o])=>o.resident!=null).map(([key,o])=>({key,n:o.resident,x:o.npc.root.position.x,z:o.npc.root.position.z,leaving:Boolean(o.leaving),reused:wanderers.some(w=>w.c===o.npc)})), placeWanderer:(n,x,z)=>{const o=wanderers.find(o=>o.n===n); if(o) Object.assign(o.w,{x,z,route:null,routeTo:null});}, wanderers: wanderers.map(({ n, c, w }) => ({ n,held:Boolean(w.pose.held), x: w.x, y: c.root.position.y, z: w.z, visible: c.root.visible, speed: w.speed, grounded: Math.abs(c.root.position.y - heightAt(w.x, w.z)) < 1e-4, walkable: walkable(w.x, w.z), clear: walkers.clear(w.x, w.z), bx: w.bx, bz: w.bz, baseClear: walkers.clear(w.bx, w.bz) && walkable(w.bx, w.bz), off: Math.hypot(w.x - w.bx, w.z - w.bz), resyncs: walkers.resyncs() })), wandererR: IslandNpcs?.WALKER.R, wandererSep: IslandNpcs?.WALKER.SEP, serverNow: () => Date.now() + serverOffset, markers: mapMarkers.map((m) => ({ ...m })), walkable, heightAt, bridges: island.bridges, pier: island.pier, spawn: SPAWN, overview: (on) => { overview = Boolean(on); placeCamera(true); }, setCamYaw: (y) => { camYaw = y; yawGoal = y; placeCamera(true); }, camPitch, pitchGoal, pitchMax: PITCH_MAX, skyMax: SKY_MAX, camDist, zoom: zoomDist, zoomRange: [ZOOM_MIN, ZOOM_MAX], setCamPitch: (v) => { camPitch = clampPitch(v); pitchGoal = camPitch; placeCamera(true); },
      camera: { x: camera.position.x, y: camera.position.y, z: camera.position.z, clear: camera.position.y - heightAt(camera.position.x, camera.position.z),faded: occlusion.debug().faded, occlusion: occlusion.debug(), inBuilding: buildingSolids.some((s) => Math.hypot(camera.position.x - s.x, camera.position.z - s.z) < s.r), rise: heightAt(camera.position.x, camera.position.z) - me.root.position.y }, radiusAt: playerRadiusAt, others: [...others].map(([id, o]) => ({ id, x: o.c.root.position.x, z: o.c.root.position.z, tag: Boolean(o.c.tag), champion: Boolean(o.champion), hoguking: Boolean(o.hoguking), bubble: o.c.bubble?.userData.text || null, look: o.look || {} })) };
  }
  // The island map in a window (안내 지도): drawn into the caller's canvas with where I stand now.
  const drawMap = (canvas) => island.drawMap(canvas.getContext('2d'), canvas.width, canvas.height, { x: me.root.position.x, z: me.root.position.z });
  // v1.10.2: a chat message over someone's head ('me' or another player's id)
  const speak = (id, text) => say(id === 'me' ? me : others.get(id)?.c, text);
  const setStatuesPublic = (list, week) => setStatues(list, week);
  const setEventsPublic = (list) => setEvents(list);
  // v1.10.31: an event's motion when the server took it (pick up, give back, a photo), the weed in hand
  const playMine = (name) => { const played = Boolean(me.anim?.play(name)); lockForClip(played); return played; };
  const holdWeed = () => assets.hold(me, 'prop.weedRooted', 900);
  const holdBasket = () => assets.hold(me, 'prop.event.basket', 1400); // v1.10.32: picking herbs, berries, mushrooms
  const setMapMarkers = (list) => { mapMarkers = Array.isArray(list) ? list.filter((m) => Number.isFinite(m?.x) && Number.isFinite(m?.z)) : []; minimapAt = 0; };
  const setTownhallPass = (on) => yard.setPass(on); const mayorLine = () => yard.line(); // v1.10.41
  const fishingNow = () => (fishing ? fishing.phase : null); // v1.10.42
  // v1.10.44 앉기·이모트 (IDEAS ④): a seat on a plaza bench (the server keeps who sits), a wave or a cheer -- each sent with
  // my pose (act, a count telling a new wave from the last), played on everyone's screen with the same clips
  const SEATS = [...globalThis.IslandTerrain.plazaProps().seats]; // (묶음 4: a house's seats join while I am in it)
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
    if (sitting) standUp(); if (gather) endGather(false); if (fishing) fishStop?.(); actLock = 0;
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
    if (sitting) standUp(); if (gather) endGather(false); if (fishing) fishStop(); actLock = 0;
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
  // A-7: seated at a window, the talk camera on its clerk (as with an islander)
  function counterCamera(doorId) { const s = SEATS.find((x) => x.door === doorId); if (!s) return false; lastTalk = { id: doorId, x: s.x, z: s.z - 3.25 }; return talkCamera('talk'); }
  function sit(seatId) {
    const s = SEATS.find((x) => x.id === seatId); if (!s || gather || fishing) return false;
    if (!startGather({ kind: 'sit', ms: Infinity, anim: 'sitDown', onDone: () => standUp(false) })) return false;
    sitting = { seat: s, t: 0, from: { x: me.root.position.x, z: me.root.position.z } };
    me.root.position.set(s.x, (s.y ?? heightAt(s.x, s.z)) + SEAT_LIFT, s.z); me.root.rotation.y = s.yaw; me.targetYaw = s.yaw;
    me.anim?.loop?.('sitIdle'); me.tailTucked = true; me.tuckTail?.(true); myAct.act = 'sit'; myAct.seat = s.id;
    return true;
  }
  function standUp(release = true) {
    if (!sitting) return; const s = sitting.seat; const sitting0 = sitting; sitting = null;
    myAct.act = null; myAct.seat = null; me.tailTucked = false; me.tuckTail?.(false); me.anim?.release?.();
    const reversed = Boolean(me.anim?.play('sitDown', { reverse: true })); lockForClip(reversed || me.anim?.play('standUp')); // (문제 기록 6: sitting down, backwards)
    // off the seat to where I came from (the side I sat down from; a step forward if that was far) -- A-7: indoors on the
    // room's floor and kept inside it (the island's ground under the 민원실, out at sea, sank me into the floor)
    const back = sitting0?.from && Math.hypot(sitting0.from.x - s.x, sitting0.from.z - s.z) < 2.2 ? sitting0.from : null;
    const step = s.counter ? -1.0 : 1.0; let x = back ? back.x : s.x + Math.sin(s.yaw) * step; let z = back ? back.z : s.z + Math.cos(s.yaw) * step; let y; // (a window's chair: back, away from the desk)
    if (mySpace === 'townhall') { const q = globalThis.IslandTerrain.roomClamp(x, z); x = q.x; z = q.z; y = ROOM.y; }
    else if (mySpace === 'store') { const q = STORE.clamp(x, z); x = q.x; z = q.z; y = STORE.ROOM.y; }
    else if (mySpace === 'furniture') { const q = FURN.clamp(x, z); x = q.x; z = q.z; y = FURN.ROOM.y; }
    else if (mySpace === 'petshop') { const q = PETS.clamp(x, z); x = q.x; z = q.z; y = PETS.ROOM.y; }
    else if (mySpace === 'home') { const q = homeRoom.clamp(x, z); x = q.x; z = q.z; y = HOME.ROOM.y; }
    else y = heightAt(x, z);
    rising = { from: me.root.position.clone(), to: new THREE.Vector3(x, y, z), at: performance.now() + Math.max(0, (me.anim?.onceLeft?.() || 0.6) * 1000 - 350), space: mySpace }; // (glides off as the clip ends)
    if (release && gather?.kind === 'sit') { gather.onDone = () => {}; endGather(false); }
    onInteract?.('seat:stand');
  }
  function emote(kind) { if (gather || fishing || me.carrying || actLocked() || !['wave', 'cheer', 'nod', 'clap', 'bow'].includes(kind)) return false; const played = me.anim?.play(kind); if (!played) me.hop = 1; lockForClip(played); myAct.act = kind; const n = ++myAct.n; setTimeout(() => { if (myAct.n === n && myAct.act === kind) myAct.act = null; }, kind === 'clap' ? 1800 : 1500); return true; }
  // v1.10.43 기념사진 모드 (IDEAS ③): I stay put (the camera turns, up to the sky), every name tag and bubble hidden; the
  // shot is the canvas alone (no page UI), drawn and read in the same task, saved as a PNG on the PC (nothing uploaded)
  let photoMode = false; const photoHidden = new Set();
  function setPhotoMode(on) {
    if (on === photoMode) return true;
    // v1.10.81 즉시 촬영: the photo mode is its own state now (it took the gathering lock before) -- it can open in the
    // middle of a pull, a cast or a seat and leaves them running; it only holds me still and takes no SPACE
    if (on) { photoMode = true; return true; }
    photoMode = false; for (const o of photoHidden) o.visible = true; photoHidden.clear();
    onPhotoEnd?.();
    return true;
  }
  let onPhotoEnd = null;
  const hideForPhoto = () => scene.traverse((o) => { if (o.isSprite && o.visible) { o.visible = false; photoHidden.add(o); } });
  const actionBusy = () => Boolean(gather || fishing || sitting || riding || liftRide); // v1.10.81: 포즈 촬영 waits for these
  const photoPose = (on = true) => { if (!on) return me.anim?.release?.(); me.targetYaw = Math.atan2(camera.position.x - me.root.position.x, camera.position.z - me.root.position.z); return me.anim?.loop?.('photo'); }; // turned to the camera, held through the countdown and the shot
  function snapshot() { // (관리자 「문제 기록」)
    renderer.render(scene, camera); const src = renderer.domElement; const w = 480; const h = Math.round((w * src.height) / Math.max(1, src.width));
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(src, 0, 0, w, h);
    for (const q of [0.7, 0.5, 0.35, 0.2]) { const url = c.toDataURL('image/jpeg', q); if (url.length <= 60000) return Promise.resolve(url); }
    return Promise.resolve(null);
  }
  function capture() { if (!photoMode) return Promise.resolve(null); hideForPhoto(); renderer.render(scene, camera); return new Promise((resolve) => renderer.domElement.toBlob(resolve, 'image/png')); }
  // v1.10.91 주민 심부름: a yellow star over an islander with an ask for me, a check over one I bring news or a thing to
  let residentMarks = {};
  function setResidentMarks(marks = {}) {
    residentMarks = { ...marks };
    for (const { n, c } of wanderers) {
      const want = marks[n] || null;
      if (c.tag && !c.tag.userData.errand) continue; // (an event's own mark on a held islander comes first)
      if ((c.errandMark || null) === want && (!want || c.tag)) continue;
      if (c.tag?.userData.errand) { disposeTag(c.tag); c.tag = null; }
      c.errandMark = want;
      if (want) { c.tag = want === 'ready' ? makeCheckMark() : makeStarMark(); c.tag.userData.errand = true; c.root.add(c.tag); fitTag(c); }
    }
  }
  return { setInsects, insectsGone, insectSwing, onInsectScare: (fn) => { onInsectScare = fn; }, setHomes, setHome, homeGhost, setBikes, toggleBike: (color) => { const r = toggleBike(color); onBike?.(r === 'on', r === 'on' || r === 'off' ? null : r); return r; }, onBike: (fn) => { onBike = fn; }, cycling: () => cycling, setSpace, space: () => mySpace, setGoodsPrices, setFurniture, setPetshop, furniture: () => (furniture ? Object.fromEntries(Object.entries(furniture.shown).map(([k, v]) => [k, v.key])) : null), useShow, shows: () => shows.map((s) => s.kind), setFarm, setResidentMarks, residentMarks: () => ({ ...residentMarks }), setStick: (x, y) => { stick = x || y ? { x, y } : null; }, paceDown, paceUp, pace: () => (paceRun ? 'run' : pace),
    // v1.10.84 조작 배치: the phone's own 걷기 (a tap switches the two walks) and 뛰기 (runs while held) buttons
    paceTap: () => { pace = pace === 'walk' ? 'slow' : 'walk'; return pace; }, setRun: (on) => { paceRun = Boolean(on); }, walkPace: () => pace, act: () => { if (grab) { endGrab(); return; } if (!isBlocked() && near) interact(near); }, actDown, actUp, grabTurn: () => turnGrab(), grabEnd: () => endGrab(), onHomeMove: (fn) => { onHomeMove = fn; }, onGrab: (fn) => { onGrab = fn; }, /* 2회차 11 */ // v1.10.62 모바일: the stick, and the hint tapped (= Space)
    canInteract, holdQuestDeparture, talkCamera, counterCamera, trainDocked: (station) => R.docked(trainNow(), station), trainChangedAt: () => trainChangedAt, setPlatform, platform: () => platform, board, alight, riding: () => (riding ? { ...riding } : null), setTrainService: (snapshot) => R.setService(snapshot), setTrainShift: (ms) => { trainShift = Number(ms) || 0; }, sit, standUp, emote, setTimeMode, setWeather, setIslandLook, setPlants, nearestPlant, tryOn, tryOnClose, tryOnPose, tryOnShot, tryOnShown: () => (tryOnView?.c ? { worn: tryOnView.c.wardrobe || null, model: Boolean(tryOnView.c.assetRoot) } : null), setPhotoMode: (on, onEnd = null) => { if (on) onPhotoEnd = onEnd; return setPhotoMode(on); }, photoPose, actionBusy, capture, fishBegin, fishResult, fishStop, fishingNow, setTownhallPass, mayorLine, start, stop, dispose, debug, interact, setAvatar, setOthers, pose, correctTo, drawMap, speak, setMapMarkers, setStatues: setStatuesPublic, setBirthdays, birthdayCheer, setGuideTarget, setMyPet, snapshot, setEvents: setEventsPublic, setResidents, setServerTime, setWeeds, removeWeeds, gatherWeed, gatherResource, finishGather, holdWeed, holdBasket, returnLost, playMine,
    lostName: (id) => (lostProp(id) === 'prop.event.lost_pouch' ? '작은 주머니' : '곰 인형') }; // v1.10.34: what the owner lost (its look)
}
