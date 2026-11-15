'use strict';
// E1 행사 달력: Seoul's dates at the edges, the weekly contests' days and hours, the administrator's override; the stamp rules
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/plaza/island-calendar');
const at = (s) => Date.parse(`${s}+09:00`);

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
// 25th all day white; nothing before the festival or after; the tree dark until 12-19 18:00, its countdown from 17:00, lit after
test('크리스마스 눈: 저녁·밤 가벼운 눈(17~06시), 24·25일 하루 종일 화이트, 행사 밖은 없음 / 점등: 17시 카운트다운, 18시 점등', () => {
  const X = C.FESTIVALS.find((f) => f.id === 'christmas-2026');
  const snow = { '2026-12-18T20:00:00': null, '2026-12-19T16:59:59': null, '2026-12-19T17:00:00': 'light', '2026-12-20T05:59:59': 'light', '2026-12-20T06:00:00': null, '2026-12-23T23:00:00': 'light', '2026-12-24T00:00:00': 'white', '2026-12-25T12:00:00': 'white', '2026-12-26T00:00:00': null };
  for (const [t, want] of Object.entries(snow)) assert.equal(C.snowOf(X, at(t)), want, t);
  assert.equal(C.snowOf(C.FESTIVALS.find((f) => f.id === 'harvest-2026'), at('2026-11-21T20:00:00')), null, '다른 행사는 눈 없음');
  assert.deepEqual(C.lightingOf(X, at('2026-12-19T16:59:59')).state, 'dark');
  assert.deepEqual(C.lightingOf(X, at('2026-12-19T17:00:00')), { state: 'count', at: at('2026-12-19T18:00:00'), left: 3600000 });
  assert.equal(C.lightingOf(X, at('2026-12-19T18:00:00')).state, 'lit'); assert.equal(C.lightingOf(X, at('2026-12-30T21:00:00')).state, 'lit');
  assert.equal(C.lightingOf(null, at('2026-12-19T18:00:00')), null);
});
