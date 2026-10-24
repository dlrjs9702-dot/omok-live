'use strict';

// v1.10.91 경제 값 관리 (IDEAS #future-admin-console ②, 사용자 2026-10-18 「경제 수치 열 수 있게」): the values the
// administrator may change without a deploy -- what the island pays for things, the solo games' rewards, the islanders'
// errands. Each has its code default and a range; a change is kept on the server (worldValue 'economy') with who/when/
// before, and can be put back. Everything else stays in code (the ledger, the bank, the tax, quest steps).
// ponytail: module-level overrides, one server process; reloaded from the store at start and on each change
const Items = require('./island-items');
const Minesweeper = require('./minesweeper');

const LIFE = ['weed', 'trash', 'herb', 'berry', 'mushroom', 'harvest', 'candy'];
const range = (def) => ({ min: 1, max: Math.max(10, def * 10) });
const DEFS = Object.freeze([
  ...LIFE.map((id) => ({ key: `item:${id}`, group: '생활 자원 판매가', label: Items.ITEMS[id].name, def: Items.ITEMS[id].price })),
  ...Object.keys(Items.ITEMS).filter((id) => id.startsWith('fish_')).map((id) => ({ key: `item:${id}`, group: '물고기 판매가', label: Items.ITEMS[id].name, def: Items.ITEMS[id].price })),
  ...Object.entries(Minesweeper.LEVELS).map(([id, l]) => ({ key: `solo:minesweeper:${id}`, group: '지뢰찾기 보상', label: l.label, def: l.points })),
  ...Items.GOODS.map((id) => ({ key: `good:${id}`, group: '잡화점 가격', label: Items.ITEMS[id].name, def: Items.ITEMS[id].buy })), // v1.10.92
  { key: 'errand:find', group: '주민 심부름 보상', label: '사람 찾기', def: 2000 },
  { key: 'errand:deliver', group: '주민 심부름 보상', label: '물건 전하기', def: 1500 },
  { key: 'errand:far', group: '주민 심부름 보상', label: '먼 주민 거리 한 단계마다 더함(최대 2단계)', def: 500 }, // (묶음 1 멀리 심부름)
  { key: 'errand:buy', group: '주민 심부름 보상', label: '사다 주기(물건값에 더함)', def: 1500 }, // v1.10.92
  // 묶음 2 가구점 (docs/furniture-shop-20261019.md): by rarity, the always-on-sale ones, and how many a day one person buys
  // 묶음 4 내 집 (docs/my-home-20261020.md): the house (about five days of a player's earnings), a floor, wallpaper or roof changed
  // 묶음 4-2: the 오두막 first (about two days' earnings), made a 작은 집 later (about five)
  { key: 'home:price_1', group: '내 집', label: '오두막 값(한 번에)', def: 20000 },
  { key: 'home:price_2', group: '내 집', label: '집 넓히기(작은 집)', def: 50000 },
  { key: 'home:price_3', group: '내 집', label: '집 넓히기(큰 집)', def: 100000 }, // (묶음 4-2 3단계: 약 10일치 벌이)
  { key: 'home:style', group: '내 집', label: '바닥·벽지·지붕 바꾸기', def: 1000 },
  { key: 'furniture:common', group: '가구점', label: '흔함 가구', def: 3000 },
  { key: 'furniture:uncommon', group: '가구점', label: '보통 가구', def: 6000 },
  { key: 'furniture:rare', group: '가구점', label: '드묾 가구', def: 15000 },
  { key: 'furniture:base', group: '가구점', label: '늘 파는 가구', def: 1000 },
  { key: 'furniture:perDay', group: '가구점', label: '한 사람 하루 구매 수(전시품)', def: 3 },
  { key: 'gift:skinPerDay', group: '선물', label: '스킨 선물 하루 횟수(보내는 사람)', def: 5 }, // 3-1 스킨 선물 (사용자 2026-10-19)
  // 문제 기록 3회차 21 (사용자 결정 10/22 「기존 펫 가격대」): the counter's pets -- a transformation small, 메타몽
  { key: 'pet:transform_animal', group: '펫샵', label: '변신 펫(동물)', def: 8000 },
  { key: 'pet:transform_ip', group: '펫샵', label: '변신 펫(캐릭터)', def: 12000 },
  { key: 'pet:ditto', group: '펫샵', label: '메타몽', def: 12000 },
  // R2 호감도 = 보상 (사용자 2026-10-22): a level reached, once per islander; a friendly asker's errand pays a little more
  { key: 'affinity:known', group: '주민 호감도', label: '아는 사이가 되면(주민마다 한 번)', def: 2000 },
  { key: 'affinity:close', group: '주민 호감도', label: '친한 사이가 되면(주민마다 한 번, 가구 하나와 함께)', def: 5000 },
  { key: 'affinity:closeErrand', group: '주민 호감도', label: '친한 주민 심부름 보상(%)', def: 110 },
  { key: 'affinity:bestieErrand', group: '주민 호감도', label: '단짝 주민 심부름 보상(%)', def: 120 },
  // R7 하늘 계단 (사용자 2026-10-25): a round of 30 steps and more, by level (the 순발력 day's cap shared)
  { key: 'solo:stairs:easy', group: '하늘 계단 보상', label: '쉬움(30계단부터)', def: 1500 },
  { key: 'solo:stairs:normal', group: '하늘 계단 보상', label: '보통(30계단부터)', def: 2500 },
  { key: 'solo:stairs:hard', group: '하늘 계단 보상', label: '어려움(30계단부터)', def: 4000 },
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
