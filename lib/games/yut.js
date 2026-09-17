'use strict';

const crypto = require('crypto');

const RESULTS = {
  1: { name: '도', steps: 1 },
  2: { name: '개', steps: 2 },
  3: { name: '걸', steps: 3 },
  4: { name: '윷', steps: 4 },
  5: { name: '모', steps: 5 },
};

const metadata = {
  id: 'yut',
  name: '윷놀이',
  size: 0,
  rules: '2인 윷놀이. 각자 말 4개를 모두 먼저 완주하면 승리합니다. 도·개·걸·윷·모만큼 이동하며 윷·모가 나오거나 상대 말을 잡으면 한 번 더 던집니다. 같은 편 말이 한 칸에 만나면 업어서 함께 움직입니다. 모서리에 정확히 멈춘 말은 다음 이동부터 지름길을 이용하며, 선택한 대각선 경로는 중앙을 지나 외곽에 다시 합류할 때까지 유지됩니다.',
};

const ROUTES = Object.freeze({
  outer: Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 'finished']),
  shortcut5: Object.freeze([5, 21, 22, 23, 24, 25, 15, 16, 17, 18, 19, 'finished']),
  shortcut10: Object.freeze([10, 26, 27, 23, 28, 29, 'finished']),
});

function freshPieces(color) {
  return Array.from({ length: 4 }, (_, index) => ({ id: `${color}-${index + 1}`, color, status: 'home', position: null, route: 'outer' }));
}

function create() {
  return {
    status: 'selecting', turn: 'black', winner: null, winningLine: null,
    round: 1, phase: 'throw', pendingSteps: null, lastThrow: null,
    pieces: { black: freshPieces('black'), white: freshPieces('white') },
    moves: [], throws: [],
  };
}

function start(game) {
  game.status = 'playing';
  game.turn = 'black';
  game.phase = 'throw';
}

function reset(game) {
  const round = Number(game.round || 1) + 1;
  Object.assign(game, create(), { round });
}

function routePath(route) {
  return ROUTES[route] || ROUTES.outer;
}

function routeForDeparture(piece) {
  const current = piece.route || 'outer';
  if (current !== 'outer') return current;
  if (piece.position === 5) return 'shortcut5';
  if (piece.position === 10) return 'shortcut10';
  return 'outer';
}

function destination(piece, steps) {
  if (!piece || piece.status === 'finished' || !Number.isInteger(steps) || steps < 1 || steps > 5) return null;
  if (piece.status === 'home') return { status: 'board', position: steps, route: 'outer' };

  const route = routeForDeparture(piece);
  const path = routePath(route);
  const at = path.indexOf(piece.position);
  if (at < 0) return null;

  let cursor = at;
  for (let remaining = steps; remaining > 0; remaining -= 1) {
    cursor = Math.min(cursor + 1, path.length - 1);
  }
  const next = path[cursor];
  return next === 'finished'
    ? { status: 'finished', position: null, route }
    : { status: 'board', position: next, route };
}

function groupFor(game, color, piece) {
  if (piece.status !== 'board') return [piece];
  return game.pieces[color].filter(other => other.status === 'board' && other.position === piece.position);
}

function legalMoves(game, color = game.turn) {
  if (game.status !== 'playing' || game.phase !== 'move' || color !== game.turn || !game.pendingSteps) return [];
  const seen = new Set();
  const moves = [];
  for (const piece of game.pieces[color]) {
    const group = groupFor(game, color, piece);
    const key = piece.status === 'home' ? piece.id : group.map(item => item.id).sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    const target = destination(piece, game.pendingSteps);
    if (target) moves.push({ pieceId: piece.id, carried: group.map(item => item.id), destination: target });
  }
  return moves;
}

function randomBackCount() {
  let backs = 0;
  for (let i = 0; i < 4; i += 1) backs += crypto.randomInt(0, 2);
  return backs;
}

function throwYut(game, color, at, backCount = randomBackCount()) {
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (color !== game.turn) return { legal: false, reason: 'not-your-turn' };
  if (game.phase !== 'throw') return { legal: false, reason: 'must-move' };
  if (!Number.isInteger(backCount) || backCount < 0 || backCount > 4) return { legal: false, reason: 'bad-throw' };
  const steps = backCount === 0 ? 5 : backCount;
  const result = { ...RESULTS[steps], backs: backCount, color, at };
  game.lastThrow = result;
  game.pendingSteps = steps;
  game.phase = 'move';
  game.throws.push(result);
  return { legal: true, ...result };
}

function applyMove(game, pieceId, color, at) {
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (color !== game.turn) return { legal: false, reason: 'not-your-turn' };
  if (game.phase !== 'move' || !game.pendingSteps) return { legal: false, reason: 'must-throw' };
  const option = legalMoves(game, color).find(move => move.pieceId === pieceId || move.carried.includes(pieceId));
  if (!option) return { legal: false, reason: 'bad-piece' };
  const moving = game.pieces[color].filter(piece => option.carried.includes(piece.id));
  for (const piece of moving) Object.assign(piece, option.destination);

  if (option.destination.status === 'board') {
    for (const piece of game.pieces[color]) {
      if (piece.status === 'board' && piece.position === option.destination.position) piece.route = option.destination.route;
    }
  }

  const other = color === 'black' ? 'white' : 'black';
  const captured = [];
  if (option.destination.status === 'board') {
    for (const piece of game.pieces[other]) {
      if (piece.status === 'board' && piece.position === option.destination.position) {
        captured.push(piece.id);
        Object.assign(piece, { status: 'home', position: null, route: 'outer' });
      }
    }
  }

  const steps = game.pendingSteps;
  const bonus = steps >= 4 || captured.length > 0;
  const record = { color, pieceIds: moving.map(piece => piece.id), steps, destination: option.destination, captured, bonus, at };
  game.moves.push(record);
  game.pendingSteps = null;

  if (game.pieces[color].every(piece => piece.status === 'finished')) {
    game.status = 'finished';
    game.winner = color;
    game.turn = null;
    game.phase = 'finished';
  } else if (bonus) {
    game.phase = 'throw';
  } else {
    game.turn = other;
    game.phase = 'throw';
  }
  return { legal: true, captured, bonus, finished: game.status === 'finished' };
}

function moveError(reason) {
  if (reason === 'not-playing') return '지금은 윷을 진행할 수 없습니다.';
  if (reason === 'not-your-turn') return '상대 차례입니다.';
  if (reason === 'must-move') return '나온 결과만큼 움직일 말을 먼저 선택해 주세요.';
  if (reason === 'must-throw') return '먼저 윷을 던져 주세요.';
  if (reason === 'bad-piece') return '움직일 수 있는 내 말을 선택해 주세요.';
  return '윷 결과를 처리할 수 없습니다.';
}

function publicState(game) {
  const finished = color => game.pieces[color].filter(piece => piece.status === 'finished').length;
  return {
    size: 0, board: [], status: game.status, turn: game.turn, winner: game.winner,
    winningLine: null, round: game.round, phase: game.phase,
    pendingSteps: game.pendingSteps, lastThrow: game.lastThrow,
    pieces: game.pieces, legalMoves: legalMoves(game), moveCount: game.moves.length,
    throwCount: game.throws.length, lastMove: game.moves.at(-1) || null,
    scores: { black: finished('black'), white: finished('white') }, lastPass: null,
  };
}

module.exports = { ...metadata, RESULTS, ROUTES, create, start, reset, routePath, destination, legalMoves, throwYut, applyMove, publicState, moveError };
