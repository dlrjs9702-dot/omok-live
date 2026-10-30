// 백화점 개편 A안 (gamecenter-notes docs/mall-revamp-20261027.md, 사용자 「A안(4층, 옥상 펫샵)으로 해」): the 2nd floor, 옷·꾸미기
// -- clothes, small things and the transformations picked from racks, a case and a costume rail (each its shop's window as
// before), and two 꾸미기 mirrors: sat at one, hair, colour and face in one place (two at a time, a seat each). The room is
// assets 60's petshop.floor3 with assets 82's wear.* in it (README 「층별 배치」), its own far off the island like the other
// floors, turned half round the same way (its front toward the camera). Browser and server.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandFashion = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const ROOM = Object.freeze({ x: 220, z: -330, y: 0.4, w: 30, d: 20 });
  const world = (lx, lz) => ({ x: Math.round((ROOM.x - lx) * 100) / 100, z: Math.round((ROOM.z - lz) * 100) / 100 });
  const local = (x, z) => ({ lx: ROOM.x - x, lz: ROOM.z - z });
  const inRoom = (x, z, pad = 0) => Math.abs(x - ROOM.x) <= ROOM.w / 2 + pad && Math.abs(z - ROOM.z) <= ROOM.d / 2 + pad;
  const LIFT = Object.freeze({ lx: -14.05, lz: 0, yaw: -Math.PI / 2, stand: Object.freeze([-11.5, 0]) });
  // what stands: model id, x, z, yaw, its footprint w x d (walked round; along the room's axes after its turn)
  // (assets 82's wear.* registered as mall.wear_*: the wear.* ids are the characters' parts)
  const PROPS = Object.freeze([
    ['mall.wear_mannequin_stage', -5, -8.9, 0, 2.22, 1.02], ['mall.wear_mannequin_stage', 5, -8.9, 0, 2.22, 1.02],
    ['mall.wear_rack_straight__plain', -7.6, -3.6, 0, 1.64, 0.56], ['mall.wear_rack_straight__plain', -3.6, -3.6, 0, 1.64, 0.56],
    ['mall.wear_rack_straight__plain', -7.6, 0.4, 0, 1.64, 0.56], ['mall.wear_rack_straight__plain', -3.6, 0.4, 0, 1.64, 0.56],
    ['mall.wear_rack_round', 3.6, -3.6, 0, 1.41, 1.24], ['mall.wear_rack_round', 7.4, -3.6, 0, 1.41, 1.24], ['mall.wear_rack_straight__costume', 5.5, 0.6, 0, 2.36, 0.56],
    ['mall.wear_acc_case', 8.8, 5.0, 0, 1.74, 0.74], ['mall.wear_display_shelf', -3.2, 9.82, 0, 2.44, 0.52, true], ['mall.wear_display_shelf', 3.2, 9.82, 0, 2.44, 0.52, true],
    ['mall.counter__f2', 0, 5.6, 0, 2.3, 0.85], ['mall.wear_fitting_room', 14.0, -5.4, Math.PI / 2, 1.62, 1.68], ['mall.wear_fitting_room', 14.0, -3.6, Math.PI / 2, 1.62, 1.68],
    ['furn.mirror_stand__gold', 14.6, -0.8, Math.PI / 2, 0.5, 0.9], ['mall.wear_vanity', -10.8, 9.82, 0, 1.5, 1.44, true], ['mall.wear_vanity', -7.4, 9.82, 0, 1.5, 1.44, true],
  ].map(([id, x, z, yaw, w, d, wall]) => Object.freeze({ id, x, z: wall ? z - d / 2 : z, at: z, yaw, w, d })));
  // the shops (`place`: the island facility each was -- its window and the server's check stay), where SPACE opens them
  const SECTORS = Object.freeze([
    { id: 'clothes', place: 'avatar', name: '옷가게', interact: [-5.6, -1.6] }, // (between the four plain racks)
    { id: 'transform', place: 'transform', name: '변신 의상실', interact: [5.5, -0.5] }, // (before the costume rail)
    { id: 'accessories', place: 'accessories', name: '소품 가게', interact: [8.8, 3.8] }, // (before the case)
  ].map((s) => Object.freeze(s)));
  const COUNTER = Object.freeze({ lx: 0, lz: 5.6, keeper: Object.freeze([0, 6.6, 0]), customer: Object.freeze([0, 4.3]) });
  // the two 꾸미기 mirrors: a chair each (assets 82 wear.vanity `seat`, looking into the mirror); sat, hair, colour and face
  const MIRRORS = Object.freeze([-10.8, -7.4].map((lx, i) => Object.freeze({ id: `mirror${i}`, lx, lz: 9.82 - 1.15, y: 0.58 })));
  const MIRROR_PLACES = Object.freeze(['hair', 'dye', 'faces']);
  // the mirrors' chairs as seats (world; yaw π -- the sitter looking into the mirror, room-local +Z; its height less 0.54, as a
  // house's chairs, island-home.js seatsOf, the scene lifting a sitter 0.28 over it)
  const SEATS = Object.freeze(MIRRORS.map((m) => Object.freeze({ id: `v-${m.id}`, ...world(m.lx, m.lz), yaw: Math.PI, y: ROOM.y + m.y - 0.54, room: 'fashion', counter: m.id, door: 'mirror', name: '꾸미기', hint: '앉아서 꾸미기' })));
  const FIXTURES = Object.freeze([...PROPS.map((p) => ({ x: p.x, z: p.z, w: p.w, d: p.d })), { x: LIFT.lx + 0.955, z: LIFT.lz, w: 1.91, d: 2.1 }].map((f) => Object.freeze(f)));
  const sectorOf = (place) => SECTORS.find((s) => s.place === place) || null;
  const sectorPoint = (place) => { const s = sectorOf(place); return s ? world(s.interact[0], s.interact[1]) : null; };
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
  return { ROOM, LIFT, PROPS, SECTORS, COUNTER, MIRRORS, MIRROR_PLACES, SEATS, FIXTURES, world, local, inRoom, clamp, sectorOf, sectorPoint };
}));
