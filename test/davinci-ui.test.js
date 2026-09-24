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
  assert.match(css, /@keyframes davinciRevealFlip/);
});
