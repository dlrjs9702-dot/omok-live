'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'styles.css'), 'utf8');
const twenty = fs.readFileSync(path.join(root, 'public', 'twentyquestions-ui.js'), 'utf8');

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} 함수가 없습니다`);
  const next = source.indexOf('\n  function ', start + 1);
  return source.slice(start, next < 0 ? undefined : next);
}

test('현재 행동 가능 표시는 공통 헬퍼와 내 좌석·진행 중·비일시정지 조건을 사용한다', () => {
  const windowOpen = functionBody(app, 'actionWindowOpen');
  assert.match(windowOpen, /seat/);
  assert.match(windowOpen, /status === 'playing'/);
  assert.match(windowOpen, /!g\.paused/);
  assert.match(app, /function setActionable\(/);
  assert.match(app, /function drawActionableMark\(/);
  assert.match(app, /window\.GameActionable = /);
  assert.match(twenty, /window\.GameActionable/);
});

test('격자판 강조는 서버가 준 합법 수 목록을 기준으로 한다', () => {
  const board = functionBody(app, 'boardTurnActionable');
  assert.match(board, /legalMoves/);
  assert.match(board, /legalColumns/);
  assert.match(board, /legalEdges/);
  assert.match(board, /isTeamGame\(\) \? g\.nextSeat : g\.turn/);
  assert.match(functionBody(app, 'drawOthelloBoard'), /for \(const \{ x, y \} of state\.game\.legalMoves/);
  assert.match(functionBody(app, 'drawDotsBoard'), /state\.game\.legalEdges/);
  assert.match(functionBody(app, 'yutActionableMoves'), /g\.legalMoves/);
});

test('v1.6.80 점과 상자 회귀: 오델로 전용 변수를 참조하지 않고 오델로 착수 링은 오델로에서 그린다', () => {
  const dots = functionBody(app, 'drawDotsBoard');
  assert.doesNotMatch(dots, /othelloRecent/);
  assert.doesNotMatch(dots, /\bif \(last\)/);
  assert.match(functionBody(app, 'drawOthelloBoard'), /if \(last\) drawRecentActionRing\(/);
});

test('행동 가능 CSS는 최근 행동 표시와 다른 속성·색을 쓰고 감소된 모션을 존중한다', () => {
  const rule = css.match(/\.actionableTarget\{([^}]*)\}/);
  assert.ok(rule, '.actionableTarget 규칙이 없습니다');
  assert.match(rule[1], /box-shadow/);
  assert.doesNotMatch(rule[1], /outline/);
  assert.match(rule[1], /52,211,153/);
  assert.match(css, /\.recentActionTarget\{outline/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.actionablePrimary\{animation:none/);
});

test('할리갈리 종은 상시 입력이라 강조하지 않고, 다빈치 표시는 공개 필드만 사용한다', () => {
  assert.doesNotMatch(app, /setActionable\(halliBellBtn/);
  assert.match(app, /setActionable\(halliFlipBtn/);
  const davinciLine = app.split('\n').find(line => line.includes("button.classList.add('actionableTarget')") && line.includes('canSelect'));
  assert.ok(davinciLine, '다빈치 타일 강조 줄이 없습니다');
  assert.doesNotMatch(davinciLine, /number/);
  assert.doesNotMatch(app, /dataset\.actionable/);
});
