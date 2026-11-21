'use strict';
// 1.10.395 Codex 검토 381~390 (notes docs/codex-review-381-390.md): the fixes that can be checked without a server
const test = require('node:test'); const assert = require('node:assert/strict');
const B = require('../public/plaza/island-boat.js');
const S = require('../lib/island-storehouse.js'); const F = require('../lib/island-festival.js'); const Cal = require('../public/plaza/island-calendar');

test('Codex 12 창고 번호는 다시 안 씀, 보인 것과 다른 물건은 안 꺼냄 · 6 자정 넘어 늦게 온 요청이 오늘 횟수를 안 지움 · 16 밭 채소 두 가지', () => {
  // 12: s1 taken out, a new thing put in -- not s1; a take naming the old thing at its id is refused
  const bag = [{ entryId: 'a', itemId: 'berry', qty: 3 }, { entryId: 'b', itemId: 'mushroom', qty: 2 }];
  const p1 = S.put([], bag, 'a', 3, 10, 0); assert.equal(p1.items[0].entryId, 's1');
  const t1 = S.take(p1.items, p1.bag, 's1', 3, 24, 'berry'); assert.equal(t1.items.length, 0);
  const p2 = S.put(t1.items, t1.bag, 'b', 2, 10, p1.seq); assert.notEqual(p2.items[0].entryId, 's1');
  assert.equal(S.take([{ entryId: 's1', itemId: 'mushroom', qty: 2 }], [], 's1', 1, 24, 'berry').error, 'MISSING');
  // 6: a cook from yesterday saved after today's harvest keeps today's count
  const fest = { id: 'x', tasks: { harvest: { perDay: 3, stamps: 1 }, cook: { perDay: 1, stamps: 2 } } };
  const open = Cal.taskOpen; Cal.taskOpen = () => true;
  try {
    const today = Date.UTC(2026, 10, 21, 3); const yday = Date.UTC(2026, 10, 20, 14, 59);
    const a = F.award(fest, {}, 'harvest', today); const b = F.award(fest, a.doc, 'cook', yday, 2);
    assert.equal(b.doc.days[Cal.dayOf(today)].harvest, 1, '오늘 횟수 그대로'); assert.equal(b.doc.days[Cal.dayOf(yday)].cook, 1);
  } finally { Cal.taskOpen = open; }
  // 16: one's own crops are cooked; two of one vegetable are not 「두 가지」
  assert.ok(F.COOKABLE('crop_carrot')); const veg2 = F.COOK_THEMES.find((t) => t.id === 'veg2');
  assert.equal(veg2.fits(['harvest', 'harvest', 'berry']), false); assert.equal(veg2.fits(['harvest', 'crop_potato', 'berry']), true);
});

test('Codex 8·9·19 탐방선: 빈 배는 한쪽에 셋째로 머물지 않음, 같은 틱에 다시 떠나도 내린 곳을 앎, 둘째 선석에서 내리면 그 선석 앞', () => {
  // 8: board at 달마루 and drop out while it waits, twice -- 달마루 is never left without a boat, its queue gets one
  let f = B.createFleet({ now: 0 }); let t = 0; const run = (until) => { while (t < until) { t += 500; B.tick(f, t); } };
  B.board(f, 'dal', 'A', t); B.drop(f, 'A'); run(200000);
  B.board(f, 'dal', 'C', t); B.drop(f, 'C'); run(400000);
  const at = (d) => f.boats.filter((b) => b.at === d && ['docked', 'hold', 'back'].includes(b.phase)).length;
  assert.ok(at('dal') >= 1, `달마루에 배 ${f.boats.map((b) => `${b.id}:${b.phase}@${b.at}`).join(' ')}`); assert.ok(f.boats.every((b) => b.phase !== 'wait'), '앞바다에서 기다리는 빈 배 없음');
  const q = B.board(f, 'dal', 'Q', t); run(t + 60000); assert.ok(q.ok || B.riderOf(f, 'Q'), '달마루 줄에 배가 옴');
  // 9: unloading at 달마루 with four waiting -- in the same tick it takes them and goes; the view still says where it let one off
  f = B.createFleet({ now: 0 }); t = 0;
  B.board(f, 'byeol', 'R', t); run(8000);
  for (const k of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'w1', 'w2', 'w3', 'w4']) B.board(f, 'dal', k, t);
  let seen = null; while (t < 200000 && !seen) { t += 500; const r = B.tick(f, t); if (r.released.some((o) => o.token === 'R')) seen = r.released.find((o) => o.token === 'R'); }
  assert.ok(seen); const v = B.view(f, t).boats.find((b) => b.riders === 0 || b.outAt); const rb = B.view(f, t).boats.find((b) => b.outAt === 'dal');
  assert.ok(rb, `내린 곳 ${JSON.stringify(v)}`); const e = B.exitOf(rb.outAt, rb.outBerth); assert.ok(Math.hypot(e.x - seen.x, e.z - seen.z) < 1e-6, '화면이 읽는 내린 곳 = 서버가 내려 준 곳');
  // 19: off before it goes, from the second berth -- at that berth's way off
  f = B.createFleet({ now: 0 });
  for (const k of ['X', 'Y', 'Z', 'V', 'U']) B.board(f, 'dal', k, 0);
  const u = B.riderOf(f, 'U'); assert.equal(u.boat.berth, 1); const l = B.leave(f, 'U', 0);
  assert.equal(l.was.berth, 1); assert.deepEqual(B.exitOf('dal', l.was.berth), B.exitOf('dal', 1));
});
