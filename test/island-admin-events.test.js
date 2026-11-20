'use strict';
// 364 관리자 「섬 이벤트」 (notes docs/admin-island-events-20261118.md): the form's checks, one kind on one target at a time, the
// largest multiplier (never a product, ×3 at most), 「산 것」 at the base price (the shop's resale loophole), chances at 50 % at most,
// the start and the end by the clock; the admin's API only for the admin
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const A = require('../lib/island-admin-events');
const IslandItems = require('../lib/island-items');
const Fishing = require('../lib/island-fishing');
const Ores = require('../lib/island-ores');
const rmAtExit = require('../test-support/rm-at-exit');
const { boot } = require('../test-support/test-server');

const T0 = Date.UTC(2026, 10, 19, 3, 0, 0);
const open = (raw, list = []) => { const v = A.validate({ minutes: 60, ...raw }, T0, IslandItems.ITEMS); assert.ok(v.event, JSON.stringify(v)); assert.equal(A.overlaps(list, v.event), false); return v.event; };

test('양식: 종류·배수·시간(5분~6시간)·시작(7일 안)·대상·물건, 알림만은 글 필요', () => {
  assert.equal(A.validate({ kind: 'x', minutes: 60 }, T0).error, 'KIND');
  assert.equal(A.validate({ kind: 'sell', target: 'weed', mult: 4, minutes: 60 }, T0).error, 'MULT');
  assert.equal(A.validate({ kind: 'sell', target: 'weed', mult: 2, minutes: 400 }, T0).error, 'TIME');
  assert.equal(A.validate({ kind: 'sell', target: 'weed', mult: 2, minutes: 60, startAt: T0 + 8 * 86400000 }, T0).error, 'START');
  assert.equal(A.validate({ kind: 'sell', target: 'nope', mult: 2, minutes: 60 }, T0).error, 'TARGET');
  assert.equal(A.validate({ kind: 'sell', target: 'item', item: 'no_such', mult: 2, minutes: 60 }, T0, IslandItems.ITEMS).error, 'ITEM');
  assert.equal(A.validate({ kind: 'notice', minutes: 30 }, T0).error, 'TEXT');
  const n = open({ kind: 'notice', text: '대청마당 공연', minutes: 30 }); assert.equal(n.endAt - n.startAt, 30 * 60000); assert.equal(A.labelOf(n), '대청마당 공연');
  assert.equal(A.labelOf(open({ kind: 'sell', target: 'weed', mult: 2 })), '잡초 값 2배');
});

test('겹침: 같은 종류·같은 대상·시간이 겹치면 거절, 대상이 다르거나 시간이 안 겹치면 됨; 알림은 늘 됨', () => {
  const a = open({ kind: 'sell', target: 'ore', mult: 3 });
  assert.equal(A.overlaps([a], A.validate({ kind: 'sell', target: 'ore', mult: 2, minutes: 30, startAt: T0 + 30 * 60000 }, T0).event), true);
  assert.equal(A.overlaps([a], A.validate({ kind: 'sell', target: 'ore', mult: 2, minutes: 30, startAt: T0 + 60 * 60000 }, T0).event), false, '끝난 뒤');
  assert.equal(A.overlaps([a], A.validate({ kind: 'sell', target: 'item', item: 'ore_iron', mult: 2, minutes: 30 }, T0, IslandItems.ITEMS).event), false, '광석 전체 + 철광석 하나는 다른 대상');
  assert.equal(A.overlaps([a], A.validate({ kind: 'catch', target: 'quarry_up', mult: 2, minutes: 30 }, T0).event), false);
  assert.equal(A.overlaps([{ ...a, closedAt: T0 }], A.validate({ kind: 'sell', target: 'ore', mult: 2, minutes: 30 }, T0).event), false, '끝낸 것은 안 셈');
});

test('판매 배수: 가장 큰 것 하나(곱하지 않음, 최대 3), 시작 전·끝난 뒤는 1, 채집물·보석 포함', () => {
  const all = open({ kind: 'sell', target: 'ore', mult: 3 }); const iron = open({ kind: 'sell', target: 'item', item: 'ore_iron', mult: 2 }, [all]);
  assert.equal(A.sellMult([all, iron], 'ore_iron', T0 + 1000), 3, '광석 전체 3 + 철 2 = 3 (6 아님)');
  assert.equal(A.sellMult([iron], 'ore_iron', T0 + 1000), 2); assert.equal(A.sellMult([all], 'fish_carp', T0 + 1000), 1);
  assert.equal(A.sellMult([all], 'ore_iron', T0 + 3600000), 1, '끝');
  const later = A.validate({ kind: 'sell', target: 'weed', mult: 2, minutes: 30, startAt: T0 + 600000 }, T0).event;
  assert.equal(A.sellMult([later], 'weed', T0 + 1000), 1, '예약: 아직'); assert.equal(A.sellMult([later], 'weed', T0 + 600000), 2, '예약: 시작');
  const g = (id) => (['twig', 'mushroom'].includes(id) ? 'gathered' : null); const gath = open({ kind: 'sell', target: 'gathered', mult: 1.5 });
  assert.equal(A.sellMult([gath], 'twig', T0 + 1, g), 1.5); assert.equal(A.sellMult([gath], 'weed', T0 + 1, g), 1);
  const gem = open({ kind: 'sell', target: 'ore', mult: 2, gems: true }); assert.equal(A.sellMult([gem], 'gem_ruby', T0 + 1), 2); assert.equal(A.sellMult([all], 'gem_ruby', T0 + 1), 1, '보석 빼고');
  assert.deepEqual(A.sellTable([all, iron], ['ore_iron', 'weed'], T0 + 1), { ore_iron: 3 });
});

test('사서 팔기 구멍: 잡화점에서 산 것(산 것)은 이벤트 ×3이어도 원래 값 -- 이득 없음; 직접 캔 것은 이벤트 값', () => {
  const base = IslandItems.priceOf('ore_iron', T0); const shopUnit = base * Ores.SHOP_MUL; // (362: the 잡화점 sells at ×3)
  const bag = [{ entryId: 'a', itemId: 'ore_iron', qty: 2, meta: { bought: true } }, { entryId: 'b', itemId: 'ore_iron', qty: 3, meta: null }];
  const r = IslandItems.sellAt(bag, 'merchant', 0, null, T0, 1e9, { ore_iron: 3 });
  const bought = r.sold.find((s) => s.bought); const mine = r.sold.find((s) => !s.bought);
  assert.equal(bought.price, base, '산 것: 원래 값'); assert.equal(mine.price, base * 3, '캔 것: ×3');
  assert.ok(bought.qty * bought.price < bought.qty * shopUnit, '사서 팔면 손해(이득 없음)');
  assert.equal(r.extra, 3 * base * 2); assert.deepEqual(r.extraBy, { ore_iron: 3 * base * 2 });
  const plain = IslandItems.sellAt(bag, 'merchant', 0, null, T0, 1e9); assert.equal(plain.extra, 0); assert.equal(plain.paid, 5 * base, '이벤트 없으면 그대로');
});

test('확률: 배수를 곱하되 최대 50 %; 낚시 대어·드문 것, 채석 위 단계', () => {
  assert.ok(Math.abs(A.chance(0.15, 3) - 0.45) < 1e-9); assert.equal(A.chance(0.3, 3), 0.5); assert.equal(A.chance(0.6, 2), 0.6, '이미 넘은 것은 그대로'); assert.equal(A.chance(0.2, 1), 0.2);
  const ev = open({ kind: 'catch', target: 'fish_rare', mult: 3 }); assert.equal(A.catchMult([ev], 'fish_rare', T0 + 1), 3); assert.equal(A.catchMult([ev], 'insect_rare', T0 + 1), 1);
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const share = (m) => { let rare = 0; let big = 0; const N = 20000; for (let i = 0; i < N; i += 1) { const id = Fishing.draw(rnd, { water: 'sea', season: 'summer', night: false, rareMult: m }); if (Fishing.SPECIES[id].grade === 'rare') rare += 1; if (Fishing.SPECIES[id].grade === 'big') big += 1; } return { rare: rare / N, big: big / N }; };
  const s1 = share(1); const s3 = share(3); assert.ok(s3.rare > s1.rare * 2.2 && s3.rare <= 0.52, `드문 것 ${s1.rare} → ${s3.rare}`); assert.ok(s3.big > s1.big * 2 && s3.big < 0.05, `대어 ${s1.big} → ${s3.big}`);
  /* (379 바위마다 고르게: the event raises a piece's worth as it did -- the old tier-above chance x upMult, at most 50 %) */
  const tier1 = Ores.ORES.find((o) => o.tier === 1).id; const w = (b, up) => Ores.oreWorth(tier1, b, up);
  assert.ok(w(false, 2) > w(false, 1) * 1.15, '×2: 값이 오름 (약 22 %)'); assert.ok(w(true, 3) > w(true, 1), '보너스 ×3');
  assert.ok(Math.abs(w(true, 3) - w(true, 10)) < 1, '보너스 35 % ×3 = 105 %가 아니라 50 %에서 멈춤');
});

test('관리자 API: 관리자만, 열기·겹침 거절·목록·끝내기', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'admin-events-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req, admin } = server; const guest = await server.enter(await server.issue('손님'));
  assert.ok([401, 403].includes((await req('/api/admin/island-events', guest, { kind: 'sell', target: 'weed', mult: 2, minutes: 60 })).status), '손님은 안 됨');
  const a = await req('/api/admin/island-events', admin, { kind: 'sell', target: 'weed', mult: 2, minutes: 60, text: '잡초 값 2배!' }); assert.equal(a.status, 200, JSON.stringify(a.data));
  const ev = a.data.list.find((e) => e.target === 'weed'); assert.equal(ev.label, '잡초 값 2배'); assert.ok(a.data.items.some((x) => x.id === 'weed'));
  assert.equal((await req('/api/admin/island-events', admin, { kind: 'sell', target: 'weed', mult: 3, minutes: 30 })).data.error, 'EVENT_OVERLAP');
  assert.equal((await req('/api/admin/island-events/end', admin, { id: ev.id })).status, 200);
  assert.ok((await req('/api/admin/island-events', admin)).data.list.find((e) => e.id === ev.id).closedAt, '끝냄');
  assert.equal((await req('/api/admin/island-events/end', admin, { id: ev.id })).data.error, 'NO_EVENT');
  /* (383 Codex 371~380 #16: a sale's extra counted once by its request -- the same sale again (a retry) adds nothing to the event's sum) */
  const T = require('../public/plaza/island-terrain.js'); const Store = require('../public/plaza/island-store.js');
  const e2 = await req('/api/admin/island-events', admin, { kind: 'sell', target: 'item', item: 'herb', mult: 2, minutes: 60, text: '약재 값 2배!' }); assert.equal(e2.status, 200, JSON.stringify(e2.data)); const id2 = e2.data.list.find((e) => e.item === 'herb' && !e.closedAt).id;
  await req('/api/test/island/give', guest, { itemId: 'herb', qty: 3 }); const stand = (p) => req('/api/plaza/state', guest, { x: p.x, z: p.z, yaw: 0, moving: false });
  await stand(T.facilityDoor('store')); await req('/api/island/store/enter', guest, {}); await stand(Store.sectorPoint('mall:stall'));
  const sold = await req('/api/island/sell', guest, { place: 'merchant', requestId: 'event-sale-0000-0001' }); assert.equal(sold.status, 200, JSON.stringify(sold.data)); assert.ok(sold.data.extra > 0, JSON.stringify(sold.data));
  const sumOf = async () => (await req('/api/admin/island-events', admin)).data.list.find((e) => e.id === id2).extra; assert.equal(await sumOf(), sold.data.extra);
  await req('/api/island/sell', guest, { place: 'merchant', requestId: 'event-sale-0000-0001' }); assert.equal(await sumOf(), sold.data.extra, '같은 판매 다시: 그대로');
});
