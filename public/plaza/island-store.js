// v1.10.92 잡화점 (사용자 2026-10-18, IDEAS #future-general-store): a store one walks into (like the 민원실, its own room far
// off the island) where the goods stand on shelves, tables and the counter -- standing at one, SPACE buys it. The room,
// its fixtures and where each good stands come from assets 41 (manifest.json, room-local metres, its door at local -Z);
// the room is turned half round in the world so the door is toward the camera like the 민원실's. Browser and server.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandStore = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const ROOM = Object.freeze({ x: 100, z: -330, y: 0.4, w: 10, d: 8, entry: Object.freeze({ lx: 0, lz: -2.9 }), exit: Object.freeze({ lx: 0, lz: -3.4 }), keeper: Object.freeze({ lx: 2.3, lz: 3.05 }) });
  // room-local -> world (turned half round: local +Z is world -Z)
  const world = (lx, lz) => ({ x: Math.round((ROOM.x - lx) * 100) / 100, z: Math.round((ROOM.z - lz) * 100) / 100 });
  const local = (x, z) => ({ lx: ROOM.x - x, lz: ROOM.z - z });
  const inStore = (x, z, pad = 0) => Math.abs(x - ROOM.x) <= ROOM.w / 2 + pad && Math.abs(z - ROOM.z) <= ROOM.d / 2 + pad;
  const FIXTURES = Object.freeze([ // x, z centre, width along it, depth, yaw (assets 41 manifest.fixtures)
    { id: 'shelf.back', x: -2.9, z: 3.45, w: 2.8, d: 0.7, yaw: 0 }, { id: 'shelf.left', x: -4.45, z: 0.2, w: 2.6, d: 0.7, yaw: -Math.PI / 2 },
    { id: 'shelf.right', x: 4.45, z: 0.2, w: 2.6, d: 0.7, yaw: Math.PI / 2 }, { id: 'table.left', x: -1.8, z: -0.8, w: 1.6, d: 1.4, yaw: 0 },
    { id: 'table.right', x: 1.8, z: -0.8, w: 1.6, d: 1.4, yaw: 0 }, { id: 'counter', x: 2.3, z: 1.85, w: 3.1, d: 0.9, yaw: 0 },
  ].map((f) => Object.freeze(f)));
  // where each good stands (manifest.displayPlacements: [id, [x, y, z], yaw]); seeds, the sapling and fertilizer wait for planting
  const SHELF = Object.freeze([
    ['seed_flower_red', [-3.93, 1.12, 3.4], 0], ['seed_flower_yellow', [-3.67, 1.12, 3.4], 0], ['seed_flower_white', [-3.13, 1.12, 3.4], 0],
    ['seed_flower_pink', [-2.9, 1.12, 3.4], 0], ['seed_flower_purple', [-2.67, 1.12, 3.4], 0], ['sapling', [-2, 1.12, 3.4], 0],
    ['bait', [-4.4, 1.12, -0.77], -Math.PI / 2], ['bait_premium', [-4.4, 1.12, -0.53], -Math.PI / 2], ['fertilizer', [-4.4, 1.12, 0.2], -Math.PI / 2],
    ['guitar_string', [-4.4, 1.12, 0.91], -Math.PI / 2], ['nail_box', [-4.4, 1.12, 1.19], -Math.PI / 2],
    ['milk', [4.4, 1.12, 1.18], Math.PI / 2], ['bread', [4.4, 1.12, 0.92], Math.PI / 2], ['bulb', [4.4, 1.12, 0.36], Math.PI / 2], ['paint', [4.4, 1.12, 0.04], Math.PI / 2],
    ['gift_wrap', [4.4, 1.12, -0.65], Math.PI / 2], ['bouquet', [-1.8, 0.82, -1.23], 0], ['frame', [-1.8, 0.82, -0.8], 0], ['letter_paper', [-1.8, 0.82, -0.37], 0],
    ['firework', [1.8, 0.82, -1.23], 0], ['balloon', [1.8, 0.82, -0.8], 0], ['bubbles', [1.8, 0.82, -0.37], 0], ['badge', [1.35, 1.02, 1.62], 0],
  ].map(([id, at, yaw]) => Object.freeze({ id, at: Object.freeze(at), yaw, soon: /^seed_|^sapling$|^fertilizer$/.test(id) })));
  const REACH = 1.5; // a good within this of me (on the floor plan) is the one SPACE buys
  // where one may stand: inside the walls (0.45 m off them), out of the fixtures (0.35 m round them)
  function clamp(x, z) {
    const fin = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
    let { lx, lz } = local(fin(x, world(ROOM.entry.lx, ROOM.entry.lz).x), fin(z, world(ROOM.entry.lx, ROOM.entry.lz).z));
    lx = Math.max(-ROOM.w / 2 + 0.45, Math.min(ROOM.w / 2 - 0.45, lx)); lz = Math.max(-ROOM.d / 2 + 0.45, Math.min(ROOM.d / 2 - 0.45, lz));
    for (const f of FIXTURES) {
      const across = Math.abs(Math.sin(f.yaw)) > 0.5; const hx = (across ? f.d : f.w) / 2 + 0.35; const hz = (across ? f.w : f.d) / 2 + 0.35;
      const dx = lx - f.x; const dz = lz - f.z;
      if (Math.abs(dx) < hx && Math.abs(dz) < hz) { if (hx - Math.abs(dx) < hz - Math.abs(dz)) lx = f.x + Math.sign(dx || 1) * hx; else lz = f.z + Math.sign(dz || 1) * hz; }
    }
    return world(lx, lz);
  }
  // the good nearest me within reach (null if none)
  function goodAt(x, z) {
    const { lx, lz } = local(x, z); let best = null; let bd = REACH;
    for (const s of SHELF) { const d = Math.hypot(s.at[0] - lx, s.at[2] - lz); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  return { ROOM, FIXTURES, SHELF, REACH, world, local, inStore, clamp, goodAt };
}));
