'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Cards = require('../lib/cards');
const { boot } = require('../test-support/test-server');

// v1.10.70 카드 게임 (한판마당 자료): the server deals and, before paying, plays the round's action log again with the
// page's own game code — a won one-suit spider (played by a plain greedy bot, test-support/spider-bot.mjs) replays to
// the same win and score; an illegal or unfinished log is refused.
const won = (async () => {
  const { playSpider } = await import('../test-support/spider-bot.mjs');
  for (let seed = 1; seed < 200; seed += 1) { const r = playSpider(seed); if (r.won) return { seed, ...r }; }
  throw new Error('the bot won nothing');
})();

test('카드 재생: 이긴 판은 같은 점수로 다시 이기고, 규칙에 없는 이동·안 끝난 판은 아님', async () => {
  const w = await won;
  assert.deepEqual(await Cards.replay({ game: 'spider', level: 'easy', seed: w.seed, log: w.log }), { won: true, score: w.score });
  assert.equal((await Cards.replay({ game: 'spider', level: 'easy', seed: w.seed + 1000, log: w.log })).won, undefined, '다른 판에는 맞지 않는다');
  assert.deepEqual(await Cards.replay({ game: 'spider', level: 'easy', seed: w.seed, log: w.log.split(';').slice(0, 20).join(';') }), { won: false });
  assert.match((await Cards.replay({ game: 'klondike', level: 'easy', seed: 7, log: 'm,stock,0,t1' })).error, /illegal/); // the stock is only turned
  assert.match((await Cards.replay({ game: 'freecell', level: 'hard', seed: 7, log: 'a,t0,0,t1' })).error, /illegal|bad auto/);
  assert.equal((await Cards.replay({ game: 'klondike', level: 'hard', seed: 7, log: 'f;f;u;f' })).won, false);
});

test('카드 API: 서버가 나눈 판만, 한 번만, 다시 재생해 이긴 판에 지급·빠르면 0P', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cards-server-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const sa = await server.enter(await server.issue('카드손')); assert.ok(sa, server.logs());
  const balance = async () => (await req('/api/points', sa)).data.balance;
  const info = (await req('/api/solo/cards', sa)).data;
  assert.deepEqual([info.points.spider.hard, info.points.klondike.hard, info.cap, info.today], [10000, 4000, 30000, 0]);
  assert.equal((await req('/api/solo/cards/start', sa, { game: 'klondike', level: 'normal' })).status, 400, '클론다이크는 쉬움·어려움뿐');
  const w = await won;
  const round = async (ageMs) => {
    const r = (await req('/api/solo/cards/start', sa, { game: 'spider', level: 'easy' })).data;
    assert.ok(Number.isSafeInteger(r.seed));
    await req('/api/test/cards/run', sa, { id: r.id, seed: w.seed, ageMs });
    return r.id;
  };
  const start = await balance();
  const unfinished = await round(600000);
  assert.equal((await req('/api/solo/cards/finish', sa, { id: unfinished, ms: 1, log: 'd' })).status, 400);
  assert.equal((await req('/api/solo/cards/finish', sa, { id: unfinished, ms: 1, log: w.log })).status, 409, '보고는 한 번');
  const quick = await round(0);
  const q = (await req('/api/solo/cards/finish', sa, { id: quick, ms: 1, log: w.log })).data;
  assert.deepEqual([q.fast, q.points, q.score], [true, 0, w.score]);
  const real = await round(600000);
  const r = (await req('/api/solo/cards/finish', sa, { id: real, ms: 1, log: w.log })).data;
  assert.deepEqual([r.fast, r.points, r.score, r.today], [false, 3000, w.score, 3000]);
  assert.equal(await balance(), start + 3000);
  assert.deepEqual((await req('/api/solo/cards', sa)).data.records.spider, { easy: { best: w.score, clears: 2 } });
});

test('카드 재생: 클론다이크 — 게임이 스스로 올리는 마무리(a)까지 적은 이긴 판은 다시 이긴다', async () => {
  const { playKlondike } = await import('../test-support/klondike-bot.mjs');
  let r = null; let seed = 0;
  while (!r?.won && seed < 300) r = playKlondike(++seed);
  assert.ok(r.won, 'the bot won nothing');
  assert.match(r.log, /(^|;)a,/);
  assert.deepEqual(await Cards.replay({ game: 'klondike', level: 'easy', seed, log: r.log }), { won: true, score: 0 }); // its time is the page's clock
  assert.equal((await Cards.replay({ game: 'klondike', level: 'easy', seed, log: r.log.replace(/(^|;)a,[^;]*$/, '') })).won, false, '마지막 한 장이 빠지면 아님');
});

test('카드 API: 시간 기록은 서버 시계(보낸 시간 무시), 3시간 지난 판은 끝난 판 (Codex 검토)', async (t) => {
  const { playKlondike } = await import('../test-support/klondike-bot.mjs');
  let r = null; let seed = 0;
  while (!r?.won && seed < 300) r = playKlondike(++seed);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cards-time-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const sa = await server.enter(await server.issue('시간손')); assert.ok(sa, server.logs());
  const round = async (ageMs) => {
    const id = (await req('/api/solo/cards/start', sa, { game: 'klondike', level: 'easy' })).data.id;
    await req('/api/test/cards/run', sa, { id, seed, ageMs });
    return id;
  };
  const old = await round(3 * 60 * 60 * 1000 + 1000);
  assert.equal((await req('/api/solo/cards/finish', sa, { id: old, log: r.log })).status, 409);
  const fair = await round(120000);
  const out = (await req('/api/solo/cards/finish', sa, { id: fair, ms: 0, log: r.log })).data;
  assert.ok(out.score >= 120000 && out.score < 130000, String(out.score));
  assert.equal(out.points, 2000);
});
