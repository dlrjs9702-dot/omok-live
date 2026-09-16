'use strict';

const omok = require('./omok');
const SEATS = ['1', '2', '3', '4'];

function colorForSeat(seat) {
  if (!SEATS.includes(String(seat))) return null;
  return Number(seat) % 2 ? 'black' : 'white';
}

function create() {
  const game = omok.create();
  game.nextSeat = null;
  game.paused = false;
  return game;
}

function start(game) {
  omok.start(game);
  game.nextSeat = '1';
  game.paused = false;
}

function reset(game) {
  omok.reset(game);
  game.nextSeat = null;
  game.paused = false;
}

function applyMove(game, x, y, seat, at) {
  const color = colorForSeat(seat);
  if (!color || game.nextSeat !== String(seat) || game.status !== 'playing' || game.paused) {
    return { legal: false, reason: 'wrong-turn' };
  }
  const verdict = omok.applyMove(game, x, y, color, at);
  if (verdict.legal) {
    game.moves.at(-1).playerSeat = String(seat);
    if (game.status === 'playing') game.nextSeat = String((Number(seat) % 4) + 1);
  }
  return verdict;
}

function publicState(game) {
  return { ...omok.publicState(game), nextSeat: game.nextSeat,
    paused: Boolean(game.paused), disconnectedSeats: game.disconnectedSeats || [] };
}

module.exports = {
  id: 'omok2v2',
  name: '오목 2vs2',
  size: 15,
  rules: '기존 오목과 같은 15×15 판과 금수 규칙. 흑팀 1번→백팀 2번→흑팀 3번→백팀 4번 순서로 착수하고 반복합니다. 네 명이 모두 자리를 골라야 시작하며, 승패는 팀 전체에 적용됩니다. 팀원 접속이 끊기면 복귀할 때까지 일시정지하며 방장은 일시정지 중 대국을 종료할 수 있습니다.',
  seats: SEATS,
  colorForSeat,
  create, start, reset, applyMove, publicState,
  moveError: omok.moveError,
};
