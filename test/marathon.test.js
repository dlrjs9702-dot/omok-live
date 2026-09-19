'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const marathon = require('../lib/games/marathon');
const { getGame, listGames } = require('../lib/games');

test('Marathon is registered and starts in individual mode by default', () => {
  assert.equal(getGame('marathon'), marathon);
  assert.ok(listGames().some((g) => g.id === 'marathon'));
  const game = marathon.create();
  assert.equal(game.status, 'selecting');
  assert.equal(game.mode, 'individual');
  const started = marathon.start(game, ['1', '2', '3']);
  assert.equal(started.legal, true);
  assert.deepEqual(game.groupOrder, ['1', '2', '3']);
  assert.deepEqual(game.groups, { 1: ['1'], 2: ['2'], 3: ['3'] });
  assert.equal(game.positions['1'], 0);
  assert.equal(game.turnGroup, '1');
  assert.equal(game.phase, 'roll');
});

test('individual mode rejects fewer than 2 seats', () => {
  const tooFew = marathon.create();
  assert.equal(marathon.start(tooFew, ['1']).legal, false);
  const zero = marathon.create();
  assert.equal(marathon.start(zero, []).legal, false);
});

test('team configuration requires a layout and an exact matching seat count', () => {
  const game = marathon.create();
  assert.equal(marathon.configure(game, { mode: 'team' }).legal, false); // no layout yet -- rejected
  assert.equal(marathon.configure(game, { mode: 'team', teamLayout: '2v2' }).legal, true);
  assert.equal(marathon.start(game, ['1', '2', '3']).legal, false); // needs exactly 4 for 2v2
  const started = marathon.start(game, ['1', '2', '3', '4']);
  assert.equal(started.legal, true);
  assert.deepEqual(game.groupOrder, ['A', 'B']);
  assert.deepEqual(game.groups.A, ['1', '3']);
  assert.deepEqual(game.groups.B, ['2', '4']);
});

test('3v3 and 2v2v2 seat->team mapping is positional and self-selectable', () => {
  assert.equal(marathon.groupForSeat('3v3', '1'), 'A');
  assert.equal(marathon.groupForSeat('3v3', '2'), 'B');
  assert.equal(marathon.groupForSeat('3v3', '5'), 'A');
  assert.equal(marathon.groupForSeat('3v3', '6'), 'B');
  assert.equal(marathon.groupForSeat('2v2v2', '1'), 'A');
  assert.equal(marathon.groupForSeat('2v2v2', '2'), 'B');
  assert.equal(marathon.groupForSeat('2v2v2', '3'), 'C');
  assert.equal(marathon.groupForSeat('2v2v2', '4'), 'A');
  assert.equal(marathon.groupForSeat('2v2v2', '5'), 'B');
  assert.equal(marathon.groupForSeat('2v2v2', '6'), 'C');
  assert.equal(marathon.requiredSeatCount('2v2'), 4);
  assert.equal(marathon.requiredSeatCount('3v3'), 6);
  assert.equal(marathon.requiredSeatCount('2v2v2'), 6);
});

test('rolling moves the current roller\'s group and draws a mission unless it finishes at 30+', () => {
  const game = marathon.create();
  marathon.start(game, ['1', '2']);
  const before = game.phaseId;
  const result = marathon.rollDice(game, '1', before);
  assert.equal(result.legal, true);
  assert.equal(game.positions['1'], result.position);
  assert.equal(game.phase, 'mission');
  assert.ok(game.mission);
  assert.ok(marathon.MISSION_TYPES.includes(game.mission.type));
  // wrong seat / wrong turn is rejected
  assert.equal(marathon.rollDice(game, '2', game.phaseId).reason, 'must-answer');
});

test('reaching 30+ ends the game immediately without a mission', () => {
  const game = marathon.create();
  marathon.start(game, ['1', '2']);
  game.positions['1'] = 29;
  const result = marathon.rollDice(game, '1', game.phaseId);
  assert.equal(result.legal, true);
  assert.equal(result.finished, true);
  assert.equal(game.status, 'finished');
  assert.equal(game.winner, '1');
  assert.equal(game.phase, 'finished');
});

test('a correct answer keeps the position and passes the turn to the next group', () => {
  const game = marathon.create();
  marathon.start(game, ['1', '2']);
  marathon.rollDice(game, '1', game.phaseId);
  const posAfterRoll = game.positions['1'];
  const answer = game.mission.answer;
  const outcome = marathon.submitAnswer(game, '1', answer, game.phaseId);
  assert.equal(outcome.legal, true);
  assert.equal(outcome.correct, true);
  assert.equal(game.positions['1'], posAfterRoll);
  assert.equal(game.turnGroup, '2');
  assert.equal(game.phase, 'roll');
});

test('a wrong answer does not end the mission -- retry is allowed within the time limit', () => {
  const game = marathon.create();
  marathon.start(game, ['1', '2']);
  marathon.rollDice(game, '1', game.phaseId);
  const wrong = marathon.submitAnswer(game, '1', '__definitely-not-the-answer__', game.phaseId);
  assert.equal(wrong.legal, true);
  assert.equal(wrong.correct, false);
  assert.equal(game.phase, 'mission'); // still open for retry
  assert.equal(game.turnGroup, '1');
});

test('a timed-out mission applies the fixed -2 penalty and immediately chains a fresh mission on the new tile', () => {
  const game = marathon.create();
  marathon.start(game, ['1', '2']);
  game.positions['1'] = 10;
  marathon.rollDice(game, '1', game.phaseId); // moves to 11-16, draws a mission
  const posBeforeTimeout = game.positions['1'];
  const missionBefore = game.mission;
  game.deadlineAt = Date.now() - 1; // force expiry
  const changed = marathon.tick(game, Date.now());
  assert.equal(changed, true);
  assert.equal(game.positions['1'], posBeforeTimeout - 2);
  // per the confirmed rule ("연쇄 있음"), a fresh mission chains immediately -- the turn does NOT
  // pass to the other group, and phase stays 'mission' rather than returning to 'roll'.
  assert.equal(game.turnGroup, '1');
  assert.equal(game.phase, 'mission');
  assert.ok(game.mission);
  assert.notEqual(game.mission, missionBefore);
});

test('the penalty never pushes a position below the start line', () => {
  const game = marathon.create();
  marathon.start(game, ['1', '2']);
  game.positions['1'] = 1;
  marathon.rollDice(game, '1', game.phaseId);
  game.positions['1'] = 1; // simulate a low roll landing back near the start
  game.deadlineAt = Date.now() - 1;
  marathon.tick(game, Date.now());
  assert.ok(game.positions['1'] >= 0);
});

test('3v3 is a two-team (not three-team) split of six seats, three per side', () => {
  const game = marathon.create();
  marathon.configure(game, { mode: 'team', teamLayout: '3v3' });
  marathon.start(game, ['1', '2', '3', '4', '5', '6']);
  assert.deepEqual(game.groupOrder, ['A', 'B']);
  assert.deepEqual(game.groups.A, ['1', '3', '5']);
  assert.deepEqual(game.groups.B, ['2', '4', '6']);
});

test('team mode rotates the dice-roller among teammates after each resolved turn (2v2v2, three groups)', () => {
  const game = marathon.create();
  marathon.configure(game, { mode: 'team', teamLayout: '2v2v2' });
  marathon.start(game, ['1', '2', '3', '4', '5', '6']);
  assert.deepEqual(game.groupOrder, ['A', 'B', 'C']);
  assert.equal(marathon.currentRoller(game), '1'); // team A's first member (seats 1,4)
  marathon.rollDice(game, '1', game.phaseId);
  marathon.submitAnswer(game, '4', game.mission.answer, game.phaseId); // any teammate may answer
  assert.equal(game.turnGroup, 'B');
  assert.equal(marathon.currentRoller(game), '2'); // team B's first member (seats 2,5) rolls next
  marathon.rollDice(game, '2', game.phaseId);
  marathon.submitAnswer(game, '5', game.mission.answer, game.phaseId);
  assert.equal(game.turnGroup, 'C');
  const rollByNonRoller = marathon.rollDice(game, '6', game.phaseId);
  assert.equal(rollByNonRoller.legal, false); // team C's roller is seat 3 first, not seat 6
  assert.equal(marathon.rollDice(game, '3', game.phaseId).legal, true);
  marathon.submitAnswer(game, '3', game.mission.answer, game.phaseId);
  // back around to team A -- and A's roller should now have rotated to its second member (seat 4)
  assert.equal(game.turnGroup, 'A');
  assert.equal(marathon.currentRoller(game), '4');
});

test('a non-turn seat cannot roll, and a non-mission-group seat cannot answer', () => {
  const game = marathon.create();
  marathon.start(game, ['1', '2', '3']);
  assert.equal(marathon.rollDice(game, '2', game.phaseId).legal, false);
  marathon.rollDice(game, '1', game.phaseId);
  assert.equal(marathon.submitAnswer(game, '2', game.mission.answer, game.phaseId).legal, false);
});

test('publicState never exposes the mission answer, only the prompt', () => {
  const game = marathon.create();
  marathon.start(game, ['1', '2']);
  marathon.rollDice(game, '1', game.phaseId);
  const publicView = marathon.publicState(game, '2');
  assert.ok(publicView.mission);
  assert.equal(publicView.mission.prompt, game.mission.prompt);
  assert.equal(publicView.mission.answer, undefined);
  assert.doesNotMatch(JSON.stringify(publicView), new RegExp(`"answer":"${game.mission.answer}"`));
});

test('reset returns to selecting and increments the round without carrying over positions', () => {
  const game = marathon.create();
  marathon.start(game, ['1', '2']);
  marathon.rollDice(game, '1', game.phaseId);
  marathon.reset(game);
  assert.equal(game.status, 'selecting');
  assert.equal(game.round, 2);
  assert.deepEqual(game.positions, {});
  assert.equal(game.mission, null);
});
