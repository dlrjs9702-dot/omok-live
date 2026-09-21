'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const dots = require('../lib/games/dots');
const { getGame } = require('../lib/games');

test('Dots and Boxes is registered with 5x5 dots and forty unique edges', () => {
  assert.equal(getGame('dots'), dots);
  const game = dots.create();
  assert.equal(game.edges.h.length, 5);
  assert.equal(game.edges.v.length, 4);
  dots.start(game);
  const legal = dots.legalEdges(game);
  assert.equal(legal.length, 40);
  assert.equal(new Set(legal).size, 40);
  assert.deepEqual(dots.decodeEdge(0), { orientation: 'h', row: 0, col: 0 });
  assert.deepEqual(dots.decodeEdge(39), { orientation: 'v', row: 3, col: 4 });
});

test('completing a box claims it and grants an extra turn', () => {
  const game = dots.create();
  dots.start(game);
  game.edges.h[0][0] = 'black';
  game.edges.h[1][0] = 'white';
  game.edges.v[0][0] = 'black';
  const rightEdge = dots.edgeId('v', 0, 1);
  const result = dots.applyMove(game, rightEdge, 0, 'black', 'now');
  assert.equal(result.legal, true);
  assert.deepEqual(result.claimed, [[0, 0]]);
  assert.equal(result.extraTurn, true);
  assert.equal(game.boxes[0][0], 'black');
  assert.equal(game.turn, 'black');
  assert.equal(dots.applyMove(game, rightEdge, 0, 'black', 'again').reason, 'occupied');
});

test('a shared final edge can claim two boxes at once', () => {
  const game = dots.create();
  dots.start(game);
  game.edges.h[0][0] = game.edges.h[1][0] = game.edges.v[0][0] = 'black';
  game.edges.h[0][1] = game.edges.h[1][1] = game.edges.v[0][2] = 'white';
  const shared = dots.edgeId('v', 0, 1);
  const result = dots.applyMove(game, shared, 0, 'black', 'now');
  assert.deepEqual(result.claimed, [[0, 0], [0, 1]]);
  assert.deepEqual(dots.scores(game), { black: 2, white: 0 });
});

test('the final edge determines victory or draw by claimed box score and reset clears the board', () => {
  const game = dots.create();
  dots.start(game);
  for (const row of game.edges.h) row.fill('black');
  for (const row of game.edges.v) row.fill('white');
  game.edges.v[3][4] = null;
  let index = 0;
  for (let row = 0; row < 4; row += 1) for (let col = 0; col < 4; col += 1) {
    if (row === 3 && col === 3) continue;
    game.boxes[row][col] = index++ < 8 ? 'black' : 'white';
  }
  game.moves = Array.from({ length: 39 }, (_, edgeId) => ({ edgeId }));
  game.turn = 'white';
  const final = dots.applyMove(game, 39, 0, 'white', 'last');
  assert.equal(final.finished, true);
  assert.equal(game.status, 'draw');
  assert.deepEqual(dots.scores(game), { black: 8, white: 8 });
  dots.reset(game);
  assert.equal(game.round, 2);
  assert.equal(game.status, 'selecting');
  assert.equal(game.edges.h.flat().every(value => value === null), true);
});

test('Dots and Boxes selection, canvas hit-testing and cache version are present', async () => {
  const root = path.join(__dirname, '..');
  const [html, js] = await Promise.all([
    fs.readFile(path.join(root, 'public/index.html'), 'utf8'),
    fs.readFile(path.join(root, 'public/app.js'), 'utf8'),
  ]);
  assert.match(html, /data-game="dots"/);
  assert.match(js, /function drawDotsBoard\(/);
  assert.match(js, /function dotsEdgeEndpoints\(/);
  assert.match(js, /state\.gameType === 'dots'/);
  assert.match(html, /app\.js\?v=1\.6\.64/);
});
