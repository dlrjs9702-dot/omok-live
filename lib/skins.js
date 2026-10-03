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
// v1.9.2 광장 아바타: `hair`, `outfit`, `hat` hold avatar items (family `avatar`); `title` holds the legend skin whose
// name is shown under the player's name in the plaza (only an owned legend can be the title).
const SLOTS = Object.freeze(['piece', 'theme', 'hair', 'outfit', 'hat', 'title']);
const AVATAR_SLOTS = Object.freeze({ hair: '헤어', outfit: '의상', hat: '모자·장식' });

// v1.9.2 광장 아바타 스킨 (IDEAS 「아바타 스킨 상점 판매」; items and prices are Claude's proposal, 2026-10-03).
// Ids are `avatar_<slot>_<n>` by position: never reorder. Prices are lower than game skins (an avatar is worn everywhere).
const AVATAR_PRICES = Object.freeze({ common: 200_000, premium: 500_000, legend: 1_500_000 });
const AVATAR_ITEMS = Object.freeze({
  hair: [['common', '양갈래 머리'], ['common', '곱슬 머리'], ['common', '포니테일'], ['premium', '뾰족 머리'], ['premium', '무지개 머리'], ['legend', '별빛 머리']],
  outfit: [['common', '멜빵바지'], ['common', '줄무늬 티셔츠'], ['premium', '한복 저고리'], ['premium', '우주복'], ['legend', '왕실 망토']],
  hat: [['common', '밀짚모자'], ['common', '고양이 귀'], ['premium', '꽃 화관'], ['premium', '왕관'], ['legend', '천사 후광']],
});

// family -> names. Ids are `<family>_c1..c5`, `_p1..p3`, `_t1..t2`, `_l1` (positions in these lists, never reorder).
const CATALOG = Object.freeze({
  // v1.8.7 (IDEAS 「배경 테마-전설 스킨 대응 구조」): a game may have one legend per room theme. `legend` is then a
  // list (ids `_l1`, `_l2` by position, never reorder: `_l1` is the legend already sold) and `pairs` names each
  // legend's matching theme (theme A ↔ legend A). Games that still have one legend keep the plain string.
  omok: { name: '오목', common: ['냥발석', '태극석', '기어코어', '행성석', '도깨비석'], premium: ['벚꽃석', '번개핵', '용암핵'], theme: ['조선 기원', '별빛 천문대'], legend: ['천상 바둑', '왕실 기보'],
    pairs: { l1: 't2', l2: 't1' } },
  connect4: { name: '사목', common: ['로켓칩', '기어칩', '눈알몬스터칩', '별코인', '아케이드 토큰'], premium: ['플라즈마 코어', '홀로 디스크', '운석 코어'], theme: ['80년대 오락실', '우주 정거장'], legend: ['코스믹 커넥트', '픽셀 챔피언'],
    pairs: { l1: 't2', l2: 't1' } },
  yut: { name: '윷놀이', common: ['병아리', '장난감 자동차', '꼬마 도깨비', '조선 무사', '미니 로봇'], premium: ['유령 행렬', '기사단', '소형 우주선'], theme: ['설날 한옥마당', '달나라 윷판'], legend: ['사방신', '옥토끼 원정대'],
    pairs: { l1: 't1', l2: 't2' } },
  dots: { name: '점과 상자', common: ['대나무', '밧줄', '철도 레일', '쇠사슬', '크레용 획'], premium: ['전기 케이블', '용암 균열', '레이저 빔'], theme: ['낙서 공책', '사이버 회로판'], legend: ['회로 지배자', '낙서 마법사'],
    pairs: { l1: 't2', l2: 't1' } },
  bingo: { name: '빙고', common: ['냥발 도장', '왁스 봉인', '조준경', '포커칩', '꽃도장'], premium: ['레이저 마커', '불꽃 인장', '홀로그램 마커'], theme: ['학교 축제', '카지노 쇼홀'], legend: ['잭팟 빙고', '축제 응원단'],
    pairs: { l1: 't2', l2: 't1' } },
  baseball: { name: '숫자야구', common: ['야구 전광판', '형사 수첩', '슬롯머신', '금고 다이얼', '실험실 표본판'], premium: ['첩보 터미널', '홀로그램 분석기', '보안 금고'], theme: ['야구장 덕아웃', '극비 연구소'], legend: ['마스터 코드', '끝내기 홈런'],
    pairs: { l1: 't2', l2: 't1' } },
  pictionary: { name: '그림 맞히기', common: ['왕연필', '통통 크레용', '페인트 붓', '만년필', '스프레이캔'], premium: ['별빛 펜', '무지개 붓', '마법 깃펜'], theme: ['미술교실', '한밤의 화실'], legend: ['꿈을 그리는 붓', '황금 팔레트'],
    pairs: { l1: 't2', l2: 't1' } },
  twentyquestions: { name: '스무고개', common: ['탐정 메모', '신문기사', '무전기', '연구 표본표', '암호 쪽지'], premium: ['마법 수정구', '암호 해독기', '홀로그램 질문판'], theme: ['탐정 사무소', 'TV 퀴즈쇼'], legend: ['진실의 문', '골든 버저'],
    pairs: { l1: 't1', l2: 't2' } },
  liar: { name: '라이어게임', common: ['탐정 배지', '수배전단', '타로카드', '비밀봉투', '카세트 신분증'], premium: ['첩보요원 카드', '왕실 가면', '홀로그램 ID'], theme: ['취조실', '가면무도회장'], legend: ['무명의 왕', '심문관의 램프'],
    pairs: { l1: 't2', l2: 't1' } },
  davinci: { name: '다빈치 코드', common: ['도미노 석판', '기계식 자물쇠', '룬 석판', '카지노 플라크', '비밀문서 파일'], premium: ['태엽 암호기', '암호 유리판', '홀로그램 키'], theme: ['르네상스 서재', '거대 금고실'], legend: ['금단의 암호', '황금 금고'],
    pairs: { l1: 't1', l2: 't2' } },
  oldmaid: { name: '도둑잡기', common: ['고양이 괴도', '장난감 상자', '신문 수배전단', '몬스터 카드', '카지노 카드'], premium: ['탐정 파일', '월광 괴도', '야광 카드'], theme: ['고풍 저택', '야간 특급열차'], legend: ['괴도와 탐정', '야간 특급 승차권'],
    pairs: { l1: 't1', l2: 't2' } },
  halligalli: { name: '할리갈리', common: ['만화책 카드', '과일상자 카드', '픽셀게임 카드', '스티커북 카드', '몬스터 연구소 카드'], premium: ['유리 아케이드', '네온 페스티벌', '팝아트 폭발'], theme: ['과일시장', '한여름 피크닉'], legend: ['황금 종 축제', '한여름 수박 축제'],
    pairs: { l1: 't1', l2: 't2' } },
  gostop: { name: '고스톱·맞고', common: ['도깨비 문양', '조선 왕실 인장', '호랑이 민화', '복주머니', '밤까치'], premium: ['자개함', '먹빛 도깨비', '금박 왕실'], theme: ['조선 사랑방', '달빛 정자'], legend: ['왕실 화투', '월광 화투'],
    pairs: { l1: 't1', l2: 't2' } },
  othello: { name: '오델로', common: ['왕관 인장', '고양이 발', '톱니기어', '행성 문양', '방패 문장'], premium: ['프리즘 코어', '태양·달', '얼음·불꽃'], theme: ['고전 응접실', '우주의 일식'], legend: ['일식과 월식', '회중시계'],
    pairs: { l1: 't2', l2: 't1' } },
});

// Games whose skin art is drawn (family name -> the game types that share it). 오목 2vs2 shares the 오목 skins.
const ACTIVE_FAMILIES = Object.freeze({ omok: ['omok', 'omok2v2'], connect4: ['connect4'], othello: ['othello'], yut: ['yut'], dots: ['dots'], bingo: ['bingo'], baseball: ['baseball'], pictionary: ['pictionary'], twentyquestions: ['twentyquestions'], liar: ['liar'], davinci: ['davinci'], oldmaid: ['oldmaid'], halligalli: ['halligalli'], gostop: ['gostop'] });
const FAMILY_OF_GAME = Object.freeze(Object.fromEntries(Object.entries(ACTIVE_FAMILIES).flatMap(([family, games]) => games.map(game => [game, family]))));
const FAMILY_NAMES = Object.freeze({ ...Object.fromEntries(Object.keys(ACTIVE_FAMILIES).map(family => [family, CATALOG[family].name])), avatar: '광장 아바타' });

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
    const pairOf = {}; // legend <-> theme, both directions
    for (const [legend, theme] of Object.entries(c.pairs || {})) { pairOf[`${family}_${legend}`] = `${family}_${theme}`; pairOf[`${family}_${theme}`] = `${family}_${legend}`; }
    c.theme.forEach((name, i) => list.push({ id: `${family}_t${i + 1}`, family, tier: 'theme', name, pair: pairOf[`${family}_t${i + 1}`] || null }));
    [].concat(c.legend).forEach((name, i) => list.push({ id: `${family}_l${i + 1}`, family, tier: 'legend', name, pair: pairOf[`${family}_l${i + 1}`] || null }));
    list.push(...LEGACY.filter(skin => skin.family === family));
  }
  for (const [slot, items] of Object.entries(AVATAR_ITEMS)) {
    items.forEach(([tier, name], i) => list.push({ id: `avatar_${slot}_${i + 1}`, family: 'avatar', tier, name, slot, price: AVATAR_PRICES[tier], slotLabel: AVATAR_SLOTS[slot] }));
  }
  return list;
}

const SKINS = Object.freeze(definitions().map((def) => {
  if (!/^[a-z0-9_]{3,60}$/.test(def.id)) throw new RangeError(`Invalid skin id ${def.id}`);
  const tier = TIERS[def.tier];
  if (!tier || !FAMILY_NAMES[def.family]) throw new RangeError(`Invalid skin ${def.id}`);
  return Object.freeze({ ...def, slot: def.slot || tier.slot, price: def.price || tier.price, tierLabel: tier.label });
}));
if (new Set(SKINS.map(skin => skin.id)).size !== SKINS.length) throw new RangeError('Duplicate skin id');
const BY_ID = new Map(SKINS.map(skin => [skin.id, skin]));

const skinById = id => BY_ID.get(String(id)) || null;
const familyOf = gameType => FAMILY_OF_GAME[gameType] || null;

// What the shop shows: grouped by game family, in catalog order. Prices come from here only, never from a client.
function catalogView() {
  return Object.keys(FAMILY_NAMES).map(family => ({
    family, name: FAMILY_NAMES[family],
    // `pair`: the matching room theme of a legend (and the legend of a theme), for a "recommended set" in the shop.
    skins: SKINS.filter(skin => skin.family === family).map(({ id, name, tier, tierLabel, slot, price, pair, slotLabel }) => ({ id, name, tier, tierLabel, slot, price, ...(pair ? { pair } : {}), ...(slotLabel ? { slotLabel } : {}) })),
  }));
}

// Profile badges: one per legend skin an account owns (shown in 내 전적 / 다른 플레이어 조회).
function badgesOf(ownedIds) {
  const owned = new Set(ownedIds);
  return SKINS.filter(skin => skin.tier === 'legend' && skin.family !== 'avatar' && owned.has(skin.id)).map(skin => ({ family: skin.family, game: FAMILY_NAMES[skin.family], name: skin.name }));
}

// v1.9.2: an account's plaza look -- the avatar items it wears and the name of the legend it chose as its title.
function avatarLookOf(equipped) {
  const mine = equipped?.avatar || {};
  const look = {};
  for (const slot of Object.keys(AVATAR_SLOTS)) { const skin = skinById(mine[slot]); if (skin?.family === 'avatar' && skin.slot === slot) look[slot] = skin.id; }
  const title = skinById(mine.title);
  return { look, title: title?.tier === 'legend' && title.family !== 'avatar' ? title.name : null };
}

module.exports = { TIERS, SLOTS, AVATAR_SLOTS, SKINS, CATALOG, ACTIVE_FAMILIES, FAMILY_NAMES, skinById, familyOf, catalogView, badgesOf, avatarLookOf };
