#!/usr/bin/env node
'use strict';
// v1.10.26 게임 아일랜드 모델 빌드: the finished models (outside this repository, --src) -> the game's files under
// public/assets/island, the same way every time:
//  - each source must have the SHA-256 recorded in island-models.json (a changed source is a deliberate config edit),
//  - High: gltfpack `profiles.high` -- meshes merged per material, quantized (KHR_mesh_quantization) and Meshopt
//    compressed (EXT_meshopt_compression); the game loads it with the Meshopt decoder,
//  - Low (entries with `low`: a triangle ratio): `profiles.low` -- the same model simplified, written next to it as
//    `<name>_low.glb` for far copies (asset-loader High/Low LOD); v1.10.29: or `lowSrc`, a far model the artist made
//    (same silhouette, its own SHA-256 `lowSha256`), packed with the High profile,
//  - the results must pass test/glb-budget.test.js (npm test).
// v1.10.29: several finished packages -- `src` is `<source>:<path>`, `<source>` one of config `sources` (a folder
// under --src, the folder that holds the packages; a `src` without one is the first source).
// Usage: node tools/assets/build-island-models.js --src "<asset folder>" [--only <substring>]
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
if (!src) { console.error('--src "<asset folder>" 가 필요합니다'); process.exit(2); }
const gltfpack = path.join(path.dirname(require.resolve('gltfpack/package.json')), 'cli.js');
const lowName = (out) => out.replace(/\.glb$/, '_low.glb');
const first = Object.keys(config.sources)[0];
function source(ref, sha256) {
  const [name, rel] = ref.includes(':') ? ref.split(/:(.*)/s) : [first, ref];
  const file = path.join(src, config.sources[name], rel);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (sha !== sha256) throw new Error(`${ref}: 원본 SHA-256이 설정과 다릅니다 (${sha})`);
  return file;
}

function pack(input, output, options) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  // the WebAssembly gltfpack on Windows Node 24 may die on exit (libuv `UV_HANDLE_CLOSING` assertion) after it has
  // written the file: a run that failed still counts when it wrote a whole GLB (the length in its header) just now
  fs.rmSync(output, { force: true });
  try { execFileSync(process.execPath, [gltfpack, '-i', input, '-o', output, ...options], { stdio: 'pipe' }); } catch (error) {
    const out = fs.existsSync(output) ? fs.readFileSync(output) : null;
    if (!out || out.length < 12 || out.toString('utf8', 0, 4) !== 'glTF' || out.readUInt32LE(8) !== out.length) throw error;
  }
}

let built = 0;
for (const file of config.files) {
  if (only && !file.out.includes(only)) continue;
  const output = path.join(root, config.outDir, file.out);
  const keep = file.args || []; // v1.10.47: e.g. -kn, a model whose named nodes the game moves (a carriage's wheels, doors, seat anchors)
  pack(source(file.src, file.sha256), output, [...config.profiles.high, ...keep]);
  if (file.lowSrc) pack(source(file.lowSrc, file.lowSha256), path.join(root, config.outDir, lowName(file.out)), [...config.profiles.high, ...keep]);
  else if (file.low) pack(source(file.src, file.sha256), path.join(root, config.outDir, lowName(file.out)), config.profiles.low.map((o) => (o === '{ratio}' ? String(file.low) : o)));
  built += 1;
  console.log(`${file.out}${file.lowSrc ? ' (+ low 제작본)' : file.low ? ` (+ low ${file.low})` : ''}`);
}
console.log(`${built}개 빌드`);
