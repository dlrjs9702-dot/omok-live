'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

// v1.6.40: client-side half of connection-drop handling -- the universal "기다리기 / 게임 종료"
// popup and the disconnect-aware status/end-screen text, both now shared by every game (not just
// the 4-seat team game they started on).

test('every game gets a debounced wait/end popup and a generalized end-game affordance on disconnect', async () => {
  const html = await fs.readFile(path.resolve(__dirname, '../public/index.html'), 'utf8');
  const app = await fs.readFile(path.resolve(__dirname, '../public/app.js'), 'utf8');

  assert.match(html, /id="pauseDialog"/);
  assert.match(html, /id="pauseWaitBtn"/);
  assert.match(html, /id="pauseEndBtn"/);

  // The popup only appears after a debounce (so a brief blip that self-resolves never flashes it),
  // and "기다리기" only dismisses that one disconnect episode, not the persistent end-game button.
  assert.match(app, /function updatePauseDialog/);
  assert.match(app, /}, 2000\);/);
  assert.match(app, /pauseDialogDismissedKey = pauseDialogShownKey/);
  assert.match(app, /참가자 \$\{names\}님의 연결이 끊겨 게임이 일시 중단되었습니다\./);

  // The end-game button is no longer restricted to the team game's host -- any connected, seated
  // participant may end a paused match, matching the server's generalized handler.
  assert.match(app, /const canEndPaused = canAct && g\.status === 'playing' && g\.paused;/);
  assert.doesNotMatch(app, /const canEndPaused = team && isHost/);

  // The pause/disconnect status text and board overlay are no longer gated to team games only.
  assert.match(app, /const pauseStatusText = g\.status === 'playing' && g\.paused/);
  assert.match(app, /} else if \(g\.status === 'playing' && g\.paused\) \{/);
  assert.doesNotMatch(app, /else if \(team && g\.status === 'playing' && g\.paused\)/);

  // A disconnect-caused finish is called out distinctly from a normal win, without inventing a
  // whole separate end screen per game.
  assert.match(app, /접속 끊김으로 종료/);
});
