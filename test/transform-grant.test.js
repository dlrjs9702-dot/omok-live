'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JsonPointStore, PostgresPointStore } = require('../lib/point-store');
const { skinById, transformationById, transformSkinId, avatarLookOf } = require('../lib/skins');
const { testDatabase } = require('../test-support/pg-database');

// v1.10.91 변신 따로 판매 A안 (사용자 2026-10-18): whoever owns every part of a set gets its transformation free, once;
// whoever wears the whole set now stays transformed; a partial set gets nothing
async function behaves(store) {
  const full = 'guest:00000000-0000-4000-8000-0000000000d1'; const worn = 'guest:00000000-0000-4000-8000-0000000000d2'; const part = 'guest:00000000-0000-4000-8000-0000000000d3';
  const kitty = transformationById('hellokitty').items;
  for (const u of [full, worn, part]) { await store.ensureAccount(u); await store.adminGrant({ grantId: `admin-grant:tf-${u.slice(-2)}`, userId: u, amount: 5_000_000, category: 'event', memo: '' }); }
  for (const u of [full, worn]) for (const id of Object.values(kitty)) await store.buySkin({ userId: u, skinId: id, price: skinById(id).price, title: 'x' });
  await store.buySkin({ userId: part, skinId: kitty.outfit, price: skinById(kitty.outfit).price, title: 'x' });
  for (const [slot, id] of Object.entries(kitty)) await store.equipSkin({ userId: worn, game: 'avatar', slot, skinId: id });
  const balance = (await store.getAccount(full)).balance;
  const sets = [{ tf: transformSkinId('hellokitty'), items: kitty }, { tf: transformSkinId('animal-cat'), items: transformationById('animal-cat').items }];
  const out = await store.grantTransformations(sets);
  assert.deepEqual(out.granted.map((g) => g.userId).sort(), [full, worn].sort());
  const tf = transformSkinId('hellokitty');
  assert.ok((await store.skinState(full)).owned.includes(tf)); assert.equal((await store.skinState(full)).equipped.avatar?.transform, undefined, '입고 있지 않았으면 고르지 않음');
  assert.equal((await store.skinState(worn)).equipped.avatar.transform, tf, '입고 있었으면 변신 그대로');
  assert.equal(avatarLookOf((await store.skinState(worn)).equipped).look.transform, 'hellokitty');
  assert.ok(!(await store.skinState(part)).owned.includes(tf));
  assert.equal((await store.getAccount(full)).balance, balance, '무료');
  assert.deepEqual((await store.grantTransformations(sets)).granted, [], '한 번만');
}

test('변신 지급 A안 (JSON)', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-grant-'));
  const store = new JsonPointStore(path.join(dir, 'points.json'), { initialGrant: 0 }); await store.init();
  await behaves(store);
  await fs.rm(dir, { recursive: true, force: true });
});
test('변신 지급 A안 (PostgreSQL)', async (t) => {
  const database = await testDatabase(); t.after(() => database.stop());
  const pg = new PostgresPointStore(database.url, { initialGrant: 0 }); t.after(() => pg.pool.end()); await pg.init();
  await behaves(pg);
});
