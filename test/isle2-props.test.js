'use strict';
// 1.10.375 N2a-1 별마루섬's still pieces (notes island-expansion 「별마루섬 호랑이」; public/plaza/isle2-props.js made by tools/isle2-props.cjs): the
// file is what the tool makes; the fence goes round (one gate, on the walk from 별마루다리, a body's lane through it); nothing that blocks
// stands on a walk; the swamps keep off the walks, the camp and the peak, a bike inside one is slowed; nature keeps off every piece
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const T = require('../public/plaza/island-terrain.js'); require('../public/plaza/island-train.js');
const P = require('../public/plaza/isle2-props.js');

test('별마루섬 소품 자료: 도구가 만든 그대로', () => {
  execFileSync(process.execPath, [path.join(__dirname, '..', 'tools/isle2-props.cjs'), '--check'], { stdio: 'pipe' });
});

test('별마루섬 목책·문·늪·캠핑장: 문은 다리 길 위 하나(지나갈 틈), 막는 것은 길 밖, 늪은 길·캠핑장·봉우리 밖, 자연물은 비켜 섬', () => {
  const D = T.dalmaru; const I = D.NEW_ISLE;
  // the fence: 2.4 m pieces most of the way round (cliffs and the creek's mouth left), one gate on the walk from 별마루다리
  // (1.10.389 N3-a: and the 부두 문, the piece before 별마루섬 부두's gangway -- notes n3-plan §3-3 #194)
  assert.ok(P.FENCE.length > 320, `${P.FENCE.length}`); const gates = P.FENCE.filter((f) => /^fence_gate/.test(P.FENCE_KINDS[f[3]])); assert.equal(gates.length, 2);
  const [gx, gz, gyaw] = gates[0]; assert.ok(T.walkDist(gx, gz) < 0, '문은 길 위'); assert.ok(Math.hypot(gx - 196, gz - 226) < 40, '별마루다리 쪽');
  // (1.10.394 N4-c, assets 163: 별마루다리's the wide gate -- 7.2 m, in the old three pieces' place: its neighbours 4.8 m off its middle, a car
  // (1.7 m wide) through its middle 2.4 m clear of every post)
  // (1.10.408 assets 171, 결정 67-1 A: the road gate -- 12 m, in five pieces' place: its neighbours 7.2 m off its middle (their ends within 6 cm of
  // its wings' ±6.0), a car in either lane (centres lx -1.55 / +0.83 over the bridge's) clear of the car gate's posts at ±2.9)
  assert.equal(P.FENCE_KINDS[gates[0][3]], 'fence_gate_road'); assert.deepEqual([gx, gz, gyaw], [228.23, 225.65, 1.327]);
  const gi = P.FENCE.indexOf(gates[0]); for (const n of [P.FENCE[gi - 1], P.FENCE[gi + 1]]) assert.ok(Math.abs(Math.hypot(n[0] - gx, n[1] - gz) - 7.2) < 0.05, `이웃 조각 ${n}`);
  for (const [o, r] of P.circlesAt('fence_gate_road', gx, gz, gyaw).map((c) => [c, c.r])) for (const a of [-1.6, -1.2, 0, 0.9, 1.2]) assert.ok(Math.hypot(o.x - (gx + a * Math.cos(gyaw)), o.z - (gz - a * Math.sin(gyaw))) >= r + 0.85, '택시가 문 가운데로');
  const D2 = T.DOCK2; assert.ok(Math.hypot(gates[1][0] - 232.44, gates[1][1] - 197.24) < 0.1 && Math.abs(gates[1][1] - D2.z) < 1.2, '부두 문은 부두 건널판 앞');
  // its lane: a body (0.45) at each gate's middle clear of every solid
  const solids = [...T.natureSolids(), ...T.structureSolids()]; for (const [x, z] of gates) assert.ok(solids.every((o) => Math.hypot(o.x - x, o.z - z) >= o.r + 0.45 - 1e-6), '문 가운데로 지나감');
  // nothing that blocks on a walk -- but the gates' posts and the pieces beside them
  const wickets = P.FENCE.filter((a) => /^fence_wicket/.test(P.FENCE_KINDS[a[3]])); /* (1.10.413 S1 · 415 S3: the camp's and the lookout's wickets stand across their walks too) */
  const props = P.solids(); const onWalk = props.filter((o) => T.walkDist(o.x, o.z) < o.r - 0.3 && [...gates, ...wickets].every(([x, z]) => Math.hypot(o.x - x, o.z - z) > 4)); assert.deepEqual(onWalk.map((o) => [o.x.toFixed(1), o.z.toFixed(1)]), []);
  // the swamps: off the walks, the camp, the peak; inside slows a bike, outside not
  for (const [i, [sx, sz]] of P.SWAMPS.entries()) {
    assert.ok(P.SWAMP_OUTLINES[i].every(([x, z]) => T.walkDist(x, z) >= 4), `늪 ${i} 길 밖`); assert.ok(Math.hypot(sx - I.camp.x, sz - I.camp.z) > I.camp.r + 10 && Math.hypot(sx - I.peak.x, sz - I.peak.z) > 20, `늪 ${i}`);
    assert.equal(P.inSwamp(sx, sz), true);
  }
  assert.ok(P.SWAMPS.length >= 5); assert.equal(P.inSwamp(I.camp.x, I.camp.z), false);
  // the camp's pieces round its fire; the cave at the creek's head; 우레's rock below the peak
  assert.deepEqual(P.CAMP, []); /* (1.10.423 사용자 결정 80 A: the camp's old middle set gone -- the hearth set its fire, the middle open) */ assert.deepEqual(P.CAMP_KINDS, ['campfire', 'log_bench', 'log_stool']);
  assert.ok(P.solids().every((c) => Math.hypot(c.x - I.camp.x, c.z - I.camp.z) > 3), 'nothing blocks the open middle');
  assert.ok(D.creekDist(P.CAVE.x, P.CAVE.z) < 3, '샘 동굴은 개울 머리'); assert.ok(Math.hypot(P.ROCK[0] - I.peak.x, P.ROCK[1] - I.peak.z) < 46);
  // nature (trees, bushes, rocks, the forest) keeps off every piece
  const N = T.nature(); const near = [...N.trees, ...N.bushes].filter((o) => o.isle2 && props.some((c) => Math.hypot(c.x - o.x, c.z - o.z) < c.r + 0.3));
  assert.deepEqual(near.map((o) => [o.x.toFixed(1), o.z.toFixed(1)]), []);
  assert.ok(solids.length > props.length && props.every((c) => solids.includes(c)), '섬의 막힘에 들어감');
});
