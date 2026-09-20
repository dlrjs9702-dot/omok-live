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
  assert.match(html, /app\.js\?v=1\.6\.57/);
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

// v1.6.55: the yut-throw stage moved out of the board canvas overlay into the common dice/yut
// animation panel docked above chat (#diceYutPanel), shared with any future dice game -- see
// PROJECT_STATUS.md's v1.6.55 section. It's no longer hidden/shown per-throw (that was only ever
// needed to get the old full-board overlay out of the way); the panel's own visibility now tracks
// whether a dice/yut-style game is active at all.
test('the yut-throw stage lives inside the common dice/yut panel docked above chat', () => {
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/index.html'), 'utf8');
  const panelStart = html.indexOf('id="diceYutPanel"');
  const panelEnd = html.indexOf('</section>', panelStart);
  const panelBlock = html.slice(panelStart, panelEnd);
  assert.match(panelBlock, /<div id="diceYutStage" class="diceYutStage" aria-hidden="true">/);
  for (const n of [1, 2, 3, 4]) {
    assert.match(panelBlock, new RegExp(`<div id="yutStick${n}" class="yutStick"><div class="ysFace ysFront"></div><div class="ysFace ysBack"></div></div>`));
  }
  // The panel sits inside .sideColumn, right before <aside id="roomSidebar"> -- i.e. directly
  // above the chat panel, not inside the board's own canvas overlay area.
  const sideColumnStart = html.indexOf('class="sideColumn"');
  assert.ok(sideColumnStart >= 0 && sideColumnStart < panelStart);
  const asideStart = html.indexOf('id="roomSidebar"');
  assert.ok(panelStart < asideStart);
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/styles.css'), 'utf8');
  assert.match(css, /\.diceYutStage\{position:relative;min-height:120px;[^}]*perspective:640px;/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.yutStick\{transition:none!important\}\}/);
});

test('the dice/yut panel is only shown while a dice/yut-style game (today: yut) is active', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(app, /diceYutPanel\.classList\.toggle\('hidden', !yut\);/);
  assert.match(app, /if \(yut && diceYutWasHidden\) applyDiceYutPanelMode\(\);/);
});

test('leaving the Yut Nori screen resets the throw-tracking state (no stale re-shuffle on the next game)', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(app, /yutLastThrowKey = null;\s*\n\s*yutThrowTrackingStarted = false;\s*\n\s*yutThrowAnimating = false;\s*\n\s*yutLastThrowFlags = null;/);
});

test('leaving the room hides the dice/yut panel and closes its PiP window without changing the saved mode preference', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(app, /function resetDiceYutPanelForRoomExit\(\) \{/);
  const fnBody = app.slice(app.indexOf('function resetDiceYutPanelForRoomExit'), app.indexOf('function resetDiceYutPanelForRoomExit') + 300);
  assert.match(fnBody, /diceYutPanel\.classList\.add\('hidden'\);/);
  // v1.6.57: closing the real PiP window (mirrors enterLobby's own closeRoomPip() call) triggers
  // openDiceYutPip's own pagehide handler, which puts #diceYutPanel back in its normal spot.
  assert.match(fnBody, /closeDiceYutPip\(\);/);
  assert.doesNotMatch(fnBody, /localStorage\.setItem\(DICE_PANEL_MODE_KEY/);
  assert.match(app, /resetDiceYutPanelForRoomExit\(\);/);
});

// v1.6.55: dice/yut animation panel -- default (docked) / pip (in-app floating window) / collapsed
// (title bar only), a single mode string so the three states can never combine/conflict, matching
// the spec's "세 가지 상태가 충돌하지 않도록" requirement directly.
test('the dice/yut panel has three mutually exclusive modes stored as a single string, persisted across games', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(app, /const DICE_PANEL_MODE_KEY = 'diceYutPanelMode';/);
  assert.match(app, /let diceYutPanelMode = 'default';/);
  assert.match(app, /if \(saved === 'default' \|\| saved === 'pip' \|\| saved === 'collapsed'\) diceYutPanelMode = saved;/);
  assert.match(app, /function setDiceYutPanelMode\(mode\) \{\s*\n\s*diceYutPanelMode = mode;\s*\n\s*try \{ localStorage\.setItem\(DICE_PANEL_MODE_KEY, mode\); \} catch \{\}/);
  assert.match(app, /diceYutPipBtn\.addEventListener\('click', \(\) => setDiceYutPanelMode\(diceYutPanelMode === 'pip' \? 'default' : 'pip'\)\);/);
  assert.match(app, /diceYutCollapseBtn\.addEventListener\('click', \(\) => setDiceYutPanelMode\(diceYutPanelMode === 'collapsed' \? 'default' : 'collapsed'\)\);/);
});

// v1.6.57: the panel's own PiP now uses the SAME native documentPictureInPicture-based mechanism as
// roomSidebar's own PIP (openRoomPip/closeRoomPip) -- a real second OS window, not an in-app
// floating <div> -- per the confirmed "네이티브 브라우저 창으로 변경" decision.
test('the dice/yut panel PiP mode uses the real native documentPictureInPicture window, reparenting the panel itself', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(app, /const diceYutPipSupported = 'documentPictureInPicture' in window;/);
  const openBody = app.slice(app.indexOf('async function openDiceYutPip'), app.indexOf('function applyDiceYutPanelMode'));
  assert.match(openBody, /const pipWindow = await documentPictureInPicture\.requestWindow\(\{ width: 300, height: 340 \}\);/);
  // Clones stylesheets into the popup's own <head> and applies a layout-override class to its
  // <html> -- same technique as openRoomPip, required because this page's CSP blocks inline styles.
  assert.match(openBody, /clone\.rel = 'stylesheet';/);
  assert.match(openBody, /pipWindow\.document\.documentElement\.classList\.add\('diceYutPipLayout'\);/);
  assert.match(openBody, /pipWindow\.document\.body\.appendChild\(diceYutPanel\);/);
  // Restoration on close is via the popup's own pagehide event, not a manual close handler.
  assert.match(openBody, /pipWindow\.addEventListener\('pagehide', \(\) => \{/);
  const applyBody = app.slice(app.indexOf('function applyDiceYutPanelMode'), app.indexOf('function setDiceYutPanelMode'));
  assert.doesNotMatch(applyBody, /diceYutPanel\.classList\.toggle\('floating'/);
  assert.match(applyBody, /if \(!diceYutPipActive\(\)\) openDiceYutPip\(\);/);
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/styles.css'), 'utf8');
  assert.doesNotMatch(css, /\.diceYutPanel\.floating/);
  assert.match(css, /html\.diceYutPipLayout,html\.diceYutPipLayout body\{/);
});

test('collapsed mode hides only the panel body (stage + result), keeping the title bar, and never applies while PiP is active', () => {
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/styles.css'), 'utf8');
  assert.match(css, /\.diceYutPanel\.collapsed \.diceYutBody\{display:none\}/);
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(app, /diceYutPanel\.classList\.toggle\('collapsed', collapsed && !pip\);/);
});

// Part E: as the popped-out PiP window is resized, the 3D stage scales down proportionally instead
// of clipping, via a CSS custom property so the underlying translate/rotate animation math is
// untouched.
test('the dice/yut PiP window scales the 3D stage proportionally as it is resized', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(app, /function applyDiceYutPipScale\(pipWindow\) \{/);
  assert.match(app, /diceYutStage\.style\.setProperty\('--diceYutScale', String\(scale\)\);/);
  assert.match(app, /diceYutPipResizeObserver = new pipWindow\.ResizeObserver\(\(\) => applyDiceYutPipScale\(pipWindow\)\);/);
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/styles.css'), 'utf8');
  assert.match(css, /transform:scale\(var\(--diceYutScale,1\)\)/);
});

// Switching the panel's own display mode must never touch game/server state, and must not restart
// an in-flight throw animation -- it only ever moves/classes the panel's own DOM node.
test('switching the dice/yut panel mode never touches game state and never rebuilds the stage', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  const fnBody = app.slice(app.indexOf('function applyDiceYutPanelMode'), app.indexOf('function setDiceYutPanelMode'));
  assert.doesNotMatch(fnBody, /roomAction|state\.game|diceYutStage\.replaceChildren|diceYutStage\.innerHTML/);
});

// The panel is a sibling of <aside id="roomSidebar">, not nested inside it, so it isn't subject to
// the sidebar's own mobile-only "hidden unless overlay open" rule -- it must stay visible in the
// normal page flow on mobile too, per the spec's mobile requirement.
test('the dice/yut panel is independent of the chat sidebar\'s own collapse/overlay/PiP state', () => {
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/index.html'), 'utf8');
  const sideColumnStart = html.indexOf('class="sideColumn"');
  const panelStart = html.indexOf('id="diceYutPanel"');
  const asideOpenTag = html.indexOf('<aside class="side card" id="roomSidebar">');
  assert.ok(sideColumnStart < panelStart && panelStart < asideOpenTag, 'panel must be a sibling of <aside>, not nested inside it');
});
