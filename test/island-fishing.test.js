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
  const by = {}; let ev = 0; const N = 50000;
  for (let i = 0; i < N; i += 1) { const id = F.draw(rnd); by[F.SPECIES[id].grade] = (by[F.SPECIES[id].grade] || 0) + 1; ev += F.SPECIES[id].price; }
  for (const [g, p] of [['common', 0.6], ['normal', 0.28], ['rare', 0.11], ['big', 0.01]]) assert.ok(Math.abs(by[g] / N - p) < 0.012, g);
  assert.ok(ev / N > 1200 && ev / N < 1700, `기대값 ${ev / N}`);
  assert.equal(F.canFish(T.PIER.x, T.PIER.z), true); assert.equal(F.canFish(0, 8), false); assert.equal(F.canFish(30, 30), false);
  const c = { biteAt: 10_000 };
  assert.deepEqual([F.judge(c, 9000), F.judge(c, 10_500), F.judge(c, 10_000 + F.BITE_MS + F.LATE_MS + 1)], ['early', 'ok', 'late']);
  assert.deepEqual(F.titlesFor(3), []); assert.deepEqual(F.titlesFor(F.DEX.length).map((t) => t.id), ['dex_title_1', 'dex_title_2', 'dex_title_3']);
});

test('낚시 서버: 물가에서만 던지고, 입질 때 당기면 가방·도감에 한 번, 이르면 실패, 어부에게 판매, 도감 칭호', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fish-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const sa = await server.enter(await server.issue('낚시꾼')); assert.ok(sa, server.logs());
  const at = async (x, z) => req('/api/plaza/state', sa, { x, z, yaw: 0, moving: false });
  await at(0, 8);
  assert.equal((await req('/api/island/fish/start', sa, {})).data.error, 'NOT_FISHING_SPOT');
  await at(T.PIER.x, T.PIER.z);
  const early = (await req('/api/island/fish/start', sa, {})).data; assert.ok(early.biteIn >= 5000 && early.biteIn <= 10000);
  assert.equal((await req('/api/island/fish/finish', sa, { fishId: early.fishId })).data.error, 'FISH_EARLY');
  const cast = (await req('/api/island/fish/start', sa, {})).data;
  await req('/api/test/fish/bite', sa, { species: 'octopus' });
  const got = (await req('/api/island/fish/finish', sa, { fishId: cast.fishId })).data;
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
});
