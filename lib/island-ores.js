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
  { id: 'granite', name: '화강암', tier: 0, merchant: true, price: 50 /* (1.10.350 사용자 182: 200 -> 50P -- a pickaxe use's worth; the 화강암 벽 never empties) */, icon: '🪨', color: '#cfc8bd' },
  { id: 'clay', name: '점토', tier: 0, merchant: true, price: 800, icon: '🟫', color: '#c06f45' },
  { id: 'sandstone', name: '사암', tier: 0, merchant: true, price: 800, icon: '🟨', color: '#d4ad72' },
  { id: 'coal', name: '석탄', tier: 1, merchant: true, price: 1200, icon: '⚫', color: '#2e2b2c' },
  { id: 'iron', name: '철광석', tier: 1, merchant: true, price: 1200, icon: '🟤', color: '#8e4a32' },
  { id: 'copper', name: '구리 광석', tier: 1, merchant: true, price: 1200, icon: '🟠', color: '#c27a3e' },
  { id: 'tin', name: '주석 광석', tier: 1, merchant: true, price: 1200, icon: '🔘', color: '#8f99a0' },
  { id: 'silver', name: '은 광석', tier: 2, merchant: true, price: 3000, icon: '⚪', color: '#b9c3cf' },
  { id: 'crystal', name: '수정', tier: 2, merchant: true, price: 3500, icon: '💎', color: '#c9b6f0' },
  { id: 'jade', name: '옥', tier: 2, merchant: true, price: 3500, icon: '🟢', color: '#4fa673' },
  { id: 'gold', name: '금 광석', tier: 3, merchant: true, price: 8000, icon: '🟡', color: '#f0c040' },
  { id: 'obsidian', name: '흑요석', tier: 3, merchant: true, price: 8000, icon: '⬛', color: '#2b2238' },
].map((o) => Object.freeze(o)));
// the gems: `pm` ‰ a piece (any rock -- `rare`: only a rock of 드묾 and above), `bonusPm` on a bonus hit; never the 잡화점's
const GEMS = Object.freeze([
  { id: 'moonstone', name: '달빛석', price: 50000, pm: 5, bonusPm: 15, rare: false, icon: '🌙', color: '#bcd7ff' },
  { id: 'ruby', name: '루비', price: 100000, pm: 7, bonusPm: 20, rare: true, icon: '🔴', color: '#d1314a' },
  { id: 'sapphire', name: '사파이어', price: 100000, pm: 7, bonusPm: 20, rare: true, icon: '🔵', color: '#2f5fd0' },
  { id: 'emerald', name: '에메랄드', price: 100000, pm: 7, bonusPm: 20, rare: true, icon: '🟩', color: '#1f9e5a' },
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
const pick = (list, t) => list[Math.min(list.length - 1, Math.floor(t * list.length))].id;
// what one piece from a rock is: `u` in [0, 1); `bonus` (the shine hit at its brightest) -- a better chance at the tier above
// (364 관리자 섬 이벤트 「채석 위 단계」: upMult -- the chance of the tier above multiplied, at most 50 %)
function drawOre(main, u, bonus = false, upMult = 1) {
  const o = oreOf(main); if (!o) return 'granite';
  if (o.tier <= 1) { const up0 = bonus ? UP_BONUS : UP; const keep = 1 - (upMult > 1 ? Math.max(up0, Math.min(0.5, up0 * upMult)) : up0); if (u < keep) return main; return pick(ORES.filter((x) => x.tier === o.tier + 1), (u - keep) / (1 - keep)); }
  if (o.tier === 2) { const keep = bonus ? 0.55 : 0.4; if (u < keep) return main; return pick(ORES.filter((x) => x.tier === 1), (u - keep) / (1 - keep)); }
  const keep = bonus ? 0.25 : 0.15; if (u < keep) return main; return pick(ORES.filter((x) => x.tier === 2), (u - keep) / (1 - keep));
}
// a gem instead of the ore? `g` in [0, 1); `pms` { <gem>: [‰, bonus ‰] } (economy -- the defaults above); `gemMult` an event's
// multiplier (each chance at most 50 %); -> the gem's id or null
function drawGem(main, g, bonus = false, gemMult = 1, pms = null) {
  const o = oreOf(main); if (!o) return null; let at = 0;
  for (const gem of GEMS) {
    if (gem.rare && o.tier < 2) continue;
    const [pm, bpm] = pms?.[gem.id] || [gem.pm, gem.bonusPm]; const p0 = (bonus ? bpm : pm) / 1000;
    const p = gemMult > 1 ? Math.max(p0, Math.min(0.5, p0 * gemMult)) : p0;
    if (g < at + p) return gem.id; at += p;
  }
  return null;
}
module.exports = { ORES, GEMS, SHOP_MUL, TIERS, UP, UP_BONUS, oreOf, gemOf, REGROW, regrowOf, LIGHT, lightOf, drawOre, drawGem };
