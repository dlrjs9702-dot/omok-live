'use strict';
// v1.10.271 섬 택시 서버 (gamecenter-notes docs/taxi-20261104.md 2·3·5절): at the 대청마당 stop, the fare asked (1,000P with no
// home, free for a home owner), 타기 paid once; riding twice refused, far off refused, too few points refused; while riding
// the server has me on the road by its clock (what I post does not move me), and after it at the other stop's step out --
// the next visit starting there too. The tests' road is 3 s.
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');
const X = require('../public/plaza/island-taxi');
const H = require('../public/plaza/island-home');
const T = require('../public/plaza/island-terrain');
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

test('섬 택시 서버: 요금(집 없음 1,000P·집주인 무료)·한 번 차감·두 번 타기·먼 곳·포인트 부족 막기, 타는 동안 길 위, 끝나면 건너편 정류장', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'taxi-')); rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('택시손님')); const b = await server.enter(await server.issue('집주인'));
  for (const who of [a, b]) await req('/api/test/points-credit', who, { amount: 100000 });
  const stand = (who, x, z) => req('/api/plaza/state', who, { x, z, yaw: 0, moving: false });
  const balance = async (who) => (await req('/api/skins', who)).data.balance;
  const P = X.stopOf('plaza'); const I = X.stopOf('isle');
  // far off: not here
  await stand(a, P.x + 12, P.z); assert.equal((await req('/api/island/taxi', a, { from: 'plaza' })).data.error, 'TOO_FAR');
  // by the stop: 1,000P, once
  await stand(a, P.out.x, P.out.z);
  assert.deepEqual((await req('/api/island/taxi?from=plaza', a)).data, { ok: true, from: 'plaza', to: 'isle', fare: 1000, home: false, awayS: 0 });
  const before = await balance(a); const rode = await req('/api/island/taxi', a, { from: 'plaza' });
  assert.equal(rode.status, 200, JSON.stringify(rode.data)); assert.equal(rode.data.fare, 1000); assert.equal(rode.data.taxi.runMs, 3000);
  assert.equal(await balance(a), before - 1000);
  assert.equal((await req('/api/island/taxi', a, { from: 'plaza' })).data.error, 'TAXI_RIDING');
  // while riding: on the road whatever I post
  await sleep(X.ENTER + 1500); const mid = await stand(a, -50, -50);
  assert.equal(mid.data.corrected, false); assert.ok(mid.data.taxi); const want = X.poseAt(rode.data.taxi, Date.now());
  assert.ok(Math.hypot(mid.data.x - want.x, mid.data.z - want.z) < 8, JSON.stringify({ got: [mid.data.x, mid.data.z], want: [want.x, want.z] }));
  // over: at the 툇마루섬 stop's step out
  await sleep(X.durationOf(rode.data.taxi) - (X.ENTER + 1500) + 300); const done = await stand(a, -50, -50);
  const out = X.arrivalOf(rode.data.taxi); assert.deepEqual([done.data.x, done.data.z], [Math.round(out.x * 100) / 100, Math.round(out.z * 100) / 100]); void I; assert.equal(done.data.taxi, null); assert.ok(done.data.taxiDone);
  // (294 7) the stop's car on its way back empty: no car there -- refused, nothing taken; every screen told
  assert.ok(['turn', 'back'].includes(X.carAt(rode.data.taxi, Date.now())?.phase)); assert.ok(done.data.taxiStops.plaza?.startedAt === rode.data.taxi.startedAt);
  await stand(b, P.out.x + 0.5, P.out.z + 0.5); const b0 = await balance(b); const away = await req('/api/island/taxi', b, { from: 'plaza' });
  assert.equal(away.data.error, 'TAXI_AWAY'); assert.ok(away.data.awayS > 0 && away.data.awayS <= Math.ceil((X.backOf(rode.data.taxi) - Date.now()) / 1000) + 1); assert.equal(await balance(b), b0);
  assert.ok((await req('/api/island/taxi?from=plaza', b)).data.awayS > 0); await req('/api/test/taxi-run', a, { ms: 3000 }); /* (back at its stop) */
  // a home owner rides free
  const door = T.facilityDoor('townhall'); await stand(b, door.x, door.z); assert.equal((await req('/api/island/townhall/enter', b, {})).status, 200);
  const lot = H.LOTS[3]; assert.equal((await req('/api/home/apply', b, { lot: lot.id, roof: 'red' })).status, 200);
  const ex = T.roomWorld(T.TOWNHALL_ROOM.exit.lx, T.TOWNHALL_ROOM.exit.lz); await stand(b, ex.x, ex.z); await req('/api/island/townhall/leave', b, {});
  await stand(b, P.out.x + 0.5, P.out.z + 0.5); const owner = await balance(b);
  assert.equal((await req('/api/island/taxi?from=plaza', b)).data.fare, 0);
  const free = await req('/api/island/taxi', b, { from: 'plaza' }); assert.equal(free.status, 200, JSON.stringify(free.data)); assert.equal(await balance(b), owner);
  await req('/api/test/taxi-run', a, { ms: 3000 }); /* (294: its car back) */
  // the fare is the economy's (the administrator's table); more than I have: refused, nothing taken
  const c = await server.enter(await server.issue('빈손')); await stand(c, P.out.x - 0.6, P.out.z - 0.6); const has = await balance(c);
  const admin = (await req('/api/admin/login', null, { password: 'look-test' })).data.sessionToken; const fare = 1500;
  const box = T.facilityDoor('donate'); await stand(c, box.x, box.z);
  const gave = await req('/api/donation', c, { amount: has - 500, requestId: `taxi-poor-${Date.now()}` }); assert.equal(gave.status, 200, JSON.stringify(gave.data)); assert.equal(await balance(c), 500); /* (points given away: 500 left) */
  const set = await req('/api/admin/economy', admin, { changes: { 'taxi:fare': fare } }); assert.equal(set.status, 200, JSON.stringify(set.data));
  await stand(c, P.out.x - 0.6, P.out.z - 0.6); assert.equal((await req('/api/island/taxi?from=plaza', c)).data.fare, fare);
  const poor = await req('/api/island/taxi', c, { from: 'plaza' }); assert.equal(poor.data.error, 'INSUFFICIENT_POINTS'); assert.match(poor.data.message, /1,500P/); assert.equal(await balance(c), 500);
  assert.equal((await req('/api/island/taxi?from=plaza', c)).data.awayS, 0, '못 탄 사람은 차를 잡지 않음');
  // (294 7) two at once at one stop: one rides, the other is told the car is away -- and pays nothing
  const d = await server.enter(await server.issue('동시하나')); const e = await server.enter(await server.issue('동시둘')); for (const who of [d, e]) { await req('/api/test/points-credit', who, { amount: 100000 }); await stand(who, P.out.x, P.out.z); }
  const [d0, e0] = [await balance(d), await balance(e)]; const both = await Promise.all([d, e].map((who) => req('/api/island/taxi', who, { from: 'plaza' })));
  assert.deepEqual(both.map((r) => r.data.error || 'ok').sort(), ['TAXI_AWAY', 'ok']); assert.equal((await balance(d)) + (await balance(e)), d0 + e0 - fare);
});
