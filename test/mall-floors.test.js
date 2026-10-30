'use strict';
// v1.10.211 백화점 개편 A안 (gamecenter-notes docs/mall-revamp-20261027.md, assets 82): four floors, one counter each --
// 1 잡화·생활, 2 옷·꾸미기, 3 가구, 4 옥상 펫샵. Every good, shop, plinth, mirror and counter reached on foot from the lift,
// the aisles between the shelves 2 m or more; the lift goes to all four; two 꾸미기 mirrors (a third waits), hair, colour
// and face only sat at one; the bag made bigger on the 1st floor only; a place kept from before on its new floor.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const T = require('../public/plaza/island-terrain.js');
const S = require('../public/plaza/island-store');
const W = require('../public/plaza/island-fashion');
const F = require('../public/plaza/island-furniture');
const P = require('../public/plaza/island-petshop');
const { boot } = require('../test-support/test-server');

// the floor walked over in 0.1 m steps from before the lift (where clamp leaves one): what can be stood on and reached
function reachable(R) {
  const step = 0.1; const nx = Math.round(R.ROOM.w / step); const nz = Math.round(R.ROOM.d / step); const key = (i, j) => i * 10000 + j;
  const free = (i, j) => { const lx = -R.ROOM.w / 2 + i * step; const lz = -R.ROOM.d / 2 + j * step; const w = R.world(lx, lz); const c = R.clamp(w.x, w.z); return Math.hypot(c.x - w.x, c.z - w.z) < 1e-6; };
  const at = (lx, lz) => [Math.round((lx + R.ROOM.w / 2) / step), Math.round((lz + R.ROOM.d / 2) / step)];
  const [si, sj] = at(...R.LIFT.stand); assert.ok(free(si, sj), 'the lift stand is clear');
  const seen = new Set([key(si, sj)]); const todo = [[si, sj]];
  while (todo.length) { const [i, j] = todo.pop(); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di; const b = j + dj; if (a < 0 || b < 0 || a > nx || b > nz || seen.has(key(a, b)) || !free(a, b)) continue; seen.add(key(a, b)); todo.push([a, b]); } }
  return (wx, wz) => { const { lx, lz } = R.local(wx, wz); const [i, j] = at(lx, lz); return [-1, 0, 1].some((di) => [-1, 0, 1].some((dj) => seen.has(key(i + di, j + dj)))); }; // (a spot by a shelf's edge: a grid point beside it)
}

test('백화점 네 층: 물건·가게·받침·거울·계산대 모두 승강기에서 걸어서 닿고, 진열대 사이 길 2 m 이상', () => {
  // 1층: every good from where SPACE picks it; the counter and the sell basket
  const f1 = reachable(S);
  for (const g of S.SHELF) { const w = S.standFor(g.id); assert.ok(w, `${g.id}: a spot that picks it`); assert.ok(f1(w.x, w.z), `${g.id}: walked to`); }
  for (const s of S.SECTORS) { const w = S.world(...s.interact); assert.ok(f1(w.x, w.z), s.place); }
  // 2층: the racks, the case, the costume rail; before both mirrors' chairs; the counter
  const f2 = reachable(W);
  for (const s of W.SECTORS) { const w = W.world(...s.interact); assert.ok(f2(w.x, w.z), s.place); }
  for (const seat of W.SEATS) { const w = { x: seat.x, z: seat.z + 0.9 }; assert.ok(f2(w.x, w.z), `${seat.id}: before it`); assert.ok(Math.hypot(w.x - seat.x, w.z - seat.z) < 1.6, seat.id); }
  { const w = W.world(...W.COUNTER.customer); assert.ok(f2(w.x, w.z), 'the 2nd floor counter'); }
  // 3층: each plinth (from where SPACE picks it), the counter
  const f3 = reachable(F);
  for (const sl of [...F.SLOTS, ...F.BASE_SLOTS]) {
    let ok = false; for (let k = 0; k < 64 && !ok; k += 1) for (const r of [1.3, 1.6, 1.9]) { const w = F.world(sl.lx + Math.cos(k / 64 * Math.PI * 2) * r, sl.lz + Math.sin(k / 64 * Math.PI * 2) * r); if (f3(w.x, w.z) && F.placeAt(w.x, w.z)?.id === sl.id) { ok = true; break; } }
    assert.ok(ok, sl.id);
  }
  { const w = F.world(F.CHECKOUT.lx, F.CHECKOUT.lz - 1.3); assert.ok(f3(w.x, w.z), 'the 3rd floor counter'); }
  // 4층: the yard's gate and inside it, the counter
  const f4 = reachable(P);
  for (const [lx, lz] of [[P.PEN.lx, P.PEN.lz - P.PEN.d / 2 - 0.6], [P.PEN.lx, P.PEN.lz], [P.COUNTER_KEEPER[0], P.COUNTER_KEEPER[1] - 2.3]]) { const w = P.world(lx, lz); assert.ok(f4(w.x, w.z), `roof ${lx},${lz}`); }
  // the aisles: between the 1st floor's gondolas, the 2nd floor's racks, the 3rd floor's plinths -- 2 m or more
  const gap = (a, b, axis) => (axis === 'x' ? Math.abs(a.x - b.x) - (a.w + b.w) / 2 : Math.abs(a.z - b.z) - (a.d + b.d) / 2);
  const gondolas = S.PROPS.filter((p) => p.id === 'mall.gondola').sort((a, b) => a.x - b.x);
  for (let i = 1; i < gondolas.length; i += 1) assert.ok(gap(gondolas[i - 1], gondolas[i], 'x') >= 2.0 - 1e-9, `gondolas ${i}: ${gap(gondolas[i - 1], gondolas[i], 'x')}`);
  const racks = W.PROPS.filter((p) => p.id === 'mall.wear_rack_straight__plain');
  for (const a of racks) for (const b of racks) { if (a === b) continue; if (a.z === b.z) assert.ok(gap(a, b, 'x') >= 2.0, 'racks across'); if (a.x === b.x) assert.ok(gap(a, b, 'z') >= 2.0, 'racks along'); }
  const plinths = F.SLOTS.filter((s) => s.plinth !== false).map((s) => ({ x: s.lx, z: s.lz, w: 2.4, d: 2.4 }));
  for (const a of plinths) for (const b of plinths) { if (a === b) continue; if (a.z === b.z) assert.ok(gap(a, b, 'x') >= 2.0 - 1e-9, `plinths across ${gap(a, b, 'x')}`); if (a.x === b.x) assert.ok(gap(a, b, 'z') >= 2.0 - 1e-9, `plinths along ${gap(a, b, 'z')}`); }
});

test('백화점 승강기 4층·꾸미기 거울 둘(셋째는 기다림)·앉아서만 머리·가방 늘리기는 1층·옛 자리는 새 층으로', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mall-floors-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const into = async (name) => {
    const token = await server.enter(await server.issue(name)); await req('/api/test/points-credit', token, { amount: 1000000 });
    await req('/api/plaza/state', token, { ...T.facilityDoor('store'), yaw: 0, moving: false });
    assert.equal((await req('/api/island/store/enter', token, {})).status, 200);
    return token;
  };
  const lift = async (token, R, to) => { await req('/api/plaza/state', token, { ...R.world(...R.LIFT.stand), yaw: 0, moving: false }); return (await req('/api/island/lift', token, { to })).data; };
  const a = await into('층손님A');
  // the lift: every floor, its own space, standing before that floor's lift
  assert.equal((await lift(a, S, 2)).space, 'fashion'); assert.equal((await lift(a, W, 3)).space, 'furniture'); assert.equal((await lift(a, F, 4)).space, 'petshop');
  assert.equal((await lift(a, P, 5)).error, 'BAD_FLOOR'); assert.equal((await lift(a, P, 1)).space, 'store');
  // the bag made bigger: on the 1st floor only (at its counter -- the 2nd floor refused)
  assert.equal((await lift(a, S, 2)).space, 'fashion');
  assert.equal((await req('/api/island/bag/grow', a, {})).data.error, 'TOO_FAR');
  // the mirrors: two chairs, a third person waits
  const b = await into('층손님B'); const c = await into('층손님C');
  for (const token of [b, c]) assert.equal((await lift(token, S, 2)).space, 'fashion');
  const sit = async (token, seat) => { await req('/api/plaza/state', token, { x: seat.x, z: seat.z + 0.9, yaw: 0, moving: false }); return req('/api/island/sit', token, { seat: seat.id }); };
  // hair only sat at one: standing by the mirror, refused
  await req('/api/plaza/state', a, { x: W.SEATS[0].x, z: W.SEATS[0].z + 0.9, yaw: 0, moving: false });
  assert.equal((await req('/api/skins/buy', a, { skinId: 'avatar_hair_3' })).data.error, 'TOO_FAR', '서서는 안 됨');
  assert.equal((await sit(a, W.SEATS[0])).status, 200); assert.equal((await sit(b, W.SEATS[1])).status, 200);
  assert.equal((await sit(c, W.SEATS[0])).data.error, 'SEAT_TAKEN', '셋째는 기다림');
  const bought = await req('/api/skins/buy', a, { skinId: 'avatar_hair_3' }); assert.equal(bought.status, 200, JSON.stringify(bought.data));
  // the clothes on the 2nd floor: at the racks, not from the 1st floor's old spot
  await req('/api/plaza/state', c, { ...W.sectorPoint('avatar'), yaw: 0, moving: false });
  assert.equal((await req('/api/skins/buy', c, { skinId: 'avatar_x2_outfit_tea_master' })).status, 200);
  // a place kept from before: a first pose in the old 3rd floor's room (the pet shop's, where it was) lands on the roof
  const d = await server.enter(await server.issue('층손님D'));
  await req('/api/plaza/state', d, { ...P.world(...P.LIFT.stand), yaw: 0, moving: false });
  assert.equal((await lift(d, P, 1)).space, 'store', '옥상 승강기에서 1층으로'); // (put on the roof: its lift takes me down)
  const e = await server.enter(await server.issue('층손님E'));
  await req('/api/plaza/state', e, { ...F.world(...F.LIFT.stand), yaw: 0, moving: false });
  assert.equal((await lift(e, F, 1)).space, 'store', '3층 승강기에서 1층으로');
});
