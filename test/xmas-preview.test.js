'use strict';
// 1.10.332 관리자 크리스마스 미리 보기: the 관리실 「섬 환경」 select (this screen only) -- its five choices, the key the island reads
// on start (gc.xmasPreview) the same one the select writes, and the scene's own modes
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('크리스마스 미리 보기: 관리실 선택 다섯(끔·장식·첫 저녁·점등 밤·화이트), 같은 브라우저 저장 이름, 장면 모드', () => {
  const html = read('public/index.html'); const sel = /<select id="xmasPreviewSelect">([\s\S]*?)<\/select>/.exec(html)?.[1] || '';
  assert.deepEqual([...sel.matchAll(/<option value="([a-z]*)">/g)].map((m) => m[1]), ['', 'decor', 'evening', 'night', 'white', 'eve']); /* (1.10.333: the 24th's night, the sleigh) */
  assert.match(html, /미리 보기는 이 화면에만 보여요/);
  const app = read('public/app.js'); assert.equal((app.match(/'gc\.xmasPreview'/g) || []).length >= 3, true, '쓰기·지우기·섬 시작 때 읽기');
  const scene = read('public/plaza/plaza-scene.js'); const modes = /const P = \{ (decor: [^}]*) \}\[mode\]/.exec(scene)?.[1] || '';
  for (const m of ['decor', 'evening', 'night', 'white', 'eve']) assert.match(modes, new RegExp(`${m}: \\[`), m);
  assert.doesNotMatch(app.slice(app.indexOf("byId('xmasPreviewSelect').addEventListener"), app.indexOf("byId('xmasPreviewSelect').addEventListener") + 600), /api\(/, '서버로 보내지 않음');
});
