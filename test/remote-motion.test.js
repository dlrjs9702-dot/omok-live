'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../public/plaza/remote-motion.js');

// v1.10.8 타인 캐릭터 이동 자연화: someone walking straight at 5.2/s sends a pose every 125 ms; the server forwards them
// in 150 ms snapshots that arrive with uneven delays. Drawn at 60 fps, the walk must look even (no surges and stops),
// a short gap in the updates must not freeze the walker, and a warp must not glide across the island.
function simulate({ until = 4000, gapFrom = Infinity, gapTo = -1, warpAt = Infinity } = {}) {
  const track = M.createTrack(); const f = M.createFollower({ maxSpeed: 5.2 * 1.6 });
  const sent = []; // poses the walker sent (server time)
  for (let t = 0; t <= until; t += 125) {
    const x = t >= warpAt ? 80 : (t / 1000) * 5.2;
    sent.push({ t, x, z: 0, yaw: Math.PI / 2, moving: true });
  }
  const deliveries = []; // [local arrival time, pose]
  let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let tick = 150; tick <= until + 150; tick += 150) {
    if (tick > gapFrom && tick < gapTo) continue; // the updates stop for a while
    const newest = sent.filter((p) => p.t <= tick).pop();
    if (newest) deliveries.push([tick + 40 + rnd() * 90, newest]);
  }
  const frames = [];
  let next = 0;
  for (let now = 0; now <= until + 600; now += 1000 / 60) {
    while (next < deliveries.length && deliveries[next][0] <= now) { track.push(deliveries[next][1], deliveries[next][0]); next += 1; }
    const target = track.at(now);
    if (target) { f.step(target, 1 / 60); frames.push({ now, x: f.x, speed: f.speed }); }
  }
  return frames;
}

test('원격 이동: 고르지 않은 도착에도 일정한 속도로 걷는다', () => {
  const frames = simulate();
  const steady = frames.filter((fr) => fr.now > 800 && fr.now < 3600);
  const steps = steady.slice(1).map((fr, i) => (fr.x - steady[i].x) * 60);
  const min = Math.min(...steps); const max = Math.max(...steps);
  assert.ok(min > 5.2 * 0.75 && max < 5.2 * 1.25, `프레임 속도 ${min.toFixed(2)}~${max.toFixed(2)}`);
  assert.ok(steady.every((fr) => fr.speed > 4 && fr.speed < 6.5), '걷는 속도로 애니메이션');
});

test('원격 이동: 짧은 공백은 잠깐 이어 걷고 멈췄다가, 새 위치에 부드럽게 합류한다', () => {
  const frames = simulate({ gapFrom: 1500, gapTo: 1900 });
  const around = frames.filter((fr) => fr.now > 1200 && fr.now < 2600);
  const jumps = around.slice(1).map((fr, i) => Math.abs(fr.x - around[i].x));
  assert.ok(Math.max(...jumps) < 0.25, `한 프레임 최대 이동 ${Math.max(...jumps).toFixed(3)}`);
});

test('원격 이동: 워프는 미끄러지지 않고 바로 옮긴다', () => {
  const frames = simulate({ warpAt: 2000 });
  const after = frames.filter((fr) => fr.x > 20);
  assert.ok(after.length, '워프 반영');
  const firstFar = frames.findIndex((fr) => fr.x > 20);
  assert.ok(frames[firstFar - 1].x < 15, '중간 지점을 거치지 않음');
  assert.ok(after.every((fr) => Math.abs(fr.x - 80) < 0.01), '그 자리에 바로');
});
