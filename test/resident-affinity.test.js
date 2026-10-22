'use strict';
// R2 주민 상호작용 확장 (gamecenter-notes IDEAS #future-resident-interactions, 사용자 「호감도는 보상이랑도 연결」): 오늘의 이야기
// (a question a day each, the liked answer +2, once), a level reached paying once (아는 사이 points, 친한 사이 points and their
// piece in my 가구 창고, 단짝 their title), what was done together said back, and my 호감도 listed for their greeting.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Npcs = require('../public/plaza/island-npcs');
const Cast = require('../public/plaza/island-cast');
const A = require('../lib/island-affinity');
const { boot } = require('../test-support/test-server');

test('호감도 단계·오늘의 이야기 순수 규칙: 지난 단계, 질문 세 답, 좋아하는 답 +2, 단짝 칭호, 친한 사이 가구', () => {
  assert.deepEqual(A.crossed(4, 15), [1, 2]); assert.deepEqual(A.crossed(29, 30), [3]);
  const day = '2026-10-23'; for (let n = 0; n < Cast.WALKERS.length; n += 1) { const q = A.questionOf(n, day); assert.equal(q.answers.length, 3); assert.equal(A.answer(n, day, q.liked).delta, 2); }
  assert.equal(A.titleOf(A.titleId(0)).name, `${Cast.WALKERS[0].name}의 단짝`);
  const F = require('../public/plaza/island-furniture'); assert.ok(A.CLOSE_GIFT.every((id) => F.good(id)));
  assert.equal(Cast.GREETS.length, 4); assert.equal(Cast.GREETS[0].length, 0);
});

test('주민 호감도: 오늘의 이야기 하루 한 번, 단계 보상 한 번씩(포인트·가구·칭호), 기억 대사, 내 호감도 목록', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'affinity-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('단짝후보'));
  await req('/api/test/island/free-residents', a, {});
  const n = 2; const by = async () => { const w = Npcs.residentAt(n, Date.now(), null); await req('/api/plaza/state', a, { x: w.x + 1, z: w.z, yaw: 0, moving: false }); };
  const talk = async (body) => { for (let i = 0; i < 6; i += 1) { await by(); const r = await req('/api/island/resident/talk', a, { n, ...body }); if (r.status !== 409 || r.data.error !== 'TOO_FAR') return r; } throw new Error('never by them'); };
  const balance = async () => (await req('/api/skins', a)).data.balance;
  const first = await talk({}); assert.equal(first.status, 200, JSON.stringify(first.data)); assert.equal(first.data.affinity.points, 1);
  // 오늘의 이야기: three answers; the liked one +2 (and 아는 사이 -- 5 -- pays once)
  await req('/api/test/affinity', a, { n, delta: 2 });
  const asked = await talk({ topic: 'ask' }); assert.equal(asked.data.question.answers.length, 3);
  const liked = A.questionOf(n, asked.data.day || new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)).liked;
  const start = await balance();
  const answered = await talk({ topic: 'answer', choice: liked });
  assert.equal(answered.status, 200, JSON.stringify(answered.data)); assert.equal(answered.data.affinity.points, 5); assert.equal(answered.data.affinity.name, '아는 사이');
  assert.equal(answered.data.stages.length, 1); assert.match(answered.data.stages[0], /아는 사이! \+2,000P/);
  assert.equal(await balance(), start + 2000);
  const again = await talk({ topic: 'answer', choice: liked }); assert.equal(again.data.affinity.points, 5); assert.match(again.data.say[0], /벌써/);
  assert.equal((await talk({ topic: 'ask' })).data.question, undefined);
  // remembered: their greeting knows it
  const mine = (await req('/api/island/affinity', a)).data.residents; assert.equal(mine.length, Cast.WALKERS.length);
  assert.deepEqual([mine[n].level, mine[n].points], [1, 5]); assert.match(mine[n].memory, /이야기/);
  // 친한 사이 (15): points and their piece in my 가구 창고, once
  const close = await req('/api/test/affinity', a, { n, delta: 10 }); assert.match(close.data.stages[0], /친한 사이! \+5,000P · 선물 「/);
  const storage = (await req('/api/island/furniture/mine', a)).data; const pieces = (storage.pieces || storage.owned || storage.items || []).filter((p) => p.id === A.CLOSE_GIFT[n]);
  assert.equal(pieces.length, 1, JSON.stringify(storage).slice(0, 300));
  // 단짝 (30): the title, worn
  assert.deepEqual((await req('/api/test/affinity', a, { n, delta: 10 })).data.stages, []); // (25: no new level)
  const bestie = await req('/api/test/affinity', a, { n, delta: 5 }); assert.match(bestie.data.stages?.[0] || JSON.stringify(bestie.data), /단짝이 됐어요/);
  assert.ok((await req('/api/skins', a)).data.dexTitles.some((x) => x.id === A.titleId(n)));
  const worn = await req('/api/skins/title', a, { skinId: A.titleId(n) }); assert.equal(worn.status, 200, JSON.stringify(worn.data)); assert.equal(worn.data.avatar.title, `${Cast.WALKERS[n].name}의 단짝`);
  assert.equal((await req('/api/skins/title', a, { skinId: A.titleId(n + 1) })).status, 409); // (not 단짝 with them)
  assert.deepEqual((await req('/api/test/affinity', a, { n, delta: 1 })).data.stages, []); // (paid once)
});
