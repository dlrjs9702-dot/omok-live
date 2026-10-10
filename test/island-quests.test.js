'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Q = require('../lib/island-quests');
const T = require('../public/plaza/island-terrain.js');
const { JsonPointStore, PostgresPointStore } = require('../lib/point-store');
const { testDatabase } = require('../test-support/pg-database');

// v1.10.37 연계 퀘스트 1단계: the islanders stand and the places asked for are where one can walk; a story goes talk →
// do → talk (paid, the next step asked at once) to the end (the bonus with the last step); only what the server noted
// counts, a thing to bring is counted in the bag and taken when handed in; each pays once.
const at = (id) => Q.STORIES[id].at;

test('연계 퀘스트: 주민과 목적지는 걸을 수 있는 곳, 시설과 떨어져 있다', () => {
  for (const story of Object.values(Q.STORIES)) {
    assert.ok(T.walkable(story.at.x, story.at.z), story.name);
    for (const s of Object.values(T.SPOTS)) assert.ok(Math.hypot(story.at.x - s.x, story.at.z - s.z) >= 7, `${story.name} 시설과 떨어짐`);
    for (const step of story.steps) if (step.kind === 'visit') assert.ok(T.walkable(step.spot.x, step.spot.z), step.label);
    assert.equal(story.steps.reduce((n, s) => n + s.reward, 0) + story.bonus, 22000); // about 20,000~30,000P a story (IDEAS)
  }
});

test('연계 퀘스트: 말 걸기 → 진행 → 보고(보상·다음 부탁) → 마지막 보너스, 멀면 거절, 아이템은 가방에서', () => {
  let doc = {};
  assert.equal(Q.talk(doc, 'granny', [], { x: 40, z: 40 }).error, 'TOO_FAR');
  assert.equal(Q.markOf('granny', doc.granny || { step: 0, taken: false, count: 0, done: false }, []), 'new');
  let r = Q.talk(doc, 'granny', [], at('granny')); doc = r.doc;
  assert.match(r.say, /잡초 20포기/); assert.equal(r.reward, 0);
  assert.equal(Q.markOf('granny', doc.granny, []), null);
  assert.deepEqual(Q.trackOf('granny', doc.granny, []), { story: 'granny', name: '정원사 할머니', label: '잡초', count: 0, need: 20, ready: false, to: null });
  assert.equal(Q.note(doc, 'beach_trash'), null, '다른 활동은 세지 않는다');
  for (let i = 0; i < 25; i += 1) doc = Q.note(doc, 'weed') || doc;
  assert.equal(doc.granny.count, 20);
  assert.equal(Q.markOf('granny', doc.granny, []), 'ready');
  r = Q.talk(doc, 'granny', [], at('granny')); doc = r.doc;
  assert.deepEqual([r.reward, r.take, r.paid], [2000, null, true]); assert.match(r.say, /열매 5개/);
  // a thing to bring: counted in the bag, taken when handed in
  const bag = [{ entryId: 'b', itemId: 'berry', qty: 3 }];
  assert.equal(Q.trackOf('granny', doc.granny, bag).count, 3);
  assert.equal(Q.talk(doc, 'granny', bag, at('granny')).waiting, true);
  bag[0].qty = 6;
  r = Q.talk(doc, 'granny', bag, at('granny')); doc = r.doc;
  assert.deepEqual([r.reward, r.take], [3000, { itemId: 'berry', qty: 5 }]);
  // a place to visit: on the map, counted when standing there
  const visit = Q.STORIES.granny.steps[2].spot;
  assert.deepEqual(Q.trackOf('granny', doc.granny, []).to, visit);
  assert.equal(Q.note(doc, 'at', { x: visit.x + 10, z: visit.z }), null);
  doc = Q.note(doc, 'at', { x: visit.x + 1, z: visit.z });
  assert.deepEqual(Q.trackOf('granny', doc.granny, []).to, at('granny'), '다 했으면 주민에게');
  r = Q.talk(doc, 'granny', [], at('granny')); doc = r.doc;
  assert.deepEqual([r.reward, r.done], [2000 + 15000, true]);
  assert.equal(Q.markOf('granny', doc.granny, []), null);
  assert.equal(Q.talk(doc, 'granny', [], at('granny')).reward, 0, '이번 주는 끝');
  assert.equal(Q.talk({}, 'nope', [], at('granny')).error, 'NO_STORY');
});

async function storeFlow(store) {
  const U = 'guest:12121212-1212-4121-8121-121212121212';
  await store.ensureAccount(U);
  const start = (await store.getAccount(U)).balance;
  const week = '2026-10-05';
  const pay = (fn) => (doc, bag) => { const out = fn(doc, bag); return out && !out.error ? { ...out, payKey: `quest:${week}:${U}:granny:${out.step}` } : out; };
  await store.questApply(U, week, pay((doc, bag) => Q.talk(doc, 'granny', bag, at('granny'))));
  for (let i = 0; i < 20; i += 1) await store.questApply(U, week, (doc) => { const next = Q.note(doc, 'weed'); return next ? { doc: next, reward: 0 } : null; });
  const paid = await store.questApply(U, week, pay((doc, bag) => Q.talk(doc, 'granny', bag, at('granny'))));
  assert.equal(paid.reward, 2000);
  assert.equal((await store.getAccount(U)).balance, start + 2000);
  await store.islandGive({ userId: U, claimId: 'quest-berry-1', itemId: 'berry', qty: 6 });
  const given = await store.questApply(U, week, pay((doc, bag) => Q.talk(doc, 'granny', bag, at('granny'))));
  assert.equal(given.reward, 3000);
  assert.deepEqual((await store.islandBag(U)).items.map((e) => [e.itemId, e.qty]), [['berry', 1]], '5개만 가져간다');
  // the same step paid twice is refused (a document put back by hand, say)
  const twice = await store.questApply(U, week, () => ({ doc: { granny: { step: 1 } }, reward: 3000, payKey: `quest:${week}:${U}:granny:1` }));
  assert.equal(twice.error, 'PAID');
  assert.equal((await store.getAccount(U)).balance, start + 5000);
  assert.equal((await store.questDoc(U, week)).doc.granny.step, 2);
  // 지뢰찾기 clears: paid once per game, best time and clears per level
  const first = await store.soloClear({ userId: U, gameId: 'game-0001', game: 'minesweeper', level: 'beginner', ms: 61000, points: 2000, title: '지뢰찾기 초급' });
  assert.deepEqual([first.applied, first.best, first.clears, first.newBest], [true, 61000, 1, true]);
  assert.equal((await store.soloClear({ userId: U, gameId: 'game-0001', game: 'minesweeper', level: 'beginner', ms: 61000, points: 2000 })).applied, false);
  const fast = await store.soloClear({ userId: U, gameId: 'game-0002', game: 'minesweeper', level: 'beginner', ms: 40000, points: 0 });
  assert.deepEqual([fast.best, fast.clears, fast.newBest], [40000, 2, true]);
  assert.equal((await store.getAccount(U)).balance, start + 7000);
  assert.deepEqual(await store.soloRecords(U), { minesweeper: { beginner: { best: 40000, clears: 2 } } });
}

test('연계 퀘스트·지뢰찾기 저장: JSON — 보상 한 번, 가방에서 가져감, 기록', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'quest-'));
  const store = new JsonPointStore(path.join(dir, 'points.json')); await store.init();
  await storeFlow(store);
  await fs.rm(dir, { recursive: true, force: true });
});

test('연계 퀘스트·지뢰찾기 저장: PostgreSQL — 같은 흐름', async (t) => {
  const database = await testDatabase(); t.after(() => database.stop());
  const store = new PostgresPointStore(database.url); t.after(() => store.pool.end());
  await store.init();
  await storeFlow(store);
});

// v1.10.39 섬 전체 할로윈: the costumed kid's story is out only in October (Asia/Seoul); candy bags from the bag
test('할로윈 꼬마: 10월(서울)에만 말을 걸 수 있고, 사탕 주머니 3개 → 광장 호박 앞 → 할머니 댁', () => {
  const oct = Date.parse('2026-10-31T23:30:00+09:00'); const nov = Date.parse('2026-11-01T00:10:00+09:00');
  assert.equal(Q.isOpen('kid', oct), true); assert.equal(Q.isOpen('kid', nov), false); assert.equal(Q.isOpen('granny', nov), true);
  assert.equal(Q.talk({}, 'kid', [], at('kid'), nov).error, 'NO_STORY');
  let doc = Q.talk({}, 'kid', [], at('kid'), oct).doc;
  const bag = [{ entryId: 'a', itemId: 'candy', qty: 3 }];
  assert.equal(Q.markOf('kid', doc.kid, bag), 'ready');
  let r = Q.talk(doc, 'kid', bag, at('kid'), oct); doc = r.doc;
  assert.deepEqual([r.reward, r.take], [3000, { itemId: 'candy', qty: 3 }]);
  assert.equal(Q.note(doc, 'at', { x: 0, z: 5.5, now: nov }), null, '11월에는 진행되지 않음');
  doc = Q.note(doc, 'at', { x: 0, z: 5.5, now: oct }); doc = Q.talk(doc, 'kid', [], at('kid'), oct).doc;
  doc = Q.note(doc, 'at', { x: 5.5, z: 39, now: oct }); r = Q.talk(doc, 'kid', [], at('kid'), oct);
  assert.deepEqual([r.reward, r.done], [17000, true]);
});


test('주간 순환: 서울 월요일 경계·2~3개·첫 주 기존 진행 유지·같은 주민 중복 없음',()=>{
  const before=Date.parse('2026-10-11T23:59:59+09:00'), after=before+1000;
  assert.deepEqual(Q.weeklyStories(before),['granny','fisher','kid']);
  assert.deepEqual(Q.weeklyStories(after),['fisher','photographer','kid']);
  assert.equal(Q.talk({},'granny',[],at('granny'),after).error,'NO_STORY');
  for(let week=0;week<52;week++) {
    const now=Date.parse('2026-10-05T00:00:00+09:00')+week*7*86400000;
    const ids=Q.weeklyStories(now); assert.ok(ids.length>=2&&ids.length<=3);
    const total=ids.reduce((sum,id)=>sum+Q.STORIES[id].bonus+Q.STORIES[id].steps.reduce((n,s)=>n+s.reward,0),0);
    assert.ok(total<=80000); // 44k normal weeks, 66k October: existing 22k per story remains
    for(const doc of [{},{photomemory:{done:true}}]) {
      const keepers=Q.visibleStories(doc,now).map(id=>Q.STORIES[id].keeper||id);
      assert.equal(new Set(keepers).size,keepers.length);
    }
  }
});

async function fixedFlow(store, rollback=false) {
  const U='guest:45454545-4545-4545-8545-454545454545', id='photomemory';
  const now=Date.parse('2026-10-10T12:00:00+09:00');
  await store.ensureAccount(U);
  await store.dexNote({userId:U,entry:'photo_bridge'});
  for(let i=0;i<16;i++) await store.islandGive({userId:U,claimId:`fixed-full-${i}`,itemId:'wallet',qty:1});
  const bag=await store.islandBag(U); const start=(await store.getAccount(U)).balance;
  const pay=(doc,items)=>{const out=Q.talk(doc,id,items,at(id),now);return {...out,payKey:`quest:fixed:${U}:${id}:${out.step}`};};
  await store.questApply(U,'fixed',pay);
  for(let step=0;step<3;step++) {
    await store.questApply(U,'fixed',doc=>({doc:Q.note(doc,step===0?'photo':'at',
      {qty:3,...(Q.STORIES[id].steps[step].spot||{}),now,scope:'fixed'}),reward:0}));
    if(step<2) await store.questApply(U,'fixed',pay);
    else {
      if(rollback) {
        const before=(await store.getAccount(U)).balance;
        await store.pool.query("ALTER TABLE island_dex ADD CONSTRAINT fixed_story_test CHECK(entry <> 'memory_island')");
        await assert.rejects(store.questApply(U,'fixed',pay));
        assert.equal((await store.questDoc(U,'fixed')).doc.photomemory.step,2);
        assert.equal((await store.dexOf(U)).memory_island,undefined);
        assert.equal(store.cachedBalance(U),before,'실패한 보상의 캐시 잔액도 보존');
        assert.equal(Number((await store.pool.query('SELECT balance FROM point_accounts WHERE user_id=$1',[U])).rows[0].balance),before);
        await store.pool.query('ALTER TABLE island_dex DROP CONSTRAINT fixed_story_test');
      }
      const both=await Promise.all([store.questApply(U,'fixed',pay),store.questApply(U,'fixed',pay)]);
      assert.equal(both.reduce((n,r)=>n+r.reward,0),17000);
    }
  }
  assert.equal((await store.getAccount(U)).balance,start+22000);
  assert.deepEqual(await store.islandBag(U),bag,'16칸이 꽉 차도 기념사진은 가방을 바꾸지 않는다');
  const mine=await store.dexOf(U);assert.equal(mine.memory_island.count,1);
  assert.equal(require('../lib/island-fishing').collectionCount(mine),1,'기존 도감 칭호 조건은 변하지 않는다');
  assert.equal((await store.questDoc(U,'2026-10-12')).doc.photomemory,undefined);
  assert.equal((await store.questDoc(U,'fixed')).doc.photomemory.done,true,'다음 주에도 고정 최초1회 완료 유지');
  assert.equal((await store.questApply(U,'fixed',pay)).reward,0);
}
test('고정 이야기 JSON: 동시 최종 지급·기념사진 원자성·주간 분리·재시작',async(t)=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'fixed-quest-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const file=path.join(dir,'points.json'),store=new JsonPointStore(file);await store.init();await fixedFlow(store);
  const reload=new JsonPointStore(file);await reload.init();
  assert.equal((await reload.questDoc('guest:45454545-4545-4545-8545-454545454545','fixed')).doc.photomemory.done,true);
  assert.equal((await reload.dexOf('guest:45454545-4545-4545-8545-454545454545')).memory_island.count,1);
});
test('고정 이야기 PostgreSQL: 동시 최종 지급·기념사진 원자성·주간 분리',async(t)=>{
  const db=await testDatabase();t.after(()=>db.stop());const store=new PostgresPointStore(db.url);t.after(()=>store.pool.end());
  await store.init();await fixedFlow(store,true);
});
