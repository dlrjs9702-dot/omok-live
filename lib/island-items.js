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
  // G4b 채집 (lib/island-gather.js; values proposed, 총괄 → 사용자): the rare blue mushroom, the twigs, the four-leaf clover
  mushroom_blue: { name: '푸른 버섯', icon: '🍄', at: 'merchant', price: 6000 },
  branch: { name: '나뭇가지', icon: '🪵', at: 'merchant', price: 500, shop: true },
  twig: { name: '잔가지', icon: '🌿', at: 'merchant', price: 300, shop: true },
  clover_four: { name: '네잎클로버', icon: '🍀', at: 'merchant', price: 10000 },
  wallet: { name: '잃어버린 지갑', icon: '👛', at: 'office', price: 10000, unique: true },
  lost: { name: '분실물', icon: '🧸', at: 'owner', price: 10000, unique: true },
  weed: { name: '잡초', icon: '🌱', at: 'office', price: 310, stack: WEED_STACK, uncapped: true, shop: true }, // v1.10.31 잡초 채집; v1.10.89 200→310P: the pull is 1.4 s (was 0.9), the pay per hour kept (200 × 1.4 / 0.9)
  harvest: { name: '밭 채소', icon: '🥕', at: 'merchant', price: 3000 }, // v1.10.89 농부 밭 수확: once a week each, when the field is grown
  // v1.10.318 마당 농사·집 손보기 (public/plaza/island-farm.js): the small stones (G4b 채집, by the rocks), the compost made of weeds
  // (no price: made, used on a bed), the six crops off the yard's beds (sold to the merchant)
  // (362 잡화점 재료, 사용자 「물고기 곤충은 제외, 집 만들기, 혹은 나중에 만들 더 좋은 도구들을 만들기 위한 재료들에만」: `shop: true` -- sold at the
  // 잡화점 at what the merchant pays times `ore:shopMul`; a new material joins with that flag; `worth` the base for one he does not buy)
  stone: { name: '작은 돌', icon: '🪨', at: 'merchant', price: 100, shop: true }, // (362 사용자 1A: 300 → 100P -- a miss paid better than an ore)
  // 366 별똥별 소원 → 별 조각 (notes docs/star-wish-20261118.md, 사용자 A · 「3000포인트에 3만 포인트로」): a wish's gift the next day --
  // materials for the star furniture; the merchant buys them, the 벼룩시장 takes them, never the 잡화점 (no `shop`: only a wish brings them)
  star_fragment: { name: '별 조각', icon: '⭐', at: 'merchant', price: 3000 },
  star_fragment_shiny: { name: '반짝이는 별 조각', icon: '🌟', at: 'merchant', price: 30000 },
  compost: { name: '퇴비', icon: '🟫', at: null, price: 0, use: 'farm', shop: true, worth: 930 /* (its three 잡초) */ },
  ore: { name: '광석', icon: '🟠', at: 'merchant', price: 300 }, // (1.10.323 채석장: mined on the ridge -- the week's 손보기 takes 5; 1.10.324 사용자 58A 800 → 300P; 1.10.342: one mined before the eight kinds)
  // 1.10.342 광석 8가지 (notes gather-must-ideas 82, assets 140): the merchant buys 흔함 at 200P and 보통 at 300P (사용자 146A); 은·수정·금 he
  // does not take -- the 벼룩시장 and making only, their `price` the worth the 벼룩시장 counts from (사용자 152A: 800 · 1,000 · 2,000)
  ...Object.fromEntries(require('./island-ores').ORES.map((o) => [`ore_${o.id}`, { name: o.name, icon: o.icon, at: o.merchant ? 'merchant' : null, price: o.price, ore: o.id, shop: true }])),
  ...Object.fromEntries(Object.entries(require('../public/plaza/island-farm').CROPS).map(([c, d]) => [`crop_${c}`, { name: d.name, icon: d.icon, at: 'merchant', price: d.price }])),
  candy: { name: '사탕 주머니', icon: '🍬', at: 'merchant', price: 1500 }, // v1.10.39 10월 할로윈: the kid's request, or sold
  // v1.10.42 낚시: every fish, sold all at once to the harbour fisherman
  ...Object.fromEntries(Object.entries(require('./island-fishing').SPECIES).map(([id, f]) => [`fish_${id}`, { name: f.name, icon: f.icon, at: 'fisher', price: f.price }])),
  // B 47 곤충: every insect, sold to the merchant (or given to the museum)
  ...Object.fromEntries(Object.entries(require('./island-insects').SPECIES).map(([id, b]) => [`insect_${id}`, { name: b.name, icon: b.icon, at: 'merchant', price: b.price }])),
  // v1.10.92 잡화점 (사용자 2026-10-18, IDEAS #future-general-store): goods bought off the store's shelves (`buy`: what it
  // costs; never sold back -- no `at`), each with what it is for (`use`): bait on the next cast, a show on the square for
  // everyone near, a gift wrap, an islander's errand, a keepsake. Seeds and saplings come with planting.
  ...Object.fromEntries(Object.entries(GOODS_DEFS()).map(([id, g]) => [id, { name: g[0], icon: g[1], at: null, price: 0, buy: g[2], use: g[3], good: true, ...(g[3] === 'tool' ? { unique: true } : {}) }])), // (v1.10.221: a tool its own slot, its own uses)
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
    // v1.10.221 도구 닳기: the sturdy ones (80 catches; about 2.5 times the plain one's price, the same models)
    bugnet_sturdy: ['튼튼한 잠자리채', '🥅', 3800, 'tool'], fishing_rod_sturdy: ['튼튼한 낚싯대', '🎣', 3800, 'tool'],
    pickaxe: ['곡괭이', '⛏️', 2000, 'tool'], // (1.10.323 채석장, assets 129: 40 ores -- price 사용자 확인 필요)
    // 자전거 (docs/bicycle-20261020.md): four colours, kept -- the one in the bag is ridden (B, or the phone's button)
    bike_mint: ['자전거 (민트)', '🚲', 12000, 'bike'], bike_red: ['자전거 (빨강)', '🚲', 12000, 'bike'], bike_sky: ['자전거 (하늘)', '🚲', 12000, 'bike'], bike_butter: ['자전거 (버터)', '🚲', 12000, 'bike'],
    pet_puppy: ['강아지', '🐶', 8000, 'pet'], pet_kitten: ['고양이', '🐱', 8000, 'pet'], pet_bird: ['어깨 새', '🐦', 6000, 'pet'], // B 47 반려동물 (kept: one walks with me)
    seed_flower_pink: ['분홍 꽃씨', '🌸', 300, 'plant'], seed_flower_purple: ['보라 꽃씨', '💜', 300, 'plant'], sapling: ['묘목', '🌱', 1500, 'plant'], fertilizer: ['비료', '🧪', 500, 'fertilize'],
    // v1.10.318 마당 농사 F1: a crop's seeds, a bag a cell (sown at a yard's bed -- island-farm)
    ...Object.fromEntries(Object.entries(require('../public/plaza/island-farm').CROPS).map(([c, d]) => [`seed_${c}`, [`${d.name} 씨앗`, '🌱', d.seed, 'farm']])),
  };
}
const GOODS = Object.freeze(Object.keys(GOODS_DEFS()));
const ONCE_USES = Object.freeze(['tool', 'bike']); // (문제 기록 5회차 10-①: kept things -- bought once, one at a time)
// v1.10.221 도구 닳기 (gamecenter-notes docs/spending-sinks-20261025.md ③, 사용자 「동물의 숲처럼 쓸수록 닳아서 다시 사야」): a rod
// or a net has catches left (meta.uses; none written yet -- the full count: one held before this is full) -- a real catch
// takes one from the most worn of its kind, at 0 it breaks and is gone (no mending). Up to TOOL_MAX of a kind; a bike never wears.
const TOOL_USES = Object.freeze({ fishing_rod: 30, bugnet: 30, fishing_rod_sturdy: 80, bugnet_sturdy: 80, pickaxe: 40 });
const TOOL_KIND = Object.freeze({ fishing_rod: 'fishing_rod', fishing_rod_sturdy: 'fishing_rod', bugnet: 'bugnet', bugnet_sturdy: 'bugnet', pickaxe: 'pickaxe' });
const TOOL_MAX = 3; const TOOL_WORN = 5; // (5 left: the note 「많이 낡았어요」)
const usesOf = (e) => (Number.isInteger(e.meta?.uses) ? e.meta.uses : TOOL_USES[e.itemId]);
const toolCount = (entries, kind) => entries.filter((e) => TOOL_KIND[e.itemId] === kind).reduce((n, e) => n + (e.qty || 1), 0);
// one catch with a kind of tool -> { entries, worn: { itemId, name, uses, broke } }, or null without one
function wearTool(entries, kind) {
  let pick = -1; entries.forEach((e, i) => { if (TOOL_KIND[e.itemId] === kind && (pick < 0 || usesOf(e) < usesOf(entries[pick]))) pick = i; });
  if (pick < 0) return null;
  const e = entries[pick]; const uses = usesOf(e) - 1; const out = entries.map((x) => ({ ...x }));
  if (uses > 0) out[pick] = { ...e, meta: { ...(e.meta || {}), uses } };
  else if (e.qty > 1) out[pick] = { ...e, qty: e.qty - 1, meta: null }; // ponytail: an old stack of two (before 221) -- the next one fresh
  else out.splice(pick, 1);
  return { entries: out, worn: { itemId: e.itemId, name: ITEMS[e.itemId].name, kind, uses: Math.max(0, uses), max: TOOL_USES[e.itemId], broke: uses <= 0 } };
}

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
// v1.10.231 물고기 크기 (docs/fish-size-20261027.md): a fish stack keeps its sizes (meta.sizes, biggest first; one from
// before sizes counts as its kind's middle -- 「옛 물고기」); sold, given and handed over smallest first, the biggest kept
// for the museum; paid by size (x 경제 값 fish:sizeMin~fish:sizeMax %, the average as before)
const Fishing = require('./island-fishing');
const fishOf = (itemId) => { const sp = String(itemId).startsWith('fish_') ? itemId.slice(5) : null; return sp && Fishing.SIZES[sp] ? sp : null; };
let sizeHook = () => null;
const setSizeHook = (fn) => { sizeHook = typeof fn === 'function' ? fn : () => null; };
const sizeRange = () => { const r = sizeHook(); return Array.isArray(r) && r.every(Number.isFinite) ? [r[0] / 100, r[1] / 100] : [0.8, 1.3]; };
function sizesOf(e) {
  const sp = fishOf(e.itemId); if (!sp) return null;
  const have = (Array.isArray(e.meta?.sizes) ? e.meta.sizes : []).filter((n) => Number.isFinite(n) && n > 0).slice(0, e.qty);
  while (have.length < e.qty) have.push(Fishing.midSize(sp));
  return have.sort((a, b) => b - a);
}
// v1.10.297 물고기 통·곤충 채집통 (notes docs/fish-keepnet-20261109.md, 사용자 확정): bought at the 잡화점, 30 -> 60 -> 90 -> 120
// slots. A catch goes into its box first (meta.box 'fish' | 'insect' -- kept in the same list as the bag, so selling, the
// museum, requests, bets and gifts take from it as from the bag), into the bag once the box is full. A fish is one a slot
// (사용자 「다 각자의 크기가 따로」), insects stack by kind. `slots` of addToBag / bagView: the bag's number, or capOf's
// { bag, fish, insect }.
// (362 사용자 「50 > 100 > 200」 1A·2A, notes fish-keepnet 끝: three sizes now; one bought before steps up free -- 30 -> 50, 60·90 -> 100,
// 120 -> 200 -- read so wherever it is kept, and the kept value rewritten once at the server's start)
const BOX_GROW = Object.freeze([50, 100, 200]);
const BOX_STEP = Object.freeze({ 30: 50, 60: 100, 90: 100, 120: 200 });
// (362, 총괄: one table of the box kinds -- the 2nd bag overhaul's 채집 바구니·재료 상자 (notes bag-tabs) come in as rows: what it takes,
// its economy key (`<key>:<slots>`), its name, and whether its things are one a slot (fish: each its size) or stacked)
const BOX_KINDS = Object.freeze({
  fish: Object.freeze({ key: 'keepnet', name: '물고기 통', single: true, takes: (itemId) => Boolean(fishOf(itemId)) }),
  insect: Object.freeze({ key: 'bugbox', name: '곤충 채집통', single: false, takes: (itemId) => String(itemId).startsWith('insect_') && Boolean(itemDef(itemId)) }),
});
const BOXES = Object.freeze(Object.keys(BOX_KINDS));
const boxFor = (itemId) => BOXES.find((k) => BOX_KINDS[k].takes(itemId)) || null;
const inBox = (e) => (BOXES.includes(e.meta?.box) ? e.meta.box : null);
const boughtOf = (e) => Boolean(e?.meta?.bought); // (1.10.340 섬 벼룩시장 「산 것」, review-plan §1-3: kept out of the 낚시왕 and the museum)
let boxHook = () => null;
const setBoxHook = (fn) => { boxHook = typeof fn === 'function' ? fn : () => null; };
const boxOf = (userId, kind) => { const n = Number(boxHook(userId, kind)); const s = BOX_STEP[n] ?? n; return BOX_GROW.includes(s) ? s : 0; };
const capOf = (userId) => ({ bag: slotsOf(userId), fish: boxOf(userId, 'fish'), insect: boxOf(userId, 'insect') });
const capArg = (c) => (typeof c === 'number' ? { bag: c, fish: 0, insect: 0 } : { bag: c?.bag ?? BAG_SLOTS, fish: c?.fish || 0, insect: c?.insect || 0 });
const gradeOf = (itemId) => (fishOf(itemId) ? Fishing.SPECIES[fishOf(itemId)]?.grade : require('./island-insects').SPECIES[String(itemId).slice(7)]?.grade) || null;
// 가방에서 옮기기 (총괄 #447): the bag's own fish (or insects) into their box as far as it has room -- the biggest fish first,
// the rest left in the bag -> { entries, moved }, or null when nothing moved (none, or the box full / not bought)
function fillBox(entries, kind, slots) {
  const cap = capArg(slots); if (!BOXES.includes(kind) || !cap[kind]) return null;
  const only = { bag: 0, fish: 0, insect: 0, [kind]: cap[kind] }; /* (the box alone: full -- addToBag says no) */
  let boxed = entries.filter(inBox).map((e) => ({ ...e })); const bag = []; let moved = 0;
  const taken = entries.map((e) => e.entryId); /* (Codex 291~300 #1: a new box entry never the id of a stack left in the bag) */
  for (const e of entries.filter((x) => !inBox(x))) {
    if (boxFor(e.itemId) !== kind) { bag.push({ ...e }); continue; }
    const sizes = kind === 'fish' ? sizesOf(e) : null; let left = e.qty; const b = boughtOf(e) ? { bought: true } : null;
    while (left) { const next = addToBag(boxed, e.itemId, 1, `${e.entryId}~${moved}`, sizes ? { size: sizes[e.qty - left], ...b } : b, only, taken); if (!next) break; boxed = next; left -= 1; moved += 1; }
    if (left) bag.push(left === e.qty ? { ...e } : { ...e, qty: left, ...(sizes ? { meta: { ...(e.meta || {}), sizes: sizes.slice(e.qty - left) } } : {}) });
  }
  return moved ? { entries: [...bag, ...boxed], moved } : null;
}
// 362 사용자 3A: the bag's old fish stacks, one fish a slot -- each in the bag while it has room (a stack's own slot counts, the
// biggest first), the rest into the fish box while it has room, what still has none left stacked as it was (sold or given in time;
// no fish lost). Again on the same bag: nothing to do -> { entries, split, toBox, left }, or null (no stack)
function splitFish(entries, slots) {
  const cap = capArg(slots); const isStack = (e) => !inBox(e) && fishOf(e.itemId) && e.qty > 1;
  if (!entries.some(isStack)) return null;
  const used = new Set(entries.map((e) => e.entryId)); const id = (base) => { let k = 0; let s = base; while (used.has(s)) s = `${base}~${++k}`; used.add(s); return s; };
  const keep = entries.filter((e) => !isStack(e)).map((e) => ({ ...e })); let free = cap.bag - keep.filter((e) => !inBox(e)).length; let boxFree = cap.fish - keep.filter((e) => inBox(e) === 'fish').length;
  let split = 0; let toBox = 0; let left = 0; const out = [...keep]; const stacks = entries.filter(isStack);
  stacks.forEach((e, k) => {
    const sizes = sizesOf(e); const b = boughtOf(e) ? { bought: true } : {}; const n = sizes.length;
    const avail = free - (stacks.length - 1 - k); /* (each stack still to come keeps a slot: its own was one) */
    const all = n <= avail + boxFree; const inBag = all ? Math.min(n, avail) : Math.max(0, avail - 1); /* (one not all out: its rest keeps a slot) */
    const inBoxN = all ? n - inBag : Math.min(boxFree, n - inBag); const rest = sizes.slice(inBag + inBoxN);
    sizes.slice(0, inBag).forEach((cm, i) => { out.push({ entryId: i === 0 ? e.entryId : id(e.entryId), itemId: e.itemId, qty: 1, meta: { ...(e.meta || {}), sizes: [cm] } }); });
    sizes.slice(inBag, inBag + inBoxN).forEach((cm) => { out.push({ entryId: id(`${e.entryId}~box`), itemId: e.itemId, qty: 1, meta: { box: 'fish', sizes: [cm], ...b } }); });
    if (rest.length) out.push({ entryId: inBag ? id(e.entryId) : e.entryId, itemId: e.itemId, qty: rest.length, meta: { ...(e.meta || {}), sizes: rest } });
    free -= inBag + (rest.length ? 1 : 0); boxFree -= inBoxN; split += inBag; toBox += inBoxN; left += rest.length;
  });
  return split + toBox ? { entries: out, split, toBox, left } : null; /* (only stacks with no room anywhere: as they were) */
}
// 놓아주기: one entry out of its box (value nothing; the 도감 keeps it) -> the list, or null (not there / not in a box)
function releaseFromBox(entries, entryId) { const i = entries.findIndex((e) => e.entryId === entryId && inBox(e)); return i < 0 ? null : entries.filter((_, k) => k !== i).map((e) => ({ ...e })); }
const fishPrice = (itemId, cm, now = Date.now()) => { const [lo, hi] = sizeRange(); return Math.round(priceOf(itemId, now) * Fishing.sizeMult(fishOf(itemId), cm, lo, hi)); };
// the size that would go next from the bag: the smallest (or the biggest) of that fish, or null (not a fish, none)
function pickSize(entries, itemId, largest = false, caught = false) { /* (caught: not one bought at the 벼룩시장 -- the museum's) */
  const all = entries.filter((e) => e.itemId === itemId && !(caught && boughtOf(e))).flatMap((e) => sizesOf(e) || []);
  return all.length ? (largest ? Math.max(...all) : Math.min(...all)) : null;
}
// What a bag looks like to its owner: each entry with its name and icon (the definitions stay on the server).
function deliveryPlace(entry, activeLost = null) {
  const at = itemDef(entry.itemId)?.at || null;
  return at === 'owner' && activeLost && !activeLost.includes(entry.meta?.eventId) ? 'office' : at;
}
function bagView(entries, now = Date.now(), activeLost = null, slots = BAG_SLOTS) {
  const cap = capArg(slots);
  return {
    slots: cap.bag, boxes: { fish: cap.fish, insect: cap.insect }, /* (297: each box's size, 0 = none) */
    items: entries.map((e) => ({ entryId: e.entryId, itemId: e.itemId, qty: e.qty, name: itemDef(e.itemId)?.name || e.itemId, icon: itemDef(e.itemId)?.icon || '❔', at: deliveryPlace(e, activeLost), price: priceOf(e.itemId, now), meta: e.meta || null, ...(fishOf(e.itemId) ? { sizes: sizesOf(e), sizePrices: sizesOf(e).map((cm) => fishPrice(e.itemId, cm, now)) /* (362 Codex 351-360 #4: what each pays, as sellAt pays it) */ } : {}),
      ...(boxFor(e.itemId) ? { box: inBox(e), grade: gradeOf(e.itemId), ...(boughtOf(e) ? { bought: true } : {}) } : {}), /* (297: in a box or the bag; the box's order by grade) */
      ...(TOOL_KIND[e.itemId] ? { tool: TOOL_KIND[e.itemId], uses: usesOf(e), usesMax: TOOL_USES[e.itemId] } : {}) })), // (v1.10.221: a tool's catches left)
  };
}
// Adding qty of an item to a bag (a plain list of entries): the new list, or null when it does not fit. Stackable
// items fill their slot up to STACK_MAX first; a unique item always takes a slot of its own.
// v1.10.37 연계 퀘스트: `qty` of a thing taken out of the bag (given to an islander) -> the bag after, or null if short
function takeFromBag(entries, itemId, qty, largest = false, caught = false) { /* (caught: 1.10.340 -- the 벼룩시장's bought ones left) */
  const mine = (e) => e.itemId === itemId && !(caught && boughtOf(e));
  if (fishOf(itemId)) { // (sizes: the qty smallest -- or biggest -- of all that fish's stacks go)
    const all = entries.flatMap((e, i) => (mine(e) ? sizesOf(e).map((cm) => [cm, i]) : [])).sort((a, b) => (largest ? b[0] - a[0] : a[0] - b[0]));
    if (all.length < qty) return null;
    const gone = new Map(); for (const [cm, i] of all.slice(0, qty)) { const l = gone.get(i) || []; l.push(cm); gone.set(i, l); }
    const out = [];
    entries.forEach((e, i) => {
      if (!gone.has(i)) { out.push(e); return; }
      const sizes = sizesOf(e); for (const cm of gone.get(i)) sizes.splice(sizes.indexOf(cm), 1);
      if (sizes.length) out.push({ ...e, qty: sizes.length, meta: { ...(e.meta || {}), sizes } });
    });
    return out;
  }
  let left = qty; const out = [];
  for (const e of entries) {
    if (!mine(e) || left === 0) { out.push(e); continue; }
    const n = Math.min(left, e.qty); left -= n;
    if (e.qty > n) out.push({ ...e, qty: e.qty - n });
  }
  return left === 0 ? out : null;
}
// 1.10.339 섬 벼룩시장 (137A): qty out of one entry -- a fish stack's smallest qty sizes, the rest kept with their sizes (and its box)
// -> { keep, sizes } (sizes: the ones taken, biggest first; null for anything else), or null (no such entry, not that many)
function takeEntry(entries, entryId, qty) {
  const i = entries.findIndex((e) => e.entryId === entryId); const e = entries[i];
  if (!e || !Number.isSafeInteger(qty) || qty < 1 || qty > e.qty) return null;
  const out = entries.map((x) => ({ ...x })); const sizes = sizesOf(e);
  if (sizes) { const rest = sizes.slice(0, sizes.length - qty); if (rest.length) out[i] = { ...e, qty: rest.length, meta: { ...(e.meta || {}), sizes: rest } }; else out.splice(i, 1); return { keep: out, sizes: sizes.slice(sizes.length - qty) }; }
  if (e.qty > qty) out[i] = { ...e, qty: e.qty - qty }; else out.splice(i, 1);
  return { keep: out, sizes: null };
}
function addToBag(entries, itemId, qty, entryId, meta = null, slots = BAG_SLOTS, reserved = null) { // (reserved: ids taken outside `entries` -- fillBox's bag)
  const def = itemDef(itemId);
  if (!def || !Number.isSafeInteger(qty) || qty < 1) return null;
  const cap = capArg(slots);
  const out = entries.map((e) => ({ ...e }));
  const sp = fishOf(itemId); const incoming = sp ? (Array.isArray(meta?.sizes) ? meta.sizes : Number.isFinite(meta?.size) ? [meta.size] : []).filter((n) => Number.isFinite(n) && n > 0) : null;
  const sizesFor = (n) => { const l = incoming.splice(0, n); while (l.length < n) l.push(Fishing.midSize(sp)); return l; };
  const bought = Boolean(meta?.bought); const same = (e) => boughtOf(e) === bought; const mark = bought ? { bought: true } : {}; /* (1.10.340 「산 것」: its own stacks) */
  const used = new Set([...out.map(e => e.entryId), ...(reserved || [])]);
  let suffix = 0;
  const max = def.stack || STACK_MAX;
  let left = qty;
  const box = boxFor(itemId); /* (297: its box first -- a fish one a slot with its size, insects stacked) */
  if (box && cap[box] > 0) {
    const mine = () => out.filter((e) => inBox(e) === box); const single = BOX_KINDS[box].single; /* (362: by its row -- one a slot, or stacked) */
    if (!single) for (const slot of mine()) { if (slot.itemId !== itemId || slot.qty >= max || !same(slot)) continue; const added = Math.min(left, max - slot.qty); slot.qty += added; left -= added; if (!left) return out; }
    while (left && mine().length < cap[box]) {
      let id = single ? entryId : itemId; while (used.has(id)) id = `${single ? entryId : itemId}:${++suffix}`; used.add(id);
      const n = single ? 1 : Math.min(left, max);
      out.push({ entryId: id, itemId, qty: n, meta: sp ? { box, sizes: sizesFor(1), ...mark } : { box, ...mark } }); left -= n;
    }
    if (!left) return out;
  }
  const bagUsed = out.filter((e) => !inBox(e)).length;
  if (sp) { // (362 사용자 3A 「가방도 통처럼 한마리당 한 칸」: a fish its own slot with its size -- never onto a stack, an old one left by splitFish either)
    if (left > cap.bag - bagUsed) return null;
    while (left) { let id = entryId || itemId; while (used.has(id)) id = `${entryId || itemId}:${++suffix}`; used.add(id); out.push({ entryId: id, itemId, qty: 1, meta: { sizes: sizesFor(1), ...mark } }); left -= 1; }
    return out;
  }
  if (def.unique) {
    if (bagUsed + left > cap.bag) return null;
    for (let i = 0; i < left; i += 1) out.push({ entryId: left === 1 ? entryId : `${entryId}:${i}`, itemId, qty: 1, meta });
    return out;
  }
  for (const slot of out) {
    if (inBox(slot) || slot.itemId !== itemId || slot.qty >= max || !same(slot)) continue;
    const added = Math.min(left, max - slot.qty);
    if (sp) slot.meta = { ...(slot.meta || {}), sizes: [...sizesOf(slot), ...sizesFor(added)].sort((a, b) => b - a) };
    slot.qty += added; left -= added;
    if (!left) return out;
  }
  if (Math.ceil(left / max) > cap.bag - bagUsed) return null;
  while (left) {
    let id = itemId;
    while (used.has(id)) id = `${itemId}:${++suffix}`;
    used.add(id);
    const n = Math.min(left, max);
    out.push({ entryId: id, itemId, qty: n, meta: sp ? { sizes: sizesFor(n).sort((a, b) => b - a), ...mark } : bought ? { bought: true } : null }); left -= n;
  }
  return out;
}
// Selling everything a place takes, highest price first, as far as today's limit allows: { keep, sold, paid }.
// `activeLost` (v1.10.11): the lost-thing events still waiting for their owner; a lost thing whose owner has gone is
// taken by the town hall instead (lost and found).
// (364 관리자 섬 이벤트: `mults` { itemId: ×1.5~3 } -- the server's, for what is not 「산 것」 (bought: the base price, the shop's resale
// loophole closed); `extra` what the events paid over the base)
function sellAt(entries, place, earnedToday, activeLost = null, now = Date.now(), cap = DAILY_CAP, mults = null) { // (cap: a test's own limit)
  const places = [].concat(place); const takes = (e, def) => def && places.includes(deliveryPlace(e, activeLost)); // (v1.10.291: the 백화점's 노점 takes ['merchant', 'fisher'])
  const boost = (e) => (boughtOf(e) ? 1 : Math.min(3, Math.max(1, Number(mults?.[e.itemId]) || 1)));
  let room = Math.max(0, cap - earnedToday);
  const keep = []; const sold = []; let paid = 0; let extra = 0; const extraBy = {};
  const order = entries.map((e, i) => ({ e, i, def: itemDef(e.itemId) && { ...itemDef(e.itemId), base: priceOf(e.itemId, now), price: Math.round(priceOf(e.itemId, now) * boost(e)) } }))
    .sort((a, b) => (b.def?.price || 0) - (a.def?.price || 0) || a.i - b.i);
  const left = new Map(); const sizesLeft = new Map(); const fishDone = new Set();
  for (const { e, def } of order) {
    if (!takes(e, def)) { left.set(e.entryId, e.qty); continue; }
    if (sizesOf(e)) { // (v1.10.231: a fish's own price by its size, the smallest first -- Codex 6차 P3: of the species in every slot)
      if (fishDone.has(e.itemId)) continue; fishDone.add(e.itemId);
      const slots = order.filter((o) => o.e.itemId === e.itemId && takes(o.e, o.def));
      const all = slots.flatMap((o) => sizesOf(o.e).map((cm) => ({ cm, id: o.e.entryId, b: boughtOf(o.e) }))).sort((a, b) => a.cm - b.cm);
      let n = 0; let value = 0; let bn = 0; let bv = 0; /* (1.10.340: the bought ones apart -- not the 낚시왕's) */
      const fm = Math.min(3, Math.max(1, Number(mults?.[e.itemId]) || 1)); /* (364: the event's multiplier on the caught ones only) */
      for (const f of all) { const p0 = fishPrice(e.itemId, f.cm, now); const p = f.b ? p0 : Math.round(p0 * fm); if (!def.uncapped && value + p > room) break; value += p; extra += p - p0; if (p > p0) extraBy[e.itemId] = (extraBy[e.itemId] || 0) + p - p0; n += 1; if (f.b) { bn += 1; bv += p; } } // (총괄 231 검토: as many as fit at their own prices -- never past the limit)
      if (n > bn) sold.push({ itemId: e.itemId, qty: n - bn, price: Math.round((value - bv) / (n - bn)) }); if (bn) sold.push({ itemId: e.itemId, qty: bn, price: Math.round(bv / bn), bought: true });
      if (n > 0) { paid += value; if (!def.uncapped) room -= value; }
      const rest = all.slice(n); for (const o of slots) { const mine = rest.filter((f) => f.id === o.e.entryId).map((f) => f.cm).sort((a, b) => b - a); left.set(o.e.entryId, mine.length); sizesLeft.set(o.e.entryId, mine); }
      continue;
    }
    const n = def.uncapped ? e.qty : Math.max(0, Math.min(e.qty, Math.floor(room / def.price))); // weeds: every one, outside the limit
    if (n > 0) { sold.push({ itemId: e.itemId, qty: n, price: def.price, ...(boughtOf(e) ? { bought: true } : {}) }); paid += n * def.price; extra += n * (def.price - def.base); if (def.price > def.base) extraBy[e.itemId] = (extraBy[e.itemId] || 0) + n * (def.price - def.base); if (!def.uncapped) room -= n * def.price; }
    left.set(e.entryId, e.qty - n);
  }
  for (const e of entries) { const q = left.get(e.entryId); if (q > 0) keep.push(sizesLeft.has(e.entryId) ? { ...e, qty: q, meta: { ...(e.meta || {}), sizes: sizesLeft.get(e.entryId) } } : { ...e, qty: q }); }
  const uncappedPaid = sold.filter((s) => itemDef(s.itemId).uncapped).reduce((n, s) => n + s.qty * s.price, 0);
  return { keep, sold, paid, extra, extraBy, uncappedPaid, capped: entries.some((e) => takes(e, itemDef(e.itemId)) && (left.get(e.entryId) || 0) > 0) };
}

// 1.10.356 골라 팔기 (notes docs/bag-tabs-20261117.md 「잡화점 골라 팔기」): only what was picked -- [{ entryId, qty }] -- sold as
// sellAt sells (the place's takes, its prices, the day's limit, weeds outside it); a fish's picked ones its smallest sizes; what
// was not picked, and what of the picked the place would not take or the limit stopped, kept where it was in the bag
function sellPicked(entries, pick, place, earnedToday, activeLost = null, now = Date.now(), cap = DAILY_CAP, mults = null) {
  const want = new Map(); for (const p of pick || []) { const n = Math.floor(Number(p?.qty)); if (Number.isSafeInteger(n) && n > 0) want.set(String(p.entryId), (want.get(String(p.entryId)) || 0) + n); }
  const chosen = []; const rest = new Map();
  for (const e of entries) {
    const n = Math.min(e.qty, want.get(e.entryId) || 0); if (!n) continue; const s = sizesOf(e);
    if (s) { const up = [...s].sort((a, b) => a - b); chosen.push({ ...e, qty: n, meta: { ...(e.meta || {}), sizes: up.slice(0, n) } }); rest.set(e.entryId, { qty: e.qty - n, sizes: up.slice(n) }); }
    else { chosen.push({ ...e, qty: n }); rest.set(e.entryId, { qty: e.qty - n }); }
  }
  const r = sellAt(chosen, place, earnedToday, activeLost, now, cap, mults); const back = new Map(r.keep.map((k) => [k.entryId, k]));
  const keep = [];
  for (const e of entries) {
    if (!rest.has(e.entryId)) { keep.push(e); continue; }
    const rs = rest.get(e.entryId); const b = back.get(e.entryId); const q = rs.qty + (b ? b.qty : 0); if (q <= 0) continue;
    if (sizesOf(e)) keep.push({ ...e, qty: q, meta: { ...(e.meta || {}), sizes: [...rs.sizes, ...((b && sizesOf(b)) || [])].sort((x, y) => y - x) } }); else keep.push({ ...e, qty: q });
  }
  return { ...r, keep };
}

// v1.10.236 빠른 칸 (notes docs/quickbar-20261104.md): five slots, each a tool by its kind or a thing to use by its id (or
// empty) -- one in one slot only; anything else refused: the five, or null
const QUICK_SLOTS = 5; const QUICK_KINDS = Object.freeze(['bugnet', 'fishing_rod', 'firework', 'balloon', 'bubbles', 'pickaxe']); // (1.10.323: the 곡괭이)
function quickSlots(raw) {
  if (!Array.isArray(raw) || raw.length > QUICK_SLOTS) return null;
  const out = Array.from({ length: QUICK_SLOTS }, (_, k) => (raw[k] == null || raw[k] === '' ? null : raw[k]));
  if (out.some((k) => k !== null && k !== 'bike' && !QUICK_KINDS.includes(k))) return null; /* (v1.10.281 문제 기록 4: the bike too -- ridden from its slot, never held) */
  const used = out.filter(Boolean); return new Set(used).size === used.length ? out : null;
}
// v1.10.195 내 순서 (사용자 「가방 순서를 각자 옮겨서」): the bag in the order given -- every entry once, nothing new -- or null
function reorderBag(entries, ids) { /* (297: the bag's own entries -- the boxes keep theirs, after) */
  const bag = entries.filter((e) => !inBox(e)); const boxed = entries.filter(inBox).map((e) => ({ ...e }));
  if (!Array.isArray(ids) || ids.length !== bag.length) return null;
  const byId = new Map(bag.map((e) => [e.entryId, e]));
  if (new Set(ids).size !== ids.length || !ids.every((id) => byId.has(id))) return null;
  return [...ids.map((id) => ({ ...byId.get(id) })), ...boxed];
}
// 정리: tools, then fish, insects, the island's materials, the rest -- each kind's own order kept
const sortGroup = (itemId) => (/^(bugnet|fishing_rod|pickaxe|bike_|pet_)/.test(itemId) /* (the sturdy ones too) */ ? 0 : itemId.startsWith('fish_') ? 1 : itemId.startsWith('insect_') ? 2
  : /^(herb|berry|mushroom|weed|harvest|trash|bait|seed_|sapling|fertilizer)/.test(itemId) ? 3 : 4);
const sortBag = (entries) => [...entries.filter((e) => !inBox(e)).map((e, i) => [sortGroup(e.itemId), i, e]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, , e]) => ({ ...e })), ...entries.filter(inBox).map((e) => ({ ...e }))];

module.exports = { BOX_GROW, BOX_STEP, BOX_KINDS, BOXES, boxFor, inBox, boughtOf, setBoxHook, boxOf, capOf, releaseFromBox, fillBox, splitFish, QUICK_SLOTS, QUICK_KINDS, quickSlots, fishOf, setSizeHook, sizesOf, fishPrice, pickSize, TOOL_USES, TOOL_KIND, TOOL_MAX, TOOL_WORN, usesOf, toolCount, wearTool, BAG_GROW, setSlotsHook, slotsOf, reorderBag, sortBag, ONCE_USES, BAG_SLOTS, STACK_MAX, WEED_STACK, DAILY_CAP, ITEMS, PLACES, GOODS, PRICE_BOOSTS, priceOf, setPriceHook, itemDef, deliveryPlace, bagView, addToBag, takeFromBag, takeEntry, sellAt, sellPicked };
