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
    avatar: { x: 55, z: -8, face: [55, 4], kind: 'shop', wall: 0xffe4ef, roof: 0xe87a9e }, // v1.10.30 옷가게 (was 캐릭터 스킨 상점)
    // v1.10.30 상점가 꾸미기 점포 세분화: across the street from the shops, facing them (the reserved lot is the 잡화점)
    faces: { x: 42.5, z: 11, face: [42.5, 0], kind: 'shop', wall: 0xeaf6f2, roof: 0x5fa39a }, // 성형외과
    hair: { x: 49, z: 11, face: [49, 0], kind: 'shop', wall: 0xfff1e0, roof: 0xd98b5f }, // 미용실
    accessories: { x: 55.5, z: 11, face: [55.5, 0], kind: 'shop', wall: 0xfdf3d7, roof: 0xc9a14a }, // 잡화점
    dye: { x: 62, z: 10, face: [62, 0], kind: 'stall' }, // 염색사
    board: { x: -10, z: -6, face: [0, 0], kind: 'board' },
    attendance: { x: 10, z: -6, face: [0, 0], kind: 'npc' },
    map: { x: -11, z: 6, face: [0, 2], kind: 'mapboard' },
    donate: { x: 9.8, z: 9.8, face: [0, 0], kind: 'donation' }, // v1.10.5 기부함, between the two statues
    chat: { x: -18, z: 27, face: [-4, 22], kind: 'gazebo' },
    climb: { x: -59, z: -28, face: [-44, -19], kind: 'tower' }, // a tall tower on the hill, seen from far away
    admin: { x: 24, z: 15, face: [14, 6], kind: 'office', wall: 0xe4e7ec, roof: 0x7b8794 },
  townhall: { x: -32.3, z: 6.4, face: [-14.6, 1.1], kind: 'townhall', wall: 0xf7f0e1, roof: 0x3f7d68 }, // v1.10.10 중앙 관공서 (settles trash, takes found wallets); v1.10.41 the marble hall, 8 m back from (-24, 6) and 2 m to its right, clear of the stream
  trader: { x: 62, z: -6, face: [62, 4], kind: 'stall' }, // v1.10.10 상점가 상인: buys herbs, berries and mushrooms
  naming: { x: 48.5, z: -3.4, face: [48.5, 4], kind: 'desk' }, // v1.10.9 작명소: a folding desk on the shop street, between the two shops
  };
  function facilityDoor(id) {
    const s = SPOTS[id]; if (!s) return null;
    const depth = { hall: 10, tower: 6.4, townhall: 12.6, shop: 2.7, house: 2.7, office: 2.7, board: .3, donation: .9, mapboard: .3, gate: 1.2, gazebo: 2.4, npc: .9, stall: 1.3, desk: 1.2 }[s.kind];
    if (depth === undefined) return null;
    const distance = s.kind === 'townhall' ? 8.6 : Math.max(1.4, depth / 2 + 1.3) + (s.kind === 'hall' ? 2.6 : 0);
    const dx = s.face[0] - s.x; const dz = s.face[1] - s.z; const length = Math.hypot(dx, dz) || 1;
    return { x: s.x + dx / length * distance, z: s.z + dz / length * distance };
  }
  const RESERVED_LOTS = []; // v1.10.30: the shop street's reserved lot became the 미용실 (more lots come with land reclamation)
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
  // v1.10.41 관공서 확장 (IDEAS, 사용자 확정 2026-10-07): the marble town hall (15 x 10 on a 16.2 x 12.6 terrace, its
  // steps out to 7.35 in front) with a walled marble yard before it (18 wide, 9 deep, a 3.2 m open gate in the middle of
  // the front wall where the mayor stands), all on ground raised to the plaza's top and run on from it. Measured in the
  // hall's own frame: lx to its right, lz toward its front (the plaza).
  const TOWNHALL = (() => {
    const s = SPOTS.townhall; const ry = Math.atan2(s.face[0] - s.x, s.face[1] - s.z);
    return { x: s.x, z: s.z, ry, cos: Math.cos(ry), sin: Math.sin(ry), body: { hx: 8.1, z0: -6.3, z1: 7.35 }, yard: { hx: 8.3, z0: 7.35, z1: 16.35 }, gate: { hw: 1.6 }, pad: { hx: 12.5, z0: -9, z1: 26 } };
  })();
  const townhallLocal = (x, z) => { const dx = x - TOWNHALL.x; const dz = z - TOWNHALL.z; return { lx: TOWNHALL.cos * dx - TOWNHALL.sin * dz, lz: TOWNHALL.sin * dx + TOWNHALL.cos * dz }; };
  const townhallWorld = (lx, lz) => ({ x: TOWNHALL.x + TOWNHALL.cos * lx + TOWNHALL.sin * lz, z: TOWNHALL.z - TOWNHALL.sin * lx + TOWNHALL.cos * lz });
  // inside the hall's terrace, or its yard (within the walls), with `m` more all round
  const inTownhall = (x, z, m = 0) => { const { lx, lz } = townhallLocal(x, z); const b = TOWNHALL.body; return Math.abs(lx) <= b.hx + m && lz >= b.z0 - m && lz <= TOWNHALL.yard.z1 + m; };
  const inTownhallYard = (x, z, m = 0) => { const { lx, lz } = townhallLocal(x, z); const y = TOWNHALL.yard; return Math.abs(lx) <= y.hx - m && lz >= y.z0 - m && lz <= y.z1 - m; };
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
  const hallA = Math.atan2(TOWNHALL.z, TOWNHALL.x) + 0.12; // v1.10.41: the ring goes round behind the town hall
  for (let i = 0; i < 48; i += 1) { const a = (i / 48) * TAU; const r = 34 + 3 * Math.sin(3 * a + 1) + 12 * bump(wrap(a - hallA), 0.62); ring.push([Math.cos(a) * r, Math.sin(a) * r]); }
  ring.push(ring[0]);
  const WALKS = [
    { w: 3.2, pts: [[0, -15], [3, -23], [-3, -32], [0, -41]] }, // to the hall
    { w: 3.2, pts: [[15, 1], [25, 4], [35, -1], [47, 2], [60, -1], [73, 3]] }, // the shop street
    { w: 3, pts: [[-14, -6], [-24, -12], [-35, -14], [-44, -19], [-52, -24]] }, // up to the climb (v1.10.41: south of the town hall's yard)
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
  // v1.10.47 관광열차 A역 (IDEAS 2026-10-08): the north-west stream is widened to about 12 m by the inner river stop, its
  // ends easing back to the usual width over RIVER_WIDE.ramp -- the water reaches further there, so every distance to a
  // stream (the ground cut, where one can stand, trees, weeds, the islanders' paths, bridges) sees the wider water
  const RIVER_WIDE = { pts: [[-21.35, -23.39], [-21.57, -24.08], [-21.77, -24.8], [-21.95, -25.53], [-22.1, -26.28], [-22.22, -27.04], [-22.32, -27.82], [-22.4, -28.6], [-22.47, -29.4], [-22.51, -30.2], [-22.55, -31.0], [-22.57, -31.8], [-22.59, -32.6], [-22.61, -33.4], [-22.64, -34.18], [-22.67, -34.96], [-22.72, -35.72], [-22.79, -36.47], [-22.88, -37.19], [-23.0, -37.9], [-23.16, -38.58], [-23.37, -39.24], [-23.61, -39.87], [-23.91, -40.47], [-24.26, -41.03], [-24.67, -41.57], [-25.13, -42.07], [-25.66, -42.53], [-26.24, -42.95]], half: 6, ramp: 6 };
  { let s = 0; RIVER_WIDE.at = RIVER_WIDE.pts.map((p, i, a) => (s += i ? Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) : 0)); RIVER_WIDE.len = s; }
  function riverExtra(x, z) { // how much wider than STREAM_HALF the water is here (0 away from the widened reach)
    const W = RIVER_WIDE; if (Math.abs(x - W.pts[14][0]) > 30 || Math.abs(z - W.pts[14][1]) > 30) return 0;
    let best = Infinity; let at = 0;
    for (let i = 0; i < W.pts.length - 1; i += 1) {
      const [ax, az] = W.pts[i]; const [bx, bz] = W.pts[i + 1]; const vx = bx - ax; const vz = bz - az; const l2 = vx * vx + vz * vz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2)); const d = Math.hypot(x - ax - vx * t, z - az - vz * t);
      if (d < best) { best = d; at = W.at[i] + t * (W.at[i + 1] - W.at[i]); }
    }
    if (best > W.half + 6) return 0;
    const full = W.half - STREAM_HALF; const k = Math.min(smooth(0, W.ramp, at), 1 - smooth(W.len - W.ramp, W.len, at));
    return full * k;
  }
  const streamDist = (x, z) => { let d = Infinity; for (const s of streamCurves) d = Math.min(d, lineDist(x, z, s)); const e = riverExtra(x, z); return e > 0 ? Math.min(d, lineDist(x, z, streamCurves[2]) - e) : d; };
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
  const PADS = [[0, -44, 9.5], ...RESERVED_LOTS.map((l) => [l.x, l.z, 5]), ...COTTAGES.map((c) => [c.x, c.z, 4.6]), ...Object.values(SPOTS).filter((s) => Math.hypot(s.x, s.z) > PLAZA_R + 4 && s.kind !== 'townhall').map((s) => [s.x, s.z, s.kind === 'hall' ? 11 : 4.5])]
    .map(([x, z, r]) => ({ x, z, r, h: rawLand(x, z) }));
  function land(x, z) {
    let h = rawLand(x, z);
    for (const p of PADS) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r + 5) h = lerp(p.h, h, smooth(p.r, p.r + 5, d)); }
    // v1.10.41: the town hall's ground at the plaza's top, run on from the plaza (a rounded slab, 5 m of slope round it)
    const { lx, lz } = townhallLocal(x, z); const pad = TOWNHALL.pad;
    const out = Math.hypot(Math.max(0, Math.abs(lx) - pad.hx), Math.max(0, pad.z0 - lz, lz - pad.z1));
    if (out < 5) h = Math.max(h, lerp(PLAZA_H, h, smooth(0, 5, out)));
    return h;
  }
  const streamDepth = (x, z) => lerp(0.22, 1, smooth(PLAZA_R + 7, PLAZA_R + 19, Math.hypot(x, z)));
  const streamWaterHeight = (x, z) => Math.max(-0.58, land(x, z) - Math.min(0.45, streamDepth(x, z) * 0.55));
  function ground(x, z) {
    let h = land(x, z);
    const sd = streamDist(x, z);
    if (sd < STREAM_HALF + 1.4) h = lerp(h - streamDepth(x, z), h, smooth(STREAM_HALF - 0.3, STREAM_HALF + 1.4, sd));
    const pd = Math.hypot(x - POND.x, z - POND.z);
    if (pd < POND.r + 2) h = lerp(h - 1, h, smooth(POND.r - 0.5, POND.r + 2, pd));
    return h;
  }

  // Height on the actual 2m terrain triangles, rather than the smooth source surface.
  function meshGroundHeight(x, z) {
    const x0 = Math.floor((x + 125) / 2) * 2 - 125, z0 = Math.floor((z + 125) / 2) * 2 - 125;
    const u = (x - x0) / 2, v = (z - z0) / 2;
    const a = ground(x0, z0), b = ground(x0 + 2, z0), c = ground(x0, z0 + 2);
    return u + v <= 1 ? a * (1 - u - v) + b * u + c * v
      : b * (1 - v) + c * (1 - u) + ground(x0 + 2, z0 + 2) * (u + v - 1);
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
    const half = 3.3 + riverExtra(run.x, run.z); const ends = // v1.10.47: longer over the widened river
      (land(run.x - ux * half, run.z - uz * half) + land(run.x + ux * half, run.z + uz * half)) / 2;
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
  // v1.10.42 낚시: the pier, the breakwater, or the shore's edge by the water (not the cliffs) -- where a cast may start
  function canFish(x, z) {
    if (!walkable(x, z)) return false;
    if (inRect(PIER, x, z, 0.2) || inRect(BREAKWATER, x, z, 0.2)) return true;
    return coastDist(x, z) < 5 && cliffAt(x, z) < 0.35 && !onBridge(x, z);
  }
  const ISLAND_RADIUS = 130; // the server's outer bound for positions

  // --- building the scene -----------------------------------------------------------------------------------------------


  // v1.10.11: the seeded nature of the island (moved from island.js unchanged, same seed and order): trees, flowers,
  // bushes, grass tufts, shore rocks, cliff fence posts and lamps. Computed once, on first use, by both the browser
  // (which draws them) and the server (which keeps events off them).
  let natureCache = null; const treeBlocks = []; // v1.10.47: places a tree must not stand (under the train's rail)
  function addTreeBlock(fn) { treeBlocks.push(fn); natureCache = null; }
  const natureBlocks = [];
  function addNatureBlock(fn) { natureBlocks.push(fn); natureCache = null; }
  function nature() {
    if (natureCache) return natureCache;
    let seed = 0x1a2b3c;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const clearOf = (x, z, walkGap) => {
      if (!walkable(x, z) || coastDist(x, z) < 6) return false;
      if (Math.hypot(x, z) < PLAZA_R + 7) return false;
      if (walkDist(x, z) < walkGap || streamDist(x, z) < STREAM_HALF + 2) return false;
      if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 2.5 || Math.hypot(x, z + 44) < 11) return false;
      for (const s of BUILDINGS) if (s.kind !== 'townhall' && Math.hypot(x - s.x, z - s.z) < (s.kind === 'hall' ? 13 : 7)) return false;
      if (inTownhall(x, z, 4)) return false; // v1.10.41
      if (treeBlocks.some((fn) => fn(x, z))) return false; // v1.10.47 (island-train.js)
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
    // v1.10.41: never in front of a facility's door (a weed there would take its SPACE): 3.5 and 6 m out along its face
    const fronts = Object.values(SPOTS).flatMap((sp) => { const dx = sp.face[0] - sp.x; const dz = sp.face[1] - sp.z; const l = Math.hypot(dx, dz) || 1; return [3.5, 6].map((d) => ({ x: sp.x + (dx / l) * d, z: sp.z + (dz / l) * d })); });
    const tufts = [];
    for (let tries = 0; tufts.length < 1400 && tries < 9000; tries += 1) {
      const a = rnd() * TAU; const r = PLAZA_R + 5 + rnd() * 85; const x = Math.cos(a) * r; const z = Math.sin(a) * r;
      if (walkable(x, z) && coastDist(x, z) > 7 && walkDist(x, z) > 0.4 && PADS.every((p) => Math.hypot(x - p.x, z - p.z) > p.r) && !inTownhall(x, z, 3) && fronts.every((f) => Math.hypot(x - f.x, z - f.z) > 4)) tufts.push({ x, z, s: 0.6 + rnd() * 0.7, r: rnd() * 6 });
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
    // Remove only obstructing props, retaining the original seeded positions of all remaining scenery.
    for (const key of Object.keys(natureCache)) natureCache[key] = natureCache[key].filter(p => !natureBlocks.some(fn => fn(p.x, p.z, p.s || 1)));
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
    // v1.10.44 앉기: a seat on each bench, facing the way the bench does. v1.10.45: one, in the middle -- a sitting
    // character is 1.06 m across with its arms and the bench 1.56 m between its armrests, so two always overlapped (and
    // the outer hands went into the armrests). v1.10.46: 0.18 forward of the bench's middle (was 0.08) -- the back of the
    // bench 0.40 behind the hips, so a cape (0.31-0.41 behind them seated) clears it; still on the seat, knees past its edge
    const seats = benches.map((b, k) => { const ry = Math.atan2(-b.x, -b.z); return { id: `b${k}`, x: b.x + Math.sin(ry) * 0.18, z: b.z + Math.cos(ry) * 0.18, yaw: ry }; });
    return { benches, lamps, beds, seats };
  }
  // Things a character walks around, with their radius (the same circles the browser uses).
  // A small deterministic subset; both server and renderer use the same trunk and approach.
  let harvestNature = null; let harvestCache = null;
  function harvestTrees() {
    const n = nature(); if (harvestNature === n) return harvestCache;
    const out = [];
    for (const t of n.trees) {
      const p = { x: t.x, z: t.z + 0.685 };
      if (Math.hypot(p.x,p.z)<PLAZA_R+4) continue;
      if (!walkable(p.x, p.z) || walkDist(p.x, p.z) < 1.5 || streamDist(p.x, p.z) < STREAM_HALF + 2 || inTownhall(p.x, p.z, 3)) continue;
      if (n.trees.some(o => o !== t && Math.hypot(p.x - o.x, p.z - o.z) < 0.75 * o.s + 0.91) || n.bushes.some(o => Math.hypot(p.x - o.x, p.z - o.z) < 0.75 * o.s + 0.91)) continue;
      if (BUILDINGS.some(b => b.kind !== 'townhall' && Math.hypot(p.x-b.x,p.z-b.z)<(b.kind === 'hall' ? 14 : 7)) || STATUE_SPOTS.some(b => Math.hypot(p.x-b.x,p.z-b.z)<3) || n.lampSpots.some(b => Math.hypot(p.x-b.x,p.z-b.z)<1.2)) continue;
      if (out.some(o => Math.hypot(t.x - o.x, t.z - o.z) < 14)) continue;
      out.push({ x: t.x, z: t.z, s: 1, yaw: -Math.atan2(0.515, 0.53), approach: p });
      if (out.length === 20) break;
    }
    harvestNature = n; harvestCache = out; return out;
  }
  function natureSolids() {
    const n = nature();
    const harvest = harvestTrees();
    return [...n.trees.map((t) => ({ x: t.x, z: t.z, r: harvest.some(h => h.x === t.x && h.z === t.z) ? 0.2 : 0.75 * t.s })), ...n.bushes.map((b) => ({ x: b.x, z: b.z, r: 0.75 * b.s })), ...n.lampSpots.map((p) => ({ x: p.x, z: p.z, r: 0.3 }))];
  }

  // --- seasons (v1.10.27 게임 아일랜드 4계절 동시 존재·일일 회전, 사용자 결정 2026-10-05) ----------------------------
  // All four seasons are on the island at once, one per zone; at 00:00 Asia/Seoul every season moves one zone
  // clockwise, so the same arrangement comes back every 4 days. Only which season a zone shows moves -- the ground,
  // its places, collision, paths, events and today's spot stay where they are. The central plaza (and its ramps) is
  // neutral, part of no season.
  // Zones: 0 north, 1 east, 2 south, 3 west (clockwise seen from above, north = -z). Their edges are not straight
  // lines: the angle is bent with the distance from the centre (so an edge curves across the island) and, thing by
  // thing, shifted a little by place (so neighbouring seasons mix over a few metres instead of meeting on a line).
  // Callers that draw the ground or plants by zone can use the same function and get the same edges.
  const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'];
  const SEASON_NEUTRAL_R = 24; // the plaza (16) and its ramps (to 22), with a little room
  const KST_MS = 9 * 3600 * 1000; const DAY_MS = 24 * 3600 * 1000; // Korea keeps no summer time
  const placeNoise = (x, z) => { const v = Math.sin(x * 12.9898 + z * 78.233 + 11.3) * 43758.5453; return v - Math.floor(v); };
  function seasonZoneAt(x, z) {
    const r = Math.hypot(x, z);
    if (r < SEASON_NEUTRAL_R) return -1;
    const th = Math.atan2(x, -z) + 0.34 * Math.sin(r * 0.045 + 1.1) + 0.16 * Math.sin(r * 0.11 + 2.3) + (placeNoise(x, z) - 0.5) * 0.24;
    return ((Math.floor((th + Math.PI / 4) / (Math.PI / 2)) % 4) + 4) % 4;
  }
  // days since 1970-01-01 in Seoul: the rotation step (changes at 00:00 KST)
  const seasonDay = (ms) => Math.floor((ms + KST_MS) / DAY_MS);
  // the season a zone shows on a day (null for the neutral plaza): zone k has season k on days divisible by 4, and a
  // season in zone k today is in zone k+1 tomorrow
  const zoneSeason = (zone, day) => (zone < 0 ? null : SEASON_ORDER[(((zone - day) % 4) + 4) % 4]);
  const seasonAt = (x, z, ms) => zoneSeason(seasonZoneAt(x, z), seasonDay(ms));

  // v1.10.38 10월 할로윈 (v1.10.46: shared, so its edges are tested): October in Asia/Seoul, by the server's clock
  const isHalloween = (ms) => new Date(ms + 9 * 3600 * 1000).getUTCMonth() === 9;
  return { facilityDoor, harvestTrees, addNatureBlock, addTreeBlock, RIVER_WIDE, riverExtra, isHalloween, canFish, TOWNHALL, townhallLocal, townhallWorld, inTownhall, inTownhallYard, SEASON_ORDER, SEASON_NEUTRAL_R, seasonZoneAt, seasonDay, zoneSeason, seasonAt, nature, natureSolids, plazaProps, coastR, PLAZA_R, AREAS, SPOTS, COTTAGES, BUILDINGS, RESERVED_LOTS, STATUE_SPOTS, SPAWN, heightAt, walkable, ISLAND_RADIUS, TAU, wrap, smooth, lerp, coastDist, cliffAt, PLAZA_H, POND, STREAMS, STREAM_HALF, streamCurves, streamDepth, streamWaterHeight, walkCurves, segDist, lineDist, streamDist, walkDist, rawLand, PADS, land, ground, meshGroundHeight, bridges, onBridge, deckAt, bayR, PIER, BREAKWATER };
}));
