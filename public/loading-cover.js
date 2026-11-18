// 366 로딩 화면 (사용자 1A 2A, notes docs/install-button-20261118.md 마지막 절): the first island entry after 「게임 접속」 shows the
// island picture, 「섬으로 가는 중…」, a bar by steps (연결 → 섬 그리기 → 주민·물건 → 준비 완료) and one tip, and lifts when the
// island is drawn, its files have stopped coming (1.5 s with none new) and ten frames in a row took under 50 ms -- or at 20 s.
// The rule alone here (the browser and test/loading-cover.test.js); app.js feeds it and draws the cover.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LoadingCover = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const STEPS = Object.freeze(['연결', '섬 그리기', '주민·물건', '준비 완료']);
  const CAP_MS = 20000; const QUIET_MS = 1500; const FRAMES = 10; const FRAME_MS = 50;
  // s: { entered, running, quietMs, frames: [ms...], elapsed } -> { step (0..4 done), label, progress 0..1, lift, timedOut }
  function state(s) {
    const frames = Array.isArray(s.frames) ? s.frames.slice(-FRAMES) : [];
    const smooth = frames.length >= FRAMES && frames.every((f) => f < FRAME_MS);
    const done = [Boolean(s.entered), Boolean(s.entered && s.running), Boolean(s.entered && s.running && s.quietMs >= QUIET_MS), false];
    done[3] = done[2] && smooth;
    const step = done.filter(Boolean).length; const timedOut = Number(s.elapsed) >= CAP_MS;
    const partial = step < 4 && step === 2 ? Math.min(1, (Number(s.quietMs) || 0) / QUIET_MS) * 0.5 : step === 3 ? Math.min(1, frames.filter((f) => f < FRAME_MS).length / FRAMES) * 0.9 : 0;
    return { step, label: STEPS[Math.min(step, 3)], progress: Math.min(1, (step + partial) / 4), lift: step === 4 || timedOut, timedOut };
  }
  // a tip for this load: one of those given (the server's list), never the same twice running in this tab
  function pickTip(tips, last = null, random = Math.random) {
    const list = (tips || []).filter((t) => t && t !== last); if (!list.length) return tips?.[0] || '';
    return list[Math.floor(random() * list.length) % list.length];
  }
  return { STEPS, CAP_MS, QUIET_MS, FRAMES, FRAME_MS, state, pickTip };
}));
