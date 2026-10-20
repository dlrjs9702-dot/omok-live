// 묶음 4 내 집 (gamecenter-notes docs/my-home-20261020.md, 사용자 2026-10-20 「4. 내 집 + 수조까지」): one house an account,
// on 툇마루섬's lots (assets 58 home.house, its door at the model's -Z); inside, an 8 x 8 m room of its own far off the
// island (each lot its own, so two houses never share a room) where the furniture of the 가구 창고 (묶음 2) is placed
// on 0.25 m steps, turned by quarters, the hung things against a wall; the tanks hold fish from the bag. Browser and
// server: the server checks every placing with these same rules.
(function (root, factory) {
  const terrain = typeof module === 'object' && module.exports ? require('./island-terrain.js') : root.IslandTerrain;
  const api = factory(terrain);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandHome = api;
}(typeof self !== 'undefined' ? self : this, (T) => {
  // 툇마루섬's twelve lots (dalmaru-island HOME_LOTS); each house faces the walk across the isle
  const ISLE = { x: 0, z: 143.29 };
  const LOTS = Object.freeze((T.HOME_LOTS || []).map((l) => [l.x, l.z])
    .map(([x, z], i) => { const yaw = Math.atan2(x - ISLE.x, z - 140.5); return Object.freeze({ id: `lot${i + 1}`, n: i + 1, x, z, yaw }); })); // (yaw: the house's front, -Z, toward the walk across the isle at z 140.5)
  const lotById = (id) => LOTS.find((l) => l.id === id) || null;
  // the house's door: in front of its steps (assets 58 seats kind door, local 0, -3.9) -- model -Z is the front
  const doorOf = (lot) => ({ x: Math.round((lot.x - Math.sin(lot.yaw) * 4.6) * 100) / 100, z: Math.round((lot.z - Math.cos(lot.yaw) * 4.6) * 100) / 100 });
  const ROOFS = Object.freeze(['red', 'blue', 'green', 'brown']);
  const FLOORS = Object.freeze(['boards__oak', 'boards__walnut', 'boards__birch', 'tiles__mint', 'tiles__pink']);
  const WALLS = Object.freeze(['cream', 'mint', 'pink', 'sky']);
  const VISITS = Object.freeze(['anyone', 'friends', 'none']); // (사용자 2026-10-20: 아무나 / 친구만 / 안 받음, 아무나 first)
  // the room: 8 x 8 m (assets 58 home.room), its low wall and doorway at local -Z (toward the camera), turned half
  // round in the world like the 백화점's floors; each lot's room 200 m from the next
  const ROOM = Object.freeze({ w: 8, d: 8, y: 0.4, half: 3.85 });
  const roomOf = (lot) => ({ x: 300 + lot.n * 200, z: -330, y: ROOM.y });
  const world = (lot, lx, lz) => { const r = roomOf(lot); return { x: Math.round((r.x - lx) * 100) / 100, z: Math.round((r.z - lz) * 100) / 100 }; };
  const local = (lot, x, z) => { const r = roomOf(lot); return { lx: r.x - x, lz: r.z - z }; };
  const inRoom = (lot, x, z, pad = 0) => { const { lx, lz } = local(lot, x, z); return Math.abs(lx) <= ROOM.w / 2 + pad && Math.abs(lz) <= ROOM.d / 2 + pad; };
  const ENTRY = Object.freeze([0, -3.1]); // where one stands coming in (the doorway behind)
  const DOORWAY = Object.freeze({ x0: -0.8, x1: 0.8, z0: -4, z1: -2.6 }); // kept clear (the way out)
  const MAX_PIECES = 40; const MAX_FISH = 20;
  // what each furniture shape takes (assets 57 manifest: width x, depth z, height), and which ones hang on a wall
  const SIZE = { aquarium_big: [2.4, 0.82, 1.82], aquarium_pillar: [1.9, 1.9, 2.65], aquarium_wall: [4.2, 1.46, 2.85], armchair: [0.9, 0.85, 0.88], bed: [1.16, 2.12, 0.95], bookshelf: [1.04, 0.37, 1.85], bunk_bed: [1.04, 1.9, 1.6], cheongsa_lantern: [0.52, 0.26, 1.32], coffee_table: [1.1, 0.6, 0.54], counter: [1.64, 0.66, 1.11], cupboard: [1.04, 0.49, 1.71], curtain_window: [1.41, 0.17, 1.29], desk: [1.2, 0.63, 0.85], dining_chair: [0.46, 0.46, 0.98], dining_table: [1.4, 0.85, 1.08], dresser: [1, 0.49, 0.85], fence_piece: [1.93, 0.13, 0.94], fish_bowl: [0.48, 0.48, 1.21], fish_tank: [0.92, 0.42, 1.01], floor_cushion: [0.59, 0.6, 0.11], floor_lamp: [0.52, 0.52, 1.71], folding_screen: [1.79, 0.18, 1.4], fridge: [0.7, 0.7, 1.75], garden_bench: [1.6, 0.53, 0.93], hanger_rack: [1.25, 0.45, 1.5], insect_case: [0.6, 0.34, 0.7], mini_lighthouse: [0.36, 0.36, 0.81], mirror_stand: [0.55, 0.3, 1.6], moon_lamp: [0.34, 0.32, 0.62], nightstand: [0.45, 0.44, 0.84], onggi: [0.6, 0.6, 0.79], parasol_table: [2.1, 2.1, 2.25], piano: [1.4, 0.74, 1.23], picture_frame: [0.7, 0.07, 0.55], plant_pot: [0.64, 0.61, 1.14], planter_box: [1.2, 0.45, 0.71], radio: [0.43, 0.2, 0.52], rug_round: [1.9, 1.9, 0.03], shell_lamp: [0.58, 0.28, 0.58], soban: [0.8, 0.8, 0.37], sofa: [1.9, 0.85, 0.84], stool: [0.36, 0.36, 0.52], tall_clock: [0.52, 0.35, 1.9], toy_box: [0.74, 0.49, 0.65], tv_stand: [1.3, 0.43, 1.16], wall_clock: [0.44, 0.07, 0.44], wall_shelf: [0.9, 0.24, 0.36], wardrobe: [1.26, 0.64, 2.06] };
  const HUNG = new Set(['picture_frame', 'wall_clock', 'curtain_window', 'wall_shelf']); // (their backs on a wall, at the height made)
  const FLAT = new Set(['rug_round']); // (under the rest)
  // where one sits (assets 57 manifest seats, model local: x, height, z) -- 'lie' and 'floor' sit too for now
  const SEATS = { armchair: [[0, 0.46, -0.12]], dining_chair: [[0, 0.53, -0.02]], floor_cushion: [[0, 0.1, 0]], garden_bench: [[-0.4, 0.47, 0], [0.4, 0.47, 0]], sofa: [[-0.45, 0.46, -0.12], [0.45, 0.46, -0.12]], stool: [[0, 0.51, 0]], bed: [[0, 0.5, 0]], bunk_bed: [[0, 0.42, 0]] };
  // the tanks (assets 57 manifest swim): where fish swim (model local), how many, the biggest size they take, how small fish show
  const TANKS = {
    fish_bowl: { min: [-0.1, 0.88, -0.1], max: [0.1, 1.08, 0.1], slots: 1, biggest: 'small', fishScale: 0.5 },
    fish_tank: { min: [-0.36, 0.66, -0.12], max: [0.36, 0.9, 0.12], slots: 3, biggest: 'small', fishScale: 0.6 },
    aquarium_big: { min: [-1.05, 0.85, -0.28], max: [1.05, 1.6, 0.28], slots: 8, biggest: 'medium', fishScale: 0.85 },
    aquarium_pillar: { min: [-0.6, 0.6, -0.6], max: [0.6, 2.25, 0.6], slots: 8, biggest: 'medium', fishScale: 0.85, cylinder: true },
    aquarium_wall: { min: [-1.75, 0.45, -0.4], max: [1.75, 2.2, 0.4], slots: 12, biggest: 'large', fishScale: 1 },
  };
  const FISH_SIZE = { fish_anchovy: 'small', fish_crucian_carp: 'small', fish_gizzard_shad: 'small', fish_goby: 'small', fish_mackerel: 'small', fish_pale_chub: 'small', fish_smelt: 'small', fish_sweetfish: 'small', fish_pufferfish: 'small',
    fish_carp: 'medium', fish_catfish: 'medium', fish_cutlassfish: 'medium', fish_eel: 'medium', fish_flatfish: 'medium', fish_mandarin_fish: 'medium', fish_mullet: 'medium', fish_octopus: 'medium', fish_rockfish: 'medium', fish_sea_bass: 'medium', fish_stingray: 'medium', fish_giant_tuna: 'large' };
  const BOTTOM = new Set(['fish_octopus', 'fish_stingray', 'fish_flatfish']); // (they keep to the sand)
  const SIZE_RANK = { small: 1, medium: 2, large: 3 };
  const fits = (tankShape, fishId) => Boolean(TANKS[tankShape] && FISH_SIZE[fishId] && SIZE_RANK[FISH_SIZE[fishId]] <= SIZE_RANK[TANKS[tankShape].biggest]);
  const shapeOf = (goodId) => String(goodId || '').split('__')[0];
  // a placed piece's floor box (room-local): its footprint turned by rot quarters about (x, z)
  function boxOf(p) {
    const s = SIZE[shapeOf(p.id)]; if (!s) return null;
    const [w, d] = p.rot % 2 ? [s[1], s[0]] : [s[0], s[1]];
    return { x0: p.x - w / 2, x1: p.x + w / 2, z0: p.z - d / 2, z1: p.z + d / 2 };
  }
  const overlap = (a, b) => a.x0 < b.x1 - 1e-6 && b.x0 < a.x1 - 1e-6 && a.z0 < b.z1 - 1e-6 && b.z0 < a.z1 - 1e-6;
  // the back of a piece (its +Z, as made) points to: rot 0 -> +z (the back wall), 1 -> -x... (a quarter turn each)
  const backDir = (rot) => [[0, 1], [1, 0], [0, -1], [-1, 0]][((rot % 4) + 4) % 4];
  // -> null when it may stand there, else why not (Korean, for the page)
  function placeError(p, others = []) {
    const shape = shapeOf(p.id); if (!SIZE[shape]) return '놓을 수 없는 가구예요.';
    if (![0, 1, 2, 3].includes(p.rot) || !Number.isFinite(p.x) || !Number.isFinite(p.z) || Math.abs(p.x * 4 - Math.round(p.x * 4)) > 1e-6 || Math.abs(p.z * 4 - Math.round(p.z * 4)) > 1e-6) return '자리를 확인해 주세요.';
    const b = boxOf(p); const H = ROOM.half;
    if (b.x0 < -H - 1e-6 || b.x1 > H + 1e-6 || b.z0 < -H - 1e-6 || b.z1 > H + 1e-6) return '방 밖으로 나가요.';
    if (HUNG.has(shape)) { // its back against the back or a side wall (the low front wall holds nothing)
      const [bx, bz] = backDir(p.rot); const ok = (bz === 1 && b.z1 > H - 0.2) || (bx === 1 && b.x1 > H - 0.2) || (bx === -1 && b.x0 < -H + 0.2); // (on the 0.25 m steps: drawn flat against the wall)
      if (!ok) return '벽에 거는 가구예요. 뒤가 벽에 닿게 놓아 주세요.';
      return others.some((o) => HUNG.has(shapeOf(o.id)) && overlap(b, boxOf(o))) ? '다른 장식과 겹쳐요.' : null;
    }
    if (overlap(b, DOORWAY)) return '문 앞은 비워 두세요.';
    if (FLAT.has(shape)) return null; // (a rug goes under the rest)
    return others.some((o) => !HUNG.has(shapeOf(o.id)) && !FLAT.has(shapeOf(o.id)) && overlap(b, boxOf(o))) ? '다른 가구와 겹쳐요.' : null;
  }
  // where one may stand inside: in the walls, out of the floor pieces (0.3 m round them)
  function clamp(lot, x, z, pieces = []) {
    const fin = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
    const e = world(lot, ENTRY[0], ENTRY[1]);
    let { lx, lz } = local(lot, fin(x, e.x), fin(z, e.z));
    lx = Math.max(-ROOM.half + 0.35, Math.min(ROOM.half - 0.35, lx)); lz = Math.max(-ROOM.half + 0.35, Math.min(ROOM.half - 0.35, lz));
    const solid = pieces.filter((p) => !HUNG.has(shapeOf(p.id)) && !FLAT.has(shapeOf(p.id))).map(boxOf).filter(Boolean);
    const hit = (x, z) => solid.find((b) => x > b.x0 - 0.3 && x < b.x1 + 0.3 && z > b.z0 - 0.3 && z < b.z1 + 0.3);
    for (let pass = 0, b = hit(lx, lz); b && pass < 4; pass += 1, b = hit(lx, lz)) {
      const ways = [[b.x0 - 0.3, lz], [b.x1 + 0.3, lz], [lx, b.z0 - 0.3], [lx, b.z1 + 0.3]].sort((p, q) => Math.hypot(p[0] - lx, p[1] - lz) - Math.hypot(q[0] - lx, q[1] - lz));
      [lx, lz] = ways.find(([x, z]) => !hit(x, z) && Math.abs(x) <= ROOM.half - 0.35 && Math.abs(z) <= ROOM.half - 0.35) || ways[0];
    }
    return world(lot, lx, lz);
  }
  // a piece's seats in the world (room-local turned by rot, then into the world)
  function seatsOf(lot, p) {
    const list = SEATS[shapeOf(p.id)] || []; const a = (p.rot * Math.PI) / 2;
    return list.map(([sx, sy, sz], k) => { const lx = p.x + sx * Math.cos(a) + sz * Math.sin(a); const lz = p.z - sx * Math.sin(a) + sz * Math.cos(a); const w = world(lot, lx, lz); return { id: `home:${p.uid}:${k}`, x: w.x, z: w.z, y: ROOM.y + sy - 0.45, yaw: a }; /* (y: as the scene lifts a seat 0.28 and a sitter's hips sit 0.17 below the seat; yaw: the piece's front, the room turned half round) */ });
  }
  return { LOTS, lotById, doorOf, ROOFS, FLOORS, WALLS, VISITS, ROOM, roomOf, world, local, inRoom, ENTRY, DOORWAY, MAX_PIECES, MAX_FISH, SIZE, HUNG, FLAT, SEATS, TANKS, FISH_SIZE, BOTTOM, fits, shapeOf, boxOf, placeError, clamp, seatsOf };
}));
