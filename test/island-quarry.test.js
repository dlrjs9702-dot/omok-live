'use strict';
// 1.10.323 Q1 채석장 (public/plaza/island-quarry.js; notes docs/island-expansion-20261115.md 28A·29B·30A; assets 129·130): the place on
// the ridge (B, r 148~166, 298°~314°), the walk 79 m on from 영웅마루역, ten rocks clear of each other with every mining spot
// standable, the nature cleared; the server -- a pickaxe needed, at the spot, three swings' time, one 광석 and a use of the pickaxe,
// a rock mined out to its mined look till it grows back, a day's count; the week's 손보기 asking 광석 5
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const rmAtExit = require('../test-support/rm-at-exit');
const { boot } = require('../test-support/test-server');
const Q = require('../public/plaza/island-quarry.js');
const T = require('../public/plaza/island-terrain.js');
const Farm = require('../public/plaza/island-farm.js');
const Items = require('../lib/island-items');

test('채석장 자리: 능선 B 안 바위 10개, 캐는 자리 모두 설 수 있음, 79 m 길, 자연물 없음, 막힘', () => {
  assert.equal(Q.ROCKS.length, 10);
  let walk = 0; for (let i = 1; i < Q.WALK.length; i += 1) walk += Math.hypot(Q.WALK[i].x - Q.WALK[i - 1].x, Q.WALK[i].z - Q.WALK[i - 1].z);
  assert.ok(walk > 74 && walk < 84, `길 ${walk.toFixed(1)} m`); assert.ok(T.walkDist(Q.WALK.at(-1).x, Q.WALK.at(-1).z) < 0, '길이 채석장까지');
  for (const r of Q.ROCKS) {
    assert.ok(Q.inArea(r.x, r.z), `${r.id} 능선 B 안`); assert.ok(T.heightAt(r.x, r.z) > 19, `${r.id} 절벽 위`);
    for (const o of Q.ROCKS) if (o !== r) assert.ok(Math.hypot(o.x - r.x, o.z - r.z) > 5, `${r.id}·${o.id} 떨어짐`);
    for (let i = 0; i < Q.spotCount(r); i += 1) for (const stage of ['full', 'mined']) {
      const s = Q.standOf(r, stage, i); assert.ok(T.walkable(s.x, s.z), `${r.id} ${stage} ${i} 설 수 있음`);
      assert.ok(T.structureSolids().every((o) => Math.hypot(o.x - s.x, o.z - s.z) > o.r), `${r.id} ${stage} ${i} 막힘 밖`);
      const tip = { x: s.x + Math.sin(s.yaw) * 1.0 - Math.cos(s.yaw) * 0.08, z: s.z + Math.cos(s.yaw) * 1.0 + Math.sin(s.yaw) * 0.08 }; assert.ok(Math.hypot(tip.x - s.S.x, tip.z - s.S.z) < 0.01, '곡괭이 끝이 그 자리에');
    }
  }
  const mined = Q.standOf(Q.ROCKS[0], 'mined', 0); const full = Q.standOf(Q.ROCKS[0], 'full', 0); assert.ok(Math.hypot(mined.x - full.x, mined.z - full.z) > 0.08, '캔 뒤 자리는 안쪽');
  const n = T.nature(); for (const k of ['trees', 'bushes', 'rocks', 'logs']) assert.equal((n[k] || []).filter((p) => Q.inArea(p.x, p.z)).length, 0, `${k} 치움`);
  assert.equal(T.structureSolids().filter((s) => s.quarry).length, 10, '바위 막힘');
  // the items: the 광석 and the 곡괭이 (a tool, 40 uses, the quick slot's), the week's 손보기 5
  assert.equal(Items.ITEMS.ore.name, '광석'); assert.equal(Items.TOOL_KIND.pickaxe, 'pickaxe'); assert.equal(Items.TOOL_USES.pickaxe, 40); assert.ok(Items.QUICK_KINDS.includes('pickaxe'));
  assert.equal(Farm.upkeepNeed(1).ore, 5); assert.equal(Farm.upkeepNeed(4).ore, 10);
});

test('채석장 서버: 곡괭이·자리·세 번 휘두를 시간 → 광석 1 · 곡괭이 닳음 · 바위 다 캐면 캔 모습 → 다시 자람', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'quarry-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server; const a = await server.enter(await server.issue('광부'));
  const rock = Q.ROCKS[0]; const stand = Q.standOf(rock, 'full', 0);
  const v0 = (await req('/api/island/quarry', a)).data; assert.equal(v0.rocks.length, 10); assert.ok(v0.rocks.every((r) => r.left === Q.ORE_PER_ROCK && r.stage === 'full')); assert.deepEqual(v0.daily, { n: 0, max: Q.DAILY });
  await req('/api/plaza/state', a, { x: stand.x, z: stand.z, yaw: stand.yaw, moving: false });
  assert.equal((await req('/api/island/quarry/start', a, { rock: rock.id, spot: 0 })).data.error, 'NO_PICKAXE');
  await req('/api/test/island/give', a, { itemId: 'pickaxe', qty: 1 });
  await req('/api/plaza/state', a, { x: stand.x + 5, z: stand.z, yaw: 0, moving: false });
  assert.equal((await req('/api/island/quarry/start', a, { rock: rock.id, spot: 0 })).data.error, 'TOO_FAR');
  const mine = async () => {
    await req('/api/plaza/state', a, { x: stand.x, z: stand.z, yaw: stand.yaw, moving: false });
    const s = await req('/api/island/quarry/start', a, { rock: rock.id, spot: 0 }); assert.equal(s.status, 200, JSON.stringify(s.data)); assert.equal(s.data.ms, Q.MINE_MS);
    const rid = crypto.randomUUID(); assert.equal((await req('/api/island/quarry/finish', a, { rock: rock.id, spot: 0, requestId: rid })).data.error, 'COLLECT_TOO_SOON');
    await new Promise((r) => setTimeout(r, Q.MINE_MS));
    const f = await req('/api/island/quarry/finish', a, { rock: rock.id, spot: 0, requestId: rid }); assert.equal(f.status, 200, JSON.stringify(f.data));
    assert.deepEqual((await req('/api/island/quarry/finish', a, { rock: rock.id, spot: 0, requestId: rid })).data, f.data, '같은 요청은 한 번'); return f.data;
  };
  const f1 = await mine(); assert.equal(f1.ore, 1); assert.equal(f1.left, 1); assert.equal(f1.worn.uses, Items.TOOL_USES.pickaxe - 1); assert.equal(f1.daily.n, 1);
  const f2 = await mine(); assert.equal(f2.left, 0); assert.equal(f2.stage, 'mined');
  const bag = (await req('/api/island/bag', a)).data; const items = bag.bag?.items || bag.items || []; assert.equal(items.filter((e) => e.itemId === 'ore').reduce((n, e) => n + e.qty, 0), 2, '광석 2');
  assert.equal((await req('/api/island/quarry/start', a, { rock: rock.id, spot: 0 })).data.error, 'MINED');
  assert.equal((await req('/api/island/quarry', a)).data.rocks.find((r) => r.id === rock.id).stage, 'mined');
  const back = (await req('/api/test/quarry/regrow', a, {})).data; assert.equal(back.rocks.find((r) => r.id === rock.id).left, Q.ORE_PER_ROCK, '다시 자람');
});
