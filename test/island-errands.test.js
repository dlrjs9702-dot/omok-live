const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../lib/island-errands');
const Cast = require('../public/plaza/island-cast');

// v1.10.91 주민 대화·심부름 (사용자 2026-10-18)
test('주민: 열 명 모두 이름·설정·대사, 이야기 주민도 대사, 조사 처리', () => {
  assert.equal(Cast.WALKERS.length, 10);
  for (const c of Cast.WALKERS) { assert.ok(c.name && c.role && c.about); assert.equal(c.lines.length, 4); for (const l of c.lines) assert.ok(l.length >= 3); assert.ok(Cast.walkerLine(c.n, () => 0.9, 'day')); }
  assert.equal(new Set(Cast.WALKERS.map((c) => c.name)).size, 10);
  assert.equal(Cast.walkerLine(0, () => 0, 'night'), Cast.withTail(Cast.WALKERS[0].night, 0)); // (T: 봄이's 「꽃!」 at the end)
  for (const id of ['granny', 'fisher', 'photographer', 'photomemory', 'farmer', 'kid']) { assert.ok(Cast.keeperLine(id, () => 0)); assert.ok(Cast.keeperN(id) >= 10); }
  // 호감도 4단계: levels by points, each its own lines, the player's name in the close ones
  assert.deepEqual([0, 4, 5, 14, 15, 29, 30, 999].map(Cast.levelOf), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(Cast.walkerLine(0, () => 0.99, 'day', 0), Cast.withTail(Cast.WALKERS[0].lines[0][2], 0));
  assert.match(Cast.walkerLine(0, () => 0.5, 'day', 3, '모모'), /모모/); assert.doesNotMatch(Cast.walkerLine(0, () => 0.5, 'day', 3, '모모'), /{me}/);
  for (const c of Cast.WALKERS) for (const l of c.lines.flat()) assert.ok(!/{(?!me})/.test(l), l);
  assert.deepEqual([Cast.josa('다온', '이가'), Cast.josa('봄이', '이가'), Cast.josa('가람', '을를'), Cast.josa('두리', '을를')], ['다온이', '봄이가', '가람을', '두리를']);
});

test('심부름: 하루 세 개(같은 날 같음, 부탁하는 사람 다름), 찾기는 찾고 알리면, 전하기는 전하면 한 번 사례', () => {
  const day = '2026-10-18'; const es = E.errandsOf(day);
  assert.deepEqual(E.errandsOf(day), es); assert.notDeepEqual(E.errandsOf('2026-10-19').map((e) => e.id), es.map((e) => e.id));
  assert.equal(es.length, 3); assert.equal(new Set(es.map((e) => e.from)).size, 3); for (const e of es) if (e.kind !== 'buy') assert.notEqual(e.from, e.to);
  // v1.10.92 잡화점: at most one 'buy' a day, over a month every kind comes
  const month = Array.from({ length: 30 }, (_, i) => E.errandsOf(`2026-11-${String(i + 1).padStart(2, '0')}`));
  assert.ok(month.every((d) => d.filter((e) => e.kind === 'buy').length <= 1)); assert.deepEqual([...new Set(month.flat().map((e) => e.kind))].sort(), ['buy', 'deliver', 'find']);
  for (const e of month.flat().filter((x) => x.kind === 'buy')) assert.ok(E.BUY_GOODS.includes(e.good) && e.from === e.to);
  // both kinds, made up by hand
  const find = { id: 'errand_x_0', kind: 'find', from: 0, to: 1, reward: 2000, why: '할 말이 있어요' };
  const give = { id: 'errand_x_1', kind: 'deliver', from: 2, to: 3, reward: 1500, thing: '편지' };
  const list = [find, give]; const done = new Set(); let st = {};
  assert.deepEqual(E.marks(list, st, done), { 0: 'new', 2: 'new' });
  assert.equal(E.talk(list, st, done, 1), null); // nothing asked yet: their own words
  let r = E.talk(list, st, done, 0); assert.deepEqual([r.offer, r.stages, r.took], [find, st, null]); assert.match(r.say.join(' '), /바다 할아버지를 못 봤어요/); // (T2: their own word first; Q: only offered)
  assert.deepEqual(E.track(list, st, done), [], '「다음에요」: nothing kept');
  assert.equal(E.accept(list, st, done, 2, find.id), null, '남의 부탁은 못 받음');
  r = E.accept(list, st, done, 0, find.id); st = r.stages; assert.equal(r.took, find); assert.equal(E.accept(list, st, done, 0, find.id), null, '두 번은 아님');
  assert.deepEqual(E.track(list, st, done).map((t) => t.to), [1]);
  r = E.talk(list, st, done, 0); assert.match(r.say[0], /아직 못 찾았어요/); assert.equal(r.pay, null); // a reminder
  r = E.talk(list, st, done, 1); st = r.stages; assert.equal(r.pay, null); assert.match(r.say[0], /봄이가 (저|나)를 찾는다고/); // (T: in the walker's own words)
  assert.equal(E.marks(list, st, done)[0], 'ready');
  r = E.talk(list, st, done, 0); st = r.stages; assert.equal(r.pay, find); done.add(find.id);
  r = E.talk(list, st, done, 2); assert.match(r.say.join(' '), /편지, 두리에게/); st = E.accept(list, st, done, 2, give.id).stages;
  r = E.talk(list, st, done, 3); assert.equal(r.pay, give); assert.match(r.say[0], /하람이 보낸 편지요/); done.add(give.id); st = r.stages;
  assert.equal(E.talk(list, st, done, 0), null); assert.equal(E.talk(list, st, done, 2), null); // both done: their own words again
  assert.deepEqual(E.marks(list, st, done), {}); assert.deepEqual(E.track(list, st, done), []);
  // a store errand: asked, the star only once the good is in the bag, then it is taken and paid
  const buy = { id: 'errand_x_2', kind: 'buy', from: 6, to: 6, reward: 1500, good: 'milk', thing: '우유' };
  r = E.talk([buy], {}, done, 6); assert.match(r.say.join(' '), /우유가 필요한데/); st = E.accept([buy], {}, done, 6, buy.id).stages;
  assert.deepEqual(E.drop([buy], st, done, buy.id), { [buy.id]: 0 }, '그만두면 다시 부탁받는 상태로'); assert.equal(E.drop([buy], {}, done, buy.id), null);
  assert.deepEqual(E.marks([buy], st, done), {}); assert.equal(E.talk([buy], st, done, 6).pay, null);
  assert.deepEqual(E.marks([buy], st, done, new Set(['milk'])), { 6: 'ready' });
  r = E.talk([buy], st, done, 6, new Set(['milk'])); assert.equal(r.take, 'milk'); assert.equal(r.pay, buy);
});

async function affinityBehaves(store, reopen) {
  const a = 'guest:00000000-0000-4000-8000-0000000000c1'; const b = 'guest:00000000-0000-4000-8000-0000000000c2';
  assert.deepEqual(await store.affinityOf(a), {});
  await store.affinityAdd(a, '2026-10-18', [{ n: 2, delta: 1, daily: true }]);
  await store.affinityAdd(a, '2026-10-18', [{ n: 2, delta: 1, daily: true }, { n: 2, delta: 3 }]);
  assert.deepEqual(await store.affinityOf(a), { 2: 4 });
  await store.affinityAdd(a, '2026-10-19', [{ n: 2, delta: 1, daily: true }]);
  assert.equal((await store.affinityOf(a))[2], 5); assert.deepEqual(await store.affinityOf(b), {});
  for (let k = 0; k < 101; k += 1) await store.affinityAdd(a, '2026-10-19', [{ n: 3, delta: 10 }]);
  assert.equal((await store.affinityOf(a))[3], 999);
  await assert.rejects(store.affinityAdd(a, '2026-10-19', [{ n: 2, delta: 50 }]));
  await Promise.all([1, 2, 3].map(() => store.affinityAdd(b, '2026-10-19', [{ n: 7, delta: 1, daily: true }]))); // two talks at once: once (Codex)
  assert.deepEqual(await store.affinityOf(b), { 7: 1 });
  if (reopen) assert.deepEqual(await (await reopen()).affinityOf(a), { 2: 5, 3: 999 });
}
test('호감도 저장(JSON): 하루 첫 대화는 한 번만, 심부름은 매번, 상한, 계정별·재시작 유지', async () => {
  const fs = require('node:fs/promises'); const os = require('node:os'); const path = require('node:path');
  const { JsonPointStore } = require('../lib/point-store');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'affinity-')); const file = path.join(dir, 'points.json');
  const store = new JsonPointStore(file); await store.init();
  await affinityBehaves(store, async () => { const again = new JsonPointStore(file); await again.init(); return again; });
  await fs.rm(dir, { recursive: true, force: true });
});
test('호감도 저장(PostgreSQL): 같은 규칙, 새 표 resident_affinity', async (t) => {
  const { PostgresPointStore } = require('../lib/point-store'); const { testDatabase } = require('../test-support/pg-database');
  const database = await testDatabase(); t.after(() => database.stop());
  const pg = new PostgresPointStore(database.url, { initialGrant: 1_000_000 }); t.after(() => pg.pool.end()); await pg.init();
  await affinityBehaves(pg, null);
});

test('A-6 주민끼리 수다·섬 소문·상황 대사', () => {
  // 수다: a, b, a, a quiet beat, then b opens; names filled
  const lines = [0, 1, 2, 3, 4].map((s) => Cast.chatLine(3, 8, s));
  assert.deepEqual(lines.map((l) => l?.who ?? null), [3, 8, 3, null, 8]);
  assert.match(lines[0].text, /^이솔, /); assert.match(lines[4].text, /^두리, /);
  // 소문: what the island has today; my errand's islander first
  assert.match(Cast.rumor({ weather: 'rain' }, () => 0.9), /비가/);
  assert.match(Cast.rumor({ weather: 'clear', hint: { n: 3, where: '섬 북쪽 언덕', errand: true } }, () => 0.9), /^두리는 요즘 섬 북쪽 언덕 근처/);
  assert.match(Cast.rumor({ contest: { phase: 'live', name: '낚시 대회' } }, () => 0), /낚시 대회/);
  for (const k of Object.keys(Cast.MOODS)) assert.equal(Cast.MOODS[k].length, 10);
  assert.equal(Cast.walkerLine(0, () => 0, 'day', 1, '', ['rain']), Cast.withTail(Cast.MOODS.rain[0], 0));
});

// 묶음 1 멀리 심부름 (residents-talk-hills-20261018.md 4): the one to find or bring to lives far from the asker (one of the
// three farthest), a step more for the way, and the asker tells where they are usually seen -- in words only
test('멀리 심부름: 상대는 부탁한 주민에게서 먼 주민, 거리 단계 보상, 어디 있는지 말로 힌트', () => {
  const Npcs = require('../public/plaza/island-npcs');
  const apart = (a, b) => { const p = Npcs.homeOf(a); const q = Npcs.homeOf(b); return Math.hypot(p.x - q.x, p.z - q.z); };
  const month = Array.from({ length: 30 }, (_, i) => E.errandsOf(`2026-11-${String(i + 1).padStart(2, '0')}`)).flat().filter((e) => e.kind !== 'buy');
  for (const e of month) {
    const rank = Cast.WALKERS.map((_, n) => n).filter((n) => n !== e.from).sort((a, b) => apart(e.from, b) - apart(e.from, a)).indexOf(e.to);
    assert.ok(rank < 3, `${e.id}: ${rank}`); assert.ok([0, 1, 2].includes(e.far) && e.where);
  }
  assert.ok(month.filter((e) => e.far > 0).length >= month.length * 0.6);
  const e = month[0]; const r = E.talk([e], {}, new Set(), e.from);
  assert.ok(r.say.some((l) => l.includes(e.where) && l.includes('근처')), r.say.join(' / '));
  assert.match(E.talk([e], E.accept([e], {}, new Set(), e.from, e.id).stages, new Set(), e.from).say[0], e.kind === 'find' ? new RegExp(e.where) : /아직 못 전했죠/);
});
