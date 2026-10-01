'use strict';

// Loaded only by the dedicated test server via --require; no fixture API in the application.
if (process.env.NODE_ENV !== 'test') throw new Error('Pandemic fixture requires NODE_ENV=test');
const P = require('../../lib/games/pandemic');
const D = require('../../lib/games/pandemic-data');
const original = P.start;
P.start = (g, seats) => {
  const result = original(g, seats);
  if (!result.legal) return result;
  for (const id of D.CITY_IDS) for (const color of D.COLORS) g.cubes[id][color] = 0;
  for (const color of D.COLORS) g.supply[color] = 24;
  const hands = { 1: ['tokyo', 'seoul', 'beijing', 'shanghai', 'ev:airlift', 'ev:grant', 'ev:forecast'], 2: ['atlanta'], 3: ['ev:quietnight'], 4: ['ev:resilient'] };
  const roles = { 1: 'scientist', 2: 'researcher', 3: 'medic', 4: 'quarantine' };
  for (const seat of seats) { g.hands[seat] = hands[seat]; g.roles[seat] = roles[seat]; g.pawns[seat] = seat === '4' ? 'sydney' : 'atlanta'; }
  const dealt = new Set(seats.flatMap(s => g.hands[s]));
  const top = ['osaka', 'taipei', 'epidemic', 'paris'];
  g.playerDeck = [...top, ...D.CITY_IDS.filter(c => !dealt.has(c) && !top.includes(c)), ...D.EVENT_IDS.map(P.eventCard).filter(c => !dealt.has(c)), ...Array(g.epidemicsTotal - 1).fill('epidemic')];
  g.infectionDeck = [...D.CITY_IDS]; g.infectionDiscard = []; g.playerDiscard = [];
  g.turn = '1'; g.actionsLeft = 4; g.phase = 'actions';
  g.stations = ['atlanta', 'chicago', 'paris', 'london', 'madrid', 'essen'];
  return result;
};
