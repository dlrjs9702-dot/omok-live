'use strict';
// 383 Codex 371~380 #2·#5·#6 (lib/island-tigers.js, server.js tigerCatch): caught -- one catch an account at a time (both tigers' paws in one
// tick take two things, not four), the move to the mayor kept as the reconnect spot and a pose sent before it no longer puts one back in
// the wood, the bag's loss saved with the catch's own id
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const rmAtExit = require('../test-support/rm-at-exit');
const { boot } = require('../test-support/test-server');
const P = require('../public/plaza/isle2-props.js');

test('호랑이 잡기 서버: 두 마리 같은 순간이어도 한 번(물건 2개), 시장님 앞이 재접속 자리, 잡히기 전 이동은 안 받음', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tigers-')); rmAtExit(dir);
  const { req, issue, enter } = await boot(t, dir); const a = await enter(await issue('잡힐이'));
  for (const [itemId, qty] of [['weed', 5], ['branch', 3], ['berry', 2]]) assert.equal((await req('/api/test/island/give', a, { itemId, qty })).status, 200);
  const swamp = { x: P.SWAMPS[1][0] + 18, z: P.SWAMPS[1][1] };
  const before = Date.now() + (await req('/api/plaza/state', a, { x: swamp.x, z: swamp.z, yaw: 0, moving: false, t: Date.now() })).status * 0;
  const r = await req('/api/test/tigers/catch', a, { both: true }); assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(r.data.here, r.data.spot, '시장님 앞');
  const items = (await req('/api/island/bag', a)).data; const list = items.bag?.items || items.items || [];
  const total = list.filter((e) => ['weed', 'branch', 'berry'].includes(e.itemId)).reduce((n, e) => n + e.qty, 0);
  assert.equal(total, 10 - 2, '두 마리가 같은 틱에 잡아도 물건은 2개만');
  // a pose from the wood sent before the catch arrives late: not taken
  const late = await req('/api/plaza/state', a, { x: swamp.x + 1, z: swamp.z, yaw: 0, moving: true, t: before });
  assert.ok(Math.hypot((late.data.x ?? r.data.spot.x) - r.data.spot.x, (late.data.z ?? r.data.spot.z) - r.data.spot.z) < 0.5, JSON.stringify(late.data));
  const again = await req('/api/test/tigers/catch', a, { id: 'ure' }); assert.equal(again.status, 200);
  assert.deepEqual(again.data.here, r.data.spot, '늦게 온 숲 좌표는 안 받음 -- 서버도 시장님 앞');
  const after = ((await req('/api/island/bag', a)).data.bag?.items || (await req('/api/island/bag', a)).data.items || []).filter((e) => ['weed', 'branch', 'berry'].includes(e.itemId)).reduce((n, e) => n + e.qty, 0);
  assert.equal(after, 8, '8초 안 두 번째 잡기는 없음');
});

// 383 Codex 371~380 #7: on a bike in 별마루섬's swamp the server too keeps to the swamp's 4.3 m/s (the tigers chase where the server has one)
test('늪 자전거 서버: 늪 안으로 한 번에 멀리 간 위치는 늪 속도만큼만', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'swamp-bike-')); rmAtExit(dir);
  const { req, issue, enter } = await boot(t, dir); const a = await enter(await issue('늪자전거'));
  const [sx, sz] = P.SWAMPS[0]; assert.ok(P.inSwamp(sx, sz)); const t0 = Date.now();
  await req('/api/plaza/state', a, { x: sx + 8, z: sz, yaw: 0, moving: true, bike: 'mint', t: t0 });
  const r = await req('/api/plaza/state', a, { x: sx, z: sz, yaw: 0, moving: true, bike: 'mint', t: t0 + 100 }); assert.equal(r.status, 200, JSON.stringify(r.data));
  const here = (await req('/api/test/tigers/catch', a, { id: 'none' })).data.here; assert.ok(Math.hypot(here.x - (sx + 8), here.z - sz) < 1.2, JSON.stringify(here));
});
