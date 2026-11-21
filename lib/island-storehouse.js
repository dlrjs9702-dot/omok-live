'use strict';
// 1.10.386 마당 창고 (사용자 「마당 한켠에 창고를 지을 수 있게, 위치 고를 수 있게 해. 이것도 돈에 따라 확장할 수 있고, 농사 지은 물건 등등 물건
// 보관용」, 결정 19~21·24·32): an account's storehouse -- built at the 관공서 (20 slots), grown to 40, 60, 100; anything of the bag but the
// tools, bikes, pets and errand things (and a lost thing to hand back), up to 99 of a thing a slot, a fish one a slot with its size (as the
// bag); mine only. Its things are a list as the bag's ({ entryId, itemId, qty, meta }) in the account's 'storehouse' document, changed with
// the bag in one step (pointStore.questApply `bag`). Pure: the server checks where one stands and keeps it.
const Items = require('./island-items');

const STACK = 99;
// what may go in
function canKeep(itemId) {
  const def = Items.itemDef(itemId);
  return Boolean(def) && !Items.TOOL_KIND[itemId] && !def.unique && !['bike', 'pet', 'errand'].includes(def.use);
}
const keepMeta = (e) => { const m = {}; if (e?.meta?.bought) m.bought = true; return Object.keys(m).length ? m : null; };
const sameKind = (a, b) => a.itemId === b.itemId && Boolean(a.meta?.bought) === Boolean(b.meta?.bought);
/* (1.10.395 Codex 381~390 #12: ids never used twice -- the store's count `seq` kept with it, so a thing put in after the only one was taken out is
   not that one's id on a screen still showing it) */
const seqOf = (items, seq) => Math.max(Number(seq) || 0, ...(items || []).map((e) => Number(String(e.entryId).slice(1)) || 0));

// qty of the bag's entry into the store -> { items, bag, seq } | { error } (NOT_KEPT, MISSING, FULL) -- all of it or nothing
function put(items, bag, entryId, qty, slots, seq = 0) {
  let s = seqOf(items, seq); const nextId = () => `s${++s}`;
  const e = (bag || []).find((x) => x.entryId === entryId); const n = Number(qty);
  if (!e) return { error: 'MISSING' };
  if (!Number.isSafeInteger(n) || n < 1 || n > e.qty) return { error: 'MISSING' };
  if (!canKeep(e.itemId)) return { error: 'NOT_KEPT' };
  const taken = Items.takeEntry(bag, entryId, n); if (!taken) return { error: 'MISSING' };
  const out = (items || []).map((x) => ({ ...x })); const meta = keepMeta(e);
  if (taken.sizes) { // (a fish: one a slot with its size -- the bag's rule)
    if (out.length + taken.sizes.length > slots) return { error: 'FULL' };
    for (const cm of taken.sizes) out.push({ entryId: nextId(), itemId: e.itemId, qty: 1, meta: { sizes: [cm], ...(meta || {}) } });
    return { items: out, bag: taken.keep, seq: s };
  }
  let left = n; const like = { itemId: e.itemId, meta };
  for (const s of out) { if (!left) break; if (!sameKind(s, like) || s.qty >= STACK) continue; const add = Math.min(left, STACK - s.qty); s.qty += add; left -= add; }
  if (Math.ceil(left / STACK) > slots - out.length) return { error: 'FULL' };
  while (left) { const add = Math.min(left, STACK); out.push({ entryId: nextId(), itemId: e.itemId, qty: add, ...(meta ? { meta: { ...meta } } : {}) }); left -= add; }
  return { items: out, bag: taken.keep, seq: s };
}

// qty of a store entry back into the bag (its boxes as the bag fills them) -> { items, bag } | { error } (MISSING, BAG_FULL)
// (395 Codex #12: `itemId`, what the screen showed there -- another thing at that id now is not taken)
function take(items, bag, entryId, qty, cap, itemId = null) {
  const i = (items || []).findIndex((x) => x.entryId === entryId); const e = items?.[i]; const n = Number(qty);
  if (!e || (itemId && e.itemId !== itemId) || !Number.isSafeInteger(n) || n < 1 || n > e.qty) return { error: 'MISSING' };
  const sizes = Items.sizesOf(e); const meta = { ...(sizes ? { sizes: sizes.slice(0, n) } : {}), ...(e.meta?.bought ? { bought: true } : {}) };
  const next = Items.addToBag(bag || [], e.itemId, n, `${e.itemId}`, Object.keys(meta).length ? meta : null, cap);
  if (!next) return { error: 'BAG_FULL' };
  const out = items.map((x) => ({ ...x }));
  if (e.qty > n) out[i] = { ...e, qty: e.qty - n, ...(sizes ? { meta: { ...(e.meta || {}), sizes: sizes.slice(n) } } : {}) }; else out.splice(i, 1);
  return { items: out, bag: next };
}

// what the owner sees: each entry with its name and icon, how many slots used
function view(items, slots, now = Date.now()) {
  return { slots, used: (items || []).length, items: (items || []).map((e) => ({ entryId: e.entryId, itemId: e.itemId, qty: e.qty, name: Items.itemDef(e.itemId)?.name || e.itemId, icon: Items.itemDef(e.itemId)?.icon || '❔', price: Items.priceOf(e.itemId, now), ...(Items.sizesOf(e) ? { sizes: Items.sizesOf(e) } : {}), ...(e.meta?.bought ? { bought: true } : {}) })) };
}

module.exports = { STACK, canKeep, put, take, view };
