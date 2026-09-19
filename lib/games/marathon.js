'use strict';

const crypto = require('node:crypto');

const metadata = {
  id: 'marathon',
  name: '마라톤',
  size: 0,
  rules: '2~6인(개인전) 또는 4인 2대2·6인 3대3·6인 2대2대2(팀전) 주사위 미션 레이스. 30칸 트랙을 먼저 통과하면 승리합니다. 주사위 1개를 굴려 이동하고, 도착한 칸(같은 칸 재방문 포함)마다 타이핑·기억력·반응·계산 중 하나의 미션이 매번 새로 나옵니다. 제한시간 안에 정답을 맞히면 그 자리에 머무르고, 시간 안에 못 맞히면 2칸 뒤로 물러나며 그 자리에서 새 미션이 바로 이어집니다. 30칸 이상에 도달하면 그 즉시 승리합니다. 팀전은 말 하나를 공유하며 팀원끼리 주사위를 돌아가며 굴리고, 미션은 팀원 누구나 함께 보고 제출할 수 있습니다(먼저 제출된 정답만 인정). 방장이 개인전/팀전과 난이도를 시작 전에 정합니다.',
};

const SEATS = ['1', '2', '3', '4', '5', '6'];
const FINISH_AT = 30;
const START_POSITION = 0;
const PENALTY_STEPS = 2;
const MISSION_TYPES = ['typing', 'memory', 'reflex', 'calculation'];
const REFLEX_OPTIONS = ['빨강', '파랑', '노랑', '초록'];

const DIFFICULTY = {
  easy: { typingMs: 22000, memoryLen: 4, memoryRevealMs: 5000, memoryMs: 18000, reflexMs: 6000, calcMs: 20000, calcRange: 20 },
  normal: { typingMs: 16000, memoryLen: 5, memoryRevealMs: 4000, memoryMs: 14000, reflexMs: 4500, calcMs: 15000, calcRange: 50 },
  hard: { typingMs: 11000, memoryLen: 6, memoryRevealMs: 3000, memoryMs: 11000, reflexMs: 3200, calcMs: 10000, calcRange: 100 },
};

const TYPING_BANK = [
  '오늘도 힘차게 달려봅시다', '느려도 꾸준히 완주하자', '토끼와 거북이 이야기',
  '마라톤은 끝까지 포기하지 않는 것', '한 칸 한 칸이 소중하다', '결승선이 눈앞에 있다',
  '주사위를 굴려 앞으로 전진', '팀워크가 승리를 만든다', '침착하게 입력해 주세요',
  '오타 없이 정확하게 적기', '반짝이는 트로피를 향해', '숨 고르고 다시 도전',
  '연습이 완벽을 만든다', '지금 이 순간에 집중하자', '작은 실수도 되돌아본다',
  '함께 달리면 더 즐겁다',
];

function shuffledSuffix(base, avoid) {
  const pool = base.filter((item) => item !== avoid);
  return pool.length ? pool : base;
}

function pickTyping(avoidPrompt) {
  const pool = shuffledSuffix(TYPING_BANK, avoidPrompt);
  return pool[crypto.randomInt(pool.length)];
}

function pickMemorySequence(length, avoidPrompt) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const seq = Array.from({ length }, () => crypto.randomInt(0, 10)).join('');
    if (seq !== avoidPrompt) return seq;
  }
  return Array.from({ length }, () => crypto.randomInt(0, 10)).join('');
}

function pickReflexCue(avoidPrompt) {
  const pool = shuffledSuffix(REFLEX_OPTIONS, avoidPrompt);
  return pool[crypto.randomInt(pool.length)];
}

function pickCalculation(range, avoidPrompt) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const useAdd = crypto.randomInt(0, 2) === 0;
    const a = crypto.randomInt(1, range + 1);
    const b = crypto.randomInt(1, range + 1);
    const prompt = useAdd ? `${a} + ${b}` : `${Math.max(a, b)} - ${Math.min(a, b)}`;
    if (prompt !== avoidPrompt) return { prompt, answer: String(useAdd ? a + b : Math.max(a, b) - Math.min(a, b)) };
  }
  const a = crypto.randomInt(1, range + 1);
  const b = crypto.randomInt(1, range + 1);
  return { prompt: `${a} + ${b}`, answer: String(a + b) };
}

// Every landing (forward roll or backward penalty alike, no tile is exempt) draws a brand-new
// mission of a uniformly random type, never repeating the immediately-previous prompt verbatim.
function drawMission(difficultyKey, previous) {
  const cfg = DIFFICULTY[difficultyKey] || DIFFICULTY.normal;
  const type = MISSION_TYPES[crypto.randomInt(MISSION_TYPES.length)];
  const avoidPrompt = previous?.type === type ? previous.prompt : null;
  if (type === 'typing') {
    const prompt = pickTyping(avoidPrompt);
    return { type, prompt, answer: prompt, timeLimitMs: cfg.typingMs };
  }
  if (type === 'memory') {
    const prompt = pickMemorySequence(cfg.memoryLen, avoidPrompt);
    return { type, prompt, answer: prompt, timeLimitMs: cfg.memoryMs, revealMs: cfg.memoryRevealMs };
  }
  if (type === 'reflex') {
    const cue = pickReflexCue(avoidPrompt);
    return { type, prompt: cue, answer: cue, timeLimitMs: cfg.reflexMs, options: [...REFLEX_OPTIONS] };
  }
  const calc = pickCalculation(cfg.calcRange, avoidPrompt);
  return { type, prompt: calc.prompt, answer: calc.answer, timeLimitMs: cfg.calcMs };
}

function normalizeAnswer(type, raw) {
  const text = String(raw ?? '').trim();
  if (type === 'typing') return text.replace(/\s+/g, ' ');
  if (type === 'memory') return text.replace(/\s+/g, '');
  if (type === 'calculation') return text.replace(/\s+/g, '');
  return text;
}

function create(options = {}) {
  return {
    status: 'selecting', round: Number(options.round || 1),
    mode: 'individual', teamLayout: null, difficulty: 'normal',
    seatOrder: [], groupOrder: [], groups: {}, rollerIndex: {},
    positions: {}, turnGroup: null, phase: null, mission: null,
    lastMission: null, deadlineAt: null, phaseId: 0,
    history: [], winner: null, moveCount: 0,
  };
}
function reset(game) {
  const round = Number(game.round || 1) + 1;
  Object.assign(game, create({ round }));
}

function configure(game, { mode, teamLayout, difficulty } = {}) {
  if (game.status !== 'selecting') return { legal: false, reason: 'already-started' };
  if (mode !== undefined) {
    if (!['individual', 'team'].includes(mode)) return { legal: false, reason: 'bad-mode' };
    game.mode = mode;
    if (mode === 'individual') game.teamLayout = null;
  }
  if (teamLayout !== undefined) {
    if (teamLayout !== null && !['2v2', '3v3', '2v2v2'].includes(teamLayout)) return { legal: false, reason: 'bad-layout' };
    game.teamLayout = teamLayout;
  }
  if (difficulty !== undefined) {
    if (!Object.hasOwn(DIFFICULTY, difficulty)) return { legal: false, reason: 'bad-difficulty' };
    game.difficulty = difficulty;
  }
  if (game.mode === 'team' && !game.teamLayout) return { legal: false, reason: 'layout-required' };
  return { legal: true, mode: game.mode, teamLayout: game.teamLayout, difficulty: game.difficulty };
}

// The seat -> team-letter mapping is purely positional (odd/even, or a 1-of-3 cycle), so seat
// buttons can show each seat's team up front and every player picks their own seat/team, exactly
// like every other numbered-seat game in this app already works.
function groupForSeat(teamLayout, seat) {
  const n = Number(seat);
  if (teamLayout === '2v2v2') return ['A', 'B', 'C'][(n - 1) % 3];
  return n % 2 ? 'A' : 'B';
}
function requiredSeatCount(teamLayout) {
  return teamLayout === '2v2' ? 4 : 6;
}

function start(game, seats) {
  if (game.status !== 'selecting') return { legal: false, reason: 'already-started' };
  const order = [...new Set((Array.isArray(seats) ? seats : []).map(String))]
    .filter((seat) => SEATS.includes(seat)).sort((a, b) => Number(a) - Number(b));
  if (game.mode === 'team') {
    if (!game.teamLayout) return { legal: false, reason: 'layout-required' };
    const need = requiredSeatCount(game.teamLayout);
    if (order.length !== need) return { legal: false, reason: 'team-seat-mismatch' };
    game.groups = {};
    for (const seat of order) {
      const g = groupForSeat(game.teamLayout, seat);
      if (!game.groups[g]) game.groups[g] = [];
      game.groups[g].push(seat);
    }
    game.groupOrder = Object.keys(game.groups).sort();
  } else {
    if (order.length < 2 || order.length > 6) return { legal: false, reason: 'player-count' };
    game.groups = Object.fromEntries(order.map((seat) => [seat, [seat]]));
    game.groupOrder = [...order];
  }
  game.seatOrder = order;
  game.rollerIndex = Object.fromEntries(game.groupOrder.map((g) => [g, 0]));
  game.positions = Object.fromEntries(game.groupOrder.map((g) => [g, START_POSITION]));
  game.turnGroup = game.groupOrder[0];
  game.phase = 'roll';
  game.mission = null;
  game.lastMission = null;
  game.status = 'playing';
  return { legal: true, groups: { ...game.groups }, groupOrder: [...game.groupOrder] };
}

function groupOf(game, seat) {
  seat = String(seat);
  for (const g of game.groupOrder) if (game.groups[g]?.includes(seat)) return g;
  return null;
}
function currentRoller(game) {
  const members = game.groups[game.turnGroup] || [];
  return members[game.rollerIndex[game.turnGroup] % members.length] || null;
}
function advanceTurn(game) {
  const idx = game.groupOrder.indexOf(game.turnGroup);
  const members = game.groups[game.turnGroup] || [];
  if (members.length > 1) game.rollerIndex[game.turnGroup] = (game.rollerIndex[game.turnGroup] + 1) % members.length;
  game.turnGroup = game.groupOrder[(idx + 1) % game.groupOrder.length];
  game.phase = 'roll';
  game.mission = null;
}
function finishGroup(game, group, now) {
  game.status = 'finished';
  game.winner = group;
  game.turnGroup = null;
  game.phase = 'finished';
  game.mission = null;
  game.deadlineAt = null;
  game.phaseId += 1;
  game.history.push({ type: 'finish', group, at: now });
  if (game.history.length > 40) game.history.shift();
}
function triggerMission(game, group, now) {
  const mission = drawMission(game.difficulty, game.lastMission);
  game.mission = { ...mission, group, attempts: 0 };
  game.lastMission = { type: mission.type, prompt: mission.prompt };
  game.phase = 'mission';
  game.deadlineAt = now + mission.timeLimitMs;
  game.phaseId += 1;
}
function landOn(game, group, now) {
  const pos = game.positions[group];
  if (pos >= FINISH_AT) { finishGroup(game, group, now); return; }
  triggerMission(game, group, now);
}

function rollDice(game, seat, expectedPhaseId, now = Date.now()) {
  tick(game, now);
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (game.phase !== 'roll') return { legal: false, reason: 'must-answer' };
  const group = groupOf(game, seat);
  if (!group) return { legal: false, reason: 'not-player' };
  if (group !== game.turnGroup) return { legal: false, reason: 'not-your-turn' };
  if (currentRoller(game) !== String(seat)) return { legal: false, reason: 'not-your-roll' };
  if (Number(expectedPhaseId) !== game.phaseId) return { legal: false, reason: 'stale' };
  const roll = crypto.randomInt(1, 7);
  game.positions[group] += roll;
  game.moveCount += 1;
  game.history.push({ type: 'roll', group, seat: String(seat), roll, position: game.positions[group], at: now });
  if (game.history.length > 40) game.history.shift();
  landOn(game, group, now);
  return { legal: true, roll, position: game.positions[group], finished: game.status === 'finished' };
}

function submitAnswer(game, seat, rawAnswer, expectedPhaseId, now = Date.now()) {
  tick(game, now);
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (game.phase !== 'mission' || !game.mission) return { legal: false, reason: 'no-mission' };
  const group = groupOf(game, seat);
  if (!group) return { legal: false, reason: 'not-player' };
  if (group !== game.mission.group) return { legal: false, reason: 'not-your-mission' };
  if (Number(expectedPhaseId) !== game.phaseId) return { legal: false, reason: 'stale' };
  if (now >= game.deadlineAt) return { legal: false, reason: 'time-up' };
  game.mission.attempts += 1;
  const correct = normalizeAnswer(game.mission.type, rawAnswer) === normalizeAnswer(game.mission.type, game.mission.answer);
  if (!correct) return { legal: true, correct: false };
  const answer = game.mission.answer;
  game.history.push({ type: 'mission-success', group, seat: String(seat), missionType: game.mission.type, at: now });
  if (game.history.length > 40) game.history.shift();
  advanceTurn(game);
  return { legal: true, correct: true, answer };
}

// Server-clock-driven: a mission whose deadline has passed fails automatically, applies the
// fixed 2-step penalty, and -- per the confirmed rule -- immediately draws a fresh mission on
// whatever tile the penalty lands on (never a bare pass-through, and no tile is ever exempt).
function tick(game, now = Date.now()) {
  let changed = false;
  let guard = 0;
  while (game.status === 'playing' && game.phase === 'mission' && game.deadlineAt !== null && now >= game.deadlineAt && guard++ < 60) {
    changed = true;
    const group = game.mission.group;
    const answer = game.mission.answer;
    game.history.push({ type: 'mission-timeout', group, missionType: game.mission.type, answer, at: game.deadlineAt });
    if (game.history.length > 40) game.history.shift();
    game.positions[group] = Math.max(0, game.positions[group] - PENALTY_STEPS);
    landOn(game, group, game.deadlineAt);
  }
  return changed;
}

function publicState(game, viewerSeat = null) {
  const seat = game.seatOrder.includes(String(viewerSeat)) ? String(viewerSeat) : null;
  const myGroup = seat ? groupOf(game, seat) : null;
  const missionVisible = game.phase === 'mission' && game.mission;
  return {
    status: game.status, round: game.round, mode: game.mode, teamLayout: game.teamLayout, difficulty: game.difficulty,
    seatOrder: [...game.seatOrder], groupOrder: [...game.groupOrder], groups: Object.fromEntries(game.groupOrder.map((g) => [g, [...game.groups[g]]])),
    positions: { ...game.positions }, turnGroup: game.turnGroup,
    currentRoller: game.status === 'playing' ? currentRoller(game) : null,
    phase: game.phase, deadlineAt: game.deadlineAt, phaseId: game.phaseId,
    myGroup, myTurn: Boolean(myGroup && myGroup === game.turnGroup),
    // The mission prompt (the puzzle itself) is public -- teammates and observers can all see it
    // and, for team mode, any teammate may answer. Only the correct answer stays hidden here; it
    // is revealed solely through submitAnswer()'s own successful response, never broadcast state.
    mission: missionVisible ? { type: game.mission.type, prompt: game.mission.prompt, timeLimitMs: game.mission.timeLimitMs, revealMs: game.mission.revealMs, options: game.mission.options, group: game.mission.group, attempts: game.mission.attempts } : null,
    history: game.history.slice(-12).map((entry) => ({ ...entry })),
    winner: game.winner, moveCount: game.moveCount, lastPass: null,
    paused: Boolean(game.paused), disconnectedSeats: game.disconnectedSeats || [],
    endReason: game.endReason || null, disconnectedAtEnd: game.disconnectedAtEnd || [],
  };
}

function moveError(reason) {
  const errors = {
    'already-started': '이미 게임이 시작되었습니다.', 'bad-mode': '개인전 또는 팀전 중에서 선택해 주세요.',
    'bad-layout': '2대2, 3대3, 2대2대2 중에서 선택해 주세요.', 'bad-difficulty': '난이도를 다시 선택해 주세요.',
    'layout-required': '팀전은 팀 구성을 먼저 선택해야 합니다.',
    'team-seat-mismatch': '선택한 팀 구성 인원수와 자리 선택 인원이 일치해야 시작할 수 있습니다.',
    'player-count': '개인전은 2명 이상 6명 이하가 자리를 선택해야 시작할 수 있습니다.',
    'not-playing': '지금은 마라톤을 진행할 수 없습니다.', 'must-answer': '먼저 미션에 답해야 합니다.',
    'not-player': '관전자는 참여할 수 없습니다.', 'not-your-turn': '우리 팀(나)의 차례가 아닙니다.',
    'not-your-roll': '이번에 주사위를 굴릴 차례가 아닙니다.', stale: '이전 단계의 요청입니다. 화면을 새로고침해 주세요.',
    'no-mission': '지금은 답할 미션이 없습니다.', 'not-your-mission': '우리 팀(나)의 미션이 아닙니다.', 'time-up': '제한시간이 종료되었습니다.',
  };
  return errors[reason] || '마라톤 요청을 처리할 수 없습니다.';
}

module.exports = {
  ...metadata, SEATS, FINISH_AT, DIFFICULTY, MISSION_TYPES,
  create, reset, configure, start, groupForSeat, requiredSeatCount, groupOf, currentRoller,
  rollDice, submitAnswer, tick, publicState, moveError,
};
