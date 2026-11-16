'use strict';
// 1.10.339 섬 벼룩시장 (notes docs/island-auction-20261115.md; 사용자 49A·50A·51C·134·135B·136A·137A·138A): things put up at the
// board in 대청마당 at a price their seller sets, bought at that price by anyone else. What can be put up: what the bag holds (fish
// and insects, finds, crops, stones and ore, snacks, the store's goods) but not the kept things (tools, bikes, pets) or the office's
// (trash, a wallet, a lost thing), and pieces of furniture not placed (no trophies). The price: 0.5~20 times what it is worth
// (its sale price, else the store's). Up 3 days, 10 a seller; taken back any time before it sells (nothing paid). Sold: 5 % kept
// back (gone), the rest waits on the board for its seller's 「받기」. A fish keeps its size, a piece its own uid.
// The state (world value `flea`): { seq, list: [listing], owed: { account: { amount, n } }, held: { account: [thing] } } -- `held`:
// what could not go back to a full bag (handed over at the next look). Pure here; the server reads and writes it one at a time.
const Items = require('./island-items');

const FEE = 0.05; const DAYS = 3; const DAY_MS = 86400000; const MINE_MAX = 10; const LOW = 0.5; const HIGH = 20; const QTY_MAX = 99;
const NOT_SOLD = new Set(['trash', 'wallet', 'lost', 'compost', 'candy']); /* (review-plan §1-4: no snacks) */
const KEPT = new Set([...Items.ONCE_USES, 'pet']);

const sellable = (itemId) => { const d = Items.itemDef(itemId); return Boolean(d) && !d.unique && !NOT_SOLD.has(itemId) && !KEPT.has(d.use) && !Items.TOOL_KIND[itemId]; };
// what qty of it is worth: a fish by each size, anything else its sale price (or the store's: `goodPrice`) a piece
function worth(itemId, qty, sizes, now = Date.now(), goodPrice = () => 0) {
  if (Items.fishOf(itemId)) return (sizes || []).reduce((n, cm) => n + Items.fishPrice(itemId, cm, now), 0);
  return (Items.priceOf(itemId, now) || Number(goodPrice(itemId)) || 0) * qty;
}
const range = (base) => [Math.max(1, Math.ceil(base * LOW)), Math.max(1, Math.floor(base * HIGH))];
const feeOf = (price) => Math.ceil(price * FEE);
const netOf = (price) => price - feeOf(price);

const CATS = Object.freeze({ fish: '물고기', insect: '곤충', gather: '채집', crop: '작물', ore: '돌·광석', good: '잡화', furniture: '가구', yard: '마당' });
function catOf(l) {
  if (l.kind === 'piece') return l.yard ? 'yard' : 'furniture';
  const id = l.itemId;
  if (id.startsWith('fish_')) return 'fish'; if (id.startsWith('insect_')) return 'insect';
  if (id.startsWith('crop_') || id === 'harvest') return 'crop'; if (id === 'ore' || id === 'stone') return 'ore';
  if (Items.itemDef(id)?.good) return 'good';
  return 'gather';
}

const stateOf = (v) => ({ seq: Number(v?.seq) || 0, list: Array.isArray(v?.list) ? v.list : [], owed: v?.owed && typeof v.owed === 'object' ? v.owed : {}, held: v?.held && typeof v.held === 'object' ? v.held : {} });
const mineOf = (s, account) => s.list.filter((l) => l.seller === account);
// a new listing (`thing`: { kind 'item', itemId, qty, sizes } | { kind 'piece', piece, name, yard }) -> { state, listing } or { error }
function put(s, account, sellerName, thing, price, base, now) {
  if (mineOf(s, account).length >= MINE_MAX) return { error: 'LIMIT' };
  const [lo, hi] = range(base); if (!Number.isSafeInteger(price) || price < lo || price > hi) return { error: 'PRICE' };
  const seq = s.seq + 1; const id = `f${now.toString(36)}${seq.toString(36)}`;
  const def = thing.kind === 'item' ? Items.itemDef(thing.itemId) : null;
  const listing = { id, seller: account, sellerName: String(sellerName || '').slice(0, 24), kind: thing.kind, price, base, at: now, until: now + DAYS * DAY_MS,
    ...(thing.kind === 'item' ? { itemId: thing.itemId, qty: thing.qty, name: def.name, icon: def.icon, ...(thing.sizes ? { sizes: thing.sizes } : {}), ...(thing.bought ? { bought: true } : {}) } : { piece: thing.piece, itemId: thing.piece.id, qty: 1, name: thing.name, icon: thing.yard ? '🌳' : '🪑', ...(thing.yard ? { yard: true } : {}) }) };
  return { state: { ...s, seq, list: [...s.list, listing] }, listing };
}
const without = (s, id) => ({ ...s, list: s.list.filter((l) => l.id !== id) });
// sold: off the board, its seller owed the price less the fee (each sale kept with its time: not taken in 3 days, it goes into the
// wallet by itself -- review-plan §1-2, so money waiting is never outside the tax)
const owedOf = (s, account) => { const o = s.owed[account] || {}; return { amount: Number(o.amount) || 0, n: Number(o.n) || 0, list: Array.isArray(o.list) ? o.list : [] }; };
function sold(s, l, now = Date.now()) { const o = owedOf(s, l.seller); const net = netOf(l.price); return { ...without(s, l.id), owed: { ...s.owed, [l.seller]: { ...o, amount: o.amount + net, list: [...o.list, { id: l.id, net, at: now }] } } }; }
// what has waited 3 days -> [{ account, id, net }] (paid by the server), and the state without them
function overdue(s, now) {
  const due = []; const owed = { ...s.owed };
  for (const account of Object.keys(s.owed)) { const o = owedOf(s, account); const late = o.list.filter((x) => x.at + DAYS * DAY_MS <= now); if (!late.length) continue; for (const x of late) due.push({ account, id: x.id, net: x.net }); const list = o.list.filter((x) => !late.includes(x)); owed[account] = { ...o, amount: list.reduce((n, x) => n + x.net, 0), list }; }
  return { due, state: { ...s, owed } };
}
const expired = (s, now) => s.list.filter((l) => l.until <= now);
const hold = (s, account, l) => ({ ...s, held: { ...s.held, [account]: [...(s.held[account] || []), l] } });
const unhold = (s, account, id) => { const left = (s.held[account] || []).filter((l) => l.id !== id); const held = { ...s.held }; if (left.length) held[account] = left; else delete held[account]; return { ...s, held }; };
// paid out: nothing owed, the next claim another key
const claimed = (s, account) => { const o = owedOf(s, account); return { ...s, owed: { ...s.owed, [account]: { amount: 0, n: o.n + 1, list: [] } } }; };

const shown = (l, account) => ({ id: l.id, kind: l.kind, cat: catOf(l), itemId: l.itemId, name: l.name, icon: l.icon, qty: l.qty, ...(l.sizes ? { sizes: l.sizes } : {}), ...(l.bought ? { bought: true } : {}), price: l.price, seller: l.sellerName, mine: l.seller === account, until: l.until });
// the board as one account sees it: everything up (its own marked), what it is owed, how many of its things wait for it
function view(s, account, now) {
  return { list: s.list.filter((l) => l.until > now).map((l) => shown(l, account)).sort((a, b) => b.until - a.until), mine: mineOf(s, account).length, owed: s.owed[account]?.amount || 0, held: (s.held[account] || []).length,
    rules: { fee: FEE, days: DAYS, max: MINE_MAX, low: LOW, high: HIGH }, cats: CATS };
}

module.exports = { FEE, DAYS, MINE_MAX, LOW, HIGH, QTY_MAX, CATS, sellable, worth, range, feeOf, netOf, catOf, stateOf, mineOf, put, without, owedOf, sold, overdue, expired, hold, unhold, claimed, view };
