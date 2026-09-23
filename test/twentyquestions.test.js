'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../lib/games/twentyquestions');
function started(mode = 'individual') {
  const game = engine.create();
  assert.equal(engine.configure(game, mode, 3).legal, true);
  assert.equal(engine.beginRound(game, ['1', '2', '3'], '1').legal, true);
  return game;
}
test('two modes configure and only drawer can set a secret', () => {
  for (const mode of ['individual', 'cooperative']) {
    const game = started(mode);
    assert.equal(engine.setSecret(game, '2', '비밀').reason, 'not-drawer');
    assert.equal(engine.setSecret(game, '1', '비밀').legal, true);
    assert.equal(engine.publicState(game).mode, mode);
    assert.equal(engine.secretFor(game, '1'), '비밀');
    assert.equal(engine.secretFor(game, '2'), null);
    assert.equal(engine.secretFor(game, null), null);
    assert.equal(JSON.stringify(engine.publicState(game)).includes('비밀'), false);
  }
});
test('turn, spectator, drawer and official-answer permissions', () => {
  const game = started();
  engine.setSecret(game, '1', '정답');
  assert.equal(engine.submitQuestion(game, '3', '질문').reason, 'not-your-turn');
  assert.equal(engine.submitQuestion(game, '9', '질문').reason, 'not-challenger');
  assert.equal(engine.submitQuestion(game, '1', '질문').reason, 'not-challenger');
  assert.equal(engine.submitQuestion(game, '2', '첫 질문').legal, true);
  assert.equal(engine.submitQuestion(game, '2', '중복 요청').reason, 'wrong-phase');
  assert.equal(engine.answerQuestion(game, '3', '예').reason, 'not-drawer');
  assert.equal(engine.answerQuestion(game, '1', '예').legal, true);
  assert.equal(engine.currentTurn(game), '3');
  assert.equal(engine.publicState(game).questions[0].text, '첫 질문');
});
test('the server enforces 20 official questions', () => {
  const game = started('cooperative');
  engine.setSecret(game, '1', '정답');
  for (let i = 0; i < 20; i++) {
    const seat = engine.currentTurn(game);
    assert.equal(engine.submitQuestion(game, seat, `질문 ${i + 1}`).legal, true);
    assert.equal(engine.answerQuestion(game, '1', '아니오').legal, true);
  }
  assert.equal(engine.publicState(game).questionsUsed, 20);
  assert.equal(engine.publicState(game).questionsRemaining, 0);
  assert.equal(engine.submitQuestion(game, engine.currentTurn(game), '21번째').reason, 'question-limit');
});
test('guess is an alternative to question, pending adjudication without revealing secret', () => {
  const game = started();
  engine.setSecret(game, '1', '진짜 비밀');
  assert.equal(engine.submitGuess(game, '2', '틀린 답').legal, true);
  assert.equal(engine.publicState(game).questionsUsed, 2);
  assert.equal(engine.publicState(game).questionsRemaining, 19);
  assert.equal(engine.submitQuestion(game, '2', '추가 질문').reason, 'wrong-phase');
  assert.equal(game.winner, null);
  assert.equal(JSON.stringify(engine.publicState(game)).includes('진짜 비밀'), false);
});
test('invalid setup and settings do not mutate playing state', () => {
  const game = engine.create();
  assert.equal(engine.configure(game, 'nonsense', 3).legal, false);
  assert.equal(engine.configure(game, 'individual', 0).legal, false);
  assert.equal(engine.configure(game, 'individual', 3).legal, true);
  assert.equal(engine.beginRound(game, ['1', '1'], '1').legal, false);
  assert.equal(engine.beginRound(game, ['1', '2'], '5').legal, false);
  assert.equal(game.status, 'selecting');
});
test('setup limits and both free and recommended round choices', () => {
  const game = engine.create();
  assert.deepEqual(engine.recommendedRounds(4), [4, 8]);
  assert.deepEqual(engine.recommendedRounds(8), [8]);
  assert.equal(engine.configure(game, 'individual', 11).reason, 'invalid-rounds');
  assert.equal(engine.configure(game, 'individual', 10).legal, true);
  assert.equal(engine.beginRound(game, Array.from({ length: 9 }, (_, i) => String(i + 1))).reason, 'invalid-seats');
  assert.equal(engine.beginRound(game, ['1', '2'], null, () => 0).legal, true);
  assert.equal(engine.publicState(game).category, engine.CATEGORIES[0]);
});
test('drawer judges allowed replies and failed guesses pass the turn', () => {
  const game = started();
  engine.setSecret(game, '1', '비행기');
  assert.equal(engine.submitQuestion(game, '2', '날아요?').legal, true);
  assert.equal(engine.answerQuestion(game, '1', '모르겠음').reason, 'invalid-reply');
  assert.equal(engine.answerQuestion(game, '1', '비슷함').legal, true);
  assert.equal(engine.submitGuess(game, '3', '자동차').legal, true);
  assert.equal(engine.judgeGuess(game, '3', false).reason, 'not-drawer');
  assert.equal(engine.judgeGuess(game, '1', false).legal, true);
  assert.equal(engine.currentTurn(game), '2');
  assert.equal(engine.publicState(game).questionsUsed, 1);
  assert.equal(JSON.stringify(engine.publicState(game)).includes('비행기'), false);
});
test('one-on-one wrong guesses consume the 20-action limit and cannot repeat forever', () => {
  const game = engine.create();
  assert.equal(engine.configure(game, 'individual', 1).legal, true);
  assert.equal(engine.beginRound(game, ['1', '2'], '1', () => 0).legal, true);
  assert.equal(engine.setSecret(game, '1', '정답').legal, true);
  for (let i = 0; i < 20; i++) {
    const submitted = engine.submitGuess(game, '2', `오답 ${i + 1}`);
    assert.equal(submitted.legal, true);
    assert.equal(engine.publicState(game).questionsUsed, i + 1);
    assert.equal(engine.publicState(game).questionsRemaining, 19 - i);
    const judged = engine.judgeGuess(game, '1', false);
    assert.equal(judged.legal, true);
    assert.equal(game.phase, i === 19 ? 'final-guesses' : 'asking');
  }
  assert.deepEqual(game.finalGuessSeats, ['2']);
  assert.equal(engine.publicState(game).questionsUsed, 20);
  assert.equal(engine.submitGuess(game, '2', '최종 오답').legal, true);
  assert.equal(engine.publicState(game).questionsUsed, 20);
  assert.equal(engine.judgeGuess(game, '1', false).legal, true);
  assert.equal(game.status, 'finished');
  assert.equal(game.scores['1'], 1);
  assert.equal(engine.submitGuess(game, '2', '추가 정답').reason, 'wrong-phase');
});
test('twenty questions grant everyone one final attempt, then award the drawer', () => {
  const game = started();
  engine.setSecret(game, '1', '비행기');
  for (let i = 0; i < 20; i++) {
    const player = engine.currentTurn(game);
    engine.submitQuestion(game, player, `질문${i}`);
    engine.answerQuestion(game, '1', '애매함');
  }
  assert.equal(game.phase, 'final-guesses');
  assert.deepEqual(game.finalGuessSeats, ['2', '3']);
  for (const player of ['2', '3']) {
    assert.equal(engine.submitGuess(game, player, '틀린 답').legal, true);
    assert.equal(engine.judgeGuess(game, '1', false).legal, true);
  }
  assert.equal(game.status, 'round-ended');
  assert.equal(game.scores['1'], 1);
  assert.equal(game.roundResults[0].success, false);
  assert.equal(engine.submitGuess(game, '2', '추가').reason, 'wrong-phase');
});
test('individual success scores single guesser and rotates drawer', () => {
  const game = started();
  engine.setSecret(game, '1', '첫 정답');
  engine.submitGuess(game, '2', '답');
  assert.equal(engine.judgeGuess(game, '1', true).legal, true);
  assert.deepEqual(game.scores, { '1': 0, '2': 1, '3': 0 });
  assert.equal(engine.nextRound(game, () => 0).drawerSeat, '2');
  assert.notEqual(game.category, game.roundResults[0].category);
  assert.equal(engine.secretFor(game, '1'), null);
});
test('cooperative success awards all challengers; tied top scores are co-winners', () => {
  const game = engine.create();
  engine.configure(game, 'cooperative', 2);
  engine.beginRound(game, ['1', '2', '3'], null, () => 0);
  engine.setSecret(game, '1', '정답 1');
  engine.submitGuess(game, '2', '정답 1');
  engine.judgeGuess(game, '1', true);
  assert.deepEqual(game.scores, { '1': 0, '2': 1, '3': 1 });
  engine.nextRound(game, () => 0);
  engine.setSecret(game, '2', '정답 2');
  engine.submitGuess(game, '1', '정답 2');
  const outcome = engine.judgeGuess(game, '2', true);
  assert.equal(outcome.finished, true);
  assert.equal(game.status, 'finished');
  assert.deepEqual(game.scores, { '1': 1, '2': 1, '3': 2 });
  assert.deepEqual(outcome.winners, ['3']);
});
test('individual mode allows tied final winners', () => {
  const game = engine.create();
  engine.configure(game, 'individual', 2);
  engine.beginRound(game, ['1', '2'], null, () => 0);
  engine.setSecret(game, '1', 'a');
  engine.submitGuess(game, '2', 'a');
  engine.judgeGuess(game, '1', true);
  engine.nextRound(game, () => 0);
  engine.setSecret(game, '2', 'b');
  engine.submitGuess(game, '1', 'b');
  const result = engine.judgeGuess(game, '2', true);
  assert.deepEqual(result.winners, ['1', '2']);
});
