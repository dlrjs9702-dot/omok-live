'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const T = require('../public/plaza/island-terrain.js');
const { boot } = require('../test-support/test-server');

// v1.10.44 앉기·이모트: two seats on each plaza bench; a seat is one player's (first come) until they stand or leave; a
// pose carries only known acts, and 'sit' only on the seat one holds (what the other screens get: e2e)
test('앉기 서버: 좌석은 먼저 앉은 사람 것, 일어나면 비고, 자세는 허용된 행동만', async (t) => {
  const seats = T.plazaProps().seats; assert.equal(seats.length, 8);
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
