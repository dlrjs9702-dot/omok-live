'use strict';
// v1.10.215 주민 근무표 (gamecenter-notes docs/resident-roster-20261027.md): a year of days -- every post filled each day by
// one of its own people, one place a day, at most 4 days a week and 3 running at a post, the festival's host off its days,
// two of the 관공서's three at a time, the station's Sunday; the same table however the days are asked
const test = require('node:test');
const assert = require('node:assert/strict');
const Calendar = require('../public/plaza/island-calendar');

const fresh = () => { delete require.cache[require.resolve('../public/plaza/island-roster')]; return require('../public/plaza/island-roster'); };

test('근무표: 1년 — 자리마다 매일 그 자리 사람, 한 사람 하루 한 곳, 주 4일 이하, 같은 자리 연속 3일 이하, 행사 진행 주민 쉼, 관공서 둘·역 일요일', () => {
  const R = fresh(); const all = [];
  for (let d = '2026-10-26'; d < '2027-10-26'; d = Calendar.addDays(d, 1)) all.push(R.rosterOf(d));
  for (const r of all) {
    for (const p of R.POSTS) assert.ok(p.who.includes(r.posts[p.id]), `${r.day} ${p.id}`);
    const people = Object.values(r.posts).flat(); assert.equal(new Set(people).size, people.length, `${r.day}: 한 사람 한 곳`);
    assert.equal(r.posts.civil.length, 2); assert.ok(!r.posts.civil.includes(r.resting)); assert.ok(R.CIVIL.includes(r.resting));
    assert.equal(r.posts.station, new Date(`${r.day}T00:00:00Z`).getUTCDay() === 0 ? 18 : 16);
    assert.deepEqual([r.posts.gate, r.posts.jail, r.posts.pavilion, r.posts.farm], [23, 22, 21, 13]);
  }
  // a week from Monday: 4 days at most each; a post: 3 days running at most
  for (let w = 0; w + 7 <= all.length; w += 7) {
    const count = {}; for (const r of all.slice(w, w + 7)) for (const p of R.POSTS) count[r.posts[p.id]] = (count[r.posts[p.id]] || 0) + 1;
    for (const [n, k] of Object.entries(count)) assert.ok(k <= R.MAX_WEEK, `${all[w].day} 주: ${n} ${k}일`);
  }
  for (const p of R.POSTS) { let run = 0; let who = null; for (const r of all) { run = r.posts[p.id] === who ? run + 1 : 1; who = r.posts[p.id]; assert.ok(run <= R.MAX_RUN, `${r.day} ${p.id} ${run}일 연속`); } }
  // everyone of a post works some days; the 관공서's rest goes round
  for (const p of R.POSTS) for (const n of p.who) assert.ok(all.some((r) => r.posts[p.id] === n), `${p.id} ${n}`);
  assert.deepEqual(new Set(all.slice(0, 3).map((r) => r.resting)).size, 3);
  // 크리스마스 (12/19~25): 바람이 hosts -- not at the plaza those days
  for (const r of all.filter((x) => x.day >= '2026-12-19' && x.day <= '2026-12-25')) assert.notEqual(r.posts.plaza, 7, r.day);
  assert.equal(R.postOf(23, '2026-11-02'), 'gate'); assert.equal(R.postOf(20, '2026-11-02'), null); // (마루 at the gate; 한결 walks till the 기록관)
});

test('근무표 C1: 계산대 주민(걷는·이야기 주민 모두), 관공서 쉬는 창구와 그 일을 맡는 옆 창구, 일요일 철이 부탁 닫힘', () => {
  const R = fresh();
  for (let d = '2026-11-01'; d < '2026-12-31'; d = Calendar.addDays(d, 1)) {
    const r = R.rosterOf(d);
    for (const p of R.POSTS) assert.equal(R.counterOf(r.posts[p.id], d), p.id, `${d} ${p.id}`);
    for (const n of [...r.posts.civil, r.posts.gate, r.posts.jail, r.posts.station, 20]) assert.equal(R.counterOf(n, d), null, `${d} ${n}`);
    const { rest, by } = R.deskRest(d); assert.equal(rest, R.DESK[r.resting]); assert.ok(r.posts.civil.map((n) => R.DESK[n]).includes(by), `${d}: ${by} 근무 중`);
  }
  process.env.ISLAND_QUEST_WEEK = '4'; delete require.cache[require.resolve('../lib/island-quests')]; const Q = require('../lib/island-quests'); // (철이's week)
  try {
    assert.equal(Q.isOpen('stationmaster', Date.parse('2026-11-01T12:00:00+09:00')), false); // a Sunday: 반디 at the station
    assert.equal(Q.isOpen('stationmaster', Date.parse('2026-11-02T00:30:00+09:00')), true); // Monday: 철이 again
    assert.equal(R.rosterOf('2026-11-01').posts.station, 18);
  } finally { delete process.env.ISLAND_QUEST_WEEK; }
});

test('근무표: 같은 날 같은 표 — 날을 거꾸로 물어도, 처음부터 물어도', () => {
  const a = fresh(); const late = a.rosterOf('2027-03-15'); const early = a.rosterOf('2026-11-09');
  const b = fresh(); assert.deepEqual(b.rosterOf('2026-11-09'), early); assert.deepEqual(b.rosterOf('2027-03-15'), late);
});
