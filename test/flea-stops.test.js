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
  const fail = (method, skip = 0, key = method === 'setWorldValue' ? 'flea' : null) => req('/api/test/store/fail', null, { method, skip, key }); /* (1.10.345: only the board's own save -- a background save never takes it) */
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
  await stand(P.stall); await req('/api/test/store/fail', null, { method: 'questApply', skip: 1, key: 'fest:harvest-2026' });
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

test('P2 5: 올리기 저장이 멈춰도 물건은 안 사라짐 -- 같은 요청 다시·다음에 볼 때 한 번 올라감 (물건·가구)', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'flea-list-stops-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server; const a = await server.enter(await server.issue('올리는이'));
  const fail = (method, skip = 0, key = method === 'setWorldValue' ? 'flea' : null) => req('/api/test/store/fail', null, { method, skip, key }); /* (1.10.345: only the board's own save -- a background save never takes it) */
  await req('/api/test/island/give', a, { itemId: 'herb', qty: 4 });
  const e = (await req('/api/island/flea/stock', a)).data.items.find((x) => x.itemId === 'herb'); const requestId = crypto.randomUUID();
  await fail('setWorldValue'); assert.notEqual((await req('/api/island/flea/list', a, { requestId, entryId: e.entryId, qty: 2, price: 8000 })).status, 200);
  const again = await req('/api/island/flea/list', a, { requestId, entryId: e.entryId, qty: 2, price: 8000 }); assert.equal(again.status, 200, JSON.stringify(again.data));
  const mine = () => req('/api/island/flea', a).then((r) => r.data.list.filter((x) => x.mine));
  assert.equal((await mine()).length, 1, '한 번 올라감'); assert.equal((await mine())[0].qty, 2);
  assert.equal(((await req('/api/island/bag', a)).data.items.find((x) => x.itemId === 'herb') || {}).qty, 2, '가방은 두 개만 빠짐');
  // a piece: out of the 창고, the board's save stops -- up at the next look, once
  const added = (await req('/api/test/home/furniture', a, { ids: ['aquarium_big__oak'] })).data.pieces[0];
  const worth = (await req('/api/island/flea/stock', a)).data.pieces.find((p) => p.uid === added.uid).worth;
  await fail('setWorldValue'); assert.notEqual((await req('/api/island/flea/list', a, { requestId: crypto.randomUUID(), uid: added.uid, price: worth })).status, 200); /* (the board's save: the 창고's is another key) */
  assert.ok(!(await req('/api/island/furniture/mine', a)).data.pieces.some((p) => p.uid === added.uid));
  assert.equal((await mine()).filter((x) => x.kind === 'piece').length, 1, '다음에 볼 때 올라감'); assert.equal((await mine()).filter((x) => x.kind === 'piece').length, 1, '한 번만');
});

test('P2 6·8: 산 물고기 표시가 수조·선물로 옮겨도 남음, 오래 멈춘 뒤 음악이 몰아서 나지 않음', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bought-mark-')); rmAtExit(dir);
  const { JsonPointStore } = require('../lib/point-store');
  const store = new JsonPointStore(path.join(dir, 'points.json'), { initialGrant: 0 }); await store.init();
  const u = 'guest:00000000-0000-4000-8000-0000000000f1'; const v = 'guest:00000000-0000-4000-8000-0000000000f2'; await store.ensureAccount(u); await store.ensureAccount(v);
  await store.islandGive({ userId: u, claimId: 'test:bought', itemId: 'fish_anchovy', qty: 1, meta: { sizes: [30], bought: true }, quiet: true });
  const used = await store.islandUse({ userId: u, requestId: 'hometank-00000001', itemId: 'fish_anchovy', keep: true }); assert.equal(used.applied, true); assert.equal(used.bought, true, '수조에 넣을 때 산 것임을 앎');
  await store.islandGive({ userId: u, claimId: 'test:bought2', itemId: 'fish_anchovy', qty: 1, meta: { sizes: [31], bought: true }, quiet: true });
  await store.islandGive({ userId: u, claimId: 'test:wrap', itemId: 'gift_wrap', qty: 1, quiet: true });
  assert.equal((await store.islandGift({ userId: u, to: v, itemId: 'fish_anchovy', requestId: 'gift-00000001' })).applied, true);
  assert.equal((await store.islandBag(v)).items.find((e) => e.itemId === 'fish_anchovy').meta.bought, true, '선물로 받아도 산 것');
  // 8: the music box -- a 10 minutes' pause makes the next notes only (not ten minutes of them at once)
  let made = 0; let clock = 0; const node = () => ({ connect: (x) => x || node(), gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} }, frequency: { setValueAtTime() {} }, start() {}, stop() {} });
  globalThis.AudioContext = class { constructor() { this.state = 'running'; this.destination = node(); } get currentTime() { return clock; } createGain() { return node(); } createOscillator() { made += 1; return node(); } resume() { return Promise.resolve(); } };
  const M = require('../public/plaza/xmas-music.js'); const box = M.create();
  box.step(1, true); clock = 600; made = 0; box.step(1, true); assert.ok(made < 30, `${made}개`); delete globalThis.AudioContext;
});