'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain');

// 문제 기록 3회차 11 「계단이랑 관공서가 너무 붙어 있고 관공서 앞쪽을 파고들어. 건물들 점검해서 파고들지 않게」: what stands on the
// island -- the buildings (the two cliff facades 30 m wide, the hall's walled yard), the props at 알림마루, the cottages,
// the house lots (a big house's round), the ridge stairs and the bridges -- each at least 2 m from every other
// (its outline sampled every 0.5 m; the hall's facade and its own yard are one)
const rect = (cx, cz, ax, az, a0, a1, b0, b1) => { const pts = []; const bx = az; const bz = -ax;
  for (let a = a0; a <= a1 + 1e-9; a += 0.5) for (const b of [b0, b1]) pts.push([cx + ax * a + bx * b, cz + az * a + bz * b]);
  for (let b = b0; b <= b1 + 1e-9; b += 0.5) for (const a of [a0, a1]) pts.push([cx + ax * a + bx * b, cz + az * a + bz * b]);
  return pts; };
const circle = (x, z, r) => Array.from({ length: 24 }, (_, i) => [x + Math.cos((i / 24) * Math.PI * 2) * r, z + Math.sin((i / 24) * Math.PI * 2) * r]);
const SIZE = { hall: 6, tower: 4.5, house: 3, gazebo: 3, office: 3, board: 0.6, mapboard: 0.6, npc: 0.4, donation: 0.5 };
test('섬 위 건물·계단·다리·집터: 서로 2 m 이상 (파고드는 것 없음)', { skip: !T.dalmaru }, () => {
  const things = [];
  for (const [id, s] of Object.entries(T.SPOTS)) {
    if (s.kind === 'facade') { const l = Math.hypot(s.face[0] - s.x, s.face[1] - s.z); const fx = (s.face[0] - s.x) / l; const fz = (s.face[1] - s.z) / l; things.push([`facade:${id}`, rect(s.x, s.z, fz, -fx, -15, 15, 0, 4.6)]); }
    else things.push([`${s.kind}:${id}`, circle(s.x, s.z, SIZE[s.kind] ?? 3)]);
  }
  { const H = T.TOWNHALL; things.push(['yard:townhall', rect(H.x + H.sin * 11.85, H.z + H.cos * 11.85, H.cos, -H.sin, -H.yard.hx, H.yard.hx, -4.5, 4.5)]); }
  T.COTTAGES.forEach((c, i) => things.push([`cottage:${i}`, circle(c.x, c.z, 3)]));
  T.HOME_LOTS.forEach((l, i) => things.push([`lot:${i}`, circle(l.x, l.z, 6.5)]));
  { const S = T.STAIRS; things.push(['stairs', rect(S.x, S.z, S.ux, S.uz, 0, S.len, -S.w1, -S.w0)]); }
  T.bridges.forEach((b, i) => things.push([`bridge:${i}`, rect(b.x, b.z, b.ux, b.uz, -b.half, b.half, -b.w / 2, b.w / 2)]));
  const close = [];
  for (let i = 0; i < things.length; i += 1) for (let j = i + 1; j < things.length; j += 1) {
    const [a, pa] = things[i]; const [b, pb] = things[j]; if (a.split(':')[1] === b.split(':')[1] && a.split(':')[1] === 'townhall') continue;
    let d = Infinity; for (const p of pa) for (const q of pb) d = Math.min(d, Math.hypot(p[0] - q[0], p[1] - q[1]));
    if (d < 2) close.push(`${a} ~ ${b} ${d.toFixed(2)} m`);
  }
  assert.ok(things.length > 30, `${things.length}`); assert.deepEqual(close, []);
});
