'use strict';
// 1.10.342 광석 8가지 (notes gather-must-ideas 82; island-expansion §9 88A·94B; 사용자 146A; assets 140 ore-palette): each ore's name,
// how rare, what the merchant pays, its colour; each rock's main ore and what else it gives, how long it takes to fill again.
// Pure; the server and the page.
// (362 광석 값 다시: what the merchant pays, each its economy key `ore:<id>`; the 잡화점 sells at SHOP_MUL times that)
// 366 광석 개편 2 (notes gather-must-ideas-20261114 끝, 사용자 「A」; assets 155 ore-v2): four new ores (사암 · 주석 · 옥 · 흑요석),
// the merchant's new prices (clay·sandstone 800, coal·iron·copper·tin 1,200, silver 3,000, crystal·jade 3,500, gold·obsidian 8,000),
// the tier above 20 % (35 % on a bonus hit), and four gems -- 달빛석 from any rock, 루비·사파이어·에메랄드 from the rare rocks -- that
// the merchant buys and the 잡화점 never sells; their chances in ‰, economy `gem:*`
const SHOP_MUL = 3;
const ORES = Object.freeze([
  { id: 'granite', name: '화강암', tier: 0, merchant: true, price: 20 /* (1.10.350 사용자 182: 200 -> 50P -- a pickaxe use's worth; the 화강암 벽 never empties) */, icon: '🪨', color: '#cfc8bd' },
  { id: 'clay', name: '점토', tier: 0, merchant: true, price: 370, icon: '🟫', color: '#c06f45' },
  { id: 'sandstone', name: '사암', tier: 0, merchant: true, price: 370, icon: '🟨', color: '#d4ad72' },
  { id: 'coal', name: '석탄', tier: 1, merchant: true, price: 550, icon: '⚫', color: '#2e2b2c' },
  { id: 'iron', name: '철광석', tier: 1, merchant: true, price: 550, icon: '🟤', color: '#8e4a32' },
  { id: 'copper', name: '구리 광석', tier: 1, merchant: true, price: 550, icon: '🟠', color: '#c27a3e' },
  { id: 'tin', name: '주석 광석', tier: 1, merchant: true, price: 550, icon: '🔘', color: '#8f99a0' },
  { id: 'silver', name: '은 광석', tier: 2, merchant: true, price: 1380, icon: '⚪', color: '#b9c3cf' },
  { id: 'crystal', name: '수정', tier: 2, merchant: true, price: 1610, icon: '💎', color: '#c9b6f0' },
  { id: 'jade', name: '옥', tier: 2, merchant: true, price: 1610, icon: '🟢', color: '#4fa673' },
  { id: 'gold', name: '금 광석', tier: 3, merchant: true, price: 3680, icon: '🟡', color: '#f0c040' },
  { id: 'obsidian', name: '흑요석', tier: 3, merchant: true, price: 3680, icon: '⬛', color: '#2b2238' },
].map((o) => Object.freeze(o)));
// the gems: `pm` ‰ a piece (any rock -- `rare`: only a rock of 드묾 and above), `bonusPm` on a bonus hit; never the 잡화점's
const GEMS = Object.freeze([
  { id: 'moonstone', name: '달빛석', price: 23000, pm: 5, bonusPm: 15, rare: false, icon: '🌙', color: '#bcd7ff' },
  /* (379 사용자 「바위마다 나오는 것 고르게」: every rock the same chance -- the three counted in ‱ now (`per`), 7 ‰ on the six rare rocks
     spread over all forty as the island had them: 5 ‱, 14 ‱ on a bonus hit) */
  { id: 'ruby', name: '루비', price: 46000, pm: 5, bonusPm: 14, per: 10000, rare: false, icon: '🔴', color: '#d1314a' },
  { id: 'sapphire', name: '사파이어', price: 46000, pm: 5, bonusPm: 14, per: 10000, rare: false, icon: '🔵', color: '#2f5fd0' },
  { id: 'emerald', name: '에메랄드', price: 46000, pm: 5, bonusPm: 14, per: 10000, rare: false, icon: '🟩', color: '#1f9e5a' },
].map((g) => Object.freeze(g)));
const UP = 0.2; const UP_BONUS = 0.35; // (the tier above: 15 % -> 20 %, 30 % -> 35 %)
const TIERS = Object.freeze(['흔함', '보통', '드묾', '아주 드묾']);
const byId = new Map(ORES.map((o) => [o.id, o]));
const oreOf = (id) => byId.get(id) || null;
const gemOf = (id) => GEMS.find((g) => g.id === id) || null;
// how long a rock of that main ore takes to fill again (88A: 흔함·보통 3 h, 드묾 6 h, 아주 드묾 12 h)
const REGROW = Object.freeze([3, 3, 6, 12].map((h) => h * 3600000));
const regrowOf = (main) => REGROW[oreOf(main)?.tier ?? 0];
const LIGHT = Object.freeze([1000, 1000, 800, 600]); // (98B: how long a crack shines -- 흔함·보통 1.0 s, 드묾 0.8, 아주 드묾 0.6)
const lightOf = (main) => LIGHT[oreOf(main)?.tier ?? 0];
// 379 바위마다 고르게 (사용자 「광석 캐기 제한을 없애고, 바위마다 나오는 것 고르게 분포해. 기대값이 비슷하게」): every rock a piece's worth the
// same (at the merchant's prices) -- the island's average as it was, each rock by how often it fills (EV 1,184 P; 1,403 on a bonus hit;
// the 「채석 위 단계」 event's rise as before: SLOPE a unit of the old tier-above chance q, q = min(50 %, q0 x upMult)). Each rock's own ore its
// share by its tier (OWN: 흔함 34 %, 보통 30 %, 드묾 12 %, 아주 드묾 7 %) -- on a 흔함·보통 rock the most of all, and every ore the most on its own
// rock; the rest of the twelve by price^beta (beta solved to the worth), each held under its own rock's share (and the rock's own ore)
// (379 결정 8 A 「한 시간 벌이를 낚시와 비슷하게」: the merchant's ore and gem prices x0.46 -- a mining about 600 P with a fifth missed for a 작은 돌
// (100 P), about 450 an hour; the worths below the same x0.46 (1,184 · 1,403 · 1,296.8 at the old prices) -- every table's shape as it was)
const PRICE_K = 0.46;
const OWN = Object.freeze([0.34, 0.3, 0.12, 0.07]); const EV_BASE = 1184 * PRICE_K; const EV_BONUS = 1403 * PRICE_K; const SLOPE = 1296.8 * PRICE_K;
const targetOf = (bonus, upMult) => { const q0 = bonus ? UP_BONUS : UP; const q = upMult > 1 ? Math.max(q0, Math.min(0.5, q0 * upMult)) : q0; return (bonus ? EV_BONUS : EV_BASE) + (q - q0) * SLOPE; };
function tableFor(main, target) {
  const pMain = OWN[oreOf(main).tier]; const cheapRock = oreOf(main).tier <= 1; const capOf = (o) => Math.min(OWN[o.tier] - 0.005, cheapRock ? pMain - 0.005 : 1);
  const t = { [main]: pMain }; let free = ORES.filter((o) => o.id !== main); let left = 1 - pMain; let fixedEv = pMain * oreOf(main).price;
  for (let round = 0; round < 12 && free.length; round += 1) {
    const evAt = (b) => { const w = free.map((o) => o.price ** b); const s = w.reduce((a, c) => a + c, 0); return fixedEv + left * free.reduce((a, o, i) => a + (w[i] / s) * o.price, 0); };
    let lo = -10; let hi = 10; for (let k = 0; k < 90; k += 1) { const m = (lo + hi) / 2; if (evAt(m) < target) lo = m; else hi = m; }
    const b = (lo + hi) / 2; const w = free.map((o) => o.price ** b); const s = w.reduce((a, c) => a + c, 0); const over = free.filter((o, i) => left * (w[i] / s) > capOf(o));
    if (!over.length) { free.forEach((o, i) => { t[o.id] = left * (w[i] / s); }); break; }
    for (const o of over) { t[o.id] = capOf(o); left -= capOf(o); fixedEv += capOf(o) * o.price; } free = free.filter((o) => !over.includes(o));
  }
  return Object.freeze([main, ...ORES.map((o) => o.id).filter((id) => id !== main)].map((id) => Object.freeze([id, t[id] || 0])));
}
const tables = new Map();
const oreTable = (main, bonus = false, upMult = 1) => { const key = `${main}|${bonus ? 1 : 0}|${Math.round(upMult * 100)}`; if (!tables.has(key)) tables.set(key, tableFor(main, targetOf(bonus, upMult))); return tables.get(key); };
// what one piece from a rock is: `u` in [0, 1); `bonus` (the shine hit at its brightest); upMult (364 관리자 섬 이벤트 「채석 위 단계」)
function drawOre(main, u, bonus = false, upMult = 1) {
  if (!oreOf(main)) return 'granite'; let at = 0; const t = oreTable(main, bonus, upMult);
  for (const [id, p] of t) { at += p; if (u < at) return id; } return t[t.length - 1][0];
}
const oreWorth = (main, bonus = false, upMult = 1) => oreTable(main, bonus, upMult).reduce((s, [id, p]) => s + p * oreOf(id).price, 0);
// a gem instead of the ore? `g` in [0, 1); `pms` { <gem>: [‰, bonus ‰] } (economy -- the defaults above); `gemMult` an event's
// multiplier (each chance at most 50 %); -> the gem's id or null
function drawGem(main, g, bonus = false, gemMult = 1, pms = null) {
  const o = oreOf(main); if (!o) return null; let at = 0;
  for (const gem of GEMS) {
    if (gem.rare && o.tier < 2) continue;
    const [pm, bpm] = pms?.[gem.id] || [gem.pm, gem.bonusPm]; const p0 = (bonus ? bpm : pm) / (gem.per || 1000); /* (379: the three in ‱) */
    const p = gemMult > 1 ? Math.max(p0, Math.min(0.5, p0 * gemMult)) : p0;
    if (g < at + p) return gem.id; at += p;
  }
  return null;
}
module.exports = { ORES, GEMS, SHOP_MUL, TIERS, UP, UP_BONUS, PRICE_K, OWN, EV_BASE, EV_BONUS, SLOPE, targetOf, oreTable, oreWorth, oreOf, gemOf, REGROW, regrowOf, LIGHT, lightOf, drawOre, drawGem };
