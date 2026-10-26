'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { bankInterest, bankAccrue, bankTerms, attendanceStreak, attendanceAmount, JsonPointStore, PostgresPointStore } = require('../lib/point-store');
const { testDatabase } = require('../test-support/pg-database');
const { weeklyPrize, dailyClimbReward } = require('../lib/climb');

// 경제 점검 ⑥ (gamecenter-notes docs/economy-audit-20261025.md, 사용자 2026-10-25): the deposit's interest by tiers, the
// climbing prizes and the attendance lowered -- each from the economy table (lib/economy.js, its defaults here)
test('예금 구간 이자: 50만까지 3%, 500만까지 1.5%, 그 위 0.5% — 구간별로 나눠 계산', () => {
  assert.equal(bankInterest(100_000), 3000);
  assert.equal(bankInterest(1_000_000), 15_000 + 7500);
  assert.equal(bankInterest(10_000_000), 15_000 + 67_500 + 25_000);
  assert.equal(bankAccrue(100_000, '2026-10-16', '2026-10-17'), 103_000);
  assert.ok(bankAccrue(100_000_000, '2026-01-01', '2026-12-31') < 100_000_000 * 8, '큰 예금은 4% 복리처럼 끝없이 불지 않음');
  assert.deepEqual(bankTerms(1_000_000), { tiers: [{ upTo: 500_000, percent: 3 }, { upTo: 5_000_000, percent: 1.5 }, { upTo: null, percent: 0.5 }], tomorrow: 22_500 });
});

test('등반 상: 주간 20만·15만·10만·4~20위 3만, 하루 최대 3만(같은 곡선)', () => {
  assert.deepEqual([1, 2, 3, 4, 20, 21].map(weeklyPrize), [200_000, 150_000, 100_000, 30_000, 30_000, 0]);
  assert.deepEqual([3000, 1500, 0].map(dailyClimbReward), [30_000, 7500, 0]);
});

// ⑥-C/⑥-E through the stores: a 7th day in a row pays the extra, and the 관리자 「경제」 numbers -- JSON and PostgreSQL alike
async function storeBehaves(store) {
  const U = 'guest:00000000-0000-4000-8000-0000000000e1'; const day = (d) => Date.parse(`2026-11-${String(d).padStart(2, '0')}T12:00:00+09:00`);
  const paid = []; for (let d = 1; d <= 8; d += 1) paid.push((await store.claimAttendance(U, day(d))).amount);
  assert.deepEqual(paid, [30_000, 30_000, 30_000, 30_000, 30_000, 30_000, 50_000, 30_000]);
  assert.equal((await store.attendanceDates(U)).length, 8);
  await store.bankMove(U, 100_000, 'econ-in-0001', day(8));
  const s = await store.economyStats(14, day(8));
  assert.deepEqual([s.wallets, s.deposits], [100_000 + 260_000 - 100_000, 100_000]);
  const att = s.flows.filter((f) => f.reason === 'daily_attendance');
  assert.equal(att.reduce((n, f) => n + f.in, 0), 260_000); assert.ok(s.flows.some((f) => f.reason === 'bank_deposit' && f.out === 100_000));
  assert.deepEqual([s.top[0].userId, s.top[0].total], [U, 360_000]);
}
test('출석 연속·경제 통계: JSON·PostgreSQL 같은 동작', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'econ-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const json = new JsonPointStore(path.join(dir, 'points.json'), { initialGrant: 100_000 }); await json.init();
  await storeBehaves(json);
  const database = await testDatabase(); t.after(() => database.stop());
  const pg = new PostgresPointStore(database.url, { initialGrant: 100_000 }); t.after(() => pg.pool.end()); await pg.init();
  await storeBehaves(pg);
});

test('출석: 하루 3만, 7일·14일 연속인 날은 2만 더', () => {
  const days = (n, end = '2026-11-14') => new Set(Array.from({ length: n }, (_, i) => new Date(Date.parse(`${end}T00:00:00Z`) - i * 86400000).toISOString().slice(0, 10)));
  assert.equal(attendanceStreak(days(6), '2026-11-14'), 6);
  assert.equal(attendanceStreak(days(6), '2026-11-15'), 0, '오늘 안 왔으면 0');
  assert.deepEqual([1, 6, 7, 8, 14].map(attendanceAmount), [30_000, 30_000, 50_000, 30_000, 50_000]);
});
