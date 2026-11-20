'use strict';
// 368 민물·바다 수조 (notes fish-keepnet-20261109.md 끝, 사용자 2026-11-19 1A 2A): the first fish sets a tank's water, then only fish of
// that water go in (TANK_WATER), an emptied tank is free again; a tank already holding both stays 「섞임」 -- taken out, none put in.
// The water is the dex's (lib/island-fishing WATER_OF), kept in island-home for the page's own check.
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');
const H = require('../public/plaza/island-home');
const T = require('../public/plaza/island-terrain');
const Fishing = require('../lib/island-fishing');

test('수조 물: 도감의 WATER_OF와 50종 모두 같음', () => {
  const ids = Object.keys(H.FISH_SIZE); assert.equal(ids.length, Object.keys(Fishing.WATER_OF).length);
  for (const id of ids) assert.equal(H.waterOf(id), Fishing.WATER_OF[id.slice(5)], id);
  assert.equal(H.waterOf('insect_ladybird'), null);
});

test('수조 물 규칙: 첫 물고기가 정함, 다른 물은 못 넣음, 섞인 수조는 넣기 없음, 비우면 다시', () => {
  const f = (...ids) => ids.map((itemId) => ({ itemId }));
  assert.equal(H.tankWater([]), null); assert.equal(H.waterFits([], 'fish_goby'), true); assert.equal(H.waterFits([], 'fish_carp'), true);
  assert.equal(H.tankWater(f('fish_carp')), 'fresh'); assert.equal(H.waterFits(f('fish_carp'), 'fish_crucian_carp'), true); assert.equal(H.waterFits(f('fish_carp'), 'fish_goby'), false, '민물 수조에 바다 물고기');
  assert.equal(H.tankWater(f('fish_goby', 'fish_mackerel')), 'sea'); assert.equal(H.waterFits(f('fish_goby'), 'fish_carp'), false);
  assert.equal(H.tankWater(f('fish_goby', 'fish_carp')), 'mixed', '이미 섞인 수조(2A)'); for (const id of ['fish_goby', 'fish_carp']) assert.equal(H.waterFits(f('fish_goby', 'fish_carp'), id), false, `섞인 수조에 ${id}`);
  assert.equal(H.waterFits(f(), 'fish_goby'), true, '다 비우면 다시 정함');
  // fits() stays about size only; the water is its own check
  assert.equal(H.fits('fish_tank', 'fish_goby'), true); assert.equal(H.fits('fish_tank', 'fish_crucian_carp'), true);
});

test('수조 물 서버: 민물 붕어를 넣은 수조에 망둑어는 TANK_WATER, 꺼내서 비우면 망둑어가 들어가 바다 수조가 됨', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tank-water-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('수조물'));
  await req('/api/test/points-credit', a, { amount: 200000 });
  const stand = (x, z) => req('/api/plaza/state', a, { x, z, yaw: 0, moving: false });
  const door = T.facilityDoor('townhall'); await stand(door.x, door.z); assert.equal((await req('/api/island/townhall/enter', a, {})).status, 200);
  const lot = H.LOTS[6]; assert.equal((await req('/api/home/apply', a, { lot: lot.id, roof: 'blue' })).status, 200);
  const ex = T.roomWorld(T.TOWNHALL_ROOM.exit.lx, T.TOWNHALL_ROOM.exit.lz); await stand(ex.x, ex.z); await req('/api/island/townhall/leave', a, {});
  const [tank] = (await req('/api/test/home/furniture', a, { ids: ['fish_tank__oak'] })).data.pieces;
  await req('/api/test/island/give', a, { itemId: 'fish_crucian_carp', qty: 1, meta: { size: 41.5 } }); await req('/api/test/island/give', a, { itemId: 'fish_goby', qty: 1 });
  const d = H.doorOf(lot, 1); await stand(d.x, d.z); assert.equal((await req('/api/home/enter', a, { lot: lot.id })).status, 200);
  assert.equal((await req('/api/home/place', a, { uid: tank.uid, x: 2, z: 2, rot: 0 })).status, 200);
  const put = (itemId, n) => req('/api/home/tank', a, { tank: tank.uid, put: itemId, requestId: `tank-water-${n}-0001` });
  let r = await put('fish_crucian_carp', 1); assert.equal(r.status, 200, JSON.stringify(r.data));
  r = await put('fish_goby', 2); assert.equal(r.status, 409); assert.equal(r.data.error, 'TANK_WATER'); assert.match(r.data.message, /민물 수조예요/);
  const fid = (await req('/api/home/inside', a)).data.home.tanks[tank.uid][0].fid;
  assert.equal((await req('/api/home/tank', a, { tank: tank.uid, take: fid, requestId: 'tank-water-3-0001' })).status, 200);
  /* (Codex 361~370 #1: out of the tank at its own length -- 41.5 cm, not the kind's middle) */
  const back = JSON.stringify((await req('/api/island/bag', a)).data.items.filter((e) => e.itemId === 'fish_crucian_carp')); assert.match(back, /41\.5/, back);
  r = await put('fish_goby', 4); assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(H.tankWater(r.data.home.tanks[tank.uid]), 'sea');
  /* (383 Codex 371~380 #3: the tank's save failing between the bag and the tank -- taking out: pressed again (a new request), one goby, the tank empty;
     putting in: the fish back in the bag) */
  const bagCount = async (id) => (await req('/api/island/bag', a)).data.items.filter((e) => e.itemId === id).reduce((n, e) => n + e.qty, 0);
  const gfid = (await req('/api/home/inside', a)).data.home.tanks[tank.uid][0].fid;
  await req('/api/test/store/fail', null, { method: 'setWorldValue' });
  assert.notEqual((await req('/api/home/tank', a, { tank: tank.uid, take: gfid, requestId: 'tank-water-5-0001' })).status, 200);
  assert.equal((await req('/api/home/tank', a, { tank: tank.uid, take: gfid, requestId: 'tank-water-6-0001' })).status, 200);
  assert.equal(await bagCount('fish_goby'), 1, '두 번 눌러도 망둑어 하나'); assert.deepEqual((await req('/api/home/inside', a)).data.home.tanks[tank.uid], [], '수조는 비었음');
  await req('/api/test/store/fail', null, { method: 'setWorldValue' });
  assert.notEqual((await put('fish_goby', 7)).status, 200); assert.equal(await bagCount('fish_goby'), 1, '못 넣었으면 가방에 그대로');
});
