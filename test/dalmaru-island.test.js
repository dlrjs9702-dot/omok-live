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
