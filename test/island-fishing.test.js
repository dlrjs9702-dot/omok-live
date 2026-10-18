'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const F = require('../lib/island-fishing');
const T = require('../public/plaza/island-terrain.js');
const { boot } = require('../test-support/test-server');

// v1.10.42 낚시·도감: the odds (60/28/11/1) and about 1,400P a cast; fishing by the water only; a pull in time, never
// before the bite or after it; the fish into the bag and the 도감 once per cast; 도감 titles worn like legend titles.
test('낚시 규칙: 확률·기대값, 물가에서만, 입질 시간 판정, 도감 칭호', () => {
  let s = 7; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  // v1.10.90: eight tables (river/sea x four seasons); each draws only its own fish, every one of the 21 is somewhere,
  // 대왕 참치 only in summer/autumn seas; a cast pays about 700~1,850P by table, about 1,100P on average
  const evs = []; const seen = new Set();
  for (const water of ['river', 'sea']) for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    const list = F.listFor(water, season); let ev = 0; const N = 20000;
    for (let i = 0; i < N; i += 1) { const id = F.draw(rnd, { water, season }); assert.ok(list.includes(id), `${water} ${season} ${id}`); seen.add(id); ev += F.SPECIES[id].price; }
    assert.ok(ev / N > 650 && ev / N < 1950, `${water} ${season} 기대값 ${ev / N}`); evs.push(ev / N);
    assert.equal(list.includes('giant_tuna'), water === 'sea' && ['summer', 'autumn'].includes(season));
  }
  assert.equal(seen.size, 21); assert.equal(Object.keys(F.SPECIES).length, 21);
  const avg = evs.reduce((a, b) => a + b, 0) / evs.length; assert.ok(avg > 1000 && avg < 1400, `평균 ${avg}`);
  assert.equal(F.waterAt(T.PIER.x, T.PIER.z), 'sea');
  assert.equal(F.canFish(T.PIER.x, T.PIER.z), true); assert.equal(F.canFish(0, 8), false); assert.equal(F.canFish(30, 30), false);
  const c = { biteAt: 10_000 };
  assert.deepEqual([F.judge(c, 9000), F.judge(c, 10_500), F.judge(c, 10_000 + F.BITE_MS + F.LATE_MS + 1)], ['early', 'ok', 'late']);
  assert.deepEqual(F.titlesFor(3), []); assert.deepEqual(F.titlesFor(F.DEX.length).map((t) => t.id), ['dex_title_1', 'dex_title_2', 'dex_title_3', 'dex_title_4']);
  assert.deepEqual(F.titlesFor(18).map((t) => t.id), ['dex_title_1', 'dex_title_2', 'dex_title_3'], '도감 완성은 예전 18개 그대로(이미 받은 사람 유지)');
});

test('낚시 서버: 물가에서만 던지고, 입질 때 당기면 가방·도감에 한 번, 이르면 실패, 어부에게 판매, 도감 칭호', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fish-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const sa = await server.enter(await server.issue('낚시꾼')); assert.ok(sa, server.logs());
  const at = async (x, z) => req('/api/plaza/state', sa, { x, z, yaw: 0, moving: false });
  await at(0, 8);
  assert.equal((await req('/api/island/fish/start', sa, {})).data.error, 'NOT_FISHING_SPOT');
  await at(T.PIER.x, T.PIER.z);
  assert.equal((await req('/api/island/fish/start', sa, {})).data.error, 'NO_ROD', '낚싯대 없이는 안 됨');
  await req('/api/test/island/give', sa, { itemId: 'fishing_rod', qty: 1 });
  const early = (await req('/api/island/fish/start', sa, {})).data; assert.ok(early.biteIn >= 5000 && early.biteIn <= 10000);
  assert.equal((await req('/api/island/fish/finish', sa, { fishId: early.fishId })).data.error, 'FISH_EARLY');
  const cast = (await req('/api/island/fish/start', sa, {})).data;
  await req('/api/test/fish/bite', sa, { species: 'octopus' });
  const concurrent = await Promise.all(Array.from({ length: 4 }, () => req('/api/island/fish/finish', sa, { fishId: cast.fishId })));
  const got = concurrent[0].data;
  for (const reply of concurrent) { assert.equal(reply.status, 200); assert.deepEqual(reply.data, got, '동일 cast 동시 완료는 같은 답·도감 한 번'); }
  assert.deepEqual([got.species, got.name, got.firstTime], ['octopus', '문어', true]);
  assert.deepEqual((await req('/api/island/fish/finish', sa, { fishId: cast.fishId })).data.species, 'octopus', '같은 답');
  const bag = (await req('/api/island/bag', sa)).data.items;
  assert.equal(bag.find((e) => e.itemId === 'fish_octopus')?.qty, 1, '한 마리만');
  const dex = (await req('/api/island/dex', sa)).data;
  assert.equal(dex.found, 1); assert.equal(dex.entries.find((e) => e.id === 'fish_octopus').count, 1);
  assert.equal((await req('/api/skins/title', sa, { skinId: 'dex_title_1' })).status, 409, '도감 4개 전에는 못 씀');
  for (const sp of ['anchovy', 'goby', 'mackerel']) { const c2 = (await req('/api/island/fish/start', sa, {})).data; await req('/api/test/fish/bite', sa, { species: sp }); assert.equal((await req('/api/island/fish/finish', sa, { fishId: c2.fishId })).data.species, sp); }
  const worn = (await req('/api/skins/title', sa, { skinId: 'dex_title_1' })).data; assert.equal(worn.avatar.title, '섬 탐험가');
  const fisher = require('../lib/island-quests').STORIES.fisher.at;
  await at(fisher.x, fisher.z);
  const before = (await req('/api/points', sa)).data.balance;
  const sold = (await req('/api/island/sell', sa, { place: 'fisher', requestId: 'fish-sale-0001' })).data;
  assert.equal(sold.paid, 4000 + 300 + 500 + 400); assert.equal((await req('/api/points', sa)).data.balance, before + sold.paid);
  // v1.10.89 낚시왕: the week of that sale closed -> its 1st holds 낚시왕 (worn in the title slot), once, on the hall
  assert.equal((await req('/api/skins/title', sa, { skinId: 'title_fishking' })).status, 409, '낚시왕 전에는 못 씀');
  const nextWeek = Date.now() + 7 * 24 * 60 * 60 * 1000;
  assert.equal((await req('/api/test/fishking/settle', null, { now: nextWeek, asCurrent: true })).status, 200);
  assert.ok((await req('/api/skins', sa)).data.dexTitles.some((x) => x.id === 'title_fishking'));
  assert.equal((await req('/api/skins/title', sa, { skinId: 'title_fishking' })).data.avatar.title, '낚시왕');
  await req('/api/test/fishking/settle', null, { now: nextWeek, asCurrent: true }); // closed once
  const hall = (await req('/api/island/titles', sa)).data.titles.find((x) => x.id === 'fishking');
  assert.deepEqual([hall.entries.length, hall.entries[0].names, hall.entries[0].mine], [1, ['낚시꾼'], true]); // (its week is this one: the hook only moved the holder)
});

test('낚시왕 집계: 어부 판매만, 그 주 안의 것만, 계정별 합계와 마지막 판매 시각', () => {
  const { fishSaleTotals } = require('../lib/point-store');
  const sale = (userId, paid, at, place = 'fisher') => ({ kind: 'island_sale', place, userId, paid, at });
  const rows = fishSaleTotals([sale('a', 500, '2026-10-12T01:00:00.000Z'), sale('a', 700, '2026-10-14T01:00:00.000Z'), sale('b', 1200, '2026-10-13T01:00:00.000Z'),
    sale('b', 9000, '2026-10-13T02:00:00.000Z', 'merchant'), sale('c', 5000, '2026-10-19T00:00:00.000Z'), { kind: 'island_sale', place: 'fisher', userId: 'd', paid: 0, at: '2026-10-13T00:00:00.000Z' }],
    '2026-10-11T15:00:00.000Z', '2026-10-18T15:00:00.000Z');
  assert.deepEqual(rows.sort((x, y) => x.userId.localeCompare(y.userId)), [{ userId: 'a', total: 1200, lastAt: '2026-10-14T01:00:00.000Z' }, { userId: 'b', total: 1200, lastAt: '2026-10-13T01:00:00.000Z' }]);
});

// v1.10.43 기념사진: a picture by a photo spot is kept once on the account (spot and day, no image); elsewhere nothing;
// the spots are in the 도감 beside the fish and finds
test('기념사진 서버: 장소 근처에서만 기록, 처음 한 번 표시, 도감에 들어간다', async (t) => {
  assert.equal(F.photoSpotAt(0, 3).id, 'photo_plaza'); assert.equal(F.photoSpotAt(60, 60), null);
  for (const s of F.PHOTO_SPOTS) assert.ok(T.walkable(s.x, s.z), s.name);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'photo-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const sa = await server.enter(await server.issue('사진가')); assert.ok(sa, server.logs());
  await req('/api/plaza/state', sa, { x: 60, z: 60, yaw: 0, moving: false });
  assert.equal((await req('/api/island/photo', sa, {})).data.spot, null);
  await req('/api/plaza/state', sa, { x: 0, z: 6, yaw: 0, moving: false });
  const first = (await req('/api/island/photo', sa, {})).data; assert.deepEqual([first.spot.id, first.first], ['photo_plaza', true]);
  assert.equal((await req('/api/island/photo', sa, {})).data.first, false);
  const dex = (await req('/api/island/dex', sa)).data;
  const e = dex.entries.find((x) => x.id === 'photo_plaza'); assert.equal(e.kind, 'photo'); assert.ok(e.first > 0); assert.equal(dex.found, 1);
});
