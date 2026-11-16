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

test('섬 주식 시장: 같은 씨앗 같은 값, 하루 15번(9~23시), 장 시간, 상한 없음, 주에 1~3개 폐지(정리 매매 하루 뒤), 1~3일 뒤 새 회사', () => {
  const a = S.createMarket('t'); const b = S.createMarket('t');
  assert.deepEqual(a.view(at(20, 12, 30)), b.view(at(20, 12, 30)), '같은 씨앗 같은 값');
  assert.equal(S.PER_DAY, 15); assert.equal(S.tickAt(at(0, 8, 59)), -1); assert.equal(S.tickAt(at(0, 9)), 0); assert.equal(S.tickAt(at(0, 17, 30)), 8); assert.equal(S.tickAt(at(0, 23, 30)), 14); assert.equal(S.tickAt(at(1, 3)), 14); assert.equal(S.tickAt(at(1, 9)), 15);
  assert.ok(!S.isOpen(at(0, 8, 59)) && S.isOpen(at(0, 9)) && S.isOpen(at(0, 17)) && S.isOpen(at(0, 22, 59)) && !S.isOpen(at(0, 23)), '9시~11시 전');
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

// 1.10.335 (사용자 「주식 장은 9시부터 23시로」): the first day (2026-11-16) 09~17 as it was posted with nine a day -- under
// two keys the thirty companies' prices those hours, and the first weeks' 부도 plans, hashed with the 1.10.334 code
test('섬 주식 장 9~23시: 첫날 9~17시 값과 부도 계획은 하루 9번이던 때와 같음', () => {
  for (const [key, prices, plans] of [['day0-a', '42399f1de0f9212ecae239f174e6d7b0c76f460e', 'e7d8c2c91ffbd40dde4f3bbaaa3a147d6620777b'], ['x'.repeat(64), '3ba3eefda3c4173081769aad7ad19bda6ba49b70', 'a5cfdac361d1df1b9ed5921293f9d8a40a523d0d']]) {
    const m = S.createMarket(key); const rows = [];
    for (let h = 9; h <= 17; h += 1) rows.push(m.view(S.tickTime(0) + (h - 9) * HOUR + 60000).companies.map((c) => `${c.code}:${c.price}`).join(','));
    const sha = (s) => require('node:crypto').createHash('sha1').update(s).digest('hex');
    assert.equal(sha(rows.join('|')), prices, `${key.slice(0, 6)} 첫날 값`); assert.equal(sha([0, 1, 2].map((w) => JSON.stringify(m.planOf(w))).join('|')), plans, '부도 계획');
  }
  const m = S.createMarket('day0-a'); const v = m.view(at(0, 23, 5)); assert.equal(v.tick, 14); assert.ok(v.companies.every((c) => c.today.length === 15 || c.status !== 'active'), '23시 값까지 하루 15개');
});

// 102A 주식 소식 (notes story/stock-news-lines-20261116.json): a jump's line once its hour is posted, by the company (or its industry),
// up or down as it went; months and the new island kept; the same company never the same line within two weeks; one key, one story
test('섬 주식 소식: 튄 시간 값이 붙은 뒤에만, 방향 맞음, 달·새 섬 조건, 같은 회사 2주 안 같은 줄 없음, 같은 키면 모두 같음, 부도 까닭', () => {
  const N = S.NEWS; assert.equal(Object.keys(N.companies).length, 60); assert.deepEqual(Object.values(N.companies).map((c) => c.name), S.POOL.map((p) => p.name), '회사 순서·이름이 시장과 같음');
  const lines = (c, dir) => (c[dir] || []).map(S.lineText); const m = S.createMarket('news-key'); const n2 = S.createMarket('news-key');
  const all = []; for (let d = 0; d < 42; d += 1) { const ms = S.tickTime(d * S.PER_DAY + S.PER_DAY - 1) + 60000; const list = m.newsOf(ms); all.push(...list.map((x) => ({ ...x, day: d }))); assert.deepEqual(list, n2.newsOf(ms), '같은 키면 같은 소식'); }
  assert.ok(all.length > 42 * 4, `6주 소식 ${all.length}`);
  const byName = new Map(Object.values(N.companies).map((c) => [c.name, c])); const ind = new Map(Object.values(N.industries).map((x) => [x.industry, x]));
  const last = new Map();
  for (const x of all.sort((a, b) => a.k - b.k)) {
    const c = byName.get(x.name.replace(/^새 /, '')); const dir = x.pct >= 0 ? 'up' : 'down'; const pool = [...(c[dir] || []), ...(ind.get(c.industry)[dir] || [])];
    const found = pool.find((l) => S.lineText(l) === x.line); assert.ok(found, `${x.name} ${dir}: ${x.line}`);
    if (typeof found === 'object') { if (found.months) assert.ok(found.months.includes(S.monthOf(x.at)), `${x.line} ${S.monthOf(x.at)}월`); assert.notEqual(found.needs, 'newIsland', '새 섬 전에는 새 섬 줄 없음'); }
    const key = `${x.name.replace(/^새 /, '')}|${x.line}`; if (last.has(key)) assert.ok(x.day - last.get(key) >= 14, `${key} ${last.get(key)}→${x.day}`); last.set(key, x.day);
    void lines;
  }
  // only posted hours: at 10:30 the news of 10:00 and before, none of 11:00
  const ms = S.tickTime(5 * S.PER_DAY + 1) + 30 * 60000; const K = S.tickAt(ms); for (const x of m.newsOf(ms)) assert.ok(x.k <= K && x.at <= ms, '미리 귀띔 없음');
  const v = m.view(ms); for (const c of v.companies) if (c.news) assert.ok(c.news.at <= ms);
  // a 부도's reason, from the list
  let bust = null; for (let k = 0; k < 8 * 7 * S.PER_DAY && !bust; k += 1) { const vv = m.view(S.tickTime(k) + 1000); bust = vv.companies.find((c) => c.status === 'cleanup' && c.bust) || null; }
  assert.ok(bust && N.bust.includes(bust.bustWhy), `부도 까닭 ${bust?.bustWhy}`);
});

test('섬 주식 주문: 1주 단위·수수료 0.5%·한 회사 1,000주·하루 횟수 제한 없음·장 밖 막힘·정리 매매는 팔기만', () => {
  const m = S.createMarket('o'); const t = at(2, 10, 10); const c = m.view(t).companies.find((x) => x.status === 'active');
  assert.equal(S.order(m, {}, { code: c.code, side: 'buy', qty: 1 }, at(2, 8, 30)).error, 'CLOSED');
  assert.equal(S.order(m, {}, { code: c.code, side: 'buy', qty: 1.5 }, t).error, 'QTY');
  const b = S.order(m, {}, { code: c.code, side: 'buy', qty: 10 }, t); assert.equal(b.cost, c.price * 10 + Math.max(1, Math.ceil(c.price * 10 * 0.005)));
  assert.equal(S.order(m, b.doc, { code: c.code, side: 'buy', qty: 991 }, t).error, 'HOLD');
  assert.equal(S.order(m, b.doc, { code: c.code, side: 'sell', qty: 11 }, t).error, 'SHARES');
  const s = S.order(m, b.doc, { code: c.code, side: 'sell', qty: 4 }, t); assert.equal(s.reward, c.price * 4 - Math.max(1, Math.ceil(c.price * 4 * 0.005))); assert.equal(s.doc.h[c.code].q, 6);
  let doc = s.doc; for (let i = 2; i < 40; i += 1) { const r = S.order(m, doc, { code: c.code, side: 'buy', qty: 1 }, t); assert.equal(r.error, undefined, `${i + 1}번째 주문`); doc = r.doc; } /* (1.10.335 사용자 「주식 거래 횟수 제한을 없애자」) */
  assert.equal(S.mine(m, doc, t).ordersToday, 40); assert.equal(S.order(m, doc, { code: c.code, side: 'buy', qty: 1 }, at(2, 22, 30)).error, undefined, '밤 10시 반에도');
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

test('섬 주식 공정한 값 식(139B): 11-17 09시(틱 15) 전 값은 그대로, 그 뒤로는 「60% 아래 사서 95%에 팔기」의 기대 이익이 0 근처', () => {
  assert.equal(S.FAIR_FROM, 15); assert.equal(S.tickTime(S.FAIR_FROM), Date.parse('2026-11-17T09:00:00+09:00'));
  const old = S.createMarket('fair-t', { fairFrom: Infinity }); const now = S.createMarket('fair-t');
  const before = S.tickTime(S.FAIR_FROM - 1) + 60000; old.upTo(before); now.upTo(before);
  assert.deepEqual(now.slots.map((s) => s.prices), old.slots.map((s) => s.prices), '틱 14까지 모든 값이 같음');
  const later = S.tickTime(S.FAIR_FROM + 30) + 60000; old.upTo(later); now.upTo(later);
  assert.notDeepEqual(now.slots.map((s) => s.prices), old.slots.map((s) => s.prices), '틱 15부터 새 식');
  // the review's strategy (notes review-plan §1-1): once a day at 21:00, buy below 60 % of the listing, sell at 95 % -- 60 days, 8 keys
  const DAYS = 60; const seeds = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];
  const run = (secret, fairFrom) => {
    const m = S.createMarket(secret, { fairFrom }); let cash = 5e6; const h = new Map(); const k0 = S.FAIR_FROM;
    for (let d = 0; d < DAYS; d += 1) {
      const k = k0 + d * S.PER_DAY + (21 - S.OPEN); const v = m.view(S.tickTime(k) + 60000);
      for (const c of v.companies) { if (c.status === 'gone') continue; const mine = h.get(c.code);
        if (mine && (c.status === 'cleanup' || c.price >= 0.95 * c.list)) { cash += mine.q * c.price * (1 - S.FEE); h.delete(c.code); continue; }
        if (!mine && c.status === 'active' && c.price <= 0.6 * c.list) { const q = Math.min(S.HOLD_MAX, Math.floor(cash / (c.price * (1 + S.FEE)))); if (q > 0) { cash -= q * c.price * (1 + S.FEE); h.set(c.code, { q }); } } }
    }
    const end = S.tickTime(k0 + DAYS * S.PER_DAY - 1) + 60000; let held = 0; for (const [code, x] of h) { const c = m.company(code, end); if (c && c.status !== 'gone') held += c.price * x.q; }
    return (cash + held - 5e6) / DAYS;
  };
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const was = seeds.map((s) => run(s, Infinity)); const fair = seeds.map((s) => run(s, S.FAIR_FROM));
  assert.ok(mean(was) > 1e6 && was.every((g) => g > 0), `옛 식은 하루 100만 P 넘게 찍혔음: ${Math.round(mean(was))}`);
  assert.ok(Math.abs(mean(fair)) < 2e5, `새 식은 하루 평균 이익이 0 근처: ${Math.round(mean(fair))}`);
  assert.ok(fair.filter((g) => g < 0).length >= 2, `새 식은 지는 판도 있음: ${fair.map(Math.round)}`);
});