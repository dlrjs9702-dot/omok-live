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
  for (let n = 0; n < C.RESIDENTS.length; n += 1) { const g = B.gameOf(n, '2026-11-08'); assert.ok(B.PROFILES[n].games.includes(g)); assert.equal(B.gameOf(n, '2026-11-08'), g); }
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

// v1.10.283 Codex 271~280 (notes docs/codex-review-271-280.md): a bet a restart forgot is given back only when its stake was
// taken and it was neither paid out nor given back (①②③); one settling long past stays in memory (④, #5); a reflex round
// asked for a contest and a bet at once is refused (#7)
test('내기 목표: 역대 1위에서 실력별(0.9·0.75·0.55, 시간은 나눔), 10 단위, 기록 3명 미만이면 표의 쉬움이 기준, 표 값이 한도, 내기에 박힌 목표로 판정', () => {
  assert.deepEqual({ ...B.goalsOf('whack', 680, 5) }, { hard: 610, normal: 510, easy: 370 }); /* (사용자's 680: hard 612 -> 610) */
  assert.deepEqual({ ...B.goalsOf('whack', 680, 2) }, { hard: 810, normal: 680, easy: 500 }); /* (2 recorders: the table's easy 900 the base) */
  assert.deepEqual({ ...B.goalsOf('whack', 5000, 9) }, { ...B.SCORE.whack.target }); /* (never past the table) */
  assert.deepEqual({ ...B.goalsOf('reaction', 300, 4) }, { hard: 330, normal: 400, easy: 550 }); /* (a time: divided -- 333, 400, 545) */
  assert.deepEqual({ ...B.goalsOf('reaction', 200, 4) }, { hard: 270, normal: 340, easy: 450 }); /* (faster than the table: the table) */
  assert.deepEqual({ ...B.goalsOf('colorfind', 30, 3) }, { hard: 27, normal: 20, easy: 12 }); /* (under 100: to 1 -- 27, 22.5 -> 20 by the table, 16.5 -> 12) */
  assert.equal(B.goalsOf('omok', 10, 5), null); assert.equal(B.targetOf('whack', 'hard', B.goalsOf('whack', 680, 5)), 610); assert.equal(B.targetOf('whack', 'hard'), 2100);
  assert.equal(B.beat('whack', 'hard', 700, 610), true); assert.equal(B.beat('whack', 'hard', 600, 610), false); assert.equal(B.beat('reaction', 'hard', 320, 330), true);
  assert.equal(B.recordLine('whack', 680, 610), '역대 최고 680점 · 나는 610점'); assert.equal(B.recordLine('reaction', null, 450), '나는 450ms'); assert.equal(B.recordLine('omok', 1, 1), '');
  assert.match(B.rule('whack', 'hard', 610), /610점/);
});

test('주민 내기 돈: 잊힌 내기 환불은 판돈만 빠졌을 때 한 번, 지급 뒤·판돈 전에는 없음, 정산 중 내기는 안 지움, 대회+내기 거절', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'resident-bets-money-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('내기돈손님')); await req('/api/test/points-credit', a, { amount: 100000 });
  const balance = async () => (await req('/api/points', a)).data.balance; const read = async () => (await req('/api/test/bet', a, {})).data.doc;
  const forgot = async (open) => (await req('/api/test/bet', a, { open: { n: 3, stake: 1000, ...open } })).data.id;
  // ② written open, the stake never taken: nothing back
  let b0 = await balance(); await forgot({}); assert.deepEqual((await read()).opens, []); assert.equal(await balance(), b0, '판돈 전 재시작');
  // ③ the stake taken only: back once
  b0 = await balance(); await forgot({ take: true }); assert.equal(await balance(), b0 - 1000); await read(); assert.equal(await balance(), b0, '한 번 돌려받음'); await read(); assert.equal(await balance(), b0);
  // ① taken and paid out (won), forgotten before its open was cleared: nothing more
  b0 = await balance(); await forgot({ take: true, pay: true }); assert.equal(await balance(), b0 + 1000); await read(); assert.equal(await balance(), b0 + 1000, '지급 뒤 재시작');
  // ④ a match bet settling past the 20 minutes: kept (forgotten, it would be refunded)
  const fixed = new Set(Object.values(R.FIXED)); const day = kst(); const n = [...Array(C.RESIDENTS.length).keys()].find((k) => !fixed.has(k) && B.kindOf(B.gameOf(k, day)) === 'match') ?? [...Array(C.RESIDENTS.length).keys()].find((k) => !fixed.has(k));
  await req('/api/test/affinity', a, { n, delta: 5 }); await req('/api/test/island/free-residents', a, {});
  const s = (await req('/api/island/bet/start', a, { n, stake: 1000 })).data; assert.ok(s.ok, JSON.stringify(s));
  assert.equal((await req('/api/test/bet', a, { pendingOld: s.id })).data.kept, true, '정산 중은 남김');
  // #7: a contest and a bet in one reflex round
  assert.equal((await req('/api/solo/reflex/start', a, { game: 'reaction', contest: true, bet: s.id })).status, 400);
});

test('주민 내기 서버: 아는 사이부터·근무 중 아님·하루 한 판, 판돈 먼저·나가면 짐, 딴 돈 한도면 재미로, 점수 내기 이기면 2배·호감도 +1', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'resident-bets-')); rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('내기손님')); await req('/api/test/points-credit', a, { amount: 100000 });
  const balance = async () => (await req('/api/points', a)).data.balance;
  const free = () => req('/api/test/island/free-residents', a, {}); // (an island event may hold an islander -- let go, as the e2e do)
  const day = kst(); const fixed = new Set(Object.values(R.FIXED));
  // a score game today with a short least round (reaction 7 s, numbers 6.5 s at 보통) -- an islander off a post
  const n = [...Array(C.RESIDENTS.length).keys()].find((k) => !fixed.has(k) && ['reaction', 'numbers'].includes(B.gameOf(k, day)));
  const other = [...Array(C.RESIDENTS.length).keys()].find((k) => !fixed.has(k) && k !== n);
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
  const third = [...Array(C.RESIDENTS.length).keys()].find((k) => !fixed.has(k) && k !== n && k !== other); await req('/api/test/affinity', a, { n: third, delta: 5 }); await free();
  const b2 = await balance(); const s3 = (await req('/api/island/bet/start', a, { n: third, stake: 1000 })).data; assert.ok(s3.ok, JSON.stringify(s3)); assert.equal(await balance(), b2 - 1000);
  await req('/api/test/bet', a, { forget: true });
  await req(`/api/island/bet?n=${third}`, a); assert.equal(await balance(), b2); await req(`/api/island/bet?n=${third}`, a); assert.equal(await balance(), b2); // (memory gone: back once)
  assert.equal((await req(`/api/island/bet?n=${third}`, a)).data.error, 'BET_DONE'); assert.deepEqual((await req('/api/test/bet', a, {})).data.doc.opens, []);
  if (n == null) return; // (no short score game off a post today -- the rest needs one)
  // a stake not on offer refused; the day's winnings at the cap: none to pick, for fun only
  await free(); assert.equal((await req('/api/island/bet/start', a, { n, stake: 10000 })).data.error, 'BAD_STAKE'); // (a score bet: 5,000 at most)
  await req('/api/test/bet', a, { reset: true, won: 30000 }); const fun = (await req(`/api/island/bet?n=${n}`, a)).data; assert.deepEqual(fun.stakes, []); assert.equal(fun.fun, true);
  assert.equal(fun.target, B.goalsOf(fun.game, null, 0)[fun.skill]); assert.equal(fun.record, `나는 ${fun.game === 'reaction' ? `${fun.target}ms` : `${Math.round(fun.target / 100) / 10}초`}`); /* (v1.10.291: no records here -- the table's easy the base) */
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
