'use strict';
// 문제 기록 ① 「의자랑 같은 방향으로 앉게 해」 (gamecenter-notes docs/issue-log-review-20261021.md): one sits the way the seat
// faces -- a plaza bench's seat the way the bench is turned (both toward the fountain), a garden rim's seat out from
// the garden, a house's sofa or chair the way the piece is turned. Within 10°.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain.js');
const H = require('../public/plaza/island-home.js');
const off = (a, b) => { const d = Math.abs((((a - b) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); return (d * 180) / Math.PI; };

test('앉는 방향: 광장 벤치(분수 쪽)·정원 테두리(바깥쪽)·집 가구(가구 앞) 모두 그 자리의 앞 ±10°', () => {
  const P = T.plazaProps(); const C = T.PLAZA_C; const bad = [];
  P.benches.forEach((b, k) => {
    const s = P.seats.find((x) => x.id === `b${k}`);
    if (!Number.isFinite(b.yaw)) { bad.push(`벤치${k}: 방향 없음`); return; } // (the scene turns the bench by it -- the seat's own)
    // (3회차 13: the rim's benches sit in a row along the kerb, facing in from it -- into the plaza, not at the fountain)
    if (off(b.yaw, Math.atan2(C.x - b.x, C.z - b.z)) > (b.rim ? 80 : 10)) bad.push(`벤치${k}: ${b.rim ? '마당 안쪽' : '분수'}을 보지 않음`);
    if (!s || off(s.yaw, b.yaw) > 10) bad.push(`벤치${k}: 앉는 방향 ${s && off(s.yaw, b.yaw).toFixed(0)}°`);
  });
  T.paving().gardens.forEach((g, k) => P.seats.filter((s) => s.id.startsWith(`g${k}-`)).forEach((s) => {
    const out = g.kind === 'round' ? Math.atan2(s.x - g.x, s.z - g.z) : Math.atan2(0, s.z - g.z); if (off(s.yaw, out) > 10) bad.push(`정원${k} ${s.id}`);
  }));
  const lot = H.LOTS[0];
  for (const id of Object.keys(H.SEATS)) for (const rot of [0, 1, 2, 3]) for (const s of H.seatsOf(lot, { uid: 'p', id: `${id}__x`, x: 0, z: 0, rot })) if (off(s.yaw, (rot * Math.PI) / 2) > 10) bad.push(`${id} rot ${rot}`);
  assert.deepEqual(bad, []);
});

test('옛 둥근 섬의 한가운데(0, 0)를 보게 돌리는 곳이 없다 (달마루섬의 광장은 분수 자리)', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public', 'plaza', 'plaza-scene.js'), 'utf8');
  assert.deepEqual(src.split('\n').filter((l) => /Math\.atan2\(-(\w+)\.x, -\1\.z\)/.test(l)).map((l) => l.trim().slice(0, 80)), []);
});
