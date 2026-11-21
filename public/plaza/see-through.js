import * as THREE from '/vendor/three/three.module.js';

// 1.10.369 N1b §6 가려도 내 캐릭터 보이기 (사용자 2026-11-18 「나무에 가릴 경우 내 케릭터 위치를 보이게 할 방법도 같이 해. 거려지는 곳 근처만
// 투명처리하는 방법으로.」, notes docs/byeolmaru-forest-n1b-20261118.md §6): the trees', bushes' and 별지기 느티's materials get a hole round
// my character on the screen -- inside a circle (soft at its edge, a 4x4 dither, never see-through blending: no sorting) only what
// is between the camera and me goes; what stands behind me and the ground stay. One set of numbers for every patched material,
// set each frame by plaza-scene (on while a tree is on the line from the camera to me, 0.2 s in and out; off in the first person).
// The shadows' own depth materials are not patched: the shadows stay whole.
// (총괄 369 검토: a camera inside a big crown showed a flat wall of leaves -- what is within 6 m of the camera fades out too, gone by
// 3 m, in the third person; `near` 0 in the first, where a tree walked up to stays)
/* (380 사용자 「건물, 절벽 등에만」: `cliff` -- the coast's cliff models get the same hole, on while one stands on the line from the camera to me;
   on both islands, the trees' `on` still 별마루섬's only. The ground's own cliffs need none: the camera stays inside them and sees out
   (plaza-scene camFloor, 문제 기록 7)) */
export const SEE = { center: { value: new THREE.Vector2(-1e5, -1e5) }, radius: { value: 0 }, depth: { value: 0 }, on: { value: 0 }, near: { value: 0 }, cliff: { value: 0 } };
const NO_NEAR = { value: 0 };
const copies = new WeakMap(); const cliffCopies = new WeakMap();
/* (1.10.373 총괄 「방충망처럼 보여요」: the 4x4 Bayer grid read as a screen's mesh where it was half way -- a fine noise without a grid
   (interleaved gradient noise) in its place, and the near fade only round me on the screen (twice the hole's circle) -- a trunk by the
   camera off to the side stays whole; within 3.5 m of the camera; cut clean, never half way -- a dither half way, on a trunk lying along the
   view, is what looked like a screen) */
const CHUNK = 'uniform vec2 uSeeC; uniform float uSeeR; uniform float uSeeD; uniform float uSeeOn; uniform float uSeeNear;\nfloat seeBayer(vec2 p) { return fract(52.9829189 * fract(dot(floor(p), vec2(0.06711056, 0.00583715)))); }';
/* (three's vViewPosition is -mvPosition: its z the distance in front of the camera) */
const HOLE = '\n  { float seeZ = vViewPosition.z; float seeK = uSeeOn > 0.0 ? uSeeOn * (1.0 - smoothstep(uSeeR * 0.55, uSeeR, length(gl_FragCoord.xy - uSeeC))) * step(seeZ, uSeeD) : 0.0; seeK = max(seeK, uSeeNear * step(seeZ, 3.5) * step(length(gl_FragCoord.xy - uSeeC), uSeeR * 2.0)); if (seeK > 0.0 && seeK > seeBayer(gl_FragCoord.xy)) discard; }';
// the hole put into a shader being compiled (`cliff`: on by SEE.cliff, without the near fade)
function seePatch(sh, cliff = false) {
  Object.assign(sh.uniforms, { uSeeC: SEE.center, uSeeR: SEE.radius, uSeeD: SEE.depth, uSeeOn: cliff ? SEE.cliff : SEE.on, uSeeNear: cliff ? NO_NEAR : SEE.near });
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${CHUNK}`).replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>${HOLE}`);
}
// a see-through copy of a material (one a source), its own patches kept
export function seeThrough(m, cliff = false) {
  if (!m || Array.isArray(m) || m.isShaderMaterial || m.userData?.seeThrough) return m;
  const cache = cliff ? cliffCopies : copies; let f = cache.get(m); if (f) return f;
  f = m.clone(); const base = m.onBeforeCompile; const key = m.customProgramCacheKey?.bind(m);
  f.userData = { ...m.userData, seeThrough: true };
  f.onBeforeCompile = (sh, r) => { base?.call(f, sh, r); seePatch(sh, cliff); };
  f.customProgramCacheKey = () => `${key ? key() : ''}|see${cliff ? '-cliff' : ''}`;
  cache.set(m, f); return f;
}
// (380) the coast's cliffs' batches: by SEE.cliff
export const SEE_CLIFF_IDS = /^angular\.cliff_/;
/* (1.10.398 사용자 결정 55 A 「달마루섬에서는 건물, 절벽 등에만」 -- 380 left the buildings out): the island's big fixed buildings, attached one by one
   (asset-loader attach), and what sits on them (a roof, banner, awning, a worn house's marks, a house's dress) -- by SEE.cliff as the cliffs; no
   rooms, signs, small facilities or 별마루섬 pieces. A new building's id goes here */
export const SEE_BUILDING_IDS = /^(facility\.(games|records|admin|townhall|store|jail|stocks|climb)|cottage(\.\d+)?|home\.(hut|house|manor2?)__\w+|decay\.\w+\.(hut|house|manor2?)|xmas\.house_dress\.\w+|together\.museum_exterior|gamehall\.record_tower|train\.platform|dalmaru\.(lighthouse_choseung|facade_townhall|facade_mall)|story\.lighthouse_hatch|games\.(roof|banner|marquee)|store\.(window|awning)|yard\.storehouse_\d\.\w+)$/;
// every mesh of an object its SEE.cliff copy (not the basic, sprite, point or line ones -- their shaders have no view position for the hole)
export function seeBuilding(object) {
  const one = (m) => (!m || m.isMeshBasicMaterial || m.isSpriteMaterial || m.isPointsMaterial || m.isLineBasicMaterial ? m : seeThrough(m, true));
  object?.traverse((o) => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material); });
}
// the targets whose batches see through: the trees and bushes everywhere, 별마루섬's big ones and 별지기 느티 (not their far pictures)
export const SEE_IDS = /^(nature\.tree|angular\.tree_|tree\.harvest|tree\.fruitLayer|forest\.tree_(big_fir|big_pine|big_oak|ancient)$|nature\.bush|angular\.bush)/;
