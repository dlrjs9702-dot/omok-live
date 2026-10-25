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

test('매주 대회: 11/7(토)부터 토 낚시·일 곤충, 10~22시만 열림, 그 전·평일은 없음, 관리자가 정한 날', () => {
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
