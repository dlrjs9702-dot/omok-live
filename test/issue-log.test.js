'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { tidy, logLine, shotLink, shotLinkOk } = require('../lib/issue-log');

const DAY = 86400e3; const now = Date.UTC(2026, 10, 1);

test('문제 기록 정리: 해결 7일 뒤 사진만, 30일 뒤 기록까지, 열린·고치는 중은 그대로', () => {
  const list = [
    { id: 'a', at: now - 90 * DAY, status: 'open', hasShot: true },
    { id: 'b', at: now - 90 * DAY, status: 'doing', hasShot: true },
    { id: 'c', at: now - 90 * DAY, status: 'done', changedAt: now - 6 * DAY, hasShot: true },
    { id: 'd', at: now - 90 * DAY, status: 'done', changedAt: now - 8 * DAY, hasShot: true },
    { id: 'e', at: now - 90 * DAY, status: 'done', changedAt: now - 31 * DAY, hasShot: true },
    { id: 'f', at: now - 40 * DAY, status: 'done', hasShot: false }, // (no changedAt: its writing time)
  ];
  const out = tidy(list, now);
  assert.deepEqual(out.list.map((i) => [i.id, i.hasShot]), [['a', true], ['b', true], ['c', true], ['d', false]]);
  assert.deepEqual(out.dropShots, ['d', 'e']);
  assert.deepEqual(out.gone.map((i) => i.id), ['e', 'f']);
});

test('문제 기록 로그 한 줄: [issue] JSON, 사진·계정 id 없음, 줄바꿈은 공백', () => {
  const line = logLine('add', { id: 'x', at: now, version: '1.10.114', kind: 'bug', status: 'open', text: '첫 줄\n둘째 줄', by: { id: 'secret-account', label: '건' }, hasShot: true, shot: 'data:image/jpeg;base64,AAAA',
    ctx: { screen: 'island', island: { x: 1.5, z: -2, space: 'island', season: 'winter', time: 'day', quality: 1 }, device: { touch: true, w: 749, h: 750 }, errors: [{ text: "Cannot read properties of undefined (reading 'name') @ app.js:10:2 at f" }] } });
  assert.ok(line.startsWith('[issue] '));
  const o = JSON.parse(line.slice(8));
  assert.deepEqual([o.by, o.device, o.text, o.x, o.season, o.hasShot], ['건', 'phone 749x750', '첫 줄 둘째 줄', 1.5, 'winter', true]);
  assert.match(o.error, /reading 'name'/);
  assert.ok(!line.includes('secret-account') && !line.includes('base64'));
  assert.equal(o.wear, null);
});

// (문제 기록 정리 2026-10-21) the writer's outfit in the line: slot ids, the transformation and its mode, the parts put on
test('문제 기록 로그 한 줄: 쓴 사람의 장착(옷 칸 id·변신·보이는 방식·입힌 부품)', () => {
  const ctx = { screen: 'island', wear: { look: { gender: 'male', outfit: 'avatar_outfit_yellow', hat: 'avatar_hat_x', transform: 'cat', transformationModes: { cat: 'current' }, face: { eyes: 'a' }, dye: { avatar_outfit_yellow: '#fff' } },
    parts: ['wear.basic_pants', 'wear.cat_head', 42], transformation: 'cat' } };
  const o = JSON.parse(logLine('add', { id: 'w', at: now, text: '배가 옷을 뚫고', ctx }).slice(8));
  assert.deepEqual(o.wear, { gender: 'male', outfit: 'avatar_outfit_yellow', hat: 'avatar_hat_x', transform: 'cat', modes: { cat: 'current' }, shown: 'cat', parts: ['wear.basic_pants', 'wear.cat_head'] });
});

test('문제 기록 사진 링크: 서버 키로 서명, 7일, 다른 키·바꾼 id·지난 시각·고친 서명은 거절', () => {
  const key = 'k'.repeat(64); const now = Date.UTC(2026, 9, 21); const link = shotLink(key, 'rec-1', now);
  const m = link.match(/^\/api\/issues\/shot\/rec-1\?exp=(\d+)&sig=([0-9a-f]{32})$/); assert.ok(m, link);
  assert.equal(shotLinkOk(key, 'rec-1', m[1], m[2], now), true);
  assert.equal(shotLinkOk(key, 'rec-1', m[1], m[2], now + 7 * DAY - 1000), true); assert.equal(shotLinkOk(key, 'rec-1', m[1], m[2], now + 7 * DAY + 1000), false);
  assert.equal(shotLinkOk('x'.repeat(64), 'rec-1', m[1], m[2], now), false); assert.equal(shotLinkOk(key, 'rec-2', m[1], m[2], now), false);
  assert.equal(shotLinkOk(key, 'rec-1', String(Number(m[1]) + 1), m[2], now), false); assert.equal(shotLinkOk(key, 'rec-1', m[1], m[2].replace(/.$/, (c) => (c === '0' ? '1' : '0')), now), false);
  assert.equal(shotLinkOk(key, '../x', m[1], m[2], now), false); assert.ok(!logLine('add', { id: 'a', at: now, text: '' }, link).includes('base64'));
});
