'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

// A4 함께하는 섬: the weather, the stars and the weekend contest keep their checks next to their code (run here)
for (const lib of ['island-weather', 'island-stars', 'island-contest', 'island-plants', 'island-together', 'island-insects']) {
  test(`${lib}: 모듈 자체 검사`, () => {
    assert.match(execFileSync(process.execPath, [path.join(__dirname, '..', 'lib', `${lib}.js`)], { encoding: 'utf8' }), / ok/);
  });
}
