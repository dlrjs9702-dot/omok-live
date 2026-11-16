'use strict';
// 1.10.339 섬 벼룩시장 (lib/island-flea.js; notes island-auction 49A·50A·134·135B·136A·137A·138A): the rules, then the real server --
// put up at a price of 0.5~20 times its worth, bought once by someone else (a fish its size), 5 % kept back, the rest 「받기」 at the
// board, a letter to the seller; taken back any time before it sells; after 3 days back to the seller; a piece of furniture too
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');
const F = require('../lib/island-flea');
const I = require('../lib/island-items');

test('벼룩시장 규칙: 올릴 수 있는 것, 값 범위, 수수료, 한 사람 10개, 팔리면 받을 돈', () => {
  assert.equal(F.sellable('herb'), true); assert.equal(F.sellable('fish_anchovy'), true); assert.equal(F.sellable('bait'), true); assert.equal(F.sellable('weed'), true);
  for (const id of ['bugnet', 'fishing_rod', 'pickaxe', 'bike_mint', 'pet_puppy', 'wallet', 'lost', 'trash', 'compost', 'candy', 'nope']) assert.equal(F.sellable(id), false, id);
  assert.deepEqual(F.range(1000), [500, 20000]); assert.deepEqual(F.range(1), [1, 20]); assert.equal(F.feeOf(1000), 50); assert.equal(F.netOf(1000), 950); assert.equal(F.feeOf(999), 50);
  assert.equal(F.worth('herb', 3, null, Date.now()), I.priceOf('herb') * 3); assert.equal(F.worth('bait', 2, null, Date.now(), () => 300), 600, '잡화는 상점값');
  let s = F.stateOf(null); const now = Date.parse('2026-12-02T12:00:00+09:00');
  assert.equal(F.put(s, 'a', '가', { kind: 'item', itemId: 'herb', qty: 1 }, 100, 4000, now).error, 'PRICE');
  for (let k = 0; k < F.MINE_MAX; k += 1) s = F.put(s, 'a', '가', { kind: 'item', itemId: 'herb', qty: 1 }, 4000, 4000, now + k).state;
  assert.equal(F.put(s, 'a', '가', { kind: 'item', itemId: 'herb', qty: 1 }, 4000, 4000, now).error, 'LIMIT'); assert.equal(new Set(s.list.map((l) => l.id)).size, F.MINE_MAX, '번호는 겹치지 않음');
  const l = s.list[0]; assert.equal(l.until - l.at, 3 * 86400000);
  s = F.sold(s, l, now); s = F.sold(s, s.list[0], now + 1000); assert.equal(s.owed.a.amount, 2 * 3800);
  { const od = F.overdue(s, now + 3 * 86400000); assert.equal(od.due.length, 1); assert.equal(od.state.owed.a.amount, 3800); assert.equal(F.overdue(s, now + 1000).due.length, 0); } assert.equal(F.view(s, 'a', now).owed, 7600); assert.equal(F.view(s, 'b', now).list[0].mine, false);
  assert.ok(!JSON.stringify(F.view(s, 'b', now)).includes('"a"'), '파는 사람 계정은 보이지 않음');
  s = F.claimed(s, 'a'); assert.deepEqual(s.owed.a, { amount: 0, n: 1, list: [] });
  assert.equal(F.expired(s, now + 3 * 86400000 + 10).length, s.list.length);
  const bag = [{ entryId: 'f', itemId: 'fish_anchovy', qty: 3, meta: { sizes: [40, 30, 20] } }];
  assert.deepEqual(I.takeEntry(bag, 'f', 2), { keep: [{ entryId: 'f', itemId: 'fish_anchovy', qty: 1, meta: { sizes: [40] } }], sizes: [30, 20] }, '작은 것부터, 크기 그대로');
  assert.equal(I.takeEntry(bag, 'f', 4), null); assert.equal(I.takeEntry(bag, 'x', 1), null);
});

test('「산 것」(review-plan §1-3): 산 물고기·곤충은 따로 쌓이고, 팔면 낚시왕 셈에서 빠지고, 박물관은 잡은 것만', () => {
  let bag = I.addToBag([], 'fish_anchovy', 2, 'a', { sizes: [30, 20] });
  bag = I.addToBag(bag, 'fish_anchovy', 1, 'b', { sizes: [50], bought: true });
  assert.equal(bag.length, 2, '산 것은 잡은 것과 한 칸에 섞이지 않음'); assert.equal(bag.find((e) => e.meta?.bought).meta.sizes[0], 50);
  assert.equal(I.pickSize(bag, 'fish_anchovy', true), 50); assert.equal(I.pickSize(bag, 'fish_anchovy', true, true), 30, '박물관은 잡은 것 중 가장 큰 것');
  assert.deepEqual(I.takeFromBag(bag, 'fish_anchovy', 1, true, true).find((e) => !e.meta?.bought).meta.sizes, [20]);
  const sale = I.sellAt(bag, 'fisher', 0); assert.equal(sale.sold.find((s) => s.bought).qty, 1); assert.equal(sale.sold.find((s) => !s.bought).qty, 2);
  const boxed = I.addToBag([], 'insect_' + Object.keys(require('../lib/island-insects').SPECIES)[0], 1, 'i', { bought: true }, { bag: 16, fish: 0, insect: 30 });
  assert.equal(boxed[0].meta.box, 'insect'); assert.equal(boxed[0].meta.bought, true, '채집통에서도 표시가 남음');
  const moved = I.fillBox([{ entryId: 'z', itemId: 'fish_anchovy', qty: 1, meta: { sizes: [40], bought: true } }], 'fish', { bag: 16, fish: 30, insect: 0 });
  assert.equal(moved.entries[0].meta.bought, true, '물고기 통으로 옮겨도 표시가 남음');
});

test('벼룩시장 서버: 올리기·사기(크기 그대로)·내 물건 못 사기·거두기·받기(5% 뗌)·편지·3일 뒤 돌려받기·가구', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'flea-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('파는이')); const b = await server.enter(await server.issue('사는이'));
  { const key = (await req('/api/admin/keys', server.admin)).data.keys.find((k) => k.label === '사는이'); await req(`/api/admin/keys/${key.id}/points`, server.admin, { amount: 900000, category: 'other', memo: '시험', requestId: crypto.randomUUID() }); }
  const bal = async (who) => (await req('/api/points', who)).data.balance;
  const bagOf = async (who) => (await req('/api/island/bag', who)).data.items;
  const rid = () => crypto.randomUUID();
  await req('/api/test/island/give', a, { itemId: 'fish_anchovy', qty: 1, meta: { sizes: [33.5] } });
  await req('/api/test/island/give', a, { itemId: 'herb', qty: 5 });
  const st = (await req('/api/island/flea/stock', a)).data; const fish = st.items.find((x) => x.itemId === 'fish_anchovy'); const herb = st.items.find((x) => x.itemId === 'herb');
  assert.deepEqual(fish.sizes, [33.5]); assert.equal(herb.qty, 5); assert.equal(herb.unit, I.priceOf('herb'));
  // the price kept within 0.5~20 times
  const low = await req('/api/island/flea/list', a, { requestId: rid(), entryId: fish.entryId, qty: 1, price: 1 }); assert.equal(low.status, 400); assert.equal(low.data.error, 'FLEA_PRICE');
  const put = await req('/api/island/flea/list', a, { requestId: rid(), entryId: fish.entryId, qty: 1, price: fish.each[0] * 2 }); assert.equal(put.status, 200, JSON.stringify(put.data));
  assert.ok(!(await bagOf(a)).some((e) => e.itemId === 'fish_anchovy'), '올리면 가방에서 빠짐');
  const herbPut = await req('/api/island/flea/list', a, { requestId: rid(), entryId: herb.entryId, qty: 2, price: 8000 }); assert.equal(herbPut.status, 200, JSON.stringify(herbPut.data));
  assert.equal((await bagOf(a)).find((e) => e.itemId === 'herb').qty, 3);
  // the board: both up, the seller's name only
  const board = (await req('/api/island/flea', b)).data; assert.equal(board.list.length, 2); assert.ok(board.list.every((x) => x.seller === '파는이' && !x.mine));
  assert.equal(board.list.find((x) => x.itemId === 'fish_anchovy').cat, 'fish');
  // mine I cannot buy (134: only that is stopped)
  assert.equal((await req('/api/island/flea/buy', a, { id: put.data.listing.id })).data.error, 'FLEA_OWN');
  // bought: the points out, the fish in with its size, once
  const before = await bal(b); const buy = await req('/api/island/flea/buy', b, { id: put.data.listing.id }); assert.equal(buy.status, 200, JSON.stringify(buy.data));
  assert.equal(await bal(b), before - fish.each[0] * 2);
  assert.deepEqual((await bagOf(b)).find((e) => e.itemId === 'fish_anchovy').sizes, [33.5], '물고기 크기 그대로');
  assert.equal((await bagOf(b)).find((e) => e.itemId === 'fish_anchovy').meta.bought, true, '「산 것」 표시');
  assert.equal((await req('/api/island/flea/buy', b, { id: put.data.listing.id })).data.error, 'FLEA_GONE');
  // the seller: a letter, money waiting -- 받기 (less 5 %), once
  const mail = (await req('/api/island/mail', a)).data.letters; assert.ok(mail.some((l) => l.fromName === '섬 벼룩시장' && l.text.includes('팔렸어요')), JSON.stringify(mail));
  const price = fish.each[0] * 2; const net = price - Math.ceil(price * 0.05);
  assert.equal((await req('/api/island/flea', a)).data.owed, net);
  const had = await bal(a); const got = await req('/api/island/flea/claim', a, {}); assert.equal(got.status, 200, JSON.stringify(got.data)); assert.equal(got.data.amount, net); assert.equal(await bal(a), had + net);
  assert.equal((await req('/api/island/flea/claim', a, {})).data.error, 'FLEA_NOTHING');
  const hist = JSON.stringify((await req('/api/points/history?limit=10', a)).data); assert.ok(hist.includes('flea_sale'));
  // taken back before it sells: into the bag, nothing paid
  const back = await req('/api/island/flea/withdraw', a, { id: herbPut.data.listing.id }); assert.equal(back.status, 200, JSON.stringify(back.data)); assert.equal((await bagOf(a)).find((e) => e.itemId === 'herb').qty, 5);
  assert.equal((await req('/api/island/flea/withdraw', b, { id: herbPut.data.listing.id })).data.error, 'FLEA_GONE');
  // up 3 days: back to its seller with a letter
  const h2 = (await req('/api/island/flea/stock', a)).data.items.find((x) => x.itemId === 'herb');
  assert.equal((await req('/api/island/flea/list', a, { requestId: rid(), entryId: h2.entryId, qty: 5, price: 20000 })).status, 200);
  assert.ok(!(await bagOf(a)).some((e) => e.itemId === 'herb'));
  await req('/api/test/flea/expire', a, {}); assert.equal((await req('/api/island/flea', b)).data.list.length, 0);
  assert.equal((await bagOf(a)).find((e) => e.itemId === 'herb').qty, 5, '3일 지나면 돌려받음');
  assert.ok((await req('/api/island/mail', a)).data.letters.some((l) => l.text.includes('팔리지 않아 돌려드렸어요')));
  // a piece of furniture not placed: up, bought into the buyer's 가구 창고 (the same piece)
  const added = (await req('/api/test/home/furniture', a, { ids: ['aquarium_big__oak'] })).data.pieces[0];
  const sp = (await req('/api/island/flea/stock', a)).data.pieces.find((p) => p.uid === added.uid); assert.ok(sp && sp.worth > 0, JSON.stringify(sp));
  const pp = await req('/api/island/flea/list', a, { requestId: rid(), uid: added.uid, price: sp.worth }); assert.equal(pp.status, 200, JSON.stringify(pp.data));
  assert.ok(!(await req('/api/island/furniture/mine', a)).data.pieces.some((p) => p.uid === added.uid));
  assert.equal((await req('/api/island/flea/buy', b, { id: pp.data.listing.id })).status, 200);
  assert.ok((await req('/api/island/furniture/mine', b)).data.pieces.some((p) => p.uid === added.uid && p.id === 'aquarium_big__oak'));
  // money not taken in 3 days: into the wallet by itself, with a letter (review-plan §1-2)
  const owedNow = (await req('/api/island/flea', a)).data.owed; assert.equal(owedNow, sp.worth - Math.ceil(sp.worth * 0.05));
  const had2 = await bal(a); await req('/api/test/flea/expire', a, {}); assert.equal((await req('/api/island/flea', b)).data.owed, 0);
  assert.equal((await req('/api/island/flea', a)).data.owed, 0); assert.equal(await bal(a), had2 + owedNow);
  assert.ok((await req('/api/island/mail', a)).data.letters.some((l) => l.text.includes('받지 않은 판 돈')));
  // ten at most a seller
  await req('/api/test/island/give', a, { itemId: 'branch', qty: 20 });
  const br = (await req('/api/island/flea/stock', a)).data.items.find((x) => x.itemId === 'branch');
  for (let k = 0; k < 10; k += 1) assert.equal((await req('/api/island/flea/list', a, { requestId: rid(), entryId: br.entryId, qty: 1, price: 500 })).status, 200);
  assert.equal((await req('/api/island/flea/list', a, { requestId: rid(), entryId: br.entryId, qty: 1, price: 500 })).data.error, 'FLEA_LIMIT');
});
