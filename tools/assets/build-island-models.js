#!/usr/bin/env node
'use strict';
// v1.10.26 게임 아일랜드 모델 빌드: the finished models (outside this repository, --src) -> the game's files under
// public/assets/island/seasonal-v2, the same way every time:
//  - each source must have the SHA-256 recorded in island-models.json (a changed source is a deliberate config edit),
//  - High: gltfpack `profiles.high` -- meshes merged per material, quantized (KHR_mesh_quantization) and Meshopt
//    compressed (EXT_meshopt_compression); the game loads it with the Meshopt decoder,
//  - Low (entries with `low`: a triangle ratio): `profiles.low` -- the same model simplified, written next to it as
//    `<name>_low.glb` for far copies (asset-loader High/Low LOD),
//  - the results must pass test/glb-budget.test.js (npm test).
// Usage: node tools/assets/build-island-models.js --src "<finished assets folder>" [--only <substring>]
// gltfpack is a pinned devDependency (WebAssembly build), so no native tool has to be installed.
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'island-models.json'), 'utf8'));
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const src = arg('--src');
const only = arg('--only');
if (!src) { console.error('--src "<finished assets folder>" 가 필요합니다'); process.exit(2); }
const gltfpack = path.join(path.dirname(require.resolve('gltfpack/package.json')), 'cli.js');
const lowName = (out) => out.replace(/\.glb$/, '_low.glb');

function pack(input, output, options) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  execFileSync(process.execPath, [gltfpack, '-i', input, '-o', output, ...options], { stdio: 'pipe' });
}

let built = 0;
for (const file of config.files) {
  if (only && !file.out.includes(only)) continue;
  const input = path.join(src, file.src);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex');
  if (sha !== file.sha256) throw new Error(`${file.src}: 원본 SHA-256이 설정과 다릅니다 (${sha})`);
  const output = path.join(root, config.outDir, file.out);
  pack(input, output, config.profiles.high);
  if (file.low) pack(input, path.join(root, config.outDir, lowName(file.out)), config.profiles.low.map((o) => (o === '{ratio}' ? String(file.low) : o)));
  built += 1;
  console.log(`${file.out}${file.low ? ` (+ low ${file.low})` : ''}`);
}
console.log(`${built}개 빌드`);
