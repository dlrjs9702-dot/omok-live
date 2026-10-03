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
