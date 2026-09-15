const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createBoard,
  evaluateMove,
  isBoardFull,
} = require('../lib/game');

function put(board, color, coords) {
  for (const [x, y] of coords) board[y][x] = color;
}

test('흑은 정확히 5목이면 승리한다', () => {
  const board = createBoard();
  put(board, 'black', [[3,7],[4,7],[5,7],[6,7]]);
  const r = evaluateMove(board, 7, 7, 'black');
  assert.equal(r.legal, true);
  assert.equal(r.win, true);
  assert.equal(r.winningLine.length, 5);
});

test('백은 6목 이상 장목도 승리한다', () => {
  const board = createBoard();
  put(board, 'white', [[2,7],[3,7],[4,7],[5,7],[6,7]]);
  const r = evaluateMove(board, 7, 7, 'white');
  assert.equal(r.legal, true);
  assert.equal(r.win, true);
  assert.equal(r.winningLine.length, 6);
});

test('흑은 6목 이상 장목을 둘 수 없다', () => {
  const board = createBoard();
  put(board, 'black', [[2,7],[3,7],[4,7],[5,7],[6,7]]);
  const r = evaluateMove(board, 7, 7, 'black');
  assert.equal(r.legal, false);
  assert.equal(r.reason, 'overline');
});

test('흑의 전형적인 4-4를 금수로 판정한다', () => {
  const board = createBoard();
  put(board, 'black', [
    [5,7],[6,7],[8,7],
    [7,5],[7,6],[7,8],
  ]);
  const r = evaluateMove(board, 7, 7, 'black');
  assert.equal(r.legal, false);
  assert.equal(r.reason, 'double-four');
});

test('흑의 전형적인 3-3을 금수로 판정한다', () => {
  const board = createBoard();
  put(board, 'black', [
    [6,7],[8,7],
    [7,6],[7,8],
  ]);
  const r = evaluateMove(board, 7, 7, 'black');
  assert.equal(r.legal, false);
  assert.equal(r.reason, 'double-three');
});

test('흑의 4-3은 허용한다', () => {
  const board = createBoard();
  put(board, 'black', [
    [5,7],[6,7],[8,7],
    [7,6],[7,8],
  ]);
  const r = evaluateMove(board, 7, 7, 'black');
  assert.equal(r.legal, true);
  assert.equal(r.win, false);
});

test('막힌 가짜 3은 3-3으로 세지 않는다', () => {
  const board = createBoard();
  put(board, 'black', [
    [6,7],[8,7],
    [7,6],[7,8],
  ]);
  put(board, 'white', [[5,7]]);
  const r = evaluateMove(board, 7, 7, 'black');
  assert.equal(r.legal, true);
  assert.equal(r.win, false);
});

test('정확한 흑 5목은 동시에 생기는 3-3/4-4보다 승리를 우선한다', () => {
  const board = createBoard();
  put(board, 'black', [
    [3,7],[4,7],[5,7],[6,7],
    [7,6],[7,8],
  ]);
  const r = evaluateMove(board, 7, 7, 'black');
  assert.equal(r.legal, true);
  assert.equal(r.win, true);
});

test('다른 방향에서 장목이 같이 생기면 흑 5목이어도 금수 처리한다', () => {
  const board = createBoard();
  put(board, 'black', [
    [3,7],[4,7],[5,7],[6,7],
    [7,2],[7,3],[7,4],[7,5],[7,6],
  ]);
  const r = evaluateMove(board, 7, 7, 'black');
  assert.equal(r.legal, false);
  assert.equal(r.reason, 'overline');
});

test('보드가 가득 찼는지 확인한다', () => {
  const board = createBoard();
  for (const row of board) row.fill('black');
  assert.equal(isBoardFull(board), true);
});
