'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { boot } = require('../test-support/test-server');

// 달마루섬 5단계 이사 (사용자 결정: 심은 꽃·나무는 전부 씨앗으로): the first start on the new island gives every planted
// flower back to its owner as its seed and every tree as a sapling -- no points, once -- and takes the plants up.
test('달마루섬 이사: 심은 꽃은 씨앗, 나무는 묘목으로 한 번만 돌려받고 땅은 비운다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dal-move-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const was = process.env.ISLAND_MAP; t.after(() => { if (was === undefined) delete process.env.ISLAND_MAP; else process.env.ISLAND_MAP = was; });
  delete process.env.ISLAND_MAP;
  let server = await boot(t, dir);
  const key = await server.issue('이사손님'); let s = await server.enter(key);
  const balance = (await server.req('/api/points', s)).data.balance;
  await server.stop();
  const file = path.join(dir, 'points.json'); const data = JSON.parse(await fs.readFile(file, 'utf8'));
  const owner = `guest:${key.id}`; const at = new Date().toISOString();
  data.island ||= { bags: {}, days: {} };
  data.island.plants = [{ id: 'p1', owner, kind: 'flower', color: 'red', x: 30, z: 30, plantedAt: Date.now() }, { id: 'p2', owner, kind: 'tree', color: null, x: 40, z: 40, plantedAt: Date.now() }];
  data.island.weeds = { day: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10) /* (today in KST: no day's roll over the test) */, removed: { w3: at }, added: [{ id: 'g1-0', x: 10, z: 10 }], pulled: 4 };
  await fs.writeFile(file, JSON.stringify(data));
  process.env.ISLAND_MAP = 'dalmaru';
  for (let round = 0; round < 2; round += 1) { // (a second start gives nothing more)
    server = await boot(t, dir); s = await server.enter(key);
    const bag = (await server.req('/api/island/bag', s)).data.items || [];
    const qty = (id) => bag.filter((e) => e.itemId === id).reduce((a, e) => a + e.qty, 0);
    assert.deepEqual([qty('seed_flower_red'), qty('sapling')], [1, 1], `round ${round}`);
    assert.equal((await server.req('/api/island/plants', s)).data.plants.length, 0);
    assert.equal((await server.req('/api/points', s)).data.balance, balance, '포인트는 그대로');
    await server.stop();
  }
  const after = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.deepEqual([Object.keys(after.island.weeds.removed).length, after.island.weeds.added.length, after.island.weeds.pulled], [0, 0, 4], '잡초는 새 섬 것으로, 오늘 뽑은 수는 그대로');
  assert.ok(Object.values(after.settlements).some((r) => r.note === '달마루섬 이사 돌려받기'));
});
