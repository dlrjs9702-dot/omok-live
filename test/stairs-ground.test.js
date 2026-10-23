'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain');

// 문제 기록 4회차 (v1.10.127 moved the ridge stairs 1.5° along the ridge; what was laid out round them stayed): 「길이 너무
// 끊겨 있어」 by their top, 「공중에 발판이 떠 있어」 and 「통과할 수 있는 산맥으로 막혀 있어」 by their foot. Everything round them
// is read from where they are, and checked so: the drawn ground (the 2.5 m mesh) never over the treads, no standing where
// it is drawn over or under one's feet, each end reached on foot from its walk, and no walk anywhere over unwalkable ground.
const S = T.STAIRS;
const at = (u, v) => ({ x: S.x + S.ux * u + S.nx * v, z: S.z + S.uz * u + S.nz * v });

test('능선 계단: 그려진 땅이 계단 판을 덮지 않고, 계단 둘레는 보이는 땅 = 서는 땅', { skip: !T.dalmaru }, () => {
  const over = []; const mismatch = [];
  for (let u = 0; u <= S.len; u += 0.5) for (let v = S.w0 + 0.1; v <= S.w1 - 0.1; v += 0.5) {
    const p = at(u, v); const d = T.meshGroundHeight(p.x, p.z) - T.heightAt(p.x, p.z);
    if (d > 0.3) over.push(`u${u} v${v.toFixed(1)} +${d.toFixed(2)}`);
  }
  for (let u = -8; u <= S.len + 8; u += 0.5) for (let v = S.w0 - 8; v <= S.w1 + 8; v += 0.5) {
    const p = at(u, v); if (!T.walkable(p.x, p.z) || T.onStairs(p.x, p.z) || T.onBridge(p.x, p.z)) continue;
    const d = T.meshGroundHeight(p.x, p.z) - T.heightAt(p.x, p.z); if (Math.abs(d) > 0.5) mismatch.push(`u${u} v${v.toFixed(1)} ${d.toFixed(2)}`);
  }
  assert.deepEqual(over, [], '계단 판 위 그려진 땅'); assert.deepEqual(mismatch.slice(0, 10), [], '계단 둘레 보이는 땅과 서는 땅');
});

// a flood over walkable 0.5 m cells, a step at most 0.45 m up or down, from the stairs' end to its walk
function reach(from, goal, limit = 40) {
  const key = (x, z) => `${Math.round(x * 2)},${Math.round(z * 2)}`; const seen = new Set([key(from.x, from.z)]); const q = [[from.x, from.z, T.heightAt(from.x, from.z)]];
  while (q.length) {
    const [x, z, y] = q.shift(); if (goal(x, z)) return true;
    for (const [dx, dz] of [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) {
      const nx = x + dx; const nz = z + dz; const k = key(nx, nz); if (seen.has(k) || Math.hypot(nx - from.x, nz - from.z) > limit || !T.walkable(nx, nz)) continue;
      const ny = T.heightAt(nx, nz); if (Math.abs(ny - y) > 0.45) continue; seen.add(k); q.push([nx, nz, ny]);
    }
  }
  return false;
}
test('능선 계단: 위·아래 끝에서 걸어서 길에 닿고, 섬의 모든 길이 걸을 수 있는 땅 위', { skip: !T.dalmaru }, () => {
  const top = at(S.len, 1.7); const foot = at(0, 1.7);
  assert.ok(reach(at(S.len - 0.3, 1.7), (x, z) => !T.onStairs(x, z) && T.walkDist(x, z) < 0 && Math.hypot(x - top.x, z - top.z) > 6), '꼭대기 → 능선 길');
  assert.ok(reach(at(0.2, 1.7), (x, z) => !T.onStairs(x, z) && T.walkDist(x, z) < 0 && Math.hypot(x - foot.x, z - foot.z) > 4), '발치 → 길');
  const bad = []; T.walkCurves.forEach((w, wi) => w.pts.forEach(([x, z]) => { if (!T.walkable(x, z)) bad.push(`walk ${wi} ${x.toFixed(1)},${z.toFixed(1)}`); }));
  assert.deepEqual(bad.slice(0, 10), []);
});
