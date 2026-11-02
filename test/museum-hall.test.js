'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const F = require('../lib/island-fishing');
const I = require('../lib/island-items');
const M = require('../public/plaza/island-museum.js');
const T = require('../public/plaza/island-terrain.js');
const Together = require('../lib/island-together');
const { boot } = require('../test-support/test-server');

// v1.10.231 물고기 크기 (docs/fish-size-20261027.md): sizes in their range, the big end rare; a stack keeps its sizes, the
// smallest go first (the biggest for the museum); the price by size averages the old one
test('물고기 크기: 범위·드문 큰 끝, 가방 크기 목록, 작은 것부터, 크기 값 평균', () => {
  let s = 11; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (const sp of Object.keys(F.SPECIES)) {
    const [lo, hi] = F.SIZES[sp]; let mult = 0; let top = 0; const N = 4000;
    for (let i = 0; i < N; i += 1) { const cm = F.rollSize(sp, rnd); assert.ok(cm >= lo && cm <= hi, `${sp} ${cm}`); mult += F.sizeMult(sp, cm); if (F.sizeT(sp, cm) > 0.8) top += 1; }
    assert.ok(Math.abs(mult / N - 1) < 0.03, `${sp} 평균 값 ×${mult / N}`); assert.ok(top / N < 0.05, `${sp} 큰 끝 ${top / N}`);
  }
  assert.ok(Math.abs(F.sizeMult('anchovy', 6) - 0.8) < 1e-9 && Math.abs(F.sizeMult('anchovy', 15) - 1.3) < 1e-9);
  let bag = I.addToBag([], 'fish_carp', 1, 'a', { size: 40 }); bag = I.addToBag(bag, 'fish_carp', 1, 'b', { size: 70.5 }); bag = I.addToBag(bag, 'fish_carp', 1, 'c', { size: 55 });
  assert.deepEqual([bag.length, bag[0].qty, I.sizesOf(bag[0])], [1, 3, [70.5, 55, 40]]);
  assert.deepEqual(I.sizesOf(I.takeFromBag(bag, 'fish_carp', 1)[0]), [70.5, 55], '작은 것부터');
  assert.deepEqual(I.sizesOf(I.takeFromBag(bag, 'fish_carp', 1, true)[0]), [55, 40], '박물관은 가장 큰 것');
  assert.equal(I.pickSize(bag, 'fish_carp', true), 70.5);
  assert.deepEqual(I.sizesOf({ itemId: 'fish_carp', qty: 2, meta: null }), [F.midSize('carp'), F.midSize('carp')], '옛 물고기는 가운데 값');
  const sale = I.sellAt(bag, 'fisher', 0);
  assert.equal(sale.paid, [40, 55, 70.5].reduce((n, cm) => n + I.fishPrice('fish_carp', cm), 0)); assert.ok(I.fishPrice('fish_carp', 70.5) > I.fishPrice('fish_carp', 40));
});

// the hall: in at the museum's door, the curator's desk the place to give; a fish shows the biggest given, a bigger one hung
// in its place (the one before told by letter, kept as past), a smaller one refused; out at the hall's door
test('박물관 전시관: 들어가고 나가기, 창구에서 기증, 더 큰 물고기로 바꿔 걸기·쪽지·지난 기록', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'museum-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('관람객')); const b = await server.enter(await server.issue('낚시꾼')); assert.ok(a && b, server.logs());
  const door = Together.museumDoor(T.MUSEUM); const desk = M.world(M.TALK.lx, M.TALK.lz);
  const goIn = async (s) => { await req('/api/plaza/state', s, { x: door.x, z: door.z, yaw: 0, moving: false }); return (await req('/api/island/museum/enter', s, {})).data; };
  const give = async (s, itemId) => req('/api/island/museum/donate', s, { itemId });
  await req('/api/test/island/give', a, { itemId: 'fish_carp', qty: 1, meta: { size: 40 } }); await req('/api/test/island/give', a, { itemId: 'fish_carp', qty: 1, meta: { size: 55 } });
  await req('/api/plaza/state', a, { x: 0, z: 0, yaw: 0, moving: false });
  assert.equal((await req('/api/island/museum/enter', a, {})).data.error, 'TOO_FAR', '문에서 멀면 못 들어감');
  const inside = await goIn(a); assert.equal(inside.space, 'museum'); assert.ok(M.inMuseum(inside.x, inside.z));
  assert.equal((await give(a, 'fish_carp')).data.error, 'TOO_FAR', '창구 앞에서만');
  await req('/api/plaza/state', a, { x: desk.x, z: desk.z, yaw: 0, moving: false });
  const first = await give(a, 'fish_carp'); assert.equal(first.status, 200); assert.equal(first.data.size, 55, '가방에서 가장 큰 것');
  assert.deepEqual(I.sizesOf((await req('/api/island/bag', a)).data.items.find((e) => e.itemId === 'fish_carp')), [40]);
  assert.equal((await give(a, 'fish_carp')).data.error, 'NOT_BIGGER', '같거나 작으면 거절');
  await goIn(b); await req('/api/plaza/state', b, { x: desk.x, z: desk.z, yaw: 0, moving: false });
  await req('/api/test/island/give', b, { itemId: 'fish_carp', qty: 1, meta: { size: 72.3 } });
  const swapped = await give(b, 'fish_carp'); assert.deepEqual([swapped.status, swapped.data.swapped, swapped.data.size], [200, true, 72.3]);
  const shown = (await req('/api/island/museum', a)).data.exhibits.find((x) => x.id === 'fish_carp');
  assert.deepEqual([shown.size, shown.by, shown.first, shown.past], [72.3, '낚시꾼', '관람객', [{ size: 55, by: '관람객' }]]);
  assert.ok((await req('/api/island/mail', a)).data.letters.some((l) => l.from === 'museum' && l.text.includes('72.3 cm')), '바뀐 사람에게 쪽지');
  // an insect: once per kind, as before
  await req('/api/test/island/give', a, { itemId: 'insect_snail', qty: 2 });
  assert.equal((await give(a, 'insect_snail')).status, 200); assert.equal((await give(a, 'insect_snail')).data.error, 'ALREADY_SHOWN');
  // out at the hall's door (not from the desk)
  assert.equal((await req('/api/island/museum/leave', a, {})).data.error, 'TOO_FAR');
  const exit = M.world(M.ROOM.exit.lx, M.ROOM.exit.lz); await req('/api/plaza/state', a, { x: exit.x, z: exit.z, yaw: 0, moving: false });
  const out = (await req('/api/island/museum/leave', a, {})).data; assert.equal(out.space, 'island'); assert.ok(Math.hypot(out.x - door.x, out.z - door.z) < 0.5);
  // the walls hold: a pose past them is pulled back inside, round the big tank
  const tank = M.world(M.TANK.lx, M.TANK.lz); const q = M.clamp(tank.x, tank.z); assert.ok(Math.hypot(q.x - tank.x, q.z - tank.z) > 1.2, '큰 수조 안에 서지 않음');
  const far = M.clamp(M.ROOM.x + 40, M.ROOM.z); assert.ok(M.inMuseum(far.x, far.z));
});

// a fish caught: its size from the server, 「내 최고」 when it is my biggest of that kind, the 도감's best
test('낚시 크기: 서버가 정한 크기, 내 최고, 도감 최고 크기', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fishsize-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const sa = await server.enter(await server.issue('크기재기')); assert.ok(sa, server.logs());
  await req('/api/plaza/state', sa, { x: T.PIER.x, z: T.PIER.z, yaw: 0, moving: false }); await req('/api/test/island/give', sa, { itemId: 'fishing_rod', qty: 1 });
  const catchOne = async (size) => { const c = (await req('/api/island/fish/start', sa, {})).data; await req('/api/test/fish/bite', sa, { species: 'mackerel', size }); return (await req('/api/island/fish/finish', sa, { fishId: c.fishId, presses: c.seq.slice(0, c.arrows).map((dir, i) => ({ dir, t: i * 150 })) })).data; };
  const one = await catchOne(30.2); assert.deepEqual([one.size, one.best], [30.2, true]); assert.equal(one.price, I.fishPrice('fish_mackerel', 30.2));
  assert.deepEqual([(await catchOne(25)).best, (await catchOne(41.5)).best], [false, true]);
  assert.equal((await req('/api/island/dex', sa)).data.entries.find((e) => e.id === 'fish_mackerel').best.size, 41.5);
  assert.deepEqual(I.sizesOf((await req('/api/island/bag', sa)).data.items.find((e) => e.itemId === 'fish_mackerel')), [41.5, 30.2, 25]);
});
