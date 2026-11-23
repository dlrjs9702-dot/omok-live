'use strict';

// 달무리 사목 (notes docs/orbit-4-plan-20261122.md, 사용자 결정 57 A · 59): a 4x4 board of two rings -- the outer twelve cells and the inner four.
// A turn: (optionally) one of the other's beads pushed to an empty cell beside it (across or up/down only), one of mine placed on an empty cell,
// then both rings turn one step the same way (counter-clockwise on the screen). Four in a row -- across, down or corner to corner -- counts only
// after the turn: whoever has a line then wins (both: a draw), even when it was the other who turned. Eight beads each; a full board turns up to
// five times more, the first line then winning, none a draw. The server does all of it: the client sends the cell and the push.
const N = 4;
const BEADS = 8;
const EXTRA_TURNS = 5;
// the rings in clockwise order on the screen (x right, y down): a bead steps to the one before it -- counter-clockwise
const OUTER = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2], [0, 1]];
const INNER = [[1, 1], [2, 1], [2, 2], [1, 2]];
const LINES = [
  ...Array.from({ length: N }, (_, y) => Array.from({ length: N }, (__, x) => [x, y])),
  ...Array.from({ length: N }, (_, x) => Array.from({ length: N }, (__, y) => [x, y])),
  Array.from({ length: N }, (_, k) => [k, k]),
  Array.from({ length: N }, (_, k) => [N - 1 - k, k]),
];

const metadata = {
  id: 'orbit4',
  name: '달무리 사목',
  size: N,
  rules: '4×4 달무리 판. 달 구슬 선공, 별 구슬 후공, 한 사람 8개. 내 차례에 상대 구슬 하나를 옆(가로·세로) 빈칸으로 한 칸 밀 수 있고(안 해도 돼요), 빈칸에 내 구슬을 놓으면 바깥 고리와 안쪽 고리가 함께 한 칸씩 돌아요. 돈 뒤에 가로·세로·대각선으로 4개가 이어진 쪽이 이기고, 둘 다 이어지면 무승부예요. 판이 다 차면 5번 더 돌리며 먼저 이어진 쪽이 이기고, 끝까지 없으면 무승부예요.',
};

function create() {
  return {
    size: N,
    board: Array.from({ length: N }, () => Array(N).fill(null)),
    turn: 'black',
    status: 'selecting',
    winner: null,
    winningLine: null,
    winningLines: null,
    left: { black: BEADS, white: BEADS },
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

const inBounds = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < N && y >= 0 && y < N;
const other = (c) => (c === 'black' ? 'white' : 'black');

// both rings one step counter-clockwise (a new board)
function turned(board) {
  const next = board.map((row) => row.slice());
  for (const ring of [OUTER, INNER]) ring.forEach(([x, y], i) => { const [px, py] = ring[(i + ring.length - 1) % ring.length]; next[py][px] = board[y][x]; });
  return next;
}

// every full line of one colour on the board
function linesOf(board, color) {
  return LINES.filter((line) => line.every(([x, y]) => board[y][x] === color));
}

function moveError(reason) {
  if (reason === 'out-of-bounds') return '판 안의 칸을 골라 주세요.';
  if (reason === 'occupied') return '이미 구슬이 있는 칸이에요. 빈칸을 골라 주세요.';
  if (reason === 'no-beads') return '놓을 구슬이 남지 않았어요.';
  if (reason === 'push-own') return '상대 구슬만 밀 수 있어요.';
  if (reason === 'push-far') return '구슬은 가로·세로로 바로 옆 빈칸에만 밀 수 있어요.';
  if (reason === 'push-first') return '아직 밀 상대 구슬이 없어요.';
  return '그 자리에는 둘 수 없어요.';
}

// the push read from the move's body: { from: [x, y], to: [x, y] } or nothing
function readPush(body) {
  const p = body?.push; if (!p) return null;
  const from = Array.isArray(p.from) ? p.from.map(Number) : null; const to = Array.isArray(p.to) ? p.to.map(Number) : null;
  return from && to ? { from, to } : { bad: true };
}

function applyMove(game, x, y, color, at, body = null) {
  if (!inBounds(x, y)) return { legal: false, reason: 'out-of-bounds' };
  if (!(game.left?.[color] > 0)) return { legal: false, reason: 'no-beads' };
  const push = readPush(body); const board = game.board.map((row) => row.slice());
  if (push) {
    if (push.bad || !inBounds(push.from[0], push.from[1]) || !inBounds(push.to[0], push.to[1])) return { legal: false, reason: 'out-of-bounds' };
    const [fx, fy] = push.from; const [tx, ty] = push.to;
    if (board[fy][fx] !== other(color)) return { legal: false, reason: game.moves.length ? 'push-own' : 'push-first' };
    if (Math.abs(fx - tx) + Math.abs(fy - ty) !== 1 || board[ty][tx]) return { legal: false, reason: 'push-far' };
    board[ty][tx] = board[fy][fx]; board[fy][fx] = null;
  }
  if (board[y][x]) return { legal: false, reason: 'occupied' };
  board[y][x] = color;
  // the turn, then the lines; a full board turns again (up to five) till one shows
  let now = turned(board); let turns = 1;
  let mine = linesOf(now, color); let theirs = linesOf(now, other(color));
  const placed = game.left.black + game.left.white - 1 === 0;
  while (placed && !mine.length && !theirs.length && turns < 1 + EXTRA_TURNS) { now = turned(now); turns += 1; mine = linesOf(now, color); theirs = linesOf(now, other(color)); }
  game.board = now; game.left = { ...game.left, [color]: game.left[color] - 1 };
  game.moves.push({ x, y, color, at, push: push ? { from: push.from, to: push.to } : null, turns });
  if (mine.length && theirs.length) Object.assign(game, { status: 'draw', winner: null, winningLine: mine[0], winningLines: [...mine, ...theirs], turn: null });
  else if (mine.length || theirs.length) { const w = mine.length ? color : other(color); const ls = mine.length ? mine : theirs; Object.assign(game, { status: 'finished', winner: w, winningLine: ls[0], winningLines: ls, turn: null }); }
  else if (placed) Object.assign(game, { status: 'draw', winner: null, winningLine: null, winningLines: null, turn: null });
  else game.turn = other(color);
  return { legal: true, x, y, turns, finished: game.status === 'finished' || game.status === 'draw' };
}

// the moves a seat could make now (the cells it may place on; a push's own check is in applyMove)
function legalCells(game) {
  if (game.status !== 'playing') return [];
  const out = []; for (let y = 0; y < N; y += 1) for (let x = 0; x < N; x += 1) if (!game.board[y][x]) out.push([x, y]); return out;
}

function publicState(game) {
  return {
    size: N,
    rows: N,
    board: game.board,
    turn: game.turn,
    status: game.status,
    winner: game.winner,
    winningLine: game.winningLine,
    winningLines: game.winningLines || null,
    left: game.left,
    moveCount: game.moves.length,
    lastMove: game.moves.at(-1) || null,
    round: game.round,
    legalMoves: legalCells(game),
    legalColumns: [],
    scores: null,
    lastPass: null,
    paused: Boolean(game.paused), disconnectedSeats: game.disconnectedSeats || [],
    endReason: game.endReason || null, disconnectedAtEnd: game.disconnectedAtEnd || [],
  };
}

module.exports = { ...metadata, create, start, reset, applyMove, publicState, moveError, turned, linesOf, legalCells, OUTER, INNER, BEADS, EXTRA_TURNS, N };
