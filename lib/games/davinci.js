'use strict';

const crypto = require('node:crypto');
const SEATS = ['1', '2', '3', '4'];
const TIMEOUT = 60_000;
const GUESS_FEEDBACK_DURATION = 900;
const shuffle = list => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};
const compare = (a, b) => a.number - b.number || (a.color === 'black' ? -1 : 1);
function deck() {
  const tiles = [];
  for (let number = 0; number <= 11; number++) for (const color of ['black', 'white']) {
    tiles.push({ id: crypto.randomUUID(), color, number, revealed: false });
  }
  return shuffle(tiles);
}

function create(options = {}) {
  return { status: 'selecting', round: options.round || 1, revision: options.revision || 0,
    seatOrder: [], hands: {}, pile: [], turn: null, phase: null, drawn: null,
    deadlineAt: null, winner: null, eliminationOrder: [], moveCount: 0, history: [], selection: null,
    lastGuess: null, guessFeedbackUntil: null };
}
function reset(game) { Object.assign(game, create({ round: game.round + 1, revision: game.revision + 1 })); }
function nextActive(game, current) {
  const index = game.seatOrder.indexOf(current);
  for (let i = 1; i <= game.seatOrder.length; i++) {
    const seat = game.seatOrder[(index + i) % game.seatOrder.length];
    if (game.hands[seat]?.some(tile => !tile.revealed)) return seat;
  }
  return null;
}
function insert(game, seat, tile, revealed) {
  tile.revealed = revealed;
  game.hands[seat].push(tile);
  game.hands[seat].sort(compare);
}
function beginTurn(game, seat, now) {
  game.turn = seat;
  game.phase = 'guess';
  game.drawn = game.pile.pop() || null;
  game.deadlineAt = now + TIMEOUT;
  game.selection = null;
}
function finishOrAdvance(game, now) {
  const active = game.seatOrder.filter(seat => game.hands[seat].some(tile => !tile.revealed));
  for (const seat of game.seatOrder) {
    if (!active.includes(seat) && !game.eliminationOrder.includes(seat)) game.eliminationOrder.push(seat);
  }
  if (active.length <= 1) {
    game.status = 'finished';
    game.winner = active;
    game.phase = null;
    game.drawn = null;
    game.deadlineAt = null;
    return;
  }
  beginTurn(game, nextActive(game, game.turn), now);
}
function start(game, seats, now = Date.now()) {
  if (game.status !== 'selecting') return { legal: false, reason: 'started' };
  if (!Array.isArray(seats) || seats.length < 2 || seats.length > 4 ||
    new Set(seats).size !== seats.length || seats.some(seat => !SEATS.includes(seat))) {
    return { legal: false, reason: 'players' };
  }
  game.seatOrder = [...seats];
  game.hands = Object.fromEntries(seats.map(seat => [seat, []]));
  game.pile = deck();
  const count = seats.length === 4 ? 3 : 4;
  for (let i = 0; i < count; i++) for (const seat of seats) insert(game, seat, game.pile.pop(), false);
  game.status = 'playing';
  game.revision++;
  beginTurn(game, seats[crypto.randomInt(seats.length)], now);
  return { legal: true };
}
function guard(game, seat, revision, phases) {
  if (game.status !== 'playing') return 'not-playing';
  if (game.turn !== seat) return 'turn';
  if (game.revision !== revision) return 'stale';
  if (!phases.includes(game.phase)) return 'phase';
  return null;
}
function fail(game, now) {
  game.selection = null;
  if (game.drawn) {
    insert(game, game.turn, game.drawn, true);
    game.drawn = null;
    game.revision++;
    game.moveCount++;
    finishOrAdvance(game, now);
  } else {
    game.phase = 'reveal-own';
    game.deadlineAt = now + TIMEOUT;
    game.revision++;
  }
}
function select(game, seat, target, id, revision) {
  const error = guard(game, seat, revision, ['guess', 'continue']);
  if (error) return { legal: false, reason: error };
  if (target === seat || !game.hands[target]?.some(tile => !tile.revealed)) return { legal: false, reason: 'target' };
  const tile = game.hands[target].find(item => item.id === id && !item.revealed);
  if (!tile) return { legal: false, reason: 'tile' };
  game.lastGuess = null;
  game.guessFeedbackUntil = null;
  game.selection = { seat, target, tileId: id };
  return { legal: true };
}
function guess(game, seat, target, id, number, revision, now = Date.now()) {
  const error = guard(game, seat, revision, ['guess', 'continue']);
  if (error) return { legal: false, reason: error };
  if (game.selection && (game.selection.seat !== seat || game.selection.target !== target || game.selection.tileId !== id)) {
    return { legal: false, reason: 'selection' };
  }
  if (target === seat || !game.hands[target]?.some(tile => !tile.revealed)) return { legal: false, reason: 'target' };
  const tile = game.hands[target].find(item => item.id === id && !item.revealed);
  if (!tile || !Number.isInteger(number) || number < 0 || number > 11) return { legal: false, reason: 'tile' };
  game.selection = null;
  const correct = tile.number === number;
  game.lastGuess = { seat, target, tileId: id, number, correct, submittedAt: now };
  game.guessFeedbackUntil = now + GUESS_FEEDBACK_DURATION;
  game.history.push({ seat, target, id, number, correct });
  if (game.history.length > 30) game.history.shift();
  if (correct) {
    tile.revealed = true;
    game.revision++;
    game.moveCount++;
    const active = game.seatOrder.filter(s => game.hands[s].some(t => !t.revealed));
    if (!active.includes(target) && !game.eliminationOrder.includes(target)) game.eliminationOrder.push(target);
    if (active.length === 1) {
      if (game.drawn) insert(game, seat, game.drawn, false);
      game.drawn = null;
      game.status = 'finished';
      game.winner = active;
      game.phase = null;
      game.deadlineAt = null;
    } else {
      game.phase = 'continue';
      game.deadlineAt = now + TIMEOUT;
    }
  } else fail(game, now);
  return { legal: true, correct };
}
function stop(game, seat, revision, now = Date.now()) {
  const error = guard(game, seat, revision, ['continue']);
  if (error) return { legal: false, reason: error };
  game.selection = null;
  if (game.drawn) { insert(game, seat, game.drawn, false); game.drawn = null; }
  game.revision++;
  game.moveCount++;
  finishOrAdvance(game, now);
  return { legal: true };
}
function reveal(game, seat, id, revision, now = Date.now()) {
  const error = guard(game, seat, revision, ['reveal-own']);
  if (error) return { legal: false, reason: error };
  const tile = game.hands[seat].find(item => item.id === id && !item.revealed);
  if (!tile) return { legal: false, reason: 'tile' };
  game.selection = null;
  tile.revealed = true;
  game.revision++;
  game.moveCount++;
  finishOrAdvance(game, now);
  return { legal: true };
}
function tick(game, now = Date.now()) {
  if (game.status !== 'playing' || !game.deadlineAt || now < game.deadlineAt) return false;
  if (game.phase === 'reveal-own') {
    const hidden = game.hands[game.turn].filter(tile => !tile.revealed);
    reveal(game, game.turn, hidden[crypto.randomInt(hidden.length)].id, game.revision, now);
  } else fail(game, now);
  return true;
}
function expireFeedback(game, now = Date.now()) {
  if (!game.lastGuess || !game.guessFeedbackUntil || now < game.guessFeedbackUntil) return false;
  game.lastGuess = null;
  game.guessFeedbackUntil = null;
  return true;
}
const tilesFor = (game, seat) => seat && game.hands[seat]?.map(({ id, color, number, revealed }) => ({ id, color, number, revealed })) || null;
const drawnFor = (game, seat) => seat === game.turn && game.drawn ? { ...game.drawn } : null;
function publicState(game) {
  const { hands, pile, drawn, guessFeedbackUntil, ...rest } = game;
  return { ...rest, pileCount: pile.length, drawn: drawn ? { color: drawn.color } : null,
    hands: Object.fromEntries(Object.entries(hands).map(([seat, tiles]) => [seat,
      tiles.map(({ id, color, number, revealed }) => ({ id, color, revealed, ...(revealed ? { number } : {}) }))])) };
}
const moveError = reason => ({ started: '이미 시작했습니다.', players: '2~4명이 필요합니다.', turn: '차례가 아닙니다.', stale: '화면이 갱신됐습니다.', phase: '현재 단계에서 할 수 없습니다.', target: '유효한 상대를 골라 주세요.', tile: '유효한 타일과 숫자를 골라 주세요.', selection: '화면의 추리 대상이 바뀌었습니다. 다시 타일을 선택해 주세요.' })[reason] || '행동할 수 없습니다.';
module.exports = { id: 'davinci', name: '다빈치 코드', size: 4, rules: '흑·백 타일의 숨겨진 숫자를 추리해 마지막까지 살아남으세요.', create, reset, start, select, guess, stop, reveal, tick, expireFeedback, publicState, tilesFor, drawnFor, moveError };
