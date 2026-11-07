// v1.10.190 메신저 새 글 알림 (사용자 「작업 표시줄 아이콘이 붉게 깜빡이게」 -- a web app can't, so what it can): one count
// on the app icon from the game window, the messenger window and the push alike -- the server's unread lines in my rooms,
// a muted room left out (as its push counts them), cleared only at 0; and, in each window on its own, the title blinking
// 「● 새 메시지 (n)」 each second while that window is not looked at and something new came, stopped when it is again.
// Works in the browser (window.MessengerAlert) and in node tests (require).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MessengerAlert = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const unreadOf = (rooms) => (rooms || []).reduce((n, r) => n + (r.muted ? 0 : Math.max(0, Number(r.unread) || 0)), 0);
  function setBadge(nav, n) {
    if (!nav || typeof nav.setAppBadge !== 'function') return;
    Promise.resolve(n > 0 ? nav.setAppBadge(n) : nav.clearAppBadge()).catch(() => {});
  }
  // `apply()` redraws the window's title (asking text(base)); the first count is only where it starts (a reload blinks not)
  function titleBlink(apply, { every = 1000, timers = { setInterval: (f, ms) => setInterval(f, ms), clearInterval: (t) => clearInterval(t) } } = {}) { // (Q2 사용자 사진 「Illegal invocation」: the bare built-ins called as timers.setInterval -- this the object, which Chrome refuses)
    let n = null; let lit = false; let timer = null;
    const stop = () => { if (timer == null && !lit) return; timers.clearInterval(timer); timer = null; lit = false; apply(); };
    return {
      update(next, away) {
        const grew = n != null && next > n; n = next;
        if (!away || n === 0) stop();
        else if (grew && timer == null) { lit = true; apply(); timer = timers.setInterval(() => { lit = !lit; apply(); }, every); }
        else if (lit) apply(); // (the count in it, newer)
      },
      seen: stop,
      text: (base) => (lit ? `● 새 메시지 (${n > 99 ? '99+' : n})` : base),
      get blinking() { return timer != null; },
    };
  }
  // v1.10.258 (총괄, 폴드): Android Chrome has no protocol_handlers -- 「메신저 앱으로 열기」 there is an intent:// link to
  // /messenger.html (the messenger WebAPK if installed, else the browser); elsewhere null (web+gcmessenger: as before)
  function appIntent(ua, origin, room) {
    if (!/Android/i.test(String(ua || ''))) return null;
    const u = new URL(`/messenger.html${room ? `?room=${encodeURIComponent(room)}` : ''}`, origin); u.searchParams.set('install', '1'); /* (Codex #16; v1.10.264 총괄, 폴드: Chrome may open the address itself in a Custom Tab, not the fallback -- install=1 on both) */
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.slice(0, -1)};S.browser_fallback_url=${encodeURIComponent(u.href)};end`;
  }
  // (v1.10.264) the messenger in Chrome itself, to install it there (where the install prompt comes): Android only
  const chromeIntent = (ua, origin) => (/Android/i.test(String(ua || '')) ? `intent://${new URL(origin).host}/messenger.html?install=chrome#Intent;scheme=https;package=com.android.chrome;end` : null);
  // (Codex 251-260 #16; v1.10.263 총괄, 폴드: two values) what the messenger page offers to install it on Android, null nothing:
  // install=1 -- come from the island app's fallback (no messenger app there; a Custom Tab, which never gets the prompt and
  // may even read as standalone): 「크롬에서 열어 설치하기」 at once; install=chrome -- that button's Chrome itself: the
  // prompt's 「앱으로 설치」, or with none the menu line only; otherwise not installed and no prompt: the button. A prompt that
  // came always wins (its 「앱으로 설치」).
  // (v1.10.267 총괄, 사용자 「1번으로 가자」: inside the island app every link -- the messenger app's, Chrome's intent -- opened in
  // the island app's own window (standalone, out of its scope), so no prompt ever came. Now: the address copied, to paste in
  // Chrome. A real Chrome tab: the prompt's 「앱으로 설치」, or with none the menu line only -- no button.)
  const MENU_LINE = '크롬 메뉴 ⋮ → 앱 설치(홈 화면에 추가)'; const COPY_LINE = '크롬 앱을 열고 주소창에 붙여넣으면 메신저 앱을 설치할 수 있어요';
  const messengerUrl = (origin) => `${new URL(origin).origin}/messenger`;
  // what the messenger page offers to install it on Android (null nothing): the island app's window (standalone, come by
  // install=1/chrome, and no messenger app seen on this device) or a Custom Tab (install=1): copy the address; a Chrome tab: the
  // menu line; the messenger app itself: nothing. A prompt that came always wins.
  function chromeInstall({ ua, origin, standalone, prompted, install = null, appSeen = false }) {
    if (!/Android/i.test(String(ua || '')) || prompted) return null;
    if (standalone) return (install === '1' || install === 'chrome') && !appSeen ? { copy: messengerUrl(origin), line: COPY_LINE } : null;
    if (install === '1') return { copy: messengerUrl(origin), line: COPY_LINE };
    return { menuOnly: true, line: MENU_LINE };
  }
  // (v1.10.268 총괄 「C만 시험해보자」: four ways out of the island app's window into Chrome itself -- tried by hand, the opened
  // page tells install-why its try; the next bundle keeps the one that won)
  function chromeTries(origin) {
    const host = new URL(origin).host; const page = (n) => `${host}/messenger.html?install=chrome&try=${n}`;
    return [
      `intent://${page(1)}#Intent;scheme=https;package=com.android.chrome;launchFlags=0x10000000;end`,
      `intent://${page(2)}#Intent;scheme=https;package=com.android.chrome;launchFlags=0x18000000;end`,
      `googlechrome://navigate?url=${encodeURIComponent(`https://${page(3)}`)}`,
      `intent://${page(4)}#Intent;scheme=https;action=android.intent.action.VIEW;component=com.android.chrome/com.google.android.apps.chrome.Main;end`,
    ];
  }
  return { unreadOf, setBadge, titleBlink, appIntent, chromeIntent, chromeInstall, messengerUrl, COPY_LINE, chromeTries };
});
