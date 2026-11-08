'use strict';
// v1.10.271 섬 택시 (gamecenter-notes docs/taxi-20261104.md 5절): the two stops are the road's ends, every point of the road on
// walkable ground or the bridge, the shelters and the steps out walkable; 25~40 s a ride (the tests' short road: 3 s), the
// phases in order and done at the other stop; the fare -- 0 for a home owner, else the economy value
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain');
const X = require('../public/plaza/island-taxi');
const ok = (x, z) => T.walkable(x, z) || Boolean(T.onBridge(x, z));

test('택시 길: 두 정류장이 길 양 끝, 길 모든 점이 걸을 수 있는 땅이나 다리, 정류장 지붕·내리는 자리도', () => {
  const road = X.roadOf('plaza');
  assert.deepEqual([road[0], road.at(-1)], [[X.stopOf('plaza').x, X.stopOf('plaza').z], [X.stopOf('isle').x, X.stopOf('isle').z]]);
  assert.deepEqual(X.roadOf('isle'), road.slice().reverse());
  for (let i = 1; i < road.length; i += 1) { const [a, b] = [road[i - 1], road[i]]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0; s <= L; s += 0.5) { const x = a[0] + (b[0] - a[0]) * s / L; const z = a[1] + (b[1] - a[1]) * s / L; assert.ok(ok(x, z), `${x.toFixed(1)},${z.toFixed(1)}`); } }
  assert.ok(road.some(([x, z]) => T.onBridge(x, z)) || (() => { for (let x = 40; x < 80; x += 2) if (T.onBridge(x, 140)) return true; return false; })(), 'over the bridge');
  for (const id of ['plaza', 'isle']) { const s = X.stopOf(id); assert.ok(T.walkable(s.shelter.x, s.shelter.z), `${id} shelter`); assert.ok(T.walkable(s.out.x, s.out.z), `${id} out`); }
  assert.ok(Math.hypot(X.stopOf('plaza').x - T.SPAWN.x, X.stopOf('plaza').z - T.SPAWN.z) > 20, 'clear of the first spot');
});

// v1.10.285 (notes docs/taxi-fix-20261108.md 2절, 사용자 「지형 지물 다 무시하고 뚫고 지나가버려」): both drives -- the road and
// the last turn to the drop-off -- walked every half metre: every solid at least the car's half width + 0.3 m off, no water
// (bridges fine), no stairs, the car's height following the ground (no step over 0.5 m in half a metre -- a bridge end ramps 0.4; off the bridges on the
// drawn ground within 0.25 m); the island end at the user's spot (-13.3, 173.1), its shelter and car spots clear too
test('택시 길 확인: 양쪽 길을 0.5 m마다 -- 단단한 물체에서 차 반폭+0.3 m 밖, 물·계단 아님, 차 높이가 땅을 따라감, 툇마루섬 마을 정류장', () => {
  const solids = [...T.natureSolids(), ...T.structureSolids(), ...T.villageSolids()];
  const clear = (x, z) => Math.min(...solids.map((s) => Math.hypot(x - s.x, z - s.z) - (s.r || 0.5)));
  const HALF = 0.85; // (the car 1.7 m wide -- island-taxi-scene's stand-in, assets 99's model)
  for (const from of ['plaza', 'isle']) {
    const road = X.driveOf(from); let last = null;
    for (let i = 1; i < road.length; i += 1) {
      const [a, b] = [road[i - 1], road[i]]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let s = 0; s <= L; s += 0.5) {
        const x = a[0] + (b[0] - a[0]) * s / L; const z = a[1] + (b[1] - a[1]) * s / L; const at = `${from} ${x.toFixed(1)},${z.toFixed(1)}`;
        assert.ok(clear(x, z) > HALF + 0.3, `${at} by a solid (${clear(x, z).toFixed(2)})`);
        assert.ok(ok(x, z) && !T.onStairs(x, z), `${at} water or stairs`);
        const y = T.heightAt(x, z); if (last != null) assert.ok(Math.abs(y - last) < 0.5, `${at} a step of ${(y - last).toFixed(2)} m`); last = y;
        if (!T.onBridge(x, z)) assert.ok(Math.abs(y - T.meshGroundHeight(x, z)) < 0.25, `${at} off the ground (${(y - T.meshGroundHeight(x, z)).toFixed(2)})`);
      }
    }
  }
  const isle = X.stopOf('isle'); assert.equal(isle.label, '툇마루섬 마을'); assert.ok(Math.hypot(isle.x + 13.3, isle.z - 173.1) < 4, '사용자 자리');
  for (const id of ['plaza', 'isle']) { const s = X.stopOf(id); const d = X.dropOf(id); for (const [name, p] of [['shelter', s.shelter], ['stand', s], ['drop', d], ['out', s.out]]) assert.ok(clear(p.x, p.z) > 1 && ok(p.x, p.z), `${id} ${name} ${p.x.toFixed(1)},${p.z.toFixed(1)}`); }
});

test('택시 시간: 한 번 25~40초(시험 길은 3초), 타기→출발→달리기→멈춤→내리기 순서, 끝에서 도착 정류장 앞', () => {
  for (const from of ['plaza', 'isle']) {
    const ride = { from, startedAt: 1000 }; const dur = X.durationOf(ride);
    assert.ok(dur > 25000 && dur < 40000, `${from} ${dur}`);
    const seen = []; let last = -1;
    for (let t = 0; t <= dur + 200; t += 100) { const p = X.poseAt(ride, 1000 + t); if (seen.at(-1) !== p.phase) seen.push(p.phase); assert.ok(p.d >= last - 1e-9, 'never back'); last = p.d; }
    assert.deepEqual(seen, ['enter', 'start', 'run', 'stop', 'exit', 'done']);
    const end = X.poseAt(ride, 1000 + dur); const to = X.stopOf(X.STOPS[from].to); const drop = X.dropOf(to.id); assert.ok(Math.hypot(end.x - drop.x, end.z - drop.z) < 0.01);
    // (v1.10.272 총괄) it stands across the shelter from the standing car, facing back along the road: its door -- and where one
    // gets out -- to the shelter, as where one gets in at the start
    assert.ok(Math.abs(Math.atan2(Math.sin(end.yaw - drop.yaw), Math.cos(end.yaw - drop.yaw))) < 0.01, `${from} yaw`);
    const shelterOf = (p) => Math.hypot(p.x - to.shelter.x, p.z - to.shelter.z);
    assert.ok(shelterOf(X.arrivalOf(ride)) < shelterOf(end) && shelterOf(X.arrivalOf(ride)) < 3.5, `${from} out by the shelter`);
    const from0 = X.stopOf(from); assert.ok(Math.hypot(from0.out.x - from0.shelter.x, from0.out.z - from0.shelter.z) < Math.hypot(from0.x - from0.shelter.x, from0.z - from0.shelter.z), `${from} in by the shelter`);
    const pts = X.driveOf(from); for (let i = 1; i < pts.length; i += 1) { const [a, b] = [pts[i - 1], pts[i]]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0; s <= L; s += 0.5) { const x = a[0] + (b[0] - a[0]) * s / L; const z = a[1] + (b[1] - a[1]) * s / L; assert.ok(ok(x, z), `${from} drive ${x.toFixed(1)},${z.toFixed(1)}`); } }
    const out = X.arrivalOf(ride); assert.ok(T.walkable(out.x, out.z), `${from} out`); assert.ok(Math.abs(Math.hypot(out.x - end.x, out.z - end.z) - Math.hypot(1.75, 1.27)) < 0.01); // (beside the car as it stands: exit_L)
    assert.ok(Math.abs(Math.hypot(to.out.x - to.x, to.out.z - to.z) - Math.hypot(1.5, 1.18)) < 0.01); // (where one gets in: enter_L)
  }
  assert.equal(X.durationOf({ from: 'plaza', startedAt: 0, runMs: 3000 }), X.ENTER + 3000 + X.EXIT);
  assert.equal(X.poseAt({ from: 'plaza', startedAt: 0, runMs: 3000 }, X.ENTER + 3000 + X.EXIT).phase, 'done');
});

test('택시 문: 타기 0~0.14에 열고 0.86~1에 닫고, 내리기 0~0.12에 열고 0.80~1에 닫고, 달리는 동안 닫힘', () => {
  assert.equal(X.doorOf('enter', 0), 0); assert.equal(X.doorOf('enter', 0.14), 1); assert.equal(X.doorOf('enter', 0.5), 1); assert.equal(X.doorOf('enter', 1), 0);
  assert.equal(X.doorOf('exit', 0.12), 1); assert.equal(X.doorOf('exit', 0.79), 1); assert.equal(X.doorOf('exit', 1), 0); assert.equal(X.doorOf('run', 0.5), 0);
});

test('택시 요금: 집주인 무료, 집 없으면 경제 값(기본 1,000P)', () => {
  assert.equal(X.fareOf({ hasHome: true }), 0); assert.equal(X.fareOf({ hasHome: false }), 1000); assert.equal(X.fareOf({ hasHome: false, fare: 1500 }), 1500);
});
