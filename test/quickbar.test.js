'use strict';
// v1.10.236 빠른 칸 (notes docs/quickbar-20261104.md): five slots of tools (by kind) and things to use (by id), one thing in
// one slot; the server keeps mine (the same on every screen) and refuses anything else; what is in my hand others see
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const I = require('../lib/island-items');
const { boot } = require('../test-support/test-server');

test('빠른 칸 규칙: 다섯 칸, 도구·쓰는 것만, 한 물건은 한 칸', () => {
  assert.deepEqual(I.quickSlots(['bugnet', 'firework']), ['bugnet', 'firework', null, null, null]);
  assert.deepEqual(I.quickSlots([]), [null, null, null, null, null]);
  assert.deepEqual(I.quickSlots([null, '', 'balloon', null, 'fishing_rod']), [null, null, 'balloon', null, 'fishing_rod']);
  assert.equal(I.quickSlots(['bugnet', null, null, null, null, 'firework']), null, '여섯 칸');
  assert.equal(I.quickSlots(['fish_goby']), null, '물고기');
  assert.equal(I.quickSlots(['seed_flower_red']), null, '꽃씨');
  assert.equal(I.quickSlots(['firework', 'firework']), null, '같은 것 두 칸');
  assert.equal(I.quickSlots('bugnet'), null);
});

test('빠른 칸 서버: 저장·다른 화면에서 같음·거절, 든 것은 다른 사람에게', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'quick-')); rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('빠른칸')); const b = await server.enter(await server.issue('구경꾼'));
  assert.deepEqual((await req('/api/island/quick', a)).data.slots, [null, null, null, null, null]);
  assert.equal((await req('/api/island/quick', a, { slots: ['bugnet', 'firework', 'balloon', null, null] })).status, 200);
  assert.deepEqual((await req('/api/island/quick', a)).data.slots, ['bugnet', 'firework', 'balloon', null, null]);
  for (const slots of [['fish_goby'], ['bugnet', 'bugnet'], new Array(6).fill(null)]) assert.equal((await req('/api/island/quick', a, { slots })).data.error, 'BAD_QUICK');
  assert.deepEqual((await req('/api/island/quick', a)).data.slots, ['bugnet', 'firework', 'balloon', null, null], '거절은 그대로');
  // in my hand: a 폭죽, seen by the other one; something else, nothing
  await req('/api/plaza/state', a, { x: 0, z: 8, yaw: 0, moving: false, held: 'firework' }); await req('/api/plaza/state', b, { x: 2, z: 8, yaw: 0, moving: false });
  const seen = async () => (await req('/api/test/plaza-snapshot')).data.players?.find((p) => p.name === '빠른칸')?.held ?? null;
  assert.equal(await seen(), 'firework');
  await req('/api/plaza/state', a, { x: 0, z: 8, yaw: 0, moving: false, held: 'trash' }); assert.equal(await seen(), null);
});
