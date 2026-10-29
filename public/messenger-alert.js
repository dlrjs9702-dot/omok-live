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
  return { unreadOf, setBadge, titleBlink };
});
