'use strict';

// v1.10.71 게임별 랭킹 (한판마당 자료 03 server/econ.js의 공식): a game's board from our match records — 10 games or more in
// the week (or in all), a draw counts half a win, ordered by the Wilson lower bound (95%) so few games weigh less, then
// more games, then whoever got there first. The week starts Monday 0:00 Seoul and a new one simply begins (nothing reset).
const MIN_GAMES = 10;
const KST = 9 * 3600e3; const DAY = 86400e3;

function weekStart(ms = Date.now()) { // 한판마당 weekStart, as written there
  const d = new Date(ms + KST); const day = (d.getUTCDay() + 6) % 7; // 월=0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day) - KST;
}
function wilson(w, d, n) { // 한판마당 wilson, as written there
  if (!n) return 0;
  const z = 1.96; const p = (w + d / 2) / n; const z2 = z * z;
  return (p + z2 / (2 * n) - z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / (1 + z2 / n);
}

// matches: [{ at, outcomes: [{ id, result }] }] of one game → [{ id, w, d, l, n, rank }] (same score, same rank)
function board(matches) {
  const by = new Map();
  for (const m of matches) {
    const at = Date.parse(m.at) || 0;
    for (const o of m.outcomes) {
      const r = by.get(o.id) || { id: o.id, w: 0, d: 0, l: 0, at: 0 };
      if (o.result === 'win') r.w += 1; else if (o.result === 'draw') r.d += 1; else r.l += 1;
      r.at = Math.max(r.at, at); // when this record was reached
      by.set(o.id, r);
    }
  }
  const rows = [...by.values()].map((r) => ({ ...r, n: r.w + r.d + r.l })).filter((r) => r.n >= MIN_GAMES);
  for (const r of rows) r.s = wilson(r.w, r.d, r.n);
  rows.sort((a, b) => b.s - a.s || b.n - a.n || a.at - b.at);
  let rank = 0; let prev = null;
  rows.forEach((r, i) => { const k = r.s.toFixed(9); if (k !== prev) rank = i + 1; r.rank = rank; prev = k; });
  return rows.map(({ id, w, d, l, n, rank: place }) => ({ id, w, d, l, n, rank: place }));
}

module.exports = { MIN_GAMES, weekStart, wilson, board };
