'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const yut = require('../lib/games/yut');
const { getGame, listGames } = require('../lib/games');

test('Yut Nori is independently registered with four pieces per player', () => {
  assert.equal(getGame('yut'), yut);
  assert.ok(listGames().some(game => game.id === 'yut'));
  const game = yut.create();
  assert.equal(game.pieces.black.length, 4);
  assert.equal(game.pieces.white.length, 4);
  assert.equal(game.status, 'selecting');
});

test('server-authoritative throws enforce phases, turns, bonus throws and capture', () => {
  const game = yut.create();
  yut.start(game);
  assert.deepEqual(yut.throwYut(game, 'black', 't1', 1), { legal: true, name: '도', steps: 1, backs: 1, color: 'black', at: 't1' });
  assert.equal(yut.throwYut(game, 'black', 'bad', 2).reason, 'must-move');
  assert.equal(yut.applyMove(game, 'black-1', 'black', 't2').legal, true);
  assert.equal(game.pieces.black[0].position, 1);
  assert.equal(game.turn, 'white');

  yut.throwYut(game, 'white', 't3', 1);
  const capture = yut.applyMove(game, 'white-1', 'white', 't4');
  assert.deepEqual(capture.captured, ['black-1']);
  assert.equal(capture.bonus, true);
  assert.equal(game.turn, 'white');
  assert.equal(game.phase, 'throw');
  assert.equal(game.pieces.black[0].status, 'home');

  const mo = yut.throwYut(game, 'white', 't5', 0);
  assert.equal(mo.name, '모');
  assert.equal(mo.steps, 5);
});

test('stacked pieces move together and corner stops use the shortcut', () => {
  const game = yut.create();
  yut.start(game);
  Object.assign(game.pieces.black[0], { status: 'board', position: 5, route: 'outer' });
  Object.assign(game.pieces.black[1], { status: 'board', position: 5, route: 'outer' });
  game.phase = 'move';
  game.pendingSteps = 2;
  const option = yut.legalMoves(game).find(move => move.pieceId === 'black-1');
  assert.deepEqual(option.carried, ['black-1', 'black-2']);
  assert.equal(option.destination.position, 22);
  const moved = yut.applyMove(game, 'black-2', 'black', 'now');
  assert.equal(moved.legal, true);
  assert.deepEqual(game.pieces.black.slice(0, 2).map(piece => piece.position), [22, 22]);
  assert.deepEqual(game.pieces.black.slice(0, 2).map(piece => piece.route), ['shortcut5', 'shortcut5']);
});

test('stacked Yut pieces are spread sideways so every piece number remains visible', async () => {
  const root = path.join(__dirname, '..');
  const js = await fs.readFile(path.join(root, 'public/app.js'), 'utf8');
  assert.match(js, /function yutStackOffsets\(count\)/);
  assert.match(js, /const offsets = yutStackOffsets\(ordered\.length\)/);
  assert.match(js, /ctx\.arc\(px,y,18,0,Math\.PI\*2\)/);
  assert.match(js, /ctx\.fillText\(piece\.id\.split\('-'\)\.at\(-1\), px, y \+ 5\)/);
  assert.match(js, /carriedNumbers\.map\(value => `\$\{value\}번`\)\.join\(' \+ '\)/);
  const match = js.match(/  function yutStackOffsets\(count\) \{[\s\S]*?\n  \}/);
  assert.ok(match, 'yutStackOffsets helper missing');
  const vm = require('node:vm');
  const offsets = vm.runInNewContext(match[0] + '\nyutStackOffsets');
  assert.deepEqual(Array.from(offsets(1)), [0]);
  assert.deepEqual(Array.from(offsets(2)), [-13, 13]);
  assert.deepEqual(Array.from(offsets(3)), [-26, 0, 26]);
  assert.deepEqual(Array.from(offsets(4)), [-39, -13, 13, 39]);
});

test('the first player to finish all four pieces wins and reset opens a clean round', () => {
  const game = yut.create();
  yut.start(game);
  for (let i = 0; i < 3; i += 1) Object.assign(game.pieces.black[i], { status: 'finished', position: null });
  Object.assign(game.pieces.black[3], { status: 'board', position: 19, route: 'outer' });
  yut.throwYut(game, 'black', 'throw', 1);
  const result = yut.applyMove(game, 'black-4', 'black', 'move');
  assert.equal(result.finished, true);
  assert.equal(game.status, 'finished');
  assert.equal(game.winner, 'black');
  assert.deepEqual(yut.publicState(game).scores, { black: 4, white: 0 });
  yut.reset(game);
  assert.equal(game.round, 2);
  assert.equal(game.status, 'selecting');
  assert.equal(game.pieces.black.every(piece => piece.status === 'home'), true);
});

test('Yut Nori UI, actions and cache version are wired without changing guest entry', async () => {
  const root = path.join(__dirname, '..');
  const [html, js, server] = await Promise.all([
    fs.readFile(path.join(root, 'public/index.html'), 'utf8'),
    fs.readFile(path.join(root, 'public/app.js'), 'utf8'),
    fs.readFile(path.join(root, 'server.js'), 'utf8'),
  ]);
  assert.match(html, /data-game="yut"/);
  assert.match(html, /id="yutThrowBtn"/);
  assert.match(js, /function drawYutBoard\(/);
  assert.match(js, /roomAction\('throw-yut'\)/);
  assert.match(server, /throw-yut\|move-yut/);
  assert.match(server, /\/guest-entry/);
  assert.match(html, /app\.js\?v=1\.6\.24/);
});
