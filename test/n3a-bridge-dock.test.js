'use strict';
// 1.10.389 N3-a (notes docs/n3-plan-20261120.md §4-1, 사용자 27A·37-3, assets 133): the high east 윤슬다리 -- 56 m at its own length, 7 m over
// the sea, its ends eased onto the banks, its ramps' sides over land walled; the crossings and the stationmaster off it, the taxi's box
// with it; 별마루섬 부두 walked on from its float to its gate, the gate's 12 m the tigers' safe ground
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain.js'); require('../public/plaza/island-train.js');
const X = require('../public/plaza/island-taxi.js');
const P = require('../public/plaza/isle2-props.js');
const Tg = require('../lib/island-tigers');
const D = T.dalmaru; const SEA = D.SEA ?? -0.6;
const E = T.bridges.find((b) => b.high);

test('N3-a 높은 윤슬다리: 56 m 제 길이, 가운데 바다 위 7 m 안팎, 배 길 밑 4.5 m 넘음, 양끝은 땅과 이어짐(턱 없음), 끝 내리막도 0.45 넘지 않음', { skip: !T.dalmaru && '달마루섬 전용' }, () => {
  assert.ok(E, 'the east bridge is the high one'); assert.equal(E.model, 'dalmaru.bridge_yunseul_wide'); assert.equal(E.w, 7.8); assert.equal(E.guard, 4.35); /* (1.10.407 assets 170: the wide one in 133's place) */ assert.equal(E.half, 28); assert.equal(E.x, 59.35); assert.equal(E.z, 140);
  const mid = T.deckAt({ b: E, u: 0 }); assert.ok(mid - SEA > 6.9 && mid - SEA < 7.2, `middle ${mid - SEA}`);
  for (const u of [-6, 0, 6]) assert.ok(T.deckAt({ b: E, u }) - 0.96 - SEA > 4.5, 'the boats\' lane: its underside 0.96 under the planks (assets 133: 5.06 over the sea at the model\'s base)');
  for (const [u, x] of [[-E.half, E.x - E.half], [E.half, E.x + E.half]]) { const off = x + Math.sign(u) * 0.3; assert.ok(Math.abs(T.deckAt({ b: E, u }) - T.heightAt(off, E.z)) < 0.12, `end ${x}: ${T.deckAt({ b: E, u })} vs ${T.heightAt(off, E.z)}`); }
  for (let u = -E.half; u < E.half; u += 0.25) { const a = T.deckAt({ b: E, u }); const b = T.deckAt({ b: E, u: u + 0.25 }); assert.ok(Math.abs(b - a) / 0.25 <= 0.45 + 1e-6, `slope at ${u}: ${(b - a) / 0.25}`); }
  for (let u = -E.half; u <= E.half; u += 1) assert.ok(Math.abs(T.heightAt(E.x + u, E.z) - T.deckAt({ b: E, u })) < 1e-6, `walked on it at ${u}`);
  const west = T.bridges.find((b) => !b.high && !b.isle2 && b.model && b.x < 0); assert.equal(west.half, 21, 'the west one as it was');
});

test('N3-a 비탈 옆 막기: 판이 옆 땅보다 0.4 m 넘게 높은 곳은 양옆이 막힘, 판 위 걷는 폭은 그대로, 건널목·찻길 쪽 길은 안 막음', { skip: !T.dalmaru && '달마루섬 전용' }, () => {
  const guards = T.structureSolids().filter((o) => o.guard); assert.ok(guards.length > 40, `${guards.length}`);
  for (const g of guards) { const v = g.z - E.z; assert.ok(Math.abs(v) - g.r >= 2.8, 'off its walk'); assert.equal(T.onBridge(g.x, g.z), null); }
  // walking in from the side: no land cell beside a ramp where the planks stand 0.9 m and more over it is left open (a body 0.3)
  let open = [];
  for (let u = -E.half; u <= E.half; u += 0.25) for (const s of [-1, 1]) { const x = E.x + u; const z = E.z + s * (E.w / 2 + 0.15); /* (407: just past the wide one's 3.9 m walk) */ if (!T.walkable(x, z) || T.deckAt({ b: E, u }) - T.ground(x, z) < 0.9) continue; if (!guards.some((g) => Math.hypot(g.x - x, g.z - z) < g.r + 0.3)) open.push([x, z]); }
  assert.deepEqual(open, []);
  for (const c of X.CROSSINGS) assert.ok(guards.every((g) => Math.hypot(g.x - c.x, g.z - c.z) > (X.CROSS_CLEAR ?? 5)), `crossing ${c.x},${c.z}`);
});

test('N3-a 택시·건널목·역장: 다리 상자 31~88, 다리 끝 건널목 둘은 끝에서 5 m 밖, 역장은 다리·낚시꾼·찻길에서 떨어짐', { skip: !T.dalmaru && '달마루섬 전용' }, () => {
  const B = X.BRIDGE || null; if (B) { assert.ok(B.x0 <= E.x - E.half && B.x1 >= E.x + E.half); }
  const ends = [[E.x - E.half, E.z], [E.x + E.half, E.z]];
  for (const c of X.CROSSINGS) assert.ok(ends.every(([x, z]) => Math.hypot(c.x - x, c.z - z) >= 5) && !T.onBridge(c.x, c.z), `crossing ${c.x},${c.z}`);
  const s = D.PLACES.stationmaster; const f = D.PLACES.quests.fisher;
  assert.ok(Math.abs(s.z - E.z) - 2.8 >= 2 || Math.abs(s.x - E.x) - E.half >= 2, 'off the bridge\'s side'); assert.ok(Math.hypot(s.x - f.x, s.z - f.z) >= 3, 'off the fisher'); assert.ok(T.roadDist(s.x, s.z) >= X.ROAD.half + 1, 'off the road'); assert.ok(T.walkable(s.x, s.z));
});

test('N3-a 별마루섬 부두: 뜬 판에서 건널판·계단을 지나 부두 문까지 끊김 없이 걸음, 문 12 m는 호랑이가 안 들어가고 안 쫓음', { skip: !T.dalmaru && '달마루섬 전용' }, () => {
  const K = T.DOCK2; assert.ok(K); assert.equal(K.root.yaw, -Math.PI / 2); assert.equal(T.STRUCTURES.dock2.x, K.x);
  assert.ok(Math.abs(T.heightAt(K.x, K.z) - (-0.2)) < 1e-9, 'its float'); assert.ok(T.heightAt(K.x, K.z) > SEA, 'over the sea');
  const gate = P.FENCE.filter((a) => P.FENCE_KINDS[a[3]] === 'fence_gate')[0]; assert.ok(gate); /* (1.10.394: 별마루다리's the wide one now -- the people's gate the dock's alone) */
  const solids = [...T.natureSolids(), ...T.structureSolids(), ...P.solids()];
  let prev = T.heightAt(K.x, K.z);
  for (let x = K.x; x <= gate[0] + 2; x += 0.25) { assert.ok(T.walkable(x, K.z), `walkable ${x}`); const h = T.heightAt(x, K.z); assert.ok(Math.abs(h - prev) < 0.4, `step at ${x}: ${prev} -> ${h}`); prev = h;
    assert.ok(solids.every((o) => Math.hypot(o.x - x, o.z - K.z) >= o.r + 0.3), `blocked at ${x}`); }
  let seed = 5; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const g = Tg.createTigers({ T, P, rand }); g.warm();
  for (const [dx, dz] of [[0, 0], [6, 0], [8, 6], [11, -3]]) assert.equal(g.huntable(gate[0] + dx, gate[1] + dz), false, `${dx},${dz}`);
});

/* (1.10.408 assets 171, 검토 docs/gate-sill-171-20261122.md: 별마루다리 7.8 m, its ends level across (their ramps kept), and by the road gate no sill --
   walked from each end's planks 1 m onto the ground, every 0.1 m within 4 cm, all across the walk) */
test('171 넓은 별마루다리: 7.8 m 제 길이 모델, 양 끝 폭 방향 평평, 문 쪽 끝 턱 없음(0.1 m마다 4 cm 안)', { skip: !T.dalmaru && '달마루섬 전용' }, () => {
  const B = T.bridges.find((b) => b.isle2); assert.equal(B.model, 'byeolmaru.bridge_byeolmaru_wide'); assert.equal(B.w, 7.8); assert.equal(B.guard, 4.35); assert.ok(B.ownLength && B.lane);
  const steps = []; let lean = 0;
  for (const s of [-1, 1]) { const ex = B.x + s * B.half; const hs = [];
    for (let v = -3.9; v <= 3.9 + 1e-9; v += 0.1) { const z = B.z + v; let prev = T.deckAt({ b: B, u: s * B.half }); for (let d = 0.1; d <= 1 + 1e-9; d += 0.1) { const h = T.heightAt(ex + s * d, z); if (Math.abs(h - prev) > 0.04) steps.push(`${(ex + s * d).toFixed(1)},${z.toFixed(1)}: ${(h - prev).toFixed(3)}`); prev = h; } hs.push(T.heightAt(ex + s * 0.3, z)); }
    if (s < 0) lean = Math.max(...hs) - Math.min(...hs); }
  assert.deepEqual(steps, []); assert.ok(lean < 0.02, `west end across ${lean}`);
});
