'use strict';

const COLUMNS = 7;
const ROWS = 6;
const DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]];

const metadata = {
  id: 'connect4',
  name: '사목 (4목)',
  size: COLUMNS,
  rules: '7열×6행. 빨강 선공, 노랑 후공. 자기 차례에 열을 누르면 그 열의 가장 아래 빈칸에 돌이 떨어집니다. 가로·세로·대각선으로 같은 색 돌 4개 이상을 먼저 연결하면 승리하며, 판이 가득 차면 무승부입니다. 가득 찬 열에는 둘 수 없습니다.',
};

function create() {
  return {
    size: COLUMNS,
    rows: ROWS,
    board: Array.from({ length: ROWS }, () => Array(COLUMNS).fill(null)),
    turn: 'black',
    status: 'selecting',
    winner: null,
    winningLine: null,
    moves: [],
    round: 1,
  };
}

function start(game) {
  game.status = 'playing';
  game.turn = 'black';
}

function reset(game) {
  const round = Number(game.round || 1) + 1;
  Object.assign(game, create(), { round });
}

function inBounds(x, y) {
  return x >= 0 && x < COLUMNS && y >= 0 && y < ROWS;
}

function landingRow(board, column) {
  if (!Number.isInteger(column) || column < 0 || column >= COLUMNS) return -1;
  for (let y = ROWS - 1; y >= 0; y -= 1) if (!board[y][column]) return y;
  return -1;
}

function winningLine(board, x, y, color) {
  for (const [dx, dy] of DIRECTIONS) {
    const before = [];
    const after = [];
    for (let cx = x - dx, cy = y - dy; inBounds(cx, cy) && board[cy][cx] === color; cx -= dx, cy -= dy) before.unshift([cx, cy]);
    for (let cx = x + dx, cy = y + dy; inBounds(cx, cy) && board[cy][cx] === color; cx += dx, cy += dy) after.push([cx, cy]);
    const line = [...before, [x, y], ...after];
    if (line.length >= 4) return line;
  }
  return null;
}

function moveError(reason) {
  if (reason === 'out-of-bounds') return '1~7번째 열 중 하나를 선택해 주세요.';
  if (reason === 'full-column') return '이 열은 이미 가득 찼습니다. 다른 열을 선택해 주세요.';
  return '선택한 열에 돌을 떨어뜨릴 수 없습니다.';
}

// The server chooses the landing row; the client cannot select a floating position.
function applyMove(game, x, _y, color, at) {
  if (!Number.isInteger(x) || x < 0 || x >= COLUMNS) return { legal: false, reason: 'out-of-bounds' };
  const y = landingRow(game.board, x);
  if (y < 0) return { legal: false, reason: 'full-column' };
  game.board[y][x] = color;
  game.moves.push({ x, y, color, at });
  const line = winningLine(game.board, x, y, color);
  if (line) {
    game.status = 'finished';
    game.winner = color;
    game.winningLine = line;
    game.turn = null;
  } else if (game.board[0].every(Boolean)) {
    game.status = 'draw';
    game.winner = null;
    game.winningLine = null;
    game.turn = null;
  } else {
    game.turn = color === 'black' ? 'white' : 'black';
  }
  return { legal: true, x, y, finished: game.status === 'finished' || game.status === 'draw' };
}

function publicState(game) {
  return {
    size: COLUMNS,
    rows: ROWS,
    board: game.board,
    turn: game.turn,
    status: game.status,
    winner: game.winner,
    winningLine: game.winningLine,
    moveCount: game.moves.length,
    lastMove: game.moves.at(-1) || null,
    round: game.round,
    legalColumns: game.status === 'playing' ? Array.from({ length: COLUMNS }, (_, x) => x).filter(x => landingRow(game.board, x) >= 0) : [],
    legalMoves: [],
    scores: null,
    lastPass: null,
    paused: Boolean(game.paused), disconnectedSeats: game.disconnectedSeats || [],
    endReason: game.endReason || null, disconnectedAtEnd: game.disconnectedAtEnd || [],
  };
}

module.exports = { ...metadata, create, start, reset, applyMove, publicState, moveError, landingRow, winningLine, COLUMNS, ROWS };
