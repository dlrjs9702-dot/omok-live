const test = require('node:test');
const assert = require('node:assert/strict');
const othello = require('../lib/games/othello');
const { getGame, hasGame } = require('../lib/games');

test('game registry exposes omok and othello independently', () => {
  assert.equal(hasGame('omok'), true);
  assert.equal(hasGame('othello'), true);
  assert.equal(getGame('omok').name, '오목');
  assert.equal(getGame('othello').name, '오델로');
});

test('othello starts with four stones and four legal black moves', () => {
  const game = othello.create();
  const count = othello.scores(game.board);
  assert.deepEqual(count, { black: 2, white: 2 });
  assert.deepEqual(
    othello.legalMoves(game.board, 'black').map(({ x, y }) => `${x},${y}`).sort(),
    ['2,3', '3,2', '4,5', '5,4']
  );
});

test('othello move flips captured stones and hands turn to white', () => {
  const game = othello.create();
  othello.start(game);
  const result = othello.applyMove(game, 2, 3, 'black', 'now');
  assert.equal(result.legal, true);
  assert.equal(game.board[3][2], 'black');
  assert.equal(game.board[3][3], 'black');
  assert.equal(game.turn, 'white');
  assert.deepEqual(othello.scores(game.board), { black: 4, white: 1 });
});

test('othello rejects a move that captures nothing', () => {
  const game = othello.create();
  othello.start(game);
  const result = othello.applyMove(game, 0, 0, 'black', 'now');
  assert.equal(result.legal, false);
  assert.equal(result.reason, 'no-capture');
});
