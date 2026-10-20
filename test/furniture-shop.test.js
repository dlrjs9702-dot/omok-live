'use strict';
// 묶음 2 가구점 (gamecenter-notes docs/furniture-shop-20261019.md): the 백화점's 2nd floor by its lift, the day's display
// (the same for everyone, the rarer ones less often), a piece bought by the first one only (the next pays nothing), three
// of the display a day each, the always-on-sale ones without that limit, everything bought in my 가구 창고.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const T = require('../public/plaza/island-terrain.js');
const S = require('../public/plaza/island-store');
const F = require('../public/plaza/island-furniture');
const { boot } = require('../test-support/test-server');

test('가구점 진열: 날마다 같은 진열, 모양 겹침 없음, 자리마다 맞는 종류, 드문 것은 가끔', () => {
  assert.equal(F.GOODS.length, 145); assert.equal(F.SLOTS.length, 16);
  for (const g of F.GOODS) assert.ok(g.name && F.SHAPES[g.shape] && F.COLOR[g.variant], g.id);
  const days = Array.from({ length: 120 }, (_, i) => new Date(Date.UTC(2026, 10, 1) + i * 864e5).toISOString().slice(0, 10));
  assert.deepEqual(F.displayOf(days[0]), F.displayOf(days[0]));
  const count = { common: 0, uncommon: 0, rare: 0 };
  for (const day of days) {
    const d = F.displayOf(day); const goods = Object.values(d).map(F.good);
    assert.equal(new Set(goods.map((g) => g.shape)).size, 16, day);
    for (const s of F.SLOTS) { const g = F.good(d[s.id]); assert.ok(s.kind === 'floor' ? g.kind === 'floor' && g.zone === s.zone : s.kind === 'wall' ? g.kind === 'wall' : ['wide', 'floor'].includes(g.kind), `${day} ${s.id} ${g.id}`); }
    for (const g of goods) count[g.rarity] += 1;
  }
  assert.ok(count.common > count.uncommon && count.uncommon > count.rare && count.rare > 0, JSON.stringify(count));
  // where one stands: never inside a plinth, the counter or the lift
  for (const s of F.SLOTS.filter((x) => x.plinth !== false)) { const w = F.world(s.lx, s.lz); const q = F.clamp(w.x, w.z); assert.ok(Math.hypot(q.x - w.x, q.z - w.z) > 1.4, s.id); }
});

test('가구점: 승강기로 2층, 먼저 산 한 명만(다음 사람은 포인트 그대로), 하루 3점, 늘 파는 것, 가구 창고', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'furniture-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('가구손님A')); const b = await server.enter(await server.issue('가구손님B'));
  const up = async (token) => {
    await req('/api/plaza/state', token, { ...T.facilityDoor('store'), yaw: 0, moving: false });
    assert.equal((await req('/api/island/store/enter', token, {})).status, 200);
    assert.equal((await req('/api/island/lift', token, { to: 2 })).data.error, 'TOO_FAR', '승강기 앞에서만');
    await req('/api/plaza/state', token, { ...S.world(...S.LIFT.stand), yaw: 0, moving: false });
    const went = await req('/api/island/lift', token, { to: 2 }); assert.equal(went.data.space, 'furniture', JSON.stringify(went.data));
    const pose = await req('/api/plaza/state', token, { ...F.world(...F.LIFT.stand), yaw: 0, moving: false }); assert.ok(F.inRoom(pose.data.x, pose.data.z), JSON.stringify(pose.data));
  };
  for (const token of [a, b]) { await req('/api/test/points-credit', token, { amount: 200000 }); await up(token); }
  const today = (await req('/api/island/furniture', a)).data;
  assert.equal(today.display.length, 16); assert.equal(today.base.length, 4); assert.equal(today.perDay, 3);
  const stand = async (token, slot) => { const s = [...F.SLOTS, ...F.BASE_SLOTS].find((x) => x.id === slot); const w = F.world(s.lx, s.lz); const q = F.clamp(w.x, w.z); await req('/api/plaza/state', token, { ...q, yaw: 0, moving: false }); };
  const balance = async (token) => (await req('/api/skins', token)).data.balance;
  // far from it: no
  assert.equal((await req('/api/island/furniture/buy', a, { slot: 'garden2' })).data.error, 'TOO_FAR');
  // both at the same piece at once: one buys it, the other is told it was just sold and keeps their points
  await stand(a, 'living0'); await stand(b, 'living0');
  const bBefore = await balance(b);
  const [ra, rb] = await Promise.all([req('/api/island/furniture/buy', a, { slot: 'living0' }), req('/api/island/furniture/buy', b, { slot: 'living0' })]);
  const won = [ra, rb].filter((r) => r.status === 200); const lost = [ra, rb].filter((r) => r.status !== 200);
  assert.equal(won.length, 1, JSON.stringify([ra.data, rb.data])); assert.equal(lost[0].data.error, 'SOLD');
  const winner = ra.status === 200 ? a : b; const loser = winner === a ? b : a;
  if (loser === b) assert.equal(await balance(b), bBefore, '못 산 사람은 포인트 그대로');
  assert.equal((await req('/api/island/furniture', loser)).data.display.find((d) => d.slot === 'living0').sold, true, '모두에게 팔림');
  // three a day: the 4th display piece is refused, an always-on-sale one is not
  for (const slot of ['living1', 'living2']) { await stand(winner, slot); assert.equal((await req('/api/island/furniture/buy', winner, { slot })).status, 200, slot); }
  await stand(winner, 'bedroom0'); assert.equal((await req('/api/island/furniture/buy', winner, { slot: 'bedroom0' })).data.error, 'FURNITURE_DAY_LIMIT');
  await stand(winner, 'base0');
  assert.equal((await req('/api/island/furniture/buy', winner, { slot: 'base0' })).data.error, 'BAD_REQUEST', '늘 파는 것은 요청 번호로 한 번씩');
  for (const requestId of ['base-0001-aaaa', 'base-0002-bbbb', 'base-0002-bbbb']) assert.equal((await req('/api/island/furniture/buy', winner, { slot: 'base0', requestId })).status, 200);
  const mine = (await req('/api/island/furniture/mine', winner)).data.pieces;
  assert.equal(mine.length, 5, '같은 요청 번호는 한 번만'); assert.equal(mine[0].id, F.BASE[0]); assert.ok(mine.every((p) => p.name && p.model));
  assert.deepEqual((await req('/api/island/furniture/mine', loser)).data.pieces, []);
  // down again: in front of the 2nd floor's lift
  await req('/api/plaza/state', winner, { ...F.world(...F.LIFT.stand), yaw: 0, moving: false });
  assert.equal((await req('/api/island/lift', winner, { to: 1 })).data.space, 'store');
});
