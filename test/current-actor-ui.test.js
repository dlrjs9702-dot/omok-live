'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'styles.css'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

function functionBody(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} 함수가 없습니다`);
  return app.slice(start, app.indexOf('\n  function ', start + 1));
}

test('현재 행동 주체는 게임별 실제 담당 필드로 계산하고 동시 행동 단계는 비운다', () => {
  const actor = functionBody('currentActorSeats');
  assert.match(actor, /g\.status !== 'playing'/);
  assert.match(actor, /g\.nextSeat/); // 2:2 오목
  assert.match(actor, /g\.phase === 'liquidate' \? g\.liquidating : g\.turn/); // 랜드킹 자산 정리
  assert.match(actor, /\['secret', 'answering', 'judging'\]\.includes\(g\.phase\)\) seats = one\(g\.drawerSeat\)/);
  assert.match(actor, /\['asking', 'final-guesses'\]\.includes\(g\.phase\)\) seats = one\(g\.turnSeat\)/);
  assert.match(actor, /g\.phase === 'drawing'\) seats = one\(g\.drawerSeat\)/);
  assert.match(actor, /\['hint1', 'hint2', 'extraHint'\]\.includes\(g\.phase\)\) seats = one\(g\.currentSpeaker\)/);
  assert.match(actor, /g\.currentRoller/);
  assert.match(actor, /yutPieceAnimation && g\.lastMove\?\.color/);
  assert.doesNotMatch(actor, /liarSeat|canGuess|eliminated/);
  assert.match(actor, /paused: Boolean\(g\.paused\)/);
});

test('참가자 카드에 공통 클래스로 표시하고 기존 호박색 차례 표시는 제거했다', () => {
  const render = functionBody('renderCurrentActor');
  assert.match(render, /blackPlayer/);
  assert.match(render, /teamPlayers\.children/);
  assert.match(render, /'currentActor', on && !paused/);
  assert.match(render, /'currentActorPaused', on && paused/);
  assert.doesNotMatch(app, /' myTurn'/);
  assert.doesNotMatch(css, /myTurn/);
  const rule = css.match(/\.currentActor\{([^}]*)\}/);
  assert.ok(rule);
  assert.match(rule[1], /56,189,248|#38bdf8/);
  assert.doesNotMatch(rule[1], /outline|animation/);
});

test('오래된 방 상태(HTTP 응답)가 더 최신 SSE 상태를 덮어쓰지 않는다', () => {
  assert.match(server, /let roomViewSeq = Date\.now\(\) \* 1000;/);
  assert.match(server, /stateSeq: roomViewSeq/);
  assert.match(app, /function isStaleRoomState\(next\)/);
  assert.match(app, /if \(isStaleRoomState\(parsed\)\) return;/);
  assert.match(app, /if \(data\.state && !isStaleRoomState\(data\.state\)\) \{\n\s*state = data\.state;/);
});
