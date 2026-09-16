'use strict';

const omok = require('./omok');
const omok2v2 = require('./omok2v2');
const othello = require('./othello');
const baseball = require('./baseball');

const GAMES = new Map([
  [omok.id, omok],
  [omok2v2.id, omok2v2],
  [othello.id, othello],
  [baseball.id, baseball],
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
