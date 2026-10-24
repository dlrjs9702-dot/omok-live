'use strict';
// 동산 다듬기 (gamecenter-notes docs/terrain-paint-design-20261025.md 3): the shapes added to the ground's formula stay in open
// ground -- no walk, door, house, stair end, bridge end, lot, water or shore inside a round (so every one of them stands at
// the height it had: nothing there changed), and their slopes stay walkable (the ledge a short step)
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain.js');

const ON = T.MAP === 'dalmaru';
test('동산 다듬기: 모양마다 빈 땅에(길·문·집·계단·다리·집터·물·바닷가 밖), 비탈은 걸을 만함', { skip: !ON && '달마루섬 전용' }, () => {
  const D = T.dalmaru; const B = typeof T.bridges === 'function' ? T.bridges() : T.bridges; const S = T.STAIRS; const LOTS = require('../public/plaza/island-home.js').LOTS;
  const points = [...Object.keys(T.SPOTS).map((id) => T.facilityDoor(id)).filter(Boolean), ...T.BUILDINGS, ...T.COTTAGES, ...LOTS,
    ...B.flatMap((b) => [-1, 1].map((s) => ({ x: b.x + b.ux * b.half * s, z: b.z + b.uz * b.half * s }))), { x: S.x, z: S.z }, { x: S.x + S.ux * S.len, z: S.z + S.uz * S.len }, ...D.POOLS, ...D.HEAD_PONDS];
  const P = D.PLAZA; const problems = [];
  for (const b of D.BRUSHES) {
    const name = `${b.kind}(${b.x},${b.z})`;
    if (T.walkDist(b.x, b.z) < b.r + 1) problems.push(`${name}: 길`);
    if (T.coastDist(b.x, b.z) < b.r + 4) problems.push(`${name}: 바닷가`);
    if (Math.max(Math.abs(b.x - P.x) - P.hw, P.d0 - b.z, b.z - P.d1) < b.r + 3) problems.push(`${name}: 대청마당`);
    for (const p of points) if (Math.hypot(p.x - b.x, p.z - b.z) < b.r + (p.r || 0) + 3) problems.push(`${name}: ${p.id || p.kind || ''}(${Math.round(p.x)},${Math.round(p.z)})`);
    for (const r of D.RIVERS) for (const [x, z] of r.pts) if (Math.hypot(x - b.x, z - b.z) < b.r + r.w + 3) problems.push(`${name}: 강`);
    let steep = 0;
    for (let a = 0; a < 48; a += 1) for (let d = 0; d < b.r; d += 0.5) { const x = b.x + Math.cos((a / 48) * Math.PI * 2) * d; const z = b.z + Math.sin((a / 48) * Math.PI * 2) * d; steep = Math.max(steep, Math.hypot(T.heightAt(x + 0.25, z) - T.heightAt(x - 0.25, z), T.heightAt(x, z + 0.25) - T.heightAt(x, z - 0.25)) / 0.5); }
    if (steep > 1.2) problems.push(`${name}: 비탈 ${steep.toFixed(2)}`);
  }
  assert.deepEqual(problems, []);
  assert.ok(D.BRUSHES.length >= 4 && Math.abs(T.heightAt(D.BRUSHES[1].x, D.BRUSHES[1].z) - T.heightAt(D.BRUSHES[1].x + D.BRUSHES[1].r + 1, D.BRUSHES[1].z)) > 1); // (a mound does stand)
});
