'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { classifyBrowser, parseSecChUa } = require('../public/browser-gate.js');

const UA = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  whale: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Whale/3.28.266.14 Safari/537.36',
  opera: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
};
const brands = (...names) => names.map(brand => ({ brand, version: '130' }));

// v1.10.14 Chrome-only: client hints decide first, the user-agent string only when they are missing.
test('브라우저 판별: Client Hints 브랜드가 있으면 그것으로 Chrome·Edge·기타를 가른다', () => {
  assert.equal(classifyBrowser({ brands: brands('Google Chrome', 'Chromium', 'Not?A_Brand'), ua: UA.chrome }), 'chrome');
  assert.equal(classifyBrowser({ brands: brands('Not)A;Brand', 'Microsoft Edge', 'Chromium'), ua: UA.edge }), 'edge');
  // Edge with a spoofed Chrome user agent is still Edge
  assert.equal(classifyBrowser({ brands: brands('Microsoft Edge', 'Chromium', 'Not A(Brand'), ua: UA.chrome }), 'edge');
  assert.equal(classifyBrowser({ brands: brands('Whale', 'Chromium', 'Not;A=Brand'), ua: UA.chrome }), 'other');
  assert.equal(classifyBrowser({ brands: brands('Brave', 'Chromium', 'Not_A Brand'), ua: UA.chrome }), 'other');
  assert.equal(classifyBrowser({ brands: brands('Opera', 'Chromium', 'Not.A/Brand'), ua: UA.opera }), 'other');
  assert.equal(classifyBrowser({ brands: brands('Chromium', 'Not=A?Brand'), ua: UA.chrome }), 'chromium'); // Playwright
  assert.equal(classifyBrowser({ brands: ['Google Chrome', 'Chromium'] }), 'chrome'); // plain names (from the header)
});

test('브라우저 판별: Client Hints가 없으면 user agent로 보수적으로 판단한다', () => {
  assert.equal(classifyBrowser({ ua: UA.chrome, vendor: 'Google Inc.' }), 'chrome');
  assert.equal(classifyBrowser({ ua: UA.chrome }), 'chrome'); // server side: no vendor
  assert.equal(classifyBrowser({ ua: UA.chrome, vendor: '' }), 'other'); // Chrome token but not Google's engine build
  assert.equal(classifyBrowser({ ua: UA.edge, vendor: 'Google Inc.' }), 'edge');
  assert.equal(classifyBrowser({ ua: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0 Safari/537.36 Edge/18.19045' }), 'edge');
  for (const ua of [UA.whale, UA.opera, UA.firefox, UA.safari, 'node', '']) assert.equal(classifyBrowser({ ua }), 'other', ua);
  assert.equal(classifyBrowser({ brands: [], ua: UA.edge }), 'edge'); // an empty brand list is no hint
  assert.equal(classifyBrowser(), 'other');
});

test('Sec-CH-UA 헤더를 브랜드 목록으로 읽는다', () => {
  assert.deepEqual(parseSecChUa('"Google Chrome";v="130", "Chromium";v="130", "Not?A_Brand";v="99"'), ['Google Chrome', 'Chromium', 'Not?A_Brand']);
  assert.deepEqual(parseSecChUa('"Microsoft Edge";v="130", "Chromium";v="130", "Not_A Brand";v="24"'), ['Microsoft Edge', 'Chromium', 'Not_A Brand']);
  assert.equal(parseSecChUa(undefined), null);
  assert.equal(parseSecChUa('garbage'), null);
});

test('Chrome 전용 서버: Edge·기타는 안내만 받고 입장 파일도 쓰지 않으며, Chrome은 게임과 리소스 목록을 받는다', { timeout: 30_000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'browser-gate-'));
  const port = await new Promise(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
  const proc = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, DATABASE_URL: '', ADMIN_PASSWORD: 'gate-test', NODE_ENV: 'test', ALLOWED_BROWSERS: 'chrome' }, stdio: 'ignore' });
  t.after(async () => {
    if (proc.exitCode === null && proc.signalCode === null) {
      const exited = new Promise(resolve => proc.once('exit', resolve));
      proc.kill('SIGTERM');
      await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 5000).unref())]);
    }
    await fs.rm(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i += 1) { try { if ((await fetch(`${base}/health`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }

  const chrome = { 'User-Agent': UA.chrome, 'Sec-CH-UA': '"Google Chrome";v="130", "Chromium";v="130", "Not?A_Brand";v="99"' };
  const edge = { 'User-Agent': UA.edge, 'Sec-CH-UA': '"Microsoft Edge";v="130", "Chromium";v="130", "Not?A_Brand";v="99"' };
  const edgeSpoofed = { 'User-Agent': UA.chrome, 'Sec-CH-UA': edge['Sec-CH-UA'] };

  for (const headers of [edge, edgeSpoofed, { 'User-Agent': UA.firefox }, { 'User-Agent': UA.whale }]) {
    const res = await fetch(`${base}/`, { headers });
    assert.equal(res.status, 403);
    const html = await res.text();
    assert.match(html, /Google Chrome으로 접속해 주세요/);
    assert.doesNotMatch(html, /assetManifest|app\.js/);
  }
  // A guest entry opened in Edge is answered before the token is even looked at (no session, no key lease).
  const entry = await fetch(`${base}/guest-entry`, { method: 'POST', headers: { ...edge, 'Content-Type': 'application/x-www-form-urlencoded' }, body: `token=${'x'.repeat(40)}` });
  assert.equal(entry.status, 403);
  assert.match(await entry.text(), /Google Chrome/);

  const page = await fetch(`${base}/`, { headers: chrome });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /data-browsers="chrome"/);
  const manifest = JSON.parse(html.match(/<script id="assetManifest" type="application\/json">([^<]*)<\/script>/)[1]);
  assert.match(manifest.version, /^[0-9a-f]{16}$/);
  assert.ok(manifest.assets.some(asset => asset.url === '/hwatu/m01-gwang.svg'));
  // only game resources: no code, no license text
  assert.ok(manifest.assets.every(asset => /^\/(assets|hwatu)\/.+\.(svg|png|glb|gltf|bin|jpe?g|webp|avif)$/.test(asset.url)), JSON.stringify(manifest.assets.map(a => a.url)));
  // the service worker is plain static code, always revalidated so a new deploy's worker is picked up
  const sw = await fetch(`${base}/sw.js`);
  assert.equal(sw.status, 200);
  assert.equal(sw.headers.get('cache-control'), 'no-cache');
});
