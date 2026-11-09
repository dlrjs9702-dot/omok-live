'use strict';

// v1.10.91 경제 값 관리 (IDEAS #future-admin-console ②, 사용자 2026-10-18 「경제 수치 열 수 있게」): the values the
// administrator may change without a deploy -- what the island pays for things, the islanders' errands (G-포인트: the
// solo games pay nothing any more -- their reward rows are gone; a value saved for one is dropped on load). Each has its code default and a range; a change is kept on the server (worldValue 'economy') with who/when/
// before, and can be put back. Everything else stays in code (the ledger, the bank, the tax, quest steps).
// ponytail: module-level overrides, one server process; reloaded from the store at start and on each change
const Items = require('./island-items');

const LIFE = ['weed', 'trash', 'herb', 'berry', 'mushroom', 'harvest', 'candy'];
const range = (def) => ({ min: 1, max: Math.max(10, def * 10) });
const DEFS = Object.freeze([
  ...LIFE.map((id) => ({ key: `item:${id}`, group: '생활 자원 판매가', label: Items.ITEMS[id].name, def: Items.ITEMS[id].price })),
  ...Object.keys(Items.ITEMS).filter((id) => id.startsWith('fish_')).map((id) => ({ key: `item:${id}`, group: '물고기 판매가', label: Items.ITEMS[id].name, def: Items.ITEMS[id].price })),
  { key: 'fish:sizeMin', group: '물고기 판매가', label: '크기 가장 작은 끝 값(%)', def: 80 }, // v1.10.231 물고기 크기: the price by size, the average 100
  { key: 'fish:sizeMax', group: '물고기 판매가', label: '크기 가장 큰 끝 값(%)', def: 130 },
  ...Items.GOODS.map((id) => ({ key: `good:${id}`, group: '잡화점 가격', label: Items.ITEMS[id].name, def: Items.ITEMS[id].buy })), // v1.10.92
  { key: 'errand:find', group: '주민 심부름 보상', label: '사람 찾기', def: 2000 },
  ...require('../public/plaza/island-projects').PROJECTS.map((p) => ({ key: `project:${p.id}`, group: '섬 가꾸기 사업 목표', label: p.name, def: p.goal })), // v1.10.222
  { key: 'errand:deliver', group: '주민 심부름 보상', label: '물건 전하기', def: 1500 },
  { key: 'errand:far', group: '주민 심부름 보상', label: '먼 주민 거리 한 단계마다 더함(최대 2단계)', def: 500 }, // (묶음 1 멀리 심부름)
  { key: 'errand:buy', group: '주민 심부름 보상', label: '사다 주기(물건값에 더함)', def: 1500 }, // v1.10.92
  // 묶음 2 가구점 (docs/furniture-shop-20261019.md): by rarity, the always-on-sale ones, and how many a day one person buys
  // 묶음 4 내 집 (docs/my-home-20261020.md): the house (about five days of a player's earnings), a floor, wallpaper or roof changed
  // 묶음 4-2: the 오두막 first (about two days' earnings), made a 작은 집 later (about five)
  { key: 'home:price_1', group: '내 집', label: '오두막 값(한 번에)', def: 20000 },
  { key: 'home:price_2', group: '내 집', label: '집 넓히기(작은 집)', def: 50000 },
  { key: 'home:price_3', group: '내 집', label: '집 넓히기(큰 집)', def: 100000 }, // (묶음 4-2 3단계: 약 10일치 벌이)
  { key: 'home:price_4', group: '내 집', label: '집 넓히기(2층 큰 집)', def: 200000 }, // (R8 4단계: 약 20일치 벌이, 제안)
  { key: 'home:style', group: '내 집', label: '바닥·벽지·지붕 바꾸기', def: 1000 },
  { key: 'furniture:common', group: '가구점', label: '흔함 가구', def: 3000 },
  { key: 'furniture:uncommon', group: '가구점', label: '보통 가구', def: 6000 },
  { key: 'furniture:rare', group: '가구점', label: '드묾 가구', def: 15000 },
  { key: 'furniture:base', group: '가구점', label: '늘 파는 가구', def: 1000 },
  { key: 'furniture:perDay', group: '가구점', label: '한 사람 하루 구매 수(전시품)', def: 3 },
  { key: 'furniture:reform', group: '가구점', label: '가구 리폼(색 바꾸기) 한 번', def: 3000 }, // v1.10.226
  // v1.10.225 마당 꾸미기 (docs/yard-20261102.md): the 「마당」 shelf's twelve, and the yard made bigger at the 관공서
  ...Object.entries({ fence_wood: 2000, fence_stone: 3000, fence_flower: 4000, stepping_stones: 3000, garden_light: 6000, birdhouse: 7000, flowerbed: 8000, planter_box: 8000, mailbox: 9000, bench: 10000, lantern_stone: 12000, arch: 20000 })
    .map(([shape, def]) => ({ key: `yard:${shape}`, group: '마당', label: require('../public/plaza/island-furniture').good(`yard_${shape}__plain`).name, def })),
  { key: 'yard:price_2', group: '마당', label: '마당 넓히기 1', def: 100000 },
  { key: 'yard:price_3', group: '마당', label: '마당 넓히기 2', def: 200000 },
  { key: 'gift:skinPerDay', group: '선물', label: '스킨 선물 하루 횟수(보내는 사람)', def: 5 }, // 3-1 스킨 선물 (사용자 2026-10-19)
  // 문제 기록 3회차 21 (사용자 결정 10/22 「기존 펫 가격대」): the counter's pets -- a transformation small, 메타몽
  { key: 'pet:transform_animal', group: '펫샵', label: '변신 펫(동물)', def: 8000 },
  { key: 'pet:transform_ip', group: '펫샵', label: '변신 펫(캐릭터)', def: 12000 },
  { key: 'pet:ditto', group: '펫샵', label: '메타몽', def: 12000 },
  // v1.10.195 가방 늘리기 (docs/bag-redesign-20261027.md 7): bought once for good at the 잡화점
  { key: 'bag:24', group: '가방', label: '가방 24칸으로 늘리기', def: 50000 },
  { key: 'bag:32', group: '가방', label: '가방 32칸으로 늘리기', def: 150000 },
  // v1.10.297 물고기 통·곤충 채집통 (notes docs/fish-keepnet-20261109.md, 사용자 확정): 30 -> 60 -> 90 -> 120, once each at the 잡화점
  ...[['keepnet', '물고기 통'], ['bugbox', '곤충 채집통']].flatMap(([k, name]) => [[30, 200000], [60, 500000], [90, 1000000], [120, 2000000]].map(([n, def]) => ({ key: `${k}:${n}`, group: '가방', label: `${name} ${n}칸`, def }))),
  // R2 호감도 = 보상 (사용자 2026-10-22): a level reached, once per islander; a friendly asker's errand pays a little more
  { key: 'affinity:known', group: '주민 호감도', label: '아는 사이가 되면(주민마다 한 번)', def: 2000 },
  { key: 'affinity:close', group: '주민 호감도', label: '친한 사이가 되면(주민마다 한 번, 가구 하나와 함께)', def: 5000 },
  { key: 'affinity:closeErrand', group: '주민 호감도', label: '친한 주민 심부름 보상(%)', def: 110 },
  { key: 'affinity:bestieErrand', group: '주민 호감도', label: '단짝 주민 심부름 보상(%)', def: 120 },
  { key: 'taxi:fare', group: '섬 택시', label: '집 없는 사람의 택시 요금(한 번)', def: 1000 }, // (v1.10.271: a home owner rides free)
  { key: 'affinity:talkDaily', group: '주민 호감도', label: '대화 나무에서 오르는 호감도(주민마다 하루 최대)', def: 2 }, // (v1.10.266 총괄 검토: +1 a fitting reply, this many a day at most; the day's first talk +1 apart)
  // v1.10.278 주민 내기 (notes docs/resident-bets-design-20261025.md 「2026-11-08 갱신」): its 호감도 apart from the talks'; light stakes
  { key: 'affinity:betDaily', group: '주민 호감도', label: '내기로 오르는 호감도(주민마다 하루, 이기든 지든)', def: 1 },
  { key: 'bet:dailyWinMax', group: '주민 내기', label: '하루 딴 돈 최대(순이익, 모든 내기 합)', def: 30000 },
  { key: 'bet:scoreStakeMax', group: '주민 내기', label: '점수 내기 판돈 최대', def: 5000 },
  { key: 'bet:stakeMax', group: '주민 내기', label: '대국 내기 판돈 최대', def: 10000 },
  // 경제 점검 ⑥ (economy-audit-20261025, 사용자 2026-10-25): the deposit's tiers (‰ a day: 30 = 3%), the climbing prizes
  // (lowered), the attendance (lowered, and a 7-day streak's extra)
  { key: 'bank:tier1', group: '예금 이자', label: '첫 구간 끝(P)', def: 500000 },
  { key: 'bank:rate1', group: '예금 이자', label: '첫 구간 이자(‰/일)', def: 30 },
  { key: 'bank:tier2', group: '예금 이자', label: '둘째 구간 끝(P)', def: 5000000 },
  { key: 'bank:rate2', group: '예금 이자', label: '둘째 구간 이자(‰/일)', def: 15 },
  { key: 'bank:rate3', group: '예금 이자', label: '그 위 이자(‰/일)', def: 5 },
  { key: 'climb:week1', group: '등반 상', label: '주간 1위', def: 200000 },
  { key: 'climb:week2', group: '등반 상', label: '주간 2위', def: 150000 },
  { key: 'climb:week3', group: '등반 상', label: '주간 3위', def: 100000 },
  { key: 'climb:week4', group: '등반 상', label: '주간 4~20위', def: 30000 },
  { key: 'climb:dailyMax', group: '등반 상', label: '하루 최대(정상 3,000m)', def: 30000 },
  { key: 'attendance:daily', group: '출석', label: '하루 출석', def: 30000 },
  { key: 'attendance:streak7', group: '출석', label: '7일 연속 그날 더', def: 20000 },
  // E1 매주 대회 (사용자 2026-10-25 A안: 토 낚시·일 곤충, 트로피·칭호에 더해 포인트는 작게, 참가는 도장)
  { key: 'contest:1', group: '매주 대회 상', label: '그날 1등', def: 10000 },
  { key: 'contest:2', group: '매주 대회 상', label: '그날 2등', def: 6000 },
  { key: 'contest:3', group: '매주 대회 상', label: '그날 3등', def: 3000 },
].map((d) => Object.freeze({ ...d, ...range(d.def) })));
const BY_KEY = new Map(DEFS.map((d) => [d.key, d]));
let overrides = {};

const value = (key) => overrides[key] ?? BY_KEY.get(key)?.def ?? null;
const priceOf = (itemId) => overrides[`item:${itemId}`] ?? null; // (null: the item's own price)
function load(saved) { overrides = {}; for (const [k, v] of Object.entries(saved?.values || {})) if (BY_KEY.has(k) && valid(k, v)) overrides[k] = v; }
const valid = (key, v) => { const d = BY_KEY.get(key); return Boolean(d) && Number.isSafeInteger(v) && v >= d.min && v <= d.max; };
// a change: { key: number | null (back to the default) } -> the next saved document, or { error, key }
function change(saved, changes, by, at) {
  const values = { ...(saved?.values || {}) }; const history = [...(saved?.history || [])];
  const entries = Object.entries(changes || {});
  if (!entries.length || entries.length > DEFS.length) return { error: 'EMPTY' };
  for (const [key, v] of entries) {
    if (!BY_KEY.has(key)) return { error: 'UNKNOWN', key };
    if (v !== null && !valid(key, v)) return { error: 'RANGE', key };
  }
  for (const [key, v] of entries) {
    const before = values[key] ?? BY_KEY.get(key).def; const after = v ?? BY_KEY.get(key).def;
    if (before === after && (v === null) === !(key in values)) continue;
    if (v === null) delete values[key]; else values[key] = v;
    history.unshift({ at, by, key, label: `${BY_KEY.get(key).group} · ${BY_KEY.get(key).label}`, before, after });
  }
  return { saved: { values, history: history.slice(0, 200) } };
}
// what the administrator sees
const view = (saved) => ({ defs: DEFS.map((d) => ({ ...d, value: saved?.values?.[d.key] ?? d.def, changed: d.key in (saved?.values || {}) })), history: saved?.history || [] });

module.exports = { DEFS, value, priceOf, load, change, view, valid };
