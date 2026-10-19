// 달마루섬 개편 (gamecenter-notes docs/dalmaru-implementation-20261019.md): which island this page shows -- set before
// the island's scripts load. 'dalmaru' only for the administrator's preview (the server tells the page, app.js keeps it
// here and reloads once); everyone else gets the island they have.
(function (root) {
  try { if (localStorage.getItem('gc.islandMap') === 'dalmaru') root.GC_ISLAND_MAP = 'dalmaru'; } catch {}
}(typeof self !== 'undefined' ? self : this));
