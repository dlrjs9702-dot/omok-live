'use strict';

// Three or four different digits (0-9), with a non-zero leading digit.
// Both players choose a secret; the server never sends an opponent's secret.
const metadata = {
  id: 'baseball',
  name: '숫자야구',
  size: 0,
  rules: '방을 만들 때 3자리 또는 4자리 숫자야구를 선택합니다. 첫 자리는 0이 아니며 모든 숫자는 서로 달라야 합니다. 선공·후공이 각자 비밀 숫자를 정하면 선공부터 상대 숫자를 번갈아 추측합니다. 숫자와 위치가 맞으면 스트라이크(S), 숫자만 맞으면 볼(B), 둘 다 없으면 아웃입니다. 선택한 자릿수만큼 스트라이크를 먼저 맞히면 승리하며 비밀 숫자는 본인에게만 보입니다.',
};

function normalizeDigitCount(value) {
  return Number(value) === 4 ? 4 : 3;
}

function validNumber(value, digitCount = 3) {
  const digits = normalizeDigitCount(digitCount);
  return typeof value === 'string'
    && new RegExp(`^[1-9][0-9]{${digits - 1}}$`).test(value)
    && new Set(value).size === digits;
}

function score(secret, guess, digitCount = 3) {
  const digits = normalizeDigitCount(digitCount);
  if (!validNumber(secret, digits) || !validNumber(guess, digits)) {
    throw new TypeError(`유효한 ${digits}자리 숫자가 필요합니다.`);
  }
  let strikes = 0;
  let balls = 0;
  for (let i = 0; i < digits; i += 1) {
    if (guess[i] === secret[i]) strikes += 1;
    else if (secret.includes(guess[i])) balls += 1;
  }
  return { strikes, balls };
}

function create(options = {}) {
  const digitCount = normalizeDigitCount(options.digitCount);
  return {
    size: 0,
    status: 'selecting',
    turn: null,
    winner: null,
    winningLine: null,
    board: [],
    moves: [],
    round: 1,
    digitCount,
    secrets: { black: null, white: null },
  };
}

function start(game) {
  if (game.status !== 'selecting') return;
  game.status = 'setup';
  game.turn = null;
}

function reset(game) {
  const nextRound = Number(game.round || 1) + 1;
  Object.assign(game, create({ digitCount: game.digitCount }), { round: nextRound });
}

function setSecret(game, color, secret) {
  if (game.status !== 'setup') return { legal: false, reason: 'not-setup' };
  if (color !== 'black' && color !== 'white') return { legal: false, reason: 'not-player' };
  if (!validNumber(secret, game.digitCount)) return { legal: false, reason: 'invalid-number' };
  if (game.secrets[color] !== null) return { legal: false, reason: 'already-set' };
  game.secrets[color] = secret;
  if (game.secrets.black !== null && game.secrets.white !== null) {
    game.status = 'playing';
    game.turn = 'black';
  }
  return { legal: true, ready: game.status === 'playing' };
}

function applyGuess(game, guess, color, at) {
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (color !== game.turn) return { legal: false, reason: 'not-your-turn' };
  if (!validNumber(guess, game.digitCount)) return { legal: false, reason: 'invalid-number' };
  const target = color === 'black' ? game.secrets.white : game.secrets.black;
  if (!validNumber(target, game.digitCount)) return { legal: false, reason: 'not-ready' };
  const result = score(target, guess, game.digitCount);
  game.moves.push({ color, guess, ...result, at });
  if (result.strikes === game.digitCount) {
    game.status = 'finished';
    game.winner = color;
    game.turn = null;
  } else {
    game.turn = color === 'black' ? 'white' : 'black';
  }
  return { legal: true, ...result, finished: game.status === 'finished' };
}

function moveError(reason) {
  if (reason === 'invalid-number') return '선택한 자릿수의 서로 다른 숫자를 입력해 주세요. 첫 자리는 0이 될 수 없습니다.';
  if (reason === 'already-set') return '비밀 숫자는 이번 판에 한 번만 정할 수 있습니다.';
  if (reason === 'not-setup') return '지금은 비밀 숫자를 정할 수 없습니다.';
  if (reason === 'not-ready') return '상대방이 비밀 숫자를 정할 때까지 기다려 주세요.';
  if (reason === 'not-your-turn') return '상대방 차례입니다.';
  if (reason === 'not-playing') return '지금은 추측할 수 없습니다.';
  return '현재 진행할 수 없는 요청입니다.';
}

function publicState(game) {
  return {
    size: 0,
    board: [],
    turn: game.turn,
    status: game.status,
    winner: game.winner,
    winningLine: null,
    moveCount: game.moves.length,
    lastMove: game.moves.at(-1) || null,
    round: game.round,
    digitCount: normalizeDigitCount(game.digitCount),
    legalMoves: [],
    scores: null,
    lastPass: null,
    ready: { black: game.secrets.black !== null, white: game.secrets.white !== null },
    guesses: game.moves.map(({ color, guess, strikes, balls, at }) => ({ color, guess, strikes, balls, at })),
    paused: Boolean(game.paused), disconnectedSeats: game.disconnectedSeats || [],
    endReason: game.endReason || null, disconnectedAtEnd: game.disconnectedAtEnd || [],
  };
}

module.exports = { ...metadata, validNumber, score, create, start, reset, setSecret, applyGuess, publicState, moveError };
