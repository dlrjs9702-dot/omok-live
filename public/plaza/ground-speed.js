// 문제 기록 5회차 6 (사용자 「길 빠르게 + 숲·덤불만 느리게」): on a walk (or 대청마당's paving) one goes 15% faster -- walking,
// running, cycling -- on forest floor, among bushes and on the beach 15% slower; grass as before. What the ground is, as
// the ground maps have it (the same walks, trees, bushes and shore), on a 2 m grid built once on first use. The same file
// in the browser (plaza-scene.js: how fast I go) and on the server (how fast a pose may move, the insects' running ears).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GroundSpeed = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const FAST = 1.15; const SLOW = 0.85; const CELL = 2; const FACTOR = [1, FAST, SLOW];
  let made = null; // { T, x0, z0, n, kind: Uint8Array } -- 0 grass, 1 fast, 2 slow
  // `cover` (x, z) -> { forest, sand } 0..1: the ground maps' own cover-a, as the ground shows it (검토: the ground one sees
  // is the ground that slows) -- the server's built at this grid, the browser's read from the loaded picture
  function build(T, Paths, cover) {
    const size = T.GROUND?.size ?? 400; const n = Math.ceil(size / CELL); const x0 = -size / 2; const z0 = -size / 2; const kind = new Uint8Array(n * n);
    const cells = (x, z, r, fn) => { const i0 = Math.max(0, Math.floor((x - r - x0) / CELL)); const i1 = Math.min(n - 1, Math.floor((x + r - x0) / CELL)); const j0 = Math.max(0, Math.floor((z - r - z0) / CELL)); const j1 = Math.min(n - 1, Math.floor((z + r - z0) / CELL)); for (let j = j0; j <= j1; j += 1) for (let i = i0; i <= i1; i += 1) fn(j * n + i, x0 + (i + 0.5) * CELL, z0 + (j + 0.5) * CELL); };
    // slow first: forest floor and sand where the cover map paints them (without it: two trees within 4 m, land within
    // 4 m of the sea), and the bushes (1.2 m round)
    const D = T.dalmaru;
    if (cover) for (let j = 0; j < n; j += 1) for (let i = 0; i < n; i += 1) { const c = cover(x0 + (i + 0.5) * CELL, z0 + (j + 0.5) * CELL); if (c && (c.forest > 0.5 || c.sand > 0.5)) kind[j * n + i] = 2; }
    else {
      for (let j = 0; j < n; j += 1) for (let i = 0; i < n; i += 1) { const x = x0 + (i + 0.5) * CELL; const z = z0 + (j + 0.5) * CELL; const cd = D.coastDist(x, z); if (cd >= 0 && cd < 4 && !D.isWater(x, z)) kind[j * n + i] = 2; }
      const trees = new Uint8Array(n * n);
      for (const t of T.nature().trees) cells(t.x, t.z, 4, (k, x, z) => { if (Math.hypot(x - t.x, z - t.z) <= 4) trees[k] = Math.min(255, trees[k] + 1); });
      for (let k = 0; k < n * n; k += 1) if (trees[k] >= 2) kind[k] = 2;
    }
    const N = T.nature();
    for (const b of N.bushes || []) cells(b.x, b.z, 1.2, (k, x, z) => { if (Math.hypot(x - b.x, z - b.z) <= 1.2) kind[k] = 2; });
    // fast over all: the painted walks (to their edge) and 대청마당's paving
    const seg = (px, pz, ax, az, bx, bz) => { const dx = bx - ax; const dz = bz - az; const l = dx * dx + dz * dz || 1; const u = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l)); return Math.hypot(px - ax - u * dx, pz - az - u * dz); };
    for (const w of Paths.paintedWalks(T).curves) for (let s = 1; s < w.pts.length; s += 1) {
      const [ax, az] = w.pts[s - 1]; const [bx, bz] = w.pts[s]; const r = w.w / 2;
      cells((ax + bx) / 2, (az + bz) / 2, Math.hypot(bx - ax, bz - az) / 2 + r, (k, x, z) => { if (seg(x, z, ax, az, bx, bz) <= r) kind[k] = 1; });
    }
    const P = D.PLAZA; cells(P.x, (P.d0 + P.d1) / 2, Math.max(P.hw, (P.d1 - P.d0) / 2), (k, x, z) => { if (Math.abs(x - P.x) <= P.hw && z >= P.d0 && z <= P.d1) kind[k] = 1; });
    made = { T, cover, x0, z0, n, kind };
  }
  // how fast one goes here, by the ground (1 off 달마루섬, indoors and off the map); built again once the cover comes
  function factorAt(T, x, z, Paths = typeof self !== 'undefined' ? self.IslandPaths : null, cover = null) {
    if (!T?.dalmaru || !Paths) return 1;
    if (!made || made.T !== T || made.cover !== cover) build(T, Paths, cover);
    const i = Math.floor((x - made.x0) / CELL); const j = Math.floor((z - made.z0) / CELL);
    return i < 0 || j < 0 || i >= made.n || j >= made.n ? 1 : FACTOR[made.kind[j * made.n + i]];
  }
  return { FAST, SLOW, CELL, factorAt };
}));
