'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const bingo = require('../lib/games/bingo');
const { getGame } = require('../lib/games');

test('bingo engine registers 5x5 boards with 25 unique values from 1 to 50', () => {
  assert.equal(getGame('bingo'), bingo);
  for (let i = 0; i < 30; i += 1) {
    const board = bingo.generateBoard();
    assert.equal(board.length, 25);
    assert.equal(new Set(board).size, 25);
    assert.equal(board.every(value => Number.isInteger(value) && value >= 1 && value <= 50), true);
  }
});

test('lineCount recognizes five rows, five columns and two diagonals without duplication', () => {
  const board = Array.from({ length: 25 }, (_, index) => index + 1);
  assert.equal(bingo.lineCount(board, new Set([1,2,3,4,5])), 1);
  assert.equal(bingo.lineCount(board, new Set([1,6,11,16,21])), 1);
  assert.equal(bingo.lineCount(board, new Set([1,7,13,19,25])), 1);
  assert.equal(bingo.lineCount(board, new Set([5,9,13,17,21])), 1);
  assert.equal(bingo.lineCount(board, new Set(board)), 12);
});

test('host-configurable target is limited to 1 through 12 and locks after start', () => {
  const game = bingo.create();
  assert.equal(bingo.setTarget(game, 0).reason, 'bad-target');
  assert.equal(bingo.setTarget(game, 13).reason, 'bad-target');
  assert.equal(bingo.setTarget(game, 7).legal, true);
  assert.equal(game.targetLines, 7);
  assert.equal(bingo.start(game, ['1','2'], '1').legal, true);
  assert.equal(bingo.setTarget(game, 3).reason, 'already-started');
});

test('2 to 4 players start with private boards and explicit turn order', () => {
  for (const seats of [['1','2'], ['1','2','3'], ['1','2','3','4']]) {
    const game = bingo.create();
    const result = bingo.start(game, seats, seats[0]);
    assert.equal(result.legal, true);
    assert.equal(game.turn, seats[0]);
    assert.deepEqual(game.seatOrder, seats);
    for (const seat of seats) assert.equal(game.boards[seat].length, 25);
  }
  assert.equal(bingo.start(bingo.create(), ['1']).reason, 'not-enough-players');
});

test('selection validates turn, own board, duplicates and stale state on the server state', () => {
  const game = bingo.create();
  bingo.start(game, ['1','2'], '1');
  game.boards = { '1': Array.from({ length: 25 }, (_, i) => i + 1), '2': Array.from({ length: 25 }, (_, i) => i + 26) };
  assert.equal(bingo.selectNumber(game, '2', 26, 't0', 0).reason, 'not-your-turn');
  assert.equal(bingo.selectNumber(game, '1', 50, 't0', 0).reason, 'not-on-board');
  const first = bingo.selectNumber(game, '1', 1, 't1', 0);
  assert.equal(first.legal, true);
  assert.equal(game.turn, '2');
  assert.equal(bingo.selectNumber(game, '2', 26, 'stale', 0).reason, 'stale-state');
  assert.equal(bingo.selectNumber(game, '2', 1, 'bad', 1).reason, 'not-on-board');
  game.turn = '1';
  assert.equal(bingo.selectNumber(game, '1', 1, 'dup', 1).reason, 'already-selected');
});

test('one chosen number checks every board that owns the number and can complete multiple lines at once', () => {
  const game = bingo.create();
  bingo.setTarget(game, 2);
  bingo.start(game, ['1','2','3'], '1');
  const base = Array.from({ length: 25 }, (_, i) => i + 1);
  game.boards = {
    '1': [...base],
    '2': [1,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,26,27,28,29],
    '3': [30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,26,27,28,29],
  };
  game.selectedNumbers = [2,3,4,5,6,11,16,21];
  bingo.recalcLines(game);
  game.moves = game.selectedNumbers.map((number, index) => ({ seat: '1', number, moveNumber: index + 1 }));
  game.turn = '1';
  const result = bingo.selectNumber(game, '1', 1, 'finish', 8);
  assert.equal(result.finished, true);
  assert.equal(game.lineCounts['1'], 2);
  assert.equal(game.selectedNumbers.includes(1), true);
  assert.equal(game.status, 'finished');
  assert.equal(bingo.selectNumber(game, '2', 31, 'late', 9).reason, 'not-playing');
});

test('reset discards boards, selections, lines, turn and winner while preserving target for a rematch setup', () => {
  const game = bingo.create();
  bingo.setTarget(game, 6);
  bingo.start(game, ['1','2'], '1');
  const oldBoards = JSON.stringify(game.boards);
  const first = game.boards['1'][0];
  bingo.selectNumber(game, '1', first, 'now', 0);
  bingo.reset(game);
  assert.equal(game.round, 2);
  assert.equal(game.status, 'selecting');
  assert.equal(game.targetLines, 6);
  assert.deepEqual(game.boards, {});
  assert.deepEqual(game.selectedNumbers, []);
  assert.deepEqual(game.lineCounts, {});
  assert.equal(game.turn, null);
  assert.equal(game.winner, null);
  assert.notEqual(JSON.stringify(game.boards), oldBoards);
});
