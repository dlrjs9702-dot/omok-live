'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const T = require('../public/plaza/island-terrain.js');
const R = require('../public/plaza/island-train.js');
const { boot } = require('../test-support/test-server');

// 달마루섬 5단계 (gamecenter-notes docs/dalmaru-implementation-20261019.md): the server's own island (ISLAND_MAP=dalmaru) --
// its seasons, its tourist train's high ring and four stations, a ride between two of them. On 지금 섬 these are skipped
// (island-train.test.js and the season tests there are its own).
const ON = T.MAP === 'dalmaru'; const skip = !ON && '달마루섬 전용 (ISLAND_MAP=dalmaru)';

test('달마루섬 계절: 대청마당은 중립, 네 구역이 모두 있고 날마다 돈다', { skip }, () => {
  const P = T.dalmaru.PLAZA; assert.equal(T.seasonZoneAt(P.x, (P.d0 + P.d1) / 2), -1);
  const zones = new Set(); for (let a = 0; a < 360; a += 10) for (const r of [60, 120, 150]) { const x = r * Math.cos((a * Math.PI) / 180); const z = r * Math.sin((a * Math.PI) / 180); if (T.walkable(x, z)) zones.add(T.seasonZoneAt(x, z)); }
  zones.add(T.seasonZoneAt(T.dalmaru.ISLE.x, T.dalmaru.ISLE.z));
  assert.deepEqual([...zones].filter((z) => z >= 0).sort(), [0, 1, 2, 3]);
  const day = Date.parse('2026-10-20T12:00:00+09:00'); const seasons = (ms) => [0, 1, 2, 3].map((z) => T.zoneSeason(z, T.seasonDay(ms)));
  assert.equal(new Set(seasons(day)).size, 4, '날마다 네 계절');
  assert.notDeepEqual(seasons(day), seasons(day + 86400000), '서울 00:00에 돈다');
});

test('달마루섬 관광열차: 바깥 높은 고리·역 4곳(땅 위 승강기)·4대가 1/4 바퀴 간격, 걷는 땅 위로는 여유', { skip }, () => {
  assert.deepEqual(Object.keys(R.STATIONS), ['E', 'I', 'W', 'N']); assert.deepEqual(R.LINES.tour.order, ['E', 'I', 'W', 'N']);
  assert.equal(R.PLATFORMS.length, 4); assert.deepEqual(R.TRAINS.map((t) => t.id), [1, 2, 3, 4]);
  for (const id of Object.keys(R.STATIONS)) {
    const lift = R.liftOf(id); const entry = R.STATIONS[id].entry;
    assert.ok(T.walkable(lift.x, lift.z) && T.walkable(...entry), `${id} 승강기·입구는 땅 위`);
    const p = R.PLATFORMS.find((q) => q.station === id); assert.ok(Math.hypot(p.x, p.z) < Math.hypot(p.car.x, p.car.z), `${id} 승강장은 섬 쪽`);
  }
  const r = R.LINES.tour.route; assert.ok(r.LENGTH > 1000, '섬 바깥 한 바퀴');
  for (let i = 0; i < r.S.length; i += 2) { const p = R.pointAt('tour', r.S[i]); if (T.walkable(p.x, p.z)) assert.ok(p.y - R.CAR.under - T.heightAt(p.x, p.z) >= R.CLEAR, '걷는 땅 위 여유'); }
  const offsets = R.TRAINS.map((t) => t.offset); assert.deepEqual(offsets, [0, 1, 2, 3].map((k) => Math.round((R.CYCLE * k) / 4)));
  // one train round: every station in order, each dwell the same
  const seen = []; for (let s = 0; s < R.CYCLE; s += 0.5) { const st = R.timetableAt(1, s * 1000).stop; if (st && seen.at(-1) !== st) seen.push(st); }
  assert.deepEqual(seen, ['I', 'W', 'N', 'E']); // (from 달끝역 at the round's start)
  const traffic = R.createTraffic(0);
  for (let sec = 0; sec < R.CYCLE * 2; sec += 0.5) { for (const c of traffic.advance(sec * 1000).clocks) assert.equal(c.held, false); const keys = traffic.reservations().flatMap((x) => x.keys); assert.equal(new Set(keys).size, keys.length); }
});

test('달마루섬 관광열차 서버: 첫 역에서 타고 다음 역에서 내린다', { skip }, async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dal-train-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('달마루승객')); const [S0, S1] = R.LINES.tour.order; const A = R.stationOf(S0);
  const at = (from, test) => { let ms = from; while (!test(ms)) ms += 250; return ms; };
  const shift = (target) => req('/api/test/train-shift', a, { ms: target - Date.now() });
  await req('/api/plaza/state', a, { ...A.spot, yaw: 0, moving: false });
  assert.equal((await req('/api/island/train/platform', a, { stop: S0, line: 'tour' })).status, 200);
  const docked = at(Date.now(), (ms) => R.docked(ms, S0).some((d) => d.id === 1) && R.docked(ms + 2500, S0).some((d) => d.id === 1));
  await shift(docked); const on = await req('/api/island/train/board', a, { stop: S0, line: 'tour' });
  assert.equal(on.status, 200, JSON.stringify(on.data)); assert.equal(on.data.train, 1);
  await shift(docked + 20000); assert.equal((await req('/api/island/train/alight', a, {})).data.error, 'MOVING');
  const next = at(docked + 20000, (ms) => R.docked(ms, S1).some((d) => d.id === 1) && R.docked(ms + 2500, S1).some((d) => d.id === 1));
  await shift(next); const off = await req('/api/island/train/alight', a, {});
  assert.equal(off.status, 200, JSON.stringify(off.data)); assert.equal(off.data.stop, S1);
});

// (관광열차 운행: the server catches the trains up on each request -- at today's absolute times and with the tests' clock
// shifts it must always finish at once; a step under the times' float resolution once spun for minutes and the server
// stopped answering)
test('관광열차 운행 따라잡기: 지금 시각·시험의 시계 옮기기에서도 바로 끝남', () => {
  const round = R.CYCLE * 1000; let worst = 0;
  for (let trial = 0; trial < 40; trial += 1) {
    const now0 = Date.now() + trial * 7777; const traffic = R.createTraffic(now0);
    for (const sec of [10, 40, 70, 100, 130, 0, 25, 55]) { const now = now0 + trial * 1000; const t0 = Date.now(); traffic.advance(Math.ceil(now / round) * round + sec * 1000); worst = Math.max(worst, Date.now() - t0); }
  }
  assert.ok(worst < 500, `${worst} ms`);
});

// 문제 기록 14 「빈 집터가 공중에 떠 있어」: every home lot on 툇마루섬's flat top, its whole 10 x 10 m square level and at
// least 2 m in from where the beach starts to fall (7 m from the water)
// (2회차 15 「집터가 길을 침범하고 집끼리도 겹쳐. 섬을 더 확장해서 정리해」: the isle wider toward 윤슬만; a 큰 집 with its veranda,
// 6.5 m round, on each lot: 3 m off the shore all round, 2 m clear of the walks -- not its own door way -- and of each other)
test('툇마루섬 집터: 12곳 모두 평평한 땅, 큰 집 둘레가 해안에서 3m·길과 서로 2m 이상', { skip }, () => {
  const bad = []; const H = require('../public/plaza/island-home.js'); const R = 6.5;
  const seg = (px, pz, ax, az, bx, bz) => { const dx = bx - ax; const dz = bz - az; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
  for (const l of H.LOTS) {
    for (let dx = -5; dx <= 5; dx += 1) for (let dz = -5; dz <= 5; dz += 1) if (Math.abs(T.heightAt(l.x + dx, l.z + dz) - 0.9) > 0.05) { bad.push(`${l.id} flat`); dx = dz = 99; }
    for (let a = 0; a < 24; a += 1) { const t = (a / 24) * Math.PI * 2; if (T.dalmaru.coastDist(l.x + Math.cos(t) * R, l.z + Math.sin(t) * R) < 3) { bad.push(`${l.id} shore`); break; } }
    const door = H.doorOf(l, 2);
    for (const w of T.walkCurves) { if (w.w === 2 && Math.hypot(w.pts[0][0] - door.x, w.pts[0][1] - door.z) < 1) continue; let d = Infinity; for (let i = 1; i < w.pts.length; i += 1) d = Math.min(d, seg(l.x, l.z, ...w.pts[i - 1], ...w.pts[i])); if (d - w.w / 2 - R < 1.95) bad.push(`${l.id} walk ${(d - w.w / 2 - R).toFixed(2)}`); }
    for (const o of H.LOTS) if (o !== l && Math.hypot(o.x - l.x, o.z - l.z) < 2 * R + 1.95) bad.push(`${l.id}~${o.id}`);
  }
  assert.equal(T.HOME_LOTS.length, 12); assert.deepEqual(bad, []);
});

// (넓힌 툇마루섬과 본섬 둘레: walked to the waterline's sand and no further -- no walkable ground under the water)
test('섬 둘레: 본섬·툇마루섬 해안에서 물 아래는 걸을 수 없음', { skip }, () => {
  const D = T.dalmaru; const wet = [];
  const ring = (cx, cz, r0, r1) => { for (let a = 0; a < Math.PI * 2; a += Math.PI / 180) for (let r = r0; r < r1; r += 0.5) { const x = cx + Math.cos(a) * r; const z = cz + Math.sin(a) * r; if (!T.onBridge(x, z) && T.walkable(x, z) && T.heightAt(x, z) < D.SEA - 0.05) wet.push([+x.toFixed(1), +z.toFixed(1)]); } };
  ring(D.ISLE.x, D.ISLE.z, D.ISLE.r - 6, D.ISLE.r + 12); ring(0, 0, 150, 190);
  assert.deepEqual(wet.slice(0, 5), []);
});

// (등록부의 사계절 모델: every season zone holds each tree kind the seasonal models are for -- 툇마루섬, a zone of its own,
// once had a day without its tall trees)
test('계절 구역마다 나무 종류(둥근·층층·키 큰·꽃)가 모두 있음', { skip }, () => {
  const H = T.harvestTrees(); const by = {};
  for (const t of T.nature().trees) { if (H.some((h) => h.x === t.x && h.z === t.z)) continue; const z = T.seasonZoneAt(t.x, t.z); (by[z] ||= new Set()).add(T.treeKind(t)); }
  for (const z of [0, 1, 2, 3]) for (const k of ['round', 'tiered', 'tall', 'blossom']) assert.ok(by[z]?.has(k), `구역 ${z}: ${k}`);
});

// 문제 기록 2회차 4 「길과 다리가 안 이어져」: a walk's bridge meets each bank at its own height (no step off either end)
test('자동 다리: 양 끝이 각자 둑 높이에 닿는다 (단차 10cm 미만), 가운데는 둑보다 높다', () => {
  const auto = T.bridges.filter((b) => !b.model); assert.ok(auto.length >= 1);
  for (const b of auto) {
    for (const s of [-1, 1]) { const on = T.heightAt(b.x + b.ux * s * (b.half - 0.05), b.z + b.uz * s * (b.half - 0.05)); const off = T.heightAt(b.x + b.ux * s * (b.half + 0.3), b.z + b.uz * s * (b.half + 0.3)); assert.ok(Math.abs(on - off) < 0.1, `${b.x.toFixed(1)},${b.z.toFixed(1)} end ${s}: ${on.toFixed(2)} vs ${off.toFixed(2)}`); }
    assert.ok(T.heightAt(b.x, b.z) > Math.max(b.e0, b.e1) + 0.3);
  }
});
