'use strict';

// v1.7.16 daily missions + first-win bonus (pure rules, no storage). Three missions per account and
// Asia/Seoul day are chosen by the server from POOL (deterministically from account + date, then kept in
// the stored day document), progress comes only from finished matches the server recorded, and a mission
// pays as soon as its target is reached (no claim button). The stores (lib/point-store.js) persist the
// day document and write the ledger rows; this file decides what changed and what is owed.

const crypto = require('node:crypto');

const MISSIONS_PER_DAY = 3;
const DAILY_REWARD_MIN = 8_000;
const DAILY_REWARD_MAX = 10_000;
const FIRST_WIN_REWARD = 5_000;
const FIRST_WIN_TITLE = '첫 승리 보너스';

const BOARD_WIN = ['omok', 'othello', 'connect4'];
const LIGHT_PLAY = ['yut', 'dots', 'bingo'];

const games = (c, types) => types.reduce((sum, type) => sum + (c.perGame[type]?.played || 0), 0);
const wins = (c, types) => types.reduce((sum, type) => sum + (c.perGame[type]?.wins || 0), 0);

// kind: two missions of the same kind never share a day. tier 'cond' missions need something specific
// (a game, the same opponent twice), so at most one is dealt per day.
const POOL = [
  { id: 'play3', kind: 'play', tier: 'base', title: '아무 게임 3판 정상 종료', short: '게임 3판', target: 3, reward: 3_000, measure: c => c.played },
  { id: 'play5', kind: 'play', tier: 'base', title: '아무 게임 5판 정상 종료', short: '게임 5판', target: 5, reward: 4_000, measure: c => c.played },
  { id: 'win1', kind: 'win', tier: 'base', title: '오늘 1승', short: '1승', target: 1, reward: 3_000, measure: c => c.wins },
  { id: 'win3', kind: 'win', tier: 'base', title: '오늘 3승', short: '3승', target: 3, reward: 4_000, measure: c => c.wins },
  { id: 'variety2', kind: 'variety', tier: 'base', title: '서로 다른 게임 2종 플레이', short: '다른 게임 2종', target: 2, reward: 2_000, measure: c => c.games.length },
  { id: 'variety3', kind: 'variety', tier: 'base', title: '서로 다른 게임 3종 플레이', short: '다른 게임 3종', target: 3, reward: 3_000, measure: c => c.games.length },
  { id: 'clean1', kind: 'clean', tier: 'base', title: '중도이탈 없이 게임 1판 완료', short: '이탈 없이 완료', target: 1, reward: 2_000, measure: c => c.clean },
  { id: 'rematch2', kind: 'rematch', tier: 'cond', title: '같은 상대와 2판 정상 완료', short: '같은 상대 2판', target: 2, reward: 2_000, measure: c => Math.max(0, ...Object.values(c.opps)) },
  { id: 'board_win', kind: 'game', tier: 'cond', title: '오목·오델로·사목 중 하나 1승', short: '보드 1승', target: 1, reward: 3_000, measure: c => wins(c, BOARD_WIN) },
  { id: 'light_play', kind: 'game', tier: 'cond', title: '윷놀이·점과 상자·빙고 중 하나 1판 완료', short: '1판 완료', target: 1, reward: 2_500, measure: c => games(c, LIGHT_PLAY) },
  ...[
    ['omok2v2', '오목 2vs2 1판 완료', 2_500], ['halligalli', '할리갈리 1판 완료', 2_500], ['baseball', '숫자야구 1판 완료', 2_000],
    ['davinci', '다빈치 코드 1판 완료', 2_500], ['pictionary', '그림 맞히기 1판 완료', 2_500], ['twentyquestions', '스무고개 1판 완료', 2_500],
    ['liar', '라이어게임 1판 완료', 2_500], ['oldmaid', '도둑잡기 1판 완료', 2_500], ['cityking', '랜드킹 1판 완료', 2_500],
    ['marathon', '마라톤 1판 완료', 2_500], ['gostop', '고스톱·맞고 1판 완료', 2_500],
  ].map(([type, title, reward]) => ({ id: `${type}_play`, kind: 'game', tier: 'cond', title, short: '1판 완료', target: 1, reward, measure: c => games(c, [type]) })),
];
const BY_ID = new Map(POOL.map(mission => [mission.id, mission]));
// v1.7.34: missions of a removed game are no longer drawn, but stay defined so a day already dealt with one still reads.
const RETIRED = new Set(['marathon_play']);
const DRAWABLE = POOL.filter(mission => !RETIRED.has(mission.id));

function rng(seedText) { // mulberry32 seeded from a hash: the same account and day always draw the same three
  let a = crypto.createHash('sha256').update(seedText).digest().readUInt32LE(0);
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Three missions of different kinds, at least two general ones, total reward within the daily target.
function pickMissions(userId, date) {
  const random = rng(`${userId}|${date}`);
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const chosen = [];
    const pool = DRAWABLE.slice();
    while (chosen.length < MISSIONS_PER_DAY && pool.length) {
      const [mission] = pool.splice(Math.floor(random() * pool.length), 1);
      if (chosen.some(item => item.kind === mission.kind)) continue;
      chosen.push(mission);
    }
    const total = chosen.reduce((sum, mission) => sum + mission.reward, 0);
    if (chosen.length === MISSIONS_PER_DAY && chosen.filter(item => item.tier === 'cond').length <= 1 && total >= DAILY_REWARD_MIN && total <= DAILY_REWARD_MAX) {
      return chosen.map(mission => mission.id);
    }
  }
  return ['play3', 'win1', 'light_play']; // unreachable in practice (every seed is covered by a test); a valid fixed day
}

function newDay(userId, date) {
  return { date, ids: pickMissions(userId, date), counters: { played: 0, wins: 0, clean: 0, games: [], perGame: {}, opps: {} }, done: {}, firstWin: false, matches: [] };
}

function progressOf(doc) {
  return Object.fromEntries(doc.ids.map(id => [id, BY_ID.get(id).measure(doc.counters)]));
}

// input: { matchId, gameType, result: 'win'|'loss'|'draw', soleWinner, clean, opponents: [accountId] }.
// Mutates `doc` (a copy owned by the caller) and returns what changed: `rewards` are owed exactly once
// (the store also keys each ledger row), `progress` lists the missions that moved, for the room toast.
function applyMatch(doc, input, at = new Date().toISOString()) {
  if (doc.matches.includes(input.matchId)) return { changed: false, rewards: [], progress: [] };
  const before = progressOf(doc);
  const c = doc.counters;
  c.played += 1;
  if (input.result === 'win') c.wins += 1;
  if (input.clean) c.clean += 1;
  if (!c.games.includes(input.gameType)) c.games.push(input.gameType);
  const game = c.perGame[input.gameType] ||= { played: 0, wins: 0 };
  game.played += 1;
  if (input.result === 'win') game.wins += 1;
  if (input.opponents.length === 1) c.opps[input.opponents[0]] = (c.opps[input.opponents[0]] || 0) + 1; // a two-player contest
  doc.matches = [...doc.matches, input.matchId].slice(-100);
  const after = progressOf(doc);
  const rewards = [];
  const progress = [];
  for (const id of doc.ids) {
    const mission = BY_ID.get(id);
    const value = Math.min(after[id], mission.target);
    if (value === Math.min(before[id], mission.target)) continue;
    const completed = value >= mission.target && !doc.done[id];
    if (completed) { doc.done[id] = at; rewards.push({ reason: 'daily_mission', id, title: mission.title, amount: mission.reward }); }
    progress.push({ id, short: mission.short, title: mission.title, before: Math.min(before[id], mission.target), after: value, target: mission.target, reward: mission.reward, completed });
  }
  // Only a sole winner earns it: a draw or a shared win (team game) is not a "first win" by default.
  if (input.result === 'win' && input.soleWinner && !doc.firstWin) {
    doc.firstWin = at;
    rewards.push({ reason: 'first_win', id: 'first_win', title: FIRST_WIN_TITLE, amount: FIRST_WIN_REWARD });
  }
  return { changed: true, rewards, progress };
}

// v1.7.18 weekly missions: fixed for everyone, Monday 00:00 to the next Monday 00:00 (Asia/Seoul). They count
// the same normal finished matches as the daily missions, but only totals, so a weekend binge is enough (no
// condition needs a login on a particular day). Each pays on completion; finishing all three adds a bonus.
const WEEKLY = [
  { id: 'weekly_play20', title: '주간 20판 정상 완료', short: '주간 20판', target: 20, reward: 9_000, measure: c => c.played },
  { id: 'weekly_win10', title: '주간 10승', short: '주간 10승', target: 10, reward: 9_000, measure: c => c.wins },
  { id: 'weekly_variety5', title: '주간 서로 다른 게임 5종 플레이', short: '주간 5종', target: 5, reward: 7_000, measure: c => c.games.length },
];
const WEEKLY_BONUS = { id: 'weekly_all', title: '주간 미션 모두 완료', reward: 5_000 };
const WEEKLY_BY_ID = new Map(WEEKLY.map(mission => [mission.id, mission]));
const DAY_MS = 86_400_000;

// `date` is an Asia/Seoul calendar date (YYYY-MM-DD, see kstDate); the week starts on its Monday.
function weekStart(date) {
  const day = new Date(`${date}T00:00:00Z`);
  return new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY_MS).toISOString().slice(0, 10);
}
function weekEnd(start) { return new Date(new Date(`${start}T00:00:00Z`).getTime() + 7 * DAY_MS).toISOString().slice(0, 10); }

function newWeek(start) {
  return { week: start, counters: { played: 0, wins: 0, games: [] }, done: {}, all: false, matches: [] };
}

function weekProgress(doc) { return Object.fromEntries(WEEKLY.map(mission => [mission.id, mission.measure(doc.counters)])); }

// Same input as applyMatch. Mutates `doc`; rewards carry `week` so their ledger key is unique per week.
function applyWeekMatch(doc, input, at = new Date().toISOString()) {
  if (doc.matches.includes(input.matchId)) return { changed: false, rewards: [], progress: [] };
  const before = weekProgress(doc);
  const c = doc.counters;
  c.played += 1;
  if (input.result === 'win') c.wins += 1;
  if (!c.games.includes(input.gameType)) c.games.push(input.gameType);
  doc.matches = [...doc.matches, input.matchId].slice(-100);
  const after = weekProgress(doc);
  const rewards = [];
  const progress = [];
  for (const mission of WEEKLY) {
    const value = Math.min(after[mission.id], mission.target);
    if (value === Math.min(before[mission.id], mission.target)) continue;
    const completed = value >= mission.target && !doc.done[mission.id];
    if (completed) { doc.done[mission.id] = at; rewards.push({ reason: 'weekly_mission', id: mission.id, title: mission.title, amount: mission.reward, week: doc.week }); }
    progress.push({ id: mission.id, short: mission.short, title: mission.title, before: Math.min(before[mission.id], mission.target), after: value, target: mission.target, reward: mission.reward, completed });
  }
  if (!doc.all && WEEKLY.every(mission => doc.done[mission.id])) {
    doc.all = at;
    rewards.push({ reason: 'weekly_mission', id: WEEKLY_BONUS.id, title: WEEKLY_BONUS.title, amount: WEEKLY_BONUS.reward, week: doc.week });
  }
  return { changed: true, rewards, progress };
}

function weekView(doc) {
  const progress = weekProgress(doc);
  const missions = WEEKLY.map(mission => ({ id: mission.id, title: mission.title, progress: Math.min(progress[mission.id], mission.target), target: mission.target, reward: mission.reward, done: Boolean(doc.done[mission.id]) }))
    .sort((a, b) => Number(a.done) - Number(b.done));
  const bonus = { title: WEEKLY_BONUS.title, reward: WEEKLY_BONUS.reward, done: Boolean(doc.all) };
  const remaining = missions.filter(item => !item.done).reduce((sum, item) => sum + item.reward, 0) + (bonus.done ? 0 : WEEKLY_BONUS.reward);
  return { week: doc.week, resetsOn: weekEnd(doc.week), missions, bonus, doneCount: missions.filter(item => item.done).length, total: missions.length, remainingReward: remaining };
}

// Ledger idempotency key / settlement id: one payout per account and day + mission (weekly: week + mission).
function rewardKey(reward, date, userId) {
  if (reward.week) return `weekly:${reward.week}:${reward.id}:${userId}`;
  return reward.reason === 'first_win' ? `first_win:${date}:${userId}` : `mission:${date}:${reward.id}:${userId}`;
}

// What the lobby shows: completed missions sink to the bottom, nothing about other accounts.
function dayView(doc) {
  const progress = progressOf(doc);
  const missions = doc.ids.map(id => {
    const mission = BY_ID.get(id);
    return { id, title: mission.title, progress: Math.min(progress[id], mission.target), target: mission.target, reward: mission.reward, done: Boolean(doc.done[id]) };
  }).sort((a, b) => Number(a.done) - Number(b.done));
  const firstWin = { title: FIRST_WIN_TITLE, reward: FIRST_WIN_REWARD, done: Boolean(doc.firstWin) };
  const remaining = missions.filter(item => !item.done).reduce((sum, item) => sum + item.reward, 0) + (firstWin.done ? 0 : FIRST_WIN_REWARD);
  return { date: doc.date, missions, firstWin, doneCount: missions.filter(item => item.done).length, total: missions.length, remainingReward: remaining };
}

// Short lines for the in-room toast: `게임 3판 2/3`, `미션 완료 +3,000P`.
function toastLines({ progress, rewards }) {
  const money = amount => `+${Number(amount).toLocaleString('ko-KR')}P`;
  const lines = [];
  for (const item of progress) lines.push(item.completed ? `미션 완료 ${money(item.reward)} · ${item.short}` : `${item.short} ${item.after}/${item.target}`);
  if (rewards.some(item => item.reason === 'first_win')) lines.push(`${FIRST_WIN_TITLE} ${money(FIRST_WIN_REWARD)}`);
  return lines.slice(0, 4);
}

// Weekly progress only announces completions in the room (a line per match would be noise).
function weeklyToastLines({ rewards }) {
  const money = amount => `+${Number(amount).toLocaleString('ko-KR')}P`;
  return rewards.filter(item => item.reason === 'weekly_mission')
    .map(item => item.id === WEEKLY_BONUS.id ? `주간 미션 모두 완료 ${money(item.amount)}` : `주간 미션 완료 ${money(item.amount)} · ${WEEKLY_BY_ID.get(item.id).short}`);
}

module.exports = { RETIRED, WEEKLY, WEEKLY_BONUS, weekStart, weekEnd, newWeek, applyWeekMatch, weekView, weeklyToastLines, POOL, MISSIONS_PER_DAY, DAILY_REWARD_MIN, DAILY_REWARD_MAX, FIRST_WIN_REWARD, FIRST_WIN_TITLE, pickMissions, newDay, applyMatch, rewardKey, dayView, toastLines, missionById: id => BY_ID.get(id) };
