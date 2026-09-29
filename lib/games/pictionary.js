'use strict';

const crypto = require('crypto');

const metadata = {
  id: 'pictionary',
  name: '그림 맞히기',
  size: 0,
  rules: '개인전 2~8명, 팀전 4·6·8명(홀수 자리 A팀·짝수 자리 B팀, 같은 인원). 출제자가 서버가 정한 제시어를 그림으로 표현하고 나머지는 전용 입력창으로 정답을 맞힙니다. 방장이 난이도·제한시간(60/90/120초)·카테고리 공개를 정합니다. 시간이 50% 남으면 글자 수, 25% 남으면 초성 힌트가 열리고, 첫 정답이 나오면 10초 추가 정답시간이 시작됩니다. 정답 점수는 남은 시간에 비례(1~100점)하고 첫 정답은 +20점, 출제자는 정답자 점수의 25%를 받습니다. 팀전에서 상대 팀 그림을 맞히면 절반만 받습니다. 전원이 한 번씩 출제하면 총점(팀전은 팀 총점)이 가장 높은 쪽이 승리합니다.',
};

const REVEAL_MS = 7 * 1000;
const AFTER_FIRST_MS = 10 * 1000;
const ROUND_SECONDS = [60, 90, 120];
const DIFFICULTIES = ['easy', 'normal', 'hard'];
const MAX_STROKES = 500;
const MAX_POINTS_PER_STROKE = 400;
const MAX_GUESS_LOG = 30;

// Server-managed word bank: difficulty -> category -> words. Own list, not copied from any game.
const WORD_BANK = {
  easy: {
    동물: ['고양이', '강아지', '토끼', '코끼리', '기린', '펭귄', '물고기', '나비', '거북이', '돼지'],
    음식: ['사과', '바나나', '수박', '딸기', '피자', '케이크', '햄버거', '아이스크림', '당근', '달걀'],
    사물: ['우산', '시계', '안경', '모자', '컵', '신발', '가방', '연필', '책', '열쇠', '풍선', '의자'],
    자연: ['나무', '꽃', '태양', '달', '별', '무지개', '구름', '눈사람'],
    탈것: ['자동차', '비행기', '자전거', '기차', '배', '버스'],
  },
  normal: {
    동물: ['호랑이', '사자', '문어', '고슴도치', '낙타', '부엉이', '다람쥐', '공룡'],
    음식: ['김밥', '라면', '떡볶이', '초밥', '팝콘', '도넛', '만두', '핫도그'],
    사물: ['냉장고', '텔레비전', '카메라', '기타', '피아노', '칫솔', '가위', '선풍기', '망원경', '자물쇠'],
    장소: ['학교', '병원', '놀이터', '도서관', '수영장', '등대', '캠핑장'],
    탈것: ['소방차', '구급차', '헬리콥터', '잠수함', '열기구', '트랙터'],
    자연: ['화산', '폭포', '사막', '번개', '파도'],
  },
  hard: {
    직업: ['소방관', '요리사', '우주비행사', '마술사', '의사', '화가', '경찰관', '택배기사'],
    행동: ['줄넘기', '낚시', '스키', '요가', '양치질', '윙크', '하품', '박수'],
    장소: ['엘리베이터', '지하철역', '영화관', '미용실', '편의점', '공항', '동물원'],
    사물: ['신호등', '우체통', '에스컬레이터', '회전목마', '허수아비', '모래시계', '나침반', '돋보기'],
    개념: ['생일', '여름방학', '겨울잠', '그림자', '메아리', '졸음'],
  },
};

const CHOSEONG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

function isHangul(ch) {
  const code = ch.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3;
}

function choseongOf(word) {
  return [...word].map((ch) => (isHangul(ch) ? CHOSEONG[Math.floor((ch.charCodeAt(0) - 0xac00) / 588)] : ch)).join('');
}

// Spaces, case and punctuation never decide a guess.
function normalizeAnswer(text) {
  return String(text || '').toLowerCase().replace(/[\s.,!?~'"`·\-_()[\]{}]/g, '');
}

// Hangul is compared jamo by jamo so "사가" is near "사과" but "사자" is not.
function jamo(text) {
  const out = [];
  for (const ch of text) {
    if (!isHangul(ch)) { out.push(ch); continue; }
    const n = ch.charCodeAt(0) - 0xac00;
    out.push(`c${Math.floor(n / 588)}`, `v${Math.floor((n % 588) / 28)}`);
    if (n % 28) out.push(`t${n % 28}`);
  }
  return out;
}

function editDistance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

function isCloseAnswer(guess, word) {
  const a = jamo(normalizeAnswer(guess));
  const b = jamo(normalizeAnswer(word));
  if (!a.length || b.length < 3) return false;
  return editDistance(a, b) <= (b.length >= 8 ? 2 : 1);
}

function teamOf(seat) {
  return Number(seat) % 2 === 1 ? 'A' : 'B';
}

function pickWord(game) {
  const categories = WORD_BANK[game.difficulty] || WORD_BANK.normal;
  const pool = [];
  for (const [category, words] of Object.entries(categories)) {
    for (const word of words) if (!game.usedWords.includes(word)) pool.push({ category, word });
  }
  // Every category of one difficulty holds more words than the 8 rounds a game can have.
  return pool[crypto.randomInt(0, pool.length)];
}

function create() {
  return {
    status: 'selecting',
    phase: null,
    round: 1,
    mode: 'individual',
    difficulty: 'normal',
    roundSeconds: 90,
    showCategory: true,
    roundNumber: 0,
    seatOrder: [],
    drawerIndex: -1,
    drawerSeat: null,
    word: null,
    category: null,
    usedWords: [],
    strokes: [],
    correctGuessers: [],
    roundAwards: [],
    guessLog: [],
    scores: {},
    roundStartedAt: null,
    deadlineAt: null,
    roundEndsAt: null,
    firstCorrectAt: null,
    hintLevel: 0,
    revealEndsAt: null,
    lastRound: null,
    winner: null,
    moves: [],
  };
}

function reset(game) {
  const round = Number(game.round || 1) + 1;
  const { mode, difficulty, roundSeconds, showCategory } = game;
  Object.assign(game, create(), { round, mode, difficulty, roundSeconds, showCategory });
}

function configure(game, { mode, difficulty, roundSeconds, showCategory } = {}) {
  if (game.status !== 'selecting') return { legal: false, reason: 'already-started' };
  if (mode !== undefined && !['individual', 'team'].includes(mode)) return { legal: false, reason: 'bad-config' };
  if (difficulty !== undefined && !DIFFICULTIES.includes(difficulty)) return { legal: false, reason: 'bad-config' };
  if (roundSeconds !== undefined && !ROUND_SECONDS.includes(Number(roundSeconds))) return { legal: false, reason: 'bad-config' };
  if (mode !== undefined) game.mode = mode;
  if (difficulty !== undefined) game.difficulty = difficulty;
  if (roundSeconds !== undefined) game.roundSeconds = Number(roundSeconds);
  if (showCategory !== undefined) game.showCategory = Boolean(showCategory);
  return { legal: true };
}

function normalizeSeats(seats) {
  return [...new Set((Array.isArray(seats) ? seats : []).map(String)
    .filter((seat) => /^[1-8]$/.test(seat)))];
}

// `seats` arrive in join order. Individual play keeps it; team play alternates A, B, A, B...
function start(game, seats, now = Date.now()) {
  if (game.status !== 'selecting') return { legal: false, reason: 'already-started' };
  let order = normalizeSeats(seats);
  if (game.mode === 'team') {
    const a = order.filter((seat) => teamOf(seat) === 'A');
    const b = order.filter((seat) => teamOf(seat) === 'B');
    if (![4, 6, 8].includes(order.length) || a.length !== b.length) return { legal: false, reason: 'team-seats' };
    order = a.flatMap((seat, i) => [seat, b[i]]);
  } else if (order.length < 2 || order.length > 8) {
    return { legal: false, reason: 'not-enough-players' };
  }
  game.seatOrder = order;
  game.scores = Object.fromEntries(order.map((seat) => [seat, 0]));
  game.usedWords = [];
  game.drawerIndex = 0;
  game.roundNumber = 1;
  game.status = 'playing';
  beginRound(game, now);
  return { legal: true, drawerSeat: game.drawerSeat };
}

function beginRound(game, now = Date.now()) {
  game.drawerSeat = game.seatOrder[game.drawerIndex];
  const picked = pickWord(game);
  game.word = picked.word;
  game.category = picked.category;
  game.usedWords.push(picked.word);
  game.strokes = [];
  game.correctGuessers = [];
  game.roundAwards = [];
  game.guessLog = [];
  game.phase = 'drawing';
  game.roundStartedAt = now;
  game.deadlineAt = now + game.roundSeconds * 1000;
  game.roundEndsAt = game.deadlineAt;
  game.firstCorrectAt = null;
  game.hintLevel = 0;
  game.revealEndsAt = null;
  game.lastRound = null;
}

function eligibleGuesserCount(game) {
  return Math.max(0, game.seatOrder.length - 1);
}

// 50% of the time left -> letter count, 25% left -> initial consonants. Frozen at the first correct answer.
function hintLevelAt(game, now) {
  const at = game.firstCorrectAt || now;
  const elapsed = (at - game.roundStartedAt) / (game.roundSeconds * 1000);
  return elapsed >= 0.75 ? 2 : elapsed >= 0.5 ? 1 : 0;
}

function updateHints(game, now = Date.now()) {
  if (game.status !== 'playing' || game.phase !== 'drawing') return false;
  const level = Math.max(game.hintLevel, hintLevelAt(game, now));
  if (level === game.hintLevel) return false;
  game.hintLevel = level;
  return true;
}

function drawerPoints(game) {
  return Math.round(game.roundAwards.reduce((sum, award) => sum + award.points, 0) * 0.25);
}

function teamTotals(game) {
  if (game.mode !== 'team') return null;
  const totals = { A: 0, B: 0 };
  for (const seat of game.seatOrder) totals[teamOf(seat)] += game.scores[seat] || 0;
  return totals;
}

function endRound(game) {
  if (game.status !== 'playing' || game.phase !== 'drawing') return { legal: false, reason: 'not-drawing' };
  const bonus = drawerPoints(game);
  if (bonus > 0) game.scores[game.drawerSeat] = (game.scores[game.drawerSeat] || 0) + bonus;
  game.lastRound = {
    word: game.word,
    category: game.category,
    drawerSeat: game.drawerSeat,
    correctGuessers: [...game.correctGuessers],
    awards: game.roundAwards.map((award) => ({ ...award })),
    drawerBonus: bonus,
    teamTotals: teamTotals(game),
  };
  game.phase = 'reveal';
  game.revealEndsAt = Date.now() + REVEAL_MS;
  game.roundEndsAt = null;
  return { legal: true };
}

function advance(game, now = Date.now()) {
  if (game.status !== 'playing' || game.phase !== 'reveal') return { legal: false, reason: 'not-reveal' };
  game.drawerIndex += 1;
  game.roundNumber += 1;
  if (game.drawerIndex >= game.seatOrder.length) {
    if (game.mode === 'team') {
      const totals = teamTotals(game);
      const top = Math.max(totals.A, totals.B);
      game.winner = game.seatOrder.filter((seat) => totals[teamOf(seat)] === top);
    } else {
      const top = Math.max(...Object.values(game.scores));
      game.winner = game.seatOrder.filter((seat) => game.scores[seat] === top);
    }
    game.status = 'finished';
    game.phase = null;
    game.drawerSeat = null;
    game.word = null;
    game.category = null;
    game.roundEndsAt = null;
    game.revealEndsAt = null;
    return { legal: true, finished: true, winner: game.winner };
  }
  beginRound(game, now);
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

function undoStroke(game, seat) {
  if (game.status !== 'playing' || game.phase !== 'drawing') return { legal: false, reason: 'not-drawing' };
  if (seat !== game.drawerSeat) return { legal: false, reason: 'not-drawer' };
  if (!game.strokes.length) return { legal: false, reason: 'nothing-to-undo' };
  game.strokes.pop();
  return { legal: true };
}

function submitGuess(game, seat, rawGuess, now = Date.now()) {
  if (game.status !== 'playing' || game.phase !== 'drawing') return { legal: false, reason: 'not-drawing' };
  if (seat === game.drawerSeat) return { legal: false, reason: 'drawer-cannot-guess' };
  if (!game.seatOrder.includes(seat)) return { legal: false, reason: 'not-a-player' };
  if (game.correctGuessers.includes(seat)) return { legal: false, reason: 'already-guessed' };
  if (now > game.roundEndsAt) return { legal: false, reason: 'time-up' };
  const guess = String(rawGuess || '').trim();
  if (!guess) return { legal: false, reason: 'empty-guess' };
  if (guess.length > 40) return { legal: false, reason: 'too-long' };
  if (normalizeAnswer(guess) !== normalizeAnswer(game.word)) {
    // A near miss is told only to its author and kept out of the shared log, so it never hints others.
    if (isCloseAnswer(guess, game.word)) return { legal: true, correct: false, close: true };
    game.guessLog.push({ seat, text: guess.slice(0, 20) });
    if (game.guessLog.length > MAX_GUESS_LOG) game.guessLog.shift();
    return { legal: true, correct: false, close: false };
  }
  const first = game.correctGuessers.length === 0;
  const ratio = Math.min(1, Math.max(0, (game.deadlineAt - now) / (game.roundSeconds * 1000)));
  let points = Math.max(1, Math.round(100 * ratio)) + (first ? 20 : 0);
  const crossTeam = game.mode === 'team' && teamOf(seat) !== teamOf(game.drawerSeat);
  if (crossTeam) points = Math.round(points / 2);
  game.scores[seat] = (game.scores[seat] || 0) + points;
  game.correctGuessers.push(seat);
  game.roundAwards.push({ seat, points, first, crossTeam });
  if (first) {
    game.hintLevel = Math.max(game.hintLevel, hintLevelAt(game, now));
    game.firstCorrectAt = now;
    game.roundEndsAt = now + AFTER_FIRST_MS;
  }
  const allGuessed = game.correctGuessers.length >= eligibleGuesserCount(game);
  return { legal: true, correct: true, first, points, allGuessed };
}

function publicState(game) {
  const drawing = game.status === 'playing' && game.phase === 'drawing' && game.word;
  return {
    status: game.status,
    phase: game.phase,
    round: game.round,
    mode: game.mode,
    difficulty: game.difficulty,
    roundSeconds: game.roundSeconds,
    showCategory: game.showCategory,
    teams: game.mode === 'team' ? Object.fromEntries(game.seatOrder.map((seat) => [seat, teamOf(seat)])) : null,
    teamTotals: teamTotals(game),
    roundNumber: game.roundNumber,
    totalRounds: game.seatOrder.length,
    seatOrder: [...game.seatOrder],
    drawerSeat: game.drawerSeat,
    category: drawing && game.showCategory ? game.category : null,
    hints: drawing ? {
      level: game.hintLevel,
      length: game.hintLevel >= 1 ? [...game.word].filter((ch) => ch.trim()).length : null,
      choseong: game.hintLevel >= 2 ? choseongOf(game.word) : null,
    } : null,
    strokes: game.strokes.map((s) => ({ ...s, points: s.points.map((p) => [...p]) })),
    correctGuessers: [...game.correctGuessers],
    roundAwards: game.roundAwards.map((award) => ({ ...award })),
    guessLog: game.guessLog.map((entry) => ({ ...entry })),
    scores: { ...game.scores },
    deadlineAt: game.deadlineAt,
    roundEndsAt: game.roundEndsAt,
    firstCorrectAt: game.firstCorrectAt,
    revealEndsAt: game.revealEndsAt,
    lastRound: game.lastRound ? {
      ...game.lastRound,
      correctGuessers: [...game.lastRound.correctGuessers],
      awards: game.lastRound.awards.map((award) => ({ ...award })),
    } : null,
    winner: game.winner,
    moveCount: game.roundNumber,
    lastPass: null,
    paused: Boolean(game.paused), disconnectedSeats: game.disconnectedSeats || [],
    endReason: game.endReason || null, disconnectedAtEnd: game.disconnectedAtEnd || [],
  };
}

function wordFor(game, seat) {
  return seat && seat === game.drawerSeat ? game.word : null;
}

function moveError(reason) {
  if (reason === 'not-enough-players') return '그림 맞히기 개인전은 2명 이상 8명 이하가 자리를 선택해야 시작할 수 있습니다.';
  if (reason === 'team-seats') return '팀전은 4·6·8명이 A팀(홀수 자리)과 B팀(짝수 자리)에 같은 인원으로 앉아야 시작할 수 있습니다.';
  if (reason === 'bad-config') return '그림 맞히기 설정 값이 올바르지 않습니다.';
  if (reason === 'already-started') return '게임 시작 후에는 설정을 변경할 수 없습니다.';
  if (reason === 'not-drawing') return '지금은 그림을 그릴 수 있는 시간이 아닙니다.';
  if (reason === 'not-reveal') return '아직 결과를 공개할 시점이 아닙니다.';
  if (reason === 'not-drawer') return '출제자만 그림을 그릴 수 있습니다.';
  if (reason === 'nothing-to-undo') return '되돌릴 획이 없습니다.';
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
  WORD_BANK,
  create,
  reset,
  configure,
  start,
  beginRound,
  updateHints,
  endRound,
  advance,
  addStroke,
  clearCanvas,
  undoStroke,
  submitGuess,
  publicState,
  wordFor,
  moveError,
  teamOf,
  choseongOf,
  isCloseAnswer,
};
