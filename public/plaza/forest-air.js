import * as THREE from '/vendor/three/three.module.js';

// 1.10.371 N1b §3 숲의 빛·공기 (notes byeolmaru-forest-n1b-20261118.md 「3 빛·공기」: 숲 안은 조금 어둡고 초록빛, 안개 가깝게, 잎 사이 햇살
// 줄기, 가끔 떨어지는 잎, 밤 반딧불이; 소리 새소리·잎 스치는 바람·개울). How deep in the wood I am (`wood` 0..1: 별마루섬's 숲속 and
// 오솔길 round me, island.isle2Wood) eases in over a second and a half; with it:
//  - the light: plaza-scene tints its sky light, sun and fog by `tint()` (green, a little darker, the fog nearer -- `fogFar`/`fogNear`)
//  - 햇살 줄기: a few soft crossed planes of light (one batch), standing where the world's 12 m squares say -- still as I walk --
//    leaning with the sun, by day only
//  - 떨어지는 잎: a handful of leaves drifting down round me (one batch), the season's colours, none in the winter or 움직임 줄이기
//  - 반딧불이: at night small lights wandering a metre or two over the ground round me, each blinking on its own (one batch)
//  - 소리: wind in the leaves and the creek near it (filtered noise), birds by day and crickets at night (short chirps) -- quiet,
//    only with the game's sound on (RoomSound), only while the page is seen
// At most three draws, none outside the wood. `info()` for the tests and photos.
const RING = 40; // (m round me the shafts are looked for)
const CELL = 12;
const hash = (x, z, k) => { const v = Math.sin(x * 127.1 + z * 311.7 + k * 74.7) * 43758.5453; return v - Math.floor(v); };
const softDot = (inner = 0.4) => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(inner, 'rgba(255,255,255,0.8)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); };
const LEAF_COLORS = { spring: [0x9fd36a, 0xb8e07a, 0xf3c2d6], summer: [0x6fae4f, 0x86c062, 0x5f9a46], autumn: [0xe39a3c, 0xd0632f, 0xe8c25a], winter: [] };

export function createForestAir({ scene, T, groundAt }) {
  let wood = 0; let want = 0; let lastNow = 0; const state = { shafts: 0, leaves: 0, fireflies: 0, sound: 'off' };
  // ---- 햇살 줄기: two crossed planes a shaft, bright at the top, gone at the bottom and the sides
  const shaftTex = (() => { const c = document.createElement('canvas'); c.width = 32; c.height = 128; const g = c.getContext('2d'); const v = g.createLinearGradient(0, 0, 0, 128); v.addColorStop(0, 'rgba(255,255,255,0.0)'); v.addColorStop(0.12, 'rgba(255,255,255,0.9)'); v.addColorStop(0.55, 'rgba(255,255,255,0.45)'); v.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = v; g.fillRect(0, 0, 32, 128); g.globalCompositeOperation = 'destination-in'; const h = g.createLinearGradient(0, 0, 32, 0); h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.5, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = h; g.fillRect(0, 0, 32, 128); return new THREE.CanvasTexture(c); })();
  const shaftGeo = (() => { const a = new THREE.PlaneGeometry(1, 1); a.translate(0, -0.5, 0); const b = a.clone(); b.rotateY(Math.PI / 2); const pos = [...a.attributes.position.array, ...b.attributes.position.array]; const uv = [...a.attributes.uv.array, ...b.attributes.uv.array]; const idx = [...a.index.array, ...b.index.array.map((i) => i + 4)]; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g; })();
  const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTex, color: 0xfff1c4, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true });
  const SHAFTS = 10; const shafts = new THREE.InstancedMesh(shaftGeo, shaftMat, SHAFTS); shafts.frustumCulled = false; shafts.visible = false; shafts.count = 0; shafts.renderOrder = 3; shafts.userData.keepFar = true; scene.add(shafts);
  const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const v3 = new THREE.Vector3(); const sc = new THREE.Vector3(); const up = new THREE.Vector3(0, -1, 0);
  let shaftAt = null;
  function placeShafts(me, sunDir) {
    const list = []; const cx = Math.floor(me.x / CELL); const cz = Math.floor(me.z / CELL); const R = Math.ceil(RING / CELL);
    for (let i = cx - R; i <= cx + R; i += 1) for (let j = cz - R; j <= cz + R; j += 1) {
      if (hash(i, j, 1) > 0.2) continue; const x = (i + 0.2 + hash(i, j, 2) * 0.6) * CELL; const z = (j + 0.2 + hash(i, j, 3) * 0.6) * CELL; const d = Math.hypot(x - me.x, z - me.z);
      if (d < 5 || d > RING || !['deep', 'trail'].includes(T.isle2Zone?.(x, z))) continue; list.push({ x, z, d, k: hash(i, j, 4) });
    }
    list.sort((a, b) => a.d - b.d); const take = list.slice(0, SHAFTS);
    const lean = new THREE.Vector3(-sunDir.x, -Math.max(0.6, sunDir.y), -sunDir.z).normalize(); q.setFromUnitVectors(up, lean);
    take.forEach((s, i) => { const top = groundAt(s.x, s.z) + 15 + s.k * 4; m4.compose(v3.set(s.x, top, s.z), q, sc.set(1.4 + s.k * 1.8, 15 + s.k * 6, 1.4 + s.k * 1.8)); shafts.setMatrixAt(i, m4); });
    shafts.count = take.length; shafts.instanceMatrix.needsUpdate = true; state.shafts = take.length;
  }
  // ---- 떨어지는 잎 and 반딧불이: points in a box round me, moved by the frame
  const pointsOf = (n, size, blend) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); const p = new THREE.Points(g, new THREE.PointsMaterial({ size, map: softDot(blend ? 0.25 : 0.6), vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: blend ? THREE.AdditiveBlending : THREE.NormalBlending, fog: !blend })); p.frustumCulled = false; p.visible = false; p.userData.keepFar = true; scene.add(p); return p; };
  const LEAVES = 64; const leaves = pointsOf(LEAVES, 0.24, false); const leafSeed = Array.from({ length: LEAVES }, (_, i) => ({ x: (hash(i, 1, 5) - 0.5) * 30, y: hash(i, 2, 5) * 14, z: (hash(i, 3, 5) - 0.5) * 30, s: 0.4 + hash(i, 4, 5) * 0.5, p: hash(i, 5, 5) * 6.28 }));
  const FLIES = 40; const flies = pointsOf(FLIES, 0.45, true); const flySeed = Array.from({ length: FLIES }, (_, i) => ({ x: (hash(i, 1, 9) - 0.5) * 36, z: (hash(i, 3, 9) - 0.5) * 36, h: 0.5 + hash(i, 2, 9) * 2, p: hash(i, 4, 9) * 6.28, r: 0.6 + hash(i, 5, 9) * 1.4 }));
  let leafSeason = null;
  function colourLeaves(season) { if (season === leafSeason) return; leafSeason = season; const set = LEAF_COLORS[season] || LEAF_COLORS.summer; const c = new THREE.Color(); const a = leaves.geometry.attributes.color.array; for (let i = 0; i < LEAVES; i += 1) { c.set(set[i % Math.max(1, set.length)] ?? 0x6fae4f); a.set([c.r, c.g, c.b], i * 3); } leaves.geometry.attributes.color.needsUpdate = true; }
  // ---- 소리
  let audio = null; let soundOn = false; let nextChirp = 0;
  function noise(a, secs) { const len = Math.floor(a.sampleRate * secs); const b = a.createBuffer(1, len, a.sampleRate); const d = b.getChannelData(0); let last = 0; for (let i = 0; i < len; i += 1) { last = last * 0.92 + (Math.random() * 2 - 1) * 0.08; d[i] = last * 6; } return b; }
  function makeAudio() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; const a = new AC(); const master = a.createGain(); master.gain.value = 0; master.connect(a.destination);
    const loop = (lo, hi) => { const s = a.createBufferSource(); s.buffer = noise(a, 4); s.loop = true; const f1 = a.createBiquadFilter(); f1.type = 'highpass'; f1.frequency.value = lo; const f2 = a.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = hi; const g = a.createGain(); g.gain.value = 0; s.connect(f1); f1.connect(f2); f2.connect(g); g.connect(master); s.start(); return g; };
    const wind = loop(250, 1400); const creek = loop(500, 3200);
    const resume = () => { if (a.state !== 'running') a.resume().catch(() => {}); }; for (const t of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(t, resume, { capture: true, passive: true });
    return { a, master, wind, creek };
  }
  function chirp(night) {
    const { a, master } = audio; const t = a.currentTime + 0.02; const n = night ? 3 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 3); const base = night ? 4300 + Math.random() * 400 : 2600 + Math.random() * 2200;
    for (let i = 0; i < n; i += 1) { const o = a.createOscillator(); const g = a.createGain(); const at = t + i * (night ? 0.07 : 0.11 + Math.random() * 0.06); o.type = 'sine'; o.frequency.setValueAtTime(base * (night ? 1 : 0.9), at); if (!night) o.frequency.exponentialRampToValueAtTime(base * (1.15 + Math.random() * 0.3), at + 0.08); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(night ? 0.05 : 0.08, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, at + (night ? 0.05 : 0.1)); o.connect(g); g.connect(master); o.start(at); o.stop(at + 0.15); }
  }
  function stepSound(on, w, near, night, now) {
    const want = on && w > 0.05 && !document.hidden && window.RoomSound?.isOn?.() !== false;
    if (!want && !audio) { state.sound = 'off'; return; }
    if (want && !audio) { audio = makeAudio(); if (!audio) { state.sound = 'none'; return; } }
    const { a, master, wind, creek } = audio; const t = a.currentTime;
    master.gain.setTargetAtTime(want ? 0.22 * w : 0, t, 0.6); wind.gain.setTargetAtTime(0.35 + 0.25 * Math.sin(now / 3100), t, 0.8); creek.gain.setTargetAtTime(0.55 * near, t, 0.6);
    if (want && a.state === 'running' && now > nextChirp) { chirp(night); nextChirp = now + (night ? 1500 + Math.random() * 2500 : 2500 + Math.random() * 5000); }
    soundOn = want; state.sound = want ? a.state : 'off';
  }
  // ---- the frame
  function step(dt, { me, sunDir, phase, quality = 2, lessMotion = false, outdoors = true, season = 'summer', now = performance.now(), woodNow = 0, sound = true }) {
    /* (eased by the wall clock -- a slow device's frames, their time clamped, would leave it behind) */
    const real = lastNow ? Math.min(1, Math.max(0, (now - lastNow) / 1000)) : dt; lastNow = now;
    want = outdoors ? woodNow : 0; wood += (want - wood) * Math.min(1, real / 1.5); if (Math.abs(want - wood) < 0.002) wood = want;
    const day = { morning: 0.9, day: 1, evening: 0.6, night: 0 }[phase] ?? 1; const night = phase === 'night';
    // 햇살 줄기
    const showShafts = wood > 0.02 && day > 0;
    if (showShafts && (!shaftAt || Math.hypot(me.x - shaftAt.x, me.z - shaftAt.z) > 4 || shaftAt.phase !== phase)) { placeShafts(me, sunDir); shaftAt = { x: me.x, z: me.z, phase }; }
    shafts.visible = showShafts && shafts.count > 0; shaftMat.opacity = 0.34 * wood * day * (0.85 + 0.15 * Math.sin(now / 2300)); shaftMat.color.set(phase === 'evening' ? 0xffc48a : 0xfff1c4); if (!showShafts) state.shafts = 0;
    // 떨어지는 잎
    const nLeaves = lessMotion || season === 'winter' || wood < 0.02 ? 0 : [24, 40, LEAVES][quality] ?? LEAVES; state.leaves = nLeaves; leaves.visible = nLeaves > 0;
    if (nLeaves) { colourLeaves(season); leaves.material.opacity = 0.9 * wood; leaves.geometry.setDrawRange(0, nLeaves); const a = leaves.geometry.attributes.position.array; const t = now / 1000;
      for (let i = 0; i < nLeaves; i += 1) { const s = leafSeed[i]; s.y -= s.s * dt; if (s.y < -1) { s.y = 13; s.x = (Math.random() - 0.5) * 30; s.z = (Math.random() - 0.5) * 30; } a[i * 3] = me.x + s.x + Math.sin(t * 0.9 + s.p) * 0.8; a[i * 3 + 1] = me.y + s.y; a[i * 3 + 2] = me.z + s.z + Math.cos(t * 0.7 + s.p) * 0.6; }
      leaves.geometry.attributes.position.needsUpdate = true; }
    // 반딧불이
    const nFlies = night && wood > 0.02 ? [16, 28, FLIES][quality] ?? FLIES : 0; state.fireflies = nFlies; flies.visible = nFlies > 0;
    if (nFlies) { flies.material.opacity = wood; flies.geometry.setDrawRange(0, nFlies); const a = flies.geometry.attributes.position.array; const c = flies.geometry.attributes.color.array; const t = now / 1000;
      for (let i = 0; i < nFlies; i += 1) { const f = flySeed[i]; const x = me.x + f.x + Math.sin(t * 0.3 + f.p) * f.r * (lessMotion ? 0.2 : 1); const z = me.z + f.z + Math.cos(t * 0.27 + f.p * 1.3) * f.r * (lessMotion ? 0.2 : 1); a[i * 3] = x; a[i * 3 + 1] = groundAt(x, z) + f.h + Math.sin(t * 0.8 + f.p) * 0.3; a[i * 3 + 2] = z; const on = Math.max(0, Math.sin(t * (1.1 + f.r * 0.4) + f.p * 3)) ** 3; c[i * 3] = 0.85 * on; c[i * 3 + 1] = 1 * on; c[i * 3 + 2] = 0.45 * on; }
      flies.geometry.attributes.position.needsUpdate = true; flies.geometry.attributes.color.needsUpdate = true; }
    const creekNear = Math.max(0, 1 - Math.max(0, (T.dalmaru?.creekDist?.(me.x, me.z) ?? 99) - 3) / 25);
    stepSound(sound && outdoors, wood, creekNear, night, now);
    return wood;
  }
  // the light's share: plaza-scene lerps its own colours by these (the sky light toward green, a little darker, the fog nearer)
  const tint = () => ({ wood, sky: 0x9ccf86, skyK: 0.3 * wood, hemiK: 1 - 0.2 * wood, sunK: 1 - 0.35 * wood, fogK: 0.6 * wood, fogFar: 175 - 85 * wood, fogNear: 70 - 52 * wood });
  const FOREST_FOG = { morning: 0xa9c4a0, day: 0x9fc29a, evening: 0x8a8f6a, night: 0x0f1d17 };
  return { step, tint, FOREST_FOG, info: () => ({ wood: Math.round(wood * 1000) / 1000, ...state }), stop: () => { try { audio?.a.close(); } catch {} audio = null; } };
}
