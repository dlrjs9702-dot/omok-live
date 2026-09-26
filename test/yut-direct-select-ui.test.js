'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

function functionBody(name) {
  const start = app.search(new RegExp(`(async )?function ${name}\\(`));
  assert.ok(start >= 0, `${name} 함수가 없습니다`);
  const next = app.indexOf('\n  function ', start + 1);
  const nextAsync = app.indexOf('\n  async function ', start + 1);
  const end = [next, nextAsync].filter(index => index > 0).sort((a, b) => a - b)[0];
  return app.slice(start, end);
}

test('윷판 선택 대상은 서버 legalMoves와 애니메이션·요청 대기 가드만을 기준으로 한다', () => {
  const targets = functionBody('yutSelectableTargets');
  assert.match(targets, /yutMovePending \? \[\] : yutActionableMoves\(\)/);
  assert.match(targets, /yutNodePosition\(/);
  assert.match(targets, /yutStackOffsets\(/);
  assert.match(targets, /move\.carried/);
  const actionable = functionBody('yutActionableMoves');
  assert.match(actionable, /yutThrowAnimating/);
  assert.match(actionable, /yutPieceAnimation/);
  assert.match(actionable, /g\.legalMoves/);
});

test('판 클릭과 보조 버튼은 같은 move-yut 요청 경로와 중복 전송 방지를 공유한다', () => {
  const request = functionBody('requestYutMove');
  assert.match(request, /if \(yutMovePending \|\| !yutTargetForPiece\(pieceId\)\) return;/);
  assert.match(request, /roomAction\('move-yut', \{ pieceId \}\)/);
  assert.match(request, /finally/);
  assert.match(app, /button\.addEventListener\('click', \(\) => requestYutMove\(move\.pieceId\)\)/);
  assert.doesNotMatch(app, /roomAction\('move-yut', \{ pieceId: move\.pieceId \}\)/);
});

test('캔버스 클릭 좌표는 표시 크기 대비 내부 해상도로 보정한다', () => {
  const pixel = functionBody('canvasPixel');
  assert.match(pixel, /getBoundingClientRect\(\)/);
  assert.match(pixel, /canvas\.width \/ rect\.width/);
  assert.match(pixel, /canvas\.height \/ rect\.height/);
});

test('말 이동 애니메이션은 첫 프레임 전에 입력 가드를 잡는다', () => {
  const animate = functionBody('animateYutPieceMove');
  const guard = animate.indexOf('yutPieceAnimation = { pieceIds: idSet, x: startX, y: startY };');
  assert.ok(guard > 0);
  assert.ok(guard < animate.indexOf('const runSegment'));
});
