'use strict';
// 364 관리자 「섬 이벤트」 (notes docs/admin-island-events-20261118.md, 사용자 「1B 2B 3A」): surprise events an admin opens -- a notice
// only, a sell-price multiplier, or a catch chance/amount multiplier -- for 30 min to 6 h, now or at a set time; several at once,
// but one kind on one target at a time. The server applies them (sales, draws); the screens only show them.
// 사서 팔기 구멍 (사용자 11-18): what was bought at the 잡화점 (`bought`) never gets an event's price; an item's multiplier is the
// largest of the events that match it, never their product, and at most ×3. A chance multiplied stays at 50 % at most.
const crypto = require('node:crypto');

const KINDS = Object.freeze(['notice', 'sell', 'catch']);
const SELL = Object.freeze({ weed: '잡초', fish: '물고기', insect: '곤충', ore: '광석', gathered: '채집물', item: '물건 하나' });
const CATCH = Object.freeze({ fish_rare: '낚시 드문·대어', insect_rare: '드문 곤충', quarry_up: '채석 위 단계', pick: '나뭇가지·버섯', star: '별똥별 반짝이' });
const MULTS = Object.freeze([1.5, 2, 3]); const MAX_MULT = 3; const CHANCE_CAP = 0.5;
const MIN_MS = 5 * 60 * 1000; const MAX_MS = 6 * 3600 * 1000; const AHEAD_MS = 7 * 24 * 3600 * 1000; const TEXT_MAX = 80; const KEEP_MS = 7 * 24 * 3600 * 1000;

const multWord = (m) => (m === 1.5 ? '1.5배' : `${m}배`);
// (itemName: the bag's name of an id, for 「물건 하나」)
function labelOf(e, itemName = (id) => id) {
  if (e.kind === 'notice') return e.text;
  if (e.kind === 'sell') return `${e.target === 'item' ? itemName(e.item) : SELL[e.target]}${e.target === 'ore' && e.gems ? '·보석' : ''} 값 ${multWord(e.mult)}`;
  return `${CATCH[e.target]} ${multWord(e.mult)}`;
}

// a new event from the admin's form, or { error }: `items` the bag's item table (for 「물건 하나」), `now` ms
function validate(raw, now, items = {}) {
  const kind = KINDS.includes(raw?.kind) ? raw.kind : null; if (!kind) return { error: 'KIND' };
  const text = String(raw.text || '').trim().slice(0, TEXT_MAX + 1); if (text.length > TEXT_MAX) return { error: 'TEXT' };
  if (kind === 'notice' && !text) return { error: 'TEXT' };
  const minutes = Number(raw.minutes); const ms = Math.round(minutes * 60000); if (!Number.isFinite(minutes) || ms < MIN_MS || ms > MAX_MS) return { error: 'TIME' };
  const startAt = raw.startAt == null || raw.startAt === '' ? now : Number(raw.startAt); if (!Number.isFinite(startAt) || startAt < now - 60000 || startAt > now + AHEAD_MS) return { error: 'START' };
  const e = { id: crypto.randomBytes(6).toString('hex'), kind, text, startAt: Math.max(now, Math.round(startAt)), endAt: 0, createdAt: now };
  e.endAt = e.startAt + ms;
  if (kind !== 'notice') {
    const mult = Number(raw.mult); if (!MULTS.includes(mult)) return { error: 'MULT' }; e.mult = mult;
    const target = String(raw.target || ''); if (!(kind === 'sell' ? SELL : CATCH)[target]) return { error: 'TARGET' }; e.target = target;
    if (kind === 'sell' && target === 'item') { const def = items[raw.item]; if (!def || !(def.price > 0)) return { error: 'ITEM' }; e.item = String(raw.item); }
    if (kind === 'sell' && target === 'ore') e.gems = raw.gems === true;
  }
  return { event: e };
}
const sameTarget = (a, b) => a.kind === b.kind && a.target === b.target && (a.target !== 'item' || a.item === b.item);
const live = (e) => !e.closedAt;
// another of the same kind on the same target whose time meets this one's: refused
const overlaps = (events, ev) => ev.kind !== 'notice' && events.some((e) => live(e) && e.id !== ev.id && sameTarget(e, ev) && e.startAt < ev.endAt && ev.startAt < e.endAt);
const activeAt = (events, now) => (events || []).filter((e) => live(e) && e.startAt <= now && now < e.endAt);

// does a sell event take this item? (`groupOf(itemId)`: 'gathered' for what is picked up on the island)
function sells(e, itemId, groupOf = () => null) {
  if (e.kind !== 'sell') return false;
  switch (e.target) {
    case 'weed': return itemId === 'weed';
    case 'fish': return itemId.startsWith('fish_');
    case 'insect': return itemId.startsWith('insect_');
    case 'ore': return itemId.startsWith('ore_') || (e.gems === true && itemId.startsWith('gem_'));
    case 'gathered': return groupOf(itemId) === 'gathered';
    case 'item': return e.item === itemId;
    default: return false;
  }
}
// the event an item sells by now (the largest multiplier of those that match), or null
function sellSource(events, itemId, now, groupOf) {
  let best = null; for (const e of activeAt(events, now)) if (sells(e, itemId, groupOf) && (!best || e.mult > best.mult)) best = e; return best;
}
const sellMult = (events, itemId, now, groupOf) => Math.min(MAX_MULT, sellSource(events, itemId, now, groupOf)?.mult || 1);
// { itemId: multiplier } for the ids given that have one now (what the sale is priced by)
function sellTable(events, itemIds, now, groupOf) { const out = {}; for (const id of itemIds) { const m = sellMult(events, id, now, groupOf); if (m > 1) out[id] = m; } return out; }
const catchMult = (events, target, now) => Math.min(MAX_MULT, Math.max(1, ...activeAt(events, now).filter((e) => e.kind === 'catch' && e.target === target).map((e) => e.mult)));
// a chance under an event: multiplied, never past 50 % (one already past stays as it is)
const chance = (p, m) => (m > 1 ? Math.max(p, Math.min(CHANCE_CAP, p * m)) : p);

// what the screens are told: the running ones (and those to come within the hour), each with its words and its end
function view(events, now, itemName) {
  return (events || []).filter((e) => live(e) && e.endAt > now && e.startAt <= now + 3600000).sort((a, b) => a.startAt - b.startAt)
    .map((e) => ({ id: e.id, kind: e.kind, target: e.target || null, item: e.item || null, mult: e.mult || null, label: labelOf(e, itemName), text: e.text || '', startAt: e.startAt, endAt: e.endAt, running: e.startAt <= now }));
}
// the stored list: ended (or closed) more than a week ago dropped
const prune = (events, now) => (events || []).filter((e) => (e.closedAt || e.endAt) > now - KEEP_MS);

module.exports = { KINDS, SELL, CATCH, MULTS, MAX_MULT, CHANCE_CAP, MAX_MS, TEXT_MAX, labelOf, validate, overlaps, activeAt, sells, sellSource, sellMult, sellTable, catchMult, chance, view, prune };
