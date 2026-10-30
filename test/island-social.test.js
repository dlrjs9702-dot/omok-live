'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const T = require('../public/plaza/island-terrain.js');
const { boot } = require('../test-support/test-server');

test('섬 시설: 원거리 지급·구매는 거부하고 가까운 출석과 개인 착용은 유지', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'near-facility-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const token = await server.enter(await server.issue('시설 거리'));
  await req('/api/plaza/state', token, { ...T.SPAWN, yaw: 0, moving: false });
  const before = (await req('/api/skins', token)).data.balance;
  assert.equal((await req('/api/points/attendance', token, {})).data.error, 'TOO_FAR');
  assert.equal((await req('/api/skins/buy', token, { skinId: 'avatar_x2_outfit_tea_master' })).data.error, 'TOO_FAR');
  assert.equal((await req('/api/skins', token)).data.balance, before, '거부한 요청은 지급·지출하지 않는다');
  assert.equal((await req('/api/skins/equip', token, { skinId: null, game: 'avatar', slot: 'outfit' })).status, 200, '개인 정보의 보유 외형 해제는 장소에 종속되지 않는다');
  await req('/api/plaza/leave', token, {});
  const door = T.facilityDoor('attendance');
  const pose = await req('/api/plaza/state', token, { ...door, yaw: 0, moving: false });
  assert.ok(Math.hypot(pose.data.x - door.x, pose.data.z - door.z) < 2.4, JSON.stringify(pose.data));
  assert.equal((await req('/api/points/attendance', token, {})).data.granted, true);
  assert.equal((await req('/api/points/attendance', token, {})).data.granted, false, '기존 일일 중복 지급 방지를 유지한다');
  await req('/api/test/points-credit', token, { amount: 100000 });
  await req('/api/plaza/leave', token, {});
  // v1.10.92 백화점: the 옷가게 is its sector -- in at its door, then at the sector's spot
  const mallDoor = T.facilityDoor('store'); await req('/api/plaza/state', token, { ...mallDoor, yaw: 0, moving: false });
  assert.equal((await req('/api/island/store/enter', token, {})).status, 200);
  // (v1.10.211 백화점 개편 A안: the 옷 up on the 2nd floor -- by the lift)
  const S = require('../public/plaza/island-store'); const F = require('../public/plaza/island-fashion');
  await req('/api/plaza/state', token, { ...S.world(...S.LIFT.stand), yaw: 0, moving: false });
  assert.equal((await req('/api/island/lift', token, { to: 2 })).data.space, 'fashion');
  await req('/api/plaza/state', token, { ...F.sectorPoint('avatar'), yaw: 0, moving: false });
  assert.equal((await req('/api/skins/buy', token, { skinId: 'avatar_x2_outfit_tea_master' })).status, 200, '가까운 옷가게에서 기존 구매가 정상 실행된다');
  // (달마루섬 5단계) the 9th sector, 노점: the trader's buy-back there, not from the 옷가게
  await req('/api/test/island/give', token, { itemId: 'herb', qty: 2 });
  assert.equal((await req('/api/island/sell', token, { place: 'merchant', requestId: 'mall-sell-0001' })).data.error, 'TOO_FAR');
  await req('/api/plaza/state', token, { ...F.world(...F.LIFT.stand), yaw: 0, moving: false }); assert.equal((await req('/api/island/lift', token, { to: 1 })).data.space, 'store'); // (down to the 1st floor's sell basket)
  await req('/api/plaza/state', token, { ...S.sectorPoint('mall:stall'), yaw: 0, moving: false });
  const sold = await req('/api/island/sell', token, { place: 'merchant', requestId: 'mall-sell-0002' });
  assert.equal(sold.status, 200, JSON.stringify(sold.data));
});

test('섬 초대: 원거리 준비와 준비 후 게임방에 간 수신자를 거부', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'near-invite-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('초대하는이')); const b = await server.enter(await server.issue('초대받는이'));
  await req('/api/plaza/state', a, { x: 0, z: 8 });
  let target = await req('/api/plaza/state', b, { x: 0, z: 16 });
  assert.equal((await req('/api/island/invite/prepare', a, { plazaId: target.data.id })).data.error, 'TOO_FAR');
  await req('/api/plaza/leave', b, {});
  target = await req('/api/plaza/state', b, { x: 0.8, z: 8 });
  assert.equal((await req('/api/island/invite/prepare', a, { plazaId: target.data.id })).status, 200);
  assert.equal((await req('/api/rooms', a, { gameType: 'othello' })).status, 201);
  assert.equal((await req('/api/rooms', b, { gameType: 'othello' })).status, 201);
  assert.equal((await req('/api/island/invite', a, { plazaId: target.data.id })).data.error, 'RECIPIENT_NOT_FOUND');
});

// v1.10.44 앉기·이모트: one seat on each plaza bench (v1.10.45); a seat is one player's (first come) until they stand or leave; a
// pose carries only known acts, and 'sit' only on the seat one holds (what the other screens get: e2e)
test('앉기 서버: 좌석은 먼저 앉은 사람 것, 일어나면 비고, 자세는 허용된 행동만', async (t) => {
  const seats = T.plazaProps().seats.filter((s) => !s.room); assert.equal(seats.length, T.paving ? 4 + 14 + 28 : 4); /* (묶음 1: 대청마당's gardens' rims too; 3회차 13: 14 benches along its rim) */ // (B 44: the 민원실's 18 seats are counted apart)
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'seat-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('앉는이')); const b = await server.enter(await server.issue('늦은이')); assert.ok(a && b, server.logs());
  const s = seats[0]; const near = { x: s.x + Math.sin(s.yaw), z: s.z + Math.cos(s.yaw), yaw: 0, moving: false };
  await req('/api/plaza/state', a, near); await req('/api/plaza/state', b, { ...near, x: near.x + 0.8 });
  assert.equal((await req('/api/island/sit', a, { seat: 'nope' })).status, 400);
  assert.equal((await req('/api/island/sit', a, { seat: s.id })).status, 200);
  assert.equal((await req('/api/island/sit', b, { seat: s.id })).data.error, 'SEAT_TAKEN');
  await req('/api/plaza/state', a, { x: s.x, z: s.z, yaw: s.yaw, moving: false, act: 'sit', actN: 0, seat: s.id });
  assert.equal((await req('/api/plaza/state', b, { ...near, x: near.x + 0.8, act: 'dance', actN: 3 })).status, 200, '모르는 행동은 버리고 받는다 (화면 동기화는 e2e)');
  await req('/api/island/stand', a, {});
  assert.equal((await req('/api/island/sit', b, { seat: s.id })).status, 200, '일어나면 다른 사람이 앉는다');
});

// A-7 민원실 창구 (사용자 2026-10-19): a customer's chair at each window, seated within the server's 1.8 m of its counter
test('민원실 창구 의자: 네 창구마다 손님 의자, 앉은 자리는 그 창구의 1.8m 안', () => {
  const R = T.TOWNHALL_ROOM; const at = { civil: R.desk, tax: R.tax, bank: R.bank, rename: R.rename };
  const chairs = T.plazaProps().seats.filter((s) => s.counter);
  assert.deepEqual(chairs.map((s) => s.door).sort(), ['room:bank', 'room:desk', 'room:rename', 'room:tax']);
  for (const s of chairs) { const w = T.roomWorld(at[s.counter].lx, at[s.counter].lz); assert.ok(Math.hypot(s.x - w.x, s.z - w.z) <= 1.8, s.id); assert.equal(s.y, R.y); }
  for (const s of chairs) { const q = T.roomClamp(s.x, s.z + 1.0); assert.ok(q.z > s.z + 0.5, `${s.id}: stands up into the hall`); }
});
