'use strict';

// B 47 곤충 채집 (IDEAS #future-together-island): with a 잠자리채 from the 잡화점, on the island's grass -- the server alone
// decides which insect comes (the spot's season, day or night, rain) and when it flies by; Space while it is there
// catches it into the bag and the 도감, like a fish. A game table, not a claim about nature. Prices sit under the fish
// (a swing is shorter than a cast); the museum takes them as gifts.
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
});
const WAIT_MS = [1500, 4000]; // from the swing's start to the insect coming by
const CATCH_MS = 2500;        // it stays this long (Space within it)
const LATE_MS = 700;          // the network's share
const MOVE_R = 2;             // where one stood

// which insects may come: the spot's season, night or day, rain (the snail only then)
const listFor = ({ season = 'summer', night = false, rain = false } = {}) => Object.keys(SPECIES).filter((id) => { const s = SPECIES[id]; return s.seasons.includes(season) && (s.when === 'any' || (s.when === 'rain' ? rain : s.when === (night ? 'night' : 'day'))); });
function swing(now, random = Math.random, where = {}) {
  const list = listFor(where); if (!list.length) return null;
  const total = list.reduce((n, id) => n + SPECIES[id].weight, 0); let r = random() * total; let species = list[0];
  for (const id of list) { r -= SPECIES[id].weight; if (r < 0) { species = id; break; } }
  return { species, comeAt: now + WAIT_MS[0] + Math.floor(random() * (WAIT_MS[1] - WAIT_MS[0])) };
}
const judge = (c, now) => (now < c.comeAt ? 'early' : now > c.comeAt + CATCH_MS + LATE_MS ? 'late' : 'ok');

module.exports = { SPECIES, WAIT_MS, CATCH_MS, LATE_MS, MOVE_R, listFor, swing, judge };

if (require.main === module) {
  const assert = require('node:assert/strict');
  assert.deepEqual(listFor({ season: 'winter' }), []);
  assert.ok(listFor({ season: 'summer', night: true }).includes('firefly')); assert.ok(!listFor({ season: 'summer' }).includes('firefly'));
  assert.ok(listFor({ season: 'spring', rain: true }).includes('snail')); assert.ok(!listFor({ season: 'spring' }).includes('snail'));
  for (let i = 0; i < 200; i += 1) { const c = swing(0, Math.random, { season: 'autumn' }); assert.ok(listFor({ season: 'autumn' }).includes(c.species)); assert.ok(c.comeAt >= 1500 && c.comeAt < 4000); }
  const c = { comeAt: 1000 }; assert.equal(judge(c, 999), 'early'); assert.equal(judge(c, 1000 + CATCH_MS), 'ok'); assert.equal(judge(c, 1000 + CATCH_MS + LATE_MS + 1), 'late');
  console.log('island-insects ok', Object.keys(SPECIES).length);
}
