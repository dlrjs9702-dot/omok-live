// 묶음 2 가구점 (gamecenter-notes docs/furniture-shop-20261019.md, 사용자 확정 2026-10-19): the 백화점's second floor --
// furniture standing on the floor (assets 57: 48 shapes, each in 2-4 colours = 145 goods), a different display every day
// (Seoul 00:00, the same for everyone), one sold is gone for everyone until the next day's display; a few plain goods
// always on sale. The room is its own far off the island like the 1st floor (turned half round the same way: its front
// toward the camera); the lift on each floor goes between them. Browser and server.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandFurniture = api;
}(typeof self !== 'undefined' ? self : this, () => {
  // shape -> [name, zone, rarity, kind] (kind: floor, wall -- hung on the back wall --, wide -- along the back wall)
  const SHAPES = {
    sofa: ['소파', 'living', 'uncommon'], armchair: ['1인 의자', 'living', 'common'], coffee_table: ['낮은 탁자', 'living', 'common'], bookshelf: ['책장', 'living', 'uncommon'],
    floor_lamp: ['스탠드', 'living', 'common'], rug_round: ['둥근 러그', 'living', 'common'], plant_pot: ['화분', 'living', 'common'], tv_stand: ['TV장', 'living', 'common'],
    radio: ['라디오', 'living', 'common'], piano: ['피아노', 'living', 'rare'], tall_clock: ['괘종시계', 'living', 'rare'], aquarium_big: ['큰 수조', 'living', 'rare'],
    aquarium_pillar: ['원기둥 수조', 'living', 'rare'], fish_tank: ['어항', 'living', 'uncommon'], fish_bowl: ['둥근 어항', 'living', 'common'],
    bed: ['침대', 'bedroom', 'uncommon'], bunk_bed: ['2층 침대', 'bedroom', 'rare'], nightstand: ['협탁', 'bedroom', 'common'], wardrobe: ['옷장', 'bedroom', 'uncommon'],
    dresser: ['서랍장', 'bedroom', 'common'], mirror_stand: ['전신 거울', 'bedroom', 'uncommon'], hanger_rack: ['옷걸이', 'bedroom', 'common'], toy_box: ['장난감 상자', 'bedroom', 'common'],
    desk: ['책상', 'bedroom', 'uncommon'], folding_screen: ['병풍', 'bedroom', 'uncommon'], floor_cushion: ['방석', 'bedroom', 'common'], moon_lamp: ['초승달 조명', 'bedroom', 'uncommon'],
    dining_table: ['식탁', 'kitchen', 'uncommon'], dining_chair: ['식탁 의자', 'kitchen', 'common'], cupboard: ['찬장', 'kitchen', 'uncommon'], fridge: ['냉장고', 'kitchen', 'uncommon'],
    counter: ['조리대', 'kitchen', 'uncommon'], stool: ['스툴', 'kitchen', 'common'], soban: ['소반', 'kitchen', 'common'], onggi: ['항아리', 'kitchen', 'common'],
    garden_bench: ['정원 벤치', 'garden', 'uncommon'], planter_box: ['꽃 화분대', 'garden', 'common'], parasol_table: ['파라솔 탁자', 'garden', 'rare'], fence_piece: ['울타리', 'garden', 'common'],
    mini_lighthouse: ['초승등대 모형', 'garden', 'rare'], cheongsa_lantern: ['청사초롱', 'garden', 'uncommon'], shell_lamp: ['조개 조명', 'garden', 'uncommon'], insect_case: ['곤충 상자', 'garden', 'uncommon'],
    picture_frame: ['액자', 'wall', 'common', 'wall'], wall_clock: ['벽시계', 'wall', 'common', 'wall'], curtain_window: ['커튼 창', 'wall', 'common', 'wall'], wall_shelf: ['벽 선반', 'wall', 'common', 'wall'],
    aquarium_wall: ['벽면 수조', 'wall', 'rare', 'wide'],
  };
  const VARIANTS = { // the pack's colour boards (assets 57 manifest), first = the one the 3D sheet shows
    aquarium_big: 'oak white walnut navy', aquarium_pillar: 'white oak navy', aquarium_wall: 'stone oak white', armchair: 'mint coral lavender', bed: 'sky pink sage butter',
    bookshelf: 'oak white mint', bunk_bed: 'oak white', cheongsa_lantern: 'blue_red', coffee_table: 'oak white walnut', counter: 'white oak navy', cupboard: 'oak white walnut mint',
    curtain_window: 'pink sage sky butter', desk: 'oak white walnut', dining_chair: 'oak white walnut', dining_table: 'oak white walnut', dresser: 'oak white walnut pink',
    fence_piece: 'white oak mint', fish_bowl: 'white walnut', fish_tank: 'oak white walnut', floor_cushion: 'red navy mint lavender', floor_lamp: 'cream mint pink',
    folding_screen: 'walnut red oak', fridge: 'white mint butter red', garden_bench: 'oak white mint', hanger_rack: 'oak charcoal', insect_case: 'oak walnut', mini_lighthouse: 'classic navy',
    mirror_stand: 'oak white gold', moon_lamp: 'gold navy white', nightstand: 'oak white walnut', onggi: 'brown charcoal white', parasol_table: 'red mint navy', piano: 'black white walnut',
    picture_frame: 'oak gold white', plant_pot: 'terracotta white navy', planter_box: 'oak white walnut', radio: 'red mint oak', rug_round: 'sage pink navy butter', shell_lamp: 'pink cream sky',
    soban: 'walnut red oak', sofa: 'mint coral navy sage', stool: 'oak walnut white', tall_clock: 'walnut white', toy_box: 'sky pink oak', tv_stand: 'oak white walnut', wall_clock: 'oak mint red',
    wall_shelf: 'oak white', wardrobe: 'oak white walnut mint',
  };
  const COLOR = { oak: '참나무', white: '하양', walnut: '호두나무', navy: '남색', stone: '돌', mint: '민트', coral: '산호', lavender: '연보라', sky: '하늘', pink: '분홍', sage: '세이지',
    butter: '버터', blue_red: '청홍', red: '빨강', cream: '크림', charcoal: '숯', classic: '흰 등대', gold: '금빛', brown: '갈색', black: '검정', terracotta: '테라코타' };
  const RARITY = { common: '흔함', uncommon: '보통', rare: '드묾' };
  const WEIGHT = { common: 6, uncommon: 3, rare: 1 };
  const GOODS = Object.freeze(Object.entries(VARIANTS).flatMap(([shape, list]) => list.split(' ').map((variant) => {
    const [name, zone, rarity, kind = 'floor'] = SHAPES[shape];
    return Object.freeze({ id: `${shape}__${variant}`, shape, variant, name: `${name} (${COLOR[variant]})`, zone, rarity, kind, model: `furn.${shape}__${variant}` });
  })));
  const byId = new Map(GOODS.map((g) => [g.id, g]));
  // always on sale, no end to them (and not counted in a day's three)
  const BASE = Object.freeze(['stool__oak', 'floor_cushion__red', 'plant_pot__terracotta', 'dining_chair__oak']);

  // the room: room-local metres (its front, low wall toward the camera, at local -Z), turned half round in the world
  const ROOM = Object.freeze({ x: 140, z: -330, y: 0.4, w: 30, d: 20 });
  const world = (lx, lz) => ({ x: Math.round((ROOM.x - lx) * 100) / 100, z: Math.round((ROOM.z - lz) * 100) / 100 });
  const local = (x, z) => ({ lx: ROOM.x - x, lz: ROOM.z - z });
  const inRoom = (x, z, pad = 0) => Math.abs(x - ROOM.x) <= ROOM.w / 2 + pad && Math.abs(z - ROOM.z) <= ROOM.d / 2 + pad;
  // the lift on the left wall of each floor (assets 57 mall.elevator, its back on the wall, its front into the room)
  const LIFT = Object.freeze({ lx: -14.05, lz: 0, yaw: -Math.PI / 2, stand: Object.freeze([-11.5, 0]) }); // (2층; 1층's in island-store.js)
  const ZONES = Object.freeze({ living: [-6.5, -4.4], bedroom: [-6.5, 4.6], kitchen: [3.5, -4.4], garden: [3.5, 4.6] });
  // the display: 3 plinths a zone, 3 places on the back wall for what hangs, 1 wide one for a wall tank (or a big piece)
  const SLOTS = Object.freeze([
    ...Object.entries(ZONES).flatMap(([zone, [x, z]]) => [[-2.2, -1.2], [2.2, -1.2], [0, 1.9]].map(([dx, dz], i) => ({ id: `${zone}${i}`, zone, kind: 'floor', lx: x + dx, lz: z + dz, yaw: 0 }))),
    ...[-6.5, -2.5, 1.5].map((x, i) => ({ id: `wall${i}`, zone: 'wall', kind: 'wall', lx: x, lz: 9.82, yaw: 0, plinth: false })),
    { id: 'wide0', zone: 'wall', kind: 'wide', lx: 8.6, lz: 9.82 - 0.76, yaw: 0, plinth: false },
  ].map((s) => Object.freeze(s)));
  const BASE_SLOTS = Object.freeze(BASE.map((id, i) => Object.freeze({ id: `base${i}`, good: id, lx: 9.6 + i * 1.3, lz: -6.2, yaw: 0 })));
  const CHECKOUT = Object.freeze({ lx: 12.2, lz: -1.5, yaw: 0, keeper: Object.freeze([12.2, -0.6, 0]) });
  const FIXTURES = Object.freeze([ // what is walked round (x, z centre, w, d): the plinths, the counter, the lift
    ...SLOTS.filter((s) => s.plinth !== false).map((s) => ({ x: s.lx, z: s.lz, w: 2.4, d: 2.4 })),
    { x: 8.6, z: 9.1, w: 4.3, d: 1.6 }, { x: CHECKOUT.lx, z: CHECKOUT.lz, w: 1.9, d: 0.7 }, { x: LIFT.lx + 0.955, z: LIFT.lz, w: 1.91, d: 2.1 } /* (the lift's body into the room, 2회차 8) */,
    ...BASE_SLOTS.map((s) => ({ x: s.lx, z: s.lz, w: 1.2, d: 1.2 })),
  ].map((f) => Object.freeze(f)));
  const REACH = 2.1; // a piece within this of me (to its plinth's middle) is the one SPACE buys

  // a day's display: each place its good -- the rarer ones less often, no shape twice -- the same everywhere for a day
  const seeded = (text) => { let s = 2166136261; for (const ch of text) s = Math.imul(s ^ ch.charCodeAt(0), 16777619) >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  function displayOf(day) {
    const rnd = seeded(`furniture:${day}`); const used = new Set(); const out = {};
    for (const slot of SLOTS) {
      const fits = GOODS.filter((g) => !used.has(g.shape) && !BASE.includes(g.id) && (slot.kind === 'floor' ? g.kind === 'floor' && g.zone === slot.zone : slot.kind === 'wall' ? g.kind === 'wall' : g.kind === 'wide' || (g.kind === 'floor' && g.zone === 'living')));
      const pool = fits;
      const weight = (g) => WEIGHT[g.rarity] * (slot.kind === 'wide' && g.kind === 'wide' ? 5 : 1); // (the wall tank: about one day in eight)
      const total = pool.reduce((n, g) => n + weight(g), 0); let r = rnd() * total; let pick = pool[pool.length - 1];
      for (const g of pool) { r -= weight(g); if (r <= 0) { pick = g; break; } }
      // (the wide place: a wall tank on its rare days, else one more living piece)
      out[slot.id] = pick.id; used.add(pick.shape);
    }
    return out;
  }
  // where one may stand: inside the walls (0.45 m off them), out of what stands (0.35 m round it)
  function clamp(x, z) {
    const fin = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
    const e = world(LIFT.stand[0], LIFT.stand[1]);
    let { lx, lz } = local(fin(x, e.x), fin(z, e.z));
    lx = Math.max(-ROOM.w / 2 + 0.45, Math.min(ROOM.w / 2 - 0.45, lx)); lz = Math.max(-ROOM.d / 2 + 0.45, Math.min(ROOM.d / 2 - 0.45, lz));
    const hit = (x, z) => FIXTURES.find((f) => Math.abs(x - f.x) < f.w / 2 + 0.35 - 1e-6 && Math.abs(z - f.z) < f.d / 2 + 0.35 - 1e-6);
    for (let pass = 0, f = hit(lx, lz); f && pass < 4; pass += 1, f = hit(lx, lz)) {
      const hx = f.w / 2 + 0.35; const hz = f.d / 2 + 0.35;
      const ways = [[f.x - hx, lz], [f.x + hx, lz], [lx, f.z - hz], [lx, f.z + hz]].sort((p, q) => Math.hypot(p[0] - lx, p[1] - lz) - Math.hypot(q[0] - lx, q[1] - lz));
      [lx, lz] = ways.find(([x, z]) => !hit(x, z) && Math.abs(x) <= ROOM.w / 2 - 0.45 && Math.abs(z) <= ROOM.d / 2 - 0.45) || ways[0];
    }
    return world(lx, lz);
  }
  // the display place (or always-on-sale place) nearest me within reach
  function placeAt(x, z) {
    const { lx, lz } = local(x, z); let best = null; let bd = REACH;
    for (const s of [...SLOTS, ...BASE_SLOTS]) { const d = Math.hypot(s.lx - lx, s.lz - lz) - (s.kind === 'wall' || s.kind === 'wide' ? 0.6 : 0); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  return { SHAPES, COLOR, RARITY, GOODS, BASE, ROOM, LIFT, ZONES, SLOTS, BASE_SLOTS, CHECKOUT, FIXTURES, REACH, world, local, inRoom, clamp, placeAt, displayOf, good: (id) => byId.get(id) || null };
}));
