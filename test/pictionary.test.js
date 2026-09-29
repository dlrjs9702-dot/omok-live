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

const T0 = 1_000_000;

test('v2 guesses: time-scaled points, first +20, 10s extra time, drawer gets 25% (rounded)', () => {
  const game = pictionary.create();
  pictionary.start(game, ['1', '2', '3'], T0); // 90s default, join order kept
  assert.deepEqual(game.seatOrder, ['1', '2', '3']);
  const drawer = game.drawerSeat;
  assert.equal(drawer, '1');
  assert.deepEqual(pictionary.submitGuess(game, drawer, game.word, T0), { legal: false, reason: 'drawer-cannot-guess' });
  assert.deepEqual(pictionary.submitGuess(game, '2', '', T0), { legal: false, reason: 'empty-guess' });
  assert.deepEqual(pictionary.submitGuess(game, '2', '오답이확실한단어', T0), { legal: true, correct: false, close: false });
  assert.deepEqual(game.guessLog, [{ seat: '2', text: '오답이확실한단어' }]);

  const first = pictionary.submitGuess(game, '2', ` ${game.word}! `, T0 + 45_000); // half the time left
  assert.equal(first.correct, true);
  assert.equal(first.first, true);
  assert.equal(game.scores['2'], 70); // 50 + 20
  assert.equal(game.roundEndsAt, T0 + 55_000); // 10s extra answer time
  assert.deepEqual(pictionary.submitGuess(game, '2', game.word, T0 + 46_000), { legal: false, reason: 'already-guessed' });

  const second = pictionary.submitGuess(game, '3', game.word, T0 + 54_000); // 36s of 90s left
  assert.equal(second.points, 40);
  assert.equal(second.allGuessed, true);
  pictionary.endRound(game);
  assert.equal(game.phase, 'reveal');
  assert.equal(game.scores[drawer], 28); // round((70 + 40) * 0.25)
  assert.deepEqual(game.lastRound.awards.map(a => [a.seat, a.points, a.first]), [['2', 70, true], ['3', 40, false]]);
  assert.deepEqual(pictionary.endRound(game), { legal: false, reason: 'not-drawing' });
});

test('v2 guess after the original deadline still earns the 1-point floor during extra time', () => {
  const game = pictionary.create();
  pictionary.configure(game, { roundSeconds: 60 });
  pictionary.start(game, ['1', '2', '3'], T0);
  pictionary.submitGuess(game, '2', game.word, T0 + 59_000);
  assert.equal(game.roundEndsAt, T0 + 69_000); // extra time runs past the original minute
  assert.equal(pictionary.submitGuess(game, '3', game.word, T0 + 65_000).points, 1);
});

test('v2 hints: letter count at 50% left, choseong at 25% left, frozen after the first correct answer', () => {
  const game = pictionary.create();
  pictionary.start(game, ['1', '2', '3'], T0);
  assert.equal(pictionary.publicState(game).hints.length, null);
  assert.equal(pictionary.updateHints(game, T0 + 44_000), false);
  assert.equal(pictionary.updateHints(game, T0 + 45_000), true);
  const one = pictionary.publicState(game).hints;
  assert.equal(one.length, [...game.word].length);
  assert.equal(one.choseong, null);
  pictionary.submitGuess(game, '2', game.word, T0 + 50_000);
  assert.equal(pictionary.updateHints(game, T0 + 80_000), false, 'no new hint after the first correct answer');
  assert.equal(pictionary.publicState(game).hints.level, 1);

  const other = pictionary.create();
  pictionary.start(other, ['1', '2'], T0);
  pictionary.updateHints(other, T0 + 68_000);
  assert.equal(pictionary.publicState(other).hints.choseong, pictionary.choseongOf(other.word));
  assert.equal(pictionary.choseongOf('고양이'), 'ㄱㅇㅇ');
});

test('v2 near misses are told only to their author and stay out of the shared guess log', () => {
  assert.equal(pictionary.isCloseAnswer('사가', '사과'), true);
  assert.equal(pictionary.isCloseAnswer('사자', '사과'), false);
  assert.equal(pictionary.isCloseAnswer('코끼리', '사과'), false);
  const game = pictionary.create();
  pictionary.start(game, ['1', '2'], T0);
  game.word = '사과';
  assert.deepEqual(pictionary.submitGuess(game, '2', '사가', T0), { legal: true, correct: false, close: true });
  assert.deepEqual(game.guessLog, []);
  assert.equal(game.correctGuessers.length, 0);
});

test('v2 team mode: odd seats A / even seats B, alternating drawers, cross-team half points, team-total winner', () => {
  const game = pictionary.create();
  assert.deepEqual(pictionary.configure(game, { mode: 'team' }), { legal: true });
  assert.deepEqual(pictionary.start(game, ['1', '3', '5', '2'], T0), { legal: false, reason: 'team-seats' });
  assert.deepEqual(pictionary.start(game, ['1', '2', '3'], T0), { legal: false, reason: 'team-seats' });
  assert.equal(pictionary.start(game, ['3', '2', '1', '4'], T0).legal, true);
  assert.deepEqual(game.seatOrder, ['3', '2', '1', '4']); // A, B, A, B in join order
  assert.equal(game.drawerSeat, '3'); // A team
  const same = pictionary.submitGuess(game, '1', game.word, T0 + 45_000); // teammate: 50 + 20
  assert.equal(same.points, 70);
  const cross = pictionary.submitGuess(game, '2', game.word, T0 + 45_000); // opponent: 50 / 2
  assert.equal(cross.points, 25);
  pictionary.endRound(game);
  assert.equal(game.scores['3'], 24); // round((70 + 25) * 0.25)
  assert.deepEqual(game.lastRound.teamTotals, { A: 94, B: 25 });
  for (let i = 0; i < 3; i += 1) { pictionary.advance(game, T0); pictionary.endRound(game); }
  const done = pictionary.advance(game, T0);
  assert.equal(done.finished, true);
  assert.deepEqual(done.winner.sort(), ['1', '3']);
});

test('v2 config is host-set before start, words never repeat in a game, undo removes the last stroke, rematch keeps settings', () => {
  const now = Date.now();
  const game = pictionary.create();
  assert.deepEqual(pictionary.configure(game, { roundSeconds: 45 }), { legal: false, reason: 'bad-config' });
  assert.deepEqual(pictionary.configure(game, { difficulty: 'expert' }), { legal: false, reason: 'bad-config' });
  pictionary.configure(game, { difficulty: 'hard', roundSeconds: 120, showCategory: false });
  pictionary.start(game, ['1', '2', '3', '4', '5', '6', '7', '8'], now);
  assert.equal(game.deadlineAt, now + 120_000);
  assert.equal(pictionary.publicState(game).category, null);
  const hardWords = Object.values(pictionary.WORD_BANK.hard).flat();
  const seen = [game.word];
  for (let i = 0; i < 7; i += 1) { pictionary.endRound(game); pictionary.advance(game, now); if (game.word) seen.push(game.word); }
  assert.equal(new Set(seen).size, 8);
  assert.ok(seen.every(word => hardWords.includes(word)));
  assert.deepEqual(pictionary.configure(game, { mode: 'team' }), { legal: false, reason: 'already-started' });

  const drawer = game.drawerSeat;
  pictionary.addStroke(game, drawer, { points: [[0, 0], [1, 1]] });
  pictionary.addStroke(game, drawer, { points: [[0.5, 0.5], [0.6, 0.6]] });
  assert.deepEqual(pictionary.undoStroke(game, game.seatOrder.find(s => s !== drawer)), { legal: false, reason: 'not-drawer' });
  assert.equal(pictionary.undoStroke(game, drawer).legal, true);
  assert.deepEqual(game.strokes.map(s => s.points[0]), [[0, 0]]);

  pictionary.reset(game);
  assert.deepEqual([game.difficulty, game.roundSeconds, game.showCategory], ['hard', 120, false]);
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
