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
  // (a moment the ten walk apart: two passing each other are never both taken -- which moment that is moves with the map's
  // routes, so it is looked for, not fixed)
  let at = 1_000_000; const apart = (t) => { const ps = Array.from({ length: 10 }, (_, n) => Npcs.at(n, t)); return ps.every((p, i) => ps.every((q, j) => j <= i || Math.hypot(p.x - q.x, p.z - q.z) >= Npcs.WALKER.SEP)); };
  while (!apart(at)) at += 1000;
  const all = createIslandResidents({ now: () => at, random: () => 0 });
  const owners = Array.from({ length: 10 }, (_,i) => all.reserve(`event-${i}`).n);
  assert.equal(new Set(owners).size, 10);
  assert.equal(all.reserve('event-10'), null);
});

test('A-6 주민 대화 붙잡기: 창이 열린 동안 멈춤(갱신), 닫거나 갱신이 끊기면 그 자리에서 이어 걷고, 3분을 넘지 않음', () => {
  const { TALK_LEASE, TALK_MAX } = require('../lib/island-residents');
  let t = 1_000_000;
  const r = createIslandResidents({ now: () => t, random: () => 0 });
  const p = Npcs.at(2, t);
  assert.deepEqual(r.talk(2, 'talk:a', 1.5), { ok: true });
  assert.deepEqual(r.talk(2, 'talk:b', 0), { busy: 'talk:a' }); // someone else's talk
  assert.equal(r.reserve('event-x').n, 0); // an event never takes a resident in a talk
  for (let k = 0; k < 10; k += 1) { t += TALK_LEASE - 1000; assert.equal(r.keep(2, 'talk:a'), true); } // kept open
  assert.equal(r.keep(2, 'talk:b'), false);
  assert.equal(r.talkOf('talk:a'), 2);
  assert.deepEqual(Npcs.residentAt(2, t, r.snapshot()[2]), { x: p.x, z: p.z, yaw: 1.5, moving: false, held: true });
  const start = t - 10 * (TALK_LEASE - 1000);
  r.release('talk:a');
  const s = r.snapshot()[2]; assert.equal(s.hold, null); assert.equal(s.delay, t - start);
  const back = Npcs.residentAt(2, t, s); assert.ok(Math.hypot(back.x - p.x, back.z - p.z) < 1e-9); // on from where it stood
  r.talk(2, 'talk:a'); t += TALK_LEASE + 1; assert.equal(r.snapshot()[2].hold, null); // no renewal: let go
  r.talk(3, 'talk:a'); r.talk(4, 'talk:a'); assert.equal(r.talkOf('talk:a'), 4); assert.equal(r.snapshot()[3].hold?.returning ?? null, null); // one at a time
  const t0 = t; for (; t < t0 + TALK_MAX + TALK_LEASE; t += 5000) r.keep(4, 'talk:a');
  assert.equal(r.snapshot()[4].hold, null); // never past TALK_MAX
});

test('주민 대화: 느린 화면이 몇 초 전 자리에서 붙잡으면 그 자리에 멈추고, 놓으면 그 자리에서 이어 걷는다', () => {
  let t = 1_000_000;
  const r = createIslandResidents({ now: () => t, random: () => 0 });
  const seen = Npcs.at(5, t - 3000); // (where the talker's screen had them 3 s ago)
  r.talk(5, 'talk:a', 0, 3000);
  const h = r.snapshot()[5].hold; assert.ok(Math.hypot(h.x - seen.x, h.z - seen.z) < 1e-9);
  t += 10_000; r.release('talk:a');
  const s = r.snapshot()[5]; assert.equal(s.delay, 13_000);
  const p = Npcs.residentAt(5, t, s); assert.ok(Math.hypot(p.x - seen.x, p.z - seen.z) < 1e-9); // on from there
  r.talk(6, 'talk:b', 0, 60_000); assert.equal(r.snapshot()[6].hold.x, Npcs.at(6, t - 5000).x); // (never more than 5 s back)
});
