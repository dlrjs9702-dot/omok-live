const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain.js');
const P = require('../public/plaza/island-pilot.js');

// v1.10.310 잡초 편입: a weed's look from its place -- the same each time, broad leaves the most, ferns the fewest (60 : 30 : 10)
test('잡초 모양: 자리로 정해지고 넓은 잎 60 · 풀포기 30 · 고사리 10 안팎', () => {
  assert.equal(P.weedKind(12.5, -40.25), P.weedKind(12.5, -40.25));
  const n = { broad: 0, tuft: 0, fern: 0 }; for (let i = 0; i < 4000; i += 1) n[P.weedKind((i % 97) * 3.1 - 150, Math.floor(i / 97) * 4.7 - 100)] += 1;
  assert.ok(Math.abs(n.broad / 4000 - 0.6) < 0.05 && Math.abs(n.tuft / 4000 - 0.3) < 0.05 && Math.abs(n.fern / 4000 - 0.1) < 0.04, JSON.stringify(n));
  assert.deepEqual(P.IDS, ['grass_broad', 'grass_tuft', 'bush_fern', 'mushroom_red', 'mushroom_brown']);
});

// v1.10.284 G1 땅과 풀, 섬 전체: where grass grows (the ground maps' values), the cells round a point, a cell's blades the same
// each time and evenly thinner when fewer are shown
test('G1 섬 전체 풀: 지도 값으로 풀 자리(길·자갈·맨땅·모래·바위·바닷가 없음, 숲 바닥 얇게), 칸 계산, 칸마다 같은 풀잎', () => {
  const lawn = { path: 0, gravel: 0, bare: 0, sand: 0, rock: 0, forest: 0, shore: 255 };
  assert.equal(P.grassFrom(lawn), 1);
  for (const [k, v] of [['path', 128], ['path', 70], ['gravel', 200], ['bare', 200], ['sand', 255], ['rock', 200], ['shore', 140]]) assert.equal(P.grassFrom({ ...lawn, [k]: v }), 0, `${k} ${v}`);
  assert.equal(P.grassFrom({ ...lawn, path: 40 }), 1, '길 가장자리에서 반 미터 넘게'); assert.ok(Math.abs(P.grassFrom({ ...lawn, forest: 255 }) - 0.35) < 1e-9, '숲 바닥은 얇게');
  // the cells: any part within r, nearest first; 16 m cells round the origin within 25 m -- the four touching it first
  const c = P.cellsNear(0, 0, 25); assert.ok(c.every((x) => x.d <= 25)); assert.deepEqual(c.map((x) => x.d), c.map((x) => x.d).slice().sort((a, b) => a - b));
  assert.deepEqual(c.slice(0, 4).map((x) => [x.i, x.j]).sort(), [[-1, -1], [-1, 0], [0, -1], [0, 0]]); assert.equal(c.length, 16);
  assert.deepEqual(P.cellsNear(3, 3, 0).map((x) => [x.i, x.j]), [[0, 0]], '서 있는 칸');
  assert.equal(P.cellsNear(0, 0, 45).length, 32, 'PC 45 m: 6×6에서 먼 네 모서리 뺀 32칸');
  // a cell's blades: the same each time, all in the cell, none where thick() says no grass, half of them over the whole cell
  const no = (x, z) => (x > 8 && x < 10 ? 0 : 1); const a = P.cellBlades(0, 0, 2000, no); assert.deepEqual(P.cellBlades(0, 0, 2000, no), a);
  assert.ok(a.length > 1500 && a.every((g) => g.x >= 0 && g.x < 16 && g.z >= 0 && g.z < 16 && !(g.x > 8 && g.x < 10)), 'in its cell, none on the walk');
  const half = a.slice(0, a.length / 2); for (const q of [[0, 8, 0, 8], [8, 16, 0, 8], [0, 8, 8, 16], [8, 16, 8, 16]]) assert.ok(half.filter((g) => g.x >= q[0] && g.x < q[1] && g.z >= q[2] && g.z < q[3]).length > half.length / 6, `half spread ${q}`);
  assert.notDeepEqual(P.cellBlades(1, 0, 50, () => 1).map((g) => g.x - 16), P.cellBlades(0, 0, 50, () => 1).map((g) => g.x), '칸마다 다른 씨앗');
});

test('풀 서서히: 단계를 바꾸면 1.5초 동안 그 사이 풀잎 높이가 0과 1 사이, 걸으며 조금 바뀌면 바로', () => {
  const g = { from: 0, to: 0, t: 1 }; let r = P.growStep(g, 1000, 16, 1000); assert.equal(r.count, 1000); assert.equal(r.lo, 0); assert.ok(r.s > 0 && r.s < 0.02); /* (a cell in: grows from nothing) */
  for (let ms = 16; ms < P.GROW_MS; ms += 16) r = P.growStep(g, 1000, 16, 1000); assert.deepEqual(r, { count: 1000, lo: 1000, s: 0 }); /* (grown: no band) */
  r = P.growStep(g, 350, 500, 1000); assert.equal(r.count, 1000); assert.equal(r.lo, 350); assert.ok(r.s > 0 && r.s < 1, 'half a second after a tier change'); /* (「중간」: 650 laid down) */
  r = P.growStep(g, 340, 1000, 1000); assert.equal(r.count, 340); assert.equal(g.to, 340); /* (a small change midway kept the band; done at 1.5 s) */
  r = P.growStep(g, 330, 16, 1000); assert.deepEqual(r, { count: 330, lo: 330, s: 0 }); /* (walking: at once) */
  r = P.growStep(g, 0, 750, 1000); assert.equal(r.count, 330); assert.ok(Math.abs(r.s - 0.5) < 1e-9); r = P.growStep(g, 0, 750, 1000); assert.equal(r.count, 0); /* (out of reach: laid down, then none) */
});
