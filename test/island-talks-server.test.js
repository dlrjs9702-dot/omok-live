'use strict';
// v1.10.266 주민 대화 나무 (gamecenter-notes docs/resident-talk-trees-20261104.md): a topic begun and walked reply by reply on the
// server (it keeps where the talk stands), each fitting reply +1 호감도, an end's keepsake once a day from each, its hint true to
// the island now (봄이: the weeds' place), a topic once a day and three a day; a reply without a talk refused. And 오늘의 물때:
// the same waters for everyone that day, the rare fish 1.5 times as often there.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Npcs = require('../public/plaza/island-npcs');
const T = require('../public/plaza/island-terrain');
const Talks = require('../lib/island-talks');
const F = require('../lib/island-fishing');
const { boot } = require('../test-support/test-server');
const seoulPhase = (ms) => { const h = new Date(ms + 9 * 3600000).getUTCHours(); return h >= 6 && h < 10 ? 'morning' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'evening' : 'night'; };
Npcs.setPhaseOf(seoulPhase);
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7]];
async function serverAt(req, who, n) { const guess = Npcs.residentAt(n, Date.now(), null); const st = (await req('/api/plaza/state', who, { x: guess.x, z: guess.z, yaw: 0, moving: false })).data.residents?.[n] || null; return Npcs.residentAt(n, Date.now(), st); }

test('오늘의 물때: 날마다 바다 쪽 하나·민물 하나(모두 같음), 그 물에서 귀한 물고기 1.5배, 대어 0.8%는 그대로', () => {
  const h = F.hotOf('2026-11-08'); assert.ok(['sea', 'bay'].includes(h.sea) && ['river', 'lake', 'pool'].includes(h.fresh)); assert.deepEqual(F.hotOf('2026-11-08'), h);
  assert.ok(new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(F.hotOf(`2026-12-${String(i + 1).padStart(2, '0')}`)))).size > 2); // (it moves day by day)
  let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const share = (hot) => { let rare = 0; let big = 0; const N = 40000; for (let i = 0; i < N; i += 1) { const id = F.draw(rnd, { water: 'sea', season: 'summer', night: false, hot }); if (F.SPECIES[id].grade === 'rare') rare += 1; if (F.SPECIES[id].grade === 'big') big += 1; } return { rare: rare / N, big: big / N }; };
  const cold = share(false); const warm = share(true);
  assert.ok(warm.rare / cold.rare > 1.3 && warm.rare / cold.rare < 1.6, JSON.stringify({ cold, warm })); assert.ok(Math.abs(warm.big - cold.big) < 0.004);
});

test('대화 힌트는 섬 지금 상태 그대로: 물때·밤 물고기·도감 빈칸·곤충·대회·사업, 이야기 책이 없으면 다음 갈 곳 없음', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'talk-hints-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('힌트손님')); await req('/api/plaza/state', a, { x: 0, z: 6, yaw: 0, moving: false });
  const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); const names = { sea: '바깥 바다', bay: '윤슬만', river: '강', lake: '거울호수', pool: '폭포 웅덩이' };
  for (const n of [0, 1]) {
    const h = (await req('/api/test/talk-hints', a, { n })).data.hints;
    assert.equal(h.fishHot.vals.place, names[n % 2 ? F.hotOf(day).fresh : F.hotOf(day).sea]); // (봄이 the sea-side one, 해송 the fresh)
    const night = Object.entries(F.SPECIES).find(([, s]) => s.name === h.nightFish.vals.fish); assert.ok(night && night[1].night, JSON.stringify(h.nightFish));
    const gap = Object.entries(F.SPECIES).find(([, s]) => s.name === h.dexGap.vals.name); assert.ok(gap && gap[1].grade !== 'big' && ['낮', '밤'].includes(h.dexGap.vals.time)); // (nothing in my 도감 yet)
    const bugs = (await req('/api/island/insects', a)).data; const list = bugs.insects || bugs.list || [];
    if (h.insectNow) assert.ok(list.some((b) => Math.abs(b.x - h.insectNow.at.x) < 0.01 && Math.abs(b.z - h.insectNow.at.z) < 0.01), 'an insect out now');
    assert.ok(h.contestTip.vals.game.endsWith('대회') && h.contestTip.vals.tip.length > 5);
    assert.ok(/P$/.test(h.project?.vals.left || 'P'));
    assert.equal(h.storyNext, undefined); // (no story book under way)
  }
});

test('주민 대화 나무 서버: 주제 시작·대답으로 마디 넘기기·호감도 +1·선물 하루 한 번·잡초 힌트 참·하루 한 번·하루 세 주제·끊긴 대답 거절', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'talks-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('이야기손님'));
  await req('/api/test/island/free-residents', a, {});
  const n = 0; // 봄이 (her hint: the weeds)
  const by = async (i) => { const w = await serverAt(req, a, n); const [dx, dz] = SIDES[i % SIDES.length]; await req('/api/plaza/state', a, { x: w.x + dx, z: w.z + dz, yaw: 0, moving: false }); };
  const talk = async (body) => { for (let i = 0; i < 6; i += 1) { await by(i); const r = await req('/api/island/resident/talk', a, { n, ...body }); if (r.status !== 409 || r.data.error !== 'TOO_FAR') return r; } throw new Error('never by them'); };
  const first = await talk({}); assert.equal(first.status, 200, JSON.stringify(first.data));
  assert.deepEqual(first.data.talks.topics.map((x) => x.id), ['today', 'hint']); assert.equal(first.data.talks.left, 3);
  assert.equal((await talk({ topic: 'talk', talk: 'work' })).data.error, 'TALK_CLOSED'); // (아는 사이 first)
  assert.equal((await talk({ topic: 'talk', talk: 'today', reply: 0 })).data.error, 'TALK_GONE'); // (no talk begun)
  // a topic walked to its end, the first reply each time: each fitting reply +1, two a day from the trees at most
  let gained = 0;
  const walk = async (id, choose = () => 0) => {
    const b = await talk({ topic: 'talk', talk: id }); assert.equal(b.status, 200, JSON.stringify(b.data)); assert.equal(b.data.talk.node, 'start');
    assert.ok(b.data.say.every((l) => !/\{/.test(l)), JSON.stringify(b.data.say)); assert.ok(b.data.talk.replies.length >= 2);
    let r = b; let node = 'start'; let points = b.data.affinity.points;
    for (let step = 0; step < 12 && !r.data.talk.end; step += 1) {
      const i = choose(r.data.talk.replies); const ans = Talks.answer(n, id, node, i);
      r = await talk({ topic: 'talk', talk: id, reply: i }); assert.equal(r.status, 200, JSON.stringify(r.data));
      const up = ans.delta && gained < 2 ? 1 : 0; gained += up;
      assert.equal(r.data.affinity.points, points + up); points = r.data.affinity.points; node = r.data.talk.node;
      assert.ok(r.data.say.every((l) => !/\{/.test(l)), JSON.stringify(r.data.say));
    }
    assert.equal(r.data.talk.end, true); return r;
  };
  assert.equal((await talk({ topic: 'talk', talk: 'today', reply: 9 })).data.error, 'TALK_GONE');
  const b0 = await talk({ topic: 'talk', talk: 'today' }); assert.equal((await talk({ topic: 'talk', talk: 'today', reply: 9 })).status, 400); // (no such reply)
  // 봄이's 「요즘 어때요?」: the first replies lead to 「눌러 말린 꽃잎」 (e1) -- the day's keepsake from her
  let r = null; let node = 'start'; for (let i = 0; i < 3; i += 1) {
    if (i === 1) assert.equal((await talk({ topic: 'talk', talk: 'today', reply: 0, node: 'start' })).data.error, 'TALK_STALE'); /* (Codex 261-270 #3: the first reply sent again -- it does not move the talk a second step) */
    gained += Talks.answer(n, 'today', node, 0).delta && gained < 2 ? 1 : 0; r = await talk({ topic: 'talk', talk: 'today', reply: 0, node }); node = r.data.talk.node;
  }
  assert.equal(r.data.talk.end, true); assert.equal(r.data.gift, '눌러 말린 꽃잎');
  assert.deepEqual((await req('/api/island/dex', a)).data.given.map((g) => [g.from, g.name]), [['봄이', '눌러 말린 꽃잎']]); // (v1.10.267 받은 것) void b0;
  assert.equal((await talk({ topic: 'talk', talk: 'today' })).data.error, 'TALK_DONE');
  // 「뭐 좋은 거 없어요?」: the weeds -- the place with the most of them now, by the island's areas
  const hint = await walk('hint', (rs) => rs.findIndex((x) => /어디/.test(x)) >= 0 ? rs.findIndex((x) => /어디/.test(x)) : 0);
  assert.equal(hint.data.hint?.kind, 'weeds', JSON.stringify(hint.data));
  const ws = (await req('/api/island/weeds', a)).data.weeds; const count = new Map();
  for (const [, x, z] of ws) { let best = null; let bd = 60; for (const [k, ar] of Object.entries(T.AREAS)) { const d = Math.hypot(ar.x - x, ar.z - z); if (d < bd) { bd = d; best = k; } } if (best) count.set(best, (count.get(best) || 0) + 1); }
  const top = T.AREAS[[...count.entries()].sort((p, q) => q[1] - p[1])[0][0]].label;
  assert.ok(hint.data.say.join(' ').includes(top), `${hint.data.say.join(' ')} / ${top}`); assert.equal(hint.data.hint.at.label, top);
  assert.equal(hint.data.talks.hintTold, true);
  // 아는 사이: two more open; the third topic today is the last
  await req('/api/test/affinity', a, { n, delta: 10 });
  const more = await talk({}); assert.ok(more.data.talks.topics.some((x) => x.id === 'work')); assert.equal(more.data.talks.left, 1);
  assert.equal(more.data.talks.topics.find((x) => x.id === 'today').fresh, false);
  await walk('work'); assert.equal((await talk({ topic: 'talk', talk: 'you' })).data.error, 'TALK_TIRED');
});

test('대화 나무 호감도 구멍 막기(총괄 검토): 시작·대답·다시 시작은 TALK_DONE(그만둬도 그날 끝), 맞는 대답 여럿도 주민마다 하루 +2', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'talk-cap-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('호감손님'));
  await req('/api/test/island/free-residents', a, {});
  const n = 0;
  const by = async (i) => { const w = await serverAt(req, a, n); const [dx, dz] = SIDES[i % SIDES.length]; await req('/api/plaza/state', a, { x: w.x + dx, z: w.z + dz, yaw: 0, moving: false }); };
  const talk = async (body) => { for (let i = 0; i < 6; i += 1) { await by(i); const r = await req('/api/island/resident/talk', a, { n, ...body }); if (r.status !== 409 || r.data.error !== 'TOO_FAR') return r; } throw new Error('never by them'); };
  const start = (await talk({})).data.affinity.points; // (the day's first talk: its own +1, before this)
  const fit = (id, node) => { const nd = Talks.topicOf(n, id).nodes[node]; const i = nd.replies.findIndex((x) => x[2] > 0); return i >= 0 ? i : 0; };
  // begun, one reply, begun again: refused, the first talk goes on
  assert.equal((await talk({ topic: 'talk', talk: 'today' })).status, 200);
  let r = await talk({ topic: 'talk', talk: 'today', reply: fit('today', 'start') }); assert.equal(r.data.affinity.points, start + 1);
  assert.equal((await talk({ topic: 'talk', talk: 'today' })).data.error, 'TALK_DONE');
  // every fitting reply through two topics: +2 for the day all the same
  let fits = Talks.answer(n, 'today', 'start', fit('today', 'start')).delta;
  for (const id of ['today', 'hint']) {
    if (id === 'hint') { r = await talk({ topic: 'talk', talk: 'hint' }); assert.equal(r.status, 200); }
    for (let step = 0; step < 12 && !r.data.talk.end; step += 1) { const i = fit(id, r.data.talk.node); fits += Talks.answer(n, id, r.data.talk.node, i).delta; r = await talk({ topic: 'talk', talk: id, reply: i }); assert.equal(r.status, 200, JSON.stringify(r.data)); }
  }
  assert.ok(fits >= 3, `fitting replies ${fits}`); assert.equal(r.data.affinity.points, start + 2);
});
