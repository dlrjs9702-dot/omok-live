'use strict';
// v1.10.291 메신저 사진 확대·축소 (notes docs/messenger-photo-zoom-20261109.md): 1~5배, 가장자리가 화면 안으로 오지 않게, 두 번 톡 2.5배 <-> 1배
const test = require('node:test');
const assert = require('node:assert/strict');
const Z = require('../public/messenger-zoom.js');

test('사진 확대: 1~5배, 가리킨 자리 그대로, 끌기 한도, 두 번 톡 2.5배 ↔ 1배', () => {
  const box = [400, 300, 800, 600]; const one = { s: 1, x: 0, y: 0 };
  assert.deepEqual(Z.zoomAt(one, 9, 0, 0, ...box), { s: 5, x: 0, y: 0 }); assert.deepEqual(Z.zoomAt({ s: 3, x: 50, y: 0 }, 0.2, 0, 0, ...box), one); /* (1~5) */
  const small = [400, 300, 600, 400]; const at = Z.zoomAt(one, 2, 100, 40, ...small); assert.deepEqual(at, { s: 2, x: -100, y: -40 }); /* (the point under (100, 40) stays: 100 - (100 - 0) x 2) */
  assert.deepEqual(Z.panBy(at, 500, -500, ...small), { s: 2, x: 100, y: -100 }); /* (800 x 600 on 600 x 400: 100 each way) */
  assert.deepEqual(Z.zoomAt(one, 2, 100, 40, ...box), { s: 2, x: 0, y: 0 }); /* (2x: the screen's size -- no room either way) */
  const big = Z.zoomAt(one, 4, 0, 0, ...box); assert.deepEqual(Z.panBy(big, 9999, -9999, ...box), { s: 4, x: 400, y: -300 }); /* (edges at the screen's: (1600 - 800) / 2, (1200 - 600) / 2) */
  const tap = Z.toggle(one, 100, 50, ...box); assert.deepEqual(tap, { s: Z.TAP, x: -100, y: -75 }); assert.deepEqual(Z.toggle(tap, 0, 0, ...box), one); /* (2.5x there, then back) */
  assert.deepEqual(Z.clampPan({ s: 1, x: 30, y: -30 }, ...box), one); /* (fitted: centred) */
});
