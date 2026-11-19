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
  assert.ok(P.FENCE.length > 320, `${P.FENCE.length}`); const gates = P.FENCE.filter((f) => P.FENCE_KINDS[f[3]] === 'fence_gate'); assert.equal(gates.length, 1);
  const [gx, gz, gyaw] = gates[0]; assert.ok(T.walkDist(gx, gz) < 0, '문은 길 위'); assert.ok(Math.hypot(gx - 196, gz - 226) < 40, '별마루다리 쪽');
  // its lane: a body (0.45) at the gate's middle clear of every solid
  const solids = T.natureSolids(); assert.ok(solids.every((o) => Math.hypot(o.x - gx, o.z - gz) >= o.r + 0.45 - 1e-6), '문 가운데로 지나감');
  // nothing that blocks on a walk -- but the gate's posts and the pieces beside it
  const props = P.solids(); const onWalk = props.filter((o) => T.walkDist(o.x, o.z) < o.r - 0.3 && Math.hypot(o.x - gx, o.z - gz) > 4); assert.deepEqual(onWalk.map((o) => [o.x.toFixed(1), o.z.toFixed(1)]), []);
  // the swamps: off the walks, the camp, the peak; inside slows a bike, outside not
  for (const [i, [sx, sz]] of P.SWAMPS.entries()) {
    assert.ok(P.SWAMP_OUTLINES[i].every(([x, z]) => T.walkDist(x, z) >= 4), `늪 ${i} 길 밖`); assert.ok(Math.hypot(sx - I.camp.x, sz - I.camp.z) > I.camp.r + 10 && Math.hypot(sx - I.peak.x, sz - I.peak.z) > 20, `늪 ${i}`);
    assert.equal(P.inSwamp(sx, sz), true);
  }
  assert.ok(P.SWAMPS.length >= 5); assert.equal(P.inSwamp(I.camp.x, I.camp.z), false);
  // the camp's pieces round its fire; the cave at the creek's head; 우레's rock below the peak
  assert.ok(P.CAMP.every(([x, z]) => Math.hypot(x - I.camp.x, z - I.camp.z) < 4)); assert.equal(P.CAMP_KINDS[P.CAMP[0][3]], 'campfire');
  assert.ok(D.creekDist(P.CAVE.x, P.CAVE.z) < 3, '샘 동굴은 개울 머리'); assert.ok(Math.hypot(P.ROCK[0] - I.peak.x, P.ROCK[1] - I.peak.z) < 46);
  // nature (trees, bushes, rocks, the forest) keeps off every piece
  const N = T.nature(); const near = [...N.trees, ...N.bushes].filter((o) => o.isle2 && props.some((c) => Math.hypot(c.x - o.x, c.z - o.z) < c.r + 0.3));
  assert.deepEqual(near.map((o) => [o.x.toFixed(1), o.z.toFixed(1)]), []);
  assert.ok(solids.length > props.length && props.every((c) => solids.includes(c)), '섬의 막힘에 들어감');
});
