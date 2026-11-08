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

export function pilotScene({ scene, assets, phone = false }) {
  const group = new THREE.Group(); group.name = 'pilot'; scene.add(group);
  const made = [];
  const U = { uPilotTime: { value: 0 }, uPilotTone: { value: 1 }, uPilotExposure: { value: 0.7 }, uPilotCuts: { value: Array.from({ length: CUTS }, () => new THREE.Vector4()) }, uPilotCutN: { value: 0 } };
  // a material of the patch: its own wind (if its geometry has the second UV), cuts (grass and flowers) and tone
  // `unit`: metres to the geometry's own units (a quantized model's positions are integers, its part matrix the scale)
  function patch(m, { wind, cut, unit = 1 }) {
    if (m.userData.pilot) return; m.userData.pilot = true;
    const before = m.onBeforeCompile; const own = { uPilotUnit: { value: unit } };
    m.onBeforeCompile = (sh, r) => {
      before?.call(m, sh, r); Object.assign(sh.uniforms, U, own);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nuniform float uPilotTime; uniform float uPilotUnit; uniform vec4 uPilotCuts[${CUTS}]; uniform int uPilotCutN;\n${wind ? '#ifndef USE_UV1\nattribute vec2 uv1;\n#endif' : ''}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
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
uniform float uPilotTone; uniform float uPilotExposure;
vec3 pilotTone(vec3 c) { float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); float x = l * uPilotExposure; float t = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); return mix(c, c * (t / max(l, 1e-4)), smoothstep(0.04, 0.2, l)); }`)
        .replace('#include <tonemapping_fragment>', '#include <tonemapping_fragment>\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, pilotTone(gl_FragColor.rgb), uPilotTone);');
    };
    const key = m.customProgramCacheKey?.bind(m);
    m.customProgramCacheKey = () => `${key ? key() : ''}:pilot2${wind ? 'w' : ''}${cut ? 'c' : ''}`; m.needsUpdate = true;
  }
  // the plants: one batch per kind, each copy on the ground where the layout says
  const cells = [];
  const byId = new Map(); for (const p of [...P.plants(T), ...P.trees(T)]) { /* (v1.10.276: and the patch's trees -- island.js leaves them out) */ if (!byId.has(p.id)) byId.set(p.id, []); byId.get(p.id).push(p); }
  const none = new THREE.BufferGeometry(); none.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3)); made.push(none);
  const noneMat = new THREE.MeshBasicMaterial(); made.push(noneMat);
  const q = new THREE.Quaternion(); const up = new THREE.Vector3(0, 1, 0);
  for (const [id, list] of byId) {
    const fallback = new THREE.InstancedMesh(none, noneMat, list.length); fallback.count = 0; fallback.visible = false; group.add(fallback);
    const matrices = list.map((p) => new THREE.Matrix4().compose(new THREE.Vector3(p.x, T.heightAt(p.x, p.z), p.z), q.setFromAxisAngle(up, p.yaw).clone(), new THREE.Vector3().setScalar(p.s)));
    const cell = { x: P.ZONE.x, z: P.ZONE.z, parent: group, procedural: [fallback], matrices, colors: null, shadow: /^(bush|rock|tree)/.test(id) };
    const one = [cell]; cells.push(one); assets.batch([`pilot.${id}`], one);
  }
  // the blades: one thin bent leaf ending in a point (총괄 #425: half as wide), many times; the season's ground colour on the
  // material, the vertex colours how much lighter -- the root as the ground, the tip lightest
  const blade = new THREE.BufferGeometry(); made.push(blade);
  blade.setAttribute('position', new THREE.Float32BufferAttribute([-0.025, 0, 0, 0.025, 0, 0, -0.014, 0.55, 0.016, 0.014, 0.55, 0.016, 0, 1, 0.05], 3));
  blade.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3)); /* (lit as the ground is: soft, no dark side) */
  blade.setAttribute('color', new THREE.Float32BufferAttribute([0.96, 0.96, 0.96, 0.96, 0.96, 0.96, 1.16, 1.22, 1.04, 1.16, 1.22, 1.04, 1.55, 1.58, 1.18], 3));
  blade.setAttribute('uv1', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0.5, 0, 0.5, 0, 1, 0], 2));
  blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 0, 2, 1, 1, 2, 3, 2, 4, 3]); /* (both faces, each lit from above -- a DoubleSide material turns the back's normal down, and half the blades went dark) */
  const bladeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }); made.push(bladeMat); patch(bladeMat, { wind: true, cut: true });
  const bladeList = P.blades(T, phone ? 2500 : 7000);
  const grass = new THREE.InstancedMesh(blade, bladeMat, bladeList.length); grass.receiveShadow = true; grass.castShadow = false; grass.name = 'pilot_grass';
  bladeList.forEach((b, i) => grass.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(b.x, T.heightAt(b.x, b.z), b.z), q.setFromAxisAngle(up, b.yaw).clone(), new THREE.Vector3(1, b.h, 1))));
  grass.computeBoundingSphere(); group.add(grass);
  // v1.10.276 ④ the patch's ground: a mottled picture (made here, 512, no file) on a sheet laid on the ground, the season's
  // ground colour, fading out from two thirds of the way to the edge -- no tone, so its rim is the island's own ground
  const groundTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); const r = (() => { let s = 2761; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
    x.fillStyle = 'rgb(232,232,232)'; x.fillRect(0, 0, 512, 512);
    const blob = (px, py, rad, v, a) => { for (const [ox, oy] of [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]]) { const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, rad); g.addColorStop(0, `rgba(${v},${v},${v},${a})`); g.addColorStop(1, `rgba(${v},${v},${v},0)`); x.fillStyle = g; x.fillRect(px + ox - rad, py + oy - rad, rad * 2, rad * 2); } };
    for (let i = 0; i < 260; i += 1) blob(r() * 512, r() * 512, 20 + r() * 60, r() < 0.5 ? 200 : 255, 0.18); /* (light and dark patches) */
    for (let i = 0; i < 900; i += 1) blob(r() * 512, r() * 512, 2 + r() * 5, r() < 0.7 ? 170 : 255, 0.35); /* (specks: soil, light leaves) */
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5); t.anisotropy = 4; made.push(t); return t;
  })();
  const sheet = new THREE.PlaneGeometry(P.ZONE.r * 2, P.ZONE.r * 2, 40, 40); sheet.rotateX(-Math.PI / 2); made.push(sheet);
  { const p = sheet.attributes.position; const rgba = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i += 1) { const wx = P.ZONE.x + p.getX(i); const wz = P.ZONE.z + p.getZ(i); p.setY(i, T.heightAt(wx, wz) + 0.025); const e = Math.min(1, Math.max(0, (Math.hypot(p.getX(i), p.getZ(i)) / P.ZONE.r - 0.65) / 0.35)); rgba.set([1, 1, 1, 1 - e * e * (3 - 2 * e)], i * 4); }
    sheet.setAttribute('color', new THREE.BufferAttribute(rgba, 4)); sheet.computeVertexNormals(); }
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, vertexColors: true, transparent: true, depthWrite: false, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); made.push(groundMat);
  const ground = new THREE.Mesh(sheet, groundMat); ground.position.set(P.ZONE.x, 0, P.ZONE.z); ground.receiveShadow = true; ground.renderOrder = -1; ground.name = 'pilot_ground'; group.add(ground);
  let season = null; let seasonAt = 0;
  // each frame on the island: wind time, cuts round `things` ([{ x, z }]), the season's tint, the loaded models patched
  function step(dt, now, things = []) {
    U.uPilotTime.value = (U.uPilotTime.value + dt) % 1000;
    let n = 0; for (const t of things) { if (n >= CUTS) break; if (!P.inZone(t.x, t.z, 1)) continue; U.uPilotCuts.value[n].set(t.x, t.z, t.r || P.CUT_R, 0); n += 1; }
    U.uPilotCutN.value = n;
    if (now - seasonAt > 5000) { seasonAt = now; const s = T.seasonAt?.(P.ZONE.x, P.ZONE.z, Date.now()) || 'summer'; if (s !== season) { season = s; const [to, share] = GROUND[s] || GROUND.summer; bladeMat.color.setHex(GRASS).lerp(new THREE.Color(to), share); groundMat.color.copy(bladeMat.color).multiplyScalar(1.12); } } /* (the picture's mean ~0.9: its sheet the ground's colour) */
    for (const o of group.children) { /* (a model's material is its file's: patched once; grass and flowers -- small and swaying -- cut) */
      if (!o.isMesh || o === grass || o === ground || o.material === noneMat || o.userData.pilotSeen === o.material) continue; o.userData.pilotSeen = o.material;
      const wind = Boolean(o.geometry.attributes.uv1); if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const scale = o.userData.part ? new THREE.Vector3().setFromMatrixScale(o.userData.part).x : 1; /* (the part's dequantizing scale: metres per unit) */
      for (const m of [].concat(o.material)) patch(m, { wind, cut: wind && o.geometry.boundingSphere.radius * scale < 0.5, unit: 1 / scale });
    }
  }
  // the graphics tier (plaza-scene setTier: 0 낮음, 1 중간, 2 높음): no blades and no ground sheet, half the blades, all (총괄 276 --
  // slow phones; a quarter on 낮음 still cost as much as none). The layout is in random order: the first ones spread over the patch.
  const BLADES_BY_TIER = [0, 0.5, 1];
  function setQuality(q) { grass.count = Math.round(bladeList.length * (BLADES_BY_TIER[q] ?? 1)); grass.visible = grass.count > 0; ground.visible = q > 0; }
  // v1.10.276 ③ (PC 「높음」 only, in and by the patch): ambient occlusion (GTAO) and a soft bloom over the picture, faded in
  // and out over a second; the passes load the first time they are wanted. draw() says whether it drew the frame.
  const ADDONS = '/vendor/three/addons/postprocessing';
  const POST = { ao: 0.75, bloom: 0.16 };
  let post = null; let postLoading = false; let postMix = 0;
  async function loadPost(renderer, scene, camera) {
    postLoading = true;
    try {
      const [{ EffectComposer }, { RenderPass }, { GTAOPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all(['EffectComposer', 'RenderPass', 'GTAOPass', 'UnrealBloomPass', 'OutputPass'].map((n) => import(`${ADDONS}/${n}.js`)));
      const size = renderer.getSize(new THREE.Vector2()); const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const ao = new GTAOPass(scene, camera, size.x, size.y); ao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1, thickness: 1, scale: 1 }); ao.blendIntensity = 0; composer.addPass(ao);
      /* (its depth and normals drew a name label and the see-through ground sheet as solid -- a dark box over me: those left
         out as it leaves out points and lines) */
      const hide = ao._overrideVisibility.bind(ao);
      ao._overrideVisibility = () => { hide(); scene.traverse((o) => { if (o.visible && (o.isSprite || (o.material && [].concat(o.material).some((m) => m.transparent || m.depthWrite === false)))) { o.visible = false; ao._visibilityCache.push(o); } }); };
      const bloom = new UnrealBloomPass(size.clone(), 0, 0.35, 0.92); composer.addPass(bloom);
      composer.addPass(new OutputPass());
      post = { composer, ao, bloom, w: 0, h: 0, ratio: 0 };
    } catch { post = false; } /* (not loaded: drawn as before) */
  }
  function draw(renderer, scene, camera, want, dt) {
    if (want && !post && !postLoading) loadPost(renderer, scene, camera);
    postMix = Math.max(0, Math.min(1, postMix + (want ? dt : -dt)));
    if (!post || postMix <= 0) return false;
    const size = renderer.getSize(new THREE.Vector2()); const ratio = renderer.getPixelRatio();
    if (size.x !== post.w || size.y !== post.h || ratio !== post.ratio) { post.w = size.x; post.h = size.y; post.ratio = ratio; post.composer.setPixelRatio(ratio); post.composer.setSize(size.x, size.y); }
    post.ao.blendIntensity = POST.ao * postMix; post.bloom.strength = POST.bloom * postMix;
    post.composer.render(dt); return true;
  }
  function dispose() { for (const one of cells) assets.unbatch?.(one); group.removeFromParent(); grass.dispose(); for (const m of made) m.dispose?.(); if (post) post.composer.dispose(); }
  return { group, step, setQuality, draw, postShown: () => postMix, dispose, uniforms: U, counts: () => ({ plants: [...byId.values()].reduce((s, l) => s + l.length, 0), kinds: byId.size, blades: bladeList.length, shown: grass.count }) };
}
