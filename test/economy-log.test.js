'use strict';
// v1.10.322 경제 로그 (lib/economy-log.js): the economy's sums as `[economy]` and `[economy:flows]` lines for Render's log -- the
// totals, what is held as numbers, yesterday's and the 14 days' in and out by reason; once a day after 00:10 Seoul; and
// never an account: no user id, name or entry file in either line (the store's stats carry the ten most with their ids)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const rmAtExit = require('../test-support/rm-at-exit');
const { JsonPointStore } = require('../lib/point-store');
const L = require('../lib/economy-log');
const HOUR = 3600000;
const at = (iso) => Date.parse(iso);

test('경제 로그: 두 줄, 합계·보유 분포·어제와 14일 사유별 흐름, 계정은 없음(아이디·이름 모양 없음), 매일 00:10 뒤 한 번', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'econlog-')); rmAtExit(dir);
  const store = new JsonPointStore(path.join(dir, 'points.json'), { initialGrant: 0 }); await store.init();
  const ids = ['guest:11111111-2222-4333-8444-555555555555', 'guest:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', 'admin'];
  for (const [i, u] of ids.entries()) { await store.ensureAccount(u); await store.adminGrant({ grantId: `admin-grant:econlog-${i}`, userId: u, amount: (i + 1) * 100_000, category: 'event', memo: '닉네임비밀' }); }
  const now = Date.now(); const stats = await store.economyStats(14, now);
  assert.equal(stats.accounts, 3); assert.ok(stats.active7 >= 3); assert.equal(stats.holdings.max, Math.max(...stats.top.map((r) => r.total)));
  assert.ok(stats.top.some((r) => r.userId), '스토어 통계에는 아이디가 있음(관리실용)');
  const [main, flows] = L.economyLogLines(stats, now, '1.10.322');
  assert.match(main, /^\[economy\] \{/); assert.match(flows, /^\[economy:flows\] \{/);
  const m = JSON.parse(main.slice('[economy] '.length)); assert.equal(m.accounts, 3); assert.equal(m.wallets, stats.wallets); assert.deepEqual(Object.keys(m.held), ['p50', 'p90', 'p99', 'max', 'top10']);
  assert.ok('tax' in m && 'interestDay' in m && 'yesterday' in m);
  const f = JSON.parse(flows.slice('[economy:flows] '.length)); assert.ok(Object.keys(f.byReason).length >= 1);
  for (const line of [main, flows]) {
    assert.doesNotMatch(line, /guest:|"admin"|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, '아이디 모양 없음');
    assert.doesNotMatch(line, /닉네임비밀|userId|name/, '이름·메모 없음');
  }
  // (1.10.330 사용자 75A) yesterday's interest actually added (no ledger row) and the bank's tiers as used, the administrator's marked
  const y = L.dayOf(now - 86400000); const withBank = JSON.parse(L.economyLogLines({ ...stats, interestPaid: { [y]: 354000, [L.dayOf(now)]: 9 }, rates: { tier1: 500000, rate1: 30, tier2: 5000000, rate2: 5, rate3: 1, set: ['rate2'] } }, now)[0].slice('[economy] '.length));
  assert.equal(withBank.interestPaid, 354000); assert.deepEqual(withBank.rates, { tier1: 500000, rate1: 30, tier2: 5000000, rate2: 5, rate3: 1, set: ['rate2'] });
  // a strange reason (never expected) is not written as it is
  const odd = L.economyLogLines({ flows: [{ day: L.dayOf(now), reason: 'guest:abc', in: 5, out: 0 }] }, now)[1]; assert.doesNotMatch(odd, /guest:/); assert.match(odd, /"other"/);
  // once a day after 00:10 Seoul
  assert.equal(L.dueDay(at('2026-11-16T00:05:00+09:00'), null), null); assert.equal(L.dueDay(at('2026-11-16T00:10:00+09:00'), null), '2026-11-16');
  assert.equal(L.dueDay(at('2026-11-16T13:00:00+09:00'), '2026-11-16'), null); assert.equal(L.dueDay(at('2026-11-17T00:11:00+09:00'), '2026-11-16'), '2026-11-17');
  void HOUR;
});
