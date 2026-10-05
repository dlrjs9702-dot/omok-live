'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pkg = require('../package.json');
const lock = require('../package-lock.json');

test('릴리스 버전 문자열은 패키지·서버·캐시·공지에서 일치한다', () => {
  const version = pkg.version;
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  const announcements = fs.readFileSync(path.join(root, 'lib', 'release-announcements.js'), 'utf8');

  assert.equal(lock.version, version);
  assert.equal(lock.packages[''].version, version);
  assert.ok(server.includes(`version: '${version}'`), 'health 버전이 package.json과 다릅니다');
  assert.ok(server.includes(`게임 서버 v${version} 실행`), '시작 로그 버전이 package.json과 다릅니다');

  // v1.10.23: code URLs carry a content hash the server works out (lib/code-manifest.js); no version strings in the
  // page or in module imports, so a release no longer edits them
  assert.doesNotMatch(html, /\?v=/, 'index.html에 수동 버전 문자열이 남아 있습니다');
  for (const file of ['app.js', 'plaza/plaza-scene.js', 'rpg/rpg-client.js']) {
    const code = fs.readFileSync(path.join(root, 'public', file), 'utf8');
    assert.doesNotMatch(code, /(?:from |import\()'[^']*\?v=/, `${file} import에 수동 버전 문자열이 남아 있습니다`);
  }
  assert.ok(announcements.includes(`key: 'v${version}'`), '릴리스 공지 키가 package.json과 다릅니다');
  assert.match(announcements, /key: 'v1\.6\.90'[\s\S]*?title: '\[안내\] v1\.6\.90 잿빛 원정 임시 비활성화'/,
    '기존 v1.6.90 공지 이력이 변경되면 안 됩니다');
  assert.match(announcements, /key: 'v1\.6\.91'[\s\S]*?title: '\[안내\] v1\.6\.91 잿빛 원정 게임 구현중 이동'/,
    '게임 구현중 이동은 v1.6.91 독립 공지여야 합니다');
});
