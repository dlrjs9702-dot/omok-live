'use strict';

// A4 밤하늘 별똥별 (IDEAS 「함께하는 섬」): on Seoul nights (20:00~04:00) a shooting star now and then, at times the server
// clock decides -- the same moment for everyone. While one falls (WISH_MS) a wish can be made; the small gift for it
// comes the next day (until the 우체통 exists: paid on the first look at the island the next Seoul day).
const SLOT_MS = 30 * 60 * 1000; // at most one star a half hour
const WISH_MS = 20 * 1000;      // how long a star can be wished on (it is seen falling about 4 s; the button stays -- a slow phone still gets its wish in)
const GIFT = 300;               // P for a wish, paid the next day
const KST = 9 * 3600 * 1000;

function roll(n, salt) {
  let h = (2166136261 ^ n ^ Math.imul(salt, 16777619)) >>> 0;
  for (let i = 0; i < 3; i += 1) { h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); h ^= h >>> 16; }
  return (h >>> 0) / 4294967296;
}
const nightSlot = (slot) => { const h = new Date(slot * SLOT_MS + KST).getUTCHours(); return h >= 20 || h < 4; };
// the star of one half-hour slot, or null: { id, at }
function starOf(slot) {
  if (!nightSlot(slot) || roll(slot, 1) >= 0.45) return null;
  return { id: `star_${slot}`, at: slot * SLOT_MS + Math.floor(roll(slot, 2) * (SLOT_MS - WISH_MS)) };
}
// the star falling now (one can wish on it) and the next one to come
function around(ms) {
  const slot = Math.floor(ms / SLOT_MS); let now = null; let next = null;
  for (const s of [slot - 1, slot]) { const st = starOf(s); if (st && ms >= st.at && ms < st.at + WISH_MS) now = st; }
  for (let s = slot; s < slot + 48 && !next; s += 1) { const st = starOf(s); if (st && st.at > ms) next = st; }
  return { now, next };
}
// the stars of the Seoul day before `ms` (their wishes are paid on `ms`'s day)
function starsOfDayBefore(ms) {
  const dayStart = Math.floor((ms + KST) / 86400000) * 86400000 - KST; const from = dayStart - 86400000;
  const out = []; for (let s = Math.floor(from / SLOT_MS); s < Math.floor(dayStart / SLOT_MS); s += 1) { const st = starOf(s); if (st) out.push(st); }
  return out;
}
const slotOfId = (id) => (/^star_\d+$/.test(String(id)) ? Number(String(id).slice(5)) : null);

module.exports = { SLOT_MS, WISH_MS, GIFT, starOf, around, starsOfDayBefore, slotOfId };

if (require.main === module) { // stars only at night, a wish window only while one falls, yesterday's list holds them
  const assert = require('node:assert/strict');
  let n = 0; for (let s = 0; s < 4800; s += 1) { const st = starOf(s); if (st) { n += 1; const h = new Date(st.at + KST).getUTCHours(); assert.ok(h >= 20 || h < 4, String(h)); } }
  assert.ok(n > 600 && n < 1300, String(n));
  const st = starOf([...Array(200).keys()].find((s) => starOf(s + 1000)) + 1000);
  assert.equal(around(st.at + 1000).now.id, st.id); assert.equal(around(st.at + WISH_MS + 1).now?.id === st.id, false);
  assert.ok(starsOfDayBefore(st.at + 86400000).some((x) => x.id === st.id));
  console.log('island-stars ok', n);
}
