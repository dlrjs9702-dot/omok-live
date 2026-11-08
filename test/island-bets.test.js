'use strict';
// v1.10.278 주민 내기 (gamecenter-notes docs/resident-bets-design-20261025.md): the rules (who likes which game, the day's game,
// the marks, the stakes one may pick, what a result pays, the words) and the server: 아는 사이 first, not at a post, once a day
// each, the stake taken first and the islander held, left -- lost, the day's winnings cap (then for fun), a score bet won by its
// reflex round's report (twice back), the 호감도 +1 apart from the talks'.
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const B = require('../public/plaza/island-bets');
const C = require('../public/plaza/island-cast');
const R = require('../public/plaza/island-roster');
const { boot } = require('../test-support/test-server');
const kst = (ms = Date.now()) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);

test('주민 내기 규칙: 27명 모두 좋아하는 게임·실력, 그날 게임은 날짜로, 판돈 한도·하루 딴 돈 한도, 이김 2배·비김 돌려받기·짐 0', () => {
  assert.equal(B.PROFILES.length, C.RESIDENTS.length);
  const games = B.PROFILES.flatMap((p) => p.games); for (const g of games) assert.ok(B.NAMES[g] && B.kindOf(g), g);
  assert.ok(games.filter((g) => B.kindOf(g) === 'score').length >= 15 && games.filter((g) => B.kindOf(g) === 'match').length >= 15); // (score and match mixed)
  for (const s of ['easy', 'normal', 'hard']) assert.ok(B.PROFILES.some((p) => p.skill === s), s);
  for (let n = 0; n < 27; n += 1) { const g = B.gameOf(n, '2026-11-08'); assert.ok(B.PROFILES[n].games.includes(g)); assert.equal(B.gameOf(n, '2026-11-08'), g); }
  assert.ok(new Set(Array.from({ length: 20 }, (_, i) => B.gameOf(0, `2026-12-${String(i + 1).padStart(2, '0')}`))).size === 2); // (both of 봄이's, day by day)
  // marks: harder is harder; a time beaten from under
  for (const [g, s] of Object.entries(B.SCORE)) { const t = s.target; assert.ok(s.higher ? t.easy < t.normal && t.normal < t.hard : t.easy > t.normal && t.normal > t.hard, g); }
  assert.equal(B.beat('whack', 'normal', 1501), true); assert.equal(B.beat('whack', 'normal', 1500), false); assert.equal(B.beat('reaction', 'hard', 260), true); assert.equal(B.beat('reaction', 'hard', 280), false);
  // stakes: a score bet up to 5,000, a match up to 10,000, only what I can pay; today's winnings at the cap -- none (for fun)
  assert.deepEqual(B.stakesFor('whack', 100000), [1000, 5000]); assert.deepEqual(B.stakesFor('omok', 100000), [1000, 5000, 10000]); assert.deepEqual(B.stakesFor('omok', 4000), [1000]);
  assert.deepEqual(B.stakesFor('omok', 100000, 30000), []); assert.deepEqual(B.stakesFor('omok', 100000, 29000), [1000, 5000, 10000]);
  // payout (the stake was taken first): won twice -- its winnings to the cap's room; a draw back; lost nothing
  assert.deepEqual(B.payout(5000, 'win', 0), { pay: 10000, net: 5000 }); assert.deepEqual(B.payout(10000, 'win', 25000), { pay: 15000, net: 5000 });
  assert.deepEqual(B.payout(5000, 'draw', 0), { pay: 5000, net: 0 }); assert.deepEqual(B.payout(5000, 'lose', 0), { pay: 0, net: 0 }); assert.deepEqual(B.payout(0, 'win', 0), { pay: 0, net: 0 });
  // words: the default with its values, a resident's own over it (the lines file), a mark said in the game's own unit
  assert.equal(B.lineOf(3, 'lose', { me: '두리친구' }), '졌다… 두리친구님 잘하는구나.'); assert.equal(B.lineOf(3, 'win', {}, { 3: { win: '헤헤, 꿀벌이 이겼다!' } }), '헤헤, 꿀벌이 이겼다!');
  assert.match(B.rule('whack', 'normal'), /1,500점/); assert.match(B.rule('reaction', 'hard'), /270ms/); assert.match(B.rule('numbers', 'normal'), /25초/); assert.equal(B.rule('omok', 'hard'), '나 꽤 둬.');
});

test('주민 내기 서버: 아는 사이부터·근무 중 아님·하루 한 판, 판돈 먼저·나가면 짐, 딴 돈 한도면 재미로, 점수 내기 이기면 2배·호감도 +1', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'resident-bets-')); rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('내기손님')); await req('/api/test/points-credit', a, { amount: 100000 });
  const balance = async () => (await req('/api/points', a)).data.balance;
  const free = () => req('/api/test/island/free-residents', a, {}); // (an island event may hold an islander -- let go, as the e2e do)
  const day = kst(); const fixed = new Set(Object.values(R.FIXED));
  // a score game today with a short least round (reaction 7 s, numbers 6.5 s at 보통) -- an islander off a post
  const n = [...Array(27).keys()].find((k) => !fixed.has(k) && ['reaction', 'numbers'].includes(B.gameOf(k, day)));
  const other = [...Array(27).keys()].find((k) => !fixed.has(k) && k !== n);
  await free(); { const r = (await req(`/api/island/bet?n=${n ?? other}`, a)).data; assert.equal(r.error, 'NOT_KNOWN', JSON.stringify(r)); } // (처음 본 사이)
  for (const k of [n, other]) await req('/api/test/affinity', a, { n: k, delta: 5 });
  const busy = (await req(`/api/island/bet?n=${R.FIXED.gate}`, a)).data; assert.equal(busy.busy, true); assert.equal(busy.say, require('../public/plaza/island-cast').withTail(require('../lib/island-bet-lines.json').lines.find((l) => l.n === R.FIXED.gate).duty, R.FIXED.gate)); /* (마루's own 「근무 중」 line) */ // (마루 at the gate: no bet)
  // left before its end: the stake gone, the islander let go; once a day each
  await free(); const info = (await req(`/api/island/bet?n=${other}`, a)).data; assert.ok(info.stakes?.includes(1000), JSON.stringify(info));
  const b0 = await balance(); const s = (await req('/api/island/bet/start', a, { n: other, stake: 1000 })).data; assert.ok(s.ok, JSON.stringify(s)); assert.equal(await balance(), b0 - 1000);
  assert.ok((await req('/api/plaza/state', a, { x: 0, z: 6, yaw: 0, moving: false })).data.residents?.[other]?.hold?.eventId?.startsWith('bet:') ?? true);
  assert.equal((await req('/api/island/bet/start', a, { n: other, stake: 1000 })).data.error, 'BET_DONE');
  const left = (await req('/api/island/bet/end', a, { id: s.id })).data.done; assert.equal(left.result, 'lose'); assert.equal(left.pay, 0); assert.equal(await balance(), b0 - 1000);
  assert.equal((await req(`/api/island/bet?n=${other}`, a)).data.error, 'BET_DONE');
  // (총괄 #428) a restart forgets a running bet: the next read gives its stake back -- once, read twice; its 「한 판」 stays
  const third = [...Array(27).keys()].find((k) => !fixed.has(k) && k !== n && k !== other); await req('/api/test/affinity', a, { n: third, delta: 5 }); await free();
  const b2 = await balance(); const s3 = (await req('/api/island/bet/start', a, { n: third, stake: 1000 })).data; assert.ok(s3.ok, JSON.stringify(s3)); assert.equal(await balance(), b2 - 1000);
  await req('/api/test/bet', a, { forget: true });
  await req(`/api/island/bet?n=${third}`, a); assert.equal(await balance(), b2); await req(`/api/island/bet?n=${third}`, a); assert.equal(await balance(), b2); // (memory gone: back once)
  assert.equal((await req(`/api/island/bet?n=${third}`, a)).data.error, 'BET_DONE'); assert.deepEqual((await req('/api/test/bet', a, {})).data.doc.opens, []);
  if (n == null) return; // (no short score game off a post today -- the rest needs one)
  // a stake not on offer refused; the day's winnings at the cap: none to pick, for fun only
  await free(); assert.equal((await req('/api/island/bet/start', a, { n, stake: 10000 })).data.error, 'BAD_STAKE'); // (a score bet: 5,000 at most)
  await req('/api/test/bet', a, { reset: true, won: 30000 }); const fun = (await req(`/api/island/bet?n=${n}`, a)).data; assert.deepEqual(fun.stakes, []); assert.equal(fun.fun, true);
  await req('/api/test/bet', a, { reset: true });
  // a score bet: the stake, its round (the server's), beaten -- twice back, +1 호감도
  const aff0 = (await req('/api/test/affinity', a, { n, delta: 0 })).data.after?.[n];
  await free(); const b1 = await balance(); const go = (await req('/api/island/bet/start', a, { n, stake: 5000 })).data; assert.equal(go.kind, 'score');
  const run = (await req('/api/solo/reflex/start', a, { game: go.game, level: 'hard', bet: go.id })).data; assert.ok(run.id, JSON.stringify(run));
  assert.equal((await req('/api/solo/reflex/start', a, { game: go.game, bet: go.id })).data.error, 'BET_GONE'); // (its one round)
  await new Promise((r) => setTimeout(r, go.game === 'reaction' ? 7100 : 6600));
  const score = go.game === 'reaction' ? 150 : 12000; /* (under every mark) */ const fin = (await req('/api/solo/reflex/finish', a, { id: run.id, score })).data;
  assert.equal(fin.bet?.result, 'win', JSON.stringify(fin)); assert.equal(fin.bet.pay, 10000); assert.equal(await balance(), b1 + 5000);
  assert.ok(fin.bet.say.length > 0 && fin.bet.emote, JSON.stringify(fin.bet));
  const aff1 = (await req('/api/test/affinity', a, { n, delta: 0 })).data.after?.[n]; if (aff0 != null && aff1 != null) assert.equal(aff1, aff0 + 1);
  assert.equal((await req('/api/test/bet', a, {})).data.doc.won, 5000);
});
