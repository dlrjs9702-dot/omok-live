'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

// These lock in two live-browser bugs found while testing Marathon end-to-end: (1) selecting the
// game from the lobby silently fell back to omok because selectGame()'s allowlist didn't know
// about it, and (2) the shared canvas board tried to draw an omok board over marathon's own panel
// and crashed, because drawBoard()'s early-return list (used by every panel-only game) didn't
// include it either.
test('selecting Marathon from the lobby actually selects Marathon, not omok', async () => {
  const app = await fs.readFile(path.resolve(__dirname, '../public/app.js'), 'utf8');
  const match = app.match(/selectedGameType = \[([^\]]+)\]\.includes\(type\) \? type : 'omok';/);
  assert.ok(match, 'selectGame() allowlist not found');
  assert.match(match[1], /'marathon'/);
});

test('the shared canvas board never tries to render a marathon game (it has its own panel)', async () => {
  const app = await fs.readFile(path.resolve(__dirname, '../public/app.js'), 'utf8');
  const match = app.match(/function drawBoard\(\) \{\n\s*if \(([^)]+)\) return;/);
  assert.ok(match, 'drawBoard() early-return guard not found');
  assert.match(match[1], /state\?\.gameType === 'marathon'/);
  assert.match(app, /canvasWrap\.classList\.toggle\('hidden', baseball \|\| bingo \|\| pictionary \|\| liar \|\| oldmaid \|\| marathon \|\| twenty\)/);
});

test('the room view passes the viewer\'s own seat into marathon\'s publicState, like liar already does', async () => {
  const server = await fs.readFile(path.resolve(__dirname, '../server.js'), 'utf8');
  // Without this, myGroup/myTurn/canAnswer are always null/false for every viewer, since
  // publicState() defaults viewerSeat to null when not explicitly passed.
  assert.match(server, /isMarathon\(room\) \? getGame\('marathon'\)\.publicState\(room\.game, seat\)/);
});

test('the Marathon panel exists with config chooser, track, dice and mission UI', async () => {
  const html = await fs.readFile(path.resolve(__dirname, '../public/index.html'), 'utf8');
  assert.match(html, /id="marathonPanel"/);
  assert.match(html, /id="marathonConfigChooser"/);
  assert.match(html, /id="marathonLayoutChooser"/);
  assert.match(html, /id="marathonTrack"/);
  assert.match(html, /id="marathonRollBtn"/);
  assert.match(html, /id="marathonMissionBox"/);
  assert.match(html, /id="marathonAnswerForm"/);
  assert.match(html, /id="marathonReflexOptions"/);
  assert.match(html, /data-game="marathon"/);
  assert.match(html, /<option value="marathon">/);
});
