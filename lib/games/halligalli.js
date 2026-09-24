'use strict';

const crypto = require('node:crypto');
const SEATS = ['1', '2', '3', '4', '5', '6'];
const FRUITS = ['딸기', '바나나', '라임', '자두'];
const COUNTS = [5, 3, 3, 2, 1];
const shuffle = cards => {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
};
function deck() {
  const cards = [];
  for (const fruit of FRUITS) for (let count = 1; count <= 5; count++) {
    for (let n = 0; n < COUNTS[count - 1]; n++) cards.push({ fruit, count });
  }
  return shuffle(cards);
}
function create(options = {}) {
  return { status: 'selecting', round: options.round || 1, durationMinutes: options.durationMinutes || 5,
    revision: options.revision || 0, seatOrder: [], piles: {}, faces: {}, eliminated: [], turn: null,
    winner: null, flipId: 0, bellLog: [], bellSettledFlip: null, ringSeats: [],
    lockUntil: null, deadlineAt: null, endsAt: null, moveCount: 0, lastBell: null, disconnectSince: {} };
}
function reset(game) { Object.assign(game, create({ round: game.round + 1, revision: game.revision + 1, durationMinutes: game.durationMinutes })); }
function setTime(game, minutes) {
  if (game.status !== 'selecting' || ![5, 10].includes(minutes)) return { legal: false, reason: 'time' };
  game.durationMinutes = minutes;
  return { legal: true };
}
function active(game) { return game.seatOrder.filter(seat => !game.eliminated.includes(seat)); }
function finish(game, winners, reason) {
  game.status = 'finished';
  game.winner = winners;
  game.endReason = reason;
  game.deadlineAt = null;
  game.revision++;
}
function nextTurn(game, previous, now) {
  if (active(game).length <= 1) { finish(game, active(game), 'last-survivor'); return; }
  const start = game.seatOrder.indexOf(previous);
  for (let i = 1; i <= game.seatOrder.length; i++) {
    const seat = game.seatOrder[(start + i) % game.seatOrder.length];
    if (game.eliminated.includes(seat)) continue;
    if (!game.piles[seat].length) {
      game.eliminated.push(seat);
      game.bellLog.push({ type: 'eliminated', seat });
      continue;
    }
    if (active(game).length <= 1) { finish(game, active(game), 'last-survivor'); return; }
    game.turn = seat;
    game.deadlineAt = now + 3000;
    return;
  }
  finish(game, active(game), 'last-survivor');
}
function start(game, seats, now = Date.now()) {
  if (game.status !== 'selecting') return { legal: false, reason: 'started' };
  if (!Array.isArray(seats) || seats.length < 2 || seats.length > 6 ||
    new Set(seats).size !== seats.length || seats.some(seat => !SEATS.includes(seat))) return { legal: false, reason: 'players' };
  const cards = deck();
  const count = Math.floor(cards.length / seats.length);
  game.seatOrder = [...seats];
  game.piles = Object.fromEntries(seats.map((seat, i) => [seat, cards.slice(i * count, (i + 1) * count)]));
  game.faces = Object.fromEntries(seats.map(seat => [seat, []]));
  game.turn = seats[crypto.randomInt(seats.length)];
  game.deadlineAt = now + 3000;
  game.endsAt = now + game.durationMinutes * 60_000;
  game.status = 'playing';
  game.revision++;
  return { legal: true };
}
function flip(game, seat, now = Date.now(), expectedRevision = game.revision) {
  if (game.status === 'playing' && now >= game.endsAt) return { legal: false, reason: 'status' };
  if (game.status !== 'playing') return { legal: false, reason: 'status' };
  if (seat !== game.turn) return { legal: false, reason: 'turn' };
  if (expectedRevision !== game.revision) return { legal: false, reason: 'stale' };
  if (!game.piles[seat].length) {
    game.eliminated.push(seat);
    nextTurn(game, seat, now);
    game.revision++;
    return { legal: true, eliminated: true };
  }
  const card = game.piles[seat].shift();
  game.faces[seat].push(card);
  game.flipId++;
  game.lockUntil = now + 300;
  game.bellSettledFlip = null;
  game.ringSeats = [];
  game.moveCount++;
  game.revision++;
  nextTurn(game, seat, now);
  return { legal: true, card };
}
function exactFive(game) {
  const totals = Object.fromEntries(FRUITS.map(fruit => [fruit, 0]));
  for (const stack of Object.values(game.faces)) {
    const top = stack.at(-1);
    if (top) totals[top.fruit] += top.count;
  }
  return Object.values(totals).some(total => total === 5);
}
function ring(game, seat, expectedFlipId, now = Date.now()) {
  if (game.status === 'playing' && now >= game.endsAt) return { legal: false, reason: 'status' };
  if (game.status !== 'playing' || game.eliminated.includes(seat) || !game.seatOrder.includes(seat)) return { legal: false, reason: 'status' };
  if (expectedFlipId !== game.flipId) return { legal: false, reason: 'stale' };
  if (!game.flipId || now < game.lockUntil) return { legal: true, ignored: 'locked' };
  if (game.bellSettledFlip === game.flipId || game.ringSeats.includes(seat)) {
    game.bellLog.push({ type: 'late', seat, flipId: game.flipId });
    return { legal: true, ignored: 'late' };
  }
  game.ringSeats.push(seat);
  const correct = exactFive(game);
  const transfers = [];
  if (correct) {
    for (const [from, stack] of Object.entries(game.faces)) {
      if (stack.length) transfers.push({ from, to: seat, count: stack.length, top: { ...stack.at(-1) } });
      game.piles[seat].push(...stack);
      stack.length = 0;
    }
    game.bellSettledFlip = game.flipId;
  } else {
    for (const target of active(game)) {
      if (target === seat || !game.piles[seat].length) continue;
      game.piles[target].push(game.piles[seat].shift());
      transfers.push({ from: seat, to: target, count: 1 });
    }
  }
  // Public movement counts only. Never include identities of cards from a hidden pile.
  game.lastBell = { seat, correct, flipId: game.flipId, transfers,
    totalTransferred: transfers.reduce((total, transfer) => total + transfer.count, 0) };
  game.bellLog.push({ type: 'ring', ...game.lastBell });
  if (game.bellLog.length > 30) game.bellLog.splice(0, game.bellLog.length - 30);
  game.revision++;
  return { legal: true, correct };
}
function disconnect(game, seat, since) {
  if (game.status === 'playing' && active(game).includes(seat) && !game.disconnectSince[seat]) game.disconnectSince[seat] = since;
}
function reconnect(game, seat) { delete game.disconnectSince[seat]; }
function tick(game, now = Date.now()) {
  if (game.status !== 'playing') return false;
  if (now >= game.endsAt) {
    const highest = Math.max(...active(game).map(seat => game.piles[seat].length));
    finish(game, active(game).filter(seat => game.piles[seat].length === highest), 'time');
    return true;
  }
  let changed = false;
  for (const [seat, since] of Object.entries(game.disconnectSince)) {
    if (now - since < 60_000 || game.eliminated.includes(seat)) continue;
    game.eliminated.push(seat);
    game.bellLog.push({ type: 'disconnected', seat });
    delete game.disconnectSince[seat];
    game.revision++;
    changed = true;
    if (active(game).length <= 1) { finish(game, active(game), 'last-survivor'); return true; }
    if (game.turn === seat) nextTurn(game, seat, now);
  }
  if (game.status === 'playing' && now >= game.deadlineAt) {
    flip(game, game.turn, now);
    changed = true;
  }
  return changed;
}
function publicState(game) {
  const { piles, faces, ...rest } = game;
  return { ...rest,
    pileCounts: Object.fromEntries(Object.entries(piles).map(([seat, cards]) => [seat, cards.length])),
    faceTops: Object.fromEntries(Object.entries(faces).map(([seat, cards]) => [seat, cards.at(-1) || null])),
    faceCounts: Object.fromEntries(Object.entries(faces).map(([seat, cards]) => [seat, cards.length])) };
}
const moveError = reason => ({ started: '이미 시작했습니다.', players: '2~6명이 필요합니다.', time: '5분 또는 10분을 선택하세요.', status: '진행할 수 없습니다.', turn: '자기 차례가 아닙니다.', stale: '화면이 갱신됐습니다.' })[reason] || '진행할 수 없습니다.';
module.exports = { id: 'halligalli', name: '할리갈리', size: 6, rules: '공개된 과일 합이 정확히 5개이면 가장 먼저 종을 치세요.', create, reset, setTime, start, flip, ring, tick, disconnect, reconnect, exactFive, deck, publicState, moveError };
