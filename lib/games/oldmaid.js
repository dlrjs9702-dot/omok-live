'use strict';

const crypto = require('node:crypto');
const SEATS = ['1', '2', '3', '4', '5', '6'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];

function deck() {
  return [...SUITS.flatMap(suit => RANKS.map(rank => ({ id: `${suit}-${rank}`, suit, rank }))),
    { id: 'joker', suit: '', rank: 'JOKER' }];
}
function shuffle(cards) {
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
function removePairs(cards) {
  const groups = new Map();
  for (const card of cards) {
    if (!groups.has(card.rank)) groups.set(card.rank, []);
    groups.get(card.rank).push(card);
  }
  const remaining = new Set();
  let pairs = 0;
  for (const [rank, group] of groups) {
    if (rank === 'JOKER') { for (const card of group) remaining.add(card.id); continue; }
    pairs += Math.floor(group.length / 2);
    if (group.length % 2) remaining.add(group[group.length - 1].id);
  }
  const kept = cards.filter(card => remaining.has(card.id));
  cards.splice(0, cards.length, ...kept);
  return pairs;
}
function create(options = {}) {
  return { status: 'selecting', round: Number(options.round || 1), seatOrder: [], hands: {},
    turn: null, target: null, revision: 0, moveCount: 0, loser: null, winner: null,
    history: [], discardedPairs: 0 };
}
function reset(game) {
  const revision = game.revision + 1;
  Object.assign(game, create({ round: (game.round || 1) + 1 }));
  game.revision = revision;
}
function nextActive(game, seat) {
  const index = game.seatOrder.indexOf(seat);
  if (index < 0) return null;
  for (let step = 1; step < game.seatOrder.length; step += 1) {
    const candidate = game.seatOrder[(index + step) % game.seatOrder.length];
    if (game.hands[candidate]?.length) return candidate;
  }
  return null;
}
function finishIfReady(game) {
  const active = game.seatOrder.filter(seat => game.hands[seat]?.length);
  if (active.length !== 1) return false;
  const loser = active[0];
  // With all ordinary pairs discarded, the final survivor must hold the joker alone.
  if (game.hands[loser].length !== 1 || game.hands[loser][0].rank !== 'JOKER') return false;
  game.status = 'finished';
  game.loser = loser;
  game.winner = game.seatOrder.filter(seat => seat !== loser);
  game.turn = null;
  game.target = null;
  return true;
}
function start(game, seats) {
  if (game.status !== 'selecting') return { legal: false, reason: 'already-started' };
  if (!Array.isArray(seats) || seats.length < 2 || seats.length > 6 ||
      new Set(seats).size !== seats.length || seats.some(s => !SEATS.includes(s))) {
    return { legal: false, reason: 'player-count' };
  }
  const cards = shuffle(deck());
  const hands = Object.fromEntries(seats.map(seat => [seat, []]));
  cards.forEach((card, i) => hands[seats[i % seats.length]].push(card));
  game.discardedPairs = 0;
  for (const seat of seats) {
    game.discardedPairs += removePairs(hands[seat]);
    shuffle(hands[seat]);
  }
  game.seatOrder = [...seats];
  game.hands = hands;
  game.status = 'playing';
  game.turn = seats[crypto.randomInt(seats.length)];
  game.revision += 1;
  game.moveCount = 0;
  game.history = [];
  game.loser = null;
  game.winner = null;
  if (!hands[game.turn].length) game.turn = seats.find(seat => hands[seat].length);
  finishIfReady(game);
  if (game.status === 'playing') game.target = nextActive(game, game.turn);
  return { legal: true };
}
function checkVersion(game, expectedRevision) {
  return Number.isInteger(expectedRevision) && expectedRevision === game.revision;
}
function shuffleHand(game, seat, expectedRevision) {
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (!game.seatOrder.includes(seat)) return { legal: false, reason: 'not-player' };
  if (!checkVersion(game, expectedRevision)) return { legal: false, reason: 'stale' };
  const hand = game.hands[seat];
  if (!hand.length) return { legal: false, reason: 'empty-hand' };
  const before = hand.map(card => card.id).join(',');
  shuffle(hand);
  if (hand.length > 1 && hand.map(card => card.id).join(',') === before) hand.push(hand.shift());
  game.revision += 1;
  return { legal: true };
}
function draw(game, seat, target, index, expectedRevision) {
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (!game.seatOrder.includes(seat)) return { legal: false, reason: 'not-player' };
  if (seat !== game.turn) return { legal: false, reason: 'not-turn' };
  if (!checkVersion(game, expectedRevision)) return { legal: false, reason: 'stale' };
  if (target !== game.target || target === seat || !game.hands[target]?.length) return { legal: false, reason: 'bad-target' };
  if (!Number.isInteger(index) || index < 0 || index >= game.hands[target].length) return { legal: false, reason: 'bad-index' };
  const [card] = game.hands[target].splice(index, 1);
  game.hands[seat].push(card);
  const pairs = removePairs(game.hands[seat]);
  game.discardedPairs += pairs;
  game.moveCount += 1;
  game.revision += 1;
  const emptied = game.seatOrder.filter(s => game.hands[s].length === 0);
  game.history.push({ actor: seat, target, pairs, emptied: game.hands[target].length === 0 ? target : null });
  if (game.history.length > 30) game.history.shift();
  const finished = finishIfReady(game);
  if (!finished) {
    game.turn = nextActive(game, seat);
    game.target = nextActive(game, game.turn);
  }
  return { legal: true, pairs, emptied, finished };
}
function publicState(game) {
  return { status: game.status, round: game.round, seatOrder: [...game.seatOrder],
    counts: Object.fromEntries(game.seatOrder.map(seat => [seat, game.hands[seat].length])),
    turn: game.turn, target: game.target, revision: game.revision,
    moveCount: game.moveCount, loser: game.loser, winner: game.winner,
    discardedPairs: game.discardedPairs, history: game.history.map(item => ({ ...item })) };
}
function handFor(game, seat) {
  return game.seatOrder.includes(seat) ? game.hands[seat].map(card => ({ ...card })) : null;
}
function moveError(reason) {
  return ({ 'already-started': '이미 시작했습니다.', 'player-count': '2~6명이 자리를 선택해야 합니다.',
    'not-playing': '진행 중인 게임이 아닙니다.', 'not-player': '관전자는 조작할 수 없습니다.',
    'not-turn': '현재 차례가 아닙니다.', stale: '카드 순서가 바뀌었습니다. 다시 선택해 주세요.',
    'bad-target': '현재 뽑을 상대의 카드만 선택할 수 있습니다.',
    'bad-index': '선택한 카드 위치가 올바르지 않습니다.', 'empty-hand': '카드가 없습니다.' })[reason] || '카드 조작을 할 수 없습니다.';
}
module.exports = { id: 'oldmaid', name: '도둑잡기', size: 0,
  rules: '2~6명이 53장(조커 1장 포함)을 나누고 같은 계급의 카드 두 장씩 자동으로 버립니다. 내 차례에는 다음 활성 참가자의 뒷면 카드 한 장을 골라 뽑습니다. 카드 섞기로 내 손패 순서를 바꿀 수 있습니다. 짝을 버려 손패를 모두 없애면 승리하며 마지막 조커 보유자가 패배합니다.',
  create, reset, start, draw, shuffleHand, publicState, handFor, removePairs, deck, nextActive, moveError };
