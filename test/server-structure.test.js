'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// v1.10.31: a second top-level `function` of the same name in server.js silently replaces the first (it happened: a new
// broadcastLobby(type, data) took the place of the lobby/chat broadcast and chat bubbles stopped)
test('server.js: 최상위 함수 이름이 겹치지 않는다', () => {
  const names = [...fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8').matchAll(/^(?:async )?function\s+([A-Za-z0-9_$]+)/gm)].map((m) => m[1]);
  const twice = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepEqual(twice, []);
});
