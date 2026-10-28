'use strict';

// v1.10.10 게임 아일랜드 이벤트 인벤토리 (비공개 IDEAS 「게임 아일랜드 — 이벤트 인벤토리」, 사용자 확정 2026-10-04): what can be
// carried in the island bag and where it is handed in. Every number the decision left open lives here, in one place:
// prices, the bag size, the stack size and the daily limit on what the island pays (see PROJECT_STATUS.md v1.10.10).
const BAG_SLOTS = 16; // IDEAS: about 12–20 slots
// v1.10.195 가방 늘리기 (docs/bag-redesign-20261027.md 7): 16 -> 24 -> 32, bought once for good at the 잡화점; an account's own
// size from the server (setSlotsHook), never more than BAG_GROW's last
const BAG_GROW = Object.freeze([24, 32]);
let slotsHook = () => null;
const setSlotsHook = (fn) => { slotsHook = typeof fn === 'function' ? fn : () => null; };
const slotsOf = (userId) => { const n = Number(slotsHook(userId)); return BAG_GROW.includes(n) ? n : BAG_SLOTS; };
const STACK_MAX = 99; // one slot holds up to this many of the same thing
// v1.10.31 게임 아일랜드 포인트 경제·생활 보상 (IDEAS, 사용자 확정 2026-10-05): the life rewards went up and their daily
// limit with them; weeds are paid apart from it (no daily limit at all), stack to 999 and are all handed in at once.
// v1.10.35 경제 기준(통합, 사용자 확정 2026-10-06): no daily limit at all -- what is gathered is paid. Too much from one
// thing is evened out by its price, how often it appears and how long it takes, never by stopping the day's pay.
const DAILY_CAP = Infinity;
const WEED_STACK = 999;

// at: who takes it -- 'office' (중앙 관공서: settle / hand in), 'merchant' (상점가 상인: sell), 'owner' (the NPC who lost it).
// unique: never stacked (each one is its own entry, e.g. a lost item that belongs to someone).
const ITEMS = {
  // v1.10.35 단가 (경제 기준 통합: 20~30분 생활에 약 100,000P): the finds pay about twice what they did; a weed, which
  // stands about a metre from the next and takes a second, 300 → 200 (a focused 20 minutes was about 180,000P)
  trash: { name: '쓰레기', icon: '🗑️', at: 'office', price: 1000 },
  herb: { name: '희귀 약재', icon: '🌿', at: 'merchant', price: 4000 },
  berry: { name: '나무 열매', icon: '🍒', at: 'merchant', price: 1000 },
  mushroom: { name: '버섯', icon: '🍄', at: 'merchant', price: 1500 },
  wallet: { name: '잃어버린 지갑', icon: '👛', at: 'office', price: 10000, unique: true },
  lost: { name: '분실물', icon: '🧸', at: 'owner', price: 10000, unique: true },
  weed: { name: '잡초', icon: '🌱', at: 'office', price: 310, stack: WEED_STACK, uncapped: true }, // v1.10.31 잡초 채집; v1.10.89 200→310P: the pull is 1.4 s (was 0.9), the pay per hour kept (200 × 1.4 / 0.9)
  harvest: { name: '밭 채소', icon: '🥕', at: 'merchant', price: 3000 }, // v1.10.89 농부 밭 수확: once a week each, when the field is grown
  candy: { name: '사탕 주머니', icon: '🍬', at: 'merchant', price: 1500 }, // v1.10.39 10월 할로윈: the kid's request, or sold
  // v1.10.42 낚시: every fish, sold all at once to the harbour fisherman
  ...Object.fromEntries(Object.entries(require('./island-fishing').SPECIES).map(([id, f]) => [`fish_${id}`, { name: f.name, icon: f.icon, at: 'fisher', price: f.price }])),
  // B 47 곤충: every insect, sold to the merchant (or given to the museum)
  ...Object.fromEntries(Object.entries(require('./island-insects').SPECIES).map(([id, b]) => [`insect_${id}`, { name: b.name, icon: b.icon, at: 'merchant', price: b.price }])),
  // v1.10.92 잡화점 (사용자 2026-10-18, IDEAS #future-general-store): goods bought off the store's shelves (`buy`: what it
  // costs; never sold back -- no `at`), each with what it is for (`use`): bait on the next cast, a show on the square for
  // everyone near, a gift wrap, an islander's errand, a keepsake. Seeds and saplings come with planting.
  ...Object.fromEntries(Object.entries(GOODS_DEFS()).map(([id, g]) => [id, { name: g[0], icon: g[1], at: null, price: 0, buy: g[2], use: g[3], good: true }])),
};
const PLACES = { office: '관공서', merchant: '상인', owner: '주인', fisher: '어부' };
function GOODS_DEFS() { // id: [name, icon, price, use]
  return {
    bait: ['낚시 미끼', '🪱', 300, 'bait'], bait_premium: ['고급 미끼', '✨', 1000, 'bait'],
    firework: ['폭죽', '🎆', 800, 'show'], balloon: ['풍선', '🎈', 300, 'show'], bubbles: ['비눗방울', '🫧', 200, 'show'],
    gift_wrap: ['선물 포장지', '🎁', 500, 'gift'],
    bread: ['빵 봉투', '🥖', 400, 'errand'], milk: ['우유', '🥛', 300, 'errand'], bouquet: ['꽃다발', '💐', 1200, 'errand'], letter_paper: ['편지지', '✉️', 200, 'errand'],
    bulb: ['전구', '💡', 500, 'errand'], paint: ['물감', '🎨', 800, 'errand'], guitar_string: ['기타 줄', '🎸', 400, 'errand'], nail_box: ['못 상자', '🔩', 300, 'errand'],
    frame: ['기념 액자', '🖼️', 2000, 'keep'], badge: ['기념 배지', '🎖️', 1000, 'keep'],
    // B 45 심기: seeds and the sapling go into the ground (lib/island-plants.js), fertilizer onto a plant
    seed_flower_red: ['빨강 꽃씨', '🌺', 300, 'plant'], seed_flower_yellow: ['노랑 꽃씨', '🌼', 300, 'plant'], seed_flower_white: ['흰 꽃씨', '🤍', 300, 'plant'],
    bugnet: ['잠자리채', '🥅', 1500, 'tool'], // B 47 곤충 채집 (kept: a swing does not use it up)
    fishing_rod: ['낚싯대', '🎣', 1500, 'tool'], // (사용자 2026-10-18: 잠자리채처럼 낚싯대도 잡화점에서 -- one in the bag to fish)
    // 자전거 (docs/bicycle-20261020.md): four colours, kept -- the one in the bag is ridden (B, or the phone's button)
    bike_mint: ['자전거 (민트)', '🚲', 12000, 'bike'], bike_red: ['자전거 (빨강)', '🚲', 12000, 'bike'], bike_sky: ['자전거 (하늘)', '🚲', 12000, 'bike'], bike_butter: ['자전거 (버터)', '🚲', 12000, 'bike'],
    pet_puppy: ['강아지', '🐶', 8000, 'pet'], pet_kitten: ['고양이', '🐱', 8000, 'pet'], pet_bird: ['어깨 새', '🐦', 6000, 'pet'], // B 47 반려동물 (kept: one walks with me)
    seed_flower_pink: ['분홍 꽃씨', '🌸', 300, 'plant'], seed_flower_purple: ['보라 꽃씨', '💜', 300, 'plant'], sapling: ['묘목', '🌱', 1500, 'plant'], fertilizer: ['비료', '🧪', 500, 'fertilize'],
  };
}
const GOODS = Object.freeze(Object.keys(GOODS_DEFS()));
const ONCE_USES = Object.freeze(['tool', 'bike']); // (문제 기록 5회차 10-①: kept things -- bought once, one at a time)

// v1.10.33 섬 제초 요청 (사용자 지시 2026-10-06): for a day the town hall pays weeds at three times their price. A
// boost is only this entry: its item, the multiple and its time (the server clock, Asia/Seoul); past boosts can stay.
const PRICE_BOOSTS = Object.freeze([
  { itemId: 'weed', multiplier: 3, startAt: '2026-10-06T00:00:00+09:00', endAt: '2026-10-07T00:00:00+09:00' },
]);
// v1.10.91 경제 값 관리: the administrator's price for an item (lib/economy.js, set by the server), else its own
let priceHook = () => null;
const setPriceHook = (fn) => { priceHook = typeof fn === 'function' ? fn : () => null; };
function priceOf(itemId, now = Date.now()) {
  const base = priceHook(itemId) ?? (ITEMS[itemId]?.price || 0);
  const boost = PRICE_BOOSTS.find((b) => b.itemId === itemId && now >= Date.parse(b.startAt) && now < Date.parse(b.endAt));
  return boost ? base * boost.multiplier : base;
}
const itemDef = (id) => (Object.prototype.hasOwnProperty.call(ITEMS, id) ? ITEMS[id] : null);
// What a bag looks like to its owner: each entry with its name and icon (the definitions stay on the server).
function deliveryPlace(entry, activeLost = null) {
  const at = itemDef(entry.itemId)?.at || null;
  return at === 'owner' && activeLost && !activeLost.includes(entry.meta?.eventId) ? 'office' : at;
}
function bagView(entries, now = Date.now(), activeLost = null, slots = BAG_SLOTS) {
  return {
    slots,
    items: entries.map((e) => ({ entryId: e.entryId, itemId: e.itemId, qty: e.qty, name: itemDef(e.itemId)?.name || e.itemId, icon: itemDef(e.itemId)?.icon || '❔', at: deliveryPlace(e, activeLost), price: priceOf(e.itemId, now), meta: e.meta || null })),
  };
}
// Adding qty of an item to a bag (a plain list of entries): the new list, or null when it does not fit. Stackable
// items fill their slot up to STACK_MAX first; a unique item always takes a slot of its own.
// v1.10.37 연계 퀘스트: `qty` of a thing taken out of the bag (given to an islander) -> the bag after, or null if short
function takeFromBag(entries, itemId, qty) {
  let left = qty; const out = [];
  for (const e of entries) {
    if (e.itemId !== itemId || left === 0) { out.push(e); continue; }
    const n = Math.min(left, e.qty); left -= n;
    if (e.qty > n) out.push({ ...e, qty: e.qty - n });
  }
  return left === 0 ? out : null;
}
function addToBag(entries, itemId, qty, entryId, meta = null, slots = BAG_SLOTS) {
  const def = itemDef(itemId);
  if (!def || !Number.isSafeInteger(qty) || qty < 1) return null;
  const out = entries.map((e) => ({ ...e }));
  if (def.unique) {
    if (out.length + qty > slots) return null;
    for (let i = 0; i < qty; i += 1) out.push({ entryId: qty === 1 ? entryId : `${entryId}:${i}`, itemId, qty: 1, meta });
    return out;
  }
  const max = def.stack || STACK_MAX;
  let left = qty;
  for (const slot of out) {
    if (slot.itemId !== itemId || slot.qty >= max) continue;
    const added = Math.min(left, max - slot.qty);
    slot.qty += added; left -= added;
    if (!left) return out;
  }
  if (Math.ceil(left / max) > slots - out.length) return null;
  const used = new Set(out.map(e => e.entryId));
  let suffix = 0;
  while (left) {
    let id = itemId;
    while (used.has(id)) id = `${itemId}:${++suffix}`;
    used.add(id);
    const n = Math.min(left, max);
    out.push({ entryId: id, itemId, qty: n, meta: null }); left -= n;
  }
  return out;
}
// Selling everything a place takes, highest price first, as far as today's limit allows: { keep, sold, paid }.
// `activeLost` (v1.10.11): the lost-thing events still waiting for their owner; a lost thing whose owner has gone is
// taken by the town hall instead (lost and found).
function sellAt(entries, place, earnedToday, activeLost = null, now = Date.now()) {
  const takes = (e, def) => def && deliveryPlace(e, activeLost) === place;
  let room = Math.max(0, DAILY_CAP - earnedToday);
  const keep = []; const sold = []; let paid = 0;
  const order = entries.map((e, i) => ({ e, i, def: itemDef(e.itemId) && { ...itemDef(e.itemId), price: priceOf(e.itemId, now) } }))
    .sort((a, b) => (b.def?.price || 0) - (a.def?.price || 0) || a.i - b.i);
  const left = new Map();
  for (const { e, def } of order) {
    if (!takes(e, def)) { left.set(e.entryId, e.qty); continue; }
    const n = def.uncapped ? e.qty : Math.min(e.qty, Math.floor(room / def.price)); // weeds: every one, outside the limit
    if (n > 0) { sold.push({ itemId: e.itemId, qty: n, price: def.price }); paid += n * def.price; if (!def.uncapped) room -= n * def.price; }
    left.set(e.entryId, e.qty - n);
  }
  for (const e of entries) { const q = left.get(e.entryId); if (q > 0) keep.push({ ...e, qty: q }); }
  const uncappedPaid = sold.filter((s) => itemDef(s.itemId).uncapped).reduce((n, s) => n + s.qty * s.price, 0);
  return { keep, sold, paid, uncappedPaid, capped: entries.some((e) => takes(e, itemDef(e.itemId)) && (left.get(e.entryId) || 0) > 0) };
}

// v1.10.195 내 순서 (사용자 「가방 순서를 각자 옮겨서」): the bag in the order given -- every entry once, nothing new -- or null
function reorderBag(entries, ids) {
  if (!Array.isArray(ids) || ids.length !== entries.length) return null;
  const byId = new Map(entries.map((e) => [e.entryId, e]));
  if (new Set(ids).size !== ids.length || !ids.every((id) => byId.has(id))) return null;
  return ids.map((id) => ({ ...byId.get(id) }));
}
// 정리: tools, then fish, insects, the island's materials, the rest -- each kind's own order kept
const sortGroup = (itemId) => (/^(bugnet|fishing_rod|bike_|pet_)/.test(itemId) ? 0 : itemId.startsWith('fish_') ? 1 : itemId.startsWith('insect_') ? 2
  : /^(herb|berry|mushroom|weed|harvest|trash|bait|seed_|sapling|fertilizer)/.test(itemId) ? 3 : 4);
const sortBag = (entries) => entries.map((e, i) => [sortGroup(e.itemId), i, e]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, , e]) => ({ ...e }));

module.exports = { BAG_GROW, setSlotsHook, slotsOf, reorderBag, sortBag, ONCE_USES, BAG_SLOTS, STACK_MAX, WEED_STACK, DAILY_CAP, ITEMS, PLACES, GOODS, PRICE_BOOSTS, priceOf, setPriceHook, itemDef, deliveryPlace, bagView, addToBag, takeFromBag, sellAt };
