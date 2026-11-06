'use strict';
// v1.10.242 주민 날마다 말 (gamecenter-notes docs/story-extra-20261104.md 1): talking to an islander -- something of mine first
// (a big catch just now: once that day to them), then the day's 섬 대회 in their words with its game's name. (The order, the
// 35%, the 조사 and the season: lib/island-daily.js's own checks, run by island-a4.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');
const N = require('../public/plaza/island-npcs');
const Cast = require('../public/plaza/island-cast');
const Daily = require('../lib/island-daily');
const Errands = require('../lib/island-errands');

test('주민 날마다 말: 대어 소식은 그날 한 번, 그다음은 오늘 대회 말(종목 이름)', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'daily-server-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const { req, issue, enter } = await boot(t, dir);
  const a = await enter(await issue('날마다'));
  const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
  await req('/api/test/island/free-residents', a, {});
  // (v1.10.258: errands go by the day -- 11-07's from this islander came first in the talk; a day with none from or to them pinned)
  const n = 3; const walkers = (k) => k < Cast.WALKERS.length;
  const free = Array.from({ length: 60 }, (_, i) => new Date(Date.now() + 9 * 3600000 + i * 86400000).toISOString().slice(0, 10)).find((d) => Errands.errandsOf(d, walkers).every((e) => e.from !== n && e.to !== n));
  assert.equal((await req('/api/test/roster', a, { on: false, day: free })).status, 200);
  const serverAt = async (k) => { const st = (await req('/api/island/resident/bye', a, { n: -1 })).data.residents?.[k] || null; return N.residentAt(k, Date.now(), st); };
  const plain = (s) => Cast.untail([s], n)[0];
  const talk = async () => { let r = null; for (let i = 0; i < 20 && r?.status !== 200; i += 1) { const p = await serverAt(n); await req('/api/plaza/state', a, { x: p.x, z: p.z, yaw: 0, moving: false }); r = await req('/api/island/resident/talk', a, { n }); if (r.status !== 200) await wait(250); } assert.equal(r.status, 200, JSON.stringify(r.data)); await req('/api/island/resident/bye', a, { n }); return plain(r.data.say[0]); };
  try {
    assert.equal((await req('/api/test/island/daily', a, { always: true, bigCatch: true })).status, 200);
    assert.equal(await talk(), Cast.slot(Daily.DAILY[n].bigCatch[0], 'me', '날마다'));
    // told today: the contest next, its game's name in their words
    assert.equal((await req('/api/test/contest/clock', a, { to: 'live', kind: 'whack' })).data.phase, 'live');
    assert.equal(await talk(), Cast.slot(Daily.DAILY[n].contestSoon[0], 'game', '두더지 잡기'));
  } finally {
    await req('/api/test/island/daily', a, { always: false, bigCatch: false }); await req('/api/test/contest/clock', a, { to: 'reset' });
  }
});
