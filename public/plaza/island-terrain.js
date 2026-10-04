// v1.10.7: the island's shape and where a character may stand, shared word for word by the browser (island.js builds
// the 3D island from it) and the server (which checks the positions it keeps -- the same-day spot, later events and
// people walking about). Pure numbers, no Three.js. Moved here unchanged from island.js (v1.10.0).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandTerrain = api;
}(typeof self !== 'undefined' ? self : this, () => {

  const TAU = Math.PI * 2;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const bump = (d, w) => Math.exp(-((d / w) ** 2));
  const smooth = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
  const lerp = (a, b, t) => a + (b - a) * t;

  // --- shape ---------------------------------------------------------------------------------------------------------
  // Distance from the centre to the shore in direction th (x east, z south). About 200 across: ~40 s of straight walking.
  function coastR(th) {
    return 100 + 7 * Math.sin(3 * th + 0.6) + 5 * Math.sin(5 * th + 2) + 3 * Math.sin(8 * th + 0.3)
      - 17 * bump(wrap(th - Math.PI / 2), 0.2) // the harbour bay (south)
      + 12 * bump(wrap(th + Math.PI / 4), 0.13) // a cape (north-east)
      - 9 * bump(wrap(th - Math.PI), 0.22) // a west bay
      + 7 * bump(wrap(th + 2.4), 0.15);
  }
  const coastDist = (x, z) => coastR(Math.atan2(z, x)) - Math.hypot(x, z); // > 0 on land
  const cliffAt = (x, z) => smooth(0.35, 0, Math.abs(wrap(Math.atan2(z, x) + Math.PI / 2 + 0.1)) - 0.55); // the north coast

  const PLAZA_R = 16; // the raised central plaza (flat top), ramps down to 22
  const PLAZA_H = 1;
  const HILLS = [[-60, -30, 7, 15], [-12, -82, 4, 13], [26, -76, 5, 12], [-24, 68, 3, 9], [72, 30, 3, 10], [-82, 16, 2.5, 9]];
  const POND = { x: -50, z: 44, r: 8 };

  // Areas (the map labels them; buildings and walks are placed around them).
  const AREAS = {
    plaza: { x: 0, z: 0, label: '중앙광장' },
    hall: { x: 0, z: -48, label: '게임관' },
    shops: { x: 50, z: -2, label: '상점가' },
    nature: { x: -46, z: 46, label: '자연 구역' },
    climb: { x: -60, z: -30, label: '등반 도전' },
    harbor: { x: 6, z: 92, label: '선착장' },
  };

  // Facility spots: position and the point the front faces. `kind` picks the model in plaza-scene.
  const SPOTS = {
    games: { x: 0, z: -58, face: [0, -40], kind: 'hall', wall: 0xffe3b3, roof: 0xf08a6b },
    records: { x: -20, z: -48, face: [-6, -42], kind: 'house', wall: 0xf3e2ff, roof: 0x9b7fd6 },
    missions: { x: 13, z: -46, face: [0, -42], kind: 'board', tint: 0x8fd18a },
    shop: { x: 42, z: -8, face: [42, 4], kind: 'shop', wall: 0xd9f0ff, roof: 0x6aa9e8 }, // 게임 스킨 상점
    avatar: { x: 55, z: -8, face: [55, 4], kind: 'shop', wall: 0xffe4ef, roof: 0xe87a9e }, // 캐릭터 스킨 상점
    board: { x: -10, z: -6, face: [0, 0], kind: 'board' },
    attendance: { x: 10, z: -6, face: [0, 0], kind: 'npc' },
    map: { x: -11, z: 6, face: [0, 2], kind: 'mapboard' },
    donate: { x: 9.8, z: 9.8, face: [0, 0], kind: 'donation' }, // v1.10.5 기부함, between the two statues
    chat: { x: -18, z: 27, face: [-4, 22], kind: 'gazebo' },
    climb: { x: -59, z: -28, face: [-44, -19], kind: 'tower' }, // a tall tower on the hill, seen from far away
    admin: { x: 24, z: 15, face: [14, 6], kind: 'office', wall: 0xe4e7ec, roof: 0x7b8794 },
  townhall: { x: -24, z: 6, face: [-14, 3], kind: 'townhall', wall: 0xf7f0e1, roof: 0x3f7d68 }, // v1.10.10 중앙 관공서: settles trash, takes found wallets
  trader: { x: 62, z: -6, face: [62, 4], kind: 'stall' }, // v1.10.10 상점가 상인: buys herbs, berries and mushrooms
  naming: { x: 48.5, z: -3.4, face: [48.5, 4], kind: 'desk' }, // v1.10.9 작명소: a folding desk on the shop street, between the two shops
  };
  const RESERVED_LOTS = [{ x: 49, z: 11, face: [49, 0] }]; // the shop street's next building (외형 변경 시설, later)
  const STATUE_SPOTS = [{ x: 12, z: 5 }, { x: 5.5, z: 12.5 }]; // 기부 동상 자리 (rules not decided yet: plinths only)
  const SPAWN = { x: 0, z: 8 };
  // v1.10.13 생활 마을: islanders' cottages on empty ground beside the walks -- a lane down to the harbour and two at the
  // far end of the shop street. Decoration only (no door to enter); each `style` picks a different build (plaza-scene).
  const COTTAGES = [
    { x: 10.8, z: 36.6, face: [4, 37], style: 0 }, { x: -3.1, z: 38.8, face: [3.3, 41.3], style: 1 },
    { x: 7.6, z: 48.3, face: [1.4, 45.8], style: 2 }, { x: -6.8, z: 49.9, face: [0, 50.3], style: 3 },
    { x: 9.6, z: 59.3, face: [3.2, 61.4], style: 4 }, { x: -4, z: 61.7, face: [2.3, 59.2], style: 5 },
    { x: 10.5, z: 69.4, face: [3.8, 68.2], style: 6 }, { x: 67.8, z: 8.3, face: [70.3, 2], style: 7 },
    { x: 74.5, z: -3.7, face: [72.1, 2.7], style: 8 },
  ];
  // Everything built that the island's other parts keep clear of (events, islanders' walks, trees).
  const BUILDINGS = [...Object.values(SPOTS), ...COTTAGES.map((c) => ({ ...c, kind: 'cottage' }))];

  // Streams: from the plaza edge toward the sea on the four diagonals, winding more the further they go.
  function makeStream(a0, phase) {
    const pts = [];
    for (let r = PLAZA_R + 1; ; r += 2) {
      const a = a0 + 0.26 * smooth(PLAZA_R, 50, r) * Math.sin(r * 0.085 + phase);
      const x = Math.cos(a) * r; const z = Math.sin(a) * r;
      pts.push([x, z]);
      if (coastDist(x, z) < -5) break;
    }
    return pts;
  }
  const STREAMS = [makeStream(Math.PI / 4, 0.4), makeStream((3 * Math.PI) / 4, 2.1), makeStream((-3 * Math.PI) / 4, 4.0), makeStream(-Math.PI / 4, 5.3)];
  const STREAM_HALF = 1.25;

  // Walks (centre lines); the ring links the areas without crossing the plaza.
  const ring = [];
  for (let i = 0; i < 24; i += 1) { const a = (i / 24) * TAU; const r = 34 + 3 * Math.sin(3 * a + 1); ring.push([Math.cos(a) * r, Math.sin(a) * r]); }
  ring.push(ring[0]);
  const WALKS = [
    { w: 3.2, pts: [[0, -15], [3, -23], [-3, -32], [0, -41]] }, // to the hall
    { w: 3.2, pts: [[15, 1], [25, 4], [35, -1], [47, 2], [60, -1], [73, 3]] }, // the shop street
    { w: 3, pts: [[-15, -2], [-25, -5], [-35, -13], [-44, -19], [-52, -24]] }, // up to the climb
    { w: 3.2, pts: [[0, 15], [-3, 25], [4, 37], [0, 51], [4, 65], [2, 78], [5, 86]] }, // down to the harbour
    { w: 2.6, pts: [[-2, 32], [-14, 37], [-27, 41], [-36, 47], [-40, 56]] }, // into the nature area
    { w: 2.4, pts: ring },
    { w: 2.4, pts: [[-6, 31], [-12, 28], [-16, 30]] }, // to the gazebo
  ];

  // --- geometry helpers -------------------------------------------------------------------------------------------------
  function catmull(pts, step = 0.8) { // a smooth curve through the points, sampled about every `step`
    const out = [];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p0 = pts[Math.max(0, i - 1)]; const p1 = pts[i]; const p2 = pts[i + 1]; const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let k = 0; k < n; k += 1) {
        const t = k / n; const t2 = t * t; const t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  const streamCurves = STREAMS.map((s) => catmull(s, 1));
  const walkCurves = WALKS.map((w) => ({ w: w.w, pts: catmull(w.pts, 0.8) }));
  function segDist(px, pz, ax, az, bx, bz) {
    const dx = bx - ax; const dz = bz - az; const l = dx * dx + dz * dz;
    const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l)) : 0;
    return Math.hypot(px - ax - dx * t, pz - az - dz * t);
  }
  function lineDist(px, pz, pts) {
    let best = Infinity;
    for (let i = 0; i < pts.length - 1; i += 1) {
      const a = pts[i]; const b = pts[i + 1];
      if (Math.abs(px - a[0]) > best + 3 && Math.abs(px - b[0]) > best + 3) continue;
      best = Math.min(best, segDist(px, pz, a[0], a[1], b[0], b[1]));
    }
    return best;
  }
  const streamDist = (x, z) => { let d = Infinity; for (const s of streamCurves) d = Math.min(d, lineDist(x, z, s)); return d; };
  const walkDist = (x, z) => { let d = Infinity; for (const w of walkCurves) d = Math.min(d, lineDist(x, z, w.pts) - w.w / 2); return d; };

  // Ground before water is cut in: plateau, hills, north cliffs, beaches; flat pads under buildings and squares.
  function rawLand(x, z) {
    const r = Math.hypot(x, z);
    let h = 0;
    for (const [hx, hz, hh, hw] of HILLS) h += hh * bump(Math.hypot(x - hx, z - hz), hw);
    h += 0.35 * Math.sin(x * 0.08) * Math.cos(z * 0.07); // a gentle roll so the grass is never flat
    h = lerp(PLAZA_H, h, smooth(PLAZA_R, PLAZA_R + 6, r)); // the plaza sits a little higher
    const cd = coastDist(x, z); const cliff = cliffAt(x, z);
    h += cliff * 4.2 * smooth(30, 6, cd) * smooth(-1, 1.5, cd);
    const shore = lerp(7, 1.4, cliff);
    if (cd < shore) h = lerp(-0.95, h, Math.max(0, cd) / shore);
    if (cd < 0) h = -0.95 + cd * 0.45;
    return h;
  }
  const PADS = [[0, -44, 9.5], ...RESERVED_LOTS.map((l) => [l.x, l.z, 5]), ...COTTAGES.map((c) => [c.x, c.z, 4.6]), ...Object.values(SPOTS).filter((s) => Math.hypot(s.x, s.z) > PLAZA_R + 4).map((s) => [s.x, s.z, s.kind === 'hall' ? 11 : 4.5])]
    .map(([x, z, r]) => ({ x, z, r, h: rawLand(x, z) }));
  function land(x, z) {
    let h = rawLand(x, z);
    for (const p of PADS) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r + 5) h = lerp(p.h, h, smooth(p.r, p.r + 5, d)); }
    return h;
  }
  function ground(x, z) {
    let h = land(x, z);
    const sd = streamDist(x, z);
    if (sd < STREAM_HALF + 1.4) h = lerp(h - 1, h, smooth(STREAM_HALF - 0.3, STREAM_HALF + 1.4, sd));
    const pd = Math.hypot(x - POND.x, z - POND.z);
    if (pd < POND.r + 2) h = lerp(h - 1, h, smooth(POND.r - 0.5, POND.r + 2, pd));
    return h;
  }

  // Bridges where a walk crosses a stream (found from the curves, so moving a walk moves its bridge).
  const bridges = [];
  for (const walk of walkCurves) {
    let run = null;
    walk.pts.forEach(([x, z], i) => {
      const d = streamDist(x, z);
      if (d < STREAM_HALF + 0.8) { if (!run || d < run.d) run = { d, i, x, z, w: walk.w }; }
      else if (run) { addBridge(run, walk.pts); run = null; }
    });
    if (run) addBridge(run, walk.pts);
  }
  function addBridge(run, pts) {
    if (bridges.some((b) => Math.hypot(b.x - run.x, b.z - run.z) < 4)) return;
    const a = pts[Math.max(0, run.i - 2)]; const b = pts[Math.min(pts.length - 1, run.i + 2)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const ux = (b[0] - a[0]) / len; const uz = (b[1] - a[1]) / len;
    const half = 3.3; const ends = (land(run.x - ux * half, run.z - uz * half) + land(run.x + ux * half, run.z + uz * half)) / 2;
    bridges.push({ x: run.x, z: run.z, ux, uz, half, w: Math.max(2.6, run.w), deck: Math.max(ends, ground(run.x, run.z) + 0.9) + 0.1 });
  }
  function onBridge(x, z) {
    for (const b of bridges) {
      const dx = x - b.x; const dz = z - b.z; const u = dx * b.ux + dz * b.uz; const v = -dx * b.uz + dz * b.ux;
      if (Math.abs(u) <= b.half && Math.abs(v) <= b.w / 2) return { b, u };
    }
    return null;
  }
  const deckAt = (hit) => hit.b.deck + 0.35 * (1 - (hit.u / hit.b.half) ** 2);

  // Harbour: a pier straight out into the bay and a stone breakwater with a lighthouse.
  const bayR = coastR(Math.PI / 2);
  const PIER = { x: 5, z: bayR - 6, ux: 0, uz: 1, half: 13, w: 3, deck: 0.45 };
  PIER.x += PIER.ux * PIER.half; PIER.z += PIER.uz * PIER.half;
  const bwA = Math.PI / 2 - 0.42; const bwBase = coastR(bwA) - 4;
  const BREAKWATER = { x: Math.cos(bwA) * bwBase, z: Math.sin(bwA) * bwBase, ux: Math.cos(bwA + 0.35), uz: Math.sin(bwA + 0.35), half: 12, w: 3.4, deck: 0.7 };
  BREAKWATER.x += BREAKWATER.ux * BREAKWATER.half; BREAKWATER.z += BREAKWATER.uz * BREAKWATER.half;
  const inRect = (r, x, z, grow = 0) => { const dx = x - r.x; const dz = z - r.z; return Math.abs(dx * r.ux + dz * r.uz) <= r.half + grow && Math.abs(-dx * r.uz + dz * r.ux) <= r.w / 2 + grow; };

  // --- what the characters use ------------------------------------------------------------------------------------------
  function heightAt(x, z) {
    const hit = onBridge(x, z);
    if (hit) return deckAt(hit);
    if (inRect(PIER, x, z)) return PIER.deck;
    if (inRect(BREAKWATER, x, z)) return BREAKWATER.deck;
    return Math.max(ground(x, z), -0.6);
  }
  // Where a character may stand: land above the waterline, not in a stream or the pond (bridges, the pier and the
  // breakwater are fine), not over a cliff edge.
  function walkable(x, z) {
    if (inRect(PIER, x, z) || inRect(BREAKWATER, x, z) || onBridge(x, z)) return true;
    const cd = coastDist(x, z);
    if (cd < 2.2 + cliffAt(x, z) * 1.2) return false;
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.2) return false;
    return streamDist(x, z) > STREAM_HALF + 0.25;
  }
  const ISLAND_RADIUS = 130; // the server's outer bound for positions

  // --- building the scene -----------------------------------------------------------------------------------------------


  // v1.10.11: the seeded nature of the island (moved from island.js unchanged, same seed and order): trees, flowers,
  // bushes, grass tufts, shore rocks, cliff fence posts and lamps. Computed once, on first use, by both the browser
  // (which draws them) and the server (which keeps events off them).
  let natureCache = null;
  function nature() {
    if (natureCache) return natureCache;
    let seed = 0x1a2b3c;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const clearOf = (x, z, walkGap) => {
      if (!walkable(x, z) || coastDist(x, z) < 6) return false;
      if (Math.hypot(x, z) < PLAZA_R + 7) return false;
      if (walkDist(x, z) < walkGap || streamDist(x, z) < STREAM_HALF + 2) return false;
      if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 2.5 || Math.hypot(x, z + 44) < 11) return false;
      for (const s of BUILDINGS) if (Math.hypot(x - s.x, z - s.z) < (s.kind === 'hall' ? 13 : 7)) return false;
      if (x > 30 && x < 80 && z > -16 && z < 17) return false; // the shop street stays open
      return true;
    };
    const trees = [];
    const woods = [[-48, 44, 22, 46], [30, -62, 20, 30], [-72, 6, 16, 22], [70, 40, 16, 20], [-30, -66, 16, 20]];
    for (const [wx, wz, wr, n] of woods) for (let k = 0, tries = 0; k < n && tries < n * 12; tries += 1) {
      const a = rnd() * TAU; const r = Math.sqrt(rnd()) * wr; const x = wx + Math.cos(a) * r; const z = wz + Math.sin(a) * r;
      if (clearOf(x, z, 3) && trees.every((t) => Math.hypot(t.x - x, t.z - z) > 3.2)) { trees.push({ x, z, s: 0.8 + rnd() * 0.55 }); k += 1; }
    }
    for (let tries = 0; trees.length < 260 && tries < 6000; tries += 1) { // and scattered everywhere else
      const a = rnd() * TAU; const r = 24 + rnd() * 80; const x = Math.cos(a) * r; const z = Math.sin(a) * r;
      if (clearOf(x, z, 4) && trees.every((t) => Math.hypot(t.x - x, t.z - z) > 6)) trees.push({ x, z, s: 0.75 + rnd() * 0.5 });
    }
    const flowers = [];
    for (const [fx, fz, fr, n] of [[-34, 58, 9, 120], [-58, 30, 6, 60], [20, 40, 6, 50], [-22, -30, 5, 40], [58, 22, 5, 40], [-6, 44, 4, 30]]) {
      for (let k = 0; k < n; k += 1) { const a = rnd() * TAU; const r = Math.sqrt(rnd()) * fr; const x = fx + Math.cos(a) * r; const z = fz + Math.sin(a) * r; if (walkable(x, z) && walkDist(x, z) > 0.6) flowers.push({ x, z, c: k % 5 }); }
    }
    // Bushes along the walks and around the woods, and grass tufts everywhere, so open ground never looks bare.
    const bushes = [];
    for (const w of walkCurves) for (let i = 3; i < w.pts.length; i += 5) {
      if (rnd() < 0.45) continue;
      const [x, z] = w.pts[i]; const [x2, z2] = w.pts[Math.max(0, i - 1)]; const l = Math.hypot(x - x2, z - z2) || 1;
      const side = rnd() < 0.5 ? -1 : 1; const off = w.w / 2 + 1.3 + rnd() * 1.2;
      const bx = x + side * (-(z - z2) / l) * off; const bz = z + side * ((x - x2) / l) * off;
      if (clearOf(bx, bz, 0.9) && Math.hypot(bx, bz) > PLAZA_R + 3) bushes.push({ x: bx, z: bz, s: 0.6 + rnd() * 0.5 });
    }
    for (let tries = 0; bushes.length < 420 && tries < 5000; tries += 1) {
      const a = rnd() * TAU; const r = 26 + rnd() * 76; const x = Math.cos(a) * r; const z = Math.sin(a) * r;
      if (clearOf(x, z, 1.5)) bushes.push({ x, z, s: 0.55 + rnd() * 0.6 });
    }
    const tufts = [];
    for (let tries = 0; tufts.length < 1400 && tries < 9000; tries += 1) {
      const a = rnd() * TAU; const r = PLAZA_R + 5 + rnd() * 85; const x = Math.cos(a) * r; const z = Math.sin(a) * r;
      if (walkable(x, z) && coastDist(x, z) > 7 && walkDist(x, z) > 0.4 && PADS.every((p) => Math.hypot(x - p.x, z - p.z) > p.r)) tufts.push({ x, z, s: 0.6 + rnd() * 0.7, r: rnd() * 6 });
    }
    const rocks = [];
    for (let tries = 0; rocks.length < 90 && tries < 4000; tries += 1) {
      const a = rnd() * TAU; const x = Math.cos(a) * (coastR(a) - 2 - rnd() * 5); const z = Math.sin(a) * (coastR(a) - 2 - rnd() * 5);
      if (Math.abs(wrap(a - Math.PI / 2)) < 0.5) continue; // keep the harbour beach clear
      rocks.push({ x, z, s: 0.5 + rnd() * (cliffAt(x, z) > 0.4 ? 1.6 : 0.8), r: rnd() * 6 });
    }
    const posts = []; // a low fence along the top of the north cliffs
    for (let a = -Math.PI; a < Math.PI; a += 0.035) {
      const R = coastR(a) - 3.6; const x = Math.cos(a) * R; const z = Math.sin(a) * R;
      if (cliffAt(x, z) > 0.55) posts.push({ x, z });
    }
    const lampSpots = [];
    for (const w of walkCurves.slice(0, 5)) for (let i = 8; i < w.pts.length - 4; i += 14) {
      const [x, z] = w.pts[i]; const [x2, z2] = w.pts[i + 1]; const l = Math.hypot(x2 - x, z2 - z) || 1;
      const lx = x - ((z2 - z) / l) * (w.w / 2 + 0.8); const lz = z + ((x2 - x) / l) * (w.w / 2 + 0.8);
      if (walkable(lx, lz) && streamDist(lx, lz) > STREAM_HALF + 1.5) lampSpots.push({ x: lx, z: lz });
    }
    natureCache = { trees, flowers, bushes, tufts, rocks, posts, lampSpots };
    return natureCache;
  }
  // v1.10.16: the plaza's fixed props with their collision circles -- benches facing the fountain, lamps on a ring, flower
  // beds along the rim -- placed once here for both the scene (plaza-scene.js draws them) and the islanders' route grid
  // (island-npcs.js), so a round never runs through them and the islanders have nothing there to squeeze round.
  function plazaProps() {
    const busy = (x, z, gap) => [...Object.values(SPOTS), ...STATUE_SPOTS].some((s) => Math.hypot(s.x - x, s.z - z) < gap);
    const benches = [0.38, -0.38, Math.PI - 0.38, Math.PI + 0.38].map((a) => ({ x: Math.cos(a) * 5, z: Math.sin(a) * 5, r: 0.9 }));
    const lamps = [];
    for (let k = 0; k < 8; k += 1) {
      const a = Math.PI / 8 + (k * Math.PI) / 4; const x = Math.cos(a) * 12; const z = Math.sin(a) * 12;
      if (!busy(x, z, 3)) lamps.push({ x, z, r: 0.35 });
    }
    const beds = [];
    for (let i = 0; i < 12; i += 1) {
      const a = Math.PI / 4 + ((i % 4) * Math.PI) / 2 + (i < 4 ? 0.3 : i < 8 ? -0.3 : 0.62);
      const x = Math.cos(a) * (PLAZA_R - 2.2); const z = Math.sin(a) * (PLAZA_R - 2.2);
      if (!busy(x, z, 3.4)) beds.push({ x, z, r: 1.1, i }); // i: the bed's place in the ring (its flower colours)
    }
    return { benches, lamps, beds };
  }
  // Things a character walks around, with their radius (the same circles the browser uses).
  function natureSolids() {
    const n = nature();
    return [...n.trees.map((t) => ({ x: t.x, z: t.z, r: 0.75 * t.s })), ...n.bushes.map((b) => ({ x: b.x, z: b.z, r: 0.75 * b.s })), ...n.lampSpots.map((p) => ({ x: p.x, z: p.z, r: 0.3 }))];
  }

  return { nature, natureSolids, plazaProps, coastR, PLAZA_R, AREAS, SPOTS, COTTAGES, BUILDINGS, RESERVED_LOTS, STATUE_SPOTS, SPAWN, heightAt, walkable, ISLAND_RADIUS, TAU, wrap, smooth, lerp, coastDist, cliffAt, PLAZA_H, POND, STREAMS, STREAM_HALF, streamCurves, walkCurves, segDist, lineDist, streamDist, walkDist, rawLand, PADS, land, ground, bridges, onBridge, deckAt, bayR, PIER, BREAKWATER };
}));
