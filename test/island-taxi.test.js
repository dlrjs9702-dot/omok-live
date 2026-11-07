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

test('택시 시간: 한 번 25~40초(시험 길은 3초), 타기→출발→달리기→멈춤→내리기 순서, 끝에서 도착 정류장 앞', () => {
  for (const from of ['plaza', 'isle']) {
    const ride = { from, startedAt: 1000 }; const dur = X.durationOf(ride);
    assert.ok(dur > 25000 && dur < 40000, `${from} ${dur}`);
    const seen = []; let last = -1;
    for (let t = 0; t <= dur + 200; t += 100) { const p = X.poseAt(ride, 1000 + t); if (seen.at(-1) !== p.phase) seen.push(p.phase); assert.ok(p.d >= last - 1e-9, 'never back'); last = p.d; }
    assert.deepEqual(seen, ['enter', 'start', 'run', 'stop', 'exit', 'done']);
    const end = X.poseAt(ride, 1000 + dur); const to = X.stopOf(X.STOPS[from].to); assert.ok(Math.hypot(end.x - to.x, end.z - to.z) < 0.01);
    assert.deepEqual(X.arrivalOf(ride), to.out);
  }
  assert.equal(X.durationOf({ from: 'plaza', startedAt: 0, runMs: 3000 }), X.ENTER + 3000 + X.EXIT);
  assert.equal(X.poseAt({ from: 'plaza', startedAt: 0, runMs: 3000 }, X.ENTER + 3000 + X.EXIT).phase, 'done');
});

test('택시 요금: 집주인 무료, 집 없으면 경제 값(기본 1,000P)', () => {
  assert.equal(X.fareOf({ hasHome: true }), 0); assert.equal(X.fareOf({ hasHome: false }), 1000); assert.equal(X.fareOf({ hasHome: false, fare: 1500 }), 1500);
});
