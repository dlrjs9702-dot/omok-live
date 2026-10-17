'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JsonPointStore, PostgresPointStore } = require('../lib/point-store');
const Items = require('../lib/island-items');
const { testDatabase } = require('../test-support/pg-database');

// v1.10.92 잡화점 (사용자 2026-10-18, IDEAS #future-general-store)
test('잡화점 물건: 16종, 판매가(되팔기 없음)·쓰임', () => {
  assert.equal(Items.GOODS.length, 16);
  for (const id of Items.GOODS) { const g = Items.ITEMS[id]; assert.ok(g.good && g.buy > 0 && g.name && ['bait', 'show', 'gift', 'errand', 'keep'].includes(g.use), id); assert.equal(g.at, null); }
  assert.equal(Items.sellAt([{ entryId: 'a', itemId: 'bait', qty: 3 }], 'merchant', 0).paid, 0, '되팔 수 없음');
  assert.deepEqual(['bait', 'bait_premium', 'firework', 'gift_wrap', 'bouquet'].map((id) => Items.ITEMS[id].buy), [300, 1000, 800, 500, 1200]);
});

async function behaves(store) {
  const u = 'guest:00000000-0000-4000-8000-0000000000e1';
  await store.ensureAccount(u); await store.adminGrant({ grantId: 'admin-grant:store-e1', userId: u, amount: 10_000, category: 'event', memo: '' });
  const start = (await store.getAccount(u)).balance;
  const buy = (requestId, itemId = 'bait', qty = 2, unit = 300) => store.islandBuy({ userId: u, requestId, itemId, qty, unit });
  const [x, y] = await Promise.all([buy('buy-0000001'), buy('buy-0000001')]);
  assert.equal([x, y].filter((r) => r.applied).length, 1, '같은 요청은 한 번만');
  assert.equal((await store.getAccount(u)).balance, start - 600);
  assert.equal((await store.islandBag(u)).items.find((e) => e.itemId === 'bait').qty, 2);
  assert.equal((await buy('buy-0000002', 'bouquet', 20, 100000)).reason, 'insufficient');
  await assert.rejects(store.islandBuy({ userId: u, requestId: 'buy-0000003', itemId: 'weed', qty: 1, unit: 1 }), RangeError, '잡화점 물건만');
  assert.equal((await store.islandUse({ userId: u, requestId: 'use-0000001', itemId: 'bait' })).applied, true);
  assert.equal((await store.islandUse({ userId: u, requestId: 'use-0000001', itemId: 'bait' })).already, true);
  assert.equal((await store.islandBag(u)).items.find((e) => e.itemId === 'bait').qty, 1);
  assert.equal((await store.islandUse({ userId: u, requestId: 'use-0000002', itemId: 'firework' })).reason, 'missing');
  for (let k = 0; k < 15; k += 1) await buy(`fill-00000${String(k).padStart(2, '0')}`, Items.GOODS[k + 1], 1, 1);
  assert.equal((await buy('buy-0000009', 'balloon', 1, 300)).applied, true, '같은 물건은 쌓임');
  const balance = (await store.getAccount(u)).balance;
  assert.equal((await store.islandBuy({ userId: u, requestId: 'buy-0000010', itemId: 'badge', qty: 1, unit: 1000 })).applied, true);
  assert.equal((await store.islandBuy({ userId: u, requestId: 'buy-0000011', itemId: 'frame', qty: 1, unit: 2000 })).applied, true);
  assert.equal((await store.getAccount(u)).balance, balance - 3000);
}
test('잡화점 구매·사용(JSON): 결제와 가방이 함께, 같은 요청 한 번, 잔액 부족·없는 물건', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'store-'));
  const store = new JsonPointStore(path.join(dir, 'points.json'), { initialGrant: 0 }); await store.init();
  await behaves(store);
  await fs.rm(dir, { recursive: true, force: true });
});
test('잡화점 구매·사용(PostgreSQL)', async (t) => {
  const database = await testDatabase(); t.after(() => database.stop());
  const pg = new PostgresPointStore(database.url, { initialGrant: 0 }); t.after(() => pg.pool.end()); await pg.init();
  await behaves(pg);
});
