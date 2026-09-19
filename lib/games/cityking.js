'use strict';

const crypto = require('crypto');

const START_CASH = 1500;
const START_BONUS = 200;
const TURN_LIMIT = 50;
const SEATS = ['1', '2', '3', '4'];
const BUILD_NAMES = ['도시', '별장', '빌딩', '호텔'];
const TOLL_MULTIPLIERS = [1, 2, 3, 5];
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
  rules: '2~4인 도시 보드게임. 주사위 두 개만큼 이동해 도시를 매입하고 상대 도시에 도착하면 개발 단계에 따른 통행료를 냅니다. 자기 소유 도시에 도착할 때 매입가의 절반을 내고 별장·빌딩·호텔을 한 단계씩 지을 수 있습니다. 출발을 지날 때마다 +200을 받고, 이벤트·공동기금 칸의 효과를 적용합니다. 더블이면 해당 칸의 매입·건설 등 처리를 마친 뒤 계속 굴립니다. 자기 차례에 언제든 소유한 도시나 건물을 원가의 절반에 매각할 수 있습니다. 낼 현금이 부족하면 자산을 매각해 정산하는 자산 정리 단계로 전환되며, 그래도 부족하면 파산해 대국에서 탈락합니다(자산은 강제 매각되어 채권자에게 우선 지급). 마지막 생존자, 또는 50턴 뒤 순자산이 가장 높은 참가자가 1위입니다.',
};

function createPlayer(seat) {
  return { seat, cash: START_CASH, position: 0, properties: [], eliminated: false };
}

function create() {
  return {
    size: 24, status: 'selecting', turn: null, winner: null, ranking: null,
    round: 1, phase: 'roll', turnCount: 0, seatOrder: [], completedTurns: {}, extraRoll: false,
    pendingProperty: null, lastRoll: null, lastEvent: null,
    liquidating: null, pendingDebt: null, eliminationOrder: [],
    players: {}, owners: {}, developments: {}, moves: [],
  };
}

function normalizeSeats(seats) {
  return [...new Set((Array.isArray(seats) ? seats : []).map(String).filter(seat => SEATS.includes(seat)))]
    .sort((a, b) => Number(a) - Number(b));
}

function start(game, seats) {
  if (game.status !== 'selecting') return { legal: false, reason: 'already-started' };
  const order = normalizeSeats(seats);
  if (order.length < 2 || order.length > 4) return { legal: false, reason: 'not-enough-players' };
  game.seatOrder = order;
  game.players = Object.fromEntries(order.map(seat => [seat, createPlayer(seat)]));
  game.owners = {};
  game.developments = {};
  game.moves = [];
  game.status = 'playing';
  game.turn = order[0];
  game.phase = 'roll';
  game.completedTurns = Object.fromEntries(order.map(seat => [seat, false]));
  game.extraRoll = false;
  game.pendingProperty = null;
  game.liquidating = null;
  game.pendingDebt = null;
  game.eliminationOrder = [];
  game.winner = null;
  game.ranking = null;
  return { legal: true, turn: game.turn, seats: [...order] };
}

function reset(game) {
  const round = Number(game.round || 1) + 1;
  Object.assign(game, create(), { round });
}

function validSeat(game, seat) { return SEATS.includes(String(seat)) && Boolean(game.players[seat]); }
function randomDie() { return crypto.randomInt(1, 7); }
function propertyLevel(game, index) {
  return Math.max(0, Math.min(3, Number(game.developments?.[index]) || 0));
}
function buildCost(index) { return Math.floor((TILES[index]?.price || 0) / 2); }
function propertyToll(game, index) { return (TILES[index]?.toll || 0) * TOLL_MULTIPLIERS[propertyLevel(game, index)]; }
function netWorth(game, seat) {
  const player = game.players[seat];
  if (!player) return 0;
  return player.cash + player.properties.reduce((sum, index) =>
    sum + (TILES[index].price || 0) + buildCost(index) * propertyLevel(game, index), 0);
}

function activeSeats(game) {
  return (game.seatOrder || []).filter(seat => game.players[seat] && !game.players[seat].eliminated);
}

function buildRanking(game) {
  const survivors = activeSeats(game).sort((a, b) => netWorth(game, b) - netWorth(game, a));
  return [...survivors, ...[...game.eliminationOrder].reverse()];
}

// Ties (equal net worth) are broken by seat order -- simple and stable, not left to chance.
function finishGame(game) {
  game.ranking = buildRanking(game);
  game.winner = game.ranking[0] || null;
  game.status = 'finished';
  game.turn = null;
  game.phase = 'finished';
  game.pendingProperty = null;
  game.extraRoll = false;
  game.liquidating = null;
  game.pendingDebt = null;
}

function nextActiveSeat(game, from) {
  const active = activeSeats(game);
  if (!active.length) return null;
  const order = game.seatOrder;
  const startIndex = order.indexOf(from);
  for (let step = 1; step <= order.length; step += 1) {
    const candidate = order[(startIndex + step) % order.length];
    if (active.includes(candidate)) return candidate;
  }
  return active[0];
}

function advanceTurn(game) {
  game.pendingProperty = null;
  if (game.status !== 'playing') return;
  game.phase = 'roll';
  if (game.extraRoll) return;
  const active = activeSeats(game);
  if (active.length <= 1) { finishGame(game); return; }
  game.completedTurns ||= {};
  game.completedTurns[game.turn] = true;
  if (active.every(seat => game.completedTurns[seat])) {
    game.turnCount += 1;
    game.completedTurns = Object.fromEntries(active.map(seat => [seat, false]));
    if (game.turnCount >= TURN_LIMIT) { finishGame(game); return; }
  }
  game.turn = nextActiveSeat(game, game.turn);
}

// Selling everything they own, in whatever order the player likes (building-by-building or the
// whole property at once) -- never a forced building-first sequence.
function sellBuilding(game, seat, tileIndex, at) {
  if (!validSeat(game, seat)) return { legal: false, reason: 'not-player' };
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (!canActNow(game, seat)) return { legal: false, reason: 'not-your-turn' };
  if (!Number.isInteger(tileIndex) || !TILES[tileIndex]) return { legal: false, reason: 'not-owner' };
  return sellBuildingAt(game, seat, tileIndex, at);
}

function sellBuildingAt(game, seat, index, at) {
  if (game.owners[index] !== seat) return { legal: false, reason: 'not-owner' };
  const level = propertyLevel(game, index);
  if (level <= 0) return { legal: false, reason: 'no-building' };
  const refund = Math.floor(buildCost(index) * 0.5);
  game.developments[index] = level - 1;
  game.players[seat].cash += refund;
  game.lastEvent = `${TILES[index].name}의 건물을 매각해 ${refund}을 받았습니다.`;
  game.moves.push({ type: 'sell-building', seat, property: index, level: level - 1, refund, at });
  const settled = trySettleLiquidation(game, seat);
  if (settled === 'advance') advanceTurn(game);
  return { legal: true, property: index, refund, level: level - 1 };
}

function sellPropertyAt(game, seat, index, at) {
  if (game.owners[index] !== seat) return { legal: false, reason: 'not-owner' };
  const level = propertyLevel(game, index);
  const refund = Math.floor(TILES[index].price * 0.5) + Math.floor(buildCost(index) * 0.5) * level;
  delete game.owners[index];
  game.developments[index] = 0;
  game.players[seat].properties = game.players[seat].properties.filter(p => p !== index);
  game.players[seat].cash += refund;
  game.lastEvent = `${TILES[index].name}을(를) 매각해 ${refund}을 받았습니다.`;
  game.moves.push({ type: 'sell-property', seat, property: index, refund, at });
  const settled = trySettleLiquidation(game, seat);
  if (settled === 'advance') advanceTurn(game);
  return { legal: true, property: index, refund };
}

function sellProperty(game, seat, tileIndex, at) {
  if (!validSeat(game, seat)) return { legal: false, reason: 'not-player' };
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (!canActNow(game, seat)) return { legal: false, reason: 'not-your-turn' };
  if (!Number.isInteger(tileIndex) || !TILES[tileIndex]) return { legal: false, reason: 'not-owner' };
  return sellPropertyAt(game, seat, tileIndex, at);
}

function canActNow(game, seat) {
  return game.turn === seat || (game.phase === 'liquidate' && game.liquidating === seat);
}

// Called after any sale while a debt is pending: pays it off the moment the seller can afford
// it, and force-liquidates the rest (creditor paid first) only once nothing is left to sell.
function trySettleLiquidation(game, seat) {
  if (game.phase !== 'liquidate' || game.liquidating !== seat || !game.pendingDebt) return null;
  const player = game.players[seat];
  const { amount, payee } = game.pendingDebt;
  if (player.cash >= amount) {
    player.cash -= amount;
    if (payee && game.players[payee]) game.players[payee].cash += amount;
    game.lastEvent = `${game.lastEvent ? game.lastEvent + ' ' : ''}미지급 금액 ${amount}을 정산했습니다.`;
    game.liquidating = null;
    game.pendingDebt = null;
    game.phase = 'roll';
    return 'advance';
  }
  if (player.properties.length === 0) {
    bankrupt(game, seat, payee, amount);
    return 'advance';
  }
  return 'pending';
}

// A player who cannot cover a debt even with nothing left to sell goes bankrupt: their
// (already-empty) remaining cash is force-paid to the creditor first, up to what's owed, and
// they're removed from the game but keep spectating.
function bankrupt(game, seat, payee, amount) {
  const player = game.players[seat];
  for (const index of [...player.properties]) sellPropertyAt(game, seat, index, null);
  const paid = Math.min(player.cash, amount);
  player.cash -= paid;
  if (payee && game.players[payee]) game.players[payee].cash += paid;
  player.eliminated = true;
  player.cash = 0;
  game.eliminationOrder.push(seat);
  game.liquidating = null;
  game.pendingDebt = null;
  game.lastEvent = `${game.lastEvent ? game.lastEvent + ' ' : ''}${seatBankruptLabel(seat)} 파산했습니다.`;
  const remaining = activeSeats(game);
  if (remaining.length <= 1) { finishGame(game); return; }
  if (game.turn === seat) game.turn = nextActiveSeat(game, seat) ?? remaining[0];
  game.phase = 'roll';
}

function seatBankruptLabel(seat) { return `${seat}번`; }

// A payment that would take cash negative never applies immediately -- it opens a liquidation
// window (the player can sell any owned building or property, in any order) instead of ending
// the game on the spot.
function chargeOrLiquidate(game, seat, amount, payee) {
  const player = game.players[seat];
  if (player.cash >= amount) {
    player.cash -= amount;
    if (payee && game.players[payee]) game.players[payee].cash += amount;
    return false;
  }
  game.phase = 'liquidate';
  game.liquidating = seat;
  game.pendingDebt = { amount, payee: payee || null };
  if (player.properties.length === 0) bankrupt(game, seat, payee, amount);
  return true;
}

function resolveLanding(game, seat, oldPosition, at) {
  const player = game.players[seat];
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
    if (owner !== seat) {
      const toll = propertyToll(game, tile.index);
      game.lastEvent = `${tile.name} 통행료 ${toll}을 지불했습니다.`;
      if (chargeOrLiquidate(game, seat, toll, owner)) return;
    } else {
      game.lastEvent = `내 도시 ${tile.name}에 도착했습니다.`;
      if (propertyLevel(game, tile.index) < 3) {
        game.pendingProperty = tile.index;
        game.phase = 'build';
        return;
      }
    }
  } else if (tile.type === 'tax') {
    game.lastEvent = `${tile.name} ${tile.amount}을 납부했습니다.`;
    if (chargeOrLiquidate(game, seat, tile.amount, null)) return;
  } else if (tile.type === 'event') {
    const text = EVENT_TEXT[tile.index] || '기회 광장: 작은 행운이 찾아왔습니다. +50';
    const amount = text.includes('-') ? -Number(text.match(/-(\d+)/)?.[1] || 0) : Number(text.match(/\+(\d+)/)?.[1] || 0);
    game.lastEvent = text;
    if (amount < 0) { if (chargeOrLiquidate(game, seat, -amount, null)) return; }
    else player.cash += amount;
  } else {
    game.lastEvent = `${tile.name}에서 잠시 쉽니다.`;
  }
  advanceTurn(game);
}

function rollDice(game, seat, at, die = randomDie, expectedMoveCount = null) {
  if (!validSeat(game, seat)) return { legal: false, reason: 'not-player' };
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (game.turn !== seat) return { legal: false, reason: 'not-your-turn' };
  if (game.phase !== 'roll') return { legal: false, reason: 'must-buy' };
  if (expectedMoveCount !== null && (!Number.isSafeInteger(expectedMoveCount) || expectedMoveCount !== game.moves.length))
    return { legal: false, reason: 'stale-roll' };
  const first = die();
  const second = die();
  if (![first, second].every(value => Number.isInteger(value) && value >= 1 && value <= 6)) return { legal: false, reason: 'bad-die' };
  const player = game.players[seat];
  const oldPosition = player.position;
  const total = first + second;
  const double = first === second;
  game.extraRoll = double;
  player.position = (player.position + total) % TILES.length;
  game.lastRoll = { seat, first, second, total, double, from: oldPosition, to: player.position, at };
  game.moves.push({ type: 'roll', ...game.lastRoll });
  resolveLanding(game, seat, oldPosition, at);
  return { legal: true, first, second, total, double, position: player.position, phase: game.phase, finished: game.status !== 'playing' };
}

function buyProperty(game, seat, at) {
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (game.turn !== seat) return { legal: false, reason: 'not-your-turn' };
  if (game.phase !== 'buy' || game.pendingProperty === null) return { legal: false, reason: 'not-for-sale' };
  const tile = TILES[game.pendingProperty];
  const player = game.players[seat];
  if (player.cash < tile.price) return { legal: false, reason: 'not-enough-cash' };
  player.cash -= tile.price;
  player.properties.push(tile.index);
  game.owners[tile.index] = seat;
  game.developments ||= {};
  game.developments[tile.index] = 0;
  game.lastEvent = `${tile.name}을(를) ${tile.price}에 매입했습니다.`;
  game.moves.push({ type: 'buy', seat, property: tile.index, at });
  advanceTurn(game);
  return { legal: true, property: tile.index, finished: game.status !== 'playing' };
}

function skipProperty(game, seat, at) {
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (game.turn !== seat) return { legal: false, reason: 'not-your-turn' };
  if (game.phase !== 'buy' || game.pendingProperty === null) return { legal: false, reason: 'not-for-sale' };
  const property = game.pendingProperty;
  game.moves.push({ type: 'skip', seat, property, at });
  game.lastEvent = `${TILES[property].name} 매입을 건너뛰었습니다.`;
  advanceTurn(game);
  return { legal: true, property, finished: game.status !== 'playing' };
}

function buildProperty(game, seat, at) {
  if (!validSeat(game, seat)) return { legal: false, reason: 'not-player' };
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (game.turn !== seat) return { legal: false, reason: 'not-your-turn' };
  const index = game.pendingProperty;
  if (game.phase !== 'build' || index === null || game.owners[index] !== seat || game.players[seat].position !== index)
    return { legal: false, reason: 'not-buildable' };
  const level = propertyLevel(game, index);
  if (level >= 3) return { legal: false, reason: 'max-level' };
  const cost = buildCost(index);
  if (game.players[seat].cash < cost) return { legal: false, reason: 'not-enough-cash' };
  game.players[seat].cash -= cost;
  game.developments ||= {};
  game.developments[index] = level + 1;
  game.lastEvent = `${TILES[index].name}에 ${BUILD_NAMES[level + 1]} 건설 · 비용 ${cost} · 통행료 ${propertyToll(game, index)}`;
  game.moves.push({ type: 'build', seat, property: index, level: level + 1, cost, at });
  advanceTurn(game);
  return { legal: true, property: index, level: level + 1, finished: game.status !== 'playing' };
}

function skipBuild(game, seat, at) {
  if (!validSeat(game, seat)) return { legal: false, reason: 'not-player' };
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (game.turn !== seat) return { legal: false, reason: 'not-your-turn' };
  const index = game.pendingProperty;
  if (game.phase !== 'build' || index === null || game.owners[index] !== seat || game.players[seat].position !== index)
    return { legal: false, reason: 'not-buildable' };
  game.moves.push({ type: 'skip-build', seat, property: index, at });
  game.lastEvent = `${TILES[index].name} 건설을 건너뛰었습니다.`;
  advanceTurn(game);
  return { legal: true, property: index, finished: game.status !== 'playing' };
}

function applyMove() { return { legal: false, reason: 'wrong-action' }; }

function moveError(reason) {
  if (reason === 'not-player') return '플레이어 역할을 먼저 선택해 주세요.';
  if (reason === 'not-playing') return '지금은 게임을 진행할 수 없습니다.';
  if (reason === 'not-your-turn') return '지금은 자산을 매각할 수 없습니다.';
  if (reason === 'must-buy') return '도시 매입 또는 건설 여부를 먼저 선택해 주세요.';
  if (reason === 'stale-roll') return '이미 처리된 주사위 요청입니다. 갱신된 차례를 확인하고 다시 굴려 주세요.';
  if (reason === 'not-for-sale') return '지금 매입할 수 있는 도시가 없습니다.';
  if (reason === 'not-enough-cash') return '현금이 부족해 매입하거나 건설할 수 없습니다.';
  if (reason === 'not-buildable') return '자기 소유 도시에 도착했을 때만 건설할 수 있습니다.';
  if (reason === 'max-level') return '호텔까지 건설한 도시는 더 개발할 수 없습니다.';
  if (reason === 'not-owner') return '자신이 소유한 도시만 매각할 수 있습니다.';
  if (reason === 'no-building') return '매각할 건물이 없습니다.';
  if (reason === 'not-enough-players') return '2~4명이 자리를 선택해야 시작할 수 있습니다.';
  if (reason === 'already-started') return '이미 시작된 대국입니다.';
  return '현재 처리할 수 없는 요청입니다.';
}

function publicState(game) {
  return {
    size: 24, board: [], status: game.status, turn: game.turn, winner: game.winner, winningLine: null,
    ranking: game.ranking, seatOrder: game.seatOrder || [],
    round: game.round, phase: game.phase, turnCount: game.turnCount, turnLimit: TURN_LIMIT,
    completedTurns: game.completedTurns || {}, extraRoll: Boolean(game.extraRoll),
    pendingProperty: game.pendingProperty, lastRoll: game.lastRoll, lastEvent: game.lastEvent,
    liquidating: game.liquidating, pendingDebt: game.pendingDebt,
    tiles: TILES, players: game.players, owners: game.owners, developments: game.developments || {},
    tolls: Object.fromEntries(TILES.filter(tile => tile.type === 'property').map(tile => [tile.index, propertyToll(game, tile.index)])),
    legalMoves: [], moveCount: game.moves.length, lastMove: game.moves.at(-1) || null,
    scores: Object.fromEntries((game.seatOrder || []).map(seat => [seat, netWorth(game, seat)])), lastPass: null,
    paused: Boolean(game.paused), disconnectedSeats: game.disconnectedSeats || [],
    endReason: game.endReason || null, disconnectedAtEnd: game.disconnectedAtEnd || [],
  };
}

module.exports = {
  ...metadata, TILES, SEATS, START_CASH, START_BONUS, TURN_LIMIT, create, start, reset, rollDice,
  buyProperty, skipProperty, buildProperty, skipBuild, sellProperty, sellBuilding,
  propertyLevel, propertyToll, buildCost, applyMove, publicState, moveError, netWorth, activeSeats,
};
