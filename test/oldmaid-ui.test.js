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

// v1.6.35 first arranged seats around a circular table; v1.6.50 replaced that with a responsive
// grid; v1.6.54 dropped the max player count 6->4 and replaced the responsive grid with a fixed
// 동서남북 compass cross, since only opponents are ever grid cells now ("나" is represented by the
// sticky "내 손패" dock, not a seat cell) -- opponents are still ordered relative to my own seat,
// not in raw server roster order.
test('opponents are ordered relative to my own seat on a fixed compass cross, not in server roster order', () => {
  const app = read('public/app.js');
  const css = read('public/styles.css');
  assert.match(app, /function oldmaidRotatedSeats\(order, anchorSeat\)/);
  assert.match(app, /const rotated = oldmaidRotatedSeats\(rosterSeats, iAmSeated \? seat : null\)/);
  assert.match(app, /const opponents = iAmSeated \? rotated\.slice\(1\) : rotated;/);
  assert.match(css, /\.oldmaidSeats\{[^}]*grid-template-areas:"\. north \." "west \. east"/);
  // opponent cards wrap onto more lines instead of needing a horizontal scrollbar
  assert.match(css, /\.oldmaidSeatCards\{display:flex;flex-wrap:wrap/);
  assert.doesNotMatch(css, /\.oldmaidSeatCards\{[^}]*overflow-x:auto/);
});

test('a player who empties their hand keeps their seat instead of being removed from the table', () => {
  const app = read('public/app.js');
  assert.match(app, /const escaped = g\.status !== 'selecting' && count === 0 && !isLoser;/);
  assert.match(app, /opponents\.forEach\(\(number, index\) => \{/);
  // escaped seats stay rendered with a badge, they are not filtered out of the seat list
  assert.doesNotMatch(app, /opponents\.filter\(/);
});

test('opponent cards are always rendered face-down; only my own hand shows card faces', () => {
  const app = read('public/app.js');
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
  assert.match(app, /oldmaidDrawCard\(number, cardIndex, button\);/);
});

test('the draw flight animation and pair/escape effects are purely cosmetic and never gate the real state update', () => {
  const app = read('public/app.js');
  assert.match(app, /await roomAction\('draw-oldmaid', \{ targetSeat, index, expectedRevision: g\.revision \}\);/);
  assert.match(app, /function oldmaidFlyDrawnCard\(originRect, card, destRect\)/);
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
  const flyIndex = drawFn.indexOf('oldmaidFlyDrawnCard(originRect, drawnCard, destRect)');
  assert.ok(awaitIndex >= 0 && flyIndex >= 0 && flyIndex > awaitIndex,
    'the flight must be triggered only after the draw request has resolved, not before it');
  // v1.6.45: the drawn card's identity now comes straight from the server response, not from
  // diffing beforeHand/afterHand -- a draw that immediately completes a pair removes that same
  // card from the hand again before the response ever reaches the client, so the old diff could
  // never recover it and silently skipped the animation on every such pair (non-joker cards pair
  // often; the joker never does, which is why only joker draws visibly animated before this fix).
  assert.match(drawFn, /const drawnCard = data\?\.drawnOldMaidCard \|\| null;/);
  // v1.6.53: lands on the real drawn card's own element (found by data-card-id), not the whole
  // hand container -- otherwise the ghost could fly toward an empty stretch of the container while
  // the actual new card sat elsewhere in the row, so the landing looked like it vanished into
  // empty space instead of visibly landing among the real hand cards.
  assert.match(drawFn, /const targetEl = oldmaidMyHand\.querySelector\(`\[data-card-id="\$\{CSS\.escape\(String\(drawnCard\.id\)\)\}"\]`\);/);
  assert.match(drawFn, /const destRect = \(targetEl \|\| oldmaidMyHand\)\.getBoundingClientRect\(\);/);
  assert.match(app, /flyer\.className = 'oldmaidCard oldmaidFace oldmaidFlyingCard' \+ oldmaidCardFaceClass\(card\);/);
});

// v1.6.52: a completed pair now glows and fades the actual matching cards inside "내 손패" (found
// by data-cardId), not separate floating clones -- so it reads as "drawn card enters the hand,
// then (if it matches) glows with its partner and both fade", instead of two disconnected effects.
// The intermediate render (drawn card shown before any pair is removed) is purely a local display
// choice for the animation to land against; the real hand array (state.me.myOldMaidHand) itself is
// never written to by any of this.
test('a completed pair glows and fades the real hand cards in place, and never mutates the real hand array', () => {
  const app = read('public/app.js');
  const drawFn = app.slice(app.indexOf('async function oldmaidDrawCard'), app.indexOf('async function oldmaidUsePeek'));
  assert.match(drawFn, /const removedCards = \[\.\.\.beforeHand, drawnCard\]\.filter\(card => !afterIds\.has\(card\.id\)\);/);
  assert.match(drawFn, /const completesPair = removedCards\.length >= 2;/);
  assert.match(drawFn, /if \(completesPair\) oldmaidRenderMyHandFaces\(\[\.\.\.beforeHand, drawnCard\]\);/);
  assert.match(drawFn, /await oldmaidGlowAndRemovePair\(removedCards\);/);
  assert.match(drawFn, /oldmaidRenderMyHandFaces\(afterHand\);/);
  assert.match(app, /function oldmaidGlowAndRemovePair\(removedCards\)/);
  const glowFn = app.slice(app.indexOf('function oldmaidGlowAndRemovePair'), app.indexOf('async function oldmaidDrawCard'));
  assert.doesNotMatch(glowFn, /myOldMaidHand\s*=|myOldMaidHand\.push|myOldMaidHand\.splice/);
  assert.match(glowFn, /el\.classList\.add\('pairGlow'\)/);
  assert.match(glowFn, /el\.classList\.add\('pairFadeOut'\)/);
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

// v1.6.51: previously the checkbox was silently AND-ed with the browser/OS's own
// prefers-reduced-motion setting, so a player with that accessibility setting on could never see
// effects even with the checkbox checked, with no indication why. A user confirmed this should be
// an explicit in-app opt-in that overrides the system default, so the checkbox is now the sole
// source of truth -- system reduced-motion no longer silently vetoes it.
test('an effects on/off toggle exists, persists to localStorage, and is the sole source of truth (system reduced-motion no longer silently overrides it)', () => {
  const app = read('public/app.js');
  const html = read('public/index.html');
  assert.match(html, /id="oldmaidEffectsToggle"/);
  assert.match(app, /function oldmaidEffectsActive\(\) \{ return oldmaidEffectsOn; \}/);
  assert.doesNotMatch(app, /oldmaidEffectsOn && !oldmaidReducedMotion\(\)/);
  assert.match(app, /localStorage\.setItem\('oldmaidEffects', oldmaidEffectsOn \? 'on' : 'off'\)/);
});

test('the seat grid CSS is scoped to Old Maid seat classes and does not touch other games', () => {
  const css = read('public/styles.css');
  assert.match(css, /\.oldmaidSeats\{/);
  assert.match(css, /\.oldmaidSeat\{/);
  assert.match(css, /\.oldmaidSeat\[data-compass="north"\]\{grid-area:north\}/);
  assert.match(css, /\.oldmaidSeat\[data-compass="east"\]\{grid-area:east\}/);
  assert.match(css, /\.oldmaidSeat\[data-compass="west"\]\{grid-area:west\}/);
});

// v1.6.50: "내 손패" is pinned to the bottom of the viewport (position:sticky) so it's always
// visible regardless of player count or hand sizes -- this is also the draw-flight animation's
// destination, so pinning it fixes the animation landing off-screen too (the bug this was
// diagnosed from: a tall opponent grid could push "내 손패" below the fold entirely).
test('"내 손패" is pinned to the bottom of the viewport so it and the draw-flight destination are always visible', () => {
  const html = read('public/index.html');
  const css = read('public/styles.css');
  const dockMarkup = html.slice(html.indexOf('class="oldmaidHandDock"'), html.indexOf('</section>', html.indexOf('class="oldmaidHandDock"')));
  assert.match(dockMarkup, /id="oldmaidMyHand"/);
  assert.match(css, /\.oldmaidHandDock\{position:sticky;bottom:0/);
});
