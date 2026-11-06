'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Reflex = require('../lib/reflex');
const { JsonPointStore, PostgresPointStore } = require('../lib/point-store');
const { testDatabase } = require('../test-support/pg-database');
const { boot } = require('../test-support/test-server');

// v1.10.68 순발력 게임 (한판마당 자료): the score is the browser's, so the server opens the round, takes one report, pays it
// only if the round lasted as long as the game can, the score is a person's and something was played, up to the day's cap.
test('순발력 판정: 최소 시간·사람 점수 범위·최소 노력', () => {
  assert.equal(Reflex.levelOf('whack', 'hard'), 'hard');
  assert.equal(Reflex.levelOf('reaction', 'hard'), 'normal'); // one level only
  assert.equal(Reflex.levelOf('whack', 'huge'), null);
  assert.equal(Reflex.levelOf('tetris', 'easy'), null);
  assert.equal(Reflex.judge('whack', 'normal', 500, 31000), 'ok');
  assert.equal(Reflex.judge('whack', 'normal', 500, 3000), 'fast');
  assert.equal(Reflex.judge('whack', 'normal', 99999, 31000), 'score');
  assert.equal(Reflex.judge('whack', 'normal', 20, 31000), 'low'); // two moles in 30 s
  assert.equal(Reflex.judge('reaction', 'normal', 50, 20000), 'score'); // nobody reacts in 50 ms
  assert.equal(Reflex.judge('reaction', 'normal', 240, 20000), 'ok');
  assert.equal(Reflex.judge('numbers', 'normal', 1000, 60000), 'score'); // 25 numbers in a second
  assert.equal(Reflex.judge('numbers', 'normal', 12000, 5000), 'fast'); // shorter than preview + 0.1 s a number
  assert.equal(Reflex.judge('numbers', 'normal', 20000, 15000), 'ok'); // 10 s played + 10 wrong taps (penalty is not real time)
  assert.equal(Reflex.judge('numbers', 'normal', 12000, 16500), 'ok');
  assert.equal(Reflex.judge('rhythm', 'easy', 2.5, 61000), 'score');
  // R7 하늘 계단: steps climbed; no faster than ten steps a second; paid from 30 steps
  assert.equal(Reflex.judge('stairs', 'normal', 200, 15000), 'fast'); // 200 steps in 15 s
  assert.equal(Reflex.judge('stairs', 'normal', 200, 25000), 'ok');
  assert.equal(Reflex.judge('stairs', 'normal', 20, 25000), 'low');
  assert.equal(Reflex.judge('stairs', 'hard', 9000, 999999), 'score');
});

// v1.10.255 두더지 잡기 「헬」 (docs/whack-hell-20261106.md): whack only; 10 a mole; no sooner than that many can come up (the
// screen's own formula, public/whack-hell.js); up to 200,000 (the others still 3000); the stages and the lives
test('두더지 헬: 두더지만, 10의 배수, n마리 최소 시간, 상한 200,000, 단계·바닥·목숨', () => {
  const H = require('../public/whack-hell.js');
  assert.equal(Reflex.levelOf('whack', 'hell'), 'hell'); assert.equal(Reflex.levelOf('colorfind', 'hell'), null); assert.equal(Reflex.levelOf('stairs', 'hell'), null);
  assert.equal(Reflex.judge('whack', 'hell', 105, 1e9), 'score', '10의 배수만');
  assert.equal(Reflex.judge('whack', 'hell', 1000, H.minMs(100) - 1), 'fast'); assert.equal(Reflex.judge('whack', 'hell', 1000, H.minMs(100)), 'ok');
  assert.equal(Reflex.judge('whack', 'hell', 200000, H.minMs(20000)), 'ok'); assert.equal(Reflex.judge('whack', 'hell', 200010, 1e12), 'score');
  assert.equal(Reflex.judge('whack', 'hell', 90, 1e6), 'low'); assert.equal(Reflex.judge('whack', 'normal', 5000, 1e6), 'score', '다른 난이도 상한 3000 그대로');
  assert.ok(H.minMs(100) > 25000 && H.minMs(10) > 4000, `${H.minMs(10)} ${H.minMs(100)}`);
  // the stages: one every ten caught, 0.93 a stage, the floor; bombs and how many up
  assert.deepEqual([H.stageOf(0), H.stageOf(9), H.stageOf(10), H.stageOf(25)], [0, 0, 1, 2]);
  assert.deepEqual(H.at(0), { spawn: 1.25, stay: 1.35, bomb: 0.05, up: 2 });
  assert.ok(Math.abs(H.at(1).spawn - 1.25 * 0.93) < 1e-9); assert.deepEqual([H.at(4).up, H.at(15).bomb, H.at(40).up], [3, 0.2, 5]);
  assert.equal(H.spawnWait(200, 0), 0.22); assert.equal(H.stayFor(200, 0.9), 0.32); assert.ok(H.spawnWait(0, 0) > 0.43 && H.stayFor(0, 1) > 1.6);
  // the lives: five, a miss one, a bomb two -- six misses and a bomb end it
  let lives = H.LIVES; for (const k of ['miss', 'bomb', 'miss']) lives -= H.LOSE[k]; assert.equal(lives, 1); lives -= H.LOSE.bomb; assert.ok(lives <= 0);
  // (더하기) the run: a catch one more, a miss or a bomb none; shouted at 10, 20, 30; 3·2·1 first; the bomb plainer at 단계 5, 10
  let run = 0; let best = 0; const shouts = [];
  for (const w of [...Array(12).fill('hit'), 'miss', ...Array(25).fill('hit'), 'bomb', 'hit']) { run = H.combo(run, w); best = Math.max(best, run); if (H.shout(run)) shouts.push(run); }
  assert.deepEqual([run, best, shouts], [1, 25, [10, 10, 20]]);
  assert.equal(H.shout(0), false); assert.deepEqual([H.COUNTDOWN, H.BOMB_FLICKER + 1, H.BOMB_GLOW + 1], [3, 5, 10]);
});

async function storeBehaves(store) {
  const U = 'guest:11111111-1111-4111-8111-111111111111';
  const daily = { day: '2026-10-12', cap: 2500 };
  const a = await store.soloClear({ userId: U, gameId: 'round-0001', game: 'whack', level: 'normal', ms: 300, higher: true, points: 1500, daily, title: '두더지 잡기 보통' });
  assert.deepEqual([a.points, a.best, a.newBest, a.today], [1500, 300, true, 1500]);
  const b = await store.soloClear({ userId: U, gameId: 'round-0002', game: 'whack', level: 'normal', ms: 200, higher: true, points: 1500, daily });
  assert.deepEqual([b.points, b.best, b.newBest, b.today], [1000, 300, false, 2500]); // capped; a lower score is no record
  const c = await store.soloClear({ userId: U, gameId: 'round-0003', game: 'reaction', level: 'normal', ms: 250, points: 1500, daily });
  assert.deepEqual([c.points, c.today], [0, 2500]);
  const d = await store.soloClear({ userId: U, gameId: 'round-0004', game: 'reaction', level: 'normal', ms: 240, points: 1500, daily: { day: '2026-10-13', cap: 2500 } });
  assert.deepEqual([d.points, d.best, d.newBest], [1500, 240, true]); // a new day; a lower time is the record
  assert.equal(await store.soloDailyPaid(U, '2026-10-12'), 2500);
  assert.deepEqual(await store.soloRecords(U), { whack: { normal: { best: 300, clears: 2 } }, reaction: { normal: { best: 240, clears: 2 } } });
  await assert.rejects(store.soloClear({ userId: U, gameId: 'round-0005', game: 'tetris', level: 'normal', ms: 1, points: 0 }), RangeError);
}

test('순발력 기록: JSON 저장소 — 높을수록 좋은 기록, 하루 상한', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reflex-store-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const store = new JsonPointStore(path.join(dir, 'points.json'));
  await store.init();
  await storeBehaves(store);
});

test('순발력 기록: PostgreSQL 저장소 — 같은 동작', async (t) => {
  const database = await testDatabase();
  t.after(() => database.stop());
  const store = new PostgresPointStore(database.url);
  t.after(() => store.pool.end());
  await store.init();
  await storeBehaves(store);
});

test('순발력 API: 판을 열고 한 번만 보고, 포인트 없이 기록만(G-포인트), 잘못된 점수 거부', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reflex-server-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const sa = await server.enter(await server.issue('순발력')); assert.ok(sa, server.logs());
  const balance = async () => (await req('/api/points', sa)).data.balance;
  const info = (await req('/api/solo/reflex', sa)).data;
  assert.deepEqual([info.points, info.cap, info.today], [undefined, undefined, undefined]);
  assert.deepEqual(Object.keys(info.records), ['whack', 'reaction', 'colorfind', 'numbers', 'rhythm', 'stairs']);
  assert.equal((await req('/api/solo/reflex/start', sa, { game: 'whack', level: 'huge' })).status, 400);
  const round = async (game, level, ageMs) => {
    const id = (await req('/api/solo/reflex/start', sa, { game, level })).data.id;
    if (ageMs) await req('/api/test/reflex/age', sa, { id, ageMs });
    return id;
  };
  const start = await balance();
  const quick = await round('whack', 'hard', 0);
  assert.deepEqual((await req('/api/solo/reflex/finish', sa, { id: quick, score: 500 })).data.verdict, 'fast');
  assert.equal(await balance(), start);
  const fake = await round('whack', 'hard', 31000);
  assert.equal((await req('/api/solo/reflex/finish', sa, { id: fake, score: 1e9 })).status, 400);
  const real = await round('whack', 'hard', 31000);
  const done = (await req('/api/solo/reflex/finish', sa, { id: real, score: 500 })).data;
  assert.deepEqual([done.verdict, done.points, done.best], ['ok', undefined, 500]);
  assert.equal(await balance(), start);
  assert.equal((await req('/api/solo/reflex/finish', sa, { id: real, score: 900 })).status, 409, '한 번만');
  const lazy = await round('colorfind', 'easy', 61000);
  assert.deepEqual([(await req('/api/solo/reflex/finish', sa, { id: lazy, score: 2 })).data.verdict], ['low']);
  const other = await server.enter(await server.issue('남의계정'));
  const mine = await round('reaction', 'normal', 20000);
  assert.equal((await req('/api/solo/reflex/finish', other, { id: mine, score: 250 })).status, 409, '남의 판');
  const after = (await req('/api/solo/reflex', sa)).data;
  assert.equal(await balance(), start);
  assert.deepEqual(after.records.whack, { hard: { best: 500, clears: 2 } });
});
