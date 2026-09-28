'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'styles.css'), 'utf8');

test('다빈치 코드 UI는 공개 선택 상태와 카드 자세를 분리해 렌더링한다', () => {
  assert.match(app, /select-davinci/);
  assert.match(app, /g\.selection/);
  assert.match(app, /selected-target/);
  assert.match(app, /reveal-now/);
  assert.match(app, /davinciFocusLine/);
  assert.match(css, /\.davinciTile\.unrevealed/);
  assert.match(css, /\.davinciTile\.selected-target/);
  assert.match(css, /\.davinciTile\.revealed/);
  assert.match(css, /\.davinciTile\.guess-submitting/);
  assert.match(css, /\.davinciTile\.guess-correct/);
  assert.match(css, /\.davinciTile\.guess-wrong/);
  assert.match(css, /\.davinciGuessValue/);
  assert.match(app, /lastGuess/);
  assert.match(app, /davinciGuessPending/);
  assert.match(css, /@keyframes davinciRevealFlip/);
  assert.match(css, /@keyframes davinciGuessCorrect/);
  assert.match(css, /@keyframes davinciGuessWrong/);
});

test('다빈치 코드 테이블(v1.6.96): 자체 테이블 이미지·내 자리 아래·중앙 더미·숫자판·추리 메모', () => {
  assert.ok(fs.existsSync(path.join(root, 'public', 'assets', 'davinci', 'table.svg')));
  assert.match(css, /url\('\/assets\/davinci\/table\.svg'\)/);
  for (const name of ['renderDavinciCenter', 'renderDavinciPicker']) assert.match(app, new RegExp(`function ${name}\\(`));
  for (const selector of ['.davinciTable', '.davinciRack', '.davinciPile', '.davinciPicker', '.davinciMemo', '.davinciDrawnTile.draw-in']) assert.ok(css.includes(selector), selector);
  // The drawn tile's number is only ever shown to the drawer; the pile never shows colours
  // (they are not public) -- a neutral back only.
  assert.match(app, /const mineDrawn = g\.turn === seat \? state\.me\?\.myDavinciDrawn : null;/);
  assert.match(app, /back\.className = 'davinciPileTile';/);
  // The number pad submits through the existing guess path (same request as the fallback button).
  assert.match(app, /davinciNumber\.value = String\(n\); davinciGuessBtn\.click\(\);/);
});

test('다빈치 코드 숫자판(v1.6.97): 0~11 모두 같은 모양·같은 조건으로 선택 가능하고 후보를 걸러내지 않는다', () => {
  const start = app.indexOf('function renderDavinciPicker(');
  const picker = app.slice(start, app.indexOf('\n  }\n', start));
  assert.match(picker, /for \(let n = 0; n <= 11; n \+= 1\)/);
  // No candidate calculation, no per-number disabled/opacity/tooltip difference.
  assert.doesNotMatch(app, /davinciImpossibleNumbers|unlikely/);
  assert.doesNotMatch(css, /davinciPickNumber[^{]*\.(unlikely|disabled|impossible)/);
  assert.doesNotMatch(picker, /\.disabled\s*=|aria-disabled|setAttribute\('disabled'|\.number\b/);
  assert.match(picker, /button\.className = `davinciPickNumber \$\{targetTile\.color\}\$\{\[6, 9\]\.includes\(n\) \? ' underline-num' : ''\}`;/);
  assert.match(picker, /button\.title = `\$\{n\}\(으\)로 추측`;/);
});
