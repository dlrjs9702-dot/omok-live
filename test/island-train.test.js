'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const T = require('../public/plaza/island-terrain.js');
const R = require('../public/plaza/island-train.js');
const { boot } = require('../test-support/test-server');

test('관광열차: 4역·별도 2노선·3대, 입구는 보행 가능하고 객차 폭 전체가 지상 통행과 분리된다', () => {
  assert.deepEqual(Object.keys(R.STATIONS), ['A', 'B', 'C', 'D']);
  assert.deepEqual(R.TRAINS.map((t) => t.id), [1, 2, 3]);
  assert.equal(R.PLATFORMS.length, 6);
  for (const st of Object.values(R.STATIONS)) assert.ok(T.walkable(...st.entry));
  for (const L of Object.values(R.LINES)) {
    const r = L.route;
    for (let i = 0; i < r.S.length; i++) {
      const p = R.pointAt(L === R.LINES.outer ? 'outer' : 'view', r.S[i]);
      for (const w of [-1.56, -0.78, 0, 0.78, 1.56]) {
        const x = p.x + Math.cos(p.yaw) * w; const z = p.z - Math.sin(p.yaw) * w;
        if (T.walkable(x, z)) assert.ok(p.y - R.CAR.under - T.heightAt(x, z) >= R.CLEAR, '객차 아래 보행 여유');
      }
    }
  }
  for (const id of ['C', 'D']) {
    const platforms = R.PLATFORMS.filter((p) => p.station === id);
    assert.ok(platforms.find((p) => p.line === 'view').y - platforms.find((p) => p.line === 'outer').y > 6);
  }
  const outer = R.LINES.outer.route; const view = R.LINES.view.route;
  for (let i = 0; i < outer.S.length; i++) for (let j = 0; j < view.S.length; j++) {
    if (Math.hypot(outer.xs[i] - view.xs[j], outer.zs[i] - view.zs[j]) < 3.5) assert.ok(Math.abs(outer.ys[i] - view.ys[j]) > 4, '겹치는 선로의 객차·하부 여유');
  }
  for (const p of R.PLATFORMS) assert.ok(Math.abs(p.y - p.car.y - 0.55) < 1e-9);
  assert.ok(T.riverExtra(-22.64, -34.18) > 3);
  assert.equal(T.riverExtra(50, 50), 0);
});

test('관광열차 시간표: 구간60초·정차10초·회차210초·외곽105초 간격·전망35초 출발', () => {
  assert.equal(R.CYCLE, 210);
  const at = (id, sec) => R.timetableAt(id, sec * 1000);
  assert.equal(at(1, 0).stop, null); assert.equal(at(1, 60).stop, 'B'); assert.equal(at(1, 69.9).stop, 'B');
  assert.equal(at(1, 70).stop, null); assert.equal(at(1, 130).stop, 'C'); assert.equal(at(1, 200).stop, 'D');
  assert.equal(at(2, 165).stop, 'B'); assert.equal(at(3, 95).stop, 'C'); assert.equal(at(3, 165).stop, 'D'); assert.equal(at(3, 235).stop, 'A');
  for (let sec = 0; sec < 420; sec += 0.5) {
    const a = at(1, sec); const b = at(2, sec);
    if (!a.stop && !b.stop) assert.notEqual(a.from, b.from, '같은 구간 동시 점유 없음');
  }
  const traffic = R.createTraffic(0);
  for (let sec = 0; sec < 420; sec += 0.25) for (const c of traffic.advance(sec * 1000).clocks) {
    assert.equal(c.held, false); assert.equal(c.cursor, sec * 1000, '정상 운행은 시간표와 일치');
  }
});

test('관광열차 안전정지: 막힌 구간 앞에서 대기·후속열차도 대기, 해제 뒤 현재 위치에서 출발', () => {
  const traffic = R.createTraffic(0); traffic.block('outer:segment:D', true);
  const stopped = traffic.advance(100000);
  assert.equal(stopped.clocks[0].cursor, 0); assert.equal(stopped.clocks[0].held, true);
  assert.equal(stopped.clocks[1].held, true, 'D역 점유 때문에 C에서 후속열차 대기');
  assert.equal(stopped.clocks[2].cursor, 100000, '전망 노선은 별도 운행');
  const keys = traffic.reservations().flatMap((r) => r.keys); assert.equal(new Set(keys).size, keys.length);
  traffic.block('outer:segment:D', false);
  const resumed = traffic.advance(101000); assert.equal(resumed.clocks[0].cursor, 1000);
  R.setService(stopped); assert.equal(R.trainAt(1, 180000).s, R.timetableAt(1, 0).s, '화면도 안전정지 유지');
  R.setService(resumed); assert.ok(R.trainAt(1, 101500).s < 1, '시간표 따라잡기 순간이동 없음');
  R.setService(null);
});

test('관광열차 서버: 탑승창·4좌석 경합·이동 잠금·운행중 하차 금지·C 환승·이탈 좌석 해제', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'train-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const riders = []; for (let i = 0; i < 5; i++) riders.push(await server.enter(await server.issue('승객' + i)));
  const a = riders[0]; const A = R.stationOf('A'); const C = R.stationOf('C');
  const shiftTo = (sec) => { const now = Date.now(); const target = Math.ceil(now / 210000) * 210000 + sec * 1000; return req('/api/test/train-shift', a, { ms: target - now }); };
  for (const rider of riders) await req('/api/plaza/state', rider, { ...A.spot, yaw: 0, moving: false });
  for (const rider of riders) assert.equal((await req('/api/island/train/platform', rider, { stop: 'A', line: 'view' })).status, 200);
  assert.equal((await req('/api/island/train/platform', a, { stop: 'D', line: 'outer' })).data.error, 'TOO_FAR');
  await shiftTo(40);
  assert.equal((await req('/api/island/train/board', a, { stop: 'A' })).data.error, 'NO_TRAIN');
  assert.equal((await req('/api/island/train/board', a, { stop: 'nowhere' })).status, 400);
  await shiftTo(238);
  assert.equal((await req('/api/island/train/board', a, { stop: 'A', line: 'outer' })).status, 400);
  const seats = new Set();
  for (const rider of riders.slice(0, 4)) { const on = await req('/api/island/train/board', rider, { stop: 'A', line: 'view' }); assert.equal(on.status, 200, JSON.stringify(on.data)); assert.equal(on.data.train, 3); seats.add(on.data.seat); }
  assert.equal(seats.size, 4);
  assert.equal((await req('/api/island/train/board', riders[4], { stop: 'A' })).data.error, 'TRAIN_FULL');
  assert.equal((await req('/api/island/train/board', a, { stop: 'A' })).data.error, 'ALREADY_RIDING');
  const pose = await req('/api/plaza/state', a, { x: 0, z: 0, yaw: 0, moving: true });
  assert.equal(pose.data.ride.id, 3); assert.equal(pose.data.corrected, false); assert.ok(pose.data.trainService);
  await shiftTo(270); assert.equal((await req('/api/island/train/alight', a, {})).data.error, 'MOVING');
  await shiftTo(308); const off = await req('/api/island/train/alight', a, {});
  assert.equal(off.status, 200, JSON.stringify(off.data)); assert.equal(off.data.stop, 'C'); assert.equal(off.data.platform.station, 'C'); assert.equal(off.data.platform.line, 'view');
  assert.equal((await req('/api/island/train/platform', a, { stop: 'C', line: 'outer' })).status, 200);
  await shiftTo(343); const transfer = await req('/api/island/train/board', a, { stop: 'C', line: 'outer' });
  assert.equal(transfer.status, 200, JSON.stringify(transfer.data)); assert.equal(transfer.data.train, 1);
  await req('/api/plaza/leave', a, {});
  assert.equal((await req('/api/island/train/alight', a, {})).data.error, 'NOT_RIDING');
  const after = await req('/api/plaza/state', a, { ...C.spot, yaw: 0, moving: false }); assert.equal(after.data.ride, null); assert.equal(after.data.platform, null);
  assert.equal((await req('/api/island/train/board', a, { stop: 'C', line: 'outer' })).data.error, 'TOO_FAR', '지상에서 공중 좌석 직접 탑승 금지');
});
