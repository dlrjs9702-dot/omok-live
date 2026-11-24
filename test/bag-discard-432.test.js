'use strict';
// 1.10.432 가방 버리기 (사용자 결정 92 전부 A): one entry's count gone for good, judged by the store -- the count checked, a lost thing and
// what an errand I took asks for kept, one request once; 되돌리기 the same things back under its own claim (never twice); JSON and
// PostgreSQL alike
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JsonPointStore, PostgresPointStore } = require('../lib/point-store');
const { testDatabase } = require('../test-support/pg-database');
const Errands = require('../lib/island-errands');
const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

const U = 'guest:00000000-0000-4000-8000-0000000004d2';
const V = 'guest:00000000-0000-4000-8000-0000000004d3';
const rid = (k) => `req-${String(k).padStart(8, '0')}`;
const find = (bag, itemId) => bag.items.filter((e) => e.itemId === itemId);
const total = (bag, itemId) => find(bag, itemId).reduce((n, e) => n + e.qty, 0);

async function storeBehaves(store) {
  await store.islandGive({ userId: U, claimId: 'give-herb-0001', itemId: 'herb', qty: 7, quiet: true });
  await store.islandGive({ userId: U, claimId: 'give-fish-0001', itemId: 'fish_carp', qty: 1, meta: { size: 42 }, quiet: true });
  await store.islandGive({ userId: U, claimId: 'give-rod-00001', itemId: 'fishing_rod', qty: 1, quiet: true });
  await store.islandGive({ userId: U, claimId: 'give-lost-0001', itemId: 'lost', qty: 1, quiet: true });
  let bag = await store.islandBag(U); const herb = find(bag, 'herb')[0];
  assert.equal(herb.qty, 7);

  const part = await store.islandDiscard({ userId: U, requestId: rid(1), entryId: herb.entryId, qty: 3 });
  assert.equal(part.applied, true); assert.deepEqual([part.gone.itemId, part.gone.qty], ['herb', 3]); assert.equal(total(part.bag, 'herb'), 4, '7 - 3');
  const again = await store.islandDiscard({ userId: U, requestId: rid(1), entryId: herb.entryId, qty: 3 });
  assert.equal(again.applied, false); assert.equal(again.already, true, '같은 요청은 한 번만'); assert.equal(total(again.bag, 'herb'), 4);

  const over = await store.islandDiscard({ userId: U, requestId: rid(2), entryId: herb.entryId, qty: 5 });
  assert.deepEqual([over.applied, over.reason], [false, 'qty'], '가진 것보다 많이는 안 됨'); assert.equal(total(over.bag, 'herb'), 4);
  await assert.rejects(store.islandDiscard({ userId: U, requestId: rid(3), entryId: herb.entryId, qty: 0 }), RangeError);
  await assert.rejects(store.islandDiscard({ userId: U, requestId: rid(3), entryId: herb.entryId, qty: 1.5 }), RangeError);
  await assert.rejects(store.islandDiscard({ userId: U, requestId: 'x', entryId: herb.entryId, qty: 1 }), TypeError);

  bag = await store.islandBag(U);
  const lost = find(bag, 'lost')[0]; const keptLost = await store.islandDiscard({ userId: U, requestId: rid(4), entryId: lost.entryId, qty: 1 });
  assert.deepEqual([keptLost.applied, keptLost.reason, keptLost.itemId], [false, 'keep', 'lost'], '분실물은 안 됨'); assert.equal(total(keptLost.bag, 'lost'), 1);
  const keptErrand = await store.islandDiscard({ userId: U, requestId: rid(5), entryId: find(bag, 'herb')[0].entryId, qty: 1, keep: ['herb'] });
  assert.deepEqual([keptErrand.applied, keptErrand.reason], [false, 'keep'], '심부름 물건은 안 됨');
  const none = await store.islandDiscard({ userId: V, requestId: rid(6), entryId: find(bag, 'herb')[0].entryId, qty: 1 });
  assert.deepEqual([none.applied, none.reason], [false, 'missing'], '남의 가방 칸은 없음');

  const fish = find(bag, 'fish_carp')[0]; const goneFish = await store.islandDiscard({ userId: U, requestId: rid(7), entryId: fish.entryId, qty: 1 });
  assert.equal(goneFish.applied, true); assert.deepEqual(goneFish.gone.meta, { sizes: [42] }, '크기는 되돌리기 위해 남김'); assert.equal(total(goneFish.bag, 'fish_carp'), 0);
  const rod = find(bag, 'fishing_rod')[0]; const goneRod = await store.islandDiscard({ userId: U, requestId: rid(8), entryId: rod.entryId, qty: 1 });
  assert.equal(goneRod.applied, true, '도구도 버릴 수 있음'); assert.equal(total(goneRod.bag, 'fishing_rod'), 0);

  /* 되돌리기 as the server does it: the same things under the token's own claim -- twice gives once */
  const back = { userId: U, claimId: 'discard-undo:0000-fish', itemId: 'fish_carp', qty: 1, meta: goneFish.gone.meta, quiet: true, note: '버리기 되돌리기' };
  const b1 = await store.islandGive(back); assert.equal(b1.applied, true); assert.deepEqual(find(b1.bag, 'fish_carp')[0].sizes || find(b1.bag, 'fish_carp')[0].meta?.sizes, [42]);
  const b2 = await store.islandGive(back); assert.equal(b2.applied, false); assert.equal(total(b2.bag, 'fish_carp'), 1, '두 번 돌려받지 않음');
  const herbBack = await store.islandGive({ userId: U, claimId: 'discard-undo:0000-herb', itemId: 'herb', qty: 3, quiet: true });
  assert.equal(total(herbBack.bag, 'herb'), 7);

  /* two requests at once on the same 4: never more than there was */
  bag = await store.islandBag(U); const h = find(bag, 'herb')[0];
  const both = await Promise.all([store.islandDiscard({ userId: U, requestId: rid(9), entryId: h.entryId, qty: 5 }), store.islandDiscard({ userId: U, requestId: rid(10), entryId: h.entryId, qty: 5 })]);
  assert.equal(both.filter((r) => r.applied).length, 1, '7에서 5 두 번은 한 번만'); assert.equal(total(await store.islandBag(U), 'herb'), 2);
}

test('432 버리기 저장소: JSON·PostgreSQL 같은 동작(개수 · 분실물 · 심부름 · 한 번만 · 되돌리기 한 번 · 동시 요청)', async (t) => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'discard-')); rmAtExit(dir);
  const json = new JsonPointStore(path.join(dir, 'points.json'), { initialGrant: 100000 }); await json.init();
  await storeBehaves(json);
  const database = await testDatabase(); t.after(() => database.stop());
  const pg = new PostgresPointStore(database.url, { initialGrant: 100000 }); t.after(() => pg.pool.end()); await pg.init();
  await storeBehaves(pg);
});

test('432 심부름 물건: 받은 심부름(1단계)의 사 오기 · 재료만 -- 끝난 것과 안 받은 것은 아님', () => {
  const errands = [{ id: 'a', kind: 'buy', good: 'herb' }, { id: 'b', kind: 'material', good: 'ore_iron' }, { id: 'c', kind: 'buy', good: 'berry' }, { id: 'd', kind: 'deliver', good: 'candy' }, { id: 'e', kind: 'buy', good: 'twig' }];
  const held = Errands.heldGoods(errands, { a: 1, b: 1, c: 0, d: 1, e: 1 }, new Set(['e']));
  assert.deepEqual([...held].sort(), ['herb', 'ore_iron']);
});

test('432 서버 · 화면: 버리기 · 되돌리기(같은 사람 10초 한 번) · 빠른 칸 정리 · 관리자 기록', () => {
  assert.match(server, /pathname === '\/api\/island\/bag\/discard' && req\.method === 'POST'/);
  assert.match(server, /const DISCARD_UNDO_MS = 10000;/);
  assert.match(server, /if \(!u \|\| u\.account !== account \|\| u\.used \|\| nowMs\(\) - u\.at > DISCARD_UNDO_MS\) return sendError\(res, 409, 'UNDO_GONE'/);
  assert.match(server, /u\.used = true; \/\* \(before any wait/);
  assert.match(server, /claimId: `discard-undo:\$\{id\}`/);
  assert.match(server, /pathname === '\/api\/admin\/discards' && req\.method === 'GET'\) \{\r?\n\s+if \(!requireAdmin\(req, res\)\) return;/);
  assert.match(server, /log\.push\(\{ at: nowMs\(\), account, name: await accountName\(account\)/);
  assert.match(server, /keep: await errandKeep\(account\)/);
  assert.match(app, /out\.push\(\['버리기', \(\) => askDiscard\(item\)/);
  assert.match(app, /api\('\/api\/island\/bag\/discard\/undo'/);
  assert.match(html, /<dialog id="discardDialog"/); assert.match(html, /data-n="1">1개<\/button><button type="button" class="ghost tiny" data-n="all">전부<\/button><input id="discardCount" type="number"/);
  assert.match(html, /<details id="discardLogBox" class="economyBox"><summary>버린 기록<\/summary>/);
});
