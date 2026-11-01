'use strict';
// v1.10.226 가구 리폼 (docs/furniture-reform-20261102.md): a shop piece made another colour of its own shape at the 3층
// counter -- not another shape, a colour it has not, the colour it is, an event piece or a yard piece; 3,000 a time, the
// same request twice paid once; a placed piece keeps its place and turn, a tank its fish, a desk what stands on it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');
const F = require('../public/plaza/island-furniture');
const S = require('../public/plaza/island-store');
const H = require('../public/plaza/island-home');
const T = require('../public/plaza/island-terrain');

test('가구 리폼 규칙: 같은 모양의 다른 색만', () => {
  assert.deepEqual(F.reformColors('sofa__mint').map((g) => g.variant), ['mint', 'coral', 'navy', 'sage']);
  assert.equal(F.reformTo('sofa__mint', 'sofa__navy'), true);
  assert.equal(F.reformTo('sofa__mint', 'bed__sky'), false, '다른 모양');
  assert.equal(F.reformTo('sofa__mint', 'sofa__gold'), false, '없는 색');
  assert.equal(F.reformTo('sofa__mint', 'sofa__mint'), false, '같은 색');
  assert.equal(F.reformColors('trophy_fish__gold').length, 0, '행사 가구');
  assert.equal(F.reformColors('yard_bench__plain').length, 0, '마당 물건');
  assert.equal(F.reformColors('cheongsa_lantern__blue_red').length, 0, '한 색뿐');
});

test('가구 리폼 서버: 3층 계산대에서 3,000P, 같은 요청 두 번은 한 번, 놓인 소파·수조 물고기·책상 위 라디오 그대로', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reform-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('리폼손님'));
  await req('/api/test/points-credit', a, { amount: 200000 });
  const stand = (x, z) => req('/api/plaza/state', a, { x, z, yaw: 0, moving: false });
  const balance = async () => (await req('/api/skins', a)).data.balance;
  // a house, and in it a sofa, a tank with a goby, a desk with a radio on it
  const door = T.facilityDoor('townhall'); await stand(door.x, door.z); assert.equal((await req('/api/island/townhall/enter', a, {})).status, 200);
  const lot = H.LOTS[5]; assert.equal((await req('/api/home/apply', a, { lot: lot.id, roof: 'red' })).status, 200);
  const ex = T.roomWorld(T.TOWNHALL_ROOM.exit.lx, T.TOWNHALL_ROOM.exit.lz); await stand(ex.x, ex.z); await req('/api/island/townhall/leave', a, {});
  const [sofa, tank, desk, radio, trophy] = (await req('/api/test/home/furniture', a, { ids: ['sofa__mint', 'fish_tank__oak', 'desk__oak', 'radio__red', 'trophy_fish__gold'] })).data.pieces;
  await req('/api/test/island/give', a, { itemId: 'fish_goby', qty: 1 });
  const d = H.doorOf(lot, 1); await stand(d.x, d.z); assert.equal((await req('/api/home/enter', a, { lot: lot.id })).status, 200);
  for (const [p, x, z] of [[sofa, -2, 2], [tank, 2, 2], [desk, 0, 0], [radio, 0, 0]]) { const r = await req('/api/home/place', a, { uid: p.uid, x, z, rot: p === sofa ? 1 : 0 }); assert.equal(r.status, 200, JSON.stringify(r.data)); }
  assert.equal((await req('/api/home/tank', a, { tank: tank.uid, put: 'fish_goby', requestId: 'reform-tank-0001' })).status, 200);
  const en = H.entryOf(1); const way = H.world(lot, en[0], en[1] - 0.6); await stand(way.x, way.z); assert.equal((await req('/api/home/leave', a, {})).status, 200);
  const reform = (uid, to, requestId) => req('/api/island/furniture/reform', a, { uid, to, requestId });
  assert.equal((await reform(sofa.uid, 'sofa__navy', 'reform-far-00001')).data.error, 'TOO_FAR', '3층 계산대에서만');
  // up to the 3층, by its counter
  await stand(T.facilityDoor('store').x, T.facilityDoor('store').z); assert.equal((await req('/api/island/store/enter', a, {})).status, 200);
  await stand(...Object.values(S.world(...S.LIFT.stand))); assert.equal((await req('/api/island/lift', a, { to: 3 })).data.space, 'furniture');
  const c = F.world(F.CHECKOUT.lx, F.CHECKOUT.lz - 1); await stand(c.x, c.z);
  assert.equal((await req('/api/island/furniture', a)).data.reform, 3000);
  for (const [uid, to, why] of [[sofa.uid, 'bed__sky', '다른 모양'], [sofa.uid, 'sofa__gold', '없는 색'], [sofa.uid, 'sofa__mint', '같은 색'], [trophy.uid, 'trophy_fish__silver', '행사']]) assert.equal((await reform(uid, to, `reform-bad-${why.length}0000`)).data.error, 'BAD_COLOR', why);
  let before = await balance(); const once = await reform(sofa.uid, 'sofa__navy', 'reform-sofa-00001'); assert.equal(once.status, 200, JSON.stringify(once.data));
  assert.equal((await reform(sofa.uid, 'sofa__navy', 'reform-sofa-00001')).status, 200); assert.equal(before - await balance(), 3000, '같은 요청 두 번 → 한 번만');
  assert.equal((await reform(tank.uid, 'fish_tank__white', 'reform-tank-00001')).status, 200); assert.equal((await reform(desk.uid, 'desk__walnut', 'reform-desk-00001')).status, 200);
  // the house: the same places and turns, the goby in the tank, the radio on the desk; the storage the new colours
  const h = (await req('/api/home', a)).data.mine; const at = (uid) => h.pieces.find((p) => p.uid === uid);
  assert.deepEqual([at(sofa.uid).id, at(sofa.uid).x, at(sofa.uid).z, at(sofa.uid).rot], ['sofa__navy', -2, 2, 1]);
  assert.equal(at(tank.uid).id, 'fish_tank__white'); assert.equal(h.tanks[tank.uid].length, 1, '수조 물고기 그대로');
  assert.equal(at(desk.uid).id, 'desk__walnut'); assert.equal(H.supportOf(at(radio.uid), h.pieces)?.uid, desk.uid, '책상 위 라디오 그대로');
  const mine = (await req('/api/island/furniture/mine', a)).data.pieces; assert.equal(mine.find((p) => p.uid === sofa.uid).id, 'sofa__navy');
});
