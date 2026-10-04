'use strict';

// v1.10.10 게임 아일랜드 이벤트 인벤토리 (비공개 IDEAS 「게임 아일랜드 — 이벤트 인벤토리」, 사용자 확정 2026-10-04): what can be
// carried in the island bag and where it is handed in. Every number the decision left open lives here, in one place:
// prices, the bag size, the stack size and the daily limit on what the island pays (see PROJECT_STATUS.md v1.10.10).
const BAG_SLOTS = 16; // IDEAS: about 12–20 slots
const STACK_MAX = 99; // one slot holds up to this many of the same thing
const DAILY_CAP = 5000; // points the island's items and events pay one account in an Asia/Seoul day

// at: who takes it -- 'office' (중앙 관공서: settle / hand in), 'merchant' (상점가 상인: sell), 'owner' (the NPC who lost it).
// unique: never stacked (each one is its own entry, e.g. a lost item that belongs to someone).
const ITEMS = {
  trash: { name: '쓰레기', icon: '🗑️', at: 'office', price: 30 },
  herb: { name: '희귀 약재', icon: '🌿', at: 'merchant', price: 120 },
  berry: { name: '나무 열매', icon: '🍒', at: 'merchant', price: 40 },
  mushroom: { name: '버섯', icon: '🍄', at: 'merchant', price: 60 },
  wallet: { name: '잃어버린 지갑', icon: '👛', at: 'office', price: 200, unique: true },
  lost: { name: '분실물', icon: '🧸', at: 'owner', price: 150, unique: true },
};
const PLACES = { office: '관공서', merchant: '상인', owner: '주인' };

const itemDef = (id) => (Object.prototype.hasOwnProperty.call(ITEMS, id) ? ITEMS[id] : null);
// What a bag looks like to its owner: each entry with its name and icon (the definitions stay on the server).
function bagView(entries) {
  return {
    slots: BAG_SLOTS,
    items: entries.map((e) => ({ entryId: e.entryId, itemId: e.itemId, qty: e.qty, name: itemDef(e.itemId)?.name || e.itemId, icon: itemDef(e.itemId)?.icon || '❔', at: itemDef(e.itemId)?.at || null, price: itemDef(e.itemId)?.price || 0, meta: e.meta || null })),
  };
}
// Adding qty of an item to a bag (a plain list of entries): the new list, or null when it does not fit. Stackable
// items fill their slot up to STACK_MAX first; a unique item always takes a slot of its own.
function addToBag(entries, itemId, qty, entryId, meta = null) {
  const def = itemDef(itemId);
  if (!def || !Number.isSafeInteger(qty) || qty < 1) return null;
  const out = entries.map((e) => ({ ...e }));
  if (def.unique) {
    if (out.length + qty > BAG_SLOTS) return null;
    for (let i = 0; i < qty; i += 1) out.push({ entryId: qty === 1 ? entryId : `${entryId}:${i}`, itemId, qty: 1, meta });
    return out;
  }
  const slot = out.find((e) => e.itemId === itemId);
  if (slot) { if (slot.qty + qty > STACK_MAX) return null; slot.qty += qty; return out; }
  if (out.length >= BAG_SLOTS || qty > STACK_MAX) return null;
  out.push({ entryId: itemId, itemId, qty, meta: null });
  return out;
}
// Selling everything a place takes, highest price first, as far as today's limit allows: { keep, sold, paid }.
// `activeLost` (v1.10.11): the lost-thing events still waiting for their owner; a lost thing whose owner has gone is
// taken by the town hall instead (lost and found).
function sellAt(entries, place, earnedToday, activeLost = null) {
  const takes = (e, def) => def && (def.at === place || (place === 'office' && def.at === 'owner' && activeLost && !activeLost.includes(e.meta?.eventId)));
  let room = Math.max(0, DAILY_CAP - earnedToday);
  const keep = []; const sold = []; let paid = 0;
  const order = entries.map((e, i) => ({ e, i, def: itemDef(e.itemId) }))
    .sort((a, b) => (b.def?.price || 0) - (a.def?.price || 0) || a.i - b.i);
  const left = new Map();
  for (const { e, def } of order) {
    if (!takes(e, def)) { left.set(e.entryId, e.qty); continue; }
    const n = Math.min(e.qty, Math.floor(room / def.price));
    if (n > 0) { sold.push({ itemId: e.itemId, qty: n, price: def.price }); paid += n * def.price; room -= n * def.price; }
    left.set(e.entryId, e.qty - n);
  }
  for (const e of entries) { const q = left.get(e.entryId); if (q > 0) keep.push({ ...e, qty: q }); }
  return { keep, sold, paid, capped: entries.some((e) => takes(e, itemDef(e.itemId)) && (left.get(e.entryId) || 0) > 0) };
}

module.exports = { BAG_SLOTS, STACK_MAX, DAILY_CAP, ITEMS, PLACES, itemDef, bagView, addToBag, sellAt };
