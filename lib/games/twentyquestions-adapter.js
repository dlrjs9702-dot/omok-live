'use strict';

const core = require('./twentyquestions');
const metadata = {
  id: 'twentyquestions',
  name: '스무고개',
  size: 0,
  rules: '2~8명 개인전 또는 협동전. 방장이 1~10라운드를 정하고 출제자는 자리 순서대로 교대합니다. 매 라운드 무작위 카테고리 안에서 출제자가 비밀 정답을 정합니다. 도전자들은 순서대로 질문하거나 정답을 제출하며 질문·일반 정답 시도는 합쳐 20회입니다. 출제자는 예·아니오·비슷함·애매함으로 답하고 정답을 직접 판정합니다. 도전자 차례가 60초 동안 무응답이면 다음 도전자로 넘어가며 일반 20회 기회는 차감하지 않습니다. 최종 정답 차례의 무응답은 해당 마지막 기회가 소진됩니다. 출제자가 60초 동안 필요한 입력·답변·판정을 하지 않거나 연결이 끊긴 채 60초 안에 돌아오지 않으면 그 라운드는 점수 없이 무효 처리되고 다음 라운드로 넘어갑니다. 개인전은 정답자에게 1점, 실패 시 출제자에게 1점. 협동전은 한 명만 맞혀도 도전자 전원에게 1점, 실패 시 출제자에게 1점. 전체 라운드 누적 최고점자가 승리하고 동점은 공동 승리합니다.',
};

function create() {
  return Object.assign(core.create(), { round: 1, seatOrder: [] });
}
function reset(game) {
  const round = (Number(game.round) || 1) + 1;
  Object.assign(game, create(), { round });
}
function beginRound(game, seats, drawerSeat = null, random = Math.random) {
  const verdict = core.beginRound(game, seats, drawerSeat, random);
  if (verdict.legal) game.seatOrder = [...game.seats];
  return verdict;
}
function nextRound(game, random = Math.random) {
  const verdict = core.nextRound(game, random);
  if (verdict.legal) game.seatOrder = [...game.seats];
  return verdict;
}
function judgeGuess(game, seat, correct) {
  const verdict = core.judgeGuess(game, seat, correct);
  if (verdict.legal && game.status === 'finished') game.winner = [...game.winners];
  return verdict;
}
function voidRound(game, reason) {
  const verdict = core.voidRound(game, reason);
  if (verdict.legal && game.status === 'finished') game.winner = [...game.winners];
  return verdict;
}
function publicState(game) {
  return { ...core.publicState(game), round: game.round, seatOrder: [...game.seatOrder] };
}
const errors = {
  'already-started': '이미 시작한 게임입니다.', 'invalid-mode': '개인전 또는 협동전을 선택해 주세요.',
  'invalid-rounds': '라운드는 1~10판까지 선택해 주세요.', 'not-ready': '지금은 라운드를 시작할 수 없습니다.',
  'invalid-seats': '2~8명이 서로 다른 자리를 선택해야 합니다.', 'seat-order-changed': '진행 중에는 참가자 자리를 바꿀 수 없습니다.',
  'invalid-drawer': '출제자 순서가 올바르지 않습니다.', 'invalid-random': '카테고리 선택에 실패했습니다.',
  'wrong-phase': '현재 단계에서는 이 행동을 할 수 없습니다.', 'not-drawer': '출제자만 진행할 수 있습니다.',
  'not-challenger': '도전자만 사용할 수 있습니다.', 'not-your-turn': '자기 차례에만 제출할 수 있습니다.',
  'invalid-secret': '정답을 1~100자로 입력해 주세요.', 'invalid-question': '질문을 1~200자로 입력해 주세요.',
  'invalid-reply': '예·아니오·비슷함·애매함 중 선택해 주세요.', 'invalid-guess': '정답을 1~100자로 입력해 주세요.',
  'invalid-judgment': '정답 또는 오답을 선택해 주세요.', 'question-limit': '공식 질문 20개를 모두 사용했습니다.',
};
function moveError(reason) { return errors[reason] || '진행 상태를 다시 확인해 주세요.'; }

module.exports = { ...core, ...metadata, create, reset, beginRound, nextRound, judgeGuess, voidRound, publicState, moveError };
