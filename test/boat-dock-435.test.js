'use strict';
// 1.10.435 A 배·부두 (notes docs/issue-plan-20261128.md, 문제 기록 7f7ee860 · 9fc80a32 · 95bff217 · 3faca5e1 · 1b9f6edf): the boats run with no one at
// the wheel; one boarding walks on (the boat waits for the walk); the hat put away under the roof; a pet on the back deck; the road in front of
// 배 타는 곳 a T (the cars round a 4 m corner, the paint square, its crossing straight), every stop where it stood
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const B = require('../public/plaza/island-boat');
const X = require('../public/plaza/island-taxi');
const T = require('../public/plaza/island-terrain');
const Paths = require('../public/plaza/island-paths');
const scene = fs.readFileSync(path.join(__dirname, '../public/plaza/plaza-scene.js'), 'utf8');
const island = fs.readFileSync(path.join(__dirname, '../public/plaza/island.js'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

test('435 걸어 타기: 탄 사람이 걸어 올 시간만큼 배가 기다림(혼자 · 다 찬 배 · 줄 선 사람), 다 오면 출발', () => {
  const e = B.exitOf('dal', B.OUTER);
  assert.equal(B.walkMsOf('dal', B.OUTER, e.x, e.z), Math.round((B.ABOARD / B.WALK_ON) * 1000 + B.WALK_SPARE));
  const far = B.walkMsOf('dal', B.OUTER, e.x + 12, e.z); assert.ok(far > B.HOLD, `12 m off the step: ${far} ms, longer than the hold`);
  const f = B.createFleet({ now: 0 }); const r = B.board(f, 'dal', 'a', 1000, { x: e.x + 12, z: e.z });
  assert.equal(r.ok, true); assert.equal(r.boat.until, 1000 + far, 'the hold runs till they could be in');
  B.tick(f, 1000 + B.HOLD + 1); assert.equal(r.boat.phase, 'hold', 'not off at the 6 s hold');
  B.tick(f, 1000 + far + 1); assert.equal(r.boat.phase, 'sail', 'off once they are in');
  // full: four on, the last still 12 m off -- it waits for them
  const g = B.createFleet({ now: 0 }); for (const [k, t] of ['a', 'b', 'c'].entries()) B.board(g, 'dal', t, 0, { x: e.x, z: e.z + k * 0.1 });
  const last = B.board(g, 'dal', 'd', 0, { x: e.x + 12, z: e.z }); assert.equal(last.boat.phase, 'hold', 'full but one still walking');
  B.tick(g, B.walkMsOf('dal', B.OUTER, e.x + 12, e.z) + 1); assert.equal(last.boat.phase, 'sail');
  // queued: boarded by the tick where they stand
  const q = B.createFleet({ now: 0 }); for (const b of q.boats) if (b.at === 'dal') b.phase = 'sail';
  assert.equal(B.board(q, 'dal', 'z', 0, { x: e.x, z: e.z }).queued, true); for (const b of q.boats) if (b.phase === 'sail' && !b.to) { b.phase = 'docked'; }
  for (const b of q.boats) if (b.at === 'dal') b.phase = 'docked';
  const out = B.tick(q, 10, { whereOf: () => ({ x: e.x + 8, z: e.z }) }); assert.equal(out.boarded.length, 1);
  const qb = q.boats.find((b) => b.seats.includes('z')); assert.equal(qb.walkUntil, 10 + B.walkMsOf('dal', qb.berth, e.x + 8, e.z));
  assert.match(server, /IslandBoat\.board\(boatFleet, dock, session\.token, now, here\)/); assert.match(server, /whereOf: \(token\) => plazaPresence\.get\(token\) \|\| null/);
});

test('435 화면: 승무원 없음 · 걸어 타기(문 안부터 배와 함께) · 모자 넣기 · 펫은 뒤 갑판', () => {
  assert.doesNotMatch(scene, /CAPTAIN_SHIRTS|o\.cap\.root|captain: o\.cap/, 'no captains');
  assert.match(scene, /const WALK_ON = BT\?\.WALK_ON \?\? 3\.36;/);
  assert.match(scene, /if \(!w\.on && w\.pts\[i\]\.gate\) \{ w\.on = true; w\.pts = w\.pts\.slice\(i\); w\.d = left; assets\.hat\?\.\(c, true\);/);
  assert.match(scene, /if \(!o\?\.pose \|\| \(!w\.on && !\['hold', 'docked', 'back'\]\.includes\(b0\?\.phase\)\)\) return done\(\);/);
  assert.match(scene, /if \(!next && myBoat\) \{ walkOns\.delete\(me\); assets\.hat\?\.\(me, false\);/);
  assert.match(scene, /if \(!bs && o\.boatSeat\) \{ walkOns\.delete\(o\.c\); assets\.hat\?\.\(o\.c, false\);/);
  assert.match(scene, /const PET_DECK = \[2\.9, 2\.9, 2\.2, 2\.2\];/); assert.match(scene, /if \(p\.boat\) \{ p\.c\.play\('Sit'\);/);
  for (const z of [2.2, 2.9]) assert.ok(z > B.NODES.gateZ && z < B.NODES.length / 2, 'the back deck, behind the gate');
});

test('435 부두 앞 T자: 차 길 · 정류장은 그대로, 칠은 곧은 물가 길 · 줄기 끝 · 건널목 곧게', () => {
  /* (the cars keep 434's Y under the painted T -- the rides, stops and fares as they were) */
  const has = (r, pts) => pts.every(([x, z]) => r.some(([a, b]) => a === x && b === z));
  assert.ok(has(X.ROUTE, [[0.4, -16.2], [0.6, -14.3], [1.2, -12.4], [2.1, -10], [2.5, -8.4], [4, -7.7], [7.8, -7.3]]));
  assert.ok(has(X.ROADS[2], [[0.4, -16.2], [-0.6, -14.3], [-1.2, -12.4], [-2.1, -10], [-2.5, -8.4], [-4, -7.7], [-7.8, -7.3]]));
  assert.deepEqual([X.ROADSTOPS.dock.s, X.ROADSTOPS.waterfront.s, X.ROADSTOPS.westWaterfront.d], [52.3, 92.1, 48]);
  /* (each stop where it stood before the T: 434's places) */
  const alongOf = (pts) => { const c = [0]; for (let i = 1; i < pts.length; i += 1) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; };
  const at = (pts, d) => { const c = alongOf(pts); let i = 1; while (i < pts.length - 1 && c[i] < d) i += 1; const t = (d - c[i - 1]) / (c[i] - c[i - 1]); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]; };
  const was = { dock: [3.35, -8.0], waterfront: [41.92, 0.7], museum: [96.02, 63.43], dalkkeut: [101.79, 109.96], isleFork: [-17.77, 141.26], villageMid: [-3.12, 236], villageEast: [105.88, 236], westWaterfront: [-40.9, 0.34], hanokGate: [-61.24, 13.56], stones: [-86.9, 43.69], choseung: [-104.31, 110.47] };
  for (const [id, [x, z]] of Object.entries(was)) { const r = X.ROADSTOPS[id]; const p = r.road ? at(X.ROADS[2], r.d) : (() => { const q = X.atS(r.s); return [q.x, q.z]; })(); assert.ok(Math.hypot(p[0] - x, p[1] - z) < 0.06, `${id} ${p}`); }
  assert.deepEqual(X.CROSSINGS.find((c) => Math.hypot(c.x - 0.59, c.z + 14.4) < 0.01), { x: 0.59, z: -14.4 });
  { const f = Paths.crossFrames(X).find(([x, z]) => Math.hypot(x - 0.4, z + 14.4) < 0.01); assert.ok(f && Math.abs(f[2]) > 0.999, 'its bars square across the painted stem'); }
  // the paint, 0.25 m: the shore road's yellow unbroken across, the mouth marked (no lines), the crossing whole across the stem
  const box = { x0: -8, z0: -18, size: 16 }; const res = 64; const m = Paths.buildRoadMap(T, X, res, box);
  const px = (x, z) => { const i = Math.floor((x - box.x0) / 0.25); const j = Math.floor((z - box.z0) / 0.25); const k = j * res + i; return { g: m[k * 3 + 1], b: m[k * 3 + 2], off: (m[k * 3] / 255 - 0.5) * 2 * Paths.ROAD_RANGE }; };
  for (let x = -7; x <= 7; x += 0.25) { let y = false; for (let z = -8.4; z <= -7.0; z += 0.25) if (Math.abs(px(x, z).off) < 0.2) y = true; assert.ok(y, `the shore road's middle at x ${x}`); }
  for (const [x, z] of [[0.4, -10], [-1.5, -9], [2, -11.4]]) { const p = px(x, z); assert.equal(p.b, Paths.MOUTH, `the mouth at ${x}, ${z}`); }
  for (let x = -1.8; x <= 2.6; x += 0.25) assert.ok(px(x, -14.4).b > 200, `the crossing at x ${x}`);
  assert.match(island, /float mo = smoothstep\(0\.06, 0\.12, rd\.b\) \* \(1\.0 - smoothstep\(0\.38, 0\.46, rd\.b\)\); float lines = \(1\.0 - zb\) \* \(1\.0 - mo\);/);
  assert.deepEqual(X.PAINT_FLIP.slice(0, 1), [X.ROADS[2]], 'L2 painted as if run east, as ROUTE across the T (436: L1 too)');
});
