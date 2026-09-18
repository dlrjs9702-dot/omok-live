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

test('dice movement resolves events, buys properties, and counts completed rounds', () => {
  const game = cityking.create();
  cityking.start(game);
  const event = cityking.rollDice(game, 'black', 'event', dice(1, 1));
  assert.equal(event.total, 2);
  assert.equal(event.double, true);
  assert.equal(game.players.black.position, 2);
  assert.equal(game.players.black.cash, 1600);
  assert.equal(game.turn, 'black');
  assert.equal(game.turnCount, 0);

  const property = cityking.rollDice(game, 'black', 'property', dice(1, 2));
  assert.equal(property.phase, 'buy');
  assert.equal(game.pendingProperty, 5);
  assert.equal(cityking.buyProperty(game, 'black', 'buy').legal, true);
  assert.equal(game.owners[5], 'black');
  assert.equal(game.players.black.properties.includes(5), true);
  assert.equal(game.turn, 'white');
  assert.equal(game.turnCount, 0);
  assert.equal(cityking.rollDice(game, 'white', 'complete', dice(1, 3)).legal, true);
  assert.equal(game.turnCount, 1);
  assert.equal(game.turn, 'black');
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

test('turn limit waits for both player turns, then uses existing net-worth outcome and resets', () => {
  const game = cityking.create();
  cityking.start(game);
  game.turnCount = cityking.TURN_LIMIT - 1;
  game.players.black.cash = 2000;
  game.players.white.cash = 1500;
  const first = cityking.rollDice(game, 'black', 'penultimate', dice(1, 3));
  assert.equal(first.finished, false);
  assert.equal(game.turnCount, cityking.TURN_LIMIT - 1);
  assert.equal(game.turn, 'white');
  const doubled = cityking.rollDice(game, 'white', 'double', dice(2, 2));
  assert.equal(doubled.finished, false);
  assert.equal(game.turn, 'white');
  assert.equal(game.turnCount, cityking.TURN_LIMIT - 1);
  const last = cityking.rollDice(game, 'white', 'last', dice(1, 2));
  assert.equal(last.phase, 'buy');
  assert.equal(game.turnCount, cityking.TURN_LIMIT - 1);
  assert.equal(cityking.skipProperty(game, 'white', 'finish').legal, true);
  assert.equal(game.turnCount, cityking.TURN_LIMIT);
  assert.equal(game.status, 'finished');
  assert.equal(game.winner, 'black');
  cityking.reset(game);
  assert.equal(game.round, 2);
  assert.equal(game.status, 'selecting');
  assert.equal(game.turnCount, 0);
  assert.equal(game.extraRoll, false);
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
  assert.equal(game.turn, 'black'); // double permits another roll after declining
  assert.equal(game.pendingProperty, null);
  assert.equal(game.owners[12], undefined);
});

test('consecutive doubles retain the turn and apply each landing before the next roll', () => {
  const game = cityking.create();
  cityking.start(game);
  const first = cityking.rollDice(game, 'black', 'first', dice(1, 1), 0);
  assert.equal(first.double, true);
  assert.equal(game.players.black.cash, 1600); // event at tile 2
  assert.equal(game.turn, 'black');
  assert.equal(cityking.publicState(game).extraRoll, true);
  assert.equal(cityking.rollDice(game, 'white', 'wrong', dice(1, 1)).reason, 'not-your-turn');
  assert.equal(cityking.rollDice(game, 'black', 'duplicate', dice(1, 1), 0).reason, 'stale-roll');
  assert.equal(game.moves.length, 1);
  assert.equal(cityking.rollDice(game, 'black', 'second', dice(1, 1), 1).double, true);
  assert.equal(game.players.black.cash, 1480); // tax at tile 4
  assert.equal(game.turnCount, 0);
  const third = cityking.rollDice(game, 'black', 'third', dice(1, 2), 2);
  assert.equal(third.double, false);
  assert.equal(third.phase, 'buy');
  assert.equal(game.pendingProperty, 7);
  assert.equal(cityking.rollDice(game, 'black', 'during-buy', dice(1, 1)).reason, 'must-buy');
  assert.equal(cityking.buyProperty(game, 'black', 'bought').legal, true);
  assert.equal(game.turn, 'white');
  assert.equal(game.turnCount, 0);
  assert.deepEqual(game.completedTurns, { black: true, white: false });
  assert.equal(cityking.rollDice(game, 'white', 'fourth', dice(2, 2)).double, true);
  assert.equal(game.players.white.cash, 1380);
  assert.equal(game.turnCount, 0);
  assert.equal(cityking.rollDice(game, 'white', 'fifth', dice(1, 2)).double, false);
  assert.equal(game.players.white.cash, 1320); // opponent property toll at tile 7
  assert.equal(game.players.black.cash, 1360);
  assert.equal(game.turnCount, 1);
  assert.equal(game.turn, 'black');
  assert.deepEqual(game.completedTurns, { black: false, white: false });
});

test('double landing on own city requires building decision before an extra roll', () => {
  const game = cityking.create();
  cityking.start(game);
  game.players.black.position = 1;
  game.players.black.properties.push(3);
  game.owners[3] = 'black';
  const result = cityking.rollDice(game, 'black', 'build', dice(1, 1));
  assert.equal(result.phase, 'build');
  assert.equal(game.extraRoll, true);
  assert.equal(cityking.rollDice(game, 'black', 'premature', dice(1, 2)).reason, 'must-buy');
  assert.equal(cityking.buildProperty(game, 'black', 'built').legal, true);
  assert.equal(game.developments[3], 1);
  assert.equal(game.players.black.cash, 1430);
  assert.equal(game.turn, 'black');
  assert.equal(game.phase, 'roll');
  assert.equal(game.turnCount, 0);
  assert.equal(cityking.rollDice(game, 'black', 'not-double', dice(1, 2)).legal, true);
  assert.equal(game.players.black.cash, 1630); // event at tile 6
  assert.equal(game.turn, 'white');
  assert.equal(game.turnCount, 0);
});

test('eliminated seats do not block completed-round counting', () => {
  const game = cityking.create();
  cityking.start(game);
  game.players.white.eliminated = true;
  assert.equal(cityking.rollDice(game, 'black', 'solo', dice(1, 3)).legal, true);
  assert.equal(game.turnCount, 1);
  assert.equal(game.turn, 'black');
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
  assert.match(js, /roomAction\('roll-city', \{ expectedMoveCount \}\)/);
  assert.match(server, /roll-city\|buy-city\|skip-city/);
  assert.match(html, /app\.js\?v=1\.6\.32/);
  assert.match(js, /더블 추가 굴림/);
  assert.match(server, /Number\(body\.expectedMoveCount\)/);
});
