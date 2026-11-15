'use strict';
// v1.10.322 경제 로그 (사용자 「직접 읽을 수 있게」, 총괄: the 운영 DB is closed to us -- read through Render's log like [issue]):
// pointStore.economyStats(14) as two lines -- `[economy]` the totals (accounts, the last 7 days' active ones, wallets and
// deposits, what is held as numbers only, a day's interest, the tax still owed, yesterday's in and out by reason) and
// `[economy:flows]` the 14 days' in and out by reason. Never an account: no user id, name or entry file -- only sums.
const KST = 9 * 3600000;
const dayOf = (ms) => new Date(ms + KST).toISOString().slice(0, 10);
// a reason is a word of the code (stock_buy, quest, ...); anything else -- never expected -- is kept out
const safeReason = (r) => (/^[a-z][a-z0-9_]{0,40}$/.test(String(r)) ? String(r) : 'other');
function byReason(flows) {
  const out = {};
  for (const f of flows) { const k = safeReason(f.reason); const o = (out[k] ||= { in: 0, out: 0 }); o.in += Number(f.in) || 0; o.out += Number(f.out) || 0; }
  return Object.fromEntries(Object.entries(out).sort((a, b) => (b[1].in + b[1].out) - (a[1].in + a[1].out)));
}
function economyLogLines(stats, now = Date.now(), version = '') {
  const flows = Array.isArray(stats?.flows) ? stats.flows : []; const yesterday = dayOf(now - 86400000);
  const n = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
  const h = stats?.holdings || {};
  const main = {
    at: new Date(now).toISOString(), day: dayOf(now), version, accounts: n(stats?.accounts), active7: n(stats?.active7),
    wallets: n(stats?.wallets), deposits: n(stats?.deposits), held: { p50: n(h.p50), p90: n(h.p90), p99: n(h.p99), max: n(h.max), top10: n(h.top10) },
    interestDay: n(stats?.interestDay), interestPaid: n(stats?.interestPaid?.[yesterday]) /* (1.10.330 사용자 75A: the interest actually added to deposits yesterday -- no ledger row) */, tax: { bills: n(stats?.tax?.bills), debt: n(stats?.tax?.debt) },
    ...(stats?.rates ? { rates: stats.rates } : {}) /* (1.10.330: the bank's tiers as the server uses them, and which are the administrator's) */,
    yesterday: { day: yesterday, byReason: byReason(flows.filter((f) => f.day === yesterday)) },
  };
  const days = [...new Set(flows.map((f) => f.day))].sort();
  const flowsLine = { at: main.at, from: days[0] || null, to: days[days.length - 1] || null, days: days.length, byReason: byReason(flows) };
  return [`[economy] ${JSON.stringify(main)}`, `[economy:flows] ${JSON.stringify(flowsLine)}`];
}
// once a day after 00:10 Seoul (the tax and the interest done by then): due when that day has not been logged yet
const dueDay = (now, last) => { const d = new Date(now + KST); const after = d.getUTCHours() > 0 || d.getUTCMinutes() >= 10; return after && last !== dayOf(now) ? dayOf(now) : null; };
module.exports = { economyLogLines, dueDay, dayOf };
