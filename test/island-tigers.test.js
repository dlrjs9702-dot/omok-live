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
  assert.equal(chase(12, 10), null, '자전거(Shift 12)는 따돌림'); /* (377 사용자 「속도를 11까지」: faster than a bike's 9) */
  // 우레 asleep 12~14시: he does not hunt one beside him
  const noon = Date.UTC(2026, 10, 20, 3, 30, 0); const s = P.SWAMPS[1]; g.place('ure', s[0] + 10, s[1], noon); g.place('angae', I.x + 300, I.z, noon);
  for (let k = 0; k < 30; k += 1) g.tick(noon + k * 100, [{ token: 'q', x: s[0] + 14, z: s[1] }]);
  assert.notEqual(g.state()[0].mode, 'stalk'); assert.notEqual(g.state()[0].mode, 'chase'); assert.equal(g.state()[0].target, null);
  // from 30 m off he walks to his rock and naps on it (lifted onto it)
  g.place('ure', P.ROCK[0] - 30, P.ROCK[1] - 20, noon); let k = 0; for (; k < 600 && g.state()[0].mode !== 'rest'; k += 1) g.tick(noon + k * 100, []);
  const v = g.view()[0]; assert.equal(v.clip, 'Nap', `${k / 10} s`); assert.deepEqual([v.x, v.z, v.lift], [P.ROCK[0], P.ROCK[1], 1.44]);
});

// 1.10.381 호랑이 지능 ①~④ (사용자 결정 12 「전부」, 「크기를 키워서 나무에 끼는 구간」): the body's ways, unstuck, the chase, the two together
test('381 몸에 맞는 길·끼임: 10분 돌아다녀도 머리·엉덩이가 나무에 드는 때 1.5 % 아래, 1초 넘게 서면 뒤로 빠져 다른 길', () => {
  let seed = 7; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const g = Tg.createTigers({ T, P, rand }); g.warm(); const now0 = Date.UTC(2026, 10, 20, 0, 0, 0); g.setClockShift(0);
  const inTree = (t) => { const fx = Math.sin(t.yaw); const fz = Math.cos(t.yaw); return !T.isle2Clear(t.x + fx * 1.4, t.z + fz * 1.4, 0.5) || !T.isle2Clear(t.x - fx * 1.3, t.z - fz * 1.3, 0.6); };
  let moving = 0; let inside = 0; const still = [0, 0]; let longest = 0;
  for (let k = 0; k < 6000; k += 1) {
    g.tick(now0 + k * 100, []);
    g.state().forEach((t, i) => { if (t.mode !== 'roam' && t.mode !== 'toRest') { still[i] = 0; return; } moving += 1; if (inTree(t)) inside += 1; const v = g.view()[i]; still[i] = v.sp > 0 ? 0 : still[i] + 1; longest = Math.max(longest, still[i]); });
  }
  assert.ok(moving > 3000, `${moving}`); assert.ok(inside / moving < 0.015, `${((100 * inside) / moving).toFixed(1)} %`);
  assert.ok(longest <= 25, `서 있던 가장 긴 때 ${longest / 10} s`); /* (stuck a second, then backing off -- never standing there long) */
});

test('381 쫓기·협공: 둘이 같은 사람을 쫓으면 가까운 쪽이 몰고 먼 쪽이 막음, 캠핑장으로 들어가면 마지막 본 곳에서 둘러봄', () => {
  let seed = 3; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const g = Tg.createTigers({ T, P, rand }); g.warm(); const now0 = Date.UTC(2026, 10, 20, 0, 0, 0); g.setClockShift(0); const I = T.dalmaru.NEW_ISLE;
  // one standing in the open: 우레 10 m one side, 안개 15 m the other (both within sight)
  let spot = null; for (let x = 330; x <= 460 && !spot; x += 4) for (let z = 140; z <= 320 && !spot; z += 4) if (g.huntable(x, z) && g.open(x - 10, z) && g.open(x + 15, z)) spot = { x, z };
  assert.ok(spot); g.place('ure', spot.x - 10, spot.z, now0); g.place('angae', spot.x + 15, spot.z, now0);
  let roles = null; for (let k = 0; k < 15 && !roles; k += 1) { g.tick(now0 + k * 100, [{ token: 'p', x: spot.x, z: spot.z }]); const st = g.state(); if (st[0].role && st[1].role) roles = st.map((t) => t.role); }
  assert.deepEqual(roles, ['drive', 'block']);
  // into the camp (safe): the chase turns to a search where they were last seen, then a look round
  g.place('ure', I.camp.x + I.camp.r + 24, I.camp.z, now0 + 5000); g.place('angae', I.x + 300, I.z, now0 + 5000);
  const at = { x: I.camp.x + I.camp.r + 5, z: I.camp.z }; let mode = null;
  for (let k = 0; k < 5; k += 1) g.tick(now0 + 5000 + k * 100, [{ token: 'q', x: at.x, z: at.z }]);
  assert.ok(['stalk', 'chase'].includes(g.state()[0].mode), g.state()[0].mode);
  const seen = []; for (let k = 5; k < 200; k += 1) { g.tick(now0 + 5000 + k * 100, [{ token: 'q', x: I.camp.x, z: I.camp.z }]); mode = g.state()[0].mode; if (!seen.includes(mode)) seen.push(mode); }
  assert.ok(seen.includes('search'), seen.join(',')); assert.ok(!g.huntable(I.camp.x, I.camp.z));
});

test('덮치기: 달리던 그대로 앞으로 곧게, 0.84초에 앞발이 닿을 거리, 그 뒤는 그대로; 포기 25초, 크기 2.4배', () => {
  assert.equal(Tg.leapAt(0, 9), 0); assert.ok(Math.abs(Tg.leapAt(0.42, 9) - 4.5) < 1e-9); assert.equal(Tg.leapAt(0.84, 9), 9); assert.equal(Tg.leapAt(1.2, 9), 9);
  assert.equal(Tg.GIVE_UP_S, 25); assert.equal(Tg.SCALE, 2.4); assert.deepEqual(Tg.TIGERS.map((t) => t.speed), [12, 11]); /* (우레 「속도 1 업」) */
  assert.equal(Tg.restingAt(Tg.TIGERS[0], Date.UTC(2026, 10, 20, 3, 0, 0)), true); assert.equal(Tg.restingAt(Tg.TIGERS[1], Date.UTC(2026, 10, 19, 19, 30, 0)), true); assert.equal(Tg.restingAt(Tg.TIGERS[1], Date.UTC(2026, 10, 20, 3, 0, 0)), false);
});
