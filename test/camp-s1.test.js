'use strict';
// 1.10.413 S1 캠핑장 높은 목책 + 쪽문 넷 (사용자 결정 72, 검토 notes docs/safe-zones-visible-20261122.md §2-1 · §3, assets 174): the camp ringed by a
// palisade taller than the tigers, a people's wicket on each walk in -- 1.2 m between its posts, a tiger 1.5 ~ 1.8 m across; the safe round the same
// 22.9 m on the server and the screens, read from the island's own data; no 12 m round a wicket (one is safe only once inside)
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain.js'); require('../public/plaza/island-train.js');
const P = require('../public/plaza/isle2-props.js');
const Tg = require('../lib/island-tigers');
const D = T.dalmaru; const C = D?.NEW_ISLE?.camp;
const ring = () => P.FENCE.filter((f) => /^fence_(palisade_tall|wicket)$/.test(P.FENCE_KINDS[f[3]]));

test('S1 캠핑장 목책: 60칸 고리 22.9 m, 칸 사이 2.4 ± 0.05 m, 안쪽(+Z)이 가운데, 쪽문 넷은 들어오는 길 위', { skip: !D && '달마루섬 전용' }, () => {
  const R = ring(); assert.equal(R.length, 60); assert.equal(C.safe, 22.9); assert.equal(C.ring.r, 22.9);
  for (let i = 0; i < R.length; i += 1) { const [x, z, yaw] = R[i]; const [nx, nz] = R[(i + 1) % R.length]; const g = Math.hypot(nx - x, nz - z); assert.ok(Math.abs(g - 2.4) <= 0.05, `${i}: ${g}`);
    assert.ok(Math.abs(Math.hypot(x - C.x, z - C.z) - 22.9) < 0.02); const inX = Math.sin(yaw); const inZ = Math.cos(yaw); assert.ok((C.x - x) * inX + (C.z - z) * inZ > 22.8, `${i}: +Z to the camp`); }
  const W = R.filter((f) => P.FENCE_KINDS[f[3]] === 'fence_wicket'); assert.equal(W.length, 4);
  for (const [x, z, yaw] of W) for (const u of [-0.6, 0, 0.6]) { const px = x + Math.cos(yaw) * u; const pz = z - Math.sin(yaw) * u; assert.ok(T.walkDist(px, pz) < 0.1, `wicket ${x},${z} at ${u}: on its walk`); }
  /* (each walk in -- 검토 §1-2's four: 별마루다리 쪽, 부두 쪽, 전망대 가는 길, 숲 둘레길) */
  for (const [x, z] of [[240.4, 236.7], [246.7, 230.6], [279.1, 238.9], [275.3, 266.2]]) assert.ok(W.some((w) => Math.hypot(w[0] - x, w[1] - z) < 1.2), `${x},${z}`);
});

test('S1 쪽문: 사람(몸 0.3)은 지나가고 호랑이(가슴 0.9씩)는 못 지나감, 문 둘레 12 m 규칙 없음 — 안으로 들어와야 안전', { skip: !D && '달마루섬 전용' }, () => {
  const W = ring().filter((f) => P.FENCE_KINDS[f[3]] === 'fence_wicket'); const solids = P.solids();
  let seed = 7; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const g = Tg.createTigers({ T, P, rand }); g.warm();
  for (const [x, z, yaw] of W) {
    const at = (u, v) => [x + Math.cos(yaw) * u + Math.sin(yaw) * v, z - Math.sin(yaw) * u + Math.cos(yaw) * v];
    for (let v = -1.5; v <= 1.5; v += 0.1) { const [px, pz] = at(0, v); const near = Math.min(...solids.map((o) => Math.hypot(o.x - px, o.z - pz) - o.r)); assert.ok(near >= 0.3, `${x},${z}: a person through at ${v.toFixed(1)} (${near.toFixed(2)})`); }
    { const [px, pz] = at(0, 0); assert.ok(!T.isle2Clear(px, pz, 0.9), 'a tiger\'s chest does not fit'); }
    /* (3 m out the tigers' -- unless a fence gate's own round reaches there: the west wicket 16.5 m from the road gate, its 16 m (검토 §3 「0.3 m」)) */
    const [ox, oz] = at(0, -3); const byGate = P.FENCE.some((f) => /^fence_gate/.test(P.FENCE_KINDS[f[3]]) && Math.hypot(f[0] - ox, f[1] - oz) < 16);
    assert.equal(g.huntable(ox, oz), !byGate && T.onIsle2(ox, oz) && D.newIsleCoast(ox, oz) > 4, `${x},${z}: 3 m out -- no safe round outside a wicket`);
    const [ix, iz] = at(0, 1.5); assert.equal(g.huntable(ix, iz), false, 'inside: safe');
  }
});

test('S1 안전 반지름 한 곳: 서버 · 화면 모두 섬 자료의 safe(캠핑장 22.9, 전망대 14)를 읽음', { skip: !D && '달마루섬 전용' }, () => {
  const fs = require('node:fs'); const path = require('node:path');
  for (const f of ['lib/island-tigers.js', 'public/plaza/tigers-view.js']) { const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8'); assert.match(src, /camp\.safe \?\?/, f); assert.match(src, /peak\.safe \?\?/, f); }
  const g = Tg.createTigers({ T, P, rand: () => 0.5 });
  for (const a of [0, 1, 2, 3, 4, 5]) { const at = (r) => [C.x + Math.cos(a) * r, C.z + Math.sin(a) * r]; assert.equal(g.huntable(...at(22.5)), false, `22.5 m at ${a}`); }
  assert.equal(D.NEW_ISLE.peak.safe, 11.9); /* (1.10.415 S3: the lookout's yard, 14 -> 11.9) */
});

test('S1 목책 위에 다른 것 없음: 자연물 · 가로등은 비킴(가로등은 안 · 밖 1.6 m, 길 밖)', { skip: !D && '달마루섬 전용' }, () => {
  const R = ring(); const rc = R.flatMap((f) => P.circlesAt(P.FENCE_KINDS[f[3]], f[0], f[1], f[2])); const own = new Set(rc.map((c) => `${c.x.toFixed(3)},${c.z.toFixed(3)}`));
  const others = [...T.natureSolids(), ...T.structureSolids(), ...T.villageSolids()].filter((o) => !own.has(`${o.x.toFixed(3)},${o.z.toFixed(3)}`));
  assert.deepEqual(others.filter((o) => rc.some((c) => Math.hypot(c.x - o.x, c.z - o.z) < c.r + (o.r || 0) + 0.2)).map((o) => [o.x, o.z]), []);
  for (const p of T.nature().lampSpots) { const d = Math.hypot(p.x - C.x, p.z - C.z); assert.ok(Math.abs(d - C.ring.r) >= 1.5, `lamp ${p.x},${p.z} at ${d}`); }
});
