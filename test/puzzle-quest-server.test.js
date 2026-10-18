'use strict';
process.env.ISLAND_QUEST_WEEK = '1'; // the electrician's week (lib/island-quests.js VILLAGE)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { boot } = require('../test-support/test-server');
const Q = require('../lib/island-quests');
const PuzzleDaily = require('../lib/puzzle-daily');

// A2b 마을 주민 × 퍼즐: the electrician's step is today's 회로 연결 (쉬움) -- a right answer sent counts, and one solved
// earlier today (in the game hall) counts as soon as the step is taken
test('전기 담당 부탁: 오늘의 회로 연결 쉬움을 풀면 단계 완료, 먼저 풀어 둔 날은 받자마자 완료', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pzquest-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const at = Q.STORIES.electrician.at;
  const date = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const sol = await PuzzleDaily.answer('circuit', 'easy', date);
  const helper = async (label) => {
    const sa = await server.enter(await server.issue(label)); assert.ok(sa, server.logs());
    const stand = () => req('/api/plaza/state', sa, { x: at.x + 1, z: at.z, yaw: 0 });
    await stand(); await new Promise((r) => setTimeout(r, 300)); await stand();
    const solve = () => req('/api/solo/puzzle/finish', sa, { game: 'circuit', level: 'easy', score: 60000, proof: { date, sol, v: 1 } });
    return { sa, talk: () => req('/api/island/event', sa, { id: 'questelectrician' }), solve };
  };
  const a = await helper('회로도움');
  const asked = (await a.talk()).data;
  assert.match(asked.say, /회로/); assert.deepEqual(asked.minigame, { game: 'circuit', level: 'easy', goal: null, puzzle: true });
  assert.equal((await a.solve()).data.ok, true);
  await new Promise((r) => setTimeout(r, 300));
  const paid = (await a.talk()).data;
  assert.equal(paid.reward, 3000, JSON.stringify(paid)); assert.equal(paid.minigame, null);

  const b = await helper('먼저풂');
  assert.equal((await b.solve()).data.ok, true); // in the game hall, before the story
  const took = (await b.talk()).data;
  assert.equal(took.minigame, null); assert.match(took.say, /벌써 풀었/);
  assert.equal((await b.talk()).data.reward, 3000);
});
