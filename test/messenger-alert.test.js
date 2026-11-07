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

// Q2 사용자 사진 「Illegal invocation」: the default timers (no `timers` given -- the windows' own use) called as methods of an
// object, `this` that object -- Chrome refuses it and the blinking (and the messenger's refresh round it) broke; a stand-in
// as strict as Chrome about `this`
test('메신저 제목 깜빡임: 기본 타이머는 this 없이 부름(Chrome Illegal invocation)', () => {
  const real = { si: globalThis.setInterval, ci: globalThis.clearInterval }; let tick = null;
  const strict = (fn) => function (...args) { if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation'); return fn(...args); };
  globalThis.setInterval = strict((f) => { tick = f; return 7; }); globalThis.clearInterval = strict(() => { tick = null; });
  try {
    let title = ''; const blink = MA.titleBlink(() => { title = blink.text('아일랜드'); });
    blink.update(1, true); blink.update(2, true); assert.equal(blink.blinking, true); assert.equal(title, '● 새 메시지 (2)');
    tick(); assert.equal(title, '아일랜드'); blink.seen(); assert.equal(blink.blinking, false); assert.equal(tick, null);
  } finally { globalThis.setInterval = real.si; globalThis.clearInterval = real.ci; }
});

// v1.10.258 (총괄, 폴드): Android has no protocol_handlers -- 「메신저 앱으로 열기」 is an intent:// link there, PC as before
test('메신저 앱으로 열기: 안드로이드는 intent:// 주소, PC는 그대로', () => {
  const o = 'https://island-dalmaru.onrender.com';
  assert.equal(MA.appIntent('Mozilla/5.0 (Linux; Android 14; SM-F956N) Chrome/141.0 Mobile', o, 'r_abc123'),
    'intent://island-dalmaru.onrender.com/messenger.html?room=r_abc123#Intent;scheme=https;S.browser_fallback_url=https%3A%2F%2Fisland-dalmaru.onrender.com%2Fmessenger.html%3Froom%3Dr_abc123%26install%3D1;end'); // (Codex #16: the fallback asks for the install)
  assert.equal(MA.appIntent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0', o, 'r_abc123'), null);
  // (Codex 251-260 #16; v1.10.263 two values) Android: from the island app's fallback (install=1, a Custom Tab -- even one that
  // reads as standalone) the Chrome button at once; in Chrome itself (install=chrome) the menu line only; a plain visit not
  // installed the button; a prompt that came, an installed window or a PC nothing
  const fold = 'Mozilla/5.0 (Linux; Android 14; SM-F956N) Chrome/141.0 Mobile';
  const button = { url: 'intent://island-dalmaru.onrender.com/messenger.html?install=chrome#Intent;scheme=https;package=com.android.chrome;end', line: '크롬 메뉴 ⋮ → 앱 설치도 돼요' };
  assert.deepEqual(MA.chromeInstall({ ua: fold, origin: o, standalone: false, prompted: false }), button);
  for (const standalone of [false, true]) assert.deepEqual(MA.chromeInstall({ ua: fold, origin: o, standalone, prompted: false, install: '1' }), { ...button, line: '또는 ⋮ → Chrome에서 열기' }); /* (총괄 #413: the Custom Tab's own menu) */
  assert.deepEqual(MA.chromeInstall({ ua: fold, origin: o, standalone: false, prompted: false, install: 'chrome' }), { menuOnly: true, line: '크롬 메뉴 ⋮ → 앱 설치(홈 화면에 추가)' });
  for (const x of [{ ua: fold, standalone: true }, { ua: fold, prompted: true }, { ua: fold, prompted: true, install: '1' }, { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0' }]) assert.equal(MA.chromeInstall({ origin: o, standalone: false, prompted: false, ...x }), null);
});
