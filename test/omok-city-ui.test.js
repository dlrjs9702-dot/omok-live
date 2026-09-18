'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getGame } = require('../lib/games');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Omok has one lobby choice with 1vs1 default and 2vs2 mapped to existing engine', () => {
  const html = read('public/index.html');
  const app = read('public/app.js');
  assert.equal((html.match(/data-game="omok"/g) || []).length, 1);
  assert.doesNotMatch(html, /data-game="omok2v2"/);
  assert.match(html, /name="omokMode" value="1v1" checked/);
  assert.match(html, /name="omokMode" value="2v2"/);
  assert.match(app, /selectedGameType === 'omok' && omokMode\(\) === '2v2' \? 'omok2v2'/);
  assert.match(app, /'오목 · 1vs1'/);
  assert.match(app, /'오목 · 2vs2'/);
  assert.equal(getGame('omok').id, 'omok');
  assert.equal(getGame('omok2v2').id, 'omok2v2');
});

test('Land King has clickable tile details, net-worth board and visual movement', () => {
  const html = read('public/index.html');
  const app = read('public/app.js');
  const css = read('public/styles.css');
  assert.match(html, /data-game="cityking"><strong>랜드킹<\/strong>/);
  assert.doesNotMatch(html, /랜드킹\(패치중\)/);
  for (const id of ['cityTurnSummary', 'cityAssets', 'cityTileSelect', 'cityTileName', 'cityTilePrice', 'cityTileToll', 'cityTileOwner'])
    assert.ok(html.includes(`id="${id}"`), id);
  assert.match(app, /function selectCityTileFromPointer\(/);
  assert.match(app, /function drawCityBoard\(/);
  assert.match(app, /requestAnimationFrame\(advance\)/);
  assert.match(app, /citySelectedTileIndex/);
  assert.match(css, /\.cityAssetCard\.isTurn/);
  assert.match(css, /\.cityTileSelect\{[^}]*min-height:44px/);
  const city = getGame('cityking');
  const game = city.create();
  assert.equal(city.TILES.length, 24);
  assert.equal(city.TILES.filter(tile => tile.type === 'property').length, 10);
  assert.equal(city.TURN_LIMIT, 50);
  // Land King is now a 2-4 numbered-seat game -- players only exist once start() is called.
  assert.deepEqual(game.players, {});
  assert.equal(city.start(game, ['1', '2']).legal, true);
  assert.equal(game.players['1'].cash, 1500);
});
