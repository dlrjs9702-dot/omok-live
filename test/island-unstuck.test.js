'use strict';
// 1.10.322 편의 1 U3 「막혔을 때 대청마당으로」 (notes mokpo-onxdo-ui-ideas-20261115): on the island the server puts me on a free spot
// by 대청마당's arrival place; in a room it says to use the door; once in 20 s
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const rmAtExit = require('../test-support/rm-at-exit');
const { boot } = require('../test-support/test-server');
const T = require('../public/plaza/island-terrain.js');

test('막혔을 때 대청마당으로: 섬에서는 도착 자리 곁으로, 방 안에서는 거절, 20초에 한 번', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'unstuck-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('끼인사람')); const b = await server.enter(await server.issue('방안사람'));
  assert.equal((await req('/api/island/unstuck', a, {})).data.error, 'NOT_ON_ISLAND', '섬에 없으면 안 됨');
  await req('/api/plaza/state', a, { x: -60, z: -30, yaw: 0, moving: false });
  const r = await req('/api/island/unstuck', a, {}); assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.ok(Math.hypot(r.data.x - T.SPAWN.x, r.data.z - T.SPAWN.z) < 3, `도착 자리 곁 ${r.data.x},${r.data.z}`); assert.ok(T.walkable(r.data.x, r.data.z), '설 수 있는 자리');
  assert.equal((await req('/api/island/unstuck', a, {})).data.error, 'TOO_SOON', '20초에 한 번');
  // in the 증권거래소's room: the door is the way out
  const door = T.facilityDoor('stocks'); await req('/api/plaza/state', b, { x: door.x, z: door.z, yaw: 0, moving: false });
  assert.equal((await req('/api/island/exchange/enter', b, {})).status, 200);
  assert.equal((await req('/api/island/unstuck', b, {})).data.error, 'INSIDE');
});
