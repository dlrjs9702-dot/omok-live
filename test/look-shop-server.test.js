'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { boot } = require('../test-support/test-server');
const crypto = require('node:crypto');

// v1.10.30 성형외과·염색사: a face part (300,000P) or the colour of one owned dyeable item (50,000P, its own colour back
// costs the same) changed per paid request -- refused without charge when short or not allowed, one charge per request
// however often it is sent (also at once), clothes are never dyed, and everyone sees the new look.
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));


test('성형외과·염색사: 잔액 부족·잘못된 선택·미보유·잘못된 품목은 차감 없이 거절, 성공은 요청당 한 번 차감되고 외형에 반영', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'look-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir);
  const { req } = server;
  const sa = await server.enter(await server.issue('외형가'));
  assert.ok(sa, server.logs());
  const balance = async () => (await req('/api/donation', sa)).data.balance;
  const surgery = (part, design, requestId = crypto.randomUUID()) => req('/api/avatar/surgery', sa, { part, design, requestId });
  const dye = (itemId, color, requestId = crypto.randomUUID()) => req('/api/avatar/dye', sa, { itemId, color, requestId });
  const shop = (await req('/api/avatar/look-shop', sa)).data;
  assert.equal(shop.surgeryFee, 30_000); assert.equal(shop.dyeFee, 5_000); // v1.10.35 경제 기준(통합)
  assert.deepEqual(Object.keys(shop.faceParts), ['eyes', 'nose', 'mouth']);
  for (const part of Object.values(shop.faceParts)) assert.equal(part.designs.length, 10);
  assert.ok(shop.palette.length >= 20 && shop.palette.length <= 28);
  // 20,000P left: a surgery is refused, nothing taken
  assert.equal((await req('/api/donation', sa, { amount: 80_000, requestId: crypto.randomUUID() })).status, 200);
  assert.equal((await surgery('eyes', 'heart')).status, 409);
  assert.equal(await balance(), 20_000);
  assert.equal((await req('/api/test/points-credit', sa, { amount: 1_000_000 })).status, 200);
  for (const [part, design] of [['eyes', 'nope'], ['ears', 'oval'], ['nose', '']]) assert.equal((await surgery(part, design)).status, 400, `${part} ${design}`);
  assert.equal(await balance(), 1_020_000);
  // one surgery, sent three times at once with the same request: one charge
  const id = crypto.randomUUID();
  const same = await Promise.all([surgery('eyes', 'heart', id), surgery('eyes', 'heart', id), surgery('eyes', 'heart', id)]);
  for (const r of same) assert.equal(r.status, 200);
  assert.equal(await balance(), 990_000);
  assert.deepEqual(same[0].data.avatar.look.face, { eyes: 'heart' });
  assert.equal((await surgery('mouth', 'cat')).status, 200);
  assert.equal(await balance(), 960_000);
  // dye: only an owned, dyeable item; clothes never
  assert.equal((await dye('avatar_hair_1', 'c12')).status, 409); // not owned
  assert.equal((await req('/api/skins/buy', sa, { skinId: 'avatar_hair_1' })).status, 200);
  assert.equal((await req('/api/skins/buy', sa, { skinId: 'avatar_outfit_2' })).status, 200);
  assert.equal((await req('/api/skins/equip', sa, { skinId: 'avatar_hair_1' })).status, 200);
  const before = await balance();
  assert.equal((await dye('avatar_outfit_999', 'c12')).status, 400); // no such owned outfit
  assert.equal((await dye('avatar_hair_1', 'c99')).status, 400);
  assert.equal(await balance(), before);
  const dyed = await dye('avatar_hair_1', 'c12');
  assert.equal(dyed.status, 200);
  assert.equal(await balance(), before - 5_000);
  assert.deepEqual(dyed.data.avatar.look.dye, { avatar_hair_1: '#eda3b8' });
  const back = await dye('avatar_hair_1', null); // its own colour back: free (v1.10.35)
  assert.equal(back.status, 200);
  assert.equal(await balance(), before - 5_000);
  assert.equal(back.data.avatar.look.dye, undefined);
  // v1.10.35 머리·눈·피부: nothing to own; the skin from its own tones only, the others from the palette
  assert.equal((await dye('skin', 'c01')).status, 400);
  assert.equal((await dye('wings', 'c01')).status, 400);
  const toned = await dye('skin', 's09');
  assert.equal(toned.status, 200); assert.equal(toned.data.avatar.look.skinColor, '#b07a4d');
  assert.equal((await dye('eyes', 'c22')).data.avatar.look.eyeColor, '#34507e');
  assert.equal((await dye('base_hair', 'c05')).data.avatar.look.hairColor, '#e2c27a');
  assert.equal(await balance(), before - 20_000);
  assert.equal((await dye('skin', null)).data.avatar.look.skinColor, undefined);
  assert.equal(await balance(), before - 20_000);
  // the face stays with the account (the look the plaza shows everyone)
  const skins = (await req('/api/skins', sa)).data;
  assert.deepEqual(skins.avatar.look.face, { eyes: 'heart', mouth: 'cat' });
});

// v1.10.32 캐릭터 스킨 상품화: a new character skin is bought once at its tier's price (a second buy charges nothing),
// worn and taken off for free in its own slot -- the five accessory slots at once -- kept with the account (a new
// session has it), dyed like the other dyeable items (an outfit never), and shown to everyone in the plaza with the
// lost thing a player carries
test('캐릭터 스킨: 등급 가격 1회 결제·중복 구매 무과금·5칸 동시 장착·해제·재접속 유지·염색·다른 사람에게 보이는 외형과 운반', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wear-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir);
  const { req } = server;
  const keyA = await server.issue('꾸미기');
  let sa = await server.enter(keyA);
  const sb = await server.enter(await server.issue('구경'));
  assert.ok(sa && sb, server.logs());
  const balance = async () => (await req('/api/donation', sa)).data.balance;
  assert.equal((await req('/api/test/points-credit', sa, { amount: 4_000_000 })).status, 200);
  const start = await balance();
  const catalog = (await req('/api/skins', sa)).data.catalog.find((f) => f.family === 'avatar').skins;
  const price = (id) => catalog.find((s) => s.id === id).price;
  const items = { hat: 'avatar_hat_6', cape: 'avatar_cape_7', tail: 'avatar_tail_10', shoes: 'avatar_shoes_2', necklace: 'avatar_necklace_4' };
  assert.deepEqual(Object.values(items).map(price), [50_000, 400_000, 100_000, 100_000, 200_000]); // 일반·전설·고급·고급·희귀 (v1.10.35)
  for (const id of Object.values(items)) assert.equal((await req('/api/skins/buy', sa, { skinId: id })).data.purchased, true);
  const spent = 50_000 + 400_000 + 100_000 + 100_000 + 200_000;
  assert.equal(await balance(), start - spent);
  const again = await req('/api/skins/buy', sa, { skinId: items.cape }); // already owned: nothing charged
  assert.equal(again.status, 200); assert.equal(again.data.purchased, false);
  assert.equal(await balance(), start - spent);
  assert.equal((await req('/api/skins/equip', sa, { skinId: 'avatar_cape_1' })).status, 409); // not owned: not worn
  for (const id of Object.values(items)) assert.equal((await req('/api/skins/equip', sa, { skinId: id })).status, 200);
  let look = (await req('/api/skins', sa)).data.avatar.look;
  for (const [slot, id] of Object.entries(items)) assert.equal(look[slot], id, slot);
  assert.equal(await balance(), start - spent); // wearing is free
  assert.equal((await req('/api/skins/equip', sa, { skinId: null, game: 'avatar', slot: 'shoes' })).status, 200);
  look = (await req('/api/skins', sa)).data.avatar.look;
  assert.equal(look.shoes, undefined); assert.equal(look.cape, items.cape);
  // owned cape and outfit: 5,000P each, shared with other players
  const dyed = await req('/api/avatar/dye', sa, { itemId: items.cape, color: 'c22', requestId: crypto.randomUUID() });
  assert.equal(dyed.status, 200); assert.deepEqual(dyed.data.avatar.look.dye, { [items.cape]: '#34507e' });
  assert.equal((await req('/api/skins/buy', sa, { skinId: 'avatar_outfit_6' })).status, 200);
  const outfitRequest = crypto.randomUUID();
  const outfitDyes = await Promise.all([1, 2, 3].map(() => req('/api/avatar/dye', sa, { itemId: 'avatar_outfit_6', color: 'c22', requestId: outfitRequest })));
  for (const r of outfitDyes) assert.equal(r.status, 200);
  assert.equal((await req('/api/skins/equip', sa, { skinId: 'avatar_outfit_6' })).status, 200);
  assert.equal(await balance(), start - spent - 10_000 - price('avatar_outfit_6'));
  // a new session of the same account: the same look
  await server.release(sa); await sleep(1500);
  sa = await server.enter(keyA);
  assert.ok(sa, server.logs());
  look = (await req('/api/skins', sa)).data.avatar.look;
  assert.equal(look.cape, items.cape); assert.equal(look.necklace, items.necklace); assert.equal(look.tail, items.tail); assert.equal(look.hat, items.hat);
  assert.deepEqual(look.dye, { [items.cape]: '#34507e', avatar_outfit_6: '#34507e' });
  // the plaza: someone else sees the look, and the lost thing carried
  const lost = (await req('/api/test/island/lost', sa, {})).data.event;
  assert.ok(lost);
  assert.equal((await req('/api/plaza/state', sa, { x: lost.x, z: lost.z, yaw: 0 })).status, 200);
  const picked = await req('/api/island/event', sa, { id: lost.id });
  assert.equal(picked.status, 200, JSON.stringify(picked.data)); assert.equal(picked.data.action, 'pickup');
  const state = await req('/api/plaza/state', sa, { x: lost.x + 1, z: lost.z, yaw: 0 });
  assert.ok(state.data.events.some((e) => e.kind === 'carrying' && e.id === lost.id), 'I carry it wherever I am');
  const ctrl = new AbortController(); t.after(() => ctrl.abort());
  const res = await fetch(`${server.base}/api/lobby/events`, { headers: { 'X-Session-Token': sb }, signal: ctrl.signal });
  const reader = res.body.getReader(); let text = '';
  while (!/event: plaza\ndata: [^\n]+\n/.test(text)) { const { value, done } = await reader.read(); if (done) break; text += new TextDecoder().decode(value); }
  const players = JSON.parse(text.match(/event: plaza\ndata: ([^\n]+)\n/)[1]).players;
  const a = players.find((p) => p.look?.cape === items.cape);
  assert.ok(a, 'the other player sees the cape'); assert.equal(a.look.necklace, items.necklace); assert.equal(a.carry, lost.id); assert.equal(a.look.dye.avatar_outfit_6, '#34507e');
  ctrl.abort();
});
