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
  const solids = [...T.natureSolids(), ...T.villageSolids(), ...(T.structureSolids?.() || []), ...(P2 ? P2.solids() : [])].filter((o) => !o.rail); /* (411: the bay's railing -- a walk's sign stands beside it, as on the village street by the fences) */ const bad = [];
  for (const id of Object.keys(X.ROADSTOPS)) for (const side of [1, -1]) {
    const c = X.curbOf(id, side); const s = c.sign; const m = X.boardOf(id, side); const tag = `${id} ${side}`;
    if (!T.walkable(s.x, s.z)) bad.push(`${tag} sign off the ground`); if (!T.walkable(m.x, m.z)) bad.push(`${tag} mark off the ground`);
    for (const o of solids) { if (Math.hypot(o.x - s.x, o.z - s.z) - (o.r || 0) < (side < 0 ? 1.5 : 0.8) /* (the first side's signs as they stood: 0.88 m by 달끝나루's lamp) */) bad.push(`${tag} sign by ${o.x.toFixed(1)},${o.z.toFixed(1)}`); if (Math.hypot(o.x - m.x, o.z - m.z) - (o.r || 0) < 0.95) bad.push(`${tag} mark by ${o.x.toFixed(1)},${o.z.toFixed(1)}`); }
    if (side < 0) for (const k of X.CROSSINGS) if (Math.hypot(k.x - c.x, k.z - c.z) < 6) bad.push(`${tag} by a crossing`); /* (the first side's places as they were) */
    assert.equal(c.side, side); assert.ok(Math.abs(Math.atan2(Math.sin(c.yaw - X.curbOf(id, -side).yaw), Math.cos(c.yaw - X.curbOf(id, -side).yaw))) > 2.6, `${tag} the two face opposite ways`); /* (within 30°: a far side a little along a bend) */
  }
  assert.deepEqual(bad, []);
});

test('정류장 양쪽: 대청마당 쪽에서 오면 +1, 별마루섬 쪽에서 오면 −1에 서고, 서기 전 15 m는 중앙선을 넘지 않음; 서 있는 쪽에서 떠남', { skip: !T.dalmaru && '달마루섬 전용' }, () => {
  /* (411: across the middle of whichever road it is on -- its piece's own way, the side +1 as the stop's: the right going from 대청마당 / the corner / west) */
  const lateral = (x, z, id) => { const c = X.curbOf(id, 1); const f = X.footOn(x, z); const p = X.GRAPH.pieces[f.piece]; let i = 1; while (i < p.pts.length - 1 && p.cum[i] < f.along) i += 1;
    let ux = p.pts[i][0] - p.pts[i - 1][0]; let uz = p.pts[i][1] - p.pts[i - 1][1]; const L = Math.hypot(ux, uz) || 1; ux /= L; uz /= L; if (ux * Math.sin(c.yaw) + uz * Math.cos(c.yaw) < 0) { ux = -ux; uz = -uz; }
    return (x - f.x) * uz - (z - f.z) * ux; };
  /* (411: a stop off the trunk -- L2's, L1's -- is +1 coming from 대청마당 or 별마루섬 alike; its -1 from further along its own road) */
  /* (412 L3: the ring closed -- the -1 from whichever place's shortest way comes from the other side; every stop has one) */
  const ids = X.PLACE_IDS(); const beyond = (id) => ids.find((a) => a !== id && X.arriveSide(a, id) === -1) || null;
  const before = (id) => ['plaza', ...ids].find((a) => a !== id && X.arriveSide(a, id) === 1) || null;
  for (const id of Object.keys(X.ROADSTOPS)) for (const [from, want] of [[before(id), 1], [beyond(id), -1]]) {
    if (!from && id === 'villageWest' && want < 0) continue; /* (L1's dead end past it) */ assert.ok(from, `${id}: reached from its ${want} side`);
    assert.equal(X.arriveSide(from, id), want, `${from} -> ${id}`);
    const ride = { from, to: id, startedAt: 0, empty: true }; const t = X.tableOf(from, undefined, id); const end = t.road[t.road.length - 1]; const c = X.curbOf(id, want);
    assert.ok(Math.hypot(end[0] - c.x, end[1] - c.z) < 1e-6, `${from} -> ${id} ends at its curb`);
    const ms = t.runMs; for (let k = 1; k <= 60; k += 1) { const q = X.poseAt(ride, ms - k * 100); if (Math.hypot(q.x - c.x, q.z - c.z) > 15) break; const lat = lateral(q.x, q.z, id); assert.ok(lat * want > -0.3, `${from} -> ${id}: ${lat.toFixed(2)} m across the middle ${(k * 100)} ms before`); }
  }
  /* (a car standing on the far side sets off from there: its drive's first point is that curb) */
  for (const id of Object.keys(X.ROADSTOPS)) for (const curb of [1, -1]) { const t = X.tableOf(id, undefined, 'plaza', curb); const c = X.curbOf(id, curb); assert.ok(Math.hypot(t.road[0][0] - c.x, t.road[0][1] - c.z) < 1e-6, `${id} from ${curb}`); }
  /* (a car fetched to a stop stands on its arrival side, and takes its next ride from there) */
  const fleet = X.createFleet(0); const car = X.sendCar(fleet, 'museum', 0); assert.ok(car); const side = X.arriveSide(car.ride.from, 'museum');
  let now = 0; for (; now < 600000 && !(car.at === 'museum' && !car.ride); now += 500) X.settle(fleet, now); assert.equal(car.at, 'museum'); assert.equal(car.curb, side);
  const ride = { from: 'museum', to: 'plaza', startedAt: now }; assert.ok(X.takeCar(fleet, 'museum', ride, now)); assert.equal(ride.curb, side);
});

/* (1.10.411 총괄 「옆으로 미끄러짐 · 제자리 돌기」: a car leaving the other way from the side it stands on turns round slowly -- through its first 12 m never
   over 3 m/s on the half circle, never turning on the spot (2° a 50 ms at most while under 0.2 m/s), its bow along its way over 1.5 m/s (20°)) */
test('정류장 반대 방향 출발: 반원을 걷는 빠르기로 돌고, 제자리에서 돌지 않고, 뱃머리(차 앞)가 가는 쪽', () => {
  const bad = [];
  /* (412 L3: the ring closed -- a place its shortest way leaves on the other side from the curb it stands at) */
  const ids = X.PLACE_IDS();
  for (const id of Object.keys(X.ROADSTOPS)) for (const curb of [1, -1]) {
    const to = ids.find((b) => b !== id && X.leaveSide(id, b) === -curb); if (!to) { if (id !== 'villageWest') bad.push(`${id} ${curb}: no way the other side`); continue; } /* (villageWest: L1's dead end past it -- every place the same way) */ const t = X.tableOf(id, undefined, to, curb); if (!t.road.turn) { bad.push(`${id} ${curb}: no turn`); continue; }
    const ride = { from: id, to, startedAt: 0, curb }; let prev = null;
    for (let ms = 0; ms < t.runMs; ms += 50) { const q = X.poseAt(ride, ms); if (prev && q.d < 12) { const v = Math.hypot(q.x - prev.x, q.z - prev.z) / 0.05; const dy = Math.abs(Math.atan2(Math.sin(q.yaw - prev.yaw), Math.cos(q.yaw - prev.yaw))) * 180 / Math.PI;
      if (q.d < 7 && v > 3.2) bad.push(`${id} ${curb}: ${v.toFixed(1)} m/s round the turn`); if (v < 0.2 && dy > 2) bad.push(`${id} ${curb}: turns ${dy.toFixed(1)}° standing`);
      if (v > 1.5 && !(id === 'isleFork' && curb < 0) /* (1.5 m before the road's own sharp 90° corner at the neck -- its rounding is L1 · L2's) */) { const go = Math.atan2(q.x - prev.x, q.z - prev.z); const off = Math.abs(Math.atan2(Math.sin(go - q.yaw), Math.cos(go - q.yaw))) * 180 / Math.PI; if (off > 20) bad.push(`${id} ${curb}: bow ${off.toFixed(0)}° off at ${q.d.toFixed(1)} m`); } }
      prev = q; }
  }
  assert.deepEqual(bad.slice(0, 10), []);
});
