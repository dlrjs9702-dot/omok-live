// 1.10.370 전체 지도 (사용자 「M 으로 전체 지도 펼칠 수 있게. 확대해서 볼 수도 있게.」): where the 안내 지도 may look. Its middle may go
// anywhere the drawn world is -- both islands and 별마루다리, x -230..530, z -200..385 (island.js drawMap's board) -- so the
// window never shows only sea past an edge; zoomed out wider than the world, its middle stays the world's. It opens on me,
// close enough to read what is round me. The rule alone here (the browser and test/map-view.test.js); app.js feeds it.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MapView = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const WORLD = Object.freeze({ x0: -230, x1: 530, z0: -200, z1: 385 });
  const ZOOM = Object.freeze({ MIN: 1, MAX: 6, OPEN: 3 });
  const axis = (c, half, a, b) => (half * 2 >= b - a ? (a + b) / 2 : Math.max(a + half, Math.min(b - half, c)));
  // the view's middle kept in the world: `halfW`/`halfH` the window's half size in metres at its zoom
  function clamp(view, halfW, halfH, world = WORLD) {
    view.zoom = Math.max(ZOOM.MIN, Math.min(ZOOM.MAX, Number(view.zoom) || 1));
    view.x = axis(Number.isFinite(view.x) ? view.x : 0, halfW, world.x0, world.x1);
    view.z = axis(Number.isFinite(view.z) ? view.z : 0, halfH, world.z0, world.z1);
    return view;
  }
  // opened: on me (where I stand -- 별마루섬 too), at the reading zoom
  const openOn = (me) => ({ zoom: ZOOM.OPEN, x: Number(me?.x) || 0, z: Number(me?.z) || 0 });
  return { WORLD, ZOOM, clamp, openOn };
}));
