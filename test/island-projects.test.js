'use strict';
// v1.10.222 섬 가꾸기 사업 (public/plaza/island-projects.js): a 기부 fills the project (once per request), what overflows is saved;
// filled, that day its works -- 바위 at the fence (the roster), talked to there -- the next day open with its plaque, the next
// begun with the savings. Pure rules and the server.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');
const P = require('../public/plaza/island-projects');
const R = require('../public/plaza/island-roster');

test('섬 가꾸기 규칙: 순서대로, 넘친 돈·공사 날 기부는 적립, 다음 날 열림·명판, 적립은 다음 사업에', () => {
  const goal = (id) => P.byId(id).goal; let s = P.fresh();
  s = P.give(s, { userId: 'a', name: '가', amount: 400000 }, '2026-11-01', goal);
  s = P.give(s, { userId: 'b', name: '나', amount: 500000 }, '2026-11-01', goal);
  s = P.give(s, { userId: 'a', name: '가', amount: 300000 }, '2026-11-01', goal); // (100,000 fills it, 200,000 saved)
  let v = P.view(s, goal, 'a'); assert.equal(v.cur, null); assert.deepEqual([v.works.id, v.works.day, v.saved], ['fountain', '2026-11-01', 200000]);
  s = P.give(s, { userId: 'c', name: '다', amount: 50000 }, '2026-11-01', goal); assert.equal(P.view(s, goal).saved, 250000, '공사 날 기부는 적립');
  s = P.roll(s, '2026-11-02', goal); v = P.view(s, goal, 'a');
  assert.deepEqual(v.open, [{ id: 'fountain', name: '대청마당 분수 새 단장', day: '2026-11-02', top: ['가', '나'] }]);
  assert.deepEqual([v.cur.id, v.cur.raised, v.cur.mine, v.saved], ['flower_path', 250000, 0, 0], '적립이 다음 사업에');
  assert.deepEqual(s.open[0].names, ['가', '나'], '명판: 보탠 사람(게임 이름)만, 적립은 이름 없이');
  assert.equal(P.PLANTERS.length >= 6, true); assert.ok(P.SITES.fountain.fence.length === 6);
});

test('섬 가꾸기 서버: 기부 → 사업, 같은 요청 두 번은 한 번, 공사 날 바위는 공사 울타리 옆(대화), 다음 날 열림·명판', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'projects-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('보태미'));
  const key = (await req('/api/admin/keys', server.admin)).data.keys.find((k) => k.label === '보태미');
  await req(`/api/admin/keys/${key.id}/points`, server.admin, { amount: 2000000, category: 'other', memo: '시험', requestId: require('node:crypto').randomUUID() });
  assert.equal((await req('/api/test/projects', a, { reset: true })).status, 200);
  let v = (await req('/api/island/projects', a)).data; assert.deepEqual([v.cur.id, v.cur.goal, v.cur.raised], ['fountain', 1000000, 0]);
  const give = (amount, id) => req('/api/donation', a, { amount, requestId: `proj-${id}-0000000` });
  const first = await give(400000, 1); assert.equal(first.status, 200, JSON.stringify(first.data));
  assert.equal((await give(400000, 1)).status, 200); // (the same request again: one gift)
  v = (await req('/api/island/projects', a)).data; assert.deepEqual([v.cur.raised, v.cur.mine], [400000, 400000]);
  assert.equal((await give(700000, 2)).status, 200);
  v = (await req('/api/island/projects', a)).data; assert.deepEqual([v.cur, v.works?.id, v.saved], [null, 'fountain', 100000]);
  // the works day: 바위 at the fence -- the roster on
  await req('/api/test/roster', null, { on: true, day: (await req('/api/test/projects', a, {})).data.day });
  R.setWorks((d) => d === v.works.day); assert.equal(R.postOf(19, v.works.day), 'works');
  const k = P.SITES.fountain.keeper; await req('/api/plaza/state', a, { x: k.x, z: k.z + 1.2, yaw: Math.PI, moving: false });
  const talk = await req('/api/island/resident/talk', a, { n: 19 }); assert.equal(talk.status, 200, JSON.stringify(talk.data));
  await req('/api/test/roster', null, { on: false });
  // the next day: open, its plaque; the flower path begun with the 100,000 saved
  const next = (await req('/api/test/projects', a, { nextDay: true })).data; assert.equal(next.state.open[0].id, 'fountain');
  v = (await req('/api/island/projects', a)).data; assert.deepEqual([v.open[0].id, v.cur.id, v.cur.raised, v.works], ['fountain', 'flower_path', 100000, null]);
  const plaque = (await req('/api/island/projects/plaque?id=fountain', a)).data; assert.deepEqual([plaque.top, plaque.names], [['보태미'], ['보태미']]);
  assert.equal((await req('/api/island/projects/plaque?id=flower_path', a)).status, 404);
});
