'use strict';
// v1.10.320 섬 주식 (gamecenter-notes docs/island-stocks-20261114.md, 사용자 결정 2026-11-14): thirty island companies, a price
// every hour 09:00~17:00 Seoul (nine a day, weekends too), no bound on a move (the price above 0), delistings often (below a
// tenth of the listing price, or a 「부도」 -- one to three a week), a day of 「정리 매매」 (selling only) before one goes, a new
// company in the empty place one to three days later. Everything is worked out from a seed, tick by tick from the first day:
// the same for everyone, the same after a restart (nothing stored but what each player holds). Players' orders never move a
// price. Buying and selling: whole shares, 0.5 % on each (points that leave the game), 1,000 shares of a company at most,
// 20 orders a day (the 정리 매매 day's sells not counted).
const DAY = 86400000; const HOUR = 3600000; const KST = 9 * HOUR;
const dayOf = (ms) => Math.floor((ms + KST) / DAY); // (Seoul's day number)
const hourOf = (ms) => new Date(ms + KST).getUTCHours();
const FIRST_DAY = dayOf(Date.parse('2026-11-16T00:00:00+09:00')); // (a Monday: weeks run Monday to Sunday)
const OPEN = 9; const CLOSE = 17; const PER_DAY = CLOSE - OPEN + 1; // (09, 10, ... 17 -- the 17:00 price the day's close)
const FEE = 0.005; const HOLD_MAX = 1000; const ORDERS_DAY = 20; const DELIST_AT = 0.1; const SLOTS = 30;
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

// a seeded number in [0, 1) from its parts
function rnd(...parts) { let h = 2166136261; for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0; h ^= h >>> 16; return (h >>> 0) / 4294967296; }
const gauss = (...parts) => Math.sqrt(-2 * Math.log(Math.max(1e-12, rnd(...parts, 'a')))) * Math.cos(2 * Math.PI * rnd(...parts, 'b'));

// the ticks: 0 the first day's 09:00, PER_DAY a day
const tickTime = (k) => (FIRST_DAY + Math.floor(k / PER_DAY)) * DAY - KST + (OPEN + (k % PER_DAY)) * HOUR;
function tickAt(ms) { // the last price posted by then (-1 before the first)
  const d = dayOf(ms) - FIRST_DAY; if (d < 0) return -1; const h = hourOf(ms);
  return h < OPEN ? d * PER_DAY - 1 : d * PER_DAY + Math.min(h, CLOSE) - OPEN;
}
const isOpen = (ms) => dayOf(ms) >= FIRST_DAY && hourOf(ms) >= OPEN && hourOf(ms) < CLOSE; // (09:00 to before 17:00; the 17:00 price the close)
const weekOf = (ms) => Math.floor((dayOf(ms) - FIRST_DAY) / 7);

// the market, worked out tick by tick and kept
function createMarket(seed = 'island-stocks-1') {
  const slots = FIRST.map(([name, kind], s) => ({ s, gen: 0, name, kind, list: listPrice(seed, s, 0), listed: 0, status: 'active', prices: [], cleanupDay: null, gone: null, relistDay: null, past: [] }));
  const used = new Set(FIRST.map(([n]) => n)); let done = -1; const delistedOfWeek = new Map();
  function listPrice(sd, s, gen) { return 1000 + Math.floor(rnd(sd, 'list', s, gen) * 91) * 100; } // (1A: 1,000 ~ 10,000P)
  function planOf(week) { // (5A: one to three 부도 a week -- a place and a day each)
    const n = 1 + Math.floor(rnd(seed, 'bust-n', week) * 3); const out = [];
    for (let i = 0; out.length < n && i < 40; i += 1) { const s = Math.floor(rnd(seed, 'bust-s', week, i) * SLOTS); const d = Math.floor(rnd(seed, 'bust-d', week, i) * 7); if (!out.some((p) => p.s === s)) out.push({ s, d }); }
    return { n, out };
  }
  function relist(sl, day, k) {
    const free = POOL.filter((p) => !used.has(p.name)); const pick = free.length ? free[Math.floor(rnd(seed, 'name', sl.s, sl.gen + 1) * free.length)] : POOL[Math.floor(rnd(seed, 'name', sl.s, sl.gen + 1) * POOL.length)];
    sl.past.push({ gen: sl.gen, name: sl.name }); used.delete(sl.name);
    sl.gen += 1; sl.name = free.length ? pick.name : `새 ${pick.name}`; sl.kind = pick.kind; used.add(sl.name);
    sl.list = listPrice(seed, sl.s, sl.gen); sl.listed = k; sl.status = 'active'; sl.prices = []; sl.cleanupDay = null; sl.gone = null; sl.relistDay = null;
  }
  function step(k) {
    const day = Math.floor(k / PER_DAY); const i = k % PER_DAY; const week = Math.floor(day / 7);
    if (i === 0) for (const sl of slots) {
      if (sl.status === 'cleanup' && day > sl.cleanupDay) { sl.status = 'gone'; sl.gone = k; sl.relistDay = day + 1 + Math.floor(rnd(seed, 'gap', sl.s, sl.gen) * 3); } // (gone at the next open; a new one 1~3 days on)
      if (sl.status === 'gone' && day >= sl.relistDay) relist(sl, day, k);
    }
    for (const sl of slots) {
      if (sl.status === 'gone') continue;
      const K = KINDS[sl.kind]; const last = sl.prices.length ? Math.log(sl.prices[sl.prices.length - 1]) : Math.log(sl.list);
      if (!sl.prices.length) { sl.prices.push(sl.list); continue; } // (its first hour: the listing price)
      let move = 0.02 * (Math.log(sl.list) - last) + K.sd * gauss(seed, 'p', sl.s, sl.gen, k) - (K.sd * K.sd) / 2;
      if (rnd(seed, 'news', sl.s, sl.gen, k) < K.news) move += (rnd(seed, 'news-up', sl.s, sl.gen, k) < 0.5 ? -1 : 1) * (0.15 + 0.3 * rnd(seed, 'news-size', sl.s, sl.gen, k)); // (a piece of news: 15~45 %)
      if (sl.status === 'cleanup') move -= 0.04; // (정리 매매: down it goes)
      sl.prices.push(Math.max(1, Math.round(Math.exp(last + move))));
    }
    if (i === PER_DAY - 1) { // the close: below a tenth of its listing, or this week's 부도 -- 정리 매매 tomorrow
      const plan = planOf(week); const dow = day % 7;
      for (const sl of slots) {
        if (sl.status !== 'active' || sl.listed === k - i) continue; // (not on the day it listed)
        const price = sl.prices[sl.prices.length - 1]; const busted = (delistedOfWeek.get(week) || 0) < plan.n && plan.out.some((p) => p.s === sl.s && p.d === dow);
        if (price < DELIST_AT * sl.list || busted) { sl.status = 'cleanup'; sl.cleanupDay = day + 1; sl.bust = busted && price >= DELIST_AT * sl.list; delistedOfWeek.set(week, (delistedOfWeek.get(week) || 0) + 1); }
      }
    }
  }
  function upTo(ms) { const K = tickAt(ms); while (done < K) { done += 1; step(done); } return K; }
  const codeOf = (sl) => `${sl.s}.${sl.gen}`;
  // the price of a company (its code) at tick k -- null if it was not listed then
  function priceAt(code, k) {
    const [s, gen] = String(code).split('.').map(Number); const sl = slots[s]; if (!sl || sl.gen !== gen || k < sl.listed) return null;
    const p = sl.prices[Math.min(k, done) - sl.listed]; return Number.isFinite(p) ? p : null;
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
      return { slot: sl.s, code: codeOf(sl), name: sl.name, kind: sl.kind, kindLabel: KINDS[sl.kind].label, list: sl.list, price, prevClose, today, week: closes, status: sl.status, bust: Boolean(sl.bust), newToday: sl.listed >= first };
    }) };
  }
  const nextTick = (ms) => { const K = tickAt(ms); let t = tickTime(K + 1); if (K < 0) t = tickTime(0); return t; };
  function company(code, ms) { upTo(ms); const [s, gen] = String(code).split('.').map(Number); const sl = slots[s]; if (!sl || sl.gen !== gen) return null; return { code, name: sl.name, status: sl.status, price: sl.prices[sl.prices.length - 1] ?? sl.list }; }
  const nameOf = (code) => { const [s, gen] = String(code).split('.').map(Number); const sl = slots[s]; if (!sl) return null; if (sl.gen === gen) return sl.name; return sl.past.find((p) => p.gen === gen)?.name || null; };
  return { view, company, priceAt, nameOf, upTo, slots, planOf };
}

// one player's holdings: doc = { h: { code: { q, c } }, d: { day, n }, w: { week, start, buys, sells } }
function holdingsValue(market, doc, ms) { let v = 0; for (const [code, x] of Object.entries(doc?.h || {})) { const c = market.company(code, ms); if (c && c.status !== 'gone' && x.q > 0) v += c.price * x.q; } return v; }
function weekStart(market, doc, ms) { // (this week's start: the holdings at last week's close)
  const k = weekOf(ms) * 7 * PER_DAY - 1; let v = 0;
  for (const [code, x] of Object.entries(doc?.h || {})) { const p = k >= 0 ? market.priceAt(code, k) : null; if (p && x.q > 0) v += p * x.q; }
  return v;
}
function rollWeek(market, doc, ms) { const week = weekOf(ms); if (doc.w?.week === week) return doc; return { ...doc, w: { week, start: weekStart(market, doc, ms), buys: 0, sells: 0 } }; }
// a buy or a sell: { doc, cost } / { doc, reward } / { error }
function order(market, doc0, { code, side, qty }, ms) {
  qty = Number(qty); if (!Number.isInteger(qty) || qty < 1 || qty > HOLD_MAX) return { error: 'QTY' };
  if (!isOpen(ms)) return { error: 'CLOSED' };
  const c = market.company(code, ms); if (!c || c.status === 'gone') return { error: 'GONE' };
  if (side !== 'buy' && side !== 'sell') return { error: 'SIDE' };
  if (side === 'buy' && c.status === 'cleanup') return { error: 'CLEANUP' }; // (정리 매매: selling only)
  let doc = rollWeek(market, { h: {}, ...(doc0 || {}) }, ms); const day = dayOf(ms);
  const d = doc.d?.day === day ? doc.d : { day, n: 0 }; const counted = !(side === 'sell' && c.status === 'cleanup');
  if (counted && d.n >= ORDERS_DAY) return { error: 'LIMIT' };
  const held = doc.h[code] || { q: 0, c: 0 };
  if (side === 'buy' && held.q + qty > HOLD_MAX) return { error: 'HOLD' };
  if (side === 'sell' && held.q < qty) return { error: 'SHARES' };
  const gross = c.price * qty; const fee = Math.max(1, Math.ceil(gross * FEE));
  const h = { ...doc.h }; const w = { ...doc.w };
  if (side === 'buy') { h[code] = { q: held.q + qty, c: held.c + gross + fee }; w.buys += gross + fee; } else { const left = held.q - qty; const basis = held.q ? Math.round((held.c * left) / held.q) : 0; if (left) h[code] = { q: left, c: basis }; else delete h[code]; w.sells += gross - fee; }
  doc = { ...doc, h, w, d: { day, n: d.n + (counted ? 1 : 0) } };
  return side === 'buy' ? { doc, cost: gross + fee, price: c.price, fee, name: c.name } : { doc, reward: gross - fee, price: c.price, fee, name: c.name };
}
// this week's return (%): what is held now and sold, less what was held at the week's start and bought, over the latter
function weekReturn(market, doc, ms) {
  const d = rollWeek(market, { h: {}, ...(doc || {}) }, ms); const base = d.w.start + d.w.buys; if (base <= 0) return null;
  return ((holdingsValue(market, d, ms) + d.w.sells - base) / base) * 100;
}
// a player's view of their holdings
function mine(market, doc, ms) {
  const d = rollWeek(market, { h: {}, ...(doc || {}) }, ms); const day = dayOf(ms);
  const rows = Object.entries(d.h).map(([code, x]) => { const c = market.company(code, ms); const price = c && c.status !== 'gone' ? c.price : 0; return { code, name: c?.name || market.nameOf(code) || code, status: c ? c.status : 'gone', qty: x.q, avg: x.q ? Math.round(x.c / x.q) : 0, value: price * x.q, gain: x.q ? Math.round(((price * x.q - x.c) / Math.max(1, x.c)) * 1000) / 10 : 0 }; });
  return { rows, ordersLeft: ORDERS_DAY - (d.d?.day === day ? d.d.n : 0), week: weekReturn(market, d, ms) };
}
module.exports = { FIRST_DAY, OPEN, CLOSE, PER_DAY, FEE, HOLD_MAX, ORDERS_DAY, DELIST_AT, SLOTS, KINDS, POOL, dayOf, weekOf, tickAt, tickTime, isOpen, createMarket, order, mine, weekReturn, holdingsValue, rnd };
