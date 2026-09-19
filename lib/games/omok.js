'use strict';

const {
  inBounds,
  evaluateMove,
  isBoardFull,
  makeInitialGame,
  resetForNextRound,
} = require('../game');

const metadata = {
  id: 'omok',
  name: '오목',
  size: 15,
  rules: '15×15, 흑 선공. 흑은 정확히 5목 승리, 3-3·4-4·6목 이상 장목 금수. 백은 5목 이상이면 승리하며 같은 금수 제한이 없습니다. 흑 4-3은 허용합니다.',
};

function create() {
  return makeInitialGame();
}

function start(game) {
  game.status = 'playing';
  game.turn = 'black';
}

function reset(game) {
  resetForNextRound(game);
}

function moveError(reason) {
  if (reason === 'double-three') return '금수입니다: 흑은 3-3에 둘 수 없습니다.';
  if (reason === 'double-four') return '금수입니다: 흑은 4-4에 둘 수 없습니다.';
  if (reason === 'overline') return '금수입니다: 흑은 6목 이상 장목에 둘 수 없습니다.';
  if (reason === 'occupied') return '이미 돌이 놓인 자리입니다.';
  if (reason === 'out-of-bounds') return '착수 위치가 올바르지 않습니다.';
  return '둘 수 없는 자리입니다.';
}

function applyMove(game, x, y, color, at) {
  if (!inBounds(x, y)) return { legal: false, reason: 'out-of-bounds' };
  if (game.board[y][x]) return { legal: false, reason: 'occupied' };
  const verdict = evaluateMove(game.board, x, y, color);
  if (!verdict.legal) return { legal: false, reason: verdict.reason, forbidden: verdict.reason };

  game.board[y][x] = color;
  game.moves.push({ x, y, color, at });
  game.rematchRequests = { black: false, white: false };
  if (verdict.win) {
    game.status = 'finished';
    game.winner = color;
    game.winningLine = verdict.winningLine;
  } else if (isBoardFull(game.board)) {
    game.status = 'draw';
    game.winner = null;
    game.winningLine = null;
  } else {
    game.turn = color === 'black' ? 'white' : 'black';
  }
  return { legal: true };
}

function publicState(game) {
  return {
    size: game.size,
    board: game.board,
    turn: game.turn,
    status: game.status,
    winner: game.winner,
    winningLine: game.winningLine,
    moveCount: game.moves.length,
    lastMove: game.moves.at(-1) || null,
    round: game.round,
    legalMoves: [],
    scores: null,
    lastPass: null,
    paused: Boolean(game.paused), disconnectedSeats: game.disconnectedSeats || [],
    endReason: game.endReason || null, disconnectedAtEnd: game.disconnectedAtEnd || [],
  };
}

module.exports = { ...metadata, create, start, reset, applyMove, publicState, moveError };
