'use strict';
// 메신저 어두운 화면 (사용자 2026-10-25, docs/messenger-standalone-20261025.md 추가): 밝게 / 어둡게 / 기기 설정 따르기, first
// 밝게, kept on this device. Read in the page's head so it is dark from the first paint; the installed window's bar
// (theme-color) follows. Only the messenger -- the island keeps its colours.
(() => {
  const KEY = 'gc.messengerTheme'; const MODES = ['light', 'dark', 'system'];
  const get = () => { try { const v = localStorage.getItem(KEY); return MODES.includes(v) ? v : 'light'; } catch { return 'light'; } };
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  function apply() {
    const mode = get(); const dark = mode === 'dark' || (mode === 'system' && Boolean(mq?.matches));
    document.documentElement.dataset.mtheme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#2a231e' : '#fff6e3');
  }
  mq?.addEventListener?.('change', apply);
  apply();
  window.MessengerTheme = { get, set(mode) { try { localStorage.setItem(KEY, MODES.includes(mode) ? mode : 'light'); } catch {} apply(); } };
})();
