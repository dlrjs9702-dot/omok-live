'use strict';

// Isolated game engine; integration with room routing, UI, rematches and match history is separate.
const QUESTION_LIMIT = 20;
const ANSWERS = Object.freeze(['예', '아니오', '비슷함', '애매함']);
const CATEGORIES = Object.freeze(['동물', '식물', '음식', '물건', '장소', '직업', '인물', '영화·드라마', '게임', '스포츠', '자연', '과학·기술']);
const MODES = new Set(['individual', 'cooperative']);

function recommendedRounds(playerCount) {
  if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 8) return [];
  return [1, 2, 3].map(n => playerCount * n).filter(n => n <= 10);
}
function create() {
  return {
    status: 'selecting', phase: null, mode: null, totalRounds: null,
    roundNumber: 0, seats: [], challengerSeats: [], drawerSeat: null,
    category: null, previousCategory: null, secret: null, turnIndex: 0,
    questions: [], pendingQuestion: null, pendingGuess: null,
    finalGuessSeats: [], finalGuessIndex: 0, guessHistory: [],
    scores: {}, roundResults: [], winner: null, winners: [], moveCount: 0,
  };
}
function configure(game, mode, totalRounds) {
  if (game.status !== 'selecting') return { legal: false, reason: 'already-started' };
  if (!MODES.has(mode)) return { legal: false, reason: 'invalid-mode' };
  if (!Number.isSafeInteger(totalRounds) || totalRounds < 1 || totalRounds > 10) return { legal: false, reason: 'invalid-rounds' };
  game.mode = mode;
  game.totalRounds = totalRounds;
  return { legal: true };
}
function chooseCategory(game, random = Math.random) {
  const pool = CATEGORIES.filter(category => category !== game.previousCategory);
  const sample = Number(random());
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) return { legal: false, reason: 'invalid-random' };
  return { legal: true, category: pool[Math.floor(sample * pool.length)] };
}
function beginRound(game, seats, drawerSeat, random = Math.random) {
  if (!MODES.has(game.mode) || !game.totalRounds ||
      !(game.status === 'selecting' || (game.status === 'round-ended' && game.roundNumber < game.totalRounds))) {
    return { legal: false, reason: 'not-ready' };
  }
  const order = Array.isArray(seats) ? seats.map(String) : [];
  if (order.length < 2 || order.length > 8 || order.some(s => !/^[1-9]\d*$/.test(s)) || new Set(order).size !== order.length) {
    return { legal: false, reason: 'invalid-seats' };
  }
  if (game.roundNumber && (order.length !== game.seats.length || order.some((seat, i) => seat !== game.seats[i]))) {
    return { legal: false, reason: 'seat-order-changed' };
  }
  const nextDrawer = game.roundNumber ? order[game.roundNumber % order.length] : order[0];
  if (drawerSeat != null && String(drawerSeat) !== nextDrawer) return { legal: false, reason: 'invalid-drawer' };
  const selection = chooseCategory(game, random);
  if (!selection.legal) return selection;
  game.seats = order;
  if (!game.roundNumber) game.scores = Object.fromEntries(order.map(s => [s, 0]));
  game.drawerSeat = nextDrawer;
  game.challengerSeats = order.filter(s => s !== nextDrawer);
  game.turnIndex = 0;
  game.questions = [];
  game.pendingQuestion = null;
  game.pendingGuess = null;
  game.guessHistory = [];
  game.finalGuessSeats = [];
  game.finalGuessIndex = 0;
  game.secret = null;
  game.category = selection.category;
  game.previousCategory = selection.category;
  game.roundNumber += 1;
  game.phase = 'secret';
  game.status = 'playing';
  game.winner = null;
  game.winners = [];
  return { legal: true, category: game.category, drawerSeat: game.drawerSeat };
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
  if (game.status !== 'playing') return null;
  if (game.phase === 'asking') return game.challengerSeats[game.turnIndex];
  if (game.phase === 'final-guesses') return game.finalGuessSeats[game.finalGuessIndex] || null;
  return null;
}
function canTakeTurn(game, seat) {
  if (game.status !== 'playing' || !['asking', 'final-guesses'].includes(game.phase)) return 'wrong-phase';
  if (!game.challengerSeats.includes(String(seat))) return 'not-challenger';
  if (currentTurn(game) !== String(seat)) return 'not-your-turn';
  return null;
}
function submitQuestion(game, seat, question) {
  const error = canTakeTurn(game, seat);
  if (error) return { legal: false, reason: error };
  if (game.phase === 'final-guesses' || game.questions.length >= QUESTION_LIMIT) return { legal: false, reason: 'question-limit' };
  if (!checkText(question, 200)) return { legal: false, reason: 'invalid-question' };
  game.pendingQuestion = { seat: String(seat), text: question.trim() };
  game.phase = 'answering';
  game.moveCount += 1;
  return { legal: true, questionsRemaining: QUESTION_LIMIT - game.questions.length - 1 };
}
function answerQuestion(game, seat, reply) {
  if (game.status !== 'playing' || game.phase !== 'answering') return { legal: false, reason: 'wrong-phase' };
  if (String(seat) !== game.drawerSeat) return { legal: false, reason: 'not-drawer' };
  if (!ANSWERS.includes(reply)) return { legal: false, reason: 'invalid-reply' };
  game.questions.push({ ...game.pendingQuestion, reply });
  game.pendingQuestion = null;
  game.turnIndex = (game.turnIndex + 1) % game.challengerSeats.length;
  if (game.questions.length === QUESTION_LIMIT) {
    // Each challenger gets exactly one last attempt; start with the next player in turn order.
    game.finalGuessSeats = game.challengerSeats.slice(game.turnIndex).concat(game.challengerSeats.slice(0, game.turnIndex));
    game.finalGuessIndex = 0;
    game.phase = 'final-guesses';
  } else game.phase = 'asking';
  game.moveCount += 1;
  return { legal: true, finalGuesses: game.phase === 'final-guesses' };
}
function submitGuess(game, seat, guess) {
  const error = canTakeTurn(game, seat);
  if (error) return { legal: false, reason: error };
  if (!checkText(guess, 100)) return { legal: false, reason: 'invalid-guess' };
  game.pendingGuess = { seat: String(seat), text: guess.trim(), final: game.phase === 'final-guesses' };
  game.phase = 'judging';
  game.moveCount += 1;
  return { legal: true };
}
function finishRound(game, success, guesserSeat = null) {
  const winners = success
    ? game.mode === 'cooperative' ? [...game.challengerSeats] : [guesserSeat]
    : [game.drawerSeat];
  for (const seat of winners) game.scores[seat] += 1;
  const result = {
    roundNumber: game.roundNumber, category: game.category, secret: game.secret,
    drawerSeat: game.drawerSeat, success, guesserSeat, winners, scores: { ...game.scores },
  };
  game.roundResults.push(result);
  game.pendingGuess = null;
  game.phase = 'result';
  game.winner = success ? guesserSeat : game.drawerSeat;
  game.winners = [...winners];
  if (game.roundNumber === game.totalRounds) {
    const max = Math.max(...Object.values(game.scores));
    game.winners = game.seats.filter(seat => game.scores[seat] === max);
    game.status = 'finished';
  } else game.status = 'round-ended';
  return { legal: true, roundResult: { ...result }, finished: game.status === 'finished', winners: [...game.winners] };
}
function judgeGuess(game, seat, correct) {
  if (game.status !== 'playing' || game.phase !== 'judging' || !game.pendingGuess) return { legal: false, reason: 'wrong-phase' };
  if (String(seat) !== game.drawerSeat) return { legal: false, reason: 'not-drawer' };
  if (typeof correct !== 'boolean') return { legal: false, reason: 'invalid-judgment' };
  const guess = game.pendingGuess;
  game.guessHistory.push({ ...guess, correct });
  game.pendingGuess = null;
  game.moveCount += 1;
  if (correct) return finishRound(game, true, guess.seat);
  if (guess.final) {
    game.finalGuessIndex += 1;
    if (game.finalGuessIndex === game.finalGuessSeats.length) return finishRound(game, false);
    game.phase = 'final-guesses';
  } else {
    game.turnIndex = (game.turnIndex + 1) % game.challengerSeats.length;
    game.phase = 'asking';
  }
  return { legal: true, nextSeat: currentTurn(game) };
}
function nextRound(game, random = Math.random) {
  return beginRound(game, game.seats, null, random);
}
function publicState(game) {
  return {
    status: game.status, phase: game.phase, mode: game.mode,
    totalRounds: game.totalRounds, roundNumber: game.roundNumber,
    seats: [...game.seats], challengerSeats: [...game.challengerSeats], drawerSeat: game.drawerSeat,
    category: game.category, turnSeat: currentTurn(game), questionLimit: QUESTION_LIMIT,
    questionsUsed: game.questions.length + Number(Boolean(game.pendingQuestion)),
    questionsRemaining: QUESTION_LIMIT - game.questions.length - Number(Boolean(game.pendingQuestion)),
    questions: game.questions.map(q => ({ ...q })),
    pendingQuestion: game.pendingQuestion ? { ...game.pendingQuestion } : null,
    pendingGuess: game.pendingGuess ? { ...game.pendingGuess } : null,
    finalGuessesRemaining: game.finalGuessSeats.slice(game.finalGuessIndex),
    guessHistory: game.guessHistory.map(g => ({ ...g })),
    scores: { ...game.scores }, roundResults: game.roundResults.map(r => ({ ...r, winners: [...r.winners], scores: { ...r.scores } })),
    winner: game.winner, winners: [...game.winners], moveCount: game.moveCount,
    // Never expose the current round's secret, even to spectators or other challengers.
  };
}
function secretFor(game, seat) {
  return String(seat) === game.drawerSeat ? game.secret : null;
}
module.exports = { QUESTION_LIMIT, ANSWERS, CATEGORIES, recommendedRounds, create, configure, beginRound,
  nextRound, setSecret, currentTurn, submitQuestion, answerQuestion, submitGuess, judgeGuess,
  publicState, secretFor };
