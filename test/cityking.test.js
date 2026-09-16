'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const cityking = require('../lib/games/cityking');
const { getGame } = require('../lib/games');

function dice(...values) {
  let index = 0;
  return () => values[index++] ?? 1;
}

test('Land King is registered as an original 24-space board game', () => {
  assert.equal(getGame('cityking'), cityking);
  assert.equal(cityking.name, '랜드킹');
  const game = cityking.create();
  assert.equal(game.players.black.cash, 1500);
  assert.equal(game.players.white.properties.length, 0);
  assert.equal(cityking.TILES.length, 24);
  assert.equal(cityking.TILES.filter(tile => tile.type === 'property').length, 10);
});

test('dice movement resolves events, buys properties, and advances turns', () => {
  const game = cityking.create();
  cityking.start(game);
  const event = cityking.rollDice(game, 'black', 'event', dice(1, 1));
  assert.equal(event.total, 2);
  assert.equal(game.players.black.position, 2);
  assert.equal(game.players.black.cash, 1600);
  assert.equal(game.turn, 'white');

  game.turn = 'black';
  game.phase = 'roll';
  const property = cityking.rollDice(game, 'black', 'property', dice(1, 2));
  assert.equal(property.phase, 'buy');
  assert.equal(game.pendingProperty, 5);
  assert.equal(cityking.buyProperty(game, 'black', 'buy').legal, true);
  assert.equal(game.owners[5], 'black');
  assert.equal(game.players.black.properties.includes(5), true);
  assert.equal(game.turn, 'white');
});

test('landing on an opponent city pays toll and can cause bankruptcy', () => {
  const game = cityking.create();
  cityking.start(game);
  game.owners[3] = 'black';
  game.players.black.properties.push(3);
  game.players.white.cash = 20;
  game.players.white.position = 1;
  game.turn = 'white';
  const result = cityking.rollDice(game, 'white', 'toll', dice(1, 1));
  assert.equal(result.finished, true);
  assert.equal(game.status, 'finished');
  assert.equal(game.winner, 'black');
  assert.equal(game.players.white.cash, -30);
});

test('turn limit chooses the higher net worth and reset starts a fresh round', () => {
  const game = cityking.create();
  cityking.start(game);
  game.turnCount = cityking.TURN_LIMIT;
  game.turn = 'black';
  game.phase = 'roll';
  game.players.black.cash = 2000;
  game.players.white.cash = 1500;
  const result = cityking.rollDice(game, 'black', 'last', dice(1, 1));
  assert.equal(result.finished, true);
  assert.equal(game.status, 'finished');
  assert.equal(game.winner, 'black');
  cityking.reset(game);
  assert.equal(game.round, 2);
  assert.equal(game.status, 'selecting');
  assert.equal(game.players.black.position, 0);
  assert.equal(Object.keys(game.owners).length, 0);
});

test('declining an unaffordable property advances turn instead of deadlocking', () => {
  const game = cityking.create();
  cityking.start(game);
  game.players.black.position = 10;
  game.players.black.cash = 0;
  const landed = cityking.rollDice(game, 'black', 'land', dice(1, 1));
  assert.equal(landed.phase, 'buy');
  assert.equal(game.pendingProperty, 12);
  assert.equal(cityking.buyProperty(game, 'black', 'buy').legal, false);
  assert.equal(cityking.skipProperty(game, 'white', 'skip').legal, false);
  assert.equal(cityking.skipProperty(game, 'black', 'skip').legal, true);
  assert.equal(game.turn, 'white');
  assert.equal(game.pendingProperty, null);
  assert.equal(game.owners[12], undefined);
});

test('Land King UI and protected action routes are wired', async () => {
  const root = path.join(__dirname, '..');
  const [html, js, server] = await Promise.all([
    fs.readFile(path.join(root, 'public/index.html'), 'utf8'),
    fs.readFile(path.join(root, 'public/app.js'), 'utf8'),
    fs.readFile(path.join(root, 'server.js'), 'utf8'),
  ]);
  assert.match(html, /data-game="cityking"/);
  assert.match(html, /랜드킹/);
  assert.doesNotMatch(html, /도시왕/);
  assert.match(js, /랜드킹/);
  assert.doesNotMatch(js, /도시왕/);
  assert.doesNotMatch(server, /도시왕/);
  assert.match(html, /id="cityRollBtn"/);
  assert.match(html, /id="citySkipBtn"/);
  assert.match(js, /function drawCityBoard\(/);
  assert.match(js, /roomAction\('roll-city'\)/);
  assert.match(server, /roll-city\|buy-city\|skip-city/);
  assert.match(html, /app\.js\?v=1\.6\.18/);
});
