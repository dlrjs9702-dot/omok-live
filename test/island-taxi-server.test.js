'use strict';
// v1.10.271 섬 택시 서버 (gamecenter-notes docs/taxi-20261104.md 2·3·5절): at the 대청마당 stop, the fare asked (1,000P; 1.10.327
// a home owner too, or the day's pass 5,000P), 타기 paid once; riding twice refused, far off refused, too few points refused; while riding
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
/* (1.10.391 N4-a: the server's cars -- the one out from 대청마당 on that ride) */
const outRide = (data, prev) => (data.taxiStops?.cars || []).map((c) => c.ride).find((r) => r && r.from === 'plaza' && (!prev || r.startedAt === prev.startedAt)) || null;

test('섬 택시 서버: 요금(누구나 1,000P, 하루 자유이용권 5,000P)·한 번 차감·두 번 타기·먼 곳·포인트 부족 막기, 타는 동안 길 위, 끝나면 건너편 정류장', async (t) => {
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
  const asked = { ok: true, from: 'plaza', to: 'isle', fare: 1000, dayPass: 8000, pass: false, awayS: 0, dests: X.PLACE_IDS().filter((id) => id !== 'plaza').map((id) => ({ id, label: X.labelOf(id), fare: X.fareByRoad('plaza', id) })), cars: 2 }; /* (391 N4-a: where to, and two cars standing; 392 N4-b: every place on the road, its fare by the road's length, the pass 8,000P) */
  assert.deepEqual((await req('/api/island/taxi?from=plaza', a)).data, asked);
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
  // (294 7; 391 N4-a) its car: 툇마루섬 had two -- back empty; every screen told; the stop's other car stands in front (one left there)
  const mine = done.data.taxiStops.cars.find((c) => c.id === rode.data.taxi.car); assert.ok(mine?.ride && mine.ride.startedAt === rode.data.taxi.startedAt && mine.ride.stay === false, JSON.stringify(mine));
  assert.ok(['turn', 'back'].includes(X.carAt(mine.ride, Date.now())?.phase)); await stand(b, P.out.x + 0.5, P.out.z + 0.5); assert.equal((await req('/api/island/taxi?from=plaza', b)).data.cars, 1);
  await req('/api/test/taxi-run', a, { ms: 3000 }); /* (every car at its stop) */
  // (1.10.327 택시 요금, 사용자) a home owner pays too; the day's pass (5,000P) bought once -- that day's rides then free, shown so
  const door = T.facilityDoor('townhall'); await stand(b, door.x, door.z); assert.equal((await req('/api/island/townhall/enter', b, {})).status, 200);
  const lot = H.LOTS[3]; assert.equal((await req('/api/home/apply', b, { lot: lot.id, roof: 'red' })).status, 200);
  const ex = T.roomWorld(T.TOWNHALL_ROOM.exit.lx, T.TOWNHALL_ROOM.exit.lz); await stand(b, ex.x, ex.z); await req('/api/island/townhall/leave', b, {});
  await stand(b, P.out.x + 0.5, P.out.z + 0.5); const owner = await balance(b);
  assert.deepEqual((await req('/api/island/taxi?from=plaza', b)).data, asked, '집이 있어도 요금');
  const rideB = async (from, pay) => { /* (b rides from that stop -- and is out at the other by the end) */
    const S = X.stopOf(from); await stand(b, S.out.x + 0.5, S.out.z + 0.5); const r = await req('/api/island/taxi', b, { from, pay }); assert.equal(r.status, 200, JSON.stringify(r.data));
    await sleep(X.durationOf(r.data.taxi) + 300); await stand(b, S.out.x, S.out.z); await req('/api/test/taxi-run', a, { ms: 3000 }); /* (294: its car back) */ return r.data;
  };
  /* (1.10.403 Codex 391~400 #5·#7: 「타기」 from a window that showed yesterday's pass -- refused, nothing taken (not today's 8,000P pass bought); a price
     over the one the window showed -- refused) */
  for (const body of [{ from: 'plaza', to: 'isle', pay: 'pass', held: true }, { from: 'plaza', to: 'isle', pay: 'fare', fare: 500 }, { from: 'plaza', to: 'isle', pay: 'pass', fare: 1000 }]) {
    const r = await req('/api/island/taxi', b, body); assert.equal(r.status, 409, JSON.stringify(body)); assert.equal(r.data.error, 'TAXI_PRICE'); assert.equal(await balance(b), owner, '아무것도 안 빠짐'); }
  const bought = await rideB('plaza', 'pass'); assert.deepEqual([bought.fare, bought.pass], [8000, true]); assert.equal(await balance(b), owner - 8000);
  const history = (await req('/api/points/history?limit=3', b)).data.items; assert.equal(history[0].reason, 'taxipass', '내역 「택시 자유이용권」');
  await stand(b, I.out.x + 0.5, I.out.z + 0.5); assert.equal((await req('/api/island/taxi?from=isle', b)).data.pass, true);
  for (const [from, pay] of [['isle', 'fare'], ['plaza', 'pass']]) { /* (the pass held: no fare, and never a second pass the same day) */
    const again = await rideB(from, pay); assert.deepEqual([again.fare, again.pass], [0, true]); assert.equal(await balance(b), owner - 8000);
  }
  // the fare is the economy's (the administrator's table); more than I have: refused, nothing taken
  const c = await server.enter(await server.issue('빈손')); await stand(c, P.out.x - 0.6, P.out.z - 0.6); const has = await balance(c);
  const admin = (await req('/api/admin/login', null, { password: 'look-test' })).data.sessionToken; const fare = 1500;
  const box = T.facilityDoor('donate'); await stand(c, box.x, box.z);
  const gave = await req('/api/donation', c, { amount: has - 500, requestId: `taxi-poor-${Date.now()}` }); assert.equal(gave.status, 200, JSON.stringify(gave.data)); assert.equal(await balance(c), 500); /* (points given away: 500 left) */
  const set = await req('/api/admin/economy', admin, { changes: { 'taxi:per100': 375 } }); /* (392: 404 m -> 4 x 375) */ assert.equal(set.status, 200, JSON.stringify(set.data));
  await stand(c, P.out.x - 0.6, P.out.z - 0.6); assert.equal((await req('/api/island/taxi?from=plaza', c)).data.fare, fare);
  const poor = await req('/api/island/taxi', c, { from: 'plaza' }); assert.equal(poor.data.error, 'INSUFFICIENT_POINTS'); assert.match(poor.data.message, /1,500P/); assert.equal(await balance(c), 500);
  assert.equal((await req('/api/island/taxi?from=plaza', c)).data.awayS, 0, '못 탄 사람은 차를 잡지 않음');
  // (294 7; 391 N4-a two cars a stop) three at once at one stop: two ride, the third is told a car is coming -- and pays nothing
  await req('/api/test/taxi-run', a, { ms: 3000 });
  const d = await server.enter(await server.issue('동시하나')); const e = await server.enter(await server.issue('동시둘')); const f = await server.enter(await server.issue('동시셋'));
  for (const who of [d, e, f]) { await req('/api/test/points-credit', who, { amount: 100000 }); await stand(who, P.out.x, P.out.z); }
  const [d0, e0, f0] = [await balance(d), await balance(e), await balance(f)]; const all = await Promise.all([d, e, f].map((who) => req('/api/island/taxi', who, { from: 'plaza' })));
  assert.deepEqual(all.map((r) => r.data.error || 'ok').sort(), ['TAXI_AWAY', 'ok', 'ok']); assert.equal((await balance(d)) + (await balance(e)) + (await balance(f)), d0 + e0 + f0 - 2 * fare);
  const away = all.find((r) => r.data.error); assert.ok(away.data.awayS > 0, JSON.stringify(away.data)); assert.notEqual(all.filter((r) => !r.data.error)[0].data.taxi.car, all.filter((r) => !r.data.error)[1].data.taxi.car, 'two cars');
});

// v1.10.317 택시 서서 기다리기 (notes docs/taxi-yield-20261109.md A1~A3): on the real road someone standing in the car's way has it
// ease to a stop short of them (never through them), 「빵」 time on (blockedAt), after 4 s creeping at a walk; they step off the
// road and it goes on at its pace -- the ride later by the wait, on every screen's road clock (warp)
test('섬 택시 서서 기다리기: 앞에 선 사람 앞에서 섬, 4초 뒤 천천히, 비키면 다시 달림, 도착은 그만큼 늦게', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'taxi-wait-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('택시탄이')); const b = await server.enter(await server.issue('길막이'));
  await req('/api/test/points-credit', a, { amount: 100000 }); await req('/api/test/taxi-run', a, { ms: 0 }); /* (the real road) */
  const stand = (who, x, z) => req('/api/plaza/state', who, { x, z, yaw: 0, moving: false });
  const P = X.stopOf('plaza'); const spot = { x: 0.6, z: -37.1 }; /* (a point of the road, about 22 m on) */
  await req('/api/island/npc-grid', a); /* (the islanders' grid made first -- seconds of a busy test machine's CPU, the server's ticks waiting behind it) */
  await stand(a, P.out.x, P.out.z); await stand(b, spot.x, spot.z);
  const rode = await req('/api/island/taxi', a, { from: 'plaza' }); assert.equal(rode.status, 200, JSON.stringify(rode.data));
  const t0 = Date.now(); let ride = null; let blockedSeen = null; let creep = null;
  while (Date.now() - t0 < 16000) {
    const s = await stand(b, spot.x, spot.z); ride = outRide(s.data, ride) || ride;
    if (ride?.blockedAt && !blockedSeen) blockedSeen = Date.now();
    if (ride?.warp && ride.warp.r1 > 0 && ride.warp.r1 < 0.3) { creep = ride.warp.r1; break; }
    await sleep(200);
  }
  assert.ok(blockedSeen, 'waited for the one in front');
  const stood = X.carAt(ride, ride.warp.at); const closest = (spot.x - stood.x) * Math.sin(stood.yaw) + (spot.z - stood.z) * Math.cos(stood.yaw); /* (where it stood: the last road clock, read when creeping begins -- not the test's own guess between answers) */
  assert.ok(closest > 1.95 + 0.5, `stands short of them (its nose 1.95 m on): ${closest.toFixed(2)} m from its middle`); /* (round the corner too -- 317: it looks along its own way) */
  assert.ok(creep > 0 && creep < 0.3, `going by at a walk after 3 s: ${creep}`); assert.ok(Date.now() - blockedSeen >= 2500);
  /* (1.10.340 133A: by them aside within the road -- 1.3 m off them, never past 1.5 m -- on the server's clock, every screen the same) */
  assert.equal(ride.dodge?.mode, 'side', JSON.stringify(ride.dodge)); assert.ok(Math.abs(ride.side.to) <= 1.5, `aside ${ride.side.to}`); /* (391 N4-a: already 1.15 m right in its lane -- what it needs aside is less; the gap below is what counts) */
  { const q = X.carAt(ride, ride.side.at + ride.side.ms + 50); const across = (spot.x - q.x) * Math.cos(q.yaw) - (spot.z - q.z) * Math.sin(q.yaw); assert.ok(Math.abs(across) >= 1.25, `going by ${across.toFixed(2)} m off them`); }
  const late = rode.data.taxi.startedAt + X.durationOf(rode.data.taxi); assert.equal(X.rideOver(ride, late), false, 'the ride later by its wait');
  // off the road: on at its pace again
  let back = null; const t1 = Date.now();
  while (Date.now() - t1 < 5000) { const s = await stand(b, spot.x + 6, spot.z); const r = outRide(s.data, ride); if (r && !r.blockedAt && r.warp?.r1 === 1) { back = r; break; } await sleep(200); }
  assert.ok(back, 'on again once clear'); assert.equal(back.side?.to ?? 0, 0, 'back to the road\'s middle'); assert.equal(back.dodge ?? null, null);
  await req('/api/test/taxi-run', a, { ms: 3000 });
});

// 1.10.340 133A: no room aside (a crossing) -- after 3 s see-through, slowly through them, solid again once past; it always arrives
test('섬 택시 비켜 가기: 건널목에 선 사람은 3초 뒤 반투명으로 천천히 통과, 지나가면 다시 불투명', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'taxi-ghost-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('택시탄이2')); const b = await server.enter(await server.issue('건널목이'));
  await req('/api/test/points-credit', a, { amount: 100000 }); await req('/api/test/taxi-run', a, { ms: 0 });
  const stand = (who, x, z) => req('/api/plaza/state', who, { x, z, yaw: 0, moving: false });
  const P = X.stopOf('plaza'); const spot = X.CROSSINGS[1]; /* (the road at the crossing by the hall's walk -- T1: by 배 타는 곳, the road moved off (0.3, -6.7)) */
  await req('/api/island/npc-grid', a);
  await stand(a, P.out.x, P.out.z); await stand(b, spot.x, spot.z);
  assert.equal((await req('/api/island/taxi', a, { from: 'plaza' })).status, 200);
  const t0 = Date.now(); let ghost = null; let solid = null;
  while (Date.now() - t0 < 30000) {
    const r = outRide((await stand(b, spot.x, spot.z)).data, null);
    if (r?.ghost && !ghost) ghost = { ...r.ghost, dodge: r.dodge };
    if (ghost && r?.ghost?.until) { solid = r; break; }
    await sleep(200);
  }
  assert.ok(ghost, 'see-through at the crossing'); assert.equal(ghost.dodge?.mode, 'ghost');
  assert.ok(solid, 'solid again once past them'); assert.equal(X.ghostAt(solid, solid.ghost.until + 10), false); assert.equal(X.ghostAt(solid, solid.ghost.until - 10), true);
  await req('/api/test/taxi-run', a, { ms: 3000 });
});

// 1.10.370 택시 못 타는 이유: each its own words (reason), and a seat left behind -- its seat far off me -- let go at the stop instead of
// refusing the ride (총괄: TAXI_BUSY reasons + self-heal)
test('섬 택시 못 타는 이유: 게임 방은 그 이유로 막고, 멀리 두고 온 의자는 정류장에서 풀려 탐', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'taxi-busy-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('의자두고온이')); const b = await server.enter(await server.issue('방에있는이'));
  for (const who of [a, b]) await req('/api/test/points-credit', who, { amount: 100000 });
  const P = X.stopOf('plaza'); const seat = T.plazaProps().seats.find((s) => s.id === 'b8');
  // A sits on a bench 13 m off the stop, then its page (stuck in the sit) is at the stop: the seat let go, the ride taken
  await req('/api/plaza/state', a, { x: seat.x, z: seat.z, yaw: 0, moving: false }); assert.equal((await req('/api/island/sit', a, { seat: 'b8' })).status, 200);
  await req('/api/plaza/state', a, { x: P.out.x, z: P.out.z, yaw: 0, moving: false, act: 'sit', seat: 'b8', actN: 1 });
  const rode = await req('/api/island/taxi', a, { from: 'plaza' }); assert.equal(rode.status, 200, JSON.stringify(rode.data));
  // B in a game room: refused, the reason said
  /* (1.10.403: by the stop for sure -- A just got in there, and the server keeps one from standing in another: a spot it moved B off to was at times past
     the stop's reach, TOO_FAR, not the reason asked about) */
  const S = X.STOPS.plaza ? X.stopOf('plaza') : P; let at = null;
  for (const [dx, dz] of [[0.5, 0.5], [-0.8, 0.6], [0.9, -0.7], [-1.2, -1.0], [1.5, 0]]) { at = (await req('/api/plaza/state', b, { x: P.out.x + dx, z: P.out.z + dz, yaw: 0, moving: false })).data; if (at && Math.hypot(at.x - S.x, at.z - S.z) <= 5) break; }
  assert.ok(Math.hypot(at.x - S.x, at.z - S.z) <= 5.5, JSON.stringify(at));
  assert.equal((await req('/api/rooms', b, { gameType: 'othello', visibility: 'public' })).status, 201);
  const busy = await req('/api/island/taxi', b, { from: 'plaza' }); assert.equal(busy.data.error, 'TAXI_BUSY'); assert.equal(busy.data.reason, 'room', JSON.stringify(busy.data)); assert.match(busy.data.message, /게임 방/);
});
