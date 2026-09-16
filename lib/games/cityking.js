'use strict';

const crypto = require('crypto');

const START_CASH = 1500;
const START_BONUS = 200;
const TURN_LIMIT = 50;
const PROPERTY_DATA = {
  1: ['새벽항', 120, 45], 3: ['푸른마을', 140, 50], 5: ['별빛역', 160, 55],
  7: ['구름공원', 180, 60], 10: ['노을거리', 200, 70], 12: ['바람언덕', 220, 75],
  15: ['은하광장', 240, 85], 17: ['달빛항', 260, 90], 20: ['솔숲마을', 280, 100], 22: ['해돋이성', 320, 115],
};
const EVENT_TEXT = {
  2: '보너스 카드: 관광객이 찾아왔습니다. +100',
  6: '기회 카드: 뜻밖의 후원금입니다. +200',
  9: '기회 카드: 수리비가 발생했습니다. -100',
  14: '보너스 카드: 축제 수익입니다. +150',
  19: '기회 카드: 긴급 배송비를 냈습니다. -150',
  23: '보너스 카드: 행운의 쿠폰입니다. +250',
};
const TAX_TILES = new Set([4, 13, 18, 21]);
const REST_TILES = new Set([8, 11, 16]);

const TILES = Array.from({ length: 24 }, (_, index) => {
  if (index === 0) return { index, type: 'start', name: '출발' };
  if (PROPERTY_DATA[index]) return { index, type: 'property', name: PROPERTY_DATA[index][0], price: PROPERTY_DATA[index][1], toll: PROPERTY_DATA[index][2] };
  if (EVENT_TEXT[index]) return { index, type: 'event', name: '이벤트' };
  if (TAX_TILES.has(index)) return { index, type: 'tax', name: '공동기금', amount: 120 };
  if (REST_TILES.has(index)) return { index, type: 'rest', name: '휴식' };
  return { index, type: 'event', name: '기회 광장' };
});

const metadata = {
  id: 'cityking',
  name: '랜드킹',
  size: 24,
  rules: '독자 규칙의 2인 도시 보드게임. 주사위 두 개만큼 이동해 도시를 매입하고 상대가 소유한 도시에 도착하면 통행료를 냅니다. 출발을 지날 때마다 +200을 받고, 이벤트·공동기금 칸의 효과를 적용합니다. 상대를 파산시키거나 50턴 뒤 순자산이 높은 쪽이 승리합니다.',
};

function createPlayer(color) {
  return { color, cash: START_CASH, position: 0, properties: [] };
}

function create() {
  return {
    size: 24, status: 'selecting', turn: 'black', winner: null, winningLine: null,
    round: 1, phase: 'roll', turnCount: 0, pendingProperty: null, lastRoll: null, lastEvent: null,
    players: { black: createPlayer('black'), white: createPlayer('white') },
    owners: {}, moves: [],
  };
}

function start(game) {
  game.status = 'playing';
  game.turn = 'black';
  game.phase = 'roll';
}

function reset(game) {
  const round = Number(game.round || 1) + 1;
  Object.assign(game, create(), { round });
}

function validColor(color) { return color === 'black' || color === 'white'; }
function other(color) { return color === 'black' ? 'white' : 'black'; }
function randomDie() { return crypto.randomInt(1, 7); }
function netWorth(game, color) {
  return game.players[color].cash + game.players[color].properties.reduce((sum, index) => sum + (TILES[index].price || 0), 0);
}

function finishByWorth(game) {
  const black = netWorth(game, 'black');
  const white = netWorth(game, 'white');
  game.status = black === white ? 'draw' : 'finished';
  game.winner = black === white ? null : black > white ? 'black' : 'white';
  game.turn = null;
  game.phase = 'finished';
  game.pendingProperty = null;
}

function advanceTurn(game) {
  game.pendingProperty = null;
  game.phase = 'roll';
  if (game.turnCount >= TURN_LIMIT) finishByWorth(game);
  else game.turn = other(game.turn);
}

function bankruptIfNeeded(game, color) {
  if (game.players[color].cash >= 0) return false;
  game.status = 'finished';
  game.winner = other(color);
  game.turn = null;
  game.phase = 'finished';
  game.pendingProperty = null;
  return true;
}

function resolveLanding(game, color, oldPosition, at) {
  const player = game.players[color];
  const tile = TILES[player.position];
  game.lastEvent = null;
  const passedStart = player.position < oldPosition;
  if (passedStart) {
    player.cash += START_BONUS;
    game.lastEvent = `출발을 지나 보너스 ${START_BONUS}을 받았습니다.`;
  }
  if (tile.type === 'start') {
    if (!passedStart) player.cash += START_BONUS;
    game.lastEvent = `출발 도착 보너스 ${START_BONUS}을 받았습니다.`;
  } else if (tile.type === 'property') {
    const owner = game.owners[tile.index];
    if (!owner) {
      game.pendingProperty = tile.index;
      game.phase = 'buy';
      return;
    }
    if (owner !== color) {
      player.cash -= tile.toll;
      game.players[owner].cash += tile.toll;
      game.lastEvent = `${tile.name} 통행료 ${tile.toll}을 지불했습니다.`;
      if (bankruptIfNeeded(game, color)) return;
    } else game.lastEvent = `내 도시 ${tile.name}에 도착했습니다.`;
  } else if (tile.type === 'tax') {
    player.cash -= tile.amount;
    game.lastEvent = `${tile.name} ${tile.amount}을 납부했습니다.`;
    if (bankruptIfNeeded(game, color)) return;
  } else if (tile.type === 'event') {
    const text = EVENT_TEXT[tile.index] || '기회 광장: 작은 행운이 찾아왔습니다. +50';
    const amount = text.includes('-') ? -Number(text.match(/-(\d+)/)?.[1] || 0) : Number(text.match(/\+(\d+)/)?.[1] || 0);
    player.cash += amount;
    game.lastEvent = text;
    if (bankruptIfNeeded(game, color)) return;
  } else {
    game.lastEvent = `${tile.name}에서 잠시 쉽니다.`;
  }
  advanceTurn(game);
}

function rollDice(game, color, at, die = randomDie) {
  if (!validColor(color)) return { legal: false, reason: 'not-player' };
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (game.turn !== color) return { legal: false, reason: 'not-your-turn' };
  if (game.phase !== 'roll') return { legal: false, reason: 'must-buy' };
  const first = die();
  const second = die();
  if (![first, second].every(value => Number.isInteger(value) && value >= 1 && value <= 6)) return { legal: false, reason: 'bad-die' };
  const player = game.players[color];
  const oldPosition = player.position;
  const total = first + second;
  player.position = (player.position + total) % TILES.length;
  game.turnCount += 1;
  game.lastRoll = { color, first, second, total, from: oldPosition, to: player.position, at };
  game.moves.push({ type: 'roll', ...game.lastRoll });
  resolveLanding(game, color, oldPosition, at);
  return { legal: true, first, second, total, position: player.position, phase: game.phase, finished: game.status !== 'playing' };
}

function buyProperty(game, color, at) {
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (game.turn !== color) return { legal: false, reason: 'not-your-turn' };
  if (game.phase !== 'buy' || game.pendingProperty === null) return { legal: false, reason: 'not-for-sale' };
  const tile = TILES[game.pendingProperty];
  const player = game.players[color];
  if (player.cash < tile.price) return { legal: false, reason: 'not-enough-cash' };
  player.cash -= tile.price;
  player.properties.push(tile.index);
  game.owners[tile.index] = color;
  game.lastEvent = `${tile.name}을(를) ${tile.price}에 매입했습니다.`;
  game.moves.push({ type: 'buy', color, property: tile.index, at });
  advanceTurn(game);
  return { legal: true, property: tile.index, finished: game.status !== 'playing' };
}

function skipProperty(game, color, at) {
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (game.turn !== color) return { legal: false, reason: 'not-your-turn' };
  if (game.phase !== 'buy' || game.pendingProperty === null) return { legal: false, reason: 'not-for-sale' };
  const property = game.pendingProperty;
  game.moves.push({ type: 'skip', color, property, at });
  game.lastEvent = `${TILES[property].name} 매입을 건너뛰었습니다.`;
  advanceTurn(game);
  return { legal: true, property, finished: game.status !== 'playing' };
}

function applyMove() { return { legal: false, reason: 'wrong-action' }; }

function moveError(reason) {
  if (reason === 'not-player') return '플레이어 역할을 먼저 선택해 주세요.';
  if (reason === 'not-playing') return '지금은 게임을 진행할 수 없습니다.';
  if (reason === 'not-your-turn') return '상대 차례입니다.';
  if (reason === 'must-buy') return '도시를 매입하거나 통행을 확인한 뒤 다음 차례로 넘어갑니다.';
  if (reason === 'not-for-sale') return '지금 매입할 수 있는 도시가 없습니다.';
  if (reason === 'not-enough-cash') return '현금이 부족해 이 도시를 매입할 수 없습니다.';
  return '현재 처리할 수 없는 요청입니다.';
}

function publicState(game) {
  return {
    size: 24, board: [], status: game.status, turn: game.turn, winner: game.winner, winningLine: null,
    round: game.round, phase: game.phase, turnCount: game.turnCount, turnLimit: TURN_LIMIT,
    pendingProperty: game.pendingProperty, lastRoll: game.lastRoll, lastEvent: game.lastEvent,
    tiles: TILES, players: game.players, owners: game.owners,
    legalMoves: [], moveCount: game.moves.length, lastMove: game.moves.at(-1) || null,
    scores: { black: netWorth(game, 'black'), white: netWorth(game, 'white') }, lastPass: null,
  };
}

module.exports = { ...metadata, TILES, START_CASH, START_BONUS, TURN_LIMIT, create, start, reset, rollDice, buyProperty, skipProperty, applyMove, publicState, moveError, netWorth };
