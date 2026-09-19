'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// v1.6.36: the floating chat button used to stay visible (and visually collide with the chat
// form's own send button) while the overlay was already open, and its aria-label/"isOpen" state
// implied it doubled as a close control there. It no longer does either -- the overlay's own
// tab-bar button is the one, unambiguous close affordance.
test('the floating chat button hides while the overlay is open, instead of colliding with the overlay\'s own controls', () => {
  const app = read('public/app.js');
  assert.match(app, /chatFloatBtn\.classList\.toggle\('hidden', sideOverlayOpen \|\| !\(mobile \|\| collapsed\)\)/);
  assert.match(app, /chatFloatBtn\.setAttribute\('aria-label', '채팅 열기'\)/);
});

test('the sidebar\'s collapse button becomes an unambiguous close button while the overlay is open, and never silently changes the docked preference', () => {
  const app = read('public/app.js');
  assert.match(app, /sideCollapseBtn\.textContent = sideOverlayOpen \? '닫기 ✕'/);
  const handler = app.slice(app.indexOf("sideCollapseBtn.addEventListener('click'"), app.indexOf("sideCollapseBtn.addEventListener('click'") + 400);
  assert.match(handler, /if \(sideOverlayOpen\)/);
  assert.match(handler, /sideOverlayOpen = false;/);
  assert.match(handler, /return;/);
});

// v1.6.36: applySideLayout() used to mark chat as "seen" purely because the chat pane was the
// active/visible pane, even while the reader had scrolled away from the bottom to read history.
// A message arriving mid-read would immediately zero out the unread badge before it was ever
// actually seen. It's now gated on chatAtBottom too.
test('the unread badge only auto-clears when the reader is actually at the bottom of the chat pane', () => {
  const app = read('public/app.js');
  assert.match(app, /if \(sideChatVisible\(\) && chatAtBottom\) markChatSeen\(\);/);
  // The scroll handler's own (already chatAtBottom-gated) call is fine; applySideLayout's
  // trailing call is specifically the one that used to fire unconditionally.
  const applySideLayoutBody = app.slice(app.indexOf('function applySideLayout()'), app.indexOf('function setSideTab('));
  assert.doesNotMatch(applySideLayoutBody, /if \(sideChatVisible\(\)\) markChatSeen\(\);/);
});

// v1.6.36: a stray media-query collision made Land King's action buttons render ~150px tall on
// narrow phones (flex-basis applies to the main axis, which becomes height once the row flips to
// flex-direction:column at <=520px), which is also what caused the floating chat button to
// visually collide with the "랜드킹 시작" button on first load. min-width isn't direction-sensitive.
test('Land King action buttons never gain an explicit height from a narrow-viewport flex-basis rule', () => {
  const css = read('public/styles.css');
  // The v1.6.36 fix removed the buggy flex:1 1 150px rule; v1.6.37 moved the action row into the
  // central board panel entirely, so neither the old buggy selector nor its narrow-width variant
  // should reappear (min-width is direction-agnostic and doesn't have this bug).
  assert.doesNotMatch(css, /\.cityActionRow button\{flex:1 1 150px\}/);
  assert.doesNotMatch(css, /\.cityBuyRow button\{flex:1 1 120px\}/);
});

test('focusing the chat input nudges it into view for the mobile keyboard', () => {
  const app = read('public/app.js');
  assert.match(app, /chatInput\.addEventListener\('focus', \(\) => \{/);
  assert.match(app, /chatInput\.scrollIntoView\(/);
});

test('room-info tab shows only the room title, participants and rules -- no room password', () => {
  const html = read('public/index.html');
  const infoSection = html.slice(html.indexOf('data-side-pane="info"'), html.indexOf('</section>', html.indexOf('data-side-pane="info"')));
  assert.doesNotMatch(infoSection, /hostRoomCode|roomSecret/);
});
