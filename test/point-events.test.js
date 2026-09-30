'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EVENTS, validateEvent, validateEvents, eventStatus, publicEvent } = require('../lib/point-events');

// v1.7.20 common point-reward event definitions: every registered event must be valid, the server
// clock windows are exact (Asia/Seoul), and the lobby only ever sees display fields.

const at = iso => Date.parse(iso);
const base = {
  id: 'sample_event', title: '샘플 이벤트', headline: '샘플', message: '샘플 메시지', rewardPoints: 50_000,
  startAt: '2026-11-01T00:00:00+09:00', endAt: '2026-11-02T00:00:00+09:00', buttonLabel: '받기', note: '하루 1회', successMessage: '받았습니다', active: true,
};

test('등록된 이벤트 정의는 모두 유효하고 id가 겹치지 않는다', () => {
  assert.ok(EVENTS.length >= 1);
  assert.deepEqual(validateEvents(EVENTS.map(event => ({ ...event }))).map(event => event.id), EVENTS.map(event => event.id));
  assert.throws(() => validateEvents([base, { ...base }]), /Duplicate/);
});

test('관리자 연가 기념 이벤트: 설정값과 Asia/Seoul 기준 기간 경계', () => {
  const event = EVENTS.find(item => item.id === 'admin_leave_2026_09_30');
  assert.ok(event);
  assert.deepEqual([event.title, event.rewardPoints, event.buttonLabel, event.active], ['관리자 연가 기념 이벤트', 100_000, '100,000P 받기', true]);
  assert.equal(eventStatus(event, at('2026-09-29T23:59:59+09:00')), 'upcoming');
  assert.equal(eventStatus(event, at('2026-09-30T00:00:00+09:00')), 'open');
  assert.equal(eventStatus(event, at('2026-09-29T15:00:00Z')), 'open', '같은 순간을 UTC로 써도 동일');
  assert.equal(eventStatus(event, at('2026-09-30T23:59:59+09:00')), 'open');
  assert.equal(eventStatus(event, at('2026-10-01T00:00:00+09:00')), 'ended');
  assert.equal(eventStatus(event, at('2027-01-01T00:00:00+09:00')), 'ended');
});

test('꺼진 이벤트는 기간 중이어도 inactive', () => {
  const off = validateEvent({ ...base, active: false });
  assert.equal(eventStatus(off, at('2026-11-01T12:00:00+09:00')), 'inactive');
});

test('잘못된 정의는 시작 시점에 거부된다', () => {
  for (const bad of [
    { id: 'Bad-Id' }, { id: 'ab' }, { rewardPoints: 0 }, { rewardPoints: -5 }, { rewardPoints: 1.5 }, { rewardPoints: 20_000_000 }, { rewardPoints: '100000' },
    { startAt: '2026-11-01T00:00:00' }, { startAt: 'nope' }, { endAt: '2026-11-01T00:00:00+09:00' }, { endAt: '2026-10-01T00:00:00+09:00' },
    { title: '' }, { title: 'x'.repeat(41) }, { buttonLabel: '   ' }, { active: 'yes' }, { message: undefined },
  ]) assert.throws(() => validateEvent({ ...base, ...bad }), e => e instanceof RangeError || e instanceof TypeError, JSON.stringify(bad));
  assert.equal(validateEvent({ ...base, title: '  줄바꿈\n포함  ' }).title, '줄바꿈 포함');
});

test('로비에 보이는 값은 표시 항목과 수령 여부뿐이다', () => {
  const view = publicEvent(validateEvent(base), true);
  assert.deepEqual(Object.keys(view).sort(), ['buttonLabel', 'claimed', 'endAt', 'headline', 'id', 'message', 'note', 'rewardPoints', 'startAt', 'successMessage', 'title']);
  assert.equal(view.claimed, true);
  assert.equal(publicEvent(validateEvent(base)).claimed, false);
});

test('팝업 강조 문구(teaser): 선택 항목, 연가 이벤트에는 있고 형식이 잘못되면 거부된다', () => {
  const event = EVENTS.find(item => item.id === 'admin_leave_2026_09_30');
  assert.equal(event.teaser, '님들은 일하심? ㅋㅋ');
  assert.equal(publicEvent(event, false).teaser, '님들은 일하심? ㅋㅋ');
  assert.equal('teaser' in publicEvent(validateEvent(base), false), false, '문구가 없는 이벤트에는 필드가 없다');
  assert.equal(validateEvent({ ...base, teaser: ['  한 줄', '문구  '].join(String.fromCharCode(10)) }).teaser, '한 줄 문구');
  for (const teaser of ['', '   ', 'x'.repeat(41), 5]) assert.throws(() => validateEvent({ ...base, teaser }), RangeError, JSON.stringify(teaser));
  assert.equal('teaser' in validateEvent({ ...base, teaser: null }), false);
});
