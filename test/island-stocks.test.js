'use strict';
// v1.10.320 섬 주식 (lib/island-stocks.js; gamecenter-notes docs/island-stocks-20261114.md): the market -- the same prices from the
// same seed, nine prices a day 09~17 Seoul, no bound on a move, delistings one to three a week (below a tenth of the listing, or a
// 부도) after a day of 정리 매매, a new company in the place 1~3 days on; orders -- whole shares, 0.5 %, 1,000 a company, 20 a day
// (정리 매매's sells not counted), closed outside the hours; the server -- points taken and paid with the holdings in one step,
// one request once, the week's ranking.
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { boot } = require('../test-support/test-server');
const S = require('../lib/island-stocks');
const HOUR = 3600000;
const at = (day, hour, min = 0) => S.tickTime(day * S.PER_DAY) + (hour - S.OPEN) * HOUR + min * 60000; // (day from the first, Seoul hour)

test('섬 주식 시장: 같은 씨앗 같은 값, 하루 9번(9~17시), 장 시간, 상한 없음, 주에 1~3개 폐지(정리 매매 하루 뒤), 1~3일 뒤 새 회사', () => {
  const a = S.createMarket('t'); const b = S.createMarket('t');
  assert.deepEqual(a.view(at(20, 12, 30)), b.view(at(20, 12, 30)), '같은 씨앗 같은 값');
  assert.equal(S.tickAt(at(0, 8, 59)), -1); assert.equal(S.tickAt(at(0, 9)), 0); assert.equal(S.tickAt(at(0, 17, 30)), 8); assert.equal(S.tickAt(at(1, 3)), 8); assert.equal(S.tickAt(at(1, 9)), 9);
  assert.ok(!S.isOpen(at(0, 8, 59)) && S.isOpen(at(0, 9)) && S.isOpen(at(0, 16, 59)) && !S.isOpen(at(0, 17)), '9시~5시 전');
  const v = S.createMarket('t').view(at(0, 9, 5)); assert.equal(v.companies.length, 30); assert.equal(new Set(v.companies.map((c) => c.name)).size, 30);
  assert.ok(v.companies.every((c) => c.price >= 1000 && c.price <= 10000 && c.price % 100 === 0), '상장가 1,000~10,000P');
  // eight weeks: how many went, the hourly moves (some beyond 8 %), every price above 0
  const m = S.createMarket('t'); const weeks = new Map(); let big = 0;
  for (let k = 0; k < 8 * 7 * S.PER_DAY; k += 1) m.view(S.tickTime(k) + 1000);
  for (const sl of m.slots) { for (let i = 1; i < sl.prices.length; i += 1) { assert.ok(sl.prices[i] >= 1); if (Math.abs(sl.prices[i] / sl.prices[i - 1] - 1) > 0.08) big += 1; } }
  assert.ok(big > 0, '한 시간에 8% 넘게 움직이기도 함');
  const went = m.slots.reduce((n, sl) => n + sl.gen + (sl.status === 'active' ? 0 : 1), 0); assert.ok(went >= 6 && went <= 30, `8주에 폐지 ${went}`);
  for (let w = 0; w < 8; w += 1) { const p = m.planOf(w); assert.ok(p.n >= 1 && p.n <= 3); }
  // one company through it: active -> cleanup (a day) -> gone -> a new one 1~3 days on
  const sl = m.slots.find((x) => x.gen >= 1); assert.ok(sl, '새로 상장한 회사가 있음');
  void weeks;
});

test('섬 주식 주문: 1주 단위·수수료 0.5%·한 회사 1,000주·하루 20번·장 밖 막힘·정리 매매는 팔기만(상한에서 뺌)', () => {
  const m = S.createMarket('o'); const t = at(2, 10, 10); const c = m.view(t).companies.find((x) => x.status === 'active');
  assert.equal(S.order(m, {}, { code: c.code, side: 'buy', qty: 1 }, at(2, 8, 30)).error, 'CLOSED');
  assert.equal(S.order(m, {}, { code: c.code, side: 'buy', qty: 1.5 }, t).error, 'QTY');
  const b = S.order(m, {}, { code: c.code, side: 'buy', qty: 10 }, t); assert.equal(b.cost, c.price * 10 + Math.max(1, Math.ceil(c.price * 10 * 0.005)));
  assert.equal(S.order(m, b.doc, { code: c.code, side: 'buy', qty: 991 }, t).error, 'HOLD');
  assert.equal(S.order(m, b.doc, { code: c.code, side: 'sell', qty: 11 }, t).error, 'SHARES');
  const s = S.order(m, b.doc, { code: c.code, side: 'sell', qty: 4 }, t); assert.equal(s.reward, c.price * 4 - Math.max(1, Math.ceil(c.price * 4 * 0.005))); assert.equal(s.doc.h[c.code].q, 6);
  let doc = s.doc; for (let i = 2; i < 20; i += 1) doc = S.order(m, doc, { code: c.code, side: 'buy', qty: 1 }, t).doc;
  assert.equal(S.order(m, doc, { code: c.code, side: 'buy', qty: 1 }, t).error, 'LIMIT'); assert.equal(S.mine(m, doc, t).ordersLeft, 0);
  assert.equal(S.order(m, doc, { code: c.code, side: 'buy', qty: 1 }, at(3, 9, 1)).error, undefined, '다음 날 다시 20번');
  // 정리 매매: find a company on its cleanup day -- buying refused, selling free of the day's limit
  const w = S.createMarket('o'); let found = null;
  for (let k = 0; k < 6 * 7 * S.PER_DAY && !found; k += 1) { const v = w.view(S.tickTime(k) + 1000); const x = v.companies.find((y) => y.status === 'cleanup'); if (x && k % S.PER_DAY < S.PER_DAY - 1) found = { x, ms: S.tickTime(k) + 1000 }; }
  assert.ok(found, '정리 매매 날이 있음');
  const full = { h: { [found.x.code]: { q: 5, c: 5000 } }, d: { day: S.dayOf(found.ms), n: 20 } };
  assert.equal(S.order(w, full, { code: found.x.code, side: 'buy', qty: 1 }, found.ms).error, 'CLEANUP');
  const out = S.order(w, full, { code: found.x.code, side: 'sell', qty: 5 }, found.ms); assert.ok(out.reward > 0, '정리 매매 팔기는 하루 상한과 상관없이'); assert.equal(out.doc.d.n, 20);
});

test('Codex 311~320: 시세는 서버 키로(키마다 다름, 키 없으면 안 만듦) · 종목 코드는 정규형만(1,000주 우회 막힘) · 늦은 주간 정산은 그 주 자료로', () => {
  // #1: the key makes the prices; no public default
  assert.throws(() => S.createMarket(), TypeError);
  const k1 = S.createMarket('a'.repeat(64)).view(at(3, 12)); const k2 = S.createMarket('b'.repeat(64)).view(at(3, 12));
  assert.notDeepEqual(k1.companies.map((c) => c.price), k2.companies.map((c) => c.price), '키가 다르면 시세가 다름');
  // #2: one company, one code
  assert.deepEqual(S.parseCode('0.0'), [0, 0]); assert.deepEqual(S.parseCode('29.12'), [29, 12]);
  for (const bad of ['00.0', '0.00', ' 0.0', '0.0 ', '30.0', '1e0.0', '-0.0', '0x1.0', '0', 0]) assert.equal(S.parseCode(bad), null, `코드 ${JSON.stringify(bad)}`);
  const m = S.createMarket('o'); const t = at(2, 10, 10); const c = m.view(t).companies.find((x) => x.status === 'active');
  const alias = c.code.replace(/^/, '0'); assert.equal(S.order(m, {}, { code: alias, side: 'buy', qty: 1 }, t).error, 'GONE', '앞에 0 붙인 코드는 없는 회사');
  const full = S.order(m, {}, { code: c.code, side: 'buy', qty: S.HOLD_MAX }, t); assert.equal(full.error, undefined);
  assert.equal(S.order(m, full.doc, { code: alias, side: 'buy', qty: S.HOLD_MAX }, t).error, 'GONE'); assert.deepEqual(Object.keys(full.doc.h), [c.code]);
  // #5: week 0's return read after a Monday order (and with the market a few days on) is week 0's own -- at its close's prices
  const weekEnd = (w) => S.tickTime(7 * (w + 1) * S.PER_DAY) - S.OPEN * HOUR - 1; /* (Sunday 23:59:59.999 Seoul) */ const end0 = weekEnd(0); const r0 = S.weekReturn(m, full.doc, end0); assert.ok(Number.isFinite(r0));
  const other = m.view(at(7, 10)).companies.find((x) => x.status === 'active' && x.code !== c.code);
  const mon = S.order(m, full.doc, { code: other.code, side: 'buy', qty: 3 }, at(7, 10)); assert.equal(mon.doc.w.week, 1); assert.equal(mon.doc.last.week, 0);
  m.view(at(10, 15)); assert.equal(S.weekReturn(m, mon.doc, end0), r0, '월요일 주문 뒤에 정산해도 같은 값');
  const held = m.priceAt(c.code, 7 * S.PER_DAY - 1) * S.HOLD_MAX; const base = full.doc.w.start + full.doc.w.buys; assert.equal(r0, ((held - base) / base) * 100, '그 주 마감 값으로');
  // a week without an order: what was held through it, from its start
  const end1 = weekEnd(1); const r1 = S.weekReturn(m, full.doc, end1); const s1 = m.priceAt(c.code, 7 * S.PER_DAY - 1) * S.HOLD_MAX;
  assert.equal(r1, ((m.priceAt(c.code, 14 * S.PER_DAY - 1) * S.HOLD_MAX - s1) / s1) * 100);
  assert.equal(S.weekReturn(m, mon.doc, weekEnd(2)) === null, false); assert.equal(S.weekReturn(m, { h: {} }, end0), null);
  // a company since gone keeps its prices (a past week's value)
  for (let k = 0; k < 6 * 7 * S.PER_DAY; k += 1) m.view(S.tickTime(k) + 1000);
  const sl = m.slots.find((x) => x.gen >= 1); assert.ok(sl); assert.equal(m.priceAt(`${sl.s}.0`, 0), sl.past[0].prices[0]);
});

test('1.10.321 옛 시세 주식 돌려주기: 거래 없으면 아무 일도 안 함 · 산 값(수수료 포함) 그대로 포인트 · 기록 비움 · 한 번만', async () => {
  const { JsonPointStore } = require('../lib/point-store');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stockrefund-')); rmAtExit(dir);
  const store = new JsonPointStore(path.join(dir, 'points.json'), { initialGrant: 0 }); await store.init();
  const letters = []; const letter = (u, n) => { letters.push([u, n]); };
  const ledger = async () => (await store.economyStats(14, Date.now())).flows.filter((f) => f.reason === 'stock_refund');
  // no trade at all: nothing
  await store.ensureAccount('guest:00000000-0000-4000-8000-000000000001'); assert.deepEqual(await S.refundOldStocks(store, letter), []); assert.equal(letters.length, 0); assert.equal((await ledger()).length, 0);
  // the old market (no v): one holding, one sold out; the new market (v 2): left alone
  const old = { h: { '3.0': { q: 10, c: 50250 }, '7.1': { q: 2, c: 4020 } }, d: { day: S.FIRST_DAY, n: 2 }, w: { week: 0, start: 0, buys: 54270, sells: 0 } };
  await store.questApply('guest:00000000-0000-4000-8000-000000000002', 'stocks', () => ({ doc: old })); await store.questApply('guest:00000000-0000-4000-8000-000000000003', 'stocks', () => ({ doc: { h: {}, d: { day: S.FIRST_DAY, n: 2 }, w: { week: 0, start: 0, buys: 1005, sells: 995 } } }));
  await store.questApply('guest:00000000-0000-4000-8000-000000000004', 'stocks', () => ({ doc: { v: S.MARKET_V, h: { '3.0': { q: 1, c: 5025 } } } }));
  const done = await S.refundOldStocks(store, letter);
  assert.deepEqual(done.map((x) => [x.userId, x.refund]).sort(), [['guest:00000000-0000-4000-8000-000000000002', 54270], ['guest:00000000-0000-4000-8000-000000000003', 0]]);
  assert.deepEqual(letters, [['guest:00000000-0000-4000-8000-000000000002', 54270]], '돌려받은 사람에게만 우편 한 통');
  assert.deepEqual((await store.questDoc('guest:00000000-0000-4000-8000-000000000002', 'stocks')).doc, { v: S.MARKET_V }, '보유·주문 기록 비움'); assert.deepEqual((await store.questDoc('guest:00000000-0000-4000-8000-000000000003', 'stocks')).doc, { v: S.MARKET_V });
  assert.equal((await store.questDoc('guest:00000000-0000-4000-8000-000000000004', 'stocks')).doc.h['3.0'].q, 1, '새 시세 주식은 그대로');
  assert.equal((await ledger()).reduce((n, f) => n + f.in, 0), 54270, '산 값 그대로 포인트');
  assert.deepEqual(await S.refundOldStocks(store, letter), [], '두 번째는 아무 일도 없음'); assert.equal(letters.length, 1);
  // an order on the new market marks the doc
  const m = S.createMarket('o'); const t = at(2, 10, 10); const c = m.view(t).companies.find((x) => x.status === 'active');
  assert.equal(S.order(m, {}, { code: c.code, side: 'buy', qty: 1 }, t).doc.v, S.MARKET_V);
});

test('섬 주식 서버: 사고팔면 포인트가 같이 빠지고 들어옴, 같은 주문 번호는 한 번, 장 밖 막힘, 주간 수익률 순위', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stocks-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('주식부자')); const b = await server.enter(await server.issue('주식초보'));
  for (const label of ['주식부자', '주식초보']) { const key = (await req('/api/admin/keys', server.admin)).data.keys.find((k) => k.label === label); await req(`/api/admin/keys/${key.id}/points`, server.admin, { amount: 900000, category: 'other', memo: '시험', requestId: crypto.randomUUID() }); }
  const bal = async (who) => (await req('/api/points', who)).data.balance;
  await req('/api/test/stocks/clock', a, { at: at(1, 8, 0) });
  const v0 = (await req('/api/island/stocks', a)).data; assert.equal(v0.open, false); assert.equal(v0.companies.length, 30);
  { const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')); const kept = (await Promise.all(files.map((f) => fs.readFile(path.join(dir, f), 'utf8')))).join('\n'); assert.match(kept, /"stocksKey":\s*"[0-9a-f]{64}"/, '시세 키는 서버 저장소에 한 번 만들어 둠'); assert.doesNotMatch(JSON.stringify(v0), /stocksKey|[0-9a-f]{64}/, '보드에는 키가 없음'); }
  const c = v0.companies.find((x) => x.status === 'active');
  assert.equal((await req('/api/island/stocks/order', a, { code: c.code, side: 'buy', qty: 1, requestId: crypto.randomUUID() })).data.error, 'CLOSED');
  await req('/api/test/stocks/clock', a, { at: at(1, 10, 30) });
  const v = (await req('/api/island/stocks', a)).data; const co = v.companies.find((x) => x.code === c.code); assert.equal(v.open, true);
  const before = await bal(a); const rid = crypto.randomUUID();
  const r1 = await req('/api/island/stocks/order', a, { code: co.code, side: 'buy', qty: 20, requestId: rid }); assert.equal(r1.status, 200);
  const cost = co.price * 20 + Math.max(1, Math.ceil(co.price * 20 * 0.005)); assert.equal(await bal(a), before - cost);
  assert.equal((await req('/api/island/stocks/order', a, { code: co.code, side: 'buy', qty: 20, requestId: rid })).status, 409, '같은 주문 번호는 한 번');
  assert.equal(await bal(a), before - cost); assert.equal(r1.data.mine.rows[0].qty, 20);
  const r2 = await req('/api/island/stocks/order', a, { code: co.code, side: 'sell', qty: 5, requestId: crypto.randomUUID() }); assert.equal(r2.status, 200);
  assert.equal(await bal(a), before - cost + co.price * 5 - Math.max(1, Math.ceil(co.price * 5 * 0.005))); assert.equal(r2.data.mine.rows[0].qty, 15);
  const hist = (await req('/api/points/history?limit=10', a)).data; const reasons = JSON.stringify(hist); assert.ok(reasons.includes('stock_buy') && reasons.includes('stock_sell'), '포인트 내역에 주식');
  // b buys another; a day later the ranking shows both, the better first
  const other = v.companies.find((x) => x.status === 'active' && x.code !== co.code);
  assert.equal((await req('/api/island/stocks/order', b, { code: other.code, side: 'buy', qty: 10, requestId: crypto.randomUUID() })).status, 200);
  await req('/api/test/stocks/clock', a, { at: at(2, 16, 0) });
  const rank = (await req('/api/island/stocks/rank', a)).data; assert.equal(rank.count, 2); assert.equal(rank.top.length, 2);
  assert.ok(rank.top[0].r >= rank.top[1].r); assert.ok(rank.me && rank.me.rank >= 1); assert.equal(rank.top.filter((x) => x.mine).length, 1);
  await req('/api/test/stocks/clock', a, { at: 0 });
});
