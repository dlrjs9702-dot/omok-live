'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// v1.6.72 keeps the useful part of board-height matching (a short game should not have a
// sidebar hanging far below it), but fixes the original failure mode by hard-capping the measured
// height to the actual viewport space remaining below the room header.
test('room sidebar height sync is integrated in app.js and needs no extra height script', () => {
  assert.equal(fs.existsSync(path.join(root, 'public/room-chat-height.js')), false);
  const html = read('public/index.html');
  assert.doesNotMatch(html, /room-chat-height\.js/);
  const app = read('public/app.js');
  assert.match(app, /function syncRoomSideHeight\(\)/);
  assert.match(app, /new ResizeObserver\(scheduleRoomSideHeightSync\)/);
  assert.match(app, /Math\.min\(boardHeight \|\| viewportBudget, viewportBudget\)/);
});

test('the docked sidebar uses the measured minimum height and collapses its phantom grid height', () => {
  const css = read('public/styles.css');
  assert.match(css, /\.sideColumn\{[^}]*height:var\(--room-side-height/);
  assert.match(css, /\.sideColumn\{[^}]*height:auto;min-height:var\(--room-side-height/);
  assert.match(css, /\.sideColumn\{[^}]*max-height:none/);
  assert.match(css, /\.gameLayout\.sideCollapsed \.sideColumn\{height:0;min-height:0;max-height:0;overflow:hidden;gap:0\}/);
  assert.match(css, /@media\(max-width:880px\)\{\.sideColumn\{position:static;height:auto;min-height:0;max-height:none\}\}/);
});

// v1.6.58: chat is now its own single-pane panel (#chatPanel, no tabs -- it only ever shows one
// thing). System/room-info stayed a tab pair, now inside the separate "게임 진행" panel
// (#gameInfoPanel) alongside the dice/yut stage and every game's own action controls.
test('chat is a standalone single-pane panel; system/room-info stayed a tab pair inside #gameInfoPanel', () => {
  const html = read('public/index.html');
  assert.match(html, /id="chatPanel"/);
  assert.match(html, /id="gameInfoPanel"/);
  assert.doesNotMatch(html, /data-side-tab="chat"/);
  assert.match(html, /data-side-tab="system"/);
  assert.match(html, /data-side-tab="info"/);
  const chatMarkup = html.slice(html.indexOf('id="chatPanel"'), html.indexOf('id="gameInfoPanel"'));
  assert.match(chatMarkup, /id="chatMessages"/);
  assert.doesNotMatch(chatMarkup, /data-side-pane=/);
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
  assert.match(app, /function toggleChatOverlay\(forceOpen\)/);
});

// v1.6.56: Land King and Old Maid used to default the sidebar to collapsed (to give their wide
// boards more room), back when the sidebar was optional for actually playing them. Now that
// #gameActionsPanel (start/roll/buy/build etc.) lives inside #gameInfoPanel for every game
// including these two, collapsing it by default would hide controls a host needs just to start
// the game -- so no game defaults to collapsed anymore. v1.6.58 split the single collapse
// preference into two independent ones (chat vs. 게임 진행), both still defaulting to open.
test('neither panel defaults to collapsed, since every game now needs #gameActionsPanel there', () => {
  const app = read('public/app.js');
  assert.doesNotMatch(app, /function wideBoardGame\(\)/);
  assert.match(app, /function chatShouldCollapse\(\) \{ return chatCollapsedPref === true; \}/);
  assert.match(app, /function gameInfoShouldCollapse\(\) \{ return gameInfoCollapsedPref === true; \}/);
  // A user's manual collapse/expand choice still overrides the (now-uniform) default, per panel.
  assert.match(app, /chatCollapsedPref = !chatShouldCollapse\(\);/);
  assert.match(app, /localStorage\.setItem\(CHAT_COLLAPSE_KEY/);
  assert.match(app, /gameInfoCollapsedPref = !gameInfoShouldCollapse\(\);/);
  assert.match(app, /localStorage\.setItem\(GAME_INFO_COLLAPSE_KEY/);
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

// v1.6.72 regression: the old fixed full-viewport column forced an unnecessary page
// scrollbar below the room header. The column still receives the measured board height as a
// minimum, but complex game controls may grow naturally instead of being clipped into a nested
// action scrollbar.
test('the docked column no longer hard-codes a full viewport below the already-rendered room header', () => {
  const css = read('public/styles.css');
  assert.doesNotMatch(css, /\.sideColumn\{[^}]*height:calc\(100vh - 32px\)/);
  assert.match(css, /\.sideColumn>\.side\{position:static;flex:0 0 auto;min-height:0;max-height:none\}/);
  const app = read('public/app.js');
  assert.match(app, /const viewportBudget = Math\.max\(1, viewportHeight - Math\.max\(layoutTop, stickyGap\) - stickyGap\)/);
  assert.match(app, /sideColumnEl\.style\.setProperty\('--room-side-height'/);
});

test('every game keeps controls in one flow while system history owns the only inner scroll', () => {
  const css = read('public/styles.css');
  assert.match(css, /\.sideColumn\{[^}]*height:auto;min-height:var\(--room-side-height/);
  assert.match(css, /\.side \.gameActionsPanel\{flex:0 0 auto;min-height:0;[^}]*max-height:none;overflow:visible/);
  assert.match(css, /\.sidePane\{display:flex;flex-direction:column;flex:0 0 auto;min-height:0\}/);
  assert.match(css, /\.systemMessages\{flex:0 1 180px;min-height:120px;max-height:180px;overflow-y:auto\}/);
  assert.match(css, /\.side\.overlayOpen#gameInfoPanel\{overflow-y:auto\}/);
  assert.match(css, /html\.sidePipLayout #gameInfoPanel\{overflow-y:auto!important\}/);
});

test('twenty questions history flows with the game page instead of adding a nested scrollbar', () => {
  const css = read('public/styles.css');
  assert.match(css, /\.twentyQuestionLog\{[^}]*max-height:none;overflow:visible\}/);
  assert.doesNotMatch(css, /\.twentyQuestionLog\{[^}]*overflow-y:auto/);
});
