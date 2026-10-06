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
