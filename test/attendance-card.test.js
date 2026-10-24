'use strict';
// 창 2단계 출석 도장 카드: this month's days attended (Seoul) -- none before, today's after the claim, and the month's shape
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');
const { kstDate } = require('../lib/point-store');

test('출석 도장 카드: 이번 달 출석한 날, 출석하면 오늘이 찍힘, 달의 길이·첫 요일', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'attendance-card-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const { req, issue, enter } = await boot(t, dir);
  const s = await enter(await issue('도장'));
  const before = (await req('/api/points/attendance/month', s)).data;
  const today = kstDate(Date.now()); const [y, m, d] = today.split('-').map(Number);
  assert.deepEqual({ month: before.month, today: before.today, days: before.days }, { month: today.slice(0, 7), today: d, days: [] });
  assert.equal(before.length, new Date(Date.UTC(y, m, 0)).getUTCDate()); assert.equal(before.firstWeekday, new Date(Date.UTC(y, m - 1, 1)).getUTCDay());
  assert.equal((await req('/api/points/attendance', s, {})).data.granted, true);
  assert.deepEqual((await req('/api/points/attendance/month', s)).data.days, [d]);
  assert.equal((await req('/api/points/attendance/month')).status, 401);
});
