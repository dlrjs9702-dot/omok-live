'use strict';
// 1.10.416 S4 망루 (사용자 결정 72 · 73 · 166A, 검토 notes docs/safe-zones-visible-20261122.md §2-4 · §3, assets 178): the tower inside the stone yard, off
// the trail, its foot by it; climbed by its own walk faces (no step over 0.3 m in 0.25 m) to the deck 6 m up; its rails keep one from stepping from
// the ground or a low flight onto a higher face; from the deck the far view and the main island's far shape
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const T = require('../public/plaza/island-terrain.js'); require('../public/plaza/island-train.js');
const P = require('../public/plaza/isle2-props.js');
const W = T.TOWER; const K = T.dalmaru?.NEW_ISLE?.peak;
const at = (lx, lz) => [W.x + lx * W.c + lz * W.s, W.z - lx * W.s + lz * W.c];

test('S4 망루 자리: 돌담 마당 안(모서리 1.2 m 안쪽), 오솔길 밖, 오르는 곳은 길가, 안전지대 안', { skip: !W && '달마루섬 전용' }, () => {
  for (const lx of [-3.4, 0, 3.4]) for (const lz of [-3.4, 0, 3.4]) { const [x, z] = at(lx, lz); assert.ok(Math.hypot(x - K.x, z - K.z) <= K.ring.r - 1.2, `${lx},${lz} inside the yard`); assert.ok(T.walkDist(x, z) >= 0.4, `${lx},${lz} off the trail`); assert.ok(Math.hypot(x - K.x, z - K.z) < K.safe); }
  const [fx, fz] = at(4.2, 2.7); assert.ok(T.walkDist(fx, fz) < 0.2, 'its foot by the trail');
});

test('S4 망루 오르기: 발치 → F1 → L1 → F2 → L2 → F3 → L3 → 마루 6 m, 0.25 m마다 0.3 m 넘게 안 오름, 난간 원에서 0.3 m 넘게 떨어짐', { skip: !W && '달마루섬 전용' }, () => {
  const route = [[4.2, 2.7], [3.2, 2.7], [-2.7, 2.7], [-2.7, -2.7], [2.7, -2.7], [2.7, -1.3], [1, 0]]; const S = P.solids(); const ids = [];
  let prev = T.heightAt(...at(...route[0]));
  for (let i = 1; i < route.length; i += 1) { const [ax, az] = route[i - 1]; const [bx, bz] = route[i]; const L = Math.hypot(bx - ax, bz - az);
    for (let d = 0.25; d <= L + 1e-9; d += 0.25) { const lx = ax + ((bx - ax) * d) / L; const lz = az + ((bz - az) * d) / L; const [x, z] = at(lx, lz); const h = T.heightAt(x, z);
      assert.ok(Math.abs(h - prev) <= 0.3, `step at ${lx.toFixed(2)},${lz.toFixed(2)}: ${(h - prev).toFixed(2)}`); prev = h; assert.ok(T.walkable(x, z));
      const near = Math.min(...S.map((o) => Math.hypot(o.x - x, o.z - z) - o.r)); assert.ok(near >= 0.3, `clear at ${lx.toFixed(2)},${lz.toFixed(2)}: ${near.toFixed(2)}`);
      const id = T.onTower(x, z)?.id; if (id && ids[ids.length - 1] !== id) ids.push(id); } }
  assert.deepEqual(ids, ['start', 'F1', 'L1', 'F2', 'L2', 'F3', 'L3', 'floor']); assert.ok(Math.abs(prev - W.base - 6) < 0.01, `the deck ${prev - W.base}`);
});

test('S4 망루 난간: 발치 밖 어느 옆에서도 높은 면으로 걸어 들어가지 못함(0.3 몸이 난간 원에 막힘)', { skip: !W && '달마루섬 전용' }, () => {
  const S = P.solids(); const blocked = (x, z) => S.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 0.3);
  const open = [];
  for (let s = -3.2; s <= 3.2; s += 0.2) for (const [ox, oz, ix, iz] of [[s, 3.9, s, 2.9], [-3.9, s, -2.9, s], [s, -3.9, s, -2.9], [3.9, s, 2.9, s]]) {
    if (ox >= 2.8 && oz >= 2.4 || ix >= 2.8 && iz >= 2.4) continue; /* (its foot: the way on) */
    let hit = false; for (let k = 0; k <= 10 && !hit; k += 1) { const t = k / 10; const [x, z] = at(ox + (ix - ox) * t, oz + (iz - oz) * t); if (blocked(x, z)) hit = true; }
    const [x2, z2] = at(ix, iz); if (!hit && T.heightAt(x2, z2) - T.ground(x2, z2) > 0.5) open.push([ix.toFixed(1), iz.toFixed(1)]); }
  assert.deepEqual(open, []);
  /* (and the deck from under it: the ground inside its square past the rails under it is never walked onto from the flights' outer side) */
  for (const [lx, lz] of [[0, 1.5], [-1.5, 0], [0, -1.5]]) { const [x, z] = at(lx, lz); assert.equal(T.onTower(x, z)?.id, 'floor'); }
});

test('S4 결정 166A: 마루 · 꼭대기 층계참 위에서 먼 시야(안개 600 · 그리는 거리 650)와 본섬 멀리 모양', () => {
  const scene = fs.readFileSync(path.join(__dirname, '../public/plaza/plaza-scene.js'), 'utf8'); assert.match(scene, /onTower\?\.\(p\.x, p\.z\)\?\.top/); assert.match(scene, /wide \? 600/); assert.match(scene, /wide \? 650/); assert.match(scene, /setMainFar\?\.\(onTop\)/);
  const island = fs.readFileSync(path.join(__dirname, '../public/plaza/island.js'), 'utf8'); assert.match(island, /name = 'main-far'/); assert.match(island, /setMainFar:/);
  if (W) { const [x, z] = at(0.7, 0); assert.equal(T.onTower(x, z).top, true); const [x2, z2] = at(-2.7, 0); assert.equal(T.onTower(x2, z2).top, false); }
});
