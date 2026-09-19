'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// v1.6.46: lets a player pop the room chat out into a Document Picture-in-Picture window (the
// same browser feature YouTube's video PIP uses) -- always-on-top, freely movable/resizable by
// the OS window chrome, entirely opt-in and per-browser. The real #chatSidePane element (with its
// already-wired render/send listeners) is reparented into the PIP window rather than duplicated,
// so no chat logic is copied or re-implemented for the popped-out state.

test('the chat side pane carries a stable id so it can be reparented into a PIP window', () => {
  const html = read('public/index.html');
  assert.match(html, /<section class="sidePane" data-side-pane="chat" id="chatSidePane"/);
});

test('the PIP toggle button is feature-detected and hidden by default for unsupported browsers', () => {
  const html = read('public/index.html');
  assert.match(html, /<button type="button" id="chatPipBtn" class="chatPipBtn hidden"/);
  const app = read('public/app.js');
  assert.match(app, /const chatPipSupported = 'documentPictureInPicture' in window;/);
  assert.match(app, /chatPipBtn\.classList\.toggle\('hidden', !chatPipSupported\)/);
});

test('the PIP preference persists per-browser across rooms, independent of the window itself', () => {
  const app = read('public/app.js');
  assert.match(app, /const CHAT_PIP_KEY = 'roomChatPipPref';/);
  assert.match(app, /localStorage\.getItem\(CHAT_PIP_KEY\) === '1'/);
  const clickHandler = app.slice(app.indexOf("chatPipBtn?.addEventListener('click'"), app.indexOf("chatPipBtn?.addEventListener('click'") + 300);
  assert.match(clickHandler, /localStorage\.setItem\(CHAT_PIP_KEY, chatPipPref \? '1' : '0'\)/);
});

test('opening PIP moves the real chat pane (not a copy) into the popped-out window and back on close', () => {
  const app = read('public/app.js');
  const openFn = app.slice(app.indexOf('async function openChatPip()'), app.indexOf('function wideBoardGame()'));
  assert.match(openFn, /documentPictureInPicture\.requestWindow\(\{ width: 360, height: 480 \}\)/);
  assert.match(openFn, /pipWindow\.document\.body\.appendChild\(chatSidePane\)/);
  assert.match(openFn, /pipWindow\.addEventListener\('pagehide'/);
  assert.match(openFn, /parent\.insertBefore\(chatSidePane, next\)/);
  // A rejected/blocked request (no recent click) must never throw up to the caller or leave
  // chatPipWindow pointing at a half-open window -- it just silently stays closed.
  assert.match(openFn, /catch \{[\s\S]*chatPipWindow = null;/);
});

test('leaving the room always closes any open PIP window; entering one only opens it if the preference is on', () => {
  const app = read('public/app.js');
  const enterLobbyFn = app.slice(app.indexOf('function enterLobby()'), app.indexOf('function enterRoomState('));
  assert.match(enterLobbyFn, /closeChatPip\(\);/);
  const enterRoomFn = app.slice(app.indexOf('function enterRoomState('), app.indexOf('function stopStream()'));
  assert.match(enterRoomFn, /if \(chatPipPref && chatPipSupported && !chatPipActive\(\)\) openChatPip\(\);/);
});

test('the chat pane counts as visible for unread-badge purposes while popped out to PIP', () => {
  const app = read('public/app.js');
  const fn = app.slice(app.indexOf('function sideChatVisible()'), app.indexOf('function applySideLayout()'));
  assert.match(fn, /if \(chatPipActive\(\)\) return true;/);
});
