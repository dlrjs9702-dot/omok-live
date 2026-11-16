// 1.10.341 지하 도박장 (notes docs/underground-den-20261116.md; assets 147 den_room): its own room far off the island like the
// 증권거래소's (turned half round the same way), reached by the bookcase door beside 테드's counter. Room-local metres from assets
// 147 (the stairs at local -Z: `door_in` (-3.0, -2.8); `walls` outline x ±4.35, z ±3.35 and its twelve blocks; the tables' places).
// Each table's spot: before its front (-Z). Browser and server.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandDen = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const ROOM = Object.freeze({ x: 310, z: -330, y: 0.4, w: 8.7, d: 6.7, entry: Object.freeze({ lx: -3.0, lz: -2.35 }), exit: Object.freeze({ lx: -3.0, lz: -2.8 }) });
  const world = (lx, lz) => ({ x: Math.round((ROOM.x - lx) * 100) / 100, z: Math.round((ROOM.z - lz) * 100) / 100 });
  const local = (x, z) => ({ lx: ROOM.x - x, lz: ROOM.z - z });
  const inRoom = (x, z, pad = 0) => Math.abs(x - ROOM.x) <= ROOM.w / 2 + pad && Math.abs(z - ROOM.z) <= ROOM.d / 2 + pad;
  // (147 `walls.blocks`: the bar, its shelf, four stools, three tables, three slot machines)
  const B = [3.5, -0.65, 0.75, 3.4, 4.33, -0.65, 0.36, 3.3, 2.8, -1.85, 0.42, 0.42, 2.8, -0.95, 0.42, 0.42, 2.8, -0.05, 0.42, 0.42, 2.8, 0.85, 0.42, 0.42, 0.2, -1.25, 1.7, 1, 1.3, 1.5, 1.75, 1.05, -1.65, 0.85, 2.1, 1.2, -3.75, 3, 0.72, 0.62, -2.95, 3, 0.72, 0.62, -2.15, 3, 0.72, 0.62];
  const FIXTURES = Object.freeze(Array.from({ length: B.length / 4 }, (_, k) => Object.freeze({ x: B[k * 4], z: B[k * 4 + 1], w: B[k * 4 + 2], d: B[k * 4 + 3] })));
  // the tables (147 `place_*`, no turn: the player at -Z) -- where each stands and where one plays it from
  const TABLES = Object.freeze([
    { id: 'dice', model: 'den.table_dice', lx: 0.2, lz: -1.25, spot: { lx: 0.2, lz: -2.15 }, name: '주사위' },
    { id: 'hilo', model: 'den.table_cards', lx: 1.3, lz: 1.5, spot: { lx: 1.3, lz: 0.6 }, name: '카드 하이로우' },
    { id: 'roulette', model: 'den.table_roulette', lx: -1.65, lz: 0.85, spot: { lx: -1.65, lz: -0.1 }, name: '룰렛' },
    { id: 'slots', model: 'den.slot_machine', lx: -3.75, lz: 3, spot: { lx: -3.75, lz: 2.35 }, name: '슬롯머신' },
    { id: 'slots', model: 'den.slot_machine', lx: -2.95, lz: 3, spot: { lx: -2.95, lz: 2.35 }, name: '슬롯머신', k: 1 },
    { id: 'slots', model: 'den.slot_machine', lx: -2.15, lz: 3, spot: { lx: -2.15, lz: 2.35 }, name: '슬롯머신', k: 2 },
  ].map((t) => Object.freeze(t)));
  const REACH = 1.2;
  const tableAt = (x, z) => { const { lx, lz } = local(x, z); let best = null; let d = REACH; for (const t of TABLES) { const k = Math.hypot(lx - t.spot.lx, lz - t.spot.lz); if (k <= d) { d = k; best = t; } } return best; };
  function clamp(x, z) {
    const fin = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
    const e = world(ROOM.entry.lx, ROOM.entry.lz); let { lx, lz } = local(fin(x, e.x), fin(z, e.z));
    lx = Math.max(-ROOM.w / 2 + 0.3, Math.min(ROOM.w / 2 - 0.3, lx)); lz = Math.max(-ROOM.d / 2 + 0.3, Math.min(ROOM.d / 2 - 0.3, lz));
    const hit = (x, z) => FIXTURES.find((f) => Math.abs(x - f.x) < f.w / 2 + 0.3 - 1e-6 && Math.abs(z - f.z) < f.d / 2 + 0.3 - 1e-6);
    for (let pass = 0, f = hit(lx, lz); f && pass < 4; pass += 1, f = hit(lx, lz)) {
      const hx = f.w / 2 + 0.3; const hz = f.d / 2 + 0.3;
      const ways = [[f.x - hx, lz], [f.x + hx, lz], [lx, f.z - hz], [lx, f.z + hz]].sort((p, q) => Math.hypot(p[0] - lx, p[1] - lz) - Math.hypot(q[0] - lx, q[1] - lz));
      [lx, lz] = ways.find(([x, z]) => !hit(x, z) && Math.abs(x) <= ROOM.w / 2 - 0.3 && Math.abs(z) <= ROOM.d / 2 - 0.3) || ways[0];
    }
    return world(lx, lz);
  }
  // the bookcase door in the exchange room (147: 118b local (-4.70, 0, 0), turned -π/2; one stands at (-3.38, 0) to go down) and
  // the 관공서's 「잠시 자리 비움」 (147: the townhall's local (1.7, 0, 8.35), turned half round)
  const DOOR = Object.freeze({ lx: -4.70, lz: 0, yaw: -Math.PI / 2, stand: Object.freeze({ lx: -3.38, lz: 0 }), closed: Object.freeze({ x: -4.48, z: 0, w: 0.44, d: 1.40 }) });
  const SIGN = Object.freeze({ lx: 1.7, lz: 8.35, yaw: Math.PI });
  // (1.10.342 assets 147b den-results.json, measured on the game files: the roulette's pockets -- the wheel at rotation w, pocket n
  // is at w + POCKETS[n]; the ball in a pocket BALL_IN (dr, dy) from its track; each die's rotation (XYZ) with face v up)
  const RESULTS = Object.freeze({
    pockets: [-0.1654, -0.4961, -0.8268, -1.1575, -1.4881, -1.8189, -2.1495, -2.4803, -2.8109, -3.1416, 2.8109, 2.4803, 2.1495, 1.8189, 1.4881, 1.1575, 0.8268, 0.4961, 0.1654],
    ball: { dr: -0.08, dy: -0.0076 },
    dice: [[[0, 0, 0], [-3.1416, 0, 0], [0, 0, 1.5708], [0, 0, -1.5708], [-1.5708, 0, 0], [1.5708, 0, 0]],
      [[0, 0, 0], [-3.1416, -1.0001, 0], [0.5569, 0.4343, 1.3145], [-0.5569, 0.4343, -1.3146], [-1.3145, -0.4343, 0.557], [1.3146, -0.4343, -0.5568]],
      [[0, 0, 0], [0, -1.1416, 3.1416], [1.2368, 0.472, 0.6519], [-1.2369, 0.472, -0.6518], [-0.6519, -0.472, 1.2367], [0.6518, -0.472, -1.2369]]],
  });
  return { ROOM, FIXTURES, TABLES, REACH, DOOR, SIGN, RESULTS, world, local, inRoom, tableAt, clamp };
}));
