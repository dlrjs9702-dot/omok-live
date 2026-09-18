'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// v1.6.27 bound the sidebar's height to the board's *measured* rendered height via a
// ResizeObserver + CSS var, then clipped it with overflow:hidden. On tall boards (Land King's
// dense controls, Old Maid's v1.6.35 card table) that pushed the chat input off-screen entirely,
// because a position:sticky element taller than the viewport can't reveal its own bottom by
// scrolling. v1.6.35 replaces it: the sidebar's height is bounded purely by the viewport
// (max-height:calc(100vh - 32px)), independent of how tall the board's content is.
test('room-chat-height.js (the board-height-mirroring script) was removed', () => {
  assert.equal(fs.existsSync(path.join(root, 'public/room-chat-height.js')), false);
  const html = read('public/index.html');
  assert.doesNotMatch(html, /room-chat-height\.js/);
});

test('the sidebar is bounded by the viewport height, not the board\'s rendered height', () => {
  const css = read('public/styles.css');
  assert.doesNotMatch(css, /--room-board-height/);
  assert.match(css, /\.side\{[^}]*max-height:calc\(100vh - 32px\)/);
  assert.match(css, /\.side\{[^}]*overflow:hidden/);
});

test('the sidebar is split into chat / system / room-info tabs', () => {
  const html = read('public/index.html');
  assert.match(html, /id="roomSidebar"/);
  assert.match(html, /data-side-tab="chat"/);
  assert.match(html, /data-side-tab="system"/);
  assert.match(html, /data-side-tab="info"/);
  assert.match(html, /data-side-pane="chat"/);
  assert.match(html, /data-side-pane="system"[\s\S]{0,80}id="systemMessages"/);
  assert.match(html, /data-side-pane="info"[\s\S]{0,400}id="participantList"/);
  // The room-info tab reuses the existing participant list and rules markup, it does not
  // duplicate them.
  assert.equal((html.match(/id="participantList"/g) || []).length, 1);
});

test('the app reuses the single existing chat message list, split client-side by the existing type field', () => {
  const app = read('public/app.js');
  // lib/room-social.js already tags every stored message with type: 'chat' | 'system' -- v1.6.35
  // reuses that field instead of inventing a new one.
  assert.match(app, /chatRows = rows\.filter\(row => row\.type !== 'system'\)/);
  assert.match(app, /systemRows = rows\.filter\(row => row\.type === 'system'\)/);
  assert.match(app, /fillMessageList\(chatMessages, chatRows/);
  assert.match(app, /fillMessageList\(systemMessages, systemRows/);
});

test('room-social message rows already carry a chat/system type, reused as-is (no new schema)', () => {
  const social = read('lib/room-social.js');
  assert.match(social, /type: message\.type === 'system' \? 'system' : 'chat'/);
});

test('chat auto-scrolls only when the reader was already at the bottom, and never force-scrolls a reader browsing history', () => {
  const app = read('public/app.js');
  assert.match(app, /const wasAtBottom = chatAtBottom;/);
  assert.match(app, /if \(wasAtBottom\) \{\s*chatMessages\.scrollTop = chatMessages\.scrollHeight;/);
  assert.match(app, /Otherwise leave scrollTop untouched/);
  assert.match(app, /chatJumpBtn/);
});

test('a floating chat button with an unread badge is always present, independent of the docked sidebar', () => {
  const html = read('public/index.html');
  assert.match(html, /id="chatFloatBtn" class="chatFloatBtn hidden"/);
  assert.match(html, /id="chatFloatBadge" class="chatFloatBadge hidden"/);
  const css = read('public/styles.css');
  assert.match(css, /\.chatFloatBtn\{position:fixed/);
  const app = read('public/app.js');
  assert.match(app, /function updateChatBadges\(\)/);
  assert.match(app, /chatFloatBadge\.textContent/);
});

test('the chat overlay repositions the same chat panel over the game instead of creating a second chat system', () => {
  const html = read('public/index.html');
  // Exactly one #chatMessages / #chatInput / #chatForm in the whole page -- the overlay is the
  // same node shown via a CSS class, not a duplicate.
  assert.equal((html.match(/id="chatMessages"/g) || []).length, 1);
  assert.equal((html.match(/id="chatInput"/g) || []).length, 1);
  assert.equal((html.match(/id="chatForm"/g) || []).length, 1);
  const css = read('public/styles.css');
  assert.match(css, /\.side\.overlayOpen\{position:fixed/);
  const app = read('public/app.js');
  assert.match(app, /function toggleSideOverlay\(forceOpen\)/);
});

test('Land King and Old Maid default the sidebar to collapsed so the board gets priority width, other games do not', () => {
  const app = read('public/app.js');
  assert.match(app, /function wideBoardGame\(\) \{ return state\?\.gameType === 'cityking' \|\| state\?\.gameType === 'oldmaid'; \}/);
  assert.match(app, /function sideShouldCollapse\(\) \{\s*if \(sideCollapsedPref !== null\) return sideCollapsedPref;\s*return wideBoardGame\(\);/);
  // A user's manual collapse/expand choice always overrides the per-game default.
  assert.match(app, /sideCollapsedPref = !sideShouldCollapse\(\);/);
  assert.match(app, /localStorage\.setItem\(SIDE_COLLAPSE_KEY/);
});

test('on mobile the sidebar is never docked inline; chat/system/room-info are only reachable via the overlay', () => {
  const css = read('public/styles.css');
  assert.match(css, /@media\(max-width:880px\)\{\.lobbyGrid,\.gameLayout\{grid-template-columns:1fr\}[\s\S]*?\.side\{position:static;display:none/);
  assert.match(css, /\.side\.overlayOpen\{display:flex\}/);
});

test('a PC-only three-preset chat width control exists and never breaks the board grid', () => {
  const html = read('public/index.html');
  assert.match(html, /data-side-size="narrow"/);
  assert.match(html, /data-side-size="normal"/);
  assert.match(html, /data-side-size="wide"/);
  const css = read('public/styles.css');
  assert.match(css, /\.gameLayout\.sideNarrow\{--side-w:280px\}/);
  assert.match(css, /\.gameLayout\.sideWide\{--side-w:460px\}/);
  assert.match(css, /@media\(max-width:880px\)\{[\s\S]*?\.sideSizeGroup\{display:none\}/);
});
