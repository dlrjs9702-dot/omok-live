'use strict';

// v1.10.42 게임 아일랜드 낚시·도감 (IDEAS 「낚시·도감·기념사진·앉기/이모트/게임 초대」 ①②, 사용자 확정 2026-10-07): the server
// alone decides -- where one may fish, which fish bites and when, whether the catch came in time; the bag, the ledger
// and the 도감 (collection) follow. Pure: server.js keeps one cast per session and calls the store.
const T = require('../public/plaza/island-terrain.js');

// grades and prices (Claude, 사용자 위임 2026-10-07): common 60% / normal 28% / rare 11% / big 1%; about 1,400P a cast,
// a cast about 20 seconds -> about 85,000P in 20 minutes, under the 20~30 minutes ≈ 100,000P line (경제 기준 통합)
const SPECIES = Object.freeze({
  anchovy: { name: '멸치', icon: '🐟', grade: 'common', weight: 20, price: 300 },
  mackerel: { name: '고등어', icon: '🐟', grade: 'common', weight: 20, price: 400 },
  goby: { name: '망둥어', icon: '🐟', grade: 'common', weight: 20, price: 500 },
  cutlassfish: { name: '갈치', icon: '🐟', grade: 'normal', weight: 14, price: 900 },
  pufferfish: { name: '복어', icon: '🐡', grade: 'normal', weight: 14, price: 1200 },
  octopus: { name: '문어', icon: '🐙', grade: 'rare', weight: 5.5, price: 4000 },
  stingray: { name: '가오리', icon: '🐟', grade: 'rare', weight: 5.5, price: 5000 },
  giant_tuna: { name: '대왕 참치', icon: '🐟', grade: 'big', weight: 1, price: 45000 },
});
const WAIT_MS = [5000, 10000]; // from the cast to the bite
const BITE_MS = 1500; // the bite: Space within this
const LATE_MS = 700; // the network's share on top
const MOVE_R = 1.5; // the rod stays where it was cast

function draw(random = Math.random) {
  const total = Object.values(SPECIES).reduce((s, f) => s + f.weight, 0);
  let r = random() * total;
  for (const [id, f] of Object.entries(SPECIES)) { r -= f.weight; if (r < 0) return id; }
  return 'anchovy';
}
// the pier, the breakwater, or the shore right by the water (not the cliffs)
const canFish = (x, z) => T.canFish(x, z); // island-terrain (the browser asks the same)
// a cast: which fish and when it bites
function cast(now, random = Math.random) {
  return { species: draw(random), biteAt: now + WAIT_MS[0] + Math.floor(random() * (WAIT_MS[1] - WAIT_MS[0])) };
}
// pulling in at `now`: 'ok', 'early' (before the bite) or 'late' (it got away)
function judge(c, now) {
  if (now < c.biteAt - 150) return 'early';
  if (now > c.biteAt + BITE_MS + LATE_MS) return 'late';
  return 'ok';
}

// 도감: fish and the island's gathered finds; titles (worn in the 칭호 slot beside the legend skins) at 4, 8 and all 11
const DEX = Object.freeze([...Object.entries(SPECIES).map(([id, f]) => ({ id: `fish_${id}`, name: f.name, kind: 'fish', grade: f.grade })),
  { id: 'herb', name: '희귀 약재', kind: 'gather' }, { id: 'berry', name: '나무 열매', kind: 'gather' }, { id: 'mushroom', name: '버섯', kind: 'gather' }]);
const DEX_IDS = new Set(DEX.map((d) => d.id));
const DEX_TITLES = Object.freeze([{ id: 'dex_title_1', name: '섬 탐험가', need: 4 }, { id: 'dex_title_2', name: '섬 박물학자', need: 8 }, { id: 'dex_title_3', name: '도감 완성', need: DEX.length }]);
const dexTitle = (id) => DEX_TITLES.find((t) => t.id === id) || null;
const titlesFor = (found) => DEX_TITLES.filter((t) => found >= t.need);

module.exports = { SPECIES, WAIT_MS, BITE_MS, LATE_MS, MOVE_R, draw, canFish, cast, judge, DEX, DEX_IDS, DEX_TITLES, dexTitle, titlesFor };
