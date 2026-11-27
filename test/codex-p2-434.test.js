'use strict';
// 1.10.434 Codex 401~432 검토 P2 10건 · P3 1건 수정 검증 (gamecenter-notes docs/codex-review-401-432.md):
// 11. 행사 밭 동시 첫 수확  12. 캐는 중 곡괭이 버림  13. 캐기 실패 작은 돌 공간·횟수·내구도 원자화
// 14. 곡괭이 버림→구매→되돌리기 4개 차단  15. 빠른 칸 잠금 안 재조회  16. 산책 중 가방 펫 버림 해제
// 17. 호랑이 미처리 재시작 복구·건별 갱신  18. 429 롤백 가방 칸 호환
// 19. 택시 건너편 curb 방송·좌표  20. 배 접안·출항 부두 수역 예약  21. 부두 22m 발판 끝 승선 판정
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const I = require('../lib/island-items');
const T = require('../public/plaza/island-terrain');
const Q = require('../public/plaza/island-quarry');
const X = require('../public/plaza/island-taxi');
const B = require('../public/plaza/island-boat');
const { JsonPointStore, PostgresPointStore } = require('../lib/point-store');
const { testDatabase } = require('../test-support/pg-database');
const { boot } = require('../test-support/test-server');

const U = 'guest:00000000-0000-4000-8000-000000000434';
const total = (bag, itemId) => bag.items.filter((e) => e.itemId === itemId).reduce((n, e) => n + e.qty, 0);

async function storeP2Checks(store) {
  const t0 = 1_795_500_000_000;
  // P2-12: islandGive with requireTool: true refuses when tool is missing (no ore without pickaxe!)
  const noPick = await store.islandGive({ userId: U, claimId: 'p2-quarry-nopick-1', itemId: 'ore_iron', qty: 1, wear: 'pickaxe', requireTool: true, quiet: true });
  assert.deepEqual([noPick.applied, noPick.reason], [false, 'no-tool'], '곡괭이 없으면 광석 지급 거절');
  assert.equal(total(await store.islandBag(U), 'ore_iron'), 0);

  // P2-14: own 3 pickaxes -> discard 1 (undo pending) -> buying a 4th during 10 s window is refused ('max'), allowed after expiry!
  for (let k = 0; k < 3; k += 1) {
    assert.equal((await store.islandGive({ userId: U, claimId: `p2-pick-${k}-000001`, itemId: 'pickaxe', qty: 1, quiet: true })).applied, true);
  }
  const bag0 = await store.islandBag(U);
  assert.equal(I.toolCount(bag0.items, 'pickaxe'), 3);
  const pick1 = bag0.items.find((e) => e.itemId === 'pickaxe');
  const disc = await store.islandDiscard({ userId: U, requestId: 'p2-pick-disc-001', entryId: pick1.entryId, qty: 1, now: t0 });
  assert.equal(disc.applied, true);
  assert.equal(I.toolCount(disc.bag.items, 'pickaxe'), 2);
  const buyDuring = await store.islandBuy({ userId: U, requestId: 'p2-pick-buy-0001', itemId: 'pickaxe', qty: 1, unit: 2000, now: t0 + 2000 });
  assert.deepEqual([buyDuring.applied, buyDuring.reason], [false, 'max'], '되돌리기 대기 중 곡괭이 구매 차단(4개 방지)');
  // After 10 s undo window expires, buying the 3rd pickaxe is allowed again
  const buyAfter = await store.islandBuy({ userId: U, requestId: 'p2-pick-buy-0002', itemId: 'pickaxe', qty: 1, unit: 2000, now: t0 + 15000 });
  assert.equal(buyAfter.applied, true, '기한 만료 뒤에는 3개 한도 안 구매 가능');
  assert.equal(I.toolCount(buyAfter.bag.items, 'pickaxe'), 3);
  // And the expired undo can no longer push it to 4
  assert.equal((await store.islandDiscardUndo({ userId: U, undo: disc.undo, now: t0 + 15000 })).applied, false);
}

test('434 Codex P2 저장소(JSON · PostgreSQL): P2-12(곡괭이 필수 차감) · P2-14(복구 대기 도구 구매 상한)', async (t) => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'codex-p2-store-')); rmAtExit(dir);
  const json = new JsonPointStore(path.join(dir, 'points.json'), { initialGrant: 100000 }); await json.init();
  await storeP2Checks(json);
  const database = await testDatabase(); t.after(() => database.stop());
  const pg = new PostgresPointStore(database.url, { initialGrant: 100000 }); t.after(() => pg.pool.end()); await pg.init();
  await storeP2Checks(pg);
});

test('434 Codex P2·P3 순수 규칙: P2-18(롤백 칸) · P2-19(택시 curb) · P2-20(배 수역 예약) · P3-21(22m 부두)', () => {
  // P2-18: bagView & visibleSlots never truncate below actual entry count
  const twenty = [
    ...Array.from({ length: 10 }, (_, k) => ({ entryId: `f${k}`, itemId: 'fish_goby', qty: 1, meta: { sizes: [20] } })),
    ...Array.from({ length: 10 }, (_, k) => ({ entryId: `m${k}`, itemId: `ore_${['granite', 'clay', 'coal', 'iron', 'copper', 'silver', 'crystal', 'gold', 'sandstone', 'tin'][k]}`, qty: 1 })),
  ];
  assert.equal(I.visibleSlots(twenty, 16), 20);
  assert.ok(I.bagView(twenty, Date.now(), null, 16).slots >= 20);

  // P2-19: taxi fleetView includes standing car curb, and curb -1 differs from curb 1
  const fleet = X.createFleet(0);
  fleet.cars[0].at = 'dock'; fleet.cars[0].curb = -1;
  const view = X.fleetView(fleet);
  assert.equal(view.cars[0].curb, -1, '방송에 정차 curb 포함');
  const p1 = X.placeOf('dock', 0, 1); const pm1 = X.placeOf('dock', 0, -1);
  assert.ok(Math.hypot(p1.x - pm1.x, p1.z - pm1.z) > 1, '건너편 curb 좌표 구분');
  const sceneSrc = fs.readFileSync(path.join(__dirname, '../public/plaza/island-taxi-scene.js'), 'utf8');
  assert.match(sceneSrc, /X\.placeOf\(c\.at, c\.place, c\.curb\)/);

  // P2-20: mooring and departing at the same dock cannot overlap
  {
    const f = B.createFleet({ now: 0, scale: 10 });
    const [b1, b2, b3] = f.boats;
    // b3 is waiting offshore at 'dal', b1 is holding at 'dal' ready to depart at t=1000
    b3.at = 'dal'; b3.berth = -1; b3.phase = 'wait'; b3.t0 = 0;
    B.board(f, 'dal', 'rider1', 0); // puts b1 in hold (until = 600)
    // Tick at t=100: b3 starts mooring into UNLOAD_BERTH while b1 is still holding
    B.tick(f, 100);
    assert.equal(b3.phase, 'moor', '대기 배 접안 시작');
    // Tick at t=700 (past b1.until = 600, while b3 is still mooring): b1 must NOT depart yet!
    B.tick(f, 700);
    assert.equal(b1.phase, 'hold', '접안 중에는 같은 부두 배가 출발하지 않음');
    // Once b3 finishes mooring, b1 departs cleanly
    B.tick(f, Math.ceil(b3.until) + 10);
    assert.equal(b1.phase, 'sail', '접안이 끝나면 출발');
    void b2;
  }
  {
    const f = B.createFleet({ now: 0, scale: 10 });
    const [b1, , b3] = f.boats;
    B.board(f, 'dal', 'r1', 0); B.board(f, 'dal', 'r2', 0); B.board(f, 'dal', 'r3', 0); B.board(f, 'dal', 'r4', 0);
    assert.equal(b1.phase, 'sail', 'b1 출발 중');
    b3.at = 'dal'; b3.berth = -1; b3.phase = 'wait'; b3.t0 = 0;
    B.tick(f, 100);
    assert.equal(b3.phase, 'wait', '출항 중인 배가 부두 앞 수역을 비우기 전에는 접안 시작 안 함');
    B.tick(f, Math.ceil(b1.clearAt) + 10);
    assert.equal(b3.phase, 'moor', '출항 배가 빠져나가면 접안 시작');
  }

  // P3-21: 22 m float ends (10 m from float center) are inside nearDock for both dal and byeol
  for (const id of ['dal', 'byeol']) {
    const r = B.ROOTS[id]; const c = Math.cos(r.yaw); const s = Math.sin(r.yaw);
    for (const mx of [-10, 0, 10]) {
      const wx = r.x + mx * c; const wz = r.z - mx * s;
      assert.equal(B.nearDock(id, wx, wz, 2.0), true, `${id} mx=${mx} 화면 승선 가능`);
      assert.equal(B.nearDock(id, wx, wz, 2.5), true, `${id} mx=${mx} 서버 승선 가능`);
    }
    const farX = r.x + 25 * c; const farZ = r.z - 25 * s;
    assert.equal(B.nearDock(id, farX, farZ, 2.5), false, `${id} 먼 곳은 거절`);
  }
});

test('434 Codex P2·P3 서버: P2-11(행사 밭 동시 수확) · P2-12/13(채석장 곡괭이/작은 돌) · P2-15/16(빠른칸·펫) · P2-17(호랑이) · P3-21(부두 끝 승선)', async (t) => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'codex-p2-srv-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('이차손님'));
  const stand = (x, z) => req('/api/plaza/state', a, { x, z, yaw: 0, moving: false });

  // P2-11: Festival harvest concurrent requests -- vegetables granted ALWAYS match daily count!
  await req('/api/test/festival/clock', a, { at: Date.parse('2026-11-22T12:00:00+09:00') }); // 수확제
  await stand(T.FARM.x, T.FARM.z);
  const [h1, h2] = await Promise.all([
    req('/api/island/festival/harvest', a, {}),
    req('/api/island/festival/harvest', a, {}),
  ]);
  assert.deepEqual([h1.status, h2.status], [200, 200]);
  const bagAfterH = (await req('/api/island/bag', a)).data;
  const festAfterH = (await req('/api/island/festival', a)).data.festival;
  const dayHarvests = festAfterH.tasks.find((x) => x.id === 'harvest').today;
  assert.equal(total(bagAfterH, 'harvest'), dayHarvests, '동시 수확 시 채소 개수와 하루 횟수 일치(2개=2회)');

  // P2-13: Quarry miss when gather is full (10/10) while material is empty -> BAG_FULL ('gather'), daily count & pickaxe untouched!
  await req('/api/test/island/give', a, { itemId: 'pickaxe', qty: 1 });
  // Already have 'harvest' in gather (1/10) -> add 9 more distinct gather items to reach 10/10 (leave out 'stone')
  for (const id of ['herb', 'berry', 'mushroom', 'mushroom_blue', 'branch', 'twig', 'clover_four', 'weed', 'mushroom_glow']) {
    assert.equal((await req('/api/test/island/give', a, { itemId: id, qty: 1 })).data.applied, true, id);
  }
  const rock = Q.ROCKS[0]; const qStand = Q.standOf(rock, 'full', 0);
  await stand(qStand.x, qStand.z);
  const qs1 = await req('/api/island/quarry/start', a, { rock: rock.id, spot: 0 });
  assert.equal(qs1.status, 200, JSON.stringify(qs1.data));
  await new Promise((r) => setTimeout(r, Q.MINE_MS + 60));
  const qMissFull = await req('/api/island/quarry/finish', a, { rock: rock.id, spot: 0, requestId: crypto.randomUUID() });
  assert.deepEqual([qMissFull.status, qMissFull.data.error, qMissFull.data.kind], [409, 'BAG_FULL', 'gather'], '채집물 꽉 참 → 작은 돌 못 넣고 BAG_FULL');
  assert.equal((await req('/api/island/quarry', a)).data.daily.n, 0, '하루 횟수 안 오름');
  const pickBefore = (await req('/api/island/bag', a)).data.items.find((e) => e.itemId === 'pickaxe');
  assert.equal(pickBefore.uses, I.TOOL_USES.pickaxe, '곡괭이 내구도 그대로');

  // P2-12: Discard last pickaxe mid-mining -> hit 3/3 -> finish refused with NO_PICKAXE and 0 ore!
  await stand(qStand.x, qStand.z);
  const qs2 = await req('/api/island/quarry/start', a, { rock: rock.id, spot: 0 });
  assert.equal(qs2.status, 200);
  const tStart = Date.now();
  const dPick = await req('/api/island/bag/discard', a, { requestId: 'p2-mid-pick-0001', entryId: pickBefore.entryId, qty: 1 });
  assert.equal(dPick.status, 200);
  for (const [k, p] of qs2.data.plan.entries()) {
    await new Promise((r) => setTimeout(r, Math.max(0, tStart + k * Q.ROUND_MS + p.at + 200 - Date.now())));
    await req('/api/island/quarry/tap', a, { round: k, spot: p.spot, ms: 200 });
  }
  await new Promise((r) => setTimeout(r, Math.max(0, tStart + Q.MINE_MS + 60 - Date.now())));
  const qNoPick = await req('/api/island/quarry/finish', a, { rock: rock.id, spot: 0, requestId: crypto.randomUUID() });
  assert.deepEqual([qNoPick.status, qNoPick.data.error], [409, 'NO_PICKAXE'], '캐는 중 곡괭이 버리면 광석 지급 거절');
  assert.equal((await req('/api/island/bag', a)).data.items.filter((e) => /^(ore|gem)_/.test(e.itemId)).length, 0);

  // P2-16: Walking bag pet discarded -> walking pet cleared in store and presence
  assert.equal((await req('/api/test/island/give', a, { itemId: 'pet_puppy', qty: 1 })).data.applied, true);
  const walkRes = await req('/api/island/pet', a, { kind: 'puppy', name: '초코' });
  assert.equal(walkRes.status, 200); assert.equal(walkRes.data.pet?.kind, 'puppy');
  assert.equal((await req('/api/island/pets', a)).data.pets.some((p) => p.walking), true, '버리기 전 산책 중');
  const petEntry = (await req('/api/island/bag', a)).data.items.find((e) => e.itemId === 'pet_puppy');
  const dPet = await req('/api/island/bag/discard', a, { requestId: 'p2-pet-disc-0001', entryId: petEntry.entryId, qty: 1 });
  assert.equal(dPet.status, 200);
  const myPetsAfter = (await req('/api/island/pets', a)).data;
  assert.equal(myPetsAfter.pets.some((p) => p.walking), false, '가방 펫 버리면 산책 상태도 해제');
  const rawAfterPet = JSON.parse(fs.readFileSync(path.join(dir, 'points.json'), 'utf8'));
  const petDocAfter = Object.entries(rawAfterPet.quests || {}).find(([k]) => k.endsWith(':pet'))?.[1]?.doc;
  assert.equal(petDocAfter?.kind || null, null, '저장소 pet 산책 문서도 함께 해제');
  // Re-acquiring via undo must NOT resurrect stale walking state
  assert.equal((await req('/api/island/bag/discard/undo', a, { undo: dPet.data.undo })).status, 200);
  assert.equal((await req('/api/island/pets', a)).data.pets.some((p) => p.walking), false, '되돌리기 뒤에도 꺼진 산책 유지');

  // P3-21: Board ferry from the far end of the 22 m float (10 m from float center)
  const dal = B.ROOTS.dal; const endX = dal.x + 10 * Math.cos(dal.yaw); const endZ = dal.z - 10 * Math.sin(dal.yaw);
  await stand(endX, endZ);
  await new Promise((r) => setTimeout(r, 3100)); // clear leap guard
  await stand(endX, endZ);
  const boardEnd = await req('/api/island/boat/board', a, { dock: 'dal' });
  assert.equal(boardEnd.status, 200, `22m 발판 끝 승선 성공: ${JSON.stringify(boardEnd.data)}`);

  // P2-15 & P2-17: static verification of atomic quickbar re-read inside worldEdit and tigerPending per-id mutation + retry
  const srvSrc = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.match(srvSrc, /await worldEdit\(async \(\) => \{\s*const cur = IslandItems\.quickSlots\(\(await pointStore\.worldValue\(`quick:\$\{account\}`\)\)/);
  assert.match(srvSrc, /const tigerPendingMutate = \(id, entry\) => worldEdit/);
  assert.match(srvSrc, /tigerResumeTimer = setTimeout/);
});
