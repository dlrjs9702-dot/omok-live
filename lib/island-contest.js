'use strict';

// A4 주말 섬 대회 (IDEAS #future-weekend-contest, 사용자 시행 결정 2026-10-18): once a week at a set time (default
// Saturday 20:00 for 30 minutes, Seoul; the administrator may change it) everyone on the island competes in the week's
// event -- 낚시 (the dearest single fish), 두더지 잡기 (the best round), 잡초 뽑기 (how many pulled) in turn. The server
// judges with its own catches, rounds and pulls; 1st~3rd and every entrant are rewarded, and the winner stands on the
// plaza (like the donation statues) until the next contest.
const KINDS = Object.freeze({
  fish: Object.freeze({ name: '낚시 대회', unit: 'P', best: true, how: '가장 비싼 한 마리' }),
  whack: Object.freeze({ name: '두더지 잡기 대회', unit: '점', best: true, how: '한 판 최고 점수' }),
  weed: Object.freeze({ name: '잡초 뽑기 경주', unit: '개', best: false, how: '뽑은 잡초 수' }),
});
const ORDER = Object.freeze(['fish', 'whack', 'weed']);
const DEFAULT = Object.freeze({ day: 6, hour: 20, minute: 0, minutes: 30, enabled: true }); // Saturday (0 = Sunday)
const REWARDS = Object.freeze({ 1: 30000, 2: 15000, 3: 8000, join: 1000 });
const MIN_ENTRANTS = 2; // alone, nobody is rewarded (the contest is for playing together)
const NOTICE_MS = 10 * 60 * 1000;
const KST = 9 * 3600 * 1000; const WEEK = 7 * 86400000;
const EPOCH = Date.parse('2026-10-05T00:00:00+09:00'); // a Monday: the weeks are counted from here (the event turns)

function config(raw) {
  const c = { ...DEFAULT, ...(raw || {}) };
  const ok = Number.isInteger(c.day) && c.day >= 0 && c.day <= 6 && Number.isInteger(c.hour) && c.hour >= 0 && c.hour <= 23 && Number.isInteger(c.minute) && c.minute >= 0 && c.minute <= 59
    && Number.isInteger(c.minutes) && c.minutes >= 10 && c.minutes <= 120;
  return ok ? { day: c.day, hour: c.hour, minute: c.minute, minutes: c.minutes, enabled: c.enabled !== false } : { ...DEFAULT };
}
// the contest of the week containing ms (Monday 00:00 Seoul to the next): { id, kind, start, end }
function weekContest(ms, cfg) {
  const c = config(cfg); const week = Math.floor((ms - EPOCH) / WEEK); const monday = EPOCH + week * WEEK;
  const start = monday + ((c.day + 6) % 7) * 86400000 + c.hour * 3600000 + c.minute * 60000;
  return { id: `contest_${week}`, week, kind: ORDER[((week % ORDER.length) + ORDER.length) % ORDER.length], start, end: start + c.minutes * 60000 };
}
// where the island is: 'soon' (10 min before), 'live', 'done' (after, this week), 'off'
function phaseAt(ms, cfg) {
  const c = config(cfg); const k = weekContest(ms, c);
  const phase = !c.enabled ? 'off' : ms >= k.start && ms < k.end ? 'live' : ms >= k.start - NOTICE_MS && ms < k.start ? 'soon' : ms >= k.end ? 'done' : 'off';
  return { ...k, phase, name: KINDS[k.kind].name, how: KINDS[k.kind].how, unit: KINDS[k.kind].unit };
}
// one entrant's record after a result: the best (fish, whack) or the sum (weed)
const merge = (kind, before, value) => (KINDS[kind].best ? Math.max(before || 0, value) : (before || 0) + value);
// the ranking: higher first, then who got there first
const rank = (rows) => [...rows].sort((a, b) => b.score - a.score || a.at - b.at);

module.exports = { KINDS, ORDER, DEFAULT, REWARDS, MIN_ENTRANTS, NOTICE_MS, config, weekContest, phaseAt, merge, rank };

if (require.main === module) {
  const assert = require('node:assert/strict');
  const sat = Date.parse('2026-10-24T20:10:00+09:00'); const p = phaseAt(sat);
  assert.equal(p.phase, 'live'); assert.equal(new Date(p.start + KST).getUTCDay(), 6);
  assert.equal(phaseAt(Date.parse('2026-10-24T19:55:00+09:00')).phase, 'soon');
  assert.equal(phaseAt(Date.parse('2026-10-24T21:00:00+09:00')).phase, 'done');
  assert.equal(phaseAt(Date.parse('2026-10-22T12:00:00+09:00')).phase, 'off');
  assert.deepEqual(new Set([0, 1, 2].map((w) => phaseAt(sat + w * WEEK).kind)).size, 3);
  assert.equal(merge('fish', 400, 300), 400); assert.equal(merge('weed', 4, 1), 5);
  assert.equal(config({ day: 9 }).day, 6); assert.equal(phaseAt(sat, { enabled: false }).phase, 'off');
  console.log('island-contest ok', p.id, p.kind);
}
