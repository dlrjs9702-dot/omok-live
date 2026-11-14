'use strict';
// v1.10.318 마당 농사 F1 + 집 손보기 (public/plaza/island-farm.js; gamecenter-notes docs/yard-farming-20261109.md, docs/gather-must-ideas-
// 20261114.md 사용자 1A 2A 3B): the rules -- a cell's stages and compost, the week's owing by house size, 허름함 after a week missed,
// the yard's weeds a few a day; and the server -- beds by yard level, sow / feed / harvest into the bag, the 손보기 상자 (what is
// owed of each kind, the week's 보답 once, 허름함 gone), 재료로 쓰기, a yard weed pulled by anyone, the week's letter.
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { boot } = require('../test-support/test-server');
const Farm = require('../public/plaza/island-farm');
const Y = require('../public/plaza/island-yard');
const H = require('../public/plaza/island-home');
const T = require('../public/plaza/island-terrain');
const HOUR = 3600000;

test('마당 농사 규칙: 단계 4개(시간의 1/3마다), 퇴비 뒤 두 배, 집 크기별 손보기 양, 한 주 빠지면 허름함, 마당 잡초 하루 3포기·최대 12', () => {
  const c = { crop: 'carrot', at: 0 }; // (12 h)
  assert.deepEqual([0, 4, 8, 12, 99].map((h) => Farm.stageOf(c, h * HOUR)), [0, 1, 2, 3, 3]);
  assert.equal(Farm.stageOf({ ...c, fed: 2 * HOUR }, 7 * HOUR - 1), 2); // (composted at 2 h: 2 h + 5 h twice = 12 h -- ripe at 7 h)
  assert.equal(Farm.ripeAt({ ...c, fed: 2 * HOUR }), 7 * HOUR);
  assert.equal(Farm.stageOf({ ...c, fed: 2 * HOUR }, 7 * HOUR), 3);
  assert.deepEqual(Farm.upkeepNeed(1), { weed: 30, twig: 10, stone: 5 }); assert.deepEqual(Farm.upkeepNeed(3), { weed: 45, twig: 15, stone: 8 }); assert.deepEqual(Farm.upkeepNeed(4), { weed: 60, twig: 20, stone: 10 });
  const mon = Date.parse('2026-11-16T00:00:00+09:00'); assert.equal(Farm.weekOf(mon), '2026-11-16'); assert.equal(Farm.weekOf(mon - 1), '2026-11-09');
  assert.equal(Farm.upkeepState({ since: '2026-11-16' }, 2, mon + HOUR).shabby, false, '첫 주는 빚 없음');
  assert.equal(Farm.upkeepState({ since: '2026-11-09' }, 2, mon + HOUR).shabby, true, '지난주 안 냄');
  assert.equal(Farm.upkeepState({ since: '2026-11-09', done: ['2026-11-09'] }, 2, mon + HOUR).shabby, false, '지난주 냄');
  assert.equal(Farm.upkeepState({ since: '2026-11-02', done: ['2026-11-16'] }, 2, mon + HOUR).shabby, false, '이번 주 다 내면 바로 깨끗');
  const box = [-5, 5, -5, 5]; const free = () => true;
  const a = Farm.growYardWeeds([], 'lot1', '2026-11-14', '2026-11-16', box, free); assert.equal(a.length, 6);
  assert.deepEqual(a, Farm.growYardWeeds([], 'lot1', '2026-11-14', '2026-11-16', box, free), '같은 날 같은 자리');
  assert.equal(Farm.growYardWeeds(a, 'lot1', '2026-11-16', '2026-11-30', box, free).length, Farm.YARD_WEEDS.MAX);
});

test('마당 농사·집 손보기 서버: 텃밭 개수(마당 단계) · 심기·퇴비·거두기 · 손보기 상자(종류별·보답 한 번·허름함) · 재료로 쓰기 · 마당 잡초 뽑기 · 주간 쪽지', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'farm-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('농사주인')); const b = await server.enter(await server.issue('이웃손님'));
  const key = (await req('/api/admin/keys', server.admin)).data.keys.find((k) => k.label === '농사주인');
  await req(`/api/admin/keys/${key.id}/points`, server.admin, { amount: 500000, category: 'other', memo: '시험', requestId: crypto.randomUUID() });
  const stand = (who, x, z) => req('/api/plaza/state', who, { x, z, yaw: 0, moving: false });
  const give = (itemId, qty) => req('/api/test/island/give', a, { itemId, qty });
  const count = async (who, itemId) => ((await req('/api/island/bag', who)).data.bag?.items || (await req('/api/island/bag', who)).data.items || []).filter((e) => e.itemId === itemId).reduce((n, e) => n + (e.qty || 1), 0);
  const lot = Y.lotById('lot6');
  const door = T.facilityDoor('townhall'); await stand(a, door.x, door.z); assert.equal((await req('/api/island/townhall/enter', a, {})).status, 200);
  assert.equal((await req('/api/home/apply', a, { lot: lot.id, roof: 'red' })).status, 200);
  const ex = T.roomWorld(T.TOWNHALL_ROOM.exit.lx, T.TOWNHALL_ROOM.exit.lz); await stand(a, ex.x, ex.z); await req('/api/island/townhall/leave', a, {});
  // beds: two in a first yard, the third refused
  const beds = (await req('/api/test/home/furniture', a, { ids: [0, 1, 2].map(() => Y.goodId('farm_bed')) })).data.pieces;
  const spots = []; const box = Y.boxOf(lot, 1, 1);
  for (let lz = box[2] + 1.5; lz < box[3] - 1; lz += 0.5) for (let lx = box[0] + 1.5; lx < box[1] - 1.5; lx += 0.5) { const p = { uid: 'q', id: Y.goodId('farm_bed'), x: Y.snap(lx), z: Y.snap(lz), rot: 0 }; if (!Y.placeError(p, [], lot, 1, 1) && spots.every((s) => Math.abs(s.x - p.x) > 3 || Math.abs(s.z - p.z) > 2.2)) spots.push(p); }
  assert.ok(spots.length >= 3, '텃밭 자리 셋');
  const inYard = Y.world(lot, spots[0].x, spots[0].z - 1.4); await stand(a, inYard.x, inYard.z);
  for (let k = 0; k < 2; k += 1) { const r = await req('/api/home/yard', a, { uid: beds[k].uid, x: spots[k].x, z: spots[k].z, rot: 0 }); assert.equal(r.status, 200, JSON.stringify(r.data)); }
  assert.equal((await req('/api/home/yard', a, { uid: beds[2].uid, x: spots[2].x, z: spots[2].z, rot: 0 })).data.error, 'TOO_MANY_BEDS', '처음 마당은 텃밭 둘');
  // sow, compost, harvest
  await give('seed_carrot', 2); await give('compost', 1);
  const farm = (body) => req('/api/home/farm', a, { uid: beds[0].uid, ...body });
  let r = await farm({ slot: 0, action: 'plant', seed: 'seed_carrot' }); assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal((await farm({ slot: 0, action: 'plant', seed: 'seed_carrot' })).data.error, 'TAKEN');
  assert.equal((await farm({ slot: 1, action: 'plant', seed: 'seed_corn' })).data.error, 'MISSING');
  assert.equal((await farm({ slot: 0, action: 'harvest' })).data.error, 'NOT_RIPE');
  assert.equal((await farm({ slot: 0, action: 'feed', item: 'compost' })).status, 200); assert.equal((await farm({ slot: 0, action: 'feed', item: 'compost' })).data.error, 'FED');
  assert.equal((await farm({ slot: 1, action: 'plant', seed: 'seed_carrot' })).status, 200);
  await req('/api/test/home/farm-time', a, { ms: 13 * HOUR });
  r = await farm({ slot: 0, action: 'harvest' }); assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.qty, 3);
  assert.equal(await count(a, 'crop_carrot'), 3); assert.equal((await farm({ slot: 0, action: 'harvest' })).data.error, 'EMPTY');
  assert.equal((await req('/api/home/yard', a, { uid: beds[0].uid, remove: true })).data.error, 'BED_GROWING', '자라는 텃밭은 못 치움');
  { const view = (await req('/api/home', b)).data.lots.find((l) => l.id === lot.id); assert.equal(view.farm[beds[0].uid][1].crop, 'carrot', '이웃 화면에도 작물'); assert.equal(view.farm[beds[0].uid][0], null); }
  // the 손보기 상자: away from it no; each kind as much as owed; the week's 보답 once
  const B = H.upkeepBoxOf(lot, 1);
  assert.equal((await req('/api/home/upkeep', a, { action: 'give', itemId: 'weed' })).data.error, 'TOO_FAR');
  await stand(a, B.x, B.z + 0.8);
  await give('weed', 40); await give('branch', 6); await give('twig', 6); await give('stone', 5);
  r = await req('/api/home/upkeep', a, { action: 'give', itemId: 'weed' }); assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.put, 30);
  assert.equal((await req('/api/home/upkeep', a, { action: 'give', itemId: 'weed' })).data.error, 'ENOUGH'); assert.equal(await count(a, 'weed'), 10);
  assert.equal((await req('/api/home/upkeep', a, { action: 'give', itemId: 'branch' })).data.put, 6); assert.equal((await req('/api/home/upkeep', a, { action: 'give', itemId: 'twig' })).data.put, 4);
  const before = (await req('/api/points', a)).data.balance;
  r = await req('/api/home/upkeep', a, { action: 'give', itemId: 'stone' }); assert.equal(r.data.upkeep.done, true); assert.equal(r.data.reward, 10000);
  assert.equal((await req('/api/points', a)).data.balance - before, 10000, '한 주 보답');
  // a week missed: 허름함 for everyone, the week's letter; done again: gone
  await req('/api/test/home/farm-time', a, { weeks: 2 });
  assert.equal((await req('/api/home', b)).data.lots.find((l) => l.id === lot.id).shabby, true, '허름함');
  assert.ok((await req('/api/island/mail', a)).data.letters.some((l) => l.id === `upkeep-${Farm.weekOf(Date.now())}` && l.text.includes('잡초 30')), '주간 쪽지');
  await give('weed', 30); await give('branch', 10); await give('stone', 5);
  for (const itemId of ['weed', 'branch', 'stone']) { const g = await req('/api/home/upkeep', a, { action: 'give', itemId }); assert.equal(g.status, 200, `${itemId} ${JSON.stringify(g.data)}`); }
  assert.equal((await req('/api/home', b)).data.lots.find((l) => l.id === lot.id).shabby, false, '다 내면 바로 깨끗');
  // 재료로 쓰기: weeds into compost, stones into stepping stones (the 가구 창고)
  await give('weed', 3); r = await req('/api/home/upkeep', a, { action: 'craft', recipe: 'compost' }); assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(await count(a, 'compost'), 1);
  assert.equal((await req('/api/home/upkeep', a, { action: 'craft', recipe: 'stepping_stones' })).data.error, 'MISSING');
  await give('stone', 6); r = await req('/api/home/upkeep', a, { action: 'craft', recipe: 'stepping_stones' }); assert.equal(r.data.good, Y.goodId('stepping_stones'));
  // the yard's weeds: two days, six; a neighbour pulls one
  await req('/api/test/home/farm-time', a, { days: 2 });
  const weeds = (await req('/api/home', b)).data.lots.find((l) => l.id === lot.id).weeds; assert.equal(weeds.length, 6);
  const w = Y.world(lot, weeds[0].lx, weeds[0].lz); await stand(b, w.x + 0.5, w.z);
  r = await req('/api/home/yard/weed', b, { lot: lot.id, id: weeds[0].id }); assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.left, 5);
  assert.equal((await req('/api/home/yard/weed', b, { lot: lot.id, id: weeds[0].id })).data.error, 'GONE'); assert.equal(await count(b, 'weed'), 1);
});
