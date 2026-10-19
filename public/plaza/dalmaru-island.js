// 달마루섬 개편 1단계 (gamecenter-notes docs/dalmaru-implementation-20261019.md, 확정 순서 2026-10-19): the island API
// (island-terrain.js's names) on the new crescent island -- the ground, water, walking, bridges, seasons and nature from
// dalmaru-terrain.js (assets 54). Only for the administrator's preview (island-map.js sets GC_ISLAND_MAP): everyone
// else, and the server, keep island-terrain.js. Step 1 is the land alone -- no buildings, walks or plaza things yet
// (PLACES come in step 2), so those lists are empty here and the scene shows the bare island (GC_TERRAIN_ONLY).
(function (root) {
  if (root.GC_ISLAND_MAP !== 'dalmaru' || !root.DalmaruTerrain || !root.IslandTerrain) return;
  const D = root.DalmaruTerrain; const C = root.IslandTerrain;
  const { TAU, smooth, lerp, wrap } = C;
  const SEA = D.SEA;

  // 윤슬다리 (the two 50 m bridges, assets 55 bridge.yunseul in step 2) and, for now, a plain bridge where each river runs
  // through the middle of its course (step 2 lays the walks and their bridges)
  const bridges = D.BRIDGES.map((b) => ({ x: b.x, z: b.z, ux: 1, uz: 0, half: b.length / 2, w: 4, deck: 1.4 }));
  for (const r of D.RIVERS) {
    const i = Math.floor((r.pts.length - 1) / 2); const [ax, az] = r.pts[i]; const [bx, bz] = r.pts[i + 1];
    const l = Math.hypot(bx - ax, bz - az) || 1; const mx = (ax + bx) / 2; const mz = (az + bz) / 2;
    bridges.push({ x: mx, z: mz, ux: -(bz - az) / l, uz: (bx - ax) / l, half: r.w / 2 + 2.6, w: 2.8, deck: Math.max(D.ground(mx + (-(bz - az) / l) * 5, mz + ((bx - ax) / l) * 5), 0.4) + 0.5 });
  }
  function onBridge(x, z) {
    for (const b of bridges) {
      const dx = x - b.x; const dz = z - b.z; const u = dx * b.ux + dz * b.uz; const v = -dx * b.uz + dz * b.ux;
      if (Math.abs(u) <= b.half && Math.abs(v) <= b.w / 2) return { b, u };
    }
    return null;
  }
  const deckAt = (hit) => hit.b.deck + 0.35 * (1 - (hit.u / hit.b.half) ** 2);
  const heightAt = (x, z) => { const hit = onBridge(x, z); return hit ? deckAt(hit) : D.heightAt(x, z); };
  const walkable = (x, z) => Boolean(onBridge(x, z)) || (D.walkable(x, z) && D.coastDist(x, z) > 1.2);
  // the cliff faces and the ridge's sea cliffs read as rock
  const cliffAt = (x, z) => Math.min(1, D.ridgeAt(x, z) * smooth(0.25, 0.9, D.slopeAt(x, z)) + (D.ridgeAt(x, z) > 0.3 ? smooth(20, 4, D.coastDist(x, z)) : 0));
  // fishing: a walkable spot with water within 2.4 m -- the sea (and 윤슬만) or fresh water (the lake, rivers, pools)
  function fishWater(x, z) {
    if (!walkable(x, z) || onBridge(x, z)) return null;
    for (const [dx, dz] of [[2.4, 0], [-2.4, 0], [0, 2.4], [0, -2.4]]) {
      const wx = x + dx; const wz = z + dz; if (!D.isWater(wx, wz)) continue;
      return D.coastDist(wx, wz) < 0 ? 'sea' : 'river';
    }
    return null;
  }
  const SIZE = 380; const SEG = 152; const STEP = SIZE / SEG; const HALF = SIZE / 2; // the ground mesh: 2.5 m (step 1; the far rings come with the phone check)
  function meshGroundHeight(x, z) {
    const x0 = Math.floor((x + HALF) / STEP) * STEP - HALF; const z0 = Math.floor((z + HALF) / STEP) * STEP - HALF;
    const u = (x - x0) / STEP; const v = (z - z0) / STEP;
    const a = D.ground(x0, z0); const b = D.ground(x0 + STEP, z0); const c = D.ground(x0, z0 + STEP);
    return u + v <= 1 ? a * (1 - u - v) + b * u + c * v : b * (1 - v) + c * (1 - u) + D.ground(x0 + STEP, z0 + STEP) * (u + v - 1);
  }
  // 계절 구역 4곳 (dalmaru-terrain); 대청마당 stays the island's own green like the old plaza
  const P = D.PLAZA;
  const seasonZoneAt = (x, z) => (Math.abs(x - P.x) < P.hw && z > P.d0 && z < P.d1 ? -1 : D.seasonZoneAt(x, z));
  const seasonAt = (x, z, ms) => C.zoneSeason(seasonZoneAt(x, z), C.seasonDay(ms));

  // nature: woods on the west arm (푸른숲골), round the lake and on the ridge's back, trees scattered over the fields,
  // flowers, bushes, grass, shore rocks -- seeded, the same on every screen
  let natureCache = null;
  function nature() {
    if (natureCache) return natureCache;
    let seed = 0x5a1d0e; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const R = D.R_OUT + 5;
    const clearOf = (x, z) => walkable(x, z) && D.coastDist(x, z) > 5 && D.slopeAt(x, z) < 0.35 && D.riverDist(x, z) > 2.5 && D.lakeDist(x, z) > 3
      && !(Math.abs(x - P.x) < P.hw + 4 && z > P.d0 - 4 && z < P.d1 + 4) && !onBridge(x, z);
    const trees = [];
    const woods = [[-118, -10, 30, 70], [-100, 40, 22, 40], [95, -40, 22, 36], [-20, -130, 26, 30], [40, -132, 22, 24]];
    for (const [wx, wz, wr, n] of woods) for (let k = 0, tries = 0; k < n && tries < n * 14; tries += 1) {
      const a = rnd() * TAU; const r = Math.sqrt(rnd()) * wr; const x = wx + Math.cos(a) * r; const z = wz + Math.sin(a) * r;
      if (clearOf(x, z) && trees.every((t) => Math.hypot(t.x - x, t.z - z) > 3.4)) { trees.push({ x, z, s: 0.8 + rnd() * 0.55 }); k += 1; }
    }
    for (let tries = 0; trees.length < 420 && tries < 9000; tries += 1) {
      const x = (rnd() * 2 - 1) * R; const z = (rnd() * 2 - 1) * R;
      if (clearOf(x, z) && trees.every((t) => Math.hypot(t.x - x, t.z - z) > 7)) trees.push({ x, z, s: 0.75 + rnd() * 0.5 });
    }
    const flowers = [];
    for (const [fx, fz, fr, n] of [[-60, 20, 9, 110], [60, 20, 9, 110], [-30, -60, 6, 60], [30, -60, 6, 60], [0, 150, 6, 50], [120, 40, 6, 50]]) {
      for (let k = 0; k < n; k += 1) { const a = rnd() * TAU; const r = Math.sqrt(rnd()) * fr; const x = fx + Math.cos(a) * r; const z = fz + Math.sin(a) * r; if (clearOf(x, z)) flowers.push({ x, z, c: k % 5 }); }
    }
    const bushes = [];
    for (let tries = 0; bushes.length < 520 && tries < 7000; tries += 1) { const x = (rnd() * 2 - 1) * R; const z = (rnd() * 2 - 1) * R; if (clearOf(x, z)) bushes.push({ x, z, s: 0.55 + rnd() * 0.6 }); }
    const tufts = [];
    for (let tries = 0; tufts.length < 2200 && tries < 14000; tries += 1) { const x = (rnd() * 2 - 1) * R; const z = (rnd() * 2 - 1) * R; if (walkable(x, z) && D.coastDist(x, z) > 7 && D.slopeAt(x, z) < 0.5) tufts.push({ x, z, s: 0.6 + rnd() * 0.7 }); }
    const rocks = [];
    for (let tries = 0; rocks.length < 160 && tries < 8000; tries += 1) {
      const x = (rnd() * 2 - 1) * R; const z = (rnd() * 2 - 1) * R; const cd = D.coastDist(x, z);
      if (cd > -1 && cd < 4 && !D.inBay(x, z)) rocks.push({ x, z, s: 0.5 + rnd() * (D.ridgeAt(x, z) > 0.3 ? 1.6 : 0.8), r: rnd() * 6 });
    }
    natureCache = { trees, flowers, bushes, tufts, rocks, posts: [], lampSpots: [] };
    return natureCache;
  }
  const natureSolids = () => [...nature().trees.map((t) => ({ x: t.x, z: t.z, r: 0.55 * t.s })), ...nature().rocks.filter((r) => r.s > 0.9).map((r) => ({ x: r.x, z: r.z, r: 0.45 * r.s }))];
  const AREAS = Object.fromEntries([['plaza', { x: P.x, z: P.z, label: D.NAMES.plaza }], ['notice', { ...D.PLACES.notice, label: D.NAMES.notice }], ['village', { ...D.PLACES.village, label: D.NAMES.village }],
    ['west', { x: -120, z: 10, label: D.NAMES.west }], ['lake', { x: D.LAKE.x, z: D.LAKE.z, label: D.NAMES.lake }], ['east', { x: 115, z: 20, label: D.NAMES.east }],
    ['isle', { x: D.ISLE.x, z: D.ISLE.z, label: D.NAMES.isle }], ['bay', { x: 0, z: 60, label: D.NAMES.bay }], ['ridge', { x: 0, z: -146, label: D.NAMES.ridge }]]);

  // the old island's placed things (the village props, the museum, the farm, the contest statue): far off this map on the
  // bare preview -- step 2 places what moves (PLACES)
  const away = (o) => (Array.isArray(o) ? o.map(away) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, (k === 'x' && typeof v === 'number') ? v + 10000 : away(v)])) : o);
  root.IslandTerrain = Object.freeze({
    ...C,
    MAP: 'dalmaru', TERRAIN_ONLY: true, GROUND: { size: SIZE, seg: SEG },
    coastR: (th) => D.R_OUT, coastDist: D.coastDist, cliffAt, rawLand: D.landHeight, land: D.landHeight, ground: D.ground, meshGroundHeight, heightAt, walkable,
    streamDist: () => Infinity, walkDist: () => Infinity, STREAMS: [], streamCurves: [], walkCurves: [], RIVER_WIDE: { pts: [] }, riverExtra: () => 0,
    streamDepth: () => 0, streamWaterHeight: () => SEA, POND: { x: 1e5, z: 1e5, r: 0 }, PADS: [],
    bridges, onBridge, deckAt, PIER: { x: 1e5, z: 1e5, ux: 1, uz: 0, half: 0, w: 0, deck: 0 }, BREAKWATER: { x: 1e5, z: 1e5, ux: 1, uz: 0, half: 0, w: 0, deck: 0 }, bayR: D.R_BAY,
    fishWater, canFish: (x, z) => fishWater(x, z) !== null, ISLAND_RADIUS: 200, SPAWN: { x: P.x, z: P.d1 - 6 }, PLAZA_R: 0, PLAZA_H: P.h,
    seasonZoneAt, seasonAt, nature, natureSolids, harvestTrees: () => [], AREAS,
    SPOTS: {}, COTTAGES: [], BUILDINGS: [], RESERVED_LOTS: [], STATUE_SPOTS: [], plazaProps: () => ({ benches: [], lamps: [], beds: [], seats: [] }), villageSolids: () => [],
    HALLOWEEN_FIELDS: [], HALLOWEEN_EXTRAS: [], dalmaru: D, VILLAGE: away(C.VILLAGE), MUSEUM: away(C.MUSEUM), FARM: away(C.FARM), CONTEST_STATUE: away(C.CONTEST_STATUE),
  });
}(typeof self !== 'undefined' ? self : this));
