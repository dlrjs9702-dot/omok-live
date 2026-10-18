'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JsonPointStore, PostgresPointStore } = require('../lib/point-store');
const { IP_SKIN_IDS } = require('../lib/skins');
const { testDatabase } = require('../test-support/pg-database');

// v1.10.90 IP 스킨 정리 (IDEAS #future-skins-double ③): the list of every character skin (the one place to look when they
// are removed), and the refund: what each owner paid, once, the skins out of the bag and the slots.
test('IP 스킨 목록: 캐릭터 게임 말·테마 33 + 아바타 44 + 변신 11(v1.10.91), 모두 ip 표시', () => {
  assert.equal(IP_SKIN_IDS.length, 93); // v1.10.92 + 포차코 파츠 4·변신 1
  assert.equal(new Set(IP_SKIN_IDS).size, 93);
  assert.ok(IP_SKIN_IDS.every((id) => /_(ip|ipt|tf)_/.test(id)));
});

async function behaves(store) {
  const user = 'guest:00000000-0000-4000-8000-0000000000a1';
  const other = 'guest:00000000-0000-4000-8000-0000000000a2';
  const ipSkin = IP_SKIN_IDS.find((id) => id.startsWith('avatar_ip_'));
  const before = (await store.getAccount(user)).balance;
  assert.equal((await store.buySkin({ userId: user, skinId: ipSkin, price: 200000, requestId: 'buy-ip-0001', title: 'ip' })).applied, true);
  assert.equal((await store.buySkin({ userId: user, skinId: 'omok_c1', price: 100000, requestId: 'buy-c1-0001', title: 'c1' })).applied, true);
  await store.equipSkin({ userId: user, game: 'avatar', slot: ipSkin.split('_').pop(), skinId: ipSkin });
  const first = await store.refundSkins(IP_SKIN_IDS);
  assert.deepEqual(first.refunded.map((r) => [r.skinId, r.price]), [[ipSkin, 200000]]);
  assert.equal((await store.getAccount(user)).balance, before - 100000, '산 값 그대로 환불, 다른 스킨은 그대로');
  const state = await store.skinState(user);
  assert.deepEqual(state.owned, ['omok_c1']);
  assert.equal(Object.values(state.equipped.avatar || {}).includes(ipSkin), false);
  assert.deepEqual((await store.refundSkins(IP_SKIN_IDS)).refunded, [], '두 번째는 아무것도 없음');
  assert.equal((await store.getAccount(user)).balance, before - 100000);
}

test('IP 스킨 정리 환불: JSON·PostgreSQL 같은 동작, 한 번만', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'iprefund-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const json = new JsonPointStore(path.join(dir, 'points.json'), { initialGrant: 1_000_000 }); await json.init();
  await behaves(json);
  const database = await testDatabase(); t.after(() => database.stop());
  const pg = new PostgresPointStore(database.url, { initialGrant: 1_000_000 }); t.after(() => pg.pool.end()); await pg.init();
  await behaves(pg);
});
