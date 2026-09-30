'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { GAMES, DEFS, evaluate, achievementView, achievementToasts, achievementById } = require('../lib/achievements');
const { listGames } = require('../lib/games');

// v1.7.18 achievement definitions (pure): what exists, what a match record meets, what the lobby shows.

test('업적 정의: id 형식·유일성·보상 범위(1,000~10,000P)·모든 게임 포함', () => {
  assert.equal(new Set(DEFS.map(def => def.id)).size, DEFS.length);
  assert.ok(DEFS.every(def => /^[a-z0-9_]{3,60}$/.test(def.id)), 'point-store가 받아들이는 id 형식');
  assert.ok(DEFS.every(def => def.reward >= 1_000 && def.reward <= 10_000 && Number.isInteger(def.target) && def.target > 0));
  // 잿빛 원정(협동, 승패 전적 없음)을 뺀 모든 게임이 업적 대상이다. 새 게임이 생기면 이 테스트가 알려 준다.
  const playable = listGames().map(game => game.id).filter(id => id !== 'rpg').sort();
  assert.deepEqual(GAMES.map(([id]) => id).sort(), playable);
  assert.equal(DEFS.length, GAMES.length * 4 + 2);
});

test('전적으로 판정: 첫 완료·첫 승리·10승·50판, 서로 다른 게임 5종·10종', () => {
  const stats = { byGame: {
    othello: { played: 12, wins: 10 }, omok: { played: 1, wins: 0 }, yut: { played: 50, wins: 3 }, bingo: { played: 2, wins: 1 }, dots: { played: 1, wins: 0 },
  } };
  const done = new Set(evaluate(stats).filter(item => item.done).map(item => item.id));
  for (const id of ['othello_first_play', 'othello_first_win', 'othello_wins10', 'omok_first_play', 'yut_first_play', 'yut_first_win', 'yut_plays50', 'bingo_first_win', 'variety5']) assert.ok(done.has(id), id);
  for (const id of ['othello_plays50', 'omok_first_win', 'yut_wins10', 'variety10', 'davinci_first_play']) assert.equal(done.has(id), false, id);
  const progress = Object.fromEntries(evaluate(stats).map(item => [item.id, item.progress]));
  assert.deepEqual([progress.othello_plays50, progress.yut_wins10, progress.variety10], [12, 3, 5]);
  assert.equal(evaluate({}).every(item => item.progress === 0 && !item.done), true, '전적이 없으면 아무것도 달성하지 않는다');
  const ten = { byGame: Object.fromEntries(GAMES.slice(0, 10).map(([id]) => [id, { played: 1, wins: 0 }])) };
  assert.equal(evaluate(ten).find(item => item.id === 'variety10').done, true);
});

test('화면용 요약과 방 안 토스트 문구', () => {
  const items = evaluate({ byGame: { othello: { played: 1, wins: 1 } } });
  const view = achievementView(items, []);
  assert.deepEqual([view.total, view.doneCount, view.earned], [DEFS.length, 2, 3_000]);
  assert.equal(view.maxReward, DEFS.reduce((sum, def) => sum + def.reward, 0));
  assert.equal(achievementView(items, ['omok_first_win']).doneCount, 3, '이미 지급된 업적은 달성으로 본다');
  assert.equal(achievementById('othello_first_win').reward, 2_000);
  assert.deepEqual(achievementToasts([{ title: '오델로 첫 정상 완료', amount: 1_000 }, { title: '오델로 첫 승리', amount: 2_000 }, { title: 'A', amount: 5_000 }, { title: 'B', amount: 1_000 }]),
    ['업적 달성 +1,000P · 오델로 첫 정상 완료', '업적 달성 +2,000P · 오델로 첫 승리', '업적 2개 더 달성 +6,000P']);
  assert.deepEqual(achievementToasts([]), []);
});
