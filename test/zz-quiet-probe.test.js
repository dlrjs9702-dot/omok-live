'use strict';
// 임시(출시 전에 지움): CI(Node 20, TAP)에서 큰 파일에 대한 assert.match 실패가 멈추지 않고 바로 실패로 끝나는지 확인
const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs');
test('임시 확인: app.js에 없는 글자를 찾는 실패는 짧게 보고된다', () => { assert.match(fs.readFileSync(require.resolve('../public/app.js'), 'utf8'), /THIS_IS_NOT_IN_APP_JS_42/); });
