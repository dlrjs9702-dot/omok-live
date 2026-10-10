'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Npcs = require('../public/plaza/island-npcs');
const { createIslandResidents } = require('../lib/island-residents');

test('주민 예약: 동일 주민/이벤트/위치는 공용이며 중복 예약·외부 스냅샷 변조를 막는다', () => {
  let t = 1_000_000;
  const r = createIslandResidents({ now: () => t, random: () => 0 });
  const a = r.reserve('event-a');
  assert.equal(a.n, 0);
  assert.deepEqual(r.reserve('event-a'), a);
  const b = r.reserve('event-b');
  assert.equal(b.n, 1);
  const first = r.snapshot(); first[0].hold.x += 999; first[0].delay += 999;
  const second = r.snapshot();
  assert.equal(second.length, 10);
  assert.equal(second[0].hold.x, a.x);
  assert.equal(second[0].delay, 0);
  t += 20_000;
  assert.deepEqual(Npcs.residentAt(0, t, second[0]), { x: a.x, z: a.z, yaw: a.yaw, moving: false, held: true });
  assert.equal(r.snapshot()[0].hold.eventId, 'event-a');
});

test('주민 예약: 취소/만료 해제 후 같은 경로 위치에서 재개하고 다른 예약은 유지한다', () => {
  let t = 1_000_000;
  const r = createIslandResidents({ now: () => t, random: () => 0 });
  const a = r.reserve('event-a'); r.reserve('event-b');
  t += 900_000;
  assert.equal(r.release('event-a'), true);
  const state = r.snapshot();
  assert.equal(state[0].hold, null);
  assert.equal(state[0].delay, 900_000);
  const p = Npcs.residentAt(0, t, state[0]);
  assert.ok(Math.hypot(p.x-a.x,p.z-a.z)<1e-8);
  assert.equal(state[1].hold.eventId, 'event-b');
  t += 1000;
  assert.deepEqual(Npcs.residentAt(0,t,r.snapshot()[0]), Npcs.at(0,t-900_000));
  assert.equal(r.release('event-a'), false);
});

test('주민 예약: 실제 전달 동안 대기하고 늦은 조회도 정확한 재개 시각을 공유한다', () => {
  let t = 1_000_000;
  const r = createIslandResidents({ now: () => t, random: () => 0 });
  const a = r.reserve('event-a'); t += 5000;
  r.release('event-a', 2100); r.release('event-a', 2100);
  assert.equal(r.snapshot()[0].hold.returning, true);
  t += 2099;
  assert.equal(r.snapshot()[0].hold.eventId, 'event-a');
  t += 1;
  const p = Npcs.residentAt(0,t,r.snapshot()[0]);
  assert.ok(Math.hypot(p.x-a.x,p.z-a.z)<1e-8);
  t += 30_000;
  assert.equal(r.snapshot()[0].delay, 7100);
  assert.deepEqual(Npcs.residentAt(0,t,r.snapshot()[0]), Npcs.at(0,t-7100));
});

test('주민 예약: 안전 위치의 기존10명만 사용하고 가용 주민이 없으면 기다린다', () => {
  const r = createIslandResidents({ now: () => 1_000_000, random: () => 0, isSafe: () => false });
  assert.equal(r.reserve('event-a'), null);
  assert.ok(r.snapshot().every(s => s.hold === null));
  const all = createIslandResidents({ now: () => 1_000_000, random: () => 0 });
  const owners = Array.from({ length: 10 }, (_,i) => all.reserve(`event-${i}`).n);
  assert.equal(new Set(owners).size, 10);
  assert.equal(all.reserve('event-10'), null);
});
