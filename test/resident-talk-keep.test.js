'use strict';
// Q2 「대화 창 저절로 닫힘」 (CI #349·#350, the island story's e2e hung on a shut window): a talk whose hold was let go while I
// still stand by them -- its lease run out between renewals, or a late bye of an earlier talk with the same islander -- is
// held again by the window's renewal (and a choice made then); over when someone else talks to them (or I walked off -- a talker stands held by them, so not staged here),
// and the answer says which
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');
const N = require('../public/plaza/island-npcs');
const Cast = require('../public/plaza/island-cast');

test('주민 대화: 붙잡기가 풀려도 곁에 있으면 다시 붙잡고, 멀어졌을 때·남이 붙잡았을 때만 끝(까닭과 함께)', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'talk-keep-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const { req, issue, enter } = await boot(t, dir);
  const a = await enter(await issue('붙잡기')); const b = await enter(await issue('다른이'));
  const stand = (p, who = a) => req('/api/plaza/state', who, { x: p.x, z: p.z, yaw: 0, moving: false });
  const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
  await req('/api/test/island/free-residents', a, {});
  const n = 3; let talk = null;
  for (let i = 0; i < 20 && talk?.status !== 200; i += 1) { await stand(N.residentAt(n, Date.now())); talk = await req('/api/island/resident/talk', a, { n }); if (talk.status !== 200) await wait(250); }
  assert.equal(talk.status, 200, JSON.stringify(talk.data));
  // a late bye (an earlier talk's) lets the hold go -- the renewal takes it again, I am still by them
  assert.equal((await req('/api/island/resident/bye', a, { n })).status, 200);
  const again = await req('/api/island/resident/keep', a, { n }); assert.equal(again.status, 200, JSON.stringify(again.data)); assert.equal(again.data.again, true);
  assert.deepEqual(await req('/api/island/resident/keep', a, { n }).then((r) => [r.status, r.data.again]), [200, undefined]); // (held: kept as before)
  // someone else talking to them meanwhile: over, said why
  assert.equal((await req('/api/island/resident/bye', a, { n })).status, 200);
  let other = null; for (let i = 0; i < 20 && other?.status !== 200; i += 1) { await stand(N.residentAt(n, Date.now()), b); other = await req('/api/island/resident/talk', b, { n }); if (other.status !== 200) await wait(250); }
  assert.equal(other.status, 200, JSON.stringify(other.data));
  const busy = await req('/api/island/resident/keep', a, { n }); assert.equal(busy.status, 409); assert.equal(busy.data.reason, 'busy'); assert.match(busy.data.message, new RegExp(Cast.WALKERS[n].name));
  await req('/api/island/resident/bye', b, { n });
});
