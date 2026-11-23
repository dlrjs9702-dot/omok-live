'use strict';
// assets 181 아이언맨 펫 비행 (사용자 「다리, 팔에서 불꽃 효과를 넣고 날아오게 해」, notes docs/pet-bike-heroes-20261123.md §1)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const scene = fs.readFileSync(path.join(__dirname, '../public/plaza/plaza-scene.js'), 'utf8');
const assets = fs.readFileSync(path.join(__dirname, '../public/plaza/island-assets.js'), 'utf8');
const models = JSON.parse(fs.readFileSync(path.join(__dirname, '../tools/assets/island-models.json'), 'utf8'));

test('181: FlyRepulsor 다시 · Hover 새로 (sha256 고정)', () => {
  const list = models.models || models.entries || Object.values(models).find(Array.isArray);
  const by = Object.fromEntries(list.map((m) => [m.out, m]));
  assert.equal(by['characters/motions/FlyRepulsor.glb'].sha256, '6dbea8791fbd0ad8c237d6291ff49e84ced008dedfc228f0c5d59e5661785d99');
  assert.equal(by['characters/motions/Hover.glb'].sha256, 'bd1ad7803a1909b425cca6630e43a5912dc4a010a8af09d5a689c69cd8e3e224');
  assert.match(by['characters/motions/Hover.glb'].src, /^ironman181:01\. High\/motions\/Hover\.glb$/);
  assert.match(assets, /'Hover'\]; \/\/ \(assets 181/); assert.match(assets, /hover: 'Hover'/);
});

test('181: 불꽃 넷(손 LowerArm→Hand 파랑, 발 LowerLeg→Foot 주황), 느리면 Hover, 속도로 기울기', () => {
  assert.match(scene, /const JET_BONES = \[\['LowerArm\.L', 'Hand\.L', 0\], \['LowerArm\.R', 'Hand\.R', 0\], \['LowerLeg\.L', 'Foot\.L', 1\], \['LowerLeg\.R', 'Foot\.R', 1\]\];/);
  assert.match(scene, /const JET_COLOR = \[\[0x6fd0ff, 0xffffff\], \[0xffb24a, 0xfff3d0\]\];/);
  assert.match(scene, /const JET_FAR = 40; const HOVER_BELOW = 1\.5; const FLY_FAST = 12; const FLY_TILT = \[-25, 15\]/);
  assert.match(scene, /by\[o\.name\.replace\('\.', ''\)\] = o;/); /* (the loader's names have no dot) */
  assert.match(scene, /p\.c\.play\(role === 'flyR' && p\.hover \? 'Hover' : PET_CLIP\[role\]/);
  assert.match(scene, /if \(role === 'flyR'\) flyStep\(p, dt, now\); else flyEnd\(p\);/);
});
