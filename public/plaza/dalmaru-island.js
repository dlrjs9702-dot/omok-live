// 달마루섬 개편 (gamecenter-notes docs/dalmaru-implementation-20261019.md, 확정 순서 2026-10-19): the island API
// (island-terrain.js's names) on the new crescent island -- the ground, water, walking, bridges, seasons and nature from
// dalmaru-terrain.js (assets 54). Only for the administrator's preview (island-map.js sets GC_ISLAND_MAP): everyone
// else, and the server, keep island-terrain.js. Step 1 laid the land; step 2 the walks and what stands on them, all
// from dalmaru-terrain's one table PLACES (the structures are assets 55). What the server places (islanders, events,
// statues, plants, the train) stays off until the server reads this island too (step 5): TERRAIN_ONLY.
(function (root) {
  if (root.GC_ISLAND_MAP !== 'dalmaru' || !root.DalmaruTerrain || !root.IslandTerrain) return;
  const D = root.DalmaruTerrain; const C = root.IslandTerrain;
  const { TAU, smooth, lerp, catmull, lineDist } = C;
  const SEA = D.SEA; const P = D.PLAZA; const PL = D.PLACES;
  const PLAZA_C = { x: P.x, z: P.z }; // 대청마당's middle (the fountain)
  const rad = (a) => (a * Math.PI) / 180;
  const inPlaza = (x, z, m = 0) => Math.abs(x - P.x) < P.hw + m && z > P.d0 - m && z < P.d1 + m;
  const yawTo = (x, z, f) => Math.atan2(x - f[0], z - f[1]); // a model whose front is -Z, turned so it looks at f

  // ---- what stands (PLACES) ----
  // the fronts against 영웅마루 (관공서, 백화점): x, z on the cliff's foot, the front toward the island's middle
  const facade = (p) => ({ x: p.x, z: p.z, face: [p.x * 0.5, p.z * 0.5] });
  const NC = PL.notice; const court = (deg, r = 6) => ({ x: NC.x + r * Math.cos(rad(deg)), z: NC.z + r * Math.sin(rad(deg)), face: [NC.x, NC.z] }); // 알림마루: round its little court
  const spot = (p, kind, extra) => ({ x: p.x, z: p.z, face: p.face, kind, ...extra });
  const SPOTS = {
    games: { ...PL.gamehall, face: [PL.gamehall.x - 16, PL.gamehall.z], kind: 'hall', wall: 0xffe3b3, roof: 0xf08a6b }, // 대청마당 동쪽 바로 옆
    records: spot(PL.records, 'house', { wall: 0xf3e2ff, roof: 0x9b7fd6 }), missions: spot(PL.missions, 'board', { tint: 0x8fd18a }),
    store: { ...facade(PL.facadeMall), kind: 'facade' }, townhall: { ...facade(PL.facadeTownhall), kind: 'facade' },
    board: { ...court(180), kind: 'board' }, map: { ...court(225), kind: 'mapboard' }, attendance: { ...court(270), kind: 'npc' }, donate: { ...court(135), kind: 'donation' },
    chat: spot(PL.chat, 'gazebo'), climb: spot(PL.climb, 'tower'), admin: spot(PL.admin, 'office', { wall: 0xe4e7ec, roof: 0x7b8794 }),
    trader: spot(PL.trader, 'stall'), naming: spot(PL.naming, 'desk'),
  };
  const FACADE = { w: 30, d: 4.6 }; // (assets 55 facade.*: 30 wide, 4.6 out from the cliff)
  function facilityDoor(id) {
    const s = SPOTS[id]; if (!s) return null;
    const depth = { hall: 10, tower: 6.4, house: 2.7, office: 2.7, board: 0.3, donation: 0.9, mapboard: 0.3, gazebo: 2.4, npc: 0.9, stall: 1.3, desk: 1.2, facade: FACADE.d }[s.kind];
    const distance = s.kind === 'facade' ? FACADE.d + 1.6 : Math.max(1.4, depth / 2 + 1.3) + (s.kind === 'hall' ? 2.6 : 0);
    const dx = s.face[0] - s.x; const dz = s.face[1] - s.z; const l = Math.hypot(dx, dz) || 1;
    return { x: s.x + (dx / l) * distance, z: s.z + (dz / l) * distance };
  }
  // 이웃골: the islanders' ten houses, five either side of its street, each facing it
  const [LA, LB] = PL.lane; const LL = Math.hypot(LB[0] - LA[0], LB[1] - LA[1]); const LN = [(LB[1] - LA[1]) / LL, -(LB[0] - LA[0]) / LL];
  const COTTAGES = [0.12, 0.31, 0.5, 0.69, 0.88].flatMap((t, i) => [-1, 1].map((s, j) => {
    const cx = LA[0] + (LB[0] - LA[0]) * t; const cz = LA[1] + (LB[1] - LA[1]) * t;
    return { x: cx + s * 8 * LN[0], z: cz + s * 8 * LN[1], face: [cx, cz], style: (i * 2 + j) % 9 };
  }));
  // what the islanders' errands and games stand by (island-terrain VILLAGE's names; each keeper beside its thing)
  const prop = (p, r, f = p.face) => Object.freeze({ x: p.x, z: p.z, yaw: f ? yawTo(p.x, p.z, f) : 0, r });
  const off = (p, dx, dz) => Object.freeze({ x: p.x + dx, z: p.z + dz });
  const RIVER2 = D.RIVERS[1].pts; const stoneYaw = Math.atan2(RIVER2[3][0] - RIVER2[2][0], RIVER2[3][1] - RIVER2[2][1]);
  const VILLAGE = Object.freeze({
    mural: prop(PL.mural, 2.4), easel: prop({ ...off(PL.mural, 3.4, -1.6), face: PL.mural.face }, 0.7), painter: off(PL.mural, 2.6, -2.8),
    busk: prop(PL.busk, 2.0), busker: off(PL.busk, -1.7, -1.2),
    stationmaster: off(PL.dock, 10000, 0), // (the train comes in step 4)
    lamps: Object.freeze(PL.hallLamps.map(([x, z]) => Object.freeze({ x, z, r: 0.4 }))), electrician: off({ x: PL.hallLamps[0][0], z: PL.hallLamps[0][1] }, -1.2, 1.9),
    toolbox: prop({ ...off({ x: PL.hallLamps[0][0], z: PL.hallLamps[0][1] }, -2.1, 2.6), face: [PLAZA_C.x, PLAZA_C.z] }, 0.4),
    stones: Object.freeze({ ...PL.stones, yaw: stoneYaw }), builder: off(PL.stones, 4.2, -2),
    bookcart: prop(PL.bookcart, 0.8), librarian: off(PL.bookcart, 2.1, -1.1),
    omokTable: prop(PL.omokTable, 1.4), grandpa: off(PL.omokTable, -0.1, 2.8),
    mailbox: prop(court(315), 0.5), guide: prop({ ...court(0), face: [PL.spawn.x, PL.spawn.z] }, 0.45), birthday: prop(PL.birthday, 0.3),
  });
  const villageSolids = () => [VILLAGE.mural, VILLAGE.easel, VILLAGE.busk, ...VILLAGE.lamps, VILLAGE.toolbox, VILLAGE.bookcart, VILLAGE.omokTable, VILLAGE.mailbox, VILLAGE.guide, MUSEUM];
  const MUSEUM = Object.freeze({ ...PL.museum, yaw: yawTo(PL.museum.x, PL.museum.z, [100, 46]), r: 5 }); // (its door toward 잔치마루's walk)
  const FARM = Object.freeze({ ...PL.farm, w: 8, d: 5, farmer: off(PL.farm, 4.6, -2.8), sign: off(PL.farm, -5.4, -0.9) });
  const CONTEST_STATUE = Object.freeze({ ...PL.contest }); // (step 3 carves the winner into 영웅마루 instead)

  // ---- the walks ----
  const bayAt = (a, r = 101) => [Math.round(r * Math.cos(rad(a)) * 10) / 10, Math.round((D.BAY_Z + r * Math.sin(rad(a))) * 10) / 10];
  const arc = (a0, a1, step = 6) => { const n = Math.max(1, Math.round(Math.abs(a1 - a0) / step)); return Array.from({ length: n + 1 }, (_, k) => bayAt(a0 + ((a1 - a0) * k) / n)); };
  const doorPt = (id) => { const d = facilityDoor(id); return [d.x, d.z]; };
  // tier: 'town' (대청마당 round and 물가 거리 before it), 'walk' (the arms, the bridges, 잔치마루), 'trail' (푸른숲골)
  const WALKS = [
    { tier: 'town', w: 3.2, pts: [[0, -54], [0.6, -30], [0, -8]] }, // 대청마당 → 물가 거리 (배 타는 곳)
    { tier: 'town', w: 3.2, pts: arc(234, 306) }, // 물가 거리, before 대청마당
    { tier: 'walk', w: 2.8, pts: [...arc(234, 156), [-88, 140]] }, // 물가 거리 → the west arm → its cape (초승등대)
    { tier: 'walk', w: 2.8, pts: [...arc(306, 384), [88, 140], [94, 146]] }, // → the east arm → its cape (달끝나루)
    { tier: 'walk', w: 3, pts: [[-88, 140], [-80, 140], [-55, 140], [-30, 140], [-12, 141.5], [12, 141.5], [30, 140], [55, 140], [80, 140], [88, 140]] }, // 윤슬다리 · 툇마루섬 · 윤슬다리
    { tier: 'town', w: 3, pts: [[-44, -86], [-56, -93], doorPt('townhall'), [-79, -95], [-84, -92]] }, // → 관공서 → the ridge's stairs
    { tier: 'town', w: 3, pts: [[44, -86], [56, -93], doorPt('store')] }, // → 백화점
    { tier: 'walk', w: 2.8, pts: [[-42, -66], LA, [(LA[0] + LB[0]) / 2, (LA[1] + LB[1]) / 2], LB, [-80, 16], [-84, 34]] }, // 이웃골 → the west arm's shore
    { tier: 'trail', w: 2.4, pts: [[-70, -8], [-82, -2], [-96, 0], [-110, 2], [-122, -6], doorPt('climb')] }, // 푸른숲골: the gazebo, 거울호수, the river, 등반탑
    { tier: 'trail', w: 2.4, pts: [[-122, -6], [-131, 12], [-133, 32], [-128, 43]] }, // → the farm
    { tier: 'walk', w: 2.8, pts: [[44, -60], [66, -48], [88, -30], [104, -6], [116, 12], [112, 34], [100, 46], [96, 60]] }, // 잔치마루: the contest square, the museum
  ];
  const walkCurves = WALKS.map((w) => ({ w: w.w, tier: w.tier, pts: catmull(w.pts, 0.8) }));
  const walkDist = (x, z) => { let d = Infinity; for (const w of walkCurves) d = Math.min(d, lineDist(x, z, w.pts) - w.w / 2); return d; };

  // ---- the ground: dalmaru-terrain's, levelled under what stands and filled where the stairs meet the ridge ----
  const BUILDINGS = [...Object.values(SPOTS), ...COTTAGES.map((c) => ({ ...c, kind: 'cottage' }))];
  const PADS = [[PL.gamehall.x, PL.gamehall.z, 10], [MUSEUM.x, MUSEUM.z, 6.5], [PL.contest.x, PL.contest.z, 10], [FARM.x, FARM.z, 6], ...COTTAGES.map((c) => [c.x, c.z, 4.6]),
    ...Object.values(SPOTS).filter((s) => s.kind !== 'facade' && s.kind !== 'hall' && !inPlaza(s.x, s.z)).map((s) => [s.x, s.z, s.kind === 'tower' ? 4.5 : 3.5])]
    .map(([x, z, r]) => ({ x, z, r, h: D.landHeight(x, z) }));
  // 능선 계단 (assets 55 stairs.ridge): three flights of 7 m (9.52 m each) and two 3 m landings along the chord from its
  // foot to its top, against the cliff (its treads 0.2-3.2 m out from it)
  const SF = PL.stairs.from; const ST = PL.stairs.to; const SL = 34.56;
  const SU = [(ST.x - SF.x) / Math.hypot(ST.x - SF.x, ST.z - SF.z), (ST.z - SF.z) / Math.hypot(ST.x - SF.x, ST.z - SF.z)];
  const SN = [SU[1], -SU[0]]; // across the chord, out from the cliff (toward the middle)
  const STAIRS = { x: SF.x, z: SF.z, ux: SU[0], uz: SU[1], nx: SN[0], nz: SN[1], len: SL, w0: 0.2, w1: 3.2, base: D.landHeight(SF.x, SF.z) };
  const stairRise = (u) => (u < 9.52 ? 7 * u / 9.52 : u < 12.52 ? 7 : u < 22.04 ? 7 + 7 * (u - 12.52) / 9.52 : u < 25.04 ? 14 : 14 + 7 * Math.min(1, (u - 25.04) / 9.52));
  function onStairs(x, z) {
    const dx = x - STAIRS.x; const dz = z - STAIRS.z; const u = dx * STAIRS.ux + dz * STAIRS.uz; const v = dx * STAIRS.nx + dz * STAIRS.nz;
    return u >= 0 && u <= STAIRS.len + 0.4 && v >= STAIRS.w0 - 0.1 && v <= STAIRS.w1 ? { u, v } : null;
  }
  const TOP = { x: ST.x + STAIRS.nx * 1.7 + STAIRS.ux * 0.4, z: ST.z + STAIRS.nz * 1.7 + STAIRS.uz * 0.4, h: STAIRS.base + 21 }; // the top landing, run back onto the ridge
  function land(x, z) {
    let h = D.landHeight(x, z);
    for (const p of PADS) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r + 5) h = lerp(p.h, h, smooth(p.r, p.r + 5, d)); }
    // the fill from the stairs' top back to the ridge: 4 m wide, from the treads to 8 m into the ridge
    const dx = x - TOP.x; const dz = z - TOP.z; const along = dx * STAIRS.ux + dz * STAIRS.uz; const out = -(dx * STAIRS.nx + dz * STAIRS.nz);
    const edge = Math.max(Math.abs(along) - 2, -out - 1.5, out - 9); if (edge < 2) h = Math.max(h, lerp(TOP.h, h, smooth(0, 2, edge)));
    return h;
  }
  const ground = (x, z) => D.ground(x, z) + (land(x, z) - D.landHeight(x, z)); // (no pad or fill is near water)
  const isWater = (x, z) => ground(x, z) < SEA;
  const slopeAt = (x, z) => Math.hypot(ground(x + 1, z) - ground(x - 1, z), ground(x, z + 1) - ground(x, z - 1)) / 2;

  // ---- bridges: 윤슬다리 (its arched deck the model's), and a plain one wherever a walk crosses a river ----
  const YB = { rise: 3.2, top: 0.43 }; // the model's deck: rise * sin(πt) over its ends, its planks' top 0.43 over that
  const bridges = D.BRIDGES.map((b) => {
    const ends = b.ends.map(([x, z]) => D.ground(x, z));
    return { x: b.x, z: b.z, ux: 1, uz: 0, half: b.length / 2, w: 5.6, arch: YB.rise, base: Math.max(...ends, SEA) - YB.top + 0.12, get deck() { return this.base + YB.top; }, model: 'dalmaru.bridge_yunseul' };
  });
  for (const walk of walkCurves) {
    let run = null;
    const add = () => {
      const a = walk.pts[Math.max(0, run.i - 2)]; const b = walk.pts[Math.min(walk.pts.length - 1, run.i + 2)]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const ux = (b[0] - a[0]) / l; const uz = (b[1] - a[1]) / l; const half = 6;
      const ends = [D.ground(run.x - ux * half, run.z - uz * half), D.ground(run.x + ux * half, run.z + uz * half)];
      if (!bridges.some((o) => Math.hypot(o.x - run.x, o.z - run.z) < 6)) bridges.push({ x: run.x, z: run.z, ux, uz, half, w: Math.max(2.6, walk.w), deck: Math.max(...ends, SEA + 0.6) + 0.1 });
      run = null;
    };
    walk.pts.forEach(([x, z], i) => { const d = D.riverDist(x, z); if (d < 0.8) { if (!run || d < run.d) run = { d, i, x, z }; } else if (run) add(); });
    if (run) add();
  }
  function onBridge(x, z) {
    for (const b of bridges) {
      const dx = x - b.x; const dz = z - b.z; const u = dx * b.ux + dz * b.uz; const v = -dx * b.uz + dz * b.ux;
      if (Math.abs(u) <= b.half && Math.abs(v) <= b.w / 2) return { b, u };
    }
    return null;
  }
  const deckAt = (hit) => (hit.b.arch ? hit.b.base + YB.top + hit.b.arch * Math.sin((Math.PI * (hit.u + hit.b.half)) / (2 * hit.b.half)) : hit.b.deck + 0.35 * (1 - (hit.u / hit.b.half) ** 2));
  // 달끝나루 (assets 55 pier.dalkkeut: 20 m out from its root, deck top 0.69 over it) straight out from the east cape, and
  // 배 타는 곳 (dock.boat) off 물가 거리 before 대청마당 -- both walked on
  const CAPE = D.CAPES[1]; const pierL = Math.hypot(PL.pier.x - CAPE.x, PL.pier.z - CAPE.z);
  const PIER_DIR = [(PL.pier.x - CAPE.x) / pierL, (PL.pier.z - CAPE.z) / pierL];
  const pierY = Math.max(SEA, D.ground(PL.pier.x, PL.pier.z)) - 0.5; // (its deck a step over the beach at its root)
  const PIER = { x: PL.pier.x + PIER_DIR[0] * 10, z: PL.pier.z + PIER_DIR[1] * 10, ux: PIER_DIR[0], uz: PIER_DIR[1], half: 10, w: 3.6, deck: pierY + 0.69, root: { x: PL.pier.x, z: PL.pier.z, y: pierY, yaw: Math.atan2(PIER_DIR[0], PIER_DIR[1]) } }; // (its front, the far end, out to sea)
  // (dock.boat: a 12 x 3 m float, its gangway 4.2 m back to the shore -- the model's -Z, here north)
  const DOCK = { x: PL.dock.x, z: PL.dock.z - 2, root: { x: PL.dock.x, z: PL.dock.z - 2, y: 0, yaw: 0 },
    rects: [{ x: PL.dock.x, z: PL.dock.z - 2, ux: 1, uz: 0, half: 6, w: 3, deck: 0.15 }, { x: PL.dock.x, z: PL.dock.z - 5.6, ux: 0, uz: 1, half: 2.3, w: 1.6, deck: 0.3 }] };
  const onDock = (x, z, grow = 0) => DOCK.rects.find((r) => inRect(r, x, z, grow));
  const inRect = (r, x, z, grow = 0) => { const dx = x - r.x; const dz = z - r.z; return Math.abs(dx * r.ux + dz * r.uz) <= r.half + grow && Math.abs(-dx * r.uz + dz * r.ux) <= r.w / 2 + grow; };

  function heightAt(x, z) {
    const hit = onBridge(x, z); if (hit) return deckAt(hit);
    const st = onStairs(x, z); if (st) return Math.max(STAIRS.base + stairRise(st.u), ground(x, z));
    if (inRect(PIER, x, z)) return PIER.deck;
    const dock = onDock(x, z); if (dock) return dock.deck;
    return Math.max(ground(x, z), SEA);
  }
  const walkable = (x, z) => Boolean(onBridge(x, z) || onStairs(x, z) || inRect(PIER, x, z) || onDock(x, z)) || (!isWater(x, z) && slopeAt(x, z) < 0.9 && D.coastDist(x, z) > 1.2);
  // the cliff faces and the ridge's sea cliffs read as rock
  const cliffAt = (x, z) => Math.min(1, D.ridgeAt(x, z) * smooth(0.25, 0.9, D.slopeAt(x, z)) + (D.ridgeAt(x, z) > 0.3 ? smooth(20, 4, D.coastDist(x, z)) : 0));
  // fishing: a walkable spot with water within 2.4 m -- the sea (and 윤슬만) or fresh water (the lake, rivers, pools)
  function fishWater(x, z) {
    if (!walkable(x, z) || onBridge(x, z) || onStairs(x, z)) return null;
    if (inRect(PIER, x, z, 0.2) || onDock(x, z, 0.2)) return 'sea';
    for (const [dx, dz] of [[2.4, 0], [-2.4, 0], [0, 2.4], [0, -2.4]]) {
      const wx = x + dx; const wz = z + dz; if (!isWater(wx, wz)) continue;
      return D.coastDist(wx, wz) < 0 ? 'sea' : 'river';
    }
    return null;
  }
  const SIZE = 380; const SEG = 152; const STEP = SIZE / SEG; const HALF = SIZE / 2; // the ground mesh: 2.5 m (step 1; the far rings come with the phone check)
  function meshGroundHeight(x, z) {
    const x0 = Math.floor((x + HALF) / STEP) * STEP - HALF; const z0 = Math.floor((z + HALF) / STEP) * STEP - HALF;
    const u = (x - x0) / STEP; const v = (z - z0) / STEP;
    const a = ground(x0, z0); const b = ground(x0 + STEP, z0); const c = ground(x0, z0 + STEP);
    return u + v <= 1 ? a * (1 - u - v) + b * u + c * v : b * (1 - v) + c * (1 - u) + ground(x0 + STEP, z0 + STEP) * (u + v - 1);
  }
  // 계절 구역 4곳 (dalmaru-terrain); 대청마당 stays the island's own green like the old plaza
  const seasonZoneAt = (x, z) => (inPlaza(x, z) ? -1 : D.seasonZoneAt(x, z));
  const seasonAt = (x, z, ms) => C.zoneSeason(seasonZoneAt(x, z), C.seasonDay(ms));

  // 물가 거리's railing, lamps and benches (assets 55) along the water before 대청마당, open where the walk comes down to
  // 배 타는 곳; a rail every 4.2 m on the shore side of the walk, a lamp every third, a bench (facing the water) between
  const WATERFRONT = (() => {
    const rails = []; const lamps = []; const benches = [];
    const r = D.R_BAY + 3.4; const step = (4.2 / r) * (180 / Math.PI);
    for (let a = 236, k = 0; a <= 304; a += step, k += 1) {
      if (Math.abs(a - 270) < 5) continue; // (the way down to the dock)
      const [x, z] = bayAt(a, r); const yaw = -(rad(a) + Math.PI / 2); // (its length along the shore)
      rails.push({ x, z, yaw });
      if (k % 3 === 1) { const [lx, lz] = bayAt(a, r + 1.2); lamps.push({ x: lx, z: lz, r: 0.3 }); }
      if (k % 6 === 4) { const [bx, bz] = bayAt(a, r + 2.6); benches.push({ x: bx, z: bz, yaw: Math.atan2(-bx, D.BAY_Z - bz), r: 0.9 }); } // (a bench's +Z, its front, toward the water)
    }
    return { rails, lamps, benches };
  })();
  const STRUCTURES = { // the pieces of assets 55 that stand once (plaza-scene draws them; solids are theirs)
    lighthouse: { ...PL.lighthouse, r: 3.2 }, pier: PIER.root, dock: DOCK.root, stairs: { x: SF.x, z: SF.z, yaw: Math.atan2(STAIRS.nx, STAIRS.nz), base: STAIRS.base }, // (its model, turned, runs along local -x: the chord)
  };

  // 대청마당's own things round its fountain: benches facing it, lamps on a ring, flower beds (island-terrain's plazaProps,
  // centred on 대청마당); the 민원실's seats and windows are the same room as now
  function plazaProps() {
    const busy = (x, z, gap) => Object.values(SPOTS).some((s) => Math.hypot(s.x - x, s.z - z) < gap);
    const at = (a, r) => ({ x: PLAZA_C.x + Math.cos(a) * r, z: PLAZA_C.z + Math.sin(a) * r });
    const benches = [0.38, -0.38, Math.PI - 0.38, Math.PI + 0.38].map((a) => ({ ...at(a, 5), r: 0.9 }));
    const lamps = [];
    for (let k = 0; k < 8; k += 1) { const p = at(Math.PI / 8 + (k * Math.PI) / 4, 12); if (!busy(p.x, p.z, 3)) lamps.push({ ...p, r: 0.35 }); }
    const beds = [];
    for (let i = 0; i < 12; i += 1) { const p = at(Math.PI / 4 + ((i % 4) * Math.PI) / 2 + (i < 4 ? 0.3 : i < 8 ? -0.3 : 0.62), 13.8); if (!busy(p.x, p.z, 3.4)) beds.push({ ...p, r: 1.1, i }); }
    const seats = benches.map((b, k) => { const ry = Math.atan2(PLAZA_C.x - b.x, PLAZA_C.z - b.z); return { id: `b${k}`, x: b.x + Math.sin(ry) * 0.18, z: b.z + Math.cos(ry) * 0.18, yaw: ry }; });
    seats.push(...C.plazaProps().seats.filter((s) => s.room));
    return { benches, lamps, beds, seats };
  }

  // nature: woods on the west arm (푸른숲골), round the lake and on the ridge's back, trees scattered over the fields,
  // flowers, bushes, grass, shore rocks -- seeded, the same on every screen, clear of the walks and what stands
  let natureCache = null;
  function nature() {
    if (natureCache) return natureCache;
    let seed = 0x5a1d0e; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const R = D.R_OUT + 5;
    const built = (x, z) => BUILDINGS.some((b) => Math.hypot(x - b.x, z - b.z) < (b.kind === 'facade' ? 18 : b.kind === 'hall' ? 13 : 7))
      || PADS.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + 1.5) || onStairs(x, z) || Math.hypot(x - TOP.x, z - TOP.z) < 6
      || Math.hypot(x - PL.lighthouse.x, z - PL.lighthouse.z) < 6 || Math.hypot(x - PL.pier.x, z - PL.pier.z) < 6 || Math.hypot(x - PL.dock.x, z - PL.dock.z) < 8
      || villageSolids().some((v) => Math.hypot(x - v.x, z - v.z) < v.r + 2) || D.PLACES.niches.some((n) => Math.hypot(x - n.x, z - n.z) < n.m * 0.4 + 2);
    const clearOf = (x, z) => walkable(x, z) && D.coastDist(x, z) > 5 && slopeAt(x, z) < 0.35 && D.riverDist(x, z) > 2.5 && D.lakeDist(x, z) > 3
      && !inPlaza(x, z, 4) && !onBridge(x, z) && walkDist(x, z) > 1.6 && !built(x, z);
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
    for (let tries = 0; tufts.length < 2200 && tries < 14000; tries += 1) { const x = (rnd() * 2 - 1) * R; const z = (rnd() * 2 - 1) * R; if (walkable(x, z) && D.coastDist(x, z) > 7 && slopeAt(x, z) < 0.5 && walkDist(x, z) > 0.5 && !inPlaza(x, z, 1)) tufts.push({ x, z, s: 0.6 + rnd() * 0.7 }); }
    const rocks = [];
    for (let tries = 0; rocks.length < 160 && tries < 8000; tries += 1) {
      const x = (rnd() * 2 - 1) * R; const z = (rnd() * 2 - 1) * R; const cd = D.coastDist(x, z);
      if (cd > -1 && cd < 4 && !D.inBay(x, z) && !built(x, z) && !onBridge(x, z)) rocks.push({ x, z, s: 0.5 + rnd() * (D.ridgeAt(x, z) > 0.3 ? 1.6 : 0.8), r: rnd() * 6 });
    }
    natureCache = { trees, flowers, bushes, tufts, rocks, posts: [], lampSpots: [] };
    return natureCache;
  }
  const natureSolids = () => [...nature().trees.map((t) => ({ x: t.x, z: t.z, r: 0.55 * t.s })), ...nature().rocks.filter((r) => r.s > 0.9).map((r) => ({ x: r.x, z: r.z, r: 0.45 * r.s }))];
  const AREAS = Object.fromEntries([['plaza', { x: P.x, z: P.z, label: D.NAMES.plaza }], ['notice', { ...PL.notice, label: D.NAMES.notice }], ['village', { ...PL.village, label: D.NAMES.village }],
    ['west', { x: -120, z: 10, label: D.NAMES.west }], ['lake', { x: D.LAKE.x, z: D.LAKE.z, label: D.NAMES.lake }], ['east', { x: 115, z: 20, label: D.NAMES.east }],
    ['isle', { x: D.ISLE.x, z: D.ISLE.z, label: D.NAMES.isle }], ['bay', { x: 0, z: 60, label: D.NAMES.bay }], ['ridge', { x: 0, z: -146, label: D.NAMES.ridge }]]);

  root.IslandTerrain = Object.freeze({
    ...C,
    MAP: 'dalmaru', TERRAIN_ONLY: true, GROUND: { size: SIZE, seg: SEG }, PLAZA_C, inPlaza,
    coastR: () => D.R_OUT, coastDist: D.coastDist, cliffAt, rawLand: D.landHeight, land, ground, meshGroundHeight, heightAt, walkable,
    streamDist: () => Infinity, walkDist, STREAMS: [], streamCurves: [], walkCurves, RIVER_WIDE: { pts: [] }, riverExtra: () => 0,
    streamDepth: () => 0, streamWaterHeight: () => SEA, POND: { x: 1e5, z: 1e5, r: 0 }, PADS,
    bridges, onBridge, deckAt, onStairs, STAIRS, PIER, DOCK, BREAKWATER: { x: 1e5, z: 1e5, ux: 1, uz: 0, half: 0, w: 0, deck: 0 }, bayR: D.R_BAY,
    fishWater, canFish: (x, z) => fishWater(x, z) !== null, ISLAND_RADIUS: 200, SPAWN: { x: PL.spawn.x, z: PL.spawn.z }, PLAZA_R: 0, PLAZA_H: P.h,
    seasonZoneAt, seasonAt, nature, natureSolids, harvestTrees: () => [], AREAS, WATERFRONT, STRUCTURES, FACADE,
    SPOTS, facilityDoor, COTTAGES, BUILDINGS, RESERVED_LOTS: [], STATUE_SPOTS: [], plazaProps, villageSolids, inVillage: (x, z) => villageSolids().some((v) => Math.hypot(x - v.x, z - v.z) < v.r + 0.8),
    HALLOWEEN_FIELDS: [], HALLOWEEN_EXTRAS: [], dalmaru: D, VILLAGE, MUSEUM, FARM, CONTEST_STATUE,
    inTownhall: () => false, inTownhallYard: () => false,
  });
}(typeof self !== 'undefined' ? self : this));
