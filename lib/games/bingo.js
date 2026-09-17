'use strict';

const crypto = require('crypto');

const metadata = {
  id: 'bingo',
  name: '빙고',
  size: 5,
  rules: '2~4인 턴제 빙고. 각 플레이어는 1~50 중 중복 없는 25개 숫자로 5×5 판을 받습니다. 자기 차례에 자신의 판에서 아직 선택되지 않은 숫자 하나를 고르면 같은 숫자를 가진 모든 참가자의 판도 함께 체크됩니다. 가로 5줄·세로 5줄·대각선 2줄을 인정하며, 방장이 시작 전에 정한 1~12줄 승리 조건을 먼저 달성하면 승리합니다.',
};

function create() {
  return {
    status: 'selecting',
    winner: null,
    winningLine: null,
    round: 1,
    targetLines: 5,
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
  Object.assign(game, create(), { round, targetLines });
}

function setTarget(game, value) {
  const target = Number(value);
  if (game.status !== 'selecting') return { legal: false, reason: 'already-started' };
  if (!Number.isInteger(target) || target < 1 || target > 12) return { legal: false, reason: 'bad-target' };
  game.targetLines = target;
  return { legal: true, targetLines: target };
}

function shuffledPool() {
  const pool = Array.from({ length: 50 }, (_, index) => index + 1);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function generateBoard() {
  return shuffledPool().slice(0, 25);
}

function normalizeSeats(seats) {
  return [...new Set((Array.isArray(seats) ? seats : []).map(String).filter(seat => ['1', '2', '3', '4'].includes(seat)))];
}

function start(game, seats, startingSeat = null) {
  if (game.status !== 'selecting') return { legal: false, reason: 'already-started' };
  const order = normalizeSeats(seats);
  if (order.length < 2 || order.length > 4) return { legal: false, reason: 'not-enough-players' };
  game.boards = Object.fromEntries(order.map(seat => [seat, generateBoard()]));
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

function lineCount(board, selectedNumbers) {
  if (!Array.isArray(board) || board.length !== 25) return 0;
  const selected = selectedNumbers instanceof Set ? selectedNumbers : new Set(selectedNumbers || []);
  let lines = 0;
  for (let row = 0; row < 5; row += 1) {
    let complete = true;
    for (let col = 0; col < 5; col += 1) complete &&= selected.has(board[row * 5 + col]);
    if (complete) lines += 1;
  }
  for (let col = 0; col < 5; col += 1) {
    let complete = true;
    for (let row = 0; row < 5; row += 1) complete &&= selected.has(board[row * 5 + col]);
    if (complete) lines += 1;
  }
  if ([0, 6, 12, 18, 24].every(index => selected.has(board[index]))) lines += 1;
  if ([4, 8, 12, 16, 20].every(index => selected.has(board[index]))) lines += 1;
  return lines;
}

function recalcLines(game) {
  const selected = new Set(game.selectedNumbers);
  game.lineCounts = Object.fromEntries(game.seatOrder.map(seat => [seat, lineCount(game.boards[seat], selected)]));
  return game.lineCounts;
}

function selectNumber(game, seat, value, at, expectedMoveCount) {
  seat = String(seat || '');
  const number = Number(value);
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (seat !== game.turn) return { legal: false, reason: 'not-your-turn' };
  if (!game.seatOrder.includes(seat)) return { legal: false, reason: 'not-a-player' };
  if (!Number.isInteger(expectedMoveCount) || expectedMoveCount !== game.moves.length) return { legal: false, reason: 'stale-state' };
  if (!Number.isInteger(number) || number < 1 || number > 50) return { legal: false, reason: 'bad-number' };
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
    size: 5,
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
  };
}

function moveError(reason) {
  if (reason === 'not-playing') return '빙고가 진행 중이 아닙니다.';
  if (reason === 'not-your-turn') return '현재 차례의 참가자만 숫자를 선택할 수 있습니다.';
  if (reason === 'not-a-player') return '관전자는 숫자를 선택할 수 없습니다.';
  if (reason === 'stale-state') return '화면 상태가 변경되었습니다. 최신 빙고판을 확인한 뒤 다시 선택해 주세요.';
  if (reason === 'bad-number') return '1~50 사이의 숫자를 선택해 주세요.';
  if (reason === 'not-on-board') return '자신의 빙고판에 있는 숫자만 선택할 수 있습니다.';
  if (reason === 'already-selected') return '이미 선택된 숫자입니다.';
  if (reason === 'bad-target') return '승리 조건은 1~12줄 중에서 선택해 주세요.';
  if (reason === 'not-enough-players') return '빙고는 2명 이상 자리를 선택해야 시작할 수 있습니다.';
  if (reason === 'already-started') return '게임 시작 후에는 설정을 변경할 수 없습니다.';
  return '빙고 요청을 처리할 수 없습니다.';
}

module.exports = {
  ...metadata,
  create,
  reset,
  setTarget,
  start,
  generateBoard,
  lineCount,
  recalcLines,
  selectNumber,
  boardFor,
  publicState,
  moveError,
};
