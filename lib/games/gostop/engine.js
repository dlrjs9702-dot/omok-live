'use strict';

// Go-Stop / Matgo turn engine. Server-only state (deck order, every hand) lives in `game`; only
// publicState()/handFor() decide what leaves the server. One turn = play (or a bomb-flip) ->
// optional capture choice -> flip from the deck -> optional capture choice -> steals / sweep ->
// optional 국진 choice -> go/stop decision or next turn.
const crypto = require('node:crypto');
const { getCard, isBonus, monthOf, shuffled, piWorth } = require('./cards');
const scoring = require('./scoring');

const STAKES = [10, 50, 100];
const DEAL = { matgo: { hand: 10, floor: 8 }, gostop: { hand: 7, floor: 6 } };

function secureRandom() { return crypto.randomInt(0, 2 ** 32) / 2 ** 32; }

function perSeat(seats, value) { return Object.fromEntries(seats.map(seat => [seat, typeof value === 'function' ? value() : value])); }

function create() {
  return {
    status: 'selecting', round: 1, mode: null, pointsPerScore: 100,
    seatOrder: [], firstSeat: null, nextFirstSeat: null, turn: null, phase: null,
    deck: [], hands: {}, floor: [], floorBonus: {}, captured: {},
    goCount: {}, lastGoScore: {}, shakes: {}, bombs: {}, bombFlips: {}, ppeok: {}, ppeokOwner: {}, gukjin: {},
    ctx: null, lastEvent: null, eventSeq: 0, moveCount: 0,
    nagariStreak: 0, nagariSignature: null,
    winner: null, result: null, endReason: null, settlement: null,
  };
}

function reset(game) {
  const keep = { pointsPerScore: game.pointsPerScore, nagariStreak: game.nagariStreak || 0, nagariSignature: game.nagariSignature || null,
    nextFirstSeat: game.nextFirstSeat || null, round: Number(game.round || 1) + 1 };
  Object.assign(game, create(), keep);
}

function setStake(game, value) {
  if (game.status !== 'selecting') return { legal: false, reason: 'already-started' };
  const stake = Number(value);
  if (!STAKES.includes(stake)) return { legal: false, reason: 'bad-stake' };
  game.pointsPerScore = stake;
  return { legal: true };
}

function nextSeat(game, seat) {
  const order = game.seatOrder;
  return order[(order.indexOf(seat) + 1) % order.length];
}

function opponents(game, seat) { return game.seatOrder.filter(other => other !== seat); }

function floorOfMonth(game, month) { return game.floor.filter(id => monthOf(id) === month); }

function event(game, seat, tags, extra = {}) {
  game.eventSeq += 1;
  game.lastEvent = { seq: game.eventSeq, seat, tags, ...extra };
}

function deal(game, random) {
  const plan = DEAL[game.mode];
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const deck = shuffled(random);
    const hands = perSeat(game.seatOrder, () => []);
    // Deal starting from the first player, one card at a time.
    const order = [...game.seatOrder.slice(game.seatOrder.indexOf(game.firstSeat)), ...game.seatOrder.slice(0, game.seatOrder.indexOf(game.firstSeat))];
    for (let i = 0; i < plan.hand; i += 1) for (const seat of order) hands[seat].push(deck.shift());
    const floor = deck.splice(0, plan.floor);
    const firstBonus = [];
    // A bonus card turned up on the opening floor goes to the first player; refill from the deck.
    for (let index = 0; index < floor.length; index += 1) {
      while (isBonus(floor[index])) { firstBonus.push(floor[index]); floor[index] = deck.shift(); }
    }
    const monthCounts = new Map();
    for (const id of floor) monthCounts.set(monthOf(id), (monthCounts.get(monthOf(id)) || 0) + 1);
    if ([...monthCounts.values()].some(count => count === 4)) continue; // all four of a month on the floor: redeal
    game.deck = deck; game.hands = hands; game.floor = floor;
    game.captured = perSeat(game.seatOrder, () => []);
    game.captured[game.firstSeat].push(...firstBonus);
    return { firstBonus };
  }
  throw new Error('deal failed');
}

function start(game, seats, { random = secureRandom, signature = null } = {}) {
  if (game.status !== 'selecting') return { legal: false, reason: 'already-started' };
  const seatOrder = [...new Set(seats.map(String))].sort((a, b) => Number(a) - Number(b));
  if (seatOrder.length < 2 || seatOrder.length > 3) return { legal: false, reason: 'player-count' };
  // A different line-up never inherits an earlier line-up's 나가리 multiplier.
  if (signature !== game.nagariSignature) { game.nagariStreak = 0; game.nagariSignature = signature; }
  game.mode = seatOrder.length === 2 ? 'matgo' : 'gostop';
  game.seatOrder = seatOrder;
  game.firstSeat = seatOrder.includes(game.nextFirstSeat) ? game.nextFirstSeat : seatOrder[Math.floor(random() * seatOrder.length)];
  for (const key of ['goCount', 'lastGoScore', 'shakes', 'bombs', 'bombFlips', 'ppeok']) game[key] = perSeat(seatOrder, 0);
  game.gukjin = perSeat(seatOrder, null);
  game.ppeokOwner = {}; game.floorBonus = {};
  const { firstBonus } = deal(game, random);
  game.status = 'playing'; game.phase = 'play'; game.turn = game.firstSeat; game.ctx = null;
  game.winner = null; game.result = null; game.endReason = null; game.settlement = null;
  event(game, game.firstSeat, firstBonus.length ? ['deal', 'bonus'] : ['deal'], { captured: firstBonus });
  // 총통: all four cards of one month dealt to one hand -> 10점 immediate win (bonus cards excluded).
  for (const seat of [...seatOrder.slice(seatOrder.indexOf(game.firstSeat)), ...seatOrder.slice(0, seatOrder.indexOf(game.firstSeat))]) {
    const counts = new Map();
    for (const id of game.hands[seat]) if (!isBonus(id)) counts.set(monthOf(id), (counts.get(monthOf(id)) || 0) + 1);
    const month = [...counts.entries()].find(([, count]) => count === 4)?.[0];
    if (month) {
      event(game, seat, ['chongtong'], { revealed: game.hands[seat].filter(id => monthOf(id) === month) });
      finish(game, seat, 'chongtong');
      break;
    }
  }
  return { legal: true };
}

// ---- turn helpers -------------------------------------------------------------------------

function equivalent(a, b) {
  const x = getCard(a); const y = getCard(b);
  return x.kind === y.kind && x.piValue === y.piValue && !x.gukjin && !y.gukjin && (x.dan || null) === (y.dan || null) && !x.godori && !y.godori;
}

function takeFloor(game, ids) {
  game.floor = game.floor.filter(id => !ids.includes(id));
}

// Capturing the whole stack of a month also takes any bonus card buried with a 뻑 on it.
function captureStack(ctx, game, month) {
  const bonus = game.floorBonus[month] || [];
  delete game.floorBonus[month];
  ctx.captured.push(...bonus);
  const owner = game.ppeokOwner[month];
  delete game.ppeokOwner[month];
  return owner;
}

function stealPiFrom(game, from, to) {
  const pile = game.captured[from];
  const candidates = pile
    .map(id => ({ id, worth: piWorth(id, game.gukjin[from] === 'pi') }))
    .filter(item => item.worth > 0)
    .sort((a, b) => a.worth - b.worth || (getCard(a.id).gukjin ? 1 : 0) - (getCard(b.id).gukjin ? 1 : 0));
  const pick = candidates[0];
  if (!pick) return null;
  game.captured[from] = pile.filter(id => id !== pick.id);
  game.captured[to].push(pick.id);
  if (getCard(pick.id).gukjin && game.gukjin[to] === null) game.gukjin[to] = 'pi';
  return pick.id;
}

function handMonthCount(game, seat, month) { return game.hands[seat].filter(id => !isBonus(id) && monthOf(id) === month).length; }

function playOptions(game, seat, id) {
  if (isBonus(id)) return { shake: false, bomb: false, kong: false };
  const month = monthOf(id);
  const inHand = handMonthCount(game, seat, month);
  const onFloor = floorOfMonth(game, month).length;
  return { shake: inHand === 3 && onFloor === 0, bomb: inHand === 3 && onFloor === 1, kong: inHand === 2 && onFloor === 2 };
}

function requireTurn(game, seat, phase) {
  if (game.status !== 'playing') return 'not-playing';
  if (game.turn !== String(seat)) return 'not-your-turn';
  if (game.phase !== phase) return 'wrong-phase';
  return null;
}

// ---- actions ------------------------------------------------------------------------------

function play(game, seat, cardId, { shake = false, bomb = false, kong = false } = {}) {
  seat = String(seat);
  const error = requireTurn(game, seat, 'play');
  if (error) return { legal: false, reason: error };
  const hand = game.hands[seat];
  if (!hand.includes(cardId)) return { legal: false, reason: 'not-in-hand' };

  if (isBonus(cardId)) {
    // A bonus card from the hand is taken straight away; the player draws a replacement from the
    // deck and keeps the turn.
    game.hands[seat] = hand.filter(id => id !== cardId);
    game.captured[seat].push(cardId);
    const drawn = game.deck.length ? game.deck.shift() : null;
    if (drawn) game.hands[seat].push(drawn);
    game.moveCount += 1;
    event(game, seat, ['bonus'], { played: [cardId], captured: [cardId] });
    return { legal: true, bonus: true };
  }

  const options = playOptions(game, seat, cardId);
  if ((shake && !options.shake) || (bomb && !options.bomb) || (kong && !options.kong)) return { legal: false, reason: 'bad-special' };
  const month = monthOf(cardId);
  const matches = floorOfMonth(game, month);
  const ctx = { seat, month, played: [], held: [], placed: false, wasPair: false, captured: [], steal: 0, tags: [], revealed: [], bonusFlipped: [], flipped: null };
  game.ctx = ctx;
  game.moveCount += 1;

  if (bomb || kong) {
    const cards = hand.filter(id => !isBonus(id) && monthOf(id) === month);
    game.hands[seat] = hand.filter(id => !cards.includes(id));
    takeFloor(game, matches);
    ctx.played = cards;
    ctx.captured.push(...cards, ...matches);
    captureStack(ctx, game, month);
    ctx.steal += 1;
    if (bomb) { game.bombs[seat] += 1; game.bombFlips[seat] += 2; ctx.tags.push('bomb'); }
    else { game.bombFlips[seat] += 1; ctx.tags.push('kong'); }
    return flip(game);
  }

  if (shake) {
    game.shakes[seat] += 1;
    ctx.tags.push('shake');
    ctx.revealed = hand.filter(id => !isBonus(id) && monthOf(id) === month);
  }
  game.hands[seat] = hand.filter(id => id !== cardId);
  ctx.played = [cardId];
  if (matches.length === 0) {
    ctx.placed = true;
    game.floor.push(cardId);
    return flip(game);
  }
  if (matches.length === 1) {
    takeFloor(game, matches);
    ctx.held = [cardId, matches[0]];
    return flip(game);
  }
  if (matches.length === 2) {
    ctx.wasPair = true;
    if (equivalent(matches[0], matches[1])) return chooseFromPair(game, matches[0]);
    ctx.options = matches;
    game.phase = 'choose-floor';
    event(game, seat, ['choose'], { played: [cardId], options: matches });
    return { legal: true, choice: 'floor' };
  }
  // Three of the month already on the floor (a 뻑 stack or an opening triple): take all four.
  takeFloor(game, matches);
  ctx.captured.push(cardId, ...matches);
  const owner = captureStack(ctx, game, month);
  if (owner) { ctx.steal += owner === seat ? 2 : 1; ctx.tags.push(owner === seat ? 'jappeok' : 'ppeokEat'); }
  return flip(game);
}

function chooseFromPair(game, chosen) {
  const ctx = game.ctx;
  takeFloor(game, [chosen]);
  ctx.held = [ctx.played[0], chosen];
  ctx.options = null;
  game.phase = 'play';
  return flip(game);
}

function chooseFloor(game, seat, cardId) {
  const error = requireTurn(game, String(seat), 'choose-floor');
  if (error) return { legal: false, reason: error };
  if (!game.ctx?.options?.includes(cardId)) return { legal: false, reason: 'bad-choice' };
  return chooseFromPair(game, cardId);
}

function flipOnly(game, seat) {
  seat = String(seat);
  const error = requireTurn(game, seat, 'play');
  if (error) return { legal: false, reason: error };
  if (!(game.bombFlips[seat] > 0)) return { legal: false, reason: 'no-bomb-flip' };
  game.bombFlips[seat] -= 1;
  game.moveCount += 1;
  game.ctx = { seat, month: null, played: [], held: [], placed: false, wasPair: false, captured: [], steal: 0, tags: ['bombFlip'], revealed: [], bonusFlipped: [], flipped: null };
  return flip(game);
}

function flip(game) {
  const ctx = game.ctx;
  let drawn = null;
  while (game.deck.length) {
    const next = game.deck.shift();
    if (isBonus(next)) { ctx.bonusFlipped.push(next); continue; } // take it and flip again
    drawn = next;
    break;
  }
  ctx.flipped = drawn;
  const M = ctx.month;
  const N = drawn ? monthOf(drawn) : null;

  if (ctx.held.length && N === M && !ctx.wasPair) {
    // 뻑: played card, its match and the flipped card all stay on the floor as one stack.
    game.floor.push(...ctx.held, drawn);
    game.floorBonus[M] = [...(game.floorBonus[M] || []), ...ctx.bonusFlipped];
    ctx.bonusFlipped = [];
    ctx.held = [];
    game.ppeokOwner[M] = ctx.seat;
    game.ppeok[ctx.seat] += 1;
    ctx.tags.push('ppeok');
    return finishTurn(game);
  }
  if (ctx.placed && drawn && N === M) {
    // 쪽: the played card found no match, then the flip matched it.
    takeFloor(game, [ctx.played[0]]);
    ctx.captured.push(ctx.played[0], drawn);
    ctx.steal += 1;
    ctx.tags.push('jjok');
    return finishTurn(game);
  }
  if (ctx.wasPair && drawn && N === M) {
    // 따닥: two on the floor, played the third, flipped the fourth -- take all four.
    const rest = floorOfMonth(game, M);
    takeFloor(game, rest);
    ctx.captured.push(...ctx.held, ...rest, drawn);
    ctx.held = [];
    ctx.steal += 1;
    ctx.tags.push('ttadak');
    return finishTurn(game);
  }
  if (ctx.held.length) { ctx.captured.push(...ctx.held); ctx.held = []; }
  if (!drawn) return finishTurn(game);
  return resolveFlipped(game, drawn);
}

function resolveFlipped(game, drawn) {
  const ctx = game.ctx;
  const month = monthOf(drawn);
  const matches = floorOfMonth(game, month);
  if (matches.length === 0) { game.floor.push(drawn); return finishTurn(game); }
  if (matches.length === 1) { takeFloor(game, matches); ctx.captured.push(drawn, matches[0]); return finishTurn(game); }
  if (matches.length === 2) {
    if (equivalent(matches[0], matches[1])) { takeFloor(game, [matches[0]]); ctx.captured.push(drawn, matches[0]); return finishTurn(game); }
    ctx.flipOptions = matches;
    game.phase = 'choose-flip';
    event(game, ctx.seat, ['choose'], { played: ctx.played, flipped: drawn, options: matches });
    return { legal: true, choice: 'flip' };
  }
  takeFloor(game, matches);
  ctx.captured.push(drawn, ...matches);
  const owner = captureStack(ctx, game, month);
  if (owner) { ctx.steal += owner === ctx.seat ? 2 : 1; ctx.tags.push(owner === ctx.seat ? 'jappeok' : 'ppeokEat'); }
  return finishTurn(game);
}

function chooseFlip(game, seat, cardId) {
  const error = requireTurn(game, String(seat), 'choose-flip');
  if (error) return { legal: false, reason: error };
  const ctx = game.ctx;
  if (!ctx?.flipOptions?.includes(cardId)) return { legal: false, reason: 'bad-choice' };
  takeFloor(game, [cardId]);
  ctx.captured.push(ctx.flipped, cardId);
  ctx.flipOptions = null;
  game.phase = 'play';
  return finishTurn(game);
}

function handsExhausted(game) {
  return game.seatOrder.every(seat => game.hands[seat].length === 0 && !(game.bombFlips[seat] > 0));
}

function finishTurn(game) {
  const ctx = game.ctx;
  const seat = ctx.seat;
  game.captured[seat].push(...ctx.captured, ...ctx.bonusFlipped);
  // 판쓸이: the floor is left empty (not counted on the very last turn of the hand).
  if (game.floor.length === 0 && !handsExhausted(game)) { ctx.steal += 1; ctx.tags.push('sweep'); }
  const stolen = [];
  for (let i = 0; i < ctx.steal; i += 1) {
    for (const other of opponents(game, seat)) {
      const id = stealPiFrom(game, other, seat);
      if (id) stolen.push({ from: other, id });
    }
  }
  event(game, seat, ctx.tags.length ? ctx.tags : ['play'], {
    played: ctx.played, flipped: ctx.flipped, captured: [...ctx.captured, ...ctx.bonusFlipped], stolen, revealed: ctx.revealed,
  });
  if (game.gukjin[seat] === null && game.captured[seat].includes('m09-animal')) {
    game.phase = 'gukjin';
    return { legal: true, choice: 'gukjin' };
  }
  return afterTurn(game);
}

function chooseGukjin(game, seat, asPi) {
  seat = String(seat);
  const error = requireTurn(game, seat, 'gukjin');
  if (error) return { legal: false, reason: error };
  game.gukjin[seat] = asPi ? 'pi' : 'animal';
  event(game, seat, ['gukjin'], { choice: game.gukjin[seat] });
  return afterTurn(game);
}

function baseScore(game, seat) {
  return scoring.scoreBreakdown(game.captured[seat], game.gukjin[seat] === 'pi').total;
}

function afterTurn(game) {
  const seat = game.ctx.seat;
  game.ctx = null;
  if (game.ppeok[seat] >= 3) { event(game, seat, ['samppeok']); finish(game, seat, 'samppeok'); return { legal: true, finished: true }; }
  const score = baseScore(game, seat);
  const eligible = score >= scoring.STOP_THRESHOLD[game.mode] && score > (game.lastGoScore[seat] || 0);
  if (eligible) {
    // With nothing left to play anywhere a "go" could never be followed up: it is an automatic stop.
    if (handsExhausted(game)) { finish(game, seat, 'stop'); return { legal: true, finished: true }; }
    game.phase = 'go-stop';
    game.turn = seat;
    return { legal: true, decision: true };
  }
  return advance(game);
}

function advance(game) {
  if (handsExhausted(game)) { nagari(game); return { legal: true, finished: true }; }
  let seat = game.turn;
  for (let i = 0; i < game.seatOrder.length; i += 1) {
    seat = nextSeat(game, seat);
    if (game.hands[seat].length || game.bombFlips[seat] > 0) break;
  }
  game.turn = seat;
  game.phase = 'play';
  return { legal: true };
}

function decide(game, seat, choice) {
  seat = String(seat);
  const error = requireTurn(game, seat, 'go-stop');
  if (error) return { legal: false, reason: error };
  if (choice === 'stop') { event(game, seat, ['stop']); finish(game, seat, 'stop'); return { legal: true, finished: true }; }
  if (choice !== 'go') return { legal: false, reason: 'bad-choice' };
  game.goCount[seat] += 1;
  game.lastGoScore[seat] = baseScore(game, seat);
  event(game, seat, ['go'], { goCount: game.goCount[seat] });
  return advance(game);
}

// ---- results ------------------------------------------------------------------------------

function computeResult(game, winner, reason) {
  const winnerBreak = scoring.scoreBreakdown(game.captured[winner], game.gukjin[winner] === 'pi');
  const instant = reason === 'chongtong' || reason === 'samppeok';
  const base = instant ? scoring.INSTANT_WIN_SCORE : winnerBreak.total;
  const goCount = game.goCount[winner] || 0;
  const score = base + goCount;
  const losers = opponents(game, winner).map((seat) => {
    const loserBreak = scoring.scoreBreakdown(game.captured[seat], game.gukjin[seat] === 'pi');
    const bakList = scoring.baks({ mode: game.mode, winner: winnerBreak, loser: loserBreak, loserWent: (game.goCount[seat] || 0) > 0 });
    const pay = scoring.payment({ score, goCount, shakes: game.shakes[winner] || 0, bombs: game.bombs[winner] || 0,
      nagari: game.nagariStreak || 0, bakList, pointsPerScore: game.pointsPerScore });
    return { seat, baks: bakList, ...pay };
  });
  return { kind: 'win', winner, reason, base, goCount, score, items: winnerBreak.items, nagariStreak: game.nagariStreak || 0, pointsPerScore: game.pointsPerScore, losers };
}

function finish(game, winner, reason) {
  game.status = 'finished';
  game.phase = 'done';
  game.winner = winner;
  game.result = computeResult(game, winner, reason);
  game.nextFirstSeat = winner;
  game.nagariStreak = 0; // consumed by this result
}

function nagari(game) {
  game.status = 'draw';
  game.phase = 'done';
  game.winner = null;
  game.nagariStreak = (game.nagariStreak || 0) + 1;
  game.result = { kind: 'nagari', nextMultiplier: 2 ** game.nagariStreak, pointsPerScore: game.pointsPerScore };
  game.nextFirstSeat = game.firstSeat;
  event(game, game.turn, ['nagari']);
}

// A forfeit (resign, or a paused game ended against an unresponsive player) is a game-center
// house rule, not a 대박맞고 one: each forfeiting seat pays every remaining seat the stop threshold
// times the carried-over 나가리 multiplier. Called by the server after it has set the winners.
function forfeitResult(game, forfeitingSeats, reason) {
  const threshold = scoring.STOP_THRESHOLD[game.mode] || 7;
  const multiplier = 2 ** (game.nagariStreak || 0);
  const winners = game.seatOrder.filter(seat => !forfeitingSeats.includes(seat));
  game.phase = 'done';
  game.result = {
    kind: 'forfeit', reason, forfeiting: [...forfeitingSeats], winners, score: threshold, pointsPerScore: game.pointsPerScore,
    payments: forfeitingSeats.flatMap(from => winners.map(to => ({ from, to, score: threshold, multiplier, amount: threshold * multiplier * game.pointsPerScore }))),
  };
  game.nagariStreak = 0;
  return game.result;
}

// ---- views --------------------------------------------------------------------------------

function seatSummary(game, seat) {
  const breakdown = scoring.scoreBreakdown(game.captured[seat] || [], game.gukjin[seat] === 'pi');
  const goCount = game.goCount[seat] || 0;
  const multiplier = scoring.goMultiplier(goCount) * 2 ** (game.shakes[seat] || 0) * 2 ** (game.bombs[seat] || 0) * 2 ** (game.nagariStreak || 0);
  return {
    captured: [...(game.captured[seat] || [])], handCount: (game.hands[seat] || []).length,
    score: breakdown.total, items: breakdown.items, counts: breakdown.counts,
    goCount, shakes: game.shakes[seat] || 0, bombs: game.bombs[seat] || 0, bombFlips: game.bombFlips[seat] || 0,
    ppeok: game.ppeok[seat] || 0, gukjin: game.gukjin[seat],
    multiplier, estimate: (breakdown.total + goCount) * multiplier * game.pointsPerScore,
  };
}

// Everything here is public: no deck order and no hand contents, for players and spectators alike.
function publicState(game) {
  const ctx = game.ctx;
  return {
    status: game.status, round: game.round, mode: game.mode, pointsPerScore: game.pointsPerScore, stakes: STAKES,
    stopThreshold: game.mode ? scoring.STOP_THRESHOLD[game.mode] : null,
    seatOrder: [...game.seatOrder], firstSeat: game.firstSeat, turn: game.turn, phase: game.phase,
    deckCount: game.deck.length, floor: [...game.floor],
    floorBonus: Object.fromEntries(Object.entries(game.floorBonus).map(([month, ids]) => [month, [...ids]])),
    ppeokOwner: { ...game.ppeokOwner },
    seats: Object.fromEntries(game.seatOrder.map(seat => [seat, seatSummary(game, seat)])),
    choice: game.phase === 'choose-floor' ? { kind: 'floor', played: ctx?.played?.[0] || null, options: [...(ctx?.options || [])] }
      : game.phase === 'choose-flip' ? { kind: 'flip', flipped: ctx?.flipped || null, options: [...(ctx?.flipOptions || [])] }
      : null,
    lastEvent: game.lastEvent ? structuredClone(game.lastEvent) : null,
    nagariStreak: game.nagariStreak || 0, nagariMultiplier: 2 ** (game.nagariStreak || 0),
    moveCount: game.moveCount, winner: game.winner, result: game.result ? structuredClone(game.result) : null,
    settlement: game.settlement ? structuredClone(game.settlement) : null,
    endReason: game.endReason || null, paused: Boolean(game.paused),
  };
}

// The viewer's own hand plus which special plays each card allows -- for that player only.
function handFor(game, seat) {
  seat = seat == null ? null : String(seat);
  if (!seat || !game.hands[seat]) return null;
  return game.hands[seat].map(id => ({ id, ...(game.status === 'playing' ? playOptions(game, seat, id) : { shake: false, bomb: false, kong: false }) }));
}

function moveError(reason) {
  return {
    'already-started': '이미 게임이 시작되었습니다.', 'player-count': '고스톱·맞고는 2명(맞고) 또는 3명(고스톱)이 필요합니다.',
    'bad-stake': '점당 포인트는 10P, 50P, 100P 중에서 선택해 주세요.', 'not-playing': '진행 중인 판이 아닙니다.',
    'not-your-turn': '지금은 내 차례가 아닙니다.', 'wrong-phase': '지금 할 수 있는 행동이 아닙니다.', 'not-in-hand': '내 손에 없는 패입니다.',
    'bad-special': '지금은 그 방식으로 낼 수 없습니다.', 'bad-choice': '선택할 수 없는 패입니다.', 'no-bomb-flip': '남은 폭탄 뒤집기가 없습니다.',
  }[reason] || '지금은 처리할 수 없습니다.';
}

module.exports = { STAKES, create, reset, setStake, start, play, chooseFloor, chooseFlip, flipOnly, chooseGukjin, decide,
  computeResult, forfeitResult, publicState, handFor, playOptions, moveError, finish, nagari };
