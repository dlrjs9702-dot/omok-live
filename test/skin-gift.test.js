'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { boot } = require('../test-support/test-server');
const Skins = require('../lib/skins');

// 3-1 스킨 선물 (사용자 2026-10-19 「선물 허용으로」 → 「1」 선물로 사기): the giver pays once (「선물 ○○ → △△」), the skin is
// the recipient's, a note in their 우체통; not an IP skin, not to oneself or one who has it, a few a day per giver, the same
// request once.
test('스킨 선물: 받는 사람 소유·우체통 쪽지, 같은 요청 한 번, IP·자기 자신·이미 가진 사람·하루 상한은 안 됨', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skin-gift-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const giverKey = await server.issue('주는이'); const giver = await server.enter(giverKey);
  const friendKey = await server.issue('받는이'); const friend = await server.enter(friendKey);
  assert.equal((await req('/api/test/points-credit', giver, { amount: 5_000_000 })).status, 200);
  const send = (skinId, to = friendKey.id, requestId = `gift-${Math.random().toString(36).slice(2, 12)}`) => req('/api/skins/gift', giver, { skinId, to, requestId, text: '축하해!' });
  const before = (await req('/api/skins', giver)).data.balance; const theirs = (await req('/api/skins', friend)).data.balance;
  const hair = Skins.skinById('avatar_hair_1');
  const first = await send(hair.id, friendKey.id, 'gift-request-0001');
  assert.equal(first.status, 200, JSON.stringify(first.data));
  assert.equal((await send(hair.id, friendKey.id, 'gift-request-0001')).data.already, true, '같은 요청은 한 번만');
  assert.equal((await req('/api/skins', giver)).data.balance, before - hair.price, '주는 사람이 한 번 냄');
  assert.equal((await req('/api/skins', friend)).data.balance, theirs, '받는 사람은 그대로');
  assert.ok((await req('/api/skins', friend)).data.owned.includes(hair.id), '받는 사람 것');
  const note = (await req('/api/island/mail', friend)).data.letters.find((l) => l.skinId === hair.id);
  assert.equal(note.text, '축하해!'); assert.equal(note.skinName, hair.name);
  assert.equal((await req('/api/points/history', giver)).data.items.find((i) => i.reason === 'skin_gift').memo, `선물 ${hair.name} → 받는이`);
  assert.equal((await send(hair.id)).data.error, 'ALREADY_OWNED');
  assert.equal((await req('/api/skins/gift/check', giver, { skinId: hair.id, to: friendKey.id })).data.owned, true);
  assert.equal((await send(hair.id, giverKey.id)).data.error, 'RECIPIENT_NOT_FOUND', '자기 자신에게는 안 됨');
  const ip = Skins.IP_SKIN_IDS.find((id) => Skins.skinById(id)); if (ip) assert.equal((await send(ip)).data.error, 'NOT_GIFTABLE', 'IP 스킨은 선물 안 됨');
  // the day's limit (economy gift:skinPerDay, 5 to start): four more go, the sixth does not
  const more = Skins.SKINS.filter((s) => s.family === 'avatar' && s.id !== hair.id && !s.ip && !Skins.IP_SKIN_IDS.includes(s.id) && s.slot !== 'transform').slice(0, 5);
  for (const s of more.slice(0, 4)) assert.equal((await send(s.id)).status, 200);
  const over = await send(more[4].id); assert.equal(over.data.error, 'GIFT_LIMIT');
  assert.equal((await req('/api/skins', friend)).data.owned.includes(more[4].id), false, '상한을 넘은 것은 받지 않음');
});
