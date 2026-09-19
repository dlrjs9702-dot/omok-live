'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// v1.6.46 popped out chat alone; a v1.6.47 attempt popped out the entire room (board included),
// which the user immediately corrected: only the sidebar -- chat, system messages, room info, and
// the resign/end-game/next-round actions that live in the same <aside> -- should leave, never the
// board or topbar. This is that corrected v1.6.48 shape. The real #roomSidebar element (with all
// its already-wired render/action logic intact) is reparented into a Document Picture-in-Picture
// window rather than duplicated, so no game or chat logic is copied or re-implemented for the
// popped-out state.

test('the PIP toggle button lives in the sidebar tab tools and is feature-detected hidden by default', () => {
  const html = read('public/index.html');
  assert.match(html, /<button type="button" id="roomPipBtn" class="pipToggleBtn hidden"/);
  // Must sit inside the sidebar (so it travels with it into the popup), not the room topbar.
  const sidebarMarkup = html.slice(html.indexOf('id="roomSidebar"'), html.indexOf('id="chatMessages"'));
  assert.match(sidebarMarkup, /id="roomPipBtn"/);
  const app = read('public/app.js');
  assert.match(app, /const roomPipSupported = 'documentPictureInPicture' in window;/);
  assert.match(app, /roomPipBtn\.classList\.toggle\('hidden', !roomPipSupported\)/);
});

test('the PIP preference persists per-browser across rooms, independent of the window itself', () => {
  const app = read('public/app.js');
  assert.match(app, /const ROOM_PIP_KEY = 'roomPipPref';/);
  assert.match(app, /localStorage\.getItem\(ROOM_PIP_KEY\) === '1'/);
  const clickHandler = app.slice(app.indexOf("roomPipBtn?.addEventListener('click'"), app.indexOf("roomPipBtn?.addEventListener('click'") + 300);
  assert.match(clickHandler, /localStorage\.setItem\(ROOM_PIP_KEY, roomPipPref \? '1' : '0'\)/);
});

test('opening PIP moves the real #roomSidebar (not a copy, and never the board) into the popped-out window and back on close', () => {
  const app = read('public/app.js');
  const openFn = app.slice(app.indexOf('async function openRoomPip()'), app.indexOf('function wideBoardGame()'));
  assert.match(openFn, /documentPictureInPicture\.requestWindow\(\{ width: 400, height: 680 \}\)/);
  assert.match(openFn, /pipWindow\.document\.body\.appendChild\(roomSidebar\)/);
  assert.doesNotMatch(openFn, /appendChild\(roomView\)/);
  assert.match(openFn, /pipWindow\.addEventListener\('pagehide'/);
  assert.match(openFn, /parent\.insertBefore\(roomSidebar, next\)/);
  // A rejected/blocked request (no recent click) must never throw up to the caller or leave
  // roomPipWindow pointing at a half-open window -- it just silently stays closed.
  assert.match(openFn, /catch \{[\s\S]*roomPipWindow = null;/);
});

test('the resign/end-game/next-round buttons travel with the sidebar since they already live inside it', () => {
  const html = read('public/index.html');
  const sidebarMarkup = html.slice(html.indexOf('<aside class="side card" id="roomSidebar">'), html.indexOf('</aside>'));
  assert.match(sidebarMarkup, /id="sideResignBtn"/);
  assert.match(sidebarMarkup, /id="sideEndGameBtn"/);
  assert.match(sidebarMarkup, /id="sideNextRoundBtn"/);
});

// v1.6.47 follow-up bug, still relevant here: a layout override injected as a <style> tag parses
// into the popup's DOM but is silently dropped by this page's own CSP (style-src 'self' has no
// 'unsafe-inline') -- confirmed live via computed styles, not just a screenshot. Moved into
// styles.css as a real class instead, and that lesson carries over to this corrected version.
test('the popped-out layout override lives in the real (CSP-safe) stylesheet, not an injected <style> tag', () => {
  const app = read('public/app.js');
  const openFn = app.slice(app.indexOf('async function openRoomPip()'), app.indexOf('function wideBoardGame()'));
  assert.doesNotMatch(openFn, /createElement\('style'\)/);
  assert.match(openFn, /pipWindow\.document\.documentElement\.classList\.add\('sidePipLayout'\)/);
  const css = read('public/styles.css');
  assert.match(css, /html\.sidePipLayout \.side\{display:flex!important;position:static!important/);
  assert.match(css, /html\.sidePipLayout \.sideTabTools \.sideSizeGroup,html\.sidePipLayout #sideCollapseBtn\{display:none!important\}/);
  // #roomPipBtn itself must stay visible and functional inside the popup as its close control.
  assert.doesNotMatch(css, /#roomPipBtn\{display:none/);
});

test('the board expands to full width and the floating chat bubble hides while the sidebar is popped out', () => {
  const app = read('public/app.js');
  const fn = app.slice(app.indexOf('function applySideLayout()'), app.indexOf('function setSideTab('));
  assert.match(fn, /const pipActive = roomPipActive\(\);/);
  assert.match(fn, /gameLayoutEl\.classList\.toggle\('sideCollapsed', pipActive \|\| /);
  assert.match(fn, /chatFloatBtn\.classList\.toggle\('hidden', pipActive \|\| /);
});

test('leaving the room always closes any open PIP window; entering one only opens it if the preference is on', () => {
  const app = read('public/app.js');
  const enterLobbyFn = app.slice(app.indexOf('function enterLobby()'), app.indexOf('function enterRoomState('));
  assert.match(enterLobbyFn, /closeRoomPip\(\);/);
  const enterRoomFn = app.slice(app.indexOf('function enterRoomState('), app.indexOf('function stopStream()'));
  assert.match(enterRoomFn, /if \(roomPipPref && roomPipSupported && !roomPipActive\(\)\) openRoomPip\(\);/);
});

test('the chat pane counts as visible for unread-badge purposes while the sidebar is popped out to PIP', () => {
  const app = read('public/app.js');
  const fn = app.slice(app.indexOf('function sideChatVisible()'), app.indexOf('function applySideLayout()'));
  assert.match(fn, /if \(roomPipActive\(\)\) return true;/);
});

// Bug reported after v1.6.48 shipped: the popup's own narrow requested width (400px) falls under
// the site's <880px mobile breakpoint, which hides .sideActions entirely (mobile relies on a
// separate .mobileActions bar near the board instead, which the sidebar-only popup doesn't have) --
// so 기권하기/다음 판 준비/중단된 대국 종료 silently vanished inside the popup. Fixed by forcing it visible.
test('the resign/end-game/next-round action row stays visible inside the PIP popup despite its narrow width', () => {
  const css = read('public/styles.css');
  assert.match(css, /html\.sidePipLayout \.sideActions\{display:grid!important\}/);
});

// Requested follow-up: inside the popup, the tab bar/close button (top) and chat input (bottom)
// should stay fixed while only the middle message list scrolls -- the same behavior the docked
// sidebar already has via .side{overflow:hidden} + .sidePane{flex:1 1 auto;min-height:0} +
// .chatMessages{overflow-y:auto}. That only works if .side itself has a bounded height; an earlier
// cut of this override set height:auto (unbounded), which broke it into a whole-popup-page scroll.
test('the PIP popup keeps .side height-bounded so only the chat message list scrolls, not the whole popup', () => {
  const css = read('public/styles.css');
  assert.match(css, /html\.sidePipLayout \.side\{display:flex!important;position:static!important;width:100%;height:100%\}/);
  assert.doesNotMatch(css, /html\.sidePipLayout \.side\{[^}]*height:auto/);
  assert.doesNotMatch(css, /html\.sidePipLayout \.side\{[^}]*max-height:none/);
  assert.match(css, /html\.sidePipLayout,html\.sidePipLayout body\{margin:0;height:100%;background:#0b1220;overflow:hidden\}/);
});
