'use strict';

// A4 주말 섬 대회 (IDEAS #future-weekend-contest, 사용자 시행 결정 2026-10-18): at a set time everyone on the island competes
// in the event; 1st~3rd and every entrant are rewarded, and the winner stands before the 게임관 until the next contest.
// v1.10.241 (사용자 「대회를 매일매일 하는걸로 하자 매일 14시」, gamecenter-notes docs/v241-bundle-20261104.md 2): every day at
// 14:00 Seoul for 30 minutes (the administrator may change the time and length), the day's event in turn (id contest_d<day>).
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
const DEFAULT = Object.freeze({ hour: 14, minute: 0, minutes: 30, enabled: true }); // (every day, Seoul)
const REWARDS = Object.freeze({ 1: 30000, 2: 15000, 3: 8000, join: 1000 });
const MIN_ENTRANTS = 2; // alone, nobody is rewarded (the contest is for playing together)
const NOTICE_MS = 10 * 60 * 1000;
const TENT_AFTER_MS = 30 * 60 * 1000; // (the tent stands from the notice till half an hour after the end: the results)
const KST = 9 * 3600 * 1000; const DAY = 86400000;
const EPOCH = Date.parse('2026-10-05T00:00:00+09:00'); // the days are counted from here (the event turns)

// the administrator's settings; `kinds` holds a chosen event for a day ({ [day]: kind }), the turn otherwise
function config(raw) {
  const c = { ...DEFAULT, ...(raw || {}) };
  const ok = Number.isInteger(c.hour) && c.hour >= 0 && c.hour <= 23 && Number.isInteger(c.minute) && c.minute >= 0 && c.minute <= 59 && Number.isInteger(c.minutes) && c.minutes >= 10 && c.minutes <= 120;
  const kinds = Object.fromEntries(Object.entries(c.kinds && typeof c.kinds === 'object' ? c.kinds : {}).filter(([d, k]) => /^\d+$/.test(d) && KINDS[k]));
  return ok ? { hour: c.hour, minute: c.minute, minutes: c.minutes, enabled: c.enabled !== false, kinds } : { ...DEFAULT, kinds };
}
const turnOf = (day) => ORDER[((day % ORDER.length) + ORDER.length) % ORDER.length];
// the contest of the day containing ms (00:00 Seoul to the next): { id, day, kind, start, end }
function dayContest(ms, cfg) {
  const c = config(cfg); const day = Math.floor((ms - EPOCH) / DAY);
  const start = EPOCH + day * DAY + c.hour * 3600000 + c.minute * 60000;
  return { id: `contest_d${day}`, day, kind: c.kinds[day] || turnOf(day), start, end: start + c.minutes * 60000 };
}
const shown = (k) => ({ ...k, name: KINDS[k.kind].name, how: KINDS[k.kind].how, unit: KINDS[k.kind].unit, game: k.kind, set: KINDS[k.kind].set, level: KINDS[k.kind].level, higher: KINDS[k.kind].higher });
// where the island is: 'soon' (10 min before), 'live', 'done' (after, that day), 'off'; the day before's stays the one till
// its tent comes down half an hour after its end -- a late start running past midnight too (Codex 10판 P3); `next`: the
// next contest not yet begun (the bar's 「내일 14:00 · ○○ 대회」)
function phaseAt(ms, cfg) {
  const c = config(cfg); const prev = dayContest(ms - DAY, c); const k = ms < prev.end + TENT_AFTER_MS ? prev : dayContest(ms, c);
  const phase = !c.enabled ? 'off' : ms >= k.start && ms < k.end ? 'live' : ms >= k.start - NOTICE_MS && ms < k.start ? 'soon' : ms >= k.end ? 'done' : 'off';
  const today = dayContest(ms, c); const nx = today.start > ms ? today : dayContest(ms + DAY, c);
  return { ...shown(k), phase, tent: phase === 'soon' || phase === 'live' || (phase === 'done' && ms < k.end + TENT_AFTER_MS), next: c.enabled ? { id: nx.id, start: nx.start, kind: nx.kind, name: KINDS[nx.kind].name } : null };
}
// the next contest not yet begun (the administrator may choose its event)
const nextContest = (ms, cfg) => { const c = config(cfg); const t = dayContest(ms, c); return t.start > ms ? t : dayContest(ms + DAY, c); };
// the latest contest already over (this week's or last week's), to be settled once -- or null when contests are off
function lastEnded(ms, cfg) {
  const c = config(cfg); if (!c.enabled) return null; const k = dayContest(ms, c); const e = k.end <= ms ? k : dayContest(ms - DAY, c);
  return e.end <= ms ? { ...shown(e), phase: 'done' } : null;
}
// one entrant's record after a round: the best of them (a higher score, or a shorter time)
const merge = (kind, before, value) => (before == null ? value : KINDS[kind].higher ? Math.max(before, value) : Math.min(before, value));
// the ranking: the better first, then who got there first
const rank = (rows, kind) => [...rows].sort((a, b) => (KINDS[kind]?.higher === false ? a.score - b.score : b.score - a.score) || a.at - b.at);
// a card contest's one deal for everyone (from its id: the same after a restart)
function seedOf(id) { let h = 2166136261; for (const ch of `contest-seed|${id}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }

module.exports = { KINDS, ORDER, DEFAULT, REWARDS, MIN_ENTRANTS, NOTICE_MS, TENT_AFTER_MS, config, dayContest, nextContest, phaseAt, lastEnded, merge, rank, seedOf };

if (require.main === module) {
  const assert = require('node:assert/strict');
  const at = (t) => Date.parse(`${t}+09:00`);
  const p = phaseAt(at('2026-11-05T14:10:00')); assert.equal(p.phase, 'live'); assert.equal(p.tent, true); assert.match(p.id, /^contest_d\d+$/);
  assert.equal(phaseAt(at('2026-11-05T13:55:00')).phase, 'soon'); assert.equal(phaseAt(at('2026-11-05T13:49:00')).tent, false); assert.equal(phaseAt(at('2026-11-05T13:49:00')).phase, 'off');
  assert.equal(phaseAt(at('2026-11-05T14:45:00')).phase, 'done'); assert.equal(phaseAt(at('2026-11-05T14:55:00')).tent, true); assert.equal(phaseAt(at('2026-11-05T15:00:00')).tent, false);
  // every day: the next day's at 14:00 too, its event the next in turn; the bar's next after today's
  const q = phaseAt(at('2026-11-06T14:05:00')); assert.equal(q.phase, 'live'); assert.equal(q.id, `contest_d${p.day + 1}`);
  assert.equal(phaseAt(at('2026-11-05T16:00:00')).next.id, q.id); assert.equal(phaseAt(at('2026-11-05T09:00:00')).next.id, p.id);
  assert.deepEqual(new Set(ORDER.map((_, d) => phaseAt(at('2026-11-05T14:10:00') + d * DAY).kind)).size, ORDER.length);
  assert.ok(!KINDS.fish && !KINDS.weed); assert.ok(ORDER.every((k) => KINDS[k].set === 'reflex' || KINDS[k].set === 'cards'));
  assert.equal(phaseAt(at('2026-11-05T14:10:00'), { kinds: { [p.day]: 'spider' } }).kind, 'spider'); assert.equal(config({ kinds: { 3: 'fish', x: 'whack' } }).kinds[3], undefined);
  assert.equal(nextContest(at('2026-11-05T14:10:00')).id, q.id); assert.equal(nextContest(at('2026-11-05T10:00:00')).id, p.id);
  // a late start past midnight: live past 00:00, its tent till half an hour after its end (Codex 10판 P3)
  const late = { hour: 23, minute: 50, minutes: 20 }; const lp = phaseAt(at('2026-11-06T00:05:00'), late);
  assert.equal(lp.phase, 'live'); assert.equal(lp.id, dayContest(at('2026-11-05T12:00:00'), late).id);
  const after = phaseAt(at('2026-11-06T00:20:00'), late); assert.equal(after.phase, 'done'); assert.equal(after.tent, true); assert.equal(after.id, lp.id);
  assert.equal(lastEnded(at('2026-11-06T00:20:00'), late).id, lp.id); assert.equal(lastEnded(at('2026-11-05T15:00:00')).id, p.id);
  assert.equal(merge('whack', 400, 300), 400); assert.equal(merge('klondike', 90000, 120000), 90000); assert.equal(merge('reaction', null, 250), 250);
  assert.deepEqual(rank([{ score: 9, at: 1 }, { score: 5, at: 2 }], 'numbers').map((r) => r.score), [5, 9]);
  assert.equal(seedOf('contest_d3'), seedOf('contest_d3')); assert.notEqual(seedOf('contest_d3'), seedOf('contest_d4'));
  assert.equal(config({ hour: 30 }).hour, 14); assert.equal(phaseAt(at('2026-11-05T14:10:00'), { enabled: false }).phase, 'off');
  console.log('island-contest ok', p.id, p.kind);
}
