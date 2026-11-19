'use strict';
// 1.10.376 N2a-2 별마루섬 호랑이 (lib/island-tigers.js; notes island-expansion 「별마루섬 호랑이」): what a catch takes from the bag, where they may
// go and hunt (never the camp, the lookout or a gate's 12 m), a walker caught and a bike away, 우레's nap hours, the pounce's leap
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain.js'); require('../public/plaza/island-train.js');
const P = require('../public/plaza/isle2-props.js');
const Items = require('../lib/island-items');
const Tg = require('../lib/island-tigers');

test('호랑이에게 잡히면: 가방 물건 칸에서 무작위 2개(도구·자전거·펫·심부름·주인 있는 물건·상자 속은 빼고)', () => {
  const bag = [
    { entryId: 'a', itemId: 'fishing_rod', qty: 1 }, { entryId: 'b', itemId: 'bike_mint', qty: 1 }, { entryId: 'c', itemId: 'pet_puppy', qty: 1 }, { entryId: 'd', itemId: 'bread', qty: 1 },
    { entryId: 'e', itemId: 'lost', qty: 1, meta: { eventId: 'x' } }, { entryId: 'f', itemId: 'wallet', qty: 1 }, { entryId: 'g', itemId: 'weed', qty: 40 }, { entryId: 'h', itemId: 'branch', qty: 3 }, { entryId: 'i', itemId: 'berry', qty: 1 },
  ];
  for (let s = 0; s < 20; s += 1) { let k = s; const rand = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
    const pick = Tg.losePick(bag, Items, rand); assert.equal(pick.length, 2); assert.notEqual(pick[0].entryId, pick[1].entryId); for (const e of pick) assert.ok(['g', 'h', 'i'].includes(e.entryId), e.itemId); }
  assert.deepEqual(Tg.losePick([{ entryId: 'a', itemId: 'pickaxe', qty: 1 }], Items), []); assert.equal(Tg.losePick([{ entryId: 'g', itemId: 'weed', qty: 2 }], Items).length, 1);
});

test('별마루섬 호랑이: 캠핑장·전망대·문 둘레 12 m는 안 들어가고 안 쫓음, 걷는 사람은 잡고 자전거는 놓침, 우레 12~14시 낮잠', () => {
  let seed = 11; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const g = Tg.createTigers({ T, P, rand }); g.warm(); const I = T.dalmaru.NEW_ISLE;
  assert.ok(g.cellCount() > 20000, `${g.cellCount()}`);
  assert.equal(g.huntable(I.camp.x, I.camp.z), false); assert.equal(g.huntable(I.peak.x, I.peak.z), false); assert.equal(g.open(I.camp.x, I.camp.z), false);
  const gate = P.FENCE.find((f) => P.FENCE_KINDS[f[3]] === 'fence_gate'); assert.equal(g.huntable(gate[0], gate[1]), false); assert.equal(g.open(gate[0] + 6, gate[1]), false);
  // one fleeing straight away (sliding aside where blocked), ticks of 0.1 s; 09시 KST: awake
  const chase = (speed, gap, now0 = Date.UTC(2026, 10, 20, 0, 0, 0)) => {
    const s = P.SWAMPS[1]; let px = s[0] + 18; let pz = s[1]; g.place('ure', px - gap, pz, now0); g.place('angae', I.x + 300, I.z, now0); g.setClockShift(0);
    for (let k = 0; k <= 140; k += 1) {
      const now = now0 + k * 100; const t = g.state()[0]; const dx = px - t.x; const dz = pz - t.z; const d = Math.hypot(dx, dz) || 1;
      const nx = px + (dx / d) * speed * 0.1; const nz = pz + (dz / d) * speed * 0.1;
      if (g.huntable(nx, nz) && T.isle2Clear(nx, nz, 0.45)) { px = nx; pz = nz; } else { const a = Math.atan2(dx, dz) + 1.2; px += Math.sin(a) * speed * 0.1; pz += Math.cos(a) * speed * 0.1; }
      if (g.tick(now, [{ token: 'p', x: px, z: pz }]).some((e) => e.type === 'catch' && e.token === 'p' && e.tiger.id === 'ure')) return k / 10;
    }
    return null;
  };
  const walked = chase(4.2, 15); assert.ok(walked !== null && walked < 12, `걷기 ${walked}`);
  assert.equal(chase(9, 10), null, '자전거는 따돌림');
  // 우레 asleep 12~14시: he does not hunt one beside him
  const noon = Date.UTC(2026, 10, 20, 3, 30, 0); const s = P.SWAMPS[1]; g.place('ure', s[0] + 10, s[1], noon); g.place('angae', I.x + 300, I.z, noon);
  for (let k = 0; k < 30; k += 1) g.tick(noon + k * 100, [{ token: 'q', x: s[0] + 14, z: s[1] }]);
  assert.notEqual(g.state()[0].mode, 'stalk'); assert.notEqual(g.state()[0].mode, 'chase'); assert.equal(g.state()[0].target, null);
  // from 30 m off he walks to his rock and naps on it (lifted onto it)
  g.place('ure', P.ROCK[0] - 30, P.ROCK[1] - 20, noon); let k = 0; for (; k < 600 && g.state()[0].mode !== 'rest'; k += 1) g.tick(noon + k * 100, []);
  const v = g.view()[0]; assert.equal(v.clip, 'Nap', `${k / 10} s`); assert.deepEqual([v.x, v.z, v.lift], [P.ROCK[0], P.ROCK[1], 1.44]);
});

test('덮치기: 0.42초까지 제자리, 0.84초에 앞발이 닿을 거리, 그 뒤는 그대로', () => {
  assert.equal(Tg.leapAt(0.3, 3), 0); assert.ok(Tg.leapAt(0.63, 3) > 1 && Tg.leapAt(0.63, 3) < 2); assert.equal(Tg.leapAt(0.84, 3), 3); assert.equal(Tg.leapAt(1.2, 3), 3);
  assert.equal(Tg.restingAt(Tg.TIGERS[0], Date.UTC(2026, 10, 20, 3, 0, 0)), true); assert.equal(Tg.restingAt(Tg.TIGERS[1], Date.UTC(2026, 10, 19, 19, 30, 0)), true); assert.equal(Tg.restingAt(Tg.TIGERS[1], Date.UTC(2026, 10, 20, 3, 0, 0)), false);
});
