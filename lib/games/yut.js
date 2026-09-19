'use strict';

const crypto = require('crypto');

const RESULTS = {
  '-1': { name: '빽도', steps: -1 },
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
  rules: '2인 윷놀이. 각자 말 4개를 모두 먼저 완주하면 승리합니다. 도·개·걸·윷·모만큼 이동하며 윷·모가 나오거나 상대 말을 잡으면 한 번 더 던집니다. 빽도가 나오면 보드 위의 말 하나를 한 칸 뒤로 물립니다(대기 중인 말은 낼 수 없고, 물릴 말이 없으면 차례가 넘어갑니다). 같은 편 말이 한 칸에 만나면 업어서 함께 움직입니다. 모서리에 정확히 멈춘 말은 다음 이동부터 지름길을 이용하며, 중앙에 정확히 멈춘 말은 항상 10자리 쪽 지름길로 출발합니다. 완주 직전 칸에 도착한 말은 그 칸에 머무르며, 다음 이동에서 한 칸 이상 더 나아가야 완주합니다.',
};

// 'finishLine' is the resting cell just before actual completion: reaching it (exactly or by
// overshoot) never finishes a piece by itself; the piece stays there until a later move advances
// it by at least one more step. It is shared by every route (they all funnel home through it).
const FINISH_LINE = 'finishLine';

const ROUTES = Object.freeze({
  outer: Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, FINISH_LINE, 'finished']),
  shortcut5: Object.freeze([5, 21, 22, 23, 24, 25, 15, 16, 17, 18, 19, FINISH_LINE, 'finished']),
  shortcut10: Object.freeze([10, 26, 27, 23, 28, 29, FINISH_LINE, 'finished']),
});

function freshPieces(color) {
  return Array.from({ length: 4 }, (_, index) => ({ id: `${color}-${index + 1}`, color, status: 'home', position: null, route: 'outer' }));
}

function create() {
  return {
    status: 'selecting', turn: 'black', winner: null, winningLine: null,
    round: 1, phase: 'throw', pendingSteps: null, lastThrow: null, lastPass: null,
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

// The route a piece's CURRENT position is anchored to, independent of movement direction: used
// both to pick the forward path and to reverse along the same path for a back-do.
function routeForPosition(piece) {
  // A piece resting exactly on the center junction (23) is always anchored to the short 10-side
  // diagonal, regardless of which diagonal it arrived on.
  if (piece.position === 23) return 'shortcut10';
  return piece.route || 'outer';
}

function routeForDeparture(piece) {
  // This only applies to a piece that is currently AT the center (its next departure); a piece
  // that merely passes through 23 within one longer throw keeps following its original path,
  // since that whole move is resolved as a single lookup along that path array (see destination()).
  if (piece.position === 23) return 'shortcut10';
  const current = piece.route || 'outer';
  if (current !== 'outer') return current;
  if (piece.position === 5) return 'shortcut5';
  if (piece.position === 10) return 'shortcut10';
  return 'outer';
}

function forwardDestination(piece, steps) {
  const route = routeForDeparture(piece);
  const path = routePath(route);
  const at = path.indexOf(piece.position);
  if (at < 0) return null;

  let cursor = at;
  for (let remaining = steps; remaining > 0; remaining -= 1) {
    cursor = Math.min(cursor + 1, path.length - 1);
    // Reaching the finish line uses up this whole throw, even with steps left over: it takes a
    // separate later move (any amount) to actually finish from there.
    if (path[cursor] === FINISH_LINE) break;
  }
  const next = path[cursor];
  return next === 'finished'
    ? { status: 'finished', position: null, route }
    : { status: 'board', position: next, route };
}

// A back-do only ever moves a piece that is already on the board (never launches a waiting piece).
// It retreats one step along whichever path the piece is currently on, and is clamped at the
// start corner (0) -- it never sends a piece back to "home".
function backwardDestination(piece, backSteps) {
  if (!piece || piece.status !== 'board') return null;
  const route = routeForPosition(piece);
  const path = routePath(route);
  const at = path.indexOf(piece.position);
  if (at < 0) return null;
  const cursor = Math.max(0, at - backSteps);
  return { status: 'board', position: path[cursor], route };
}

function destination(piece, steps) {
  if (!piece || piece.status === 'finished' || !Number.isInteger(steps) || steps === 0 || steps < -1 || steps > 5) return null;
  if (steps < 0) return backwardDestination(piece, -steps);
  if (piece.status === 'home') return { status: 'board', position: steps, route: 'outer' };
  return forwardDestination(piece, steps);
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

// A 5th, independently flipped stick decides whether a "도" throw (a single back showing) is
// instead read as "빽도". This keeps the existing do/gae/geol/yut/mo odds intact and only splits
// the "도" outcome between the two.
function randomBackDoFlag() {
  return crypto.randomInt(0, 2) === 1;
}

function throwYut(game, color, at, backCount = randomBackCount(), backDoFlag = randomBackDoFlag()) {
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (color !== game.turn) return { legal: false, reason: 'not-your-turn' };
  if (game.phase !== 'throw') return { legal: false, reason: 'must-move' };
  if (!Number.isInteger(backCount) || backCount < 0 || backCount > 4) return { legal: false, reason: 'bad-throw' };
  const isBackDo = backCount === 1 && Boolean(backDoFlag);
  const steps = isBackDo ? -1 : (backCount === 0 ? 5 : backCount);
  const result = { ...RESULTS[steps], backs: backCount, color, at };
  game.lastThrow = result;
  game.pendingSteps = steps;
  game.phase = 'move';
  game.throws.push(result);
  game.lastPass = null;

  if (legalMoves(game, color).length === 0) {
    // No piece can use this throw at all (e.g. a back-do while every piece is still waiting to
    // start): the turn passes automatically instead of leaving the player stuck.
    game.pendingSteps = null;
    game.phase = 'throw';
    game.turn = color === 'black' ? 'white' : 'black';
    game.lastPass = color;
    return { legal: true, ...result, passed: true };
  }
  return { legal: true, ...result, passed: false };
}

function applyMove(game, pieceId, color, at) {
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (color !== game.turn) return { legal: false, reason: 'not-your-turn' };
  if (game.phase !== 'move' || !game.pendingSteps) return { legal: false, reason: 'must-throw' };
  const option = legalMoves(game, color).find(move => move.pieceId === pieceId || move.carried.includes(pieceId));
  if (!option) return { legal: false, reason: 'bad-piece' };
  game.lastPass = null;
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
    scores: { black: finished('black'), white: finished('white') }, lastPass: game.lastPass || null,
    paused: Boolean(game.paused), disconnectedSeats: game.disconnectedSeats || [],
    endReason: game.endReason || null, disconnectedAtEnd: game.disconnectedAtEnd || [],
  };
}

module.exports = { ...metadata, RESULTS, ROUTES, FINISH_LINE, create, start, reset, routePath, destination, legalMoves, throwYut, applyMove, publicState, moveError };
