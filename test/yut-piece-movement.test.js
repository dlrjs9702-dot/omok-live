'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// v1.6.57: a move used to teleport straight from the old position to the new one (drawYutBoard()
// always painted every piece at its current, already-final, server position with zero animation).
// Now the piece hops node-by-node along the real server-computed path (lib/games/yut.js's new
// `path` field on a move's destination) before the instant redraw takes over. This is purely a
// draw-position override -- state.game.pieces is authoritative and untouched throughout.

test('animateYutPieceMove walks the real server path node by node instead of jumping straight to the result', () => {
  const app = read('public/app.js');
  assert.match(app, /function animateYutPieceMove\(pieceIds, path, \{ stepDuration = 400, pauseDuration = 100, onDone \} = \{\}\)/);
  // Reduced motion (or a degenerate 0/1-node path) skips straight to the final draw, same contract
  // as animateTumble's own reduced-motion bypass -- never silently does nothing.
  assert.match(app, /if \(reducedMotionActive\(\) \|\| path\.length < 2\) \{/);
  // Interpolates between yutNodePosition(path[i]) and yutNodePosition(path[i+1]) per segment.
  assert.match(app, /const \[fx, fy\] = yutNodePosition\(path\[segmentIndex\]\);/);
  assert.match(app, /const \[tx, ty\] = yutNodePosition\(path\[segmentIndex \+ 1\]\);/);
  // A small hop (sine arc) is layered on top of the straight-line interpolation per segment.
  assert.match(app, /y: fy \+ \(ty - fy\) \* eased - Math\.sin\(progress \* Math\.PI\) \* hopHeight,/);
  // Advances to the next segment only after a short pause, not immediately back-to-back.
  assert.match(app, /segmentIndex \+= 1; setTimeout\(runSegment, pauseDuration\); \}/);
});

test("a newer move animation supersedes an older one still in flight, instead of fighting it for the canvas", () => {
  const app = read('public/app.js');
  assert.match(app, /let yutMoveAnimationGen = 0;/);
  assert.match(app, /const gen = \+\+yutMoveAnimationGen;/);
  assert.match(app, /if \(gen !== yutMoveAnimationGen\) return;/);
});

test('drawYutBoard draws an in-flight piece (or piggybacked group) at its interpolated position, never its already-final server position', () => {
  const app = read('public/app.js');
  const fnBody = app.slice(app.indexOf('function drawYutBoard'), app.indexOf('function dotsLayout'));
  assert.match(fnBody, /const drawPieceStack = \(x, y, color, pieces\) => \{/);
  assert.match(fnBody, /const animatingIds = yutPieceAnimation\?\.pieceIds \|\| null;/);
  assert.match(fnBody, /if \(animatingIds\?\.has\(piece\.id\)\) continue;/);
  assert.match(fnBody, /drawPieceStack\(yutPieceAnimation\.x, yutPieceAnimation\.y, color, pieces\);/);
});

test('a move is only ever animated once the throw animation has fully settled', () => {
  const app = read('public/app.js');
  const fnBody = app.slice(app.indexOf('function renderYut()'), app.indexOf('function renderBingo'));
  // The whole new-move check is nested inside `if (!yutThrowAnimating) { ... }`, so it's skipped
  // entirely while the stick toss is still playing and only evaluated once settled (the throw's own
  // onDone -> renderYut() callback re-runs it then).
  assert.match(fnBody, /if \(!yutThrowAnimating\) \{\s*\n\s*const lastMove = g\.lastMove;/);
  assert.match(fnBody, /const isNewMove = Boolean\(moveKey && yutMoveTrackingStarted && yutLastMoveKey !== moveKey\);/);
});

test('move-choice buttons stay hidden until both the throw and any in-flight piece move have finished', () => {
  const app = read('public/app.js');
  assert.match(app, /const moves = mine && g\.phase === 'move' && !yutThrowAnimating && !yutPieceAnimation \? \(g\.legalMoves \|\| \[\]\) : \[\];/);
});

test('leaving the Yut Nori screen resets the move-tracking state and cancels any in-flight piece animation', () => {
  const app = read('public/app.js');
  const anchor = app.indexOf('yutThrowTrackingStarted = false;\n      yutThrowAnimating = false;\n      yutLastThrowFlags = null;');
  const fnBody = app.slice(anchor, anchor + 400);
  assert.match(fnBody, /yutLastMoveKey = null;/);
  assert.match(fnBody, /yutMoveTrackingStarted = false;/);
  assert.match(fnBody, /yutPieceAnimation = null;/);
  assert.match(fnBody, /yutMoveAnimationGen \+= 1;/);
});
