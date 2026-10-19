// 달마루섬 지형 시안 (2026-10-19, gamecenter-notes docs/island-crescent-redesign-20261019.md): the crescent island that
// replaces island-terrain.js's round one -- the same idea (the ground is a few formulas, everything else is laid on it),
// written standalone so it can be checked and drawn before it goes into the game. Units: metres, x east, z south
// (north = -z), heights over the waterline 0 (the sea's surface is -0.6 in the game, as now).
//
// Shape: a big circle (R_OUT) minus the bay circle (R_BAY, its centre BAY_Z south) = the crescent, plus 툇마루섬 on the
// line between the crescent's two tips. Both edges wobble a little so the coast is never a compass line.
// Height: low fields round 윤슬만, the 달마루 ridge round the north (its inner face the 영웅마루 cliff, ~22 m), 대청마당 a
// flat terrace before the cliff, 거울호수 and two rivers cut in, beaches along the shores, the island low and flat.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.DalmaruTerrain = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const TAU = Math.PI * 2;
  const smooth = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  // ---- the plan (the numbers in the plan page) ----
  const R_OUT = 165, R_BAY = 95, BAY_Z = 95, R_ISLE = 34;
  const TIP_Z = (R_OUT * R_OUT - R_BAY * R_BAY + BAY_Z * BAY_Z) / (2 * BAY_Z); // 143.3
  const TIP_X = Math.sqrt(R_OUT * R_OUT - TIP_Z * TIP_Z); // 81.8
  const ISLE = { x: 0, z: TIP_Z, r: R_ISLE };
  // the crescent's horns end in round capes (the bare tips are a point): 윤슬다리 lands on them, 초승등대 and 달끝나루 stand on them
  const CAPES = [{ x: -92, z: 140, r: 14 }, { x: 92, z: 140, r: 14 }];
  const RIDGE = { a0: (184 * Math.PI) / 180, a1: (356 * Math.PI) / 180, inner: 128, top: 22 }; // 달마루 능선: angles round the north, the cliff's foot radius, the ridge's height
  const PLAZA = { x: 0, z: -84, hw: 44, d0: -112, d1: -52, h: 1.2 }; // 대청마당: a terrace before the cliff (half width, north and south edges)
  const SEA = -0.6;

  const outerR = (th) => R_OUT + 3.2 * Math.sin(3 * th + 0.4) + 2.2 * Math.sin(7 * th + 1.3) + 1.2 * Math.sin(13 * th);
  const bayR = (th) => R_BAY + 2.4 * Math.sin(4 * th + 0.9) + 1.4 * Math.sin(9 * th + 2.1);
  // > 0 on land: distance (roughly, metres) inside the crescent or the island
  function coastDist(x, z) {
    const r = Math.hypot(x, z); const th = Math.atan2(z, x);
    const dOut = outerR(th) - r;
    const bx = x, bz = z - BAY_Z; const dBay = Math.hypot(bx, bz) - bayR(Math.atan2(bz, bx));
    const crescent = Math.min(dOut, dBay);
    const isle = ISLE.r + 1.2 * Math.sin(5 * Math.atan2(z - ISLE.z, x) + 0.7) - Math.hypot(x - ISLE.x, z - ISLE.z);
    const cape = Math.max(...CAPES.map((c) => c.r - Math.hypot(x - c.x, z - c.z)));
    return Math.max(crescent, isle, cape);
  }
  const inBay = (x, z) => Math.hypot(x, z - BAY_Z) < bayR(Math.atan2(z - BAY_Z, x)) && Math.hypot(x, z) < outerR(Math.atan2(z, x)) + 4 && z < TIP_Z;

  // 0..1: how far into the ridge band (1 on the ridge top), by angle round the north and radius
  function ridgeAt(x, z) {
    const th = Math.atan2(z, x); const a = ((th % TAU) + TAU) % TAU; // 0..2π, north = 3π/2
    const along = Math.min(smooth(RIDGE.a0, RIDGE.a0 + 0.22, a), smooth(RIDGE.a1, RIDGE.a1 - 0.22, a));
    const r = Math.hypot(x, z);
    const across = smooth(RIDGE.inner - 1.5, RIDGE.inner + 4.5, r); // the steep inner face (the cliff)
    return along * across;
  }

  // 거울호수, the rivers, the pools under the falls
  const LAKE = { x: -105, z: -26, rx: 20, rz: 14 };
  const RIVERS = [
    { name: '서쪽 강', w: 5, pts: [[-124, -55], [-118, -44], [-110, -36]] },
    { name: '서쪽 강', w: 5.5, pts: [[-106, -12], [-111, 10], [-108, 30], [-99, 48], [-88, 62]] },
    { name: '은하내', w: 5, pts: [[111, -78], [114, -60], [124, -40], [146, -22], [168, -12]] },
  ];
  const POOLS = [{ x: -124, z: -55, r: 7 }, { x: 111, z: -78, r: 7 }]; // 마루폭포 under the ridge's west end (204°), the east fall (325°) -- clear of 관공서·계단 (206–241°) and 백화점 (298–312°)
  const ISLE_POND = { x: 8, z: TIP_Z + 4, rx: 6, rz: 4 };
  function segDist(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(px - ax - dx * t, pz - az - dz * t); }
  const lineDist = (x, z, pts) => { let d = Infinity; for (let i = 0; i + 1 < pts.length; i++) d = Math.min(d, segDist(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])); return d; };
  const riverDist = (x, z) => { let d = Infinity; for (const r of RIVERS) d = Math.min(d, lineDist(x, z, r.pts) - r.w / 2); return d; };
  const lakeDist = (x, z) => (Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz) - 1) * Math.min(LAKE.rx, LAKE.rz);
  const poolDist = (x, z) => Math.min(...POOLS.map((p) => Math.hypot(x - p.x, z - p.z) - p.r));
  const islePondDist = (x, z) => (Math.hypot((x - ISLE_POND.x) / ISLE_POND.rx, (z - ISLE_POND.z) / ISLE_POND.rz) - 1) * ISLE_POND.rz;

  function landHeight(x, z) {
    const cd = coastDist(x, z);
    if (cd < 0) return SEA - 0.35 + cd * 0.35; // the sea floor going down
    const r = Math.hypot(x, z);
    const onIsle = Math.hypot(x - ISLE.x, z - ISLE.z) < ISLE.r + 4;
    // the fields: rise gently away from 윤슬만 and the coast, a little roll
    let h = 0.6 + 0.9 * smooth(0, 60, cd) + 0.35 * Math.sin(x * 0.07) * Math.cos(z * 0.06);
    // the ridge: 22 m on top, a sheer inner face; its outer side falls to sea cliffs
    const rg = ridgeAt(x, z);
    if (rg > 0) { const outerFall = smooth(4, 22, cd); h = lerp(h, RIDGE.top * (0.55 + 0.45 * outerFall) + 1.5 * Math.sin(x * 0.11), rg); }
    // 대청마당: a flat terrace up to the cliff's foot
    const px = Math.max(0, Math.abs(x - PLAZA.x) - PLAZA.hw); const pz = Math.max(0, PLAZA.d0 - z, z - PLAZA.d1);
    const outP = Math.hypot(px, pz); if (outP < 8 && rg < 0.5) h = lerp(PLAZA.h, h, smooth(0, 8, outP));
    if (onIsle) h = lerp(0.9, h, smooth(ISLE.r - 6, ISLE.r + 4, Math.hypot(x - ISLE.x, z - ISLE.z)));
    // beaches: the last few metres to the water lie low (not under the ridge's sea cliffs)
    const beach = rg > 0.3 ? 1.2 : 7;
    if (cd < beach) h = lerp(SEA - 0.3, h, cd / beach);
    return h;
  }
  function ground(x, z) {
    let h = landHeight(x, z);
    const cut = (dist, depth, bank) => { if (dist < bank) h = lerp(Math.min(h, SEA - depth), h, smooth(-0.5, bank, dist)); };
    cut(riverDist(x, z), 0.9, 2.2); cut(lakeDist(x, z), 1.6, 3); cut(poolDist(x, z), 1.8, 2.5); cut(islePondDist(x, z), 0.8, 1.5);
    return h;
  }
  const heightAt = (x, z) => Math.max(ground(x, z), SEA);
  const isWater = (x, z) => ground(x, z) < SEA;
  // walkable: on land above the water, not on the cliff faces (too steep)
  function slopeAt(x, z) { const e = 1; return Math.hypot(ground(x + e, z) - ground(x - e, z), ground(x, z + e) - ground(x, z - e)) / (2 * e); }
  const walkable = (x, z) => !isWater(x, z) && slopeAt(x, z) < 0.9;

  // 계절 구역 4곳: 푸른숲골(서쪽 팔), 북쪽 가운데, 잔치마루(동쪽 팔), 툇마루섬
  function seasonZoneAt(x, z) {
    if (Math.hypot(x - ISLE.x, z - ISLE.z) < ISLE.r + 6) return 3;
    const a = ((Math.atan2(z, x) % TAU) + TAU) % TAU; const deg = (a * 180) / Math.PI;
    return deg >= 115 && deg < 225 ? 0 : deg >= 225 && deg < 315 ? 1 : 2;
  }
  const BRIDGE_Z = 140; // 윤슬다리 (assets 55 bridge.yunseul, 50 m): centred over the 45 m of water between 툇마루섬 and each cape, 2.5 m on land at each end
  const BRIDGES = [-1, 1].map((sgn) => ({ x: sgn * 55.35, z: BRIDGE_Z, length: 50, ends: [[sgn * 30.35, BRIDGE_Z], [sgn * 80.35, BRIDGE_Z]] }));
  // where the pieces stand (assets 55): angles round the island's centre, degrees (north = 270), r = distance from it
  const deg = (r, a) => ({ x: Math.round(r * Math.cos((a * Math.PI) / 180) * 10) / 10, z: Math.round(r * Math.sin((a * Math.PI) / 180) * 10) / 10, yawToCentre: Math.atan2(-Math.cos((a * Math.PI) / 180), -Math.sin((a * Math.PI) / 180)) });
  const PLACES = {
    niches: [[270, 14], [261, 10], [279, 10], [253, 7], [287, 7], [246, 7], [294, 7]].map(([a, m], i) => ({ ...deg(RIDGE.inner - 1.5, a), m, now: i < 3 })), // 기부 1위·2위·대회 우승 now, the rest empty
    facadeTownhall: deg(RIDGE.inner - 2, 235), facadeMall: deg(RIDGE.inner - 2, 305),
    stairs: { from: deg(RIDGE.inner - 2, 227.5), to: deg(RIDGE.inner - 2, 212) }, // up the cliff face westward beside 관공서
    lighthouse: { x: -96, z: 144 }, pier: { x: 98, z: 150, yaw: Math.PI * 0.75 }, dock: { x: 0, z: 3.5 }, // (its gangway onto the beach)
    gamehall: { x: 56, z: -66 }, notice: { x: -34, z: -62 }, village: { x: -60, z: -30 }, contest: { x: 120, z: 18 }, museum: { x: 108, z: 58 }, farm: { x: -128, z: 50 },
    // 2단계 (2026-10-19): the rest of what stands by hand -- [x, z] or { x, z, face: [x, z] } (the point its front looks at)
    spawn: { x: -22, z: -60 }, // 첫 접속 자리: 알림마루's east side, on 대청마당
    records: { x: 53, z: -90, face: [40, -88] }, missions: { x: 50, z: -54, face: [40, -62] }, // beside the 게임관
    admin: { x: -54, z: -72, face: [-40, -76] }, chat: { x: -86, z: -4, face: [-100, -20] }, climb: { x: -128, z: -12, face: [-112, -10] },
    // (the trader and the 작명소 are indoors: the 백화점's 노점 and the 관공서's 개명 신청 window)
    lane: [[-52, -48], [-74, -4]], // 이웃골's street (the islanders' ten houses either side of it)
    mural: { x: 30, z: -57, face: [0, -84] }, busk: { x: 16, z: -12, face: [0, -30] }, stones: { x: -103.5, z: 39 }, bookcart: { x: -27, z: -68, face: [-34, -62] },
    omokTable: { x: -94, z: -8, face: [-86, -4] }, birthday: { x: -12, z: -60, face: [0, -84] },
    hallLamps: [[-2.8, -22], [3.2, -30], [-2.8, -38]], // the three lamps the electrician mends, beside the walk to the water (off it)
    stationmaster: { x: 83, z: 137 }, // by 달끝역's way in
    // 5단계 the quest givers and the places they send one to (lib/island-quests.js; 지금 섬's own spots there)
    // October's fields (a scarecrow and a hay bale each), its brooms, hay and a cauldron by 거울호수 (island-halloween.js)
    halloween: { fields: [[-60, 20], [60, 20], [120, 40], [-8, 150], [-132, 30]], extras: [['broom', -112, -22, 0.6], ['broom', -96, 36, 2.1], ['hay', -122, 46, 1.2], ['cauldron', -82, -24, 1.57]] },
    quests: { photographer: { x: -12, z: -12 }, gardener: { x: -56, z: 14 }, flowers: { x: -94, z: 44 }, fisher: { x: 84, z: 133 }, pierEnd: { x: 107, z: 165 },
      station: { x: -88.3, z: 143.9 }, stonesBank: { x: -99, z: 36 }, kid: { x: -8, z: -64 }, pumpkin: { x: 0, z: -78.5 } },
  };
  const TRAIN = { r: 184, stations: { west: Math.PI - Math.atan2(TIP_Z, TIP_X), north: -Math.PI / 2, east: Math.atan2(TIP_Z, TIP_X), isle: Math.PI / 2 } };
  const NAMES = { island: '달마루섬', ridge: '달마루 능선', cliff: '영웅마루', plaza: '대청마당', notice: '알림마루', bay: '윤슬만', isle: '툇마루섬', bridge: '윤슬다리', village: '이웃골', west: '푸른숲골', lake: '거울호수', falls: '마루폭포', east: '잔치마루', eastRiver: '은하내', lighthouse: '초승등대', pier: '달끝나루' };

  return { CAPES, PLACES, BRIDGE_Z, R_OUT, R_BAY, BAY_Z, R_ISLE, TIP_X, TIP_Z, ISLE, RIDGE, PLAZA, SEA, LAKE, RIVERS, POOLS, ISLE_POND, BRIDGES, TRAIN, NAMES,
    coastDist, inBay, ridgeAt, landHeight, ground, heightAt, isWater, slopeAt, walkable, seasonZoneAt, riverDist, lakeDist, smooth, lerp, wrap };
}));
