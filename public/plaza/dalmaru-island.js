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
  const ISLE2 = D.NEW_ISLE; // (N1 새 섬: dalmaru-terrain's)
  // (1.10.367 N1b §8) 별지기 느티: on the flat north-east of the bridge head (the dock 30 m, the camp ground's edge 34 m), 20 m off the forest loop -- seen from 별마루다리 and the train's viaduct
  const ANCIENT = Object.freeze({ x: 261, z: 197, yaw: 0, name: '별지기 느티', sign: Object.freeze({ x: 246, z: 193, yaw: Math.PI / 2 }) }); /* (its board at the clearing's edge, read from the forest loop) */
  const Q =(typeof self !== 'undefined' && self.IslandQuarry) || (typeof require === 'function' ? require('./island-quarry') : null); // (1.10.323 채석장)
  const SEA = D.SEA; const P = D.PLAZA; const PL = D.PLACES;
  const PLAZA_C = { x: P.x, z: P.z }; // 대청마당's middle (the fountain)
  // 묶음 4 내 집: 툇마루섬's twelve lots -- 2회차 15: laid out again on the isle widened toward 윤슬만 so that a 큰 집 (with
  // its veranda, 6.5 m round) stands 2 m clear of every walk, way, the pond, the station way and the other lots: by the walk
  // across the isle, a walk north from it and the station way; yaw: the house's front (-Z) square to its walk,
  // the walks below lead from each door to it (worked out once: gamecenter-notes docs/issue-log-review-20261021-b.md 15)
  // v1.10.230 울타리 마을 (gamecenter-notes docs/yard-fenced-20261102.md): the sixteen lots south of the ring, either side of the
  // village's street (z 236) -- each its fence's front at the street (a 1.4 m gate's way to it), the house 10 m behind the gate,
  // its front to the street; the fence goes back and out from the front as the yard is made bigger (island-yard FENCE).
  // 1~12 the houses of 툇마루섬 moved in lot for lot, 13~16 (the east end) empty; the north row's gap is the way down from the isle
  const STREET_Z = 236; const GATE_BACK = 10; // (the house's middle behind its gate)
  const HOME_LOTS = Object.freeze([
    ...[-126, -98, -70, -42, 14, 42].map((x) => ({ x, z: STREET_Z - 2.5 - 1.4 - GATE_BACK, yaw: Math.PI })),
    ...[-98, -70, -42, -14, 14, 42].map((x) => ({ x, z: STREET_Z + 2.5 + 1.4 + GATE_BACK, yaw: 0 })),
    ...[70, 98].map((x) => ({ x, z: STREET_Z - 2.5 - 1.4 - GATE_BACK, yaw: Math.PI })), ...[70, 98].map((x) => ({ x, z: STREET_Z + 2.5 + 1.4 + GATE_BACK, yaw: 0 })),
  ].map((l) => Object.freeze(l)));
  // the widest fence (26 x 24, lot-local: its front 10 m before the house, -z) and pad round it: nothing grows or stands in it
  const lotLocal = (l, x, z) => { const c = Math.cos(l.yaw); const s = Math.sin(l.yaw); const dx = x - l.x; const dz = z - l.z; return [dx * c - dz * s, dx * s + dz * c]; };
  const onLot = (x, z, pad = 0) => HOME_LOTS.some((l) => { const [lx, lz] = lotLocal(l, x, z); return Math.abs(lx) < 13 + pad && lz > -GATE_BACK - pad && lz < 14 + pad; });
  // what a house takes (the 6 x 5 m house and its steps, a little round it, and in front of its door -- island-home's
  // doorOf: 4.6 m toward the walk across the isle at z 140.5); trees and rocks may stand on the rest of the lot
  const onHouse = (x, z) => onLot(x, z, 1); // (v1.10.230: the whole fenced ground, not the house alone)
  // (v1.10.230: where 툇마루섬's houses stood, four little gardens -- a flower bed, a bench either side facing it -- the grass round
  // them left to grow; plazaProps lays them, the trees keep 4 m off)
  const ISLE_GARDENS = Object.freeze([[-9, 116], [9, 116], [-27, 129], [27, 129]].map(([x, z]) => Object.freeze({ x, z })));
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
    records: spot(PL.records, 'house', { wall: 0xf3e2ff, roof: 0x9b7fd6, size: [7, 8.7], front: 5.85, back: 2.85 /* (assets 75 records.hall -- 간판 ④ 「작은 일반 집」: 7 m across, 8.7 m deep with its porch steps, from 2.85 behind its spot to 5.85 before it) */ }), missions: spot(PL.missions, 'board', { tint: 0x8fd18a }),
    store: { ...facade(PL.facadeMall), kind: 'facade' }, townhall: { ...facade(PL.facadeTownhall), kind: 'facade' },
    board: { ...row(0), kind: 'board' }, map: { ...row(1), kind: 'mapboard' }, attendance: { ...row(3), kind: 'npc' }, donate: { x: 3.5, z: -62, face: [-9, -62], kind: 'donation' } /* (1.10.325 56A: the 기부함 to the 경제 앞뜰, by the 거래소; the row closed up) */,
    chat: spot(PL.chat, 'gazebo'), climb: spot(PL.climb, 'tower'), admin: spot(PL.admin, 'office', { wall: 0xe4e7ec, roof: 0x7b8794 }),
    jail: { ...PL.jail, face: [PL.jail.x, PL.jail.z + 10], kind: 'jail' }, // R4 구치소 (assets 67: 9.8 x 7.4 m; its door toward the camera -- the island's buildings never fade)
    // v1.10.320 섬 증권거래소 (assets 118; 사용자 22A, notes img/stocks-320 나): 대청마당's water side by 기록의 탑, its door to the fountain
    // -- the ground 9.6 x 7.7 m with its steps (its `footprint`), from 3.4 behind the spot to 4.3 before it; the door 4.9 out
    stocks: { x: 10.5, z: -64.5, face: [10.5, -84], kind: 'exchange', size: [9.6, 7.7], front: 3.8 },
  };
  const FACADE = { w: 30, d: 4.6 }; // (assets 55 facade.*: 30 wide, 4.6 out from the cliff)
  function facilityDoor(id) {
    const s = SPOTS[id]; if (!s) return null;
    const depth = s.size?.[1] ?? { hall: 10, tower: 6.4, house: 2.7, office: 2.7, board: 0.3, donation: 0.9, mapboard: 0.3, gazebo: 2.4, npc: 0.9, stall: 1.3, desk: 1.2, facade: FACADE.d, jail: 7.4 }[s.kind];
    const distance = s.front != null ? s.front + 1.1 : s.kind === 'facade' ? FACADE.d + 1.6 : Math.max(1.4, depth / 2 + 1.3) + (s.kind === 'hall' ? 2.6 : 0);
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
    lamps: Object.freeze(PL.hallLamps.map(([x, z]) => Object.freeze({ x, z, r: 0.4 }))), electrician: off({ x: PL.hallLamps[0][0], z: PL.hallLamps[0][1] }, 0.6, 1.9), /* (T1: the lamps out at the taxi road's walk's edge -- he stands on that edge, by the walk) */
    toolbox: prop({ ...off({ x: PL.hallLamps[0][0], z: PL.hallLamps[0][1] }, -2.1, 2.6), face: [PLAZA_C.x, PLAZA_C.z] }, 0.4),
    stones: Object.freeze({ ...PL.stones, yaw: stoneYaw }), builder: off(PL.stones, 4.2, -2),
    bookcart: prop(PL.bookcart, 0.8), librarian: off(PL.bookcart, 2.1, -1.1),
    omokTable: prop(PL.omokTable, 1.4), grandpa: off(PL.omokTable, -0.1, 2.8),
    mailbox: prop(row(2), 0.5) /* (1.10.325: up the row where the 기부함 was) */, guide: prop({ x: PL.spawn.x - 2, z: PL.spawn.z + 2, face: [PL.spawn.x, PL.spawn.z] }, 0.45), /* (the guide beside 첫 접속's spot) */ birthday: prop(PL.birthday, 0.3),
  });
  const villageSolids = () => [VILLAGE.mural, VILLAGE.easel, VILLAGE.busk, ...VILLAGE.buskBenches, VILLAGE.buskLamp, ...VILLAGE.lamps, VILLAGE.toolbox, VILLAGE.bookcart, VILLAGE.omokTable, VILLAGE.mailbox, /* (1103 9: no guide standing apart -- its spot open) */ MUSEUM];
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
  // T1 길 넓히기 (notes docs/island-expansion-20261115.md §9, 171A; island-taxi ROAD): the taxi road's two lanes and its walks,
  // 3.9 m each side of its middle -- nothing solid in it (roadClear); a thing put by rule near it goes out to its edge (roadFoot:
  // the nearest point on the middle, the road's left-hand normal there, which side the point is on)
  const TX = (typeof self !== 'undefined' && self.IslandTaxi) || (typeof require === 'function' ? require('./island-taxi.js') : null);
  const ROAD = TX?.ROAD || { lane: 2.3, walk: 1.6, half: 3.9 };
  const ROADS = TX ? (TX.ROADS || [TX.ROUTE]) : []; /* (1.10.395 N4-c: the road on to 별마루섬 too) */
  const roadDist = (x, z) => { let d = Infinity; for (const r of ROADS) d = Math.min(d, lineDist(x, z, r)); return d; };
  const roadClear = (o, r) => roadDist(o.x, o.z) > ROAD.half + r + 0.1;
  function roadFoot(x, z) {
    let best = null;
    for (const route of ROADS) for (let i = 1; i < route.length; i += 1) {
      const [ax, az] = route[i - 1]; const [bx, bz] = route[i]; const dx = bx - ax; const dz = bz - az; const L = Math.hypot(dx, dz) || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (L * L))); const px = ax + dx * t; const pz = az + dz * t; const d = Math.hypot(x - px, z - pz);
      if (!best || d < best.d) best = { d, x: px, z: pz, nx: dz / L, nz: -dx / L };
    }
    if (best) best.side = Math.sign((x - best.x) * best.nx + (z - best.z) * best.nz) || 1;
    return best;
  }
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
    // (v1.10.224 섬 가꾸기 동쪽 강 새 다리: off 잔치마루's walk to 은하내's mouth -- stopping on the bank, the bridge itself the
    // project's; over it a step onto 강 어귀 낚시터, the little rise between the river and the sea)
    { tier: 'walk', w: 2.8, pts: [[115.2, 9.3], [132, 2], [148, -5], [159, -10.1]] }, { tier: 'trail', w: 2, pts: [[163.7, -20], [163.9, -21.8]] },
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
    // (v1.10.230 울타리 마을: the way down from 툇마루섬 under the ring, the village's street, and each gate's way to its door)
    { tier: 'walk', w: 3, pts: [[-20, 141.5], [-20, 175], [-20, 205], [-20, STREET_Z]] },
    { tier: 'walk', w: 5, pts: [[-126, STREET_Z], [-20, STREET_Z], [98, STREET_Z]] }, // (from the west lot's gate to the east lot's: the open land past it, for later)
    ...HOME_LOTS.map((l) => { const s = Math.cos(l.yaw); return { tier: 'trail', w: 1.4, pts: [[l.x, l.z - s * 6.9], [l.x, STREET_Z - s * 2.5]] }; }),
    { tier: 'walk', w: 2.8, pts: [stairsAt(35.6, 1.7), stairsAt(36, -1.5), stairsAt(36, -4.5), stairsAt(35.8, -6.4), po(STAIRS_TOP_DEG + 4, 138) /* (문제 기록 4회차: on the top's fill, not its edge, and toward the ridge from where the stairs now end -- 216° stayed when they moved) */, ...[222, 230, 238, 246, 254].map((a) => po(a, 138)), po(261, 141), stationPt(270 - 2, 155)] }, // 능선 위 길 → 영웅마루역 (from the top step sideways onto the ridge: past the top the cliff drops)
    ...(Q ? [{ tier: 'trail', w: 2.4, pts: Q.WALK.map((p) => [p.x, p.z]) }] : []), // (1.10.323 채석장, 28A: from 영웅마루역 on along the ridge, r 150, 79 m east into the quarry)
    // N1 새 섬 (notes island-expansion §8-2): the village street on east to 새 섬다리 (the open land past the east lots), and over
    // it the walk from the bridge head to the camp ground, the way to the pier, the forest loop round the island, the path up
    // the peak and the one by the creek -- 자연 구역: the walks round the camp, the rest 오솔길
    { tier: 'walk', w: 5, pts: [[98, STREET_Z], [140, 232], [162.5, ISLE2.bridgeZ], [196, ISLE2.bridgeZ], [229.5, ISLE2.bridgeZ]] }, /* (on over 새 섬다리, as the walks over 윤슬다리) */
    { tier: 'walk', w: 3, pts: [[229.5, ISLE2.bridgeZ], [240, 236], [243, 248]] },
    { tier: 'walk', w: 2.6, pts: [[243, 248], [249, 236], [262, 231.5], [277, 240], [278.5, 252], [273, 262], [259, 268.5], [245, 262], [243, 248]] }, /* (round the camp ground's flat: where its walks meet) */
    { tier: 'walk', w: 2.6, pts: [[249, 236], [243, 222], [236, 208], [235.5, 202]] }, /* (on to the forest loop by the pier's root -- N3's pier on from here) */
    { tier: 'trail', w: 2.4, pts: [[273, 262], [293, 296], [327, 338], [375, 352], [427, 334], [469, 292], [489, 236], [477, 178], [441, 128], [389, 102], [333, 104], [289, 126], [259, 160], [240, 188], [235.5, 202]] },
    { tier: 'trail', w: 2.4, pts: [[277, 240], [297, 232], [319, 244], [341, 228], [335, 208], [357, 198], [371, 216], [393, 212], [414, 201], [437, 191], [460, 184], [477, 178]] }, /* (over the peak and down its east side to the loop) */
    { tier: 'trail', w: 2, pts: [[284.5, 131.1], [298, 144], [320, 156.5], [340, 166.5], [359.5, 180], [358, 196.5]] }, /* (on the creek's north-east bank all the way: from the loop past its footbridge, by the spring, up to the peak's path) */
    // 1.10.369 N1b §9 오솔길 (사용자 「전부 A」, notes img/forest-369/zones-proposal.png): three narrow ways from the walks into the wood --
    // to 별지기 느티's clearing, from the peak's path down through the wood to the loop (south-west and east); their branches meet
    // overhead (`narrow`: not a 산책길 -- the zones' own)
    { tier: 'trail', w: 1.5, narrow: true, pts: [[243, 222], [246, 217], [248, 213]] }, /* (to the clearing's edge, 20 m from the trunk -- off its roots) */
    { tier: 'trail', w: 1.5, narrow: true, pts: [[319, 244], [314, 262], [304, 280], [293, 296]] },
    { tier: 'trail', w: 1.5, narrow: true, pts: [[414, 201], [421, 230], [433, 262], [457.5, 307.3]] }, /* (onto the east trail's band -- no end in the air: walk-ends.test) */
  ];
  const walkCurves = WALKS.map((w) => ({ w: w.w, tier: w.tier, ...(w.narrow ? { narrow: true } : {}), pts: catmull(w.pts, 0.8) }));
  // (1.10.369: each curve's box first -- one farther than the nearest so far is skipped; the same distance, some 10x quicker)
  for (const w of walkCurves) { let x0 = Infinity; let x1 = -Infinity; let z0 = Infinity; let z1 = -Infinity; for (const [x, z] of w.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } w.box = [x0, x1, z0, z1]; }
  const boxDist = (x, z, b) => Math.hypot(Math.max(b[0] - x, 0, x - b[1]), Math.max(b[2] - z, 0, z - b[3]));
  const walkDist = (x, z) => { let d = Infinity; for (const w of walkCurves) { if (boxDist(x, z, w.box) - w.w / 2 >= d) continue; d = Math.min(d, lineDist(x, z, w.pts) - w.w / 2); } return d; };
  // 1.10.369 N1b §9 별마루섬 구역 (사용자 「동산, 숲속, 산책길, 오솔길 나눠서 처리해」 「전부 A」, notes img/forest-369/zones-proposal.png): every point
  // of the island one of four -- 동산 (open slopes: the bridge head, round the camp ground, the lookout, the meadow south below the peak,
  // and 별지기 느티's clearing), 오솔길 (6 m either side of the three narrow ways), 산책길 (7 m either side of the walks), 숲속 (the rest).
  // The trees, the light and N2a (the tigers keep to 숲속, bikes to 동산 and 산책길) read it
  const ISLE2_ZONES = Object.freeze({ HILL: 'hill', DEEP: 'deep', WALK: 'walk', TRAIL: 'trail', WALK_BAND: 7, TRAIL_BAND: 6 });
  let isle2Curves = null; const isle2Walks = () => (isle2Curves ||= { main: walkCurves.filter((w) => !w.narrow && w.pts.some(([x, z]) => D.newIsleCoast(x, z) > -30)), narrow: walkCurves.filter((w) => w.narrow) });
  const curveDist = (x, z, list) => { let d = Infinity; for (const w of list) { if (boxDist(x, z, w.box) - w.w / 2 >= d) continue; d = Math.min(d, lineDist(x, z, w.pts) - w.w / 2); } return d; };
  function isle2Zone(x, z) {
    if (!ISLE2 || D.newIsleCoast(x, z) < 0) return null;
    const a = Math.hypot(x - ANCIENT.x, z - ANCIENT.z); if (a < 18) return ISLE2_ZONES.HILL;
    const C = ISLE2.camp; const P = ISLE2.peak; const { main, narrow } = isle2Walks();
    if (curveDist(x, z, narrow) < ISLE2_ZONES.TRAIL_BAND) return ISLE2_ZONES.TRAIL;
    if (a > 34 && (Math.hypot(x - 229.5, z - ISLE2.bridgeZ) < 30 || Math.hypot(x - C.x, z - C.z) < C.r + 34 || Math.hypot(x - P.x, z - P.z) < 30 || Math.hypot((x - P.x) / 52, (z - (P.z + 50)) / 30) < 1)) return ISLE2_ZONES.HILL;
    return curveDist(x, z, main) <= ISLE2_ZONES.WALK_BAND ? ISLE2_ZONES.WALK : ISLE2_ZONES.DEEP;
  }

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
    ...Object.values(SPOTS).filter((s) => s.kind !== 'facade' && s.kind !== 'hall' && !inPlaza(s.x, s.z)).map((s) => [s.x, s.z, s.size ? Math.max(s.front ?? 0, ...s.size.map((v) => v / 2)) + 0.6 : s.kind === 'tower' ? 4.5 : 3.5]),
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
    return roadBank(x, z, h);
  }
  // T1 고침 (문제 기록 11-18 「인도까지 바닷물이 올라와 … 모래사장 구간, 인도 구간 명확히」): where the taxi road runs by the sea its
  // lanes and walks lay at the sea's height and under it -- the road now on a low bank: the ground under them and half a metre past
  // the walk's edge at least 0.75 m over the sea, then down to the water as a beach (0.3 m a metre, about 2.5 m of sand). Only ever
  // raised; never within 4 m of a bridge's ends (their decks lie on the ground as it was). A grid of the road's pieces (8 m) for speed
  const BANK_TOP = SEA + 0.75; const BANK_SLOPE = 0.3; const BANK_REACH = ROAD.half + 0.5 + (BANK_TOP - SEA + 0.5) / BANK_SLOPE;
  const BANK_ROUND = 1.0; let bankGrid = null; /* (a rounded max over 1 m: path-paving's slabs over the 2 m mesh cells) */
  function roadBank(x, z, h) {
    if (h >= BANK_TOP + BANK_ROUND || !TX) return h;
    if (!bankGrid) {
      bankGrid = new Map(); const R = TX.ROUTE;
      for (let i = 1; i < R.length; i += 1) { const [ax, az] = R[i - 1]; const [bx, bz] = R[i];
        for (let cx = Math.floor((Math.min(ax, bx) - BANK_REACH) / 8); cx <= Math.floor((Math.max(ax, bx) + BANK_REACH) / 8); cx += 1) for (let cz = Math.floor((Math.min(az, bz) - BANK_REACH) / 8); cz <= Math.floor((Math.max(az, bz) + BANK_REACH) / 8); cz += 1) { const k = `${cx},${cz}`; if (!bankGrid.has(k)) bankGrid.set(k, []); bankGrid.get(k).push(i); } }
    }
    const segs = bankGrid.get(`${Math.floor(x / 8)},${Math.floor(z / 8)}`); if (!segs) return h;
    for (const b of D.BRIDGES) if (Math.abs(x - b.x) < (b.bank || b.length) / 2 + 4 && Math.abs(z - b.z) < 2.8 + 4) return h;
    const R = TX.ROUTE; let d = Infinity;
    for (const i of segs) { const [ax, az] = R[i - 1]; const [bx, bz] = R[i]; const dx = bx - ax; const dz = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1e-9))); const e = Math.hypot(x - ax - dx * t, z - az - dz * t); if (e < d) d = e; }
    if (d >= BANK_REACH) return h;
    const e = d - ROAD.half - 0.5; const drop = e <= -0.5 ? 0 : e >= 0.5 ? e : (e + 0.5) ** 2 / 2; /* (the bank's edge rounded over 1 m too) */
    const top = BANK_TOP - drop * BANK_SLOPE;
    /* (a rounded max: where the bank meets the ground no sharp crease -- the 마을 길 slabs lean flat over it) */
    /* (none on a flattened pad -- the stations' stand level, as before the rounding -- eased in over its 5 m edge) */
    let k = BANK_ROUND; for (const p of PADS) { if (Math.abs(x - p.x) >= p.r + 5 || Math.abs(z - p.z) >= p.r + 5) continue; k = Math.min(k, BANK_ROUND * smooth(p.r, p.r + 5, Math.hypot(x - p.x, z - p.z))); }
    const gap = Math.abs(h - top); return Math.max(h, top) + (gap < k ? ((k - gap) ** 2) / (4 * k) : 0);
  }
  const ground = (x, z) => D.ground(x, z) + (land(x, z) - D.landHeight(x, z)); // (no pad or fill is near water)
  const isWater = (x, z) => ground(x, z) < SEA || D.inHeadPond(x, z) || D.inCreek(x, z); // (2회차 18: the ponds over the falls are water too; N1: 새 섬's creek)
  // (N1 새 섬 개울) its water's face: 0.45 m over its bed at the middle nearest, never under the sea's -- the drawn ribbon (island.js)
  // and the fishing float (362 Codex 351-360 #7: the float lay at the sea's height, under the ground up the creek) read the same
  function creekWaterY(x, z) {
    const C = D.CREEK; if (!C) return SEA; let best = Infinity; let gx = x; let gz = z;
    for (let i = 1; i < C.pts.length; i += 1) { const [ax, az] = C.pts[i - 1]; const [bx, bz] = C.pts[i]; const dx = bx - ax; const dz = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))); const px = ax + dx * t; const pz = az + dz * t; const d = Math.hypot(x - px, z - pz); if (d < best) { best = d; gx = px; gz = pz; } }
    return Math.max(ground(gx, gz) + 0.45, SEA + 0.03);
  }
  const slopeAt = (x, z) => Math.hypot(ground(x + 1, z) - ground(x - 1, z), ground(x, z + 1) - ground(x, z - 1)) / 2;
  // (동산 다듬기: the scenery is picked on the ground as it was before the 동산 shapes -- the same seeded picks, so nothing
  // moves; only what then stands on a steep new bank is left out, afterwards)
  const brushAt = D.brushAt || (() => 0);
  const slopeBefore = (x, z) => Math.hypot(ground(x + 1, z) - brushAt(x + 1, z) - ground(x - 1, z) + brushAt(x - 1, z), ground(x, z + 1) - brushAt(x, z + 1) - ground(x, z - 1) + brushAt(x, z - 1)) / 2;
  const walkableBefore = (x, z) => Boolean(onBridge(x, z) || onStairs(x, z) || inRect(PIER, x, z) || onDock(x, z)) || (!isWater(x, z) && slopeBefore(x, z) < 0.9 && D.coastDist(x, z) > 1.2 && !underDrawnRock(x, z));
  const onBank = (o, limit) => D.BRUSHES?.some((b) => Math.hypot(o.x - b.x, o.z - b.z) < b.r) && slopeAt(o.x, o.z) >= limit;

  // ---- bridges: 윤슬다리 (its arched deck the model's), and a plain one wherever a walk crosses a river ----
  const YB = { rise: 3.2, top: 0.43 }; // the model's deck: rise * sin(πt) over its ends, its planks' top 0.43 over that
  /* (1.10.389 N3-a, assets 133 deck-profile.json: the high one's planks over its base line -- flat 13 m at the top, 0.27 down each
     ramp, the bends rounded over 3 m; its last 2 m eased to meet each bank, which stand 0.12 / 0.33 m under its ends) */
  const HB = { flat: 8, rise: 5.4, b: 1.5, top: 0.43, ease: 2 };
  const hbProfile = (u, half) => { const g = HB.rise / (half - HB.flat); const d = Math.abs(u) - HB.flat; return d <= -HB.b ? HB.rise : d < HB.b ? HB.rise - g * (d + HB.b) ** 2 / (4 * HB.b) : Math.max(0, HB.rise - g * d); };
  const bridges = D.BRIDGES.map((b) => {
    const ends = b.ends.map(([x, z]) => (b.high ? ground(x, z) : D.ground(x, z))); /* (389: the high one meets the ground as walked -- the road's bank cut its east bank 0.4 m under the raw one) */
    if (b.high) return { x: b.x, z: b.z, ux: 1, uz: 0, half: b.length / 2, w: 5.6, high: true, base: Math.max(...ends, SEA) - HB.top + 0.12, e0: ends[0] + 0.02, e1: ends[1] + 0.02, get deck() { return this.base + HB.top; }, modelTop: (u) => HB.top + hbProfile(u, b.length / 2), model: 'dalmaru.bridge_yunseul_high' };
    return { x: b.x, z: b.z, ux: 1, uz: 0, half: b.length / 2, w: 5.6, arch: YB.rise, base: Math.max(...ends, SEA) - YB.top + 0.12, get deck() { return this.base + YB.top; }, model: 'dalmaru.bridge_yunseul', ...(b.isle2 ? { isle2: true } : {}) };
  });
  /* (the ease at least 2 m, longer where the bank stands lower -- no steeper than the ramp's 0.27 + 0.18: the east bank, cut by the
     road's bank, 0.73 under the planks' end -> 4 m) */
  const highDeck = (b, u) => { const y = b.base + b.modelTop(u); const drop = (u < 0 ? b.e0 : b.e1) - (b.base + HB.top); const L = Math.max(HB.ease, Math.abs(drop) / 0.18); const e = b.half - Math.abs(u); return e >= L ? y : y + drop * (1 - Math.max(0, e) / L); };
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
    walk.pts.forEach(([x, z], i) => { const d = Math.min(D.riverDist(x, z), D.creekDist(x, z) + 0.6); /* (N1: over 새 섬's creek too -- its banks the less) */ if (d < 0.8) { if (!run || d < run.d) run = { d, i, x, z }; } else if (run) add(); });
    if (run) add();
  }
  function onBridge(x, z) {
    for (const b of bridges) {
      const dx = x - b.x; const dz = z - b.z; const u = dx * b.ux + dz * b.uz; const v = -dx * b.uz + dz * b.ux;
      if (Math.abs(u) <= b.half && Math.abs(v) <= b.w / 2) return { b, u };
    }
    return null;
  }
  const deckAt = (hit) => (hit.b.high ? highDeck(hit.b, hit.u) : hit.b.arch ? hit.b.base + YB.top + hit.b.arch * Math.sin((Math.PI * (hit.u + hit.b.half)) / (2 * hit.b.half)) : hit.b.e0 !== undefined ? hit.b.e0 + (hit.b.e1 - hit.b.e0) * (hit.u / hit.b.half + 1) / 2 + Math.max(0.35, hit.b.deck + 0.35 - (hit.b.e0 + hit.b.e1) / 2) * (1 - (hit.u / hit.b.half) ** 2) : hit.b.deck + 0.35 * (1 - (hit.u / hit.b.half) ** 2));
  // 달끝나루 (assets 55 pier.dalkkeut: 20 m out from its root, deck top 0.69 over it) straight out from the east cape, and
  // 배 타는 곳 (dock.boat) off 물가 거리 before 대청마당 -- both walked on
  const CAPE = D.CAPES[1]; const pierL = Math.hypot(PL.pier.x - CAPE.x, PL.pier.z - CAPE.z);
  const PIER_DIR = [(PL.pier.x - CAPE.x) / pierL, (PL.pier.z - CAPE.z) / pierL];
  const pierY = Math.max(SEA, D.ground(PL.pier.x, PL.pier.z)) - 0.5; // (its deck a step over the beach at its root)
  const PIER = { x: PL.pier.x + PIER_DIR[0] * 10, z: PL.pier.z + PIER_DIR[1] * 10, ux: PIER_DIR[0], uz: PIER_DIR[1], half: 10, w: 3.6, deck: pierY + 0.69, root: { x: PL.pier.x, z: PL.pier.z, y: pierY, yaw: Math.atan2(PIER_DIR[0], PIER_DIR[1]) } }; // (its front, the far end, out to sea)
  // (dock.boat: a 12 x 3 m float, its gangway 4.2 m back to the shore -- the model's -Z, here north)
  // (문제 기록 5회차 2 「하늘에 떠 있어」: at y 0 its deck stood 0.75 m over the sea -- a float rides low: 0.4 m; v1.10.190 assets
  // 81: on piles down to the sand, its gangway level)
  const DOCK_Y = -0.35;
  const DOCK = { x: PL.dock.x, z: PL.dock.z - 2, root: { x: PL.dock.x, z: PL.dock.z - 2, y: DOCK_Y, yaw: 0 },
    rects: [{ x: PL.dock.x, z: PL.dock.z - 2, ux: 1, uz: 0, half: 6, w: 3, deck: 0.15 + DOCK_Y }, { x: PL.dock.x, z: PL.dock.z - 5.6, ux: 0, uz: 1, half: 2.3, w: 1.6, deck: 0.3 + DOCK_Y },
      { x: PL.dock.x, z: PL.dock.z - 8.1, ux: 0, uz: 1, half: 0.22, w: 1.8, deck: 0.03 + DOCK_Y }] }; // (v1.10.190, assets 81: the stone steps off the gangway's land end, world z -4.6)
  /* 1.10.389 N3-a (notes n3-plan-20261120 §3-3 · §4-1): 별마루섬 부두 -- the same dock.boat once more off its west-north-west shore by the
     bridge head, its float north-south (x 222.1 ~ 225.1, z 191 ~ 203), its gangway east onto the beach (its steps' end where the beach is
     walked, 1.2 m in from the water); walked on as 배 타는 곳 is */
  const dockAt = (p, yaw) => { const gx = -Math.sin(yaw); const gz = -Math.cos(yaw); const ax = Math.cos(yaw); const az = -Math.sin(yaw);
    return { x: p.x, z: p.z, root: { x: p.x, z: p.z, y: DOCK_Y, yaw }, rects: [{ x: p.x, z: p.z, ux: ax, uz: az, half: 6, w: 3, deck: 0.15 + DOCK_Y }, { x: p.x + gx * 3.6, z: p.z + gz * 3.6, ux: gx, uz: gz, half: 2.3, w: 1.6, deck: 0.3 + DOCK_Y },
      { x: p.x + gx * 6.1, z: p.z + gz * 6.1, ux: gx, uz: gz, half: 0.22, w: 1.8, deck: 0.03 + DOCK_Y }] }; };
  const DOCK2 = ISLE2 && PL.dock2 ? dockAt(PL.dock2, -Math.PI / 2) : null;
  const DOCKS = [DOCK, ...(DOCK2 ? [DOCK2] : [])];
  const onDock = (x, z, grow = 0) => { for (const d of DOCKS) { const r = d.rects.find((o) => inRect(o, x, z, grow)); if (r) return r; } return undefined; };
  const inRect = (r, x, z, grow = 0) => { const dx = x - r.x; const dz = z - r.z; return Math.abs(dx * r.ux + dz * r.uz) <= r.half + grow && Math.abs(-dx * r.uz + dz * r.ux) <= r.w / 2 + grow; };

  function heightAt(x, z) {
    const hit = onBridge(x, z); if (hit) return deckAt(hit);
    const st = onStairs(x, z); if (st) return Math.max(STAIRS.base + stairRise(st.u), ground(x, z));
    if (inRect(PIER, x, z)) return PIER.deck;
    const dock = onDock(x, z); if (dock) return dock.deck;
    if (Q && Math.abs(x - Q.DECK.x) < 3 && Math.abs(z - Q.DECK.z) < 3) { const lift = Q.deckLift(x, z); if (lift !== null) return Math.max(ground(Q.DECK.x, Q.DECK.z), SEA) + lift; } // (1.10.342 채석장: the waterfall deck's boards and steps, over its foot)
    const g = Math.max(ground(x, z), SEA); if (Math.abs(x) >= 290 || Math.abs(z) >= 290 || !bulgy(x, z)) return g; /* (the main ground's mesh only -- 별마루섬 its own) */
    // (361 문제 기록 2d83e547·618fce8f 「공중에 떠있어」, 사용자 1A: on a cliff's top edge the drawn ground (its 2 m cells) already goes down
    // -- one stood up to 1.1 m over it; there one stands on what is drawn, eased in from 0.1 m over it to all of it at 0.35 m)
    const gap = g - Math.max(meshGroundHeight(x, z), SEA); return gap > 0.1 ? g - smooth(0.1, 0.35, gap) * gap : g;
  }
  // (the drawn cells where the ground rises over the drawn one by more than 0.1 m somewhere inside -- looked at once each, 3 x 3 points)
  const bulgeCells = new Map();
  function bulgy(x, z) {
    const i = Math.floor((x + HALF) / STEP); const j = Math.floor((z + HALF) / STEP); const key = i * 65536 + j; let v = bulgeCells.get(key);
    if (v === undefined) { v = false; const cx = i * STEP - HALF; const cz = j * STEP - HALF; for (let a = 1; a <= 3 && !v; a += 1) for (let b = 1; b <= 3 && !v; b += 1) { const px = cx + (STEP * a) / 4; const pz = cz + (STEP * b) / 4; if (Math.max(ground(px, pz), SEA) - Math.max(meshGroundHeight(px, pz), SEA) > 0.1) v = true; } bulgeCells.set(key, v); }
    return v;
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
      /* (1.10.355 사용자 「고쳐」: 거울호수 is dug wider than its ellipse -- the probe on the lake's own water past lakeDist 0.5 read as a
         river, three in four of its shore; within 4 m of the ellipse and nearer it than any river, the lake) */
      if ((D.lakeDist(wx, wz) < 4 && D.lakeDist(wx, wz) < D.riverDist(wx, wz)) || Math.hypot((wx - D.ISLE_POND.x) / D.ISLE_POND.rx, (wz - D.ISLE_POND.z) / D.ISLE_POND.rz) < 1.2) return 'lake';
      return 'river';
    }
    return null;
  }
  const SIZE = 590; const SEG = 236; /* (v1.10.230: 380 -> 590 for the village south of the ring -- the same 2.5 m step, every point of the ground as before) */ const STEP = SIZE / SEG; const HALF = SIZE / 2; // the ground mesh: 2.5 m (step 1; the far rings come with the phone check)
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
      // (T1: where the taxi road runs by the water, the lamp on its land-side walk's outer edge and the bench behind it -- out
      // from the bay till clear of the road)
      const outward = (r0, room) => { let rr = r0; while (rr < r0 + 9 && roadDist(...bayAt(a, rr)) < ROAD.half + room) rr += 0.2; return bayAt(a, rr); };
      if (k % 3 === 1) { const [lx, lz] = outward(103.1, 0.55); lamps.push({ x: lx, z: lz, r: 0.3 }); }
      if (k % 6 === 3) { const [bx, bz] = outward(104.6, 1.3); benches.push({ x: bx, z: bz, yaw: Math.atan2(-bx, D.BAY_Z - bz), r: 0.9 }); } // (a bench's +Z, its front, toward the water)
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
  // 1.10.338 섬 경매장 (notes island-auction-20261115 51C, plaza-relayout 55A; assets 137): the 경매 게시판 at (-9, -64), its face (the
  // model's -Z) east to the 물가 거리-분수 axis -- across the 13 m 「경제 거리」 from the 증권거래소; SPACE at (-6.9, -64), 4 m clear before
  // it; its plinth's three circles (solids.json, r 0.52 at the model's x -1.45 / 0 / 1.45, z 0.06)
  // (1.10.346 사용자 155A C안: from (-9, -64) facing east -- its side to the fountain and the main walk, the birthday corner behind it --
  // to (-4.1, -68.5) beside the north walk, its face to the fountain; SPACE 2.1 m before it)
  const AUCTION_BOARD = Object.freeze({ x: -4.1, z: -68.5, yaw: yawTo(-4.1, -68.5, [0, -84]), stand: Object.freeze({ x: -3.56, z: -70.53 }) });
  // (155A: the birthday corner keeps its one small circle -- it stands only on a birthday; circles across its banner would be walls
  // nobody sees on the other days, dalmaru-walk unseen)
  const auctionSolids = () => [-1.45, 0, 1.45].map((u) => { const B = AUCTION_BOARD; return { x: B.x + Math.cos(B.yaw) * u + Math.sin(B.yaw) * 0.06, z: B.z - Math.sin(B.yaw) * u + Math.cos(B.yaw) * 0.06, r: 0.52 }; });
  // v1.10.250 기록의 탑 (assets 100 record_tower): before the 게임관's door, its front (-Z) to the door (+x); its ground 8.55 m along
  // world z (the model's x -4.95 ~ +3.6) and 1.94 m deep (its z -1.385 ~ +0.55 -> world x +1.385 ~ -0.55): circles over it
  // (v1.10.253 탑 자리 옮기기, 사용자 「동상을 가리게 되는 배치야. 그 앞에 있는 화단위로 옮기고 그 화단에 있는 나무는 없애」) on the long
  // garden before the 게임관 (paving's (24, 18) from the fountain): the board along its length, the podium (local +z) to the
  // plaza's middle (south); its 8.55 m ground set in the garden's 10 m (the model's x -4.95 ~ +3.6, turned: x 3.6 west ~ 4.95 east)
  const RECORD_TOWER = Object.freeze({ x: PLAZA_C.x + 24 - 0.675, z: PLAZA_C.z + 18.4, yaw: Math.PI, lift: 0.45 }); // (lift: on the garden's soil)
  function towerSolids() { // (along the board, its middle 0.42 m to the podium's side -- v1.10.251)
    const R = RECORD_TOWER; const ax = Math.cos(R.yaw); const az = -Math.sin(R.yaw); const bx = Math.sin(R.yaw); const bz = Math.cos(R.yaw); const out = [];
    for (let u = -4.45; u <= 3.11; u += 0.8) out.push({ x: R.x + ax * u + bx * 0.42, z: R.z + az * u + bz * 0.42, r: 0.98 });
    return out;
  }
  const ISLE_SIGN_IN = 8.3; // (툇마루섬's board, its middle this far in from the isle's centre: 7.3 -> 8.3 in T1, off the road's walk -- plaza-scene draws it here)
  /* 1.10.389 N3-a (notes n3-plan-20261120 §3-2 · 위험 1): the high bridge's ramps run 9 m over land each side -- one coming in from the side
     would rise onto the planks (up to 4 m), one going off them would drop. Where its planks stand over 0.4 m above the walkable ground
     beside them, its sides are walled: 0.4 m circles every 0.5 m just out of its walk (3.25 m off its line; the rails stand at 3.2) */
  let guards_ = null;
  function rampGuards() {
    if (guards_) return guards_; const out = [];
    /* (1.10.396 문제 기록 937dce24 「다리 끝에서 자전거가 묻힘」, 검토 isle2-fence-bridge-whale: the two low model bridges too -- their sides
       over walkable sand stood up to 0.78 m over one's feet; their side kept from 0.15 m over the ground (the high one's ramps 0.4)) */
    for (const b of bridges) { if (!b.model) continue; const rise = b.high ? 0.4 : 0.15;
      for (let u = -b.half; u <= b.half + 1e-6; u += 0.5) for (const v of [-3.25, 3.25]) { const x = b.x + b.ux * u - b.uz * v; const z = b.z + b.uz * u + b.ux * v; if (deckAt({ b, u }) - ground(x, z) > rise && walkable(x, z)) out.push({ x, z, r: 0.4, guard: true }); } }
    return (guards_ = out);
  }
  function structureSolids() {
    const out = [{ x: PL.lighthouse.x, z: PL.lighthouse.z, r: 3.2 }, { x: D.ISLE.x - 4, z: D.ISLE.z - ISLE_SIGN_IN, r: 1.1 }, ...pavingSolids(), ...auctionSolids()];
    for (let u = 1.1; u <= SL - 2; u += 0.5) for (const v of [-0.05, 3.45]) out.push( /* (the rails' run: the foot and the top meet level ground, nothing drawn there to stop one) */{ x: STAIRS.x + STAIRS.ux * u + STAIRS.nx * v, z: STAIRS.z + STAIRS.uz * u + STAIRS.nz * v, r: 0.28, rail: true });
    for (const n of PL.niches) for (let lx = -0.4 * n.m; lx <= 0.4 * n.m + 1e-6; lx += 0.8) out.push({ x: n.x + Math.cos(n.yawToCentre) * lx + Math.sin(n.yawToCentre) * 0.6, z: n.z - Math.sin(n.yawToCentre) * lx + Math.cos(n.yawToCentre) * 0.6, r: 0.6 });
    /* (316 ④ `batch`: drawn instanced -- the map check counts them as seen) */
    for (const r of WATERFRONT.rails) for (const d of [-1.6, -0.55, 0.55, 1.6]) out.push({ x: r.x + Math.cos(r.yaw) * d, z: r.z - Math.sin(r.yaw) * d, r: 0.3, batch: true });
    for (const l of WATERFRONT.lamps) out.push({ x: l.x, z: l.z, r: l.r, batch: true });
    for (const b of WATERFRONT.benches) out.push({ x: b.x, z: b.z, r: b.r, batch: true });
    for (const p of farmFence()) out.push({ ...p, r: 0.22, fence: true }); // (3회차 15: the farm's fence, its shed and scarecrow)
    { const s = FARM.yard.shed; for (const dx of [-1, 0, 1]) for (const dz of [-0.6, 0.6]) out.push({ x: s.x + dx, z: s.z + dz, r: 0.8 }); }
    out.push({ ...FARM.yard.scarecrow, r: 0.35 });
    out.push(...towerSolids()); // (v1.10.250: the islanders' routes and the player keep off 기록의 탑)
    out.push(...exchangeSolids()); // (v1.10.320: and off the 증권거래소)
    if (Q) out.push(...Q.solidsOf()); // (1.10.323 채석장: its rocks, the sign and the ore pile -- assets 129 circles)
    out.push(...rampGuards()); // (1.10.389: the high bridge's ramps' sides over land)
    return out;
  }
  // v1.10.320 섬 증권거래소: its ground's edge all round (0.5 m circles every 0.5 m, 0.3 in) and its middle filled -- in its own
  // frame (lx across, lz toward its front: from -3.4 to +4.3, assets 118 `footprint`)
  function exchangeSolids() {
    const s = SPOTS.stocks; const ry = Math.atan2(s.face[0] - s.x, s.face[1] - s.z); const c = Math.cos(ry); const sn = Math.sin(ry);
    const at = (lx, lz) => ({ x: s.x + c * lx + sn * lz, z: s.z - sn * lx + c * lz }); const out = []; const [x0, x1, z0, z1] = [-4.8, 4.8, -3.4, 4.3];
    for (let lx = x0 + 0.3; lx <= x1 - 0.3 + 1e-6; lx += 0.5) for (const lz of [z0 + 0.3, z1 - 0.3]) out.push({ ...at(lx, lz), r: 0.5 });
    for (let lz = z0 + 0.8; lz <= z1 - 0.8 + 1e-6; lz += 0.5) for (const lx of [x0 + 0.3, x1 - 0.3]) out.push({ ...at(lx, lz), r: 0.5 });
    for (let lx = x0 + 1.5; lx <= x1 - 1.5 + 1e-6; lx += 1.6) for (let lz = z0 + 1.5; lz <= z1 - 1.5 + 1e-6; lz += 1.6) out.push({ ...at(lx, lz), r: 1.2 });
    return out;
  }
  const STRUCTURES = { // the pieces of assets 55 that stand once (plaza-scene draws them; solids are theirs)
    lighthouse: { ...PL.lighthouse, r: 3.2 }, pier: PIER.root, dock: DOCK.root, ...(DOCK2 ? { dock2: DOCK2.root } : {}), stairs: { x: SF.x, z: SF.z, yaw: Math.atan2(STAIRS.nx, STAIRS.nz), base: STAIRS.base }, // (its model, turned, runs along local -x: the chord)
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
      && !busy(x, z, 6) && !gardens.some((g) => Math.hypot(g.x - x, g.z - z) < (g.kind === 'round' ? 6 : 8)) && !channels.some((c) => Math.hypot(c.x - x, c.z - z) < 4) && !placesIn.some((p) => Math.hypot(p.x - x, p.z - z) < 5) && Math.hypot(x - PL.spawn.x, z - PL.spawn.z) > 6
      && !(TX && Math.hypot(x - TX.ROUTE[0][0], z - TX.ROUTE[0][1]) < 8); /* (T1 길 넓히기: the taxi's 대청마당 stop -- room for its cars, T2's two -- no group within 8 m) */
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
    for (const g of ISLE_GARDENS) { beds.push({ x: g.x, z: g.z, r: 1.1, i: beds.length }); for (const sx of [-2.6, 2.6]) benches.push({ x: g.x + sx, z: g.z, r: 0.9, yaw: Math.atan2(-sx, 0), garden: g }); } // (v1.10.230: facing its own bed)
    const seats = benches.map((b, k) => { const ry = b.yaw; return { id: `b${k}`, x: b.x + Math.sin(ry) * 0.18, z: b.z + Math.cos(ry) * 0.18, yaw: ry }; });
    // (묶음 1, assets 59) the gardens' rims: 4 seats round a round one, 3 down each long side of a long one, facing out
    paving().gardens.forEach((g, k) => {
      const at = g.kind === 'round' ? [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => [a * 2.23, b * 2.23]) : [-3, 0, 3].flatMap((x) => [[x, 1.95], [x, -1.95]]);
      // (v1.10.253 assets 104 tower-fit: on 기록의 탑's garden the middle seat on the podium's side goes -- 0.87 m before it)
      const towered = Math.hypot(g.x - RECORD_TOWER.x, g.z - RECORD_TOWER.z) < 3;
      at.forEach(([dx, dz], n) => { if (towered && dx === 0 && dz * Math.cos(RECORD_TOWER.yaw) > 0) return; seats.push({ id: `g${k}-${n}`, x: g.x + dx, z: g.z + dz, yaw: g.kind === 'round' ? Math.atan2(dx, dz) : Math.atan2(0, dz) }); });
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
  // (G4a: what blocks keeps off the taxi's road and its stops -- island-taxi.js, loaded before this file)
  const TAXI_BAND = 0.85 + 3.2; /* (from the road's middle: the car's half width, then the islanders' band 1.5~3 m beside it, a little over -- notes docs/taxi-yield-20261109.md) */
  const taxiClear = (x, z, r) => { const X = (typeof require === 'function' ? require('./island-taxi.js') : globalThis.IslandTaxi); const roads = X.ROADS || [X.ROUTE]; return roads.every((route) => lineDist(x, z, route) > TAXI_BAND + r) && (X.ROAD_ENDS || [X.ROUTE[0], X.ROUTE.at(-1)]).every(([sx, sz]) => Math.hypot(x - sx, z - sz) > 10 + r) /* (395: the road on to 별마루섬 and its end's stop too) */ && (X.CROSSINGS || []).every((c) => Math.hypot(x - c.x, z - c.z) > (X.CROSS_CLEAR ?? 5) + r); }; /* (317: and its 건널목 -- doc 27행) */
  let natureCache = null; const natureBlocks = []; // (island-train: no tree on a lift's way)
  const addNatureBlock = (fn) => { natureBlocks.push(fn); natureCache = null; };
  addNatureBlock((x, z, r) => inFarmYard(x, z, r)); // (3회차 15: the farm yard clear)
  if (Q) addNatureBlock((x, z, r) => Q.inArea(x, z, r + 1)); // (1.10.323 채석장: the quarry's ground clear of trees, bushes and rocks)
  if (Q) { const out = Q.solidsOf().filter((s) => s.quarryProp && !Q.inArea(s.x, s.z, 1)); addNatureBlock((x, z, r) => out.some((s) => Math.hypot(x - s.x, z - s.z) < s.r + r + 1)); } // (1.10.342: and round its props outside it -- the bench faces along the cliff edge)
  /* (385 부팅 무게 2, lib/boot-cache.js: the server's start hands in what this made before from the same code -- taken when the same
     blocks are in, else made as ever) */
  let naturePreset = null; const presetNature = (made, blocks) => { naturePreset = made && { made, blocks }; };
  const natureBlockCount = () => natureBlocks.length;
  function nature() {
    if (natureCache) return natureCache;
    if (naturePreset) { const p = naturePreset; naturePreset = null; if (p.blocks === natureBlocks.length) return (natureCache = p.made); }
    let seed = 0x5a1d0e; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const R = D.R_OUT + 5;
  const built = (x, z) => onHouse(x, z) || ISLE_GARDENS.some((g) => Math.hypot(x - g.x, z - g.z) < 4) || BUILDINGS.some((b) => Math.hypot(x - b.x, z - b.z) < (b.kind === 'facade' ? 18 : b.kind === 'hall' ? 13 : 7))
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
    const X = (typeof require === 'function' ? require('./island-taxi.js') : globalThis.IslandTaxi); /* (1.10.323: the 건널목 kept clear by rule, not by where the seeded trees happened to fall) */
    const atCrossing = (o, r) => (X?.CROSSINGS || []).some((c) => Math.hypot(c.x - o.x, c.z - o.z) < (X.CROSS_CLEAR || 5) + r + 0.1);
    const blocked = (o, r) => natureBlocks.some((fn) => fn(o.x, o.z, r)) || onBank(o, 0.35);
    /* (T1 길 넓히기: and none in the taxi road -- its lanes and walks; taken out, the others stay where they are) */
    const keptTrees = trees.filter((t) => !blocked(t, 1.5) && !atCrossing(t, 0.7) && roadClear(t, 0.7)); /* (a tree's trunk: the solid by a 건널목) */ const keptBushes = bushes.filter((b) => !blocked(b, 0.8) && roadClear(b, 0.75 * b.s));
    // the walks' lamps (island-terrain's rule): beside the town walks and the 산책로 (not the 오솔길), every 14 points of
    // their curve -- on standable ground, off 대청마당 (its own lamps), the stairs, the bridges, the 관공서 yard, another
    // walk, what is built and the trees (after the tufts: the weeds keep their numbers). T1: one by the taxi road stands at its
    // walk's outer edge -- on its own side, else the other
    const lampSpots = [];
    for (const w of walkCurves) { if (w.tier === 'trail') continue; for (let i = 8; i < w.pts.length - 4; i += 14) {
      const [x, z] = w.pts[i]; const [x2, z2] = w.pts[i + 1]; const l = Math.hypot(x2 - x, z2 - z) || 1;
      const lx0 = x - ((z2 - z) / l) * (w.w / 2 + 0.8); const lz0 = z + ((x2 - x) / l) * (w.w / 2 + 0.8);
      const foot = roadFoot(lx0, lz0); const atRoad = foot && foot.d < ROAD.half + 0.55;
      /* (1.10.395 N4-c: on the village street the yards' fences stand at the road's edge -- its lamps on its walks, 3.3 m out, where they stood) */
      const SL = TX?.STREET; const street = atRoad && SL && foot.x >= SL.x0 && foot.x <= SL.x1 && Math.abs(foot.z - SL.z) < 0.5; const out = street ? SL.lamp : ROAD.half + 0.55;
      const spots = atRoad ? [foot.side, -foot.side].map((s) => [foot.x + foot.nx * out * s, foot.z + foot.nz * out * s]) : [[lx0, lz0]];
      const fits = ([lx, lz]) => !(!walkable(lx, lz) || inPlaza(lx, lz, 1) || onBridge(lx, lz) || onStairs(lx, lz) || inTownhall(lx, lz, 1) || (!atRoad && walkDist(lx, lz) < 0.2) || roadDist(lx, lz) < (street ? out - 0.05 : ROAD.half + 0.5))
        && !(structureSolids().some((o) => Math.hypot(o.x - lx, o.z - lz) < o.r + 0.6) || BUILDINGS.some((b) => Math.hypot(b.x - lx, b.z - lz) < (b.kind === 'facade' ? FACADE.w / 2 + 1 : 4)))
        && ![...keptTrees, ...keptBushes].some((t) => Math.hypot(t.x - lx, t.z - lz) < 1.5) && !atCrossing({ x: lx, z: lz }, 0.4);
      const at = spots.find(fits); if (at) lampSpots.push({ x: at[0], z: at[1], ...(D.newIsleCoast(at[0], at[1]) > -5 ? { isle2: true } : {}) }); /* (N1: 새 섬's shown with it) */
    } }
    // G4a 흩뿌리기 (notes docs/graphics-island-wide-20261108.md G4, assets 112; 사용자 「덤불, 바위들은 뚫고 지나가지 못하게」):
    // more bushes and rocks over the fields and woods, fallen logs in the woods, palms on the sandy shore (all of them block),
    // tall grass by the woods and fields, lily pads and lotus on the lake and the rivers (walked through / on the water) --
    // each on its own seed after the rest, so nothing above moves. What blocks keeps 3.2 m off the taxi's road (the car's
    // half width + 1.5 m, and the islanders' walk to be moved beside it: notes docs/taxi-yield-20261109.md) and 10 m off its
    // stops, 2.5 m off the walks, off the lots, buildings, bridges, water and the lift ways
    const solidFree = (x, z, r) => clearOf(x, z) && slopeAt(x, z) < 0.35 /* (the ground as shaped, not only before: no new thing on a bank -- terrain-brushes.test) */ && walkDist(x, z) > 2.5 + r && taxiClear(x, z, r) && !natureBlocks.some((fn) => fn(x, z, r + 0.5)) && !onBank({ x, z }, r + 0.5);
    const taken = [...keptTrees.map((t) => [t.x, t.z, 0.75 * t.s]), ...keptBushes.map((b) => [b.x, b.z, 0.75 * b.s]), ...rocks.map((r) => [r.x, r.z, r.s]), ...lampSpots.map((p) => [p.x, p.z, 0.3]),
      ...keptTrees.map((t) => [t.x, t.z + 0.5 * t.s + 0.55, 1.2])]; /* (a tree's fruit-picking spot -- harvestTrees' approach -- kept open: berries hang there) */
    const cells = new Map(); const cellOf = (x, z) => `${Math.floor(x / 7)},${Math.floor(z / 7)}`; /* (7 m squares: every gap asked is under 7 m) */
    const keep = (e) => { const k = cellOf(e[0], e[1]); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(e); };
    taken.forEach(keep); taken.push = (e) => keep(e);
    const room = (x, z, r, gap = 0.6) => { const cx = Math.floor(x / 7); const cz = Math.floor(z / 7);
      for (let i = cx - 1; i <= cx + 1; i += 1) for (let j = cz - 1; j <= cz + 1; j += 1) for (const [tx, tz, tr] of cells.get(`${i},${j}`) || []) if (Math.hypot(x - tx, z - tz) <= tr + r + gap) return false;
      return true; };
    const g4 = { logs: [], palms: [], grass: [], lilies: [] };
    seed = 0x6a41; for (let tries = 0, n = 0; n < 160 && tries < 6000; tries += 1) { const x = (rnd() * 2 - 1) * R; const z = (rnd() * 2 - 1) * R; const s = 0.55 + rnd() * 0.6; if (room(x, z, 0.75 * s) && solidFree(x, z, 0.75 * s)) { keptBushes.push({ x, z, s, g4: true }); taken.push([x, z, 0.75 * s]); n += 1; } } /* (g4: told from the island's own -- T1's road takes some of those out) */
    seed = 0x6a42; for (let tries = 0, n = 0; n < 120 && tries < 6000; tries += 1) { const x = (rnd() * 2 - 1) * R; const z = (rnd() * 2 - 1) * R; const s = 0.5 + rnd() * 0.7; if (D.coastDist(x, z) > 8 && room(x, z, s) && solidFree(x, z, s) && slopeAt(x, z) < 0.6) { rocks.push({ x, z, s, r: rnd() * 6, g4: true }); taken.push([x, z, s]); n += 1; } }
    seed = 0x6a43; for (const [wx, wz, wr, n0] of woods.map(([wx, wz, wr]) => [wx, wz, wr, Math.round(wr / 4)])) for (let tries = 0, n = 0; n < n0 && tries < n0 * 60; tries += 1) {
      const a = rnd() * TAU; const d = Math.sqrt(rnd()) * wr; const x = wx + Math.cos(a) * d; const z = wz + Math.sin(a) * d; const kind = Math.floor(rnd() * 3); const yaw = rnd() * TAU;
      if (room(x, z, 1.1, 0.4) && solidFree(x, z, 1.1)) { g4.logs.push({ x, z, kind, yaw }); taken.push([x, z, 1.1]); n += 1; }
    }
    seed = 0x6a44; for (let tries = 0; g4.palms.length < 18 && tries < 8000; tries += 1) { const x = (rnd() * 2 - 1) * R; const z = (rnd() * 2 - 1) * R; const cd = D.coastDist(x, z);
      if (cd > 4.5 && cd < 10 && room(x, z, 0.4, 3) && D.ridgeAt(x, z) < 0.3 && walkableBefore(x, z) && slopeAt(x, z) < 0.35 && walkDist(x, z) > 2.8 && taxiClear(x, z, 0.4) && !built(x, z) && !onBridge(x, z) && !inPlaza(x, z, 4) && room(x, z, 0.4, 3)) { g4.palms.push({ x, z, kind: Math.floor(rnd() * 3), yaw: rnd() * TAU, s: 0.9 + rnd() * 0.25 }); taken.push([x, z, 0.4]); } }
    // (313 A6 「뽑을 수 없는 잡초가 몇개 있어」: a clump of tall grass loose in the field read as a weed -- now at a tree's foot,
    // against its trunk (its walked-round circle + 0.1~0.3 m), the tree's own growth; nothing else within its room but that tree)
    const roomBut = (x, z, r, t) => { const cx = Math.floor(x / 7); const cz = Math.floor(z / 7);
      for (let i = cx - 1; i <= cx + 1; i += 1) for (let j = cz - 1; j <= cz + 1; j += 1) for (const [tx, tz, tr] of cells.get(`${i},${j}`) || []) if (!(Math.abs(tx - t.x) < 1e-6 && Math.abs(tz - t.z) < 1e-6) && !(Math.abs(tx - t.x) < 1e-6 && Math.abs(tz - t.z - 0.5 * t.s - 0.55) < 1e-6) && Math.hypot(x - tx, z - tz) <= tr + r + 0.1) return false;
      return true; };
    seed = 0x6a45; for (let tries = 0; g4.grass.length < 240 && tries < 9000 && keptTrees.length; tries += 1) { const t = keptTrees[Math.floor(rnd() * keptTrees.length)]; const a = rnd() * TAU; const d = 0.75 * t.s + 0.1 + rnd() * 0.2; const x = t.x + Math.cos(a) * d; const z = t.z + Math.sin(a) * d; const kind = Math.floor(rnd() * 3); const yaw = rnd() * TAU; const s = 0.85 + rnd() * 0.3; if (roomBut(x, z, 0.3, t) && clearOf(x, z) && walkDist(x, z) > 1.2) { g4.grass.push({ x, z, kind, yaw, s }); taken.push([x, z, 0.3]); } }
    seed = 0x6a46; for (let tries = 0; g4.lilies.length < 36 && tries < 6000; tries += 1) { const x = (rnd() * 2 - 1) * R; const z = (rnd() * 2 - 1) * R; const inLake = D.lakeDist(x, z) < -2 && D.lakeDist(x, z) > -11; const inRiver = D.riverDist(x, z) < -0.8;
      if ((inLake || inRiver) && !onBridge(x, z) && Math.hypot(x - PL.dock.x, z - PL.dock.z) > 10 && g4.lilies.every((l) => Math.hypot(l.x - x, l.z - z) > 2.2)) g4.lilies.push({ x, z, kind: Math.floor(rnd() * 4), yaw: rnd() * TAU }); }
    g4.grass = g4.grass.filter((g) => roadClear(g, 0.2)); /* (T1: the road's lanes and walks bare -- the flowers, tufts (the weeds keep their numbers) and rocks too) */
    // N1 새 섬's wood (notes island-expansion §8-4), N1b 숲 다듬기 (1.10.367, assets 156: big trees, ferns, mossy rocks, fallen logs,
    // 별지기 느티) and, 1.10.369 §9 (사용자 「동산, 숲속, 산책길, 오솔길 나눠서」 「전부 A」), how thick by its zone (isle2Zone): 숲속 thick --
    // 2.5 trees and 1.2 big ones to 100 m², ferns, moss, logs; 산책길 7 m either side lined with big trees, the floor open; 오솔길 big
    // trees close either side, their crowns meeting over it; 동산 open -- a lone big tree here and there, flowers, low shrubs, rocks.
    // Each kind on its own seed after everything above (nothing of the main island moves); on its land 4 m in from the shore, slopes
    // under 0.6, off the creek, the bridge, the camp ground's flat, the peak's top, the pier's root and 별지기 느티's 18 m; what
    // blocks 3 m off a walk (a 1.5 m lane by an 오솔길). Each marked isle2 -- the scene puts it in and out with the island
    const PIER2 = { x: 230, z: 197.3 }; const I2 = { trees: [], bushes: [], rocks: [], flowers: [], grass: [], logs: [] };
    const A = ANCIENT; const KEEP = 18; const offAncient = (x, z, r) => Math.hypot(x - A.x, z - A.z) > KEEP + r;
    const HEAD_END = TX?.EXT ? TX.EXT[TX.EXT.length - 1] : null; /* (1.10.397: 별마루섬 입구's stop -- its places, shelter and drop spot, 10 m round as the other stops) */
    const isle2Free = (x, z, r) => roadClear({ x, z }, r) /* (1.10.396 N4-c: the taxi's road in through the wide gate) */ && !(HEAD_END && Math.hypot(x - HEAD_END[0], z - HEAD_END[1]) < 10 + r) && D.newIsleCoast(x, z) > 4 + r && slopeAt(x, z) < 0.6 && D.creekDist(x, z) > 1.5 + r && !onBridge(x, z) && Math.hypot(x - ISLE2.camp.x, z - ISLE2.camp.z) > ISLE2.camp.r + 1 + r
      && Math.hypot(x - ISLE2.peak.x, z - ISLE2.peak.z) > 9 + r && Math.hypot(x - PIER2.x, z - PIER2.z) > 8 + r && walkDist(x, z) > 1.6 + r && offAncient(x, z, r) && !natureBlocks.some((fn) => fn(x, z, r))
      && !isle2PropsNear(x, z, r); /* (1.10.375 N2a-1: off the fence, the cave, the camp's pieces, 우레's rock and the swamps -- isle2-props.js) */
    const at2 = () => { const a = rnd() * TAU; const d = Math.sqrt(rnd()) * (ISLE2.r + 8); return [ISLE2.x + Math.cos(a) * d, ISLE2.z + Math.sin(a) * d]; };
    // the zone of a point off a 2 m grid made once, and each zone's land (m²)
    const ZG = 2; const zx0 = ISLE2.x - ISLE2.r - 14; const zz0 = ISLE2.z - ISLE2.r - 14; const ZN = Math.ceil((2 * (ISLE2.r + 14)) / ZG); const ZK = [null, 'hill', 'deep', 'walk', 'trail']; const zgrid = new Uint8Array(ZN * ZN); const zoneArea = { hill: 0, deep: 0, walk: 0, trail: 0 };
    for (let j = 0; j < ZN; j += 1) for (let i = 0; i < ZN; i += 1) { const zn = isle2Zone(zx0 + (i + 0.5) * ZG, zz0 + (j + 0.5) * ZG); const k = ZK.indexOf(zn); zgrid[j * ZN + i] = Math.max(0, k); if (zn) zoneArea[zn] += ZG * ZG; }
    const zoneOf = (x, z) => { const i = Math.floor((x - zx0) / ZG); const j = Math.floor((z - zz0) / ZG); return i >= 0 && j >= 0 && i < ZN && j < ZN ? ZK[zgrid[j * ZN + i]] : null; };
    // to 100 m², by zone (§9)
    const DENS = { deep: { mid: 1.8, big: 1.2, /* (§9 무게: 2.5 measured over the 316 line; the big trees' crowns keep it covered) */ bush: 0.5, fern: 1.6, mossy: 0.15, fallen: 0.06, rock: 0.15, flower: 0, log: 0.1 },
      walk: { mid: 1.5, big: 0.9, bush: 0.15, fern: 0.15, mossy: 0.03, fallen: 0, rock: 0.15, flower: 0.4, log: 0 },
      trail: { mid: 1.2, big: 1.1, bush: 0.2, fern: 1.0, mossy: 0.1, fallen: 0, rock: 0.1, flower: 0, log: 0.05 },
      hill: { mid: 0.05, big: 0.15, bush: 0.8, fern: 0, mossy: 0.05, fallen: 0, rock: 0.4, flower: 1.6, log: 0 } };
    const targetOf = (k) => Math.round(Object.entries(zoneArea).reduce((n, [zn, m2]) => n + (m2 / 100) * DENS[zn][k], 0));
    const maxOf = (k) => Math.max(...Object.values(DENS).map((d) => d[k]));
    // a try at a point: its zone, and kept by its zone's share of the thickest (so each zone gets its own thickness)
    const quota = {}; const quotaOf = (k, zn) => ((quota[k] ||= Object.fromEntries(Object.entries(zoneArea).map(([z2, m2]) => [z2, Math.round((m2 / 100) * DENS[z2][k])])))[zn]);
    const kept = {}; const tally = (k, zn) => { (kept[k] ||= {})[zn] = (kept[k][zn] || 0) + 1; }; // (each zone its own count -- the open ones fill faster and would take the rest)
    const pick = (k) => { const [x, z] = at2(); const zn = zoneOf(x, z); return zn && rnd() * maxOf(k) < DENS[zn][k] && (kept[k]?.[zn] || 0) < quotaOf(k, zn) ? { x, z, zn } : null; };
    const lane = (x, z, zn, r) => walkDist(x, z) > (zn === 'trail' ? 1.5 : 3) + r; // (the clear lane by a walk)
    const nTrees = targetOf('mid'); seed = 0x15e201;
    for (let tries = 0; I2.trees.length < nTrees && tries < nTrees * 90; tries += 1) { const p = pick('mid'); const s = 0.8 + rnd() * 0.6; if (!p) continue; const r0 = p.zn === 'deep' || p.zn === 'trail' ? 1.2 : 1.6;
      if (lane(p.x, p.z, p.zn, 0.75 * s) && room(p.x, p.z, r0, p.zn === 'deep' ? 0.8 : 1.4) && isle2Free(p.x, p.z, 0.8)) { I2.trees.push({ x: p.x, z: p.z, s, isle2: true }); taken.push([p.x, p.z, r0]); tally('mid', p.zn); } }
    const nBush = targetOf('bush'); seed = 0x15e202;
    for (let tries = 0; I2.bushes.length < nBush && tries < nBush * 40; tries += 1) { const p = pick('bush'); const s = 0.55 + rnd() * 0.6; if (p && room(p.x, p.z, 0.75 * s) && isle2Free(p.x, p.z, 0.75 * s) && lane(p.x, p.z, p.zn, 0.75 * s)) { I2.bushes.push({ x: p.x, z: p.z, s, isle2: true }); taken.push([p.x, p.z, 0.75 * s]); tally('bush', p.zn); } }
    const nRock = targetOf('rock'); seed = 0x15e203;
    for (let tries = 0; I2.rocks.length < nRock && tries < nRock * 40; tries += 1) { const p = pick('rock'); const s = 0.5 + rnd() * 0.7; if (p && room(p.x, p.z, s) && isle2Free(p.x, p.z, s) && lane(p.x, p.z, p.zn, s)) { I2.rocks.push({ x: p.x, z: p.z, s, r: rnd() * 6, g4: true, isle2: true }); taken.push([p.x, p.z, s]); tally('rock', p.zn); } }
    const nLog = targetOf('log'); seed = 0x15e204;
    for (let tries = 0; I2.logs.length < nLog && tries < nLog * 60; tries += 1) { const p = pick('log'); const kind = Math.floor(rnd() * 3); const yaw = rnd() * TAU; if (p && room(p.x, p.z, 1.1, 0.4) && isle2Free(p.x, p.z, 1.1) && lane(p.x, p.z, null, 1.1) /* (a log the full lane, by a trail too: lying along it, it blocks -- island-taxi.test) */) { I2.logs.push({ x: p.x, z: p.z, kind, yaw, isle2: true }); taken.push([p.x, p.z, 1.1]); tally('log', p.zn); } }
    const nFlower = targetOf('flower'); seed = 0x15e205;
    for (let tries = 0, k = 0; I2.flowers.length < nFlower && tries < nFlower * 40; tries += 1) { const p = pick('flower'); if (p && isle2Free(p.x, p.z, 0.1) && Math.hypot(p.x - A.x, p.z - A.z) > 6) { I2.flowers.push({ x: p.x, z: p.z, c: k % 5, isle2: true }); k += 1; tally('flower', p.zn); } }
    /* (the wild flowers at a tree's foot: on the open ground only -- 동산, 산책길; 숲속's floor is ferns and moss -- 369 §9 무게: they were 1,400 of 456 triangles each) */
    seed = 0x15e206; const openTrees = I2.trees.filter((t) => ['hill', 'walk'].includes(zoneOf(t.x, t.z))); const nGrass = Math.round(openTrees.length * 1.6);
    for (let tries = 0; I2.grass.length < nGrass && tries < nGrass * 30 && openTrees.length; tries += 1) { const t = openTrees[Math.floor(rnd() * openTrees.length)]; const a = rnd() * TAU; const d = 0.75 * t.s + 0.1 + rnd() * 0.9; const x = t.x + Math.cos(a) * d; const z = t.z + Math.sin(a) * d; const kind = Math.floor(rnd() * 3); const yaw = rnd() * TAU; const s = 0.85 + rnd() * 0.3; if (roomBut(x, z, 0.3, t) && isle2Free(x, z, 0.2)) { I2.grass.push({ x, z, kind, yaw, s, isle2: true }); taken.push([x, z, 0.3]); } }
    const F156 = (typeof self !== 'undefined' && self.Forest156) || (typeof require === 'function' ? require('./forest156.js') : null);
    const forest = { big: [], ferns: [], mossy: [], fallen: [], ancient: null };
    if (F156) {
      forest.ancient = { x: A.x, z: A.z, yaw: A.yaw, isle2: true };
      // big trees: 숲속 a mix, the 산책길 lined (3.5~7 m off it) and the 오솔길 close (1.8~5 m: crowns meeting) with the broad ones,
      // 동산 a lone oak here and there
      const BIG = { deep: [['tree_big_fir', 0.4], ['tree_big_pine', 0.3], ['tree_big_oak', 0.3]], walk: [['tree_big_oak', 0.5], ['tree_big_pine', 0.5]], trail: [['tree_big_oak', 0.55], ['tree_big_pine', 0.45]], hill: [['tree_big_oak', 0.7], ['tree_big_pine', 0.3]] };
      const SIZE = { tree_big_fir: [0.75, 0.3], tree_big_pine: [0.8, 0.3], tree_big_oak: [0.85, 0.25] };
      const nBig = targetOf('big'); seed = 0x15e207;
      for (let tries = 0; forest.big.length < nBig && tries < nBig * 90; tries += 1) {
        const p = pick('big'); const u = rnd(); const v = rnd(); const yaw = rnd() * TAU; if (!p) continue;
        let acc = 0; const kind = BIG[p.zn].find(([, w]) => (acc += w) > u)?.[0] || BIG[p.zn][0][0]; const [s0, ds] = SIZE[kind]; const s = s0 + v * ds;
        const r = F156.CIRCLES[kind][0][2] * s; const wd = walkDist(p.x, p.z);
        if ((p.zn === 'walk' && (wd < 3.5 + r || wd > 7)) || (p.zn === 'trail' && (wd < 1.8 + r || wd > 5)) || (p.zn !== 'trail' && wd < 3.5 + r) || D.creekDist(p.x, p.z) < 6 + r || Math.hypot(p.x - ISLE2.camp.x, p.z - ISLE2.camp.z) < ISLE2.camp.r + 8 || Math.hypot(p.x - ISLE2.peak.x, p.z - ISLE2.peak.z) < 18) continue;
        if (room(p.x, p.z, r, 1.0) && isle2Free(p.x, p.z, r)) { forest.big.push({ x: p.x, z: p.z, s, yaw, kind, isle2: true }); taken.push([p.x, p.z, r]); tally('big', p.zn); }
      }
      const nMossy = targetOf('mossy'); seed = 0x15e208;
      for (let tries = 0; forest.mossy.length < nMossy && tries < nMossy * 60; tries += 1) {
        const p = pick('mossy'); const kind = rnd() < 0.6 ? 'rock_mossy_a' : 'rock_mossy_b'; const s = 0.8 + rnd() * 0.4; const yaw = rnd() * TAU; if (!p) continue; const cs = F156.circlesAt(kind, p.x, p.z, yaw, s);
        if (slopeAt(p.x, p.z) < 0.45 && cs.every((c) => lane(c.x, c.z, p.zn, c.r) && room(c.x, c.z, c.r, 0.6) && isle2Free(c.x, c.z, c.r))) { forest.mossy.push({ x: p.x, z: p.z, s, yaw, kind, isle2: true }); for (const c of cs) taken.push([c.x, c.z, c.r]); tally('mossy', p.zn); }
      }
      const nFallen = targetOf('fallen'); seed = 0x15e209;
      for (let tries = 0; forest.fallen.length < nFallen && tries < nFallen * 80; tries += 1) {
        const p = pick('fallen'); const kind = rnd() < 0.7 ? 'log_fallen_big' : 'log_fallen_mid'; const yaw = rnd() * TAU; if (!p) continue; const cs = F156.circlesAt(kind, p.x, p.z, yaw, 1); const hs = cs.map((c) => meshGroundHeight(c.x, c.z));
        if (Math.max(...hs) - Math.min(...hs) < 0.7 && cs.every((c) => lane(c.x, c.z, p.zn, c.r) && room(c.x, c.z, c.r, 0.4) && isle2Free(c.x, c.z, c.r))) { forest.fallen.push({ x: p.x, z: p.z, s: 1, yaw, kind, isle2: true }); for (const c of cs) taken.push([c.x, c.z, c.r]); tally('fallen', p.zn); }
      }
      const nFern = targetOf('fern'); seed = 0x15e20a;
      for (let tries = 0; forest.ferns.length < nFern && tries < nFern * 30; tries += 1) {
        const p = pick('fern'); const kind = rnd() < 0.55 ? 'fern_wide' : 'fern_tall'; const s = 0.8 + rnd() * 0.4; const yaw = rnd() * TAU;
        if (p && walkDist(p.x, p.z) > 1.2 && room(p.x, p.z, 0.35, 0.15) && isle2Free(p.x, p.z, 0.5)) { forest.ferns.push({ x: p.x, z: p.z, s, yaw, kind, isle2: true }); taken.push([p.x, p.z, 0.35]); tally('fern', p.zn); }
      }
    }
    // (§9 「빈 숲속 칸 없음」: a 10 m square all 숲속 that came out with no tree gets one -- its own seed, last)
    { const has = new Set([...I2.trees, ...forest.big].map((t) => `${Math.floor(t.x / 10)},${Math.floor(t.z / 10)}`)); seed = 0x15e20b;
      for (let x = Math.floor(zx0 / 10) * 10; x < zx0 + ZN * ZG; x += 10) for (let z = Math.floor(zz0 / 10) * 10; z < zz0 + ZN * ZG; z += 10) {
        if (has.has(`${x / 10},${z / 10}`) || D.newIsleCoast(x + 5, z + 5) <= 6) continue; let deep = true; /* (a square at the shore has no room 4 m in) */ for (let a = 1; a < 10 && deep; a += 3) for (let b = 1; b < 10 && deep; b += 3) deep = zoneOf(x + a, z + b) === 'deep'; if (!deep) continue;
        for (let k = 0; k < 80; k += 1) { const tx = x + 0.5 + rnd() * 9; /* (a square at the shore: most of it within the 4 m) */ const tz = z + 0.5 + rnd() * 9; const s = 0.8 + rnd() * 0.6; if (lane(tx, tz, 'deep', 0.75 * s) && room(tx, tz, 1.2, 0.6) && isle2Free(tx, tz, 0.8)) { I2.trees.push({ x: tx, z: tz, s, isle2: true }); taken.push([tx, tz, 1.2]); break; } }
      } }
    g4.grass.push(...I2.grass); g4.logs.push(...I2.logs);
    natureCache = { ...g4, forest, trees: [...keptTrees, ...I2.trees], flowers: [...flowers.filter((p) => !blocked(p, 0.3) && roadClear(p, 0.2)), ...I2.flowers], bushes: [...keptBushes, ...I2.bushes], tufts: tufts.filter((t) => !onBank(t, 0.5) && roadClear(t, 0.2)), rocks: [...rocks.filter((r) => slopeAt(r.x, r.z) < 1 && walkDist(r.x, r.z) > 1.5 && roadClear(r, r.s)), ...I2.rocks] /* (묶음 1: none on a cliff face -- set at the ground under its middle, it hung in the air there; 6회차 1: none on a walk) */, posts: [], lampSpots };
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
    for (const t of n.trees) { if (t.isle2 || C.treeKind(t) !== 'fruit' || out.some((o) => Math.hypot(o.x - t.x, o.z - t.z) < 5)) continue; const p = approachOf(t); if (p) add(t, p); } /* (N1: none on 새 섬 -- what grows there is N2's) */
    harvestOf = n; harvestCache = out; return out;
  }
  // the shore within a few metres of the water (sea or 윤슬만, not the cliffs) -- where the tide leaves things, and the
  // views: a 2 m sample, worked out once
  let shoreCells = null;
  function shoreSpots() {
    if (shoreCells) return shoreCells;
    shoreCells = [];
    for (let x = -D.R_OUT; x <= D.R_OUT; x += 2) for (let z = -D.R_OUT; z <= D.R_OUT; z += 2) { const cd = D.coastDist(x, z); if (cd > 2.6 && cd < 9 && cliffAt(x, z) < 0.3 && walkable(x, z) && roadClear({ x, z }, 0.5)) shoreCells.push({ x, z, cd }); } /* (T1 고침: none on the taxi road -- the beach's litter lay on its lanes) */
    return shoreCells;
  }
  // G4a: which rock is which (island.js draws each so) -- the shore's low stones and the pebble walked over, the rest block;
  // a log's three rounds along it, a palm's trunk
  const hashK = (x, z, k = 0) => { const v = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };
  let rockKindOf = null; let rockKindMap = null;
  function rockKind(r) {
    const n = nature();
    if (rockKindOf !== n) {
      const shore = (o) => D.coastDist(o.x, o.z) < 4 && hashK(o.x, o.z, 31) < 0.5;
      const inland = n.rocks.filter((o) => !shore(o)); const crystals = new Set(inland.slice().sort((a, b) => hashK(a.x, a.z, 43) - hashK(b.x, b.z, 43)).slice(0, 3));
      rockKindMap = new Map(n.rocks.map((o) => [o, shore(o) ? 'shore' : crystals.has(o) ? 'rock_stack' : hashK(o.x, o.z, 41) < 0.3 ? ['rock_lump', 'rock_small', 'rock_block'][Math.min(2, Math.floor(hashK(o.x, o.z, 42) * 3))] : `rock${Math.min(2, Math.floor(hashK(o.x, o.z, 17) * 3))}`]));
      rockKindOf = n;
    }
    return rockKindMap.get(r) || null;
  }
  const rockBlocks = (r) => !['shore', 'rock_small'].includes(rockKind(r)) && (r.g4 || (taxiClear(r.x, r.z, 0.8 * r.s) && walkDist(r.x, r.z) > 1.5 + 0.8 * r.s)); // (an older rock by the taxi's road or a walk stays walked over)
  const LOG_ROUNDS = [[[-0.6, 0.24], [0, 0.24], [0.6, 0.24]], [[-0.6, 0.24], [0, 0.24], [0.6, 0.24]], [[-0.7, 0.32], [0, 0.4], [0.7, 0.32]]]; // (assets 112 footprint: 1.8 x 0.43, 2.0 x 0.92)
  const logRounds = (l) => LOG_ROUNDS[l.kind].map(([u, r]) => ({ x: l.x + Math.cos(l.yaw) * u, z: l.z - Math.sin(l.yaw) * u, r }));
  let solidsOf = null; let solidsCache = null; // (G4a: worked out once per nature -- asked for often)
  const natureSolids = () => { const n = nature(); if (solidsOf === n) return solidsCache; solidsOf = n; return (solidsCache = natureSolidsOf(n)); };
  // 1.10.375 N2a-1 별마루섬's still pieces (public/plaza/isle2-props.js, made by tools/isle2-props.cjs): their circles among the island's solids, and
  // a look-up of whether a point is near one (nature() keeps its trees, bushes and rocks off them; a swamp's ground left open)
  const isle2Props = () => (ISLE2 ? (typeof self !== 'undefined' && self.Isle2Props) || (typeof require === 'function' ? require('./isle2-props.js') : null) : null);
  let propsHash = null;
  function isle2PropsNear(x, z, r) {
    const P = isle2Props(); if (!P) return false;
    if (!propsHash) { propsHash = new Map(); for (const o of P.solids()) { const k = `${Math.floor(o.x / 8)},${Math.floor(o.z / 8)}`; let l = propsHash.get(k); if (!l) propsHash.set(k, (l = [])); l.push(o); }
      propsHash.swamps = P.SWAMPS.map(([sx, sz], i) => ({ x: sx, z: sz, r: Math.max(...P.SWAMP_OUTLINES[i].map(([ox, oz]) => Math.hypot(ox - sx, oz - sz))) })); }
    const cx = Math.floor(x / 8); const cz = Math.floor(z / 8);
    for (let i = cx - 1; i <= cx + 1; i += 1) for (let j = cz - 1; j <= cz + 1; j += 1) for (const o of propsHash.get(`${i},${j}`) || []) if (Math.hypot(o.x - x, o.z - z) < o.r + r + 0.5) return true;
    return propsHash.swamps.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + r + 1);
  }
  const isle2PropSolids = () => isle2Props()?.solids() || [];
  const natureSolidsOf = (n) => { const harvest = harvestTrees(); return [...n.trees.map((t) => ({ x: t.x, z: t.z, r: harvest.some((h) => h.x === t.x && h.z === t.z) ? 0.5 * t.s : 0.75 * t.s })), ...n.bushes.map((b) => ({ x: b.x, z: b.z, r: 0.75 * b.s })), ...n.lampSpots.map((p) => ({ x: p.x, z: p.z, r: 0.3 })),
    ...n.rocks.filter((r) => rockBlocks(r) && settledSpot(r.x, r.z)).map((r) => ({ x: r.x, z: r.z, r: 0.8 * r.s })), ...n.logs.flatMap(logRounds), ...n.palms.map((p) => ({ x: p.x, z: p.z, r: 0.3 * p.s })), ...forestSolids(n), ...isle2PropSolids()]; }; /* (1.10.375: 별마루섬's fence, cave, camp pieces, rock) */ // (as the scene walks round them: island.js; G4a the rocks, logs and palms too)
  // (1.10.369, 총괄) a free point on 별마루섬 -- past the islanders' walk grid (±200 m) every point there read as blocked (the unstuck
  // move, the screen check): off every solid there by `margin`, its solids in 8 m squares made once a nature
  let clearOf2 = null; let clearHash = null;
  const onIsle2 = (x, z) => Boolean(ISLE2) && D.newIsleCoast(x, z) > -2;
  function isle2Clear(x, z, margin = 1.2) {
    if (!onIsle2(x, z)) return false; const n = nature();
    if (clearOf2 !== n) { clearOf2 = n; clearHash = new Map(); for (const o of natureSolids()) { if (!onIsle2(o.x, o.z)) continue; const k = `${Math.floor(o.x / 8)},${Math.floor(o.z / 8)}`; let l = clearHash.get(k); if (!l) clearHash.set(k, (l = [])); l.push(o); } }
    const cx = Math.floor(x / 8); const cz = Math.floor(z / 8);
    for (let i = cx - 2; i <= cx + 2; i += 1) for (let j = cz - 2; j <= cz + 2; j += 1) for (const o of clearHash.get(`${i},${j}`) || []) if (Math.hypot(o.x - x, o.z - z) < o.r + margin) return false;
    return true;
  }
  // (369 검토 #7) and open: joined to the island's walks by free cells (1 m, off the solids by 0.6) -- not a pocket among roots and trunks
  // like the one the unstuck move left. (검토 369 P1: a search from each asked point froze the server up to 73 s on the open meadow far
  // from a walk -- now one fill from the walks over the free cells, made once a nature (the server makes it at its start), then a look-up)
  let openOf = null; let openCells = null; const OPEN_N = ISLE2 ? Math.ceil(2 * (ISLE2.r + 14)) : 0; const ox0 = ISLE2 ? ISLE2.x - ISLE2.r - 14 : 0; const oz0 = ISLE2 ? ISLE2.z - ISLE2.r - 14 : 0;
  /* (Codex 361~370 #16: the fill kept as a build that can stop and go on -- the server runs it in 20 ms slices after it listens (isle2OpenWarm),
     nothing else held up; a look before it is done finishes it there) */
  let openBuild = null;
  function openStep(budgetMs = Infinity) {
    const n = nature(); if (openOf === n && openCells) return true;
    if (!openBuild || openBuild.n !== n) {
      const N = OPEN_N; const state = new Uint8Array(N * N); /* 0 unseen, 1 blocked, 2 open */ const q = new Int32Array(N * N); let tail = 0;
      const freeAt = (i, j) => { const x = ox0 + i + 0.5; const z = oz0 + j + 0.5; return walkable(x, z) && isle2Clear(x, z, 0.6); };
      for (const w of isle2Walks().main.concat(isle2Walks().narrow)) for (const [x, z] of w.pts) { const i = Math.floor(x - ox0); const j = Math.floor(z - oz0); if (i < 0 || j < 0 || i >= N || j >= N) continue; const id = j * N + i; if (state[id]) continue; if (freeAt(i, j)) { state[id] = 2; q[tail++] = id; } else state[id] = 1; }
      openBuild = { n, N, state, q, head: 0, tail, freeAt };
    }
    const b = openBuild; const { N, state, q, freeAt } = b; const until = Date.now() + budgetMs; let k = 0;
    while (b.head < b.tail) {
      const id = q[b.head++]; const i = id % N; const j = (id - i) / N;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di; const nj = j + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue; const nid = nj * N + ni; if (state[nid]) continue; if (freeAt(ni, nj)) { state[nid] = 2; q[b.tail++] = nid; } else state[nid] = 1; }
      if ((++k & 63) === 0 && Date.now() >= until) return false;
    }
    openOf = n; openCells = state; openBuild = null; return true;
  }
  function openTable() { openStep(); return openCells; }
  function isle2Open(x, z) {
    if (!isle2Clear(x, z)) return false; const t = openTable(); const i = Math.floor(x - ox0); const j = Math.floor(z - oz0);
    return i >= 0 && j >= 0 && i < OPEN_N && j < OPEN_N && t[j * OPEN_N + i] === 2;
  }
  // (1.10.367 N1b) the forest's: the big trees' trunks, the mossy rocks, the fallen logs and 별지기 느티's trunk and roots (assets 156
  // solids.json -- its arches walked under); the ferns walked through
  const forestSolids = (n) => { const F156 = (typeof self !== 'undefined' && self.Forest156) || (typeof require === 'function' ? require('./forest156.js') : null); const f = n.forest; if (!F156 || !f) return [];
    return [...[...f.big, ...f.mossy, ...f.fallen].flatMap((o) => F156.circlesAt(o.kind, o.x, o.z, o.yaw, o.s)), ...(f.ancient ? F156.circlesAt('tree_ancient', f.ancient.x, f.ancient.z, f.ancient.yaw, 1) : [])]; };
  const AREAS = Object.fromEntries([['plaza', { x: P.x, z: P.z, label: D.NAMES.plaza }], ...(Q ? [['quarry', { x: 90, z: -123, label: '채석장' }]] : []) /* (1.10.323) */,['notice', { ...PL.notice, label: D.NAMES.notice }], ['village', { ...PL.village, label: D.NAMES.village }],
    ['west', { x: -120, z: 10, label: D.NAMES.west }], ['lake', { x: D.LAKE.x, z: D.LAKE.z, label: D.NAMES.lake }], ['east', { x: 115, z: 20, label: D.NAMES.east }],
    ['isle', { x: D.ISLE.x, z: D.ISLE.z, label: D.NAMES.isle }], ['bay', { x: 0, z: 60, label: D.NAMES.bay }], ['ridge', { x: 0, z: -146, label: D.NAMES.ridge }],
    ...(ISLE2 ? [['newIsle', { x: ISLE2.x, z: ISLE2.z, label: D.NAMES.newIsle }], ['ancient', { x: ANCIENT.x, z: ANCIENT.z, label: ANCIENT.name, r: 25 /* (368: its name only within 25 m of the trunk) */ }]] : [])]); /* (N1 새 섬; 1.10.367 별지기 느티) */

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
    MAP: 'dalmaru', HOME_LOTS, onLot, STREET_Z, GATE_BACK, GROUND: { size: SIZE, seg: SEG }, PLAZA_C, inPlaza,
    coastR: () => D.R_OUT, coastDist: D.coastDist, cliffAt, rawLand: D.landHeight, land, ground, creekWaterY, meshGroundHeight, settledSpot, heightAt, walkable,
    streamDist: () => Infinity, walkDist, STREAMS: [], streamCurves: [], walkCurves, RIVER_WIDE: { pts: [] }, riverExtra: () => 0,
    streamDepth: () => 0, streamWaterHeight: () => SEA, POND: { x: 1e5, z: 1e5, r: 0 }, PADS,
    bridges, onBridge, deckAt, onStairs, STAIRS, PIER, DOCK, DOCK2, DOCKS, BREAKWATER: { x: 1e5, z: 1e5, ux: 1, uz: 0, half: 0, w: 0, deck: 0 }, bayR: D.R_BAY,
    fishWater, canFish: (x, z) => fishWater(x, z) !== null, ISLAND_RADIUS: 540 /* (v1.10.230: the village's far corner, r 323; N1: 새 섬's east end x 516 -- 330 -> 540) */,
    /* N1 새 섬's ground: its own mesh on the main ground's 2.5 m lattice (x0, z0 on it), a cell its when within 14 m of its coast
       (the main ground leaves those out -- no cell drawn twice); its own ground maps over this square */
    GROUND2: Object.freeze({ x0: 215, z0: 72.5, size: 305, seg: 122 }), isle2Cell: (x, z) => D.newIsleCoast(x, z) > -14, NEW_ISLE: ISLE2, ANCIENT /* (1.10.367 별지기 느티) */, isle2Zone, ISLE2_ZONES /* (1.10.369 구역) */, onIsle2, isle2Clear, isle2Open, isle2OpenWarm: (ms = 20) => openStep(ms) /* (Codex 361~370 #16) */, ISLE2_BRIDGE_HEAD: Object.freeze({ x: 233, z: 228 }) /* (1.10.369 막혔을 때: 별마루섬's own way out) */,
    ROAD, roadDist, roadFoot, /* (T1 고침: the taxi road's band -- the scene's grass and decor, the shore and cover maps keep off it) */ SPAWN: { x: PL.spawn.x, z: PL.spawn.z }, PLAZA_R: 0, PLAZA_H: P.h,
    seasonZoneAt, seasonAt, nature, presetNature, natureBlockCount, natureSolids, rockKind, rockBlocks, logRounds, harvestTrees, shoreSpots, AREAS, WATERFRONT, STRUCTURES, FACADE,
    structureSolids, RECORD_TOWER, AUCTION_BOARD, paving, addNatureBlock, addTreeBlock: addNatureBlock, NICHES: PL.niches, SPOTS, facilityDoor, COTTAGES, BUILDINGS, RESERVED_LOTS: [], STATUE_SPOTS: [], plazaProps, villageSolids, inVillage: (x, z) => villageSolids().some((v) => Math.hypot(x - v.x, z - v.z) < v.r + 0.8),
    HALLOWEEN_FIELDS: PL.halloween.fields, HALLOWEEN_EXTRAS: PL.halloween.extras, dalmaru: D, VILLAGE, MUSEUM, FARM, CONTEST_STATUE,
    TOWNHALL, townhallLocal, townhallWorld, inTownhall, inTownhallYard,
  });
}));
