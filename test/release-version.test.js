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

  for (const asset of ['styles.css', 'session-lock.js', 'recent-action.js', 'twentyquestions-ui.js', 'gostop-ui.js', 'skin-looks.js', 'skin-art-omok.js', 'skin-art-connect4.js', 'skin-art-othello.js', 'skin-art-yut.js', 'skin-art-dots.js', 'skin-art-bingo.js', 'skin-art-baseball.js', 'skin-art-pictionary.js', 'skin-art-twenty.js', 'skin-art-liar.js', 'skin-art-davinci.js', 'skin-art-oldmaid.js', 'skin-art-halli.js', 'skin-art-gostop.js', 'app.js']) {
    assert.ok(html.includes(`${asset}?v=${version}`), `${asset} 캐시 버전이 package.json과 다릅니다`);
  }
  assert.ok(announcements.includes(`key: 'v${version}'`), '릴리스 공지 키가 package.json과 다릅니다');
  // v1.7.22: the RPG 3D client is a module graph cached for a day, so its import URLs carry the version too
  const appJs = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  const rpgClient = fs.readFileSync(path.join(root, 'public', 'rpg', 'rpg-client.js'), 'utf8');
  assert.ok(appJs.includes(`/rpg/rpg-client.js?v=${version}`), '잿빛 원정 클라이언트 import 버전이 package.json과 다릅니다');
  for (const mod of ['rpg-scene.js', 'rpg-hud.js']) assert.ok(rpgClient.includes(`./${mod}?v=${version}`), `${mod} import 버전이 package.json과 다릅니다`);
  assert.match(announcements, /key: 'v1\.6\.90'[\s\S]*?title: '\[안내\] v1\.6\.90 잿빛 원정 임시 비활성화'/,
    '기존 v1.6.90 공지 이력이 변경되면 안 됩니다');
  assert.match(announcements, /key: 'v1\.6\.91'[\s\S]*?title: '\[안내\] v1\.6\.91 잿빛 원정 게임 구현중 이동'/,
    '게임 구현중 이동은 v1.6.91 독립 공지여야 합니다');
});
