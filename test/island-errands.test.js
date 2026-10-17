const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../lib/island-errands');
const Cast = require('../public/plaza/island-cast');

// v1.10.91 주민 대화·심부름 (사용자 2026-10-18)
test('주민: 열 명 모두 이름·설정·대사, 이야기 주민도 대사, 조사 처리', () => {
  assert.equal(Cast.WALKERS.length, 10);
  for (const c of Cast.WALKERS) { assert.ok(c.name && c.role && c.about); assert.equal(c.lines.length, 4); for (const l of c.lines) assert.ok(l.length >= 3); assert.ok(Cast.walkerLine(c.n, () => 0.9, 'day')); }
  assert.equal(new Set(Cast.WALKERS.map((c) => c.name)).size, 10);
  assert.equal(Cast.walkerLine(0, () => 0, 'night'), Cast.WALKERS[0].night);
  for (const id of ['granny', 'fisher', 'photographer', 'photomemory', 'farmer', 'kid']) { assert.ok(Cast.keeperLine(id, () => 0)); assert.ok(Cast.keeperN(id) >= 10); }
  // 호감도 4단계: levels by points, each its own lines, the player's name in the close ones
  assert.deepEqual([0, 4, 5, 14, 15, 29, 30, 999].map(Cast.levelOf), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(Cast.walkerLine(0, () => 0.99, 'day', 0), Cast.WALKERS[0].lines[0][2]);
  assert.match(Cast.walkerLine(0, () => 0.5, 'day', 3, '모모'), /모모/); assert.doesNotMatch(Cast.walkerLine(0, () => 0.5, 'day', 3, '모모'), /{me}/);
  for (const c of Cast.WALKERS) for (const l of c.lines.flat()) assert.ok(!/{(?!me})/.test(l), l);
  assert.deepEqual([Cast.josa('다온', '이가'), Cast.josa('봄이', '이가'), Cast.josa('가람', '을를'), Cast.josa('두리', '을를')], ['다온이', '봄이가', '가람을', '두리를']);
});

test('심부름: 하루 세 개(같은 날 같음, 부탁하는 사람 다름), 찾기는 찾고 알리면, 전하기는 전하면 한 번 사례', () => {
  const day = '2026-10-18'; const es = E.errandsOf(day);
  assert.deepEqual(E.errandsOf(day), es); assert.notDeepEqual(E.errandsOf('2026-10-19').map((e) => e.id), es.map((e) => e.id));
  assert.equal(es.length, 3); assert.equal(new Set(es.map((e) => e.from)).size, 3); for (const e of es) assert.notEqual(e.from, e.to);
  // both kinds, made up by hand
  const find = { id: 'errand_x_0', kind: 'find', from: 0, to: 1, reward: 2000, why: '할 말이 있어요' };
  const give = { id: 'errand_x_1', kind: 'deliver', from: 2, to: 3, reward: 1500, thing: '편지' };
  const list = [find, give]; const done = new Set(); let st = {};
  assert.deepEqual(E.marks(list, st, done), { 0: 'new', 2: 'new' });
  assert.equal(E.talk(list, st, done, 1), null); // nothing asked yet: their own words
  let r = E.talk(list, st, done, 0); st = r.stages; assert.equal(r.took, find); assert.match(r.say[0], /바다 할아버지를 못 봤어요/);
  assert.deepEqual(E.track(list, st, done).map((t) => t.to), [1]);
  r = E.talk(list, st, done, 0); assert.match(r.say[0], /아직 못 찾았어요/); assert.equal(r.pay, null); // a reminder
  r = E.talk(list, st, done, 1); st = r.stages; assert.equal(r.pay, null); assert.match(r.say[0], /봄이가 저를 찾는다고요/);
  assert.equal(E.marks(list, st, done)[0], 'ready');
  r = E.talk(list, st, done, 0); st = r.stages; assert.equal(r.pay, find); done.add(find.id);
  r = E.talk(list, st, done, 2); st = r.stages; assert.match(r.say[0], /편지, 두리에게/);
  r = E.talk(list, st, done, 3); assert.equal(r.pay, give); assert.match(r.say[0], /하람이 보낸 편지요/); done.add(give.id); st = r.stages;
  assert.equal(E.talk(list, st, done, 0), null); assert.equal(E.talk(list, st, done, 2), null); // both done: their own words again
  assert.deepEqual(E.marks(list, st, done), {}); assert.deepEqual(E.track(list, st, done), []);
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
