'use strict';

const omok = require('./omok');
const omok2v2 = require('./omok2v2');
const othello = require('./othello');
const baseball = require('./baseball');
const connect4 = require('./connect4');
const yut = require('./yut');
const dots = require('./dots');
const cityking = require('./cityking');
const bingo = require('./bingo');
const pictionary = require('./pictionary');
const liar = require('./liar');
const oldmaid = require('./oldmaid');
const twentyquestions = require('./twentyquestions-adapter');
const davinci = require('./davinci');
const halligalli = require('./halligalli');
const gostop = require('./gostop');
const rpg = require('./rpg');
const pandemic = require('./pandemic');

const GAMES = new Map([
  [omok.id, omok],
  [omok2v2.id, omok2v2],
  [othello.id, othello],
  [baseball.id, baseball],
  [connect4.id, connect4],
  [yut.id, yut],
  [dots.id, dots],
  [cityking.id, cityking],
  [bingo.id, bingo],
  [pictionary.id, pictionary],
  [liar.id, liar],
  [oldmaid.id, oldmaid],
  [twentyquestions.id, twentyquestions],
  [davinci.id, davinci],
  [halligalli.id, halligalli],
  [gostop.id, gostop],
  [rpg.id, rpg],
  [pandemic.id, pandemic],
]);

function hasGame(id) {
  return GAMES.has(String(id || '').toLowerCase());
}

function getGame(id = 'omok') {
  return GAMES.get(String(id || 'omok').toLowerCase()) || null;
}

// v1.7.3: every game pays the common entry fee unless its module declares otherwise
// (`points: 'settlement'` settles its own stakes, `points: 'none'` has no points).
function pointPolicy(id) {
  return getGame(id)?.points || 'entry';
}

function listGames() {
  return [...GAMES.values()].map(({ id, name, size, rules }) => ({ id, name, size, rules }));
}

module.exports = { getGame, hasGame, listGames, pointPolicy };
