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
// (R3 ③: the islanders walk the round of the island's time of day -- here as the server has it, Seoul's hour)
const seoulPhase = (ms) => { const h = new Date(ms + 9 * 3600000).getUTCHours(); return h >= 6 && h < 10 ? 'morning' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'evening' : 'night'; };
Npcs.setPhaseOf(seoulPhase);
// (CI #298: a metre east of an islander was no place to stand that moment -- the server kept me where I was, TOO_FAR six
// times; each try stands on another side of them)
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7]];

// (CI #351 「never by them」: where an islander is by the server's own count -- each hold paused their round (its delay), which
// residentAt(…, null) left out; the place answer carries the server's state)
async function serverAt(req, who, n) { const guess = Npcs.residentAt(n, Date.now(), null); const st = (await req('/api/plaza/state', who, { x: guess.x, z: guess.z, yaw: 0, moving: false })).data.residents?.[n] || null; return Npcs.residentAt(n, Date.now(), st); }

test('호감도 단계·오늘의 이야기 순수 규칙: 지난 단계, 질문 세 답, 좋아하는 답 +2, 단짝 칭호, 친한 사이 가구', () => {
  assert.deepEqual(A.crossed(4, 15), [1, 2]); assert.deepEqual(A.crossed(29, 30), [3]);
  const day = '2026-10-23'; for (let n = 0; n < Cast.WALKERS.length; n += 1) { const q = A.questionOf(n, day); assert.equal(q.answers.length, 3); assert.equal(A.answer(n, day, q.liked).delta, 2); }
  assert.equal(A.titleOf(A.titleId(0)).name, `${Cast.WALKERS[0].name}의 단짝`);
  const F = require('../public/plaza/island-furniture'); assert.ok(A.CLOSE_GIFT.every((id) => F.good(id)));
  for (let n = 0; n < 10; n += 1) { assert.equal(Cast.say(n, 'greet0').length, 0); for (const k of [1, 2, 3]) assert.equal(Cast.say(n, `greet${k}`).length, 1); } // (T: each greets in their own words, 처음 본 사이 not yet)
});

test('주민 호감도: 오늘의 이야기 하루 한 번, 단계 보상 한 번씩(포인트·가구·칭호), 기억 대사, 내 호감도 목록', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'affinity-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('단짝후보'));
  await req('/api/test/island/free-residents', a, {});
  const n = 2; const by = async (i) => { const w = await serverAt(req, a, n); const [dx, dz] = SIDES[i % SIDES.length]; await req('/api/plaza/state', a, { x: w.x + dx, z: w.z + dz, yaw: 0, moving: false }); };
  const talk = async (body) => { for (let i = 0; i < 6; i += 1) { await by(i); const r = await req('/api/island/resident/talk', a, { n, ...body }); if (r.status !== 409 || r.data.error !== 'TOO_FAR') return r; } throw new Error('never by them'); };
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
  const mine = (await req('/api/island/affinity', a)).data.residents; assert.equal(mine.length, Cast.RESIDENTS.length); // (v1.10.216: all 27)
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
  // R3 ⑥ 편지: the one I am closest to writes into my 우체통, once a day
  const mail = async () => (await req('/api/island/mail', a)).data.letters.filter((l) => String(l.from).startsWith('resident:'));
  const letters = await mail(); assert.equal(letters.length, 1); assert.equal(letters[0].fromName, Cast.WALKERS[n].name); assert.match(letters[0].text, /단짝후보/);
  assert.equal((await mail()).length, 1);
});

test('R3: 선물 하루 한 번(좋아함 +3·싫어함 0·보통 +1, 가방에서 빠짐), 서먹한 사이·친구 사이, 시간대마다 다른 하루 길', async (t) => {
  // ⑤ who gets on with whom
  assert.equal(Cast.relationOf(1, 5), 'rival'); assert.equal(Cast.relationOf(3, 0), 'friend'); assert.equal(Cast.relationOf(0, 1), null);
  // ③ the round by the time of day: another place in the morning than by day, the same again for the same time of day
  Npcs.setPhaseOf(() => 'day'); const day = Npcs.at(1, 123456); Npcs.setPhaseOf(() => 'morning'); const morning = Npcs.at(1, 123456);
  assert.ok(Math.hypot(day.x - morning.x, day.z - morning.z) > 1, JSON.stringify([day, morning])); assert.deepEqual(Npcs.at(1, 123456), morning); Npcs.setPhaseOf(seoulPhase);
  // ⑥ a gift
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'resgift-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('선물주기'));
  await req('/api/test/island/free-residents', a, {});
  const n = 1; const by = async (i) => { const w = await serverAt(req, a, n); const [dx, dz] = SIDES[i % SIDES.length]; await req('/api/plaza/state', a, { x: w.x + dx, z: w.z + dz, yaw: 0, moving: false }); };
  const talk = async (body) => { for (let i = 0; i < 6; i += 1) { await by(i); const r = await req('/api/island/resident/talk', a, { n, ...body }); if (r.status !== 409 || r.data.error !== 'TOO_FAR') return r; } throw new Error('never by them'); };
  assert.equal((await talk({})).status, 200);
  assert.deepEqual((await talk({ topic: 'gift' })).data.gifts, []);
  await req('/api/test/island/give', a, { itemId: 'fish_goby', qty: 2 }); await req('/api/test/island/give', a, { itemId: 'bugnet', qty: 1 });
  const offer = await talk({ topic: 'gift' }); assert.deepEqual(offer.data.gifts.map((g) => g.itemId), ['fish_goby']); // (a tool is not given)
  const given = await talk({ topic: 'gift', itemId: 'fish_goby' }); assert.equal(given.status, 200, JSON.stringify(given.data)); assert.match(given.data.say[0], /제일 좋아하는/); assert.equal(given.data.affinity.points, 1 + 3);
  assert.equal(((await req('/api/island/bag', a)).data.items.find((e) => e.itemId === 'fish_goby') || {}).qty, 1);
  const twice = await talk({ topic: 'gift', itemId: 'fish_goby' }); assert.match(twice.data.say[0], /벌써/); assert.equal(twice.data.affinity.points, 4);
  assert.match((await req('/api/island/affinity', a)).data.residents[n].memory, /망둥어/);
  // (Codex 검토 2차 #7) the item taken, then the 호감도 failing: the retry finishes that gift -- choosing another item takes
  // nothing more and pays that gift's 호감도, not the other's
  const m = 2; const talk2 = async (body) => { for (let i = 0; i < 6; i += 1) { const w = await serverAt(req, a, m); const [dx, dz] = SIDES[i % SIDES.length]; await req('/api/plaza/state', a, { x: w.x + dx, z: w.z + dz, yaw: 0, moving: false }); const r = await req('/api/island/resident/talk', a, { n: m, ...body }); if (r.status !== 409 || r.data.error !== 'TOO_FAR') return r; } throw new Error('never by them'); };
  await req('/api/test/island/give', a, { itemId: 'fish_mackerel', qty: 1 });
  const qty = async (id) => ((await req('/api/island/bag', a)).data.items.find((e) => e.itemId === id) || {}).qty || 0;
  const pointsBefore = (await talk2({})).data.affinity.points;
  await req('/api/test/affinity/fail-once', a, {});
  assert.equal((await talk2({ topic: 'gift', itemId: 'fish_goby' })).status, 500);
  assert.equal(await qty('fish_goby'), 0, '망둥어는 빠짐');
  const retried = await talk2({ topic: 'gift', itemId: 'fish_mackerel' }); assert.equal(retried.status, 200, JSON.stringify(retried.data));
  assert.equal(await qty('fish_mackerel'), 1, '다른 물건은 그대로');
  assert.equal(retried.data.affinity.points, pointsBefore + A.giftReact(m, 'fish_goby', '망둥어').delta, '그 선물(망둥어)의 호감도');
  assert.match((await talk2({ topic: 'gift', itemId: 'fish_mackerel' })).data.say[0], /벌써/);
});

// Q 부탁 받기 (gamecenter-notes docs/quest-accept-complete-20261026.md): talking to today's asker only offers the errand (its
// note: what, where, what it pays, today), 「다음에요」 keeps nothing, 「할게요!」 starts it (the tracker), 「그만둘래요」 lets it go
test('심부름 받기: 말 걸면 쪽지만, 다음에요는 기록 없음, 할게요로 시작, 그만두면 다시 부탁', async (t) => {
  const E = require('../lib/island-errands');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'errand-accept-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('심부름꾼'));
  await req('/api/test/island/free-residents', a, {});
  const e = E.errandsOf(new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10))[0]; const n = e.from;
  const talk = async (body) => { for (let i = 0; i < 6; i += 1) { const w = await serverAt(req, a, n); const [dx, dz] = SIDES[i % SIDES.length]; await req('/api/plaza/state', a, { x: w.x + dx, z: w.z + dz, yaw: 0, moving: false }); const r = await req('/api/island/resident/talk', a, { n, ...body }); if (r.status !== 409 || r.data.error !== 'TOO_FAR') return r; } throw new Error('never by them'); };
  const offered = (await talk({})).data; // (the talk begun -- by the asker, the errand first)
  assert.equal(offered.offer?.id, e.id, JSON.stringify(offered)); assert.equal(offered.offer.title, E.title(e)); assert.ok(offered.offer.reward > 0); assert.equal(offered.offer.until, '오늘 안에');
  assert.equal(offered.track.length, 0, '말만 걸어서는 시작 안 함');
  const later = (await talk({ topic: 'decline' })).data; assert.equal(later.say.length > 0, true);
  assert.equal((await req('/api/island/errands', a)).data.track.length, 0, '다음에요: 기록 없음');
  assert.equal((await talk({ topic: 'errand' })).data.offer?.id, e.id, '다시 말 걸면 다시 부탁');
  assert.equal((await talk({ topic: 'accept', errand: 'errand_nope' })).status, 409);
  const took = (await talk({ topic: 'accept', errand: e.id })).data;
  assert.deepEqual([took.accepted.id, took.track.map((x) => x.id)], [e.id, [e.id]]);
  assert.equal((await talk({ topic: 'accept', errand: e.id })).status, 409, '두 번 받지 않음');
  const dropped = (await req('/api/island/errand/drop', a, { id: e.id })).data; assert.equal(dropped.track.length, 0);
  assert.equal((await req('/api/island/errand/drop', a, { id: e.id })).status, 409);
  assert.equal((await talk({ topic: 'errand' })).data.offer?.id, e.id, '그만둔 부탁은 다시 부탁');
});
