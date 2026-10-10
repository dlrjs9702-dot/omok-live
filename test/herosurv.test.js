'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JsonPointStore, PostgresPointStore } = require('../lib/point-store');
const { testDatabase } = require('../test-support/pg-database');
const { boot } = require('../test-support/test-server');

// v1.10.61 두 세계 영웅전: the game's leaderboard API answered by our server — game-center nickname, best run per account,
// one result per run, no longer than the run really took; the page carries the session to the game's calls.
const A = 'guest:11111111-1111-4111-8111-111111111111';
const B = 'guest:22222222-2222-4222-8222-222222222222';

async function storeBehaves(store) {
  assert.deepEqual(await store.herosurvRun({ userId: A, board: 'heroes-r14', name: '가나', score: 500, durationMs: 1000, meta: { hero: 'witch', kills: 3, bad: { x: 1 } } }), { personalBest: true });
  assert.deepEqual(await store.herosurvRun({ userId: A, board: 'heroes-r14', name: '가나다', score: 400, durationMs: 1000, meta: {} }), { personalBest: false });
  await store.herosurvRun({ userId: B, board: 'heroes-r14', name: '라마', score: 900, durationMs: 2000, meta: {} });
  await store.herosurvRun({ userId: B, board: 'heroes-r15', name: '라마', score: 1, durationMs: 1, meta: {} });
  const rows = await store.herosurvBoard('heroes-r14');
  assert.deepEqual(rows.map((r) => [r.userId, r.name, r.score]), [[B, '라마', 900], [A, '가나다', 500]]); // best kept, name follows
  assert.deepEqual(rows[1].meta, { hero: 'witch', kills: 3 });
  await assert.rejects(store.herosurvRun({ userId: A, board: 'heroes-r14', name: 'x', score: -1, durationMs: 0 }), RangeError);
}

test('영웅전 기록: JSON 저장소 — 계정별 최고 기록만, 이름은 최근 것', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'herosurv-'));
  const file = path.join(dir, 'points.json');
  const store = new JsonPointStore(file);
  await store.init();
  await storeBehaves(store);
  const again = new JsonPointStore(file); // survives a restart
  await again.init();
  assert.equal((await again.herosurvBoard('heroes-r14')).length, 2);
  await fs.rm(dir, { recursive: true, force: true });
});

test('영웅전 기록: PostgreSQL 저장소 — 같은 동작', async (t) => {
  const database = await testDatabase();
  t.after(() => database.stop());
  const store = new PostgresPointStore(database.url);
  t.after(() => store.pool.end());
  await store.init();
  await storeBehaves(store);
  // two first runs of one account at once: the higher one stays, whichever lands last (Codex review)
  const C = 'guest:33333333-3333-4333-8333-333333333333';
  const results = await Promise.all([900, 100, 500].map((score) => store.herosurvRun({ userId: C, board: 'heroes-r14', name: '동시', score, durationMs: 1, meta: {} })));
  assert.equal((await store.herosurvBoard('heroes-r14')).find((r) => r.userId === C).score, 900);
  assert.ok(results.some((r) => r.personalBest));
});

test('영웅전 API: 게임센터 닉네임으로 기록·순위, 판마다 한 번, 실제 시간보다 긴 기록 거부', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'herosurv-server-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const { req, issue, enter, base } = await boot(t, dir);
  const session = await enter(await issue('영웅'));
  const call = async (route, method, body, token = session) => {
    const res = await fetch(base + '/api/leaderboards/v1/' + route, { method, headers: { 'X-Session-Token': token, 'Content-Type': 'application/json', Authorization: 'Bearer game-token' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };

  assert.equal((await call('boards/heroes-r14?limit=1', 'GET', null, 'nope')).status, 401);
  const guest = await call('guests', 'POST', { displayName: '용사abc' });
  assert.equal(guest.status, 201);
  assert.equal(guest.data.displayName, '영웅'); // the game's random name is not used
  assert.equal((await call('me', 'PUT', { displayName: '바꾼이름' })).data.displayName, '영웅');

  const run = await call('boards/heroes-r14/runs', 'POST', { protocolVersion: 1, rulesVersion: 'r14' });
  assert.equal(run.status, 201);
  assert.equal(run.data.rulesVersion, 'r14');
  assert.equal((await call(`runs/${run.data.runId}`, 'PUT', { durationMs: 10 * 60 * 1000, score: 5, meta: {} })).status, 400); // longer than the run
  const run2 = await call('boards/heroes-r14/runs', 'POST', {});
  const done = await call(`runs/${run2.data.runId}`, 'PUT', { durationMs: 100, score: 2746, meta: { hero: 'witch', victory: false } });
  assert.deepEqual([done.status, done.data.accepted, done.data.personalBest], [200, true, true]);
  assert.equal((await call(`runs/${run2.data.runId}`, 'PUT', { durationMs: 100, score: 9999, meta: {} })).status, 404); // once per run

  const other = await enter(await issue('남의계정'));
  const run3 = await call('boards/heroes-r14/runs', 'POST', {}, other);
  assert.equal((await call(`runs/${run3.data.runId}`, 'PUT', { durationMs: 1, score: 1, meta: {} })).status, 404); // not my run

  const board = await call('boards/heroes-r14?limit=100', 'GET');
  assert.equal(board.data.total, 1);
  assert.deepEqual(board.data.entries.map((e) => [e.displayName, e.score, e.rank, e.mine]), [['영웅', 2746, 1, true]]);
  assert.equal(board.data.entries[0].playerId, guest.data.playerId);
  assert.deepEqual([board.data.myRank.rank, board.data.myRank.score], [1, 2746]);
  assert.equal((await call('boards/heroes-r14', 'GET', null, other)).data.myRank.rank, null);

  const page = await fetch(base + '/herosurv/', { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/140.0.0.0', 'Sec-CH-UA': '"Google Chrome";v="140"' } });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<script src="\/herosurv\/boot\.js\?h=/);
  assert.doesNotMatch(html, /__HEROSURV_ASSETS__|<script>/);
  assert.match(page.headers.get('content-security-policy'), /connect-src 'self' https:\/\/gamecenter-games\.dlrjs9702\.workers\.dev;/);
  assert.equal((await req('/herosurv/index.html')).status, 404); // the page only through its route
});
