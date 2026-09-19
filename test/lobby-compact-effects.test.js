'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { listGames } = require('../lib/games');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');

test('all thirteen games expose one shared rules selector with the original full rule text', () => {
  const games = listGames();
  assert.equal(games.length, 13);
  const selectedIds = [...html.matchAll(/<option value="(omok|omok2v2|connect4|yut|bingo|dots|cityking|othello|baseball|pictionary|liar|oldmaid|marathon)">/g)].map(m => m[1]);
  assert.equal(selectedIds.length, 13);
  assert.deepEqual(new Set(selectedIds), new Set(games.map(g => g.id)));
  assert.equal((html.match(/class="gameRuleDetails"/g) || []).length, 0);
  assert.equal((html.match(/id="gameRulesSelect"/g) || []).length, 1);
  const map = app.match(/const gameRules = Object\.freeze\((\{[\s\S]*?\})\);/);
  assert.ok(map, 'Shared rule definitions must exist');
  const descriptions = JSON.parse(map[1]);
  assert.deepEqual(new Set(Object.keys(descriptions)), new Set(selectedIds));
  for (const id of selectedIds) assert.ok(descriptions[id].length >= 40, `Missing rule text for ${id}`);
  assert.match(app, /gameRulesSelect\.addEventListener\('change', \(\) => showGameRule\(gameRulesSelect\.value\)\)/);
  assert.match(app, /gameRulesSelect\.value = resolvedType;/);
  assert.match(html, /id="gameRulesDisclosure" class="helpDisclosure"/);
});

test('announcement rows are compact with inline controls and game choice heights are condensed', () => {
  assert.match(css, /\.announcementRow\{display:grid;grid-template-columns:minmax\(0,1fr\) auto auto/);
  assert.match(css, /\.announcementDetails:not\(\[open\]\)\{grid-column:2;grid-row:1\}/);
  assert.match(css, /\.announcementDetails\[open\]\{grid-column:1\/-1;grid-row:2/);
  assert.match(css, /\.announcementActions\{grid-column:3;grid-row:1/);
  assert.match(css, /\.announcementList\{max-height:240px/);
  assert.match(css, /\.gameOption \.gameChoice\{width:100%;min-height:34px/);
  assert.match(html, /styles\.css\?v=1\.6\.53/);
  assert.match(html, /app\.js\?v=1\.6\.53/);
});

test('shared outcome drives win and loss effects for all game IDs, 2v2 teammates, Bingo seats, and excludes draws and spectators', () => {
  const expression = app.match(/  function resultOutcome\(game, playerSeat, gameType\) \{[\s\S]*?\n  \}/);
  assert.ok(expression, 'Pure shared outcome function missing');
  const resultOutcome = vm.runInNewContext(expression[0] + '\nresultOutcome', {
    seatColor: seat => ['1', '3'].includes(seat) ? 'black' : ['2', '4'].includes(seat) ? 'white' : seat,
  });
  for (const { id } of listGames()) {
    const blackSeat = id === 'omok2v2' ? '1' : 'black';
    const whiteSeat = id === 'omok2v2' ? '2' : 'white';
    assert.equal(resultOutcome({ status: 'finished', winner: 'black' }, blackSeat, id), 'win', `${id} black winner`);
    assert.equal(resultOutcome({ status: 'finished', winner: 'black' }, whiteSeat, id), 'loss', `${id} white loser`);
    assert.equal(resultOutcome({ status: 'finished', winner: 'white' }, blackSeat, id), 'loss', `${id} black loser`);
    assert.equal(resultOutcome({ status: 'finished', winner: 'white' }, whiteSeat, id), 'win', `${id} white winner`);
    assert.equal(resultOutcome({ status: 'draw', winner: null }, blackSeat, id), null);
    assert.equal(resultOutcome({ status: 'finished', winner: 'black' }, null, id), null);
  }
  assert.equal(resultOutcome({ status: 'finished', winner: 'black' }, '3', 'omok2v2'), 'win');
  assert.equal(resultOutcome({ status: 'finished', winner: 'white' }, '4', 'omok2v2'), 'win');
  assert.equal(resultOutcome({ status: 'finished', winner: '3' }, '3', 'bingo'), 'win');
  assert.equal(resultOutcome({ status: 'finished', winner: '3' }, '1', 'bingo'), 'loss');
  assert.match(app, /const outcome = resultOutcome\(g, seat, state\.gameType\);/);
  assert.match(app, /showResultEffect\(outcome, g\);/);
  assert.match(app, /baseballPanel\.classList\.toggle\('resultWinPanel', baseball && outcome === 'win'\)/);
  assert.match(app, /baseballPanel\.classList\.toggle\('resultLossPanel', baseball && outcome === 'loss'\)/);
  assert.match(app, /function enterLobby\(\) \{[\s\S]*?lastResultEffectKey = null;\n    clearResultEffect\(\);/);
  assert.match(css, /\.baseballPanel\.resultWinPanel/);
  assert.match(css, /\.baseballPanel\.resultLossPanel/);
});
