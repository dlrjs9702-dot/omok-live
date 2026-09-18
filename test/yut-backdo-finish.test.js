'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const yut = require('../lib/games/yut');

function freshGame() {
  const game = yut.create();
  yut.start(game);
  return game;
}

test('back-do moves a board piece one step back along its own current path', () => {
  assert.deepEqual(yut.destination({ status: 'board', position: 3, route: 'outer' }, -1), { status: 'board', position: 2, route: 'outer' });
  // On the shortcut branch it retreats along the same diagonal, not the outer ring.
  assert.deepEqual(yut.destination({ status: 'board', position: 22, route: 'shortcut5' }, -1), { status: 'board', position: 21, route: 'shortcut5' });
  assert.deepEqual(yut.destination({ status: 'board', position: 21, route: 'shortcut5' }, -1), { status: 'board', position: 5, route: 'shortcut5' });
});

test('back-do is clamped at the start corner and never sends a piece back home', () => {
  assert.deepEqual(yut.destination({ status: 'board', position: 1, route: 'outer' }, -1), { status: 'board', position: 0, route: 'outer' });
  assert.deepEqual(yut.destination({ status: 'board', position: 0, route: 'outer' }, -1), { status: 'board', position: 0, route: 'outer' });
});

test('back-do cannot launch a waiting piece and cannot move a finished one', () => {
  assert.equal(yut.destination({ status: 'home', position: null, route: 'outer' }, -1), null);
  assert.equal(yut.destination({ status: 'finished', position: null, route: 'outer' }, -1), null);
});

test('back-do at the finish line retreats to the last real cell on that route', () => {
  assert.deepEqual(yut.destination({ status: 'board', position: 'finishLine', route: 'outer' }, -1), { status: 'board', position: 19, route: 'outer' });
  assert.deepEqual(yut.destination({ status: 'board', position: 'finishLine', route: 'shortcut10' }, -1), { status: 'board', position: 29, route: 'shortcut10' });
});

test('a back-do throw with no piece able to move (everyone still waiting) auto-passes the turn', () => {
  const game = freshGame();
  const result = yut.throwYut(game, 'black', 't1', 1, true);
  assert.equal(result.legal, true);
  assert.equal(result.name, '빽도');
  assert.equal(result.passed, true);
  assert.equal(game.turn, 'white');
  assert.equal(game.phase, 'throw');
  assert.equal(game.pendingSteps, null);
  assert.equal(game.lastPass, 'black');
  assert.deepEqual(yut.publicState(game).lastPass, 'black');
});

test('a back-do throw is not offered as a legal move for any waiting piece', () => {
  const game = freshGame();
  Object.assign(game.pieces.black[0], { status: 'board', position: 3, route: 'outer' });
  game.phase = 'move';
  game.pendingSteps = -1;
  const moves = yut.legalMoves(game, 'black');
  assert.equal(moves.length, 1);
  assert.equal(moves[0].pieceId, 'black-1');
  assert.equal(moves[0].destination.position, 2);
});

test('back-do that captures an opponent applies the existing capture rule and grants a bonus throw', () => {
  const game = freshGame();
  Object.assign(game.pieces.black[0], { status: 'board', position: 3, route: 'outer' });
  Object.assign(game.pieces.white[0], { status: 'board', position: 2, route: 'outer' });
  game.phase = 'move';
  game.pendingSteps = -1;
  game.lastThrow = { name: '빽도', steps: -1 };
  const result = yut.applyMove(game, 'black-1', 'black', 'now');
  assert.equal(result.legal, true);
  assert.deepEqual(result.captured, ['white-1']);
  assert.equal(result.bonus, true);
  assert.equal(game.pieces.black[0].position, 2);
  assert.equal(game.pieces.white[0].status, 'home');
  assert.equal(game.turn, 'black');
  assert.equal(game.phase, 'throw');
});

test('back-do without a capture does not grant a bonus throw and passes to the opponent', () => {
  const game = freshGame();
  Object.assign(game.pieces.black[0], { status: 'board', position: 3, route: 'outer' });
  game.phase = 'move';
  game.pendingSteps = -1;
  game.lastThrow = { name: '빽도', steps: -1 };
  const result = yut.applyMove(game, 'black-1', 'black', 'now');
  assert.equal(result.legal, true);
  assert.equal(result.captured.length, 0);
  assert.equal(result.bonus, false);
  assert.equal(game.turn, 'white');
  assert.equal(game.phase, 'throw');
});

test('a piece resting on the finish line can still be knocked back by a back-do (boundary with the +1 finish rule)', () => {
  const game = freshGame();
  Object.assign(game.pieces.black[0], { status: 'board', position: 'finishLine', route: 'outer' });
  game.phase = 'move';
  game.pendingSteps = -1;
  game.lastThrow = { name: '빽도', steps: -1 };
  const result = yut.applyMove(game, 'black-1', 'black', 'now');
  assert.equal(result.legal, true);
  assert.equal(game.pieces.black[0].status, 'board');
  assert.equal(game.pieces.black[0].position, 19);
});

test('opponent pieces can be captured while resting on the finish line, with the usual bonus throw', () => {
  const game = freshGame();
  Object.assign(game.pieces.black[0], { status: 'board', position: 18, route: 'outer' });
  Object.assign(game.pieces.white[0], { status: 'board', position: 'finishLine', route: 'outer' });
  game.phase = 'move';
  game.pendingSteps = 2;
  game.lastThrow = { name: '개', steps: 2 };
  const result = yut.applyMove(game, 'black-1', 'black', 'now');
  assert.equal(result.legal, true);
  assert.deepEqual(result.captured, ['white-1']);
  assert.equal(result.bonus, true);
  assert.equal(game.pieces.black[0].position, 'finishLine');
  assert.equal(game.pieces.white[0].status, 'home');
});
