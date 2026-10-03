'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JsonPointStore } = require('../lib/point-store');
const { dailyClimbReward, competitionRanking, weeklyPrize, climbWeekOf } = require('../lib/climb');

const at = (iso) => Date.parse(iso);
async function store(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'climb-store-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const s = new JsonPointStore(path.join(dir, 'points.json'));
  await s.init();
  return s;
}
let n = 0;
const climbId = () => `test-climb-${String(n += 1).padStart(4, '0')}`;

test('등반 보상 곡선: 기준값과 상·하한', () => {
  assert.deepEqual([300, 600, 900, 1500, 2100, 2400, 2700, 3000].map(dailyClimbReward), [1000, 4000, 9000, 25000, 49000, 64000, 81000, 100000]);
  assert.equal(dailyClimbReward(3001), 100000, '3,000m 초과도 100,000P가 상한');
  assert.equal(dailyClimbReward(-10), 0);
  assert.equal(dailyClimbReward('nope'), 0);
});

test('일일 보상: 첫 기록 지급, 같은 날 더 높으면 차액만, 같거나 낮으면 0, 날이 바뀌면 새로', async (t) => {
  const s = await store(t);
  const user = 'guest:00000000-0000-4000-8000-000000000001';
  const day1 = at('2026-10-06T03:00:00Z'); // KST 12:00 Tue
  const first = await s.recordClimb({ userId: user, climbId: climbId(), altitude: 1500, name: '등반가' }, day1);
  assert.deepEqual([first.delta, first.best, first.paid], [25000, 1500, 25000]);
  const higher = await s.recordClimb({ userId: user, climbId: climbId(), altitude: 2100 }, day1 + 1000);
  assert.deepEqual([higher.delta, higher.best, higher.paid], [24000, 2100, 49000], '49,000 - 25,000');
  const same = await s.recordClimb({ userId: user, climbId: climbId(), altitude: 2100 }, day1 + 2000);
  const lower = await s.recordClimb({ userId: user, climbId: climbId(), altitude: 900 }, day1 + 3000);
  assert.deepEqual([same.delta, lower.delta, lower.best], [0, 0, 2100]);
  const top = await s.recordClimb({ userId: user, climbId: climbId(), altitude: 3000 }, day1 + 4000);
  assert.deepEqual([top.delta, top.paid], [51000, 100000], '하루 총 100,000P');
  assert.equal((await s.getAccount(user, day1)).balance, 100_000 + 100_000);
  // KST midnight: 2026-10-06T15:00Z is Wednesday 00:00 in Seoul
  const before = await s.recordClimb({ userId: user, climbId: climbId(), altitude: 300 }, at('2026-10-06T14:59:59Z'));
  assert.equal(before.delta, 0, '아직 같은 날');
  const next = await s.recordClimb({ userId: user, climbId: climbId(), altitude: 300 }, at('2026-10-06T15:00:00Z'));
  assert.deepEqual([next.delta, next.date], [1000, '2026-10-07'], '새 날의 첫 기록');
  assert.deepEqual((await s.climbStatus(user, at('2026-10-06T15:00:01Z'))).today, { best: 300, paid: 1000 });
});

test('일일 보상: 같은 등반을 다시 보내거나 동시에 보내도 한 번만 지급, 비정상 고도는 거절', async (t) => {
  const s = await store(t);
  const user = 'guest:00000000-0000-4000-8000-000000000002';
  const now = at('2026-10-07T01:00:00Z');
  const id = climbId();
  const [a, b, c] = await Promise.all([1, 2, 3].map(() => s.recordClimb({ userId: user, climbId: id, altitude: 600 }, now)));
  assert.equal([a, b, c].filter((r) => r.applied).length, 1, '같은 등반은 한 번만 기록');
  const [x, y] = await Promise.all([s.recordClimb({ userId: user, climbId: climbId(), altitude: 900 }, now), s.recordClimb({ userId: user, climbId: climbId(), altitude: 900 }, now)]);
  assert.equal(x.delta + y.delta, 9000 - 4000, '동시에 두 기록이어도 하루 총보상 기준 차액만');
  assert.equal((await s.getAccount(user, now)).balance, 100_000 + 9000);
  for (const bad of [-1, 3001, 1.5, NaN, '300']) await assert.rejects(s.recordClimb({ userId: user, climbId: climbId(), altitude: bad }, now), /altitude/i, String(bad));
  await assert.rejects(s.recordClimb({ userId: user, climbId: 'x', altitude: 10 }, now), /climb id/i);
  const history = (await s.history(user)).items;
  assert.ok(history.some((item) => item.reason === 'climb_daily' && item.detail === 'climb' && /m 기록/.test(item.memo)), '포인트 내역에 등반 보상');
});

test('주간 기록: 월요일 00:00 KST 경계, 같은 주는 최고 기록만, 주가 바뀌면 새 기록', async (t) => {
  const s = await store(t);
  const sunday = at('2026-10-11T14:59:59Z'); // Sun 23:59:59 KST
  const monday = at('2026-10-11T15:00:00Z'); // Mon 00:00 KST
  assert.equal(climbWeekOf(sunday), '2026-10-05');
  assert.equal(climbWeekOf(monday), '2026-10-12');
  await s.recordClimb({ userId: 'guest:00000000-0000-4000-8000-000000000003', climbId: climbId(), altitude: 1200, name: 'W' }, sunday - 60000);
  await s.recordClimb({ userId: 'guest:00000000-0000-4000-8000-000000000003', climbId: climbId(), altitude: 800, name: 'W' }, sunday);
  await s.recordClimb({ userId: 'guest:00000000-0000-4000-8000-000000000003', climbId: climbId(), altitude: 500, name: 'W' }, monday);
  const last = await s.climbWeekRows('2026-10-05');
  const now = await s.climbWeekRows('2026-10-12');
  assert.deepEqual(last.map((r) => r.best), [1200], '지난주는 최고 기록 하나');
  assert.deepEqual(now.map((r) => r.best), [500], '새 주는 새 기록');
});

test('주간 순위: 경쟁 순위(1·1·3 / 1·2·2·2·5)와 순위 보상', () => {
  const rank = (bests) => competitionRanking(bests.map((best, i) => ({ userId: `u${i}`, best }))).map((r) => r.rank);
  assert.deepEqual(rank([3000, 3000, 2950]), [1, 1, 3]);
  assert.deepEqual(rank([3000, 2000, 2000, 2000, 1000]), [1, 2, 2, 2, 5]);
  assert.deepEqual(rank([0, 10]), [1], '0m 기록은 순위에 없다');
  assert.deepEqual([1, 2, 3, 4, 20, 21].map(weeklyPrize), [1_000_000, 700_000, 500_000, 100_000, 100_000, 0]);
});

// v1.9.5 주간 결산: 경쟁 순위 보상(공동순위는 각자 전액, 20위 밖 없음), 공동 1위 전원 챔피언, 한 번만 결산.
const uid = (i) => `guest:00000000-0000-4000-8000-${String(1000 + i).padStart(12, '0')}`;
async function weekWith(s, bests, when = at('2026-10-07T03:00:00Z')) { // week 2026-10-05
  for (const [i, best] of bests.entries()) await s.recordClimb({ userId: uid(i), climbId: climbId(), altitude: best, name: `P${i}` }, when + i);
  return '2026-10-05';
}
const paid = async (s, i) => (await s.getAccount(uid(i), at('2026-10-20T00:00:00Z'))).balance;

test('주간 결산: 1위·1위·3위 — 공동 1위 둘 다 1,000,000P·챔피언, 다음은 3위 500,000P', async (t) => {
  const s = await store(t);
  const week = await weekWith(s, [3000, 3000, 2950]);
  assert.deepEqual(await s.climbUnsettledWeeks('2026-10-12'), [week]);
  assert.deepEqual(await s.climbUnsettledWeeks('2026-10-05'), [], '진행 중인 주는 결산하지 않는다');
  const result = await s.settleClimbWeek(week);
  assert.deepEqual(result.ranking.map((r) => r.rank), [1, 1, 3]);
  assert.deepEqual(result.payouts.map((p) => p.amount), [1_000_000, 1_000_000, 500_000]);
  assert.deepEqual(result.champions.sort(), [uid(0), uid(1)].sort());
  // daily (100,000 / 100,000 / ~97,000) + weekly prize on top of the 100,000 start
  assert.equal(await paid(s, 0), 100_000 + 100_000 + 1_000_000);
  assert.equal(await paid(s, 2), 100_000 + Math.round(100_000 * (2950 / 3000) ** 2) + 500_000);
  assert.deepEqual((await s.climbWeekResult(week)).champions.sort(), [uid(0), uid(1)].sort());
  assert.deepEqual(await s.climbUnsettledWeeks('2026-10-12'), []);
});

test('주간 결산: 1위·2위·2위·2위·5위, 다시 결산하거나 동시에 결산해도 한 번만 지급', async (t) => {
  const s = await store(t);
  const week = await weekWith(s, [3000, 2000, 2000, 2000, 1000]);
  const [r1, r2] = await Promise.all([s.settleClimbWeek(week), s.settleClimbWeek(week)]);
  assert.equal([r1, r2].filter((r) => r.applied).length, 1, '동시에 두 번 결산해도 한 번');
  const again = await s.settleClimbWeek(week);
  assert.equal(again.applied, false);
  assert.deepEqual(r1.ranking.map((r) => r.rank), [1, 2, 2, 2, 5]);
  assert.deepEqual(r1.payouts.map((p) => p.amount), [1_000_000, 700_000, 700_000, 700_000, 100_000], '건너뛴 3·4위 보상은 없다');
  assert.deepEqual(r1.champions, [uid(0)], '2위 이하는 챔피언 아님');
  const daily = (h) => Math.round(100_000 * (h / 3000) ** 2);
  assert.equal(await paid(s, 3), 100_000 + daily(2000) + 700_000);
  assert.equal((await s.history(uid(1))).items.filter((item) => item.reason === 'climb_weekly_rank').length, 1);
});

test('주간 결산: 20위 동률은 모두 100,000P, 공동순위로 다음 순위가 20위를 넘으면 순위권 보상 없음', async (t) => {
  const s = await store(t);
  // 19 distinct records, then three tied at 20th, then one more (rank 23)
  const bests = [...Array.from({ length: 19 }, (_, i) => 2900 - i * 10), 500, 500, 500, 100];
  const week = await weekWith(s, bests);
  const result = await s.settleClimbWeek(week);
  const byRank = (rank) => result.payouts.filter((p) => p.rank === rank).map((p) => p.amount);
  assert.deepEqual(byRank(20), [100_000, 100_000, 100_000]);
  assert.ok(!result.payouts.some((p) => p.rank > 20), '23위는 없음');
  const s2 = await store(t);
  const week2 = await weekWith(s2, [...Array.from({ length: 18 }, (_, i) => 2900 - i * 10), 300, 300, 300, 50]); // ranks 19,19,19 then 22
  const result2 = await s2.settleClimbWeek(week2);
  assert.deepEqual(result2.payouts.filter((p) => p.rank === 19).length, 3);
  assert.ok(!result2.payouts.some((p) => p.rank === 22));
});
