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
  assert.deepEqual(yut.throwYut(game, 'black', 't1', 1, false), { legal: true, name: '도', steps: 1, backs: 1, color: 'black', at: 't1', passed: false });
  assert.equal(yut.throwYut(game, 'black', 'bad', 2).reason, 'must-move');
  assert.equal(yut.applyMove(game, 'black-1', 'black', 't2').legal, true);
  assert.equal(game.pieces.black[0].position, 1);
  assert.equal(game.turn, 'white');

  yut.throwYut(game, 'white', 't3', 1, false);
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

test('reaching the finish line does not finish a piece by itself; a later move does', () => {
  const game = yut.create();
  yut.start(game);
  for (let i = 0; i < 3; i += 1) Object.assign(game.pieces.black[i], { status: 'finished', position: null });
  Object.assign(game.pieces.black[3], { status: 'board', position: 19, route: 'outer' });
  yut.throwYut(game, 'black', 'throw', 1, false);
  const resting = yut.applyMove(game, 'black-4', 'black', 'move');
  assert.equal(resting.finished, false);
  assert.equal(game.pieces.black[3].status, 'board');
  assert.equal(game.pieces.black[3].position, 'finishLine');
  assert.equal(game.status, 'playing');
  assert.equal(game.turn, 'white');
});

test('the first player to finish all four pieces wins and reset opens a clean round', () => {
  const game = yut.create();
  yut.start(game);
  for (let i = 0; i < 3; i += 1) Object.assign(game.pieces.black[i], { status: 'finished', position: null });
  Object.assign(game.pieces.black[3], { status: 'board', position: 'finishLine', route: 'outer' });
  yut.throwYut(game, 'black', 'throw', 1, false);
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
  assert.match(html, /app\.js\?v=1\.6.40/);
});

// v1.6.38: advanced CSS/JS yut-throw animation, requested in place of pre-rendered video (no video
// production tooling is available in this environment) -- 4 sticks tumble in the board center and
// settle on the server-confirmed backs-up pattern. Engine rules are completely untouched.
test('the yut-throw animation is a reusable function, reconnect-safe, and duplicate-throw safe', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(app, /function animateYutThrow\(stickEls, backFlags/);
  assert.match(app, /if \(reducedMotionActive\(\) \|\| !stickEls\.length\) \{ settle\(false\); return; \}/);
  // Face content is fixed per stick element (see index.html); settling only ever rotates to 0deg
  // (front/flat) or 180deg (back/round) for the server-confirmed count, never touching content.
  const settleBlock = app.slice(app.indexOf("function animateYutThrow"), app.indexOf("function animateYutThrow") + 700);
  assert.match(settleBlock, /rotateY\(\$\{backFlags\[i\] \? 180 : 0\}deg\)/);
  // Same reconnect-safe key-diff guard used for Land King's dice/token animations -- a throw
  // inherited on first render (reconnect) must not replay, but a fresh game's own first throw must.
  assert.match(app, /const isNewThrow = Boolean\(throwKey && yutThrowTrackingStarted && yutLastThrowKey !== throwKey\);/);
  assert.match(app, /animateYutThrow\(yutSticks, flags,/);
  // Duplicate-throw prevention: disabled the instant the button is clicked (before the request
  // resolves), and again while the animation itself is still in flight.
  assert.match(app, /yutThrowBtn\.disabled = true;\s*\n\s*await roomAction\('throw-yut'\);/);
  assert.match(app, /yutThrowBtn\.disabled = !\(mine && g\.phase === 'throw'\) \|\| yutThrowAnimating;/);
});

test('the yut-throw animation only ever displays the server-confirmed backs count, never invents one', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  // The count of true flags always equals g.lastThrow.backs -- only which specific stick shows
  // which face is shuffled client-side for visual variety, since the engine never reports that.
  assert.match(app, /const backs = Math\.max\(0, Math\.min\(4, Number\(g\.lastThrow\.backs\) \|\| 0\)\);/);
  assert.match(app, /const flags = \[true, true, true, true\]\.map\(\(_, i\) => i < backs\);/);
  // 빽도 and 도 are visually identical to this engine (both a single back-up stick); mark it so the
  // player has a visual anchor, but only as decoration -- it changes no logic.
  assert.match(app, /g\.lastThrow\.name === '빽도' && flags\[i\]/);
});

test('the yut-throw stage lives inside the shared board canvas wrap (center of the board)', () => {
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/index.html'), 'utf8');
  const wrapStart = html.indexOf('id="canvasWrap"');
  const wrapEnd = html.indexOf('id="cityActionPanel"', wrapStart);
  const wrapBlock = html.slice(wrapStart, wrapEnd);
  assert.match(wrapBlock, /<div id="yutThrowStage" class="yutThrowStage hidden"/);
  for (const n of [1, 2, 3, 4]) {
    assert.match(wrapBlock, new RegExp(`<div id="yutStick${n}" class="yutStick"><div class="ysFace ysFront"></div><div class="ysFace ysBack"></div></div>`));
  }
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/styles.css'), 'utf8');
  assert.match(css, /\.yutThrowStage\{position:absolute;inset:0;[^}]*pointer-events:none\}/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.yutStick\{transition:none!important\}\}/);
});

test('leaving the Yut Nori screen resets the throw-tracking state and hides the stage', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(app, /yutLastThrowKey = null;\s*\n\s*yutThrowTrackingStarted = false;\s*\n\s*yutThrowAnimating = false;/);
  assert.match(app, /yutThrowStage\.classList\.add\('hidden'\);/);
});
