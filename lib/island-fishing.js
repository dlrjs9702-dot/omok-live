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
  // v1.10.90 낚시 도감 21종 (IDEAS #future-fishing-dex, assets 40): eight river fish and five more of the sea
  crucian_carp: { name: '붕어', icon: '🐟', grade: 'common', weight: 20, price: 500 },
  carp: { name: '잉어', icon: '🐟', grade: 'normal', weight: 14, price: 1100 },
  pale_chub: { name: '피라미', icon: '🐟', grade: 'common', weight: 20, price: 400 },
  sweetfish: { name: '은어', icon: '🐟', grade: 'normal', weight: 14, price: 1400 },
  catfish: { name: '메기', icon: '🐟', grade: 'normal', weight: 14, price: 1200 },
  mandarin_fish: { name: '쏘가리', icon: '🐟', grade: 'rare', weight: 5.5, price: 4500 },
  eel: { name: '뱀장어', icon: '🐟', grade: 'rare', weight: 5.5, price: 4000 },
  smelt: { name: '빙어', icon: '🐟', grade: 'normal', weight: 14, price: 1500 },
  mullet: { name: '숭어', icon: '🐟', grade: 'common', weight: 20, price: 600 },
  flatfish: { name: '넙치', icon: '🐟', grade: 'normal', weight: 14, price: 1300 },
  sea_bass: { name: '농어', icon: '🐟', grade: 'rare', weight: 5.5, price: 3500 },
  gizzard_shad: { name: '전어', icon: '🐟', grade: 'normal', weight: 14, price: 1000 },
  rockfish: { name: '우럭', icon: '🐟', grade: 'normal', weight: 14, price: 1200 },
});
// v1.10.90: which fish come where -- the water (river or sea) and that spot's season today (the island's four zones turn
// every Seoul midnight). A game table, not a claim about nature. 대왕 참치 only in summer and autumn seas, rarely.
const TABLE = Object.freeze({
  river: { spring: ['crucian_carp', 'carp', 'pale_chub', 'sweetfish'], summer: ['crucian_carp', 'pale_chub', 'sweetfish', 'catfish', 'mandarin_fish', 'eel'],
    autumn: ['crucian_carp', 'carp', 'pale_chub', 'sweetfish', 'catfish', 'eel'], winter: ['crucian_carp', 'carp', 'smelt'] },
  sea: { spring: ['anchovy', 'goby', 'pufferfish', 'mullet', 'flatfish'], summer: ['anchovy', 'mackerel', 'cutlassfish', 'pufferfish', 'sea_bass', 'octopus', 'stingray', 'giant_tuna'],
    autumn: ['anchovy', 'mackerel', 'cutlassfish', 'goby', 'gizzard_shad', 'stingray', 'giant_tuna'], winter: ['goby', 'pufferfish', 'mullet', 'flatfish', 'octopus', 'rockfish'] },
});
const WAIT_MS = [5000, 10000]; // from the cast to the bite
const BITE_MS = 1500; // the bite: Space within this
const LATE_MS = 700; // the network's share on top
const MOVE_R = 1.5; // the rod stays where it was cast

const listFor = (water = 'sea', season = 'summer') => TABLE[water === 'river' ? 'river' : 'sea'][TABLE.sea[season] ? season : 'summer'];
function draw(random = Math.random, { water = 'sea', season = 'summer' } = {}) {
  const list = listFor(water, season);
  const total = list.reduce((s, id) => s + SPECIES[id].weight, 0);
  let r = random() * total;
  for (const id of list) { r -= SPECIES[id].weight; if (r < 0) return id; }
  return list[0];
}
// the pier, the breakwater, or the shore right by the water (not the cliffs)
const canFish = (x, z) => T.canFish(x, z); // island-terrain (the browser asks the same)
const waterAt = (x, z) => T.fishWater(x, z); // v1.10.90: 'river' | 'sea' | null
// a cast: which fish and when it bites
// v1.10.92 잡화점 미끼 (where.bait): 'bait' bites sooner (2~5 s), 'bait_premium' too and the better (by price) of two draws
const BAIT_WAIT_MS = [2000, 5000];
function cast(now, random = Math.random, where = {}) { // where: { water, season } of the spot (v1.10.90), bait
  const wait = where.bait ? BAIT_WAIT_MS : WAIT_MS;
  let species = draw(random, where);
  // (A4 날씨: in the rain one more draw too -- the better by price is kept)
  for (let extra = (where.bait === 'bait_premium' ? 1 : 0) + (where.rain ? 1 : 0); extra > 0; extra -= 1) { const other = draw(random, where); if (SPECIES[other].price > SPECIES[species].price) species = other; }
  return { species, bait: where.bait || null, biteAt: now + wait[0] + Math.floor(random() * (wait[1] - wait[0])) };
}
// pulling in at `now`: 'ok', 'early' (before the bite) or 'late' (it got away)
function judge(c, now) {
  if (now < c.biteAt - 150) return 'early';
  if (now > c.biteAt + BITE_MS + LATE_MS) return 'late';
  return 'ok';
}

// v1.10.43 기념사진 (IDEAS ③): the photo spots -- a picture taken near one is kept on the account (spot and day, never the
// image); a picture anywhere else is only the player's own PNG
const townhallGate = T.townhallWorld(0, T.TOWNHALL.yard.z1 + 3);
const PHOTO_SPOTS = Object.freeze([
  { id: 'photo_plaza', name: '중앙광장', x: 0, z: 0, r: 15 },
  { id: 'photo_hall', name: '게임관 앞', x: 0, z: -41, r: 9 },
  { id: 'photo_townhall', name: '관공서 정문', x: townhallGate.x, z: townhallGate.z, r: 7 },
  { id: 'photo_gazebo', name: '정자', x: T.SPOTS.chat.x, z: T.SPOTS.chat.z, r: 8 },
  { id: 'photo_bridge', name: '개울 다리', x: T.bridges[0].x, z: T.bridges[0].z, r: 6 },
  { id: 'photo_tower', name: '등반 탑', x: T.SPOTS.climb.x, z: T.SPOTS.climb.z, r: 12 },
  { id: 'photo_pier', name: '부두 끝', x: T.PIER.x + T.PIER.ux * (T.PIER.half - 2), z: T.PIER.z + T.PIER.uz * (T.PIER.half - 2), r: 6 },
]);
const photoSpotAt = (x, z) => PHOTO_SPOTS.filter((s) => Math.hypot(x - s.x, z - s.z) <= s.r).sort((a, b) => Math.hypot(x - a.x, z - a.z) / a.r - Math.hypot(x - b.x, z - b.z) / b.r)[0] || null; // the nearest (relative to its size)
// 도감: fish, the island's gathered finds and (v1.10.43) the photo spots; titles (worn in the 칭호 slot beside the
// legend skins) at 4, 10 and all of them
const DEX = Object.freeze([...Object.entries(SPECIES).map(([id, f]) => ({ id: `fish_${id}`, name: f.name, kind: 'fish', grade: f.grade })),
  { id: 'herb', name: '희귀 약재', kind: 'gather' }, { id: 'berry', name: '나무 열매', kind: 'gather' }, { id: 'mushroom', name: '버섯', kind: 'gather' },
  ...PHOTO_SPOTS.map((s) => ({ id: s.id, name: s.name, kind: 'photo' })),
  ...Object.entries(require('./island-insects').SPECIES).map(([id, b]) => ({ id: `insect_${id}`, name: b.name, kind: 'insect', grade: b.grade }))]); // B 47 곤충 12
// Story keepsakes share the photo tab, but do not change existing collection/title requirements.
const MEMORIES = Object.freeze([{id:'memory_island',name:'첫 섬 나들이',kind:'photo',icon:'photo_gazebo',keepsake:true}]);
const MEMORY_IDS = new Set(MEMORIES.map(d=>d.id));
const collectionCount = mine => DEX.filter(d=>mine[d.id]?.count>0).length;
const DEX_IDS = new Set(DEX.map((d) => d.id));
// v1.10.90: 도감 완성 keeps its old count (18: the first eight fish, three finds, seven photo spots) so no one who earned it
// loses it now that 13 fish are in; the whole of the larger book is 대도감 완성
const DEX_TITLES = Object.freeze([{ id: 'dex_title_1', name: '섬 탐험가', need: 4 }, { id: 'dex_title_2', name: '섬 박물학자', need: 10 }, { id: 'dex_title_3', name: '도감 완성', need: 18 }, { id: 'dex_title_4', name: '대도감 완성', need: 23 }]); // (B 47: the insects added to the book do not take away a 대도감 already earned -- its 23 stays)
const dexTitle = (id) => DEX_TITLES.find((t) => t.id === id) || null;
const titlesFor = (found) => DEX_TITLES.filter((t) => found >= t.need);

module.exports = { TABLE, listFor, waterAt, MEMORIES, MEMORY_IDS, collectionCount, PHOTO_SPOTS, photoSpotAt, SPECIES, WAIT_MS, BITE_MS, LATE_MS, MOVE_R, draw, canFish, cast, judge, DEX, DEX_IDS, DEX_TITLES, dexTitle, titlesFor };
