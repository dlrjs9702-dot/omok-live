'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JsonPointStore, PostgresPointStore, kstDate, capTransfers, INITIAL_GRANT, DAILY_ATTENDANCE } = require('../lib/point-store');

const A = 'guest:11111111-1111-4111-8111-111111111111';
const B = 'guest:22222222-2222-4222-8222-222222222222';
const C = 'guest:33333333-3333-4333-8333-333333333333';
// 2026-09-27 00:30 KST == 2026-09-26 15:30 UTC
const KST_EARLY = Date.parse('2026-09-26T15:30:00Z');
const KST_LATE = Date.parse('2026-09-27T14:59:59Z'); // 23:59:59 KST same day
const KST_NEXT = Date.parse('2026-09-27T15:00:00Z'); // 00:00 KST next day

test('KST 날짜 경계는 한국시간 자정이다', () => {
  assert.equal(kstDate(Date.parse('2026-09-26T14:59:59Z')), '2026-09-26');
  assert.equal(kstDate(KST_EARLY), '2026-09-27');
  assert.equal(kstDate(KST_LATE), '2026-09-27');
  assert.equal(kstDate(KST_NEXT), '2026-09-28');
});

test('잔액 한도: 패자는 보유분까지만 내고 승자는 실제 지불분만 받는다', () => {
  const [first, second] = capTransfers([
    { from: A, to: B, amount: 80_000 },
    { from: C, to: B, amount: 10_000 },
  ], { [A]: 30_000, [B]: 0, [C]: 50_000 });
  assert.deepEqual([first.paid, first.capped, second.paid, second.capped], [30_000, true, 10_000, false]);
});

async function exercise(t, makeStore) {
  const store = await makeStore();
  await t.test('신규 계정은 100,000P를 한 번만 받는다', async () => {
    const first = await store.ensureAccount(A);
    const again = await store.ensureAccount(A);
    assert.deepEqual([first.balance, first.created, again.balance, again.created], [INITIAL_GRANT, true, INITIAL_GRANT, false]);
    const rows = await store.ledger(A);
    assert.equal(rows.filter(row => row.reason === 'initial_grant').length, 1);
  });

  await t.test('출석은 KST 날짜당 한 번, 동시 요청에도 정확히 한 번 +50,000P', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => store.claimAttendance(A, KST_EARLY)));
    assert.equal(results.filter(result => result.granted).length, 1);
    assert.equal((await store.claimAttendance(A, KST_LATE)).granted, false);
    const account = await store.getAccount(A, KST_LATE);
    assert.deepEqual(account, { balance: INITIAL_GRANT + DAILY_ATTENDANCE, attendance: { date: '2026-09-27', claimed: true } });
    const next = await store.claimAttendance(A, KST_NEXT);
    assert.equal(next.granted, true);
    assert.equal(next.balance, INITIAL_GRANT + 2 * DAILY_ATTENDANCE);
  });

  await t.test('정산은 원자적·1회만, 잔액은 0 미만이 되지 않고 원장과 일치한다', async () => {
    await store.ensureAccount(B); await store.ensureAccount(C);
    const plan = { settlementId: 'room1:1', matchId: 'room1:1', gameType: 'gostop', transfers: [
      { from: B, to: A, amount: 150_000 }, // B holds 100,000 → capped
      { from: C, to: A, amount: 20_000 },
    ] };
    const outcomes = await Promise.all([store.settle(plan), store.settle(plan), store.settle(plan)]);
    assert.equal(outcomes.filter(item => item.applied).length, 1);
    const applied = outcomes.find(item => item.applied);
    assert.deepEqual(applied.transfers.map(item => [item.requested, item.paid, item.capped]), [[150_000, 100_000, true], [20_000, 20_000, false]]);
    assert.equal((await store.settle(plan)).applied, false);
    const balances = await Promise.all([A, B, C].map(id => store.getAccount(id, KST_NEXT)));
    assert.deepEqual(balances.map(item => item.balance), [INITIAL_GRANT + 2 * DAILY_ATTENDANCE + 120_000, 0, 80_000]);
    for (const id of [A, B, C]) {
      const rows = await store.ledger(id, 100);
      const sum = rows.reduce((total, row) => total + row.delta, 0);
      assert.equal(sum, (await store.getAccount(id, KST_NEXT)).balance, `${id} 원장 합계`);
      for (const row of rows) {
        assert.equal(row.balanceAfter, row.balanceBefore + row.delta);
        assert.ok(row.balanceAfter >= 0);
      }
    }
    // A player with 0P can lose nothing further.
    const again = await store.settle({ settlementId: 'room1:2', matchId: 'room1:2', gameType: 'gostop', transfers: [{ from: B, to: C, amount: 5_000 }] });
    assert.equal(again.transfers[0].paid, 0);
    assert.equal((await store.getAccount(B, KST_NEXT)).balance, 0);
  });

  await t.test('잘못된 계정·금액·자기 송금은 거부한다', async () => {
    await assert.rejects(() => store.ensureAccount('admin:session-token'));
    await assert.rejects(() => store.settle({ settlementId: 'x', gameType: 'gostop', transfers: [{ from: A, to: A, amount: 1 }] }));
    await assert.rejects(() => store.settle({ settlementId: 'y', gameType: 'gostop', transfers: [{ from: A, to: B, amount: -5 }] }));
  });
  return store;
}

test('JSON 포인트 저장소', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'points-'));
  const file = path.join(dir, 'points.json');
  await exercise(t, async () => { const store = new JsonPointStore(file); await store.init(); return store; });
  // Reload from disk: balances survive a restart.
  const reloaded = new JsonPointStore(file);
  await reloaded.init();
  assert.equal((await reloaded.getAccount(B)).balance, 0);
  await fs.rm(dir, { recursive: true, force: true });
});

test('PostgreSQL 포인트 저장소', { skip: !process.env.POINTS_TEST_DATABASE_URL && 'POINTS_TEST_DATABASE_URL 미설정' }, async (t) => {
  const url = process.env.POINTS_TEST_DATABASE_URL;
  const { Pool } = require('pg');
  const admin = new Pool({ connectionString: url });
  await admin.query('DROP TABLE IF EXISTS point_ledger, point_settlements, point_accounts');
  await admin.end();
  const store = await exercise(t, async () => { const s = new PostgresPointStore(url); await s.init(); await s.init(); return s; });
  await store.pool.end();
});
