'use strict';
// v1.10.225 마당 꾸미기 (public/plaza/island-yard.js, docs/yard-20261102.md): a yard piece in the yard only (its box, clear of
// the house, the door's way, the ground's edge and the other pieces -- fences sharing their posts), the count a level
// holds (24 / 40 / 60), furniture and yard pieces never mixed, the yard made bigger at the 관공서 (its prices), a lot
// given up sends the pieces back to the 가구 창고 and keeps the level, a bigger house sends back the ones it stands on
// (and a note says so). Pure rules and the server.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { boot } = require('../test-support/test-server');
const Y = require('../public/plaza/island-yard');
const F = require('../public/plaza/island-furniture');
const T = require('../public/plaza/island-terrain');

const lot = Y.lotById('lot5'); const id = (shape) => Y.goodId(shape);

test('마당 규칙: 칸 안/밖·집·현관 길·겹침·울타리 기둥 맞춤·0.25 m 칸, 넓히면 더 멀리', () => {
  const bench = { uid: 'b', id: id('bench'), x: -5, z: 0, rot: 1 };
  assert.equal(Y.placeError(bench, [], lot, 1, 1), null, '집 옆 처음 마당');
  assert.equal(Y.placeError({ ...bench, x: 0, z: 0 }, [], lot, 1, 1), '집에 너무 붙었어요.');
  assert.equal(Y.placeError({ ...bench, x: 0, z: -4, rot: 0 }, [], lot, 1, 1), '현관에서 길까지는 비워 둬요.');
  assert.equal(Y.placeError({ ...bench, x: -5.1, z: 0 }, [], lot, 1, 1), '자리를 확인해 주세요.', '0.25 m 칸에만');
  assert.equal(Y.placeError({ ...bench, x: 3, z: 2.75 }, [], lot, 1, 1), '집에 너무 붙었어요.');
  // the back: 2.5 m out at first, 6 m once made bigger twice
  const far = { uid: 'f', id: id('lantern_stone'), x: 0, z: 7.5, rot: 0 };
  assert.equal(Y.placeError(far, [], lot, 1, 1), '마당 칸 밖이에요.'); assert.equal(Y.placeError(far, [], lot, 1, 3), null);
  assert.ok(Y.areaOf(lot, 1, 1) < Y.areaOf(lot, 1, 2) && Y.areaOf(lot, 1, 2) < Y.areaOf(lot, 1, 3));
  // overlapping: no -- but fences end to end and at a corner share their posts
  const fa = { uid: 'fa', id: id('fence_wood'), x: -4, z: 1, rot: 0 }; const fb = { uid: 'fb', id: id('fence_stone'), x: -4.5, z: 1.5, rot: 1 };
  assert.equal(Y.placeError(fb, [fa], lot, 1, 1), null, '울타리끼리 모서리');
  assert.equal(Y.placeError({ ...bench, x: -4, z: 1, rot: 0 }, [fa], lot, 1, 1), '다른 물건과 겹쳐요.');
  assert.equal(Y.placeError({ uid: 'x', id: 'sofa__mint', x: -5, z: 0, rot: 0 }, [], lot, 1, 1), '마당 물건이 아니에요.');
  // the way in, its walk and the neighbours': never in a yard, whatever the level
  for (const l of Y.LOTS) for (const st of [1, 2, 3]) {
    const b = Y.boxOf(l, st, 3);
    for (let lx = b[0]; lx < b[1]; lx += 0.5) for (let lz = b[2]; lz < b[3]; lz += 0.5) {
      if (!Y.usable(l, st, 3, lx, lz)) continue; const w = Y.world(l, Math.round(lx * 8) / 8, Math.round(lz * 8) / 8);
      assert.ok(T.walkDist(w.x, w.z) >= 0.4 && !(Math.abs(lx) < Y.PATH && lz <= Y.FOOT[st][2]), `${l.id} ${st}단계 (${lx}, ${lz})`);
      assert.ok(!Y.LOTS.some((o) => o.id !== l.id && Math.hypot(w.x - o.x, w.z - o.z) < Math.hypot(w.x - l.x, w.z - l.z)), `${l.id}: 이웃 집터 쪽`);
    }
  }
  // the arch blocks at its two posts only; the stepping stones not at all; a bench's two seats
  assert.equal(Y.solidsOf(lot, { id: id('arch'), x: -5, z: 0, rot: 0 }).length, 2); assert.equal(Y.solidsOf(lot, { id: id('stepping_stones'), x: -5, z: 0, rot: 0 }).length, 0);
  assert.equal(Y.seatsOf(lot, bench).length, 2); assert.equal(Y.limitOf(1), 24); assert.equal(Y.limitOf(2), 40); assert.equal(Y.limitOf(3), 60);
  // the shop: all twelve on the 「마당」 shelf, each its own place
  assert.equal(F.YARD_SLOTS.length, 12); assert.ok(F.YARD_SLOTS.every((s) => F.placeAt(F.world(s.lx, s.lz).x, F.world(s.lx, s.lz).z).id === s.id));
});

test('마당 서버: 사기 → 마당에 놓기(개수 24·넓히기 40) · 집 안↔마당 섞기 막음 · 넓히기 값 · 벤치 앉기 · 집 넓히면 걸린 것 창고로·쪽지 · 집터 풀면 창고로·단계는 남음', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'yard-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('마당주인'));
  const key = (await req('/api/admin/keys', server.admin)).data.keys.find((k) => k.label === '마당주인');
  await req(`/api/admin/keys/${key.id}/points`, server.admin, { amount: 2000000, category: 'other', memo: '시험', requestId: crypto.randomUUID() });
  const stand = (x, z) => req('/api/plaza/state', a, { x, z, yaw: 0, moving: false });
  const balance = async () => (await req('/api/points', a)).data.balance;
  // the 3층's 「마당」 shelf: the arch, at its price, into the 가구 창고
  const shelf = F.YARD_SLOTS.find((s) => s.good === id('arch')); const view = (await req('/api/island/furniture', a)).data; assert.equal(view.yard.find((d) => d.slot === shelf.id).price, 20000);
  // the house: from the 민원실
  const door = T.facilityDoor('townhall'); await stand(door.x, door.z); assert.equal((await req('/api/island/townhall/enter', a, {})).status, 200);
  assert.equal((await req('/api/home/yard/grow', a, {})).data.error, 'NO_HOME', '집이 없으면 못 넓힘');
  const applied = await req('/api/home/apply', a, { lot: lot.id, roof: 'red' }); assert.equal(applied.status, 200, JSON.stringify(applied.data));
  const ex = T.roomWorld(T.TOWNHALL_ROOM.exit.lx, T.TOWNHALL_ROOM.exit.lz); await stand(ex.x, ex.z); assert.equal((await req('/api/island/townhall/leave', a, {})).status, 200);
  // pieces straight into the 가구 창고 (the shop's own buying: island-furniture / e2e)
  const pieces = (await req('/api/test/home/furniture', a, { ids: [...Array(25)].map(() => id('fence_wood')).concat([id('bench'), 'sofa__mint']) })).data.pieces;
  const fences = pieces.filter((p) => p.id === id('fence_wood')); const bench = pieces.find((p) => p.id === id('bench')); const sofa = pieces.find((p) => p.id === 'sofa__mint');
  const put = (p, x, z, rot = 0) => req('/api/home/yard', a, { uid: p.uid, x, z, rot });
  const yardSpot = Y.world(lot, -5, 0);
  assert.equal((await put(bench, -5, 0, 1)).data.error, 'TOO_FAR', '내 마당에 서야');
  await stand(yardSpot.x, yardSpot.z);
  assert.equal((await put(sofa, -5, 0)).data.error, 'NOT_YARD', '집 안 가구는 마당에 못 놓음');
  const placed = await put(bench, -5, 0, 1); assert.equal(placed.status, 200, JSON.stringify(placed.data));
  assert.equal((await put(fences[0], 0, -4)).data.error, 'BAD_PLACE');
  // 24 at first: the fences round the back and sides till the yard is full
  const spots = []; const b = Y.boxOf(lot, 1, 1);
  for (let lz = 3; lz < b[3]; lz += 0.5) /* (from just behind the hut outward) */ for (let lx = b[0] + 0.5; lx < b[1] - 0.5; lx += 1) spots.push([Y.snap(lx), Y.snap(lz)]);
  let n = 1; const ok = [];
  for (const f of fences) { for (const [lx, lz] of spots) { if (ok.some(([x, z]) => x === lx && z === lz)) continue; const p = { uid: f.uid, id: f.id, x: lx, z: lz, rot: 0 }; if (Y.placeError(p, [], lot, 1, 1)) continue; const r = await put(f, lx, lz); if (r.status === 200) { ok.push([lx, lz]); n += 1; break; } if (r.data.error === 'TOO_MANY') { break; } } if (n >= 24) break; }
  assert.equal(n, 24, '처음 24개까지 놓을 자리');
  const last = fences[fences.length - 1]; const free = spots.find(([x, z]) => !ok.some(([ox, oz]) => ox === x && oz === z) && !Y.placeError({ uid: 'z', id: id('fence_wood'), x, z, rot: 0 }, [], lot, 1, 1));
  assert.equal((await put(last, free[0], free[1])).data.error, 'TOO_MANY', '25개째는 안 됨');
  // indoors: a yard piece never
  const H = require('../public/plaza/island-home'); const d = H.doorOf(H.lotById(lot.id), 1); await stand(d.x, d.z);
  assert.equal((await req('/api/home/enter', a, { lot: lot.id })).status, 200);
  assert.equal((await req('/api/home/place', a, { uid: last.uid, x: 0, z: 0, rot: 0 })).data.error, 'YARD_PIECE', '마당 물건은 집 안에 못 놓음');
  const en = H.entryOf(1); const way = H.world(H.lotById(lot.id), en[0], en[1] - 0.6); await stand(way.x, way.z); assert.equal((await req('/api/home/leave', a, {})).status, 200);
  // made bigger at the 관공서: 100,000 then 200,000, at once -- 40 then
  await stand(door.x, door.z); assert.equal((await req('/api/island/townhall/enter', a, {})).status, 200);
  let before = await balance(); let g = await req('/api/home/yard/grow', a, {}); assert.equal(g.status, 200, JSON.stringify(g.data)); assert.deepEqual([g.data.yardLevel, g.data.limit, before - await balance()], [2, 40, 100000]);
  before = await balance(); g = await req('/api/home/yard/grow', a, {}); assert.deepEqual([g.data.yardLevel, g.data.limit, before - await balance()], [3, 60, 200000]);
  assert.equal((await req('/api/home/yard/grow', a, {})).data.error, 'TOP_LEVEL');
  await stand(ex.x, ex.z); await req('/api/island/townhall/leave', a, {}); await stand(yardSpot.x, yardSpot.z);
  assert.equal((await put(last, free[0], free[1])).status, 200, '넓힌 뒤 25개째');
  // everyone sees it: the lots' list; a bench sat on
  const lots = (await req('/api/home', a)).data; const mine = lots.lots.find((l) => l.id === lot.id); assert.equal(mine.yard.length, 25); assert.equal(lots.yardLevel, 3);
  const seat = Y.seatsOf(lot, { ...placed.data.yard[0] })[0]; await stand(seat.x, seat.z + 0.5);
  assert.equal((await req('/api/island/sit', a, { seat: seat.id })).status, 200, '벤치 앉기'); await req('/api/island/stand', a, {});
  // a bigger house (the 작은 집): what it now stands on goes back, and the 관공서's note says how many
  const close = [...ok].filter(([lx, lz]) => Y.placeError({ uid: 'q', id: id('fence_wood'), x: lx, z: lz, rot: 0 }, [], lot, 2, 3)).length;
  await stand(door.x, door.z); await req('/api/island/townhall/enter', a, {}); assert.equal((await req('/api/home/upgrade', a, {})).status, 200);
  await req('/api/test/home/next-day', a, {});
  const grown = (await req('/api/home', a)).data; assert.equal(grown.mine.stage, 2);
  const left = grown.lots.find((l) => l.id === lot.id).yard; assert.equal(left.length, 25 - close, `집이 커져 걸린 ${close}개는 창고로`);
  assert.ok(close > 0, "(작은 집 자리에 걸린 울타리가 있게 놓았음)");
  { const mail = (await req('/api/island/mail', a)).data; assert.ok((mail.letters || []).some((l) => l.from === 'office' && l.text.includes(`마당 물건 ${close}개`)), JSON.stringify(mail).slice(0, 300)); }
  // the lot given up: the pieces all back in the 가구 창고 (still mine), the level kept
  await req('/api/test/home/release', a, {}); const after = (await req('/api/home', a)).data;
  assert.equal(after.lots.find((l) => l.id === lot.id).yard.length, 0); assert.equal(after.yardLevel, 3, '넓힌 단계는 남음');
  assert.equal((await req('/api/island/furniture/mine', a)).data.pieces.filter((p) => Y.isYard(p.id)).length, 26);
});
