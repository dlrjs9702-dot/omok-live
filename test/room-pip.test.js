'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// v1.6.46: lets a player pop the ENTIRE room view -- board, chat, resign/end-game/next-round
// controls, everything -- out into a Document Picture-in-Picture window (the same browser feature
// YouTube's video PIP uses): always-on-top, freely movable/resizable by the OS window chrome,
// entirely opt-in and per-browser. The real #roomView element (with all its already-wired render/
// action logic intact) is reparented into the PIP window rather than duplicated, so no game or
// chat logic is copied or re-implemented for the popped-out state. First shipped as chat-only,
// then broadened the same session after the user pointed out resign/end-game/rematch controls
// live outside the chat pane and would otherwise be stranded in the docked (now-empty) panel.

test('the PIP toggle button lives in the room topbar and is feature-detected hidden by default', () => {
  const html = read('public/index.html');
  assert.match(html, /<button type="button" id="roomPipBtn" class="ghost pipToggleBtn hidden"/);
  const app = read('public/app.js');
  assert.match(app, /const roomPipSupported = 'documentPictureInPicture' in window;/);
  assert.match(app, /roomPipBtn\.classList\.toggle\('hidden', !roomPipSupported\)/);
});

test('a restore placeholder covers the room view\'s slot on the main page while popped out', () => {
  const html = read('public/index.html');
  assert.match(html, /<section id="roomPipPlaceholder" class="card lobbyCard hidden"/);
  assert.match(html, /<button type="button" id="roomPipRestoreBtn"/);
  const app = read('public/app.js');
  assert.match(app, /roomPipPlaceholder\?\.classList\.remove\('hidden'\)/);
  assert.match(app, /roomPipPlaceholder\?\.classList\.add\('hidden'\)/);
});

test('the PIP preference persists per-browser across rooms, independent of the window itself', () => {
  const app = read('public/app.js');
  assert.match(app, /const ROOM_PIP_KEY = 'roomPipPref';/);
  assert.match(app, /localStorage\.getItem\(ROOM_PIP_KEY\) === '1'/);
  const clickHandler = app.slice(app.indexOf("roomPipBtn?.addEventListener('click'"), app.indexOf("roomPipBtn?.addEventListener('click'") + 300);
  assert.match(clickHandler, /localStorage\.setItem\(ROOM_PIP_KEY, roomPipPref \? '1' : '0'\)/);
  // Bringing it back to the main screen via the placeholder button is the same "I don't want PIP
  // right now" signal as toggling it off, so it must clear the preference too -- otherwise the
  // very next room entered would silently try to pop out again.
  const restoreHandler = app.slice(app.indexOf("roomPipRestoreBtn?.addEventListener('click'"), app.indexOf("roomPipRestoreBtn?.addEventListener('click'") + 200);
  assert.match(restoreHandler, /roomPipPref = false;/);
});

test('opening PIP moves the entire real #roomView (not a copy) into the popped-out window and back on close', () => {
  const app = read('public/app.js');
  const openFn = app.slice(app.indexOf('async function openRoomPip()'), app.indexOf('function wideBoardGame()'));
  assert.match(openFn, /documentPictureInPicture\.requestWindow\(\{ width: 460, height: 760 \}\)/);
  assert.match(openFn, /pipWindow\.document\.body\.appendChild\(roomView\)/);
  assert.match(openFn, /pipWindow\.addEventListener\('pagehide'/);
  assert.match(openFn, /parent\.insertBefore\(roomView, next\)/);
  // A rejected/blocked request (no recent click) must never throw up to the caller or leave
  // roomPipWindow pointing at a half-open window -- it just silently stays closed.
  assert.match(openFn, /catch \{[\s\S]*roomPipWindow = null;/);
});

// v1.6.46 follow-up: the layout override first shipped as an injected <style> tag, which parses
// into the popup's DOM but is silently dropped by this page's own CSP (style-src 'self' has no
// 'unsafe-inline') -- confirmed live, the popup rendered the normal 2-column desktop grid
// regardless of the tag's content. Moved into styles.css as a real class instead.
test('the popped-out layout override lives in the real (CSP-safe) stylesheet, not an injected <style> tag', () => {
  const app = read('public/app.js');
  const openFn = app.slice(app.indexOf('async function openRoomPip()'), app.indexOf('function wideBoardGame()'));
  assert.doesNotMatch(openFn, /createElement\('style'\)/);
  assert.match(openFn, /pipWindow\.document\.documentElement\.classList\.add\('roomPipLayout'\)/);
  const css = read('public/styles.css');
  assert.match(css, /html\.roomPipLayout \.gameLayout\{display:flex!important;flex-direction:column/);
  assert.match(css, /html\.roomPipLayout \.side\{position:static!important;display:flex!important/);
  assert.match(css, /html\.roomPipLayout \.sideTabTools \.sideSizeGroup,html\.roomPipLayout #sideCollapseBtn\{display:none!important\}/);
  // #roomPipBtn itself must stay visible and functional inside the popup as its close control.
  assert.doesNotMatch(css, /#roomPipBtn\{display:none/);
});

test('leaving the room always closes any open PIP window; entering one only opens it if the preference is on', () => {
  const app = read('public/app.js');
  const enterLobbyFn = app.slice(app.indexOf('function enterLobby()'), app.indexOf('function enterRoomState('));
  assert.match(enterLobbyFn, /closeRoomPip\(\);/);
  const enterRoomFn = app.slice(app.indexOf('function enterRoomState('), app.indexOf('function stopStream()'));
  assert.match(enterRoomFn, /if \(roomPipPref && roomPipSupported && !roomPipActive\(\)\) openRoomPip\(\);/);
});

test('the chat pane counts as visible for unread-badge purposes while the whole room is popped out to PIP', () => {
  const app = read('public/app.js');
  const fn = app.slice(app.indexOf('function sideChatVisible()'), app.indexOf('function applySideLayout()'));
  assert.match(fn, /if \(roomPipActive\(\)\) return true;/);
});
