'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain.js');
const { createIslandEvents, TYPES, ACTIVE, GAP, NEAR } = require('../lib/island-events');

// v1.10.11 서버 공용 랜덤 이벤트: 15 out (14 everyday finds + 1 NPC event), each on ground that fits it and clear of
// everything; one taker only; a solved one is replaced elsewhere; a lost thing is returned by whoever carries it.
function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

test('공용 이벤트: 15개 유지, NPC 이벤트 1개, 종류별 상한, 지형에 맞고 서로·시설·나무와 겹치지 않는다', () => {
  for (const seed of [1, 2, 3]) {
    const ev = createIslandEvents({ random: seeded(seed) });
    const list = [...ev.events.values()];
    assert.equal(list.length, ACTIVE);
    assert.equal(list.filter((e) => TYPES[e.type].npc).length, 1, 'NPC 이벤트는 하나');
    for (const [type, def] of Object.entries(TYPES)) if (def.max) assert.ok(list.filter((e) => e.type === type).length <= def.max, type);
    const places = list.flatMap((e) => [{ x: e.x, z: e.z }, ...(e.npc && (e.npc.x !== e.x || e.npc.z !== e.z) ? [e.npc] : [])]);
    for (const p of places) {
      assert.ok(T.walkable(p.x, p.z), '설 수 있는 곳');
      assert.ok(Math.hypot(p.x, p.z) > T.PLAZA_R + 3, '중앙광장 밖');
      for (const s of Object.values(T.SPOTS)) assert.ok(Math.hypot(p.x - s.x, p.z - s.z) >= 7, '시설과 떨어짐');
    }
    for (let i = 0; i < places.length; i += 1) for (let j = i + 1; j < places.length; j += 1) assert.ok(Math.hypot(places[i].x - places[j].x, places[i].z - places[j].z) >= GAP - 1e-6, '이벤트끼리 겹치지 않음');
    for (const e of list) {
      if (e.type === 'beach_trash') assert.ok(T.coastDist(e.x, e.z) < 8, '해안 쓰레기는 해안');
      if (e.type === 'grass_trash') assert.ok(T.coastDist(e.x, e.z) > 9, '풀밭 쓰레기는 풀밭');
    }
  }
});

test('공용 이벤트: 한 사람만 가져가고, 해결하면 그 자리를 피해 새로 생겨 15개를 유지한다', () => {
  const ev = createIslandEvents({ random: seeded(7) });
  const e = [...ev.events.values()].find((x) => !TYPES[x.type].npc);
  const at = { x: e.x, z: e.z };
  assert.equal(ev.claim(e.id, 'guest:a', { x: e.x + 10, z: e.z }).error, 'TOO_FAR');
  const first = ev.claim(e.id, 'guest:a', at);
  assert.ok(first.event);
  assert.equal(ev.claim(e.id, 'guest:b', at).error, 'GONE', '동시에 두 번째는 실패');
  assert.equal(ev.settle(first, false, 'guest:a'), null); // the bag was full: it stays
  const again = ev.claim(e.id, 'guest:b', at);
  assert.ok(again.event, '실패하면 다른 사람이 가져갈 수 있다');
  assert.equal(ev.settle(again, true, 'guest:b').removed, e.id);
  assert.equal(ev.size(), ACTIVE);
  assert.ok(!ev.events.has(e.id));
  for (const n of ev.events.values()) assert.ok(Math.hypot(n.x - at.x, n.z - at.z) >= 7 || n.createdAt <= e.createdAt);
  assert.equal(ev.claim(e.id, 'guest:c', at).error, 'GONE');
});

test('공용 이벤트: 분실물은 주운 사람만 주인에게 돌려주고, 돌려주면 끝난다', () => {
  let t = 1_000_000;
  const ev = createIslandEvents({ random: seeded(5), now: () => t }); let lost;
  for (let k = 0; k < 60 && !lost; k += 1) { // photo requests are taken until someone has lost something
    const npcEvent = [...ev.events.values()].find((e) => TYPES[e.type].npc);
    if (npcEvent.type === 'lost') lost = npcEvent;
    else ev.settle(ev.claim(npcEvent.id, 'guest:z', npcEvent), true, 'guest:z');
  }
  assert.ok(lost, '분실물 이벤트');
  const item = { x: lost.x, z: lost.z }; const owner = lost.npc;
  assert.ok(Math.hypot(item.x - owner.x, item.z - owner.z) > 12);
  const view = ev.nearby(owner.x, owner.z, 'guest:a');
  assert.equal(view.find((v) => v.kind === 'lost_owner').verb, '말 걸기', '줍기 전에는 주인이 부탁한다(v1.10.34)');
  const pick = ev.claim(lost.id, 'guest:a', item);
  assert.equal(pick.action, 'pickup');
  assert.deepEqual(ev.settle(pick, true, 'guest:a'), { carried: lost.id });
  assert.equal(ev.nearby(owner.x, owner.z, 'guest:a').find((v) => v.kind === 'lost_owner').verb, '돌려주기');
  assert.equal(ev.nearby(owner.x, owner.z, 'guest:b').find((v) => v.kind === 'lost_owner').verb, null, '다른 사람에게는 돌려주기 없음');
  assert.equal(ev.claim(lost.id, 'guest:b', owner).error, 'GONE');
  const back = ev.claim(lost.id, 'guest:a', owner);
  assert.equal(back.action, 'return');
  assert.equal(ev.settle(back, true, 'guest:a').removed, lost.id);
  assert.equal([...ev.events.values()].filter((e) => TYPES[e.type].npc).length, 1, '다음 NPC 이벤트');
  // an NPC event nobody takes up ends after a while and another starts
  const next = [...ev.events.values()].find((e) => TYPES[e.type].npc);
  t += 26 * 60 * 1000;
  assert.ok(ev.expire().includes(next.id));
  assert.equal(ev.size(), ACTIVE);
});

test('공용 이벤트: 플레이어에게는 가까운 것만 알린다', () => {
  const ev = createIslandEvents({ random: seeded(11) });
  const all = [...ev.events.values()];
  const near = ev.nearby(0, 0, 'guest:a');
  assert.ok(near.length < all.length + 1);
  for (const v of near) assert.ok(Math.hypot(v.x, v.z) <= NEAR);
});

// v1.10.32 운반: a lost thing I carry is mine to see wherever I am (its owner's place, for the map), and the account's
// carry is known for the others' view; nobody else carries it
test('운반: 주운 분실물은 어디서든 내 목록에 남고(주인 위치), 다른 계정에는 없다', () => {
  const { createIslandEvents } = require('../lib/island-events');
  let t = 1_000_000;
  const ev = createIslandEvents({ now: () => t, random: (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })() });
  const lost = ev.spawnLost();
  assert.ok(lost && lost.npc);
  const claimed = ev.claim(lost.id, 'acc-a', { x: lost.x, z: lost.z });
  assert.equal(claimed.action, 'pickup');
  ev.settle(claimed, true, 'acc-a');
  const far = ev.nearby(lost.x + 300, lost.z + 300, 'acc-a');
  assert.deepEqual(far.filter((e) => e.kind === 'carrying'), [{ id: lost.id, kind: 'carrying', x: lost.npc.x, z: lost.npc.z, verb: null }]);
  assert.equal(ev.nearby(lost.x, lost.z, 'acc-b').some((e) => e.kind === 'carrying'), false);
  assert.equal(ev.carryOf('acc-a'), lost.id); assert.equal(ev.carryOf('acc-b'), null);
  const back = ev.claim(lost.id, 'acc-a', { x: lost.npc.x, z: lost.npc.z });
  assert.equal(back.action, 'return'); ev.settle(back, true, 'acc-a');
  assert.equal(ev.carryOf('acc-a'), null);
  // a thing still carried by someone else does not stop the next one (tests make one each)
  const one = ev.spawnLost(); ev.settle(ev.claim(one.id, 'acc-c', { x: one.x, z: one.z }), true, 'acc-c');
  assert.ok(ev.spawnLost()?.npc);
  t += 1;
});

// v1.10.34 부탁: talking to the owner of a thing not found yet changes nothing but that I now see it from anywhere (it
// stays where it is, nothing paid); too far is refused; once it is carried there is nothing to ask
test('부탁: 주인에게 말 걸면 그 계정만 멀리서도 물건이 보이고, 멀면 거절, 주운 뒤에는 부탁 없음', () => {
  const { createIslandEvents } = require('../lib/island-events');
  const ev = createIslandEvents({ now: () => 1_000_000, random: (() => { let s = 11; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })() });
  const lost = ev.spawnLost();
  const far = { x: lost.x + 200, z: lost.z + 200 };
  assert.equal(ev.claim(lost.id, 'acc-a', far, { owner: true }).error, 'TOO_FAR');
  assert.equal(ev.nearby(far.x, far.z, 'acc-a').some((e) => e.kind === 'lost_item'), false);
  const owner = ev.nearby(lost.npc.x, lost.npc.z, 'acc-a').find((e) => e.kind === 'lost_owner');
  assert.equal(owner.verb, '말 걸기');
  const talk = ev.claim(lost.id, 'acc-a', { x: lost.npc.x, z: lost.npc.z }, { owner: true });
  assert.equal(talk.action, 'talk'); assert.equal(talk.points, 10000); // v1.10.35 단가
  assert.ok(ev.nearby(far.x, far.z, 'acc-a').some((e) => e.kind === 'lost_item' && e.id === lost.id));
  assert.equal(ev.nearby(far.x, far.z, 'acc-b').some((e) => e.kind === 'lost_item'), false);
  ev.settle(ev.claim(lost.id, 'acc-a', { x: lost.x, z: lost.z }), true, 'acc-a');
  assert.equal(ev.nearby(lost.npc.x, lost.npc.z, 'acc-b').find((e) => e.kind === 'lost_owner').verb, null);
  assert.equal(ev.nearby(lost.npc.x, lost.npc.z, 'acc-a').find((e) => e.kind === 'lost_owner').verb, '돌려주기');
});

// v1.10.39 섬 전체 할로윈: candy bags lie about only in October (Asia/Seoul) and are gone when November comes
test('사탕 주머니 이벤트: 10월에만 나오고 11월이 되면 사라진다', () => {
  let t = Date.parse('2026-10-15T12:00:00+09:00'); let seen = 0;
  for (let seed = 1; seed <= 12; seed += 1) { const ev = createIslandEvents({ random: seeded(seed), now: () => t }); seen += [...ev.events.values()].filter((e) => e.type === 'candy').length; }
  assert.ok(seen > 0, '10월에는 사탕 주머니가 놓인다');
  const ev = createIslandEvents({ random: seeded(3), now: () => t });
  t = Date.parse('2026-11-01T00:01:00+09:00'); ev.expire();
  assert.equal([...ev.events.values()].filter((e) => e.type === 'candy').length, 0);
  assert.equal(ev.size(), 15, '빈자리는 다른 이벤트로 채운다');
});

// v1.10.46: the island's October night (decor, bats, moon) is off from 1 November 00:00 in Seoul, on all of October
test('할로윈 화면: 10월 내내 켜지고 11월 1일 0시(서울)에 꺼진다', () => {
  const T = require('../public/plaza/island-terrain.js');
  assert.equal(T.isHalloween(Date.parse('2026-10-01T00:00:00+09:00')), true);
  assert.equal(T.isHalloween(Date.parse('2026-10-31T23:59:59+09:00')), true);
  assert.equal(T.isHalloween(Date.parse('2026-11-01T00:00:00+09:00')), false);
  assert.equal(T.isHalloween(Date.parse('2026-09-30T23:59:59+09:00')), false);
});
