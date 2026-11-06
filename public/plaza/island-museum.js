// v1.10.231 M 박물관 전시관 (gamecenter-notes docs/museum-hall-design-20261025.md, assets 74) -> v1.10.254 박물관 나누기
// (docs/museum-wings-20261104.md, 사용자 「물고기 전시장과 곤충 채집 전시장을 나누고 방 입구 따로 둬서 한번 더 입장하는 걸로」):
// three rooms far off the island (like the 구치소's), each turned half round in the world like the others (the door at
// local -Z). The entrance hall -- assets 74's room, its wings shut off -- the curator at his desk, the benches, the board, and
// a doorway each side: west into the aquarium (the sea fish in the big tank, a tank for the big fish, the river's, the lake's
// and the pools' each on their own wall), east into the insect hall (a case each, the dome the butterflies fly in). A doorway
// back to the hall in each. Each slot's plaque says what is on show, its size and who gave it. Browser and server.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandMuseum = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const room = (x, z, w, d, entry, exit) => Object.freeze({ x, z, y: 0.4, w, d, entry: Object.freeze(entry), exit: Object.freeze(exit) });
  const ROOM = room(100, -430, 24, 16, { lx: 0, lz: -7.1 }, { lx: 0, lz: -7.5 }); // the hall (its model 24 m; walked in |lx| < 4.5)
  const AQUA = room(40, -430, 28, 18, { lx: 0, lz: -7.2 }, { lx: 0, lz: -8.4 }); // the aquarium (west of the hall's door)
  const BUGS = room(160, -430, 18, 14, { lx: 0, lz: -5.2 }, { lx: 0, lz: -6.4 }); // the insect hall (east)
  const ROOMS = Object.freeze({ hall: ROOM, aquarium: AQUA, insects: BUGS });
  const HALL_HALF = 4.5; // (the hall's side walls -- the old arches -- at |lx| 4.5)
  const r2 = (v) => Math.round(v * 100) / 100;
  const worldIn = (id, lx, lz) => ({ x: r2(ROOMS[id].x - lx), z: r2(ROOMS[id].z - lz) });
  const localIn = (id, x, z) => ({ lx: ROOMS[id].x - x, lz: ROOMS[id].z - z });
  const world = (lx, lz) => worldIn('hall', lx, lz);
  const local = (x, z) => localIn('hall', x, z);
  const roomOf = (x, z, pad = 0) => { for (const [id, R] of Object.entries(ROOMS)) if (Math.abs(x - R.x) <= R.w / 2 + pad && Math.abs(z - R.z) <= R.d / 2 + pad) return id; return null; };
  const inMuseum = (x, z, pad = 0) => roomOf(x, z, pad) !== null;
  // the 34 fish: the sea's in the big tank, the fresh water's each on its water's wall -- the river's, 거울호수's, the pools'
  // (where it is caught first: lib/island-fishing's TABLE, the unit test holds them together); the 12 insects a case each
  const SEA = Object.freeze(['anchovy', 'mackerel', 'goby', 'cutlassfish', 'pufferfish', 'octopus', 'stingray', 'giant_tuna', 'mullet', 'flatfish', 'sea_bass', 'gizzard_shad', 'rockfish',
    'yellowtail', 'red_seabream', 'horse_mackerel', 'filefish', 'cod', 'squid', 'blue_crab', 'seahorse']);
  const FRESH = Object.freeze(['crucian_carp', 'carp', 'pale_chub', 'sweetfish', 'catfish', 'mandarin_fish', 'eel', 'smelt', 'crayfish', 'medaka', 'bagrid_catfish', 'masu_salmon', 'sturgeon']);
  const WATER_OF = Object.freeze({ masu_salmon: 'pool', sturgeon: 'lake' }); // (the rest the river's)
  const WATERS = Object.freeze([['river', '강'], ['lake', '거울호수'], ['pool', '폭포 웅덩이']].map(([id, name]) => Object.freeze({ id, name })));
  const INSECTS = Object.freeze(['butterfly_cabbage', 'butterfly_blue', 'butterfly_swallowtail', 'dragonfly_red', 'dragonfly_emperor', 'cicada', 'rhinoceros_beetle', 'stag_beetle', 'ladybird', 'firefly', 'grasshopper', 'snail']);
  const FLYERS = Object.freeze(['butterfly_cabbage', 'butterfly_blue', 'butterfly_swallowtail', 'dragonfly_red', 'dragonfly_emperor']); // (in the dome too)
  // the aquarium (28 x 18): the big tank in the middle (assets 74 museum.tank_big: 6.2 x 2.6, its long side across), where
  // its fish swim (tank-local) and its plaques, a row along each long side of its base; the big fish's tank behind it (the
  // same model 1.3 times as tall: 대어 -- the next fish bundle's); the wall tanks (museum.tank_wall, 2 m, its back to the wall)
  const TANK = Object.freeze({ lx: 0, lz: -0.5, yaw: 0, swim: Object.freeze({ x: 2.7, z: 0.95, y0: 0.8, y1: 2.05 }) });
  const BIG = Object.freeze({ lx: 0, lz: 5.4, yaw: 0, tall: 1.3, swim: Object.freeze({ x: 2.6, z: 0.9, y0: 0.9, y1: 2.6 }) });
  const tankPlaque = (k) => ({ side: k < 11 ? -1 : 1, x: -2.75 + (k < 11 ? k : k - 11) * 0.55 }); // (11 on the front, 10 on the back)
  const wallAt = (side, at) => side === 'west' ? { lx: -(AQUA.w / 2 - 0.45), lz: at, yaw: -Math.PI / 2 } : side === 'east' ? { lx: AQUA.w / 2 - 0.45, lz: at, yaw: Math.PI / 2 } : side === 'back' ? { lx: at, lz: AQUA.d / 2 - 0.45, yaw: 0 } : { lx: at, lz: -(AQUA.d / 2 - 0.45), yaw: Math.PI };
  // each water's wall: the river's the west wall and the front's west end, 거울호수's the back wall either side of the big
  // tank, the pools' the east wall and the front's east end -- 32 places for 25 fish, the first ones of each water used
  const WATER_WALLS = Object.freeze({
    river: Object.freeze([...[-6, -4, -2, 0, 2, 4, 6].map((z) => wallAt('west', z)), ...[-12, -10, -8, -6, -4].map((x) => wallAt('front', x))].map((s) => Object.freeze(s))),
    lake: Object.freeze([-12, -10, -8, -6, 6, 8, 10, 12].map((x) => Object.freeze(wallAt('back', x)))),
    pool: Object.freeze([...[-6, -4, -2, 0, 2, 4, 6].map((z) => wallAt('east', z)), ...[4, 6, 8, 10, 12].map((x) => wallAt('front', x))].map((s) => Object.freeze(s))),
  });
  const SPARE_WALL = 2; // (each water: two more tanks, glass and water only -- for the next fish)
  const freshIn = (water) => FRESH.filter((sp) => (WATER_OF[sp] || 'river') === water);
  const WALLS = Object.freeze(FRESH.map((sp) => WATER_WALLS[WATER_OF[sp] || 'river'][freshIn(WATER_OF[sp] || 'river').indexOf(sp)]));
  const SPARE_WALLS = Object.freeze(WATERS.flatMap((w) => WATER_WALLS[w.id].slice(freshIn(w.id).length, freshIn(w.id).length + SPARE_WALL)));
  const WALL_SIGNS = Object.freeze({ river: Object.freeze({ lx: -(AQUA.w / 2 - 0.3), lz: 0, yaw: -Math.PI / 2 }), lake: Object.freeze({ lx: -9, lz: AQUA.d / 2 - 0.3, yaw: 0 }), pool: Object.freeze({ lx: AQUA.w / 2 - 0.3, lz: 0, yaw: Math.PI / 2 }) });
  // the insect hall (18 x 14): a row of cases by the back wall, a row by the front either side of the door (museum.insect_case),
  // their plaques toward the middle; the insects in the back row's first twelve, the rest glass for the next ones
  const CASE_SPOTS = Object.freeze([...[-7.8, -6.6, -5.4, -4.2, -3.0, -1.8, -0.6, 0.6, 1.8, 3.0, 4.2, 5.4, 6.6, 7.8].map((lx) => [lx, BUGS.d / 2 - 0.9, 0]),
    ...[-7.8, -6.6, -5.4, -4.2, -3.0, 3.0, 4.2, 5.4, 6.6, 7.8].map((lx) => [lx, -(BUGS.d / 2 - 0.9), Math.PI])].map(([lx, lz, yaw]) => Object.freeze({ lx, lz, yaw })));
  const CASES = Object.freeze(CASE_SPOTS.slice(0, INSECTS.length));
  const SPARE_CASES = Object.freeze(CASE_SPOTS.slice(INSECTS.length));
  const DOME = Object.freeze({ lx: 0, lz: 0.4, yaw: 0, r: 1.3, y0: 0.6, y1: 1.5 }); // (its plaque toward the door)
  const SLOTS = Object.freeze(Object.fromEntries([...SEA.map((id, k) => [`fish_${id}`, { kind: 'tank', k }]), ...FRESH.map((id, k) => [`fish_${id}`, { kind: 'wall', k, water: WATER_OF[id] || 'river', ...WALLS[k] }]),
    ...INSECTS.map((id, k) => [`insect_${id}`, { kind: 'case', k, ...CASES[k] }])].map(([id, s]) => [id, Object.freeze(s)])));
  // the entrance hall: the curator behind his desk (facing the door), where one talks to him, the benches, the board, the plants
  const DESK = Object.freeze({ lx: 0, lz: 1.6 });
  const CURATOR = Object.freeze({ lx: 0, lz: 2.8, yaw: Math.PI });
  const TALK = Object.freeze({ lx: 0, lz: 0.5 });
  const TALK_R = 2.2; // (the server's: a gift from here)
  const BENCHES = Object.freeze([[-1.7, -3.2], [1.7, -3.2], [3.1, -5.4]].map(([lx, lz]) => Object.freeze({ lx, lz, yaw: 0 }))); // (14 m² more of hall: a third bench)
  const BOARD = Object.freeze({ lx: -3.1, lz: -5.2 });
  const PLANTS = Object.freeze([[-3.6, 6.4], [3.6, 6.4], [-3.6, -1.6], [3.6, -1.6]].map(([lx, lz]) => Object.freeze({ lx, lz })));
  // the ways between the rooms: the hall's doorway each side (its wall at |lx| 4.5) and each wing's at its front, where one
  // comes out on the other side -- clear of the doorway there (as one comes in from the island)
  const PASSAGES = Object.freeze({
    aquarium: Object.freeze({ from: 'hall', door: Object.freeze({ lx: -HALL_HALF, lz: 0 }), arrive: AQUA.entry, sign: '수족관' }),
    insects: Object.freeze({ from: 'hall', door: Object.freeze({ lx: HALL_HALF, lz: 0 }), arrive: BUGS.entry, sign: '곤충관' }),
    'hall:aquarium': Object.freeze({ from: 'aquarium', to: 'hall', door: Object.freeze({ lx: 0, lz: -AQUA.d / 2 }), arrive: Object.freeze({ lx: -HALL_HALF + 1.8, lz: 0 }), sign: '입구 홀' }),
    'hall:insects': Object.freeze({ from: 'insects', to: 'hall', door: Object.freeze({ lx: 0, lz: -BUGS.d / 2 }), arrive: Object.freeze({ lx: HALL_HALF - 1.8, lz: 0 }), sign: '입구 홀' }),
  });
  const PASS_R = 2.4; // (the server's: from this near its doorway)
  // a way from where I stand (world): where I come out, or null (not by its doorway)
  function passage(id, x, z) {
    const p = PASSAGES[id]; if (!p || roomOf(x, z, 0.5) !== p.from) return null;
    const d = worldIn(p.from, p.door.lx, p.door.lz); if (Math.hypot(x - d.x, z - d.z) > PASS_R) return null;
    return { room: p.to || id, ...worldIn(p.to || id, p.arrive.lx, p.arrive.lz) };
  }
  const FIXTURES = Object.freeze({ // what one walks round, per room: x, z centre, w, d (room-local)
    hall: Object.freeze([
      ...[-2.6, 2.6].flatMap((x) => [-4.2, 4.2].map((z) => ({ x, z, w: 0.76, d: 0.76 }))) /* the columns */,
      { x: DESK.lx, z: DESK.lz + 0.6, w: 3.8, d: 2.4 } /* the desk and the curator */, ...BENCHES.map((b) => ({ x: b.lx, z: b.lz, w: 1.8, d: 0.5 })), { x: BOARD.lx, z: BOARD.lz, w: 1.3, d: 0.3 },
      ...PLANTS.map((p) => ({ x: p.lx, z: p.lz, w: 0.6, d: 0.6 })),
    ].map((f) => Object.freeze(f))),
    aquarium: Object.freeze([
      { x: TANK.lx, z: TANK.lz, w: 6.2, d: 2.6 }, { x: BIG.lx, z: BIG.lz, w: 6.2, d: 2.6 },
      ...[...WALLS, ...SPARE_WALLS].map((s) => (Math.abs(s.yaw) === Math.PI / 2 ? { x: s.lx, z: s.lz, w: 0.9, d: 2 } : { x: s.lx, z: s.lz, w: 2, d: 0.9 })),
    ].map((f) => Object.freeze(f))),
    insects: Object.freeze([...CASE_SPOTS.map((c) => ({ x: c.lx, z: c.lz, w: 0.95, d: 0.95 })), { x: DOME.lx, z: DOME.lz, w: 3.1, d: 3.1 }].map((f) => Object.freeze(f))),
  });
  // where one may stand: in the room one is in (or the nearest -- a pose from nowhere, the hall), round what stands in it
  function clamp(x, z) {
    const fin = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
    const e = world(ROOM.entry.lx, ROOM.entry.lz); const px = fin(x, e.x); const pz = fin(z, e.z);
    const id = roomOf(px, pz, 2) || 'hall'; const R = ROOMS[id]; const fx = FIXTURES[id];
    let { lx, lz } = localIn(id, px, pz);
    const hx = (id === 'hall' ? HALL_HALF - 0.2 : R.w / 2) - 0.45; const hz = R.d / 2 - 0.45;
    lx = Math.max(-hx, Math.min(hx, lx)); lz = Math.max(-hz, Math.min(hz, lz));
    const hit = (x, z) => fx.find((f) => Math.abs(x - f.x) < f.w / 2 + 0.35 - 1e-6 && Math.abs(z - f.z) < f.d / 2 + 0.35 - 1e-6);
    for (let pass = 0, f = hit(lx, lz); f && pass < 4; pass += 1, f = hit(lx, lz)) {
      const ax = f.w / 2 + 0.35; const az = f.d / 2 + 0.35;
      const ways = [[f.x - ax, lz], [f.x + ax, lz], [lx, f.z - az], [lx, f.z + az]].sort((p, q) => Math.hypot(p[0] - lx, p[1] - lz) - Math.hypot(q[0] - lx, q[1] - lz));
      [lx, lz] = ways.find(([x, z]) => !hit(x, z) && Math.abs(x) <= hx && Math.abs(z) <= hz) || ways[0];
    }
    return worldIn(id, lx, lz);
  }
  const atDesk = (x, z) => { const t = world(TALK.lx, TALK.lz); return roomOf(x, z) === 'hall' && Math.hypot(x - t.x, z - t.z) <= TALK_R; };
  // a plaque's words: what is on show, its size and who gave it -- or the empty slot's
  const plaqueText = (name, shown) => (!shown?.by ? `${name}\n아직 기증받지 못했어요` : `${name}${Number.isFinite(shown.size) ? ` ${shown.size} cm` : ''}\n${shown.by}님 기증`);
  return { ROOM, ROOMS, AQUA, BUGS, HALL_HALF, world, local, worldIn, localIn, roomOf, inMuseum, SEA, FRESH, WATER_OF, WATERS, WATER_WALLS, INSECTS, FLYERS, TANK, BIG, tankPlaque, WALLS, SPARE_WALLS, WALL_SIGNS, CASES, SPARE_CASES, DOME, SLOTS, DESK, CURATOR, TALK, TALK_R, BENCHES, BOARD, PLANTS, PASSAGES, PASS_R, passage, FIXTURES, clamp, atDesk, plaqueText };
}));
