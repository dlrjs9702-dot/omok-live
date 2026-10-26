'use strict';
// v1.10.160 역 터 (사용자 「땅 다지기」): under each station's lift and the walkway to its way in the ground is levelled, its bank
// gentle; the lift stands on it (no plinth to fill a slope), nothing else's level ground under it, nothing growing on its bank
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain.js');
const R = require('../public/plaza/island-train.js');

const ON = T.MAP === 'dalmaru';
test('역 터: 승강기·들어가는 길 아래 평평(땅과 0.05 m 안), 둑 완만(0.85 아래), 다른 건물·집터 터와 안 겹침, 둑 위 나무·덤불·돌 없음', { skip: !ON && '달마루섬 전용' }, () => {
  const D = T.dalmaru; const slope = (x, z) => Math.hypot(T.heightAt(x + 0.25, z) - T.heightAt(x - 0.25, z), T.heightAt(x, z + 0.25) - T.heightAt(x, z - 0.25)) / 0.5;
  const N = T.nature(); const growing = [...N.trees, ...N.bushes, ...N.rocks]; const problems = [];
  for (const id of Object.keys(R.STATIONS)) {
    const at = D.TRAIN.liftAt(id); const lift = R.liftOf(id); const [ex, ez] = R.STATIONS[id].entry;
    assert.ok(Math.hypot(at.x - lift.x, at.z - lift.z) < 0.01 && Math.hypot(at.entry[0] - ex, at.entry[1] - ez) < 0.01, `${id}: 지형의 역 자리 = 열차의 역 자리`);
    // the lift's base and the walkway: on the ground, within 5 cm
    const under = []; for (const dx of [-1.2, 0, 1.2]) for (const dz of [-1.2, 0, 1.2]) under.push([lift.x + dx, lift.z + dz]);
    for (let k = 0; k <= 8; k += 1) under.push([lift.x + ((ex - lift.x) * k) / 8, lift.z + ((ez - lift.z) * k) / 8]);
    const off = Math.max(...under.map(([x, z]) => Math.abs(T.heightAt(x, z) - lift.y))); if (off > 0.05) problems.push(`${id}: 바닥과 땅 ${off.toFixed(2)} m`);
    // (I8-1 「승강장 아래 땅 깜빡임」) the walk in's deck over the ground everywhere under it, by 2 cm at least -- never level with it
    const walk = under.slice(9).map(([x, z]) => T.heightAt(x, z)); const gap = lift.y + R.ACCESS_DECK - Math.max(...walk); if (gap < 0.02) problems.push(`${id}: 들어가는 길 판이 땅과 ${gap.toFixed(3)} m`);
    if (lift.y - lift.low > 0.05) problems.push(`${id}: 기단 ${(lift.y - lift.low).toFixed(2)} m`);
    // its pad (none where the ground was level already): walkable where it moves the ground (the beach's own fall to the sea at
    // its rim is the beach's),
    // no other level ground (a building's, a lot's) within it, nothing growing on the bank
    const pad = T.PADS.find((p) => Math.hypot(p.x - (lift.x + ex) / 2, p.z - (lift.z + ez) / 2) < 0.01); if (!pad) continue;
    let steep = 0; for (let a = 0; a < 48; a += 1) for (let d = 0; d < pad.r + 5; d += 0.5) { const x = pad.x + Math.cos((a / 48) * Math.PI * 2) * d; const z = pad.z + Math.sin((a / 48) * Math.PI * 2) * d; if ((1 - D.smooth(pad.r, pad.r + 5, d)) * Math.abs(pad.h - T.heightAt(x, z)) > 0.02 || d < pad.r + 1) steep = Math.max(steep, slope(x, z)); }
    if (steep > 0.85) problems.push(`${id}: 둑 ${steep.toFixed(2)}`);
    for (const q of T.PADS) if (q !== pad && Math.hypot(q.x - pad.x, q.z - pad.z) < q.r + pad.r + 5) problems.push(`${id}: 다른 터(${Math.round(q.x)},${Math.round(q.z)})`);
    for (const o of growing) if (Math.hypot(o.x - pad.x, o.z - pad.z) < pad.r + 5 && (Math.hypot(o.x - pad.x, o.z - pad.z) < pad.r + 0.5 || slope(o.x, o.z) >= 0.4)) problems.push(`${id}: 터·둑 위 (${o.x.toFixed(1)},${o.z.toFixed(1)})`);
  }
  assert.deepEqual(problems, []);
});
