'use strict';
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');

// v1.10.66 홈 화면 앱: the page names a manifest (standalone, the island icons) and iPhone's icon; the server sends the
// manifest as a manifest and every icon it lists as a PNG; v1.10.190 달마루섬 and the tab's favicon.ico (16, 32, 48)
test('홈 화면 앱: manifest와 섬 아이콘을 내보내고 첫 화면이 그것을 가리킨다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'home-app-'));
  rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */
  const { base } = await boot(t, dir);
  const page = await (await fetch(base + '/')).text();
  assert.match(page, /<link rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(page, /<link rel="apple-touch-icon" href="\/icons\/apple-touch-icon\.png"/);
  const res = await fetch(base + '/manifest.webmanifest');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^application\/manifest\+json/);
  const manifest = await res.json();
  assert.equal(manifest.display, 'standalone');
  assert.deepEqual([manifest.id, manifest.start_url, manifest.scope], ['/island/', '/island/', '/island/']); // (v1.10.256 15절)
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'));
  for (const src of [...manifest.icons.map((i) => i.src), '/icons/apple-touch-icon.png']) {
    const icon = await fetch(base + src);
    assert.equal(icon.status, 200, src);
    assert.equal(icon.headers.get('content-type'), 'image/png', src);
    const bytes = Buffer.from(await icon.arrayBuffer());
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG', src);
  }
  assert.match(page, /<link rel="icon" href="\/favicon\.ico"/);
  const ico = Buffer.from(await (await fetch(base + '/favicon.ico')).arrayBuffer());
  assert.deepEqual([ico.readUInt16LE(2), ico.readUInt16LE(4)], [1, 3]); // (an icon, three images)
  assert.deepEqual([0, 1, 2].map((k) => ico[6 + 16 * k]).sort((a, b) => a - b), [16, 32, 48]);
});

// v1.10.256 주소 옮기기 15절: one address, the island app under /island/ (its scope), the messenger /messenger outside it --
// two apps Chrome installs apart; the old ways in go to the new ones (query kept); the hero game's files beside its page
test('주소 15절: / → /island/, 섬·메신저 manifest id·scope 안 겹침, 옛 영웅전 경로 넘김', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'island-path-'));
  rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */
  const { base } = await boot(t, dir);
  const chrome = { 'User-Agent': 'Mozilla/5.0 Chrome/140.0.0.0', 'Sec-CH-UA': '"Google Chrome";v="140"' };
  const go = async (p) => { const r = await fetch(base + p, { redirect: 'manual', headers: chrome }); return [r.status, r.headers.get('location')]; };
  assert.deepEqual(await go('/?room=abc'), [302, '/island/?room=abc']);
  assert.deepEqual(await go('/island'), [301, '/island/']);
  assert.deepEqual(await go('/herosurv/'), [301, '/island/herosurv/']); assert.deepEqual(await go('/herosurv'), [301, '/island/herosurv/']);
  const page = await fetch(base + '/island/', { headers: chrome }); assert.equal(page.status, 200); assert.match(await page.text(), /<link rel="manifest" href="\/manifest\.webmanifest"/);
  assert.equal((await fetch(base + '/island/herosurv/', { headers: chrome })).status, 200);
  assert.equal((await fetch(base + '/island/herosurv/index.audio.worklet.js')).status, 200);
  const island = await (await fetch(base + '/manifest.webmanifest')).json(); const messenger = await (await fetch(base + '/messenger.webmanifest')).json();
  assert.deepEqual([messenger.id, messenger.start_url, messenger.scope], ['/messenger', '/messenger', '/messenger']);
  const inside = (url, scope) => url.startsWith(scope);
  assert.ok(!inside(messenger.start_url, island.scope) && !inside(island.start_url, messenger.scope), '서로의 scope 밖'); // (Chrome: a start_url inside an installed app's scope is 「already installed」)
  assert.ok(inside(new URL(messenger.protocol_handlers[0].url, base).pathname, messenger.scope));
  assert.equal((await fetch(base + '/messenger', { headers: chrome })).status, 200);
});
