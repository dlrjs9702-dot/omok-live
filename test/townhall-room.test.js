'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');
const T = require('../public/plaza/island-terrain');

// v1.10.84 관공서 실내 (IDEAS 2026-10-07): in only at the hall's door, a pose inside stays in the room (never out on the
// island by a pose), the counter inside settles what the hall took outside, out only at the room's door; the room and
// the island do not see each other's chat.
test('관공서 실내: 문에서만 입장, 실내 안에서만 이동, 창구 정산, 문에서 퇴장, 채팅 분리', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'townhall-room-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('민원인')); const b = await server.enter(await server.issue('바깥사람'));
  const door = T.facilityDoor('townhall'); const R = T.TOWNHALL_ROOM;
  const stand = (who, x, z) => req('/api/plaza/state', who, { x, z, yaw: 0, moving: false });
  await stand(a, 0, 20);
  assert.equal((await req('/api/island/townhall/enter', a, {})).data.error, 'TOO_FAR', '문 앞이 아니면 못 들어감');
  await stand(a, door.x, door.z); await stand(b, door.x + 1, door.z);
  await req('/api/test/island/give', a, { itemId: 'trash', qty: 1 });
  assert.equal((await req('/api/island/sell', a, { place: 'office', requestId: 'door-sell-0001' })).data.error, 'TOO_FAR', '문 앞에서는 정산 안 됨(실내 창구만)');
  const inside = (await req('/api/island/townhall/enter', a, {})).data;
  assert.equal(inside.space, 'townhall'); assert.ok(T.inRoom(inside.x, inside.z));
  assert.equal((await req('/api/island/townhall/enter', a, {})).data.error, 'ALREADY_INSIDE');
  // a pose out on the island is put back in the room
  const moved = (await stand(a, 0, 0)).data;
  assert.ok(T.inRoom(moved.x, moved.z), JSON.stringify(moved));
  assert.equal(moved.corrected, true);
  // the counter: the hall's settlement, inside
  await req('/api/test/island/give', a, { itemId: 'trash', qty: 2 });
  const desk = T.roomWorld(R.desk.lx, R.desk.lz); await stand(a, desk.x, desk.z);
  const sold = await req('/api/island/sell', a, { place: 'office', requestId: 'room-sell-0001' });
  assert.equal(sold.status, 200, JSON.stringify(sold.data));
  // (달마루섬 5단계) the 작명소's business at the 개명 신청 window -- not from the 민원 window
  assert.equal((await req('/api/test/points-credit', a, { amount: 30_000 })).status, 200);
  assert.equal((await req('/api/nickname', a, { name: '창구 손님', requestId: 'room-name-0001' })).data.error, 'TOO_FAR');
  const rename = T.roomWorld(R.rename.lx, R.rename.lz); await stand(a, rename.x, rename.z);
  const named = await req('/api/nickname', a, { name: '창구 손님', requestId: 'room-name-0002' });
  assert.equal(named.status, 200, JSON.stringify(named.data));
  // chat: the room does not reach the door outside (the two are 0 m apart in neither space)
  assert.equal((await req('/api/island/townhall/leave', a, {})).data.error, 'TOO_FAR', '창구에서는 못 나감');
  const exit = T.roomWorld(R.exit.lx, R.exit.lz); await stand(a, exit.x, exit.z);
  const out = (await req('/api/island/townhall/leave', a, {})).data;
  assert.equal(out.space, 'island'); assert.ok(Math.hypot(out.x - door.x, out.z - door.z) < 0.01);
  const after = (await stand(a, door.x, door.z + 0.5)).data;
  assert.ok(!T.inRoom(after.x, after.z), '나오면 섬 위');
});
