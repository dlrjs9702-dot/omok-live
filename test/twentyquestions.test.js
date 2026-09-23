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
  assert.equal(engine.publicState(game).questionsUsed, 0);
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
