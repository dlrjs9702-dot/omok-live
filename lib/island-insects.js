'use strict';

// B 47 곤충 채집 (IDEAS #future-together-island) → 묶음 5 보이는 곤충 (gamecenter-notes docs/insects-visible-20261020.md):
// the insects are out on the island where they live -- butterflies over the flowers, dragonflies over the grass, cicadas
// and beetles on the tree trunks, a grasshopper in the grass, a ladybird or a snail on a flower -- the server alone
// deciding which and where (each spot's season zone, day or night, rain), the same for everyone, laid out again every
// 10 minutes; one walked up to (not run at) is caught with a 잠자리채 into the bag and the 도감, and is gone for everyone.
// A game table, not a claim about nature. Prices sit under the fish; the museum takes them as gifts.
const SPECIES = Object.freeze({
  butterfly_cabbage: { name: '배추흰나비', icon: '🦋', grade: 'common', weight: 20, price: 250, seasons: ['spring', 'summer'], when: 'day' },
  butterfly_blue: { name: '파랑나비', icon: '🦋', grade: 'normal', weight: 14, price: 700, seasons: ['spring', 'summer'], when: 'day' },
  butterfly_swallowtail: { name: '호랑나비', icon: '🦋', grade: 'normal', weight: 14, price: 900, seasons: ['spring', 'summer'], when: 'day' },
  dragonfly_red: { name: '고추잠자리', icon: '🪰', grade: 'common', weight: 20, price: 350, seasons: ['summer', 'autumn'], when: 'day' },
  dragonfly_emperor: { name: '왕잠자리', icon: '🪰', grade: 'rare', weight: 5.5, price: 2500, seasons: ['summer'], when: 'day' },
  cicada: { name: '매미', icon: '🪲', grade: 'common', weight: 20, price: 350, seasons: ['summer'], when: 'day' },
  rhinoceros_beetle: { name: '장수풍뎅이', icon: '🪲', grade: 'rare', weight: 5.5, price: 3500, seasons: ['summer'], when: 'night' },
  stag_beetle: { name: '사슴벌레', icon: '🪲', grade: 'rare', weight: 5.5, price: 4000, seasons: ['summer', 'autumn'], when: 'night' },
  ladybird: { name: '무당벌레', icon: '🐞', grade: 'common', weight: 20, price: 250, seasons: ['spring', 'summer', 'autumn'], when: 'day' },
  firefly: { name: '반딧불이', icon: '✨', grade: 'normal', weight: 14, price: 1200, seasons: ['summer'], when: 'night' },
  grasshopper: { name: '메뚜기', icon: '🦗', grade: 'common', weight: 20, price: 300, seasons: ['summer', 'autumn'], when: 'any' },
  snail: { name: '달팽이', icon: '🐌', grade: 'normal', weight: 14, price: 600, seasons: ['spring', 'summer', 'autumn'], when: 'rain' },
  // v1.10.261 새 곤충 12종 (docs/insect-catch-improve-20261107.md 4절, assets 105): winter too now; the longhorn the rarest
  butterfly_yellow: { name: '노랑나비', icon: '🦋', grade: 'common', weight: 20, price: 250, seasons: ['spring'], when: 'day' },
  honeybee: { name: '꿀벌', icon: '🐝', grade: 'common', weight: 20, price: 300, seasons: ['spring', 'summer'], when: 'day' },
  hawkmoth_hummingbird: { name: '꼬리박각시', icon: '🦋', grade: 'rare', weight: 5.5, price: 2800, seasons: ['summer', 'autumn'], when: 'day' },
  jewel_beetle: { name: '비단벌레', icon: '🪲', grade: 'rare', weight: 5.5, price: 3000, seasons: ['summer'], when: 'day' },
  longhorn_giant: { name: '장수하늘소', icon: '🪲', grade: 'rare', weight: 2, price: 8000, seasons: ['summer'], when: 'day' },
  water_strider: { name: '소금쟁이', icon: '🦟', grade: 'common', weight: 20, price: 300, seasons: ['spring', 'summer', 'autumn'], when: 'day' },
  mantis: { name: '사마귀', icon: '🦗', grade: 'normal', weight: 14, price: 800, seasons: ['autumn'], when: 'day' },
  cricket: { name: '귀뚜라미', icon: '🦗', grade: 'normal', weight: 14, price: 700, seasons: ['autumn'], when: 'night' },
  moth_silk: { name: '산누에나방', icon: '🦋', grade: 'normal', weight: 14, price: 1000, seasons: ['summer'], when: 'night' },
  winter_moth: { name: '겨울자나방', icon: '🦋', grade: 'normal', weight: 14, price: 900, seasons: ['winter'], when: 'night' },
  snow_springtail: { name: '톡토기', icon: '🪲', grade: 'common', weight: 20, price: 300, seasons: ['winter'], when: 'day' },
  snow_scorpionfly: { name: '눈밑들이', icon: '🦟', grade: 'rare', weight: 5.5, price: 2500, seasons: ['winter'], when: 'day' },
});
// where each lives (the spots island-terrain's nature gives: a tree's trunk, a flower bed, the grass by a bush)
const HABITAT = Object.freeze({ butterfly_cabbage: ['flower'], butterfly_blue: ['flower'], butterfly_swallowtail: ['flower'], dragonfly_red: ['grass'], dragonfly_emperor: ['grass'],
  cicada: ['tree'], rhinoceros_beetle: ['tree'], stag_beetle: ['tree'], ladybird: ['flower', 'grass'], firefly: ['grass', 'flower'], grasshopper: ['grass'], snail: ['flower', 'grass'],
  // (v1.10.261) two more kinds of spot: the fresh water's bank (shore) and a lamp
  butterfly_yellow: ['flower'], honeybee: ['flower'], hawkmoth_hummingbird: ['flower'], jewel_beetle: ['tree'], longhorn_giant: ['tree'], water_strider: ['shore'], mantis: ['grass'], cricket: ['grass'],
  moth_silk: ['lamp'], winter_moth: ['tree', 'lamp'], snow_springtail: ['grass'], snow_scorpionfly: ['grass', 'tree'] });
const TYPES = Object.freeze(['tree', 'flower', 'grass', 'shore', 'lamp']);
const EPOCH_MS = 10 * 60 * 1000; // a new layout (the caught and the scared ones back, elsewhere)
const COUNT = 45;                // spots tried a layout (those with nothing for the season or the hour stay empty)
const QUOTA = Object.freeze({ tree: 13, flower: 13, grass: 13, shore: 3, lamp: 3 }); // (#411 검토) COUNT by kind: the banks and the lamps a few
const CATCH_R = 3;               // one stands this near to catch it (the server's check; the page asks at 2)
const SCARE_R = 7;               // a runner or a rider this near sends it off
const RUN_SPEED = 5.2;           // (Codex 검토 #8) m/s: faster than a walk (4.2) is a run (6.2) -- the server's own word at a catch

// which insects may come: the spot's season, night or day, rain (the snail only then)
const listFor = ({ season = 'summer', night = false, rain = false } = {}) => Object.keys(SPECIES).filter((id) => { const s = SPECIES[id]; return s.seasons.includes(season) && (s.when === 'any' || (s.when === 'rain' ? rain : s.when === (night ? 'night' : 'day'))); });
const pickWeighted = (list, r) => { const total = list.reduce((n, id) => n + SPECIES[id].weight, 0); let x = r * total; for (const id of list) { x -= SPECIES[id].weight; if (x < 0) return id; } return list[list.length - 1]; };
// the spots, once from the island's nature: { type, x, z, y? } -- tree trunks (not the harvest trees), flower beds, grass by
// the bushes; off the walks and the plaza (terrain: island-terrain's api)
function spotsOf(T) {
  const n = T.nature(); const harvest = new Set((T.harvestTrees?.() || []).map((h) => `${h.x},${h.z}`));
  const clear = (x, z) => T.walkable(x, z) && T.walkDist(x, z) > 1.5 && Math.hypot(x, z) > (T.PLAZA_R || 0) + 2;
  const out = [];
  for (const t of n.trees) if (!harvest.has(`${t.x},${t.z}`) && !['stump', 'sapling'].includes(T.treeKind(t)) && clear(t.x, t.z)) out.push({ type: 'tree', x: t.x, z: t.z, r: 0.75 * t.s * 0.45 });
  n.flowers.forEach((f, k) => { if (k % 3 === 0 && clear(f.x, f.z)) out.push({ type: 'flower', x: f.x, z: f.z }); });
  n.bushes.forEach((b, k) => { if (k % 3 === 0) { const x = b.x + 1.4; const z = b.z; if (clear(x, z)) out.push({ type: 'grass', x, z }); } });
  // (v1.10.261) a lamp: its top (the insect circles 0.3 m under it); a bank: land by fresh water (the river, the lakes, the
  // pools -- not the sea) within 1.5 m, every 6 m along it at most -- wx, wz toward the water (the strider stands out on it)
  (n.lampSpots || []).forEach((l, k) => { if (k % 2 === 0) out.push({ type: 'lamp', x: l.x, z: l.z }); });
  if (T.canFish && T.fishWater) {
    const FRESH = new Set(['river', 'lake', 'pool']); const banks = [];
    for (let x = -220; x <= 220; x += 2) for (let z = -220; z <= 220; z += 2) {
      if (!T.walkable(x, z) || !T.canFish(x, z) || !FRESH.has(T.fishWater(x, z))) continue; let w = null; // (a fishing spot by fresh water: its water the way the land ends)
      for (let a = 0; a < 8 && !w; a += 1) { const dx = Math.cos((a * Math.PI) / 4) * 1.5; const dz = Math.sin((a * Math.PI) / 4) * 1.5; if (!T.walkable(x + dx, z + dz)) w = { wx: Math.round(Math.cos((a * Math.PI) / 4) * 100) / 100, wz: Math.round(Math.sin((a * Math.PI) / 4) * 100) / 100 }; }
      if (w && banks.every((b) => Math.hypot(b.x - x, b.z - z) >= 6)) banks.push({ type: 'shore', x, z, ...w });
    }
    out.push(...banks);
  }
  return out;
}
// one layout: the epoch's insects (id, species, spot type, place) -- where.at(x, z) gives { season, night, rain } there
function layout(epoch, spots, where) {
  let seed = (epoch * 2654435761) >>> 0; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const out = []; let k = 0;
  for (const t of TYPES) { /* (#411 검토) each kind its own share: an empty one (no lamp by day, no bank by night) stays empty */
    const pool = spots.filter((s) => s.type === t);
    for (let j = 0; j < QUOTA[t] && pool.length; j += 1, k += 1) {
    const s = pool.splice(Math.floor(rnd() * pool.length), 1)[0]; const r = rnd(); const list = listFor(where.at(s.x, s.z)).filter((id) => HABITAT[id].includes(s.type)); if (!list.length) continue;
    out.push({ id: `e${epoch}-${k}`, species: pickWeighted(list, r), type: s.type, x: Math.round(s.x * 100) / 100, z: Math.round(s.z * 100) / 100, ...(s.r ? { r: Math.round(s.r * 100) / 100 } : {}), ...(s.wx !== undefined ? { wx: s.wx, wz: s.wz } : {}) });
    }
  }
  return out;
}

module.exports = { TYPES, QUOTA, SPECIES, HABITAT, EPOCH_MS, COUNT, CATCH_R, SCARE_R, RUN_SPEED, listFor, spotsOf, layout };

if (require.main === module) {
  const assert = require('node:assert/strict');
  assert.deepEqual(listFor({ season: 'winter' }).sort(), ['snow_scorpionfly', 'snow_springtail']); assert.deepEqual(listFor({ season: 'winter', night: true }), ['winter_moth']); // (v1.10.261: winter too)
  assert.ok(listFor({ season: 'summer', night: true }).includes('firefly')); assert.ok(!listFor({ season: 'summer' }).includes('firefly'));
  assert.ok(listFor({ season: 'spring', rain: true }).includes('snail')); assert.ok(!listFor({ season: 'spring' }).includes('snail'));
  const spots = [{ type: 'tree', x: 1, z: 1 }, { type: 'flower', x: 2, z: 2 }, { type: 'grass', x: 3, z: 3 }];
  const day = layout(7, spots, { at: () => ({ season: 'summer' }) }); assert.ok(day.length > 0 && day.every((b) => HABITAT[b.species].includes(b.type) && listFor({ season: 'summer' }).includes(b.species)));
  assert.deepEqual(layout(7, spots, { at: () => ({ season: 'summer' }) }), day); // (the same for everyone)
  assert.ok(layout(7, spots, { at: () => ({ season: 'winter' }) }).every((b) => listFor({ season: 'winter' }).includes(b.species))); // (v1.10.261: winter's own)
  assert.ok(layout(9, spots, { at: () => ({ season: 'summer', night: true }) }).every((b) => SPECIES[b.species].when !== 'day'));
  /* (#411 검토) shares: a summer day on a big island -- 39 tries on trees, flowers and grass, the striders 3 at most, the lamps empty */
  assert.equal(Object.values(QUOTA).reduce((a, b) => a + b, 0), COUNT);
  const many = TYPES.flatMap((t) => Array.from({ length: 60 }, (_, i) => ({ type: t, x: i, z: TYPES.indexOf(t) }))); const tried = {};
  const sum = layout(11, many, { at: (x, z) => { tried[TYPES[z]] = (tried[TYPES[z]] || 0) + 1; return { season: 'summer' }; } });
  assert.equal(tried.tree + tried.flower + tried.grass, 39); assert.ok(sum.filter((b) => b.species === 'water_strider').length <= 3); assert.equal(sum.filter((b) => b.type === 'lamp').length, 0);
  assert.equal(new Set(sum.map((b) => b.id)).size, sum.length);
  console.log('island-insects ok', Object.keys(SPECIES).length);
}
