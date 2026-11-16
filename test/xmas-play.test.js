'use strict';
// 1.10.334 크리스마스 3 ② (notes christmas-boost P2·P3, 사용자 18A·95A·96A·97A, assets 128): the sled hill on the grass south of
// 대청마당 and the two snow forts facing each other between it and the snow field -- where they stand (clear of the walks, the
// water, the island's solids, the statues' niches and the snow field), the run down the hill, the throws; the server's round
// of five throws in the forts' ground for the stamp 「눈싸움 한 판」 once a day
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const rmAtExit = require('../test-support/rm-at-exit');
const { boot } = require('../test-support/test-server');
const X = require('../public/plaza/xmas-play.js');
const T = require('../public/plaza/island-terrain.js');
const C = require('../public/plaza/island-calendar.js');

test('썰매 언덕·눈 요새 자리: 눈사람 밭 남쪽 풀밭·사이 포장, 길·물·막힘·영웅마루 벽감·눈밭과 안 겹침, 마주 보는 요새 둘', () => {
  const S = C.PLACES.snow; const island = [...T.structureSolids(), ...T.natureSolids(), ...(T.villageSolids ? T.villageSolids() : [])];
  const mine = X.solids(); assert.equal(mine.length, 36 + 2 * (2 + 3 * 7), '언덕 원 36 + 요새마다 모서리 2·벽 3×7');
  for (const s of mine) {
    assert.ok(T.walkable(s.x, s.z), `물 위 아님 ${s.x},${s.z}`); assert.ok(T.walkDist(s.x, s.z) >= s.r + 0.5, `산책길 아님 ${s.x},${s.z}`);
    assert.ok(!island.some((q) => Math.hypot(q.x - s.x, q.z - s.z) < (q.r || 0) + s.r + 0.3), `섬 막힘과 안 겹침 ${s.x},${s.z}`);
    assert.ok(!(Math.abs(s.x - S.x) < S.w / 2 + s.r + 0.5 && Math.abs(s.z - S.z) < S.d / 2 + s.r + 0.5), '눈사람 밭 밖');
    for (const n of T.NICHES) assert.ok(Math.hypot(n.x - s.x, n.z - s.z) >= n.m * 0.4 + 2, '영웅마루 벽감 앞 비움');
  }
  for (const s of mine.filter((q) => q.kind === 'hill')) assert.ok(!T.inPlaza(s.x, s.z), '언덕은 대청마당 포장 밖 풀밭');
  const [w, e] = X.FORTS; assert.ok(Math.abs(w.yaw - e.yaw) > 3, '마주 봄'); assert.ok(Math.hypot(w.x - e.x, w.z - e.z) >= 8, '사이 8 m 넘음');
  for (const f of X.FORTS) { const front = X.turn(f, 0, -1); assert.ok(Math.hypot(front.x - (w.x + e.x) / 2, front.z - w.z) < Math.hypot(f.x - (w.x + e.x) / 2, f.z - w.z), '앞(-Z)이 맞은편 쪽'); assert.ok(X.inFight(f.x, f.z), '요새가 던지기 자리 안'); }
  const door = X.hillPoint(0, X.HILL.door); assert.ok(!mine.some((q) => Math.hypot(q.x - door.x, q.z - door.z) < q.r + 0.45), '「썰매 타기」 자리는 비어 있음');
  for (const [, z] of X.RUN.filter(([, z]) => z < 0)) { const p = X.hillPoint(0, z); assert.ok(T.walkable(p.x, p.z) && !island.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < (q.r || 0) + 0.45), `내려온 뒤 미끄러지는 길 ${z}`); }
  assert.ok(C.FESTIVALS.find((f) => f.id === 'christmas-2026').tasks.snowfight, '도장 과제 「눈싸움 한 판」');
});

test('썰매 타기: 꼭대기 출발(높이 2.5 m)에서 0.7 s 앉았다가 길을 따라 내려와 발치 지나 멈춤, 빠르기 6 m/s 안팎', () => {
  assert.equal(X.trackY(X.HILL.startZ), 2.5); assert.equal(X.trackY(0), 0); assert.equal(X.trackY(-3), 0);
  const a = X.rideAt(0); assert.equal(a.z, X.HILL.startZ); assert.equal(a.y, 2.5); assert.equal(X.rideAt(600).z, X.HILL.startZ, '출발 전 앉음');
  let last = Infinity; let fast = 0; for (let i = 1; i < X.RUN.length; i += 1) { const [t0, z0] = X.RUN[i - 1]; const [t1, z1] = X.RUN[i]; assert.ok(z1 <= z0 + 1e-9 && z1 < last + 1e-9); last = z1; if (t1 > t0) fast = Math.max(fast, (z0 - z1) / ((t1 - t0) / 1000)); }
  assert.ok(fast > 4 && fast < 6.5, `가장 빠를 때 ${fast}`); assert.ok(X.RIDE_MS > 4000 && X.RIDE_MS < 8000, `${X.RIDE_MS} ms`);
  const end = X.rideAt(X.RIDE_MS + 1); assert.ok(end.done && end.z < -3 && end.z >= -X.HILL.run, '발치를 지나 미끄러져 멈춤');
  const mid = X.rideAt(2600); assert.ok(mid.pitch > 0.2 && mid.y > 0 && mid.y < 2.5, '비탈에서 앞이 숙어짐');
  const p = X.hillPoint(0, 5); const l = X.hillLocal(p.x, p.z); assert.ok(Math.abs(l.u) < 1e-9 && Math.abs(l.v - 5) < 1e-9 && X.onHill(p.x, p.z));
});

test('눈덩이: 겨눈 사람의 가슴 높이를 지나감, 맞음 판정, 행동 이름(던짐 거리·맞음·썰매)', () => {
  for (const d of [3, 7, 11]) { const b = X.throwOf({ x: 0, y: 0, z: 0 }, 0, d); const s = d / b.vh; const p = X.ballAt(b, s); assert.ok(Math.abs(p.z - d) < 1e-9 && Math.abs(p.y - X.THROW.chest) < 1e-6, `${d} m`); assert.ok(X.hits(p, { x: 0, y: 0, z: d })); }
  assert.ok(!X.hits({ x: 0, y: 2.2, z: 5 }, { x: 0, y: 0, z: 5 }), '머리 위로 지나감'); assert.ok(!X.hits({ x: 0.7, y: 1, z: 5 }, { x: 0, y: 0, z: 5 }), '옆으로 빗나감');
  assert.equal(X.throwAct(0), 'snow:throw:11'); assert.equal(X.throwAct(5.4), 'snow:throw:5'); assert.equal(X.throwAct(1), 'snow:throw:2');
  for (const a of ['snow:hit', 'sled', 'snow:throw:2', 'snow:throw:11']) assert.ok(X.ACTS.includes(a), a);
});

test('눈싸움 서버: 요새 둘레에서만, 0.8 s 간격, 다섯 번째에 도장 「눈싸움 한 판」 하루 한 번', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snowfight-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server; const a = await server.enter(await server.issue('눈싸움')); 
  const clock = (iso) => req('/api/test/festival/clock', null, { at: Date.parse(`${iso}+09:00`) });
  const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
  const throwAt = async (x, z) => { await req('/api/plaza/state', a, { x, z, yaw: 1.57, moving: false, act: 'snow:throw:9', actN: 1 }); return req('/api/island/festival/snowball', a, {}); };
  const F = X.FORTS[0]; const inside = X.turn(F, 0, 1.6);
  try {
    await clock('2026-12-21T12:00:00');
    const far = await throwAt(C.PLACES.snow.x, C.PLACES.snow.z); assert.equal(far.status, 409); assert.equal(far.data.error, 'TOO_FAR', '눈밭에서는 아님');
    const r1 = await throwAt(inside.x, inside.z); assert.equal(r1.status, 200, JSON.stringify(r1.data)); assert.deepEqual([r1.data.throws, r1.data.of, r1.data.added], [1, 5, 0]);
    const fast = await req('/api/island/festival/snowball', a, {}); assert.equal(fast.data.error, 'TOO_FAST', '너무 빨리');
    let last = null; for (let k = 2; k <= 5; k += 1) { await wait(750); last = await req('/api/island/festival/snowball', a, {}); assert.equal(last.status, 200, JSON.stringify(last.data)); }
    assert.equal(last.data.added, 1, '다섯 번째에 도장'); assert.equal(last.data.festival.tasks.find((x) => x.id === 'snowfight').today, 1);
    for (let k = 1; k <= 5; k += 1) { await wait(750); last = await req('/api/island/festival/snowball', a, {}); }
    assert.equal(last.data.error, 'TASK_DONE', '하루 한 번');
  } finally { await clock('2026-11-16T12:00:00').catch(() => {}); }
});
