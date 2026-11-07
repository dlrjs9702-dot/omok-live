'use strict';
// v1.10.269 시험 정리 (gamecenter-notes docs/test-audit-20261107.md, messenger :331): the messenger app's own manifest -- its
// own id, start and scope (/messenger, apart from the island's /island/), standalone, every icon there at its size, the page
// pointing at it. The install button and lines stay with the e2e (phone).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pub = path.join(__dirname, '..', 'public');

test('메신저 앱 manifest: /messenger 범위·standalone·아이콘 파일과 크기, 메신저 페이지가 가리킴, 섬 manifest와 따로', () => {
  const m = JSON.parse(fs.readFileSync(path.join(pub, 'messenger.webmanifest'), 'utf8'));
  assert.deepEqual([m.id, m.start_url, m.scope, m.display], ['/messenger', '/messenger', '/messenger', 'standalone']);
  assert.ok(m.icons.some((i) => i.purpose === 'maskable') && m.icons.some((i) => i.sizes === '192x192'));
  for (const icon of m.icons) {
    const png = fs.readFileSync(path.join(pub, icon.src)); assert.equal(png.toString('ascii', 1, 4), 'PNG', icon.src);
    const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)]; assert.equal(`${w}x${h}`, icon.sizes, icon.src);
  }
  assert.match(fs.readFileSync(path.join(pub, 'messenger.html'), 'utf8'), /<link rel="manifest" href="\/messenger\.webmanifest"/);
  const island = JSON.parse(fs.readFileSync(path.join(pub, 'manifest.webmanifest'), 'utf8'));
  assert.equal(island.scope, '/island/'); assert.notEqual(island.id, m.id);
});
