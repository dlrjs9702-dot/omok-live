'use strict';
// 1.10.391 N4-a (public/plaza/island-taxi.js; notes docs/n4-plan-20261120.md §4·§5-1, 사용자 N4 §8 · 11-20 「가까운 빈자리를 채우는 걸로」): two cars at
// each stop; a ride takes the front one (the one behind pulls up); after letting its rider out a car stays when that stop has fewer than two,
// else it goes back empty; quiet, two and two again. Its lane: a car keeps right of the road's middle, on the bridge the middle
const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../public/plaza/island-taxi.js');

const run = (fleet, rides, until, step = 250) => { for (let now = 0; now <= until; now += step) { for (const r of rides.filter((x) => x.at === now)) r.out = X.takeCar(fleet, r.from, r.ride = { from: r.from, startedAt: now, runMs: 3000 }, now); X.settle(fleet, now); check(fleet); } };
const check = (fleet) => { for (const id of Object.keys(X.STOPS)) { const st = X.standingAt(fleet, id); assert.ok(st.length <= 2); assert.equal(new Set(st.map((c) => c.place)).size, st.length, `${id}: one car a place`); assert.ok(X.countAt(fleet, id) <= 3); } assert.equal(fleet.cars.length, 6); /* (1.10.397: three terminals) */ };
const standing = (fleet) => Object.keys(X.STOPS).map((id) => X.standingAt(fleet, id).length).join('/');

test('택시 N4-a: 종점마다 2대, 앞 차가 떠나면 뒤 차가 당겨 섬', () => {
  const f = X.createFleet(0); assert.equal(standing(f), '2/2/2');
  const r = X.takeCar(f, 'plaza', { from: 'plaza', startedAt: 0, runMs: 3000 }, 0); assert.equal(r.car.id, 't1');
  const st = X.standingAt(f, 'plaza'); assert.equal(st.length, 1); assert.equal(st[0].place, 0, 'pulled up'); assert.ok(st[0].pulledAt === 0 || st[0].pulledAt >= 0);
  assert.equal(r.car.ride.stay, undefined, 'decided as the rider gets out');
  for (let now = 0; now < X.durationOf(r.car.ride) + 100; now += 100) X.settle(f, now);
  assert.equal(r.car.ride.stay, false, 'isle has two: back empty'); assert.equal(r.car.ride.park, 1, 'home: the place behind');
  const f2 = X.createFleet(0); const r2 = X.takeCar(f2, 'plaza', { from: 'plaza', startedAt: 0, runMs: 3000 }, 0); r2.undo(); assert.equal(standing(f2), '2/2/2'); assert.equal(X.standingAt(f2, 'plaza')[0].id, 't1');
  return; assert.equal(standing(f), '2/2/2'); assert.equal(X.standingAt(f, 'plaza')[0].id, 't1');
});
test('택시 N4-a: 한쪽에서만 타면 빈 차로 돌아와 2/2, 엇갈려 타면 둘 다 머물러 2/2, 연달아 둘이면 둘째도 바로', () => {
  { const f = X.createFleet(0); const rides = [{ at: 0, from: 'plaza' }]; run(f, rides, 60000); assert.equal(standing(f), '2/2/2'); }
  { const f = X.createFleet(0); const rides = [{ at: 0, from: 'plaza' }, { at: 0, from: 'isle' }]; run(f, rides, 60000); assert.ok(rides.every((r) => r.ride.stay), 'crossed: both stay'); assert.equal(standing(f), '2/2/2'); }
  { const f = X.createFleet(0); const rides = [{ at: 0, from: 'plaza' }, { at: 500, from: 'plaza' }, { at: 1000, from: 'plaza' }]; run(f, rides, 90000);
    assert.ok(rides[0].out && rides[1].out, 'two cars'); assert.equal(rides[2].out, null, 'the third: none standing'); assert.equal(standing(f), '2/2/2'); }
});
test('택시 N4-a 차선: 길 가운데에서 오른쪽 1.15 m, 양끝 8 m와 다리 위는 가운데로', () => {
  const t = X.tableOf('plaza'); const mid = t.offs[Math.floor(t.offs.length / 3)]; assert.ok(Math.abs(mid - X.LANE) < 1e-9);
  assert.equal(t.offs[0], 0); assert.equal(t.offs[t.offs.length - 1], 0);
  t.road.forEach(([x, z], i) => { if (X.onBridgeBox(x, z)) assert.equal(t.offs[i], 0, `on the bridge ${x},${z}`); });
  // going and coming back pass each other: at the same point of the road, 2.3 m apart
  const ride = { from: 'plaza', startedAt: 0 }; const d = t.total / 3; let pTo = null; for (let ms = 0; ms < X.durationOf(ride); ms += 50) { const p = X.poseAt(ride, ms); if (p.d >= d) { pTo = p; break; } }
  const back = { from: 'plaza', startedAt: 0 }; const T0 = X.durationOf(back) + X.TURN; let pBack = null; for (let ms = T0; ms < T0 + 60000; ms += 50) { const p = X.carAt(back, ms); if (p && p.phase === 'back' && p.d <= d) { pBack = p; break; } }
  assert.ok(pTo && pBack); assert.ok(Math.abs(Math.hypot(pTo.x - pBack.x, pTo.z - pBack.z) - 2 * X.LANE) < 0.6, `${Math.hypot(pTo.x - pBack.x, pTo.z - pBack.z)}`);
});

// 1.10.397 N4-c (notes n4-plan §5-3): the third terminal 별마루섬 입구 at EXT's end -- every two places a drive with no gap, at the drive's end the
// place it is to; the road between them along the trunk (마을's spur added); on both one-lane bridges and through the wide gate the lane's middle
test('택시 N4-c: 세 번째 종점·정류장 ⑥⑦ — 모든 두 자리 사이 길(끊김 없음, 끝은 그 자리), 거리·요금, 두 한 줄 다리는 가운데', () => {
  const ids = X.PLACE_IDS(); assert.deepEqual(ids.slice(-3), ['villageMid', 'villageEast', 'head']); assert.ok(ids.includes('isle'));
  assert.equal(Math.round(X.distanceOf('plaza', 'isle') * 10) / 10, Math.round(X.ROAD_LEN * 10) / 10, 'the two old ends as before');
  assert.ok(Math.abs(X.distanceOf('plaza', 'head') - X.TRUNK_LEN) < 1e-9); assert.ok(Math.abs(X.distanceOf('isle', 'head') - (X.TRUNK_LEN - X.sOf('isle') + X.SPUR)) < 1e-9);
  assert.equal(X.fareByRoad('plaza', 'isle'), 1000); assert.equal(X.fareByRoad('plaza', 'head'), 1750);
  for (const a of ids) for (const b of ids) { if (a === b) continue;
    const road = X.driveBetween(a, b); for (let i = 1; i < road.length; i += 1) assert.ok(Math.hypot(road[i][0] - road[i - 1][0], road[i][1] - road[i - 1][1]) < 20, `${a}->${b} a gap at ${i}`);
    const end = road[road.length - 1]; const want = X.isTerminal(b) ? X.dropOf(b) : X.curbOf(b); assert.ok(Math.hypot(end[0] - want.x, end[1] - want.z) < 1e-6, `${a}->${b} ends there`);
    const t = X.tableOf(a, 0, b); assert.ok(t.total > 0 && Number.isFinite(t.runMs)); }
  const t = X.tableOf('plaza', 0, 'head');
  const offAt = (x, z) => { let best = null; t.road.forEach(([px, pz], i) => { const e = Math.hypot(px - x, pz - z); if (!best || e < best.e) best = { e, o: t.offs[i] }; }); return best.o; };
  assert.equal(offAt(196, 226), 0, '별마루다리: the middle'); assert.equal(offAt(228.2, 225.9), 0, 'through the wide gate: the middle'); assert.equal(offAt(59, 140), 0, '윤슬다리: the middle');
  assert.ok(offAt(30, 236) > 1, 'the village street: its own lane');
  assert.equal(X.bridgeOf(196, 226), 1); assert.equal(X.bridgeOf(59, 140), 0); assert.equal(X.bridgeOf(30, 236), -1);
});

// 1.10.403 문제 기록 6d2679c4·de84f895 (notes issues-taxi-resident-20261122 ⑤): the car behind pulled up while the front one still stood for its
// rider -- 1.6 s in one place. Drawn as a screen draws it (from its place behind, eased over 2 s from pulledAt), the two stay a car's length apart
test('택시 ⑤: 뒤 차는 앞 차가 빠진 뒤에 당겨 섬 — 두 차가 겹치지 않음', () => {
  const sm = (k) => { const t = Math.min(1, Math.max(0, k)); return t * t * (3 - 2 * t); };
  for (const [from, to, extra] of [['plaza', 'head', {}], ['isle', 'plaza', {}], ['plaza', 'dock', { empty: true }]]) {
    const fleet = X.createFleet(0); const ride = { from, to, startedAt: 1000, ...extra }; const took = X.takeCar(fleet, from, ride, 1000);
    const back = fleet.cars.find((c) => !c.ride && c.at === from && c.place === 0); assert.ok(back, 'the one behind now has the front place');
    assert.equal(back.pulledAt, 1000 + X.PULL_AFTER(ride));
    const f = X.placeOf(from, 1); const q = X.placeOf(from, 0); let least = Infinity;
    for (let t = 1000; t <= back.pulledAt + 2500; t += 20) { const k = sm((t - back.pulledAt) / 2000); const r = { x: f.x + (q.x - f.x) * k, z: f.z + (q.z - f.z) * k }; const a = X.carAt(took.car.ride, t); least = Math.min(least, Math.hypot(a.x - r.x, a.z - r.z)); }
    assert.ok(least >= 4.4, `${from}: ${least.toFixed(2)} m at the closest`);
  }
});

// 1.10.404 문제 기록 de84f895 (notes issues-taxi-resident §12): a car staying at a terminal goes into its place front first -- never more than 20°
// between where it faces and where it goes, 2 m and more from the shelter's middle line, and it ends in its place facing the road
test('택시 종점: 내려 준 뒤 서는 자리로 갈 때 차 앞이 가는 방향, 쉼터를 돌아 뒤에서 들어감', () => {
  for (const id of Object.keys(X.STOPS)) for (const place of [0, 1]) {
    const s = X.stopOf(id); const sh = s.shelter; const fx = Math.sin(s.yaw); const fz = Math.cos(s.yaw); let last = X.parkPose(id, place, 0);
    for (let i = 1; i <= 200; i += 1) {
      const p = X.parkPose(id, place, i / 200); const mx = p.x - last.x; const mz = p.z - last.z; const step = Math.hypot(mx, mz);
      if (step > 0.01) { const off = Math.abs(Math.atan2(Math.sin(Math.atan2(mx, mz) - p.yaw), Math.cos(Math.atan2(mx, mz) - p.yaw))) * 180 / Math.PI; assert.ok(off < 20, `${id} ${place}: ${off.toFixed(0)}° at ${i}`); }
      const t = Math.max(-1.45, Math.min(1.45, (p.x - sh.x) * fx + (p.z - sh.z) * fz)); const gap = Math.hypot(p.x - sh.x - fx * t, p.z - sh.z - fz * t); assert.ok(gap > 2, `${id} ${place}: ${gap.toFixed(2)} m from the shelter at ${i}`);
      last = p;
    }
    const end = X.parkPose(id, place, 1); const q = X.placeOf(id, place); assert.ok(Math.hypot(end.x - q.x, end.z - q.z) < 0.01, `${id} ${place}: in its place`); assert.ok(Math.abs(Math.atan2(Math.sin(end.yaw - q.yaw), Math.cos(end.yaw - q.yaw))) < 0.01, 'facing the road');
  }
});

// 1.10.403 Codex 391~400 #10: 마을's two cars off to the full 별마루섬 입구 while 대청마당's two stay at 마을 -- the two coming back from 입구 went to
// 마을's taken places (two cars a place) and 대청마당 had none. Now they go where there is room
test('택시 Codex #10: 돌아갈 종점이 찼으면 빈자리 있는 가까운 종점으로 — 한 자리에 두 대 없음', () => {
  const fleet = X.createFleet(0); const rides = [];
  for (const [from, to] of [['plaza', 'isle'], ['plaza', 'isle'], ['isle', 'head'], ['isle', 'head']]) { const ride = { from, to, startedAt: 0, runMs: 3000 }; assert.ok(X.takeCar(fleet, from, ride, 0)); rides.push(ride); }
  for (let now = 0; now <= 60000; now += 250) { X.settle(fleet, now); check(fleet); }
  assert.equal(standing(fleet), '2/2/2', '종점마다 두 대');
});

// 1.10.403 Codex 391~400 #2: A's fare pending, B takes the car pulled up; A's fare refused -- A's undo put the whole fleet back as it stood,
// B's car with it (B charged, their car standing again). Now only A's car goes back
test('택시 Codex #2: 결제 실패 되돌리기는 내 차만 — 그사이 남이 탄 차는 그대로', () => {
  const fleet = X.createFleet(0); const rideA = { from: 'plaza', to: 'head', startedAt: 1000 }; const a = X.takeCar(fleet, 'plaza', rideA, 1000);
  const rideB = { from: 'plaza', to: 'isle', startedAt: 1200 }; const b = X.takeCar(fleet, 'plaza', rideB, 1200); assert.ok(b && b.car !== a.car);
  a.undo();
  assert.equal(b.car.ride, rideB, "B's car still out with B"); assert.equal(rideB.car, b.car.id);
  assert.equal(a.car.ride, null); assert.equal(a.car.at, 'plaza'); assert.equal(X.standingAt(fleet, 'plaza').length, 1); assert.equal(X.standingAt(fleet, 'plaza')[0].place, 0);
  check(fleet);
  // undone before anyone else came: both back as they were, the one behind behind again
  const f2 = X.createFleet(0); const before = JSON.stringify(f2.cars); const t = X.takeCar(f2, 'isle', { from: 'isle', to: 'plaza', startedAt: 500 }, 500); t.undo();
  assert.equal(JSON.stringify(f2.cars), before);
});

// 1.10.401 Codex 391~400 #1: the server's tick looks ahead on the ride's own table clock -- that copy kept only from and startedAt, so a ride
// from a stop between the terminals (박물관 …) had no end and curbOf(undefined) threw, stopping the server; an empty car fetching a caller
// there and going back the same. timeless keeps where it goes, leaves out only the waits and the aside
test('택시 Codex #1: 중간 정류장 출발·빈 차 복귀를 미리 보는 운행이 목적지를 잃지 않음', () => {
  const ends = ['plaza', 'isle', 'head'];
  for (const from of Object.keys(X.ROADSTOPS)) for (const to of ends) for (const extra of [{}, { empty: true, stay: false, park: 0 }]) {
    const ride = { from, to, startedAt: 1000, ...extra, warp: { at: 5000, tau: 5000, r0: 1, r1: 0, ms: 700 }, side: { at: 5000, from: 0, to: 0.8, ms: 700 }, ghost: { at: 6000, until: null } };
    assert.throws(() => X.carAt({ from: ride.from, startedAt: ride.startedAt }, 4000), `${from}: the old copy had no end`);
    const bare = X.timeless(ride);
    assert.deepEqual(Object.keys(bare).sort(), Object.keys({ from, to, startedAt: 1, ...extra }).sort(), 'no clock or aside');
    const clean = { from, to, startedAt: 1000, ...extra };
    for (const t of [1000, 4000, 20000, 60000, 200000]) assert.deepEqual(X.carAt(bare, t), X.carAt(clean, t), `${from} → ${to} at ${t}`);
  }
});
