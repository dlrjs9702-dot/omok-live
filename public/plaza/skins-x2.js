// v1.10.74 스킨 2배 (IDEAS #future-skins-double): the added avatar parts, read by lib/skins.js (catalog: ids, tiers,
// names, the IP_SKINS switch) and by plaza/island-assets.js (the wardrobe: which model file draws each).
// X2_ITEMS: slot -> [[tier, name, file name], ...] (original designs). IP_ITEMS: [[character, name, owner, [[slot, tier,
// name], ...]], ...] (fan art of outside characters -- marked, switchable and to be deleted before any paid release).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SkinsX2 = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const X2_ITEMS = Object.freeze({
    hair: [['common', '조수 물결머리', 'tide_sweep'], ['premium', '산호 소용돌이', 'coral_curls'], ['common', '다시마 리본머리', 'kelp_ribbons'], ['premium', '혜성 부채머리', 'comet_fan'], ['rare', '성운 고리머리', 'nebula_coils'], ['common', '유성 능선머리', 'meteor_ridge'], ['premium', '논두렁 층머리', 'rice_terrace'], ['common', '차선 묶음머리', 'tea_whisk'], ['premium', '단풍 접힘머리', 'maple_fold'], ['rare', '눈언덕 머리', 'snowdrift'], ['common', '밤송이 회오리', 'chestnut_swirl'], ['premium', '대나무 마디머리', 'bamboo_stack'], ['common', '구름 계단머리', 'cloud_step'], ['premium', '도예가 매듭머리', 'potter_knot'], ['rare', '직조 리본머리', 'ribbon_weave'], ['premium', '면발 고리머리', 'ramen_loop'], ['common', '새싹 가르마', 'sprout_part']],
    outfit: [['common', '조수 측량복', 'tidal_surveyor'], ['premium', '산호 잠수복', 'coral_diver'], ['common', '다도 예복', 'tea_master'], ['premium', '도예 작업복', 'potter_smock'], ['rare', '별 지도사복', 'star_cartographer'], ['common', '달 우편복', 'moon_courier'], ['premium', '대나무 직조복', 'bamboo_weaver'], ['common', '빗방울 관측복', 'rain_gauge'], ['premium', '과수원 작업복', 'orchard_keeper'], ['rare', '설원 구조복', 'snow_rescuer'], ['common', '산호 연구복', 'reef_chemist'], ['premium', '발효사 작업복', 'bakery_proof'], ['common', '국수 장인복', 'noodle_chef'], ['premium', '등 장인복', 'lantern_maker'], ['rare', '연 축제복', 'kite_festival'], ['premium', '항구 안내복', 'harbor_pilot'], ['common', '숲 소리꾼복', 'forest_listener'], ['legend', '하지 겹옷', 'solstice_coat'], ['premium', '천문 정비복', 'observatory_tech']],
    hat: [['common', '조수 나침반', 'tide_compass'], ['premium', '산호 장식관', 'coral_tiara'], ['common', '찻잔 뚜껑모자', 'tea_lid'], ['premium', '대나무 차양', 'bamboo_canopy'], ['rare', '혜성 차양', 'comet_visor'], ['common', '달 시계관', 'moon_dial'], ['premium', '과일 바구니모자', 'orchard_basket'], ['common', '설원 신호모자', 'snow_beacon'], ['premium', '도기 그릇모자', 'pottery_bowl'], ['rare', '면발 둥지모자', 'noodle_nest'], ['common', '접은 연 모자', 'kite_fold'], ['premium', '등살 모자', 'lantern_cage'], ['common', '항구 등대모자', 'harbor_light'], ['premium', '숲 주름모자', 'mushroom_gills'], ['rare', '볏단 머리장식', 'rice_sheaf'], ['premium', '행성 고리모자', 'planet_ring']],
    cape: [['common', '조수 돛 망토', 'tide_sail'], ['premium', '대나무 발 망토', 'bamboo_screen'], ['common', '성운 패널', 'nebula_panel'], ['premium', '접은 연 등짐', 'kite_rig'], ['rare', '눈누비 망토', 'snow_quilt'], ['common', '과수원 잎 덮개', 'orchard_leaves'], ['premium', '항로 지도 망토', 'harbor_map'], ['common', '다도 접음 망토', 'tea_fold']],
    tail: [['common', '혜성 흐름', 'comet_stream'], ['premium', '다시마 부채', 'kelp_fan'], ['common', '산호 사슬', 'coral_chain'], ['premium', '기포 행렬', 'bubble_trail'], ['rare', '대나무 마디꼬리', 'bamboo_joint'], ['common', '볏단 술', 'rice_tassel'], ['premium', '차 향 소용돌이', 'tea_whorl'], ['common', '연 리본꼬리', 'kite_ribbon'], ['premium', '등 줄꼬리', 'lantern_string'], ['rare', '눈가루 흐름', 'snow_puff'], ['common', '유성 사슬', 'meteor_chain'], ['premium', '행성 궤도', 'planet_orbit'], ['common', '국수 꼬임', 'noodle_twist'], ['premium', '잎 폭포', 'leaf_cascade'], ['rare', '항구 밧줄', 'harbor_rope'], ['premium', '구름 흐름', 'cloud_drift'], ['common', '기어 사슬', 'gear_link']],
    shoes: [['common', '조수 갑판화', 'tidal_deck'], ['premium', '산호 지느러미화', 'coral_fin'], ['common', '다도 나막신', 'tea_clog'], ['premium', '도기 굽 신발', 'pottery_heel'], ['rare', '혜성 앞코화', 'comet_toe'], ['common', '달 디딤화', 'moon_step'], ['premium', '대나무 짜임화', 'bamboo_lattice'], ['common', '빗물 홈 신발', 'rain_channel'], ['premium', '씨앗 단추화', 'orchard_seed'], ['rare', '설원 아이젠화', 'snow_cleat'], ['common', '산호 채집화', 'reef_sample'], ['premium', '발효 빵 신발', 'bakery_puff'], ['common', '국수 매듭화', 'noodle_knot'], ['premium', '등살 신발', 'lantern_sole'], ['rare', '연 탭 신발', 'kite_tab'], ['premium', '밧줄 고리화', 'harbor_loop'], ['common', '숲 소리화', 'forest_tone']],
    necklace: [['common', '조수계 펜던트', 'tide_gauge'], ['premium', '산호 가지 펜던트', 'coral_branch'], ['common', '찻잔 펜던트', 'tea_cup'], ['premium', '도기 꽃병', 'pottery_vase'], ['rare', '혜성 호 펜던트', 'comet_arc'], ['common', '달 시계 펜던트', 'moon_dial'], ['premium', '대나무 매듭', 'bamboo_knot'], ['common', '빗물 병', 'rain_vial'], ['premium', '씨앗 모음', 'orchard_seed'], ['rare', '눈 결정', 'snow_crystal'], ['common', '산호 창', 'reef_window'], ['premium', '밀 이삭', 'bakery_wheat'], ['common', '국수 그릇', 'noodle_bowl'], ['premium', '작은 등', 'lantern_mini'], ['rare', '작은 연', 'kite_diamond'], ['premium', '항구 조타륜', 'harbor_wheel'], ['common', '도토리 모음', 'forest_acorn'], ['legend', '궤도 측정기', 'orbit_instrument']],
  });
  const IP_ITEMS = Object.freeze([ // [character, name, owner, [[slot, tier, name], ...]]
    ['hellokitty', '헬로키티', '산리오', [['outfit', 'legend', '헬로키티 의상'], ['hat', 'rare', '헬로키티 머리장식'], ['tail', 'premium', '헬로키티 꼬리'], ['necklace', 'premium', '헬로키티 목걸이']]],
    ['kuromi', '쿠로미', '산리오', [['outfit', 'legend', '쿠로미 의상'], ['hat', 'legend', '쿠로미 머리장식'], ['tail', 'premium', '쿠로미 꼬리'], ['necklace', 'premium', '쿠로미 목걸이']]],
    ['mymelody', '마이멜로디', '산리오', [['outfit', 'legend', '마이멜로디 의상'], ['hat', 'rare', '마이멜로디 머리장식'], ['tail', 'premium', '마이멜로디 꼬리'], ['shoes', 'premium', '마이멜로디 신발']]],
    ['cinnamoroll', '시나모롤', '산리오', [['outfit', 'legend', '시나모롤 의상'], ['hat', 'rare', '시나모롤 머리장식'], ['tail', 'premium', '시나모롤 꼬리'], ['necklace', 'premium', '시나모롤 목걸이']]],
    ['pompompurin', '폼폼푸린', '산리오', [['outfit', 'legend', '폼폼푸린 의상'], ['hat', 'rare', '폼폼푸린 머리장식'], ['tail', 'premium', '폼폼푸린 꼬리'], ['shoes', 'premium', '폼폼푸린 신발']]],
    ['superman', '슈퍼맨', 'DC', [['outfit', 'legend', '슈퍼맨 의상'], ['hat', 'rare', '슈퍼맨 머리장식'], ['cape', 'premium', '슈퍼맨 등 장비'], ['shoes', 'premium', '슈퍼맨 신발']]],
    ['batman', '배트맨', 'DC', [['outfit', 'legend', '배트맨 의상'], ['hat', 'rare', '배트맨 머리장식'], ['cape', 'premium', '배트맨 등 장비'], ['shoes', 'premium', '배트맨 신발']]],
    ['ironman', '아이언맨', '마블', [['outfit', 'legend', '아이언맨 의상'], ['hat', 'rare', '아이언맨 머리장식'], ['cape', 'premium', '아이언맨 등 장비'], ['necklace', 'premium', '아이언맨 목걸이']]],
    ['spiderman', '스파이더맨', '마블', [['outfit', 'legend', '스파이더맨 의상'], ['hat', 'rare', '스파이더맨 머리장식'], ['cape', 'premium', '스파이더맨 등 장비'], ['shoes', 'premium', '스파이더맨 신발']]],
    ['captainamerica', '캡틴 아메리카', '마블', [['outfit', 'legend', '캡틴 아메리카 의상'], ['hat', 'rare', '캡틴 아메리카 머리장식'], ['cape', 'premium', '캡틴 아메리카 등 장비'], ['necklace', 'premium', '캡틴 아메리카 목걸이']]],
    ['pochacco', '포차코', '산리오', [['outfit', 'legend', '포차코 의상'], ['hat', 'rare', '포차코 머리장식'], ['tail', 'premium', '포차코 꼬리'], ['necklace', 'premium', '포차코 목걸이']]], // v1.10.92 (assets 42)
    ['pikachu', '피카츄', '포켓몬', [['outfit', 'legend', '피카츄 의상'], ['hat', 'rare', '피카츄 머리장식'], ['tail', 'premium', '피카츄 꼬리'], ['necklace', 'premium', '피카츄 목걸이']]],
  ]);
  // the character game skins connected so far (public/skin-art-ip.js draws them): [family, character, tier ('theme' = room
  // theme), owner]; ids <family>_ip_<character> (piece) and <family>_ipt_<character> (theme)
  const IP_GAME = Object.freeze([
  [
    "omok",
    "hellokitty",
    "rare",
    "산리오"
  ],
  [
    "bingo",
    "hellokitty",
    "rare",
    "산리오"
  ],
  [
    "yut",
    "kuromi",
    "legend",
    "산리오"
  ],
  [
    "othello",
    "kuromi",
    "rare",
    "산리오"
  ],
  [
    "connect4",
    "mymelody",
    "premium",
    "산리오"
  ],
  [
    "oldmaid",
    "mymelody",
    "premium",
    "산리오"
  ],
  [
    "dots",
    "cinnamoroll",
    "premium",
    "산리오"
  ],
  [
    "pictionary",
    "cinnamoroll",
    "premium",
    "산리오"
  ],
  [
    "baseball",
    "pompompurin",
    "premium",
    "산리오"
  ],
  [
    "halligalli",
    "pompompurin",
    "premium",
    "산리오"
  ],
  [
    "omok",
    "superman",
    "rare",
    "DC"
  ],
  [
    "liar",
    "superman",
    "rare",
    "DC"
  ],
  [
    "yut",
    "batman",
    "rare",
    "DC"
  ],
  [
    "davinci",
    "batman",
    "rare",
    "DC"
  ],
  [
    "connect4",
    "ironman",
    "rare",
    "마블"
  ],
  [
    "gostop",
    "ironman",
    "rare",
    "마블"
  ],
  [
    "dots",
    "spiderman",
    "rare",
    "마블"
  ],
  [
    "bingo",
    "spiderman",
    "rare",
    "마블"
  ],
  [
    "baseball",
    "captainamerica",
    "rare",
    "마블"
  ],
  [
    "oldmaid",
    "captainamerica",
    "rare",
    "마블"
  ],
  [
    "halligalli",
    "pikachu",
    "rare",
    "포켓몬"
  ],
  [
    "pictionary",
    "pikachu",
    "rare",
    "포켓몬"
  ],
  [
    "omok",
    "hellokitty",
    "theme",
    "산리오"
  ],
  [
    "yut",
    "kuromi",
    "theme",
    "산리오"
  ],
  [
    "connect4",
    "mymelody",
    "theme",
    "산리오"
  ],
  [
    "dots",
    "cinnamoroll",
    "theme",
    "산리오"
  ],
  [
    "halligalli",
    "pompompurin",
    "theme",
    "산리오"
  ],
  [
    "liar",
    "superman",
    "theme",
    "DC"
  ],
  [
    "davinci",
    "batman",
    "theme",
    "DC"
  ],
  [
    "gostop",
    "ironman",
    "theme",
    "마블"
  ],
  [
    "bingo",
    "spiderman",
    "theme",
    "마블"
  ],
  [
    "baseball",
    "captainamerica",
    "theme",
    "마블"
  ],
  [
    "pictionary",
    "pikachu",
    "theme",
    "포켓몬"
  ]
]);
  // B 46 겨울 축제 의상 (assets 46, characters/wear-winter): [slot, tier, name, file] -- ids avatar_winter_<file without wear_>
  const WINTER_ITEMS = Object.freeze([
    ['hat', 'premium', '산타 모자', 'wear_hat_santa'], ['outfit', 'rare', '산타 옷', 'wear_outfit_santa'], ['necklace', 'common', '털 목도리', 'wear_necklace_fur'],
    ['shoes', 'common', '털 부츠', 'wear_shoes_fur'], ['cape', 'premium', '눈꽃 망토', 'wear_cape_snowflake'], ['hat', 'premium', '루돌프 머리띠', 'wear_hat_reindeer'],
    // X1 크리스마스 (the sweater from assets 78 -- made on the slim body --, the earmuffs from 77): on sale before the festival too
    ['outfit', 'rare', '크리스마스 스웨터', 'wear_outfit_xmas_sweater'], ['hat', 'premium', '털 귀마개', 'wear_hat_earmuffs'],
  ]);
  return { X2_ITEMS, IP_ITEMS, IP_GAME, WINTER_ITEMS };
}));
