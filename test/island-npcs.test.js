'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain.js');
const P = require('../public/plaza/island-npcs.js');

// v1.10.12 배회 NPC: about 10 islanders on rounds worked out from fixed seeds -- the same on every screen and the
// server -- that stay on standable ground clear of buildings and trees, never turn straight back, stop for a while
// away from doors, and never jump.
test('배회 NPC: 10명, 같은 시각이면 같은 자리, 설 수 있는 곳만, 순간이동 없음', () => {
  assert.equal(P.COUNT, 10);
  for (let n = 0; n < P.COUNT; n += 1) {
    const r = P.round(n);
    assert.ok(r.period > 30 && Number.isFinite(r.period));
    let prev = P.at(n, 0);
    for (let ms = 100; ms <= r.period * 1000; ms += 100) {
      const p = P.at(n, ms);
      assert.ok(T.walkable(p.x, p.z), `n${n} ${ms}ms 설 수 있는 곳`);
      assert.ok(Math.hypot(p.x - prev.x, p.z - prev.z) <= r.speed * 0.1 + 0.01, `n${n} ${ms}ms 순간이동 없음`);
      prev = p;
    }
    const once = P.at(n, 123456789); const later = P.at(n, 123456789 + r.period * 1000 * 3);
    assert.ok(Math.hypot(once.x - later.x, once.z - later.z) < 1e-6, '같은 바퀴를 반복');
    for (const part of r.parts) for (const pt of part.pts) assert.ok(P.free(pt.x, pt.z) || part.moving === false, '건물·나무를 피함');
  }
});

test('배회 NPC: 서는 곳은 시설 입구에서 떨어져 있고, 왔던 곳으로 바로 돌아가지 않으며, 3~9초 쉰다', () => {
  for (let n = 0; n < P.COUNT; n += 1) {
    const r = P.round(n);
    const stops = r.parts.filter((p) => !p.moving);
    assert.ok(stops.length >= 5 && stops.length <= 7, `${n}: 정류 ${stops.length}`);
    for (const s of stops) {
      assert.ok(s.t1 - s.t0 >= 3 && s.t1 - s.t0 <= 9);
      for (const spot of Object.values(T.SPOTS)) assert.ok(Math.hypot(s.pts[0].x - spot.x, s.pts[0].z - spot.z) >= 8, '입구를 막지 않음');
    }
    for (let k = 2; k < stops.length; k += 1) assert.ok(Math.hypot(stops[k].pts[0].x - stops[k - 2].pts[0].x, stops[k].pts[0].z - stops[k - 2].pts[0].z) >= 10, '바로 되돌아가지 않음');
  }
  const spread = new Set(Array.from({ length: P.COUNT }, (_, n) => { const p = P.at(n, 1_000_000); return `${Math.round(p.x / 10)},${Math.round(p.z / 10)}`; }));
  assert.ok(spread.size >= 7, '한곳에 몰리지 않음');
});

test('배회 NPC: 닫힌 마지막 구간도 14~55m이며 주기 경계에서 바로 되돌아가지 않는다', () => {
  for (let n = 0; n < P.COUNT; n += 1) {
    const stops = P.round(n).parts.filter(p => !p.moving).map(p => p.pts[0]);
    for (let k = 0; k < stops.length; k += 1) {
      const a = stops[k], b = stops[(k + 1) % stops.length], next = stops[(k + 2) % stops.length];
      const distance = Math.hypot(a.x - b.x, a.z - b.z);
      assert.ok(distance >= 14 && distance <= 55, `NPC${n} 구간${k}: ${distance.toFixed(3)}m`);
      assert.ok(Math.hypot(a.x - next.x, a.z - next.z) >= 10, `NPC${n} 구간${k}: 주기 경계 즉시 되돌림 없음`);
      assert.ok(P.findPath(a, b), `NPC${n} 구간${k}: 실제 연결 경로 있음`);
    }
  }
});


test('주민 대기: 모든 화면의 예약 위치를 유지하고 다른 사람은 회피하며 늦은 해제도 순간이동하지 않는다', () => {
  let held=true;
  const poseAt=(n,ms)=>n===0&&held ? {x:10,z:10,yaw:0,moving:false,held:true}
    : {x:n===0?10+(ms-1000)/1000:10.2,z:10,yaw:Math.PI/2,moving:n===0};
  const make=()=>P.createWalkers({walkable:()=>true,solidsNear:()=>[],poseAt});
  const a=make(), b=make(); a.add(0,0); b.add(0,0); a.add(1,0);
  for(let ms=0;ms<=1000;ms+=100) {
    a.step(ms,.1,[{x:10,z:10,r:.5}]); b.step(ms,.1);
    assert.equal(a.list[0].x,10); assert.equal(a.list[0].z,10);
    assert.equal(b.list[0].x,10); assert.equal(a.list[0].speed,0);
    assert.ok(Math.hypot(a.list[1].x-10,a.list[1].z-10)>=P.WALKER.SEP-.01);
  }
  held=false; a.step(10000,.1);
  assert.equal(a.resyncs(),0); assert.ok(Math.hypot(a.list[0].x-10,a.list[0].z-10)<=P.WALKER.TOP+.01);
});
