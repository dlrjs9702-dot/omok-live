'use strict';

// v1.9.4 상시 등반 도전 rules that touch points (IDEAS 「상시 등반 도전 · 확정(사용자, 2026-10-03)」). Pure functions:
// the point store and the server call them; nothing here reads the clock (the caller passes one captured `now`).
const { weekStart } = require('./missions');
const Economy = require('./economy'); // (경제 점검 ⑥-B: the prizes and the day's top pay are the economy table's -- lowered)

const CLIMB_TOP = 3000;
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000; // Asia/Seoul has no DST
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const kstDate = (now) => new Date(Number(now) + SEOUL_OFFSET_MS).toISOString().slice(0, 10);
const climbWeekOf = (now) => weekStart(kstDate(now)); // Monday 00:00 Asia/Seoul starts a week
const previousWeek = (week) => new Date(Date.parse(`${week}T00:00:00Z`) - WEEK_MS).toISOString().slice(0, 10);

// A whole number of metres, 0..3000. Anything else (negative, NaN, past the summit) is clamped, never trusted.
function climbAltitude(raw) {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) ? Math.max(0, Math.min(CLIMB_TOP, n)) : 0;
}

// The day's total for the best confirmed altitude: the day's top (경제 값 climb:dailyMax, 30,000) × (h / 3000)², rounded
// to a point -- the same curve, only its end lowered: 300 m → 300 · 1,500 m → 7,500 · 3,000 m → 30,000.
function dailyClimbReward(altitude) {
  const h = climbAltitude(altitude);
  return Math.round(Economy.value('climb:dailyMax') * (h / CLIMB_TOP) ** 2);
}

// Competition ranking (사용자 확정 2026-10-03): the same record shares a rank and the next rank skips as many places
// as were shared -- 1, 1, 3 / 1, 2, 2, 2, 5. Only records above 0 m take part. Ties are listed by who reached it first.
function competitionRanking(rows) {
  const list = rows.filter((row) => climbAltitude(row.best) > 0)
    .map((row) => ({ ...row, best: climbAltitude(row.best) }))
    .sort((a, b) => b.best - a.best || String(a.at || '').localeCompare(String(b.at || '')) || String(a.userId).localeCompare(String(b.userId)));
  let rank = 0;
  return list.map((row, i) => { if (i === 0 || row.best !== list[i - 1].best) rank = i + 1; return { ...row, rank }; });
}

// Weekly prizes by rank: everyone sharing a rank gets that rank's full prize; a rank past 20 gets nothing.
// (경제 점검 ⑥-B: 200,000 · 150,000 · 100,000 · 4~20위 30,000 -- the economy table's; the week's 1st a statue too)
function weeklyPrize(rank) {
  if (rank >= 1 && rank <= 3) return Economy.value(`climb:week${rank}`);
  if (rank >= 4 && rank <= 20) return Economy.value('climb:week4');
  return 0;
}

module.exports = { CLIMB_TOP, kstDate, climbWeekOf, previousWeek, climbAltitude, dailyClimbReward, competitionRanking, weeklyPrize };
