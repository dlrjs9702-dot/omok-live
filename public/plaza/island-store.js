// v1.10.92 백화점 (사용자 2026-10-18 「상점가도 백화점화… 큰 건물 하나, 내부에 섹터별로」, IDEAS #future-department-store):
// the shop street's shops in one building one walks into (like the 민원실, its own room far off the island) -- eight
// sectors, each with its keeper; at a sector's spot SPACE opens that shop (the same windows as before), and in the 잡화
// sector the goods stand on shelves and tables (assets 41) -- standing at one, SPACE buys it. The room, its sectors,
// obstacles and where each good stands come from assets 43 (manifest.json, room-local metres, its door at local -Z); the
// room is turned half round in the world so the door is toward the camera like the 민원실's. Browser and server.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandStore = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const ROOM = Object.freeze({ x: 100, z: -330, y: 0.4, w: 30, d: 20, entry: Object.freeze({ lx: 0, lz: -8.6 }), exit: Object.freeze({ lx: 0, lz: -9.4 }) });
  // room-local -> world (turned half round: local +Z is world -Z)
  const world = (lx, lz) => ({ x: Math.round((ROOM.x - lx) * 100) / 100, z: Math.round((ROOM.z - lz) * 100) / 100 });
  const local = (x, z) => ({ lx: ROOM.x - x, lz: ROOM.z - z });
  const inStore = (x, z, pad = 0) => Math.abs(x - ROOM.x) <= ROOM.w / 2 + pad && Math.abs(z - ROOM.z) <= ROOM.d / 2 + pad;
  // the sectors: `place` is the facility id each shop had on the island (its window and the server's check stay)
  const SECTORS = Object.freeze([
    { id: 'game', place: 'shop', name: '게임 스킨 상점', interact: [-12.3, -3.3], keeper: [-12.3, -6.1, Math.PI] },
    { id: 'clothes', place: 'avatar', name: '옷가게', interact: [-4.7, -3.3], keeper: [-4.7, -6.1, Math.PI] },
    { id: 'hair', place: 'hair', name: '미용실', interact: [3.7, -3.6], keeper: [1.05, -5.35, Math.PI] },
    { id: 'accessories', place: 'accessories', name: '소품 가게', interact: [9.9, -3.3], keeper: [9.9, -5.85, Math.PI] },
    { id: 'surgery', place: 'faces', name: '성형외과', interact: [-11.1, 4], keeper: [-11.1, 7.05, 0] },
    { id: 'dye', place: 'dye', name: '염색사', interact: [-3.7, 4.1], keeper: [-3.7, 6.75, 0] },
    { id: 'transform', place: 'transform', name: '변신 의상실', interact: [5.3, 3.65], keeper: [5.3, 5.3, 0] },
    { id: 'store', place: 'mall:store', name: '잡화점', interact: [12.3, 3.3], keeper: [12.3, 6, 0] },
    // (달마루섬 5단계: the trader's stall, 9th -- its buy-back window as outside -- along the wall at local +x, the keeper behind it)
    { id: 'stall', place: 'mall:stall', name: '노점', interact: [11.9, 0], keeper: [14.05, 0, Math.PI / 2], stall: [13.2, 0] },
  ].map((s) => Object.freeze(s)));
  const sectorOf = (place) => SECTORS.find((s) => s.place === place) || null;
  const sectorPoint = (place) => { const s = sectorOf(place); return s ? world(s.interact[0], s.interact[1]) : null; };
  const FIXTURES = Object.freeze([ // the furniture (assets 43 manifest.obstacles, walls apart): x, z centre, w, d (all square to the room)
    [-9.55, -7.5, 1.72, 0.77], [-12.65, -7.5, 1.72, 0.77], [-9.75, -4.55, 1.92, 1.42], [-12.3, -4.6, 2.12, 0.82], [-1.9, -7.6, 1.42, 0.72], [-3.7, -7.6, 1.42, 0.72],
    [-5.5, -7.6, 1.42, 0.72], [-1.9, -4.5, 0.97, 0.62], [-4.7, -4.6, 2.32, 0.82], [4.95, -5.4, 1.07, 1.22], [2.45, -5.4, 1.07, 1.22], [4.95, -7, 1.32, 0.52],
    [2.45, -7, 1.32, 0.52], [12.7, -4.9, 1.37, 1.27], [11.6, -7.1, 3.52, 0.82], [9.9, -4.6, 2.12, 0.82], [-11.1, 5.55, 2.32, 1.07], [-12.9, 4.5, 0.82, 0.92],
    [-9.45, 7.15, 0.92, 0.52], [-3.7, 5.4, 3.42, 0.97], [-3.7, 7.95, 4.62, 0.62], [2.55, 6.1, 2.12, 2.52], [5.3, 7, 1.12, 0.62], [9.75, 7.35, 2.52, 0.82],
    [12.45, 7.35, 2.52, 0.82], [9.9, 4.55, 1.92, 1.52], [12.3, 4.7, 2.12, 0.82], [13.2, 0, 0.9, 2.2] /* (the 노점's stall) */, [-14.05, 0, 1.91, 2.1] /* (묶음 2: the lift to the 가구점) */,
  ].map(([x, z, w, d]) => Object.freeze({ x, z, w, d })));
  // where each good stands in the 잡화 sector (assets 43 manifest.goodsSlots); seeds, the sapling and fertilizer wait for planting
  const SHELF = Object.freeze([
    ['seed_flower_red', [8.805, 1.12, 7.3]], ['seed_flower_yellow', [9.045, 1.12, 7.3]], ['seed_flower_white', [9.355, 1.12, 7.3]], ['seed_flower_pink', [9.595, 1.12, 7.3]],
    ['seed_flower_purple', [9.905, 1.12, 7.3]], ['sapling', [10.145, 1.12, 7.3]], ['bait', [10.455, 1.12, 7.3]], ['bait_premium', [10.695, 1.12, 7.3]],
    ['fertilizer', [11.625, 1.12, 7.3]], ['guitar_string', [12.055, 1.12, 7.3]], ['nail_box', [12.295, 1.12, 7.3]], ['milk', [12.605, 1.12, 7.3]],
    ['bread', [12.845, 1.12, 7.3]], ['bulb', [13.155, 1.12, 7.3]], ['paint', [13.395, 1.12, 7.3]], ['bouquet', [9.78, 0.82, 4.12]], ['gift_wrap', [10.02, 0.82, 4.12]], ['bugnet', [10.3, 0.82, 4.12]] /* (B 47) */, ['fishing_rod', [10.58, 0.82, 4.12]],
    ['frame', [12.87, 1.02, 4.6]] /* (the table's middle row could not be reached either) */, ['letter_paper', [11.16, 1.12, 7.3]] /* (Codex review: in the table's middle it could not be reached -- the gap of the back shelf) */, ['firework', [9.54, 0.82, 4.98]], ['bubbles', [9.9, 0.82, 4.98]], ['balloon', [10.26, 0.82, 4.98]],
    ['badge', [11.73, 1.02, 4.6]], ['pet_puppy', [12.03, 1.02, 4.6]], ['pet_kitten', [12.31, 1.02, 4.6]], ['pet_bird', [12.59, 1.02, 4.6]], // (B 47: between the badge and the frame)
  ].map(([id, at]) => Object.freeze({ id, at: Object.freeze(at), yaw: 0, soon: false }))); // (B 45: the seeds, the sapling and fertilizer on sale)
  const REACH = 1.2; // a good within this of me (on the floor plan) is the one SPACE buys
  // 묶음 2 가구점: the lift on the left wall (assets 57 mall.elevator, its back on the wall) -- SPACE in front of it goes up
  const LIFT = Object.freeze({ lx: -14.05, lz: 0, yaw: -Math.PI / 2, stand: Object.freeze([-12.4, 0]) });
  // where one may stand: inside the walls (0.45 m off them), out of the furniture (0.35 m round it)
  function clamp(x, z) {
    const fin = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
    const e = world(ROOM.entry.lx, ROOM.entry.lz);
    let { lx, lz } = local(fin(x, e.x), fin(z, e.z));
    lx = Math.max(-ROOM.w / 2 + 0.45, Math.min(ROOM.w / 2 - 0.45, lx)); lz = Math.max(-ROOM.d / 2 + 0.45, Math.min(ROOM.d / 2 - 0.45, lz));
    // (Codex review: a push out of one piece could land in the next -- of the four ways out, the nearest clear one)
    const hit = (x, z) => FIXTURES.find((f) => Math.abs(x - f.x) < f.w / 2 + 0.35 - 1e-6 && Math.abs(z - f.z) < f.d / 2 + 0.35 - 1e-6);
    for (let pass = 0, f = hit(lx, lz); f && pass < 4; pass += 1, f = hit(lx, lz)) {
      const hx = f.w / 2 + 0.35; const hz = f.d / 2 + 0.35;
      const ways = [[f.x - hx, lz], [f.x + hx, lz], [lx, f.z - hz], [lx, f.z + hz]].sort((p, q) => Math.hypot(p[0] - lx, p[1] - lz) - Math.hypot(q[0] - lx, q[1] - lz));
      [lx, lz] = ways.find(([x, z]) => !hit(x, z) && Math.abs(x) <= ROOM.w / 2 - 0.45 && Math.abs(z) <= ROOM.d / 2 - 0.45) || ways[0];
    }
    return world(lx, lz);
  }
  // the good nearest me within reach (null if none)
  function goodAt(x, z) {
    const { lx, lz } = local(x, z); let best = null; let bd = REACH;
    for (const s of SHELF) { const d = Math.hypot(s.at[0] - lx, s.at[2] - lz); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  return { ROOM, SECTORS, FIXTURES, SHELF, REACH, LIFT, world, local, inStore, clamp, goodAt, sectorOf, sectorPoint };
}));
