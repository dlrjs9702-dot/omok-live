'use strict';
// 문제 기록 3회차 21 + 메타몽: the special pets -- each transformation small (IP ones too) and 메타몽, one of each, priced from
// the economy table (animals 8,000, characters and 메타몽 12,000), never in the bag (so never given away).
// v1.10.191 (docs/petshop-yard-unify-20261027.md, 사용자 「모든 펫을 동일하게 하루하루 랜덤으로 풀어놓고」): no more sold at the
// counter -- four a day in the yard, in turn (all 23 within any six days), taken as the others; one I have already: no.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const T = require('../public/plaza/island-terrain.js');
const S = require('../public/plaza/island-store');
const P = require('../public/plaza/island-petshop');
const { boot } = require('../test-support/test-server');

test('특별 펫 목록: 변신 모두(캐릭터 포함)와 메타몽, 캐릭터·메타몽은 IP', () => {
  const tf = require('../public/plaza/character-transformations.js').characters;
  assert.equal(P.catalog().length, tf.length + 1);
  assert.deepEqual(P.catalogOf('ditto'), { kind: 'ditto', name: '메타몽', ip: true });
  assert.equal(P.catalogOf('tf_pikachu').ip, true); assert.equal(P.catalogOf('tf_animal-cat').ip, false);
  assert.equal(P.nameOf('tf_kuromi'), '쿠로미'); assert.equal(P.known('tf_none'), false); assert.equal(P.known('puppy'), true);
});

test('마당 특별 넷: 하루에 서로 다른 넷, 23가지 모두 어느 6일 안에도 나옴', () => {
  const all = P.catalog().map((p) => p.kind); const days = [];
  for (let k = 0; k < 60; k += 1) days.push(P.displayOf(new Date(Date.UTC(2026, 9, 1 + k)).toISOString().slice(0, 10)).filter((p) => P.catalogOf(p.kind)).map((p) => p.kind));
  for (const d of days) { assert.equal(d.length, 4); assert.equal(new Set(d).size, 4); }
  for (let k = 0; k + 6 <= days.length; k += 1) assert.deepEqual([...new Set(days.slice(k, k + 6).flat())].sort(), [...all].sort(), `day ${k}`);
});

test('펫샵 특별 펫: 창구 판매는 거절, 마당에서 데려가고, 이미 가진 종류는 「이미 함께 살아요」(다른 사람은 됨)', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'petcatalog-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  let server = await boot(t, dir);
  const keys = [await server.issue('특별펫손님'), await server.issue('특별펫이웃')];
  const upstairs = async (srv, key) => {
    const token = await srv.enter(key); const { req } = srv;
    await req('/api/test/points-credit', token, { amount: 100000 });
    await req('/api/plaza/state', token, { ...T.facilityDoor('store'), yaw: 0, moving: false });
    assert.equal((await req('/api/island/store/enter', token, {})).status, 200);
    await req('/api/plaza/state', token, { ...S.world(...S.LIFT.stand), yaw: 0, moving: false });
    assert.equal((await req('/api/island/lift', token, { to: 4 })).data.space, 'petshop');
    return token;
  };
  let a = await upstairs(server, keys[0]);
  // the old screen's counter purchase: turned away
  const old = await server.req('/api/island/petshop/buy', a, { kind: 'ditto', name: '말랑' });
  assert.equal(old.status, 410); assert.equal(old.data.error, 'CATALOG_CLOSED');
  const shop = (await server.req('/api/island/petshop', a)).data;
  assert.equal(shop.catalog, undefined);
  const sp = shop.pets.find((p) => p.special); assert.ok(sp && sp.coat === null && sp.owned === false);
  assert.equal(sp.price, P.catalogOf(sp.kind).ip ? 12000 : 8000); assert.equal(sp.ip, P.catalogOf(sp.kind).ip);
  const adopt = async (srv, token) => { const w = P.petAt(shop.day, sp.slot, Date.now()); await srv.req('/api/plaza/state', token, { x: w.x + 0.6, z: w.z, yaw: 0, moving: false }); return srv.req('/api/island/petshop/adopt', token, { slot: sp.slot, name: '특별이' }); };
  const r = await adopt(server, a);
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.deepEqual(r.data.pet, { kind: sp.kind, coat: null, name: '특별이' });
  assert.ok(!((await server.req('/api/island/bag', a)).data.items || []).some((e) => /ditto|tf_/.test(e.itemId)), '가방에 없으니 선물할 수 없음');
  // another day with the same one in the yard (the day's taken written off): mine already -- no; the neighbour -- yes
  await server.stop();
  const file = path.join(dir, 'points.json'); const data = JSON.parse(await fs.readFile(file, 'utf8')); delete data.island.world.petshop; await fs.writeFile(file, JSON.stringify(data));
  server = await boot(t, dir);
  a = await upstairs(server, keys[0]); const b = await upstairs(server, keys[1]);
  assert.equal((await server.req('/api/island/petshop', a)).data.pets.find((p) => p.slot === sp.slot).owned, true);
  const again = await adopt(server, a); assert.equal(again.status, 409); assert.equal(again.data.error, 'ALREADY_OWNED'); assert.equal(again.data.message, '이미 함께 살아요.');
  assert.equal((await adopt(server, b)).status, 200);
});
