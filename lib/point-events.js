'use strict';

// v1.7.15 common point-reward events. An event is only this definition: the server alone decides whether
// it is open (its own clock), which account may claim it and how many points it pays; the client only
// sends the event id. Claiming goes through PointStore.claimEvent (one ledger row + one claim record per
// account and event id, in one atomic write), so a new time-limited point event is one more entry below.
//
// To add an event: append an object to EVENTS (id, title, headline, message, rewardPoints, startAt, endAt,
// buttonLabel, note, successMessage; optional `teaser`: one extra line shown large in the popup). Keep past events in the list: after `endAt` they simply stop being
// offered and can no longer be claimed, and the points and ledger rows already paid stay untouched.

const { EVENT_REWARD_MAX } = require('./point-store');

const EVENTS = [
  {
    id: 'admin_leave_2026_09_30',
    title: '관리자 연가 기념 이벤트',
    headline: '오늘은 관리자가 연가입니다!',
    message: '연가 기념으로 모든 이용자에게 100,000P를 드립니다.',
    rewardPoints: 100_000,
    startAt: '2026-09-30T00:00:00+09:00', // Asia/Seoul, inclusive
    endAt: '2026-10-01T00:00:00+09:00', // exclusive
    buttonLabel: '100,000P 받기',
    note: '오늘 하루 · 계정당 1회',
    successMessage: '연가 기념 포인트를 받았습니다!',
    teaser: '님들은 일하심? ㅋㅋ',
    active: true,
  },
  {
    id: 'skin_launch_2026_10_01',
    title: '스킨 등록 기념 이벤트',
    headline: '스킨 상점이 열렸습니다!',
    message: '스킨 등록 기념으로 모든 이용자에게 200,000P를 드립니다.',
    rewardPoints: 200_000,
    startAt: '2026-10-01T00:00:00+09:00', // Asia/Seoul, inclusive
    endAt: '2026-10-02T00:00:00+09:00', // exclusive
    buttonLabel: '200,000P 받기',
    note: '오늘 하루 · 계정당 1회',
    successMessage: '스킨 등록 기념 포인트를 받았습니다!',
    active: true,
  },
  // v1.10.33 (사용자 지시 2026-10-06): a notice without points (`notice`: nothing to claim, the button only closes it);
  // the price is the town hall's (lib/island-items.js PRICE_BOOSTS, the same day)
  {
    id: 'weed_request_2026_10_06',
    notice: true,
    title: '섬 제초 요청',
    headline: '섬에 풀이 너무 많이 자랐습니다!',
    message: '관공서에서 제초를 부탁드립니다. 뽑은 잡초를 관공서로 가져와 주세요. 오늘 하루는 잡초를 평소의 3배인 개당 900P에 정산해 드립니다.',
    rewardPoints: 0,
    startAt: '2026-10-06T00:00:00+09:00', // Asia/Seoul, inclusive
    endAt: '2026-10-07T00:00:00+09:00', // exclusive
    buttonLabel: '확인',
    note: '오늘 하루 · 잡초 개당 900P (평소 300P)',
    successMessage: '제초를 부탁드립니다!',
    active: true,
  },
];

const TEXT_LIMITS = { title: 40, headline: 60, message: 120, buttonLabel: 24, note: 40, successMessage: 60, teaser: 40 };
const OPTIONAL_TEXT = new Set(['teaser']);

function text(raw, field) {
  const value = typeof raw === 'string' ? raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  if (!value || value.length > TEXT_LIMITS[field]) throw new RangeError(`Invalid event ${field}`);
  return value;
}

function time(raw, field) {
  const value = Date.parse(raw);
  if (typeof raw !== 'string' || !/[zZ]|[+-]\d\d:\d\d$/.test(raw) || !Number.isFinite(value)) throw new RangeError(`Invalid event ${field}`);
  return value;
}

// Throws on a malformed definition, so a typo fails at startup/test time instead of paying wrong points.
function validateEvent(raw) {
  if (typeof raw?.id !== 'string' || !/^[a-z0-9_]{3,60}$/.test(raw.id)) throw new RangeError('Invalid event id');
  const rewardPoints = raw.rewardPoints;
  const notice = raw.notice === true; // v1.10.33: a notice pays nothing and cannot be claimed
  if (notice ? rewardPoints !== 0 : (!Number.isSafeInteger(rewardPoints) || rewardPoints <= 0 || rewardPoints > EVENT_REWARD_MAX)) throw new RangeError('Invalid event reward');
  const startMs = time(raw.startAt, 'startAt');
  const endMs = time(raw.endAt, 'endAt');
  if (endMs <= startMs) throw new RangeError('Event must end after it starts');
  if (typeof raw.active !== 'boolean') throw new TypeError('Event active flag must be a boolean');
  const event = { id: raw.id, rewardPoints, startAt: raw.startAt, endAt: raw.endAt, active: raw.active, ...(notice ? { notice } : {}) };
  for (const field of Object.keys(TEXT_LIMITS)) {
    if (OPTIONAL_TEXT.has(field) && (raw[field] === undefined || raw[field] === null)) continue;
    event[field] = text(raw[field], field);
  }
  return Object.freeze(event);
}

function validateEvents(list) {
  const events = list.map(validateEvent);
  if (new Set(events.map(event => event.id)).size !== events.length) throw new RangeError('Duplicate event id');
  return Object.freeze(events);
}

// 'inactive' (switched off) | 'upcoming' | 'open' | 'ended'
function eventStatus(event, now = Date.now()) {
  if (!event.active) return 'inactive';
  if (now < Date.parse(event.startAt)) return 'upcoming';
  if (now >= Date.parse(event.endAt)) return 'ended';
  return 'open';
}

// What the lobby may see: display text and the reward, never anything the client could use to pay itself.
function publicEvent(event, claimed) {
  const { id, title, headline, message, rewardPoints, buttonLabel, note, successMessage, startAt, endAt, teaser, notice } = event;
  return { id, title, headline, message, rewardPoints, buttonLabel, note, successMessage, startAt, endAt, ...(teaser ? { teaser } : {}), ...(notice ? { notice: true } : {}), claimed: Boolean(claimed) };
}

module.exports = { EVENTS: validateEvents(EVENTS), validateEvent, validateEvents, eventStatus, publicEvent };
