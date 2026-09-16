'use strict';

// Three different digits (0-9), with a non-zero leading digit.
// Both players choose a secret; the server never sends an opponent's secret.
const metadata = {
  id: 'baseball',
  name: '숫자야구',
  size: 0,
  rules: '3자리 숫자야구. 첫 자리는 0이 아닌 숫자, 세 숫자는 서로 달라야 합니다(0은 두 번째·세 번째 자리에 사용 가능). 선공·후공이 각자 비밀 숫자를 정하면 선공부터 상대 숫자를 번갈아 추측합니다. 숫자와 위치가 맞으면 스트라이크(S), 숫자만 맞으면 볼(B), 둘 다 없으면 아웃입니다. 먼저 3스트라이크를 맞힌 사람이 승리합니다. 비밀 숫자는 본인에게만 보입니다.',
};

function validNumber(value) {
  return typeof value === 'string' && /^[1-9][0-9]{2}$/.test(value) && new Set(value).size === 3;
}

function score(secret, guess) {
  if (!validNumber(secret) || !validNumber(guess)) throw new TypeError('유효한 3자리 숫자가 필요합니다.');
  let strikes = 0;
  let balls = 0;
  for (let i = 0; i < 3; i += 1) {
    if (guess[i] === secret[i]) strikes += 1;
    else if (secret.includes(guess[i])) balls += 1;
  }
  return { strikes, balls };
}

function create() {
  return {
    size: 0,
    status: 'selecting',
    turn: null,
    winner: null,
    winningLine: null,
    board: [],
    moves: [],
    round: 1,
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
  Object.assign(game, create(), { round: nextRound });
}

function setSecret(game, color, secret) {
  if (game.status !== 'setup') return { legal: false, reason: 'not-setup' };
  if (color !== 'black' && color !== 'white') return { legal: false, reason: 'not-player' };
  if (!validNumber(secret)) return { legal: false, reason: 'invalid-number' };
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
  if (!validNumber(guess)) return { legal: false, reason: 'invalid-number' };
  const target = color === 'black' ? game.secrets.white : game.secrets.black;
  if (!validNumber(target)) return { legal: false, reason: 'not-ready' };
  const result = score(target, guess);
  game.moves.push({ color, guess, ...result, at });
  if (result.strikes === 3) {
    game.status = 'finished';
    game.winner = color;
    game.turn = null;
  } else {
    game.turn = color === 'black' ? 'white' : 'black';
  }
  return { legal: true, ...result, finished: game.status === 'finished' };
}

function moveError(reason) {
  if (reason === 'invalid-number') return '서로 다른 숫자 3개를 입력해 주세요. 첫 자리는 0이 될 수 없습니다.';
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
    legalMoves: [],
    scores: null,
    lastPass: null,
    ready: { black: game.secrets.black !== null, white: game.secrets.white !== null },
    guesses: game.moves.map(({ color, guess, strikes, balls, at }) => ({ color, guess, strikes, balls, at })),
  };
}

module.exports = { ...metadata, validNumber, score, create, start, reset, setSecret, applyGuess, publicState, moveError };
