'use strict';

// 팬데믹(기본판) 2~4인 완전 협력. 규칙은 IDEAS.md 「팬데믹 기본 규칙」을 그대로 구현한다. 손패·직업은 공개 정보이고
// 두 카드 더미(플레이어/감염)의 순서는 서버 밖으로 나가지 않는다(publicState는 장수만 준다).
// 모든 변경은 act()/start()를 거치며, 결과는 { legal, reason? } 형태다.

const crypto = require('node:crypto');
const { COLORS, CITIES, CITY_IDS, ROLE_IDS, EVENT_IDS, INFECTION_RATES, DIFFICULTY } = require('./pandemic-data');

const SEATS = ['1', '2', '3', '4'];
const HAND_LIMIT = 7;
const ACTIONS_PER_TURN = 4;
const MAX_STATIONS = 6;
const CUBES_PER_COLOR = 24;
const START_HAND = { 2: 4, 3: 3, 4: 2 };
const OUTBREAK_LOSS = 8;
const EVENT_PREFIX = 'ev:';
const isEvent = (card) => typeof card === 'string' && card.startsWith(EVENT_PREFIX);
const eventId = (card) => card.slice(EVENT_PREFIX.length);
const eventCard = (id) => `${EVENT_PREFIX}${id}`;

const randomInt = (n) => crypto.randomInt(n);
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) { const j = randomInt(i + 1); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}

function emptyCubes() { return Object.fromEntries(CITY_IDS.map((id) => [id, { blue: 0, yellow: 0, black: 0, red: 0 }])); }

function create(options = {}) {
  return {
    status: 'selecting', round: options.round || 1, revision: options.revision || 0, moveCount: 0,
    difficulty: options.difficulty && DIFFICULTY[options.difficulty] ? options.difficulty : 'standard',
    seatOrder: [], roles: {}, pawns: {}, hands: {}, stored: {},
    playerDeck: [], playerDiscard: [], infectionDeck: [], infectionDiscard: [], removedEvents: [], removedInfection: [],
    cubes: emptyCubes(), supply: Object.fromEntries(COLORS.map((c) => [c, CUBES_PER_COLOR])), stations: [],
    cures: { blue: null, yellow: null, black: null, red: null }, rateIndex: 0, outbreaks: 0, epidemicsTotal: 0, epidemicsDrawn: 0,
    turn: null, turnNumber: 0, actionsLeft: 0, phase: null, pending: null, resume: null, quietNight: false, opsMoveUsed: false,
    winner: [], endReason: null, lastEvent: null, eventSeq: 0, log: [],
  };
}
function reset(game) { const next = create({ round: game.round + 1, revision: game.revision + 1, difficulty: game.difficulty }); Object.keys(game).forEach((k) => delete game[k]); Object.assign(game, next); }

const infectionRate = (game) => INFECTION_RATES[Math.min(game.rateIndex, INFECTION_RATES.length - 1)];
const cityCards = (hand) => hand.filter((card) => !isEvent(card));
const bump = (game) => { game.revision += 1; game.moveCount += 1; };
function note(game, event) { game.eventSeq += 1; game.lastEvent = { seq: game.eventSeq, ...event }; game.log.push(game.lastEvent); if (game.log.length > 80) game.log.shift(); }

function setSetup(game, options = {}) {
  if (game.status !== 'selecting') return { legal: false, reason: 'started' };
  if (options.difficulty !== undefined) { if (!DIFFICULTY[options.difficulty]) return { legal: false, reason: 'difficulty' }; game.difficulty = options.difficulty; }
  game.revision += 1;
  return { legal: true };
}

// ---- start -----------------------------------------------------------------------------------------------------
function start(game, seats) {
  if (game.status !== 'selecting') return { legal: false, reason: 'started' };
  const order = SEATS.filter((s) => seats.includes(s));
  if (order.length < 2 || order.length > 4) return { legal: false, reason: 'players' };
  game.seatOrder = order;
  const roles = shuffle([...ROLE_IDS]);
  order.forEach((seat, i) => { game.roles[seat] = roles[i]; game.pawns[seat] = 'atlanta'; game.hands[seat] = []; game.stored[seat] = null; });
  game.stations = ['atlanta'];
  // Infection: 3 cities x3 cubes, 3 x2, 3 x1 (18 cubes); those nine cards go to the discard pile. No protections apply during setup.
  game.infectionDeck = shuffle([...CITY_IDS]);
  for (const cubes of [3, 3, 3, 2, 2, 2, 1, 1, 1]) {
    const city = game.infectionDeck.shift();
    game.infectionDiscard.push(city);
    const color = CITIES[city].color;
    game.cubes[city][color] += cubes; game.supply[color] -= cubes;
  }
  // Player deck: 48 city cards + 5 events; hands first, then epidemics shuffled into equal piles.
  const deck = shuffle([...CITY_IDS, ...EVENT_IDS.map(eventCard)]);
  const handSize = START_HAND[order.length];
  for (let i = 0; i < handSize; i += 1) for (const seat of order) game.hands[seat].push(deck.shift());
  let first = order[0]; let best = -1;
  for (const seat of order) for (const card of game.hands[seat]) if (!isEvent(card) && CITIES[card].population > best) { best = CITIES[card].population; first = seat; }
  const epidemics = DIFFICULTY[game.difficulty].epidemics;
  game.epidemicsTotal = epidemics;
  const base = Math.floor(deck.length / epidemics); const extra = deck.length % epidemics;
  const piles = []; let cursor = 0;
  for (let i = 0; i < epidemics; i += 1) { const size = base + (i >= epidemics - extra ? 1 : 0); piles.push(deck.slice(cursor, cursor + size)); cursor += size; } // the larger piles end up at the bottom
  game.playerDeck = piles.flatMap((pile) => shuffle([...pile, 'epidemic']));
  for (const seat of order) game.hands[seat].sort(sortCards);
  game.status = 'playing'; game.turn = first; game.turnNumber = 1; game.actionsLeft = ACTIONS_PER_TURN; game.phase = 'actions';
  note(game, { kind: 'start', seat: first });
  bump(game);
  return { legal: true };
}
const sortCards = (a, b) => (isEvent(a) - isEvent(b)) || (isEvent(a) ? a.localeCompare(b) : (CITIES[a].color.localeCompare(CITIES[b].color) || CITIES[a].name.localeCompare(CITIES[b].name, 'ko')));

// ---- protections and cube placement ----------------------------------------------------------------------------
const roleSeat = (game, role) => game.seatOrder.find((s) => game.roles[s] === role) || null;
function protectedCity(game, city, color) {
  const q = roleSeat(game, 'quarantine');
  if (q) { const at = game.pawns[q]; if (at === city || CITIES[at].links.includes(city)) return true; }
  const m = roleSeat(game, 'medic');
  if (m && game.pawns[m] === city && game.cures[color]) return true;
  return false;
}
const totalCubes = (game, color) => CUBES_PER_COLOR - game.supply[color];

function lose(game, reason) {
  if (game.status !== 'playing') return;
  game.status = 'finished'; game.winner = []; game.endReason = reason; game.phase = null; game.pending = null; game.resume = null;
  note(game, { kind: 'lose', reason });
}
function win(game) {
  if (game.status !== 'playing') return;
  game.status = 'finished'; game.winner = [...game.seatOrder]; game.endReason = 'cures'; game.phase = null; game.pending = null; game.resume = null;
  note(game, { kind: 'win' });
}
function checkEradication(game, color) {
  if (game.cures[color] === 'cured' && totalCubes(game, color) === 0) { game.cures[color] = 'eradicated'; note(game, { kind: 'eradicate', color }); }
}

// Put one cube of `color` on `city`. The fourth cube is an outbreak. `chain` holds the cities that already broke out in this chain.
function addCube(game, city, color, chain) {
  if (game.status !== 'playing' || game.cures[color] === 'eradicated' || protectedCity(game, city, color)) return;
  if (game.cubes[city][color] >= 3) { outbreak(game, city, color, chain); return; }
  if (game.supply[color] <= 0) { lose(game, 'cubes'); return; }
  game.cubes[city][color] += 1; game.supply[color] -= 1;
  note(game, { kind: 'cube', city, color });
}
function outbreak(game, city, color, chain) {
  if (game.status !== 'playing' || chain.has(city)) return;
  chain.add(city);
  game.outbreaks += 1;
  note(game, { kind: 'outbreak', city, color, count: game.outbreaks });
  if (game.outbreaks >= OUTBREAK_LOSS) { lose(game, 'outbreaks'); return; }
  for (const next of CITIES[city].links) { if (game.status !== 'playing') return; addCube(game, next, color, chain); }
}
function infectCity(game, city, cubes = 1) {
  const color = CITIES[city].color;
  if (game.cures[color] === 'eradicated' || protectedCity(game, city, color)) { note(game, { kind: 'infect', city, color, blocked: true }); return; }
  note(game, { kind: 'infect', city, color });
  const chain = new Set();
  if (cubes === 1) { addCube(game, city, color, chain); return; }
  const existing = game.cubes[city][color];
  if (existing === 0) { for (let i = 0; i < 3 && game.status === 'playing'; i += 1) addCube(game, city, color, chain); return; }
  for (let i = existing; i < 3 && game.status === 'playing'; i += 1) addCube(game, city, color, chain);
  if (game.status === 'playing') outbreak(game, city, color, chain);
}

// ---- turn flow -------------------------------------------------------------------------------------------------
const holdsEvent = (game) => game.seatOrder.some((s) => game.hands[s].some(isEvent) || game.stored[s]);
const nextSeat = (game, seat) => game.seatOrder[(game.seatOrder.indexOf(seat) + 1) % game.seatOrder.length];

function endActions(game) { // actions are over: draw two player cards, then infect
  game.phase = 'draw';
  game.resume = { step: 'draw', remaining: 2, epidemicBefore: false };
  continueFlow(game);
}

// Runs the automatic part of a turn until something needs a person (hand limit, an event window) or the turn ends.
function continueFlow(game) {
  for (let guard = 0; guard < 100 && game.status === 'playing' && game.resume && !game.pending; guard += 1) {
    const r = game.resume;
    if (r.step === 'draw') {
      if (r.remaining <= 0) { game.resume = { step: 'infect-window' }; continue; }
      if (r.epidemicBefore && holdsEvent(game) && !r.windowShown) { r.windowShown = true; game.pending = { type: 'window', next: 'draw' }; return; } // between two epidemics
      r.windowShown = false;
      if (!game.playerDeck.length) { lose(game, 'deck'); return; }
      const card = game.playerDeck.shift(); r.remaining -= 1;
      if (card === 'epidemic') { epidemic(game); r.epidemicBefore = true; continue; }
      r.epidemicBefore = false;
      game.hands[game.turn].push(card); game.hands[game.turn].sort(sortCards);
      note(game, { kind: 'draw', seat: game.turn, card: isEvent(card) ? card : card });
      const over = game.hands[game.turn].length - HAND_LIMIT;
      if (over > 0) { game.pending = { type: 'discard', seat: game.turn }; return; }
      continue;
    }
    if (r.step === 'infect-window') {
      if (holdsEvent(game) && !r.shown) { r.shown = true; game.pending = { type: 'window', next: 'infect' }; return; }
      game.resume = { step: 'infect', remaining: infectionRate(game) }; if (game.quietNight) { game.quietNight = false; note(game, { kind: 'quiet' }); game.resume = { step: 'next-turn' }; }
      continue;
    }
    if (r.step === 'infect') {
      if (r.remaining <= 0) { game.resume = { step: 'next-turn' }; continue; }
      if (!game.infectionDeck.length) { game.infectionDeck = shuffle(game.infectionDiscard); game.infectionDiscard = []; }
      const city = game.infectionDeck.shift(); game.infectionDiscard.push(city); r.remaining -= 1;
      infectCity(game, city);
      continue;
    }
    if (r.step === 'next-turn') {
      game.resume = null; game.turn = nextSeat(game, game.turn); game.turnNumber += 1; game.actionsLeft = ACTIONS_PER_TURN; game.phase = 'actions'; game.opsMoveUsed = false;
      note(game, { kind: 'turn', seat: game.turn });
      return;
    }
  }
}

function epidemic(game) {
  game.epidemicsDrawn += 1;
  game.rateIndex += 1;
  note(game, { kind: 'epidemic', rate: infectionRate(game), n: game.epidemicsDrawn });
  const city = game.infectionDeck.pop() || game.infectionDiscard.pop(); // the card at the bottom
  if (city) { game.infectionDiscard.push(city); infectCity(game, city, 3); }
  if (game.status !== 'playing') return;
  game.infectionDeck = [...shuffle(game.infectionDiscard), ...game.infectionDeck]; // intensify: the shuffled discard goes on top
  game.infectionDiscard = [];
}

// ---- helpers for actions ---------------------------------------------------------------------------------------
const bad = (reason) => ({ legal: false, reason });
const has = (game, seat, card) => game.hands[seat].includes(card);
function removeCard(game, seat, card) { const i = game.hands[seat].indexOf(card); if (i >= 0) game.hands[seat].splice(i, 1); }
function discardCard(game, seat, card) { removeCard(game, seat, card); game.playerDiscard.push(card); }
function spendAction(game) { game.actionsLeft -= 1; }
function afterAction(game) {
  checkWin(game);
  if (game.status === 'playing' && game.actionsLeft <= 0 && !game.pending) endActions(game);
}
function checkWin(game) { if (COLORS.every((c) => game.cures[c])) win(game); }
function medicAutoTreat(game, seat, city) { // 위생병: cured diseases are cleared as soon as the medic is in the city
  if (game.roles[seat] !== 'medic') return;
  for (const color of COLORS) if (game.cures[color] && game.cubes[city][color] > 0) { game.supply[color] += game.cubes[city][color]; game.cubes[city][color] = 0; note(game, { kind: 'treat', seat, city, color, all: true }); checkEradication(game, color); }
}
function movePawn(game, seat, to) { game.pawns[seat] = to; medicAutoTreat(game, seat, to); note(game, { kind: 'move', seat, to }); }
function medicSweepAfterCure(game) { const m = roleSeat(game, 'medic'); if (m) medicAutoTreat(game, m, game.pawns[m]); }

// One movement step of `mover`'s pawn using cards from `payer`'s hand. mode: drive|direct|charter|shuttle|join
function planMove(game, mover, payer, mode, to) {
  if (!CITIES[to]) return bad('city');
  const from = game.pawns[mover];
  if (to === from) return bad('same');
  if (mode === 'drive') return CITIES[from].links.includes(to) ? { legal: true } : bad('not-adjacent');
  if (mode === 'direct') return has(game, payer, to) ? { legal: true, discard: to } : bad('no-card');
  if (mode === 'charter') return has(game, payer, from) ? { legal: true, discard: from } : bad('no-card');
  if (mode === 'shuttle') return game.stations.includes(from) && game.stations.includes(to) ? { legal: true } : bad('no-station');
  if (mode === 'join') return game.seatOrder.some((s) => s !== mover && game.pawns[s] === to) ? { legal: true } : bad('no-pawn');
  return bad('mode');
}
function doMove(game, mover, payer, mode, to) {
  const plan = planMove(game, mover, payer, mode, to);
  if (!plan.legal) return plan;
  if (plan.discard) discardCard(game, payer, plan.discard);
  movePawn(game, mover, to);
  return { legal: true };
}

function pendingBlocks(game, seat, action) { // what is allowed while something waits for an answer
  const p = game.pending;
  if (!p) return false;
  if (p.type === 'discard') return !(action.type === 'discard' && seat === p.seat) && action.type !== 'event';
  if (p.type === 'window') return action.type !== 'continue' && action.type !== 'event';
  if (p.type === 'forecast') return !(action.type === 'forecast-order' && seat === p.seat);
  if (p.type === 'consent') return !(['respond', 'cancel'].includes(action.type) && (seat === p.owner || seat === p.requester));
  if (p.type === 'share') return !(['respond', 'cancel'].includes(action.type) && (seat === p.other || seat === p.proposer));
  return false;
}

// ---- the public entry point ------------------------------------------------------------------------------------
function act(game, seat, action) {
  if (game.status !== 'playing') return bad('phase');
  if (!game.seatOrder.includes(seat)) return bad('seat');
  if (!action || typeof action.type !== 'string') return bad('action');
  if (pendingBlocks(game, seat, action)) return bad('pending');
  const fn = HANDLERS[action.type];
  if (!fn) return bad('action');
  const verdict = fn(game, seat, action);
  if (verdict.legal) {
    bump(game);
    // A hand that is back at the limit (a discarded card, an event played) ends the discard wait.
    if (game.pending?.type === 'discard' && game.hands[game.pending.seat].length <= HAND_LIMIT) game.pending = null;
    if (game.status === 'playing' && !game.pending && game.phase === 'actions' && game.actionsLeft <= 0 && !game.resume) endActions(game);
    if (game.status === 'playing' && !game.pending && game.resume) continueFlow(game);
  }
  return verdict;
}

const needTurn = (game, seat) => (game.phase !== 'actions' || game.turn !== seat) ? bad('turn') : game.actionsLeft <= 0 ? bad('no-actions') : null;
const mine = (game, seat) => game.turn === seat;

const HANDLERS = {
  drive(game, seat, a) { const e = needTurn(game, seat); if (e) return e; const v = doMove(game, seat, seat, 'drive', a.to); if (!v.legal) return v; spendAction(game); afterAction(game); return v; },
  direct(game, seat, a) { const e = needTurn(game, seat); if (e) return e; const v = doMove(game, seat, seat, 'direct', a.to); if (!v.legal) return v; spendAction(game); afterAction(game); return v; },
  charter(game, seat, a) { const e = needTurn(game, seat); if (e) return e; const v = doMove(game, seat, seat, 'charter', a.to); if (!v.legal) return v; spendAction(game); afterAction(game); return v; },
  shuttle(game, seat, a) { const e = needTurn(game, seat); if (e) return e; const v = doMove(game, seat, seat, 'shuttle', a.to); if (!v.legal) return v; spendAction(game); afterAction(game); return v; },

  build(game, seat, a) {
    const e = needTurn(game, seat); if (e) return e;
    const city = game.pawns[seat];
    if (game.stations.includes(city)) return bad('has-station');
    const free = game.roles[seat] === 'operations';
    if (!free && !has(game, seat, city)) return bad('no-card');
    if (game.stations.length >= MAX_STATIONS) {
      if (!a.remove || !game.stations.includes(a.remove)) return bad('remove-station');
      game.stations.splice(game.stations.indexOf(a.remove), 1);
    }
    if (!free) discardCard(game, seat, city);
    game.stations.push(city);
    note(game, { kind: 'build', seat, city });
    spendAction(game); afterAction(game); return { legal: true };
  },

  treat(game, seat, a) {
    const e = needTurn(game, seat); if (e) return e;
    const city = game.pawns[seat]; const color = a.color;
    if (!COLORS.includes(color) || game.cubes[city][color] <= 0) return bad('no-cube');
    const all = game.cures[color] || game.roles[seat] === 'medic';
    const removed = all ? game.cubes[city][color] : 1;
    game.cubes[city][color] -= removed; game.supply[color] += removed;
    note(game, { kind: 'treat', seat, city, color, all: Boolean(all) });
    checkEradication(game, color);
    spendAction(game); afterAction(game); return { legal: true };
  },

  cure(game, seat, a) {
    const e = needTurn(game, seat); if (e) return e;
    if (!game.stations.includes(game.pawns[seat])) return bad('no-station');
    const color = a.color; if (!COLORS.includes(color)) return bad('color');
    if (game.cures[color]) return bad('already');
    const need = game.roles[seat] === 'scientist' ? 4 : 5;
    const cards = Array.isArray(a.cards) ? [...new Set(a.cards)] : [];
    if (cards.length !== need || !cards.every((c) => !isEvent(c) && CITIES[c]?.color === color && has(game, seat, c))) return bad('cards');
    for (const c of cards) discardCard(game, seat, c);
    game.cures[color] = 'cured';
    note(game, { kind: 'cure', seat, color });
    checkEradication(game, color);
    medicSweepAfterCure(game);
    spendAction(game); afterAction(game); return { legal: true };
  },

  // 정보 공유: the acting player proposes; the other player answers (respond). Both must stand in the same city.
  share(game, seat, a) {
    const e = needTurn(game, seat); if (e) return e;
    const other = String(a.with || '');
    if (!game.seatOrder.includes(other) || other === seat) return bad('player');
    const city = game.pawns[seat];
    if (game.pawns[other] !== city) return bad('same-city');
    const give = a.dir === 'give';
    const giver = give ? seat : other; const taker = give ? other : seat;
    const card = String(a.card || '');
    if (isEvent(card) || !CITIES[card] || !has(game, giver, card)) return bad('card');
    if (card !== city && game.roles[giver] !== 'researcher') return bad('not-city-card');
    game.pending = { type: 'share', proposer: seat, other, giver, taker, card };
    return { legal: true };
  },

  // 운항관리자: move another player's pawn like your own (they must agree), or send any pawn to another pawn's city.
  dispatch(game, seat, a) {
    const e = needTurn(game, seat); if (e) return e;
    if (game.roles[seat] !== 'dispatcher') return bad('role');
    const owner = String(a.pawn || '');
    if (!game.seatOrder.includes(owner)) return bad('player');
    const mover = owner;
    const plan = planMove(game, mover, seat, a.mode, a.to);
    if (!plan.legal) return plan;
    if (owner === seat) { const v = doMove(game, seat, seat, a.mode, a.to); if (!v.legal) return v; spendAction(game); afterAction(game); return v; }
    game.pending = { type: 'consent', requester: seat, owner, kind: 'dispatch', mode: a.mode, to: a.to };
    return { legal: true };
  },

  // 건축 전문가: once per turn, at a station, discard any city card to fly anywhere.
  opsmove(game, seat, a) {
    const e = needTurn(game, seat); if (e) return e;
    if (game.roles[seat] !== 'operations' || game.opsMoveUsed) return bad('role');
    if (!game.stations.includes(game.pawns[seat])) return bad('no-station');
    const card = String(a.card || '');
    if (isEvent(card) || !has(game, seat, card) || !CITIES[a.to] || a.to === game.pawns[seat]) return bad('card');
    discardCard(game, seat, card);
    game.opsMoveUsed = true;
    movePawn(game, seat, a.to);
    spendAction(game); afterAction(game); return { legal: true };
  },

  // 비상 대책 설계자: keep one event card from the player discard pile on the role card.
  store(game, seat, a) {
    const e = needTurn(game, seat); if (e) return e;
    if (game.roles[seat] !== 'contingency' || game.stored[seat]) return bad('role');
    const card = eventCard(String(a.event || ''));
    const i = game.playerDiscard.indexOf(card);
    if (i < 0) return bad('no-event');
    game.playerDiscard.splice(i, 1); game.stored[seat] = String(a.event);
    note(game, { kind: 'store', seat, event: a.event });
    spendAction(game); afterAction(game); return { legal: true };
  },

  pass(game, seat) { if (game.phase !== 'actions' || game.turn !== seat) return bad('turn'); game.actionsLeft = 0; endActions(game); return { legal: true }; },

  discard(game, seat, a) {
    const p = game.pending; if (!p || p.type !== 'discard' || p.seat !== seat) return bad('phase');
    const card = String(a.card || '');
    if (!has(game, seat, card)) return bad('card');
    discardCard(game, seat, card);
    note(game, { kind: 'discard', seat, card });
    if (game.hands[seat].length <= HAND_LIMIT) game.pending = null;
    return { legal: true };
  },

  continue(game, seat) { // the table agrees to go on after the event window
    const p = game.pending; if (!p || p.type !== 'window') return bad('phase');
    if (seat !== game.turn) return bad('turn');
    game.pending = null; return { legal: true };
  },

  respond(game, seat, a) {
    const p = game.pending;
    if (!p || (p.type !== 'consent' && p.type !== 'share')) return bad('phase');
    const answerer = p.type === 'consent' ? p.owner : p.other;
    if (seat !== answerer) return bad('turn');
    game.pending = p.resumePending || null; // an Airlift asked in the middle of a hand-limit wait goes back to it
    if (!a.accept) { note(game, { kind: 'refuse', seat }); return { legal: true }; }
    if (p.type === 'share') {
      if (!has(game, p.giver, p.card) || game.pawns[p.giver] !== game.pawns[p.taker]) return bad('card');
      removeCard(game, p.giver, p.card); game.hands[p.taker].push(p.card); game.hands[p.taker].sort(sortCards);
      note(game, { kind: 'share', from: p.giver, to: p.taker, card: p.card });
      spendAction(game);
      if (game.hands[p.taker].length > HAND_LIMIT) game.pending = { type: 'discard', seat: p.taker };
      afterAction(game); return { legal: true };
    }
    if (p.kind === 'dispatch') { const v = doMove(game, p.owner, p.requester, p.mode, p.to); if (!v.legal) return v; spendAction(game); afterAction(game); return v; }
    if (p.kind === 'airlift') { movePawn(game, p.owner, p.to); useEventCard(game, p.player, 'airlift', p.fromStored); afterAction(game); return { legal: true }; }
    return bad('phase');
  },

  cancel(game, seat) {
    const p = game.pending; if (!p || !['consent', 'share'].includes(p.type)) return bad('phase');
    if (seat !== (p.requester || p.proposer)) return bad('turn');
    game.pending = p.resumePending || null; return { legal: true };
  },

  // Event cards use no action and can be played by anyone at any time the engine is waiting on a person.
  event(game, seat, a) {
    const id = String(a.event || ''); if (!EVENT_IDS.includes(id)) return bad('event');
    const fromStored = Boolean(a.fromStored);
    if (fromStored ? game.stored[seat] !== id : !has(game, seat, eventCard(id))) return bad('no-event');
    if (game.pending && !['discard', 'window'].includes(game.pending.type)) return bad('pending');
    if (id === 'airlift') {
      const pawn = String(a.pawn || ''); if (!game.seatOrder.includes(pawn) || !CITIES[a.to] || game.pawns[pawn] === a.to) return bad('target');
      if (pawn === seat) { movePawn(game, pawn, a.to); useEventCard(game, seat, id, fromStored); checkWin(game); return { legal: true }; }
      game.pending = { type: 'consent', requester: seat, owner: pawn, kind: 'airlift', to: a.to, player: seat, fromStored, resumePending: game.pending };
      return { legal: true };
    }
    if (id === 'grant') {
      const city = String(a.city || ''); if (!CITIES[city] || game.stations.includes(city)) return bad('target');
      if (game.stations.length >= MAX_STATIONS) { if (!a.remove || !game.stations.includes(a.remove)) return bad('remove-station'); game.stations.splice(game.stations.indexOf(a.remove), 1); }
      game.stations.push(city); note(game, { kind: 'build', seat, city, event: true }); useEventCard(game, seat, id, fromStored); return { legal: true };
    }
    if (id === 'quietnight') { game.quietNight = true; useEventCard(game, seat, id, fromStored); note(game, { kind: 'event', seat, event: id }); return { legal: true }; }
    if (id === 'resilient') {
      const city = String(a.city || ''); const i = game.infectionDiscard.indexOf(city); if (i < 0) return bad('target');
      game.infectionDiscard.splice(i, 1); game.removedInfection.push(city); useEventCard(game, seat, id, fromStored); note(game, { kind: 'event', seat, event: id, city }); return { legal: true };
    }
    if (id === 'forecast') {
      if (game.infectionDeck.length < 1) return bad('target');
      game.pending = { type: 'forecast', seat, cards: game.infectionDeck.slice(0, 6), fromStored, resumePending: game.pending };
      return { legal: true };
    }
    return bad('event');
  },

  'forecast-order'(game, seat, a) {
    const p = game.pending; if (!p || p.type !== 'forecast' || p.seat !== seat) return bad('phase');
    const order = Array.isArray(a.order) ? a.order.map(String) : [];
    if (order.length !== p.cards.length || [...order].sort().join() !== [...p.cards].sort().join()) return bad('order');
    game.infectionDeck.splice(0, p.cards.length, ...order);
    game.pending = p.resumePending || null;
    useEventCard(game, seat, 'forecast', p.fromStored);
    note(game, { kind: 'event', seat, event: 'forecast' });
    return { legal: true };
  },
};

function useEventCard(game, seat, id, fromStored) {
  if (fromStored) { game.stored[seat] = null; game.removedEvents.push(id); }
  else { discardCard(game, seat, eventCard(id)); }
  note(game, { kind: 'event', seat, event: id });
}

// ---- legal moves for the highlights (all inputs are public, so this can be sent to the player it is computed for) --
function legal(game, seat) {
  const out = { drive: [], direct: [], charter: [], shuttle: [], build: false, buildRemove: false, treat: [], cure: [], share: [], dispatch: null, opsmove: null, store: [], events: [] };
  if (game.status !== 'playing' || !seat || !game.seatOrder.includes(seat)) return out;
  const city = game.pawns[seat];
  const myTurn = game.phase === 'actions' && game.turn === seat && game.actionsLeft > 0 && !game.pending;
  if (myTurn) {
    out.drive = [...CITIES[city].links];
    out.direct = cityCards(game.hands[seat]).filter((c) => c !== city);
    out.charter = game.hands[seat].includes(city) ? CITY_IDS.filter((c) => c !== city) : [];
    out.shuttle = game.stations.includes(city) ? game.stations.filter((c) => c !== city) : [];
    out.build = !game.stations.includes(city) && (game.roles[seat] === 'operations' || game.hands[seat].includes(city));
    out.buildRemove = out.build && game.stations.length >= MAX_STATIONS;
    out.treat = COLORS.filter((c) => game.cubes[city][c] > 0);
    if (game.stations.includes(city)) {
      const need = game.roles[seat] === 'scientist' ? 4 : 5;
      out.cure = COLORS.filter((c) => !game.cures[c] && cityCards(game.hands[seat]).filter((x) => CITIES[x].color === c).length >= need).map((color) => ({ color, need }));
    }
    for (const other of game.seatOrder) if (other !== seat && game.pawns[other] === city) {
      const cards = [];
      for (const [giver, taker] of [[seat, other], [other, seat]]) for (const card of cityCards(game.hands[giver])) if (card === city || game.roles[giver] === 'researcher') cards.push({ giver, taker, card });
      if (cards.length) out.share.push({ with: other, cards });
    }
    if (game.roles[seat] === 'dispatcher') out.dispatch = game.seatOrder.map((pawn) => ({ pawn, joins: game.seatOrder.filter((s) => s !== pawn).map((s) => game.pawns[s]) }));
    if (game.roles[seat] === 'operations' && !game.opsMoveUsed && game.stations.includes(city)) out.opsmove = cityCards(game.hands[seat]);
    if (game.roles[seat] === 'contingency' && !game.stored[seat]) out.store = game.playerDiscard.filter(isEvent).map(eventId);
  }
  out.events = [...game.hands[seat].filter(isEvent).map((c) => ({ event: eventId(c), stored: false })), ...(game.stored[seat] ? [{ event: game.stored[seat], stored: true }] : [])];
  return out;
}

// ---- views -----------------------------------------------------------------------------------------------------
function publicState(game) {
  const { playerDeck, infectionDeck, pending, ...rest } = game;
  return structuredClone({
    ...rest,
    playerDeckCount: playerDeck.length, infectionDeckCount: infectionDeck.length, infectionRate: infectionRate(game),
    // the cards of a Forecast are for the player who plays it only (see privateFor)
    pending: pending ? { ...pending, cards: undefined, resumePending: undefined } : null,
  });
}
function privateFor(game, seat) { // what only this seat may see
  const p = game.pending;
  return { forecast: p?.type === 'forecast' && p.seat === seat ? [...p.cards] : null, legal: legal(game, seat) };
}
function disconnect() {}
function reconnect() {}
function tick() { return false; }

const moveError = (reason) => ({
  started: '이미 시작했습니다.', players: '2~4명이 필요합니다.', difficulty: '난이도를 확인해 주세요.', phase: '지금은 할 수 없습니다.', turn: '내 차례가 아닙니다.', seat: '참가자만 할 수 있습니다.',
  'no-actions': '이번 차례의 행동을 모두 사용했습니다.', pending: '먼저 처리해야 할 일이 있습니다.', action: '알 수 없는 행동입니다.', city: '도시를 확인해 주세요.', same: '이미 그 도시에 있습니다.',
  'not-adjacent': '직접 연결된 도시가 아닙니다.', 'no-card': '필요한 도시 카드가 없습니다.', 'no-station': '연구소가 필요합니다.', 'no-pawn': '다른 플레이어의 말이 있는 도시가 아닙니다.', mode: '이동 방식을 확인해 주세요.',
  'has-station': '이미 연구소가 있습니다.', 'remove-station': '연구소가 6개입니다. 옮길 기존 연구소를 고르세요.', 'no-cube': '그 색 질병 큐브가 없습니다.', color: '색을 확인해 주세요.', already: '이미 치료제가 있습니다.', cards: '치료제에 쓸 카드를 확인해 주세요.',
  player: '플레이어를 확인해 주세요.', 'same-city': '같은 도시에 있어야 합니다.', 'not-city-card': '현재 도시의 카드만 줄 수 있습니다.', role: '이 직업은 할 수 없는 행동입니다.', 'no-event': '그 이벤트 카드가 없습니다.',
  event: '이벤트를 확인해 주세요.', target: '대상을 확인해 주세요.', order: '순서를 확인해 주세요.',
}[reason] || '지금은 할 수 없습니다.');

module.exports = {
  id: 'pandemic', name: '팬데믹', size: 4, points: 'entry', rules: '2~4명이 힘을 모아 네 가지 질병의 치료제를 모두 개발하세요. 확산 8회·큐브 부족·카드 부족 중 하나가 생기면 함께 패배합니다.',
  SEATS, HAND_LIMIT, create, reset, setSetup, start, act, legal, publicState, privateFor, disconnect, reconnect, tick, moveError, infectionRate, isEvent, eventCard, eventId,
};
