'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

test('라이어게임 결과 효과 키는 내부 라운드(roundNumber)를 포함해 3판 모드의 2·3번째 판에도 재생된다', () => {
  assert.match(app, /const liarKey = result \? `\$\{state\.me\?\.roomCode\}:\$\{g\.round\}:\$\{result\.roundNumber \?\? g\.roundNumber\}` : null;/);
});

test('다빈치 정답·공개 효과는 추측/타일 키당 한 번만 예약하고 화면에 붙어 있는 타일에 그린다', () => {
  assert.match(app, /const fxKey = feedbackForTile && feedback\.correct \? `guess:\$\{davinciFeedbackKey\(feedback\)\}` : revealingNow \? `reveal:\$\{tile\.id\}` : null;/);
  assert.match(app, /fxKey !== davinciFxPlayed/);
  assert.match(app, /button\.isConnected \? button : davinciHands\.querySelector/);
  assert.doesNotMatch(app, /\(revealingNow \|\| \(feedbackForTile && feedback\.correct\)\)\) requestAnimationFrame/);
});
