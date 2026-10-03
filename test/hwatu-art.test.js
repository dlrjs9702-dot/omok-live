'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { CARDS } = require('../lib/games/gostop/cards');

// v1.7.4: the game center's own vector hwatu. Every engine card (48 + 2 bonus) has a self-contained
// drawing: no external image, no href/url reference, no copied bitmap -- only basic SVG shapes.
function loadArt() {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'hwatu-art.js'), 'utf8'), { window });
  return window.HwatuArt;
}

test('자체 화투 그림: 엔진의 50장 모두 있고, 외부 이미지·참조 없이 기본 도형만 쓴다', () => {
  const art = loadArt();
  assert.deepEqual([...art.ids].sort(), CARDS.map(card => card.id).sort());
  const drawings = new Map(art.ids.map(id => [id, art.svg(id)]));
  for (const [id, svg] of drawings) {
    assert.match(svg, /^<svg class="hwatuSvg" viewBox="0 0 60 90"[^>]*aria-hidden="true"/, id);
    assert.doesNotMatch(svg, /<image|<use|href=|url\(|data:|<script|<foreignObject/i, id);
    const tags = new Set([...svg.matchAll(/<([a-zA-Z]+)/g)].map(m => m[1]));
    for (const tag of tags) assert.ok(['svg', 'rect', 'circle', 'path', 'text'].includes(tag), `${id}: ${tag}`);
  }
  assert.ok(new Set(drawings.values()).size >= 36, '월·종류마다 구별되는 그림');
  // 광에는 光 표식, 쌍피·보너스에는 숫자 딱지, 홍단·청단에는 글씨가 있다.
  for (const card of CARDS) {
    const svg = drawings.get(card.id);
    if (card.kind === 'gwang') assert.match(svg, />光</, card.id);
    if (card.piValue >= 2) assert.match(svg, new RegExp(`>${card.piValue}<`), card.id);
    if (card.dan === 'hong') assert.match(svg, />홍</, card.id);
    if (card.dan === 'cheong') assert.match(svg, />청</, card.id);
  }
  assert.equal(art.svg('m01-gwang'), art.svg('m01-gwang'), '같은 카드는 캐시된 같은 그림');
  assert.equal(art.svg('m13-pi1'), '');
});

test('화면 연결: 화투 그림 스크립트가 고스톱 화면보다 먼저 로드되고, 비공개 뒷면에는 그림이 없다', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert.ok(html.indexOf('/hwatu-art.js') > 0 && html.indexOf('/hwatu-art.js') < html.indexOf('/gostop-ui.js'));
  const ui = fs.readFileSync(path.join(__dirname, '..', 'public', 'gostop-ui.js'), 'utf8');
  assert.match(ui, /window\.HwatuArt\?\.html\?\.\(id\) \?\? window\.HwatuArt\?\.svg\(id\)/); // v1.8.6: 공개 그림 우선, 자체 그림은 보너스·대비용
  const back = ui.slice(ui.indexOf('function backEl('), ui.indexOf('function groupCaptured('));
  assert.doesNotMatch(back, /HwatuArt|svg\(/, '뒷면은 카드 정보 없이 그린다');
  // 특수상황별 전용 연출 목록(서로 다른 종류)
  for (const kind of ['ppeok', 'jappeok', 'jjok', 'ttadak', 'sweep', 'bomb', 'kong', 'shake', 'go', 'stop']) assert.match(ui, new RegExp(`\\b${kind}: \\[`), kind);
});

test('v1.8.6 공개 화투 그림: 일반 48장은 public/hwatu/<id>.svg(안전한 SVG, 출처·라이선스 문서 포함), 보너스 2장은 자체 그림', () => {
  const art = loadArt();
  const regular = CARDS.filter(card => !card.id.startsWith('bonus-')).map(card => card.id);
  assert.equal(regular.length, 48);
  assert.deepEqual([...art.publicIds].sort(), [...regular].sort());
  const dir = path.join(__dirname, '..', 'public', 'hwatu');
  for (const id of regular) {
    assert.equal(art.html(id), `<img class="hwatuImg" src="/hwatu/${id}.svg" alt="" draggable="false" decoding="async">`, id);
    const svg = fs.readFileSync(path.join(dir, `${id}.svg`), 'utf8');
    assert.match(svg, /^<svg[^>]*viewBox="0 0 103\.2 168\.2"/, id);
    assert.doesNotMatch(svg, /<script|href=|url\(|<image|<foreignObject|\son[a-z]+=/i, id); // 스크립트·외부 참조 없음
  }
  for (const id of ['bonus-2', 'bonus-3']) assert.equal(art.html(id), art.svg(id), id);
  const license = fs.readFileSync(path.join(dir, 'LICENSE.md'), 'utf8');
  for (const word of ['CC BY-SA 4.0', 'Louie Mantia', 'Marcus Richert', 'Spenĉjo', 'commons.wikimedia.org']) assert.ok(license.includes(word), word);
  for (const id of regular) assert.ok(license.includes(`\`${id}.svg\``), `원본 파일 대응표: ${id}`);
  // 화면 안에서도 출처를 밝힌다(고스톱 규칙 설명).
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  assert.match(app, /화투 그림: Louie Mantia Jr\.·Marcus Richert·Spenĉjo\(Wikimedia Commons, CC BY-SA 4\.0\)/);
});
