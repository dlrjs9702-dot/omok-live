'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');

// v1.10.66 홈 화면 앱: the page names a manifest (standalone, the island icons) and iPhone's icon; the server sends the
// manifest as a manifest and every icon it lists as a PNG
test('홈 화면 앱: manifest와 섬 아이콘을 내보내고 첫 화면이 그것을 가리킨다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'home-app-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const { base } = await boot(t, dir);
  const page = await (await fetch(base + '/')).text();
  assert.match(page, /<link rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(page, /<link rel="apple-touch-icon" href="\/icons\/apple-touch-icon\.png"/);
  const res = await fetch(base + '/manifest.webmanifest');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^application\/manifest\+json/);
  const manifest = await res.json();
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'));
  for (const src of [...manifest.icons.map((i) => i.src), '/icons/apple-touch-icon.png']) {
    const icon = await fetch(base + src);
    assert.equal(icon.status, 200, src);
    assert.equal(icon.headers.get('content-type'), 'image/png', src);
    const bytes = Buffer.from(await icon.arrayBuffer());
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG', src);
  }
});
