'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain.js');
const P = require('../public/plaza/island-npcs.js');

// v1.10.16 배회 NPC 이동 현실화: the drawn walk (createWalkers) on the real island ground, trees and plaza props, plus
// props the route grid does not know -- dropped right on the islanders' routes --
// over ten minutes of frames: always on standable ground, never inside a circle, never through one another, never
// far from the shared round and back on it once past, and two screens that started at different times agree.
const { R, SEP } = P.WALKER;
const DT = 1 / 30;

function world(extra = []) {
  const pp = T.plazaProps();
  const solids = [...T.natureSolids(), ...T.STATUE_SPOTS.map((s) => ({ x: s.x, z: s.z, r: 1.3 })), { x: 0, z: 0, r: 3.4 },
    ...pp.benches, ...pp.lamps, ...pp.beds, ...T.RESERVED_LOTS.map((l) => ({ x: l.x, z: l.z, r: 3.2 })), ...extra];
  const GRID = 8; const grid = new Map();
  for (const s of solids) {
    const reach = s.r + 0.5;
    for (let gx = Math.floor((s.x - reach) / GRID); gx <= Math.floor((s.x + reach) / GRID); gx += 1) {
      for (let gz = Math.floor((s.z - reach) / GRID); gz <= Math.floor((s.z + reach) / GRID); gz += 1) {
        const key = `${gx},${gz}`; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(s);
      }
    }
  }
  return { solids, solidsNear: (x, z) => grid.get(`${Math.floor(x / GRID)},${Math.floor(z / GRID)}`) || [] };
}
// props on the routes: every 40 s of each round a bench-sized circle just beside the walking line (not on a bridge),
// spaced like the scene's own props -- each leaves a gap an islander fits through next to every other circle
function routeProps() {
  const pp = T.plazaProps();
  const props = []; const others = [...T.natureSolids(), ...T.STATUE_SPOTS.map((s) => ({ x: s.x, z: s.z, r: 1.3 })), ...pp.benches, ...pp.lamps, ...pp.beds];
  for (let n = 0; n < P.COUNT; n += 1) {
    const r = P.round(n);
    for (let t = 7; t < r.period; t += 40) {
      const p = P.at(n, (t - r.phase) * 1000);
      if (!p.moving || T.onBridge(p.x, p.z) || Math.hypot(p.x, p.z) < 6) continue;
      const prop = { x: p.x + Math.cos(p.yaw) * 0.25, z: p.z - Math.sin(p.yaw) * 0.25, r: 0.9 };
      if ([...others, ...props].some((o) => Math.hypot(o.x - prop.x, o.z - prop.z) < o.r + prop.r + 2 * R + 0.1)) continue;
      props.push(prop);
    }
  }
  return props;
}

// Ten minutes of frames; returns what was seen. Every frame: on standable ground and inside no circle.
function run(solidsNear, t0, minutes = 10) {
  const walkers = P.createWalkers({ walkable: T.walkable, solidsNear });
  for (let n = 0; n < P.COUNT; n += 1) walkers.add(n, t0);
  let minPair = Infinity; let maxOff = 0; let maxSpell = 0; let maxStep = 0; let avoided = 0; const spell = new Array(P.COUNT).fill(0);
  for (let k = 1; k <= minutes * 60 * 30; k += 1) {
    const before = walkers.list.map((w) => [w.x, w.z]);
    walkers.step(t0 + k * DT * 1000, DT);
    for (const [i, w] of walkers.list.entries()) {
      assert.ok(T.walkable(w.x, w.z), `n${w.n} frame ${k}: 설 수 있는 땅`);
      assert.ok(walkers.clear(w.x, w.z), `n${w.n} frame ${k}: 장애물 안이 아님 (${w.x.toFixed(2)}, ${w.z.toFixed(2)})`);
      const off = Math.hypot(w.x - w.bx, w.z - w.bz); maxOff = Math.max(maxOff, off); if (off > 0.2) avoided += 1;
      // frames in a row more than 1 off the round although the round's own point is free (nothing left to step round)
      spell[i] = off > 1 && walkers.clear(w.bx, w.bz) ? spell[i] + 1 : 0; maxSpell = Math.max(maxSpell, spell[i]);
      if (!w.warped) maxStep = Math.max(maxStep, Math.hypot(w.x - before[i][0], w.z - before[i][1]));
    }
    const L = walkers.list;
    for (let i = 0; i < L.length; i += 1) for (let j = i + 1; j < L.length; j += 1) minPair = Math.min(minPair, Math.hypot(L[i].x - L[j].x, L[i].z - L[j].z));
  }
  return { minPair, maxOff, maxSpell, maxStep, avoided, resyncs: walkers.resyncs() };
}

test('배회 NPC 이동(실제 장면): 10분 동안 늘 땅 위·장애물 밖, 서로 겹치지 않고, 경로 가까이에서 막힘 없이 걷는다', () => {
  const seen = run(world().solidsNear, 5_000_000);
  assert.ok(seen.avoided > 0, '서로·소품을 실제로 비켜 갔다');
  assert.ok(seen.minPair >= 2 * R * 0.9, `NPC끼리 몸이 겹치지 않음 (최소 간격 ${seen.minPair.toFixed(3)})`);
  assert.ok(seen.maxOff < 2.5, `경로에서 멀리 벗어나지 않음 (최대 ${seen.maxOff.toFixed(2)})`);
  assert.ok(seen.maxSpell < 3 * 30, `피할 것이 없어지면 3초 안에 경로로 돌아온다 (최장 ${(seen.maxSpell / 30).toFixed(1)}초)`);
  assert.ok(seen.maxStep < 0.3, `순간이동 없음 (한 프레임 최대 ${seen.maxStep.toFixed(3)})`);
  assert.equal(seen.resyncs, 0, '경로로 되돌리는 마지막 수단을 쓰지 않음');
});

test('배회 NPC 이동(가혹한 장면): 경로 위에 경로 계획이 모르는 소품을 깔아도 땅 위·장애물 밖, 겹치지 않고 곧 돌아온다', () => {
  const props = routeProps();
  assert.ok(props.length >= 20, `경로 위 장애물 ${props.length}개`);
  const seen = run(world(props).solidsNear, 5_000_000);
  assert.ok(seen.minPair >= 2 * R * 0.9, `NPC끼리 몸이 겹치지 않음 (최소 간격 ${seen.minPair.toFixed(3)})`);
  assert.ok(seen.maxSpell < 4 * 30, `피할 것이 없어지면 4초 안에 경로로 돌아온다 (최장 ${(seen.maxSpell / 30).toFixed(1)}초)`);
  assert.ok(seen.maxStep < 0.3, `순간이동 없음 (한 프레임 최대 ${seen.maxStep.toFixed(3)})`);
  assert.ok(seen.resyncs <= 3, `끼어서 경로로 되돌린 횟수는 드물다 (${seen.resyncs}회 / 10분·10명)`);
});

test('배회 NPC 이동: 경로를 가로막은 소품 벽에도 끼어 떨지 않고 원 안에 들어가지 않으며, 곧 자기 경로로 돌아간다', () => {
  // a wall of touching props right across islander 0's way (worse than anything the scene has)
  const t0 = 13_000_000; let s = 2; let p = null;
  for (; s < 60; s += 0.5) { p = P.at(0, t0 + s * 1000); if (p.moving && !T.onBridge(p.x, p.z)) break; }
  const wall = [-2, -1, 0, 1, 2].map((k) => ({ x: p.x + Math.cos(p.yaw) * k * 1.2, z: p.z - Math.sin(p.yaw) * k * 1.2, r: 0.75 }));
  const { solidsNear } = world(wall);
  const walkers = P.createWalkers({ walkable: T.walkable, solidsNear });
  const w = walkers.add(0, t0);
  let jitter = 0; let prevMove = null;
  for (let k = 1; k <= (s + 20) * 30; k += 1) {
    const bx = w.x; const bz = w.z;
    walkers.step(t0 + k * DT * 1000, DT);
    assert.ok(walkers.clear(w.x, w.z) && T.walkable(w.x, w.z), `frame ${k}`);
    const mv = [w.x - bx, w.z - bz];
    if (prevMove && mv[0] * prevMove[0] + mv[1] * prevMove[1] < -1e-4) jitter += 1; // reversed direction frame to frame
    prevMove = mv;
  }
  assert.ok(Math.hypot(w.x - w.bx, w.z - w.bz) < 0.5, '벽을 지난 뒤 공유 경로로 돌아옴');
  assert.ok(walkers.resyncs() <= 2, `되돌림은 많아야 두 번 (${walkers.resyncs()})`);
  assert.ok(jitter < 30, `제자리에서 떨지 않음 (방향 반전 ${jitter}프레임)`);
});

test('배회 NPC 이동: 서 있는 사람(나·다른 플레이어·이벤트 방문객)은 비켜 가고 다시 경로로 돌아온다', () => {
  const { solidsNear } = world();
  const walkers = P.createWalkers({ walkable: T.walkable, solidsNear });
  const t0 = 7_000_000;
  const w = walkers.add(0, t0);
  // someone standing a few seconds ahead on its way
  let k = 0; let ahead = null;
  for (let s = 2; s < 60 && !ahead; s += 0.5) { const p = P.at(0, t0 + s * 1000); if (p.moving && !T.onBridge(p.x, p.z)) ahead = { x: p.x, z: p.z, r: 0.45, s }; }
  assert.ok(ahead);
  let closest = Infinity;
  for (; k < (ahead.s + 6) * 30; k += 1) {
    walkers.step(t0 + (k + 1) * DT * 1000, DT, [ahead]);
    closest = Math.min(closest, Math.hypot(w.x - ahead.x, w.z - ahead.z));
  }
  assert.ok(closest >= R + ahead.r - 1e-6, `사람을 통과하지 않음 (최소 ${closest.toFixed(3)})`);
  for (let j = 0; j < 90; j += 1) walkers.step(t0 + (k + 1 + j) * DT * 1000, DT);
  assert.ok(Math.hypot(w.x - w.bx, w.z - w.bz) < 0.05, '지나간 뒤 공유 경로로 돌아옴');
});

test('배회 NPC 이동: 다른 시각에 들어온 두 화면도 곧 같은 자리를 보이고, 오래 멈췄던 화면은 바로 경로로 돌아간다', () => {
  const props = routeProps();
  const a = P.createWalkers({ walkable: T.walkable, solidsNear: world(props).solidsNear });
  const b = P.createWalkers({ walkable: T.walkable, solidsNear: world(props).solidsNear });
  const t0 = 9_000_000; const late = 45 * 30; // b opens the island 45 s later
  for (let n = 0; n < P.COUNT; n += 1) a.add(n, t0);
  let apart = 0; let frames = 0; let worst = 0;
  for (let k = 1; k <= 6 * 60 * 30; k += 1) {
    const ms = t0 + k * DT * 1000;
    if (k === late) for (let n = 0; n < P.COUNT; n += 1) b.add(n, ms);
    a.step(ms, DT); if (k > late) b.step(ms, DT);
    if (k < late + 3 * 30) continue; // give the later screen a few seconds
    for (let i = 0; i < P.COUNT; i += 1) {
      const d = Math.hypot(a.list[i].x - b.list[i].x, a.list[i].z - b.list[i].z);
      worst = Math.max(worst, d); if (d > 0.3) apart += 1; frames += 1;
    }
  }
  assert.ok(worst < 2.5, `두 화면 차이는 작다 (최대 ${worst.toFixed(2)})`);
  assert.ok(apart / frames < 0.03, `두 화면이 0.3 넘게 다른 시간은 잠깐 (${(100 * apart / frames).toFixed(2)}%)`);

  // a tab that slept for ten minutes: straight back on the shared round, not a long walk over
  const ms = t0 + 6 * 60 * 1000 + 10 * 60 * 1000;
  a.step(ms, 0.05);
  // (as in run(): when a prop dropped on the round covers the round's own point, the islander waits right beside it)
  for (const w of a.list) { assert.ok(Math.hypot(w.x - w.bx, w.z - w.bz) < (a.clear(w.bx, w.bz) ? 1 : 1.5) && a.clear(w.x, w.z), `n${w.n} 바로 경로로`); assert.ok(w.warped || Math.hypot(w.x - w.px, w.z - w.pz) < 1.5, `n${w.n} 먼 거리를 한 번에 쓸고 가지 않음`); }
});

test('배회 NPC 이동: 정확히 같은 자리에 겹쳐 생겨도 서로 비켜서고, 물·장애물로 밀려나지 않는다', () => {
  const { solidsNear } = world();
  const walkers = P.createWalkers({ walkable: T.walkable, solidsNear });
  const a = walkers.add(0, 11_000_000); const b = walkers.add(1, 11_000_000);
  b.x = a.x; b.z = a.z; b.bx = a.bx; b.bz = a.bz; // the same point (as if both rounds met there)
  walkers.list.length = 2;
  walkers.step(11_000_000, 0); walkers.step(11_000_000, 0);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= SEP * 0.9);
  for (const w of [a, b]) { assert.ok(T.walkable(w.x, w.z)); assert.ok(walkers.clear(w.x, w.z)); }
});
