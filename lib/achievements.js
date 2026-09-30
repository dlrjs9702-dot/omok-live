'use strict';

// v1.7.17 game achievements: one-time, lifetime rewards read straight from the account's existing match
// record (lib/match-records.js `stats`), so they reuse each game's own win/loss/draw result and add no
// win rule of their own. Every achievement pays once per account (the point store keys the ledger row and
// the claim by account + achievement id); this file only says which achievements exist and which are met.
// Adding a game means adding it to GAMES below.

const GAMES = [
  ['omok', '오목'], ['omok2v2', '오목 2vs2'], ['connect4', '사목'], ['othello', '오델로'], ['yut', '윷놀이'], ['dots', '점과 상자'],
  ['bingo', '빙고'], ['baseball', '숫자야구'], ['pictionary', '그림 맞히기'], ['twentyquestions', '스무고개'], ['liar', '라이어게임'],
  ['oldmaid', '도둑잡기'], ['cityking', '랜드킹'], ['marathon', '마라톤'], ['gostop', '고스톱·맞고'], ['davinci', '다빈치 코드'], ['halligalli', '할리갈리'],
];

const at = (stats, game) => stats?.byGame?.[game] || { played: 0, wins: 0 };

// Per game: first completed game +1,000, first win +2,000, 10 wins +5,000, 50 completed games +7,500.
const PER_GAME = [
  { key: 'first_play', label: '첫 정상 완료', target: 1, reward: 1_000, measure: g => g.played },
  { key: 'first_win', label: '첫 승리', target: 1, reward: 2_000, measure: g => g.wins },
  { key: 'wins10', label: '10승', target: 10, reward: 5_000, measure: g => g.wins },
  { key: 'plays50', label: '50판 완료', target: 50, reward: 7_500, measure: g => g.played },
];

const DEFS = [
  ...GAMES.flatMap(([game, name]) => PER_GAME.map(item => ({
    id: `${game}_${item.key}`, group: game, groupName: name, title: `${name} ${item.label}`, target: item.target, reward: item.reward,
    measure: stats => item.measure(at(stats, game)),
  }))),
  ...[[5, 5_000], [10, 10_000]].map(([count, reward]) => ({
    id: `variety${count}`, group: 'variety', groupName: '여러 게임', title: `서로 다른 게임 ${count}종 첫 플레이 완료`, target: count, reward,
    measure: stats => GAMES.filter(([game]) => at(stats, game).played >= 1).length,
  })),
];
const BY_ID = new Map(DEFS.map(def => [def.id, def]));

// stats: what `matchStore.stats(playerId)` returns ({ total, byGame }). `done` means the record already
// meets the target; whether it was paid is the point store's business.
function evaluate(stats) {
  return DEFS.map(def => {
    const value = def.measure(stats);
    return { id: def.id, group: def.group, groupName: def.groupName, title: def.title, reward: def.reward, target: def.target, progress: Math.min(value, def.target), done: value >= def.target };
  });
}

// Lobby view: nothing but the account's own progress.
function achievementView(items, grantedIds) {
  const granted = new Set(grantedIds);
  const rows = items.map(item => ({ ...item, done: item.done || granted.has(item.id) }));
  return {
    items: rows, doneCount: rows.filter(item => item.done).length, total: rows.length,
    earned: rows.filter(item => item.done).reduce((sum, item) => sum + item.reward, 0), maxReward: rows.reduce((sum, item) => sum + item.reward, 0),
  };
}

// In-room toast lines: at most two named achievements, the rest as a count.
function achievementToasts(granted) {
  const money = amount => `+${Number(amount).toLocaleString('ko-KR')}P`;
  const lines = granted.slice(0, 2).map(item => `업적 달성 ${money(item.amount)} · ${item.title}`);
  if (granted.length > 2) lines.push(`업적 ${granted.length - 2}개 더 달성 ${money(granted.slice(2).reduce((sum, item) => sum + item.amount, 0))}`);
  return lines;
}

module.exports = { GAMES, DEFS, evaluate, achievementView, achievementToasts, achievementById: id => BY_ID.get(id) };
