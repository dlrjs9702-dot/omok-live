'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JsonPointStore, PostgresPointStore, INITIAL_GRANT } = require('../lib/point-store');
const { testDatabase } = require('../test-support/pg-database');

// v1.10.35 경제 기준(통합, 사용자 확정 2026-10-06): the release sets every balance to 0P once (a ledger row each, the
// balance before kept there), new accounts start at 0P, and an account made after the reset is never reset again.
const A = 'guest:11111111-1111-4111-8111-111111111111';
const B = 'guest:22222222-2222-4222-8222-222222222222';

test('경제 개편: 신규 계정은 0P에서 시작한다', () => assert.equal(INITIAL_GRANT, 0));

test('경제 개편: JSON 저장소 — 배포 때 한 번 전부 0P, 기록 남김, 이후 계정은 그대로', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reset-'));
  const file = path.join(dir, 'points.json');
  const at = new Date().toISOString();
  const before = { accounts: { [A]: { balance: 1_234_000, createdAt: at, updatedAt: at }, [B]: { balance: 0, createdAt: at, updatedAt: at } }, ledger: [], keys: {} };
  await fs.writeFile(file, JSON.stringify(before));
  const store = new JsonPointStore(file);
  await store.init();
  assert.equal((await store.getAccount(A)).balance, 0);
  const row = (await store.ledger(A)).find((r) => r.reason === 'economy_reset');
  assert.equal(row.balanceBefore, 1_234_000);
  const fresh = 'guest:33333333-3333-4333-8333-333333333333';
  assert.equal((await store.ensureAccount(fresh)).balance, 0);
  assert.deepEqual(await store.resetEconomy(), { applied: false });
  const reloaded = new JsonPointStore(file);
  await reloaded.init();
  assert.equal((await reloaded.ledger(A)).filter((r) => r.reason === 'economy_reset').length, 1, '다시 시작해도 한 번만');
  await fs.rm(dir, { recursive: true, force: true });
});

test('경제 개편: PostgreSQL 저장소 — 한 번만, 잔액 있는 계정마다 기록', async (t) => {
  const database = await testDatabase();
  t.after(() => database.stop());
  const store = new PostgresPointStore(database.url, { initialGrant: 100_000 });
  t.after(() => store.pool.end());
  await store.init(); // empty: the marker is taken, nothing to reset
  await store.ensureAccount(A); await store.ensureAccount(B);
  await store.pool.query("UPDATE point_accounts SET balance = 0 WHERE user_id = $1", [B]);
  await store.pool.query("DELETE FROM island_world WHERE key = 'economy_reset_2026_10_v1'"); // as before the release
  assert.deepEqual(await store.resetEconomy(), { applied: true, accounts: 1 });
  assert.equal((await store.getAccount(A)).balance, 0);
  const rows = (await store.pool.query("SELECT balance_before, balance_after FROM point_ledger WHERE reason = 'economy_reset'")).rows;
  assert.deepEqual(rows.map((r) => [Number(r.balance_before), Number(r.balance_after)]), [[100_000, 0]]);
  assert.deepEqual(await store.resetEconomy(), { applied: false });
  await store.init();
  assert.equal(Number((await store.pool.query("SELECT count(*) FROM point_ledger WHERE reason = 'economy_reset'")).rows[0].count), 1);
});
