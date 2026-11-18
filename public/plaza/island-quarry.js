// 1.10.323 Q1 채석장 (gamecenter-notes docs/island-expansion-20261115.md 28A·29B·30A; assets 129 rocks·ore·pickaxe·sign, 130 the
// pickaxe's swing): the rules the server and the page share.
// - The place: 달마루 능선 B (298°~314° round the island's middle, r 148~166, about 21 m up, behind and above the 백화점 -- not seen
//   from 대청마당), the ridge walk carried 79 m east from 영웅마루역 to it. Ten rocks of three kinds, a sign 「채석장」 and an ore pile.
// - Mining: with a 곡괭이 (잡화점) in the hand, at one of a rock's mining spots (assets 129 mine-spots, the spot of the rock's stage
//   now: a mined rock's are about 11 cm further in), SPACE: three swings (PickaxeSwing 1.2 s each), then one 광석 into the bag and
//   the pickaxe one use older. A rock gives ORE_PER_ROCK, then stands 「mined」 (its own model) until it grows back.
// - 사용자 2026-11-17: 하루 60, 바위 6 (ORE_PER_ROCK 6, DAILY 60 a person; REGROW_MS 3 h). The 화강암 벽 (WALL, 사용자 182): granite only, never empty, outside DAILY.
// 1.10.342 4a 채석장 전체 (notes island-expansion §9, 사용자 88A~98B; assets 140 ores, 141 quarry-v2, 143 quarry-v3): the whole ridge
// top from 290° to 343° -- four pieces (AREA), 32 rocks each with its main ore (lib/island-ores.js: how often it comes, how long the
// rock takes to fill), the developed look (walls, carts on a 132 m rail, tents, the bench faces along the cliff edge, the cranes, the
// waterfall deck, stone blocks, lamps, rope rails, ore crates). Mining is a little game now (98B, review-plan §1-8): each swing lights
// one of the rock's five cracks for a moment; pressing it (click, tap -- a wider ring on a phone) while it shines or up to GRACE_MS
// after is 「쨍!」, near its brightest middle (±BONUS_MS) a better chance of the ore a tier up; two of three swings give the ore, else
// rubble (a 작은 돌) -- a missed set wears only the pickaxe (the rock's ores and the day's count stay).
(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.IslandQuarry = api; }(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const DEG = Math.PI / 180;
  const po = (deg, r) => ({ x: Math.round(Math.cos(deg * DEG) * r * 100) / 100, z: Math.round(Math.sin(deg * DEG) * r * 100) / 100 });
  // (1.10.342 §9-1: four pieces -- the west way in, the middle (the old quarry inside it), the waterfall's neck (r 151: 3.8 m off its
  // pond's bank, §9-3), the east)
  const AREA = Object.freeze([{ id: 'west', a0: 290, a1: 297, r0: 143, r1: 166 }, { id: 'middle', a0: 297, a1: 320, r0: 137, r1: 166 }, { id: 'neck', a0: 320, a1: 330, r0: 151, r1: 162.5 }, { id: 'east', a0: 330, a1: 343, r0: 139, r1: 162 }].map((p) => Object.freeze(p)));
  const polar = (x, z) => { let a = Math.atan2(z, x) / DEG; if (a < 0) a += 360; return { r: Math.hypot(x, z), a }; };
  // in the area (m metres round it): in any piece
  function inArea(x, z, m = 0) { const { r, a } = polar(x, z); const ma = (m / Math.max(1, r)) / DEG; return AREA.some((p) => r >= p.r0 - m && r <= p.r1 + m && a >= p.a0 - ma && a <= p.a1 + ma); }
  // how far inside the area's edge (outside: negative) -- its outline where two pieces meet left out, so the dug ground has no seam
  // there (the ground maps: tools/maps/ground-cover.js)
  let rim = null;
  function edgeDist(x, z) {
    if (!rim) { rim = []; const inner = (px, pz, own) => AREA.some((p) => { const q = polar(px, pz); return p === own ? q.r > p.r0 + 0.05 && q.r < p.r1 - 0.05 && q.a > p.a0 + 0.02 && q.a < p.a1 - 0.02 : q.r >= p.r0 - 0.01 && q.r <= p.r1 + 0.01 && q.a >= p.a0 - 0.001 && q.a <= p.a1 + 0.001; }); /* (on another piece, its edge too: a seam) */
      for (const p of AREA) { const add = (px, pz) => { if (!inner(px, pz, p)) rim.push([px, pz]); };
        for (const r of [p.r0, p.r1]) for (let a = p.a0; a <= p.a1 + 1e-9; a += 0.4 / r / DEG) add(Math.cos(a * DEG) * r, Math.sin(a * DEG) * r);
        for (const a of [p.a0, p.a1]) for (let r = p.r0; r <= p.r1 + 1e-9; r += 0.4) add(Math.cos(a * DEG) * r, Math.sin(a * DEG) * r); } }
    let d = Infinity; for (const [px, pz] of rim) { const e = (px - x) ** 2 + (pz - z) ** 2; if (e < d) d = e; } d = Math.sqrt(d); return inArea(x, z) ? d : -d;
  }
  // the walk on from 영웅마루역 (its last point, -5 -155 / 268° r 155) along the ridge at r 150 into the quarry (79 m)
  const WALK = Object.freeze([268, 274, 280, 286, 292, 298].map((a, i) => po(a, i === 0 ? 155 : 150)));
  // the rocks: kind (a round, b a standing slab, c a low heap), place, yaw (places: tools quarrysites -- walkable, flat, 5.2 m apart)
  // (1.10.342 §9-2: r0~r9 where they were, r10~r31 the new; each its main ore -- 88A: granite 8, clay 7, coal 6, iron 5, copper 3,
  // silver, crystal and gold one each; the common ones near the way in, the rare ones far east and by the waterfall)
  const ROCKS = Object.freeze([
    ['a', 78.6, -127.8, 'granite'], ['b', 85.6, -123.2, 'granite'], ['c', 92.3, -118.2, 'clay'], ['a', 98.8, -112.9, 'clay'], ['c', 77.5, -134.2, 'granite'],
    ['b', 84.9, -129.7, 'granite'], ['a', 92.0, -124.8, 'clay'], ['c', 98.8, -119.4, 'clay'], ['a', 105.3, -113.7, 'coal'], ['b', 83.8, -136.3, 'granite'],
    ['c', 91.3, -131.4, 'clay'], ['a', 98.5, -126.1, 'coal'], ['b', 105.4, -120.4, 'coal'], ['a', 72.5, -122.6, 'granite'], ['b', 81.7, -116.6, 'clay'],
    ['c', 90.4, -110.0, 'clay'], ['a', 98.6, -102.8, 'coal'], ['b', 62.0, -143.2, 'granite'], ['a', 70.9, -144.0, 'granite'], ['c', 111.5, -109.1, 'coal'],
    ['a', 120.0, -106.6, 'iron'], ['b', 105.5, -95.7, 'coal'], ['a', 131.3, -91.9, 'copper'], ['c', 136.2, -84.5, 'crystal'], ['b', 143.2, -71.4, 'iron'],
    ['a', 145.1, -63.7, 'iron'], ['c', 147.1, -56.2, 'copper'], ['b', 149.6, -49.2, 'gold'], ['a', 129.3, -69.9, 'iron'], ['c', 132.2, -63.1, 'iron'],
    ['b', 135.3, -56.1, 'copper'], ['a', 138.4, -49.6, 'silver'],
  ].map(([kind, x, z, ore], i) => Object.freeze({ id: `r${i}`, kind, x, z, ore, yaw: Math.round(((i * 2.39) % (Math.PI * 2)) * 100) / 100 })));
  // (1.10.342: where it was, at the ridge walk's end -- the walk unchanged (92A), the sign the place it leads to; §9-2's (54.3, -143.0) by
  // the west way in would leave the walk's end in the open)
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
  // 1.10.342 the developed look: each model (quarry.<model>: 141 quarry-v2, 143 quarry-v3) where it stands; the rail apart (walked
  // over, not solid -- its two end buffers are)
  const PROPS = Object.freeze([
    ['rock_wall_a_granite',90.61,-137.42,-3.725] /* (1.10.350: the 화강암 벽) */, ['rock_wall_a',98.6,-131.8,-3.784], ['rock_wall_a',106.24,-125.72,-3.843], ['rock_wall_a',139.3,-43.7,1.875],
    ['rock_wall_b',83.24,-141.88,-3.672], ['rock_wall_b',112.19,-120.31,-3.892], ['ore_cart',60,-133.5,-2.008], ['ore_cart',86.6,-117.5,-2.222],
    ['ore_cart',127.8,-89.5,-2.537], ['ore_cart',140.7,-56.8,-2.832], ['work_tent',59.1,-149.3,0], ['work_tent',125,-100.2,0],
    ['work_tent',138.3,-78,0], ['tool_rack',57.7,-142,0], ['bench_face_end_r',65.21,-117.64,-3.672], ['bench_face',68.06,-116.01,-3.672],
    ['bench_face',73.25,-112.8,-3.718], ['bench_face',78.3,-109.36,-3.763], ['bench_face',83.18,-105.7,-3.808], ['bench_face',88.24,-101.51,-3.857],
    ['bench_face',92.75,-97.4,-3.903], ['bench_face',97.08,-93.09,-3.948], ['bench_face',101.2,-88.59,-3.993], ['bench_face_end_l',103.33,-86.09,-3.993],
    ['bench_face_end_r',119.64,-63.61,-4.248], ['bench_face',121.16,-60.67,-4.248], ['bench_face',123.98,-54.68,-4.297], ['bench_face',126.5,-48.56,-4.346],
    ['bench_face_end_l',127.65,-45.45,-4.346], ['crane_big',123.6,-88.2,3.023], ['crane_small',123.8,-69.2,2.08], ['view_deck',127.4,-82.1,2.135],
    ['stone_blocks',50.89,-132.57,-3.508], ['stone_blocks',54.47,-141.9,-3.508], ['stone_blocks',58.06,-151.24,-3.508], ['stone_blocks',55.48,-130.71,-3.543],
    ['stone_blocks',59.39,-139.92,-3.543], ['stone_blocks',63.3,-149.12,-3.543], ['stone_blocks',60.01,-128.7,-3.578], ['work_lamp',64.24,-137.76,-3.578],
    ['work_lamp',64.47,-126.52,-3.613], ['work_lamp',69.01,-135.43,-3.613], ['work_lamp',78.54,-141.69,-3.648], ['work_lamp',77.34,-119.09,-3.718],
    ['work_lamp',88.23,-135.86,-3.718], ['work_lamp',85.46,-113.41,-3.787], ['rope_rail',110.48,-118.48,-3.892], ['rope_rail',114.55,-114.55,-3.927],
    ['rope_rail',110.35,-89.36,-4.032], ['rope_rail',118.13,-95.66,-4.032], ['rope_rail',125.9,-101.95,-4.032],
    ['rope_rail',129.38,-97.49,-4.067], ['ore_crate',121.72,-73.14,-4.171], ['ore_crate',130.29,-78.29,-4.171],
    ['ore_crate',132.94,-73.69,-4.206], ['ore_crate',141.69,-78.54,-4.206], ['ore_crate',146.82,-68.46,-4.276], ['ore_crate',153.17,-52.74,-4.381],
    ['rope_rail_post',109.02,-119.84,-3.892], ['rope_rail_post',113.14,-115.97,-3.927], ['rope_rail_post',109.1,-90.92,-4.032], ['rope_rail_post',116.87,-97.21,-4.032],
    ['rope_rail_post',124.64,-103.5,-4.032], ['rope_rail_post',128.18,-99.09,-4.067],
  ].map(([model, x, z, yaw]) => Object.freeze({ model, x, z, yaw }))); /* (gen342 from assets 141 layout.json, 143 scene-layout.json and README bench rows; a rope rail, its post and a crate of 143 left out -- on the real ground they stood down the cliff by the waterfall, the crate in its pool) */
  const RAIL = Object.freeze([
    ['e',54.7,-136.2,0.932], ['s',54.7,-136.2,-2.158], ['s',56.37,-135.1,-2.107], ['s',58.09,-134.07,-2.055], ['s',59.86,-133.14,-2.008], ['s',61.67,-132.3,-2.018],
    ['s',63.47,-131.43,-2.03], ['s',65.26,-130.54,-2.043], ['s',67.05,-129.64,-2.056], ['s',68.82,-128.7,-2.069], ['s',70.57,-127.75,-2.083], ['s',72.32,-126.77,-2.096],
    ['s',74.05,-125.76,-2.11], ['s',75.76,-124.74,-2.123], ['s',77.46,-123.69,-2.137], ['s',79.15,-122.61,-2.151], ['s',80.83,-121.52,-2.164], ['s',82.48,-120.4,-2.178],
    ['s',84.13,-119.26,-2.192], ['s',85.75,-118.09,-2.206], ['s',87.36,-116.91,-2.222], ['s',88.95,-115.7,-2.238], ['s',90.52,-114.46,-2.259], ['s',92.07,-113.19,-2.29],
    ['s',93.57,-111.87,-2.275], ['s',95.1,-110.57,-2.224], ['s',96.69,-109.36,-2.172], ['s',98.33,-108.23,-2.121], ['s',100.04,-107.18,-2.069], ['s',101.8,-106.23,-2.018],
    ['s',103.6,-105.36,-1.966], ['s',105.45,-104.59,-1.915], ['s',107.33,-103.92,-1.864], ['s',109.24,-103.34,-1.915], ['s',111.13,-102.66,-1.967], ['s',112.97,-101.89,-2.019],
    ['s',114.77,-101.03,-2.07], ['s',116.53,-100.07,-2.122], ['s',118.23,-99.02,-2.174], ['s',119.88,-97.89,-2.226], ['s',121.47,-96.67,-2.278], ['s',122.99,-95.37,-2.33],
    ['s',124.44,-93.99,-2.382], ['s',125.81,-92.54,-2.433], ['s',127.11,-91.02,-2.485], ['s',128.34,-89.44,-2.537], ['s',129.47,-87.79,-2.588], ['s',130.52,-86.09,-2.64],
    ['s',131.49,-84.34,-2.644], ['s',132.44,-82.58,-2.694], ['s',133.31,-80.78,-2.745], ['s',134.08,-78.93,-2.797], ['s',134.76,-77.05,-2.848], ['s',135.33,-75.14,-2.9],
    ['s',135.81,-73.19,-2.951], ['s',136.19,-71.23,-2.936], ['s',136.6,-69.27,-2.885], ['s',137.11,-67.34,-2.858], ['s',137.67,-65.42,-2.845], ['s',138.25,-63.5,-2.839],
    ['s',138.85,-61.6,-2.835], ['s',139.45,-59.69,-2.834], ['s',140.06,-57.78,-2.833], ['s',140.66,-55.88,-2.832], ['s',141.27,-53.97,-2.832], ['s',141.88,-52.07,-2.832],
    ['e',142.49,-50.16,-2.832],
  ].map(([k, x, z, yaw]) => Object.freeze({ model: k === 'e' ? 'rail_end' : 'rail_straight_2', x, z, yaw }))); /* (assets 143 rail-layout.json: 67 pieces, 132 m) */
  const SHAPES = Object.freeze({
    rock_wall_a: { c: [[-1.35,0,0.65],[-0.45,0,0.65],[0.45,0,0.65],[1.35,0,0.65]], b: [[-1.35,1.15,0,1.3,2.3,1.3],[-0.45,1.15,0,1.3,2.3,1.3],[0.45,1.15,0,1.3,2.3,1.3],[1.35,1.15,0,1.3,2.3,1.3]] },
    rock_wall_a_granite: { c: [[-1.35,0,0.65],[-0.45,0,0.65],[0.45,0,0.65],[1.35,0,0.65]], b: [[-1.35,1.15,0,1.3,2.3,1.3],[-0.45,1.15,0,1.3,2.3,1.3],[0.45,1.15,0,1.3,2.3,1.3],[1.35,1.15,0,1.3,2.3,1.3]] },
    rock_wall_b: { c: [[-1,0.9,0.65],[-0.2,0.9,0.65],[0.9,0.9,0.65],[0.9,0,0.65],[0.9,-0.95,0.65]], b: [[-1,1.15,0.9,1.3,2.3,1.3],[-0.2,1.15,0.9,1.3,2.3,1.3],[0.9,1.15,0.9,1.3,2.3,1.3],[0.9,1.15,0,1.3,2.3,1.3],[0.9,1.15,-0.95,1.3,2.3,1.3]] },
    ore_cart: { c: [[0,-0.35,0.55],[0,0.35,0.55]], b: [[0,0.56,-0.35,1.1,1.12,1.1],[0,0.56,0.35,1.1,1.12,1.1]] },
    tool_rack: { c: [[0,0.02,0.7]], b: [[0,0.8,0.02,1.4,1.6,1.4]] },
    work_tent: { c: [[-1.12,-0.92,0.075],[-1.12,0.92,0.075],[1.12,-0.92,0.075],[1.12,0.92,0.075],[-0.33,0.75,0.4],[0.33,0.75,0.4]], b: [[-1.12,0.99,-0.92,0.15,1.98,0.15],[-1.12,1.125,0.92,0.15,2.25,0.15],[1.12,0.99,-0.92,0.15,1.98,0.15],[1.12,1.125,0.92,0.15,2.25,0.15],[-0.33,0.425,0.75,0.8,0.85,0.8],[0.33,0.425,0.75,0.8,0.85,0.8]] },
    rubble_small: { c: [[0,0,0.45]], b: [[0,0.175,0,0.9,0.35,0.9]] },
    rubble_large: { c: [[0,0,0.8]], b: [[0,0.3,0,1.6,0.6,1.6]] },
    bench_face: { c: [[-2,0,0.62],[-1,0,0.62],[0,0,0.62],[1,0,0.62],[2,0,0.62]], b: [[-2,0.75,0,1.24,1.5,1.24],[-1,0.75,0,1.24,1.5,1.24],[0,0.75,0,1.24,1.5,1.24],[1,0.75,0,1.24,1.5,1.24],[2,0.75,0,1.24,1.5,1.24]] },
    bench_face_end_l: { c: [[-0.4,0,0.62],[0.4,0,0.62]], b: [[-0.4,0.75,0,1.24,1.5,1.24],[0.4,0.75,0,1.24,1.5,1.24]] },
    bench_face_end_r: { c: [[-0.4,0,0.62],[0.4,0,0.62]], b: [[-0.4,0.75,0,1.24,1.5,1.24],[0.4,0.75,0,1.24,1.5,1.24]] },
    rail_end: { c: [[-0.55,-1.3,0.35],[0,-1.3,0.35],[0.55,-1.3,0.35]], b: [[-0.55,0.4,-1.3,0.7,0.8,0.7],[0,0.4,-1.3,0.7,0.8,0.7],[0.55,0.4,-1.3,0.7,0.8,0.7]] },
    crane_big: { c: [[0,0,2.122]], b: [[0,0.35,0,4.244,0.7,4.244]] },
    crane_small: { c: [[0,0,1.415]], b: [[0,0.25,0,2.83,0.5,2.83]] },
    view_deck: (() => { const c = []; for (let i = 0; i <= 19; i += 1) c.push([Math.round((-1.9 + i * 0.2) * 10) / 10, -1.4, 0.13]); for (const x of [-1.9, 1.9]) for (let i = 1; i <= 14; i += 1) c.push([x, Math.round((-1.4 + i * 0.2) * 10) / 10, 0.13]); return { c, b: c.map(([x, z]) => [x, 0.75, z, 0.26, 1.5, 0.26]) }; })(), /* (its 48 rail circles: the front and both sides, the back's steps open; the boards walked on -- DECK) */
    stone_blocks: { c: [[0,0.12,0.91]], b: [[0,0.55,0.12,1.82,1.1,1.82]] },
    work_lamp: { c: [[0,0,0.36]], b: [[0,1,0,0.72,2,0.72]] },
    ore_crate: { c: [[0,0,0.55]], b: [[0,0.39,0,1.1,0.78,1.1]] },
    rope_rail: { c: [[0,0,0.25],[0.5,0,0.25],[1,0,0.25],[1.5,0,0.25],[2,0,0.25]], b: [[0,0.45,0,0.5,0.9,0.5],[0.5,0.45,0,0.5,0.9,0.5],[1,0.45,0,0.5,0.9,0.5],[1.5,0.45,0,0.5,0.9,0.5],[2,0.45,0,0.5,0.9,0.5]] },
    rope_rail_post: { c: [[0,0,0.25]], b: [[0,0.45,0,0.5,0.9,0.5]] },
  }); /* (assets 141/143 solids.json: circles [x, z, r] and stand-in boxes [x, y, z, w, h, d] in the model's frame) */
  // what of them stands in the way: each model's circles turned with it (THREE's rotation.y), the rail's two buffers
  const turn = (p, x, z) => { const c = Math.cos(p.yaw); const s = Math.sin(p.yaw); return { x: Math.round((p.x + x * c + z * s) * 1000) / 1000, z: Math.round((p.z - x * s + z * c) * 1000) / 1000 }; };
  const BATCHED = Object.freeze(['stone_blocks', 'work_lamp', 'rope_rail', 'rope_rail_post', 'ore_crate', 'rail_straight_2', 'rail_end']); // (drawn instanced by the page: propBatch)
  const propSolids = () => [...PROPS, ...RAIL.filter((p) => SHAPES[p.model])].flatMap((p) => (SHAPES[p.model]?.c || []).map(([x, z, r]) => ({ ...turn(p, x, z), r, quarryProp: p.model, ...(BATCHED.includes(p.model) ? { batch: true } : {}) })));
  // the waterfall deck's boards and steps (assets 143 walk.json, its own frame): how high over its foot one stands there
  const DECK = Object.freeze({ ...PROPS.find((p) => p.model === 'view_deck'), surfaces: Object.freeze([[-2, 2, -1.5, 1.5, 0.45], [-0.6, 0.6, 1.5, 1.8, 0.45], [-0.6, 0.6, 1.8, 2.1, 0.3], [-0.6, 0.6, 2.1, 2.4, 0.15]]) });
  function deckLift(x, z) { const dx = x - DECK.x; const dz = z - DECK.z; const c = Math.cos(DECK.yaw); const s = Math.sin(DECK.yaw); const lx = dx * c - dz * s; const lz = dx * s + dz * c; for (const [x0, x1, z0, z1, h] of DECK.surfaces) if (lx >= x0 && lx <= x1 && lz >= z0 && lz <= z1) return h; return null; }
  // assets 130: the pickaxe's tip at the hit, in the player's own frame (x right, y up, -z ahead) -- the player stands so it lands on the spot
  const HIT_TIP = Object.freeze([0.08, 0.4, -1.0]);
  const SWING_MS = 1200; const SWINGS = 3; const MINE_MS = 2000 * 3; /* (1.10.342: ROUNDS x ROUND_MS -- the crack-light game) */ const END_MS = 1000;
  const ORE_PER_ROCK = 6; const REGROW_MS = 3 * 3600000; const DAILY = 60; // (사용자 2026-11-17: 하루 60, 바위 6 -- a rock already kept keeps its left till it fills again; 1.10.342: a rock's own fill time by its ore -- regrowOf)
  // 1.10.342 the crack-light game (98B, review-plan §1-8): ROUNDS swings of ROUND_MS; in each one crack lights at `at` ms for the
  // ore's LIGHT (lib/island-ores: 1.0 / 0.8 / 0.6 s) -- the cracks five points on the rock's face toward the miner: [right of the
  // hit, height share of the rock] (the page finds the surface by a ray); a press while lit or GRACE_MS after hits, within BONUS_MS of
  // the light's middle a bonus; HITS_NEEDED of the swings give the ore
  const ROUNDS = 3; const ROUND_MS = 2000; const GRACE_MS = 300; const BONUS_MS = 150; const HITS_NEEDED = 2;
  const CRACKS = Object.freeze([[-0.34, 0.3], [0.34, 0.34], [-0.18, 0.62], [0.22, 0.7], [0, 0.48]].map((c) => Object.freeze(c)));
  const LIGHT = Object.freeze({ 0: 1000, 1: 1000, 2: 800, 3: 600 }); const TIER = Object.freeze({ granite: 0, clay: 0, coal: 1, iron: 1, copper: 1, silver: 2, crystal: 2, gold: 3 });
  const lightOf = (rock) => LIGHT[TIER[rock?.ore] ?? 0];
  const REGROW = Object.freeze({ 0: 3 * 3600000, 1: 3 * 3600000, 2: 6 * 3600000, 3: 12 * 3600000 });
  const regrowOf = (rock) => REGROW[TIER[rock?.ore] ?? 0];
  // the server's plan for a mining: per swing which crack and when it lights (rnd: [0, 1))
  const planOf = (rock, rnd) => Array.from({ length: ROUNDS }, () => ({ spot: Math.floor(rnd() * CRACKS.length) % CRACKS.length, at: 350 + Math.floor(rnd() * 300), light: lightOf(rock) }));
  // the page's presses ([{ spot, ms after its light came on } | null] a swing) judged: hits, bonus hits, done (the ore)
  function judge(plan, taps) {
    let hits = 0; let bonus = 0;
    (plan || []).forEach((r, i) => { const p = Array.isArray(taps) ? taps[i] : null; if (!p || p.spot !== r.spot || !Number.isFinite(p.ms) || p.ms < 0 || p.ms > r.light + GRACE_MS) return; hits += 1; if (Math.abs(p.ms - r.light / 2) <= BONUS_MS) bonus += 1; });
    return { hits, bonus, done: hits >= HITS_NEEDED };
  }
  // 1.10.351 (Codex 341-350 P1): a press as the server got it -- `since` ms after the mining started there. The page's own `ms` (after
  // its light came on) counts only when it fits the server's clock: the server's is later by the trip there and back (0..LAG_MAX), so a
  // list made up from the plan and sent at the end is too late and judged a miss
  // (362 Codex 351-360 P1 #2: within those 2 s the page's `ms` was taken as it said -- a press ~2 s late told as the light's middle was a
  // bonus. Now never earlier than the server's own time less LAG_ALLOW, a trip there and back: a made-up `ms` gains that at most)
  const LAG_MIN = -150; const LAG_MAX = 2000; const LAG_ALLOW = 450;
  function tapAt(plan, k, tap, since) {
    const r = plan?.[k]; if (!r || !tap || !Number.isInteger(tap.spot) || !Number.isFinite(tap.ms) || !Number.isFinite(since)) return null;
    const server = since - k * ROUND_MS - r.at; const lag = server - tap.ms;
    return lag >= LAG_MIN && lag <= LAG_MAX ? { spot: tap.spot, ms: Math.max(tap.ms, server - LAG_ALLOW) } : { spot: tap.spot, ms: null, late: true };
  }
  const PICK_USES = 40; // (a pickaxe: 40 ores)
  // a spot in the world: the surface point, outward, and where to stand (origin = S - R(yaw) HIT_TIP, facing -n)
  function spotOf(rock, stage, i) {
    const s = (rock.kind === 'wall' ? WALL_SPOTS : SPOTS[rock.kind]?.[stage === 'mined' ? 'mined' : 'full'])?.[i]; if (!s) return null;
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
  // 1.10.350 화강암 벽 (사용자 182 C+B, notes island-expansion 끝): the rock wall by the entrance (141 rock_wall_a, painted granite --
  // `rock_wall_a_granite`): three spots along its face toward the quarry (local -Z: the walked side), its plaque on that face above them.
  // Granite only, never empty, outside DAILY; the minigame and the pickaxe's wear as at a rock (a miss: a 작은 돌)
  const WALL_SPOTS = Object.freeze([[-0.9, -0.65, 0, -1], [0, -0.65, 0, -1], [0.9, -0.65, 0, -1]].map((s) => Object.freeze(s)));
  const WALL = (() => { const p = PROPS.find((x) => x.model === 'rock_wall_a_granite'); return Object.freeze({ id: 'wall', kind: 'wall', ore: 'granite', x: p.x, z: p.z, yaw: p.yaw, plaque: Object.freeze({ ...turn(p, 0, -0.68), y: 1.75, yaw: p.yaw }) }); })();
  const rockById = (id) => (id === 'wall' ? WALL : ROCKS.find((r) => r.id === id) || null);
  const spotCount = (rock) => (rock.kind === 'wall' ? WALL_SPOTS.length : SPOTS[rock.kind].full.length);
  // a rock's state at `now` from what is kept { left, minedAt, gen }: full again REGROW_MS after it was mined out
  function rockState(kept, now, rock = null) { const k = kept || {}; const left = Number.isInteger(k.left) ? k.left : ORE_PER_ROCK; if (left <= 0 && Number.isFinite(k.minedAt) && now - k.minedAt >= (rock ? regrowOf(rock) : REGROW_MS)) return { left: ORE_PER_ROCK, gen: now, stage: 'full', regrown: true }; return { left, gen: k.gen || 0, stage: left > 0 ? 'full' : 'mined', minedAt: k.minedAt ?? null }; }
  // the solids round a rock (its circle, turned with it: centred) and the sign's and pile's
  const solidsOf = () => [...ROCKS.map((r) => ({ x: r.x, z: r.z, r: SOLIDS[r.kind].r, quarry: r.id })), { x: SIGN.x, z: SIGN.z, r: SOLIDS.sign.r }, { x: PILE.x, z: PILE.z, r: SOLIDS.pile.r }, ...propSolids()];
  return { WALL, WALL_SPOTS, AREA, inArea, edgeDist, po, WALK, ROCKS, SIGN, PILE, SPOTS, SOLIDS, PROPS, RAIL, SHAPES, BATCHED, DECK, deckLift, HIT_TIP, SWING_MS, SWINGS, MINE_MS, END_MS, ORE_PER_ROCK, REGROW_MS, DAILY, PICK_USES, ROUNDS, ROUND_MS, GRACE_MS, BONUS_MS, HITS_NEEDED, CRACKS, lightOf, regrowOf, planOf, judge, tapAt, LAG_MIN, LAG_MAX, LAG_ALLOW, spotOf, standOf, rockById, spotCount, rockState, solidsOf, turn };
}));
