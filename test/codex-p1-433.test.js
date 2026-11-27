'use strict';
// 1.10.433 Codex 401~432 검토 P1 10건 수정 검증 (gamecenter-notes docs/codex-review-401-432.md):
// 1. 가방 버리기 재시도·재시작 되돌리기  2. 혼자 퍼즐 fast 저장 전 거절  3. 곤충 놓아주기 수량 선택·되돌리기
// 4. 옛 가방 늘리기 결제 전 거절(이력 유지)  5. 수조 오래된 넣기 재도착 복사 차단  6. 초과 보유자 버리기 되돌리기
// 7. 바구니·상자 구매 원자화 + 재시작 자동 복구  8. 마당 잡초 원자적 제거·지급
// 9. 택시 승차권 영구 사용 전환·경로/금액 대조  10. 숫자 밀기 저장 실패 시 판 유지·재시도
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const I = require('../lib/island-items');
const T = require('../public/plaza/island-terrain');
const H = require('../public/plaza/island-home');
const X = require('../public/plaza/island-taxi');
const { JsonPointStore, PostgresPointStore } = require('../lib/point-store');
const { testDatabase } = require('../test-support/pg-database');
const { boot } = require('../test-support/test-server');

const U = 'guest:00000000-0000-4000-8000-000000000433';
const V = 'guest:00000000-0000-4000-8000-000000000434';
const total = (bag, itemId) => bag.items.filter((e) => e.itemId === itemId).reduce((n, e) => n + e.qty, 0);

async function storeP1Checks(store) {
  // P1-1 & P1-3: discard & release idempotency (same requestId returns original undo token; insect release defaults to 1, respects qty, supports undo)
  await store.islandGive({ userId: U, claimId: 'p1-give-herb-01', itemId: 'herb', qty: 20, quiet: true });
  await store.islandGive({ userId: U, claimId: 'p1-give-bug-001', itemId: 'insect_ladybird', qty: 20, quiet: true });
  let bag = await store.islandBag(U);
  const herb = bag.items.find((e) => e.itemId === 'herb');
  const t0 = 1_795_000_000_000;
  const d1 = await store.islandDiscard({ userId: U, requestId: 'p1-disc-00000001', entryId: herb.entryId, qty: 5, now: t0 });
  assert.equal(d1.applied, true); assert.ok(d1.undo); assert.equal(total(d1.bag, 'herb'), 15);
  const d1Retry = await store.islandDiscard({ userId: U, requestId: 'p1-disc-00000001', entryId: herb.entryId, qty: 5, now: t0 + 1000 });
  assert.deepEqual([d1Retry.applied, d1Retry.already, d1Retry.undo, d1Retry.until], [false, true, d1.undo, d1.until], '재시도에도 같은 되돌리기 토큰 반환');
  assert.equal(total(d1Retry.bag, 'herb'), 15, '두 번 차감 안 됨');
  assert.equal((await store.islandDiscardUndo({ userId: V, undo: d1.undo, now: t0 + 2000 })).applied, false, '남의 되돌리기 불가');
  const u1 = await store.islandDiscardUndo({ userId: U, undo: d1.undo, now: t0 + 2000 });
  assert.equal(u1.applied, true); assert.equal(total(u1.bag, 'herb'), 20);
  assert.equal((await store.islandDiscardUndo({ userId: U, undo: d1.undo, now: t0 + 3000 })).applied, false, '되돌리기 두 번 불가');
  const d1AfterUndo = await store.islandDiscard({ userId: U, requestId: 'p1-disc-00000001', entryId: herb.entryId, qty: 5, now: t0 + 3000 });
  assert.equal(d1AfterUndo.undone, true);

  // P1-3: insect stack release (chosen qty, default 1, undoable)
  bag = await store.islandBag(U);
  const bug = bag.items.find((e) => e.itemId === 'insect_ladybird');
  const rel1 = await store.islandRelease({ userId: U, requestId: 'p1-rel-00000001', entryId: bug.entryId, qty: 4, now: t0 });
  assert.equal(rel1.applied, true); assert.equal(total(rel1.bag, 'insect_ladybird'), 16, '20마리 중 4마리만 놓아줌');
  assert.ok(rel1.undo);
  const relDefault = await store.islandRelease({ userId: U, entryId: bug.entryId, now: t0 });
  assert.equal(relDefault.applied, true); assert.equal(total(relDefault.bag, 'insect_ladybird'), 15, '개수 생략 시 1마리만');
  const relUndo = await store.islandDiscardUndo({ userId: U, undo: rel1.undo, now: t0 + 1000 });
  assert.equal(relUndo.applied, true); assert.equal(total(relUndo.bag, 'insect_ladybird'), 19);

  // P1-6: account holding 12 fish (over 430's 10 default cap) discards 1 -> 11 -> immediate undo restores to 12!
  const prevBoxHook = I.boxOf;
  I.setBoxHook((uid, kind) => (uid === V && kind === 'fish' ? 50 : null));
  for (let k = 0; k < 12; k += 1) {
    assert.equal((await store.islandGive({ userId: V, claimId: `p1-fish-over-${String(k).padStart(2, '0')}`, itemId: 'fish_carp', qty: 1, meta: { size: 30 + k }, quiet: true })).applied, true);
  }
  I.setBoxHook(() => null); // now V has 12 fish with default 10 cap (just like 429 -> 430 overflow)
  const vBag = await store.islandBag(V);
  assert.equal(total(vBag, 'fish_carp'), 12);
  const targetFish = vBag.items.find((e) => e.itemId === 'fish_carp' && e.sizes?.[0] === 41);
  const dFish = await store.islandDiscard({ userId: V, requestId: 'p1-fish-disc-001', entryId: targetFish.entryId, qty: 1, now: t0 });
  assert.equal(dFish.applied, true); assert.equal(total(dFish.bag, 'fish_carp'), 11);
  const uFish = await store.islandDiscardUndo({ userId: V, undo: dFish.undo, now: t0 + 1000 });
  assert.equal(uFish.applied, true, '10칸 초과 보유자도 버리기 직전 수량(12)까지 복원');
  assert.equal(total(uFish.bag, 'fish_carp'), 12);
  assert.ok(uFish.bag.items.some((e) => e.itemId === 'fish_carp' && e.sizes?.[0] === 41), '물고기 크기 보존');
  // Normal cap user: cannot exploit discard + catch + undo to exceed 10
  for (let k = 0; k < 10; k += 1) {
    assert.equal((await store.islandGive({ userId: U, claimId: `p1-fish-cap-${String(k).padStart(2, '0')}`, itemId: 'fish_goby', qty: 1, meta: { size: 15 }, quiet: true })).applied, true);
  }
  const uFishOne = (await store.islandBag(U)).items.find((e) => e.itemId === 'fish_goby');
  const uDisc = await store.islandDiscard({ userId: U, requestId: 'p1-fish-cap-d001', entryId: uFishOne.entryId, qty: 1, now: t0 });
  assert.equal(uDisc.applied, true);
  assert.equal((await store.islandGive({ userId: U, claimId: 'p1-fish-cap-fill', itemId: 'fish_goby', qty: 1, meta: { size: 16 }, quiet: true })).applied, true);
  const uFull = await store.islandDiscardUndo({ userId: U, undo: uDisc.undo, now: t0 + 1000 });
  assert.deepEqual([uFull.applied, uFull.reason], [false, 'full'], '빈칸이 다른 물고기로 채워지면 10칸 넘기지 않음');

  // P1-7: growBox commits charge + boxSlots together atomically
  const g = await store.growBox({ userId: U, kind: 'gather', to: 50, price: 300000, title: '잡화점 · 채집 바구니 50칸' });
  assert.deepEqual([g.applied, g.slots], [true, 50]);
  assert.equal((await store.worldValue('boxSlots'))?.[U]?.gather, 50, '결제와 통 확장이 한 거래로 저장됨');
  assert.ok((await store.paidBoxClaims()).some((c) => c.userId === U && c.kind === 'gather' && c.to === 50));

  // P1-8: pullYardWeed atomic -- when puller's gather section is full, weed stays in owner's yard
  await store.questApply(V, 'upkeep', () => ({ doc: { since: '2026-11-23', weeds: { day: '2026-11-28', list: [{ id: 'yw-1', lx: 1, lz: 1 }] } } }));
  const gatherKinds = ['berry', 'mushroom', 'mushroom_blue', 'branch', 'twig', 'clover_four', 'harvest', 'stone', 'mushroom_glow'];
  // U already has herb (1) -> add 9 more distinct gather items to fill 10/10 (boxSlots hook is off so cap is 10)
  for (const id of gatherKinds) assert.equal((await store.islandGive({ userId: U, claimId: `p1-gfill-${id}`, itemId: id, qty: 1, quiet: true })).applied, true);
  const fullWeed = await store.pullYardWeed({ owner: V, userId: U, claimId: 'yardweed:lot1:yw-1', weedId: 'yw-1' });
  assert.deepEqual([fullWeed.applied, fullWeed.reason], [false, 'full']);
  assert.equal(((await store.questDoc(V, 'upkeep')).doc.weeds.list || []).length, 1, '가방 가득이면 마당 잡초가 그대로 남음');
  // Free one slot in gather -> pull succeeds atomically
  const stone = (await store.islandBag(U)).items.find((e) => e.itemId === 'stone');
  assert.equal((await store.islandDiscard({ userId: U, requestId: 'p1-free-stone-01', entryId: stone.entryId, qty: 1, now: t0 })).applied, true);
  const okWeed = await store.pullYardWeed({ owner: V, userId: U, claimId: 'yardweed:lot1:yw-1', weedId: 'yw-1' });
  assert.equal(okWeed.applied, true);
  assert.equal(((await store.questDoc(V, 'upkeep')).doc.weeds.list || []).length, 0);
  assert.equal(total(okWeed.bag, 'weed'), 1);

  // P1-9: taxi ticket binds route + price + unused->used transition once
  const taxiClaim = `taxi:${U}:p1-taxi-00000001`;
  const ch = await store.charge({ userId: U, claimId: taxiClaim, price: 1500, title: '섬 택시', meta: { from: 'plaza', to: 'isle' } });
  assert.equal(ch.applied, true);
  const now = Date.parse(ch.at) + 1000;
  assert.equal((await store.useTaxiTicket({ userId: U, claimId: taxiClaim, from: 'plaza', to: 'museum', price: 1500, now })).applied, false, '도착지 다르면 거절');
  assert.equal((await store.useTaxiTicket({ userId: U, claimId: taxiClaim, from: 'plaza', to: 'isle', price: 3000, now })).applied, false, '금액 다르면 거절');
  assert.equal((await store.useTaxiTicket({ userId: V, claimId: taxiClaim, from: 'plaza', to: 'isle', price: 1500, now })).applied, false, '다른 계정 거절');
  assert.equal((await store.useTaxiTicket({ userId: U, claimId: taxiClaim, from: 'plaza', to: 'isle', price: 1500, now })).applied, true, '일치하면 1회 사용 전환');
  assert.equal((await store.useTaxiTicket({ userId: U, claimId: taxiClaim, from: 'plaza', to: 'isle', price: 1500, now: now + 1000 })).applied, false, '사용 완료 후 재사용 불가');
}

test('433 Codex P1 저장소(JSON · PostgreSQL): 버리기·놓아주기·초과복원·통원자화·마당잡초·택시승차권', async (t) => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'codex-p1-store-')); rmAtExit(dir);
  const json = new JsonPointStore(path.join(dir, 'points.json'), { initialGrant: 500000 }); await json.init();
  await storeP1Checks(json);
  const database = await testDatabase(); t.after(() => database.stop());
  const pg = new PostgresPointStore(database.url, { initialGrant: 500000 }); t.after(() => pg.pool.end()); await pg.init();
  await storeP1Checks(pg);
});

test('433 Codex P1 서버: 재시작 뒤 버리기 되돌리기 · 택시 재사용 차단 · 바구니 미완료 복구 · 옛 가방 거절', async (t) => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'codex-p1-restart-')); rmAtExit(dir);
  let server = await boot(t, dir);
  const key = await server.issue('재시작손님');
  let a = await server.enter(key);
  await server.req('/api/test/points-credit', a, { amount: 500000 });
  await server.req('/api/test/island/give', a, { itemId: 'herb', qty: 10 });
  const herb = (await server.req('/api/island/bag', a)).data.items.find((e) => e.itemId === 'herb');
  // P1-1: discard -> retry returns same undo -> restart -> undo still succeeds!
  const d1 = await server.req('/api/island/bag/discard', a, { requestId: 'srv-disc-00000001', entryId: herb.entryId, qty: 4 });
  assert.equal(d1.status, 200); assert.ok(d1.data.undo);
  const d2 = await server.req('/api/island/bag/discard', a, { requestId: 'srv-disc-00000001', entryId: herb.entryId, qty: 4 });
  assert.deepEqual([d2.status, d2.data.already, d2.data.undo], [200, true, d1.data.undo]);
  assert.equal(total(d2.data.bag, 'herb'), 6);
  // P1-9: taxi ride -> restart within 10 min -> replay same requestId MUST be refused!
  const P = X.stopOf('plaza');
  await server.req('/api/plaza/state', a, { x: P.out.x, z: P.out.z, yaw: 0, moving: false });
  const taxiBody = { from: 'plaza', to: 'isle', pay: 'fare', requestId: 'srv-taxi-00000001' };
  const ride1 = await server.req('/api/island/taxi', a, taxiBody);
  assert.equal(ride1.status, 200, JSON.stringify(ride1.data));

  await server.stop();

  // Also seed pre-433 data on disk before restart:
  // (a) legacy bagSlots = 24 (P1-4), and (b) paid box claim without boxSlots written (P1-7 startup recovery)
  const pFile = path.join(dir, 'points.json');
  const raw = JSON.parse(fs.readFileSync(pFile, 'utf8'));
  const accountId = Object.keys(raw.accounts).find((k) => k.startsWith('guest:'));
  raw.island ||= { bags: {}, days: {}, world: {} }; raw.island.world ||= {};
  raw.island.world.bagSlots = { ...(raw.island.world.bagSlots || {}), [accountId]: 24 };
  raw.settlements[`bag:materialbox:50:${accountId}`] = { kind: 'bag', settlementId: `bag:materialbox:50:${accountId}`, gameType: 'bag', at: new Date().toISOString(), userId: accountId, price: 300000, summary: { kind: 'bag', title: '잡화점 · 재료 상자 50칸' } };
  // Verify undo token was persisted on disk with exact 10 s window, then extend `until` before slow test boot so CI load never flakes
  const persistedUndo = raw.settlements[`island_discard_undo:${d1.data.undo}`];
  assert.ok(persistedUndo && persistedUndo.used === false, '되돌리기 토큰이 디스크에 영구 저장됨');
  assert.equal(persistedUndo.until - persistedUndo.atMs, 10000, '10초 기한 저장');
  persistedUndo.until = Date.now() + 120000;
  fs.writeFileSync(pFile, JSON.stringify(raw));

  server = await boot(t, dir);
  a = await server.enter(key);
  // P1-1 after restart: undo still restores the 4 herbs!
  const u = await server.req('/api/island/bag/discard/undo', a, { undo: d1.data.undo });
  assert.equal(u.status, 200, JSON.stringify(u.data)); assert.equal(total(u.data.bag, 'herb'), 10);
  // P1-7 startup heal: material box automatically healed to 50 on restart!
  const bagAfter = (await server.req('/api/island/bag', a)).data;
  assert.equal(bagAfter.sections.material.slots, 50, '미완료 재료 상자 구매 재시작 시 자동 복구');
  assert.equal(bagAfter.sections.gather.slots, 50, '기존 24칸 이력의 무료 채집 바구니 50칸 유지');
  assert.equal(bagAfter.grow, null);
  // P1-4: calling /api/island/bag/grow refuses BEFORE charging 150,000P
  await server.req('/api/plaza/state', a, { ...T.facilityDoor('store'), yaw: 0, moving: false });
  assert.equal((await server.req('/api/island/store/enter', a, {})).status, 200);
  const balBefore = (await server.req('/api/points', a)).data.balance;
  const oldGrow = await server.req('/api/island/bag/grow', a, {});
  assert.deepEqual([oldGrow.status, oldGrow.data.error], [409, 'BAG_RETIRED']);
  assert.equal((await server.req('/api/points', a)).data.balance, balBefore, '15만P 차감 없음');
  await server.req('/api/plaza/state', a, { ...require('../public/plaza/island-store').world(require('../public/plaza/island-store').ROOM.exit.lx, require('../public/plaza/island-store').ROOM.exit.lz), yaw: 0, moving: false });
  await server.req('/api/island/store/leave', a, {});
  // P1-9 after restart: replaying used taxi requestId within 10 min is refused!
  await server.req('/api/plaza/state', a, { x: P.out.x, z: P.out.z, yaw: 0, moving: false });
  const rideReplay = await server.req('/api/island/taxi', a, taxiBody);
  assert.deepEqual([rideReplay.status, rideReplay.data.error], [409, 'TAXI_PRICE'], '재시작 후 쓴 승차권 재사용 불가');
});

test('433 Codex P1 서버: P1-2(사과 게임 fast 순위 차단) · P1-5(수조 만료 뒤 복사 차단) · P1-10(숫자 밀기 저장 실패 재시도)', async (t) => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'codex-p1-misc-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const key = await server.issue('검증손님');
  const a = await server.enter(key);
  await req('/api/test/points-credit', a, { amount: 200000 });

  // P1-2: apple10 score 100 in 5s (> 4 pts/s -> fast) is rejected BEFORE soloClear -- never enters personal best or weekly board!
  const fastRun = (await req('/api/solo/reflex/start', a, { game: 'apple10', level: 'normal' })).data.id;
  await req('/api/test/reflex/age', a, { id: fastRun, ageMs: 5000 });
  const fastOut = await req('/api/solo/reflex/finish', a, { id: fastRun, score: 100 });
  assert.deepEqual([fastOut.status, fastOut.data.error, fastOut.data.verdict], [400, 'TOO_FAST', 'fast']);
  assert.deepEqual((await req('/api/solo/reflex', a)).data.records.apple10, {}, 'fast 기록은 개인 최고에 저장 안 됨');
  const board = (await req('/api/solo/board', a)).data.games.find((g) => g.game === 'apple10');
  assert.deepEqual(board.top, [], 'fast 기록은 주간 순위에 오르지 않음');

  // P1-10: slide puzzle finish fails transiently on soloClear -> run stays open -> retry succeeds -> same score idempotent, other score 409
  const slideRun = (await req('/api/solo/reflex/start', a, { game: 'slide', level: 'normal' })).data.id;
  await req('/api/test/reflex/age', a, { id: slideRun, ageMs: 35000 });
  await req('/api/test/store/fail', null, { method: 'soloClear' });
  const fail1 = await req('/api/solo/reflex/finish', a, { id: slideRun, score: 30000 });
  assert.deepEqual([fail1.status, fail1.data.error], [503, 'TRY_LATER'], '저장 실패 시 503으로 재시도 허용');
  const retryOk = await req('/api/solo/reflex/finish', a, { id: slideRun, score: 30000 });
  assert.deepEqual([retryOk.status, retryOk.data.verdict, retryOk.data.best], [200, 'ok', 30000], '저장소 회복 후 같은 판 ID 재전송 성공');
  const idem = await req('/api/solo/reflex/finish', a, { id: slideRun, score: 30000 });
  assert.deepEqual([idem.status, idem.data.best], [200, 30000], '완료된 판 같은 점수 재전송은 저장된 결과 반환');
  assert.equal((await req('/api/solo/reflex/finish', a, { id: slideRun, score: 25000 })).status, 409, '다른 점수는 거절');

  // P1-5: fish tank put -> take out -> simulate tankPuts eviction (7 days / 300 cap) -> replay old put -> NO duplicate fish!
  const stand = (x, z) => req('/api/plaza/state', a, { x, z, yaw: 0, moving: false });
  const door = T.facilityDoor('townhall'); await stand(door.x, door.z); assert.equal((await req('/api/island/townhall/enter', a, {})).status, 200);
  const lot = H.LOTS[6]; assert.equal((await req('/api/home/apply', a, { lot: lot.id, roof: 'blue' })).status, 200);
  const ex = T.roomWorld(T.TOWNHALL_ROOM.exit.lx, T.TOWNHALL_ROOM.exit.lz); await stand(ex.x, ex.z); await req('/api/island/townhall/leave', a, {});
  const [tank] = (await req('/api/test/home/furniture', a, { ids: ['fish_tank__oak'] })).data.pieces;
  await req('/api/test/island/give', a, { itemId: 'fish_goby', qty: 1, meta: { size: 22 } });
  const d = H.doorOf(lot, 1); await stand(d.x, d.z); assert.equal((await req('/api/home/enter', a, { lot: lot.id })).status, 200);
  assert.equal((await req('/api/home/place', a, { uid: tank.uid, x: 2, z: 2, rot: 0 })).status, 200);
  const oldReq = 'tank-evict-00001';
  assert.equal((await req('/api/home/tank', a, { tank: tank.uid, put: 'fish_goby', requestId: oldReq })).status, 200);
  const fid = (await req('/api/home/inside', a)).data.home.tanks[tank.uid][0].fid;
  assert.equal((await req('/api/home/tank', a, { tank: tank.uid, take: fid, requestId: 'tank-evict-00002' })).status, 200);
  // Stop server, delete tankPuts from saved home (simulating 7-day / 300-put eviction), reboot and replay oldReq!
  await server.stop();
  const pFile = path.join(dir, 'points.json');
  const raw = JSON.parse(fs.readFileSync(pFile, 'utf8'));
  for (const [k, v] of Object.entries(raw.island?.world || {})) if (k.startsWith('home:') && v?.tankPuts) delete v.tankPuts;
  fs.writeFileSync(pFile, JSON.stringify(raw));

  const server2 = await boot(t, dir);
  const a2 = await server2.enter(key);
  await server2.req('/api/plaza/state', a2, { x: d.x, z: d.z, yaw: 0, moving: false });
  assert.equal((await server2.req('/api/home/enter', a2, { lot: lot.id })).status, 200);
  const replay = await server2.req('/api/home/tank', a2, { tank: tank.uid, put: 'fish_goby', requestId: oldReq });
  assert.equal(replay.status, 200, JSON.stringify(replay.data));
  assert.deepEqual(replay.data.home.tanks[tank.uid], [], 'tankPuts가 밀려난 뒤에도 예전 넣기 재도착 시 물고기 복사 없음');
  assert.equal(total((await server2.req('/api/island/bag', a2)).data, 'fish_goby'), 1, '가방의 물고기 1마리 그대로');
});
