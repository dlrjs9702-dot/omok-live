'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../lib/games/twentyquestions-adapter');
const { buildMatchResult } = require('../lib/match-result');

function start(mode = 'individual', rounds = 2, seats = ['1', '2', '3']) {
  const state = game.create();
  assert.equal(game.configure(state, mode, rounds).legal, true);
  assert.equal(game.beginRound(state, seats, null, () => 0).legal, true);
  return state;
}
test('registered adapter has game-center metadata, seat order and expected public shape', () => {
  assert.equal(game.id, 'twentyquestions');
  assert.equal(game.size, 0);
  const state = start();
  assert.equal(state.round, 1);
  assert.deepEqual(state.seatOrder, ['1', '2', '3']);
  assert.equal(game.publicState(state).round, 1);
  assert.deepEqual(game.publicState(state).seatOrder, ['1', '2', '3']);
  assert.equal(game.setSecret(state, '1', '비밀-비행기').legal, true);
  assert.equal(game.secretFor(state, '1'), '비밀-비행기');
  assert.equal(game.secretFor(state, '2'), null);
  assert.equal(game.secretFor(state, null), null);
  assert.equal(JSON.stringify(game.publicState(state)).includes('비밀-비행기'), false);
});

test('two round results map cumulative winning seats to permanent records, including ties', () => {
  const state = start('individual', 2, ['1', '2']);
  game.setSecret(state, '1', '첫 문제');
  game.submitGuess(state, '2', '첫 문제');
  game.judgeGuess(state, '1', true);
  assert.equal(state.status, 'round-ended');
  assert.equal(game.nextRound(state, () => 0).drawerSeat, '2');
  game.setSecret(state, '2', '둘째 문제');
  game.submitGuess(state, '1', '둘째 문제');
  game.judgeGuess(state, '2', true);
  assert.equal(state.status, 'finished');
  assert.deepEqual(state.winner, ['1', '2']);
  const room = {
    id: 'twenty-test-room', gameType: game.id, game: state,
    players: { '1': 'token-one', '2': 'token-two' },
    participants: {
      'token-one': { recordId: 'player-one' },
      'token-two': { recordId: 'player-two' },
    },
  };
  const record = buildMatchResult(room, '2026-09-23T00:00:00.000Z');
  assert.equal(record.gameType, 'twentyquestions');
  assert.equal(record.id, 'twenty-test-room:1');
  assert.deepEqual(record.outcomes, [
    { id: 'player-one', result: 'win' },
    { id: 'player-two', result: 'win' },
  ]);
  game.reset(state);
  assert.equal(state.status, 'selecting');
  assert.equal(state.round, 2);
});

test('cooperative final result includes all successful challengers in match history', () => {
  const state = start('cooperative', 1);
  game.setSecret(state, '1', '비행기');
  game.submitGuess(state, '2', '비행기');
  assert.equal(game.judgeGuess(state, '1', true).finished, true);
  assert.deepEqual(state.winner, ['2', '3']);
  assert.deepEqual(state.scores, { '1': 0, '2': 1, '3': 1 });
  const room = {
    id: 'team-test', gameType: game.id, game: state,
    players: { '1': 'a', '2': 'b', '3': 'c' },
    participants: { a: { recordId: 'a-id' }, b: { recordId: 'b-id' }, c: { recordId: 'c-id' } },
  };
  assert.deepEqual(buildMatchResult(room).outcomes, [
    { id: 'a-id', result: 'loss' },
    { id: 'b-id', result: 'win' },
    { id: 'c-id', result: 'win' },
  ]);
});
