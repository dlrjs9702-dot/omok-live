'use strict';
// 1.10.392 N4-b 「택시 부르기」 (notes docs/n4-plan-20261120.md §4·§5-2·§5-5, 결정 40 A): at a road stop with no car -- a call sends the nearest
// car standing at a terminal empty; once there, 「어디로 갈까요?」 lists every place with its fare by the road's length (250P a 100 m, 500P at
// least); a ride from the stop to another stop, the car then off empty to the nearest terminal with room. A caller walked off is let go
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');
const X = require('../public/plaza/island-taxi');
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

test('택시 부르기: 정류장에서 부르면 가까운 차가 빈 차로 옴 → 정류장끼리 타기(거리 요금) → 내려 준 차는 가까운 빈 종점으로, 자리를 뜨면 부름 취소', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'taxi-call-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('부르는이')); const b = await server.enter(await server.issue('떠나는이'));
  for (const who of [a, b]) await req('/api/test/points-credit', who, { amount: 100000 });
  await req('/api/test/taxi-run', a, { ms: 3000 });
  const stand = (who, x, z) => req('/api/plaza/state', who, { x, z, yaw: 0, moving: false });
  const balance = async (who) => (await req('/api/skins', who)).data.balance;
  const dock = X.curbOf('dock'); const board = X.boardOf('dock');
  // no car at the stop: the window says so; far from its sign, no call
  await stand(a, board.x, board.z); const q = (await req('/api/island/taxi?from=dock', a)).data;
  assert.equal(q.cars, 0); assert.deepEqual(q.dests.map((d) => d.id), X.PLACE_IDS().filter((id) => id !== 'dock'));
  assert.deepEqual(q.dests.map((d) => d.fare), q.dests.map((d) => Math.max(500, 250 * Math.round(X.distanceOf('dock', d.id) / 100))), 'fares by the road');
  assert.equal((await req('/api/island/taxi', a, { from: 'dock', to: 'museum' })).data.error, 'TAXI_AWAY', 'no car standing: none to get in');
  await stand(b, dock.sign.x + 12, dock.sign.z); assert.equal((await req('/api/island/taxi/call', b, { stop: 'dock' })).data.error, 'TOO_FAR');
  // the call: the nearest terminal's front car comes (대청마당 -- 52 m), its seconds said
  const called = await req('/api/island/taxi/call', a, { stop: 'dock' }); assert.equal(called.status, 200, JSON.stringify(called.data)); assert.equal(called.data.ready, false); assert.equal(called.data.queued, false); assert.ok(called.data.etaS > 0);
  const coming = (await stand(a, board.x, board.z)).data.taxiStops.cars.find((c) => c.ride?.empty); assert.equal(coming.ride.from, 'plaza'); assert.equal(coming.ride.to, 'dock');
  await sleep(X.durationOf(coming.ride) + X.TURN + 400); await stand(a, board.x, board.z);
  assert.equal((await req('/api/island/taxi?from=dock', a)).data.cars, 1, 'it stands at the stop');
  // to 박물관: the fare by the road (125 m -> 500P)
  const before = await balance(a); const rode = await req('/api/island/taxi', a, { from: 'dock', to: 'museum' }); assert.equal(rode.status, 200, JSON.stringify(rode.data));
  assert.equal(rode.data.fare, X.fareByRoad('dock', 'museum')); assert.equal(await balance(a), before - rode.data.fare); assert.equal(rode.data.taxi.to, 'museum');
  await sleep(X.durationOf(rode.data.taxi) + 400); const done = await stand(a, 0, 0);
  const out = X.arrivalOf(rode.data.taxi); assert.ok(Math.hypot(done.data.x - out.x, done.data.z - out.z) < 0.05, 'out by the 박물관 stop');
  // its car: off empty to the nearest terminal with room (대청마당 had one left)
  await sleep(300); const after = (await stand(a, out.x, out.z)).data.taxiStops.cars.find((c) => c.id === rode.data.taxi.car); assert.ok(after.ride?.empty && after.ride.from === 'museum' && after.ride.to === 'plaza', JSON.stringify(after));
  // a caller who walks off is let go
  await req('/api/test/taxi-run', a, { ms: 3000 }); await stand(b, X.boardOf('isleFork').x, X.boardOf('isleFork').z); assert.equal((await req('/api/island/taxi/call', b, { stop: 'isleFork' })).status, 200);
  await stand(b, X.boardOf('isleFork').x + 15, X.boardOf('isleFork').z); await sleep(400);
  assert.equal((await req('/api/island/taxi?from=isleFork', b)).data.called, null, 'walked off: the call let go');
});

// 1.10.401 Codex 391~400 #1: on the real road (no test run time) the server's tick looks ahead along each ride -- a ride from a stop between
// the terminals lost its end in that copy and threw, stopping the server
test('택시 Codex #1: 중간 정류장에서 실제 속도로 출발해도 서버가 멈추지 않음', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'taxi-mid-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('중간출발')); await req('/api/test/points-credit', a, { amount: 100000 });
  const stand = (x, z) => req('/api/plaza/state', a, { x, z, yaw: 0, moving: false });
  await req('/api/test/taxi-run', a, { ms: 3000 }); const board = X.boardOf('dock'); await stand(board.x, board.z);
  const called = await req('/api/island/taxi/call', a, { stop: 'dock' }); assert.equal(called.status, 200, JSON.stringify(called.data));
  const coming = (await stand(board.x, board.z)).data.taxiStops.cars.find((c) => c.ride?.empty); await sleep(X.durationOf(coming.ride) + X.TURN + 400); await stand(board.x, board.z);
  await req('/api/test/taxi-run', a, { ms: 0, back: false }); /* (the real road from here on, the fleet as it is) */
  const rode = await req('/api/island/taxi', a, { from: 'dock', to: 'museum' }); assert.equal(rode.status, 200, JSON.stringify(rode.data)); assert.equal(rode.data.taxi.runMs, undefined, 'on the real road');
  await sleep(1500); /* (fifteen of the server's looks ahead along it) */
  const still = await stand(board.x, board.z); assert.equal(still.status, 200, 'the server still answers');
  assert.ok(still.data.taxiStops.cars.some((c) => c.ride?.from === 'dock' && c.ride?.to === 'museum'), 'the ride on its way');
});
