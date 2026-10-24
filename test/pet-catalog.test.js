'use strict';
// 문제 기록 3회차 21 (사용자 결정 10/22 「펫샵에서 따로 판매」) + 메타몽: at the 펫샵's counter, always on sale apart from the
// yard -- each transformation small (IP ones too, whoever owns the transformation or not) and 메타몽, one of each, priced
// from the economy table (animals 8,000, characters and 메타몽 12,000); bought, named, it walks with me; never in the bag
// (so never given away).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const T = require('../public/plaza/island-terrain.js');
const S = require('../public/plaza/island-store');
const P = require('../public/plaza/island-petshop');
const { boot } = require('../test-support/test-server');

test('변신 펫 목록: 변신 모두(캐릭터 포함)와 메타몽, 캐릭터·메타몽은 IP', () => {
  const tf = require('../public/plaza/character-transformations.js').characters;
  assert.equal(P.catalog().length, tf.length + 1);
  assert.deepEqual(P.catalogOf('ditto'), { kind: 'ditto', name: '메타몽', ip: true });
  assert.equal(P.catalogOf('tf_pikachu').ip, true); assert.equal(P.catalogOf('tf_animal-cat').ip, false);
  assert.equal(P.nameOf('tf_kuromi'), '쿠로미'); assert.equal(P.known('tf_none'), false); assert.equal(P.known('puppy'), true);
});

test('펫샵 카운터: 펫샵 안에서만, 한 종류 한 마리, 경제 값 가격, 데려가면 따라다니고 가방에는 없음', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'petcatalog-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('변신펫손님'));
  await req('/api/test/points-credit', a, { amount: 100000 });
  assert.equal((await req('/api/island/petshop/buy', a, { kind: 'ditto', name: '말랑' })).data.error, 'TOO_FAR'); // (not in the 펫샵)
  await req('/api/plaza/state', a, { ...T.facilityDoor('store'), yaw: 0, moving: false });
  assert.equal((await req('/api/island/store/enter', a, {})).status, 200);
  await req('/api/plaza/state', a, { ...S.world(...S.LIFT.stand), yaw: 0, moving: false });
  assert.equal((await req('/api/island/lift', a, { to: 3 })).data.space, 'petshop');
  const shop = (await req('/api/island/petshop', a)).data;
  const price = (kind) => shop.catalog.find((p) => p.kind === kind).price;
  assert.deepEqual([price('ditto'), price('tf_pikachu'), price('tf_animal-cat')], [12000, 12000, 8000]);
  const balance = async () => (await req('/api/skins', a)).data.balance;
  const start = await balance();
  const r = await req('/api/island/petshop/buy', a, { kind: 'ditto', name: '말랑' });
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.deepEqual(r.data.pet, { kind: 'ditto', coat: null, name: '말랑' });
  assert.equal((await req('/api/island/petshop/buy', a, { kind: 'ditto', name: '또' })).data.error, 'ALREADY_OWNED');
  assert.equal((await req('/api/island/petshop/buy', a, { kind: 'tf_nope' })).data.error, 'BAD_PET');
  assert.equal((await req('/api/island/petshop/buy', a, { kind: 'tf_animal-cat', name: '나비' })).status, 200);
  assert.equal(await balance(), start - 12000 - 8000);
  const mine = (await req('/api/island/pets', a)).data.pets;
  assert.deepEqual(mine.map((p) => [p.kind, p.walking]), [['ditto', false], ['tf_animal-cat', true]]);
  assert.ok(!((await req('/api/island/bag', a)).data.items || []).some((e) => /ditto|tf_/.test(e.itemId)), '가방에 없으니 선물할 수 없음');
  assert.equal((await req('/api/island/petshop', a)).data.catalog.find((p) => p.kind === 'ditto').owned, true);
  assert.deepEqual((await req('/api/island/pet', a, { uid: mine[0].uid })).data.pet, { kind: 'ditto', coat: null, name: '말랑' });
});
