'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');

function functionBody(name) {
  const start = app.search(new RegExp(`(async )?function ${name}\\(`));
  assert.ok(start >= 0, `${name} 함수가 없습니다`);
  const ends = ['\n  function ', '\n  async function '].map(marker => app.indexOf(marker, start + 1)).filter(index => index > 0);
  return app.slice(start, Math.min(...ends));
}

test('내 차례 알림은 v1.6.84 행동 주체 계산을 재사용하고 관전자·일시정지·종료를 제외한다', () => {
  const request = functionBody('myTurnAlertRequest');
  assert.match(request, /if \(!state \|\| !seat \|\| !g \|\| g\.paused\) return null;/);
  assert.match(request, /g\.status !== 'playing'/);
  assert.match(request, /currentActorSeats\(\{ holdAnimations: false \}\)/);
  assert.match(request, /g\.myVoted/);
  assert.match(request, /g\.canGuess/);
});

test('같은 행동 단계는 한 번만, 입장 직후(일시정지 포함) 기준 상태는 알리지 않는다', () => {
  const evaluate = functionBody('evaluateTurnAlert');
  assert.match(evaluate, /const baseline = !turnAlertBaselineReady;/);
  assert.match(evaluate, /if \(!state\?\.game\?\.paused\) turnAlertBaselineReady = true;/);
  assert.match(evaluate, /seenTurnAlertKeys\.has\(request\.key\)/);
  assert.match(evaluate, /if \(fresh && !baseline && pageInBackground\(\)\) raiseTurnAlert\(request\);/);
  assert.match(functionBody('enterRoomState'), /resetTurnAlertTracking\(\)/);
  assert.doesNotMatch(functionBody('turnAlertSequence'), /revision/);
});

test('권한 요청은 버튼 클릭 경로에서만, 알림 문구는 게임 이름과 공개 동작만 쓴다', () => {
  const requestCalls = app.match(/Notification\.requestPermission\(/g) || [];
  assert.equal(requestCalls.length, 1);
  assert.match(functionBody('toggleTurnNotify'), /Notification\.requestPermission\(\)/);
  assert.match(app, /turnNotifyBtn\?\.addEventListener\('click', \(\) => \{ toggleTurnNotify\(\); \}\)/);
  const verb = functionBody('turnAlertVerb');
  // Only the public phase/status decide the wording -- no per-viewer (state.me) or hidden fields.
  assert.doesNotMatch(verb, /state\.me|g\.(?!phase\b|status\b)\w+/);
  assert.match(functionBody('myTurnAlertRequest'), /body: `\$\{state\.gameName \|\| gameName\(type\)\}에서 \$\{turnAlertVerb\(type, g\)\} 차례입니다\.`/);
  assert.match(functionBody('raiseTurnAlert'), /tag: 'gamecenter-my-turn'/);
  assert.match(functionBody('raiseTurnAlert'), /window\.focus\(\)/);
  assert.match(html, /id="turnNotifyBtn"/);
});

test('탭 제목은 공통 함수로만 바꾸고 복귀 시 원래 제목으로 되돌린다', () => {
  assert.match(functionBody('applyDocumentTitle'), /if \(document\.title !== next\) document\.title = next;/);
  assert.doesNotMatch(app.replace(/pipWindow\.document\.title/g, ''), /document\.title = `|document\.title = '/);
  assert.match(app, /document\.addEventListener\('visibilitychange', endTurnAlertIfLooking\)/);
  assert.match(app, /window\.addEventListener\('focus', endTurnAlertIfLooking\)/);
});
