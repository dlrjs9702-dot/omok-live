'use strict';
// 1.10.438 C2 해안 산책로 + 밤 만 파도 (문제 기록 c057bfa1, 사용자 결정 99 · 100): the walk dimmer at night and edged; the lamps' pools on the roads too;
// the bay's rails along the sea-side walk edge, joined, east to x 60+ and west to x -85; the walk's edge broken, sand over it; the wash dying away by
// what is built (not cut at whole texels round 4 m circles); the shallow lines lit a little at night
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const T = require('../public/plaza/island-terrain');
const X = require('../public/plaza/island-taxi');
const { buildShoreMap } = require('../tools/maps/shore');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('438 ③ 물가 난간: 바다 쪽 인도 끝선을 따라, 인도 안으로 안 들어오고, 동쪽 x 60 넘어 · 서쪽 x -85 넘어까지 이어짐', { skip: !T.dalmaru && '달마루섬 전용' }, () => {
  const R = T.WATERFRONT.rails; assert.ok(R.length >= 30, `${R.length} pieces`);
  for (const r of R) for (const d of [-1.6, -0.55, 0.55, 1.6]) { const x = r.x + Math.cos(r.yaw) * d; const z = r.z - Math.sin(r.yaw) * d; const rd = T.roadDist(x, z);
    assert.ok(rd >= X.ROAD.half + 0.3 && rd <= X.ROAD.half + 1.8, `${x.toFixed(1)},${z.toFixed(1)} ${rd.toFixed(2)} m from the road: at the walk's edge`); }
  assert.ok(Math.max(...R.map((r) => r.x)) > 60 && Math.min(...R.map((r) => r.x)) < -85, 'both ways along the bay and the west shore');
  // joined: on the west shore (the photo's -60 ~ -81) a piece every 4.2 m
  const west = R.filter((r) => r.x < -60 && r.x > -81).sort((a, b) => b.x - a.x);
  for (let i = 1; i < west.length; i += 1) assert.ok(Math.hypot(west[i].x - west[i - 1].x, west[i].z - west[i - 1].z) < 5, `joined at ${west[i].x.toFixed(1)}`); /* (4.2 along the road's middle -- a little more round a bend's outside) */
  assert.ok(!R.some((r) => r.z > 70), 'none on the 윤슬다리 roads');
});

test('438 ⑤ 바닷가 지도: 인공 물가는 실제 인도 · 난간 자리만, 그 옆 모래는 2.5 m에 걸쳐 서서히(B 204 ~ 255)', { skip: !T.dalmaru && '달마루섬 전용' }, () => {
  const box = { x0: -82, z0: 14, size: 24 }; const res = 96; const m = buildShoreMap(T, res, box); const cell = box.size / res;
  let built = 0; let fading = 0; let farBuilt = 0;
  for (let j = 0; j < res; j += 1) for (let i = 0; i < res; i += 1) { const k = j * res + i; const b = m[k * 3 + 2]; const x = box.x0 + (i + 0.5) * cell; const z = box.z0 + (j + 0.5) * cell;
    if (b === 64) { built += 1; if (T.roadDist(x, z) > X.ROAD.half + 0.9 && !T.WATERFRONT.rails.some((r) => Math.hypot(r.x - x, r.z - z) < 2.6)) farBuilt += 1; }
    if (b > 204 && b < 255) fading += 1; }
  assert.ok(built > 0 && fading > 50, `built ${built}, fading ${fading}`); assert.equal(farBuilt, 0, 'nothing built off the walk and the rails');
  assert.match(read('public/plaza/island.js'), /float sandy = smoothstep\(0\.8, 0\.95, sh\.b\);/, 'the shader reads the fade as `sandy`');
});

test('438 ① ② ④ 밤 바닥 · 가로등 빛 · 인도 끝, 밤 만 파도', () => {
  const s = read('public/plaza/island.js');
  assert.match(s, /col \*= mix\(1\.0, ao < 2\.3 \? 0\.86 : 0\.62, uNight\);/, '① the walk and kerb dimmer at night');
  assert.match(s, /col \*= mix\(1\.0, 0\.8, smoothstep\(3\.3, 3\.78, ao\)\);/, '① an edging along its outer side');
  assert.match(s, /float edgeAt = 3\.84 \+ 0\.16 \* jag \+ 0\.08 \* jag2;/, '④ the outer edge broken');
  assert.match(s, /groundNight\.value = phase === 'night' \? 1 : phase === 'evening' \? 0\.5 : 0;/);
  assert.match(s, /totalEmissiveRadiance \+= vec3\(0\.55, 0\.66, 0\.82\) \* \(band \* holes \* 0\.5 \+ film \* 0\.1\) \* sandy \* uNight;/, '밤 만 파도: the lace');
  assert.match(s, /totalEmissiveRadiance \+= lines \* uNight \* vec3\(0\.5, 0\.62, 0\.8\) \* 0\.15;/, '밤 만 파도: the shallow lines');
  assert.match(s, /\* smoothstep\(0\.7, 1\.15, ln\)/, '⑤ the lines on more of the shore');
  const p = read('public/plaza/plaza-scene.js');
  assert.match(p, /const poolAt = \[\.\.\.PROPS\.lamps, \.\.\.\(globalThis\.IslandTerrain\.nature\?\.\(\)\.lampSpots \|\| \[\]\), \.\.\.\(globalThis\.IslandTerrain\.WATERFRONT\?\.lamps \|\| \[\]\)\];/, '② every lamp its pool');
});
