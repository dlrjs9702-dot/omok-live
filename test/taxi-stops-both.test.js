'use strict';
// 1.10.410 사용자 결정 65-3 A (notes docs/issues-taxi-resident-20261122.md §3): every road stop on both sides of the road -- a sign and a mark each
// side, walkable and clear; a car comes in on its own way's side (from 대청마당 the +1 curb, from 별마루섬 the -1), never across the middle line,
// and sets off from the side it stands on
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain.js'); require('../public/plaza/island-train.js');
const X = require('../public/plaza/island-taxi.js');
const P2 = (() => { try { return require('../public/plaza/isle2-props.js'); } catch { return null; } })();

test('정류장 양쪽: 표지 · 바닥 표시 둘씩 걸을 수 있는 땅, 표지 1.5 m · 표시 0.95 m 안 단단한 것 없음, 건너편 차 자리는 건널목에서 6 m 밖', { skip: !T.dalmaru && '달마루섬 전용' }, () => {
  const solids = [...T.natureSolids(), ...T.villageSolids(), ...(T.structureSolids?.() || []), ...(P2 ? P2.solids() : [])]; const bad = [];
  for (const id of Object.keys(X.ROADSTOPS)) for (const side of [1, -1]) {
    const c = X.curbOf(id, side); const s = c.sign; const m = X.boardOf(id, side); const tag = `${id} ${side}`;
    if (!T.walkable(s.x, s.z)) bad.push(`${tag} sign off the ground`); if (!T.walkable(m.x, m.z)) bad.push(`${tag} mark off the ground`);
    for (const o of solids) { if (Math.hypot(o.x - s.x, o.z - s.z) - (o.r || 0) < (side < 0 ? 1.5 : 0.8) /* (the first side's signs as they stood: 0.88 m by 달끝나루's lamp) */) bad.push(`${tag} sign by ${o.x.toFixed(1)},${o.z.toFixed(1)}`); if (Math.hypot(o.x - m.x, o.z - m.z) - (o.r || 0) < 0.95) bad.push(`${tag} mark by ${o.x.toFixed(1)},${o.z.toFixed(1)}`); }
    if (side < 0) for (const k of X.CROSSINGS) if (Math.hypot(k.x - c.x, k.z - c.z) < 6) bad.push(`${tag} by a crossing`); /* (the first side's places as they were) */
    assert.equal(c.side, side); assert.ok(Math.abs(Math.atan2(Math.sin(c.yaw - X.curbOf(id, -side).yaw), Math.cos(c.yaw - X.curbOf(id, -side).yaw))) > 3, `${tag} the two face opposite ways`);
  }
  assert.deepEqual(bad, []);
});

test('정류장 양쪽: 대청마당 쪽에서 오면 +1, 별마루섬 쪽에서 오면 −1에 서고, 서기 전 15 m는 중앙선을 넘지 않음; 서 있는 쪽에서 떠남', { skip: !T.dalmaru && '달마루섬 전용' }, () => {
  const lateral = (x, z) => { const f = X.footOn(x, z); let best = null; for (let s = 0; s <= X.TRUNK_LEN; s += 0.5) { const p = X.atS(s); const d = Math.hypot(p.x - f.x, p.z - f.z); if (!best || d < best.d) best = { d, p }; } const p = best.p; return (x - p.x) * Math.cos(p.yaw) - (z - p.z) * Math.sin(p.yaw); };
  for (const id of Object.keys(X.ROADSTOPS)) for (const [from, want] of [['plaza', 1], ['head', -1]]) {
    assert.equal(X.arriveSide(from, id), want, `${from} -> ${id}`);
    const ride = { from, to: id, startedAt: 0, empty: true }; const t = X.tableOf(from, undefined, id); const end = t.road[t.road.length - 1]; const c = X.curbOf(id, want);
    assert.ok(Math.hypot(end[0] - c.x, end[1] - c.z) < 1e-6, `${from} -> ${id} ends at its curb`);
    const ms = t.runMs; for (let k = 1; k <= 60; k += 1) { const q = X.poseAt(ride, ms - k * 100); if (Math.hypot(q.x - c.x, q.z - c.z) > 15) break; const lat = lateral(q.x, q.z); assert.ok(lat * want > -0.3, `${from} -> ${id}: ${lat.toFixed(2)} m across the middle ${(k * 100)} ms before`); }
  }
  /* (a car standing on the far side sets off from there: its drive's first point is that curb) */
  for (const id of Object.keys(X.ROADSTOPS)) for (const curb of [1, -1]) { const t = X.tableOf(id, undefined, 'plaza', curb); const c = X.curbOf(id, curb); assert.ok(Math.hypot(t.road[0][0] - c.x, t.road[0][1] - c.z) < 1e-6, `${id} from ${curb}`); }
  /* (a car fetched to a stop stands on its arrival side, and takes its next ride from there) */
  const fleet = X.createFleet(0); const car = X.sendCar(fleet, 'museum', 0); assert.ok(car); const side = X.arriveSide(car.ride.from, 'museum');
  let now = 0; for (; now < 600000 && !(car.at === 'museum' && !car.ride); now += 500) X.settle(fleet, now); assert.equal(car.at, 'museum'); assert.equal(car.curb, side);
  const ride = { from: 'museum', to: 'plaza', startedAt: now }; assert.ok(X.takeCar(fleet, 'museum', ride, now)); assert.equal(ride.curb, side);
});
