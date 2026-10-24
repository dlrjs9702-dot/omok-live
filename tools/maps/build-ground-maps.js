'use strict';
// 섬 땅 지도 그림 (gamecenter-notes docs/terrain-paint-design-20261025.md, 사용자 「그림 파일로 가자」): the island's ground maps,
// made from the island's own data (island-terrain.js, island-paths.js) and kept as PNGs the game only reads --
//   public/assets/island/ground-v2/path-a.png, path-b.png, cover-a.png, cover-b.png (1024 x 1024 RGB, row 0 = north)
// Run after changing the walks or the ground's rules: node tools/maps/build-ground-maps.js
// (test/ground-maps.test.js builds them again and compares the bytes: a change without a new build fails)
const fs = require('node:fs'); const path = require('node:path');
const T = require('../../public/plaza/island-terrain.js');
globalThis.IslandTerrain = T;
const Paths = require('../../public/plaza/island-paths.js');
const { buildCoverMaps } = require('./ground-cover.js');
const { encodeRgb } = require('./png.js');
const { buildShoreMap } = require('./shore.js');

const RES = 1024;
const OUT = path.join(__dirname, '..', '..', 'public', 'assets', 'island', 'ground-v2');
function buildAll(res = RES) {
  const p = Paths.buildPathMaps(T, res); const c = buildCoverMaps(T, res);
  for (let k = 0; k < res * res; k += 1) p.b[k * 3 + 2] = c.gravel[k];
  return { 'path-a.png': encodeRgb(p.a, res, res), 'path-b.png': encodeRgb(p.b, res, res), 'cover-a.png': encodeRgb(c.a, res, res), 'cover-b.png': encodeRgb(c.b, res, res), 'shore.png': encodeRgb(buildShoreMap(T, res), res, res) };
}
module.exports = { buildAll, OUT };

if (require.main === module) {
  const t = Date.now(); const files = buildAll(); fs.mkdirSync(OUT, { recursive: true });
  for (const [name, bytes] of Object.entries(files)) { fs.writeFileSync(path.join(OUT, name), bytes); console.log(`${name}: ${(bytes.length / 1024).toFixed(0)} KB`); }
  console.log(`${((Date.now() - t) / 1000).toFixed(1)} s`);
}
