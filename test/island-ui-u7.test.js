'use strict';
// 1.10.421 U7 (notes docs/ui-review-20261121.md §2-P P2 · P3 · P5 · P7, §2-D D6): on a touch screen the bag's foot and the stock / flea tabs one sliding
// row, the record tower's chips fading at their end, small targets 40 px and up; a place's window lists what it takes first
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../public/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

test('U7 폰: 가방 아래 단추 · 증권 탭은 한 줄로 밀기, 기록의 탑 칩 끝 흐림, 작은 누름 대상 40px 이상(pointer:coarse)', () => {
  const block = css.match(/@media \(pointer:coarse\)\{\.islandBagFoot\{[\s\S]*?\}\}/); assert.ok(block, 'the touch block');
  for (const s of ['.islandBagFoot{flex-wrap:nowrap;overflow-x:auto', '.stocksTabs{flex-wrap:nowrap;overflow-x:auto', '.recordTowerChips{flex-wrap:nowrap;overflow-x:auto', 'mask-image:linear-gradient(90deg,#000 88%,transparent)', '.bagTab,#islandBagDialog .islandDexTab,#islandBagDialog .islandBagFoot button,.stocksTabs button,.recordTowerChip{min-height:40px}']) assert.ok(block[0].includes(s), s);
});

test('U7 D6 골라 팔기: 가게가 사는 것 먼저, 못 사는 것은 아래(같은 무리 안은 가방 순서)', () => {
  assert.match(app, /for \(const item of \[\.\.\.bag\.items\]\.sort\(\(a, b\) => Number\(!placeTakesItem\(a\)\) - Number\(!placeTakesItem\(b\)\)\)\)/);
});
