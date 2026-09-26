'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const othello = require('../lib/games/othello');
const halligalli = require('../lib/games/halligalli');

const root = path.join(__dirname, '..');

test('오델로 최근 행동 상태는 착수점과 뒤집힌 좌표를 재접속 상태에 보존한다', () => {
  const game = othello.create();
  othello.start(game);
  const first = othello.publicState(game).legalMoves[0];
  assert.ok(first);
  const result = othello.applyMove(game, first.x, first.y, 'black', 12345);
  assert.equal(result.legal, true);
  const state = othello.publicState(game);
  assert.equal(state.lastMove.x, first.x);
  assert.equal(state.lastMove.y, first.y);
  assert.equal(state.lastMove.flippedCells.length, state.lastMove.flipped);
  assert.ok(state.lastMove.flippedCells.every(cell => Number.isInteger(cell.x) && Number.isInteger(cell.y)));
});

test('할리갈리 최근 공개 카드는 공개 상태에서 자리·flipId·시각을 복원한다', () => {
  const game = halligalli.create({ durationMinutes: 5 });
  assert.equal(halligalli.start(game, ['1', '2'], 1000).legal, true);
  const actor = game.turn;
  const before = game.revision;
  const result = halligalli.flip(game, actor, 1200, before);
  assert.equal(result.legal, true);
  const state = halligalli.publicState(game);
  assert.deepEqual(state.lastFlip, { seat: actor, flipId: 1, at: 1200 });
  assert.equal(state.faceCounts[actor], 1);
});

test('공통 최근 행동 UI는 지속 마커·짧은 강조·감소된 모션을 함께 제공한다', () => {
  const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'public', 'styles.css'), 'utf8');
  const twenty = fs.readFileSync(path.join(root, 'public', 'twentyquestions-ui.js'), 'utf8');

  assert.match(app, /RECENT_ACTION_FLASH_MS = 720/);
  assert.match(app, /function observeRecentAction\(/);
  assert.match(app, /function drawRecentActionRing\(/);
  assert.match(app, /flippedCells/);
  assert.match(app, /lastFlip/);
  assert.match(css, /\.recentActionTarget/);
  assert.match(css, /\.recentActionActor/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(twenty, /window\.GameRecentAction/);
});
