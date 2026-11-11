// v1.10.275 그래픽 시범 (gamecenter-notes docs/graphics-pilot-20261107.md): the one grass patch (island-pilot.js) drawn
// richer -- assets 106's plants (Nature Megapack Extended, RG Poly, CC0) placed as the island's nature is (assets.batch: a
// model per season, instanced), thick blades of grass made here, all swaying in the wind (the models' second UV: 0 at the
// stem, 1 at a leaf's tip) and tone-mapped in their own shaders (the rest of the island is drawn as before). No blade nor
// grass model round a weed, an insect or a thing on the ground (cuts). Only on the island, and not in tests unless asked.
import * as THREE from '/vendor/three/three.module.js';

const T = globalThis.IslandTerrain; const P = globalThis.IslandPilot;
const CUTS = 24;
// the ground's colour in each season (island.js SEASON_GROUND: its grass toward this by that share) -- a blade's root is
// the ground's own colour, lighter toward the tip, so it grows out of the ground and does not float on it
const GRASS = 0x9fd67f; const GROUND = { spring: [0xc0e0a4, 0.55], summer: [0xacd497, 0.35], autumn: [0xe9d7a8, 0.6], winter: [0xeff4fa, 0.8] };

export function pilotScene({ scene, assets, phone = false, groundMaps = null }) {
  const group = new THREE.Group(); group.name = 'pilot'; scene.add(group);
  const made = [];
  const U = { uPilotTime: { value: 0 }, uPilotTone: { value: 1 }, uPilotOut: { value: 1 }, uPilotExposure: { value: 0.7 }, uPilotCuts: { value: Array.from({ length: CUTS }, () => new THREE.Vector4()) }, uPilotCutN: { value: 0 } };
  // a material of the patch: its own wind (if its geometry has the second UV), cuts (grass and flowers) and tone
  // `unit`: metres to the geometry's own units (a quantized model's positions are integers, its part matrix the scale)
  // (v1.10.290 6 `grow`: { uGrowLo, uGrowS } of a blade cell's own material -- instances from uGrowLo on at uGrowS height, growStep)
  function patch(m, { wind, cut, unit = 1, grow = null }) {
    if (m.userData.pilot) return; m.userData.pilot = true;
    const before = m.onBeforeCompile; const own = { uPilotUnit: { value: unit }, ...grow };
    m.onBeforeCompile = (sh, r) => {
      before?.call(m, sh, r); Object.assign(sh.uniforms, U, own);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nuniform float uPilotTime; uniform float uPilotUnit; uniform vec4 uPilotCuts[${CUTS}]; uniform int uPilotCutN;\n${wind ? '#ifndef USE_UV1\nattribute vec2 uv1;\n#endif' : ''}${grow ? '\nuniform float uGrowLo; uniform float uGrowS;' : ''}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
${grow ? '#ifdef USE_INSTANCING\n  if (float(gl_InstanceID) >= uGrowLo) transformed.y *= uGrowS;\n#endif' : ''}
#ifdef USE_INSTANCING
  vec3 pilotAt = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#else
  vec3 pilotAt = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#endif
${cut ? `  float pilotCut = 1.0;
  for (int i = 0; i < ${CUTS}; i++) { if (i >= uPilotCutN) break; pilotCut = min(pilotCut, smoothstep(uPilotCuts[i].z * 0.55, uPilotCuts[i].z, distance(pilotAt.xz, uPilotCuts[i].xy))); }
  transformed *= pilotCut;` : ''}
${wind ? `  float pilotSway = uv1.x * (0.75 + 0.25 * sin(uPilotTime * 0.37 + pilotAt.x * 0.05));
  transformed.x += sin(uPilotTime * 1.9 + pilotAt.x * 0.37 + pilotAt.z * 0.21 + uv1.x * 0.8) * 0.07 * uPilotUnit * pilotSway;
  transformed.z += cos(uPilotTime * 1.4 + pilotAt.z * 0.31 + pilotAt.x * 0.13) * 0.045 * uPilotUnit * pilotSway;` : ''}`);
      /* the tone: the ACES curve on the brightness only (each channel's own made dark greys navy at night -- 총괄 #425), and
         none in the dark (its toe would make the night darker than the island round it) */
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uPilotTone; uniform float uPilotOut; uniform float uPilotExposure;
vec3 pilotTone(vec3 c) { float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); float x = l * uPilotExposure; float t = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); return mix(c, c * (t / max(l, 1e-4)), smoothstep(0.04, 0.2, l)); }`)
        .replace('#include <tonemapping_fragment>', '#include <tonemapping_fragment>\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, pilotTone(gl_FragColor.rgb), uPilotTone * uPilotOut);');
    };
    const key = m.customProgramCacheKey?.bind(m);
    m.customProgramCacheKey = () => `${key ? key() : ''}:pilot2${wind ? 'w' : ''}${cut ? 'c' : ''}${grow ? 'g' : ''}`; m.needsUpdate = true;
  }
  // (v1.10.310 잡초 편입: the patch's own plants and trees are gone -- the island's nature and weeds stand there as everywhere)
  const q = new THREE.Quaternion(); const up = new THREE.Vector3(0, 1, 0);
  // the blades: one thin bent leaf ending in a point (총괄 #425: half as wide), many times; the season's ground colour on the
  // material, the vertex colours how much lighter -- the root as the ground, the tip lightest
  const blade = new THREE.BufferGeometry(); made.push(blade);
  blade.setAttribute('position', new THREE.Float32BufferAttribute([-0.025, 0, 0, 0.025, 0, 0, -0.014, 0.55, 0.016, 0.014, 0.55, 0.016, 0, 1, 0.05], 3));
  blade.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3)); /* (lit as the ground is: soft, no dark side) */
  blade.setAttribute('color', new THREE.Float32BufferAttribute([0.96, 0.96, 0.96, 0.96, 0.96, 0.96, 1.16, 1.22, 1.04, 1.16, 1.22, 1.04, 1.55, 1.58, 1.18], 3));
  blade.setAttribute('uv1', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0.5, 0, 0.5, 0, 1, 0], 2));
  blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 0, 2, 1, 1, 2, 3, 2, 4, 3]); /* (both faces, each lit from above -- a DoubleSide material turns the back's normal down, and half the blades went dark) */
  // (v1.10.284 G1: a blade material per season -- the cells stand in the island's season zones, each its own ground colour)
  // (v1.10.290 6: and a material a cell -- its own grow uniforms; one program for all, the cache key the same -- dropped with it)
  const bladeColors = new Map(); const bladeColorOf = (s) => { if (!bladeColors.has(s)) { const [to, share] = GROUND[s] || GROUND.summer; bladeColors.set(s, new THREE.Color(GRASS).lerp(new THREE.Color(to), share)); } return bladeColors.get(s); };
  const bladeMat = (s) => { const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }); m.color.copy(bladeColorOf(s)); m.userData.grow = { uGrowLo: { value: 0 }, uGrowS: { value: 1 } }; patch(m, { wind: true, cut: true, grow: m.userData.grow }); return m; };
  // v1.10.276 ④ the ground: a mottled picture (made here, 512, no file) on a sheet laid on the ground, the season's ground
  // colour -- no tone, so where it fades it is the island's own ground. v1.10.284 G1: a sheet a cell, seen where grass grows
  const groundTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); const r = (() => { let s = 2761; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
    x.fillStyle = 'rgb(232,232,232)'; x.fillRect(0, 0, 512, 512);
    const blob = (px, py, rad, v, a) => { for (const [ox, oy] of [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]]) { const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, rad); g.addColorStop(0, `rgba(${v},${v},${v},${a})`); g.addColorStop(1, `rgba(${v},${v},${v},0)`); x.fillStyle = g; x.fillRect(px + ox - rad, py + oy - rad, rad * 2, rad * 2); } };
    for (let i = 0; i < 260; i += 1) blob(r() * 512, r() * 512, 20 + r() * 60, r() < 0.5 ? 200 : 255, 0.18); /* (light and dark patches) */
    for (let i = 0; i < 900; i += 1) blob(r() * 512, r() * 512, 2 + r() * 5, r() < 0.7 ? 170 : 255, 0.35); /* (specks: soil, light leaves) */
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5); t.anisotropy = 4; made.push(t); return t;
  })();
  // one ground material; its colour in the sheet's points (the season there, x1.12: the picture's mean ~0.9)
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, vertexColors: true, transparent: true, depthWrite: false, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }); made.push(groundMat); /* (G1: -1, not -2 -- at a low angle it reached over the season's flat specks) */
  const groundColors = new Map(); const groundColorOf = (s) => { if (!groundColors.has(s)) groundColors.set(s, bladeColorOf(s).clone().multiplyScalar(1.12)); return groundColors.get(s); };

  // ---- v1.10.284 G1 땅과 풀, 섬 전체 (notes docs/graphics-island-wide-20261108.md 2절): the cells round me, made one a frame
  // nearest first and dropped once well behind; where grass grows read from the ground's maps (island.js's pictures, read
  // once small: 512 a side, 1.15 m a point, the walks' and the shore's distances blended between points), off every solid
  // and the plaza and the water. PC: 45 m, 12 blades a square metre; a phone 25 m, 6. 「중간」 half, 「낮음」 none; beyond
  // half the distance thinning to a quarter at the edge.
  // (the software-render gate, docs 3절: 「중간」 within 20% of no grass -- 12 a m² cost 35-40%; this 8, 「중간」 a third of it within
  // two thirds of the reach)
  const REACH = phone ? 25 : 45; const PER_M2 = phone ? 5 : 8; const MAX_CELLS = phone ? 24 : 48; const SIDE = 512; const TIER = [0, 0.35, 1];
  let quality = 2; let mapsRead = null; let solidGrid = null;
  function readMaps() { // -> { path, gravel, bare, sand, rock, forest, shore } sampler, or null until island.js's pictures are in
    if (mapsRead) return mapsRead; const m = groundMaps?.(); const imgs = m && [m.pathA, m.pathB, m.coverA, m.coverB, m.shore].map((t) => t?.image);
    if (!imgs || imgs.some((im) => !im?.width)) return null;
    const c = document.createElement('canvas'); c.width = c.height = SIDE; const g = c.getContext('2d', { willReadFrequently: true });
    const data = imgs.map((im) => { g.clearRect(0, 0, SIDE, SIDE); g.drawImage(im, 0, 0, SIDE, SIDE); return g.getImageData(0, 0, SIDE, SIDE).data; });
    const S = T.GROUND.size; const at = (d, ch, x, z) => { const u = ((x + S / 2) / S) * SIDE - 0.5; const v = ((z + S / 2) / S) * SIDE - 0.5; const i = Math.max(0, Math.min(SIDE - 2, Math.floor(u))); const j = Math.max(0, Math.min(SIDE - 2, Math.floor(v))); const fu = Math.max(0, Math.min(1, u - i)); const fv = Math.max(0, Math.min(1, v - j)); const p = (a, b) => d[((j + b) * SIDE + i + a) * 4 + ch]; return (p(0, 0) * (1 - fu) + p(1, 0) * fu) * (1 - fv) + (p(0, 1) * (1 - fu) + p(1, 1) * fu) * fv; };
    const [pa, pb, ca, cb, sh] = data;
    mapsRead = (x, z) => ({ path: at(pa, 0, x, z), gravel: at(pb, 2, x, z), forest: at(ca, 0, x, z), bare: at(ca, 1, x, z), sand: at(ca, 2, x, z), rock: at(cb, 0, x, z), shore: at(sh, 0, x, z) });
    return mapsRead;
  }
  function nearSolid(x, z) { // (a 4 m grid of the island's solids, made once)
    if (!solidGrid) { solidGrid = new Map(); for (const s of [...(T.natureSolids?.() || []), ...(T.structureSolids?.() || []), ...(T.villageSolids?.() || [])]) { const k = `${Math.floor(s.x / 4)},${Math.floor(s.z / 4)}`; if (!solidGrid.has(k)) solidGrid.set(k, []); solidGrid.get(k).push(s); } }
    const i = Math.floor(x / 4); const j = Math.floor(z / 4);
    for (let a = i - 2; a <= i + 2; a += 1) for (let b = j - 2; b <= j + 2; b += 1) for (const s of solidGrid.get(`${a},${b}`) || []) if (Math.hypot(x - s.x, z - s.z) < (s.r || 0.5) + 0.12) return true;
    return false;
  }
  const thickAt = (x, z) => { const m = readMaps(); if (!m) return 0; const k = P.grassFrom(m(x, z)); return k > 0 && !(T.inPlaza && T.inPlaza(x, z)) && T.walkable(x, z) && !nearSolid(x, z) ? k : 0; };
  // the drawn ground's own height (its mesh's triangles, 2.5 m) -- the smooth heightAt left the sheet under it on a slope
  const groundY = (x, z) => (T.meshGroundHeight ? T.meshGroundHeight(x, z) : T.heightAt(x, z));
  const cellMap = new Map(); // 'i,j' -> { mesh, sheet, n (its blades), d }
  function makeCell({ i, j, x, z }) {
    const season = T.seasonAt?.(x, z, Date.now()) || 'summer';
    const list = P.cellBlades(i, j, Math.round(P.CELL * P.CELL * PER_M2), thickAt);
    const mesh = new THREE.InstancedMesh(blade, bladeMat(season), Math.max(1, list.length)); mesh.receiveShadow = true; mesh.castShadow = false; mesh.name = 'pilot_grass';
    list.forEach((b, k) => mesh.setMatrixAt(k, new THREE.Matrix4().compose(new THREE.Vector3(b.x, groundY(b.x, b.z), b.z), q.setFromAxisAngle(up, b.yaw).clone(), new THREE.Vector3(1, b.h, 1))));
    mesh.count = list.length; mesh.computeBoundingSphere(); mesh.count = 0; mesh.visible = false; group.add(mesh); /* (290 6: grown in by stepCells; Codex 281~290 #1: the sphere over every blade first -- three measures only `count`, and an empty one culled the cell) */
    // its ground sheet: 17 x 17 points on the ground, each as clear as the grass is thick there
    const geo = new THREE.PlaneGeometry(P.CELL, P.CELL, 16, 16); geo.rotateX(-Math.PI / 2); const p = geo.attributes.position; const rgba = new Float32Array(p.count * 4);
    /* (each point its own season's ground colour -- a cell on a zone's edge took its middle's, a straight 16 m seam) */
    for (let k = 0; k < p.count; k += 1) { const wx = x + p.getX(k); const wz = z + p.getZ(k); p.setY(k, groundY(wx, wz) + 0.05); /* (5 cm: between its points it crosses the mesh's creases a few cm low) */ const c = groundColorOf(T.seasonAt?.(wx, wz, Date.now()) || 'summer'); rgba.set([c.r, c.g, c.b, Math.min(1, thickAt(wx, wz) * 1.4)], k * 4); }
    geo.setAttribute('color', new THREE.BufferAttribute(rgba, 4)); geo.computeVertexNormals(); geo.computeBoundingSphere();
    const sheet = new THREE.Mesh(geo, groundMat.clone()); sheet.material.opacity = 0; sheet.visible = false; /* (290 6: its own, faded in and out with its blades) */ sheet.position.set(x, 0, z); sheet.receiveShadow = true; sheet.renderOrder = -1; sheet.name = 'pilot_ground'; group.add(sheet);
    madeN += 1; return { mesh, sheet, n: list.length, d: 0, g: { from: 0, to: 0, t: 1 }, a: 0 };
  }
  function dropCell(key) { const c = cellMap.get(key); if (!c) return; c.mesh.removeFromParent(); c.mesh.dispose(); c.mesh.material.dispose(); c.sheet.removeFromParent(); c.sheet.geometry.dispose(); c.sheet.material.dispose(); cellMap.delete(key); }
  // (290 6: a cell toward `n` blades and its sheet toward `a`, over GROW_MS -- P.growStep; `ms` real time)
  function easeCell(c, n, a, ms) {
    const { count, lo, s } = P.growStep(c.g, n, ms, c.n); c.mesh.count = count; c.mesh.visible = count > 0; c.mesh.material.userData.grow.uGrowLo.value = lo; c.mesh.material.userData.grow.uGrowS.value = s;
    c.a = Math.max(0, Math.min(1, c.a + Math.sign(a - c.a) * Math.min(Math.abs(a - c.a), ms / P.GROW_MS))); c.sheet.material.opacity = c.a; c.sheet.visible = c.a > 0;
    return count === 0 && c.a === 0; /* (gone) */
  }
  const reachNow = () => (quality === 1 ? REACH * 0.66 : REACH);
  const shownOf = (c) => { const far = Math.max(0, Math.min(1, (c.d / reachNow() - 0.5) / 0.5)); return Math.round(c.n * (TIER[quality] ?? 1) * (1 - far * 0.75)); };
  let cellsAt = { x: Infinity, z: Infinity };
  function stepCells(me, ms) { // (where I stand: the cells' distances each frame, one made a frame -- none while the maps are not in)
    if (!readMaps()) return;
    const want = quality > 0 ? P.cellsNear(me.x, me.z, reachNow()) : []; const keep = new Set(want.map((c) => `${c.i},${c.j}`));
    for (const key of [...cellMap.keys()]) { const [i, j] = key.split(',').map(Number); const dx = Math.max(i * P.CELL - me.x, 0, me.x - (i + 1) * P.CELL); const dz = Math.max(j * P.CELL - me.z, 0, me.z - (j + 1) * P.CELL); if (!keep.has(key) && Math.hypot(dx, dz) > REACH + P.CELL) dropCell(key); }
    let made1 = false; const madeFrom = performance.now();
    for (const c of want) {
      const key = `${c.i},${c.j}`; let cell = cellMap.get(key);
      if (!cell) {
        if (made1 && performance.now() - madeFrom > 2) continue; /* (294 6b: as many as 2 ms of a frame lets -- a riding car's road comes fast) */
        if (cellMap.size >= MAX_CELLS) { /* (full: the farthest one I left goes first -- a warp left the old place's behind) */
          let far = null; let fd = -1; for (const k of cellMap.keys()) { if (keep.has(k)) continue; const [i, j] = k.split(',').map(Number); const d = Math.hypot((i + 0.5) * P.CELL - me.x, (j + 0.5) * P.CELL - me.z); if (d > fd) { fd = d; far = k; } }
          if (!far) continue; dropCell(far);
        }
        cell = makeCell(c); cellMap.set(key, cell); made1 = true;
      } cell.d = c.d; easeCell(cell, shownOf(cell), quality >= 2 ? 1 : 0, ms); }
    for (const [key, cell] of [...cellMap]) if (!keep.has(key) && easeCell(cell, 0, 0, ms) && quality === 0) dropCell(key); /* (out of reach: laid down; on 「낮음」 then dropped) */
    cellsAt = { x: me.x, z: me.z };
  }
  // each frame on the island: wind time, cuts round `things` ([{ x, z }]), the season's tint
  // (v1.10.284 G1: the tone over the whole island outside -- every lit material in the scene patched for it once, looked for
  // every two seconds; uPilotOut 0 indoors, so a room, a shop and a character in them look as before)
  let toneAt = 0; const toned = new WeakSet();
  function toneAll() {
    scene.traverse((o) => { if (!o.isMesh || o.isSprite) return; for (const m of [].concat(o.material)) { if (!m || toned.has(m) || m.isShaderMaterial || m.userData.pilot) continue; toned.add(m); patch(m, { wind: false, cut: false }); } });
  }
  function setOutdoors(on) { U.uPilotOut.value = on ? 1 : 0; }
  let stepAt = null; let madeN = 0; /* (294: cells made so far -- a ride's trace) */ let seasonAt = 0; let seasonDay = null;
  function step(dt, now, things = [], me = null) {
    if (now - toneAt > 2000) { toneAt = now; toneAll(); }
    U.uPilotTime.value = (U.uPilotTime.value + dt) % 1000;
    const ms = Math.min(500, Math.max(0, now - (stepAt ?? now))); stepAt = now; /* (290 6: the grass eases in real time -- a slow screen too) */
    /* (Codex 281~290 #5: a new Seoul day turns the season zones -- the cells made again in their new colours, grown in) */
    if (now - seasonAt > 10000) { seasonAt = now; const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); if (seasonDay && day !== seasonDay) for (const key of [...cellMap.keys()]) dropCell(key); seasonDay = day; }
    if (me) stepCells(me, ms);
    let n = 0; for (const t of things) { if (n >= CUTS) break; U.uPilotCuts.value[n].set(t.x, t.z, t.r || P.CUT_R, 0); n += 1; } /* (G1: the nearest few round me -- plaza-scene sorts them) */
    U.uPilotCutN.value = n;
  }
  // the graphics tier (plaza-scene setTier: 0 낮음, 1 중간, 2 높음): no blades and no ground sheet, half the blades, all (총괄 276 --
  // slow phones; a quarter on 낮음 still cost as much as none). The layout is in random order: the first ones spread over the patch.
  function setQuality(q) { quality = q; } /* (G1: the cells' counts by tier and distance, stepCells -- 290 6: eased there, on 「낮음」 laid down and then dropped) */
  // v1.10.276 ③ (PC 「높음」 only; G3: the whole island outside): a soft bloom over the picture, faded in and out over a second;
  // the passes load the first time they are wanted. draw() says whether it drew the frame. (G3 사용자 「C안: GTAO 끄기」: the
  // 276 GTAO is gone everywhere -- its second scene pass halved the frame rate on a mid GPU, bloom costs next to nothing)
  const ADDONS = '/vendor/three/addons/postprocessing';
  const POST = { bloom: 0.16 };
  let post = null; let postLoading = false; let postMix = 0;
  async function loadPost(renderer, scene, camera) {
    postLoading = true;
    try {
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all(['EffectComposer', 'RenderPass', 'UnrealBloomPass', 'OutputPass'].map((n) => import(`${ADDONS}/${n}.js`)));
      const size = renderer.getSize(new THREE.Vector2()); const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloom = new UnrealBloomPass(size.clone(), 0, 0.35, 0.92); composer.addPass(bloom);
      composer.addPass(new OutputPass());
      post = { composer, bloom, w: 0, h: 0, ratio: 0 };
    } catch { post = false; } /* (not loaded: drawn as before) */
  }
  let postForce = null; /* (tests: on/off whatever the place and tier, its strength set -- debug().pilotPost) */
  function setPost({ force = null, bloom = POST.bloom } = {}) { postForce = force; POST.bloom = bloom; }
  function draw(renderer, scene, camera, wanted, dt) {
    const want = postForce ?? wanted;
    if (want && !post && !postLoading) loadPost(renderer, scene, camera);
    postMix = Math.max(0, Math.min(1, postMix + (want ? dt : -dt)));
    if (!post || postMix <= 0) return false;
    const size = renderer.getSize(new THREE.Vector2()); const ratio = renderer.getPixelRatio();
    if (size.x !== post.w || size.y !== post.h || ratio !== post.ratio) { post.w = size.x; post.h = size.y; post.ratio = ratio; post.composer.setPixelRatio(ratio); post.composer.setSize(size.x, size.y); }
    post.bloom.strength = POST.bloom * postMix;
    post.composer.render(dt); return true;
  }
  function dispose() { for (const key of [...cellMap.keys()]) dropCell(key); group.removeFromParent(); for (const m of made) m.dispose?.(); if (post) { for (const p of post.composer.passes) p.dispose?.(); post.composer.dispose(); } } /* (v1.10.283 Codex #11: each pass's own render targets too) */
  return { group, step, setQuality, setOutdoors, draw, setPost, postShown: () => postMix, dispose, uniforms: U, counts: () => ({ cells: cellMap.size, cellKeys: [...cellMap.keys()], blades: [...cellMap.values()].reduce((s, c) => s + c.n, 0), shown: [...cellMap.values()].reduce((s, c) => s + (c.mesh.visible ? c.mesh.count : 0), 0), spheres: [...cellMap.values()].filter((c) => c.n > 0).map((c) => +(c.mesh.boundingSphere?.radius ?? -1).toFixed(1)), /* (Codex 281~290 #1) */ grow: [...cellMap.values()].filter((c) => c.g.t < 1).map((c) => +(c.g.to > c.g.from ? c.g.t : 1 - c.g.t).toFixed(2)).slice(0, 8), made: madeN, mapsIn: Boolean(mapsRead), reach: REACH, at: cellsAt }), grassAt: (x, z) => thickAt(x, z) };
}
