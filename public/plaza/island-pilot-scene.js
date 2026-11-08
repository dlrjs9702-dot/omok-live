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
  const byId = new Map(); for (const p of P.plants(T)) { if (!byId.has(p.id)) byId.set(p.id, []); byId.get(p.id).push(p); }
  const none = new THREE.BufferGeometry(); none.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3)); made.push(none);
  const noneMat = new THREE.MeshBasicMaterial(); made.push(noneMat);
  const q = new THREE.Quaternion(); const up = new THREE.Vector3(0, 1, 0);
  for (const [id, list] of byId) {
    const fallback = new THREE.InstancedMesh(none, noneMat, list.length); fallback.count = 0; fallback.visible = false; group.add(fallback);
    const matrices = list.map((p) => new THREE.Matrix4().compose(new THREE.Vector3(p.x, T.heightAt(p.x, p.z), p.z), q.setFromAxisAngle(up, p.yaw).clone(), new THREE.Vector3().setScalar(p.s)));
    const cell = { x: P.ZONE.x, z: P.ZONE.z, parent: group, procedural: [fallback], matrices, colors: null, shadow: /^(bush|rock)/.test(id) };
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
  let season = null; let seasonAt = 0;
  // each frame on the island: wind time, cuts round `things` ([{ x, z }]), the season's tint, the loaded models patched
  function step(dt, now, things = []) {
    U.uPilotTime.value = (U.uPilotTime.value + dt) % 1000;
    let n = 0; for (const t of things) { if (n >= CUTS) break; if (!P.inZone(t.x, t.z, 1)) continue; U.uPilotCuts.value[n].set(t.x, t.z, t.r || P.CUT_R, 0); n += 1; }
    U.uPilotCutN.value = n;
    if (now - seasonAt > 5000) { seasonAt = now; const s = T.seasonAt?.(P.ZONE.x, P.ZONE.z, Date.now()) || 'summer'; if (s !== season) { season = s; const [to, share] = GROUND[s] || GROUND.summer; bladeMat.color.setHex(GRASS).lerp(new THREE.Color(to), share); } }
    for (const o of group.children) { /* (a model's material is its file's: patched once; grass and flowers -- small and swaying -- cut) */
      if (!o.isMesh || o === grass || o.material === noneMat || o.userData.pilotSeen === o.material) continue; o.userData.pilotSeen = o.material;
      const wind = Boolean(o.geometry.attributes.uv1); if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const scale = o.userData.part ? new THREE.Vector3().setFromMatrixScale(o.userData.part).x : 1; /* (the part's dequantizing scale: metres per unit) */
      for (const m of [].concat(o.material)) patch(m, { wind, cut: wind && o.geometry.boundingSphere.radius * scale < 0.5, unit: 1 / scale });
    }
  }
  function dispose() { for (const one of cells) assets.unbatch?.(one); group.removeFromParent(); grass.dispose(); for (const m of made) m.dispose?.(); }
  return { group, step, dispose, uniforms: U, counts: () => ({ plants: [...byId.values()].reduce((s, l) => s + l.length, 0), kinds: byId.size, blades: bladeList.length }) };
}
