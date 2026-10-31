'use strict';
// v1.10.215 주민 근무표 C1 (gamecenter-notes docs/resident-roster-c-plan-20261031.md, 총괄 2026-10-31 ②·③): on a day the table
// puts a walker at a counter they are talked to there (not on their walk); a story islander at a counter gives their 부탁
// there (not at their own place); the 관공서's resting desk's work at the desk beside it. A tests' server keeps the table
// off (the other tests' talks) till /api/test/roster turns it on -- here on a day picked for it
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
process.env.ISLAND_QUEST_WEEK = '0'; // (the 정원사·어부 week: 물결's 부탁 open)
const { boot } = require('../test-support/test-server');
const T = require('../public/plaza/island-terrain');
const R = require('../public/plaza/island-roster');
const Calendar = require('../public/plaza/island-calendar');
const Store = require('../public/plaza/island-store');
const Quests = require('../lib/island-quests');

test('근무표 C1 서버: 계산대 주민은 계산대에서, 이야기 주민 부탁도 계산대에서, 쉬는 창구 일은 옆 창구에서', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'roster-server-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const { req, issue, enter } = await boot(t, dir);
  const a = await enter(await issue('근무표손님'));
  const stand = (p) => req('/api/plaza/state', a, { x: p.x, z: p.z, yaw: 0, moving: false });
  assert.equal((await req('/api/island/roster', a)).data.day, null); // (off on a tests' server)
  // a day 물결 keeps the 1st floor and 새롬's 예금 desk rests
  let day = Calendar.dayOf(Date.now());
  for (let k = 0; k < 200 && !(R.rosterOf(day).posts.mall1 === 11 && R.deskRest(day).rest === 'bank'); k += 1) day = Calendar.addDays(day, 1);
  assert.equal(R.rosterOf(day).posts.mall1, 11, day);
  assert.equal((await req('/api/test/roster', a, { on: true, day })).data.day, day);
  assert.equal((await req('/api/island/roster', a)).data.day, day);
  // the walker at the 광장 출석 stand: talked to there -- not where their walk would have them
  const w = R.rosterOf(day).posts.plaza; const stall = T.facilityDoor('attendance');
  await stand({ x: stall.x + 20, z: stall.z }); assert.equal((await req('/api/island/resident/talk', a, { n: w })).data.error, 'TOO_FAR');
  await stand(stall);
  const talk = await req('/api/island/resident/talk', a, { n: w }); assert.equal(talk.status, 200, JSON.stringify(talk.data));
  assert.equal((await req('/api/island/resident/keep', a, { n: w })).status, 200);
  await stand({ x: stall.x + 20, z: stall.z }); assert.equal((await req('/api/island/resident/keep', a, { n: w })).data.error, 'TALK_OVER');
  await req('/api/island/resident/bye', a, { n: w });
  // 물결 at the 1st floor's counter: his 부탁 there, not at the harbour
  await stand(Quests.STORIES.fisher.at); assert.equal((await req('/api/island/event', a, { id: 'questfisher' })).data.error, 'TOO_FAR');
  await stand(T.facilityDoor('store')); assert.equal((await req('/api/island/store/enter', a, {})).status, 200);
  await stand(Store.sectorPoint('mall:store'));
  const offer = await req('/api/island/event', a, { id: 'questfisher' }); assert.equal(offer.status, 200, JSON.stringify(offer.data));
  assert.equal(offer.data.action, 'quest'); assert.equal(offer.data.offer?.story, 'fisher');
  assert.equal(offer.data.events.find((e) => e.id === 'questfisher')?.post, 'mall1');
  await stand(Store.world(Store.ROOM.exit.lx, Store.ROOM.exit.lz)); assert.equal((await req('/api/island/store/leave', a, {})).status, 200);
  // 관공서: 예금 rests -- at the 세금 window, not at its own
  await stand(T.facilityDoor('townhall')); assert.equal((await req('/api/island/townhall/enter', a, {})).status, 200);
  const W = T.TOWNHALL_ROOM; const bank = T.roomWorld(W.bank.lx, W.bank.lz); const tax = T.roomWorld(W.tax.lx, W.tax.lz);
  await stand(bank); assert.equal((await req('/api/island/bank', a)).data.error, 'TOO_FAR');
  await stand(tax); const view = await req('/api/island/bank', a); assert.equal(view.status, 200, JSON.stringify(view.data)); assert.equal(view.data.deposit, 0);
  // off again: back to the walk and each window its own
  await req('/api/test/roster', a, { on: false });
  await stand(bank); const back = await req('/api/island/bank', a); assert.equal(back.status, 200, JSON.stringify(back.data));
});

// C2 (v1.10.216, 총괄 C2 ① 가): on a day the table has 물결 walking, his 부탁 comes from him where he walks (by him, not at the
// harbour); one of the 17 walking that day talks; the station's keeper (철이 of a weekday) talks at the station
test('근무표 C2 서버: 걷는 이야기 주민에게서 부탁, 17명도 걸으며 대화, 역 근무 주민은 역에서 대화', async (t) => {
  const N = require('../public/plaza/island-npcs');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'roster-c2-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const { req, issue, enter } = await boot(t, dir);
  const a = await enter(await issue('걷는부탁'));
  const stand = (p) => req('/api/plaza/state', a, { x: p.x, z: p.z, yaw: 0, moving: false });
  const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
  // a weekday 물결 walks; that day's resting clerk walks too
  let day = Calendar.dayOf(Date.now());
  for (let k = 0; k < 200 && !(R.walks(11, day) && new Date(`${day}T00:00:00Z`).getUTCDay() !== 0); k += 1) day = Calendar.addDays(day, 1);
  assert.ok(R.walks(11, day), day); const rest = R.rosterOf(day).resting; assert.ok(R.walks(rest, day));
  await req('/api/test/roster', a, { on: true, day });
  const serverAt = async (k) => { const st = (await req('/api/island/resident/bye', a, { n: -1 })).data.residents?.[k] || null; return N.residentAt(k, Date.now(), st); };
  // 물결's 부탁: by him where he walks -- an offer, the entry with him
  const entry = async () => (await req('/api/island/event', a, { id: 'questfisher' })).data;
  let offer = null; for (let i = 0; i < 20 && offer?.action !== 'quest'; i += 1) { await stand(await serverAt(11)); offer = await entry(); if (offer.action !== 'quest') await wait(250); }
  assert.equal(offer.action, 'quest', JSON.stringify(offer)); assert.equal(offer.offer?.story, 'fisher');
  assert.equal(offer.events.find((e) => e.id === 'questfisher')?.walker, 11);
  // far from him: not taken
  const him = await serverAt(11); await stand({ x: him.x + 30, z: him.z }); assert.equal((await entry()).error, 'TOO_FAR');
  // the resting clerk, walking: talked to where they walk
  let talk = null; for (let i = 0; i < 20 && talk?.status !== 200; i += 1) { await stand(await serverAt(rest)); talk = await req('/api/island/resident/talk', a, { n: rest }); if (talk.status !== 200) await wait(250); }
  assert.equal(talk.status, 200, JSON.stringify(talk.data)); assert.equal(talk.data.name, require('../public/plaza/island-cast').RESIDENTS[rest].name);
  await req('/api/island/resident/bye', a, { n: rest });
  // 철이 at the station of a weekday: talked to there, not elsewhere
  const station = Quests.STORIES.stationmaster.at;
  await stand({ x: station.x + 20, z: station.z }); assert.equal((await req('/api/island/resident/talk', a, { n: 16 })).data.error, 'TOO_FAR');
  await stand(station); const cheori = await req('/api/island/resident/talk', a, { n: 16 }); assert.equal(cheori.status, 200, JSON.stringify(cheori.data));
  await req('/api/island/resident/bye', a, { n: 16 });
  // off: the 17 do not talk where they walk
  await req('/api/test/roster', a, { on: false });
  await stand(await serverAt(rest)); assert.equal((await req('/api/island/resident/talk', a, { n: rest })).status, 400);
});
