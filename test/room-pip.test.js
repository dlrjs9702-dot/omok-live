'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// v1.6.46 popped out chat alone; a v1.6.47 attempt popped out the entire room (board included),
// which the user immediately corrected: only the sidebar should leave, never the board or topbar.
// v1.6.57 gave the dice/yut panel its own separate native PIP button -- but a browser only ever
// allows ONE Document Picture-in-Picture window open at a time (system-wide, not per-tab), so
// opening one silently closed the other, which read as things randomly vanishing rather than a
// real second window. v1.6.58 split the old single #roomSidebar into two independent cards --
// #chatPanel (chat only) and #gameInfoPanel (system/room-info tabs, the dice/yut stage, every
// game's own #gameActionsPanel controls, and 기권/재대결/종료) -- but giving BOTH their own native
// PIP button meant they still fought each other the moment a player wanted both floating at once.
// v1.6.59 is the real fix: #gameInfoPanel keeps the true native `documentPictureInPicture` window
// (openGameInfoPip, "always on top of everything"); #chatPanel instead opens as a regular
// `window.open()` secondary window (openChatPip) -- a different browser mechanism with no
// "one at a time" limit, so both can be open at the exact same moment. The trade-off is explicit
// in its own UI text ("별도 창으로 보기", never "PIP") since it doesn't float above other windows.

test('each panel has its own toggle button in its own tab tools, feature-detected hidden by default', () => {
  const html = read('public/index.html');
  assert.match(html, /<button type="button" id="chatPipBtn" class="pipToggleBtn hidden"/);
  assert.match(html, /<button type="button" id="gameInfoPipBtn" class="pipToggleBtn hidden"/);
  // Each button must sit inside its own panel (so it travels with that panel into its own popup).
  const chatMarkup = html.slice(html.indexOf('id="chatPanel"'), html.indexOf('id="gameInfoPanel"'));
  assert.match(chatMarkup, /id="chatPipBtn"/);
  const gameInfoMarkup = html.slice(html.indexOf('id="gameInfoPanel"'), html.indexOf('id="chatFloatBtn"'));
  assert.match(gameInfoMarkup, /id="gameInfoPipBtn"/);
  const app = read('public/app.js');
  // Chat's button is universally supported (window.open, not a Chromium-only API); game-info's
  // stays feature-detected on the native PIP API.
  assert.match(app, /const chatPipSupported = typeof window\.open === 'function';/);
  assert.match(app, /const gameInfoPipSupported = 'documentPictureInPicture' in window;/);
  assert.match(app, /chatPipBtn\.classList\.toggle\('hidden', !chatPipSupported\)/);
  assert.match(app, /gameInfoPipBtn\.classList\.toggle\('hidden', !gameInfoPipSupported\)/);
});

test('each PIP preference persists per-browser across rooms, independent of the window itself', () => {
  const app = read('public/app.js');
  assert.match(app, /const CHAT_PIP_KEY = 'chatPipPref';/);
  assert.match(app, /localStorage\.getItem\(CHAT_PIP_KEY\) === '1'/);
  assert.match(app, /const GAME_INFO_PIP_KEY = 'gameInfoPipPref';/);
  assert.match(app, /localStorage\.getItem\(GAME_INFO_PIP_KEY\) === '1'/);
  const chatClick = app.slice(app.indexOf("chatPipBtn?.addEventListener('click'"), app.indexOf("chatPipBtn?.addEventListener('click'") + 300);
  assert.match(chatClick, /localStorage\.setItem\(CHAT_PIP_KEY, chatPipPref \? '1' : '0'\)/);
  const gameInfoClick = app.slice(app.indexOf("gameInfoPipBtn?.addEventListener('click'"), app.indexOf("gameInfoPipBtn?.addEventListener('click'") + 300);
  assert.match(gameInfoClick, /localStorage\.setItem\(GAME_INFO_PIP_KEY, gameInfoPipPref \? '1' : '0'\)/);
});

test('opening chat\'s separate window moves the real #chatPanel (not a copy, and never the board) via window.open, and back on close', () => {
  const app = read('public/app.js');
  const openFn = app.slice(app.indexOf('function openChatPip()'), app.indexOf('const GAME_INFO_PIP_KEY'));
  assert.match(openFn, /window\.open\('about:blank', 'gameCenterChat', 'width=380,height=640,menubar=no,toolbar=no,location=no,status=no,resizable=yes'\)/);
  assert.match(openFn, /pipWindow\.document\.body\.appendChild\(chatPanel\)/);
  assert.doesNotMatch(openFn, /appendChild\(roomView\)/);
  assert.doesNotMatch(openFn, /await documentPictureInPicture\.requestWindow/);
  assert.match(openFn, /pipWindow\.addEventListener\('pagehide'/);
  assert.match(openFn, /parent\.insertBefore\(chatPanel, next\)/);
  // window.open returns synchronously (null on failure/block), unlike
  // documentPictureInPicture.requestWindow's promise -- no async/catch needed, just a null check.
  assert.doesNotMatch(app.slice(app.indexOf('function openChatPip()'), app.indexOf('function openChatPip()') + 30), /async/);
  assert.match(openFn, /if \(!pipWindow\) \{[\s\S]*chatPipWindow = null;[\s\S]*return;/);
});

// A regular window.open() popup can stay open at the exact same time #gameInfoPanel's native PIP
// window is floating -- the whole reason chat moved off documentPictureInPicture.
test('opening chat\'s window never checks or waits on #gameInfoPanel\'s PIP state, and vice versa', () => {
  const app = read('public/app.js');
  const openFn = app.slice(app.indexOf('function openChatPip()'), app.indexOf('const GAME_INFO_PIP_KEY'));
  assert.doesNotMatch(openFn, /gameInfoPipWindow|gameInfoPipActive/);
  const gameInfoOpenFn = app.slice(app.indexOf('async function openGameInfoPip()'), app.indexOf('function updateSideOverlayBackdrop()'));
  assert.doesNotMatch(gameInfoOpenFn, /chatPipWindow|chatPipActive/);
});

test('opening game-info PIP moves the real #gameInfoPanel (not a copy, and never the board) into the popped-out window and back on close', () => {
  const app = read('public/app.js');
  const openFn = app.slice(app.indexOf('async function openGameInfoPip()'), app.indexOf('function updateSideOverlayBackdrop()'));
  assert.match(openFn, /documentPictureInPicture\.requestWindow\(\{ width: 420, height: 720 \}\)/);
  assert.match(openFn, /pipWindow\.document\.body\.appendChild\(gameInfoPanel\)/);
  assert.doesNotMatch(openFn, /appendChild\(roomView\)/);
  assert.match(openFn, /pipWindow\.addEventListener\('pagehide'/);
  assert.match(openFn, /parent\.insertBefore\(gameInfoPanel, next\)/);
  assert.match(openFn, /catch \{[\s\S]*gameInfoPipWindow = null;/);
});

test('the resign/end-game/next-round buttons and #gameActionsPanel travel with #gameInfoPanel, never with chat', () => {
  const html = read('public/index.html');
  const gameInfoMarkup = html.slice(html.indexOf('<aside class="side card" id="gameInfoPanel"'), html.lastIndexOf('</aside>'));
  assert.match(gameInfoMarkup, /id="sideResignBtn"/);
  assert.match(gameInfoMarkup, /id="sideEndGameBtn"/);
  assert.match(gameInfoMarkup, /id="sideNextRoundBtn"/);
  assert.match(gameInfoMarkup, /id="gameActionsPanel"/);
  const chatMarkup = html.slice(html.indexOf('id="chatPanel"'), html.indexOf('id="gameInfoPanel"'));
  assert.doesNotMatch(chatMarkup, /id="sideResignBtn"|id="gameActionsPanel"/);
});

// v1.6.47 follow-up bug, still relevant here: a layout override injected as a <style> tag parses
// into the popup's DOM but is silently dropped by this page's own CSP (style-src 'self' has no
// 'unsafe-inline') -- confirmed live via computed styles, not just a screenshot. Moved into
// styles.css as a real class instead, and that lesson carries over. Both panels' popups -- chat's
// window.open() secondary window and 게임 진행's native PIP window -- reuse the SAME
// .sidePipLayout class (every rule it applies is class-based, not #roomSidebar-specific, and both
// need the identical "fill the window" treatment), so there's one shared override, not two.
test('the popped-out layout override lives in the real (CSP-safe) stylesheet, shared by both panels, not an injected <style> tag', () => {
  const app = read('public/app.js');
  const chatOpenFn = app.slice(app.indexOf('function openChatPip()'), app.indexOf('const GAME_INFO_PIP_KEY'));
  assert.doesNotMatch(chatOpenFn, /createElement\('style'\)/);
  assert.match(chatOpenFn, /pipWindow\.document\.documentElement\.classList\.add\('sidePipLayout'\)/);
  const gameInfoOpenFn = app.slice(app.indexOf('async function openGameInfoPip()'), app.indexOf('function updateSideOverlayBackdrop()'));
  assert.doesNotMatch(gameInfoOpenFn, /createElement\('style'\)/);
  assert.match(gameInfoOpenFn, /pipWindow\.document\.documentElement\.classList\.add\('sidePipLayout'\)/);
  const css = read('public/styles.css');
  assert.match(css, /html\.sidePipLayout \.side\{display:flex!important;position:static!important/);
  assert.match(css, /html\.sidePipLayout \.sideTabTools \.sideSizeGroup,html\.sidePipLayout \.sideCollapseBtn\{display:none!important\}/);
  // Neither button itself may be hidden -- each stays visible and functional inside its own popup
  // as that popup's close control.
  assert.doesNotMatch(css, /#chatPipBtn\{display:none|#gameInfoPipBtn\{display:none/);
});

test('the board widens only once BOTH panels are actually gone (popped out or docked-collapsed), not just one', () => {
  const app = read('public/app.js');
  const fn = app.slice(app.indexOf('function updateGameLayoutCollapsed()'), app.indexOf('function chatVisible()'));
  assert.match(fn, /const chatGone = chatPipActive\(\) \|\| \(!mobile && chatShouldCollapse\(\) && !chatOverlayOpen\);/);
  assert.match(fn, /const gameInfoGone = gameInfoPipActive\(\) \|\| \(!mobile && gameInfoShouldCollapse\(\) && !gameInfoOverlayOpen\);/);
  assert.match(fn, /gameLayoutEl\.classList\.toggle\('sideCollapsed', chatGone && gameInfoGone\);/);
});

// v1.6.59: since chat's window and 게임 진행's PIP window use two different, non-competing browser
// mechanisms, restoring both preferences on room entry is now safe (unlike the short-lived v1.6.58
// design, which deliberately restored only one to avoid the two native-PIP buttons fighting).
test('leaving the room always closes both windows; entering one restores BOTH preferences since they no longer compete', () => {
  const app = read('public/app.js');
  const enterLobbyFn = app.slice(app.indexOf('function enterLobby()'), app.indexOf('function enterRoomState('));
  assert.match(enterLobbyFn, /closeChatPip\(\);/);
  assert.match(enterLobbyFn, /closeGameInfoPip\(\);/);
  const enterRoomFn = app.slice(app.indexOf('function enterRoomState('), app.indexOf('function stopStream()'));
  assert.match(enterRoomFn, /if \(chatPipPref && chatPipSupported && !chatPipActive\(\)\) openChatPip\(\);/);
  assert.match(enterRoomFn, /if \(gameInfoPipPref && gameInfoPipSupported && !gameInfoPipActive\(\)\) openGameInfoPip\(\);/);
});

test('the chat pane counts as visible for unread-badge purposes while chat is popped out to its own PIP', () => {
  const app = read('public/app.js');
  const fn = app.slice(app.indexOf('function chatVisible()'), app.indexOf('function applyChatLayout()'));
  assert.match(fn, /if \(chatPipActive\(\)\) return true;/);
});

// Bug reported after v1.6.48 shipped: the popup's own narrow requested width falls under the
// site's <880px mobile breakpoint, which hides .sideActions entirely (mobile relies on a separate
// .mobileActions bar near the board instead, which no popup has) -- so 기권하기/다음 판 준비/중단된
// 대국 종료 silently vanished inside the popup. Fixed by forcing it visible; applies equally to
// whichever panel (now always #gameInfoPanel, the only one holding .sideActions) is popped out.
test('the resign/end-game/next-round action row stays visible inside the PIP popup despite its narrow width', () => {
  const css = read('public/styles.css');
  assert.match(css, /html\.sidePipLayout \.sideActions\{display:grid!important\}/);
});

// Requested follow-up: inside the popup, the tab bar/close button (top) and chat input (bottom)
// should stay fixed while only the middle message list scrolls -- the same behavior the docked
// panel already has via .side{overflow:hidden} + .sidePane{flex:1 1 auto;min-height:0} +
// .chatMessages{overflow-y:auto}. That only works if .side itself has a bounded height; an earlier
// cut of this override set height:auto (unbounded), which broke it into a whole-popup-page scroll.
test('the PIP popup keeps .side height-bounded so only the message list scrolls, not the whole popup', () => {
  const css = read('public/styles.css');
  assert.match(css, /html\.sidePipLayout \.side\{display:flex!important;position:static!important;width:100%;height:100%\}/);
  assert.doesNotMatch(css, /html\.sidePipLayout \.side\{[^}]*height:auto/);
  assert.doesNotMatch(css, /html\.sidePipLayout \.side\{[^}]*max-height:none/);
  assert.match(css, /html\.sidePipLayout,html\.sidePipLayout body\{margin:0;height:100%;background:#0b1220;overflow:hidden\}/);
});

// v1.6.58: as the "게임 진행" PIP popup is resized, the dice/yut 3D stage scales proportionally
// instead of clipping -- a smaller popup should show a smaller-but-legible stage.
test('the game-info PIP window scales the dice/yut 3D stage proportionally as it is resized', () => {
  const app = read('public/app.js');
  assert.match(app, /function applyDiceYutPipScale\(pipWindow\) \{/);
  assert.match(app, /diceYutStage\.style\.setProperty\('--diceYutScale', String\(scale\)\);/);
  assert.match(app, /gameInfoPipResizeObserver = new pipWindow\.ResizeObserver\(\(\) => applyDiceYutPipScale\(pipWindow\)\);/);
  const css = read('public/styles.css');
  assert.match(css, /transform:scale\(var\(--diceYutScale,1\)\)/);
});


// v1.6.62: a one-click "기본으로" (back to default) button per panel -- regardless of which
// non-default state a panel is currently in (popped out to its own window, floating in the
// mobile/collapsed overlay, or just manually collapsed), one click returns it to its plain docked,
// expanded state. Requested live after confirming there wasn't already a single button that did
// this from every starting state.
test('each panel has its own "기본으로" reset button that closes its window, its overlay, and clears its collapsed preference', () => {
  const html = read('public/index.html');
  assert.match(html, /<button type="button" id="chatResetBtn" class="sideCollapseBtn hidden"/);
  assert.match(html, /<button type="button" id="gameInfoResetBtn" class="sideCollapseBtn hidden"/);
  const chatMarkup = html.slice(html.indexOf('id="chatPanel"'), html.indexOf('id="gameInfoPanel"'));
  assert.match(chatMarkup, /id="chatResetBtn"/);
  const gameInfoMarkup = html.slice(html.indexOf('id="gameInfoPanel"'), html.indexOf('id="chatFloatBtn"'));
  assert.match(gameInfoMarkup, /id="gameInfoResetBtn"/);

  const app = read('public/app.js');
  const resetChatFn = app.slice(app.indexOf('function resetChatToDocked()'), app.indexOf('function toggleChatOverlay('));
  assert.match(resetChatFn, /closeChatPip\(\);/);
  assert.match(resetChatFn, /chatPipPref = false;/);
  assert.match(resetChatFn, /chatOverlayOpen = false;/);
  assert.match(resetChatFn, /chatCollapsedPref = false;/);
  assert.match(app, /chatResetBtn\?\.addEventListener\('click', \(\) => resetChatToDocked\(\)\);/);

  const resetGameInfoFn = app.slice(app.indexOf('function resetGameInfoToDocked()'), app.indexOf('function toggleGameInfoOverlay('));
  assert.match(resetGameInfoFn, /closeGameInfoPip\(\);/);
  assert.match(resetGameInfoFn, /gameInfoPipPref = false;/);
  assert.match(resetGameInfoFn, /gameInfoOverlayOpen = false;/);
  assert.match(resetGameInfoFn, /gameInfoCollapsedPref = false;/);
  assert.match(app, /gameInfoResetBtn\?\.addEventListener\('click', \(\) => resetGameInfoToDocked\(\)\);/);
});

test('the reset button only shows once a panel actually left its default docked/expanded state, and never on mobile', () => {
  const app = read('public/app.js');
  const applyChatFn = app.slice(app.indexOf('function applyChatLayout()'), app.indexOf('function resetChatToDocked('));
  assert.match(applyChatFn, /chatResetBtn\?\.classList\.toggle\('hidden', mobile \|\| \(!pipActive && !chatOverlayOpen && !collapsed\)\);/);
  const applyGameInfoFn = app.slice(app.indexOf('function applyGameInfoLayout()'), app.indexOf('function setGameInfoTab('));
  assert.match(applyGameInfoFn, /gameInfoResetBtn\?\.classList\.toggle\('hidden', mobile \|\| \(!pipActive && !gameInfoOverlayOpen && !collapsed\)\);/);
});
