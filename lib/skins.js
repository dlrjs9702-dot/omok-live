'use strict';

// Cosmetic skins: a points sink that never changes a game's rules or what its board says. This file is the catalog
// (ids, tiers, prices, names) and the small rules around it; how a skin looks lives in public/skin-*.js.
// A skin is bought once per account with points (ledger reason `skin_purchase`, never refunded, traded or gifted),
// equipped per game and slot, and shown identically to everyone in the room (the server shares each player's
// equipped `skin` and the host's room `theme` in the public room state; clients only draw them).
//
// Confirmed catalog (IDEAS.md 「게임별 스킨 카탈로그」): per official game 5 common (500,000P) + 3 premium
// (1,000,000P) + 2 room themes (1,500,000P) + 1 legend (3,000,000P). Slots: `piece` (common / premium / legend, one
// per game) and `theme` (room theme, one per game, applied from the host's equipped one). A legend takes the `piece`
// slot. The whole catalog is written down here, but a game only sells skins once its art exists (ACTIVE_FAMILIES).
// The five S1 omok material skins (v1.7.30) stay on sale and stay equippable (`legacy`).

const TIERS = Object.freeze({
  common: Object.freeze({ label: '일반', price: 500_000, slot: 'piece' }),
  premium: Object.freeze({ label: '고급', price: 1_000_000, slot: 'piece' }),
  theme: Object.freeze({ label: '방 테마', price: 1_500_000, slot: 'theme' }),
  legend: Object.freeze({ label: '전설', price: 3_000_000, slot: 'piece' }),
});
const SLOTS = Object.freeze(['piece', 'theme']);

// family -> names. Ids are `<family>_c1..c5`, `_p1..p3`, `_t1..t2`, `_l1` (positions in these lists, never reorder).
const CATALOG = Object.freeze({
  omok: { name: '오목', common: ['냥발석', '태극석', '기어코어', '행성석', '도깨비석'], premium: ['벚꽃석', '번개핵', '용암핵'], theme: ['조선 기원', '별빛 천문대'], legend: '천상 바둑' },
  connect4: { name: '사목', common: ['로켓칩', '기어칩', '눈알몬스터칩', '별코인', '아케이드 토큰'], premium: ['플라즈마 코어', '홀로 디스크', '운석 코어'], theme: ['80년대 오락실', '우주 정거장'], legend: '코스믹 커넥트' },
  yut: { name: '윷놀이', common: ['병아리', '장난감 자동차', '꼬마 도깨비', '조선 무사', '미니 로봇'], premium: ['유령 행렬', '기사단', '소형 우주선'], theme: ['설날 한옥마당', '달나라 윷판'], legend: '사방신' },
  dots: { name: '점과 상자', common: ['대나무', '밧줄', '철도 레일', '쇠사슬', '크레용 획'], premium: ['전기 케이블', '용암 균열', '레이저 빔'], theme: ['낙서 공책', '사이버 회로판'], legend: '회로 지배자' },
  bingo: { name: '빙고', common: ['냥발 도장', '왁스 봉인', '조준경', '포커칩', '꽃도장'], premium: ['레이저 마커', '불꽃 인장', '홀로그램 마커'], theme: ['학교 축제', '카지노 쇼홀'], legend: '잭팟 빙고' },
  baseball: { name: '숫자야구', common: ['야구 전광판', '형사 수첩', '슬롯머신', '금고 다이얼', '실험실 표본판'], premium: ['첩보 터미널', '홀로그램 분석기', '보안 금고'], theme: ['야구장 덕아웃', '극비 연구소'], legend: '마스터 코드' },
  othello: { name: '오델로', common: ['왕관 인장', '고양이 발', '톱니기어', '행성 문양', '방패 문장'], premium: ['프리즘 코어', '태양·달', '얼음·불꽃'], theme: ['고전 응접실', '우주의 일식'], legend: '일식과 월식' },
});

// Games whose skin art is drawn (family name -> the game types that share it). 오목 2vs2 shares the 오목 skins.
const ACTIVE_FAMILIES = Object.freeze({ omok: ['omok', 'omok2v2'], connect4: ['connect4'], othello: ['othello'], yut: ['yut'], dots: ['dots'], bingo: ['bingo'], baseball: ['baseball'] });
const FAMILY_OF_GAME = Object.freeze(Object.fromEntries(Object.entries(ACTIVE_FAMILIES).flatMap(([family, games]) => games.map(game => [game, family]))));
const FAMILY_NAMES = Object.freeze(Object.fromEntries(Object.keys(ACTIVE_FAMILIES).map(family => [family, CATALOG[family].name])));

const LEGACY = [
  { id: 'omok_common_obsidian', family: 'omok', tier: 'common', name: '흑요석과 진주', legacy: true },
  { id: 'omok_common_jade', family: 'omok', tier: 'common', name: '비취와 백옥', legacy: true },
  { id: 'omok_common_amber', family: 'omok', tier: 'common', name: '호박과 수정', legacy: true },
  { id: 'omok_common_porcelain', family: 'omok', tier: 'common', name: '청화 자기', legacy: true },
  { id: 'omok_common_bronze', family: 'omok', tier: 'common', name: '청동과 은', legacy: true },
];

function definitions() {
  const list = [];
  for (const family of Object.keys(ACTIVE_FAMILIES)) {
    const c = CATALOG[family];
    c.common.forEach((name, i) => list.push({ id: `${family}_c${i + 1}`, family, tier: 'common', name }));
    c.premium.forEach((name, i) => list.push({ id: `${family}_p${i + 1}`, family, tier: 'premium', name }));
    c.theme.forEach((name, i) => list.push({ id: `${family}_t${i + 1}`, family, tier: 'theme', name }));
    list.push({ id: `${family}_l1`, family, tier: 'legend', name: c.legend });
    list.push(...LEGACY.filter(skin => skin.family === family));
  }
  return list;
}

const SKINS = Object.freeze(definitions().map((def) => {
  if (!/^[a-z0-9_]{3,60}$/.test(def.id)) throw new RangeError(`Invalid skin id ${def.id}`);
  const tier = TIERS[def.tier];
  if (!tier || !FAMILY_NAMES[def.family]) throw new RangeError(`Invalid skin ${def.id}`);
  return Object.freeze({ ...def, slot: tier.slot, price: tier.price, tierLabel: tier.label });
}));
if (new Set(SKINS.map(skin => skin.id)).size !== SKINS.length) throw new RangeError('Duplicate skin id');
const BY_ID = new Map(SKINS.map(skin => [skin.id, skin]));

const skinById = id => BY_ID.get(String(id)) || null;
const familyOf = gameType => FAMILY_OF_GAME[gameType] || null;

// What the shop shows: grouped by game family, in catalog order. Prices come from here only, never from a client.
function catalogView() {
  return Object.keys(FAMILY_NAMES).map(family => ({
    family, name: FAMILY_NAMES[family],
    skins: SKINS.filter(skin => skin.family === family).map(({ id, name, tier, tierLabel, slot, price }) => ({ id, name, tier, tierLabel, slot, price })),
  }));
}

// Profile badges: one per legend skin an account owns (shown in 내 전적 / 다른 플레이어 조회).
function badgesOf(ownedIds) {
  const owned = new Set(ownedIds);
  return SKINS.filter(skin => skin.tier === 'legend' && owned.has(skin.id)).map(skin => ({ family: skin.family, game: FAMILY_NAMES[skin.family], name: skin.name }));
}

module.exports = { TIERS, SLOTS, SKINS, CATALOG, ACTIVE_FAMILIES, FAMILY_NAMES, skinById, familyOf, catalogView, badgesOf };
