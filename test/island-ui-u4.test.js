'use strict';
// 1.10.418 U4 (notes docs/ui-review-20261121.md §2-C C2 · C3 · C4, §2-D D3 · D4, 결정 43 A 4): one close -- the head's ✕ on every island sheet (its
// …Mode windows too; a talk has none, the admin's U6), no second 「닫기」 at the bottom of a window that has it; a window's width by what it holds
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../public/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

test('U4 닫기 하나: 머리 ✕ 규칙이 대화 · 관리자 말고 모든 섬 창(…Mode 포함), 아래 「닫기」 단추는 없음', () => {
  assert.match(css, /body\.plazaMode \.isle-sheet:not\(\.talkMode\):not\(\.adminMode\)>\.recordsDialogHead>button:last-child::after\{content:"✕"/);
  assert.doesNotMatch(app, /btn\('닫기', 'secondary', \(\) => plazaDialog\.close\(\)\)/, 'a bottom 「닫기」 in a window with the head ✕');
  assert.doesNotMatch(app, /taxiCloseBtn/, 'the taxi windows: the head ✕ only');
});

test('U4 창 폭 3단계: 작게 440 · 보통 560 · 넓게 1120, 택시 · 승강기 작게, 가격표 보통', () => {
  assert.match(css, /\.recordsDialog\.plazaDialog\{width:min\(1120px,94vw\)/); assert.match(css, /\.recordsDialog\.plazaDialog\.winS\{width:min\(440px,94vw\)\}/); assert.match(css, /\.recordsDialog\.plazaDialog\.winM\{width:min\(560px,94vw\)\}/);
  assert.match(app, /function openPlazaWindow\(title, nodes, size = 'wide'\)/);
  for (const [title, size] of [['🚕 택시 부르기', 's'], ['🚕 어디로 갈까요?', 's'], ['승강기', 's'], ['펫샵', 'm'], ['가구점', 'm'], ['잡화점', 'm'], ['테드 창', 'm']]) assert.ok(app.includes(`openPlazaWindow('${title}', [`) && new RegExp(`openPlazaWindow\\('${title.replace(/[?]/g, '\\?')}', \\[[^\\]]*\\], '${size}'\\)`).test(app), `${title} ${size}`);
});
