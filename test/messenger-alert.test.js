'use strict';
// v1.10.190 메신저 새 글 알림: the app icon's one count (muted rooms out, cleared only at 0) and each window's title blinking
// 「● 새 메시지 (n)」 while it is not looked at and something new came
const test = require('node:test');
const assert = require('node:assert/strict');
const MA = require('../public/messenger-alert.js');

test('메신저 배지: 안 읽은 합계 하나(알림 끈 방 빼고), 0일 때만 지움', async () => {
  const rooms = [{ unread: 2 }, { unread: 5, muted: true }, { unread: 1 }];
  assert.equal(MA.unreadOf(rooms), 3);
  assert.equal(MA.unreadOf([]), 0); assert.equal(MA.unreadOf(undefined), 0);
  const calls = []; const nav = { setAppBadge: async (n) => { calls.push(n); }, clearAppBadge: async () => { calls.push('clear'); } };
  MA.setBadge(nav, 3); MA.setBadge(nav, 0); MA.setBadge({}, 2); // (no badge on this device: nothing)
  assert.deepEqual(calls, [3, 'clear']);
});

test('메신저 제목 깜빡임: 창이 안 보일 때 새 글이면 1초마다, 돌아오면 멈춤, 처음 수는 기준만', () => {
  let tick = null; const timers = { setInterval: (fn) => { tick = fn; return 1; }, clearInterval: () => { tick = null; } };
  let title = '';
  const blink = MA.titleBlink(() => { title = blink.text('아일랜드'); }, { timers });
  blink.update(4, true); assert.equal(blink.blinking, false); // (a reload while away: no blinking for what was there)
  blink.update(4, true); assert.equal(blink.blinking, false);
  blink.update(5, true); assert.equal(blink.blinking, true); assert.equal(title, '● 새 메시지 (5)');
  tick(); assert.equal(title, '아일랜드'); tick(); assert.equal(title, '● 새 메시지 (5)');
  blink.update(7, true); assert.equal(title, '● 새 메시지 (7)');
  blink.seen(); assert.equal(blink.blinking, false); assert.equal(title, '아일랜드'); // (looked at again)
  blink.update(8, false); assert.equal(blink.blinking, false); // (new while looking: no blinking)
  blink.update(9, true); assert.equal(blink.blinking, true);
  blink.update(0, true); assert.equal(blink.blinking, false); // (read elsewhere: all read)
  blink.update(120, true); assert.equal(title, '● 새 메시지 (99+)');
});
