'use strict';
// 1.10.342 광석 8가지 (notes gather-must-ideas 82; island-expansion §9 88A·94B; 사용자 146A; assets 140 ore-palette): each ore's name,
// how rare, what the merchant pays (흔함 200P, 보통 300P; 드묾·아주 드묾 he does not buy -- their `price` the worth the 벼룩시장 counts
// from), its colour; each rock's main ore and what else it gives (흔함·보통 85 % its own, else one tier up; 은·수정 40 %; 금 15 %,
// else 은·수정), how long it takes to fill again. Pure; the server and the page.
// (362 광석 값 다시, notes gather-must-ideas 끝, 사용자 「1A 2A 3A」: what the merchant pays -- clay 600, coal·iron·copper 900, and now
// silver 1,500 · crystal 1,800 · gold 3,600 too (a mining was 200~300P against a fish's 1,400). The 잡화점 sells each at SHOP_MUL times
// that (economy `ore:shopMul`); the 벼룩시장 in between. Each its economy key `ore:<id>`)
const SHOP_MUL = 3;
const ORES = Object.freeze([
  { id: 'granite', name: '화강암', tier: 0, merchant: true, price: 50 /* (1.10.350 사용자 182: 200 -> 50P -- a pickaxe use's worth; the 화강암 벽 never empties) */, icon: '🪨', color: '#cfc8bd' },
  { id: 'clay', name: '점토', tier: 0, merchant: true, price: 600, icon: '🟫', color: '#c06f45' },
  { id: 'coal', name: '석탄', tier: 1, merchant: true, price: 900, icon: '⚫', color: '#2e2b2c' },
  { id: 'iron', name: '철광석', tier: 1, merchant: true, price: 900, icon: '🟤', color: '#8e4a32' },
  { id: 'copper', name: '구리 광석', tier: 1, merchant: true, price: 900, icon: '🟠', color: '#c27a3e' },
  { id: 'silver', name: '은 광석', tier: 2, merchant: true, price: 1500, icon: '⚪', color: '#b9c3cf' },
  { id: 'crystal', name: '수정', tier: 2, merchant: true, price: 1800, icon: '💎', color: '#c9b6f0' },
  { id: 'gold', name: '금 광석', tier: 3, merchant: true, price: 3600, icon: '🟡', color: '#f0c040' },
].map((o) => Object.freeze(o)));
const TIERS = Object.freeze(['흔함', '보통', '드묾', '아주 드묾']);
const byId = new Map(ORES.map((o) => [o.id, o]));
const oreOf = (id) => byId.get(id) || null;
// how long a rock of that main ore takes to fill again (88A: 흔함·보통 3 h, 드묾 6 h, 아주 드묾 12 h)
const REGROW = Object.freeze([3, 3, 6, 12].map((h) => h * 3600000));
const regrowOf = (main) => REGROW[oreOf(main)?.tier ?? 0];
const LIGHT = Object.freeze([1000, 1000, 800, 600]); // (98B: how long a crack shines -- 흔함·보통 1.0 s, 드묾 0.8, 아주 드묾 0.6)
const lightOf = (main) => LIGHT[oreOf(main)?.tier ?? 0];
// what one piece from a rock is: `u` in [0, 1); `bonus` (the shine hit at its brightest) -- a better chance at the tier above
function drawOre(main, u, bonus = false) {
  const o = oreOf(main); if (!o) return 'granite';
  if (o.tier <= 1) { const keep = bonus ? 0.7 : 0.85; if (u < keep) return main; const up = ORES.filter((x) => x.tier === o.tier + 1); return up[Math.floor(((u - keep) / (1 - keep)) * up.length) % up.length].id; }
  if (o.tier === 2) { const keep = bonus ? 0.55 : 0.4; if (u < keep) return main; const down = ORES.filter((x) => x.tier === 1); return down[Math.floor(((u - keep) / (1 - keep)) * down.length) % down.length].id; }
  const keep = bonus ? 0.25 : 0.15; if (u < keep) return main; return u < keep + (1 - keep) / 2 ? 'silver' : 'crystal';
}
module.exports = { ORES, SHOP_MUL, TIERS, oreOf, REGROW, regrowOf, LIGHT, lightOf, drawOre };
