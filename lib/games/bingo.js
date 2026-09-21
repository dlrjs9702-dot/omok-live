'use strict';

const crypto = require('crypto');

// Grid size and number-pool ceiling are both host-configurable (v1.6.66), chosen from a fixed
// enum each -- every combination is valid since the smallest pool (50) already covers the largest
// grid (7x7 = 49 cells), so no cross-validation between the two is needed.
const GRID_SIZES = Object.freeze([5, 7]);
const POOL_SIZES = Object.freeze([50, 75, 100, 150]);
// Every row + every column + the two diagonals of an NxN grid.
const maxLines = (gridSize) => 2 * gridSize + 2;

const metadata = {
  id: 'bingo',
  name: '빙고',
  size: 5,
  rules: '2~4인 턴제 빙고. 방장이 시작 전에 판 크기(5×5 또는 7×7)와 숫자 범위(1~50/75/100/150)를 정하면, 각 플레이어는 그 범위 안에서 중복 없는 숫자로 자신의 판을 받습니다. 자기 차례에 자신의 판에서 아직 선택되지 않은 숫자 하나를 고르면 같은 숫자를 가진 모든 참가자의 판도 함께 체크됩니다. 가로·세로·대각선 줄을 인정하며(5×5는 최대 12줄, 7×7은 최대 16줄), 방장이 정한 목표 줄 수를 먼저 달성하면 승리합니다.',
};

function create() {
  return {
    status: 'selecting',
    winner: null,
    winningLine: null,
    round: 1,
    targetLines: 5,
    gridSize: 5,
    poolMax: 50,
    turn: null,
    seatOrder: [],
    boards: {},
    selectedNumbers: [],
    lineCounts: {},
    lastSelected: null,
    moves: [],
  };
}

function reset(game) {
  const round = Number(game.round || 1) + 1;
  const targetLines = Number(game.targetLines || 5);
  const gridSize = GRID_SIZES.includes(Number(game.gridSize)) ? Number(game.gridSize) : 5;
  const poolMax = POOL_SIZES.includes(Number(game.poolMax)) ? Number(game.poolMax) : 50;
  Object.assign(game, create(), { round, targetLines, gridSize, poolMax });
}

function setTarget(game, value) {
  const target = Number(value);
  if (game.status !== 'selecting') return { legal: false, reason: 'already-started' };
  if (!Number.isInteger(target) || target < 1 || target > maxLines(game.gridSize)) return { legal: false, reason: 'bad-target' };
  game.targetLines = target;
  return { legal: true, targetLines: target };
}

function setGridSize(game, value) {
  const size = Number(value);
  if (game.status !== 'selecting') return { legal: false, reason: 'already-started' };
  if (!GRID_SIZES.includes(size)) return { legal: false, reason: 'bad-grid' };
  game.gridSize = size;
  // A target already set for a bigger grid may no longer fit a smaller one.
  if (game.targetLines > maxLines(size)) game.targetLines = maxLines(size);
  return { legal: true, gridSize: size };
}

function setPoolMax(game, value) {
  const pool = Number(value);
  if (game.status !== 'selecting') return { legal: false, reason: 'already-started' };
  if (!POOL_SIZES.includes(pool)) return { legal: false, reason: 'bad-pool' };
  game.poolMax = pool;
  return { legal: true, poolMax: pool };
}

function shuffledPool(poolMax = 50) {
  const pool = Array.from({ length: poolMax }, (_, index) => index + 1);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function generateBoard(gridSize = 5, poolMax = 50) {
  return shuffledPool(poolMax).slice(0, gridSize * gridSize);
}

function normalizeSeats(seats) {
  return [...new Set((Array.isArray(seats) ? seats : []).map(String).filter(seat => ['1', '2', '3', '4'].includes(seat)))];
}

function start(game, seats, startingSeat = null) {
  if (game.status !== 'selecting') return { legal: false, reason: 'already-started' };
  const order = normalizeSeats(seats);
  if (order.length < 2 || order.length > 4) return { legal: false, reason: 'not-enough-players' };
  game.boards = Object.fromEntries(order.map(seat => [seat, generateBoard(game.gridSize, game.poolMax)]));
  game.seatOrder = order;
  game.selectedNumbers = [];
  game.lineCounts = Object.fromEntries(order.map(seat => [seat, 0]));
  game.lastSelected = null;
  game.moves = [];
  game.winner = null;
  game.status = 'playing';
  game.turn = order.includes(String(startingSeat)) ? String(startingSeat) : order[crypto.randomInt(0, order.length)];
  return { legal: true, turn: game.turn, seats: [...order] };
}

// Generalized to an NxN grid (was hardcoded to 5x5): row r/col c lives at r*N+c, the main
// diagonal is r*(N+1), the anti-diagonal is (r+1)*(N-1) -- both formulas checked against the
// original literal 5x5 index lists ([0,6,12,18,24] and [4,8,12,16,20]) before generalizing.
function lineCount(board, selectedNumbers, gridSize = 5) {
  const n = gridSize;
  if (!Array.isArray(board) || board.length !== n * n) return 0;
  const selected = selectedNumbers instanceof Set ? selectedNumbers : new Set(selectedNumbers || []);
  let lines = 0;
  for (let row = 0; row < n; row += 1) {
    let complete = true;
    for (let col = 0; col < n; col += 1) complete &&= selected.has(board[row * n + col]);
    if (complete) lines += 1;
  }
  for (let col = 0; col < n; col += 1) {
    let complete = true;
    for (let row = 0; row < n; row += 1) complete &&= selected.has(board[row * n + col]);
    if (complete) lines += 1;
  }
  if (Array.from({ length: n }, (_, row) => row * (n + 1)).every(index => selected.has(board[index]))) lines += 1;
  if (Array.from({ length: n }, (_, row) => (row + 1) * (n - 1)).every(index => selected.has(board[index]))) lines += 1;
  return lines;
}

function recalcLines(game) {
  const selected = new Set(game.selectedNumbers);
  game.lineCounts = Object.fromEntries(game.seatOrder.map(seat => [seat, lineCount(game.boards[seat], selected, game.gridSize)]));
  return game.lineCounts;
}

function selectNumber(game, seat, value, at, expectedMoveCount) {
  seat = String(seat || '');
  const number = Number(value);
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (seat !== game.turn) return { legal: false, reason: 'not-your-turn' };
  if (!game.seatOrder.includes(seat)) return { legal: false, reason: 'not-a-player' };
  if (!Number.isInteger(expectedMoveCount) || expectedMoveCount !== game.moves.length) return { legal: false, reason: 'stale-state' };
  if (!Number.isInteger(number) || number < 1 || number > game.poolMax) return { legal: false, reason: 'bad-number' };
  if (!game.boards[seat]?.includes(number)) return { legal: false, reason: 'not-on-board' };
  if (game.selectedNumbers.includes(number)) return { legal: false, reason: 'already-selected' };

  game.selectedNumbers.push(number);
  game.lastSelected = { number, seat, at };
  recalcLines(game);
  const move = { seat, number, at, moveNumber: game.moves.length + 1, lineCounts: { ...game.lineCounts } };
  game.moves.push(move);

  const winners = game.seatOrder.filter(playerSeat => game.lineCounts[playerSeat] >= game.targetLines);
  if (winners.length) {
    game.status = 'finished';
    game.winner = winners.includes(seat) ? seat : winners[0];
    game.turn = null;
    return { legal: true, finished: true, winner: game.winner, lineCounts: { ...game.lineCounts } };
  }

  const current = game.seatOrder.indexOf(seat);
  game.turn = game.seatOrder[(current + 1) % game.seatOrder.length];
  return { legal: true, finished: false, nextTurn: game.turn, lineCounts: { ...game.lineCounts } };
}

function boardFor(game, seat) {
  const board = game.boards?.[String(seat || '')];
  return Array.isArray(board) ? [...board] : null;
}

function publicState(game) {
  return {
    size: game.gridSize,
    gridSize: game.gridSize,
    poolMax: game.poolMax,
    board: [],
    status: game.status,
    winner: game.winner,
    winningLine: null,
    round: game.round,
    targetLines: game.targetLines,
    turn: game.turn,
    seatOrder: [...game.seatOrder],
    selectedNumbers: [...game.selectedNumbers],
    lineCounts: { ...game.lineCounts },
    lastSelected: game.lastSelected ? { ...game.lastSelected } : null,
    moveCount: game.moves.length,
    lastMove: game.moves.at(-1) || null,
    lastPass: null,
    paused: Boolean(game.paused), disconnectedSeats: game.disconnectedSeats || [],
    endReason: game.endReason || null, disconnectedAtEnd: game.disconnectedAtEnd || [],
  };
}

function moveError(reason) {
  if (reason === 'not-playing') return '빙고가 진행 중이 아닙니다.';
  if (reason === 'not-your-turn') return '현재 차례의 참가자만 숫자를 선택할 수 있습니다.';
  if (reason === 'not-a-player') return '관전자는 숫자를 선택할 수 없습니다.';
  if (reason === 'stale-state') return '화면 상태가 변경되었습니다. 최신 빙고판을 확인한 뒤 다시 선택해 주세요.';
  if (reason === 'bad-number') return '선택한 숫자 범위 안의 숫자를 골라 주세요.';
  if (reason === 'not-on-board') return '자신의 빙고판에 있는 숫자만 선택할 수 있습니다.';
  if (reason === 'already-selected') return '이미 선택된 숫자입니다.';
  if (reason === 'bad-target') return '승리 조건은 선택한 판 크기에 맞는 줄 수 범위에서 선택해 주세요.';
  if (reason === 'bad-grid') return '빙고판 크기는 5×5 또는 7×7 중에서 선택해 주세요.';
  if (reason === 'bad-pool') return '숫자 범위는 1~50, 1~75, 1~100, 1~150 중에서 선택해 주세요.';
  if (reason === 'not-enough-players') return '빙고는 2명 이상 자리를 선택해야 시작할 수 있습니다.';
  if (reason === 'already-started') return '게임 시작 후에는 설정을 변경할 수 없습니다.';
  return '빙고 요청을 처리할 수 없습니다.';
}

module.exports = {
  ...metadata,
  create,
  reset,
  setTarget,
  setGridSize,
  setPoolMax,
  GRID_SIZES,
  POOL_SIZES,
  maxLines,
  start,
  generateBoard,
  lineCount,
  recalcLines,
  selectNumber,
  boardFor,
  publicState,
  moveError,
};
