'use strict';
// 1.10.412 L3 「섬 한 바퀴」 (사용자 결정 69 A, notes docs/taxi-island-loop-20261122.md §5 · §6): the ring closed over the west 윤슬다리 -- a ride back where
// one got in, once round it with 윤슬만 on the car's right; from a place off the ring out along its spur and back; its fare by its own length
const test = require('node:test');
const assert = require('node:assert/strict');
globalThis.GC_ISLAND_MAP = 'dalmaru';
require('../public/plaza/island-terrain.js');
const X = require('../public/plaza/island-taxi.js');

test('섬 한 바퀴: 고리 610 m, 윤슬만이 차 오른쪽, 탄 곳으로 돌아옴(같은 쪽 연석), 곁가지는 나갔다 돌아옴, 요금은 제 길이', () => {
  const R = X.RING; assert.ok(R); assert.ok(Math.abs(R.len - 610.2) < 1, `ring ${R.len}`);
  const inside = (x, z) => { let c = false; const p = R.pts; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, zi] = p[i]; const [xj, zj] = p[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
  let right = 0; let n = 0; for (let i = 1; i < R.pts.length; i += 1) { const [ax, az] = R.pts[i - 1]; const [bx, bz] = R.pts[i]; const L = Math.hypot(bx - ax, bz - az); if (L < 2) continue; n += 1; if (inside((ax + bx) / 2 + ((bz - az) / L) * 6, (az + bz) / 2 - ((bx - ax) / L) * 6)) right += 1; }
  assert.ok(right / n > 0.9, `the bay on the right ${right}/${n}`);
  for (const id of X.PLACE_IDS()) {
    const road = X.driveBetween(id, id); for (let i = 1; i < road.length; i += 1) assert.ok(Math.hypot(road[i][0] - road[i - 1][0], road[i][1] - road[i - 1][1]) < 20, `${id} a gap at ${i}`);
    const end = road[road.length - 1]; const want = X.isTerminal(id) ? X.dropOf(id) : X.curbOf(id, X.arriveSide(id, id)); assert.ok(Math.hypot(end[0] - want.x, end[1] - want.z) < 1e-6, `${id} back there`);
    assert.ok(X.loopLenOf(id) >= R.len - 1e-6, `${id} once round at least`); assert.equal(X.fareByRoad(id, id), Math.max(500, 250 * Math.round(X.loopLenOf(id) / 100)));
    assert.equal(X.distanceOf(id, id), 0, 'distanceOf itself stays 0 (the nearest terminal)');
    const t = X.tableOf(id, undefined, id); assert.ok(t.total > R.len - 20 && Number.isFinite(t.runMs), `${id} its table`);
  }
  for (const id of Object.keys(X.ROADSTOPS)) if (X.RING.pieces.has(X.footOn(X.curbOf(id).x, X.curbOf(id).z).piece)) assert.equal(X.leaveSide(id, id), X.arriveSide(id, id), `${id} on the ring: off and back on one side`);
  assert.equal(X.fareByRoad('plaza', 'plaza'), 1750, '대청마당: its spur, round, back (§6 about 695 m)'); assert.equal(X.fareByRoad('dock', 'dock'), 1500, 'on the ring: 610 m');
  /* (a car back from a loop is never sent empty once round again: the nearest room is another terminal) */
  for (const t of ['plaza', 'isle', 'head']) assert.notEqual(X.nearestRoom(X.createFleet(0), t), t, `${t}: not round again`);
});
