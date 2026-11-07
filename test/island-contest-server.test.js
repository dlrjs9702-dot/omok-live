'use strict';
// v1.10.238 섬 대회 천막 (문제 기록 1103 7, gamecenter-notes docs/issue-log-review-20261103.md 7-3): the contest's rounds are
// the game hall's solo games opened at the 대청마당 tent -- the server checks the contest is on, its game, and that I stand by
// the tent; the round's level is the contest's, a card contest's deal the same for everyone; a round from the game hall
// keeps its record only there. (The turn of events, no 낚시 or 잡초: lib/island-contest.js's own checks, run by island-a4.)
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');
const Calendar = require('../public/plaza/island-calendar');

test('섬 대회 천막 서버: 천막에서 연 판만 대회 기록, 대회 난이도, 카드는 모두 같은 패', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'contest-server-')); rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */
  const { req, issue, enter, admin } = await boot(t, dir);
  const a = await enter(await issue('대회손님')); const b = await enter(await issue('대회이웃'));
  const K = Calendar.PLACES.keeper; const stand = (s, x, z) => req('/api/plaza/state', s, { x, z, yaw: 0, moving: false });
  const start = (s, game, extra = {}) => req('/api/solo/reflex/start', s, { game, level: 'easy', ...extra });
  const round = async (s, game, score, extra) => { const r = await start(s, game, extra); assert.equal(r.status, 200, JSON.stringify(r.data)); await req('/api/test/reflex/age', s, { id: r.data.id, ageMs: 31000 }); return (await req('/api/solo/reflex/finish', s, { id: r.data.id, score })).data; };
  try {
    assert.equal((await req('/api/test/contest/clock', a, { to: 'live', kind: 'whack' })).data.phase, 'live');
    const view = (await req('/api/island/contest', a)).data;
    assert.equal(view.contest.tent, true); assert.equal(view.contest.game, 'whack'); assert.equal(view.contest.level, 'normal');
    // the game hall's round: its own record, not the contest's
    assert.equal((await round(a, 'whack', 300)).contest, null);
    assert.deepEqual((await req('/api/island/contest', a)).data.top, []);
    // away from the tent: no contest round; by it: one, at the contest's level (whatever was asked)
    assert.equal((await start(a, 'whack', { contest: true })).data.error, 'TOO_FAR'); // (no pass yet)
    await stand(a, K.x + 30, K.z); assert.equal((await req('/api/island/contest/join', a, {})).data.error, 'TOO_FAR');
    await stand(a, K.x, K.z); await stand(b, K.x + 1, K.z);
    for (const s of [a, b]) assert.equal((await req('/api/island/contest/join', s, {})).data.game, 'whack'); // (「참가하기」 by the tent: the pass)
    assert.equal((await start(a, 'colorfind', { contest: true })).data.error, 'BAD_LEVEL'); // (not this week's game)
    assert.deepEqual((await round(a, 'whack', 260, { contest: true })).contest, { score: 260, rank: 1 });
    assert.deepEqual((await round(b, 'whack', 280, { contest: true })).contest, { score: 280, rank: 1 });
    assert.deepEqual((await round(a, 'whack', 240, { contest: true })).contest, { score: 260, rank: 2 }); // (my best kept)
    const live = (await req('/api/island/contest', a)).data;
    assert.deepEqual(live.top.map((r) => [r.name, r.score]), [['대회이웃', 280], ['대회손님', 260]]); assert.deepEqual(live.mine, { score: 260, rank: 2 });
    // a card contest: one deal for everyone (a game hall deal its own)
    await req('/api/test/contest/clock', a, { to: 'live', kind: 'klondike' });
    const deal = async (s, extra) => (await req('/api/solo/cards/start', s, { game: 'klondike', level: 'hard', ...extra })).data;
    const [da, db] = [await deal(a, { contest: true }), await deal(b, { contest: true })];
    assert.ok(Number.isInteger(da.seed)); assert.equal(da.seed, db.seed);
    const free = [await deal(a), await deal(a)]; assert.notEqual(free[0].seed, free[1].seed);
    // a time contest: the shorter is better
    await req('/api/test/contest/clock', a, { to: 'live', kind: 'reaction' });
    assert.deepEqual((await round(a, 'reaction', 320, { contest: true })).contest, { score: 320, rank: 1 });
    assert.deepEqual((await round(b, 'reaction', 250, { contest: true })).contest, { score: 250, rank: 1 });
    assert.deepEqual((await round(a, 'reaction', 400, { contest: true })).contest, { score: 320, rank: 2 });
    // (총괄 238 검토 1) settled into its own result: E1's settling (its Saturday 낚시 keeps `contestResult` and 영웅마루) and
    // A4's again leave it as it is -- its winner on its own statue before the 게임관
    assert.equal((await req('/api/test/contest/clock', a, { to: 'end' })).data.phase, 'done');
    const last = (await req('/api/island/contest', a)).data.last; assert.equal(last.id, live.contest.id); assert.deepEqual(last.top.map((r) => r.name), ['대회이웃', '대회손님']);
    await req('/api/test/weekly/settle', a, { day: Calendar.dayOf(Date.now()) }); await req('/api/test/weekly/settle', a, { all: true });
    await req('/api/test/contest/clock', a, { to: 'end' });
    assert.deepEqual((await req('/api/island/contest', a)).data.last, last);
  } finally { await req('/api/test/contest/clock', a, { to: 'reset' }); }
  // the contest over (the real clock, unless it is 14:00 now): no contest round
  const off = (await req('/api/island/contest', a)).data.contest;
  if (off.phase !== 'live') assert.equal((await start(a, off.game, { contest: true })).data.error, 'CONTEST_CLOSED');
  // the administrator: the next contest's game chosen (the turn otherwise), the games only; v1.10.241 매일 대회: no weekday,
  // and only a contest not yet begun (Codex 10판 P3: an open or past one keeps its event)
  const g = (await req('/api/admin/contest', admin)).data; assert.ok(g.kinds.whack && !g.kinds.fish && !g.kinds.weed);
  const pick = g.next.kind === 'spider' ? 'stairs' : 'spider';
  assert.ok(Number.isInteger(g.next.day) && g.next.start > Date.now() && g.config.day === undefined);
  assert.equal((await req('/api/admin/contest', admin, { ...g.config, day: g.next.day, kind: pick })).status, 200);
  assert.equal((await req('/api/admin/contest', admin)).data.next.kind, pick);
  assert.equal((await req('/api/admin/contest', admin, { ...g.config, day: g.next.day, kind: 'fish' })).status, 400); assert.equal((await req('/api/admin/contest', admin)).data.next.kind, pick); // (낚시: not an event)
  const started = await req('/api/admin/contest', admin, { ...g.config, day: g.next.day - 1, kind: pick }); assert.equal(started.status, 400); assert.equal(started.data.error, 'CONTEST_STARTED'); // (today's begun, or yesterday's)
  assert.equal((await req('/api/admin/contest', admin, { ...g.config, hour: 25 })).status, 400); assert.equal((await req('/api/admin/contest', admin, { ...g.config, minutes: 45 })).data.config.minutes, 45); // (the time and length alone)
});
