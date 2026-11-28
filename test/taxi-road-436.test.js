'use strict';
// 1.10.436 B 택시 · 도로 (notes docs/issue-plan-20261128.md 2번 묶음, 문제 기록 66460bba · ca8229cf · f62f225a, 다듬기 「택시 비스듬히」): every T painted as
// a T, a dead end squared past its last short piece, a sign meeting outside the lanes read by the shader as walk (no squiggle by 툇마루섬 마을's stop);
// a ride's seat mine (no server correction pulling me back to the stop); the car tilted with the ground; a standing car turned 25°
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const T = require('../public/plaza/island-terrain');
const X = require('../public/plaza/island-taxi');
const P = require('../public/plaza/island-paths');
const read = (f) => fs.readFileSync(path.join(__dirname, '../public/plaza', f), 'utf8');

test('436 칠: 모든 T자 · 막힌 끝 -- 차선 위에 셰이더가 못 가리는 부호 뒤집힘 없음(별마루섬 입구 길 끝, 택시 서는 자리 아래 하나뿐)', () => {
  const at = (x, z) => X.TEES.find((t) => Math.hypot(t.x - x, t.z - z) < 0.01);
  for (const [x, z] of [[0.4, -7.8], [-19.7, 172.8], [-19.2, 141.3], [-20, 236]]) assert.ok(at(x, z), `a T at ${x}, ${z}`);
  assert.deepEqual(X.PAINT_FLIP, [X.ROADS[2], X.ROADS[3]], 'L2 and L1 painted east, as ROUTE and EXT where they meet');
  const res = 1024; const m = P.buildRoadMap(T, X, res); const size = T.GROUND.size; const cell = size / res; const x0 = -size / 2;
  const R = (k) => (m[k * 3] / 255 - 0.5) * 2 * P.ROAD_RANGE; const bad = [];
  for (let j = 0; j < res - 1; j += 1) for (let i = 0; i < res - 1; i += 1) { const k = j * res + i; if (!m[k * 3 + 1]) continue;
    for (const n of [k + 1, k + res]) { if (!m[n * 3 + 1]) continue; const a = R(k); const b = R(n); if (!a || !b || Math.sign(a) === Math.sign(b)) continue;
      const avg = (Math.abs(a) + Math.abs(b)) / 2; /* (a real middle: both small; the shader's four texels: 1.5 and over read as they are) */
      if (avg < 0.9 || avg >= 1.5 || m[k * 3 + 2] === P.MOUTH || m[n * 3 + 2] === P.MOUTH) continue; bad.push([x0 + (i + 0.5) * cell, x0 + (j + 0.5) * cell]); } }
  const end = X.EXT[X.EXT.length - 1]; assert.ok(bad.every(([x, z]) => Math.hypot(x - end[0], z - end[1]) < 4), `left: ${JSON.stringify(bad.slice(0, 5))}`);
  // 66460bba's corner: 툇마루섬 마을's stop -- the stem squared at the stop (nothing painted 1 m past its end), the mouth marked
  const box = { x0: -26, z0: 166, size: 16 }; const q = P.buildRoadMap(T, X, 64, box); const px = (x, z) => { const i = Math.floor((x - box.x0) / 0.25); const jj = Math.floor((z - box.z0) / 0.25); return jj * 64 + i; };
  assert.equal(q[px(-17.5, 173) * 3 + 2], P.MOUTH, 'the mouth'); assert.equal(q[px(-12.2, 173.2) * 3 + 1], 0, 'squared at the stop');
  // the shader: where the filtered R reads near 0 but the four texels' own distances are far, those
  const island = read('island.js');
  assert.match(island, /if \(ao < 2\.5\) \{ ivec2 rs = textureSize\(tRoad, 0\);/); assert.match(island, /ao = mix\(ao, af, smoothstep\(1\.1, 1\.5, af\) \* smoothstep\(0\.3, 0\.6, af - ao\)\);/);
});

test('436 떨림: 택시 · 배 · 기차 · 엘리베이터 위에서는 서버 위치 보정을 받지도 끌려가지도 않음, 탈 때 · 내릴 때 앞의 보정은 버림', () => {
  const s = read('plaza-scene.js');
  assert.match(s, /function correctTo\(x, z\) \{\s*if \(liftRide \|\| riding \|\| taxiRide \|\| myBoat\) return;/);
  assert.match(s, /if \(taxiRide \|\| riding \|\| myBoat \|\| liftRide\) \{ correction = null; return; \}/);
  assert.match(s, /keys\.clear\(\); correction = null; trainChangedAt = Date\.now\(\);[^\n]*taxiRide\.clips = taxiClipsIn/);
  assert.match(s, /correction = null; trainChangedAt = Date\.now\(\);[^\n]*placeCamera\(true\); onTaxiEnd/);
  // the order that shook: the seat set, then the correction glided after it, the same frame
  assert.match(s, /stepTaxi\(\); stepQuestScenes\(dt\);[\s\S]{0,1200}stepOthers\(dt\);/, 'stepOthers (the correction) after stepTaxi -- why it is dropped, not just ordered');
});

test('436 택시: 땅 기울기 따라 앞뒤 · 옆으로 기욺(0.35 rad까지), 서 있는 차는 25° 비스듬히(그림만)', () => {
  const s = read('island-taxi-scene.js');
  assert.match(s, /const SLOPE = \{ along: 1\.3, across: 0\.75, max: 0\.35 \};/);
  assert.match(s, /rec\.h\.rotation\.set\(\(pose\.pitch \|\| 0\) \+ sl\.pitch, pose\.yaw, \(pose\.roll \|\| 0\) \+ sl\.roll, 'YXZ'\);/);
  assert.match(s, /const PARK_TILT = \(25 \* Math\.PI\) \/ 180;/); assert.match(s, /const want = ride \? 0 : PARK_TILT;/);
  // the ground the high 별마루다리 is: its ramps 0.1 rad and more (the arch), so a car on it tilts
  const A = 1.3; const pitchAt = (x, z, yaw) => -Math.atan2(T.heightAt(x + Math.sin(yaw) * A, z + Math.cos(yaw) * A) - T.heightAt(x - Math.sin(yaw) * A, z - Math.cos(yaw) * A), 2 * A);
  let most = 0; for (let x = 168; x <= 224; x += 2) most = Math.max(most, Math.abs(pitchAt(x, 226, -Math.PI / 2))); assert.ok(most > 0.1, `the bridge's ramps ${most.toFixed(3)}`);
});
