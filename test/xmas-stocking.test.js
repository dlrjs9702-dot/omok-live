'use strict';
// 1.10.333 M6 양말 선물 (notes christmas-boost M6): on the 크리스마스 festival's last day (12-25) from 06:00, a house with a 양말 걸이
// hung gets two 사탕 주머니 in the bag and 산타's letter in the 우체통 -- once; before 06:00, or with no stocking, nothing
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');
const T = require('../public/plaza/island-terrain');
const H = require('../public/plaza/island-home');

test('양말 선물: 25일 06시부터 양말 걸이 건 집에 사탕 주머니 둘 + 산타 편지, 한 번만; 걸이 없으면 없음', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stocking-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('양말집')); const b = await server.enter(await server.issue('빈집'));
  for (const who of [a, b]) await req('/api/test/points-credit', who, { amount: 500000 });
  const stand = (who, x, z) => req('/api/plaza/state', who, { x, z, yaw: 0, moving: false });
  const door = T.facilityDoor('townhall'); const ex = T.roomWorld(T.TOWNHALL_ROOM.exit.lx, T.TOWNHALL_ROOM.exit.lz);
  for (const [who, lot] of [[a, H.LOTS[6]], [b, H.LOTS[7]]]) { await stand(who, door.x, door.z); assert.equal((await req('/api/island/townhall/enter', who, {})).status, 200); assert.equal((await req('/api/home/apply', who, { lot: lot.id, roof: 'red' })).status, 200); await stand(who, ex.x, ex.z); await req('/api/island/townhall/leave', who, {}); }
  const [stocking] = (await req('/api/test/home/furniture', a, { ids: ['xmas_stocking__plain'] })).data.pieces;
  const d = H.doorOf(H.LOTS[6], 1); await stand(a, d.x, d.z); assert.equal((await req('/api/home/enter', a, { lot: H.LOTS[6].id })).status, 200);
  const put = await req('/api/home/place', a, { uid: stocking.uid, x: -2, z: 4.31, rot: 0 }); assert.equal(put.status, 200, JSON.stringify(put.data)); /* (hung on the 오두막's back wall, as the xmas-assets e2e) */
  const candy = async (who) => ((await req('/api/island/bag', who)).data.items || []).filter((i) => i.itemId === 'candy').reduce((n, i) => n + (i.qty || 1), 0);
  const santa = async (who) => (await req('/api/island/mail', who)).data.letters.filter((l) => l.from === 'santa');
  const clock = (iso) => req('/api/test/festival/clock', null, { at: Date.parse(`${iso}+09:00`) });
  try {
    await clock('2026-12-25T05:59:00'); assert.deepEqual(await santa(a), [], '06시 전에는 없음');
    await clock('2026-12-24T12:00:00'); assert.deepEqual(await santa(a), [], '24일에는 없음');
    await clock('2026-12-25T07:00:00');
    const got = await santa(a); assert.equal(got.length, 1); assert.match(got[0].text, /양말/); assert.equal(got[0].itemId, 'candy'); assert.equal(await candy(a), 2);
    assert.equal((await santa(a)).length, 1); assert.equal(await candy(a), 2, '한 번만');
    assert.deepEqual(await santa(b), [], '양말 걸이 없는 집'); assert.equal(await candy(b), 0);
  } finally { await req('/api/test/festival/clock', null, { at: 0 }); }
});
