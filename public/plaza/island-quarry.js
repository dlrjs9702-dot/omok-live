// 1.10.323 Q1 채석장 (gamecenter-notes docs/island-expansion-20261115.md 28A·29B·30A; assets 129 rocks·ore·pickaxe·sign, 130 the
// pickaxe's swing): the rules the server and the page share.
// - The place: 달마루 능선 B (298°~314° round the island's middle, r 148~166, about 21 m up, behind and above the 백화점 -- not seen
//   from 대청마당), the ridge walk carried 79 m east from 영웅마루역 to it. Ten rocks of three kinds, a sign 「채석장」 and an ore pile.
// - Mining: with a 곡괭이 (잡화점) in the hand, at one of a rock's mining spots (assets 129 mine-spots, the spot of the rock's stage
//   now: a mined rock's are about 11 cm further in), SPACE: three swings (PickaxeSwing 1.2 s each), then one 광석 into the bag and
//   the pickaxe one use older. A rock gives ORE_PER_ROCK, then stands 「mined」 (its own model) until it grows back.
// - 사용자 확인 필요 (proposed, 총괄): ORE_PER_ROCK 2, REGROW_MS 3 h, DAILY 6 a person.
(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.IslandQuarry = api; }(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const DEG = Math.PI / 180;
  const po = (deg, r) => ({ x: Math.round(Math.cos(deg * DEG) * r * 100) / 100, z: Math.round(Math.sin(deg * DEG) * r * 100) / 100 });
  const AREA = Object.freeze({ a0: 298, a1: 314, r0: 148, r1: 166 });
  // in the area (m metres round it)
  function inArea(x, z, m = 0) { const r = Math.hypot(x, z); let a = Math.atan2(z, x) / DEG; if (a < 0) a += 360; const ma = (m / Math.max(1, r)) / DEG; return r >= AREA.r0 - m && r <= AREA.r1 + m && a >= AREA.a0 - ma && a <= AREA.a1 + ma; }
  // the walk on from 영웅마루역 (its last point, -5 -155 / 268° r 155) along the ridge at r 150 into the quarry (79 m)
  const WALK = Object.freeze([268, 274, 280, 286, 292, 298].map((a, i) => po(a, i === 0 ? 155 : 150)));
  // the rocks: kind (a round, b a standing slab, c a low heap), place, yaw (places: tools quarrysites -- walkable, flat, 5.2 m apart)
  const ROCKS = Object.freeze([
    ['a', 78.6, -127.8], ['b', 85.6, -123.2], ['c', 92.3, -118.2], ['a', 98.8, -112.9], ['c', 77.5, -134.2],
    ['b', 84.9, -129.7], ['a', 92.0, -124.8], ['c', 98.8, -119.4], ['a', 105.3, -113.7], ['b', 83.8, -136.3],
  ].map(([kind, x, z], i) => Object.freeze({ id: `r${i}`, kind, x, z, yaw: Math.round(((i * 2.39) % (Math.PI * 2)) * 100) / 100 })));
  const SIGN = Object.freeze({ x: 72.2, z: -130.3, yaw: Math.round((Math.atan2(72.2 - 70.89, -130.3 + 133.33)) * 100) / 100 }); // (its front, the model's -Z, to the walk's end)
  const PILE = Object.freeze({ x: 74.2, z: -133.8, yaw: 0.6 });
  // assets 129 mine-spots: per kind and stage, [x, z, nx, nz] in the rock's own frame (the surface point at 0.4 m, outward)
  const SPOTS = Object.freeze({
    a: { full: [[0, -0.7544, 0, -1], [0.7468, 0.4312, 0.866, 0.5], [-0.7388, 0.4265, -0.866, 0.5]], mined: [[0, -0.6454, 0, -1], [0.6545, 0.3779, 0.866, 0.5], [-0.6433, 0.3714, -0.866, 0.5]] },
    b: { full: [[0, -0.5018, 0, -1], [0, 0.508, 0, 1]], mined: [[0, -0.3967, 0, -1], [0, 0.3981, 0, 1]] },
    c: { full: [[0, -0.7186, 0, -1], [0.7325, 0.4229, 0.866, 0.5], [-0.7403, 0.4274, -0.866, 0.5]], mined: [[0, -0.6083, 0, -1], [0.642, 0.3706, 0.866, 0.5], [-0.6366, 0.3675, -0.866, 0.5]] },
  });
  // assets 129 solids: the circle people do not walk into, and its stand-in box [w, h, d, centre y] (dalmaru-walk)
  const SOLIDS = Object.freeze({ a: { r: 0.862, box: [1.724, 1.249, 1.724, 0.625] }, b: { r: 0.668, box: [1.336, 1.485, 1.336, 0.743] }, c: { r: 1.17, box: [2.34, 0.947, 2.34, 0.473] }, pile: { r: 0.506, box: [1.012, 0.51, 1.012, 0.255] }, sign: { r: 0.361, box: [0.722, 1.35, 0.722, 0.675] } });
  // assets 130: the pickaxe's tip at the hit, in the player's own frame (x right, y up, -z ahead) -- the player stands so it lands on the spot
  const HIT_TIP = Object.freeze([0.08, 0.4, -1.0]);
  const SWING_MS = 1200; const SWINGS = 3; const MINE_MS = SWING_MS * SWINGS; const END_MS = 1000;
  const ORE_PER_ROCK = 2; const REGROW_MS = 3 * 3600000; const DAILY = 6; // (사용자 확인 필요)
  const PICK_USES = 40; // (a pickaxe: 40 ores)
  // a spot in the world: the surface point, outward, and where to stand (origin = S - R(yaw) HIT_TIP, facing -n)
  function spotOf(rock, stage, i) {
    const s = SPOTS[rock.kind]?.[stage === 'mined' ? 'mined' : 'full']?.[i]; if (!s) return null;
    const c = Math.cos(rock.yaw); const sn = Math.sin(rock.yaw); const rot = (x, z) => ({ x: x * c + z * sn, z: -x * sn + z * c }); /* (THREE's rotation.y) */
    const p = rot(s[0], s[1]); const n = rot(s[2], s[3]); const S = { x: rock.x + p.x, z: rock.z + p.z };
    const yaw = Math.atan2(-n.x, -n.z); /* (facing -n: the player's -Z... the characters face +Z at yaw 0 -- see standOf) */
    return { S, n, yaw };
  }
  // where the player stands at a spot: the characters face +Z at rotation 0 (yaw = atan2(dx, dz) toward the rock); the tip [x, y, -z
  // ahead] put on the spot
  function standOf(rock, stage, i) {
    const sp = spotOf(rock, stage, i); if (!sp) return null; const face = Math.atan2(-sp.n.x, -sp.n.z); // (toward the rock: -n)
    const ahead = { x: Math.sin(face), z: Math.cos(face) }; const right = { x: -Math.cos(face), z: Math.sin(face) };
    const t = HIT_TIP; const forward = -t[2]; const side = t[0];
    return { x: Math.round((sp.S.x - ahead.x * forward - right.x * side) * 1000) / 1000, z: Math.round((sp.S.z - ahead.z * forward - right.z * side) * 1000) / 1000, yaw: face, S: sp.S };
  }
  const rockById = (id) => ROCKS.find((r) => r.id === id) || null;
  const spotCount = (rock) => SPOTS[rock.kind].full.length;
  // a rock's state at `now` from what is kept { left, minedAt, gen }: full again REGROW_MS after it was mined out
  function rockState(kept, now) { const k = kept || {}; const left = Number.isInteger(k.left) ? k.left : ORE_PER_ROCK; if (left <= 0 && Number.isFinite(k.minedAt) && now - k.minedAt >= REGROW_MS) return { left: ORE_PER_ROCK, gen: now, stage: 'full', regrown: true }; return { left, gen: k.gen || 0, stage: left > 0 ? 'full' : 'mined', minedAt: k.minedAt ?? null }; }
  // the solids round a rock (its circle, turned with it: centred) and the sign's and pile's
  const solidsOf = () => [...ROCKS.map((r) => ({ x: r.x, z: r.z, r: SOLIDS[r.kind].r, quarry: r.id })), { x: SIGN.x, z: SIGN.z, r: SOLIDS.sign.r }, { x: PILE.x, z: PILE.z, r: SOLIDS.pile.r }];
  return { AREA, inArea, po, WALK, ROCKS, SIGN, PILE, SPOTS, SOLIDS, HIT_TIP, SWING_MS, SWINGS, MINE_MS, END_MS, ORE_PER_ROCK, REGROW_MS, DAILY, PICK_USES, spotOf, standOf, rockById, spotCount, rockState, solidsOf };
}));
