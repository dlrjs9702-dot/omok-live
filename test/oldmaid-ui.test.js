'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// The panel used to have no dark-theme container and several light-mode colors (a light amber
// result banner, a near-white "draw target" highlight) that made text unreadable against the
// app's dark background. This only re-styles the existing markup/behavior, it does not change
// any old maid game rule.
test('Old Maid panel matches the app dark theme instead of leftover light-mode colors', () => {
  const css = read('public/styles.css');
  assert.match(css, /\.oldmaidPanel\{[^}]*background:#0b1324/);
  assert.match(css, /\.oldmaidResult\{[^}]*background:#422006/);
  assert.doesNotMatch(css, /\.oldmaidResult\{[^}]*#fef3c7/); // old light-amber result background
  assert.match(css, /\.oldmaidOpponent\.target\{[^}]*border-color:#facc15/);
  assert.doesNotMatch(css, /\.oldmaidOpponent\.target\{[^}]*#eff6ff/); // old near-white target highlight
  assert.doesNotMatch(css, /\.oldmaidFace\{background:white/); // old plain-white hand card background
  assert.match(css, /\.oldmaidHistory\{[^}]*color:#94a3b8/); // was #475569, too low-contrast on dark bg
});

test('the current-turn opponent is highlighted separately from the draw target', () => {
  const css = read('public/styles.css');
  const app = read('public/app.js');
  assert.match(css, /\.oldmaidOpponent\.turn\{[^}]*border-color:#60a5fa/);
  assert.match(css, /\.oldmaidOpponent\.target\{[^}]*border-color:#facc15/);
  assert.match(app, /row\.className = 'oldmaidOpponent' \+ \(g\.target === number \? ' target' : ''\) \+ \(g\.turn === number \? ' turn' : ''\)/);
  assert.match(app, /g\.turn === number \? ' · 차례' : ''/);
});

test('hand cards color-code red suits for readability and the draw pile uses a real emoji glyph', () => {
  const app = read('public/app.js');
  assert.match(app, /const red = card\.suit === '♥' \|\| card\.suit === '♦';/);
  assert.match(app, /'oldmaidCard oldmaidFace' \+ \(card\.rank === 'JOKER' \? ' joker' : red \? ' red' : ''\)/);
  assert.match(app, /'oldmaidCard oldmaidBack'/);
  assert.match(app, /button\.textContent = '🎴';/);
  assert.doesNotMatch(app, /🂠/); // the old Playing-Card-Back glyph renders as a blank box in many fonts
});

test('existing shuffle, draw and start behavior is untouched', () => {
  const app = read('public/app.js');
  const server = read('server.js');
  assert.match(app, /roomAction\('draw-oldmaid', \{ targetSeat: number, index, expectedRevision: g\.revision \}\)/);
  assert.match(app, /oldmaidShuffleBtn\.addEventListener/);
  assert.match(app, /oldmaidStartBtn\.addEventListener/);
  assert.match(server, /start-oldmaid\|shuffle-oldmaid\|draw-oldmaid/);
});
