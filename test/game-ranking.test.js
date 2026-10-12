'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const R = require('../lib/game-ranking');
const { JsonMatchStore, PostgresMatchStore } = require('../lib/match-records');
const { testDatabase } = require('../test-support/pg-database');
const { boot } = require('../test-support/test-server');

// v1.10.71 게임별 랭킹 (한판마당 자료 03 공식): 10판 이상, 무승부 반 승, 윌슨 하한 → 판수 → 먼저 달성, 서울 월요일 0시 주
const games = (id, other, list, from = Date.parse('2026-10-12T01:00:00Z')) => list.map((result, i) => ({
  id: `${id}-${i}`, gameType: 'omok', at: new Date(from + i * 60000).toISOString(),
  outcomes: [{ id, result }, { id: other, result: result === 'win' ? 'loss' : result === 'loss' ? 'win' : 'draw' }],
}));

test('랭킹 공식: 10판 미만 제외, 판수가 적으면 같은 승률이라도 아래, 무승부는 반 승, 같은 점수는 같은 순위', () => {
  assert.ok(R.wilson(10, 0, 10) < R.wilson(30, 0, 30)); // 10전 10승 < 30전 30승
  assert.equal(R.wilson(5, 0, 10).toFixed(6), R.wilson(4, 2, 10).toFixed(6)); // 5승 = 4승 2무
  const rows = R.board([
    ...games('a', 'x', Array(12).fill('win')),
    ...games('b', 'y', [...Array(10).fill('win'), 'loss', 'loss']),
    ...games('c', 'z', Array(9).fill('win')), // 9판: 아직 순위 밖
  ]);
  assert.deepEqual(rows.filter((r) => ['a', 'b', 'c'].includes(r.id)).map((r) => [r.id, r.rank, r.n]), [['a', 1, 12], ['b', 2, 12]]);
  assert.ok(rows.every((r) => r.n >= R.MIN_GAMES));
  const tied = R.board([...games('p', 'q', Array(10).fill('draw'))]);
  assert.deepEqual(tied.map((r) => r.rank), [1, 1]);
  assert.equal(new Date(R.weekStart(Date.parse('2026-10-18T14:59:00Z'))).toISOString(), '2026-10-11T15:00:00.000Z'); // 일요일 23:59 KST
  assert.equal(new Date(R.weekStart(Date.parse('2026-10-18T15:00:00Z'))).toISOString(), '2026-10-18T15:00:00.000Z'); // 월요일 0시 KST
});

async function storeBehaves(store) {
  for (const m of [...games('a', 'x', ['win', 'loss']), ...games('b', 'y', ['win'], Date.parse('2026-10-01T00:00:00Z'))]) await store.recordMatch(m);
  await store.recordMatch({ id: 'other-1', gameType: 'connect4', at: '2026-10-12T02:00:00.000Z', outcomes: [{ id: 'a', result: 'win' }, { id: 'x', result: 'loss' }] });
  const week = await store.matchesOf('omok', '2026-10-11T15:00:00.000Z');
  assert.deepEqual(week.map((m) => m.outcomes[0].id).sort(), ['a', 'a']);
  assert.equal((await store.matchesOf('omok', '1970-01-01T00:00:00.000Z')).length, 3);
}

test('랭킹 조회: JSON 저장소 — 게임·기간으로 고른다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ranking-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const store = new JsonMatchStore(path.join(dir, 'match-records.json'));
  await store.init();
  await storeBehaves(store);
});

test('랭킹 조회: PostgreSQL 저장소 — 같은 동작', async (t) => {
  const database = await testDatabase();
  t.after(() => database.stop());
  const store = new PostgresMatchStore(database.url);
  t.after(() => store.pool.end());
  await store.init();
  await storeBehaves(store);
});

test('랭킹 API: 게임·기간, 순위가 없으면 빈 목록과 안내', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ranking-server-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const sa = await server.enter(await server.issue('랭커')); assert.ok(sa, server.logs());
  assert.equal((await req('/api/records/ranking?game=../x', sa)).status, 400);
  const r = (await req('/api/records/ranking?game=omok&week=all', sa)).data;
  assert.deepEqual([r.game, r.week, r.min, r.top, r.me], ['omok', 'all', 10, [], null]);
  assert.equal((await req('/api/records/ranking?game=omok', sa)).data.week, 'this');
});
