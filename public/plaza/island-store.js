// 백화점 개편 A안 (gamecenter-notes docs/mall-revamp-20261027.md, v1.10.211): this is the 1st floor, 잡화·생활 -- one counter
// (the 잡화점's window, the bag made bigger), the 노점's buying by the sell baskets beside it, the goods on the 오늘의 물건 table,
// the 소모품 gondolas and the tool wall (assets 82 mall.floor1 and its pieces, README 「층별 배치」); the clothes, hair, colour
// and face went up to the 2nd floor (island-fashion.js), the game skins to the game hall's 「스킨」 tab.
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
    { id: 'store', place: 'mall:store', name: '잡화점', interact: [9.5, 4.3], keeper: [9.5, 6.6, 0] }, // (assets 82 mall.counter__f1: its customer and keeper spots)
    { id: 'stall', place: 'mall:stall', name: '노점', interact: [12.4, 4.5], keeper: null }, // (the sell basket by the counter -- its keeper's)
  ].map((s) => Object.freeze(s)));
  const sectorOf = (place) => SECTORS.find((s) => s.place === place) || null;
  const sectorPoint = (place) => { const s = sectorOf(place); return s ? world(s.interact[0], s.interact[1]) : null; };
  // what stands (assets 82 README; x, z centre, w, d along the room's axes): model id, x, z, yaw, w, d (no id: drawn by the room)
  const PROPS = Object.freeze([
    ['mall.today_table', 0, -3.2, 0, 3.46, 2.42], ['mall.gondola', 4.6, 0.2, Math.PI / 2, 0.9, 3.66], ['mall.gondola', 7.7, 0.2, Math.PI / 2, 0.9, 3.66], ['mall.gondola', 10.8, 0.2, Math.PI / 2, 0.9, 3.66],
    ['mall.wall_shelf', 13.0, 9.98, 0, 3.64, 0.47, true], ['mall.tool_wall', -8.0, 9.98, 0, 5.1, 1.0, true], ['mall.counter__f1', 9.5, 5.6, 0, 2.3, 0.85],
    ['mall.sell_basket', 12.4, 5.6, 0, 0.87, 0.96], ['mall.sell_basket', 6.6, 5.6, 0, 0.87, 0.96],
    ...[[-2.0, -9.3], [-14.2, -9.2], [14.2, -9.2], [-14.2, 9.2], [5.0, 9.4], [14.2, -2.5]].map(([x, z]) => [null, x, z, 0, 0.6, 0.6]), // (the room's pots)
  ].map(([id, x, z, yaw, w, d, wall]) => Object.freeze({ id, x, z: wall ? z - d / 2 : z, at: z, yaw, w, d })));
  const FIXTURES = Object.freeze([
    ...PROPS.filter((p) => p.w).map((p) => [p.x, p.z, p.w, p.d]), [3.4, -7.6, 0.6, 0.4] /* (the sign stand) */, [-13.095, 0, 1.91, 2.1] /* (the lift's body: lx -14.05 to -12.14) */,
  ].map(([x, z, w, d]) => Object.freeze({ x, z, w, d })));
  // where each good stands in the 잡화 sector (assets 43 manifest.goodsSlots); seeds, the sapling and fertilizer wait for planting
  // (assets 82 anchors, model-local glTF m, turned by the piece's yaw into the room: x' = x cos + z sin, z' = -x sin + z cos)
  const on = (px, pz, yaw, [ax, ay, az]) => [Math.round((px + ax * Math.cos(yaw) + az * Math.sin(yaw)) * 1000) / 1000, ay, Math.round((pz - ax * Math.sin(yaw) + az * Math.cos(yaw)) * 1000) / 1000];
  const TODAY = [[-1.17, 0.517, -0.975], [-0.39, 0.517, -0.975], [0.39, 0.517, -0.975], [1.17, 0.517, -0.975], [-0.78, 0.92, -0.65], [0, 0.92, -0.65], [0.78, 0.92, -0.65], [0, 1.265, -0.065]];
  const SHELF_ROW = [-1.5, -0.9, -0.3, 0.3, 0.9, 1.5]; // (assets 82 mall.wall_shelf s12-s17)
  const ROW = [-1.45, -0.87, -0.29, 0.29, 0.87, 1.45]; // (a gondola's six along its middle shelf, 0.815 up; a: its -x face, b: +x)
  const gondola = (gx, side, k) => on(gx, 0.2, Math.PI / 2, [ROW[k], 0.815, side === 'a' ? -0.24 : 0.24]);
  // where each good stands: the play things and gifts on the 오늘의 물건 table, the 소모품 on the gondolas (seeds and growing,
  // then the kitchen and the toolbox), the net and the rod on the tool wall's hooks, the bikes on the floor by the door
  const SHELF = Object.freeze([
    ...['firework', 'bubbles', 'balloon', 'badge'].map((id, k) => [id, on(0, -3.2, 0, TODAY[k])]), // (the front row: the back rows are always behind a nearer one)
    ...['bouquet', 'gift_wrap', 'letter_paper', 'frame'].map((id, k) => [id, on(13.0, 9.98, 0, [SHELF_ROW[k + 1], 1.015, -0.25])]), // (the wall shelf by the counter, its third shelf)
    ...['seed_flower_red', 'seed_flower_yellow', 'seed_flower_white', 'seed_flower_pink', 'seed_flower_purple', 'sapling'].map((id, k) => [id, gondola(4.6, 'a', k)]),
    ...['fertilizer', 'bait', 'bait_premium'].map((id, k) => [id, gondola(4.6, 'b', k + 1)]),
    ...['milk', 'bread', 'bulb', 'paint', 'nail_box', 'guitar_string'].map((id, k) => [id, gondola(7.7, 'a', k)]),
    ['fishing_rod', on(-8.0, 9.98, 0, [-2, 1.86, -0.2])], ['bugnet', on(-8.0, 9.98, 0, [-1.2, 1.86, -0.2])], // (hook0 the rod, hook1 the net -- B 47)
    ['bike_mint', [-9.35, 0, -6]], ['bike_red', [-8.45, 0, -6]], ['bike_sky', [-7.55, 0, -6]], ['bike_butter', [-6.65, 0, -6]], // (자전거: by the door)
  ].map(([id, at]) => Object.freeze({ id, at: Object.freeze(at), yaw: 0, soon: false }))); // (B 45: the seeds, the sapling and fertilizer on sale)
  const REACH = 1.5; // a good within this of me (on the floor plan) is the one SPACE buys (v1.10.211: the tool wall's hooks and the table's back row, 1.2-1.5 off where one stands)
  // 묶음 2 가구점: the lift on the left wall (assets 57 mall.elevator, its back on the wall) -- SPACE in front of it goes up
  const LIFT = Object.freeze({ lx: -14.05, lz: 0, yaw: -Math.PI / 2, stand: Object.freeze([-11.5, 0]) }); // (stand: before its door, 2회차 8)
  // v1.10.211 the floors: 1 잡화·생활 (here), 2 옷·꾸미기 (island-fashion.js), 3 가구 (island-furniture.js), 4 옥상 펫샵 (island-petshop.js)
  const FLOORS = Object.freeze([null, '잡화·생활', '옷·꾸미기', '가구', '옥상 펫샵']);
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
  // (v1.10.211) where to stand for a good: the nearest clear spot round it from which SPACE picks it (null if none)
  function standFor(id) {
    const g = SHELF.find((s) => s.id === id); if (!g) return null;
    for (const r of [0.5, 0.8, 1.1, 1.4]) for (let k = 0; k < 48; k += 1) {
      const a = (k / 48) * Math.PI * 2; const w = world(g.at[0] + Math.cos(a) * r, g.at[2] + Math.sin(a) * r); const c = clamp(w.x, w.z);
      if (Math.hypot(c.x - w.x, c.z - w.z) < 1e-6 && goodAt(w.x, w.z)?.id === id) return w;
    }
    return null;
  }
  return { ROOM, SECTORS, PROPS, FIXTURES, SHELF, REACH, LIFT, FLOORS, standFor, world, local, inStore, clamp, goodAt, sectorOf, sectorPoint };
}));
