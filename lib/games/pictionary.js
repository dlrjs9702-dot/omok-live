'use strict';

const crypto = require('crypto');

const metadata = {
  id: 'pictionary',
  name: '그림 맞히기',
  size: 0,
  rules: '2~8인 그림 맞히기. 라운드마다 한 명이 출제자가 되어 서버가 무작위로 정한 제시어를 90초 동안 그림으로 표현하고, 나머지 참가자는 정답을 추측합니다. 정답을 맞히면 100점, 출제자는 정답자 1명당 50점을 얻습니다. 참가자 전원이 한 번씩 출제자를 맡는 1순환이 끝나면 총점이 가장 높은 사람이 승리합니다.',
};

const ROUND_MS = 90 * 1000;
const REVEAL_MS = 6 * 1000;
const MAX_STROKES = 500;
const MAX_POINTS_PER_STROKE = 400;

const WORDS = [
  '사과', '자동차', '고양이', '비행기', '우산', '피자', '학교', '농구공',
  '나무', '집', '자전거', '시계', '안경', '모자', '컵',
  '신발', '기차', '배', '꽃', '눈사람', '축구공', '냉장고', '침대', '의자',
  '텔레비전', '전화기', '가방', '연필', '책', '태양', '달', '별', '무지개',
  '바나나', '수박', '딸기', '아이스크림', '케이크', '햄버거', '커피',
  '강아지', '토끼', '코끼리', '기린', '사자', '호랑이', '펭귄', '물고기',
  '나비', '거북이', '풍선', '열쇠', '지갑', '카메라', '기타', '피아노',
  '우체통', '신호등', '소방차', '구급차', '병원', '학용품', '칫솔',
];

function pickWord(exclude) {
  const pool = exclude ? WORDS.filter((w) => w !== exclude) : WORDS;
  return pool[crypto.randomInt(0, pool.length)];
}

function create() {
  return {
    status: 'selecting',
    phase: null,
    round: 1,
    roundNumber: 0,
    seatOrder: [],
    drawerIndex: -1,
    drawerSeat: null,
    word: null,
    strokes: [],
    correctGuessers: [],
    scores: {},
    roundEndsAt: null,
    revealEndsAt: null,
    lastRound: null,
    winner: null,
    moves: [],
  };
}

function reset(game) {
  const round = Number(game.round || 1) + 1;
  Object.assign(game, create(), { round });
}

function normalizeSeats(seats) {
  return [...new Set((Array.isArray(seats) ? seats : []).map(String)
    .filter((seat) => /^[1-8]$/.test(seat)))];
}

function start(game, seats) {
  if (game.status !== 'selecting') return { legal: false, reason: 'already-started' };
  const order = normalizeSeats(seats);
  if (order.length < 2 || order.length > 8) return { legal: false, reason: 'not-enough-players' };
  // Randomize draw order so the drawer sequence isn't predictable from seat numbers.
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  game.seatOrder = order;
  game.scores = Object.fromEntries(order.map((seat) => [seat, 0]));
  game.drawerIndex = 0;
  game.roundNumber = 1;
  game.status = 'playing';
  beginRound(game);
  return { legal: true, drawerSeat: game.drawerSeat };
}

function beginRound(game) {
  game.drawerSeat = game.seatOrder[game.drawerIndex];
  game.word = pickWord();
  game.strokes = [];
  game.correctGuessers = [];
  game.phase = 'drawing';
  game.roundEndsAt = Date.now() + ROUND_MS;
  game.revealEndsAt = null;
  game.lastRound = null;
}

function eligibleGuesserCount(game) {
  return Math.max(0, game.seatOrder.length - 1);
}

function endRound(game) {
  if (game.status !== 'playing' || game.phase !== 'drawing') return { legal: false, reason: 'not-drawing' };
  const drawerBonus = game.correctGuessers.length * 50;
  if (drawerBonus > 0) game.scores[game.drawerSeat] = (game.scores[game.drawerSeat] || 0) + drawerBonus;
  game.lastRound = {
    word: game.word,
    drawerSeat: game.drawerSeat,
    correctGuessers: [...game.correctGuessers],
    drawerBonus,
  };
  game.phase = 'reveal';
  game.revealEndsAt = Date.now() + REVEAL_MS;
  game.roundEndsAt = null;
  return { legal: true };
}

function advance(game) {
  if (game.status !== 'playing' || game.phase !== 'reveal') return { legal: false, reason: 'not-reveal' };
  game.drawerIndex += 1;
  game.roundNumber += 1;
  if (game.drawerIndex >= game.seatOrder.length) {
    const top = Math.max(...Object.values(game.scores));
    game.winner = game.seatOrder.filter((seat) => game.scores[seat] === top);
    game.status = 'finished';
    game.phase = null;
    game.drawerSeat = null;
    game.word = null;
    game.roundEndsAt = null;
    game.revealEndsAt = null;
    return { legal: true, finished: true, winner: game.winner };
  }
  beginRound(game);
  return { legal: true, finished: false, drawerSeat: game.drawerSeat };
}

function addStroke(game, seat, stroke) {
  if (game.status !== 'playing' || game.phase !== 'drawing') return { legal: false, reason: 'not-drawing' };
  if (seat !== game.drawerSeat) return { legal: false, reason: 'not-drawer' };
  if (Date.now() > game.roundEndsAt) return { legal: false, reason: 'time-up' };
  if (!stroke || !Array.isArray(stroke.points) || !stroke.points.length) return { legal: false, reason: 'bad-stroke' };
  if (game.strokes.length >= MAX_STROKES) return { legal: false, reason: 'too-many-strokes' };
  const points = stroke.points.slice(0, MAX_POINTS_PER_STROKE)
    .map((pt) => [Number(pt[0]), Number(pt[1])])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1);
  if (!points.length) return { legal: false, reason: 'bad-stroke' };
  const color = typeof stroke.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(stroke.color) ? stroke.color : '#111111';
  const width = Number.isFinite(Number(stroke.width)) ? Math.min(24, Math.max(1, Number(stroke.width))) : 4;
  const tool = stroke.tool === 'eraser' ? 'eraser' : 'pen';
  game.strokes.push({ points, color, width, tool });
  return { legal: true };
}

function clearCanvas(game, seat) {
  if (game.status !== 'playing' || game.phase !== 'drawing') return { legal: false, reason: 'not-drawing' };
  if (seat !== game.drawerSeat) return { legal: false, reason: 'not-drawer' };
  game.strokes = [];
  return { legal: true };
}

function submitGuess(game, seat, rawGuess) {
  if (game.status !== 'playing' || game.phase !== 'drawing') return { legal: false, reason: 'not-drawing' };
  if (seat === game.drawerSeat) return { legal: false, reason: 'drawer-cannot-guess' };
  if (!game.seatOrder.includes(seat)) return { legal: false, reason: 'not-a-player' };
  if (game.correctGuessers.includes(seat)) return { legal: false, reason: 'already-guessed' };
  if (Date.now() > game.roundEndsAt) return { legal: false, reason: 'time-up' };
  const guess = String(rawGuess || '').trim();
  if (!guess) return { legal: false, reason: 'empty-guess' };
  if (guess.length > 40) return { legal: false, reason: 'too-long' };
  const normalize = (s) => s.replace(/\s+/g, '').toLowerCase();
  const correct = normalize(guess) === normalize(game.word);
  if (!correct) return { legal: true, correct: false };
  game.scores[seat] = (game.scores[seat] || 0) + 100;
  game.correctGuessers.push(seat);
  const allGuessed = game.correctGuessers.length >= eligibleGuesserCount(game);
  return { legal: true, correct: true, allGuessed };
}

function publicState(game) {
  return {
    status: game.status,
    phase: game.phase,
    round: game.round,
    roundNumber: game.roundNumber,
    totalRounds: game.seatOrder.length,
    seatOrder: [...game.seatOrder],
    drawerSeat: game.drawerSeat,
    strokes: game.strokes.map((s) => ({ ...s, points: s.points.map((p) => [...p]) })),
    correctGuessers: [...game.correctGuessers],
    scores: { ...game.scores },
    roundEndsAt: game.roundEndsAt,
    revealEndsAt: game.revealEndsAt,
    lastRound: game.lastRound ? { ...game.lastRound, correctGuessers: [...game.lastRound.correctGuessers] } : null,
    winner: game.winner,
    moveCount: game.roundNumber,
    lastPass: null,
  };
}

function wordFor(game, seat) {
  return seat && seat === game.drawerSeat ? game.word : null;
}

function moveError(reason) {
  if (reason === 'not-enough-players') return '그림 맞히기는 2명 이상 8명 이하가 자리를 선택해야 시작할 수 있습니다.';
  if (reason === 'already-started') return '게임 시작 후에는 설정을 변경할 수 없습니다.';
  if (reason === 'not-drawing') return '지금은 그림을 그릴 수 있는 시간이 아닙니다.';
  if (reason === 'not-reveal') return '아직 결과를 공개할 시점이 아닙니다.';
  if (reason === 'not-drawer') return '출제자만 그림을 그릴 수 있습니다.';
  if (reason === 'time-up') return '제한 시간이 종료되었습니다.';
  if (reason === 'bad-stroke') return '그림 데이터가 올바르지 않습니다.';
  if (reason === 'too-many-strokes') return '한 라운드에 그릴 수 있는 획 수를 초과했습니다.';
  if (reason === 'drawer-cannot-guess') return '출제자는 정답을 제출할 수 없습니다.';
  if (reason === 'not-a-player') return '관전자는 정답을 제출할 수 없습니다.';
  if (reason === 'already-guessed') return '이미 정답을 맞혔습니다.';
  if (reason === 'empty-guess') return '정답을 입력해 주세요.';
  if (reason === 'too-long') return '정답은 40자 이하로 입력해 주세요.';
  return '그림 맞히기 요청을 처리할 수 없습니다.';
}

module.exports = {
  ...metadata,
  create,
  reset,
  start,
  beginRound,
  endRound,
  advance,
  addStroke,
  clearCanvas,
  submitGuess,
  publicState,
  wordFor,
  moveError,
};
