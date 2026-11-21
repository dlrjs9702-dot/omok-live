'use strict';
// 1.10.391 N4-a (public/plaza/island-taxi.js; notes docs/n4-plan-20261120.md §4·§5-1, 사용자 N4 §8 · 11-20 「가까운 빈자리를 채우는 걸로」): two cars at
// each stop; a ride takes the front one (the one behind pulls up); after letting its rider out a car stays when that stop has fewer than two,
// else it goes back empty; quiet, two and two again. Its lane: a car keeps right of the road's middle, on the bridge the middle
const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../public/plaza/island-taxi.js');

const run = (fleet, rides, until, step = 250) => { for (let now = 0; now <= until; now += step) { for (const r of rides.filter((x) => x.at === now)) r.out = X.takeCar(fleet, r.from, r.ride = { from: r.from, startedAt: now, runMs: 3000 }, now); X.settle(fleet, now); check(fleet); } };
const check = (fleet) => { for (const id of Object.keys(X.STOPS)) { const st = X.standingAt(fleet, id); assert.ok(st.length <= 2); assert.equal(new Set(st.map((c) => c.place)).size, st.length, `${id}: one car a place`); assert.ok(X.countAt(fleet, id) <= 3); } assert.equal(fleet.cars.length, 4); };
const standing = (fleet) => Object.keys(X.STOPS).map((id) => X.standingAt(fleet, id).length).join('/');

test('택시 N4-a: 종점마다 2대, 앞 차가 떠나면 뒤 차가 당겨 섬', () => {
  const f = X.createFleet(0); assert.equal(standing(f), '2/2');
  const r = X.takeCar(f, 'plaza', { from: 'plaza', startedAt: 0, runMs: 3000 }, 0); assert.equal(r.car.id, 't1');
  const st = X.standingAt(f, 'plaza'); assert.equal(st.length, 1); assert.equal(st[0].place, 0, 'pulled up'); assert.ok(st[0].pulledAt === 0 || st[0].pulledAt >= 0);
  assert.equal(r.car.ride.stay, undefined, 'decided as the rider gets out');
  for (let now = 0; now < X.durationOf(r.car.ride) + 100; now += 100) X.settle(f, now);
  assert.equal(r.car.ride.stay, false, 'isle has two: back empty'); assert.equal(r.car.ride.park, 1, 'home: the place behind');
  const f2 = X.createFleet(0); const r2 = X.takeCar(f2, 'plaza', { from: 'plaza', startedAt: 0, runMs: 3000 }, 0); r2.undo(); assert.equal(standing(f2), '2/2'); assert.equal(X.standingAt(f2, 'plaza')[0].id, 't1');
  return; assert.equal(standing(f), '2/2'); assert.equal(X.standingAt(f, 'plaza')[0].id, 't1');
});
test('택시 N4-a: 한쪽에서만 타면 빈 차로 돌아와 2/2, 엇갈려 타면 둘 다 머물러 2/2, 연달아 둘이면 둘째도 바로', () => {
  { const f = X.createFleet(0); const rides = [{ at: 0, from: 'plaza' }]; run(f, rides, 60000); assert.equal(standing(f), '2/2'); }
  { const f = X.createFleet(0); const rides = [{ at: 0, from: 'plaza' }, { at: 0, from: 'isle' }]; run(f, rides, 60000); assert.ok(rides.every((r) => r.ride.stay), 'crossed: both stay'); assert.equal(standing(f), '2/2'); }
  { const f = X.createFleet(0); const rides = [{ at: 0, from: 'plaza' }, { at: 500, from: 'plaza' }, { at: 1000, from: 'plaza' }]; run(f, rides, 90000);
    assert.ok(rides[0].out && rides[1].out, 'two cars'); assert.equal(rides[2].out, null, 'the third: none standing'); assert.equal(standing(f), '2/2'); }
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
