'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { POOL, MISSIONS_PER_DAY, DAILY_REWARD_MIN, DAILY_REWARD_MAX, FIRST_WIN_REWARD, pickMissions, newDay, applyMatch, rewardKey, dayView, toastLines, missionById } = require('../lib/missions');

// v1.7.16 daily mission rules (pure): the daily draw, progress from finished matches, once-only payouts,
// and the first-win bonus.

const A = 'guest:00000000-0000-4000-8000-00000000000a';
const B = 'guest:00000000-0000-4000-8000-00000000000b';
const C = 'guest:00000000-0000-4000-8000-00000000000c';
let matchNo = 0;
const match = (over = {}) => ({ matchId: `m${++matchNo}`, gameType: 'othello', result: 'win', soleWinner: true, clean: true, opponents: [B], ...over });
const dayWith = (ids) => { const doc = newDay(A, '2026-10-01'); doc.ids = ids; return doc; };

test('하루 3개: 유형이 모두 다르고, 조건부 미션은 최대 1개, 합계 보상은 8,000~10,000P', () => {
  assert.ok(POOL.length >= 20 && POOL.length <= 30, `풀 ${POOL.length}개`);
  assert.equal(new Set(POOL.map(mission => mission.id)).size, POOL.length, '미션 id는 유일');
  for (let i = 0; i < 6000; i += 1) {
    const ids = pickMissions(`guest:${i}`, `2026-10-${String(1 + (i % 28)).padStart(2, '0')}`);
    const defs = ids.map(missionById);
    const total = defs.reduce((sum, mission) => sum + mission.reward, 0);
    assert.equal(ids.length, MISSIONS_PER_DAY);
    assert.equal(new Set(defs.map(mission => mission.kind)).size, MISSIONS_PER_DAY, `${ids} 유형 중복`);
    assert.ok(defs.filter(mission => mission.tier === 'cond').length <= 1, `${ids} 조건부 2개 이상`);
    assert.ok(total >= DAILY_REWARD_MIN && total <= DAILY_REWARD_MAX, `${ids} 합계 ${total}`);
  }
});

test('같은 계정·날짜는 같은 미션, 날짜나 계정이 다르면 다르게 뽑힌다', () => {
  assert.deepEqual(pickMissions(A, '2026-10-01'), pickMissions(A, '2026-10-01'));
  const days = new Set(Array.from({ length: 30 }, (_, i) => pickMissions(A, `2026-11-${String(i + 1).padStart(2, '0')}`).join()));
  const people = new Set(Array.from({ length: 30 }, (_, i) => pickMissions(`guest:${i}`, '2026-10-01').join()));
  assert.ok(days.size > 8 && people.size > 8);
});

test('진행도: 정상 종료 판수·승수·서로 다른 게임·중도이탈 없는 완료·같은 상대 반복', () => {
  const doc = dayWith(['play3', 'win3', 'variety2']);
  let out = applyMatch(doc, match({ gameType: 'othello' }));
  assert.equal(out.changed, true);
  assert.deepEqual(out.progress.map(item => [item.id, item.after, item.target]), [['play3', 1, 3], ['win3', 1, 3], ['variety2', 1, 2]]);
  assert.deepEqual(out.rewards.map(item => item.reason), ['first_win'], '첫 승리만 지급, 미션은 아직');
  out = applyMatch(doc, match({ gameType: 'omok', result: 'loss', soleWinner: false }));
  assert.deepEqual(out.progress.map(item => [item.id, item.after]), [['play3', 2], ['variety2', 2]]);
  assert.deepEqual(out.rewards.map(item => [item.reason, item.id, item.amount]), [['daily_mission', 'variety2', 2_000]]);
  out = applyMatch(doc, match({ gameType: 'omok', result: 'win' }));
  assert.deepEqual(out.rewards.map(item => [item.id, item.amount]), [['play3', 3_000]], '3판째에 play3 완료');
  assert.equal(doc.counters.wins, 2);
  out = applyMatch(doc, match({ gameType: 'yut', result: 'win' }));
  assert.deepEqual(out.rewards.map(item => [item.id, item.amount]), [['win3', 4_000]], '3승째에 win3 완료');
  assert.equal(dayView(doc).doneCount, 3);
});

test('같은 판(match id)은 몇 번 들어와도 한 번만 반영되고 보상도 한 번만 나온다', () => {
  const doc = dayWith(['win1', 'play3', 'clean1']);
  const first = match();
  const one = applyMatch(doc, first);
  assert.deepEqual(one.rewards.map(item => item.id).sort(), ['clean1', 'first_win', 'win1']);
  for (let i = 0; i < 3; i += 1) assert.deepEqual(applyMatch(doc, first), { changed: false, rewards: [], progress: [] });
  assert.deepEqual([doc.counters.played, doc.counters.wins], [1, 1]);
});

test('중도이탈 없이 완료: 기권한 사람은 제외, 게임별·묶음 미션과 같은 상대 2판', () => {
  const resigner = dayWith(['clean1', 'board_win', 'rematch2']);
  const lost = applyMatch(resigner, match({ result: 'loss', soleWinner: false, clean: false }));
  assert.deepEqual(lost.rewards, [], '기권 패배는 clean1 미달, 보드 승 아님');
  const again = applyMatch(resigner, match({ gameType: 'omok' }));
  assert.deepEqual(again.rewards.map(item => item.id).sort(), ['board_win', 'clean1', 'first_win', 'rematch2'], '다시 한 판 이기면 완료, 같은 상대(B)와 2판 정상 완료도 함께');
  const multi = dayWith(['rematch2', 'play3', 'win1']);
  applyMatch(multi, match({ opponents: [B, C] }));
  applyMatch(multi, match({ opponents: [B, C] }));
  assert.deepEqual(multi.counters.opps, {}, '3인 이상 판은 같은 상대 반복으로 세지 않는다');
});

test('게임별 미션은 그 게임 종류만 센다', () => {
  const doc = dayWith(['halligalli_play', 'light_play', 'win1']);
  applyMatch(doc, match({ gameType: 'omok', result: 'loss', soleWinner: false }));
  assert.equal(dayView(doc).doneCount, 0);
  applyMatch(doc, match({ gameType: 'halligalli', result: 'draw', soleWinner: false }));
  assert.ok(doc.done.halligalli_play, '무승부도 정상 완료로 센다');
  applyMatch(doc, match({ gameType: 'bingo', result: 'loss', soleWinner: false }));
  assert.ok(doc.done.light_play);
  assert.equal(doc.done.win1, undefined, '승리가 없었으므로 미완료');
});

test('첫 승리 보너스: 하루 한 번, 단독 승리만, 미션과 동시에 받는다', () => {
  const doc = dayWith(['win1', 'play3', 'variety2']);
  assert.deepEqual(applyMatch(doc, match({ result: 'draw', soleWinner: false })).rewards, [], '무승부 제외');
  assert.deepEqual(applyMatch(doc, match({ result: 'win', soleWinner: false })).rewards.map(item => item.reason), ['daily_mission'], '공동승리는 미션(1승)만');
  const first = applyMatch(doc, match({ result: 'win', soleWinner: true }));
  assert.deepEqual(first.rewards.map(item => [item.reason, item.amount]), [['daily_mission', 3_000], ['first_win', FIRST_WIN_REWARD]], '3판째: play3와 첫 승리 동시');
  assert.deepEqual(applyMatch(doc, match({ result: 'win', soleWinner: true })).rewards, [], '이후 승리는 보너스 없음');
  assert.equal(dayView(doc).firstWin.done, true);
});

test('보상 키는 계정·날짜·미션마다 유일하고, 화면에는 완료 미션이 아래로 정렬된다', () => {
  const keys = new Set([
    rewardKey({ reason: 'daily_mission', id: 'play3' }, '2026-10-01', A), rewardKey({ reason: 'daily_mission', id: 'win1' }, '2026-10-01', A),
    rewardKey({ reason: 'daily_mission', id: 'play3' }, '2026-10-02', A), rewardKey({ reason: 'daily_mission', id: 'play3' }, '2026-10-01', B),
    rewardKey({ reason: 'first_win', id: 'first_win' }, '2026-10-01', A),
  ]);
  assert.equal(keys.size, 5);
  const doc = dayWith(['win1', 'play3', 'variety2']);
  applyMatch(doc, match({ result: 'loss', soleWinner: false, gameType: 'omok' }));
  applyMatch(doc, match({ result: 'loss', soleWinner: false, gameType: 'yut' }));
  const view = dayView(doc);
  assert.deepEqual(view.missions.map(item => item.id), ['win1', 'play3', 'variety2']);
  assert.deepEqual(view.missions.map(item => item.done), [false, false, true], '완료는 맨 아래');
  assert.equal(view.remainingReward, 3_000 + 3_000 + FIRST_WIN_REWARD);
  assert.deepEqual(Object.keys(view.missions[0]).sort(), ['done', 'id', 'progress', 'reward', 'target', 'title']);
});

test('방 안 토스트 문구: 진행도와 완료·첫 승리', () => {
  const doc = dayWith(['play3', 'win1', 'variety2']);
  applyMatch(doc, match({ result: 'loss', soleWinner: false, gameType: 'omok' }));
  const out = applyMatch(doc, match({ result: 'win', soleWinner: true, gameType: 'yut' }));
  assert.deepEqual(toastLines(out), ['게임 3판 2/3', '미션 완료 +3,000P · 1승', '미션 완료 +2,000P · 다른 게임 2종', '첫 승리 보너스 +5,000P']);
});
