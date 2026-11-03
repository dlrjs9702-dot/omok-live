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
  // (Codex 6차 P3) the points taken but the project not saved: the same request again puts it in, once
  await req('/api/test/store/fail', a, { method: 'setWorldValue' }); assert.equal((await give(100000, 9)).status, 200);
  assert.equal((await req('/api/island/projects', a)).data.cur.raised, 400000, '사업 저장 실패');
  for (let i = 0; i < 2; i += 1) assert.equal((await give(100000, 9)).status, 200);
  assert.equal((await req('/api/island/projects', a)).data.cur.raised, 500000, '다시 보내면 한 번 들어감');
  assert.equal((await give(600000, 2)).status, 200);
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

test('심부름은 공사 날 갈고리 없이 뽑음: 같은 날 사업이 낮에 다 모여도 그날 심부름 그대로 (총괄 222 검토 3)', () => {
  const E = require('../lib/island-errands'); const day = '2026-11-05';
  R.setWorks(() => false); const before = JSON.stringify(E.errandsOf(day, (n) => R.walks(n, day, true)));
  R.setWorks((d) => d === day);
  try {
    assert.notEqual(JSON.stringify(E.errandsOf(day, (n) => R.walks(n, day))), before, '(공사 날 근무표로 뽑으면 바뀌었을 날)');
    assert.equal(JSON.stringify(E.errandsOf(day, (n) => R.walks(n, day, true))), before);
    assert.equal(R.walks(19, day), false); assert.equal(R.postOf(19, day), 'works');
  } finally { R.setWorks(() => false); }
});

test('섬 가꾸기 투표(223): 첫 두 사업 뒤 마루 시장이 셋까지 내놓고 하루 투표 → 다음 날 가장 많은 표(같으면 앞), 다리·전망대(224)는 아직 빠짐', () => {
  const goal = (id) => P.byId(id).goal; let s = P.fresh(); s.cur = null;
  s.open = ['fountain', 'flower_path'].map((id) => ({ id, day: '2026-11-03', top: [], names: [] }));
  s = P.roll(s, '2026-11-10', goal); let v = P.view(s, goal, 'a');
  assert.deepEqual(v.vote.choices.map((c) => c.id), ['promenade', 'night_lights', 'bridge'], '셋까지 (224: 다리·전망대도)');
  assert.equal(P.vote(s, 'a', 'lookout', '2026-11-10', goal), null, '표에 없는 것(넷째)');
  s = P.vote(s, 'a', 'night_lights', '2026-11-10', goal); s = P.vote(s, 'b', 'promenade', '2026-11-10', goal); s = P.vote(s, 'b', 'night_lights', '2026-11-10', goal); // (b changed their mind)
  v = P.view(s, goal, 'b'); assert.deepEqual([v.vote.choices.map((c) => c.votes), v.vote.mine], [[0, 2, 0], 'night_lights']);
  s = P.give(s, { userId: 'c', name: '다', amount: 300000 }, '2026-11-10', goal); assert.equal(s.saved, 300000, '투표 날 기부는 적립');
  s = P.roll(s, '2026-11-11', goal); v = P.view(s, goal);
  assert.deepEqual([v.vote, v.cur.id, v.cur.raised], [null, 'night_lights', 300000], '다음 날 이긴 것 시작, 적립 넣음');
  // a tie (none cast): the first on the list
  let t = P.fresh(); t.cur = null; t.open = ['fountain', 'flower_path'].map((id) => ({ id, day: 'x', top: [], names: [] })); t = P.roll(t, '2026-11-20', goal); t = P.roll(t, '2026-11-21', goal);
  assert.equal(t.cur, 'promenade');
  // one left: begun at once, no vote
  let u = P.fresh(); u.cur = null; u.open = ['fountain', 'flower_path', 'promenade', 'night_lights', 'bridge'].map((id) => ({ id, day: 'x', top: [], names: [] })); u = P.roll(u, '2026-11-20', goal);
  assert.deepEqual([u.cur, u.vote ?? null], ['lookout', null]);
  assert.ok(P.PROMENADE.length >= 6 && P.PROMENADE_SEATS.length === P.PROMENADE.length && P.STRINGS.length >= 3 && P.UPLIGHTS.length === 7);
});

test('섬 가꾸기 투표·민원 창구 서버: 정문에서만 한 표, 바꿀 수 있음, 창구 밖에서는 못 보탬, 물가 거리 벤치는 열린 뒤에만', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'projects-vote-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('투표미'));
  await req('/api/test/projects', a, { reset: true }); await req('/api/test/projects', a, { open: ['fountain', 'flower_path'] });
  let v = (await req('/api/island/projects', a)).data; assert.deepEqual(v.vote.choices.map((c) => c.id), ['promenade', 'night_lights', 'bridge']);
  const T = require('../public/plaza/island-terrain'); const gate = T.townhallWorld(0, T.TOWNHALL.yard.z1 + 1.4);
  await req('/api/plaza/state', a, { x: gate.x + 10, z: gate.z, yaw: 0, moving: false });
  assert.equal((await req('/api/island/projects/vote', a, { id: 'promenade' })).data.error, 'TOO_FAR');
  await req('/api/plaza/state', a, { x: gate.x, z: gate.z + 0.5, yaw: 0, moving: false });
  assert.equal((await req('/api/island/projects/vote', a, { id: 'promenade' })).status, 200);
  v = (await req('/api/island/projects/vote', a, { id: 'night_lights' })).data; assert.deepEqual([v.vote.mine, v.vote.choices.map((c) => c.votes)], ['night_lights', [0, 1, 0]], '한 사람 한 표, 바꿈');
  assert.equal((await req('/api/island/projects/vote', a, { id: 'lookout' })).data.error, 'NO_VOTE');
  assert.equal((await req('/api/island/projects/give', a, { amount: 1000, requestId: 'desk-00000001' })).data.error, 'TOO_FAR', '민원 창구 앞에서만');
  const seat = P.PROMENADE_SEATS[0]; await req('/api/plaza/state', a, { x: seat.x, z: seat.z, yaw: 0, moving: false });
  assert.equal((await req('/api/island/sit', a, { seat: seat.id })).status, 400, '열리기 전 벤치는 없음');
  await req('/api/test/projects', a, { open: 'promenade' }); await req('/api/island/projects', a);
  assert.equal((await req('/api/island/sit', a, { seat: seat.id })).status, 200, '열린 뒤 앉기');
});

test('새 다리(224): 열리면 지형의 다리 규칙으로 강 위를 걸음, 가운데 1.1 m 높이', () => {
  const T = require('../public/plaza/island-terrain'); const B = P.BRIDGE; assert.equal(T.walkable(B.x, B.z), false, '전엔 물');
  const e = P.bridgeEntry(T); T.bridges.push(e);
  try {
    assert.equal(T.walkable(B.x, B.z), true); assert.ok(Math.abs(T.heightAt(B.x, B.z) - (e.base + 0.43 + B.rise)) < 0.01);
    assert.ok(Math.abs(T.heightAt(B.x - B.half + 0.1, B.z) - T.heightAt(B.x - B.half - 0.6, B.z)) < 0.35, '한쪽 끝이 둑과 이어짐');
  } finally { T.bridges.splice(T.bridges.indexOf(e), 1); }
});

test('강 어귀 다리(224): 잔치마루 길에서 다리까지 길, 다리 열리기 전엔 낚시터 둔덕에 못 가고 열리면 감, 둔덕 가장자리는 낚시 물', () => {
  const T = require('../public/plaza/island-terrain'); const B = P.BRIDGE; const S = P.FISHING_SPOT;
  const X0 = 90, X1 = 175, Z0 = -40, Z1 = 20; const W = X1 - X0 + 1;
  const reach = () => { // (8 ways, a metre a step: as one walks)
    const ok = (x, z) => x >= X0 && x <= X1 && z >= Z0 && z <= Z1 && T.walkable(x, z); const seen = new Set([`116,9`]); const q = [[116, 9]];
    while (q.length) { const [x, z] = q.pop(); for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) { const k = `${x + dx},${z + dz}`; if (!seen.has(k) && ok(x + dx, z + dz)) { seen.add(k); q.push([x + dx, z + dz]); } } }
    return seen.has(`${Math.round(S.x)},${Math.round(S.z)}`);
  };
  assert.ok(W > 0);
  const walk = T.walkCurves.find((w) => Math.hypot(w.pts[0][0] - 115.2, w.pts[0][1] - 9.3) < 0.5); assert.ok(walk, '다리로 가는 길'); assert.equal(walk.w, 2.8);
  const end = walk.pts[walk.pts.length - 1]; assert.ok(Math.hypot(end[0] - (B.x + B.ux * B.half), end[1] - (B.z + B.uz * B.half)) < 2.5, '길 끝이 다리 남쪽 끝');
  assert.equal(T.bridges.filter((b) => !b.project).length, 4, '길이 강을 건너지 않음: 저절로 생기는 다리 없음');
  assert.equal(reach(), false, '열리기 전엔 둔덕에 못 감');
  const e = P.bridgeEntry(T); T.bridges.push(e);
  try { assert.equal(reach(), true, '열리면 다리로 건너감'); } finally { T.bridges.splice(T.bridges.indexOf(e), 1); }
  assert.ok(T.canFish(S.x, S.z) || T.canFish(S.x, S.z + 0.6), '낚시터에서 낚시');
  for (const k of ['sign', 'keeper', 'plaque']) assert.ok(T.walkable(P.SITES.bridge[k].x, P.SITES.bridge[k].z), k);
  assert.ok(Math.hypot(P.SITES.bridge.plaque.x - S.x, P.SITES.bridge.plaque.z - S.z) > 8, '명판과 낚시터 SPACE가 겹치지 않음');
});
