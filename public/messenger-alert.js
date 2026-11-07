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
    const u = new URL(`/messenger.html${room ? `?room=${encodeURIComponent(room)}` : ''}`, origin);
    const back = new URL(u.href); back.searchParams.set('install', '1'); /* (Codex 251-260 #16: no app -- the page asks for the install) */
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.slice(0, -1)};S.browser_fallback_url=${encodeURIComponent(back.href)};end`;
  }
  // (Codex 251-260 #16; v1.10.263 총괄, 폴드: two values) what the messenger page offers to install it on Android, null nothing:
  // install=1 -- come from the island app's fallback (no messenger app there; a Custom Tab, which never gets the prompt and
  // may even read as standalone): 「크롬에서 열어 설치하기」 at once; install=chrome -- that button's Chrome itself: the
  // prompt's 「앱으로 설치」, or with none the menu line only; otherwise not installed and no prompt: the button. A prompt that
  // came always wins (its 「앱으로 설치」).
  const CHROME_LINE = '크롬 메뉴 ⋮ → 앱 설치도 돼요'; const MENU_LINE = '크롬 메뉴 ⋮ → 앱 설치(홈 화면에 추가)';
  function chromeInstall({ ua, origin, standalone, prompted, install = null }) {
    if (!/Android/i.test(String(ua || '')) || prompted) return null;
    const url = `intent://${new URL(origin).host}/messenger.html?install=chrome#Intent;scheme=https;package=com.android.chrome;end`;
    if (install === '1') return { url, line: CHROME_LINE };
    if (install === 'chrome') return { menuOnly: true, line: MENU_LINE };
    return standalone ? null : { url, line: CHROME_LINE };
  }
  return { unreadOf, setBadge, titleBlink, appIntent, chromeInstall };
});
