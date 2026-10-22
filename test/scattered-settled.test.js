'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain');
const W = require('../lib/island-weeds');

// 문제 기록 3회차 8 「있을 필요 없는 곳에도 돌·잡초, 하늘에 떠 있네」: the island's stones, flowers and weeds (the first ones and
// those that grow back) stand on the drawn ground where it is gentle -- none more than 0.1 m off it anywhere under its
// 0.3 m -- never on a cliff's edge, a walk or the stairs. (Placed on the 2 m mesh: on the ridge's slopes the formula's ground
// stood metres off the drawn one.)
const float = (x, z) => { const h = T.meshGroundHeight(x, z); let lo = h; for (let a = 0; a < 16; a += 1) lo = Math.min(lo, T.meshGroundHeight(x + Math.cos(a * Math.PI / 8) * 0.3, z + Math.sin(a * Math.PI / 8) * 0.3)); return h - lo; };
test('흩어 놓은 돌·꽃·잡초: 땅에서 0.1 m 넘게 뜬 것 없음, 절벽·길·계단 위 없음', () => {
  const n = T.nature(); const bad = [];
  const kept = [...n.rocks.filter((r) => T.settledSpot(r.x, r.z)).map((r) => ['돌', r]), ...n.flowers.filter((f) => T.settledSpot(f.x, f.z)).map((f) => ['꽃', f]), ...W.active({}).map((w) => ['잡초', w])];
  for (const [k, p] of kept) {
    if (float(p.x, p.z) > 0.1) bad.push(`${k} ${p.x.toFixed(1)},${p.z.toFixed(1)} 뜸 ${float(p.x, p.z).toFixed(2)}`);
    if (T.walkDist(p.x, p.z) <= 0.3 || T.onStairs(p.x, p.z) || Math.abs(T.ground(p.x, p.z) - T.meshGroundHeight(p.x, p.z)) >= 0.15) bad.push(`${k} ${p.x.toFixed(1)},${p.z.toFixed(1)} 자리`);
  }
  assert.ok(kept.length > 1000, `${kept.length}`); assert.deepEqual(bad.slice(0, 10), []);
  // the weeds keep their numbers: each first weed is still the tuft it was numbered by
  for (const w of W.active({}).filter((x) => x.id.startsWith('w'))) { const t = n.tufts[Number(w.id.slice(1))]; assert.ok(Math.abs(t.x - w.x) < 0.01 && Math.abs(t.z - w.z) < 0.01, w.id); }
});
