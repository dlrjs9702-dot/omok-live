'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

// A4 함께하는 섬: the weather, the stars and the weekend contest keep their checks next to their code (run here)
for (const lib of ['island-weather', 'island-stars', 'island-contest', 'island-plants', 'island-together', 'island-insects', 'island-daily' /* (v1.10.242 주민 날마다 말) */]) {
  test(`${lib}: 모듈 자체 검사`, () => {
    assert.match(execFileSync(process.execPath, [path.join(__dirname, '..', 'lib', `${lib}.js`)], { encoding: 'utf8' }), / ok/);
  });
}
test('contest-lines: 가락 대회 말 자체 검사', () => { /* (v1.10.242) */
  assert.match(execFileSync(process.execPath, [path.join(__dirname, '..', 'public', 'plaza', 'contest-lines.js')], { encoding: 'utf8' }), / ok/);
});
