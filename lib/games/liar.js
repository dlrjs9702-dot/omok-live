'use strict';

const crypto = require('node:crypto');

const metadata = {
  id: 'liar',
  name: '라이어게임',
  size: 0,
  rules: '3~8명이 참여합니다. 시민은 제시어를 알고 라이어 1명은 모릅니다. 참가자마다 순서대로 힌트를 두 번 말한 뒤 30초간 비밀 투표합니다. 동률이면 후보만 추가 힌트를 말하고 한 번 재투표합니다. 라이어를 찾아도 라이어가 제시어를 맞히면 라이어가 승리합니다. 방장은 1판 또는 3판을 선택합니다.',
};
const HINT_MS = 60_000;
const VOTE_MS = 30_000;
const GUESS_MS = 30_000;
const REVEAL_MS = 6_000;
const WORDS = [
  '김치찌개', '비빔밥', '떡볶이', '삼겹살', '김밥', '라면', '피자', '햄버거', '아이스크림', '수박',
  '사과', '바나나', '딸기', '커피', '우유', '만두', '팥빙수', '계란말이', '치킨', '초밥',
  '고양이', '강아지', '토끼', '코끼리', '기린', '펭귄', '호랑이', '사자', '돌고래', '거북이',
  '학교', '도서관', '병원', '공항', '기차역', '영화관', '놀이공원', '수영장', '편의점', '박물관',
  '우산', '지갑', '핸드폰', '냉장고', '청소기', '책가방', '연필', '선풍기', '시계', '안경',
  '축구', '농구', '야구', '배드민턴', '테니스', '수영', '마라톤', '볼링', '태권도', '탁구',
];

function create(options = {}) {
  return {
    status: 'selecting', phase: null, totalRounds: options.totalRounds === 3 ? 3 : 1,
    round: Number(options.round || 1), roundNumber: 0, players: [], scores: {}, usedWords: [],
    liarSeat: null, word: null, hintOrder: [], hintIndex: 0, hints: [],
    votes: {}, voteHistory: [], tiedCandidates: [], revoteUsed: false, guessSubmitted: false,
    deadlineAt: null, phaseId: 0, lastResult: null, results: [], winner: null, winningSide: null,
    moveCount: 0,
  };
}
function reset(game) {
  const totalRounds = game.totalRounds;
  const round = Number(game.round || 1) + 1;
  Object.assign(game, create({ totalRounds, round }));
}
function setRounds(game, totalRounds) {
  if (game.status !== 'selecting') return { legal: false, reason: 'started' };
  if (totalRounds !== 1 && totalRounds !== 3) return { legal: false, reason: 'bad-rounds' };
  game.totalRounds = totalRounds;
  return { legal: true };
}
function phase(game, name, endsAt) {
  game.phase = name;
  game.deadlineAt = endsAt;
  game.phaseId += 1;
}
function beginRound(game, now) {
  game.roundNumber += 1;
  game.liarSeat = game.players[crypto.randomInt(game.players.length)];
  const available = WORDS.filter(word => !game.usedWords.includes(word));
  game.word = available[crypto.randomInt(available.length)];
  game.usedWords.push(game.word);
  game.hintOrder = [...game.players];
  game.hintIndex = 0;
  game.hints = [];
  game.votes = {};
  game.voteHistory = [];
  game.tiedCandidates = [];
  game.revoteUsed = false;
  game.guessSubmitted = false;
  game.lastResult = null;
  game.winningSide = null;
  phase(game, 'hint1', now + HINT_MS);
}
function start(game, seats, now = Date.now()) {
  if (game.status !== 'selecting') return { legal: false, reason: 'started' };
  const players = [...new Set((Array.isArray(seats) ? seats : []).map(String))]
    .filter(seat => /^[1-8]$/.test(seat)).sort((a, b) => Number(a) - Number(b));
  if (players.length < 3 || players.length > 8) return { legal: false, reason: 'player-count' };
  game.players = players;
  game.scores = Object.fromEntries(players.map(seat => [seat, 0]));
  game.status = 'playing';
  beginRound(game, now);
  return { legal: true };
}
function currentSpeaker(game) {
  return ['hint1', 'hint2', 'extraHint'].includes(game.phase) ? game.hintOrder[game.hintIndex] : null;
}
function nextHint(game, now) {
  game.hintIndex += 1;
  if (game.hintIndex < game.hintOrder.length) {
    phase(game, game.phase, now + HINT_MS);
  } else if (game.phase === 'hint1') {
    game.hintIndex = 0;
    phase(game, 'hint2', now + HINT_MS);
  } else {
    game.votes = {};
    phase(game, game.phase === 'extraHint' ? 'revote' : 'vote', now + VOTE_MS);
  }
}
function actionReady(game, seat, expectedPhaseId, allowed) {
  if (game.status !== 'playing' || !allowed.includes(game.phase)) return 'wrong-phase';
  if (!game.players.includes(String(seat))) return 'not-player';
  if (Number(expectedPhaseId) !== game.phaseId) return 'stale';
  if (Date.now() >= game.deadlineAt) return 'time-up';
  return null;
}
function submitHint(game, seat, raw, expectedPhaseId, now = Date.now()) {
  tick(game, now);
  const error = actionReady(game, seat, expectedPhaseId, ['hint1', 'hint2', 'extraHint']);
  if (error) return { legal: false, reason: error };
  if (currentSpeaker(game) !== String(seat)) return { legal: false, reason: 'not-turn' };
  if (now >= game.deadlineAt) return { legal: false, reason: 'time-up' };
  if (typeof raw !== 'string' || !raw.trim() || raw.trim().length > 100) return { legal: false, reason: 'bad-hint' };
  game.hints.push({ seat: String(seat), stage: game.phase, text: raw.trim(), timedOut: false });
  game.moveCount += 1;
  nextHint(game, now);
  return { legal: true };
}
function tally(game, now) {
  const counts = Object.fromEntries((game.phase === 'revote' ? game.tiedCandidates : game.players)
    .map(seat => [seat, 0]));
  for (const candidate of Object.values(game.votes)) if (candidate in counts) counts[candidate] += 1;
  const ballot = { stage: game.phase, counts, votes: { ...game.votes } };
  game.voteHistory.push(ballot);
  const high = Math.max(0, ...Object.values(counts));
  if (!high) return finishRound(game, 'liar', 'no-votes', now);
  const leaders = Object.keys(counts).filter(seat => counts[seat] === high);
  if (leaders.length > 1) {
    if (game.revoteUsed) return finishRound(game, 'liar', 'revote-tie', now);
    game.revoteUsed = true;
    game.tiedCandidates = leaders;
    game.hintOrder = game.players.filter(seat => leaders.includes(seat));
    game.hintIndex = 0;
    game.votes = {};
    phase(game, 'extraHint', now + HINT_MS);
    return { legal: true, tie: true };
  }
  if (leaders[0] !== game.liarSeat) return finishRound(game, 'liar', 'wrong-person', now);
  game.votes = {};
  phase(game, 'guess', now + GUESS_MS);
  return { legal: true, guessing: true };
}
function submitVote(game, seat, target, expectedPhaseId, now = Date.now()) {
  tick(game, now);
  const error = actionReady(game, seat, expectedPhaseId, ['vote', 'revote']);
  if (error) return { legal: false, reason: error };
  seat = String(seat); target = String(target);
  if (now >= game.deadlineAt) return { legal: false, reason: 'time-up' };
  if (Object.hasOwn(game.votes, seat)) return { legal: false, reason: 'already-voted' };
  const targets = game.phase === 'revote' ? game.tiedCandidates : game.players;
  if (target === seat || !targets.includes(target)) return { legal: false, reason: 'bad-vote' };
  game.votes[seat] = target;
  game.moveCount += 1;
  if (Object.keys(game.votes).length === game.players.length) tally(game, now);
  return { legal: true };
}
function finishRound(game, winningSide, reason, now) {
  const result = {
    roundNumber: game.roundNumber, liarSeat: game.liarSeat, word: game.word,
    winningSide, reason, voteHistory: game.voteHistory.map(v => ({ stage: v.stage, counts: { ...v.counts }, votes: { ...v.votes } })),
  };
  for (const seat of game.players) {
    if ((seat === game.liarSeat ? 'liar' : 'citizen') === winningSide) game.scores[seat] += 1;
  }
  game.results.push(result);
  game.lastResult = result;
  game.winningSide = winningSide;
  game.liarSeat = null;
  game.word = null;
  game.votes = {};
  if (game.roundNumber >= game.totalRounds) {
    const highest = Math.max(...Object.values(game.scores));
    game.winner = game.players.filter(seat => game.scores[seat] === highest);
    game.status = 'finished';
    phase(game, 'finished', null);
    return { legal: true, finished: true };
  }
  phase(game, 'reveal', now + REVEAL_MS);
  return { legal: true, finished: false };
}
function submitGuess(game, seat, raw, expectedPhaseId, now = Date.now()) {
  tick(game, now);
  const error = actionReady(game, seat, expectedPhaseId, ['guess']);
  if (error) return { legal: false, reason: error };
  if (String(seat) !== game.liarSeat) return { legal: false, reason: 'not-liar' };
  if (game.guessSubmitted) return { legal: false, reason: 'already-guessed' };
  if (now >= game.deadlineAt) return { legal: false, reason: 'time-up' };
  if (typeof raw !== 'string' || !raw.trim() || raw.trim().length > 40) return { legal: false, reason: 'bad-guess' };
  game.guessSubmitted = true;
  const correct = raw.trim() === game.word;
  finishRound(game, correct ? 'liar' : 'citizen', correct ? 'guessed' : 'wrong-guess', now);
  game.moveCount += 1;
  return { legal: true, correct };
}
function tick(game, now = Date.now()) {
  let changed = false;
  let guard = 0;
  while (game.status === 'playing' && game.deadlineAt !== null && now >= game.deadlineAt && guard++ < 100) {
    const expired = game.deadlineAt;
    changed = true;
    if (['hint1', 'hint2', 'extraHint'].includes(game.phase)) {
      game.hints.push({ seat: currentSpeaker(game), stage: game.phase, text: '시간 초과 — 힌트 없음', timedOut: true });
      nextHint(game, expired);
    } else if (game.phase === 'vote' || game.phase === 'revote') tally(game, expired);
    else if (game.phase === 'guess') finishRound(game, 'citizen', 'guess-timeout', expired);
    else if (game.phase === 'reveal') beginRound(game, expired);
    else break;
  }
  return changed;
}
function publicState(game, viewerSeat = null) {
  const seat = game.players.includes(String(viewerSeat)) ? String(viewerSeat) : null;
  const active = game.status === 'playing' && game.phase !== 'reveal';
  const currentVote = game.phase === 'vote' || game.phase === 'revote';
  return {
    status: game.status, phase: game.phase, totalRounds: game.totalRounds,
    round: game.round, roundNumber: game.roundNumber, players: [...game.players],
    scores: { ...game.scores }, role: active && seat ? (seat === game.liarSeat ? 'liar' : 'citizen') : null,
    myWord: active && seat && seat !== game.liarSeat ? game.word : null,
    currentSpeaker: currentSpeaker(game), deadlineAt: game.deadlineAt, phaseId: game.phaseId,
    hints: game.hints.map(hint => ({ ...hint })),
    votedSeats: currentVote ? Object.keys(game.votes) : [],
    myVoted: currentVote && !!seat && Object.hasOwn(game.votes, seat),
    voteTargets: currentVote ? [...(game.phase === 'revote' ? game.tiedCandidates : game.players)] : [],
    tiedCandidates: [...game.tiedCandidates],
    voteHistory: game.voteHistory.map(v => ({ stage: v.stage, counts: { ...v.counts } })),
    canGuess: active && game.phase === 'guess' && !!seat && seat === game.liarSeat,
    lastResult: game.lastResult ? { ...game.lastResult, voteHistory: game.lastResult.voteHistory.map(v => ({ ...v, counts: { ...v.counts }, votes: { ...v.votes } })) } : null,
    results: game.results.map(r => ({ ...r, voteHistory: r.voteHistory.map(v => ({ ...v, counts: { ...v.counts }, votes: { ...v.votes } })) })),
    winner: game.winner ? [...game.winner] : null, winningSide: game.winningSide,
    moveCount: game.moveCount, lastPass: null,
    paused: Boolean(game.paused), disconnectedSeats: game.disconnectedSeats || [],
    endReason: game.endReason || null, disconnectedAtEnd: game.disconnectedAtEnd || [],
  };
}
function moveError(reason) {
  const errors = {
    started: '이미 게임이 시작되었습니다.', 'bad-rounds': '1판 또는 3판을 선택해 주세요.',
    'player-count': '라이어게임은 3~8명이 자리를 선택해야 시작할 수 있습니다.',
    'wrong-phase': '현재 진행 단계에서는 할 수 없는 행동입니다.', 'not-player': '관전자는 게임을 조작할 수 없습니다.',
    stale: '이전 단계의 요청입니다. 화면을 새로고침해 주세요.', 'time-up': '제한시간이 종료되었습니다.',
    'not-turn': '현재 발언 순서가 아닙니다.', 'bad-hint': '힌트는 1~100자로 입력해 주세요.',
    'already-voted': '이미 투표했습니다.', 'bad-vote': '자신을 제외한 투표 대상자를 선택해 주세요.',
    'not-liar': '라이어만 최종 추측할 수 있습니다.', 'already-guessed': '이미 추측했습니다.',
    'bad-guess': '제시어는 1~40자로 입력해 주세요.',
  };
  return errors[reason] || '라이어게임 요청을 처리할 수 없습니다.';
}
module.exports = { ...metadata, create, reset, setRounds, start, currentSpeaker, submitHint, submitVote, submitGuess, tick, publicState, moveError, HINT_MS, VOTE_MS, GUESS_MS };