'use strict';
// 1.10.343 Codex 331~340 P1 1~4 (notes docs/codex-review-331-340.md): a stop half way (a save failing: /api/test/store/fail) never
// copies a thing or pays twice -- the 벼룩시장's buy (another buyer never gets the thing on the first one's charge), 거두기 (never
// sold again), 판 돈 (auto and 받기 one key a sale), and the stamp shop's piece (handed over once, even after it went to the 벼룩시장)
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');
const C = require('../public/plaza/island-calendar');

test('벼룩시장 멈춤: 결제 뒤 멈추면 낸 사람이 받음(다른 사람 공짜 없음), 거두기 뒤 멈춰도 다시 안 팔림, 판 돈은 한 번만', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'flea-stops-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('파는이')); const b = await server.enter(await server.issue('사는이')); const c = await server.enter(await server.issue('끼어든이'));
  for (const label of ['사는이', '끼어든이']) { const key = (await req('/api/admin/keys', server.admin)).data.keys.find((k) => k.label === label); await req(`/api/admin/keys/${key.id}/points`, server.admin, { amount: 900000, category: 'other', memo: '시험', requestId: crypto.randomUUID() }); }
  const bal = async (who) => (await req('/api/points', who)).data.balance;
  const count = async (who, id) => ((await req('/api/island/bag', who)).data.items || []).filter((e) => e.itemId === id).reduce((n, e) => n + e.qty, 0);
  const fail = (method, skip = 0) => req('/api/test/store/fail', null, { method, skip });
  const put = async (qty, price) => { const e = (await req('/api/island/flea/stock', a)).data.items.find((x) => x.itemId === 'herb'); const r = await req('/api/island/flea/list', a, { requestId: crypto.randomUUID(), entryId: e.entryId, qty, price }); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data.listing.id; };
  await req('/api/test/island/give', a, { itemId: 'herb', qty: 9 });

  // P1-2: B's charge saved, the handing over stops -- C cannot buy it on B's charge; B gets it (once), charged once
  const id1 = await put(2, 8000);
  const b0 = await bal(b); const c0 = await bal(c);
  await fail('islandGive'); assert.notEqual((await req('/api/island/flea/buy', b, { id: id1 })).status, 200);
  assert.equal(await bal(b), b0 - 8000, 'B는 한 번 냄');
  const cTry = await req('/api/island/flea/buy', c, { id: id1 }); assert.equal(cTry.data.error, 'FLEA_GONE', JSON.stringify(cTry.data)); assert.equal(await bal(c), c0, 'C는 안 냄'); assert.equal(await count(c, 'herb'), 0, 'C는 못 받음');
  assert.equal(await count(b, 'herb'), 2, 'B가 받음'); assert.equal(await bal(b), b0 - 8000);
  assert.equal((await req('/api/island/flea/buy', b, { id: id1 })).data.error, 'FLEA_GONE');
  // a reservation with no charge (the charge failed): let go -- anyone may buy it
  const id2 = await put(1, 4000); await fail('questApply'); assert.notEqual((await req('/api/island/flea/buy', b, { id: id2 })).status, 200);
  const c1 = await bal(c); assert.equal((await req('/api/island/flea/buy', c, { id: id2 })).status, 200); assert.equal(await bal(c), c1 - 4000); assert.equal(await count(c, 'herb'), 1);

  // P1-4: 거두기 -- the thing back, then the board's save stops: not on the board to be sold again, and not given twice
  const id3 = await put(3, 12000); assert.equal(await count(a, 'herb'), 3);
  await fail('setWorldValue', 1); assert.notEqual((await req('/api/island/flea/withdraw', a, { id: id3 })).status, 200);
  assert.equal(await count(a, 'herb'), 6, '돌려받음'); assert.ok(!(await req('/api/island/flea', c)).data.list.some((x) => x.id === id3), '게시판에서 내려감');
  assert.equal((await req('/api/island/flea/buy', c, { id: id3 })).data.error, 'FLEA_GONE');
  await req('/api/island/flea', a); assert.equal(await count(a, 'herb'), 6, '다시 봐도 한 번만'); assert.equal((await req('/api/island/flea', a)).data.held, 0);

  // P1-3: 받기 paid, its save stops -- the 3 days' auto pay does not pay it again; and auto paid, its save stops -- 받기 does not
  const owed = (await req('/api/island/flea', a)).data.owed; assert.equal(owed, (8000 - 400) + (4000 - 200));
  const a0 = await bal(a); await fail('setWorldValue'); assert.notEqual((await req('/api/island/flea/claim', a, {})).status, 200);
  assert.equal(await bal(a), a0 + owed, '받기로 한 번');
  await req('/api/test/flea/expire', a, {}); await req('/api/island/flea', a); assert.equal(await bal(a), a0 + owed, '자동 지급이 또 주지 않음');
  assert.equal((await req('/api/island/flea', a)).data.owed, 0);
  const id4 = await put(1, 6000); assert.equal((await req('/api/island/flea/buy', b, { id: id4 })).status, 200);
  const a1 = await bal(a); await req('/api/test/flea/expire', a, {}); await fail('setWorldValue'); assert.notEqual((await req('/api/island/flea', a)).status, 200); /* (the look's tidy pays, its save stops) */
  assert.equal(await bal(a), a1 + 5700, '자동 지급 한 번');
  const again = await req('/api/island/flea/claim', a, {}); assert.ok(again.data.error === 'FLEA_NOTHING' || again.status === 200, JSON.stringify(again.data));
  assert.equal(await bal(a), a1 + 5700, '받기가 또 주지 않음');
});

test('도장 가게 멈춤: 가구 전달 기록이 남아, 벼룩시장에 맡긴 뒤 다시 사도 새로 안 줌 · 표시 저장이 멈추면 한 번만 줌', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stamp-stops-')); rmAtExit(dir);
  const { req, issue, enter } = await boot(t, dir);
  const a = await enter(await issue('도장모으는이')); const P = C.PLACES;
  const stand = (p) => req('/api/plaza/state', a, { x: p.x, z: p.z, yaw: 0, moving: false });
  const pieces = async () => (await req('/api/island/furniture/mine', a)).data.pieces.filter((p) => p.id.startsWith('straw_sheaf'));
  await req('/api/test/festival/clock', null, { at: Date.parse('2026-11-26T19:00:00+09:00') });
  await stand(P.feast); assert.equal((await req('/api/island/festival/feast', a, {})).data.festival.stamps, 3);
  // the stamps spent and the piece put in; marking it handed over stops -- the second try hands it over once (no second piece)
  await stand(P.stall); await req('/api/test/store/fail', null, { method: 'questApply', skip: 1 });
  assert.notEqual((await req('/api/island/festival/buy', a, { id: 'straw_sheaf' })).status, 200); assert.equal((await pieces()).length, 1);
  const retry = await req('/api/island/festival/buy', a, { id: 'straw_sheaf' }); assert.equal(retry.status, 200, JSON.stringify(retry.data)); assert.equal((await pieces()).length, 1, '하나만');
  // put on the 벼룩시장 (out of the 창고), asked again: OWNED -- nothing new
  const piece = (await pieces())[0]; const worth = (await req('/api/island/flea/stock', a)).data.pieces.find((p) => p.uid === piece.uid)?.worth;
  assert.ok(worth > 0, '도장 가구도 벼룩시장에 올릴 수 있음');
  const listed = await req('/api/island/flea/list', a, { requestId: crypto.randomUUID(), uid: piece.uid, price: worth }); assert.equal(listed.status, 200, JSON.stringify(listed.data)); assert.equal((await pieces()).length, 0);
  assert.equal((await req('/api/island/festival/buy', a, { id: 'straw_sheaf' })).data.error, 'OWNED'); assert.equal((await pieces()).length, 0, '다시 사도 새로 안 줌');
  assert.equal((await req('/api/island/flea/withdraw', a, { id: listed.data.listing.id })).status, 200); assert.equal((await pieces()).length, 1, '거두면 하나');
  await req('/api/test/festival/clock', null, { at: 0 });
});
