// 366 로딩 화면 (사용자 1A 2A, notes docs/install-button-20261118.md 마지막 절): the first island entry after 「게임 접속」 shows the
// island picture, 「섬으로 가는 중…」, a bar by steps (연결 → 섬 그리기 → 주민·물건 → 준비 완료) and one tip.
// 368 로딩 안정화 (사용자 「이런것도 로딩창 중 다 안정화 되고 넘어가게 할 순 없어?」): it lifts on the scene's own word, not on files gone
// quiet -- `ready` (plaza-scene readiness: every ground picture arrived, no model still coming, the shaders compiled) -- then ten
// frames in a row under 50 ms, or at 20 s. `short`: the same cover again on a place change that is not ready (a room, a taxi, the
// train, the boat, a reconnect) -- no tip, five frames under 100 ms, at most 8 s.
// The rule alone here (the browser and test/loading-cover.test.js); app.js feeds it and draws the cover.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LoadingCover = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const STEPS = Object.freeze(['연결', '섬 그리기', '주민·물건', '준비 완료']);
  const CAP_MS = 20000; const FRAMES = 10; const FRAME_MS = 50;
  const SHORT = Object.freeze({ CAP_MS: 8000, FRAMES: 5, FRAME_MS: 100 }); /* (a slow phone's 20~25 fps -- 40~50 ms -- would sit out the 8 s every door: the hitches waited out are 200 ms and more) */
  // s: { entered, running, ready, waiting (things still coming), frames: [ms...], elapsed, short } -> { step (0..4 done), label, progress 0..1, lift, timedOut }
  function state(s) {
    const need = s.short ? SHORT.FRAMES : FRAMES; const cap = s.short ? SHORT.CAP_MS : CAP_MS; const ms = s.short ? SHORT.FRAME_MS : FRAME_MS;
    const frames = Array.isArray(s.frames) ? s.frames.slice(-need) : [];
    const smooth = frames.length >= need && frames.every((f) => f < ms);
    const done = [Boolean(s.entered), Boolean(s.entered && s.running), Boolean(s.entered && s.running && s.ready), false];
    done[3] = done[2] && smooth;
    const step = done.filter(Boolean).length; const timedOut = Number(s.elapsed) >= cap;
    const waiting = Math.max(0, Number(s.waiting) || 0); const most = Math.max(waiting, Number(s.mostWaiting) || 0);
    const partial = step === 2 ? (most ? (1 - waiting / most) * 0.8 : 0) : step === 3 ? Math.min(1, frames.filter((f) => f < ms).length / need) * 0.9 : 0;
    return { step, label: STEPS[Math.min(step, 3)], progress: Math.min(1, (step + partial) / 4), lift: step === 4 || timedOut, timedOut };
  }
  // a tip for this load: one of those given (the server's list), never the same twice running in this tab
  function pickTip(tips, last = null, random = Math.random) {
    const list = (tips || []).filter((t) => t && t !== last); if (!list.length) return tips?.[0] || '';
    return list[Math.floor(random() * list.length) % list.length];
  }
  return { STEPS, CAP_MS, FRAMES, FRAME_MS, SHORT, state, pickTip };
}));
