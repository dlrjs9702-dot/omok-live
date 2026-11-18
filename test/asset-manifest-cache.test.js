'use strict';
// 364 켜짐 시간: the asset manifest's size·mtime cache gives the same manifest as hashing everything; a changed file is hashed again
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildAssetManifest } = require('../lib/asset-manifest');

test('캐시: 처음엔 모두 해시, 다음엔 그대로 재사용(같은 목록), 바뀐 파일만 다시, 깨진 캐시는 무시', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'am-cache-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const pub = path.join(dir, 'public'); fs.mkdirSync(path.join(pub, 'assets', 'island'), { recursive: true });
  fs.writeFileSync(path.join(pub, 'assets', 'island', 'a.glb'), 'aaaa'); fs.writeFileSync(path.join(pub, 'assets', 'b.png'), 'bb'); fs.writeFileSync(path.join(pub, 'assets', 'c.js'), 'code');
  const cacheFile = path.join(dir, '.cache', 'asset-manifest.json'); const servable = (ext) => ext !== '.txt';
  const plain = buildAssetManifest(pub, servable);
  const s1 = {}; const first = buildAssetManifest(pub, servable, { cacheFile, stats: s1 });
  assert.deepEqual(first, plain); assert.deepEqual(s1, { hashed: 2, reused: 0 }); assert.ok(fs.existsSync(cacheFile));
  const s2 = {}; assert.deepEqual(buildAssetManifest(pub, servable, { cacheFile, stats: s2 }), plain); assert.deepEqual(s2, { hashed: 0, reused: 2 });
  fs.writeFileSync(path.join(pub, 'assets', 'b.png'), 'bbbb-new'); fs.utimesSync(path.join(pub, 'assets', 'b.png'), new Date(), new Date(Date.now() + 5000));
  const s3 = {}; const third = buildAssetManifest(pub, servable, { cacheFile, stats: s3 });
  assert.deepEqual(s3, { hashed: 1, reused: 1 }); assert.deepEqual(third, buildAssetManifest(pub, servable)); assert.notEqual(third.version, plain.version);
  fs.writeFileSync(cacheFile, '{not json'); const s4 = {}; assert.deepEqual(buildAssetManifest(pub, servable, { cacheFile, stats: s4 }), third); assert.equal(s4.hashed, 2);
});

test('npm install이 캐시를 데우고, 서버는 시험 밖에서만 캐시를 쓴다', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.postinstall, 'node tools/warm-asset-manifest.js');
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(src, /cacheFile: process\.env\.NODE_ENV === 'test' \? null : path\.join\(__dirname, '\.cache', 'asset-manifest\.json'\)/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8'), /^\.cache\/$/m);
});
