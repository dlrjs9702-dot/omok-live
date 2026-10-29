'use strict';
process.env.ISLAND_QUEST_WEEK ??= '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { boot } = require('../test-support/test-server');
const Q = require('../lib/island-quests');

// v1.10.80 농부 × 두더지 잡기 (IDEAS #future-island-minigames): the farmer's step is a paid round of 두더지 잡기 at 200 or
// more (a low or too-fast round does not count); the talk says which round to open; who handed it in this week grows
// the field everyone sees (stage = helpers, at most 3) and is named on the sign.
test('농부 부탁: 두더지 잡기 200점 판으로 단계 완료, 공동 밭 단계·팻말 이름', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'farmer-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const f = Q.STORIES.farmer.at;
  const helper = async (label) => {
    const sa = await server.enter(await server.issue(label)); assert.ok(sa, server.logs());
    const stand = (x, z) => req('/api/plaza/state', sa, { x, z, yaw: 0 });
    await stand(f.x + 1, f.z); await new Promise((r) => setTimeout(r, 300)); await stand(f.x + 1, f.z);
    const talk = () => req('/api/island/event', sa, { id: 'questfarmer', accept: true }); // (Q: 「할게요!」 -- the first talk only offers)
    const round = async (score, ageMs = 31000) => {
      const id = (await req('/api/solo/reflex/start', sa, { game: 'whack', level: 'easy' })).data.id;
      if (ageMs) await req('/api/test/reflex/age', sa, { id, ageMs });
      return (await req('/api/solo/reflex/finish', sa, { id, score })).data;
    };
    return { sa, talk, round };
  };
  assert.deepEqual((await req('/api/island/farm', (await helper('밭구경')).sa)).data, { ok: true, stage: 0, names: [], village: { mural: 0, busk: false, lamps: 0, stones: 0, books: false }, harvested: false }); // (v1.10.93 + the village)

  const a = await helper('농부도움');
  const asked = (await a.talk()).data;
  assert.match(asked.say, /두더지/); assert.deepEqual(asked.minigame, { game: 'whack', level: 'easy', goal: 200 });
  await a.round(150); // too few
  await a.round(400, 0); // too fast: not paid, not counted
  await new Promise((r) => setTimeout(r, 200));
  const still = (await a.talk()).data;
  assert.equal(still.waiting, true); assert.ok(still.minigame, '아직 게임 단계');
  await a.round(230);
  await new Promise((r) => setTimeout(r, 200));
  const paid = (await a.talk()).data;
  assert.equal(paid.reward, 3000); assert.match(paid.say, /허수아비/); assert.equal(paid.minigame, null);
  assert.deepEqual((await req('/api/island/farm', a.sa)).data, { ok: true, stage: 1, names: ['농부도움'], village: { mural: 0, busk: false, lamps: 0, stones: 0, books: false }, harvested: false });
  const T = require('../public/plaza/island-terrain.js'); const field = (s) => req('/api/plaza/state', s, { x: T.FARM.x, z: T.FARM.z, yaw: 0 });
  await field(a.sa); await new Promise((r) => setTimeout(r, 300)); await field(a.sa);
  assert.equal((await req('/api/island/farm/harvest', a.sa, {})).data.error, 'FARM_NOT_GROWN'); // v1.10.89: not before it is grown

  for (const name of ['도움둘', '도움셋', '도움넷']) {
    const h = await helper(name); await h.talk(); await h.round(300); await new Promise((r) => setTimeout(r, 200)); await h.talk();
  }
  const farm = (await req('/api/island/farm', a.sa)).data;
  assert.equal(farm.stage, 3, '최대 3단계');
  assert.deepEqual([...farm.names].sort(), ['농부도움', '도움넷', '도움둘', '도움셋'].sort());
  // v1.10.89 밭 수확: grown -> one 밭 채소 each a week, in the field only
  const late = await helper('늦게옴'); // helped nobody: still harvests (each one's own)
  assert.equal((await req('/api/island/farm/harvest', late.sa, {})).data.error, 'TOO_FAR');
  await field(late.sa); await new Promise((r) => setTimeout(r, 300)); await field(late.sa);
  assert.equal((await req('/api/island/farm/harvest', late.sa, {})).status, 200);
  assert.equal((await req('/api/island/farm/harvest', late.sa, {})).data.error, 'HARVESTED');
  assert.equal(((await req('/api/island/bag', late.sa)).data.items || []).find((e) => e.itemId === 'harvest')?.qty, 1);
  assert.deepEqual([(await req('/api/island/farm', late.sa)).data.harvested, (await req('/api/island/farm', a.sa)).data.harvested], [true, false]);
});

test('농부 밭: 도운 사람 목록 — JSON·PostgreSQL 같은 답(그 주, 첫 단계를 넘긴 계정만)', async (t) => {
  const { JsonPointStore, PostgresPointStore } = require('../lib/point-store');
  const { testDatabase } = require('../test-support/pg-database');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'farmer-store-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const database = await testDatabase(); t.after(() => database.stop());
  const pg = new PostgresPointStore(database.url, { initialGrant: 0 }); t.after(() => pg.pool.end()); await pg.init();
  const json = new JsonPointStore(path.join(dir, 'points.json'), { initialGrant: 0 }); await json.init();
  for (const store of [json, pg]) {
    const set = (user, week, doc) => store.questApply(user, week, () => ({ doc, reward: 0 }));
    await set('guest:00000000-0000-4000-8000-00000000000b', '2026-10-12', { farmer: { step: 1, taken: true, count: 0, done: false } });
    await set('guest:00000000-0000-4000-8000-00000000000a', '2026-10-12', { farmer: { step: 2, taken: false, count: 0, done: true } });
    await set('guest:00000000-0000-4000-8000-00000000000c', '2026-10-12', { farmer: { step: 0, taken: true, count: 1, done: false } }); // the game done, not handed in
    await set('guest:00000000-0000-4000-8000-00000000000d', '2026-10-05', { farmer: { step: 1, taken: true, count: 0, done: false } }); // last week
    assert.deepEqual(await store.questHelpers('2026-10-12', 'farmer'), ['guest:00000000-0000-4000-8000-00000000000a', 'guest:00000000-0000-4000-8000-00000000000b']);
  }
});
