'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildAssetManifest, revisionOf } = require('../lib/asset-manifest');

// v1.10.14 resource pack: a file's revision follows its content only, so a patch changes exactly the edited files.
test('리소스 매니페스트: 파일별 내용 해시, 바뀐 파일만 revision이 바뀌고 지운 파일은 빠진다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-manifest-'));
  try {
    fs.mkdirSync(path.join(dir, 'assets', 'island'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'hwatu'));
    fs.writeFileSync(path.join(dir, 'assets', 'island', 'tree.svg'), '<svg>tree</svg>');
    fs.writeFileSync(path.join(dir, 'assets', 'rock.png'), 'png');
    fs.writeFileSync(path.join(dir, 'assets', 'loader.js'), 'code'); // code is never a pack asset
    fs.writeFileSync(path.join(dir, 'hwatu', 'LICENSE.md'), 'text'); // no static content type
    fs.writeFileSync(path.join(dir, 'hwatu', 'm01.svg'), '<svg>m01</svg>');
    fs.writeFileSync(path.join(dir, 'other.svg'), '<svg/>'); // outside the pack folders
    const servable = ext => ['.svg', '.png', '.js'].includes(ext);

    const first = buildAssetManifest(dir, servable);
    assert.deepEqual(first.assets.map(a => a.url), ['/assets/island/tree.svg', '/assets/rock.png', '/hwatu/m01.svg']);
    assert.deepEqual(first.assets[0], { url: '/assets/island/tree.svg', rev: revisionOf(Buffer.from('<svg>tree</svg>')), size: 15, group: 'island' });
    assert.deepEqual(buildAssetManifest(dir, servable), first, '같은 파일이면 같은 결과');

    fs.writeFileSync(path.join(dir, 'assets', 'island', 'tree.svg'), '<svg>tree v2</svg>');
    fs.rmSync(path.join(dir, 'assets', 'rock.png'));
    const second = buildAssetManifest(dir, servable);
    assert.notEqual(second.version, first.version);
    assert.deepEqual(second.assets.map(a => a.url), ['/assets/island/tree.svg', '/hwatu/m01.svg']);
    assert.notEqual(second.assets[0].rev, first.assets[0].rev);
    assert.equal(second.assets[1].rev, first.assets[2].rev, '바뀌지 않은 파일은 같은 revision');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// v1.10.25 groups: logical groups in the one file cache; the island (every season and the common files of every
// registered model) is required before the game starts, a game's files are not
test('리소스 매니페스트 그룹: 아일랜드 등록 모델 파일은 4계절 모두 누락 없이 필수 island 그룹, 게임 리소스는 게임 그룹', () => {
  const { groupOf, REQUIRED_GROUPS } = require('../lib/asset-manifest');
  const { REGISTRY } = require('../public/plaza/island-assets.js');
  const manifest = buildAssetManifest(path.join(__dirname, '..', 'public'), ext => ['.svg', '.png', '.glb'].includes(ext));
  assert.deepEqual(manifest.required, REQUIRED_GROUPS);
  assert.ok(REQUIRED_GROUPS.includes('island') && REQUIRED_GROUPS.includes('core'));
  const byUrl = new Map(manifest.assets.map(a => [a.url, a]));
  const urls = new Set();
  for (const entry of Object.values(REGISTRY)) {
    if (entry.url) urls.add(entry.url);
    for (const url of Object.values(entry.seasons || {})) urls.add(url);
  }
  assert.ok(urls.size >= 32);
  for (const url of urls) {
    assert.ok(byUrl.has(url), `${url} 매니페스트에 있음`);
    assert.equal(byUrl.get(url).group, 'island', url);
  }
  for (const season of ['spring', 'summer', 'autumn', 'winter']) assert.ok([...urls].some(u => u.includes(`/${season}/`)), season);
  assert.ok(manifest.assets.filter(a => a.url.startsWith('/assets/island/')).every(a => a.group === 'island'));
  assert.ok(manifest.assets.filter(a => a.url.startsWith('/hwatu/')).every(a => a.group === 'game.gostop'));
  assert.equal(groupOf('/assets/halli/banana.svg'), 'game.halligalli');
  assert.equal(groupOf('/assets/davinci/table.svg'), 'game.davinci');
  assert.equal(groupOf('/assets/ui/icon.svg'), 'core');
});

test('리소스 매니페스트: 실제 public 폴더의 게임 리소스를 담는다', () => {
  const manifest = buildAssetManifest(path.join(__dirname, '..', 'public'), ext => ['.svg', '.png'].includes(ext));
  assert.equal(manifest.assets.filter(a => a.url.startsWith('/hwatu/')).length, 48);
  assert.ok(manifest.assets.some(a => a.url === '/assets/halli/banana.svg'));
  for (const asset of manifest.assets) assert.match(asset.rev, /^[0-9a-f]{16}$/);
});

// v1.10.14 emergency off switch: ASSET_CACHE=off (Render environment, no code change) gives every page the "off"
// manifest and tells leftover workers to remove themselves; both answers are never cached.
test('긴급 비활성화 스위치: ASSET_CACHE=off면 페이지와 /asset-cache.json이 꺼짐을 알린다', { timeout: 30_000 }, async t => {
  const net = require('node:net');
  const { spawn } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-off-'));
  const port = await new Promise(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
  const proc = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, DATABASE_URL: '', ADMIN_PASSWORD: 'off-test', NODE_ENV: 'test', ASSET_CACHE: 'off' }, stdio: 'ignore' });
  t.after(async () => {
    if (proc.exitCode === null && proc.signalCode === null) {
      const exited = new Promise(resolve => proc.once('exit', resolve));
      proc.kill('SIGTERM');
      await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 5000).unref())]);
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i += 1) { try { if ((await fetch(`${base}/health`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }

  const flag = await fetch(`${base}/asset-cache.json`);
  assert.equal(flag.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await flag.json(), { enabled: false, version: '' });
  const page = await fetch(`${base}/`);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  const manifest = JSON.parse((await page.text()).match(/<script id="assetManifest" type="application\/json">([^<]*)<\/script>/)[1]);
  assert.deepEqual(manifest, { enabled: false, version: '', assets: [], assetsOff: [] });
});

// Directory enumeration and a file read are separate operations: concurrent cleanup must not break other servers.
test('리소스 매니페스트: 열거 뒤 사라진 임시 파일만 생략하고 나머지 파일은 보존한다', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-vanish-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const assets = path.join(dir, 'assets'); fs.mkdirSync(assets);
  fs.writeFileSync(path.join(assets, 'gone.png'), 'temporary'); fs.writeFileSync(path.join(assets, 'kept.png'), 'kept');
  const readDirectory = fs.readdirSync;
  t.mock.method(fs, 'readdirSync', (p, options) => { const names = readDirectory(p, options); if (p === assets) fs.rmSync(path.join(assets, 'gone.png'), { force: true }); return names; });
  assert.deepEqual(buildAssetManifest(dir, () => true).assets.map((a) => a.url), ['/assets/kept.png']);
});
