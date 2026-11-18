'use strict';
// 1.10.363 메모리: the [mem] line and the 80 % crossing (once going up, again only after falling under 75 %)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { memLine, createMemWatch } = require('../lib/mem-watch');

const MB = 1048576;
const mem = (rss) => ({ rss: rss * MB, heapUsed: 50 * MB, heapTotal: 60 * MB, external: 4 * MB, arrayBuffers: 1 * MB });

test('[mem] 줄: rss·heap·external·arrayBuffers, 한도 대비 %, 가장 큰 Map 8개만(0은 빼고)', () => {
  const sizes = { a: 3, b: 0, c: 10, d: 1, e: 2, f: 4, g: 5, h: 6, i: 7, j: 8 };
  const line = memLine(mem(256), 512, sizes);
  assert.match(line, /^\[mem\] rss 256 heapUsed 50 heapTotal 60 external 4 arrayBuffers 1 MB · 50% of 512 · c=10 j=8 i=7 h=6 g=5 f=4 a=3 e=2$/);
  assert.equal(memLine(mem(100), 512, {}), '[mem] rss 100 heapUsed 50 heapTotal 60 external 4 arrayBuffers 1 MB · 20% of 512');
});

test('80% 넘을 때 한 번, 75% 아래로 내려간 뒤 다시 넘으면 또 한 번; 5분 줄은 늘', () => {
  let rss = 300; const lines = [];
  const w = createMemWatch({ limitMb: 512, read: () => mem(rss), sizes: () => ({ plazaPresence: 12 }), log: (l) => lines.push(l), timers: false });
  assert.equal(w.check(), null);
  rss = 420; assert.match(w.check(), /^\[mem\] over 80% rss 420 .* 82% of 512 · plazaPresence=12$/);
  rss = 450; assert.equal(w.check(), null, '한 번만');
  rss = 390; assert.equal(w.check(), null); rss = 420; assert.equal(w.check(), null, '75% 위에서는 다시 안 셈');
  rss = 370; assert.equal(w.check(), null); rss = 415; assert.ok(w.check(), '75% 아래로 갔다가 다시 넘음');
  assert.match(w.tick(), /^\[mem\] rss 415 /); assert.equal(lines.length, 3);
});

test('sizes가 던져도 줄은 남는다; 서버는 시험 밖에서만 켜고 주요 Map을 넘긴다', () => {
  const w = createMemWatch({ read: () => mem(100), sizes: () => { throw new Error('x'); }, log: () => {}, timers: false });
  assert.match(w.tick(), /^\[mem\] rss 100 /);
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(src, /if \(process\.env\.NODE_ENV !== 'test'\) require\('\.\/lib\/mem-watch'\)\.createMemWatch\(/);
  for (const name of ['sessions', 'plazaPresence', 'plazaLastPos', 'lobbyStreams', 'rateLimits', 'fishCasts']) assert.match(src, new RegExp(`const tracked = \\{[^}]*\\b${name}\\b`), name);
});
