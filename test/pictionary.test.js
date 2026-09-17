'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const pictionary = require('../lib/games/pictionary');
const { getGame, hasGame, listGames } = require('../lib/games');

test('Pictionary is independently registered', () => {
  assert.equal(hasGame('pictionary'), true);
  assert.equal(getGame('pictionary'), pictionary);
  assert.ok(listGames().some(g => g.id === 'pictionary'));
});

test('start requires 2-8 players and assigns scores plus a first drawer', () => {
  const game = pictionary.create();
  assert.deepEqual(pictionary.start(game, ['1']), { legal: false, reason: 'not-enough-players' });
  const eight = ['1', '2', '3', '4', '5', '6', '7', '8'];
  assert.equal(pictionary.start(pictionary.create(), eight).legal, true);

  const verdict = pictionary.start(game, ['1', '2', '3']);
  assert.equal(verdict.legal, true);
  assert.equal(game.status, 'playing');
  assert.equal(game.phase, 'drawing');
  assert.equal(game.seatOrder.length, 3);
  assert.ok(game.seatOrder.includes(game.drawerSeat));
  assert.deepEqual(game.scores, { '1': 0, '2': 0, '3': 0 });
  assert.ok(typeof game.word === 'string' && game.word.length > 0);
  assert.ok(game.roundEndsAt > Date.now());
});

test('starting twice is rejected', () => {
  const game = pictionary.create();
  pictionary.start(game, ['1', '2']);
  assert.deepEqual(pictionary.start(game, ['1', '2']), { legal: false, reason: 'already-started' });
});

test('wordFor only reveals the secret word to the current drawer', () => {
  const game = pictionary.create();
  pictionary.start(game, ['1', '2']);
  const other = game.seatOrder.find(s => s !== game.drawerSeat);
  assert.equal(pictionary.wordFor(game, game.drawerSeat), game.word);
  assert.equal(pictionary.wordFor(game, other), null);
  assert.equal(pictionary.wordFor(game, null), null);
});

test('only the current drawer may add strokes, and points are validated and clamped', () => {
  const game = pictionary.create();
  pictionary.start(game, ['1', '2']);
  const drawer = game.drawerSeat;
  const other = game.seatOrder.find(s => s !== drawer);
  assert.deepEqual(
    pictionary.addStroke(game, other, { points: [[0, 0], [1, 1]], color: '#000000', width: 4, tool: 'pen' }),
    { legal: false, reason: 'not-drawer' }
  );
  const verdict = pictionary.addStroke(game, drawer, { points: [[0.1, 0.2], [0.3, 0.4]], color: '#ff0000', width: 40, tool: 'pen' });
  assert.equal(verdict.legal, true);
  assert.equal(game.strokes.length, 1);
  assert.equal(game.strokes[0].width, 24); // clamped to the max
  assert.deepEqual(
    pictionary.addStroke(game, drawer, { points: [], color: '#000000', width: 4, tool: 'pen' }),
    { legal: false, reason: 'bad-stroke' }
  );
});

test('clearCanvas only works for the drawer during the drawing phase', () => {
  const game = pictionary.create();
  pictionary.start(game, ['1', '2']);
  const drawer = game.drawerSeat;
  const other = game.seatOrder.find(s => s !== drawer);
  pictionary.addStroke(game, drawer, { points: [[0, 0], [1, 1]], color: '#000000', width: 4, tool: 'pen' });
  assert.deepEqual(pictionary.clearCanvas(game, other), { legal: false, reason: 'not-drawer' });
  assert.equal(pictionary.clearCanvas(game, drawer).legal, true);
  assert.equal(game.strokes.length, 0);
});

test('guesses are validated, scored, and duplicate/self guesses are rejected', () => {
  const game = pictionary.create();
  pictionary.start(game, ['1', '2', '3']);
  const drawer = game.drawerSeat;
  const guessers = game.seatOrder.filter(s => s !== drawer);
  assert.deepEqual(pictionary.submitGuess(game, drawer, game.word), { legal: false, reason: 'drawer-cannot-guess' });
  assert.deepEqual(pictionary.submitGuess(game, guessers[0], ''), { legal: false, reason: 'empty-guess' });
  const wrong = pictionary.submitGuess(game, guessers[0], '오답이확실한단어');
  assert.deepEqual(wrong, { legal: true, correct: false });
  const right = pictionary.submitGuess(game, guessers[0], `  ${game.word}  `);
  assert.equal(right.legal, true);
  assert.equal(right.correct, true);
  assert.equal(right.allGuessed, false);
  assert.equal(game.scores[guessers[0]], 100);
  assert.deepEqual(pictionary.submitGuess(game, guessers[0], game.word), { legal: false, reason: 'already-guessed' });
  const finalGuess = pictionary.submitGuess(game, guessers[1], game.word);
  assert.equal(finalGuess.allGuessed, true);
});

test('endRound awards the drawer 50 points per correct guesser and moves to reveal', () => {
  const game = pictionary.create();
  pictionary.start(game, ['1', '2', '3']);
  const drawer = game.drawerSeat;
  const guessers = game.seatOrder.filter(s => s !== drawer);
  pictionary.submitGuess(game, guessers[0], game.word);
  pictionary.submitGuess(game, guessers[1], game.word);
  const before = pictionary.endRound(game);
  assert.equal(before.legal, true);
  assert.equal(game.phase, 'reveal');
  assert.equal(game.scores[drawer], 100);
  assert.equal(game.lastRound.word, game.lastRound.word);
  assert.equal(game.lastRound.correctGuessers.length, 2);
  assert.deepEqual(pictionary.endRound(game), { legal: false, reason: 'not-drawing' });
});

test('advance rotates to the next drawer and finishes with a winner after a full cycle, handling ties', () => {
  const game = pictionary.create();
  pictionary.start(game, ['1', '2']);
  pictionary.endRound(game);
  const firstDrawer = game.drawerSeat;
  const step1 = pictionary.advance(game);
  assert.equal(step1.legal, true);
  assert.equal(step1.finished, false);
  assert.notEqual(game.drawerSeat, firstDrawer);
  assert.equal(game.phase, 'drawing');
  assert.equal(game.strokes.length, 0);

  pictionary.endRound(game);
  const step2 = pictionary.advance(game);
  assert.equal(step2.finished, true);
  assert.equal(game.status, 'finished');
  assert.deepEqual(new Set(step2.winner), new Set(['1', '2'])); // tied at 0-0 -> co-winners
});

test('reset starts a fresh match while bumping the round counter', () => {
  const game = pictionary.create();
  pictionary.start(game, ['1', '2']);
  pictionary.reset(game);
  assert.equal(game.status, 'selecting');
  assert.equal(game.round, 2);
  assert.equal(game.seatOrder.length, 0);
});
