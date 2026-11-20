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
  const commit = process.env.RENDER_GIT_COMMIT; delete process.env.RENDER_GIT_COMMIT; t.after(() => { if (commit === undefined) delete process.env.RENDER_GIT_COMMIT; else process.env.RENDER_GIT_COMMIT = commit; });
  const counts = (s) => ({ hashed: s.hashed, reused: s.reused, cache: s.cache });
  const plain = buildAssetManifest(pub, servable);
  const s1 = {}; const first = buildAssetManifest(pub, servable, { cacheFile, stats: s1 });
  assert.deepEqual(first, plain); assert.deepEqual(counts(s1), { hashed: 2, reused: 0, cache: 'none' }); assert.ok(fs.existsSync(cacheFile));
  const s2 = {}; assert.deepEqual(buildAssetManifest(pub, servable, { cacheFile, stats: s2 }), plain); assert.deepEqual(counts(s2), { hashed: 0, reused: 2, cache: 'kept' });
  fs.writeFileSync(path.join(pub, 'assets', 'b.png'), 'bbbb-new'); fs.utimesSync(path.join(pub, 'assets', 'b.png'), new Date(), new Date(Date.now() + 5000));
  const s3 = {}; const third = buildAssetManifest(pub, servable, { cacheFile, stats: s3 });
  assert.deepEqual(counts(s3), { hashed: 1, reused: 1, cache: 'kept' }); assert.deepEqual(third, buildAssetManifest(pub, servable)); assert.notEqual(third.version, plain.version);
  fs.writeFileSync(cacheFile, '{not json'); const s4 = {}; assert.deepEqual(buildAssetManifest(pub, servable, { cacheFile, stats: s4 }), third); assert.equal(s4.hashed, 2); assert.equal(s4.cache, 'broken');
});

test('385: 같은 커밋(RENDER_GIT_COMMIT)에서 만든 목록은 파일 시각이 바뀌어도 크기가 같으면 그대로, 다른 커밋·크기가 다르면 다시 해시', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'am-commit-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const commit = process.env.RENDER_GIT_COMMIT; t.after(() => { if (commit === undefined) delete process.env.RENDER_GIT_COMMIT; else process.env.RENDER_GIT_COMMIT = commit; });
  const pub = path.join(dir, 'public'); fs.mkdirSync(path.join(pub, 'assets'), { recursive: true });
  const a = path.join(pub, 'assets', 'a.glb'); const b = path.join(pub, 'assets', 'b.png'); fs.writeFileSync(a, 'aaaa'); fs.writeFileSync(b, 'bb');
  const cacheFile = path.join(dir, '.cache', 'asset-manifest.json'); const servable = () => true;
  process.env.RENDER_GIT_COMMIT = 'c1'; const built = buildAssetManifest(pub, servable, { cacheFile, stats: {} }); /* (the build) */
  const later = new Date(Date.now() + 60000); fs.utimesSync(a, later, later); fs.utimesSync(b, later, later); /* (the upload: new mtimes) */
  const s1 = {}; assert.deepEqual(buildAssetManifest(pub, servable, { cacheFile, stats: s1 }), built); assert.deepEqual([s1.hashed, s1.reused, s1.sameCommit], [0, 2, true], '같은 커밋: 시각 무시');
  process.env.RENDER_GIT_COMMIT = 'c2'; const s2 = {}; buildAssetManifest(pub, servable, { cacheFile, stats: s2 }); assert.deepEqual([s2.hashed, s2.sameCommit], [2, false], '다른 커밋: 다시 해시');
  fs.writeFileSync(b, 'bb-longer'); const s3 = {}; const changed = buildAssetManifest(pub, servable, { cacheFile, stats: s3 }); assert.equal(s3.hashed, 1, '같은 커밋이어도 크기가 다르면 다시'); assert.notEqual(changed.version, built.version);
});

test('npm install이 캐시를 데우고, 서버는 시험 밖에서만 캐시를 쓴다', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.postinstall, 'node tools/warm-asset-manifest.js && node tools/warm-boot-cache.js'); /* (385: and the island's scenery and walk grid) */
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(src, /cacheFile: process\.env\.NODE_ENV === 'test' \? null : path\.join\(__dirname, '\.cache', 'asset-manifest\.json'\)/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8'), /^\.cache\/$/m);
});
