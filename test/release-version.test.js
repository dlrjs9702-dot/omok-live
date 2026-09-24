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

  for (const asset of ['styles.css', 'session-lock.js', 'twentyquestions-ui.js', 'app.js']) {
    assert.ok(html.includes(`${asset}?v=${version}`), `${asset} 캐시 버전이 package.json과 다릅니다`);
  }
  assert.ok(announcements.includes(`key: 'v${version}'`), '릴리스 공지 키가 package.json과 다릅니다');
});
