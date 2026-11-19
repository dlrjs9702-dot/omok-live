'use strict';
// v1.10.320 섬 주식 (gamecenter-notes docs/island-stocks-20261114.md, 사용자 결정 2026-11-14): thirty island companies, a price
// every hour 09:00~23:00 Seoul (fifteen a day since 1.10.335, weekends too), no bound on a move (the price above 0), delistings often (below a
// tenth of the listing price, or a 「부도」 -- one to three a week), a day of 「정리 매매」 (selling only) before one goes, a new
// company in the empty place one to three days later. Everything is worked out from a seed, tick by tick from the first day:
// the same for everyone, the same after a restart (nothing stored but what each player holds). Players' orders never move a
// price. Buying and selling: whole shares, 0.5 % on each (points that leave the game), 1,000 shares of a company at most,
// 20 orders a day (the 정리 매매 day's sells not counted).
const DAY = 86400000; const HOUR = 3600000; const KST = 9 * HOUR;
const dayOf = (ms) => Math.floor((ms + KST) / DAY); // (Seoul's day number)
const hourOf = (ms) => new Date(ms + KST).getUTCHours();
const FIRST_DAY = dayOf(Date.parse('2026-11-16T00:00:00+09:00')); // (a Monday: weeks run Monday to Sunday)
// (1.10.335 사용자 「주식 장은 9시부터 23시로」: fifteen a day, 09 ... 23 -- the 23:00 price the day's close. The first day's
// ticks 0..8 (09~17) are as before: an hour's draws are by its tick number, and the later ones had never been posted)
const OPEN = 9; const CLOSE = 23; const PER_DAY = CLOSE - OPEN + 1;
const FEE = 0.005; const HOLD_MAX = 1000; const DELIST_AT = 0.1; const SLOTS = 30; // (1.10.335 사용자 「주식 거래 횟수 제한을 없애자」: no orders a day cap -- the fee and 1,000 shares a company stay)
// how much a price moves an hour (the spread of its log), how often a piece of news jumps it
const KINDS = Object.freeze({ calm: Object.freeze({ sd: 0.012, news: 0.015, label: '잔잔함' }), normal: Object.freeze({ sd: 0.03, news: 0.03, label: '보통' }), wild: Object.freeze({ sd: 0.07, news: 0.06, label: '출렁임 큼' }) });
// the first thirty (7A: island companies, shops and residents' businesses), then those that list in an empty place
const FIRST = [['달마루 수산', 'normal'], ['과수원 조합', 'normal'], ['섬 택시', 'calm'], ['달마루 백화점', 'normal'], ['게임관', 'wild'], ['윤슬만 해운', 'normal'], ['푸른숲골 목재', 'calm'],
  ['툇마루 건설', 'normal'], ['물가 거리 상회', 'calm'], ['잔치마루 식품', 'normal'], ['영웅마루 광업', 'wild'], ['섬 우편 물류', 'calm'], ['대청마당 관광', 'normal'], ['섬 관광열차', 'calm'],
  ['해송 제과', 'normal'], ['별빛 전력', 'calm'], ['섬 은행', 'calm'], ['반딧불 조명', 'normal'], ['봄내 꽃집', 'normal'], ['섬 신문', 'calm'], ['달마루 통신', 'normal'], ['바다 양식장', 'wild'],
  ['섬 목장', 'normal'], ['곤충 박물관 상점', 'normal'], ['거리 악단 기획', 'wild'], ['섬 가구 공방', 'normal'], ['섬 의상실', 'normal'], ['꼬리 펫샵', 'normal'], ['기록관 출판', 'calm'], ['섬 약국', 'calm']];
const SPARE = [['윤슬 바이오', 'wild'], ['섬 로봇', 'wild'], ['파도 에너지', 'normal'], ['노을 여행사', 'normal'], ['섬 커피', 'normal'], ['소금밭 염전', 'calm'], ['섬 빵집', 'normal'], ['갈매기 항공', 'wild'],
  ['섬 도자기', 'calm'], ['별똥별 우주', 'wild'], ['바람개비 풍력', 'normal'], ['섬 놀이공원', 'normal'], ['섬 학원', 'calm'], ['해녀 수산', 'normal'], ['섬 보험', 'calm'], ['섬 체육관', 'normal'],
  ['등대 해운', 'normal'], ['섬 세탁소', 'calm'], ['섬 철물점', 'calm'], ['섬 정원사', 'normal'], ['꿀벌 농장', 'normal'], ['섬 영화관', 'wild'], ['달빛 호텔', 'normal'], ['섬 장난감', 'wild'],
  ['섬 시계방', 'calm'], ['섬 안경원', 'calm'], ['섬 문구', 'calm'], ['섬 수리점', 'normal'], ['섬 치과', 'calm'], ['섬 식초 공방', 'normal']];
const POOL = [...FIRST, ...SPARE].map(([name, kind]) => Object.freeze({ name, kind }));
// 102A 주식 소식 (사용자 「그럴 듯한 이유 문장을 더 많이 붙여」, notes story/stock-news-lines-20261116.json): what happened when a
// piece of news jumped a price -- shown only once that hour's price is posted (never ahead). A line for each company (70 %) or for
// its industry (30 %), up or down as the price went; one with `months` only in those (Seoul) months, one that `needs` the new
// island only once it is open (1.10.358: `boat` -- 별마루섬's boat, N3 -- only once that runs; any other need never); the same company never the same line within two weeks; picked by the server's key (the same for
// everyone). A 부도's reason the same way.
const NEWS = require('./island-stock-news.json');
const NEWS_OF = new Map(Object.values(NEWS.companies).map((c) => [c.name, c])); const INDUSTRY = new Map(Object.values(NEWS.industries).map((x) => [x.industry, x]));
const NEWS_KEEP = 14; // (days: a line not again for the same company)
const lineText = (l) => (typeof l === 'string' ? l : l.t);

// (Codex 311-320 #1: the seed was in this public file and the hash a 32-bit one -- anyone could work out the prices and the 부도
// to come. Now a number in [0, 1) is an HMAC-SHA256 of its parts under the server's own key, made once and kept in its store
// (server.js stocksMarket): the same after a restart, unknown outside)
const crypto = require('node:crypto');
const keyedRandom = (secret) => { const key = Buffer.from(String(secret)); return (...parts) => crypto.createHmac('sha256', key).update(parts.join('|')).digest().readUIntBE(0, 6) / 281474976710656; };
// (Codex 311-320 #2: a code only as the market writes it -- 「0.0」 and 「00.0」 were one company held under two keys)
function parseCode(code) { const m = /^(0|[1-9]\d?)\.(0|[1-9]\d{0,5})$/.exec(typeof code === 'string' ? code : ''); if (!m) return null; const s = Number(m[1]); return s < SLOTS ? [s, Number(m[2])] : null; }

// the ticks: 0 the first day's 09:00, PER_DAY a day
const monthOf = (ms) => new Date(ms + KST).getUTCMonth() + 1;
const tickTime = (k) => (FIRST_DAY + Math.floor(k / PER_DAY)) * DAY - KST + (OPEN + (k % PER_DAY)) * HOUR;
function tickAt(ms) { // the last price posted by then (-1 before the first)
  const d = dayOf(ms) - FIRST_DAY; if (d < 0) return -1; const h = hourOf(ms);
  return h < OPEN ? d * PER_DAY - 1 : d * PER_DAY + Math.min(h, CLOSE) - OPEN;
}
// 1.10.338 공정한 값 식 (notes review-plan-20261116 §1-1, 사용자 139B): from 11-17 09:00 (tick 15) on, no pull toward the listing
// price (a fallen one was sure to come back: 「60 % 아래 사서 95 %에 팔기」 made points) and a news jump of J - log cosh J (a
// mean of 1, not 1.05). The hours posted before stay as they were -- the same draws, only the move worked out anew
const FAIR_FROM = tickAt(Date.parse('2026-11-17T09:00:00+09:00'));
// 1.10.367 부도는 상장가 아래만 (notes island-stocks-20261114.md 끝, 사용자 2026-11-19 「둘 다 a」 1A): from this tick on, a week's 부도
// day (planOf: its 1~3 days, at most n) takes one of that close's companies under their listing price, drawn by the key -- none
// under it, none that day (해송 제과 went bust above it). The ticks before stay exactly as they were; the 10 % delisting unchanged
const BUST_FROM = tickAt(Date.parse('2026-11-23T09:00:00+09:00'));
const isOpen = (ms) => dayOf(ms) >= FIRST_DAY && hourOf(ms) >= OPEN && hourOf(ms) < CLOSE; // (09:00 to before 23:00; the 23:00 price the close)
const weekOf = (ms) => Math.floor((dayOf(ms) - FIRST_DAY) / 7);

// the market, worked out tick by tick and kept
function createMarket(secret, { fairFrom = FAIR_FROM, bustFrom = BUST_FROM, newIsland = () => false, boat = () => false } = {}) { /* (fairFrom, bustFrom: a test's old market -- Infinity) */
  if (typeof secret !== 'string' || !secret) throw new TypeError('createMarket: the server key is needed'); // (no public default)
  const rnd = keyedRandom(secret);
  // (an hour's moves: one AES-CTR stream under a key from the secret -- five numbers a place; an HMAC each was 9 s a year of
  // hours at a restart, this ~0.1 s)
  const streamKey = crypto.createHmac('sha256', Buffer.from(secret)).update('island-stocks|hour-stream').digest().subarray(0, 16);
  function hourDraws(k) { const iv = Buffer.alloc(16); iv.writeUInt32BE(k >>> 0, 4); return crypto.createCipheriv('aes-128-ctr', streamKey, iv).update(Buffer.alloc(SLOTS * 40)); }
  const drawOf = (D, s, j) => D.readUIntBE(s * 40 + j * 8, 6) / 281474976710656;
  const slots = FIRST.map(([name, kind], s) => ({ s, gen: 0, name, kind, list: listPrice(s, 0), listed: 0, status: 'active', prices: [], cleanupDay: null, gone: null, relistDay: null, past: [] }));
  const used = new Set(FIRST.map(([n]) => n)); let done = -1; const delistedOfWeek = new Map(); const busts = []; // (each 부도: its close and listing price -- the tests')
  const said = new Map(); // company name -> Map(line -> day it was said)
  function newsLine(sl, k, up) { // a line for this company's news at tick k, or null
    const base = sl.name.replace(/^새 /, ''); const c = NEWS_OF.get(base); if (!c) return null; const ind = INDUSTRY.get(c.industry);
    const day = Math.floor(k / PER_DAY); const month = monthOf(tickTime(k)); const seen = said.get(base) || new Map(); const dir = up ? 'up' : 'down';
    const fits = (l) => (typeof l === 'string' || ((!l.months || l.months.includes(month)) && (!l.needs || (l.needs === 'newIsland' ? newIsland(tickTime(k)) : l.needs === 'boat' ? boat(tickTime(k)) : false)))) && !(seen.has(lineText(l)) && day - seen.get(lineText(l)) < NEWS_KEEP);
    const own = (c[dir] || []).filter(fits); const common = (ind?.[dir] || []).filter(fits);
    const pool = (rnd('news-src', sl.s, sl.gen, k) < 0.7 ? own : common).length ? (rnd('news-src', sl.s, sl.gen, k) < 0.7 ? own : common) : own.length ? own : common; if (!pool.length) return null;
    const t = lineText(pool[Math.floor(rnd('news-pick', sl.s, sl.gen, k) * pool.length)]); seen.set(t, day); said.set(base, seen); return t;
  }
  function listPrice(s, gen) { return 1000 + Math.floor(rnd('list', s, gen) * 91) * 100; } // (1A: 1,000 ~ 10,000P)
  function planOf(week) { // (5A: one to three 부도 a week -- a place and a day each)
    const n = 1 + Math.floor(rnd('bust-n', week) * 3); const out = [];
    for (let i = 0; out.length < n && i < 40; i += 1) { const s = Math.floor(rnd('bust-s', week, i) * SLOTS); const d = Math.floor(rnd('bust-d', week, i) * 7); if (!out.some((p) => p.s === s)) out.push({ s, d }); }
    return { n, out };
  }
  function relist(sl, day, k) {
    const free = POOL.filter((p) => !used.has(p.name)); const pick = free.length ? free[Math.floor(rnd('name', sl.s, sl.gen + 1) * free.length)] : POOL[Math.floor(rnd('name', sl.s, sl.gen + 1) * POOL.length)];
    sl.past.push({ gen: sl.gen, name: sl.name, listed: sl.listed, prices: sl.prices, news: sl.news || [] }); used.delete(sl.name); // (its prices kept: a past week's value -- Codex 311-320 #5)
    sl.gen += 1; sl.name = free.length ? pick.name : `새 ${pick.name}`; sl.kind = pick.kind; used.add(sl.name);
    sl.list = listPrice(sl.s, sl.gen); sl.listed = k; sl.status = 'active'; sl.prices = []; sl.cleanupDay = null; sl.gone = null; sl.relistDay = null; sl.news = []; sl.bustWhy = null;
  }
  function step(k) {
    const day = Math.floor(k / PER_DAY); const i = k % PER_DAY; const week = Math.floor(day / 7);
    if (i === 0) for (const sl of slots) {
      if (sl.status === 'cleanup' && day > sl.cleanupDay) { sl.status = 'gone'; sl.gone = k; sl.relistDay = day + 1 + Math.floor(rnd('gap', sl.s, sl.gen) * 3); } // (gone at the next open; a new one 1~3 days on)
      if (sl.status === 'gone' && day >= sl.relistDay) relist(sl, day, k);
    }
    const D = hourDraws(k); const u = (sl, j) => drawOf(D, sl.s, j);
    for (const sl of slots) {
      if (sl.status === 'gone') continue;
      const K = KINDS[sl.kind]; const last = sl.prices.length ? Math.log(sl.prices[sl.prices.length - 1]) : Math.log(sl.list);
      if (!sl.prices.length) { sl.prices.push(sl.list); continue; } // (its first hour: the listing price)
      const gauss = Math.sqrt(-2 * Math.log(Math.max(1e-12, u(sl, 0)))) * Math.cos(2 * Math.PI * u(sl, 1));
      const fair = k >= fairFrom;
      let move = (fair ? 0 : 0.02 * (Math.log(sl.list) - last)) + K.sd * gauss - (K.sd * K.sd) / 2;
      const news = u(sl, 2) < K.news; const up = u(sl, 3) >= 0.5; if (news) { const J = (up ? 1 : -1) * (0.15 + 0.3 * u(sl, 4)); move += fair ? J - Math.log(Math.cosh(J)) : J; } // (a piece of news: 15~45 %; 139B from tick 15 a mean of 1)
      if (sl.status === 'cleanup') move -= 0.04; // (정리 매매: down it goes)
      const before = sl.prices[sl.prices.length - 1]; const price = Math.max(1, Math.round(Math.exp(last + move))); sl.prices.push(price);
      if (news && sl.status === 'active') { const line = newsLine(sl, k, price >= before); if (line) (sl.news ||= []).push({ k, line, pct: Math.round((price / before - 1) * 100) }); } /* (102A: its line, by how the price really went) */
    }
    if (i === PER_DAY - 1) { // the close: below a tenth of its listing, or this week's 부도 -- 정리 매매 tomorrow
      const plan = planOf(week); const dow = day % 7; const under = k >= bustFrom; /* (1.10.367 1A) */
      const due = (sl) => sl.status === 'active' && sl.listed !== k - i; // (not on the day it listed)
      const close = (sl) => sl.prices[sl.prices.length - 1];
      const out = (sl, busted) => { sl.status = 'cleanup'; sl.cleanupDay = day + 1; sl.bust = busted && close(sl) >= DELIST_AT * sl.list; if (sl.bust) { sl.bustWhy = NEWS.bust[Math.floor(rnd('bust-why', sl.s, sl.gen) * NEWS.bust.length)]; busts.push({ k, slot: sl.s, gen: sl.gen, price: close(sl), list: sl.list }); } delistedOfWeek.set(week, (delistedOfWeek.get(week) || 0) + 1); };
      for (const sl of slots) {
        if (!due(sl)) continue;
        const busted = !under && (delistedOfWeek.get(week) || 0) < plan.n && plan.out.some((p) => p.s === sl.s && p.d === dow);
        if (close(sl) < DELIST_AT * sl.list || busted) out(sl, busted);
      }
      if (under) plan.out.forEach((p, j) => { /* (each of the week's 부도 days: one under its listing price, by the key) */
        if (p.d !== dow || (delistedOfWeek.get(week) || 0) >= plan.n) return;
        const pool = slots.filter((sl) => due(sl) && close(sl) < sl.list); if (pool.length) out(pool[Math.floor(rnd('bust-pick', week, j) * pool.length)], true);
      });
    }
  }
  function upTo(ms) { const K = tickAt(ms); while (done < K) { done += 1; step(done); } return K; }
  const codeOf = (sl) => `${sl.s}.${sl.gen}`;
  // the price of a company (its code) at tick k -- null if it was not listed then
  function priceAt(code, k) { // (a company gone since too: its kept prices)
    const sc = parseCode(code); if (!sc) return null; const sl = slots[sc[0]]; const g = sl.gen === sc[1] ? sl : sl.past.find((p) => p.gen === sc[1]);
    if (!g || !g.prices || k < g.listed) return null;
    const p = g.prices[Math.min(k, done) - g.listed]; return Number.isFinite(p) ? p : null;
  }
  // what the board shows
  function view(ms) {
    const K = upTo(ms); const day = K >= 0 ? Math.floor(K / PER_DAY) : -1; const first = day * PER_DAY;
    return { open: isOpen(ms), tick: K, at: K >= 0 ? tickTime(K) : null, next: nextTick(ms), companies: slots.map((sl) => {
      if (sl.status === 'gone') return { slot: sl.s, status: 'gone', name: sl.past[sl.past.length - 1]?.name || sl.name, relistDay: sl.relistDay };
      const n = sl.prices.length; const price = n ? sl.prices[n - 1] : sl.list; const startK = Math.max(sl.listed, first);
      const today = K >= 0 ? sl.prices.slice(startK - sl.listed) : [];
      const prevClose = first - 1 >= sl.listed ? sl.prices[first - 1 - sl.listed] : sl.list;
      const closes = []; for (let d = day - 6; d <= day; d += 1) { const kc = Math.min(d * PER_DAY + PER_DAY - 1, K); closes.push(kc >= sl.listed ? sl.prices[kc - sl.listed] : null); }
      const newsToday = (sl.news || []).filter((x) => x.k >= first && x.k <= K); const last = newsToday[newsToday.length - 1] || null;
      const industry = NEWS_OF.get(sl.name.replace(/^새 /, ''))?.industry || null; const recent = (sl.news || []).filter((x) => x.k <= K).slice(-3).reverse().map((x) => ({ line: x.line, pct: x.pct, at: tickTime(x.k) })); /* (1.10.351 ⑤ 회사 정보) */
      return { slot: sl.s, code: codeOf(sl), name: sl.name, kind: sl.kind, kindLabel: KINDS[sl.kind].label, list: sl.list, price, prevClose, today, week: closes, status: sl.status, bust: Boolean(sl.bust), bustWhy: sl.bustWhy || null, newToday: sl.listed >= first, news: last ? { line: last.line, pct: last.pct, at: tickTime(last.k) } : null, industry, listedAt: tickTime(sl.listed), recent };
    }), news: newsOf(first, K) };
  }
  // (102A) the day's news, the latest first: { code, name, line, pct, at } -- only those posted by tick K
  function newsOf(first, K) { const out = []; for (const sl of slots) for (const g of [sl, ...sl.past]) for (const x of g.news || []) if (x.k >= first && x.k <= K) out.push({ code: `${sl.s}.${g.gen}`, name: g.name, line: x.line, pct: x.pct, at: tickTime(x.k), k: x.k, price: g.prices?.[x.k - g.listed] ?? null }); /* (1.10.351 ①: the price then) */ return out.sort((a, b) => b.k - a.k || (a.code < b.code ? -1 : 1)); }
  const nextTick = (ms) => { const K = tickAt(ms); let t = tickTime(K + 1); if (K < 0) t = tickTime(0); return t; };
  function company(code, ms) { upTo(ms); const sc = parseCode(code); const sl = sc && slots[sc[0]]; if (!sl || sl.gen !== sc[1]) return null; return { code: codeOf(sl), name: sl.name, status: sl.status, price: sl.prices[sl.prices.length - 1] ?? sl.list }; }
  const nameOf = (code) => { const sc = parseCode(code); const sl = sc && slots[sc[0]]; if (!sl) return null; if (sl.gen === sc[1]) return sl.name; return sl.past.find((p) => p.gen === sc[1])?.name || null; };
  return { view, company, priceAt, nameOf, upTo, slots, planOf, busts, newsOf: (ms) => { const K = upTo(ms); const day = K >= 0 ? Math.floor(K / PER_DAY) : -1; return newsOf(day * PER_DAY, K); } };
}

// one player's holdings: doc = { h: { code: { q, c } }, d: { day, n }, w: { week, start, buys, sells }, last: { week, start,
// buys, sells, h } } -- `last` the week before the one in `w`, as it ended (Codex 311-320 #5: a week settled late, after a
// Monday order, is read from its own figures, not this week's)
function holdingsValue(market, doc, ms) { let v = 0; for (const [code, x] of Object.entries(doc?.h || {})) { const c = market.company(code, ms); if (c && c.status !== 'gone' && x.q > 0) v += c.price * x.q; } return v; }
function valueAt(market, h, k) { let v = 0; if (k < 0) return 0; for (const [code, x] of Object.entries(h || {})) { const p = market.priceAt(code, k); if (p && x.q > 0) v += p * x.q; } return v; } // (at tick k's prices; a company gone by then 0)
const weekFirstTick = (week) => week * 7 * PER_DAY;
function rollWeek(market, doc, ms) {
  const week = weekOf(ms); if (doc.w?.week === week) return doc;
  const last = doc.w && doc.w.week < week ? { week: doc.w.week, start: doc.w.start, buys: doc.w.buys, sells: doc.w.sells, h: doc.h || {} } : doc.last;
  return { ...doc, ...(last ? { last } : {}), w: { week, start: valueAt(market, doc.h, weekFirstTick(week) - 1), buys: 0, sells: 0 } }; // (its start: the holdings at last week's close)
}
// a week's own figures from a doc: its record, or -- a week with no order -- what was held through it, nothing bought or sold
function weekFigures(market, doc, week) {
  const w = doc?.w; const last = doc?.last;
  if (w?.week === week) return { start: w.start, buys: w.buys, sells: w.sells, h: doc.h || {} };
  if (last?.week === week) return { start: last.start, buys: last.buys, sells: last.sells, h: last.h || {} };
  const before = [w, last].filter((x) => x && x.week < week).sort((a, b) => b.week - a.week)[0]; if (!before) return null;
  const h = (before === w ? doc.h : last.h) || {};
  return { start: valueAt(market, h, weekFirstTick(week) - 1), buys: 0, sells: 0, h };
}
// a buy or a sell: { doc, cost } / { doc, reward } / { error }
function order(market, doc0, { code: asked, side, qty }, ms) {
  if (!parseCode(asked)) return { error: 'GONE' };
  qty = Number(qty); if (!Number.isInteger(qty) || qty < 1 || qty > HOLD_MAX) return { error: 'QTY' };
  if (!isOpen(ms)) return { error: 'CLOSED' };
  const c = market.company(asked, ms); if (!c || c.status === 'gone') return { error: 'GONE' }; const code = c.code; // (the holdings under the market's own code)
  if (side !== 'buy' && side !== 'sell') return { error: 'SIDE' };
  if (side === 'buy' && c.status === 'cleanup') return { error: 'CLEANUP' }; // (정리 매매: selling only)
  let doc = rollWeek(market, { h: {}, ...(doc0 || {}) }, ms); const day = dayOf(ms);
  const d = doc.d?.day === day ? doc.d : { day, n: 0 }; const counted = !(side === 'sell' && c.status === 'cleanup'); // (the day's count kept, never a cap now)
  const held = doc.h[code] || { q: 0, c: 0 };
  if (side === 'buy' && held.q + qty > HOLD_MAX) return { error: 'HOLD' };
  if (side === 'sell' && held.q < qty) return { error: 'SHARES' };
  const gross = c.price * qty; const fee = Math.max(1, Math.ceil(gross * FEE));
  const h = { ...doc.h }; const w = { ...doc.w };
  let gain = null;
  if (side === 'buy') { h[code] = { q: held.q + qty, c: held.c + gross + fee }; w.buys += gross + fee; } else { const left = held.q - qty; const basis = held.q ? Math.round((held.c * left) / held.q) : 0; if (left) h[code] = { q: left, c: basis }; else delete h[code]; w.sells += gross - fee; gain = gross - fee - (held.c - (left ? basis : 0)); }
  // (1.10.351 ② 거래 기록: the last LOG_MAX orders, the sale's gain on the average cost (fees in both); this week's and all-time sums)
  const entry = { at: ms, code, name: c.name, side, qty, price: c.price, fee, ...(gain !== null ? { gain } : {}) }; const wk = weekOf(ms);
  const tw = doc.tw?.week === wk ? doc.tw : { week: wk, gain: 0, fee: 0 }; const tot = doc.tot || { gain: 0, fee: 0 };
  doc = { ...doc, v: MARKET_V, h, w, d: { day, n: d.n + (counted ? 1 : 0) }, log: [entry, ...(doc.log || [])].slice(0, LOG_MAX), tw: { week: wk, gain: tw.gain + (gain || 0), fee: tw.fee + fee }, tot: { gain: tot.gain + (gain || 0), fee: tot.fee + fee } };
  return side === 'buy' ? { doc, cost: gross + fee, price: c.price, fee, name: c.name } : { doc, reward: gross - fee, price: c.price, fee, name: c.name, gain };
}
// the return (%) of the week `ms` is in, by then (its end at the latest): what is held and sold, less what was held at the
// week's start and bought, over the latter -- at that time's prices, not today's (a late settling)
function weekReturn(market, doc, ms) {
  const week = weekOf(ms); market.upTo(ms); const f = weekFigures(market, { h: {}, ...(doc || {}) }, week); if (!f) return null;
  const base = f.start + f.buys; if (base <= 0) return null;
  const k = Math.min(tickAt(ms), weekFirstTick(week + 1) - 1);
  return ((valueAt(market, f.h, k) + f.sells - base) / base) * 100;
}
// (1.10.351 ⑥) the same week's gain in points -- the rank's ▲/▼ beside its return (the rank and the title still by the return)
function weekGain(market, doc, ms) {
  const week = weekOf(ms); market.upTo(ms); const f = weekFigures(market, { h: {}, ...(doc || {}) }, week); if (!f) return null;
  const base = f.start + f.buys; if (base <= 0) return null; const k = Math.min(tickAt(ms), weekFirstTick(week + 1) - 1);
  return Math.round(valueAt(market, f.h, k) + f.sells - base);
}
const LOG_MAX = 200; const WATCH_MAX = 10;
// (1.10.351 ④) stars and alerts on a doc: { star: [code], alerts: { code: { above, below } } } -- WATCH_MAX alerts at most
function watchSet(doc0, { code, star, above, below, clear }, alive = null) { // (alive(code): still trading -- 362 Codex 351-360 #6)
  if (!parseCode(code)) return { error: 'GONE' }; const doc = { h: {}, ...(doc0 || {}) }; const stars = new Set(doc.star || []); const alerts = { ...(doc.alerts || {}) };
  if (alive) for (const k of Object.keys(alerts)) if (k !== code && !alive(k)) delete alerts[k]; /* (a delisted company's alert -- not to be reached on the board to clear -- took one of the 10 for good) */
  if (typeof star === 'boolean') { if (star) stars.add(code); else stars.delete(code); }
  if (clear === true) delete alerts[code];
  else if (above !== undefined || below !== undefined) {
    const num = (v) => (v === null || v === '' || v === undefined ? null : Number.isSafeInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 10000000 ? Number(v) : NaN);
    const a = num(above); const b = num(below); if (Number.isNaN(a) || Number.isNaN(b) || (a === null && b === null)) return { error: 'ALERT' };
    if (!alerts[code] && Object.keys(alerts).length >= WATCH_MAX) return { error: 'ALERT_MAX' };
    alerts[code] = { ...(a !== null ? { above: a } : {}), ...(b !== null ? { below: b } : {}) };
  }
  return { doc: { ...doc, star: [...stars].slice(0, 30), alerts } };
}
// (1.10.321, 사용자 「B」: 320 went out with the public seed's market -- a doc of that market (no `v`) that traded is given back
// what its shares cost (the fees in it) and starts again empty; one that never traded is left alone)
const MARKET_V = 2;
function oldRefund(doc) {
  if (!doc || typeof doc !== 'object' || doc.v === MARKET_V) return null;
  if (!Object.keys(doc.h || {}).length && !doc.w && !doc.d) return null; // (never traded: nothing to do)
  const refund = Object.values(doc.h || {}).reduce((n, x) => n + (Number(x?.q) > 0 && Number(x?.c) > 0 ? Math.round(Number(x.c)) : 0), 0);
  return { doc: { v: MARKET_V }, refund };
}
// every such doc through the store: the points back and the doc emptied in one step (once: the doc's `v` and the pay key),
// then `letter(userId, refund)` -> [{ userId, refund }] of those done
async function refundOldStocks(store, letter = null) {
  const done = [];
  for (const { userId, doc } of await store.questAll('stocks')) {
    if (!oldRefund(doc)) continue;
    const payKey = `stock-refund:${crypto.createHash('sha1').update(String(userId)).digest('hex').slice(0, 16)}`;
    const out = await store.questApply(userId, 'stocks', (d) => { const x = oldRefund(d); return x ? { doc: x.doc, refund: x.refund, ...(x.refund > 0 ? { reward: x.refund, payKey, reason: 'stock_refund' } : {}) } : null; });
    if (!out?.doc) continue;
    done.push({ userId, refund: out.refund });
    if (out.refund > 0 && letter) await Promise.resolve(letter(userId, out.refund)).catch(() => {});
  }
  return done;
}
// a player's view of their holdings
function mine(market, doc, ms) {
  const d = rollWeek(market, { h: {}, ...(doc || {}) }, ms); const day = dayOf(ms);
  const rows = Object.entries(d.h).map(([code, x]) => { const c = market.company(code, ms); const price = c && c.status !== 'gone' ? c.price : 0; return { code, name: c?.name || market.nameOf(code) || code, status: c ? c.status : 'gone', qty: x.q, avg: x.q ? Math.round(x.c / x.q) : 0, value: price * x.q, gain: x.q ? Math.round(((price * x.q - x.c) / Math.max(1, x.c)) * 1000) / 10 : 0 }; });
  const wk = weekOf(ms); /* (1.10.351: the log, the sums, the stars and alerts) */
  return { rows, ordersToday: d.d?.day === day ? d.d.n : 0, week: weekReturn(market, d, ms), weekGain: weekGain(market, d, ms), log: d.log || [], sums: { week: d.tw?.week === wk ? { gain: d.tw.gain, fee: d.tw.fee } : { gain: 0, fee: 0 }, all: d.tot || { gain: 0, fee: 0 } }, star: d.star || [], alerts: d.alerts || {} };
}
module.exports = { NEWS, lineText, monthOf, FIRST_DAY, FAIR_FROM, BUST_FROM, OPEN, CLOSE, PER_DAY, FEE, HOLD_MAX, DELIST_AT, SLOTS, KINDS, POOL, dayOf, weekOf, tickAt, tickTime, isOpen, createMarket, order, mine, weekReturn, weekGain, watchSet, LOG_MAX, WATCH_MAX, holdingsValue, parseCode, MARKET_V, oldRefund, refundOldStocks };
