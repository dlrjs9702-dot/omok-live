'use strict';
// 문제 기록 5회차 10-①: a tool at the 잡화점 (낚싯대, 잠자리채, a bike) is bought once -- one, and not while one is in the bag
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');
const T = require('../public/plaza/island-terrain');
const S = require('../public/plaza/island-store');

test('잡화점 도구: 한 개만, 가방에 있으면 「이미 가지고 있어요」', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'store-tools-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('도구손님'));
  const key = (await req('/api/admin/keys', server.admin)).data.keys.find((k) => k.label === '도구손님');
  await req(`/api/admin/keys/${key.id}/points`, server.admin, { amount: 100000, category: 'other', memo: '시험', requestId: require('node:crypto').randomUUID() });
  const door = T.facilityDoor('store'); await req('/api/plaza/state', a, { x: door.x, z: door.z, yaw: 0 });
  assert.equal((await req('/api/island/store/enter', a, {})).status, 200);
  const w = S.standFor('fishing_rod'); // (v1.10.211: before the tool wall's hook)
  await req('/api/plaza/state', a, { x: w.x, z: w.z, yaw: 0 });
  const buy = (qty, n) => req('/api/island/store/buy', a, { itemId: 'fishing_rod', qty, requestId: `rod-${n}-00000000` });
  assert.equal((await buy(5, 1)).data.error, 'BAD_QTY', '5개는 안 됨');
  const first = await buy(1, 2); assert.equal(first.status, 200, JSON.stringify(first.data));
  assert.equal((await buy(1, 3)).data.error, 'ALREADY_HAVE', '가방에 있으면 거절');
  const b = S.standFor('bait'); // (v1.10.211: by its gondola)
  await req('/api/plaza/state', a, { x: b.x, z: b.z, yaw: 0 });
  assert.equal((await req('/api/island/store/buy', a, { itemId: 'bait', qty: 5, requestId: 'bait-5-00000000' })).status, 200, '소모품은 그대로 5개');
});
