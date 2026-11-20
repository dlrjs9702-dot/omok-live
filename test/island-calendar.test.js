'use strict';
// E1 행사 달력: Seoul's dates at the edges, the weekly contests' days and hours, the administrator's override; the stamp rules
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/plaza/island-calendar');
const at = (s) => Date.parse(`${s}+09:00`);

// 381 사용자 결정 14 「A, 매일 하는 대회 섬대회로」: the weekend contests off -- their line hidden and closed; 「섬 대회 참가」 in its place, once a day
test('행사 할 일: 주말 대회가 꺼져 있으면 「매주 대회 참가」는 안 보이고, 「섬 대회 참가」 도장 1개 하루 1번', () => {
  const F = require('../lib/island-festival'); assert.equal(C.CONTEST.on, false);
  for (const s of ['2026-11-21T15:00:00', '2026-12-05T15:00:00']) {
    const fest = C.festivalAt(at(s)); const ids = F.view(fest, null, at(s)).tasks.map((t) => t.id);
    assert.ok(!ids.includes('contest'), ids.join(',')); assert.ok(ids.includes('islandContest'), ids.join(',')); assert.equal(C.taskOpen(fest, 'contest', at(s)), false);
    const t = F.view(fest, null, at(s)).tasks.find((x) => x.id === 'islandContest'); assert.deepEqual([t.name, t.stamps, t.perDay], ['섬 대회 참가', 1, 1]);
    const one = F.award(fest, null, 'islandContest', at(s)); assert.equal(one.added, 1); assert.equal(F.award(fest, one.doc, 'islandContest', at(s)).error, 'TASK_DONE');
    assert.equal(F.award(fest, one.doc, 'islandContest', at(s) + 86400000).added, 1); /* (the next day again) */
  }
});

// 381 사용자 결정 15 A: the cooking -- a theme a day (Seoul's date, the list in turn), +30 when it fits, stamps 1 / 2 / 3 at 90 and 140
test('요리 대회: 매일 주제(날짜로 차례), 맞으면 +30점·「오늘 주제에 딱 맞아요!」, 도장 90점 미만 1·90~139 2·140 이상 3', () => {
  const F = require('../lib/island-festival');
  const days = Array.from({ length: F.COOK_THEMES.length }, (_, k) => C.addDays('2026-11-20', k)); assert.equal(new Set(days.map((d) => F.cookTheme(d).id)).size, F.COOK_THEMES.length);
  assert.deepEqual([F.cookStamps(89), F.cookStamps(90), F.cookStamps(139), F.cookStamps(140)], [1, 2, 2, 3]);
  const veg = ['harvest', 'harvest', 'harvest']; const vegDay = days.find((d) => F.cookTheme(d).id === 'veg2'); const other = days.find((d) => F.cookTheme(d).id === 'herb');
  const a = F.judgeCook(veg, vegDay); const b = F.judgeCook(veg, other); assert.equal(a.themed, true); assert.equal(b.themed, false); assert.equal(a.score - b.score, F.THEME_BONUS);
  assert.ok(a.say.startsWith('오늘 주제에 딱 맞아요!')); assert.ok(!b.say.includes('주제')); assert.equal(a.stamps, F.cookStamps(a.score));
  const fishDay = days.find((d) => F.cookTheme(d).id === 'fish'); assert.equal(F.judgeCook(['fish_goby', 'berry', 'mushroom'], fishDay).themed, true); assert.equal(F.judgeCook(['berry', 'berry', 'berry'], fishDay).themed, false);
  const view = F.view(C.festivalAt(Date.parse(`${vegDay}T12:00:00+09:00`)), null, Date.parse(`${vegDay}T12:00:00+09:00`)); assert.equal(view.cookTheme.name, '밭 채소 두 가지 이상');
});

test('행사 달력: 수확제는 서울 날짜 11/20 00:00 ~ 11/26 23:59, 마지막 날, 다음 행사, 관리자 끄기·옮기기', () => {
  assert.equal(C.festivalAt(at('2026-11-19T23:59:59')), null);
  assert.equal(C.festivalAt(at('2026-11-20T00:00:00')).id, 'harvest-2026');
  assert.equal(C.festivalAt(at('2026-11-26T23:59:59')).lastDay, true);
  assert.equal(C.festivalAt(at('2026-11-27T00:00:00')), null);
  assert.equal(C.nextFestival(at('2026-11-01T12:00:00')).start, '2026-11-20');
  assert.equal(C.festivalAt(at('2026-11-21T12:00:00'), { 'harvest-2026': { off: true } }), null);
  assert.equal(C.festivalAt(at('2026-11-02T12:00:00'), { 'harvest-2026': { start: '2026-11-01', end: '2026-11-03' } }).end, '2026-11-03');
});

// v1.10.233: the weekend contests off -- 11/7 and 11/8 no contest, an admin's day neither
test('매주 대회 꺼짐: 11/7(토)·11/8(일)·관리자가 정한 날 모두 대회 없음', () => {
  for (const s of ['2026-11-07T12:00:00', '2026-11-08T15:00:00', '2026-11-14T12:00:00']) assert.equal(C.contestAt(at(s)), null, s);
  assert.equal(C.contestAt(at('2026-11-04T15:00:00'), { contest: { '2026-11-04': 'bug' } }), null);
  assert.equal(C.CONTEST.on, false);
});

test.skip('매주 대회: 11/7(토)부터 토 낚시·일 곤충, 10~22시만 열림, 그 전·평일은 없음, 관리자가 정한 날 (v1.10.233 꺼짐 -- 게임 대회로 돌아올 때 다시)', () => {
  assert.equal(C.contestAt(at('2026-10-31T12:00:00')), null); // (before the first)
  const sat = C.contestAt(at('2026-11-07T10:00:00')); assert.deepEqual([sat.kind, sat.open], ['fish', true]);
  assert.equal(C.contestAt(at('2026-11-07T09:59:00')).open, false); assert.equal(C.contestAt(at('2026-11-07T22:00:00')).open, false);
  assert.equal(C.contestAt(at('2026-11-08T15:00:00')).kind, 'bug'); assert.equal(C.contestAt(at('2026-11-09T15:00:00')), null);
  assert.equal(C.contestAt(at('2026-11-04T15:00:00'), { contest: { '2026-11-04': 'bug' } }).kind, 'bug');
  assert.deepEqual(C.rankOf([{ account: 'b', score: 5, at: 2 }, { account: 'a', score: 5, at: 1 }, { account: 'c', score: 9, at: 3 }]).map((r) => r.account), ['c', 'a', 'b']);
});

test('행사 칭호·물건: 칭호는 행사 칭호만, 가판대 물건은 가구 또는 칭호', () => {
  assert.equal(C.titleOf('title_event_harvest').name, '풍년'); assert.equal(C.titleOf('title_contest_fish_1').name, '낚시 대회 금상'); assert.equal(C.titleOf('nope'), null);
  for (const g of C.FESTIVALS[0].shop) assert.ok(g.kind === 'furniture' ? require('../public/plaza/island-furniture').good(g.good) : C.titleOf(g.title), g.id);
});

test('축제 도장 규칙(lib/island-festival 자체 검사)', () => { require('node:child_process').execFileSync(process.execPath, [require.resolve('../lib/island-festival')]); });

// 1.10.329 크리스마스 눈·트리 점등식 (notes christmas-boost M1·M5): the evenings and nights' light snow (17:00~06:00), the 24th and
// 25th all day white; nothing before the festival or after; the tree dark until 12-1 18:00 (1.10.338 127A: the festival from 12-1), its countdown from 17:00, lit after
test('크리스마스 눈: 저녁·밤 가벼운 눈(17~06시), 24·25일 하루 종일 화이트, 행사 밖은 없음 / 점등: 17시 카운트다운, 18시 점등', () => {
  const X = C.FESTIVALS.find((f) => f.id === 'christmas-2026');
  const snow = { '2026-11-30T20:00:00': null, '2026-12-01T16:59:59': null, '2026-12-01T17:00:00': 'light', '2026-12-02T05:59:59': 'light', '2026-12-02T06:00:00': null, '2026-12-19T17:00:00': 'light', '2026-12-23T23:00:00': 'light', '2026-12-24T00:00:00': 'white', '2026-12-25T12:00:00': 'white', '2026-12-26T00:00:00': null };
  for (const [t, want] of Object.entries(snow)) assert.equal(C.snowOf(X, at(t)), want, t);
  assert.equal(C.snowOf(C.FESTIVALS.find((f) => f.id === 'harvest-2026'), at('2026-11-21T20:00:00')), null, '다른 행사는 눈 없음');
  assert.deepEqual(C.lightingOf(X, at('2026-12-01T16:59:59')).state, 'dark');
  assert.deepEqual(C.lightingOf(X, at('2026-12-01T17:00:00')), { state: 'count', at: at('2026-12-01T18:00:00'), left: 3600000 });
  assert.equal(C.lightingOf(X, at('2026-12-01T18:00:00')).state, 'lit'); assert.equal(C.lightingOf(X, at('2026-12-19T17:30:00')).state, 'lit'); assert.equal(C.lightingOf(X, at('2026-12-30T21:00:00')).state, 'lit');
  assert.equal(C.lightingOf(null, at('2026-12-01T18:00:00')), null);
  assert.deepEqual([X.start, X.end], ['2026-12-01', '2026-12-25'], '127A: 12-1~25'); assert.ok(C.festivalAt(at('2026-12-01T00:00:01'))?.id === 'christmas-2026' && C.festivalAt(at('2026-11-30T23:59:59'))?.id !== 'christmas-2026');
  /* (128A: the stall's prices doubled, six more -- assets 149) */ assert.deepEqual(X.shop.map((g) => [g.id, g.stamps]), [['xmas_tree_small', 16], ['xmas_fireplace', 16], ['xmas_snow_globe', 8], ['xmas_stocking', 6], ['xmas_gingerbread_house', 8], ['title_christmas', 20], ['xmas_check_sofa', 16], ['xmas_gift_pile', 8], ['xmas_rocking_reindeer', 14], ['xmas_snowman_lamp', 8], ['xmas_gingerbread_shelf', 12], ['xmas_rug_snowflake', 10]]);
});

test('산타 썰매 (1.10.333 M6): 24일 21~22시만, 2분에 한 바퀴', () => {
  const X = C.FESTIVALS.find((f) => f.id === 'christmas-2026');
  assert.equal(C.sleighOf(X, at('2026-12-24T20:59:59')), null); assert.equal(C.sleighOf(X, at('2026-12-24T22:00:00')), null); assert.equal(C.sleighOf(X, at('2026-12-25T21:30:00')), null);
  assert.equal(C.sleighOf(X, at('2026-12-24T21:00:00')).k, 0); assert.equal(C.sleighOf(X, at('2026-12-24T21:01:00')).k, 0.5); assert.equal(C.sleighOf(X, at('2026-12-24T21:02:00')).k, 0);
  assert.equal(C.sleighOf(null, at('2026-12-24T21:30:00')), null);
});
