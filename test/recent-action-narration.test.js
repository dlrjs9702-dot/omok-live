'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { narrate } = require('../public/recent-action');
const { listGames } = require('../lib/games');

// v1.7.29: the 「방금」 line comes from each game's own public state, never from the room's system chat.
// States below use the field names each engine's publicState() really sends (checked against lib/games).

const names = { black: '흑돌이님', white: '백돌이님', 1: '일번님', 2: '이번님', 3: '삼번님', A: 'A' };
const helpers = {
  actorName: value => names[value] || `${value}번`,
  marathonGroupLabel: (group, game) => (game?.mode === 'team' ? `${group}팀` : `${group}번`),
};
const line = (gameType, game, extra = {}) => narrate({ gameType, game: { status: 'playing', ...game }, ...extra }, helpers);
const SYSTEM_CHAT = { chat: { messages: [{ id: 1, type: 'system', text: '일번님이 입장했습니다.' }, { id: 2, type: 'system', text: '게임이 시작되었습니다.' }] } };

test('시스템 채팅은 더 이상 「방금」이 아니다: 게임 상태에 행동이 없으면 아무것도 표시하지 않는다', () => {
  for (const type of ['bingo', 'yut', 'cityking', 'oldmaid', 'marathon', 'twentyquestions', 'pictionary']) {
    assert.equal(line(type, {}, SYSTEM_CHAT), '', type);
  }
  assert.equal(line('yut', { phase: 'throw', lastThrow: null, lastPass: null }, SYSTEM_CHAT), '');
  assert.equal(narrate({ gameType: 'bingo', game: { status: 'waiting', lastSelected: { seat: '1', number: 5 } } }, helpers), '', '진행 전에는 표시하지 않는다');
  assert.equal(narrate({ gameType: 'bingo' }, helpers), '');
});

test('모든 게임 종류에서 빈 상태로 호출해도 오류 없이 문자열을 돌려준다', () => {
  for (const { id } of listGames()) assert.equal(typeof narrate({ gameType: id, game: { status: 'playing' } }, helpers), 'string', id);
});

test('보드 게임(기존 문구 유지): 오목·오델로·사목·점과 상자·숫자야구', () => {
  assert.equal(line('omok', { lastMove: { color: 'black' } }), '흑돌이님이 돌을 놓았습니다');
  assert.equal(line('othello', { lastMove: { color: 'white', flipped: 3 } }), '백돌이님이 두어 3개를 뒤집었습니다');
  assert.equal(line('connect4', { lastMove: { color: 'black', x: 2 } }), '흑돌이님이 3열에 넣었습니다');
  assert.equal(line('dots', { lastMove: { color: 'white', claimed: [1, 2] } }), '백돌이님이 선을 그었습니다 · 상자 2개 완성');
  assert.equal(line('baseball', { lastMove: { color: 'black', guess: '123', strikes: 1, balls: 2 } }), '흑돌이님의 추측 123 → 1S 2B');
  assert.equal(line('omok', {}), '');
});

test('오목 2vs2: 팀 색이 아니라 실제 착수자(playerSeat), 없으면 색으로 대체', () => {
  assert.equal(line('omok2v2', { lastMove: { color: 'black', playerSeat: '3' } }), '삼번님이 돌을 놓았습니다');
  assert.equal(line('omok2v2', { lastMove: { color: 'black' } }), '흑돌이님이 돌을 놓았습니다');
});

test('빙고: 마지막으로 고른 숫자(받침에 맞는 조사)', () => {
  assert.equal(line('bingo', { lastSelected: { seat: '1', number: 7 } }), '일번님이 7을 골랐습니다');
  assert.equal(line('bingo', { lastSelected: { seat: '2', number: 12 } }), '이번님이 12를 골랐습니다');
  assert.equal(line('bingo', { lastSelected: { seat: '2', number: 20 } }), '이번님이 20을 골랐습니다');
  assert.equal(line('bingo', { lastSelected: { seat: '2', number: 4 } }), '이번님이 4를 골랐습니다');
  assert.equal(line('bingo', { lastSelected: { seat: '2', number: 9 } }), '이번님이 9를 골랐습니다');
});

test('윷놀이: 던진 직후는 윷 결과, 이동 뒤는 말 이동(잡기·한 번 더), 이동할 말이 없으면 넘김', () => {
  assert.equal(line('yut', { phase: 'move', turn: 'black', lastThrow: { name: '개', steps: 2 } }), '흑돌이님의 윷 던지기 → 개');
  assert.equal(line('yut', { phase: 'move', turn: 'white', lastThrow: { name: '빽도', steps: -1 } }), '백돌이님의 윷 던지기 → 빽도');
  assert.equal(line('yut', { phase: 'throw', lastMove: { color: 'black', captured: [], bonus: false } }), '흑돌이님이 말을 옮겼습니다');
  assert.equal(line('yut', { phase: 'throw', lastMove: { color: 'black', captured: ['w1', 'w2'], bonus: true } }), '흑돌이님이 말을 옮겼습니다 · 상대 말 2개 잡음 · 한 번 더');
  assert.equal(line('yut', { phase: 'throw', lastPass: 'white', lastMove: { color: 'black', captured: [] } }), '백돌이님이 이동할 말이 없어 차례를 넘겼습니다');
});

test('도둑잡기: 마지막으로 뽑은 사람·대상·버린 쌍·손패를 비운 사람', () => {
  assert.equal(line('oldmaid', { history: [{ actor: '1', target: '2', pairs: 0, emptied: null }] }), '일번님이 이번님의 카드를 뽑았습니다');
  assert.equal(line('oldmaid', { history: [{ actor: '1', target: '2', pairs: 0 }, { actor: '2', target: '3', pairs: 2, emptied: null }] }), '이번님이 삼번님의 카드를 뽑았습니다 · 2쌍을 버림');
  assert.equal(line('oldmaid', { history: [{ actor: '3', target: '1', pairs: 1, emptied: '1' }] }), '삼번님이 일번님의 카드를 뽑았습니다 · 1쌍을 버림 · 일번님이 손패를 모두 비움');
});

test('랜드킹: 마지막 주사위(더블)와 그 결과 문장', () => {
  assert.equal(line('cityking', { lastRoll: { seat: '1', total: 8, double: false }, lastEvent: null }), '일번님이 주사위 8');
  assert.equal(line('cityking', { lastRoll: { seat: '2', total: 6, double: true }, lastEvent: '서울 통행료 200을 지불했습니다.' }), '이번님이 주사위 6(더블) · 서울 통행료 200을 지불했습니다.');
});

test('마라톤: 주사위·미션 성공·시간 초과·도착(팀전은 팀 이름)', () => {
  assert.equal(line('marathon', { history: [{ type: 'roll', seat: '1', roll: 4, group: '1' }] }), '일번님이 주사위를 굴려 4가 나왔습니다');
  assert.equal(line('marathon', { history: [{ type: 'roll', seat: '1', roll: 5, group: '1' }] }), '일번님이 주사위를 굴려 5가 나왔습니다');
  assert.equal(line('marathon', { history: [{ type: 'roll', seat: '1', roll: 6, group: '1' }] }), '일번님이 주사위를 굴려 6이 나왔습니다');
  assert.equal(line('marathon', { history: [{ type: 'mission-success', seat: '2', group: 'A' }] }), '이번님이 미션을 성공했습니다');
  assert.equal(line('marathon', { mode: 'team', history: [{ type: 'mission-timeout', group: 'A' }] }), 'A팀의 미션 시간이 초과되었습니다');
  assert.equal(line('marathon', { mode: 'team', history: [{ type: 'finish', group: 'B' }] }), 'B팀이 도착했습니다');
  assert.equal(line('marathon', { mode: 'solo', history: [{ type: 'finish', group: '3' }] }), '3번이 도착했습니다');
  assert.equal(line('marathon', { history: [{ type: 'other' }] }), '');
});

test('스무고개: 아직 답을 기다리는 질문·정답 시도만 이름 붙이고, 순서를 알 수 없는 기록은 표시하지 않는다', () => {
  assert.equal(line('twentyquestions', { pendingQuestion: { seat: '2', text: '동물인가요?' } }), '이번님이 질문했습니다');
  assert.equal(line('twentyquestions', { pendingGuess: { seat: '3', text: '사자' } }), '삼번님이 정답을 시도했습니다');
  assert.equal(line('twentyquestions', { phase: 'asking', drawerSeat: '1', questions: [], guessHistory: [] }), '일번님이 정답을 설정했습니다', '첫 질문 차례 = 방금 정답을 설정');
  assert.equal(line('twentyquestions', { phase: 'secret', drawerSeat: '1', questions: [], guessHistory: [] }), '', '정답을 정하는 중에는 아직 행동이 없다');
  assert.equal(line('twentyquestions', { phase: 'asking', drawerSeat: '1', questions: [{ seat: '2', text: '동물인가요?', reply: '예' }], guessHistory: [] }), '일번님이 이번님의 질문에 "예"(으)로 답했습니다');
  assert.equal(line('twentyquestions', { phase: 'asking', drawerSeat: '1', questions: [], guessHistory: [{ seat: '3', text: '사자', correct: false }] }), '삼번님의 정답 시도 · 오답');
  assert.equal(line('twentyquestions', { questions: [{ seat: '2', text: 'a', reply: '예' }], guessHistory: [{ seat: '3', correct: false }] }), '');
});

test('그림 맞히기: 오답만 있거나 정답만 있을 때만 마지막 것을 말하고, 둘이 섞이면 표시하지 않는다', () => {
  assert.equal(line('pictionary', { guessLog: [{ seat: '2', text: '고양이' }, { seat: '3', text: '강아지' }], roundAwards: [] }), '삼번님의 추측 · "강아지"');
  assert.equal(line('pictionary', { guessLog: [], roundAwards: [{ seat: '2', points: 120, first: true }] }), '이번님이 정답을 맞혔습니다 · 첫 정답');
  assert.equal(line('pictionary', { guessLog: [], roundAwards: [{ seat: '2', first: true }, { seat: '3', first: false }] }), '삼번님이 정답을 맞혔습니다');
  assert.equal(line('pictionary', { guessLog: [{ seat: '2', text: '고양이' }], roundAwards: [{ seat: '3', first: true }] }), '');
});

test('할리갈리·다빈치·라이어: 기존 문구 그대로', () => {
  assert.equal(line('halligalli', { flipId: 4, lastFlip: { seat: '2', flipId: 4 } }), '이번님이 카드를 뒤집었습니다');
  assert.equal(line('halligalli', { flipId: 4, lastFlip: { seat: '2', flipId: 4 }, lastBell: { seat: '3', flipId: 4, correct: true, totalTransferred: 6 } }), '삼번님이 종을 쳤습니다 · 성공, 카드 6장 획득');
  assert.equal(line('davinci', { lastGuess: { seat: '1', target: '2', number: 5, correct: false } }), '일번님이 이번님의 타일을 5(으)로 추측 · 오답');
  assert.equal(line('liar', { hints: [{ seat: '1', text: '노랗다' }] }), '일번님의 힌트 · "노랗다"');
  assert.equal(line('liar', { hints: [{ seat: '1', timedOut: true }] }), '일번님의 힌트 · 시간 초과');
});
