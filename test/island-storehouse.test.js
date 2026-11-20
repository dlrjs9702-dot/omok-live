'use strict';
// 1.10.386 마당 창고 (lib/island-storehouse.js, island-yard STORE, 사용자 결정 19~21·24·32): what goes in (not tools, bikes, pets, errand things),
// 99 of a thing a slot, a fish one a slot with its size, all or nothing; the server -- built and grown at the 관공서 (10만 · 30만 ...), placed
// in my yard with the place tool (not counted in the yard's pieces), things in and out at its door only, grown where it stands
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { boot } = require('../test-support/test-server');
const S = require('../lib/island-storehouse');
const I = require('../lib/island-items');
const Y = require('../public/plaza/island-yard');
const T = require('../public/plaza/island-terrain');

test('386 창고 규칙: 넣을 수 있는 것 · 한 칸 99 · 물고기 한 칸 한 마리 · 가득이면 통째로 안 됨 · 꺼내면 가방으로', () => {
  assert.ok(S.canKeep('crop_carrot') && S.canKeep('ore_iron') && S.canKeep('fish_mackerel') && S.canKeep('seed_carrot') && S.canKeep('weed'));
  for (const id of ['pickaxe', 'fishing_rod', 'bugnet', 'bike_red', 'pet_puppy', 'bread', 'lost', 'wallet', 'nothing']) assert.ok(!S.canKeep(id), id);
  let bag = I.addToBag([], 'crop_carrot', 150, 'c'); bag = I.addToBag(bag, 'fish_mackerel', 2, 'f', { sizes: [30, 40] });
  let r = S.put([], bag, 'crop_carrot', 99, 20); assert.deepEqual(r.items.map((e) => [e.itemId, e.qty]), [['crop_carrot', 99]]);
  r = S.put(r.items, r.bag, 'crop_carrot:1', 51, 20); assert.deepEqual(r.items.map((e) => e.qty), [99, 51], '99 넘으면 다음 칸');
  assert.ok(!r.bag.some((e) => e.itemId === 'crop_carrot'));
  const fish = r.bag.filter((e) => e.itemId === 'fish_mackerel'); r = S.put(r.items, r.bag, fish[1].entryId, 1, 20); assert.deepEqual(r.items[2].meta, { sizes: [40] }, '물고기는 제 크기로 한 칸');
  assert.equal(S.put(r.items, r.bag, fish[0].entryId, 1, 3).error, 'FULL', '칸이 없으면 안 됨'); assert.equal(S.put(r.items, r.bag, 'none', 1, 20).error, 'MISSING');
  assert.equal(S.put([], I.addToBag([], 'pickaxe', 1, 'p'), 'p', 1, 20).error, 'NOT_KEPT');
  // all or nothing: 120 into a store with one slot left
  const full = Array.from({ length: 19 }, (_, k) => ({ entryId: `s${k + 1}`, itemId: 'ore_iron', qty: 99 })); const ores = I.addToBag(I.addToBag([], 'ore_coal', 99, 'o'), 'ore_coal', 21, 'o');
  assert.equal(S.put(full, ores, ores[0].entryId, 99, 20).items.length, 20); assert.equal(S.put(full, ores, ores[1].entryId, 21, 19).error, 'FULL');
  // out: back into the bag (a fish with its size), the rest left
  const back = S.take(r.items, r.bag, r.items[0].entryId, 40, I.capOf('x')); assert.equal(back.items[0].qty, 59); assert.equal(back.bag.find((e) => e.itemId === 'crop_carrot').qty, 40);
  const fishBack = S.take(r.items, r.bag, r.items[2].entryId, 1, I.capOf('x')); assert.ok(fishBack.bag.some((e) => e.itemId === 'fish_mackerel' && e.meta?.sizes?.[0] === 40)); assert.equal(fishBack.items.length, 2);
  const crammed = Array.from({ length: I.BAG_SLOTS }, (_, k) => ({ entryId: `b${k}`, itemId: 'ore_iron', qty: 99 })); assert.equal(S.take(r.items, crammed, r.items[0].entryId, 1, I.capOf('x')).error, 'BAG_FULL');
  assert.equal(S.take(r.items, r.bag, r.items[0].entryId, 100, I.capOf('x')).error, 'MISSING', '있는 것보다 많이 꺼내기');
});

test('386 창고 모양: 네 단계 크기·문 자리·마당 개수에 안 듦, 큰 집 + 마당 1에서도 네 단계 다 놓을 자리', () => {
  const S4 = Y.STORE; assert.deepEqual(S4.SLOTS, [20, 40, 60, 100]);
  for (let s = 1; s <= 4; s += 1) { const it = Y.ITEMS[`storehouse_${s}`]; assert.equal(Y.shapeOf(S4.idOf(s)), `storehouse_${s}`); assert.ok(it.foot[1] <= 3, '깊이 3 m 이하 (결정 24 A)'); const [, , z0] = [0, 0, -it.foot[1] / 2]; assert.ok(it.door[1] > z0 && it.door[1] < 0, '문 자리는 발자국 앞쪽 안'); }
  assert.equal(Y.counted([{ uid: 'storehouse', id: S4.idOf(1) }, { uid: 'a', id: Y.goodId('bench') }]).length, 1, '창고는 마당 물건 수에 안 듦');
  const lot = Y.lotById('lot5');
  for (const [stage, level] of [[3, 1], [4, 1], [1, 1], [2, 2]]) for (let s = 1; s <= 4; s += 1) {
    const b = Y.boxOf(lot, stage, level); let fits = 0;
    for (let x = b[0]; x <= b[1] && !fits; x += 0.25) for (let z = b[2]; z <= b[3] && !fits; z += 0.25) for (const rot of [0, 1, 2, 3]) if (!Y.placeError({ uid: 'storehouse', id: S4.idOf(s), x: Y.snap(x), z: Y.snap(z), rot }, [], lot, stage, level)) { fits += 1; break; }
    assert.ok(fits, `집 ${stage}단계·마당 ${level}: 창고 ${s}단계 자리`);
  }
  const door = Y.storeDoor(lot, { uid: 'storehouse', id: S4.idOf(1), x: -5, z: 0, rot: 0 }); const w = Y.world(lot, -5, -1.1); assert.ok(Math.hypot(door.x - w.x, door.z - w.z) < 1e-9);
});

test('386 창고 서버: 관공서에서 짓기·넓히기(값, 한 단계 한 번) · 마당에 놓기(개수 밖) · 문 앞에서만 넣고 빼기 · 넓히면 그 자리에서 커짐', { timeout: 120000 }, async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'storehouse-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('창고주인'));
  const key = (await req('/api/admin/keys', server.admin)).data.keys.find((k) => k.label === '창고주인');
  await req(`/api/admin/keys/${key.id}/points`, server.admin, { amount: 3000000, category: 'other', memo: '시험', requestId: crypto.randomUUID() });
  const stand = (x, z) => req('/api/plaza/state', a, { x, z, yaw: 0, moving: false }); const balance = async () => (await req('/api/points', a)).data.balance;
  const lot = Y.lotById('lot5'); const door = T.facilityDoor('townhall'); const ex = T.roomWorld(T.TOWNHALL_ROOM.exit.lx, T.TOWNHALL_ROOM.exit.lz);
  const inHall = async (fn) => { await stand(door.x, door.z); assert.equal((await req('/api/island/townhall/enter', a, {})).status, 200); const r = await fn(); await stand(ex.x, ex.z); await req('/api/island/townhall/leave', a, {}); return r; };
  assert.equal((await req('/api/home/storehouse/build', a, {})).data.error, 'TOO_FAR', '관공서에서만');
  await inHall(async () => { assert.equal((await req('/api/home/storehouse/build', a, {})).data.error, 'NO_HOME'); assert.equal((await req('/api/home/apply', a, { lot: lot.id, roof: 'blue' })).status, 200); });
  let before = await balance(); const built = await inHall(() => req('/api/home/storehouse/build', a, { to: 1 }));
  assert.equal(built.status, 200, JSON.stringify(built.data)); assert.deepEqual([built.data.stage, built.data.slots, before - await balance()], [1, 20, 100000]);
  assert.equal((await req('/api/home', a)).data.storehouse, 1);
  // placed with the yard's request (its uid), not counted; a spot that fits every stage
  const at = (() => { const b = Y.boxOf(lot, 1, 1); for (let x = b[0]; x <= b[1]; x += 0.25) for (let z = b[2]; z <= b[3]; z += 0.25) { const p = { uid: 'storehouse', x: Y.snap(x), z: Y.snap(z), rot: 0 }; if ([1, 2, 3, 4].every((s) => !Y.placeError({ ...p, id: Y.STORE.idOf(s) }, [], lot, 1, 1))) return p; } return null; })();
  assert.ok(at, '네 단계 다 맞는 자리'); const yardSpot = Y.world(lot, at.x, at.z - 2); await stand(yardSpot.x, yardSpot.z);
  const placed = await req('/api/home/yard', a, { uid: 'storehouse', x: at.x, z: at.z, rot: 0 }); assert.equal(placed.status, 200, JSON.stringify(placed.data));
  assert.equal(placed.data.yard.find((p) => p.uid === 'storehouse').id, Y.STORE.idOf(1));
  // things: given, in at the door only
  { const g = await req('/api/test/island/give', a, { itemId: 'crop_carrot', qty: 90 }); assert.equal(g.status, 200, JSON.stringify(g.data)); } const gave = await req('/api/test/island/give', a, { itemId: 'bread', qty: 1 }); assert.equal(gave.status, 200, JSON.stringify(gave.data));
  const bagOf = async () => (await req('/api/island/bag', a)).data; const carrot = (await bagOf()).items.find((e) => e.itemId === 'crop_carrot'); assert.ok(carrot, JSON.stringify(await bagOf()).slice(0, 400));
  await stand(door.x, door.z); assert.equal((await req('/api/home/storehouse/move', a, { dir: 'put', entryId: carrot.entryId, qty: 50 })).data.error, 'TOO_FAR', '문 앞에서만');
  const dd = Y.storeDoor(lot, { ...at, id: Y.STORE.idOf(1) }); await stand(dd.x, dd.z);
  let r = await req('/api/home/storehouse/move', a, { dir: 'put', entryId: carrot.entryId, qty: 50 }); assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual([r.data.storehouse.used, r.data.storehouse.items[0].qty], [1, 50]); assert.equal((await bagOf()).items.filter((e) => e.itemId === 'crop_carrot').reduce((n, e) => n + e.qty, 0), 40);
  const pick = (await bagOf()).items.find((e) => e.itemId === 'bread'); assert.ok(pick, JSON.stringify((await bagOf()).items.map((e) => e.itemId))); assert.equal((await req('/api/home/storehouse/move', a, { dir: 'put', entryId: pick.entryId, qty: 1 })).data.error, 'NOT_KEPT');
  { /* (검토 #4: the same request twice -- its answer lost -- moves once) */ const requestId = crypto.randomUUID(); const body = { dir: 'take', entryId: r.data.storehouse.items[0].entryId, qty: 20, requestId };
    r = await req('/api/home/storehouse/move', a, body); assert.equal(r.status, 200); assert.equal(r.data.storehouse.items[0].qty, 30);
    const twice = await req('/api/home/storehouse/move', a, body); assert.deepEqual([twice.status, twice.data.again, twice.data.storehouse.items[0].qty], [200, true, 30]); }
  assert.equal((await bagOf()).items.filter((e) => e.itemId === 'crop_carrot').reduce((n, e) => n + e.qty, 0), 60);
  // grown at the 관공서: 30만, where it stood, its things kept; the last stage -- no more
  before = await balance(); const grown = await inHall(async () => { const g = await req('/api/home/storehouse/build', a, { to: 2 }); const again = await req('/api/home/storehouse/build', a, { to: 2 }); assert.deepEqual([again.status, again.data.error], [409, 'STALE'], '검토 #1: 같은 단계를 다시 눌러도 다음 단계를 안 삼'); assert.equal((await req('/api/home/storehouse/build', a, {})).data.error, 'STALE', '단계 없는 요청도 거절'); return g; });
  assert.deepEqual([grown.data.stage, grown.data.slots, grown.data.putAway, before - await balance()], [2, 40, false, 300000]);
  const yard = (await req('/api/home', a)).data.lots.find((l) => l.id === lot.id).yard; const s2 = yard.find((p) => p.uid === 'storehouse'); assert.deepEqual([s2.id, s2.x, s2.z], [Y.STORE.idOf(2), at.x, at.z]);
  assert.equal((await req('/api/home/storehouse', a)).data.storehouse.items[0].qty, 30, '넓혀도 물건은 그대로');
  await inHall(async () => { assert.equal((await req('/api/home/storehouse/build', a, { to: 3 })).status, 200); assert.equal((await req('/api/home/storehouse/build', a, { to: 4 })).status, 200); assert.equal((await req('/api/home/storehouse/build', a, { to: 5 })).data.error, 'TOP_STAGE'); });
  const view = (await req('/api/home/storehouse', a)).data.storehouse; assert.deepEqual([view.stage, view.slots, view.next], [4, 100, null]);
  // (검토 #2: a worn house's yard locked -- but its storehouse, put away, placed again: its things in reach)
  await stand(Y.world(lot, at.x, at.z - 2).x, Y.world(lot, at.x, at.z - 2).z); assert.equal((await req('/api/home/yard', a, { uid: 'storehouse', remove: true })).status, 200);
  await req('/api/test/home/farm-time', a, { level: 2 }); /* (낡음) */
  assert.equal((await req('/api/home/yard', a, { uid: 'storehouse', x: at.x, z: at.z, rot: 0 })).data.error, undefined, '접어 둔 창고는 낡음에도 다시 놓음');
  assert.equal((await req('/api/home/yard', a, { uid: 'storehouse', x: at.x, z: at.z, rot: 2 })).data.error, 'HOUSE_WORN', '놓인 창고 옮기기는 다른 마당 물건처럼 잠김');
});
