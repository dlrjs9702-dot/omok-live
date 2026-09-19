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
  assert.match(css, /\.oldmaidSeat\.target \.oldmaidSeatInfo\{[^}]*border-color:#facc15/);
  assert.doesNotMatch(css, /\.oldmaidSeat\.target \.oldmaidSeatInfo\{[^}]*#eff6ff/); // old near-white target highlight
  assert.doesNotMatch(css, /\.oldmaidFace\{background:white/); // old plain-white hand card background
  assert.match(css, /\.oldmaidHistory\{[^}]*color:#94a3b8/); // was #475569, too low-contrast on dark bg
});

test('the current-turn seat is highlighted separately from the draw target', () => {
  const css = read('public/styles.css');
  const app = read('public/app.js');
  assert.match(css, /\.oldmaidSeat\.turn \.oldmaidSeatInfo\{[^}]*border-color:#60a5fa/);
  assert.match(css, /\.oldmaidSeat\.target \.oldmaidSeatInfo\{[^}]*border-color:#facc15/);
  assert.match(app, /\(g\.turn === number \? ' turn' : ''\) \+ \(g\.target === number \? ' target' : ''\)/);
});

test('hand cards color-code red suits for readability and the card back is a custom CSS design, not an OS emoji', () => {
  const app = read('public/app.js');
  const css = read('public/styles.css');
  assert.match(app, /const red = card\.suit === '♥' \|\| card\.suit === '♦';/);
  assert.match(app, /'oldmaidCard oldmaidFace' \+ \(card\.rank === 'JOKER' \? ' joker' : red \? ' red' : ''\)/);
  assert.match(app, /'oldmaidCard oldmaidBack'/);
  // v1.6.43: no emoji glyph is ever set as the back-card's text content anymore -- the back is a
  // pure CSS pattern (diagonal weave + inner frame) so it renders identically on every OS/browser.
  assert.doesNotMatch(app, /button\.textContent = '🎴';/);
  assert.doesNotMatch(app, /🂠/); // the old Playing-Card-Back glyph renders as a blank box in many fonts
  assert.match(css, /\.oldmaidBack\{[^}]*repeating-linear-gradient/);
  assert.match(css, /\.oldmaidBack::after\{/);
});

test('existing shuffle, draw and start behavior is untouched', () => {
  const app = read('public/app.js');
  const server = read('server.js');
  assert.match(app, /roomAction\('draw-oldmaid', \{ targetSeat, index, expectedRevision: g\.revision \}\)/);
  assert.match(app, /oldmaidShuffleBtn\.addEventListener/);
  assert.match(app, /oldmaidStartBtn\.addEventListener/);
  assert.match(server, /start-oldmaid\|shuffle-oldmaid\|draw-oldmaid/);
});

// v1.6.35: the flat opponent list was replaced with a seat layout positioned around a table.
test('seats are arranged around the table relative to my own seat, not in server roster order', () => {
  const app = read('public/app.js');
  assert.match(app, /function oldmaidRotatedSeats\(order, anchorSeat\)/);
  assert.match(app, /function oldmaidSeatPoint\(angleDeg\)/);
  assert.match(app, /const rotated = oldmaidRotatedSeats\(rosterSeats, iAmSeated \? seat : null\)/);
  assert.match(app, /oldmaidSeatPoint\(180 \+ \(n \? \(360 \/ n\) \* k : 0\)\)/);
  // my seat is always anchored to the bottom-center angle (180deg) via the rotation, not hardcoded per player count
  assert.doesNotMatch(app, /if \(n === 2\)/);
});

test('a player who empties their hand keeps their seat instead of being removed from the table', () => {
  const app = read('public/app.js');
  assert.match(app, /const escaped = g\.status !== 'selecting' && count === 0 && !isLoser;/);
  assert.match(app, /rotated\.forEach\(\(number, k\) => \{/);
  // escaped seats stay rendered with a badge, they are not filtered out of the seat list
  assert.doesNotMatch(app, /rotated\.filter\(/);
});

test('opponent cards are always rendered face-down; only my own hand shows card faces', () => {
  const app = read('public/app.js');
  assert.match(app, /if \(!isMe\) \{/);
  assert.match(app, /cards\.className = 'oldmaidSeatCards';/);
  assert.match(app, /button\.className = 'oldmaidCard oldmaidBack' \+ \(canDraw \? ' selectable' : ''\);/);
  // opponent seat cards never read from card.rank/card.suit (their face content) - only my own
  // hand does; the back's look comes entirely from the .oldmaidBack CSS class, not a text glyph.
  const seatCardsBlock = app.slice(app.indexOf("cards.className = 'oldmaidSeatCards'"), app.indexOf('seatEl.appendChild(cards)'));
  assert.doesNotMatch(seatCardsBlock, /card\.rank|card\.suit|textContent/);
});

test('draw clicks are routed through a busy-guarded handler that disables all card backs during the request', () => {
  const app = read('public/app.js');
  assert.match(app, /async function oldmaidDrawCard\(targetSeat, index, buttonEl\)/);
  assert.match(app, /if \(oldmaidDrawBusy \|\| !state\?\.game\) return;/);
  assert.match(app, /oldmaidDrawBusy = true;/);
  assert.match(app, /for \(const candidate of oldmaidSeatsEl\.querySelectorAll\('\.oldmaidBack'\)\) candidate\.disabled = true;/);
  assert.match(app, /oldmaidDrawBusy = false;/);
  assert.match(app, /oldmaidDrawCard\(number, index, button\);/);
});

test('the draw flight animation and pair/escape effects are purely cosmetic and never gate the real state update', () => {
  const app = read('public/app.js');
  assert.match(app, /await roomAction\('draw-oldmaid', \{ targetSeat, index, expectedRevision: g\.revision \}\);/);
  assert.match(app, /function oldmaidFlyDrawnCard\(originRect, card\)/);
  assert.match(app, /function oldmaidRunEffects\(g\)/);
  // effects are derived from a diff against already-applied server state (g.history / counts), not from the request itself
  assert.match(app, /if \(history\.length > oldmaidLastHistoryLen\)/);
});

// v1.6.43: the draw flyer used to start optimistically on click and always show the card back; it
// now only ever starts after roomAction() resolves, and only when a genuinely new card id shows up
// in my own hand (a failed/stale draw leaves the hand unchanged, so nothing plays).
test('the draw flyer is server-confirmed (starts only after the request resolves, driven by a hand diff) and reveals the real face', () => {
  const app = read('public/app.js');
  const drawFn = app.slice(app.indexOf('async function oldmaidDrawCard'), app.indexOf('async function oldmaidUsePeek'));
  const awaitIndex = drawFn.indexOf("await roomAction('draw-oldmaid'");
  const flyIndex = drawFn.indexOf('oldmaidFlyDrawnCard(originRect, drawnCard)');
  assert.ok(awaitIndex >= 0 && flyIndex >= 0 && flyIndex > awaitIndex,
    'the flight must be triggered only after the draw request has resolved, not before it');
  // v1.6.45: the drawn card's identity now comes straight from the server response, not from
  // diffing beforeHand/afterHand -- a draw that immediately completes a pair removes that same
  // card from the hand again before the response ever reaches the client, so the old diff could
  // never recover it and silently skipped the animation on every such pair (non-joker cards pair
  // often; the joker never does, which is why only joker draws visibly animated before this fix).
  assert.match(drawFn, /const drawnCard = data\?\.drawnOldMaidCard \|\| null;/);
  assert.match(drawFn, /if \(drawnCard && originRect\?\.width && originRect\?\.height\)/);
  assert.match(app, /flyer\.className = 'oldmaidCard oldmaidFace oldmaidFlyingCard' \+ oldmaidCardFaceClass\(card\);/);
});

// v1.6.43: a completed pair's two cards converge, glow and fade -- but this is decorative clones
// only; the real hand array (state.me.myOldMaidHand) is never written to by this code.
test('the pair-removal convergence effect animates clones and never mutates the real hand array', () => {
  const app = read('public/app.js');
  assert.match(app, /function oldmaidFlyPairsToDiscard\(removedCards\)/);
  assert.match(app, /const removedCards = \[\.\.\.beforeHand, drawnCard\]\.filter\(card => !afterIds\.has\(card\.id\)\);/);
  assert.match(app, /if \(removedCards\.length >= 2\) oldmaidFlyPairsToDiscard\(removedCards\);/);
  const flyFn = app.slice(app.indexOf('function oldmaidFlyPairsToDiscard'), app.indexOf('function oldmaidShowJokerTension'));
  assert.doesNotMatch(flyFn, /myOldMaidHand\s*=|myOldMaidHand\.push|myOldMaidHand\.splice/);
});

test('the joker tension effect only reads my own private hand, never touches shared game state', () => {
  const app = read('public/app.js');
  assert.match(app, /function oldmaidShowJokerTension\(\)/);
  assert.match(app, /const drawnCard = data\?\.drawnOldMaidCard \|\| null;/);
  assert.match(app, /if \(drawnCard\.rank === 'JOKER'\) oldmaidShowJokerTension\(\);/);
  assert.match(app, /state\.me\.myOldMaidHand/);
  // must never write a joker/private flag onto the shared game object
  assert.doesNotMatch(app, /g\.joker/);
  assert.doesNotMatch(app, /game\.joker/);
});

test('an effects on/off toggle exists, persists to localStorage, and respects prefers-reduced-motion', () => {
  const app = read('public/app.js');
  const html = read('public/index.html');
  assert.match(html, /id="oldmaidEffectsToggle"/);
  assert.match(app, /function oldmaidReducedMotion\(\)/);
  assert.match(app, /window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/);
  assert.match(app, /function oldmaidEffectsActive\(\) \{ return oldmaidEffectsOn && !oldmaidReducedMotion\(\); \}/);
  assert.match(app, /localStorage\.setItem\('oldmaidEffects', oldmaidEffectsOn \? 'on' : 'off'\)/);
});

test('the table CSS is scoped to Old Maid seat/table classes and does not touch other games', () => {
  const css = read('public/styles.css');
  assert.match(css, /\.oldmaidTable\{/);
  assert.match(css, /\.oldmaidSeats\{/);
  assert.match(css, /\.oldmaidSeat\{/);
  assert.match(css, /\.oldmaidSeat\.me\{/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{[\s\S]*?\.oldmaidFlyingCard/);
});
