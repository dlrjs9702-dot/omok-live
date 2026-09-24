'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'styles.css'), 'utf8');

function relativeLuminance(hex) {
  const rgb = hex.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16) / 255);
  const [r, g, b] = rgb.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground, background) {
  const values = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('할리갈리 공개 카드는 로컬 과일 SVG와 1~5개 반복 그림을 사용한다', () => {
  const start = app.indexOf('function renderHalli()');
  const end = app.indexOf('function renderDavinci()', start);
  const halli = app.slice(start, end);
  for (const [fruit, file] of [
    ['딸기', 'strawberry.svg'],
    ['바나나', 'banana.svg'],
    ['라임', 'lime.svg'],
    ['자두', 'plum.svg'],
  ]) {
    assert.match(halli, new RegExp(`'${fruit}': '/assets/halli/${file.replace('.', '\\.')}'`));
    const svg = fs.readFileSync(path.join(root, 'public', 'assets', 'halli', file), 'utf8');
    assert.match(svg, /<svg[^>]+viewBox="0 0 96 96"/);
    assert.doesNotMatch(svg, /<image\\b/i);
  }
  assert.doesNotMatch(halli, /🍓|🍌|🍋|🍇/);
  assert.match(halli, /for \(let index = 0; index < top\.count; index \+= 1\)/);
  assert.match(halli, /halliFruitName/);
  assert.match(halli, /halliFruitCount/);
  assert.match(halli, /halliCardCounts/);
});

test('할리갈리 카드는 PC 2~6인 배치와 밝은 배경 대비를 명시한다', () => {
  assert.match(css, /\.halliCards \{[^}]*minmax\(13rem, 1fr\)/s);
  assert.match(css, /\.halliCard \{[^}]*background: #fffaf0;[^}]*color: #1d2733;/s);
  assert.match(css, /\.halliPlayerName \{[^}]*color: #18212c;/s);
  assert.match(css, /\.halliFruitName \{[^}]*color: #26313d;/s);
  assert.match(css, /\.halliFruitCount \{[^}]*color: #101820;/s);
  assert.match(css, /\.halliCardCounts \{[^}]*color: #38424e;/s);
  for (let count = 1; count <= 5; count += 1) {
    assert.match(css, new RegExp(`\\.halliFruitVisuals\\.count-${count} \\.halliFruitIcon`));
  }
  for (const [foreground, background] of [
    ['#18212c', '#fffaf0'],
    ['#26313d', '#ffffff'],
    ['#101820', '#ffffff'],
    ['#38424e', '#fffaf0'],
  ]) {
    assert.ok(contrastRatio(foreground, background) >= 4.5, `${foreground} 대비가 4.5:1 미만입니다`);
  }
});
