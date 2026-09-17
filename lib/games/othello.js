'use strict';

const SIZE = 8;
const DIRECTIONS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],            [1, 0],
  [-1, 1],  [0, 1],   [1, 1],
];

const metadata = {
  id: 'othello',
  name: '오델로',
  size: SIZE,
  rules: '8×8, 흑 선공. 상대 돌을 양쪽에서 감싸는 위치에 두면 사이의 돌을 뒤집습니다. 둘 수 있는 곳이 없으면 자동으로 패스하며, 양쪽 모두 둘 수 없으면 종료됩니다. 마지막에 돌이 더 많은 쪽이 승리합니다.',
};

function inBounds(x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

function opponent(color) {
  return color === 'black' ? 'white' : 'black';
}

function createBoard() {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  board[3][3] = 'white';
  board[3][4] = 'black';
  board[4][3] = 'black';
  board[4][4] = 'white';
  return board;
}

function flipsForMove(board, x, y, color) {
  if (!inBounds(x, y) || board[y][x]) return [];
  const other = opponent(color);
  const all = [];
  for (const [dx, dy] of DIRECTIONS) {
    const line = [];
    let cx = x + dx;
    let cy = y + dy;
    while (inBounds(cx, cy) && board[cy][cx] === other) {
      line.push([cx, cy]);
      cx += dx;
      cy += dy;
    }
    if (line.length && inBounds(cx, cy) && board[cy][cx] === color) all.push(...line);
  }
  return all;
}

function legalMoves(board, color) {
  const moves = [];
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (!board[y][x] && flipsForMove(board, x, y, color).length) moves.push({ x, y });
    }
  }
  return moves;
}

function scores(board) {
  let black = 0;
  let white = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === 'black') black += 1;
      else if (cell === 'white') white += 1;
    }
  }
  return { black, white };
}

function create() {
  return {
    size: SIZE,
    board: createBoard(),
    turn: 'black',
    status: 'selecting',
    winner: null,
    winningLine: null,
    moves: [],
    round: 1,
    lastPass: null,
  };
}

function start(game) {
  game.status = 'playing';
  game.turn = 'black';
  game.lastPass = null;
}

function reset(game) {
  const nextRound = Number(game.round || 1) + 1;
  const fresh = create();
  fresh.round = nextRound;
  Object.assign(game, fresh);
}

function finish(game) {
  const count = scores(game.board);
  if (count.black === count.white) {
    game.status = 'draw';
    game.winner = null;
  } else {
    game.status = 'finished';
    game.winner = count.black > count.white ? 'black' : 'white';
  }
  game.turn = null;
  game.lastPass = null;
  return count;
}

function moveError(reason) {
  if (reason === 'occupied') return '이미 돌이 놓인 칸입니다.';
  if (reason === 'out-of-bounds') return '착수 위치가 올바르지 않습니다.';
  if (reason === 'no-capture') return '상대 돌을 뒤집을 수 있는 칸에만 둘 수 있습니다.';
  return '둘 수 없는 자리입니다.';
}

function applyMove(game, x, y, color, at) {
  if (!inBounds(x, y)) return { legal: false, reason: 'out-of-bounds' };
  if (game.board[y][x]) return { legal: false, reason: 'occupied' };
  const flips = flipsForMove(game.board, x, y, color);
  if (!flips.length) return { legal: false, reason: 'no-capture' };

  game.board[y][x] = color;
  for (const [fx, fy] of flips) game.board[fy][fx] = color;
  game.moves.push({ x, y, color, flipped: flips.length, at });

  const other = opponent(color);
  const otherMoves = legalMoves(game.board, other);
  const ownMoves = legalMoves(game.board, color);
  game.lastPass = null;

  if (otherMoves.length) {
    game.turn = other;
  } else if (ownMoves.length) {
    game.turn = color;
    game.lastPass = other;
  } else {
    finish(game);
  }

  return { legal: true, passed: game.lastPass, finished: ['finished', 'draw'].includes(game.status) };
}

function publicState(game) {
  return {
    size: SIZE,
    board: game.board,
    turn: game.turn,
    status: game.status,
    winner: game.winner,
    winningLine: null,
    moveCount: game.moves.length,
    lastMove: game.moves.at(-1) || null,
    round: game.round,
    legalMoves: game.status === 'playing' && game.turn ? legalMoves(game.board, game.turn) : [],
    scores: scores(game.board),
    lastPass: game.lastPass,
  };
}

module.exports = {
  ...metadata,
  create,
  start,
  reset,
  applyMove,
  publicState,
  moveError,
  inBounds,
  flipsForMove,
  legalMoves,
  scores,
};
