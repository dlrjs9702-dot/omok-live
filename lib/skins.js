'use strict';

// v1.7.30 cosmetic skins: a points sink that never changes a game's rules or what its board says. This file is the
// catalog (ids, tiers, prices, names) and the small rules around it; how a skin looks lives in public/skin-looks.js.
// A skin is bought once per account with points (ledger reason `skin_purchase`, never refunded, traded or gifted),
// equipped per game and slot, and shown identically to everyone in the room (the server shares each player's
// equipped `skin` and the host's room `theme` in the public room state; clients only draw them).
//
// Confirmed catalog (IDEAS.md): per official game 5 common (500,000P) + 3 premium (1,000,000P) + 2 room themes
// (1,500,000P) + 1 legend (3,000,000P). Only games whose skins are drawn are listed in SKINS; others are added as
// their art lands. Slots: `piece` (common / premium / legend, one per game) and `theme` (room theme, one per game,
// applied from the host's equipped one). A legend takes the `piece` slot and does not include a theme.

const TIERS = Object.freeze({
  common: Object.freeze({ label: '일반', price: 500_000, slot: 'piece' }),
  premium: Object.freeze({ label: '고급', price: 1_000_000, slot: 'piece' }),
  theme: Object.freeze({ label: '방 테마', price: 1_500_000, slot: 'theme' }),
  legend: Object.freeze({ label: '전설', price: 3_000_000, slot: 'piece' }),
});
const SLOTS = Object.freeze(['piece', 'theme']);

// Skins belong to a game family: 오목 2vs2 shares the 오목 skins.
const FAMILY_OF_GAME = Object.freeze({ omok: 'omok', omok2v2: 'omok' });
const FAMILY_NAMES = Object.freeze({ omok: '오목' });

const DEFINITIONS = [
  { id: 'omok_common_obsidian', family: 'omok', tier: 'common', name: '흑요석과 진주' },
  { id: 'omok_common_jade', family: 'omok', tier: 'common', name: '비취와 백옥' },
  { id: 'omok_common_amber', family: 'omok', tier: 'common', name: '호박과 수정' },
  { id: 'omok_common_porcelain', family: 'omok', tier: 'common', name: '청화 자기' },
  { id: 'omok_common_bronze', family: 'omok', tier: 'common', name: '청동과 은' },
];

const SKINS = Object.freeze(DEFINITIONS.map((def) => {
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

module.exports = { TIERS, SLOTS, SKINS, FAMILY_NAMES, skinById, familyOf, catalogView };
