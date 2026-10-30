'use strict';
// 묶음 2-2 펫샵 (gamecenter-notes docs/pet-shop-20261020.md): the 백화점's 3rd floor by the lift, ten pets a day (v1.10.191) walking
// their rounds in the yard (the same everywhere: the server knows where each is), one taken by the first who asks
// (by it), one a day each, named, it walks with me in its coat; the pets bought before at the 잡화점 stay mine.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const T = require('../public/plaza/island-terrain.js');
const S = require('../public/plaza/island-store');
const P = require('../public/plaza/island-petshop');
const { boot } = require('../test-support/test-server');

test('펫샵 하루: 열 마리(기본 종류마다 둘·무늬 다름 + 특별 넷), 모두 놀이 마당 안을 돈다', () => {
  for (const day of ['2026-10-20', '2026-10-21', '2026-12-31']) {
    const d = P.displayOf(day); assert.equal(d.length, 10);
    assert.equal(new Set(d.map((p) => `${p.kind}:${p.coat}`)).size, 10);
    for (const kind of Object.keys(P.KINDS)) assert.equal(d.filter((p) => p.kind === kind).length, 2, `${day} ${kind}`);
    assert.equal(d.filter((p) => P.catalogOf(p.kind) && p.coat === null).length, 4, day);
    for (const p of d) for (let t = 0; t < 900; t += 7) {
      const q = P.local(...Object.values(P.petAt(day, p.slot, t * 1000)).slice(0, 2)); assert.ok(Math.abs(q.lx - P.PEN.lx) < P.PEN.w / 2 && Math.abs(q.lz - P.PEN.lz) < P.PEN.d / 2, `${day} ${p.slot} ${t}`);
    }
  }
  assert.deepEqual(P.displayOf('2026-10-20'), P.displayOf('2026-10-20'));
  assert.equal(P.coatOf('puppy', 'nope'), 'tan');
});

test('펫샵: 승강기 3층, 곁에서만·먼저 온 한 명만·하루 한 마리, 이름과 무늬로 따라다님, 잡화점 반려동물도 내 것', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'petshop-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('펫손님A')); const b = await server.enter(await server.issue('펫손님B'));
  for (const token of [a, b]) {
    await req('/api/test/points-credit', token, { amount: 100000 });
    await req('/api/plaza/state', token, { ...T.facilityDoor('store'), yaw: 0, moving: false });
    assert.equal((await req('/api/island/store/enter', token, {})).status, 200);
    await req('/api/plaza/state', token, { ...S.world(...S.LIFT.stand), yaw: 0, moving: false });
    assert.equal((await req('/api/island/lift', token, { to: 4 })).data.space, 'petshop');
  }
  const shop = (await req('/api/island/petshop', a)).data; assert.equal(shop.pets.length, 10); assert.ok(shop.pets.every((p) => p.price > 0 && !p.sold));
  const pet = shop.pets[0];
  const by = async (token) => { const w = P.petAt(shop.day, pet.slot, Date.now()); await req('/api/plaza/state', token, { x: w.x + 0.6, z: w.z, yaw: 0, moving: false }); };
  // far from it: no
  await req('/api/plaza/state', a, { ...P.world(...P.LIFT.stand), yaw: 0, moving: false });
  assert.equal((await req('/api/island/petshop/adopt', a, { slot: pet.slot, name: '초코' })).data.error, 'TOO_FAR');
  // both by it at once: one takes it, the other keeps their points
  await by(a); await by(b);
  const before = (await req('/api/skins', b)).data.balance;
  const [ra, rb] = await Promise.all([req('/api/island/petshop/adopt', a, { slot: pet.slot, name: '초코' }), req('/api/island/petshop/adopt', b, { slot: pet.slot, name: '바둑' })]);
  const won = ra.status === 200 ? { r: ra, token: a } : { r: rb, token: b }; const lost = ra.status === 200 ? { r: rb, token: b } : { r: ra, token: a };
  assert.equal(won.r.status, 200, JSON.stringify([ra.data, rb.data])); assert.equal(lost.r.data.error, 'SOLD');
  if (lost.token === b) assert.equal((await req('/api/skins', b)).data.balance, before, '못 데려간 사람은 포인트 그대로');
  assert.deepEqual(won.r.data.pet, { kind: pet.kind, coat: pet.coat, name: ra.status === 200 ? '초코' : '바둑' });
  assert.equal((await req('/api/island/petshop', lost.token)).data.pets[0].sold, true);
  // one a day
  const other = shop.pets[1]; const w = P.petAt(shop.day, other.slot, Date.now()); await req('/api/plaza/state', won.token, { x: w.x + 0.6, z: w.z, yaw: 0, moving: false });
  assert.equal((await req('/api/island/petshop/adopt', won.token, { slot: other.slot, name: '둘째' })).data.error, 'PET_DAY_LIMIT');
  // the one walking: in my presence with its coat; mine, with an old 잡화점 puppy too; away and back by its uid
  await req('/api/test/island/give', won.token, { itemId: 'pet_puppy', qty: 1 });
  const mine = (await req('/api/island/pets', won.token)).data.pets;
  assert.equal(mine.length, 2); assert.equal(mine.find((p) => p.from === 'petshop').walking, true); assert.equal(mine.find((p) => p.from === 'bag').coat, 'tan');
  assert.equal((await req('/api/island/pet', won.token, { uid: 'bag:puppy', name: '누렁' })).data.pet.coat, 'tan');
  const adopted = mine.find((p) => p.from === 'petshop');
  assert.deepEqual((await req('/api/island/pet', won.token, { uid: adopted.uid })).data.pet, { kind: pet.kind, coat: pet.coat, name: adopted.name });
  assert.equal((await req('/api/island/pet', won.token, { uid: 'not-mine-0000' })).data.error, 'NOT_MINE');
  assert.equal((await req('/api/island/pet', won.token, { kind: null })).data.pet, null);
  // the 잡화점 sells pets no more
  assert.ok(!S.SHELF.some((s) => s.id.startsWith('pet_')));
});
