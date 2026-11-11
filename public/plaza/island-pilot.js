// v1.10.275 그래픽 시범 (gamecenter-notes docs/graphics-pilot-20261107.md, assets 106 Nature Megapack Extended, RG Poly CC0):
// once one grass patch west of the plaza's north path with its own plants and trees; since v1.10.284 G1 the wind grass over the
// whole island (below). v1.10.310 잡초 편입 (사용자 「막 뿌려둔 조형물들 … 깔끔하게 정리」): the patch's own plants and trees are
// gone -- the island's own nature, weeds and grass stand there as everywhere (its bushes, rocks and trees solid), and the weeds
// are drawn with three of its models (plaza-scene setWeeds: weed.broad / weed.tuft / weed.fern). Browser and node.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandPilot = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const CUT_R = 0.75; // (round a weed, an insect, a thing on the ground: no blades -- they stay easy to see)
  // the assets 106 models still drawn (island-assets.js pilot.<id>): the weeds' three (weed.*), G4b's two mushrooms
  const IDS = Object.freeze(['grass_broad', 'grass_tuft', 'bush_fern', 'mushroom_red', 'mushroom_brown']);
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // ---- v1.10.284 G1 땅과 풀, 섬 전체 (notes docs/graphics-island-wide-20261108.md): the blades over all the island's grass
  // ground, in square cells (CELL m) made as the camera comes near and dropped behind it -- each cell its own seed, the same
  // on every screen. Where grass grows is read from the ground's own painted maps (tools/maps: path-a, path-b, cover-a/b,
  // shore -- each a value 0..255 per point), not the walks' curves (34 µs a point: too slow for a cell a frame).
  const CELL = 16;
  // how thick the grass is at a point from the maps' values (0: none) -- off the walks (half a metre past their edge), the
  // gravel, bare earth, sand and rock, and two metres back from the sea; thinner on the forest floor
  function grassFrom(m) {
    if (m.path > 64 || m.gravel > 60 || m.bare > 128 || m.sand > 100 || m.rock > 100 || m.shore < 150) return 0;
    return 1 - (m.forest / 255) * 0.65;
  }
  // the cells with any part within r of (x, z), nearest first: { i, j, x, z (its centre), d (to its nearest point) }
  function cellsNear(x, z, r, size = CELL) {
    const out = []; const i0 = Math.floor((x - r) / size); const i1 = Math.floor((x + r) / size); const j0 = Math.floor((z - r) / size); const j1 = Math.floor((z + r) / size);
    for (let i = i0; i <= i1; i += 1) for (let j = j0; j <= j1; j += 1) {
      const dx = Math.max(i * size - x, 0, x - (i + 1) * size); const dz = Math.max(j * size - z, 0, z - (j + 1) * size); const d = Math.hypot(dx, dz);
      if (d <= r) out.push({ i, j, x: (i + 0.5) * size, z: (j + 0.5) * size, d });
    }
    return out.sort((a, b) => a.d - b.d || Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
  }
  // a cell's blades: up to `max` tried points in a random order of its own (any first part of the list is spread over the
  // whole cell -- fewer shown is evenly thinner), each kept with the chance `thick(x, z)` (0..1) gives: { x, z, yaw, h }
  function cellBlades(i, j, max, thick, size = CELL) {
    const r = rng(((i * 73856093) ^ (j * 19349663) ^ 0x51ed) | 0); const out = [];
    for (let k = 0; k < max; k += 1) {
      const x = (i + r()) * size; const z = (j + r()) * size; const yaw = r() * Math.PI * 2; const h = 0.12 + r() * 0.14; const keep = r();
      if (keep < thick(x, z)) out.push({ x, z, yaw, h });
    }
    return out;
  }
  // v1.10.290 6 (사용자 「풀이 멋대로 사라졌다 생겨」): a cell's shown count eases. A big change (a tier, the cell in or out of
  // reach) grows or lays down the blades between the old count and the new over GROW_MS -- their height 0 -> 1 or 1 -> 0;
  // a small one (walking: the far share, under a tenth of the cell's blades) is taken at once. `g` { from, to, t } is the
  // cell's (start { from: 0, to: 0, t: 1 }); gives the instances to draw (`count`), the band's first (`lo`) and its height (`s`)
  const GROW_MS = 1500;
  function growStep(g, n, ms, total) {
    if (n !== g.to) {
      if (Math.abs(n - g.to) <= total * 0.1) { g.to = n; if (g.t >= 1) g.from = n; }
      else { g.from = Math.round(g.from + (g.to - g.from) * g.t); g.to = n; g.t = 0; }
    }
    g.t = Math.min(1, g.t + ms / GROW_MS); if (g.t >= 1) g.from = g.to;
    return { count: Math.max(g.from, g.to), lo: Math.min(g.from, g.to), s: g.to > g.from ? g.t : 1 - g.t };
  }
  // v1.10.310 잡초 편입: which of the three a weed is drawn as, from its place (the same on every screen) -- broad leaves the
  // most (104 triangles), tufts fewer (220), ferns seldom (300): 60 : 30 : 10
  function weedKind(x, z) { const v = Math.sin(x * 91.7 + z * 47.3) * 24634.6345; const h = v - Math.floor(v); return h < 0.6 ? 'broad' : h < 0.9 ? 'tuft' : 'fern'; }
  return Object.freeze({ CUT_R, IDS, CELL, grassFrom, cellsNear, cellBlades, GROW_MS, growStep, weedKind });
}));
