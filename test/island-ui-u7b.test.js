'use strict';
// 1.10.422 U7 part 2 (notes docs/ui-review-20261121.md §2-D D1 · D2): the first visit one window at a time (the 캐릭터 선택 first, a new
// player not told of the old keys), the top middle one 띠 and one note line under the row (event chips, then a toast or the first
// visit's keys band -- never both); a phone's 할 일 in the row's column
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../public/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

test('U7 D2 마크업: 위 줄 안 대회 띠 다음에 알림 줄(행사 칩이 그 안)', () => {
  const row = html.match(/<div id="islandTopRow"[\s\S]*?<div id="islandNoteLine" class="islandNoteLine"><div id="islandEventLine"[^>]*><\/div><\/div>\s*<\/div>/);
  assert.ok(row, 'the note line closes the top row, the event chips inside it');
  assert.ok(row[0].indexOf('id="contestBar"') < row[0].indexOf('id="islandNoteLine"'), 'the 대회 띠 first');
  assert.equal((html.match(/id="islandEventLine"/g) || []).length, 1);
});

test('U7 D2 자리: 알림은 섬에서 알림 줄로, 조작 띠도 그 줄로, 알림이 뜨면 조작 띠는 숨김', () => {
  assert.match(app, /const home = document\.body\.classList\.contains\('plazaMode'\) \? document\.getElementById\('islandNoteLine'\) : document\.body; if \(toast\.parentElement !== home\) home\.append\(toast\);/);
  assert.match(app, /bar\.append\(words, more, x\); byId\('islandNoteLine'\)\.append\(bar\);/);
  for (const s of ['.islandNoteLine{flex:0 0 100%;display:flex;flex-direction:column;align-items:center', '.islandNoteLine:has(>.toast:not(.hidden))>.controlsHint{display:none}', 'body.plazaMode .islandNoteLine>.toast{position:static', '.islandTopRow>.questTracker{position:static;flex:0 0 100%']) assert.ok(css.replace(/\s*([{}:;,>()])\s*/g, '$1').replace(/;\}/g, '}').includes(s), s);
  assert.doesNotMatch(css, /\.controlsHint\s*\{[^}]*position:\s*absolute/, 'the band in the flow, not over the 대회 띠');
  assert.match(app, /if \(touchIsland\) byId\('islandTopRow'\)\.insertBefore\(byId\('questTracker'\), byId\('islandNoteLine'\)\);/);
});

test('U7 D2 조작 띠는 처음 방문(그 탭) 한 번만', () => {
  assert.match(app, /sessionStorage\.setItem\('gc\.hintVisit', String\(since\)\); \} if \(sessionStorage\.getItem\('gc\.hintVisit'\) !== String\(since\)\) return;/);
  assert.doesNotMatch(app, /3 \* 86400000 \|\| byId\('controlsHint'\)/);
});

test('U7 D1 첫 방문 창 하나씩: 캐릭터 선택 다음에, 새로 온 사람에겐 「조작이 바뀌었어요」 없음, 공지도 기다림', () => {
  assert.match(app, /function whenNoWindow\(fn\) \{ const open = document\.querySelector\('dialog\[open\]'\); if \(!open\) \{ fn\(\); return; \} open\.addEventListener\('close'/);
  assert.match(app, /setTimeout\(\(\) => showControlsNotice\(skins\), 0\);/);
  assert.match(app, /if \(sessionRole !== 'admin' && !avatar\.look\?\.gender\) \{ try \{ localStorage\.setItem\('gc\.controlsNotice', '217'\); \} catch \{\} return; \}/);
  assert.match(app, /if \(document\.querySelector\('dialog\[open\]'\)\) \{ whenNoWindow\(\(\) => \{ if \(document\.body\.classList\.contains\('plazaMode'\)\) showControlsNotice\(\); \}\); return; \}/);
  assert.match(app, /async function islandNoticeOnce\(\) \{\s*if \(!document\.body\.classList\.contains\('plazaMode'\)\) return;\s*if \(document\.querySelector\('dialog\[open\]'\)\) \{ whenNoWindow\(islandNoticeOnce\); return; \}/);
});
