'use strict';
// assets 182 스파이더맨 펫 끌려오기 (사용자 결정 85 A, notes docs/pet-bike-heroes-20261123.md §2-3 A)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const scene = fs.readFileSync(path.join(__dirname, '../public/plaza/plaza-scene.js'), 'utf8');
const assets = fs.readFileSync(path.join(__dirname, '../public/plaza/island-assets.js'), 'utf8');
const models = JSON.parse(fs.readFileSync(path.join(__dirname, '../tools/assets/island-models.json'), 'utf8'));

test('182: WebSki 동작 (sha256 고정), 자전거의 연 역할 클립', () => {
  const list = models.models || models.entries || Object.values(models).find(Array.isArray);
  const m = list.find((x) => x.out === 'characters/motions/WebSki.glb');
  assert.equal(m.sha256, '1b40981e58f92195d82f9cf2fd069bcfee84d1dc361ff03e4d9b5498b6c078df'); assert.match(m.src, /^webski182:01\. High\/motions\/WebSki\.glb$/);
  assert.match(assets, /'WebSki'\]; \/\/ \(assets 182/); assert.match(assets, /webSki: 'WebSki'/);
  assert.match(scene, /kite: 'WebSki', glide:/); assert.match(scene, /WebSki: 'webSki'/);
});

test('182: 고리에서 1.9 m 줄로 끌려옴 -- 땅 위, 고리를 봄, 곧은 길 좌우 0.4 m, 초속 1 m 아래면 서서 줄이 처짐', () => {
  assert.match(scene, /const WEB_LEN = 1\.9; const WEB_HOLD = \[0, 0\.7293, 0\];/);
  assert.match(scene, /const WEB_SWAY = 0\.4; const WEB_SWAY_S = 2\.6; const WEB_STILL = 1; const WEB_SAG = 0\.1;/);
  assert.match(scene, /const hook = b\.localToWorld\(petV\.set\(\.\.\.BIKE\.hook\)\);/);
  assert.match(scene, /r\.y = lift\(r\);\r?\n\s+p\.c\.root\.rotation\.y = Math\.atan2\(-\(hook\.x - r\.x\), -\(hook\.z - r\.z\)\)/);
  assert.match(scene, /p\.c\.play\(going \? PET_CLIP\.kite : 'Idle'\)/);
  assert.doesNotMatch(scene, /KITE_AT|KITE_SIDE/); /* (the kite's fixed place in the bike's frame is gone) */
});
