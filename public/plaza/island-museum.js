// v1.10.231 M 박물관 전시관 (gamecenter-notes docs/museum-hall-design-20261025.md, assets 74): through the museum's door, its
// own room far off the island (like the 구치소's): the entrance hall in the middle (the curator at his desk, two benches,
// the board), the aquarium west (the sea fish together in the big tank, each river fish in its wall tank) and the insect
// wing east (a case each, the butterflies and dragonflies flying in the glass dome). Each slot's plaque says what is on
// show, its size and who gave it. Room-local metres from assets 74 (the door at local -Z), the room turned half round in
// the world like the others. Browser and server.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandMuseum = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const ROOM = Object.freeze({ x: 100, z: -430, y: 0.4, w: 24, d: 16, entry: Object.freeze({ lx: 0, lz: -7.1 }), exit: Object.freeze({ lx: 0, lz: -7.5 }) });
  const world = (lx, lz) => ({ x: Math.round((ROOM.x - lx) * 100) / 100, z: Math.round((ROOM.z - lz) * 100) / 100 });
  const local = (x, z) => ({ lx: ROOM.x - x, lz: ROOM.z - z });
  const inMuseum = (x, z, pad = 0) => Math.abs(x - ROOM.x) <= ROOM.w / 2 + pad && Math.abs(z - ROOM.z) <= ROOM.d / 2 + pad;
  // the 34 fish: the sea's in the big tank, the river's (and the lake's, the pools') a wall tank each; the 12 insects a case each
  const SEA = Object.freeze(['anchovy', 'mackerel', 'goby', 'cutlassfish', 'pufferfish', 'octopus', 'stingray', 'giant_tuna', 'mullet', 'flatfish', 'sea_bass', 'gizzard_shad', 'rockfish',
    'yellowtail', 'red_seabream', 'horse_mackerel', 'filefish', 'cod', 'squid', 'blue_crab', 'seahorse']);
  const FRESH = Object.freeze(['crucian_carp', 'carp', 'pale_chub', 'sweetfish', 'catfish', 'mandarin_fish', 'eel', 'smelt', 'crayfish', 'medaka', 'bagrid_catfish', 'masu_salmon', 'sturgeon']);
  const INSECTS = Object.freeze(['butterfly_cabbage', 'butterfly_blue', 'butterfly_swallowtail', 'dragonfly_red', 'dragonfly_emperor', 'cicada', 'rhinoceros_beetle', 'stag_beetle', 'ladybird', 'firefly', 'grasshopper', 'snail']);
  const FLYERS = Object.freeze(['butterfly_cabbage', 'butterfly_blue', 'butterfly_swallowtail', 'dragonfly_red', 'dragonfly_emperor']); // (in the dome too)
  // the big tank (assets 74 museum.tank_big: 6.2 x 2.6, its long side along the room), where its fish swim (tank-local), and
  // its plaques: a row along each long side of its base
  const TANK = Object.freeze({ lx: -8.25, lz: 0, yaw: Math.PI / 2, swim: Object.freeze({ x: 2.7, z: 0.95, y0: 0.8, y1: 2.05 }) });
  const tankPlaque = (k) => ({ side: k < 11 ? -1 : 1, x: -2.75 + (k < 11 ? k : k - 11) * 0.55 }); // (11 on the front, 10 on the back)
  // the wall tanks (museum.tank_wall, 2 m, its back to the wall): seven on the west wall, three each on the back and front
  const WALLS = Object.freeze([...[-6, -4, -2, 0, 2, 4, 6].map((lz) => [-11.55, lz, -Math.PI / 2]), ...[-10, -8, -6].map((lx) => [lx, 7.55, 0]), ...[-10, -8, -6].map((lx) => [lx, -7.55, Math.PI])]
    .map(([lx, lz, yaw]) => Object.freeze({ lx, lz, yaw })));
  // the insect cases (museum.insect_case): a row by the back wall, a row by the front, their plaques toward the middle
  const CASES = Object.freeze([...[5.4, 6.6, 7.8, 9.0, 10.2, 11.4].map((lx) => [lx, 6.6, 0]), ...[5.4, 6.6, 7.8, 9.0, 10.2, 11.4].map((lx) => [lx, -6.6, Math.PI])].map(([lx, lz, yaw]) => Object.freeze({ lx, lz, yaw })));
  const DOME = Object.freeze({ lx: 8.25, lz: 0, yaw: Math.PI / 2, r: 1.3, y0: 0.6, y1: 1.5 }); // (its plaque toward the arch)
  const SLOTS = Object.freeze(Object.fromEntries([...SEA.map((id, k) => [`fish_${id}`, { kind: 'tank', k }]), ...FRESH.map((id, k) => [`fish_${id}`, { kind: 'wall', k, ...WALLS[k] }]),
    ...INSECTS.map((id, k) => [`insect_${id}`, { kind: 'case', k, ...CASES[k] }])].map(([id, s]) => [id, Object.freeze(s)])));
  // the entrance hall: the curator behind his desk (facing the door), where one talks to him, the benches, the board
  const DESK = Object.freeze({ lx: 0, lz: 5.0 });
  const CURATOR = Object.freeze({ lx: 0, lz: 6.2, yaw: Math.PI });
  const TALK = Object.freeze({ lx: 0, lz: 3.9 });
  const TALK_R = 2.2; // (the server's: a gift from here)
  const BENCHES = Object.freeze([[-1.7, -1.2], [1.7, -1.2]].map(([lx, lz]) => Object.freeze({ lx, lz, yaw: 0 })));
  const BOARD = Object.freeze({ lx: -3.1, lz: -5.2 });
  const FIXTURES = Object.freeze([ // what one walks round: x, z centre, w, d (room-local)
    ...[-2.6, 2.6].flatMap((x) => [-4.2, 4.2].map((z) => ({ x, z, w: 0.76, d: 0.76 }))) /* the columns */, ...[-4.5, 4.5].flatMap((x) => [-5.25, 5.25].map((z) => ({ x, z, w: 0.4, d: 5.5 }))) /* the wing walls by the arches */,
    { x: 0, z: 5.6, w: 3.8, d: 2.4 } /* the desk and the curator */, ...BENCHES.map((b) => ({ x: b.lx, z: b.lz, w: 1.8, d: 0.5 })), { x: BOARD.lx, z: BOARD.lz, w: 1.3, d: 0.3 },
    { x: TANK.lx, z: TANK.lz, w: 2.6, d: 6.2 }, { x: -11.55, z: 0, w: 0.9, d: 14 }, { x: -8, z: 7.55, w: 6, d: 0.9 }, { x: -8, z: -7.55, w: 6, d: 0.9 },
    { x: 8.4, z: 6.6, w: 7, d: 0.95 }, { x: 8.4, z: -6.6, w: 7, d: 0.95 }, { x: DOME.lx, z: DOME.lz, w: 3.1, d: 3.1 },
  ].map((f) => Object.freeze(f)));
  // where one may stand: in the room, round what stands in it (as the 구치소's)
  function clamp(x, z) {
    const fin = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
    const e = world(ROOM.entry.lx, ROOM.entry.lz);
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
  const atDesk = (x, z) => { const t = world(TALK.lx, TALK.lz); return Math.hypot(x - t.x, z - t.z) <= TALK_R; };
  // a plaque's words: what is on show, its size and who gave it -- or the empty slot's
  const plaqueText = (name, shown) => (!shown?.by ? `${name}\n아직 기증받지 못했어요` : `${name}${Number.isFinite(shown.size) ? ` ${shown.size} cm` : ''}\n${shown.by}님 기증`);
  return { ROOM, world, local, inMuseum, SEA, FRESH, INSECTS, FLYERS, TANK, tankPlaque, WALLS, CASES, DOME, SLOTS, DESK, CURATOR, TALK, TALK_R, BENCHES, BOARD, FIXTURES, clamp, atDesk, plaqueText };
}));
