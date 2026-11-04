'use strict';

// A4 주말 섬 대회 (IDEAS #future-weekend-contest, 사용자 시행 결정 2026-10-18): once a week at a set time (default
// Saturday 20:00 for 30 minutes, Seoul; the administrator may change it) everyone on the island competes in the week's
// event; 1st~3rd and every entrant are rewarded, and the winner stands on the plaza (like the donation statues) until the
// next contest.
// v1.10.238 문제 기록 1103 7 (사용자 「잡초, 낚시는 빼고 게임에서 혼자 하는 게임으로 대회 성적 기록하는 걸로」, gamecenter-notes
// docs/issue-log-review-20261103.md 7): the events are the game hall's solo games the server checks itself -- the 순발력
// rounds (lib/reflex.js judge) and the card games (Cards.replay of a deal the server made) -- one level for everyone, the
// card games one deal for everyone (the contest's seed); only a round opened at the 대청마당 대회 천막 counts.
// ponytail: 지뢰찾기 and the puzzles are not in the turn yet (their boards are not one for all); add them with a seeded board.
const KINDS = Object.freeze({
  whack: Object.freeze({ name: '두더지 잡기 대회', set: 'reflex', level: 'normal', higher: true, unit: '점', how: '한 판 최고 점수' }),
  klondike: Object.freeze({ name: '카드놀이 대회', set: 'cards', level: 'easy', higher: false, unit: 'ms', how: '모두 같은 패 · 가장 빨리 다 맞추기' }),
  colorfind: Object.freeze({ name: '다른 색 찾기 대회', set: 'reflex', level: 'normal', higher: true, unit: '점', how: '한 판 최고 점수' }),
  rhythm: Object.freeze({ name: '비트 탭 대회', set: 'reflex', level: 'normal', higher: true, unit: '점', how: '한 판 최고 점수' }),
  freecell: Object.freeze({ name: '프리셀 대회', set: 'cards', level: 'easy', higher: false, unit: 'ms', how: '모두 같은 패 · 가장 빨리 다 맞추기' }),
  stairs: Object.freeze({ name: '하늘 계단 대회', set: 'reflex', level: 'normal', higher: true, unit: '칸', how: '한 판 최고 칸 수' }),
  numbers: Object.freeze({ name: '숫자 터치 대회', set: 'reflex', level: 'normal', higher: false, unit: 'ms', how: '가장 빠른 기록' }),
  spider: Object.freeze({ name: '스파이더 대회', set: 'cards', level: 'easy', higher: true, unit: '점', how: '모두 같은 패 · 다 맞춘 점수' }),
  reaction: Object.freeze({ name: '반응속도 대회', set: 'reflex', level: 'normal', higher: false, unit: 'ms', how: '가장 빠른 기록' }),
});
const ORDER = Object.freeze(['whack', 'klondike', 'colorfind', 'rhythm', 'freecell', 'stairs', 'numbers', 'spider', 'reaction']);
const DEFAULT = Object.freeze({ day: 6, hour: 20, minute: 0, minutes: 30, enabled: true }); // Saturday (0 = Sunday)
const REWARDS = Object.freeze({ 1: 30000, 2: 15000, 3: 8000, join: 1000 });
const MIN_ENTRANTS = 2; // alone, nobody is rewarded (the contest is for playing together)
const NOTICE_MS = 10 * 60 * 1000;
const TENT_AFTER_MS = 30 * 60 * 1000; // (the tent stands from the notice till half an hour after the end: the results)
const KST = 9 * 3600 * 1000; const WEEK = 7 * 86400000;
const EPOCH = Date.parse('2026-10-05T00:00:00+09:00'); // a Monday: the weeks are counted from here (the event turns)

// the administrator's settings; `kinds` holds a chosen event for a week ({ [week]: kind }), the turn otherwise
function config(raw) {
  const c = { ...DEFAULT, ...(raw || {}) };
  const ok = Number.isInteger(c.day) && c.day >= 0 && c.day <= 6 && Number.isInteger(c.hour) && c.hour >= 0 && c.hour <= 23 && Number.isInteger(c.minute) && c.minute >= 0 && c.minute <= 59
    && Number.isInteger(c.minutes) && c.minutes >= 10 && c.minutes <= 120;
  const kinds = Object.fromEntries(Object.entries(c.kinds && typeof c.kinds === 'object' ? c.kinds : {}).filter(([w, k]) => /^\d+$/.test(w) && KINDS[k]));
  return ok ? { day: c.day, hour: c.hour, minute: c.minute, minutes: c.minutes, enabled: c.enabled !== false, kinds } : { ...DEFAULT, kinds };
}
const turnOf = (week) => ORDER[((week % ORDER.length) + ORDER.length) % ORDER.length];
// the contest of the week containing ms (Monday 00:00 Seoul to the next): { id, kind, start, end }
function weekContest(ms, cfg) {
  const c = config(cfg); const week = Math.floor((ms - EPOCH) / WEEK); const monday = EPOCH + week * WEEK;
  const start = monday + ((c.day + 6) % 7) * 86400000 + c.hour * 3600000 + c.minute * 60000;
  return { id: `contest_${week}`, week, kind: c.kinds[week] || turnOf(week), start, end: start + c.minutes * 60000 };
}
const shown = (k) => ({ ...k, name: KINDS[k.kind].name, how: KINDS[k.kind].how, unit: KINDS[k.kind].unit, game: k.kind, set: KINDS[k.kind].set, level: KINDS[k.kind].level, higher: KINDS[k.kind].higher });
// where the island is: 'soon' (10 min before), 'live', 'done' (after, this week), 'off'; last week's still running past
// Monday midnight (a late Sunday start) stays the one (Codex review)
function phaseAt(ms, cfg) {
  const c = config(cfg); const prev = weekContest(ms - WEEK, c); const k = ms < prev.end ? prev : weekContest(ms, c);
  const phase = !c.enabled ? 'off' : ms >= k.start && ms < k.end ? 'live' : ms >= k.start - NOTICE_MS && ms < k.start ? 'soon' : ms >= k.end ? 'done' : 'off';
  return { ...shown(k), phase, tent: phase === 'soon' || phase === 'live' || (phase === 'done' && ms < k.end + TENT_AFTER_MS) };
}
// the latest contest already over (this week's or last week's), to be settled once -- or null when contests are off
function lastEnded(ms, cfg) {
  const c = config(cfg); if (!c.enabled) return null; const k = weekContest(ms, c); const e = k.end <= ms ? k : weekContest(ms - WEEK, c);
  return e.end <= ms ? { ...shown(e), phase: 'done' } : null;
}
// one entrant's record after a round: the best of them (a higher score, or a shorter time)
const merge = (kind, before, value) => (before == null ? value : KINDS[kind].higher ? Math.max(before, value) : Math.min(before, value));
// the ranking: the better first, then who got there first
const rank = (rows, kind) => [...rows].sort((a, b) => (KINDS[kind]?.higher === false ? a.score - b.score : b.score - a.score) || a.at - b.at);
// a card contest's one deal for everyone (from its id: the same after a restart)
function seedOf(id) { let h = 2166136261; for (const ch of `contest-seed|${id}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }

module.exports = { KINDS, ORDER, DEFAULT, REWARDS, MIN_ENTRANTS, NOTICE_MS, TENT_AFTER_MS, config, weekContest, phaseAt, lastEnded, merge, rank, seedOf };

if (require.main === module) {
  const assert = require('node:assert/strict');
  const sat = Date.parse('2026-10-24T20:10:00+09:00'); const p = phaseAt(sat);
  assert.equal(p.phase, 'live'); assert.equal(new Date(p.start + KST).getUTCDay(), 6); assert.equal(p.tent, true);
  assert.equal(phaseAt(Date.parse('2026-10-24T19:55:00+09:00')).phase, 'soon'); assert.equal(phaseAt(Date.parse('2026-10-24T19:45:00+09:00')).tent, false);
  assert.equal(phaseAt(Date.parse('2026-10-24T21:00:00+09:00')).phase, 'done'); assert.equal(phaseAt(Date.parse('2026-10-24T20:55:00+09:00')).tent, true);
  assert.equal(phaseAt(Date.parse('2026-10-24T21:05:00+09:00')).tent, false);
  assert.equal(phaseAt(Date.parse('2026-10-22T12:00:00+09:00')).phase, 'off');
  // the turn: every game once in ORDER.length weeks, no 낚시 or 잡초 (문제 기록 1103 7)
  assert.deepEqual(new Set(ORDER.map((_, w) => phaseAt(sat + w * WEEK).kind)).size, ORDER.length);
  assert.ok(!KINDS.fish && !KINDS.weed); assert.ok(ORDER.every((k) => KINDS[k].set === 'reflex' || KINDS[k].set === 'cards'));
  assert.equal(phaseAt(sat, { kinds: { [p.week]: 'spider' } }).kind, 'spider'); assert.equal(config({ kinds: { 3: 'fish', x: 'whack' } }).kinds[3], undefined);
  assert.equal(merge('whack', 400, 300), 400); assert.equal(merge('klondike', 90000, 120000), 90000); assert.equal(merge('reaction', null, 250), 250);
  assert.deepEqual(rank([{ score: 9, at: 1 }, { score: 5, at: 2 }], 'numbers').map((r) => r.score), [5, 9]);
  assert.deepEqual(rank([{ score: 5, at: 1 }, { score: 9, at: 2 }], 'whack').map((r) => r.score), [9, 5]);
  assert.equal(seedOf('contest_3'), seedOf('contest_3')); assert.notEqual(seedOf('contest_3'), seedOf('contest_4'));
  assert.equal(config({ day: 9 }).day, 6); assert.equal(phaseAt(sat, { enabled: false }).phase, 'off');
  const late = { day: 0, hour: 23, minute: 0, minutes: 120 }; const mon = Date.parse('2026-10-26T00:30:00+09:00'); // Sunday 23:00 for 2 hours
  assert.equal(phaseAt(mon, late).phase, 'live'); assert.equal(phaseAt(mon, late).id, weekContest(mon - WEEK, late).id);
  assert.equal(lastEnded(mon + 3600000, late).id, weekContest(mon - WEEK, late).id); assert.equal(lastEnded(sat + 3600000).id, p.id);
  console.log('island-contest ok', p.id, p.kind);
}
