'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain.js');
const { createIslandEvents, TYPES, RESOURCE_COUNTS, REGEN_MS, ACTIVE, GAP, NEAR } = require('../lib/island-events');

// Shared life resources have per-kind slots and cooldowns; NPC requests keep their separate one-active policy.
// Placement, one taker, shared regrowth, and carried lost things use the same event engine.
function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

test('생활 자원: 15개 제한 없이 모든 종류·20개 나무, 지형/길/충돌 여유', () => {
  for(const seed of [1,2,3]) {
    const ev=createIslandEvents({random:seeded(seed),now:()=>Date.parse('2026-10-08T12:00:00+09:00')});
    const list=[...ev.events.values()]; assert.equal(list.length,ACTIVE);
    for(const [type,count] of Object.entries(RESOURCE_COUNTS)) assert.equal(list.filter(e=>e.type===type).length,count,type);
    assert.equal(list.filter(e=>TYPES[e.type].npc).length,1);
    for(const e of list) if(!e.npc) {
      assert.ok(T.walkable(e.x,e.z)); assert.ok(T.walkDist(e.x,e.z)>=0.35);
      assert.ok(!T.inTownhall(e.x,e.z,3));
      for(const solid of T.natureSolids()) assert.ok(Math.hypot(e.x-solid.x,e.z-solid.z)>solid.r+0.45,'player approach clear');
      if(e.type==='beach_trash') assert.ok(T.coastDist(e.x,e.z)<8);
      if(['herb','mushroom'].includes(e.type)) assert.ok(T.nature().trees.some(t=>Math.hypot(e.x-t.x,e.z-t.z)<3.6));
    }
  }
});
test('생활 자원: 한 사람만 획득, 실패 복원, 종류별 재생·세대 변경·같은 나무', () => {
  let time=Date.parse('2026-10-08T12:00:00+09:00');
  const ev=createIslandEvents({random:seeded(7),now:()=>time});
  for(const type of Object.keys(RESOURCE_COUNTS)) {
    const e=[...ev.events.values()].find(e=>e.type===type),original={x:e.x,z:e.z};
    const c=ev.claim(e.id,'a',e); assert.ok(c.event); assert.equal(ev.claim(e.id,'b',e).error,'GONE');
    ev.settle(c,false,'a'); const winner=ev.claim(e.id,'b',e); ev.settle(winner,true,'b');
    assert.equal(e.state,'growing');assert.equal(ev.claim(e.id,'c',e).error,'GONE');
    const ownView=()=>ev.nearby(e.x,e.z,'a').find(x=>x.id===e.id);
    assert.equal(Boolean(ownView()),type==='berry');if(e.tree) assert.equal(ownView().verb,null);
    time=e.readyAt-1;ev.expire();assert.equal(e.state,'growing');
    time++;ev.expire();assert.equal(e.state,'open');assert.equal(e.generation,2);
    if(e.tree) assert.deepEqual({x:e.x,z:e.z},original);else assert.ok(Math.hypot(e.x-original.x,e.z-original.z)>=15);
  }
  const restart=createIslandEvents({random:seeded(7),now:()=>time});
  assert.ok([...restart.events.keys()].every(id=>!ev.events.has(id)),'restart claim IDs never reused');
});
test('생활 경제: 단가 유지·공용 재생 공급 244,000P/h 이하, 개인 일일 상한 없음', () => {
  const I=require('../lib/island-items');let hourly=0;
  for(const [type,count] of Object.entries(RESOURCE_COUNTS)){const d=TYPES[type];hourly+=count*(d.points || I.priceOf(d.item))*(d.qty||1)*3600000/REGEN_MS[type];}
  assert.equal(hourly,244000);assert.equal(I.DAILY_CAP,Infinity);
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
  assert.equal(ev.size(), ACTIVE - RESOURCE_COUNTS.candy);
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
  assert.equal(ev.size(), ACTIVE - RESOURCE_COUNTS.candy, '계절 종료시 사탕 슬롯만 제외');
});

// v1.10.46: the island's October night (decor, bats, moon) is off from 1 November 00:00 in Seoul, on all of October
test('할로윈 화면: 10월 내내 켜지고 11월 1일 0시(서울)에 꺼진다', () => {
  const T = require('../public/plaza/island-terrain.js');
  assert.equal(T.isHalloween(Date.parse('2026-10-01T00:00:00+09:00')), true);
  assert.equal(T.isHalloween(Date.parse('2026-10-31T23:59:59+09:00')), true);
  assert.equal(T.isHalloween(Date.parse('2026-11-01T00:00:00+09:00')), false);
  assert.equal(T.isHalloween(Date.parse('2026-09-30T23:59:59+09:00')), false);
});
