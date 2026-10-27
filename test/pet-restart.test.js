'use strict';
// 펫 깜빡임 (사용자 2026-10-27 「펫이 자꾸 한번씩 없어지는데」): a server just up (a deploy, Render waking) has no pet cached --
// the first pose went out with none, and a 펫샵 pet (ditto·변신) was never read back at all. Now the walking pet is there from
// the first pose after a restart.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const T = require('../public/plaza/island-terrain.js');
const S = require('../public/plaza/island-store');
const { boot } = require('../test-support/test-server');

test('서버가 다시 뜬 직후 첫 자세 전송에서도 데리고 다니는 펫이 보인다(펫샵 메타몽 포함)', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pet-restart-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const first = await boot(t, dir);
  const key = await first.issue('펫주인');
  const a = await first.enter(key);
  await first.req('/api/test/points-credit', a, { amount: 100000 });
  await first.req('/api/plaza/state', a, { ...T.facilityDoor('store'), yaw: 0, moving: false });
  assert.equal((await first.req('/api/island/store/enter', a, {})).status, 200);
  await first.req('/api/plaza/state', a, { ...S.world(...S.LIFT.stand), yaw: 0, moving: false });
  assert.equal((await first.req('/api/island/lift', a, { to: 3 })).data.space, 'petshop');
  const bought = await first.req('/api/island/petshop/buy', a, { kind: 'ditto', name: '말랑' });
  assert.equal(bought.status, 200, JSON.stringify(bought.data));
  await first.stop();

  const again = await boot(t, dir);
  const b = await again.enter(key);
  await again.req('/api/plaza/state', b, { ...T.facilityDoor('store'), yaw: 0, moving: false });
  const shown = (await again.req('/api/test/plaza-snapshot')).data.players;
  assert.equal(shown.length, 1);
  assert.deepEqual(shown[0].pet, { kind: 'ditto', coat: null, name: '말랑' });
});
