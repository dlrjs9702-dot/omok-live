'use strict';
// 사용자 결정 86 별마루섬 택시 종점 마당 (notes docs/terminal-yard-20261123.md, 검토): the island's outer fence joined to the camp's palisade by
// three runs of the tall palisade (15 pieces, a people's wicket on the walk to the dock); the yard inside safe on the server and the screens alike;
// and the cars' way into their places there kept off every fence (검토 §4-2: it went through the camp's palisade)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
globalThis.GC_ISLAND_MAP = globalThis.GC_ISLAND_MAP || 'dalmaru';
const T = require('../public/plaza/island-terrain.js'); require('../public/plaza/island-train.js');
const P = require('../public/plaza/isle2-props.js'); const X = require('../public/plaza/island-taxi.js');
const Tg = require('../lib/island-tigers');
const D = T.dalmaru; const I = D?.NEW_ISLE;
const YARD = [[226.2, 243.29], [228.65, 243.19], [231.09, 243.09], [233.54, 243], [235.99, 242.9], [249.16, 227.97], [248, 225.86], [246.83, 223.75],
  [245.1, 222.33], [242.81, 221.58], [240.51, 220.84], [238.22, 220.09], [235.92, 219.35], [233.63, 218.6], [231.33, 217.86]];
const yardPieces = () => YARD.map(([x, z]) => P.FENCE.find((f) => Math.hypot(f[0] - x, f[1] - z) < 0.01));

test('결정 86 마당 목책: 15칸(높은 목책 14 + 부두 길 쪽문 1), 서로 · 있는 목책과 호랑이가 못 지나게 이어짐', { skip: !I && '달마루섬 전용' }, () => {
  const ps = yardPieces(); assert.ok(ps.every(Boolean), 'all 15 in FENCE');
  assert.deepEqual(ps.map((f) => P.FENCE_KINDS[f[3]]).filter((k) => k === 'fence_wicket').length, 1); assert.equal(P.FENCE_KINDS[ps[9][3]], 'fence_wicket');
  const [x, z, yaw] = ps[9]; for (const u of [-0.6, 0, 0.6]) assert.ok(T.walkDist(x + Math.cos(yaw) * u, z - Math.sin(yaw) * u) < 0.1, `the wicket on its walk at ${u}`);
  /* (every piece's two ends: no tiger's chest (0.9) fits between it and its neighbour -- in a run, and at the four joins to standing fences) */
  const ends = (f) => [[f[0] - Math.cos(f[2]) * 1.2, f[1] + Math.sin(f[2]) * 1.2], [f[0] + Math.cos(f[2]) * 1.2, f[1] - Math.sin(f[2]) * 1.2]];
  for (const f of ps) for (const [ex, ez] of ends(f)) assert.ok(!T.isle2Clear(ex, ez, 0.9), `${f[0]},${f[1]}: a tiger at its end`);
});

test('결정 86 마당 안전: 서버 · 화면이 같은 다각형 -- 마당 안 쫓길 곳 0 · 호랑이 땅 0, 목책 밖은 그대로', { skip: !I && '달마루섬 전용' }, () => {
  assert.equal(I.yard.length, 7);
  for (const f of ['lib/island-tigers.js', 'public/plaza/tigers-view.js']) assert.match(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), /\.yard/, f);
  const g = Tg.createTigers({ T, P, rand: () => 0.5 }); g.warm();
  let inside = 0; let chased = 0; let ground = 0;
  for (let x = 222; x <= 252; x += 0.5) for (let z = 215; z <= 246; z += 0.5) { if (!Tg.inPoly(I.yard, x, z) || !T.onIsle2(x, z)) continue; inside += 1; if (g.huntable(x, z)) chased += 1; if (g.open(x, z)) ground += 1; }
  assert.ok(inside > 1000, `${inside} cells`); assert.equal(chased, 0); assert.equal(ground, 0);
  /* (just outside the south-east run, away from the gates' rounds: still the tigers' -- the yard did not grow past its fence) */
  const out = [[243.5, 215.5], [252.5, 222.5]].filter(([x, z]) => !P.FENCE.some((f) => /^fence_gate/.test(P.FENCE_KINDS[f[3]]) && Math.hypot(f[0] - x, f[1] - z) < 16));
  assert.ok(out.length > 0); for (const [x, z] of out) assert.equal(Tg.inPoly(I.yard, x, z), false, `${x},${z}`);
});

test('결정 86 종점 차 길: 자리 0 · 1, 손님 태우고 와서 · 빈 차로 돌아와서 -- 도는 동안 울타리와 1 m 넘게, 쉼터와 0.3 m 넘게', { skip: !I && '달마루섬 전용' }, () => {
  const s = X.stopOf('head'); const pieces = P.FENCE.filter((f) => Math.hypot(f[0] - s.x, f[1] - s.z) < 30 && P.FENCE_KINDS[f[3]] !== 'fence_gate_road')
    .map((f) => { const c = Math.cos(f[2]); const n = Math.sin(f[2]); return [[f[0] - c * 1.2, f[1] + n * 1.2], [f[0] + c * 1.2, f[1] - n * 1.2]]; });
  const segD = (x, z, p, q) => { const dx = q[0] - p[0]; const dz = q[1] - p[1]; const t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (z - p[1]) * dz) / (dx * dx + dz * dz || 1e-9))); return Math.hypot(x - p[0] - dx * t, z - p[1] - dz * t); };
  const box = (p) => { const out = []; const a = Math.sin(p.yaw); const b = Math.cos(p.yaw); for (let u = -1.6; u <= 1.601; u += 0.2) for (const v of [-0.85, 0, 0.85]) out.push([p.x + a * u + b * v, p.z + b * u - a * v]); return out; };
  const sh = s.shelter; const shD = (x, z) => { const c = Math.cos(sh.yaw); const n = Math.sin(sh.yaw); const lx = (x - sh.x) * c - (z - sh.z) * n; const lz = (x - sh.x) * n + (z - sh.z) * c; return Math.hypot(Math.max(0, Math.abs(lx) - 1.45), Math.max(0, Math.abs(lz) - 0.7)); };
  for (const park of [0, 1]) for (const ride of [{ from: 'isle', to: 'head', startedAt: 0, stay: true, park }, { from: 'head', to: 'isle', startedAt: 0, stay: false, park }]) {
    const t0 = ride.stay ? X.durationOf(ride) - 4000 : 0; const t1 = X.backOf(ride, 0) + 100; let fMin = Infinity; let sMin = Infinity; let seen = 0;
    for (let t = t0; t <= t1; t += 50) { const p = X.carAt(ride, t); if (!p || Math.hypot(p.x - s.x, p.z - s.z) > 14) continue; seen += 1;
      for (const [x, z] of box(p)) { for (const [a, b] of pieces) fMin = Math.min(fMin, segD(x, z, a, b)); sMin = Math.min(sMin, shD(x, z)); } }
    const name = `place ${park}, ${ride.stay ? 'arriving' : 'back home'}`; assert.ok(seen > 20, name); assert.ok(fMin > 1, `${name}: ${fMin.toFixed(2)} m off a fence`); assert.ok(sMin > 0.3, `${name}: ${sMin.toFixed(2)} m off the shelter`);
  }
  for (const k of [0, 1]) { const end = X.parkPose('head', k, 1); const q = X.placeOf('head', k); assert.ok(Math.hypot(end.x - q.x, end.z - q.z) < 1e-6 && Math.abs(Math.sin(end.yaw - q.yaw)) < 1e-6 && Math.cos(end.yaw - q.yaw) > 0, `into place ${k} front first`); }
  { const d = X.dropOf('head'); const p = X.parkPose('head', 0, 0); assert.ok(Math.hypot(p.x - d.x, p.z - d.z) < 1e-6 && Math.cos(p.yaw - d.yaw) > 0.999, 'from the drop as it faces'); }
});

test('결정 86 마당 목책 위에 다른 것 없음(줄 위 자연물 비킴)', { skip: !I && '달마루섬 전용' }, () => {
  const rc = yardPieces().flatMap((f) => P.circlesAt(P.FENCE_KINDS[f[3]], f[0], f[1], f[2]));
  const own = new Set(P.FENCE.filter((f) => /^fence_/.test(P.FENCE_KINDS[f[3]])).flatMap((f) => P.circlesAt(P.FENCE_KINDS[f[3]], f[0], f[1], f[2])).map((c) => `${c.x.toFixed(3)},${c.z.toFixed(3)}`));
  const others = [...T.natureSolids(), ...T.structureSolids(), ...T.villageSolids()].filter((o) => !own.has(`${o.x.toFixed(3)},${o.z.toFixed(3)}`));
  assert.deepEqual(others.filter((o) => rc.some((c) => Math.hypot(c.x - o.x, c.z - o.z) < c.r + (o.r || 0) + 0.2)).map((o) => [o.x, o.z]), []);
});
