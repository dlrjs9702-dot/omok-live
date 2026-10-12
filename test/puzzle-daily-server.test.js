'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const PuzzleDaily = require('../lib/puzzle-daily');
const { kstDate } = require('../lib/point-store');
const { boot } = require('../test-support/test-server');

// v1.10.69 오늘의 문제 (한판마당 자료): the server makes the day's answer again with the page's own generator, pays the
// first right answer of a game, level and day once, nothing for a wrong board, another day or a time nobody solves in.
test('오늘의 문제 정답: 네 퍼즐 모두 같은 날·난이도면 같은 정답, 틀린 판·다른 버전은 아님', async () => {
  const date = '2026-10-12';
  for (const game of Object.keys(PuzzleDaily.GAMES)) {
    const a = await PuzzleDaily.answer(game, 'easy', date);
    assert.ok(Array.isArray(a) && a.length > 0, game);
    assert.equal(await PuzzleDaily.verify(game, 'easy', { date, v: 1, sol: a }), true, game);
    assert.equal(await PuzzleDaily.verify(game, 'easy', { date, v: 1, sol: a.map((v, i) => (i ? v : v === 1 ? 2 : 1)) }), false, game);
    assert.equal(await PuzzleDaily.verify(game, 'easy', { date, v: 2, sol: a }), false, game);
  }
  assert.notDeepEqual(await PuzzleDaily.answer('sudoku', 'easy', date), await PuzzleDaily.answer('sudoku', 'easy', '2026-10-13'));
  assert.equal(await PuzzleDaily.verify('chess', 'easy', { date, sol: [] }), false);
});

test('오늘의 문제 API: 처음 맞힌 한 번만 지급, 틀린 판·지난 날 거부, 너무 빠르면 0P', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'puzzle-server-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const sa = await server.enter(await server.issue('퍼즐러')); assert.ok(sa, server.logs());
  const balance = async () => (await req('/api/points', sa)).data.balance;
  const info = (await req('/api/solo/puzzle', sa)).data;
  assert.deepEqual([info.points.easy, info.points.hard], [2000, 5000]);
  assert.deepEqual(Object.keys(info.records), ['sudoku', 'nonogram', 'hashi', 'circuit']);
  const other = await server.enter(await server.issue('다른퍼즐러'));
  assert.match(info.uid, /^[0-9a-f]{16}$/); // each account's own progress in the browser (Codex review)
  assert.notEqual((await req('/api/solo/puzzle', other)).data.uid, info.uid);
  assert.equal((await req('/api/solo/puzzle', sa)).data.uid, info.uid);
  const date = kstDate(Date.now());
  const sol = await PuzzleDaily.answer('sudoku', 'easy', date);
  const finish = (body) => req('/api/solo/puzzle/finish', sa, { game: 'sudoku', level: 'easy', ...body });
  assert.equal((await req('/api/solo/puzzle/start', sa, { game: 'sudoku', level: 'huge' })).status, 400);
  assert.equal((await req('/api/solo/puzzle/start', sa, { game: 'sudoku', level: 'easy' })).status, 200);
  const start = await balance();
  assert.equal((await finish({ score: 300000, proof: { date, v: 1, sol: Array(81).fill(1) } })).status, 400, '틀린 판');
  assert.equal((await finish({ score: 300000, proof: { date: '2026-01-01', v: 1, sol } })).status, 400, '지난 날');
  const quick = (await finish({ score: 300000, proof: { date, v: 1, sol } })).data; // opened a moment ago
  assert.deepEqual([quick.fast, quick.points, quick.already], [true, 0, false]);
  assert.equal((await finish({ score: 300000, proof: { date, v: 1, sol } })).data.already, true, '그날 한 번만');
  assert.equal(await balance(), start);

  // another level, opened long enough ago (no start known, as after a restart: the time it claims decides)
  const hard = await PuzzleDaily.answer('hashi', 'normal', date);
  const paid = (await req('/api/solo/puzzle/finish', sa, { game: 'hashi', level: 'normal', score: 95000, proof: { date, v: 1, sol: hard } })).data;
  assert.deepEqual([paid.points, paid.best, paid.newBest], [3000, 95000, true]);
  assert.equal(await balance(), start + 3000);
  assert.deepEqual((await req('/api/solo/puzzle', sa)).data.records.hashi, { normal: { best: 95000, clears: 1 } });
});
