'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { revisionOf } = require('../lib/asset-manifest');
const { staticGlb } = require('../test-support/gltf-fixture.js');

// v1.10.15 고품질 에셋 파이프라인 (server side): the glTF loader is served from the three package with its 'three'
// import pointed at the game's own module; model files and their buffers/textures are served with their types and
// join the game resource pack (manifest + revision) like any other asset; ISLAND_ASSETS_OFF reaches the page.
test('3D 에셋: 로더 애드온 제공, glTF 계열 형식 제공·리소스 팩 포함, 개별 비활성화 전달', { timeout: 30_000 }, async t => {
  const root = path.resolve(__dirname, '..');
  const fixtureDir = path.join(root, 'public', 'assets', 'island', `__test-${process.pid}`);
  const files = {
    'box.glb': [staticGlb(), 'model/gltf-binary'],
    'box.gltf': [Buffer.from('{"asset":{"version":"2.0"}}'), 'model/gltf+json'],
    'box.bin': [Buffer.from([1, 2, 3, 4]), 'application/octet-stream'],
    'wood.jpg': [Buffer.from([0xff, 0xd8, 0xff, 0xd9]), 'image/jpeg'],
    'leaf.webp': [Buffer.from('RIFF0000WEBP'), 'image/webp'],
    'stone.avif': [Buffer.from('0000ftypavif'), 'image/avif'],
  };
  fs.mkdirSync(fixtureDir, { recursive: true });
  for (const [name, [body]] of Object.entries(files)) fs.writeFileSync(path.join(fixtureDir, name), body);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'island-asset-serve-'));
  const port = await new Promise(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
  const proc = spawn(process.execPath, ['server.js'], { cwd: root, stdio: 'ignore',
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, DATABASE_URL: '', ADMIN_PASSWORD: 'asset-serve', NODE_ENV: 'test', ISLAND_ASSETS_OFF: 'facility.townhall, character.player' } });
  t.after(async () => {
    if (proc.exitCode === null && proc.signalCode === null) {
      const exited = new Promise(resolve => proc.once('exit', resolve));
      proc.kill('SIGTERM');
      await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 5000).unref())]);
    }
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    try { fs.rmdirSync(path.dirname(fixtureDir)); } catch {} // the island folder too, unless real models are in it
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i += 1) { try { if ((await fetch(`${base}/health`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }

  // the loader and what it imports, with the bare 'three' pointed at the game's module (no import map under the CSP)
  for (const addon of ['loaders/GLTFLoader.js', 'utils/SkeletonUtils.js', 'utils/BufferGeometryUtils.js']) {
    const res = await fetch(`${base}/vendor/three/addons/${addon}`);
    assert.equal(res.status, 200, addon);
    assert.match(res.headers.get('content-type'), /javascript/);
    const code = await res.text();
    assert.doesNotMatch(code, /from 'three'/, addon);
    assert.match(code, /from '\/vendor\/three\/three\.module\.js'/, addon);
  }
  assert.equal((await fetch(`${base}/vendor/three/addons/loaders/DRACOLoader.js`)).status, 404); // allow-list only
  assert.equal((await fetch(`${base}/vendor/three/addons/../../package.json`)).status, 404);

  const page = await (await fetch(`${base}/`)).text();
  const manifest = JSON.parse(page.match(/<script id="assetManifest" type="application\/json">([^<]*)<\/script>/)[1]);
  assert.deepEqual(manifest.assetsOff, ['facility.townhall', 'character.player']);
  const rel = `/assets/island/__test-${process.pid}`;
  for (const [name, [body, type]] of Object.entries(files)) {
    const url = `${rel}/${name}`;
    const entry = manifest.assets.find(a => a.url === url);
    assert.ok(entry, `${url} in the resource pack`);
    assert.equal(entry.rev, revisionOf(body)); assert.equal(entry.size, body.length);
    const res = await fetch(`${base}${url}?rev=${entry.rev}`);
    assert.equal(res.status, 200, url);
    assert.equal(res.headers.get('content-type'), type, url);
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), body, url);
  }
});
