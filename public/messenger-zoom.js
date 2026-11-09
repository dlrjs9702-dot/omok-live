// v1.10.291 메신저 사진 확대·축소 (사용자 「주고 받은 사진을 확대, 축소할 수 있게」, notes docs/messenger-photo-zoom-20261109.md):
// the photo viewer's zoom as numbers -- { s, x, y }: the scale (1 = fitted .. 5) and the photo's shift from the screen's
// centre in px (CSS translate before scale, the origin the photo's centre). `w h` the fitted photo's size, `W H` the
// viewer's; a point `px py` is from the viewer's centre. The photo's edges never come inside the screen.
// Works in the browser (window.MessengerZoom) and in node tests (require).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MessengerZoom = factory();
}(typeof self !== 'undefined' ? self : this, () => {
  const MIN = 1; const MAX = 5; const TAP = 2.5;
  const fit = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  // the shift kept so the scaled photo still covers the screen where it can (a side smaller than the screen: centred)
  function clampPan(z, w, h, W, H) {
    const mx = Math.max(0, (w * z.s - W) / 2); const my = Math.max(0, (h * z.s - H) / 2);
    return { s: z.s, x: fit(z.x, -mx, mx) || 0, y: fit(z.y, -my, my) || 0 };
  }
  // to scale s2, the photo's point under (px, py) staying under it
  function zoomAt(z, s2, px, py, w, h, W, H) {
    const s = fit(s2, MIN, MAX); const k = s / z.s;
    return clampPan({ s, x: px - (px - z.x) * k, y: py - (py - z.y) * k }, w, h, W, H);
  }
  // a double tap: there to TAP times, or back to fitted
  const toggle = (z, px, py, w, h, W, H) => (z.s > MIN ? { s: MIN, x: 0, y: 0 } : zoomAt(z, TAP, px, py, w, h, W, H));
  const panBy = (z, dx, dy, w, h, W, H) => clampPan({ s: z.s, x: z.x + dx, y: z.y + dy }, w, h, W, H);
  return Object.freeze({ MIN, MAX, TAP, clampPan, zoomAt, toggle, panBy });
}));
