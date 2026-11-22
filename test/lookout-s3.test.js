'use strict';
// 1.10.415 S3 전망대 돌담 마당 (사용자 결정 72 4 A, 검토 notes docs/safe-zones-visible-20261122.md §2-3, assets 175): 31 stone pieces round the
// peak, a pillar at each piece's +x end on the joint to the next; a stone wicket on each of the trail's two crossings; the safe round 11.9 m
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain.js'); require('../public/plaza/island-train.js');
const P = require('../public/plaza/isle2-props.js');
const Tg = require('../lib/island-tigers');
const D = T.dalmaru; const K = D?.NEW_ISLE?.peak;
const ring = () => P.FENCE.filter((f) => /^fence_(stonewall_tall|wicket_stone)$/.test(P.FENCE_KINDS[f[3]]));

test('S3 돌담 마당: 31칸 11.84 m, 칸 사이 2.4 ± 0.05, 안쪽이 봉우리, 기둥(+x)이 다음 칸 이음 위, 쪽문 둘은 오솔길 위', { skip: !D && '달마루섬 전용' }, () => {
  const R = ring(); assert.equal(R.length, 31); assert.equal(K.safe, 11.9);
  for (let i = 0; i < R.length; i += 1) { const [x, z, yaw] = R[i]; const [nx, nz, nyaw] = R[(i + 1) % R.length]; const g = Math.hypot(nx - x, nz - z); assert.ok(Math.abs(g - 2.4) <= 0.05, `${i}: ${g}`);
    assert.ok((K.x - x) * Math.sin(yaw) + (K.z - z) * Math.cos(yaw) > 11.7, `${i}: +Z to the peak`);
    /* (the pillar at +x 1.2 -- on the joint: within 6 cm of the next piece's -x end) */
    const px = x + Math.cos(yaw) * 1.2; const pz = z - Math.sin(yaw) * 1.2; const qx = nx - Math.cos(nyaw) * 1.2; const qz = nz + Math.sin(nyaw) * 1.2; assert.ok(Math.hypot(px - qx, pz - qz) < 0.06, `${i}: pillar on the joint ${Math.hypot(px - qx, pz - qz)}`); }
  const W = R.filter((f) => P.FENCE_KINDS[f[3]] === 'fence_wicket_stone'); assert.equal(W.length, 2);
  for (const [x, z] of [[381.8, 215.7], [403.7, 206.7]]) assert.ok(W.some((w) => Math.hypot(w[0] - x, w[1] - z) < 0.6), `${x},${z}`);
  for (const [x, z, yaw] of W) for (const u of [-0.6, 0, 0.6]) assert.ok(T.walkDist(x + Math.cos(yaw) * u, z - Math.sin(yaw) * u) < 0, `wicket ${x},${z} at ${u}: on the trail`);
});

test('S3 돌담 쪽문: 사람(몸 0.3)은 지나가고 호랑이 가슴은 못 지나감, 쪽문 밖은 호랑이 땅, 마당 안은 안전', { skip: !D && '달마루섬 전용' }, () => {
  const W = ring().filter((f) => P.FENCE_KINDS[f[3]] === 'fence_wicket_stone'); const solids = P.solids();
  const g = Tg.createTigers({ T, P, rand: () => 0.5 });
  for (const [x, z, yaw] of W) {
    const at = (u, v) => [x + Math.cos(yaw) * u + Math.sin(yaw) * v, z - Math.sin(yaw) * u + Math.cos(yaw) * v];
    for (let v = -1.5; v <= 1.5; v += 0.1) { const [px, pz] = at(0, v); const near = Math.min(...solids.map((o) => Math.hypot(o.x - px, o.z - pz) - o.r)); assert.ok(near >= 0.3, `${x},${z}: a person through at ${v.toFixed(1)} (${near.toFixed(2)})`); }
    assert.ok(!T.isle2Clear(...at(0, 0), 0.9), 'no tiger\'s chest');
    assert.equal(g.huntable(...at(0, -3)), true, '3 m out: the tigers\''); assert.equal(g.huntable(...at(0, 1.5)), false, 'inside: safe');
  }
  for (const a of [0, 1, 2, 3, 4, 5]) { assert.equal(g.huntable(K.x + Math.cos(a) * 11.5, K.z + Math.sin(a) * 11.5), false, `11.5 m at ${a}`); }
});

test('S3 돌담 위에 다른 것 없음(자연물 · 가로등 · 우레 바위)', { skip: !D && '달마루섬 전용' }, () => {
  const rc = ring().flatMap((f) => P.circlesAt(P.FENCE_KINDS[f[3]], f[0], f[1], f[2])); const own = new Set(rc.map((c) => `${c.x.toFixed(3)},${c.z.toFixed(3)}`));
  const others = [...T.natureSolids(), ...T.structureSolids(), ...T.villageSolids()].filter((o) => !own.has(`${o.x.toFixed(3)},${o.z.toFixed(3)}`));
  assert.deepEqual(others.filter((o) => rc.some((c) => Math.hypot(c.x - o.x, c.z - o.z) < c.r + (o.r || 0) + 0.2)).map((o) => [o.x, o.z]), []);
});
