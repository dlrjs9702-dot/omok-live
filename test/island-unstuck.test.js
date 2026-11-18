'use strict';
// 1.10.322 편의 1 U3 「막혔을 때」 (notes mokpo-onxdo-ui-ideas-20261115); 364 (user A): the server puts me on the nearest free spot
// round where I am (1.5~15 m: standable, a free cell of the islanders' grid), 대청마당's arrival place only when none is near;
// in a room it says to use the door; once in 10 minutes
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const rmAtExit = require('../test-support/rm-at-exit');
const { boot } = require('../test-support/test-server');
const T = require('../public/plaza/island-terrain.js');
const N = require('../public/plaza/island-npcs.js');
const U = require('../lib/island-unstuck');

test('가까운 빈 자리: 가장 가까운 고리부터, 1.5 m 안은 안 고름, 15 m 안에 없으면 null; 기다림 분 수', () => {
  const ok = (x, z) => Math.hypot(x - 3, z) < 0.6; // (only round (3, 0))
  const p = U.nearestFree({ x: 0, z: 0, ok }); assert.ok(p && Math.hypot(p.x - 3, p.z) < 0.6 && Math.hypot(p.x, p.z) >= 1.5, JSON.stringify(p));
  assert.equal(U.nearestFree({ x: 0, z: 0, ok: (x, z) => Math.hypot(x, z) < 1.2 }), null, '제자리(1.5 m 안)는 아님');
  assert.equal(U.nearestFree({ x: 0, z: 0, ok: (x, z) => Math.hypot(x, z) > 16 }), null, '15 m 밖은 없음 → 대청마당');
  const near = U.nearestFree({ x: 0, z: 0, ok: (x, z) => Math.hypot(x, z) > 4 }); assert.ok(Math.hypot(near.x, near.z) < 4.6, '가까운 고리 먼저');
  assert.equal(U.COOLDOWN_MS, 600000); assert.equal(U.waitMinutes(0, 1e9), 0); assert.equal(U.waitMinutes(1e9, 1e9 + 1000), 10); assert.equal(U.waitMinutes(1e9, 1e9 + 9.5 * 60000), 1); assert.equal(U.waitMinutes(1e9, 1e9 + 600000), 0);
});

test('막혔을 때: 섬에서는 15 m 안 빈 자리로(where near), 방 안에서는 거절, 10분에 한 번', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'unstuck-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('끼인사람')); const b = await server.enter(await server.issue('방안사람'));
  assert.equal((await req('/api/island/unstuck', a, {})).data.error, 'NOT_ON_ISLAND', '섬에 없으면 안 됨');
  const st = await req('/api/plaza/state', a, { x: -60, z: -30, yaw: 0, moving: false }); const from = { x: st.data.x, z: st.data.z };
  const r = await req('/api/island/unstuck', a, {}); assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.where, 'near'); const d = Math.hypot(r.data.x - from.x, r.data.z - from.z);
  assert.ok(d >= 1.4 && d <= 15.1, `근처 ${r.data.x},${r.data.z} (${d.toFixed(2)} m)`); assert.ok(T.walkable(r.data.x, r.data.z) && N.free(r.data.x, r.data.z), '설 수 있고 막힘 없는 자리');
  const again = await req('/api/island/unstuck', a, {}); assert.equal(again.data.error, 'TOO_SOON'); assert.match(again.data.message, /10분에 한 번 .*10분 뒤/);
  // in the 증권거래소's room: the door is the way out
  const door = T.facilityDoor('stocks'); await req('/api/plaza/state', b, { x: door.x, z: door.z, yaw: 0, moving: false });
  assert.equal((await req('/api/island/exchange/enter', b, {})).status, 200);
  assert.equal((await req('/api/island/unstuck', b, {})).data.error, 'INSIDE');
});
