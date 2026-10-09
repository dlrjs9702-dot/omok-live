'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

// v1.8.8 3D 광장 로비 V1: the plaza is its own scene (no RPG coupling, no outside assets) and every facility the
// confirmed design lists opens an existing lobby UI.
test('광장 로비: 별도 장면, 외부 에셋 없음, 확정된 시설이 모두 기존 UI로 연결된다', () => {
  const scene = read('public/plaza/plaza-scene.js');
  const imports = [...scene.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1].replace(/\?v=.*/, ''));
  assert.deepEqual(imports, ['/vendor/three/three.module.js', './island.js', './island-halloween.js', './island-townhall.js', './island-train-scene.js', './occlusion.js', './camera-motion.js'], '광장은 로컬 섬 장면 모듈만 가져온다');
  assert.deepEqual([...read('public/plaza/occlusion.js').matchAll(/^import .* from '([^']+)'/gm)].map(m => m[1]), ['/vendor/three/three.module.js']);
  for (const f of ['public/plaza/island-townhall.js']) assert.deepEqual([...read(f).matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]), ['/vendor/three/three.module.js', './island.js']);
  const decor = read('public/plaza/island-halloween.js');
  assert.deepEqual([...decor.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]), ['/vendor/three/three.module.js', './island.js']);
  assert.doesNotMatch(decor, /https?:\/\//, '외부 주소 없음');
  assert.doesNotMatch(scene, /https?:\/\//, '외부 주소 없음');
  const island = read('public/plaza/island.js');
  assert.deepEqual([...island.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]), ['/vendor/three/three.module.js']);
  assert.doesNotMatch(island, /https?:\/\//, '외부 주소 없음');
  assert.doesNotMatch(read('public/rpg/rpg-scene.js'), /plaza/, 'RPG 장면은 광장을 모른다');

  const app = read('public/app.js');
  const facilities = app.match(/const PLAZA_FACILITIES = \[([\s\S]*?)\n {2}\];/)[1];
  const ids = [...facilities.matchAll(/id: '([a-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(ids.sort(), ['accessories', 'admin', 'attendance', 'avatar', 'board', 'climb', 'donate', 'dye', 'faces', 'games', 'hair', 'map', 'missions', 'naming', 'records', 'shop', 'townhall', 'trader']);
  const terrain = read('public/plaza/island-terrain.js'); // v1.10.7: the facility spots moved with the island's shape
  for (const id of ids) assert.match(terrain, new RegExp(`\\b${id}: \\{ x:`), `${id} 시설 배치(게임 아일랜드)`);
  for (const target of ['openSkinShop', 'missionBtn', 'attendanceBtn', 'myRecordsCard', 'announcementsCard', 'publicRoomsCard', 'lobbyCard']) {
    assert.match(facilities + app.match(/const publicRoomsCardEl = .*/)[0], new RegExp(target), `${target} 재사용`);
  }

  const html = read('public/index.html');
  assert.match(html, /<section id="plazaStage" class="plazaStage hidden"/);
  assert.match(html, /<dialog id="plazaDialog" class="recordsDialog plazaDialog"/);
  assert.doesNotMatch(html, /id="lobbyModeBtn"/);
  assert.match(html, /id="adminWindowBtn"[^>]*>관리자 창<\/button>/);
  assert.match(html, /id="myInfoBtn"[^>]*>내 정보<\/button>/);
  assert.match(html, /id="logoutBtn"[^>]*>접속 종료<\/button>/);
  assert.match(html, /<dialog id="myInfoDialog"/);
  assert.match(html, /id="myInfoSkinBody"/);
  assert.match(app, /navigator\.webdriver && localStorage\.getItem\('gc\.testClassic'\) === '1'/);
});
