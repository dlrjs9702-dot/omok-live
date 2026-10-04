'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../public/climb/climb-sim.js');

// v1.9.4 상시 등반 도전: the course must be climbable from the ground to the summit using only jumps the physics
// allows and the ladders/ropes, every section must have its own mechanic, and the physics must be deterministic.
test('등반 코스: 바닥에서 정상(3,000m)까지 점프·사다리만으로 오를 수 있다', () => {
  const { platforms, ladders } = S.COURSE;
  const G = 25; const J = 11; const SPEED = 5;
  // farthest edge-to-edge gap a running jump clears while landing dy higher (plus the body's width)
  const reachFor = (dy) => { const disc = J * J - 2 * G * dy; if (disc < 0) return -1; return SPEED * ((J + Math.sqrt(disc)) / G) + 2 * S.HALF_W - 0.2; };
  const span = (p) => (p.move?.axis === 'x' ? [p.x0 - p.move.amp, p.x1 + p.move.amp] : [p.x0, p.x1]);
  const yRange = (p) => (p.move?.axis === 'y' ? [p.y - p.move.amp, p.y + p.move.amp] : [p.y, p.y]);
  const reached = new Set([0]); const queue = [0];
  while (queue.length) {
    const i = queue.shift(); const a = platforms[i]; const [ax0, ax1] = span(a); const [aLow, aHigh] = yRange(a);
    for (let j = 0; j < platforms.length; j += 1) {
      if (reached.has(j)) continue;
      const b = platforms[j]; const [bx0, bx1] = span(b); const [bLow] = yRange(b);
      const dy = bLow - aHigh; // the easiest moment for a lift: it is at its lowest and mine at its highest
      const gap = Math.max(0, bx0 - ax1, ax0 - bx1);
      const down = b.y < aLow && gap < 0.01; // falling straight down onto it
      if ((dy <= 0.001 && b.y >= aLow - 2.5 && gap <= 3.5) || (dy > 0 && reachFor(dy) >= gap) || down) { reached.add(j); queue.push(j); }
    }
    for (const l of ladders) { // a ladder starting on this platform leads to whatever stands at its top
      if (Math.abs(l.y0 - a.y) > 0.01 || l.x < ax0 - 0.3 || l.x > ax1 + 0.3) continue;
      platforms.forEach((b, j) => { if (!reached.has(j) && Math.abs(b.y - l.y1) < 0.01 && l.x >= b.x0 - 0.5 && l.x <= b.x1 + 0.5) { reached.add(j); queue.push(j); } });
    }
  }
  const summit = platforms.findIndex((p) => p.summit);
  assert.ok(summit >= 0, '정상 발판');
  assert.equal(platforms[summit].y, 3000);
  assert.ok(reached.has(summit), `정상까지 도달 가능 (도달한 최고 ${Math.max(...[...reached].map((i) => platforms[i].y)).toFixed(1)}m)`);
  // v1.10.4: no full-width shelf between the ground and the summit any more
  assert.deepEqual(platforms.filter((p) => p.x1 - p.x0 >= S.W - 0.01).map((p) => p.y), [0], '전체 폭 발판은 바닥뿐');
});

// v1.10.4 낙하 안전장치 제거: a fall is stopped only by a real step it lands on. Dropped from 1,000 m at many places,
// some falls go below 900 m (nothing catches them every 100 m), some reach the ground, and every one ends standing on
// an actual platform (or the ground).
test('등반 낙하: 100m마다 받쳐 주지 않아 운이 나쁘면 맨 아래까지, 아니면 중간 실제 발판에 걸린다', () => {
  const { platforms } = S.COURSE;
  const ends = [];
  for (let k = 0; k < 48; k += 1) {
    const s = S.newState(); s.x = 0.4 + k * 0.48; s.y = 1000.5; s.grounded = false; s.plat = -1; s.tick = 0;
    for (let t = 0; t < 30 * 60 && !s.grounded; t += 1) S.step(s, 0);
    assert.ok(s.grounded, '결국 어딘가에 선다');
    const under = platforms[s.plat];
    assert.ok(under && s.x >= Math.min(under.x0, under.x1) - S.HALF_W - 3 && Math.abs(s.y - under.y) < 3, '실제 발판 위');
    ends.push(s.y);
  }
  assert.ok(ends.some((y) => y < 900), `100m 아래로 계속 떨어지는 경우가 있다 (가장 낮게 ${Math.min(...ends).toFixed(1)}m)`);
  assert.ok(ends.some((y) => y > 900), '중간 발판에 걸리는 경우도 있다');
});

test('등반 코스: 300m 구간마다 다른 장치(사다리·이동 발판·공·바람·오르내리는 발판·갈림길)가 있다', () => {
  const { platforms, ladders, balls, gusts } = S.COURSE;
  const inSection = (y, s) => y >= s * 300 && y < (s + 1) * 300;
  assert.equal(S.SECTIONS.length, 10);
  assert.ok(ladders.some((l) => l.kind === 'ladder' && inSection(l.y0, 1)), '나무 사다리');
  assert.ok(platforms.filter((p) => p.move?.axis === 'x' && inSection(p.y, 3)).length > 10, '흔들 다리');
  assert.ok(platforms.some((p) => inSection(p.y, 4) && p.x1 < 11) && platforms.some((p) => inSection(p.y, 4) && p.x0 > 13), '두 갈래 길');
  assert.ok(balls.filter((b) => inSection(b.cy, 5)).length > 20, '굴러오는 공');
  assert.ok(ladders.some((l) => l.kind === 'rope' && inSection(l.y0, 6)) && gusts.some((g) => inSection(g.y0, 6)), '바람 협곡 밧줄');
  assert.ok(platforms.filter((p) => p.move?.axis === 'y' && inSection(p.y, 7)).length > 10, '오르내리는 발판');
  const smallAvg = (s) => { const ps = platforms.filter((p) => inSection(p.y, s) && !p.shelf); return ps.reduce((n, p) => n + p.x1 - p.x0, 0) / ps.length; };
  assert.ok(smallAvg(0) > smallAvg(9) + 2, '아래가 넓고 정상 탑이 좁다');
});

test('등반 물리: 같은 입력이면 항상 같은 결과, 고도는 0~3,000m 정수, 서 있을 때만 안전', () => {
  const run = () => { const s = S.newState(); for (let i = 0; i < 600; i += 1) S.step(s, (i % 40 < 20 ? S.BIT.right : S.BIT.left) | (i % 17 === 0 ? S.BIT.jump : 0) | (i % 50 > 40 ? S.BIT.up : 0)); return s; };
  assert.deepEqual(run(), run());
  const s = S.newState();
  assert.equal(S.altitude(s), 0);
  assert.ok(S.isSafe(s), '바닥에 서 있으면 안전');
  S.step(s, S.BIT.jump);
  assert.ok(!S.isSafe(s), '공중에서는 끝낼 수 없다');
  assert.equal(S.altitude({ y: 3999 }), 3000);
  assert.equal(S.altitude({ y: -5 }), 0);
  assert.equal(S.altitude({ y: 1428.97 }), 1428);
});
