'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildActionTimer, currentTurnSeat } = require('../lib/action-timer');

function room(gameType, game, extra = {}) {
  return { gameType, game: { status: 'playing', ...game }, ...extra };
}

test('일반 차례형은 서버 turnWatch를 표시하고 만료 의미는 일시정지다', () => {
  const r = room('omok', { turn: 'black', paused: false }, { turnWatch: { seat: 'black', since: 1_000 } });
  const timer = buildActionTimer(r, 'black', 2_000, 60_000);
  assert.equal(timer.deadlineAt, 61_000);
  assert.equal(timer.serverNow, 2_000);
  assert.equal(timer.timeoutText, '시간 초과 시 일시정지');
  assert.equal(buildActionTimer(r, 'white', 2_000, 60_000), null);
  r.game.paused = true;
  assert.equal(buildActionTimer(r, 'black', 2_000, 60_000), null);
});

test('차례 전환·재접속 후에는 새 서버 turnWatch 기준시각만 사용한다', () => {
  const r = room('omok', { turn: 'white', paused: false }, { turnWatch: { seat: 'white', since: 9_000 } });
  assert.equal(buildActionTimer(r, 'white', 9_100, 60_000).deadlineAt, 69_000);
  assert.equal(buildActionTimer(r, 'black', 9_100, 60_000), null);
});

test('스무고개는 출제·질문·최종정답 단계별 실제 제한과 결과를 구분한다', () => {
  const base = { drawerSeat: '1', challengerSeats: ['2','3'], turnIndex: 0, finalGuessSeats: ['2','3'], finalGuessIndex: 0 };
  let r = room('twentyquestions', { ...base, phase: 'secret' }, { turnWatch: { seat: '1', since: 10 } });
  assert.equal(buildActionTimer(r, '1', 20, 700).deadlineAt, 710);
  assert.equal(buildActionTimer(r, '1', 20, 700).timeoutText, '시간 초과 시 라운드 무효');
  r = room('twentyquestions', { ...base, phase: 'asking' }, { turnWatch: { seat: '2', since: 20 } });
  assert.equal(buildActionTimer(r, '2', 30).timeoutText, '시간 초과 시 다음 도전자로');
  r = room('twentyquestions', { ...base, phase: 'final-guesses' }, { turnWatch: { seat: '2', since: 30 } });
  assert.equal(buildActionTimer(r, '2', 40).timeoutText, '시간 초과 시 마지막 기회 소진');
});

test('할리갈리와 다빈치 코드는 엔진 마감 시각과 만료 동작을 그대로 표시한다', () => {
  let r = room('halligalli', { turn: '2', deadlineAt: 3_000 });
  assert.equal(buildActionTimer(r, '2', 100).deadlineAt, 3_000);
  assert.equal(buildActionTimer(r, '2', 100).timeoutText, '시간 초과 시 자동 뒤집기');
  r = room('davinci', { turn: '1', phase: 'reveal-own', deadlineAt: 60_000 });
  assert.match(buildActionTimer(r, '1', 100).timeoutText, /무작위 공개/);
  r.game.phase = 'guess';
  assert.equal(buildActionTimer(r, '1', 100).timeoutText, '시간 초과 시 오답 처리');
});

test('라이어게임은 현재 발언자·미투표자·라이어 추측자에게만 표시한다', () => {
  const r = room('liar', { phase: 'hint1', hintOrder: ['1','2'], hintIndex: 0, players: ['1','2','3'], votes: {}, deadlineAt: 60_000, liarSeat: '3' });
  assert.match(buildActionTimer(r, '1', 100).timeoutText, /힌트 없음/);
  assert.equal(buildActionTimer(r, '2', 100), null);
  r.game.phase = 'vote';
  assert.equal(buildActionTimer(r, '2', 100).label, '내 투표 시간');
  r.game.votes['2'] = '1';
  assert.equal(buildActionTimer(r, '2', 100), null);
  r.game.phase = 'guess';
  r.game.votes = {};
  assert.equal(buildActionTimer(r, '3', 100).timeoutText, '시간 초과 시 시민 승');
});

test('그림 맞히기는 출제자와 아직 못 맞힌 참가자만 같은 90초 마감을 공유한다', () => {
  const r = room('pictionary', { phase: 'drawing', seatOrder: ['1','2','3'], drawerSeat: '1', correctGuessers: ['2'], roundEndsAt: 90_000 });
  assert.equal(buildActionTimer(r, '1', 100).label, '내 출제 시간');
  assert.equal(buildActionTimer(r, '2', 100), null);
  assert.equal(buildActionTimer(r, '3', 100).deadlineAt, 90_000);
});

test('마라톤은 미션 참여자에게만 표시하고 시간 제한 없는 주사위 단계는 표시하지 않는다', () => {
  const r = room('marathon', {
    phase: 'mission', mode: 'team', teamLayout: '2v2', seatOrder: ['1','2','3','4'],
    groupOrder: ['A','B'], groups: { A: ['1','3'], B: ['2','4'] }, turnGroup: 'A',
    mission: { group: 'A' }, deadlineAt: 15_000,
  });
  assert.equal(buildActionTimer(r, '1', 100).label, '우리 팀 미션');
  assert.equal(buildActionTimer(r, '2', 100), null);
  r.game.phase = 'roll';
  r.game.mission = null;
  assert.equal(buildActionTimer(r, '1', 100), null);
});

test('2대2 일반 차례는 nextSeat가 현재 행동자를 결정한다', () => {
  const r = room('omok2v2', { nextSeat: '3', paused: false }, { turnWatch: { seat: '3', since: 500 } });
  assert.equal(currentTurnSeat(r), '3');
  assert.equal(buildActionTimer(r, '3', 600, 60_000).deadlineAt, 60_500);
});
