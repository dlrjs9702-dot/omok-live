'use strict';

// Hwatu deck for Go-Stop / Matgo: 48 month cards plus the two 대박맞고 bonus cards (one 쌍피, one
// 쓰리피) -- 50 in total. Each card: id, month (1-12, 0 for bonus), kind ('gwang' | 'animal' |
// 'ribbon' | 'pi'), piValue for pi cards, and flags for the scoring sets.

const MONTH_NAMES = ['', '송학', '매조', '벚꽃', '흑싸리', '난초', '모란', '홍싸리', '공산', '국진', '단풍', '오동', '비'];

function card(id, month, kind, extra = {}) {
  return Object.freeze({ id, month, kind, piValue: kind === 'pi' ? (extra.piValue || 1) : 0, ...extra });
}

const CARDS = Object.freeze([
  card('m01-gwang', 1, 'gwang'), card('m01-ribbon', 1, 'ribbon', { dan: 'hong' }), card('m01-pi1', 1, 'pi'), card('m01-pi2', 1, 'pi'),
  card('m02-animal', 2, 'animal', { godori: true }), card('m02-ribbon', 2, 'ribbon', { dan: 'hong' }), card('m02-pi1', 2, 'pi'), card('m02-pi2', 2, 'pi'),
  card('m03-gwang', 3, 'gwang'), card('m03-ribbon', 3, 'ribbon', { dan: 'hong' }), card('m03-pi1', 3, 'pi'), card('m03-pi2', 3, 'pi'),
  card('m04-animal', 4, 'animal', { godori: true }), card('m04-ribbon', 4, 'ribbon', { dan: 'cho' }), card('m04-pi1', 4, 'pi'), card('m04-pi2', 4, 'pi'),
  card('m05-animal', 5, 'animal'), card('m05-ribbon', 5, 'ribbon', { dan: 'cho' }), card('m05-pi1', 5, 'pi'), card('m05-pi2', 5, 'pi'),
  card('m06-animal', 6, 'animal'), card('m06-ribbon', 6, 'ribbon', { dan: 'cheong' }), card('m06-pi1', 6, 'pi'), card('m06-pi2', 6, 'pi'),
  card('m07-animal', 7, 'animal'), card('m07-ribbon', 7, 'ribbon', { dan: 'cho' }), card('m07-pi1', 7, 'pi'), card('m07-pi2', 7, 'pi'),
  card('m08-gwang', 8, 'gwang'), card('m08-animal', 8, 'animal', { godori: true }), card('m08-pi1', 8, 'pi'), card('m08-pi2', 8, 'pi'),
  // 9월 국진: counted as 열끗 or as 쌍피, chosen by its owner (never both at once).
  card('m09-animal', 9, 'animal', { gukjin: true }), card('m09-ribbon', 9, 'ribbon', { dan: 'cheong' }), card('m09-pi1', 9, 'pi'), card('m09-pi2', 9, 'pi'),
  card('m10-animal', 10, 'animal'), card('m10-ribbon', 10, 'ribbon', { dan: 'cheong' }), card('m10-pi1', 10, 'pi'), card('m10-pi2', 10, 'pi'),
  card('m11-gwang', 11, 'gwang'), card('m11-ssangpi', 11, 'pi', { piValue: 2 }), card('m11-pi1', 11, 'pi'), card('m11-pi2', 11, 'pi'),
  card('m12-gwang', 12, 'gwang', { rain: true }), card('m12-animal', 12, 'animal'), card('m12-ribbon', 12, 'ribbon'), card('m12-ssangpi', 12, 'pi', { piValue: 2 }),
  card('bonus-2', 0, 'pi', { piValue: 2, bonus: true }), card('bonus-3', 0, 'pi', { piValue: 3, bonus: true }),
]);

const BY_ID = new Map(CARDS.map(item => [item.id, item]));

function getCard(id) {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown card ${id}`);
  return found;
}

function isBonus(id) { return Boolean(BY_ID.get(id)?.bonus); }
function monthOf(id) { return getCard(id).month; }

// Unbiased shuffle with a pluggable random source (tests inject a seeded one).
function shuffled(random = Math.random) {
  const deck = CARDS.map(item => item.id);
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Value of a captured card when a pi is taken by (or given to) an opponent -- lowest first.
function piWorth(id, gukjinAsPi = false) {
  const item = getCard(id);
  if (item.gukjin) return gukjinAsPi ? 2 : 0;
  return item.kind === 'pi' ? item.piValue : 0;
}

module.exports = { CARDS, MONTH_NAMES, getCard, isBonus, monthOf, shuffled, piWorth };
