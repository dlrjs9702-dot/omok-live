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
]);

function hasGame(id) {
  return GAMES.has(String(id || '').toLowerCase());
}

function getGame(id = 'omok') {
  return GAMES.get(String(id || 'omok').toLowerCase()) || null;
}

function listGames() {
  return [...GAMES.values()].map(({ id, name, size, rules }) => ({ id, name, size, rules }));
}

module.exports = { getGame, hasGame, listGames };
