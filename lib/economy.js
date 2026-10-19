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
  { key: 'errand:buy', group: '주민 심부름 보상', label: '사다 주기(물건값에 더함)', def: 1500 }, // v1.10.92
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
