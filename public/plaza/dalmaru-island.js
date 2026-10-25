// 달마루섬 개편 (gamecenter-notes docs/dalmaru-implementation-20261019.md, 확정 순서 2026-10-19): the island API
// (island-terrain.js's names) on the new crescent island -- the ground, water, walking, bridges, seasons and nature from
// dalmaru-terrain.js (assets 54). Only for the administrator's preview (island-map.js sets GC_ISLAND_MAP): everyone
// else, and the server, keep island-terrain.js. Step 1 laid the land; step 2 the walks and what stands on them, all
// from dalmaru-terrain's one table PLACES (the structures are assets 55). What the server places (islanders, events,
// statues, plants, the train) stays off on the preview -- until the server reads this island too (step 5: `live`, the
// server's own island; TERRAIN_ONLY otherwise). The server builds it with island-terrain.js (ISLAND_MAP=dalmaru).
(function (root, build) {
  if (typeof module === 'object' && module.exports) { module.exports = build; return; }
  if (root.DalmaruTerrain && root.IslandTerrain) root.IslandTerrain = build(root.DalmaruTerrain, root.IslandTerrain); // (묶음 3: the only island)
}(typeof self !== 'undefined' ? self : this, (D, C) => {
  const { TAU, smooth, lerp, catmull, lineDist } = C;
  const SEA = D.SEA; const P = D.PLAZA; const PL = D.PLACES;
  const PLAZA_C = { x: P.x, z: P.z }; // 대청마당's middle (the fountain)
  // 묶음 4 내 집: 툇마루섬's twelve lots -- 2회차 15: laid out again on the isle widened toward 윤슬만 so that a 큰 집 (with
  // its veranda, 6.5 m round) stands 2 m clear of every walk, way, the pond, the station way and the other lots: by the walk
  // across the isle, a walk north from it and the station way; yaw: the house's front (-Z) square to its walk,
  // the walks below lead from each door to it (worked out once: gamecenter-notes docs/issue-log-review-20261021-b.md 15)
  const HOME_LOTS = Object.freeze([[-1.5, 172.5, -0.76], [19.5, 166.5, 0.73], [-1.5, 157, -2.24], [27, 150.5, 1.53], [-10, 108.5, -1.57], [-10, 123.5, -1.57], [10, 107.5, 1.57], [10, 122.5, 1.57], [-30.5, 150, -0.03], [-29, 130, 3.1], [28, 130, -3.09], [-15.5, 151.5, -0.07]].map(([x, z, yaw]) => Object.freeze({ x, z, yaw })));
  const onLot = (x, z, pad = 0) => HOME_LOTS.some((l) => Math.abs(x - l.x) < 5 + pad && Math.abs(z - l.z) < 5 + pad);
  // what a house takes (the 6 x 5 m house and its steps, a little round it, and in front of its door -- island-home's
  // doorOf: 4.6 m toward the walk across the isle at z 140.5); trees and rocks may stand on the rest of the lot
  const onHouse = (x, z) => HOME_LOTS.some((l) => { const a = l.yaw; const dx = l.x - Math.sin(a) * 6.9; const dz = l.z - Math.cos(a) * 6.9; return Math.hypot(x - l.x, z - l.z) < 6.2 || Math.hypot(x - dx, z - dz) < 2.5; }); // (묶음 4-2: room for the 큰 집, 11 x 10 m with its eaves, and its door 6.9 m out)
  const rad = (a) => (a * Math.PI) / 180;
  const inPlaza = (x, z, m = 0) => Math.abs(x - P.x) < P.hw + m && z > P.d0 - m && z < P.d1 + m;
  const yawTo = (x, z, f) => Math.atan2(x - f[0], z - f[1]); // a model whose front is -Z, turned so it looks at f

  // ---- what stands (PLACES) ----
  // the fronts against 영웅마루 (관공서, 백화점): x, z on the cliff's foot, the front toward the island's middle
  const facade = (p) => ({ x: p.x, z: p.z, face: [p.x * 0.5, p.z * 0.5] });
  // 알림마루 (묶음 5 배치 점검, 사용자 「갑자기 뜬금없이 모여 있어」): one row along 대청마당's west edge, 3 m apart, each facing
  // the plaza with 4 m clear before it -- 게시판·지도판·기부함·우체통, the 출석 islander at its end where 관리실's walk comes in
  const row = (k) => ({ x: -42.2, z: -65 - 3.4 * k, face: [-30, -65 - 3.4 * k] });
  const spot = (p, kind, extra) => ({ x: p.x, z: p.z, face: p.face, kind, ...extra });
  const SPOTS = {
    games: { ...PL.gamehall, face: [PL.gamehall.x - 16, PL.gamehall.z], kind: 'hall', wall: 0xffe3b3, roof: 0xf08a6b }, // 대청마당 동쪽 바로 옆
    records: spot(PL.records, 'house', { wall: 0xf3e2ff, roof: 0x9b7fd6 }), missions: spot(PL.missions, 'board', { tint: 0x8fd18a }),
    store: { ...facade(PL.facadeMall), kind: 'facade' }, townhall: { ...facade(PL.facadeTownhall), kind: 'facade' },
    board: { ...row(0), kind: 'board' }, map: { ...row(1), kind: 'mapboard' }, attendance: { ...row(4), kind: 'npc' }, donate: { ...row(2), kind: 'donation' },
    chat: spot(PL.chat, 'gazebo'), climb: spot(PL.climb, 'tower'), admin: spot(PL.admin, 'office', { wall: 0xe4e7ec, roof: 0x7b8794 }),
    jail: { ...PL.jail, face: [PL.jail.x, PL.jail.z + 10], kind: 'jail' }, // R4 구치소 (assets 67: 9.8 x 7.4 m; its door toward the camera -- the island's buildings never fade)
  };
  const FACADE = { w: 30, d: 4.6 }; // (assets 55 facade.*: 30 wide, 4.6 out from the cliff)
  function facilityDoor(id) {
    const s = SPOTS[id]; if (!s) return null;
    const depth = { hall: 10, tower: 6.4, house: 2.7, office: 2.7, board: 0.3, donation: 0.9, mapboard: 0.3, gazebo: 2.4, npc: 0.9, stall: 1.3, desk: 1.2, facade: FACADE.d, jail: 7.4 }[s.kind];
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
  // 거리 악단 자리 (PL.busk: the paved round's middle, facing the water): u toward the water, v across -- the stage at its
  // back, the busker before it, two benches facing it from the walk's side, a lamp beside it
  const BU = PL.busk; const BL = Math.hypot(BU.face[0] - BU.x, BU.face[1] - BU.z); const BF = [(BU.face[0] - BU.x) / BL, (BU.face[1] - BU.z) / BL];
  const buskAt = (u, v) => ({ x: Math.round((BU.x + BF[0] * u - BF[1] * v) * 10) / 10, z: Math.round((BU.z + BF[1] * u + BF[0] * v) * 10) / 10 });
  const STAGE = buskAt(-1.3, 0);
  const RIVER2 = D.RIVERS[1].pts; const stoneYaw = Math.atan2(RIVER2[3][0] - RIVER2[2][0], RIVER2[3][1] - RIVER2[2][1]);
  const VILLAGE = Object.freeze({
    mural: prop(PL.mural, 2.4), easel: prop({ ...off(PL.mural, 3.4, -1.6), face: PL.mural.face }, 0.7), painter: off(PL.mural, 2.6, -2.8),
    busk: prop({ ...STAGE, face: BU.face }, 1.5), busker: Object.freeze(buskAt(0.1, 0)),
    buskBenches: Object.freeze([-1, 1].map((s) => prop(buskAt(1.5, 2.1 * s), 0.9, [STAGE.x, STAGE.z]))), buskLamp: prop(buskAt(-1.3, 3), 0.3),
    stationmaster: Object.freeze({ ...PL.stationmaster }),
    lamps: Object.freeze(PL.hallLamps.map(([x, z]) => Object.freeze({ x, z, r: 0.4 }))), electrician: off({ x: PL.hallLamps[0][0], z: PL.hallLamps[0][1] }, -1.2, 1.9),
    toolbox: prop({ ...off({ x: PL.hallLamps[0][0], z: PL.hallLamps[0][1] }, -2.1, 2.6), face: [PLAZA_C.x, PLAZA_C.z] }, 0.4),
    stones: Object.freeze({ ...PL.stones, yaw: stoneYaw }), builder: off(PL.stones, 4.2, -2),
    bookcart: prop(PL.bookcart, 0.8), librarian: off(PL.bookcart, 2.1, -1.1),
    omokTable: prop(PL.omokTable, 1.4), grandpa: off(PL.omokTable, -0.1, 2.8),
    mailbox: prop(row(3), 0.5), guide: prop({ x: PL.spawn.x - 2, z: PL.spawn.z + 2, face: [PL.spawn.x, PL.spawn.z] }, 0.45), /* (the guide beside 첫 접속's spot) */ birthday: prop(PL.birthday, 0.3),
  });
  const villageSolids = () => [VILLAGE.mural, VILLAGE.easel, VILLAGE.busk, ...VILLAGE.buskBenches, VILLAGE.buskLamp, ...VILLAGE.lamps, VILLAGE.toolbox, VILLAGE.bookcart, VILLAGE.omokTable, VILLAGE.mailbox, VILLAGE.guide, MUSEUM];
  const MUSEUM = Object.freeze({ ...PL.museum, yaw: yawTo(PL.museum.x, PL.museum.z, [100, 46]), r: 5 }); // (its door toward 잔치마루's walk)
  // (문제 기록 3회차 15 「밭이 뜬금없어, 풍경과 유리. 밭 넓히고 컨셉 확실히」) a farm yard round the quest field: three more
  // plots beside it (2 x 2, 2 m between), a fence round them with its gate where the trail comes in (north), a tool shed
  // in the south-west corner and a scarecrow between the plots -- x across, z the field's own
  const FARM = Object.freeze({ ...PL.farm, w: 8, d: 5, farmer: off(PL.farm, 4.6, -2.8), sign: off(PL.farm, -5.4, -0.9),
    yard: Object.freeze({ x0: PL.farm.x - 8, x1: PL.farm.x + 16, z0: PL.farm.z - 6, z1: PL.farm.z + 12.5, gate: [PL.farm.x + 1.5, PL.farm.x + 6],
      plots: [[PL.farm.x + 10, PL.farm.z], [PL.farm.x, PL.farm.z + 7.5], [PL.farm.x + 10, PL.farm.z + 7.5]],
      shed: { x: PL.farm.x - 5, z: PL.farm.z + 9.8, w: 3, d: 2.5 }, scarecrow: { x: PL.farm.x + 5, z: PL.farm.z + 3.75 } }) });
  const inFarmYard = (x, z, m = 0) => { const y = FARM.yard; return x > y.x0 - m && x < y.x1 + m && z > y.z0 - m && z < y.z1 + m; };
  // the fence's line, every 0.7 m round the yard, the gate left open
  const farmFence = () => { const y = FARM.yard; const out = [];
    for (let x = y.x0; x <= y.x1 + 1e-6; x += 0.7) { if (x < y.gate[0] || x > y.gate[1]) out.push({ x, z: y.z0 }); out.push({ x, z: y.z1 }); }
    for (let z = y.z0 + 0.7; z < y.z1 - 1e-6; z += 0.7) { out.push({ x: y.x0, z }); out.push({ x: y.x1, z }); }
    return out; };
  const CONTEST_STATUE = Object.freeze({ ...PL.contest }); // (step 3 carves the winner into 영웅마루 instead)

  // ---- the walks ----
  const bayAt = (a, r = 101) => [Math.round(r * Math.cos(rad(a)) * 10) / 10, Math.round((D.BAY_Z + r * Math.sin(rad(a))) * 10) / 10];
  const arc = (a0, a1, step = 6) => { const n = Math.max(1, Math.round(Math.abs(a1 - a0) / step)); return Array.from({ length: n + 1 }, (_, k) => bayAt(a0 + ((a1 - a0) * k) / n)); };
  const doorPt = (id) => { const d = facilityDoor(id); return [d.x, d.z]; };
  const po = (deg, r) => [Math.round(r * Math.cos(rad(deg)) * 10) / 10, Math.round(r * Math.sin(rad(deg)) * 10) / 10];
  const STAIRS_TOP_DEG = Math.round(((((Math.atan2(PL.stairs.to.z, PL.stairs.to.x) * 180) / Math.PI) + 360) % 360) * 10) / 10; // (the stairs' top, where dalmaru-terrain puts it: what is laid out by it follows when they move)
  const stationPt = (deg, r) => po(deg, r); // (island-train's stops: its way in, 7 m inland of the lift)
  const stairsAt = (u, v) => { const F = PL.stairs.from; const T2 = PL.stairs.to; const l = Math.hypot(T2.x - F.x, T2.z - F.z); const ux = (T2.x - F.x) / l; const uz = (T2.z - F.z) / l; return [Math.round((F.x + ux * u + uz * v) * 10) / 10, Math.round((F.z + uz * u - ux * v) * 10) / 10]; }; // (u along the stairs from the foot, v out from the cliff)
  // 관공서 앞마당 (5단계): the walled yard and the mayor's gate before the cliff front, in the old hall's frame -- its origin
  // 2.75 m into the cliff, so the front stands at lz 7.35 as the old hall's did and island-townhall builds the yard as it is
  const TOWNHALL = (() => {
    const s = SPOTS.townhall; const ry = Math.atan2(s.face[0] - s.x, s.face[1] - s.z); const back = 7.35 - FACADE.d;
    return { x: s.x - Math.sin(ry) * back, z: s.z - Math.cos(ry) * back, ry, cos: Math.cos(ry), sin: Math.sin(ry), body: { hx: 8.3, z0: back, z1: 7.35 }, yard: { hx: 8.3, z0: 7.35, z1: 16.35 }, gate: { hw: 1.6 } };
  })();
  const townhallLocal = (x, z) => { const dx = x - TOWNHALL.x; const dz = z - TOWNHALL.z; return { lx: TOWNHALL.cos * dx - TOWNHALL.sin * dz, lz: TOWNHALL.sin * dx + TOWNHALL.cos * dz }; };
  const townhallWorld = (lx, lz) => ({ x: TOWNHALL.x + TOWNHALL.cos * lx + TOWNHALL.sin * lz, z: TOWNHALL.z - TOWNHALL.sin * lx + TOWNHALL.cos * lz });
  const inTownhall = (x, z, m = 0) => { const { lx, lz } = townhallLocal(x, z); const b = TOWNHALL.body; return Math.abs(lx) <= b.hx + m && lz >= b.z0 - m && lz <= TOWNHALL.yard.z1 + m; };
  const inTownhallYard = (x, z, m = 0) => { const { lx, lz } = townhallLocal(x, z); const y = TOWNHALL.yard; return Math.abs(lx) <= y.hx - m && lz >= y.z0 - m && lz <= y.z1 - m; };
  const thPt = (lx, lz) => { const p = townhallWorld(lx, lz); return [Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10]; };
  // tier: 'town' (대청마당 round and 물가 거리 before it), 'walk' (the arms, the bridges, 잔치마루), 'trail' (푸른숲골)
  const WALKS = [
    { tier: 'town', w: 3.2, pts: [[0, -54], [0.6, -30], [0, -8]] }, // 대청마당 → 물가 거리 (배 타는 곳)
    { tier: 'town', w: 3.2, pts: arc(234, 306) }, // 물가 거리, before 대청마당
    { tier: 'walk', w: 2.8, pts: [...arc(234, 156), [-88, 140]] }, // 물가 거리 → the west arm → its cape (초승등대)
    { tier: 'walk', w: 2.8, pts: [...arc(306, 384), [88, 140], [94, 146], [97, 149]] }, // → the east arm → its cape (달끝나루, the pier's foot)
    { tier: 'walk', w: 3, pts: [[-88, 140], [-80, 140], [-55, 140], [-30, 140], [-12, 141.5], [12, 141.5], [30, 140], [55, 140], [80, 140], [88, 140]] }, // 윤슬다리 · 툇마루섬 · 윤슬다리
    { tier: 'town', w: 3, pts: [[-44, -86], [-56, -93], thPt(0, 19.5), thPt(0, 15), doorPt('townhall')] }, // → 관공서, through the mayor's gate
    { tier: 'town', w: 3, pts: [thPt(0, 19.5), thPt(-11, 18.5), thPt(-17.5, 11)] }, // → round the yard, past the cliff front's corner
    { tier: 'town', w: 2.4, pts: [doorPt('jail'), [-59.5, -70.2], [-58, -75.8], [-47, -76]] }, // (R4) → 구치소, off 관리실's walk (round its back)
    { tier: 'walk', w: 2.4, pts: [thPt(-17.5, 11), stairsAt(-0.4, 4.6), stairsAt(-0.4, 1.7)] }, /* (3회차 10: to the first step's foot, not on it) */ // → onto the ridge's stairs, from their open side by the foot
    { tier: 'town', w: 3, pts: [[44, -86], [56, -93], doorPt('store')] }, // → 백화점
    { tier: 'walk', w: 2.8, pts: [[-41, -59], LA, [(LA[0] + LB[0]) / 2, (LA[1] + LB[1]) / 2], LB, [-80, 16], [-84, 34], [-86, 40.5], [-87.1, 43.8]] }, // (묶음 5: on to the stepping stones' walk -- no end in the field) // 이웃골 → the west arm's shore
    { tier: 'trail', w: 2.4, pts: [[-70, -8], [-80, 1.5], [-86, 3.5], [-92, 2.5], [-96, 0], [-110, 2], [-122, -6], doorPt('climb')] }, // 푸른숲골: the gazebo, 거울호수, the river, 등반탑
    { tier: 'trail', w: 2.4, pts: [[-122, -6], [-131, 12], [-133, 32], [-127.5, 37.5], [-124.25, 41], [-124.25, 45.8]] }, // → the farm (its farmer) -- (5회차 5 「길이랑 터 있는 곳이랑 안 맞아」: straight into the gate's middle, not the fence's corner)
    { tier: 'walk', w: 2.8, pts: [[42, -54], [46, -49], [66, -46], [88, -30], [104, -6], [116, 12], [112, 34], [100, 46], [96, 60]] }, // 잔치마루: the contest square, the museum
    // (묶음 1 섬 길 정리: every place on a walk -- the doors the walks passed by, 툇마루역 round 툇마루섬's pond, and the
    // ridge: from the stairs' top along 달마루 능선 (its flat crest, r 138) to 영웅마루역's lift, a lookout on the way)
    { tier: 'trail', w: 2.4, pts: [[-80.5, 1.2], [-81, -3.5], [-84.5, -8.6], doorPt('chat')] }, // → the gazebo (묶음 5: round its east side to its door)
    { tier: 'town', w: 3, pts: [[43, -66], doorPt('games')] }, { tier: 'town', w: 2.4, pts: [[61.5, -95.3], doorPt('records')] }, // (기록관's door, off the 백화점 walk) // → 게임관's door, from 대청마당 (묶음 5)
    { tier: 'town', w: 3, pts: [doorPt('admin'), [-47, -76], [-43, -79]] }, // → 관리실, from 대청마당 (묶음 5: at 알림마루's end)
    { tier: 'walk', w: 2.8, pts: [[100.5, 47], [MUSEUM.x - Math.sin(MUSEUM.yaw) * 8, MUSEUM.z - Math.cos(MUSEUM.yaw) * 8], [MUSEUM.x - Math.sin(MUSEUM.yaw) * 4.9, MUSEUM.z - Math.cos(MUSEUM.yaw) * 4.9]] }, // → the museum's door (묶음 5: straight at it, clear of its corner)
    { tier: 'walk', w: 2.8, pts: [[12, 141.5], [17, 149], [14, 158], [7, 162.5], [5.3, 165.3]] }, // 툇마루섬 → 툇마루역 (its way in: island-train pulls the stop's straight inward), round its pond
    // (묶음 3: the villagers' places on a walk too -- the builder by the stepping stones, the gazebo's grandpa; the busker's
    // round touches 물가 거리 itself)
    { tier: 'trail', w: 2.4, pts: [[-87.1, 43.8], [-97.8, 37.8]] }, { tier: 'trail', w: 2.4, pts: [[-93.6, -0.3], [-94, -3.9]] },
    // (묶음 4 내 집: from each of 툇마루섬's twelve lots' door (island-home.js LOTS) to the walk across the isle, round the other houses)
    { tier: 'walk', w: 2.4, pts: [[0, 141], [0, 124], [0, 107.3]] }, // (2회차 15: north from the walk across the isle into its widened part, four houses by it)
    { tier: 'trail', w: 2, pts: [[1.7, 169.2], [4.5, 166.1]] }, { tier: 'trail', w: 2, pts: [[16.4, 163.1], [13.6, 159.9]] }, { tier: 'trail', w: 2, pts: [[2.1, 159.9], [5.4, 162.5]] }, { tier: 'trail', w: 2, pts: [[22.4, 150.3], [18.1, 150.1]] }, { tier: 'trail', w: 2, pts: [[-5.4, 108.5], [-0.9, 108.5]] }, { tier: 'trail', w: 2, pts: [[-5.4, 123.5], [-0.9, 123.5]] }, { tier: 'trail', w: 2, pts: [[5.4, 107.5], [0.9, 107.5]] }, { tier: 'trail', w: 2, pts: [[5.4, 122.5], [0.9, 122.5]] }, { tier: 'trail', w: 2, pts: [[-30.4, 145.4], [-30.2, 141.2]] }, { tier: 'trail', w: 2, pts: [[-29.2, 134.6], [-29.4, 138.8]] }, { tier: 'trail', w: 2, pts: [[28.2, 134.6], [28.4, 138.9]] }, { tier: 'trail', w: 2, pts: [[-15.2, 146.9], [-14.9, 142.6]] },
    { tier: 'walk', w: 2.8, pts: [stairsAt(35.6, 1.7), stairsAt(36, -1.5), stairsAt(36, -4.5), stairsAt(35.8, -6.4), po(STAIRS_TOP_DEG + 4, 138) /* (문제 기록 4회차: on the top's fill, not its edge, and toward the ridge from where the stairs now end -- 216° stayed when they moved) */, ...[222, 230, 238, 246, 254].map((a) => po(a, 138)), po(261, 141), stationPt(270 - 2, 155)] }, // 능선 위 길 → 영웅마루역 (from the top step sideways onto the ridge: past the top the cliff drops)
  ];
  const walkCurves = WALKS.map((w) => ({ w: w.w, tier: w.tier, pts: catmull(w.pts, 0.8) }));
  const walkDist = (x, z) => { let d = Infinity; for (const w of walkCurves) d = Math.min(d, lineDist(x, z, w.pts) - w.w / 2); return d; };

  // ---- the ground: dalmaru-terrain's, levelled under what stands and filled where the stairs meet the ridge ----
  const BUILDINGS = [...Object.values(SPOTS), ...COTTAGES.map((c) => ({ ...c, kind: 'cottage' }))];
  // (v1.10.160 역 터, 사용자 「땅 다지기」 -- not 156's lift raised to the highest ground on a stone plinth): each station's lift
  // (its 2.4 m base) and the walkway to its way in, 1.5 m more all round, levelled at the middle height of the ground under
  // them; the pads' 5 m bank meets the ground round it
  function stationPad(id) {
    const L = D.TRAIN.liftAt(id); const [ex, ez] = L.entry; const hs = [];
    for (const dx of [-1.2, 0, 1.2]) for (const dz of [-1.2, 0, 1.2]) hs.push(D.landHeight(L.x + dx, L.z + dz));
    for (let k = 1; k <= 8; k += 1) hs.push(D.landHeight(L.x + ((ex - L.x) * k) / 8, L.z + ((ez - L.z) * k) / 8));
    hs.sort((a, b) => a - b); if (hs.at(-1) - hs[0] <= 0.05) return null; // (툇마루역: level already, the lots' ground)
    return [(L.x + ex) / 2, (L.z + ez) / 2, Math.hypot(ex - L.x, ez - L.z) / 2 + 1.2 + 1.5, hs[hs.length >> 1]];
  }
  const laneH = COTTAGES.reduce((a, c) => a + D.landHeight(c.x, c.z), 0) / COTTAGES.length; // (이웃골: the houses' pads one level, so the yards between them stay flat)
  const PADS = [[PL.gamehall.x, PL.gamehall.z, 10], [MUSEUM.x, MUSEUM.z, 6.5], [PL.contest.x, PL.contest.z, 10], [FARM.x, FARM.z, 6], ...FARM.yard.plots.map(([x, z]) => [x, z, 6]) /* (3회차 15: the farm's plots level) */, [townhallWorld(0, 11.5).x, townhallWorld(0, 11.5).z, 10] /* (관공서 앞마당, level under its marble) */, ...COTTAGES.map((c) => [c.x, c.z, 4.6, laneH]),
    ...Object.values(SPOTS).filter((s) => s.kind !== 'facade' && s.kind !== 'hall' && !inPlaza(s.x, s.z)).map((s) => [s.x, s.z, s.kind === 'tower' ? 4.5 : 3.5]),
    ...HOME_LOTS.map((l) => [l.x, l.z, 7.2, 0.9]) /* (2회차 15: each lot level, its big house by the shore too) */,
    ...Object.keys(D.TRAIN.stops).map(stationPad).filter(Boolean)]
    .map(([x, z, r, h]) => ({ x, z, r, h: h ?? D.landHeight(x, z) }));
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
  // 문제 기록 15 「백화점이 떠 있어서 이상해. 절벽을 파고 들어가 절벽 안에 지었구나 싶게」: either side of each front the ridge
  // comes forward to its face, 5 m of cliff -- 관공서·백화점 stand in a cut in 영웅마루, not before it
  // (not on the side where 영웅마루's stairs come down by the 관공서 -- its foot stands there)
  // (문제 기록 4회차: 1.5 m past the treads was too little once the stairs stood 3 m off the hall (3회차 11) -- the ground is
  // drawn on a 2.5 m mesh, so the cut's wall a cell off leant over the treads and the way to their foot, 17 m over where one
  // walked; now 4.5 m, more than a cell's diagonal, all round them)
  const STAIRS_CLEAR = 4.5;
  const stairsBand = (x, z) => { const ex = x - STAIRS.x; const ez = z - STAIRS.z; const u = ex * STAIRS.ux + ez * STAIRS.uz; const v = ex * STAIRS.nx + ez * STAIRS.nz; return u > -STAIRS_CLEAR - 1.5 && u < STAIRS.len + 1 && v > STAIRS.w0 - STAIRS_CLEAR && v < STAIRS.w1 + STAIRS_CLEAR; };
  const CUTS = Object.values(SPOTS).filter((s) => s.kind === 'facade').map((s) => { const ry = Math.atan2(s.face[0] - s.x, s.face[1] - s.z); const c = Math.cos(ry); const sn = Math.sin(ry);
    const foot = (u) => { const x = STAIRS.x + STAIRS.ux * u + STAIRS.nx * 1.7 - s.x; const z = STAIRS.z + STAIRS.uz * u + STAIRS.nz * 1.7 - s.z; return { lx: x * c - z * sn, lz: x * sn + z * c }; };
    const near = [0, 2, 4, 6].map(foot).filter((p) => Math.abs(p.lx) < FACADE.w / 2 + 8 && p.lz > -4 && p.lz < FACADE.d + 3);
    return { x: s.x, z: s.z, c, s: sn, top: D.landHeight(s.x - sn * 7, s.z - Math.cos(ry) * 7), skip: near.length ? Math.sign(near[0].lx) : 0 }; });
  function land(x, z) {
    let h = D.landHeight(x, z);
    for (const k of CUTS) {
      const dx = x - k.x; const dz = z - k.z; const lx = dx * k.c - dz * k.s; if (k.skip && Math.sign(lx) === k.skip && stairsBand(x, z)) continue; const side = Math.abs(lx) - FACADE.w / 2; const lz = dx * k.s + dz * k.c; // (2회차 16: only the stairs' own way left uncut -- the 관공서 dug in as the 백화점)
      const edge = Math.max(0.3 - side, side - 5.3, lz - FACADE.d - 0.2, -3 - lz); if (edge < 1.2) h = Math.max(h, lerp(k.top, h, smooth(0, 1.2, edge)));
    }
    for (const p of PADS) { if (Math.abs(x - p.x) >= p.r + 5 || Math.abs(z - p.z) >= p.r + 5) continue; /* (CI 3차: far off on one axis is far off -- 32 pads, most a long way) */ const d = Math.hypot(x - p.x, z - p.z); if (d < p.r + 5) h = lerp(p.h, h, smooth(p.r, p.r + 5, d)); }
    // (문제 기록 3회차 20 「마당 경계가 이상해」: the 게임관's pad rose into 대청마당's east side, the grass up through its paving in a
    // ragged edge -- the terrace stays at its height under all of its paving)
    if (inPlaza(x, z, 2.5)) h = Math.min(h, P.h); // (2.5 m past its edge: the 2 m ground cells under the edge lie flat too)
    // the fill from the stairs' top back to the ridge: 4 m wide, from the treads to 8 m into the ridge
    const dx = x - TOP.x; const dz = z - TOP.z; const along = dx * STAIRS.ux + dz * STAIRS.uz; const out = -(dx * STAIRS.nx + dz * STAIRS.nz);
    // (문제 기록 4회차: 2.4 m deep it fell between the 2.5 m mesh's points -- drawn 7 m under where one stood at the top; 5 m deep)
    const edge = Math.max(-along - 0.4, along - 5, -out - 1.5, out - 9); if (edge < 2.5) h = Math.max(h, lerp(TOP.h, h, smooth(0, 2.5, edge))); // (from the stairs' end on: over their last steps it stood flat at the top -- a 1.9 m step up)
    return h;
  }
  const ground = (x, z) => D.ground(x, z) + (land(x, z) - D.landHeight(x, z)); // (no pad or fill is near water)
  const isWater = (x, z) => ground(x, z) < SEA || D.inHeadPond(x, z); // (2회차 18: the ponds over the falls are water too)
  const slopeAt = (x, z) => Math.hypot(ground(x + 1, z) - ground(x - 1, z), ground(x, z + 1) - ground(x, z - 1)) / 2;
  // (동산 다듬기: the scenery is picked on the ground as it was before the 동산 shapes -- the same seeded picks, so nothing
  // moves; only what then stands on a steep new bank is left out, afterwards)
  const brushAt = D.brushAt || (() => 0);
  const slopeBefore = (x, z) => Math.hypot(ground(x + 1, z) - brushAt(x + 1, z) - ground(x - 1, z) + brushAt(x - 1, z), ground(x, z + 1) - brushAt(x, z + 1) - ground(x, z - 1) + brushAt(x, z - 1)) / 2;
  const walkableBefore = (x, z) => Boolean(onBridge(x, z) || onStairs(x, z) || inRect(PIER, x, z) || onDock(x, z)) || (!isWater(x, z) && slopeBefore(x, z) < 0.9 && D.coastDist(x, z) > 1.2 && !underDrawnRock(x, z));
  const onBank = (o, limit) => D.BRUSHES?.some((b) => Math.hypot(o.x - b.x, o.z - b.z) < b.r) && slopeAt(o.x, o.z) >= limit;

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
      // (문제 기록 2회차 4: one height for both ends left a step where the banks differ -- 65 cm on the west river's north bank;
      // each end now meets its own bank, e0 at -half and e1 at +half, the middle no lower than before)
      if (!bridges.some((o) => Math.hypot(o.x - run.x, o.z - run.z) < 6)) bridges.push({ x: run.x, z: run.z, ux, uz, half, w: Math.max(2.6, walk.w), deck: Math.max(...ends, SEA + 0.6) + 0.1, e0: ends[0] + 0.02, e1: ends[1] + 0.02 });
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
  const deckAt = (hit) => (hit.b.arch ? hit.b.base + YB.top + hit.b.arch * Math.sin((Math.PI * (hit.u + hit.b.half)) / (2 * hit.b.half)) : hit.b.e0 !== undefined ? hit.b.e0 + (hit.b.e1 - hit.b.e0) * (hit.u / hit.b.half + 1) / 2 + Math.max(0.35, hit.b.deck + 0.35 - (hit.b.e0 + hit.b.e1) / 2) * (1 - (hit.u / hit.b.half) ** 2) : hit.b.deck + 0.35 * (1 - (hit.u / hit.b.half) ** 2));
  // 달끝나루 (assets 55 pier.dalkkeut: 20 m out from its root, deck top 0.69 over it) straight out from the east cape, and
  // 배 타는 곳 (dock.boat) off 물가 거리 before 대청마당 -- both walked on
  const CAPE = D.CAPES[1]; const pierL = Math.hypot(PL.pier.x - CAPE.x, PL.pier.z - CAPE.z);
  const PIER_DIR = [(PL.pier.x - CAPE.x) / pierL, (PL.pier.z - CAPE.z) / pierL];
  const pierY = Math.max(SEA, D.ground(PL.pier.x, PL.pier.z)) - 0.5; // (its deck a step over the beach at its root)
  const PIER = { x: PL.pier.x + PIER_DIR[0] * 10, z: PL.pier.z + PIER_DIR[1] * 10, ux: PIER_DIR[0], uz: PIER_DIR[1], half: 10, w: 3.6, deck: pierY + 0.69, root: { x: PL.pier.x, z: PL.pier.z, y: pierY, yaw: Math.atan2(PIER_DIR[0], PIER_DIR[1]) } }; // (its front, the far end, out to sea)
  // (dock.boat: a 12 x 3 m float, its gangway 4.2 m back to the shore -- the model's -Z, here north)
  // (문제 기록 5회차 2 「하늘에 떠 있어」: at y 0 its deck stood 0.75 m over the sea -- a float rides low: 0.4 m)
  const DOCK_Y = -0.35;
  const DOCK = { x: PL.dock.x, z: PL.dock.z - 2, root: { x: PL.dock.x, z: PL.dock.z - 2, y: DOCK_Y, yaw: 0 },
    rects: [{ x: PL.dock.x, z: PL.dock.z - 2, ux: 1, uz: 0, half: 6, w: 3, deck: 0.15 + DOCK_Y }, { x: PL.dock.x, z: PL.dock.z - 5.6, ux: 0, uz: 1, half: 2.3, w: 1.6, deck: 0.3 + DOCK_Y }] };
  const onDock = (x, z, grow = 0) => DOCK.rects.find((r) => inRect(r, x, z, grow));
  const inRect = (r, x, z, grow = 0) => { const dx = x - r.x; const dz = z - r.z; return Math.abs(dx * r.ux + dz * r.uz) <= r.half + grow && Math.abs(-dx * r.uz + dz * r.ux) <= r.w / 2 + grow; };

  function heightAt(x, z) {
    const hit = onBridge(x, z); if (hit) return deckAt(hit);
    const st = onStairs(x, z); if (st) return Math.max(STAIRS.base + stairRise(st.u), ground(x, z));
    if (inRect(PIER, x, z)) return PIER.deck;
    const dock = onDock(x, z); if (dock) return dock.deck;
    return Math.max(ground(x, z), SEA);
  }
  const walkable = (x, z) => Boolean(onBridge(x, z) || onStairs(x, z) || inRect(PIER, x, z) || onDock(x, z)) || (!isWater(x, z) && slopeAt(x, z) < 0.9 && D.coastDist(x, z) > 1.2 && !underDrawnRock(x, z));
  // (문제 기록 4회차 「통과할 수 있는 산맥」) round the stairs the ridge's face is steeper than the 2.5 m ground mesh: where the
  // ground is drawn more than 0.5 m over or under one's feet -- rock over one's head, air under one's feet -- one may not
  // stand: what is seen stops (round them only: a cheap test first)
  function underDrawnRock(x, z) {
    const dx = x - STAIRS.x; const dz = z - STAIRS.z; const u = dx * STAIRS.ux + dz * STAIRS.uz; const v = dx * STAIRS.nx + dz * STAIRS.nz;
    return u > -10 && u < STAIRS.len + 10 && v > STAIRS.w0 - 10 && v < STAIRS.w1 + 10 && Math.abs(meshGroundHeight(x, z) - ground(x, z)) > 0.5;
  }
  // the cliff faces and the ridge's sea cliffs read as rock
  const cliffAt = (x, z) => Math.min(1, D.ridgeAt(x, z) * smooth(0.25, 0.9, D.slopeAt(x, z)) + (D.ridgeAt(x, z) > 0.3 ? smooth(20, 4, D.coastDist(x, z)) : 0));
  // fishing: a walkable spot with water within 2.4 m -- the sea (and 윤슬만) or fresh water (the lake, rivers, pools)
  function fishWater(x, z) {
    if (!walkable(x, z) || onBridge(x, z) || onStairs(x, z)) return null;
    if (inRect(PIER, x, z, 0.2) || onDock(x, z, 0.2)) return 'sea';
    for (const [dx, dz] of [[2.4, 0], [-2.4, 0], [0, 2.4], [0, -2.4]]) {
      const wx = x + dx; const wz = z + dz; if (!isWater(wx, wz)) continue;
      // (5단계: five waters -- the open sea, 윤슬만, the still water (거울호수, 툇마루섬's pond), the waterfall pools, the rivers)
      if (D.coastDist(wx, wz) < 0) return D.inBay(wx, wz) ? 'bay' : 'sea';
      if (D.POOLS.some((p) => Math.hypot(wx - p.x, wz - p.z) < p.r + 0.5)) return 'pool';
      if (D.lakeDist(wx, wz) < 0.5 || Math.hypot((wx - D.ISLE_POND.x) / D.ISLE_POND.rx, (wz - D.ISLE_POND.z) / D.ISLE_POND.rz) < 1.2) return 'lake';
      return 'river';
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
      // (묶음 5 배치 점검: off the walk (r 99.4-102.6) -- the lamps on its land side, the benches beyond them facing the water)
      if (k % 3 === 1) { const [lx, lz] = bayAt(a, 103.1); lamps.push({ x: lx, z: lz, r: 0.3 }); }
      if (k % 6 === 3) { const [bx, bz] = bayAt(a, 104.6); benches.push({ x: bx, z: bz, yaw: Math.atan2(-bx, D.BAY_Z - bz), r: 0.9 }); } // (a bench's +Z, its front, toward the water)
    }
    return { rails, lamps, benches };
  })();
  // what one walks round at the structures (the scene's collision and the islanders' route grid alike): 초승등대, the
  // stairs' walls (the open side and the stone under the steps), each niche's foot, 툇마루섬's board, 물가 거리's railing,
  // lamps and benches
  // 묶음 1 대청마당 바닥 (assets 59 plaza-v1, notes 88eb828): a stone disc round the fountain, a ring, kerbs along the
  // south, east and west edges (open where a walk comes in; the north runs on into 영웅마루's yard), a water channel each
  // side of the disc and six garden islands -- the pack's suggested places moved off the walks, doors, 알림마루's court
  // and the plaza's own places (spawn, 책수레, 생일, 벽화). Places from the fountain: x east, z south.
  let paving_ = null;
  function paving() {
    if (paving_) return paving_;
    const c = (x, z, extra) => ({ x: PLAZA_C.x + x, z: PLAZA_C.z + z, ...extra });
    const channels = [];
    for (const s of [1, -1]) { for (let k = 0; k < 4; k += 1) channels.push(c(s * (11.5 + 4 * k), 0, { yaw: 0 })); channels.push(c(s * 26.5, 0, { yaw: (s * Math.PI) / 2, end: true })); }
    const gardens = [['long', -18, 18], ['long', 24, 18], ['round', -33, -12], ['round', 33, -12], ['round', -29, 27], ['round', 39.5, 25]].map(([kind, x, z]) => c(x, z, { kind }));
    const S = P.d1 - PLAZA_C.z - 0.18; const E = P.hw - 0.18; // (the kerb's middle, 0.18 in from the edge)
    const open = (x, z, alongX) => [-2, -1, 0, 1, 2].some((d) => { const px = alongX ? x + d : x; const pz = alongX ? z : z + d; return walkCurves.some((w) => w.pts.some(([a, b]) => Math.hypot(a - px, b - pz) < w.w / 2 + 0.8)) || Object.keys(SPOTS).some((id) => { const o = facilityDoor(id); return o && Math.hypot(o.x - px, o.z - pz) < 2.5; }); });
    const curbs = [];
    for (let x = -40; x <= 40; x += 4) if (!open(PLAZA_C.x + x, PLAZA_C.z + S, true)) curbs.push(c(x, S, { yaw: 0 }));
    for (const s of [1, -1]) for (let z = S - 3.8; z > P.d0 - PLAZA_C.z + 2; z -= 4) if (!open(PLAZA_C.x + s * E, PLAZA_C.z + z, false)) curbs.push(c(s * E, z, { yaw: Math.PI / 2 }));
    const corners = [c(-E, S, { yaw: 0 }), c(E, S, { yaw: Math.PI / 2 })]; // (its arms run +x and -z)
    return (paving_ = { disc: c(0, 0), channels, gardens, curbs, corners });
  }
  // a garden's rim and a channel's bank are walked round (a garden's rim sat on: plazaProps' seats)
  function pavingSolids() {
    const { channels, gardens } = paving(); const out = [];
    for (const g of gardens) if (g.kind === 'round') out.push({ x: g.x, z: g.z, r: 3.05 }); else for (const d of [-3.2, -1.6, 0, 1.6, 3.2]) out.push({ x: g.x + d, z: g.z, r: 1.8 });
    for (const ch of channels) if (ch.end) out.push({ x: ch.x, z: ch.z, r: 1 }); else for (const d of [-1.5, -0.5, 0.5, 1.5]) out.push({ x: ch.x + d, z: ch.z, r: 0.65 });
    return out;
  }
  function structureSolids() {
    const out = [{ x: PL.lighthouse.x, z: PL.lighthouse.z, r: 3.2 }, { x: D.ISLE.x - 4, z: D.ISLE.z - 7.3, r: 1.1 }, ...pavingSolids()];
    for (let u = 1.1; u <= SL - 2; u += 0.5) for (const v of [-0.05, 3.45]) out.push( /* (the rails' run: the foot and the top meet level ground, nothing drawn there to stop one) */{ x: STAIRS.x + STAIRS.ux * u + STAIRS.nx * v, z: STAIRS.z + STAIRS.uz * u + STAIRS.nz * v, r: 0.28, rail: true });
    for (const n of PL.niches) for (let lx = -0.4 * n.m; lx <= 0.4 * n.m + 1e-6; lx += 0.8) out.push({ x: n.x + Math.cos(n.yawToCentre) * lx + Math.sin(n.yawToCentre) * 0.6, z: n.z - Math.sin(n.yawToCentre) * lx + Math.cos(n.yawToCentre) * 0.6, r: 0.6 });
    for (const r of WATERFRONT.rails) for (const d of [-1.6, -0.55, 0.55, 1.6]) out.push({ x: r.x + Math.cos(r.yaw) * d, z: r.z - Math.sin(r.yaw) * d, r: 0.3 });
    for (const l of WATERFRONT.lamps) out.push({ x: l.x, z: l.z, r: l.r });
    for (const b of WATERFRONT.benches) out.push({ x: b.x, z: b.z, r: b.r });
    for (const p of farmFence()) out.push({ ...p, r: 0.22, fence: true }); // (3회차 15: the farm's fence, its shed and scarecrow)
    { const s = FARM.yard.shed; for (const dx of [-1, 0, 1]) for (const dz of [-0.6, 0.6]) out.push({ x: s.x + dx, z: s.z + dz, r: 0.8 }); }
    out.push({ ...FARM.yard.scarecrow, r: 0.35 });
    return out;
  }
  const STRUCTURES = { // the pieces of assets 55 that stand once (plaza-scene draws them; solids are theirs)
    lighthouse: { ...PL.lighthouse, r: 3.2 }, pier: PIER.root, dock: DOCK.root, stairs: { x: SF.x, z: SF.z, yaw: Math.atan2(STAIRS.nx, STAIRS.nz), base: STAIRS.base }, // (its model, turned, runs along local -x: the chord)
  };

  // 대청마당's own things round its fountain: benches facing it, lamps on a ring, flower beds (island-terrain's plazaProps,
  // centred on 대청마당); the 민원실's seats and windows are the same room as now
  function plazaProps() {
    const busy = (x, z, gap) => Object.values(SPOTS).some((s) => Math.hypot(s.x - x, s.z - z) < gap);
    const at = (a, r) => ({ x: PLAZA_C.x + Math.cos(a) * r, z: PLAZA_C.z + Math.sin(a) * r });
    const benches = [0.38, -0.38, Math.PI - 0.38, Math.PI + 0.38].map((a) => { const p = at(a, 5); return { ...p, r: 0.9, yaw: Math.atan2(PLAZA_C.x - p.x, PLAZA_C.z - p.z) }; }); // (facing the fountain: the bench and its seat alike)
    const lamps = [];
    for (let k = 0; k < 8; k += 1) { const p = at(Math.PI / 8 + (k * Math.PI) / 4, 12); if (!busy(p.x, p.z, 3)) lamps.push({ ...p, r: 0.35 }); }
    const beds = []; // (묶음 1 광장 소품 정리: the wooden planters round the lamps gave way to assets 59's gardens and disc)
    // (문제 기록 3회차 13 「중앙 광장 주변이 좀 황량해」) along the rim inside the kerbs -- south, east and west -- every 14 m a
    // group: a flower bed 3 m in, a bench each side of it facing the fountain's side, a lamp behind it by the kerb; none
    // where a walk or a door comes in, on a garden, a channel, a place of the plaza's own or the building fronts' 8 m
    const { gardens, channels } = paving(); const placesIn = []; const walkIn = (o) => { if (!o || typeof o !== 'object') return; if (Number.isFinite(o.x) && Number.isFinite(o.z)) { if (inPlaza(o.x, o.z, 2)) placesIn.push(o); } else Object.values(o).forEach(walkIn); }; walkIn(PL);
    const clear = (x, z) => !walkCurves.some((w) => w.pts.some(([a, b]) => Math.hypot(a - x, b - z) < w.w / 2 + 2.5)) && !Object.keys(SPOTS).some((id) => { const d = facilityDoor(id); return d && Math.hypot(d.x - x, d.z - z) < 6; })
      && !busy(x, z, 6) && !gardens.some((g) => Math.hypot(g.x - x, g.z - z) < (g.kind === 'round' ? 6 : 8)) && !channels.some((c) => Math.hypot(c.x - x, c.z - z) < 4) && !placesIn.some((p) => Math.hypot(p.x - x, p.z - z) < 5) && Math.hypot(x - PL.spawn.x, z - PL.spawn.z) > 6;
    const rim = [];
    for (let x = -36; x <= 36; x += 10) rim.push({ x: PLAZA_C.x + x, z: P.d1 - 3, ax: 1, az: 0, ox: 0, oz: 1 }); // south: along x, the kerb +z
    for (const s of [1, -1]) for (let z = P.d1 - 9; z > P.d0 + 5; z -= 10) rim.push({ x: P.x + s * (P.hw - 3), z, ax: 0, az: 1, ox: s, oz: 0 });
    for (const g of rim) {
      if (!clear(g.x, g.z)) continue;
      const sides = [-2.4, 2.4].map((d) => ({ x: g.x + g.ax * d, z: g.z + g.az * d })).filter((p) => clear(p.x, p.z)); // (a bench where it fits)
      beds.push({ x: g.x, z: g.z, r: 1.1, i: beds.length, rim: true });
      for (const p of sides) benches.push({ ...p, r: 0.9, yaw: Math.atan2(-g.ox, -g.oz), rim: true }); // (facing in, away from the kerb)
      lamps.push({ x: g.x + g.ox * 1.6, z: g.z + g.oz * 1.6, r: 0.35 });
    }
    const seats = benches.map((b, k) => { const ry = b.yaw; return { id: `b${k}`, x: b.x + Math.sin(ry) * 0.18, z: b.z + Math.cos(ry) * 0.18, yaw: ry }; });
    // (묶음 1, assets 59) the gardens' rims: 4 seats round a round one, 3 down each long side of a long one, facing out
    paving().gardens.forEach((g, k) => {
      const at = g.kind === 'round' ? [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => [a * 2.23, b * 2.23]) : [-3, 0, 3].flatMap((x) => [[x, 1.95], [x, -1.95]]);
      at.forEach(([dx, dz], n) => seats.push({ id: `g${k}-${n}`, x: g.x + dx, z: g.z + dz, yaw: g.kind === 'round' ? Math.atan2(dx, dz) : Math.atan2(0, dz) }));
    });
    seats.push(...C.plazaProps().seats.filter((s) => s.room));
    return { benches, lamps, beds, seats };
  }

  // nature: woods on the west arm (푸른숲골), round the lake and on the ridge's back, trees scattered over the fields,
  // flowers, bushes, grass, shore rocks -- seeded, the same on every screen, clear of the walks and what stands
  // 영웅마루's foot, from 대청마당 to the cliff along the niches and the two fronts: kept open, so the statues are seen
  const heroYard = (x, z) => { const r = Math.hypot(x, z); const a = (((Math.atan2(z, x) * 180) / Math.PI) + 360) % 360; return r > 106 && r < 131 && a > 236 && a < 304; };
  // (no weed at a quest giver's or a keeper's feet: SPACE there is for talking)
  const nearKeeper = (x, z) => Object.values(PL.quests).some((q) => Math.hypot(x - q.x, z - q.z) < 3.5) || [VILLAGE.painter, VILLAGE.busker, VILLAGE.electrician, VILLAGE.builder, VILLAGE.librarian, VILLAGE.grandpa, VILLAGE.guide, FARM.farmer].some((q) => Math.hypot(x - q.x, z - q.z) < 3.5);
  let natureCache = null; const natureBlocks = []; // (island-train: no tree on a lift's way)
  const addNatureBlock = (fn) => { natureBlocks.push(fn); natureCache = null; };
  addNatureBlock((x, z, r) => inFarmYard(x, z, r)); // (3회차 15: the farm yard clear)
  function nature() {
    if (natureCache) return natureCache;
    let seed = 0x5a1d0e; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const R = D.R_OUT + 5;
  const built = (x, z) => onHouse(x, z) || BUILDINGS.some((b) => Math.hypot(x - b.x, z - b.z) < (b.kind === 'facade' ? 18 : b.kind === 'hall' ? 13 : 7))
      || PADS.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + 1.5) || onStairs(x, z) || Math.hypot(x - TOP.x, z - TOP.z) < 6
      || Math.hypot(x - PL.lighthouse.x, z - PL.lighthouse.z) < 6 || Math.hypot(x - PL.pier.x, z - PL.pier.z) < 6 || Math.hypot(x - PL.dock.x, z - PL.dock.z) < 8
      || villageSolids().some((v) => Math.hypot(x - v.x, z - v.z) < v.r + 2) || heroYard(x, z);
    const clearOf = (x, z) => walkableBefore(x, z) && D.coastDist(x, z) > 5 && slopeBefore(x, z) < 0.35 && D.riverDist(x, z) > 2.5 && D.lakeDist(x, z) > 3
      && !inPlaza(x, z, 4) && !onBridge(x, z) && walkDist(x, z) > 1.6 && !built(x, z);
    const trees = [];
    // (묶음 4: 툇마루섬 -- a season zone of its own -- its grove round the houses; 묶음 5: on the wider isle, and sure to hold
    // every kind of tree each season shows -- with 22 picked at random a day's season there could miss its tall trees)
    const woods = [[-118, -10, 30, 70], [-100, 40, 22, 40], [95, -40, 22, 36], [-20, -130, 26, 30], [40, -132, 22, 24], [0, 150, 36, 30, { tall: 3, tiered: 3, round: 4, blossom: 2, pine: 2 }]];
    for (const [wx, wz, wr, n, need = {}] of woods) {
      const has = {}; const short = () => Object.entries(need).some(([k, m]) => (has[k] || 0) < m);
      for (let k = 0, tries = 0; (k < n || short()) && tries < n * 40; tries += 1) {
        const a = rnd() * TAU; const r = Math.sqrt(rnd()) * wr; const x = wx + Math.cos(a) * r; const z = wz + Math.sin(a) * r;
        if (!clearOf(x, z) || !trees.every((t) => Math.hypot(t.x - x, t.z - z) > 3.4)) continue;
        const kind = C.treeKind({ x, z }); if (k >= n && (has[kind] || 0) >= (need[kind] || 0)) continue; // (past n: only the kinds still short)
        trees.push({ x, z, s: 0.8 + rnd() * 0.55 }); has[kind] = (has[kind] || 0) + 1; k += 1;
      }
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
    // (3회차 8) the tufts seeded on their own and numbered by their try (`i`, island-weeds `w<i>`), three draws a try taken
    // or not: a tree or a flower placed otherwise above, or a walk laid across some, never moves or renumbers the rest
    const tufts = []; seed = 0x7a1f5;
    for (let tries = 0; tufts.length < 1400 && tries < 14000; tries += 1) { const x = (rnd() * 2 - 1) * R; const z = (rnd() * 2 - 1) * R; const s = 0.6 + rnd() * 0.7; if (walkableBefore(x, z) && D.coastDist(x, z) > 7 && slopeBefore(x, z) < 0.5 && walkDist(x, z) > 0.5 && !inPlaza(x, z, 1) && !nearKeeper(x, z)) tufts.push({ x, z, s, i: tries }); }
    const rocks = []; seed = 0x40c5; // (3회차 8: on their own too, not after however many tufts were tried)
    for (let tries = 0; rocks.length < 160 && tries < 8000; tries += 1) {
      const x = (rnd() * 2 - 1) * R; const z = (rnd() * 2 - 1) * R; const cd = D.coastDist(x, z);
      // (6회차 1 「돌이 있을 필요 없는 곳에」: at the water only on the rocky shore; the sandy shore's go behind the beach, on the grass)
      if (cd > -1 && cd < 12 && (D.ridgeAt(x, z) > 0.3 ? cd < 4 : cd > 6) && !D.inBay(x, z) && !built(x, z) && !onBridge(x, z)) rocks.push({ x, z, s: 0.5 + rnd() * (D.ridgeAt(x, z) > 0.3 ? 1.6 : 0.8), r: rnd() * 6 });
    }
    // what the train's lifts keep clear is taken out after the seeded scenery, so nothing else moves -- the weeds are
    // numbered by the tufts (island-weeds `w<i>`): the server and every screen must have the same ones
    const blocked = (o, r) => natureBlocks.some((fn) => fn(o.x, o.z, r)) || onBank(o, 0.35);
    const keptTrees = trees.filter((t) => !blocked(t, 1.5)); const keptBushes = bushes.filter((b) => !blocked(b, 0.8));
    // the walks' lamps (island-terrain's rule): beside the town walks and the 산책로 (not the 오솔길), every 14 points of
    // their curve -- on standable ground, off 대청마당 (its own lamps), the stairs, the bridges, the 관공서 yard, another
    // walk, what is built and the trees (after the tufts: the weeds keep their numbers)
    const lampSpots = [];
    for (const w of walkCurves) { if (w.tier === 'trail') continue; for (let i = 8; i < w.pts.length - 4; i += 14) {
      const [x, z] = w.pts[i]; const [x2, z2] = w.pts[i + 1]; const l = Math.hypot(x2 - x, z2 - z) || 1;
      const lx = x - ((z2 - z) / l) * (w.w / 2 + 0.8); const lz = z + ((x2 - x) / l) * (w.w / 2 + 0.8);
      if (!walkable(lx, lz) || inPlaza(lx, lz, 1) || onBridge(lx, lz) || onStairs(lx, lz) || inTownhall(lx, lz, 1) || walkDist(lx, lz) < 0.2) continue;
      if (structureSolids().some((o) => Math.hypot(o.x - lx, o.z - lz) < o.r + 0.6) || BUILDINGS.some((b) => Math.hypot(b.x - lx, b.z - lz) < (b.kind === 'facade' ? FACADE.w / 2 + 1 : 4))) continue;
      if ([...keptTrees, ...keptBushes].some((t) => Math.hypot(t.x - lx, t.z - lz) < 1.5)) continue;
      lampSpots.push({ x: lx, z: lz });
    } }
    natureCache = { trees: keptTrees, flowers: flowers.filter((p) => !blocked(p, 0.3)), bushes: keptBushes, tufts: tufts.filter((t) => !onBank(t, 0.5)), rocks: rocks.filter((r) => slopeAt(r.x, r.z) < 1 && walkDist(r.x, r.z) > 1.5) /* (묶음 1: none on a cliff face -- set at the ground under its middle, it hung in the air there; 6회차 1: none on a walk) */, posts: [], lampSpots };
    return natureCache;
  }
  // the trees fruit is picked from (island-terrain's rule): 20 spaced ones and every fruit-kind tree, each with a free
  // spot at its trunk; fruit trees are kept clear of walks, buildings and the plaza
  let harvestOf = null; let harvestCache = [];
  function harvestTrees() {
    const n = nature(); if (harvestOf === n) return harvestCache;
    const out = [];
    const approachOf = (t) => {
      const p = { x: t.x, z: t.z + 0.5 * t.s + 0.55 }; // (문제 기록 13: just outside the trunk -- the tree is walked round like the rest)
      if (inPlaza(p.x, p.z, 4) || !walkable(p.x, p.z) || walkDist(p.x, p.z) < 1.5 || D.riverDist(p.x, p.z) < 3 || D.lakeDist(p.x, p.z) < 3) return null;
      if (n.trees.some((o) => o !== t && Math.hypot(p.x - o.x, p.z - o.z) < 0.75 * o.s + 0.91) || n.bushes.some((o) => Math.hypot(p.x - o.x, p.z - o.z) < 0.75 * o.s + 0.91)) return null;
      if (BUILDINGS.some((b) => Math.hypot(p.x - b.x, p.z - b.z) < (b.kind === 'hall' ? 14 : b.kind === 'facade' ? 18 : 7))) return null;
      return p;
    };
    const add = (t, p) => out.push({ x: t.x, z: t.z, s: 1, yaw: -Math.atan2(0.515, 0.53), approach: p });
    for (const t of n.trees) { if (out.length === 20) break; const p = approachOf(t); if (!p || out.some((o) => Math.hypot(t.x - o.x, t.z - o.z) < 14)) continue; add(t, p); }
    for (const t of n.trees) { if (C.treeKind(t) !== 'fruit' || out.some((o) => Math.hypot(o.x - t.x, o.z - t.z) < 5)) continue; const p = approachOf(t); if (p) add(t, p); }
    harvestOf = n; harvestCache = out; return out;
  }
  // the shore within a few metres of the water (sea or 윤슬만, not the cliffs) -- where the tide leaves things, and the
  // views: a 2 m sample, worked out once
  let shoreCells = null;
  function shoreSpots() {
    if (shoreCells) return shoreCells;
    shoreCells = [];
    for (let x = -D.R_OUT; x <= D.R_OUT; x += 2) for (let z = -D.R_OUT; z <= D.R_OUT; z += 2) { const cd = D.coastDist(x, z); if (cd > 2.6 && cd < 9 && cliffAt(x, z) < 0.3 && walkable(x, z)) shoreCells.push({ x, z, cd }); }
    return shoreCells;
  }
  const natureSolids = () => { const n = nature(); const harvest = harvestTrees(); return [...n.trees.map((t) => ({ x: t.x, z: t.z, r: harvest.some((h) => h.x === t.x && h.z === t.z) ? 0.5 * t.s : 0.75 * t.s })), ...n.bushes.map((b) => ({ x: b.x, z: b.z, r: 0.75 * b.s })), ...n.lampSpots.map((p) => ({ x: p.x, z: p.z, r: 0.3 }))]; }; // (as the scene walks round them: island.js)
  const AREAS = Object.fromEntries([['plaza', { x: P.x, z: P.z, label: D.NAMES.plaza }], ['notice', { ...PL.notice, label: D.NAMES.notice }], ['village', { ...PL.village, label: D.NAMES.village }],
    ['west', { x: -120, z: 10, label: D.NAMES.west }], ['lake', { x: D.LAKE.x, z: D.LAKE.z, label: D.NAMES.lake }], ['east', { x: 115, z: 20, label: D.NAMES.east }],
    ['isle', { x: D.ISLE.x, z: D.ISLE.z, label: D.NAMES.isle }], ['bay', { x: 0, z: 60, label: D.NAMES.bay }], ['ridge', { x: 0, z: -146, label: D.NAMES.ridge }]]);

  // (문제 기록 3회차 8 「있을 필요 없는 곳에도 돌·잡초, 하늘에 떠 있네」) where a small scattered piece -- a stone, a flower, a weed
  // -- sits: the drawn ground within its 0.3 m round never more than 0.09 m below its middle (no edge of it hangs in the air),
  // the formula's ground and the drawn one together (not a cliff's edge, where the 2 m mesh cuts the corner), and off the
  // walks and stairs
  function settledSpot(x, z) {
    const h = meshGroundHeight(x, z); if (Math.abs(ground(x, z) - h) >= 0.15 || walkDist(x, z) <= 0.3 || onStairs(x, z) || inFarmYard(x, z, 0.3)) return false;
    for (let a = 0; a < 8; a += 1) if (h - meshGroundHeight(x + Math.cos(a * Math.PI / 4) * 0.3, z + Math.sin(a * Math.PI / 4) * 0.3) > 0.09) return false;
    return true;
  }
  return Object.freeze({
    ...C,
    MAP: 'dalmaru', HOME_LOTS, onLot, GROUND: { size: SIZE, seg: SEG }, PLAZA_C, inPlaza,
    coastR: () => D.R_OUT, coastDist: D.coastDist, cliffAt, rawLand: D.landHeight, land, ground, meshGroundHeight, settledSpot, heightAt, walkable,
    streamDist: () => Infinity, walkDist, STREAMS: [], streamCurves: [], walkCurves, RIVER_WIDE: { pts: [] }, riverExtra: () => 0,
    streamDepth: () => 0, streamWaterHeight: () => SEA, POND: { x: 1e5, z: 1e5, r: 0 }, PADS,
    bridges, onBridge, deckAt, onStairs, STAIRS, PIER, DOCK, BREAKWATER: { x: 1e5, z: 1e5, ux: 1, uz: 0, half: 0, w: 0, deck: 0 }, bayR: D.R_BAY,
    fishWater, canFish: (x, z) => fishWater(x, z) !== null, ISLAND_RADIUS: 200, SPAWN: { x: PL.spawn.x, z: PL.spawn.z }, PLAZA_R: 0, PLAZA_H: P.h,
    seasonZoneAt, seasonAt, nature, natureSolids, harvestTrees, shoreSpots, AREAS, WATERFRONT, STRUCTURES, FACADE,
    structureSolids, paving, addNatureBlock, addTreeBlock: addNatureBlock, NICHES: PL.niches, SPOTS, facilityDoor, COTTAGES, BUILDINGS, RESERVED_LOTS: [], STATUE_SPOTS: [], plazaProps, villageSolids, inVillage: (x, z) => villageSolids().some((v) => Math.hypot(x - v.x, z - v.z) < v.r + 0.8),
    HALLOWEEN_FIELDS: PL.halloween.fields, HALLOWEEN_EXTRAS: PL.halloween.extras, dalmaru: D, VILLAGE, MUSEUM, FARM, CONTEST_STATUE,
    TOWNHALL, townhallLocal, townhallWorld, inTownhall, inTownhallYard,
  });
}));
