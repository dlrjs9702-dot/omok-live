'use strict';

// Isolated, pre-integration engine. Round outcome, adjudication and scoring require
// explicit rule decisions; the module deliberately does not award a winner.
const QUESTION_LIMIT = 20;
const MODES = new Set(['individual', 'cooperative']);

function create() {
  return {
    status: 'selecting', phase: null, mode: null, totalRounds: null,
    roundNumber: 0, seats: [], challengerSeats: [], drawerSeat: null,
    secret: null, turnIndex: 0, questions: [], pendingQuestion: null,
    pendingGuess: null, winner: null, moveCount: 0,
  };
}

function configure(game, mode, totalRounds) {
  if (game.status !== 'selecting') return { legal: false, reason: 'already-started' };
  if (!MODES.has(mode)) return { legal: false, reason: 'invalid-mode' };
  // This is an implementation safety cap, not a finalized room UI round-count menu.
  if (!Number.isSafeInteger(totalRounds) || totalRounds < 1 || totalRounds > 1000) {
    return { legal: false, reason: 'invalid-rounds' };
  }
  game.mode = mode;
  game.totalRounds = totalRounds;
  return { legal: true };
}

function beginRound(game, seats, drawerSeat) {
  if (game.status !== 'selecting' || !MODES.has(game.mode) || !game.totalRounds) {
    return { legal: false, reason: 'not-ready' };
  }
  const order = Array.isArray(seats) ? seats.map(String) : [];
  if (order.length < 2 || order.some(s => !/^[1-9]\d*$/.test(s)) || new Set(order).size !== order.length || !order.includes(String(drawerSeat))) {
    return { legal: false, reason: 'invalid-seats' };
  }
  game.seats = order;
  game.drawerSeat = String(drawerSeat);
  game.challengerSeats = order.filter(s => s !== game.drawerSeat);
  game.turnIndex = 0;
  game.questions = [];
  game.pendingQuestion = null;
  game.pendingGuess = null;
  game.secret = null;
  game.roundNumber += 1;
  game.phase = 'secret';
  game.status = 'playing';
  return { legal: true };
}

function checkText(raw, maxLength) {
  return typeof raw === 'string' && raw.trim().length > 0 && raw.trim().length <= maxLength;
}

function setSecret(game, seat, secret) {
  if (game.status !== 'playing' || game.phase !== 'secret') return { legal: false, reason: 'wrong-phase' };
  if (String(seat) !== game.drawerSeat) return { legal: false, reason: 'not-drawer' };
  if (!checkText(secret, 100)) return { legal: false, reason: 'invalid-secret' };
  game.secret = secret.trim();
  game.phase = 'asking';
  return { legal: true };
}

function currentTurn(game) {
  return game.status === 'playing' && game.phase === 'asking'
    ? game.challengerSeats[game.turnIndex] : null;
}

function canTakeTurn(game, seat) {
  if (game.status !== 'playing' || game.phase !== 'asking') return 'wrong-phase';
  if (!game.challengerSeats.includes(String(seat))) return 'not-challenger';
  if (currentTurn(game) !== String(seat)) return 'not-your-turn';
  return null;
}

function submitQuestion(game, seat, question) {
  const error = canTakeTurn(game, seat);
  if (error) return { legal: false, reason: error };
  if (game.questions.length >= QUESTION_LIMIT) return { legal: false, reason: 'question-limit' };
  if (!checkText(question, 200)) return { legal: false, reason: 'invalid-question' };
  game.pendingQuestion = { seat: String(seat), text: question.trim() };
  game.phase = 'answering';
  game.moveCount += 1;
  return { legal: true, questionsRemaining: QUESTION_LIMIT - game.questions.length - 1 };
}

function answerQuestion(game, seat, reply) {
  if (game.status !== 'playing' || game.phase !== 'answering') return { legal: false, reason: 'wrong-phase' };
  if (String(seat) !== game.drawerSeat) return { legal: false, reason: 'not-drawer' };
  if (!checkText(reply, 200)) return { legal: false, reason: 'invalid-reply' };
  game.questions.push({ ...game.pendingQuestion, reply: reply.trim() });
  game.pendingQuestion = null;
  game.turnIndex = (game.turnIndex + 1) % game.challengerSeats.length;
  game.phase = 'asking';
  return { legal: true };
}

function submitGuess(game, seat, guess) {
  const error = canTakeTurn(game, seat);
  if (error) return { legal: false, reason: error };
  if (!checkText(guess, 100)) return { legal: false, reason: 'invalid-guess' };
  game.pendingGuess = { seat: String(seat), text: guess.trim() };
  game.phase = 'judging';
  game.moveCount += 1;
  // Do not decide correctness or mutate scores until answer-adjudication and
  // incorrect-guess rules are explicitly approved by the user.
  return { legal: true, awaitingRuleDecision: true };
}

function publicState(game) {
  return {
    status: game.status, phase: game.phase, mode: game.mode,
    totalRounds: game.totalRounds, roundNumber: game.roundNumber,
    seats: [...game.seats], drawerSeat: game.drawerSeat,
    turnSeat: currentTurn(game), questionLimit: QUESTION_LIMIT,
    questionsUsed: game.questions.length + Number(Boolean(game.pendingQuestion)),
    questionsRemaining: QUESTION_LIMIT - game.questions.length - Number(Boolean(game.pendingQuestion)),
    questions: game.questions.map(q => ({ ...q })),
    pendingQuestion: game.pendingQuestion ? { ...game.pendingQuestion } : null,
    pendingGuess: game.pendingGuess ? { ...game.pendingGuess } : null,
    winner: game.winner, moveCount: game.moveCount,
  };
}

function secretFor(game, seat) {
  return String(seat) === game.drawerSeat ? game.secret : null;
}

module.exports = { QUESTION_LIMIT, create, configure, beginRound, setSecret, currentTurn,
  submitQuestion, answerQuestion, submitGuess, publicState, secretFor };
