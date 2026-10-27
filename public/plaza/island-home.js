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
    .map(([x, z], i) => { const yaw = (T.HOME_LOTS[i].yaw ?? Math.atan2(x - ISLE.x, z - 140.5)); return Object.freeze({ id: `lot${i + 1}`, n: i + 1, x, z, yaw }); })); // (yaw: the house's front, -Z, square to its walk -- 2회차 15, dalmaru-island HOME_LOTS)
  const lotById = (id) => LOTS.find((l) => l.id === id) || null;
  // the house's door: 0.7 m in front of its steps (assets 58 seats kind door: the 오두막 -2.9, the 작은 집 -3.9, the 큰 집
  // -6.2 past its veranda) -- model -Z is the front
  const DOOR = { 1: 3.6, 2: 4.6, 3: 6.9, 4: 6.9 }; // (R8 4단계: the 큰 집's footing and door)
  const doorOf = (lot, stage = 2) => { const d = DOOR[stage] || DOOR[2]; return { x: Math.round((lot.x - Math.sin(lot.yaw) * d) * 100) / 100, z: Math.round((lot.z - Math.cos(lot.yaw) * d) * 100) / 100 }; };
  const ROOFS = Object.freeze(['red', 'blue', 'green', 'brown']);
  const FLOORS = Object.freeze(['boards__oak', 'boards__walnut', 'boards__birch', 'tiles__mint', 'tiles__pink']);
  const WALLS = Object.freeze(['cream', 'mint', 'pink', 'sky']);
  const VISITS = Object.freeze(['anyone', 'friends', 'none']); // (사용자 2026-10-20: 아무나 / 친구만 / 안 받음, 아무나 first)
  // the room: 8 x 8 m (assets 58 home.room), its low wall and doorway at local -Z (toward the camera), turned half
  // round in the world like the 백화점's floors; each lot's room 200 m from the next
  const ROOM = Object.freeze({ w: 12, d: 12, y: 0.4, half: 5.85 }); // (the 작은 집's; each stage its own -- STAGES)
  // (R8 2층: a house's upper floor is a room of its own, 90 m behind its 1층 -- a lot marked `upper` stands for it, so
  // every rule here takes it as it takes a lot)
  const roomOf = (lot) => ({ x: 300 + lot.n * 200, z: lot.upper ? -420 : -330, y: ROOM.y });
  const upperLot = (lot) => (lot ? Object.freeze({ ...lot, upper: true }) : null);
  const world = (lot, lx, lz) => { const r = roomOf(lot); return { x: Math.round((r.x - lx) * 100) / 100, z: Math.round((r.z - lz) * 100) / 100 }; };
  const local = (lot, x, z) => { const r = roomOf(lot); return { lx: r.x - x, lz: r.z - z }; };
  // 묶음 4-2 집 단계 (docs/my-home-20261020.md 「단계」·「실내 크기 다시」, 사용자 「첫 주택은 오두막에서 진화해 나가는 걸로」·「좀
  // 작은데 1단계부터 다시」): every house starts as a 오두막 (its room 9 x 9 m, 25 pieces, 10 fish), is made a 작은 집 at the
  // 관공서 (12 x 12, 45, 20) and then a 큰 집 (16 x 13, 70, 30; walls 3.4 m, a half wall with an arch on its right third and
  // a window seat) -- each the same room's middle, so the pieces stay where they stood; a house without a stage
  // (v1.10.112) is a 작은 집. hx, hz: the inside of the walls (assets 58: the wallpaper 0.05 m in, the walls 0.15)
  const STAGES = Object.freeze({
    1: Object.freeze({ n: 1, w: 9, d: 9, hx: 4.35, hz: 4.35, pieces: 25, fish: 10, house: 'hut', room: 'hut_room', tile: '_s1', name: '오두막', fixed: [], seats: [] }),
    2: Object.freeze({ n: 2, w: 12, d: 12, hx: 5.85, hz: 5.85, pieces: 45, fish: 20, house: 'house', room: 'room', tile: '', name: '작은 집', fixed: [], seats: [] }),
    3: Object.freeze({ n: 3, w: 16, d: 13, hx: 7.85, hz: 6.35, pieces: 70, fish: 30, house: 'manor', room: 'manor_room', tile: '_s3', name: '큰 집',
      // (home.manor_room: the half wall at x 2.67 with its arch |z| < 1.4 and two posts, the window seat on the back wall)
      fixed: [{ x0: 2.55, x1: 2.79, z0: 1.25, z1: 6.5 }, { x0: 2.55, x1: 2.79, z0: -5.3, z1: -1.25 }, { x0: -4.0, x1: -1.2, z0: 5.9, z1: 6.5 }],
      seats: [{ x: -2.6, z: 6.05 }] }),
    // R8 4단계 큰 집 2층 (assets 58 2026-10-25, docs/my-home-20261020.md): the 큰 집's 1층 with the stairs up at its front left
    // (home.stairs_in at STAIRS, its foot by the front wall), and the 2층 (`upper`, a room of its own: home.upper_room, the
    // same 16 x 13, walls 3.0 m, the stair hole front left, a window seat at the back, the balcony door in the middle front)
    4: Object.freeze({ n: 4, w: 16, d: 13, hx: 7.85, hz: 6.35, pieces: 70, fish: 40, house: 'manor2', room: 'manor_room', tile: '_s3', name: '2층 큰 집',
      fixed: [{ x0: 2.55, x1: 2.79, z0: 1.25, z1: 6.5 }, { x0: 2.55, x1: 2.79, z0: -5.3, z1: -1.25 }, { x0: -4.0, x1: -1.2, z0: 5.9, z1: 6.5 }, { x0: -7.85, x1: -6.55, z0: -5.7, z1: -0.9 }], // (+ the stairs)
      seats: [{ x: -2.6, z: 6.05 }] }),
    upper: Object.freeze({ n: 4, upper: true, w: 16, d: 13, hx: 7.85, hz: 6.35, pieces: 50, fish: 40, house: 'manor2', room: 'upper_room', tile: '_s4', name: '2층',
      fixed: [{ x0: -8, x1: -6, z0: -6.5, z1: -1.5 }], seats: [{ x: 0, z: 6.08 }], entry: [-7, -0.95] }), // (the hole; one comes up behind it)
  });
  const TOP_STAGE = 4;
  // the stairs (room-local): home.stairs_in's middle (its seat stairs_up 2.7 m before it, at its foot), and where the 2층's
  // way down is (home.upper_room seat stairs_down, in the hole) -- one goes up or down standing within REACH of them
  const STAIRS = Object.freeze({ x: -7.3, z: -3.3, foot: { x: -7.3, z: -6.0 }, down: { x: -7, z: -2.1 }, reach: 1.8 });
  const stageOf = (n) => STAGES[n] || STAGES[2];
  const inRoom = (lot, x, z, pad = 0, stage = 2) => { const { lx, lz } = local(lot, x, z); const st = stageOf(stage); return Math.abs(lx) <= st.w / 2 + pad && Math.abs(lz) <= st.d / 2 + pad; };
  const entryOf = (stage = 2) => stageOf(stage).entry || [0, Math.round((-stageOf(stage).hz + 0.75) * 100) / 100]; // where one stands coming in (the doorway behind; the 2층: by the stairs)
  // a house as seen on one floor: the 2층 its own stage and the pieces on it (`floor: 2`), the 1층 the rest
  const onFloor = (p, floor) => (floor === 2 ? p.floor === 2 : p.floor !== 2);
  const floorView = (home, floor) => (floor === 2 && home ? { ...home, stage: 'upper', pieces: home.pieces.filter((p) => onFloor(p, 2)) } : home && { ...home, pieces: home.pieces.filter((p) => onFloor(p, 1)) });
  const doorwayOf = (stage = 2) => { const h = stageOf(stage).d / 2; return { x0: -0.8, x1: 0.8, z0: -h, z1: -h + 1.4 }; }; // kept clear (the way out)
  const ENTRY = Object.freeze(entryOf(2)); const DOORWAY = Object.freeze(doorwayOf(2));
  const MAX_PIECES = STAGES[TOP_STAGE].pieces + STAGES.upper.pieces; const MAX_FISH = STAGES[TOP_STAGE].fish; // (R8: both floors)
  // what each furniture shape takes (assets 57 manifest: width x, depth z, height), and which ones hang on a wall
  const SIZE = { aquarium_big: [2.4, 0.82, 1.82], aquarium_pillar: [1.9, 1.9, 2.65], aquarium_wall: [4.2, 1.46, 2.85], armchair: [0.9, 0.85, 0.88], bed: [1.16, 2.12, 0.95], bookshelf: [1.04, 0.37, 1.85], bunk_bed: [1.04, 1.9, 1.6], cheongsa_lantern: [0.52, 0.26, 1.32], coffee_table: [1.1, 0.6, 0.54], counter: [1.64, 0.66, 1.11], cupboard: [1.04, 0.49, 1.71], curtain_window: [1.41, 0.17, 1.29], desk: [1.2, 0.63, 0.85], dining_chair: [0.46, 0.46, 0.98], dining_table: [1.4, 0.85, 1.08], dresser: [1, 0.49, 0.85], fence_piece: [1.93, 0.13, 0.94], fish_bowl: [0.48, 0.48, 1.21], fish_tank: [0.92, 0.42, 1.01], floor_cushion: [0.59, 0.6, 0.11], floor_lamp: [0.52, 0.52, 1.71], folding_screen: [1.79, 0.18, 1.4], fridge: [0.7, 0.7, 1.75], garden_bench: [1.6, 0.53, 0.93], hanger_rack: [1.25, 0.45, 1.5], insect_case: [0.6, 0.34, 0.7], mini_lighthouse: [0.36, 0.36, 0.81], mirror_stand: [0.55, 0.3, 1.6], moon_lamp: [0.34, 0.32, 0.62], nightstand: [0.45, 0.44, 0.84], onggi: [0.6, 0.6, 0.79], parasol_table: [2.1, 2.1, 2.25], piano: [1.4, 0.74, 1.23], picture_frame: [0.7, 0.07, 0.55], plant_pot: [0.64, 0.61, 1.14], planter_box: [1.2, 0.45, 0.71], radio: [0.43, 0.2, 0.52], rug_round: [1.9, 1.9, 0.03], shell_lamp: [0.58, 0.28, 0.58], soban: [0.8, 0.8, 0.37], sofa: [1.9, 0.85, 0.84], stool: [0.36, 0.36, 0.52], tall_clock: [0.52, 0.35, 1.9], toy_box: [0.74, 0.49, 0.65], tv_stand: [1.3, 0.43, 1.16], wall_clock: [0.44, 0.07, 0.44], wall_shelf: [0.9, 0.24, 0.36], wardrobe: [1.26, 0.64, 2.06],
    // E1 계절 행사 (assets 72): the festival stall's goods and the contests' trophies
    trophy_fish: [0.44, 0.32, 0.55], trophy_bug: [0.44, 0.32, 0.55], harvest_basket: [0.7, 0.72, 0.73], straw_sheaf: [0.47, 0.49, 1.09], corn_string: [0.54, 0.14, 0.57], persimmon_string: [0.9, 0.08, 0.94], feast_table: [1.1, 1.1, 0.5] };
  const HUNG = new Set(['picture_frame', 'wall_clock', 'curtain_window', 'wall_shelf', 'corn_string', 'persimmon_string']); // (their backs on a wall, at the height made)
  const FLAT = new Set(['rug_round']); // (under the rest)
  // where one sits (assets 57 manifest seats, model local: x, height, z) -- 'lie' and 'floor' sit too for now
  const SEATS = { window_seat: [[0, 0.5, 0]], armchair: [[0, 0.46, -0.12]], dining_chair: [[0, 0.53, -0.02]], floor_cushion: [[0, 0.1, 0]], garden_bench: [[-0.4, 0.47, 0], [0.4, 0.47, 0]], sofa: [[-0.56, 0.46, -0.12], [0.56, 0.46, -0.12]] /* (6회차 4 「같이 앉으면 머리가 뚫려」: 0.9 m apart the two big heads met -- 1.12, still on its cushions) */, stool: [[0, 0.51, 0]], bed: [[0, 0.55, 0]], bunk_bed: [[0, 0.5, 0]] }; // (3회차 3: the beds' heights as their models' mattresses)
  // the tanks (assets 57 manifest swim): where fish swim (model local), how many, the biggest size they take, how small fish show
  const TANKS = {
    fish_bowl: { min: [-0.1, 0.88, -0.1], max: [0.1, 1.08, 0.1], slots: 1, biggest: 'small', fishScale: 0.5 },
    fish_tank: { min: [-0.36, 0.66, -0.12], max: [0.36, 0.9, 0.12], slots: 3, biggest: 'small', fishScale: 0.6 },
    aquarium_big: { min: [-1.05, 0.85, -0.28], max: [1.05, 1.6, 0.28], slots: 8, biggest: 'medium', fishScale: 0.85 },
    aquarium_pillar: { min: [-0.6, 0.6, -0.6], max: [0.6, 2.25, 0.6], slots: 8, biggest: 'medium', fishScale: 0.85, cylinder: true },
    aquarium_wall: { min: [-1.75, 0.45, -0.4], max: [1.75, 2.2, 0.4], slots: 12, biggest: 'large', fishScale: 1 },
    insect_case: { min: [-0.12, 0.3, -0.05], max: [0.12, 0.5, 0.05], slots: 1, insects: true }, // (곤충 상자: one insect, sitting)
  };
  // the twelve insects (lib/island-insects.js, bag items insect_<id>)
  const INSECTS = new Set(['butterfly_cabbage', 'butterfly_swallowtail', 'butterfly_blue', 'dragonfly_red', 'dragonfly_emperor', 'cicada', 'rhinoceros_beetle', 'stag_beetle', 'ladybird', 'firefly', 'grasshopper', 'snail'].map((s) => `insect_${s}`));
  const FISH_SIZE = { fish_anchovy: 'small', fish_crucian_carp: 'small', fish_gizzard_shad: 'small', fish_goby: 'small', fish_mackerel: 'small', fish_pale_chub: 'small', fish_smelt: 'small', fish_sweetfish: 'small', fish_pufferfish: 'small',
    fish_carp: 'medium', fish_catfish: 'medium', fish_cutlassfish: 'medium', fish_eel: 'medium', fish_flatfish: 'medium', fish_mandarin_fish: 'medium', fish_mullet: 'medium', fish_octopus: 'medium', fish_rockfish: 'medium', fish_sea_bass: 'medium', fish_stingray: 'medium', fish_giant_tuna: 'large' };
  const BOTTOM = new Set(['fish_octopus', 'fish_stingray', 'fish_flatfish']); // (they keep to the sand)
  const SIZE_RANK = { small: 1, medium: 2, large: 3 };
  const fits = (tankShape, id) => { const t = TANKS[tankShape]; return Boolean(t && (t.insects ? INSECTS.has(id) : FISH_SIZE[id] && SIZE_RANK[FISH_SIZE[id]] <= SIZE_RANK[t.biggest])); };
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
  // (문제 기록 3회차 6 「벽면에 딱 안 붙어」: a piece stands on the 0.25 m steps or with an edge right against a wall -- the
  // walls are not on the steps, so a step short of one left a gap of up to 0.24 m)
  const onStep = (v) => Math.abs(v * 4 - Math.round(v * 4)) < 1e-6;
  const flushOn = (v, half, H) => Math.abs(Math.abs(v) + half - H) < 1e-6;
  function placeError(p, others = [], stage = 2, { free = false } = {}) { // free: a held piece on its way (any place, not only the steps)
    const shape = shapeOf(p.id); if (!SIZE[shape]) return '놓을 수 없는 가구예요.';
    if (![0, 1, 2, 3].includes(p.rot) || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return '자리를 확인해 주세요.';
    const b = boxOf(p); const st = stageOf(stage); const HX = st.hx; const HZ = st.hz;
    if (!free && !((onStep(p.x) || flushOn(p.x, (b.x1 - b.x0) / 2, HX)) && (onStep(p.z) || flushOn(p.z, (b.z1 - b.z0) / 2, HZ)))) return '자리를 확인해 주세요.';
    if (b.x0 < -HX - 1e-6 || b.x1 > HX + 1e-6 || b.z0 < -HZ - 1e-6 || b.z1 > HZ + 1e-6) return '방 밖으로 나가요.';
    if (st.fixed.some((w) => overlap(b, w))) return '방의 벽이나 창가 의자와 겹쳐요.';
    if (HUNG.has(shape)) { // its back against the back or a side wall (the low front wall holds nothing)
      const [bx, bz] = backDir(p.rot); const ok = (bz === 1 && b.z1 > HZ - 0.2) || (bx === 1 && b.x1 > HX - 0.2) || (bx === -1 && b.x0 < -HX + 0.2); // (on the 0.25 m steps: drawn flat against the wall)
      if (!ok) return '벽에 거는 가구예요. 뒤가 벽에 닿게 놓아 주세요.';
      return others.some((o) => HUNG.has(shapeOf(o.id)) && overlap(b, boxOf(o))) ? '다른 장식과 겹쳐요.' : null;
    }
    if (overlap(b, doorwayOf(stage))) return '문 앞은 비워 두세요.';
    if (FLAT.has(shape)) return null; // (a rug goes under the rest)
    return others.some((o) => !HUNG.has(shapeOf(o.id)) && !FLAT.has(shapeOf(o.id)) && overlap(b, boxOf(o))) ? '다른 가구와 겹쳐요.' : null;
  }
  // the place nearest p that placeError takes: its step, or against a wall when that is within a step (3회차 6)
  function snapPos(p, stage = 2) {
    const s = SIZE[shapeOf(p.id)]; if (!s) return { x: p.x, z: p.z }; const st = stageOf(stage);
    const [w, d] = p.rot % 2 ? [s[1], s[0]] : [s[0], s[1]];
    const one = (v, half, H) => { const hi = H - half; const q = Math.min(hi, Math.max(-hi, Math.round(v * 4) / 4)); return [q, hi, -hi].filter((c) => c === q || Math.abs(c - v) < 0.25).sort((a, b) => Math.abs(a - v) - Math.abs(b - v))[0]; };
    return { x: one(p.x, w / 2, st.hx), z: one(p.z, d / 2, st.hz) };
  }
  // where one may stand inside: in the walls, out of the floor pieces (0.3 m round them)
  function clamp(lot, x, z, pieces = [], stage = 2) {
    const fin = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d); const st = stageOf(stage); const HX = st.hx; const HZ = st.hz;
    const en = entryOf(stage); const e = world(lot, en[0], en[1]);
    let { lx, lz } = local(lot, fin(x, e.x), fin(z, e.z));
    const W = 0.55; // (문제 기록 2회차 12: off the walls by the big head's radius -- 0.35 let it into them)
    lx = Math.max(-HX + W, Math.min(HX - W, lx)); lz = Math.max(-HZ + W, Math.min(HZ - W, lz));
    const solid = [...pieces.filter((p) => !HUNG.has(shapeOf(p.id)) && !FLAT.has(shapeOf(p.id))).map(boxOf).filter(Boolean), ...st.fixed];
    const hit = (x, z) => solid.find((b) => x > b.x0 - 0.3 && x < b.x1 + 0.3 && z > b.z0 - 0.3 && z < b.z1 + 0.3);
    for (let pass = 0, b = hit(lx, lz); b && pass < 4; pass += 1, b = hit(lx, lz)) {
      const ways = [[b.x0 - 0.3, lz], [b.x1 + 0.3, lz], [lx, b.z0 - 0.3], [lx, b.z1 + 0.3]].sort((p, q) => Math.hypot(p[0] - lx, p[1] - lz) - Math.hypot(q[0] - lx, q[1] - lz));
      [lx, lz] = ways.find(([x, z]) => !hit(x, z) && Math.abs(x) <= HX - W && Math.abs(z) <= HZ - W) || ways[0];
    }
    return world(lot, lx, lz);
  }
  // the house made bigger: each piece where it stood (the same middle), the hung ones moved out onto the new walls; one
  // that no longer fits (none should) goes back to the 가구 창고 -> { pieces, back: [uid] }
  function grownPieces(pieces, stage) {
    const { hx: HX, hz: HZ } = stageOf(stage); const out = []; const back = [];
    for (const p of pieces) {
      const shape = shapeOf(p.id); const s = SIZE[shape]; let q = { ...p };
      if (HUNG.has(shape) && s) { const [bx, bz] = backDir(p.rot); const d = s[1]; const snap = (v) => Math.round(v * 4) / 4; q = bz === 1 ? { ...q, z: snap(HZ - d / 2) } : bx === 1 ? { ...q, x: snap(HX - d / 2) } : bx === -1 ? { ...q, x: snap(-HX + d / 2) } : q; }
      if (placeError(q, out, stage) && !TANKS[shape]) back.push(p.uid); else out.push(q); // (a tank stays, with its fish, even in the 큰 집's half wall -- moved by its owner)
    }
    return { pieces: out, back };
  }
  // every seat in a house: its pieces' and the room's own (the 큰 집's window seat: id home:room<k>:0)
  const allSeatsOf = (lot, home) => [...(home?.pieces || []).flatMap((p) => seatsOf(lot, p)), ...stageOf(home?.stage).seats.flatMap((q, k) => seatsOf(lot, { uid: `room${k}`, id: 'window_seat', x: q.x, z: q.z, rot: 0 }))];
  // a piece's seats in the world (room-local turned by rot, then into the world)
  // (y: the scene lifts a seat 0.28 and SitIdle's seat of the body is 0.26 above the root -- so the root 0.54 under the
  // seat's top, as on a plaza bench; 3회차 3 「소파 위에 떠 있어」: it was 0.45, 9 cm up)
  const SIT_BELOW = 0.54;
  // v1.10.189: backless seats -- sat on facing the way I faced (45° steps), turned there with ←/→ or ↺↻
  const ANY_DIR = new Set(['stool', 'floor_cushion']);
  function seatsOf(lot, p) {
    const list = SEATS[shapeOf(p.id)] || []; const a = (p.rot * Math.PI) / 2;
    const anyDir = ANY_DIR.has(shapeOf(p.id));
    return list.map(([sx, sy, sz], k) => { const lx = p.x + sx * Math.cos(a) + sz * Math.sin(a); const lz = p.z - sx * Math.sin(a) + sz * Math.cos(a); const w = world(lot, lx, lz); return { id: `home:${p.uid}:${k}`, x: w.x, z: w.z, y: ROOM.y + sy - SIT_BELOW, yaw: a, anyDir }; /* (yaw: the piece's front, the room turned half round) */ });
  }
  return { LOTS, lotById, upperLot, STAIRS, onFloor, floorView, doorOf, ROOFS, FLOORS, WALLS, VISITS, ROOM, STAGES, TOP_STAGE, allSeatsOf, stageOf, entryOf, doorwayOf, grownPieces, roomOf, world, local, inRoom, ENTRY, DOORWAY, MAX_PIECES, MAX_FISH, SIZE, HUNG, FLAT, SEATS, TANKS, FISH_SIZE, INSECTS, BOTTOM, fits, shapeOf, boxOf, placeError, snapPos, clamp, seatsOf };
}));
