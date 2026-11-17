'use strict';
// 1.10.348 4b (notes gather-must-ideas §64~81A): what a worn house keeps from people -- 낡음: no guests, no decorating (the 방문 허용
// still free), 부서짐: nobody in, the owner too; 고치기 at 부서짐 takes its 수리비 with the materials
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { boot } = require('../test-support/test-server');
const Y = require('../public/plaza/island-yard');
const H = require('../public/plaza/island-home');
const T = require('../public/plaza/island-terrain');

test('집 낡음·부서짐: 낡음은 손님·꾸미기 잠김(방문 허용은 됨), 부서짐은 주인도 못 들어감, 부서짐 고치기는 수리비도', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wear-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('낡은집주인')); const b = await server.enter(await server.issue('놀러온이'));
  const key = (await req('/api/admin/keys', server.admin)).data.keys.find((k) => k.label === '낡은집주인');
  await req(`/api/admin/keys/${key.id}/points`, server.admin, { amount: 500000, category: 'other', memo: '시험', requestId: crypto.randomUUID() });
  const stand = (who, x, z) => req('/api/plaza/state', who, { x, z, yaw: 0, moving: false });
  const lot = Y.lotById('lot6');
  const door = T.facilityDoor('townhall'); await stand(a, door.x, door.z); assert.equal((await req('/api/island/townhall/enter', a, {})).status, 200);
  assert.equal((await req('/api/home/apply', a, { lot: lot.id, roof: 'red' })).status, 200);
  const ex = T.roomWorld(T.TOWNHALL_ROOM.exit.lx, T.TOWNHALL_ROOM.exit.lz); await stand(a, ex.x, ex.z); await req('/api/island/townhall/leave', a, {});
  const hd = H.doorOf(lot, 1); const enter = async (who) => { await stand(who, hd.x, hd.z); return req('/api/home/enter', who, { lot: lot.id }); };
  const leave = async (who) => { const en = H.entryOf(1); const w = H.world(lot, en[0], en[1] - 0.6); await stand(who, w.x, w.z); return req('/api/home/leave', who, {}); };
  // 낡음: a guest refused, the owner in -- but placing refused; the 방문 허용 still changes
  await req('/api/test/home/farm-time', a, { level: 2 });
  assert.equal((await enter(b)).data.error, 'HOUSE_WORN');
  const inA = await enter(a); assert.equal(inA.status, 200, JSON.stringify(inA.data));
  assert.equal((await req('/api/home/place', a, { uid: 'nope', x: 0, z: 0 })).data.error, 'HOUSE_WORN');
  assert.equal((await req('/api/home/yard', a, { action: 'place', uid: 'nope', x: 0, z: 0 })).data.error, 'HOUSE_WORN');
  assert.equal((await req('/api/home/style', a, { floor: H.FLOORS[1] })).data.error, 'HOUSE_WORN');
  assert.equal((await req('/api/home/style', a, { visit: H.VISITS[0] })).status, 200, '방문 허용은 그대로');
  await leave(a);
  // 부서짐: the owner too kept out
  await req('/api/test/home/farm-time', a, { level: 3 }); assert.equal((await enter(a)).data.error, 'HOUSE_BROKEN');
  // 고치기 from 부서짐: the materials and 20,000P
  for (const [itemId, qty] of [['ore_granite', 20], ['ore_iron', 10], ['branch', 20]]) await req('/api/test/island/give', a, { itemId, qty });
  const B = H.upkeepBoxOf(lot, 1); await stand(a, B.x, B.z); const p0 = (await req('/api/points', a)).data.balance;
  const fix = await req('/api/home/upkeep', a, { action: 'repair' }); assert.equal(fix.status, 200, JSON.stringify(fix.data)); assert.equal(fix.data.from, '부서짐'); assert.equal(fix.data.to, '낡음');
  assert.equal((await req('/api/points', a)).data.balance, p0 - 20000, '수리비');
  assert.equal((await enter(a)).status, 200, '낡음이면 주인은 들어감');
});
