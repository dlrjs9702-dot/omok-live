import * as THREE from '/vendor/three/three.module.js';

// 1.10.369 N1b §6 가려도 내 캐릭터 보이기 (사용자 2026-11-18 「나무에 가릴 경우 내 케릭터 위치를 보이게 할 방법도 같이 해. 거려지는 곳 근처만
// 투명처리하는 방법으로.」, notes docs/byeolmaru-forest-n1b-20261118.md §6): the trees', bushes' and 별지기 느티's materials get a hole round
// my character on the screen -- inside a circle (soft at its edge, a 4x4 dither, never see-through blending: no sorting) only what
// is between the camera and me goes; what stands behind me and the ground stay. One set of numbers for every patched material,
// set each frame by plaza-scene (on while a tree is on the line from the camera to me, 0.2 s in and out; off in the first person).
// The shadows' own depth materials are not patched: the shadows stay whole.
// (총괄 369 검토: a camera inside a big crown showed a flat wall of leaves -- what is within 6 m of the camera fades out too, gone by
// 3 m, in the third person; `near` 0 in the first, where a tree walked up to stays)
export const SEE = { center: { value: new THREE.Vector2(-1e5, -1e5) }, radius: { value: 0 }, depth: { value: 0 }, on: { value: 0 }, near: { value: 0 } };
const copies = new WeakMap();
const CHUNK = 'uniform vec2 uSeeC; uniform float uSeeR; uniform float uSeeD; uniform float uSeeOn; uniform float uSeeNear;\nfloat seeBayer(vec2 p) { const float B[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0); ivec2 q = ivec2(mod(floor(p), 4.0)); return (B[q.y * 4 + q.x] + 0.5) / 16.0; }';
/* (three's vViewPosition is -mvPosition: its z the distance in front of the camera) */
const HOLE = '\n  { float seeZ = vViewPosition.z; float seeK = uSeeOn > 0.0 ? uSeeOn * (1.0 - smoothstep(uSeeR * 0.55, uSeeR, length(gl_FragCoord.xy - uSeeC))) * step(seeZ, uSeeD) : 0.0; seeK = max(seeK, uSeeNear * (1.0 - smoothstep(3.0, 6.0, seeZ))); if (seeK > 0.0 && seeK > seeBayer(gl_FragCoord.xy)) discard; }';
// a see-through copy of a material (one a source), its own patches kept
export function seeThrough(m) {
  if (!m || Array.isArray(m) || m.isShaderMaterial || m.userData?.seeThrough) return m;
  let f = copies.get(m); if (f) return f;
  f = m.clone(); const base = m.onBeforeCompile; const key = m.customProgramCacheKey?.bind(m);
  f.userData = { ...m.userData, seeThrough: true };
  f.onBeforeCompile = (sh, r) => {
    base?.call(f, sh, r); Object.assign(sh.uniforms, { uSeeC: SEE.center, uSeeR: SEE.radius, uSeeD: SEE.depth, uSeeOn: SEE.on, uSeeNear: SEE.near });
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${CHUNK}`).replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>${HOLE}`);
  };
  f.customProgramCacheKey = () => `${key ? key() : ''}|see`;
  copies.set(m, f); return f;
}
// the targets whose batches see through: the trees and bushes everywhere, 별마루섬's big ones and 별지기 느티 (not their far pictures)
export const SEE_IDS = /^(nature\.tree|angular\.tree_|tree\.harvest|tree\.fruitLayer|forest\.tree_(big_fir|big_pine|big_oak|ancient)$|nature\.bush|angular\.bush)/;
