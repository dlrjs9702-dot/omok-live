'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// v1.6.56: every game's role/seat selection, start button, and turn-action inputs (throw/roll
// buttons, guess/hint/answer forms, setup selects) moved out from under the board into a single
// shared #gameActionsPanel, docked below the dice/yut stage inside <aside id="gameInfoPanel"> --
// the same "게임 진행" panel that also holds the system/room-info tabs and .sideActions (v1.6.58
// split chat out into its own separate #chatPanel; #gameActionsPanel never lived there). Passive
// board content (bingo's number grid, oldmaid's seat cards, marathon's track, pictionary's drawing
// canvas, the actual game boards) stays where it was; only interactive controls moved. All of this
// is a pure DOM relocation -- every element keeps its original id, so none of app.js's
// getElementById-based render/toggle/click-wiring logic needed to change.
test('#gameActionsPanel exists inside #gameInfoPanel, below the dice/yut stage and above the resign/next-round row', () => {
  const html = read('public/index.html');
  const asideStart = html.indexOf('<aside class="side card" id="gameInfoPanel"');
  const asideEnd = html.indexOf('</aside>', asideStart);
  const infoStart = html.indexOf('data-side-pane="info"', asideStart);
  const panelStart = html.indexOf('id="gameActionsPanel"', asideStart);
  const sideActionsStart = html.indexOf('class="sideActions"', asideStart);
  assert.ok(asideStart >= 0 && asideStart < panelStart, 'aside must contain #gameActionsPanel');
  assert.ok(panelStart < infoStart, '#gameActionsPanel must come before the system/info sidePane tabs');
  assert.ok(panelStart < sideActionsStart, '#gameActionsPanel must come before .sideActions');
  assert.ok(infoStart < asideEnd && sideActionsStart < asideEnd, 'the info tab and .sideActions must still be inside the aside');
});

test('the shared role/seat chooser lives inside #gameActionsPanel, not under the board', () => {
  const html = read('public/index.html');
  const panelStart = html.indexOf('id="gameActionsPanel"');
  const panelEnd = html.indexOf('class="sideActions"');
  const panel = html.slice(panelStart, panelEnd);
  for (const id of ['roleChooser', 'standardRoleButtons', 'teamRoleButtons', 'chooseBlackBtn', 'chooseWhiteBtn', 'chooseSpectatorBtn', 'teamSpectatorBtn']) {
    assert.ok(panel.includes(`id="${id}"`), `${id} should be inside #gameActionsPanel`);
  }
  const boardScrollStart = html.indexOf('id="boardScroll"');
  const boardScrollEnd = html.indexOf('id="yutControls"');
  const boardScrollRegion = html.slice(boardScrollStart, boardScrollEnd);
  assert.doesNotMatch(boardScrollRegion, /id="roleChooser"/);
});

test('every relocated per-game control lives inside #gameActionsPanel; every board/status element it was split from stays behind', () => {
  const html = read('public/index.html');
  const panelStart = html.indexOf('id="gameActionsPanel"');
  const panelEnd = html.indexOf('class="sideActions"');
  const panel = html.slice(panelStart, panelEnd);
  const outside = html.slice(0, panelStart) + html.slice(panelEnd);

  const moved = [
    'yutThrowBtn', 'yutMoveChoices',
    'bingoTargetSelect', 'bingoStartBtn',
    'cityActionPanel', 'cityStartBtn', 'cityRollBtn', 'cityBuyBtn', 'citySkipBtn', 'cityBuildBtn', 'cityBuildSkipBtn',
    'baseballSecretForm', 'baseballGuessForm',
    'pictionaryStartBtn', 'pictionaryGuessForm',
    'oldmaidStartBtn', 'oldmaidModeChooser',
    'liarRoundsSelect', 'liarStartBtn', 'liarHintForm', 'liarGuessForm',
    'marathonStartBtn', 'marathonConfigChooser', 'marathonRollBtn', 'marathonAnswerForm',
  ];
  for (const id of moved) {
    assert.ok(panel.includes(`id="${id}"`), `${id} should be inside #gameActionsPanel`);
    assert.ok(!outside.includes(`id="${id}"`), `${id} must not remain duplicated outside #gameActionsPanel`);
  }

  const stayed = [
    'bingoBoard', 'bingoStatus',
    'cityControls', 'cityAssets', 'cityEvent',
    'baseballReady', 'baseballMySecret', 'baseballHint', 'baseballHistory',
    'pictionaryCanvas', 'pictionaryDrawTools', 'pictionaryScoreboard',
    'oldmaidSeats', 'oldmaidMyHand', 'oldmaidAbilityBar',
    'liarRoleBox', 'liarVoteBox', 'liarScoreboard',
    'marathonTrack', 'marathonHistory', 'marathonMissionBox',
    'yutLastThrow', 'yutHint',
  ];
  for (const id of stayed) {
    assert.ok(outside.includes(`id="${id}"`), `${id} should stay outside #gameActionsPanel`);
    assert.ok(!panel.includes(`id="${id}"`), `${id} must not have moved into #gameActionsPanel`);
  }
});

// Since every relocated element kept its exact id, renderRoom()'s per-game classList.toggle('hidden', ...)
// calls and every button's click-wiring still work unchanged -- getElementById doesn't care where in
// the DOM the element physically lives. This test just pins that no id was accidentally renamed/dropped
// during the move by re-checking a representative sample of the existing wiring still references them.
test('relocated controls keep the exact wiring app.js already had for them', () => {
  const app = read('public/app.js');
  assert.match(app, /yutControls\.classList\.toggle\('hidden', !yut\)/);
  assert.match(app, /bingoStartBtn\.addEventListener\('click', \(\) => roomAction\('start-bingo'\)\)/);
  assert.match(app, /cityStartBtn\.addEventListener\('click', \(\) => roomAction\('start-city'\)\)/);
  assert.match(app, /oldmaidStartBtn\.addEventListener\('click', \(\) => roomAction\('start-oldmaid'\)\)/);
  assert.match(app, /liarStartBtn\.addEventListener\('click', \(\) => roomAction\('start-liar'\)\)/);
  assert.match(app, /marathonStartBtn\.addEventListener\('click', \(\) => roomAction\('start-marathon'\)\)/);
  assert.match(app, /pictionaryStartBtn\.addEventListener\('click', \(\) => roomAction\('start-pictionary'\)\)/);
  assert.match(app, /chooseBlackBtn\.addEventListener\('click', \(\) => roomAction\('choose-role', \{ choice: 'black' \}\)\)/);
});

// Land King's start/roll/buy/build controls used to overlay the canvas; now that they're an ordinary
// in-flow sidebar block, that CSS must not still be positioning them absolutely (which would resolve
// against whatever new ancestor they land in, likely producing a broken/invisible layout).
test('#cityActionPanel is a normal in-flow block now, not absolutely positioned over the canvas', () => {
  const css = read('public/styles.css');
  assert.doesNotMatch(css, /\.cityActionPanel\{[^}]*position:absolute/);
  assert.match(css, /\.cityActionPanel\{display:flex/);
});

test('#gameActionsPanel stays in one visible flow instead of hiding controls behind an inner scrollbar', () => {
  const css = read('public/styles.css');
  assert.match(css, /\.side \.gameActionsPanel\{[^}]*overflow:visible/);
  assert.doesNotMatch(css, /\.side \.gameActionsPanel\{[^}]*overflow-y:auto/);
});

// Regression: every relocated control used to sit inside a per-game panel (#yutControls,
// #bingoPanel, #liarPanel, etc.) that already had `classList.toggle('hidden', !thisGame)` --
// moving it into the shared #gameActionsPanel silently dropped that "hide entirely when a
// DIFFERENT game is active" behavior, since each control's own remaining toggle logic (disabled
// state, sub-phase visibility) only ever runs from inside that game's own render*() function,
// which never executes for other game types. Without its own explicit hide, a control just keeps
// showing whatever it was last set to -- e.g. yutThrowBtn stayed visible and clickable while
// playing Land King, confirmed live via Playwright before this fix. renderRoom() must give every
// moved control this same blanket toggle, tied to the exact boolean its own panel uses.
test('every relocated control has its own explicit hidden-toggle so it disappears when a different game is active', () => {
  const app = read('public/app.js');
  const pairs = [
    ['yutThrowBtn', '!yut'], ['yutMoveChoices', '!yut'],
    ['bingoSetupRow', '!bingo'],
    ['baseballSecretForm', '!baseball'], ['baseballGuessForm', '!baseball'],
    ['pictionaryStartBtn', '!pictionary'], ['pictionaryGuessForm', '!pictionary'],
    ['oldmaidStartBtn', '!oldmaid'], ['oldmaidModeChooser', '!oldmaid'],
    ['liarSetupRow', '!liar'], ['liarHintForm', '!liar'], ['liarGuessForm', '!liar'],
    ['marathonStartBtn', '!marathon'], ['marathonConfigChooser', '!marathon'],
    ['marathonRollBtn', '!marathon'], ['marathonAnswerForm', '!marathon'],
  ];
  for (const [id, cond] of pairs) {
    const re = new RegExp(`${id}\\.classList\\.toggle\\('hidden', ${cond.replace('!', '!')}\\)`);
    assert.match(app, re, `${id} should have classList.toggle('hidden', ${cond})`);
  }
  // cityActionPanel already had its own independent toggle before the move (it was never nested
  // inside another hidden-toggled panel), so it needs no new toggle -- just confirm it's intact.
  assert.match(app, /cityActionPanel\.classList\.toggle\('hidden', !city\)/);
});
