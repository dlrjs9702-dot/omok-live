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

// v1.6.67 house rule: the start corner and the finish line are the same landing spot approached
// from opposite directions, so a back-do that would push a piece off the very first cell (1)
// instead sends it straight to the finish line -- exactly as if it had gone all the way around.
test('a back-do off the first cell lands on the finish line instead of the start corner', () => {
  const game = yut.create();
  yut.start(game);
  Object.assign(game.pieces.black[0], { status: 'board', position: 1, route: 'outer' });
  game.phase = 'move';
  game.pendingSteps = -1;
  const option = yut.legalMoves(game).find(move => move.pieceId === 'black-1');
  assert.equal(option.destination.status, 'board');
  assert.equal(option.destination.position, 'finishLine');
  assert.deepEqual(option.destination.path, [1, 'finishLine']);
  const moved = yut.applyMove(game, 'black-1', 'black', 'now');
  assert.equal(moved.legal, true);
  assert.equal(game.pieces.black[0].status, 'board');
  assert.equal(game.pieces.black[0].position, 'finishLine');
  // Reaching the finish line this way still doesn't finish the piece by itself -- a further move
  // is required, same as reaching it by any other route (a plain forward walk or a shortcut).
  assert.equal(game.status, 'playing');

  // Backing up from any other cell is unaffected -- only cell 1 gets the wrap-around.
  const other = { status: 'board', position: 2, route: 'outer' };
  assert.equal(yut.destination(other, -1).position, 1);
});

test('stacked Yut pieces are spread sideways so every piece number remains visible', async () => {
  const root = path.join(__dirname, '..');
  const js = await fs.readFile(path.join(root, 'public/app.js'), 'utf8');
  assert.match(js, /function yutStackOffsets\(count\)/);
  assert.match(js, /const offsets = yutStackOffsets\(ordered\.length\)/);
  assert.match(js, /ctx\.arc\(px,y,18,0,Math\.PI\*2\)/);
  assert.match(js, /ctx\.fillText\(piece\.id\.split\('-'\)\.at\(-1\), px, y \+ 5\)/);
  assert.match(js, /carriedNumbers\.join\('·'\)/);
  const match = js.match(/  function yutStackOffsets\(count\) \{[\s\S]*?\n  \}/);
  assert.ok(match, 'yutStackOffsets helper missing');
  const vm = require('node:vm');
  const offsets = vm.runInNewContext(match[0] + '\nyutStackOffsets');
  assert.deepEqual(Array.from(offsets(1)), [0]);
  assert.deepEqual(Array.from(offsets(2)), [-13, 13]);
  assert.deepEqual(Array.from(offsets(3)), [-26, 0, 26]);
  assert.deepEqual(Array.from(offsets(4)), [-39, -13, 13, 39]);
});

// v1.6.41: move-choice buttons show how many spaces a piece moves instead of the destination tile
// number, the start tile gets a solid, high-contrast blue fill instead of a text label, and the
// floating "지름길"/"출발 · 완주" center-board labels were removed -- purely presentational, the
// underlying move/backdo/piggyback/shortcut/finish rules are untouched (still covered above).
test('move-choice buttons are distance-focused and the start tile is a distinct blue fill', async () => {
  const root = path.join(__dirname, '..');
  const js = await fs.readFile(path.join(root, 'public/app.js'), 'utf8');
  assert.match(js, /const moveLabel = backward \? `\$\{steps\}칸 뒤로` : `\$\{steps\}칸 이동`/);
  assert.match(js, /pieceLabel = carriedNumbers\.length > 1 \? `\$\{carriedNumbers\.join\('·'\)\}번 말` : `\$\{number\}번 말`/);
  assert.match(js, /button\.textContent = `\$\{pieceLabel\} · \$\{moveLabel\}\$\{statusNote\}`/);
  assert.doesNotMatch(js, /→ \$\{target\}/);
  assert.match(js, /const isStart = node === 0;/);
  assert.match(js, /ctx\.fillStyle = '#1d4ed8';\s*\n\s*ctx\.beginPath\(\); ctx\.arc\(x,y,30,0,Math\.PI\*2\); ctx\.fill\(\);/);
  assert.doesNotMatch(js, /fillText\('지름길'/);
  assert.doesNotMatch(js, /fillText\('출발 · 완주'/);
});

// v1.6.64 bug fix: a piece resting on the finish line (server: lib/games/yut.js FINISH_LINE) used
// to be drawn at the exact same board coordinate as node 0 (the start corner), so a back-do off of
// it could look like nothing happened whenever another piece of the same color also sat on node 0.
test('the finish-line resting waypoint is drawn at its own board position, distinct from the start tile', async () => {
  const root = path.join(__dirname, '..');
  const js = await fs.readFile(path.join(root, 'public/app.js'), 'utf8');
  const mapMatch = js.match(/function yutNodePosition\(node\) \{\s*const map = \{([\s\S]*?)\};/);
  assert.ok(mapMatch, 'yutNodePosition coordinate map missing');
  assert.doesNotMatch(mapMatch[1], /finishLine:\[630,630\]/);
  assert.match(mapMatch[1], /finishLine:\[\d+,\d+\]/);
  const vm = require('node:vm');
  const positions = vm.runInNewContext(`(${js.match(/function yutNodePosition\(node\) \{[\s\S]*?\n  \}/)[0]})`);
  assert.notDeepEqual(positions('finishLine'), positions(0));
  // The distinct green marker tile and the board's own track line both route through it, so it
  // reads as a real waypoint rather than empty space.
  assert.match(js, /const isFinish = node === 'finishLine';/);
  assert.match(js, /if \(isFinish\) \{\s*\n\s*ctx\.fillStyle = '#15803d';/);
  assert.match(js, /\[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,'finishLine',0\]/);
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
  assert.match(html, /app\.js\?v=1\.6\.84/);
});

// v1.6.38: advanced CSS/JS yut-throw animation, requested in place of pre-rendered video (no video
// production tooling is available in this environment) -- 4 sticks tumble in the board center and
// settle on the server-confirmed backs-up pattern. Engine rules are completely untouched.
test('the yut-throw animation is a reusable function, reconnect-safe, and duplicate-throw safe', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(app, /function animateYutThrow\(stickEls, backFlags/);
  // v1.6.55: the reduced-motion bypass now lives in the shared animateTumble core (also used by
  // animateDiceRoll), not duplicated inside animateYutThrow itself.
  const tumbleBody = app.slice(app.indexOf('function animateTumble'), app.indexOf('function animateDiceRoll'));
  assert.match(tumbleBody, /if \(reducedMotionActive\(\) \|\| !els\.length\) \{ settle\(false\); return; \}/);
  // Face content is fixed per stick element (see index.html); settling only ever rotates to 0deg
  // (front/flat) or 180deg (back/round) for the server-confirmed count, never touching content.
  const settleBlock = app.slice(app.indexOf("function animateYutThrow"), app.indexOf("function animateYutThrow") + 1100);
  assert.match(settleBlock, /rotateY\(\$\{backFlags\[i\] \? 180 : 0\}deg\)/);
  // v1.6.57: each of the 4 sticks gets its own bounce-height/timing jitter (bouncePhase/
  // bounceScale) on top of its own spin axes, so the sticks visibly don't all tumble identically.
  assert.match(settleBlock, /bouncePhase: \(Math\.random\(\) - 0\.5\) \* 0\.08,/);
  assert.match(settleBlock, /bounceScale: 0\.82 \+ Math\.random\(\) \* 0\.36,/);
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

// v1.6.55: the yut-throw stage moved out of the board canvas overlay into a common dice/yut
// animation stage -- see PROJECT_STATUS.md's v1.6.55 section. It's no longer hidden/shown
// per-throw (that was only ever needed to get the old full-board overlay out of the way); its
// visibility now tracks whether a dice/yut-style game is active at all.
// v1.6.58: the stage (#diceYutSection) is no longer its own separately-poppable panel -- it's
// embedded inside the "게임 진행" card (#gameInfoPanel), which pops out as a whole (see
// openGameInfoPip in app.js) alongside every game's own action controls. A browser only allows one
// native Document Picture-in-Picture window at a time, so giving the stage its own separate PIP
// button (the short-lived v1.6.57 design) meant opening it silently closed the chat sidebar's own
// PIP and vice versa -- confusing, not a real second window.
test('the yut-throw stage lives inside #gameInfoPanel, above its #gameActionsPanel controls', () => {
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/index.html'), 'utf8');
  const sectionStart = html.indexOf('id="diceYutSection"');
  const sectionEnd = html.indexOf('id="gameActionsPanel"', sectionStart);
  const sectionBlock = html.slice(sectionStart, sectionEnd);
  assert.match(sectionBlock, /<div id="diceYutStage" class="diceYutStage" aria-hidden="true">/);
  for (const n of [1, 2, 3, 4]) {
    assert.match(sectionBlock, new RegExp(`<div id="yutStick${n}" class="yutStick"><div class="ysFace ysFront"></div><div class="ysFace ysBack"></div></div>`));
  }
  // The stage sits inside #gameInfoPanel, before #gameActionsPanel -- not inside the board's own
  // canvas overlay area, and not inside the separate chat-only #chatPanel.
  const gameInfoStart = html.indexOf('id="gameInfoPanel"');
  assert.ok(gameInfoStart >= 0 && gameInfoStart < sectionStart);
  const actionsStart = html.indexOf('id="gameActionsPanel"');
  assert.ok(sectionStart < actionsStart);
  const chatStart = html.indexOf('id="chatPanel"');
  assert.ok(chatStart < gameInfoStart, 'chatPanel must come first, as its own separate panel');
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/styles.css'), 'utf8');
  assert.match(css, /\.diceYutStage\{position:relative;min-height:120px;[^}]*perspective:640px;/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.yutStick\{transition:none!important\}\}/);
});

test('the dice/yut stage is only shown while a dice/yut-style game (today: yut) is active', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(app, /diceYutSection\.classList\.toggle\('hidden', !yut\);/);
});

test('leaving the Yut Nori screen resets the throw-tracking state (no stale re-shuffle on the next game)', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(app, /yutLastThrowKey = null;\s*\n\s*yutThrowTrackingStarted = false;\s*\n\s*yutThrowAnimating = false;\s*\n\s*yutLastThrowFlags = null;/);
});

// v1.6.58: no more per-stage room-exit reset -- the stage is a plain embedded section with no PIP
// or collapse state of its own; enterLobby() closing #gameInfoPanel's own PIP window (see
// room-pip.test.js) is what keeps it from lingering over the lobby.
test('the dice/yut stage has no PIP or collapse state of its own -- it inherits #gameInfoPanel\'s', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.doesNotMatch(app, /diceYutPipBtn|diceYutCollapseBtn|diceYutPanelMode|DICE_PANEL_MODE_KEY/);
});

// Part E carried forward: as the popped-out "게임 진행" PIP window is resized, the 3D stage scales
// down proportionally instead of clipping, via a CSS custom property so the underlying
// translate/rotate animation math is untouched. (Covered in depth by room-pip.test.js; this just
// pins the stage's own side of the contract -- the CSS variable it reads.)
test('the dice/yut stage scales via a CSS custom property the game-info PIP resize observer sets', () => {
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/styles.css'), 'utf8');
  assert.match(css, /transform:scale\(var\(--diceYutScale,1\)\)/);
});

// The stage lives inside #gameInfoPanel now, not as its own sibling -- so it shares that panel's
// mobile collapse/overlay/PIP state (covered by chat-height.test.js and room-pip.test.js) rather
// than being independent of it. It must never sit inside the separate chat-only #chatPanel.
test('the dice/yut stage is part of #gameInfoPanel, never nested inside the chat-only #chatPanel', () => {
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/index.html'), 'utf8');
  const chatStart = html.indexOf('id="chatPanel"');
  const chatEnd = html.indexOf('</aside>', chatStart);
  const chatMarkup = html.slice(chatStart, chatEnd);
  assert.doesNotMatch(chatMarkup, /id="diceYutSection"/);
  const gameInfoStart = html.indexOf('id="gameInfoPanel"');
  const sectionStart = html.indexOf('id="diceYutSection"');
  assert.ok(gameInfoStart >= 0 && gameInfoStart < sectionStart);
});
