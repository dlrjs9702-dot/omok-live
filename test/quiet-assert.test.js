'use strict';
// test-support/quiet-assert.js (loaded by npm test): a miss on a long string is reported short, and match /
// doesNotMatch still mean what they say -- on Node 20 wrapping the main export's match inverted every match.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../test-support/quiet-assert');

test('긴 문자열: match·doesNotMatch는 그대로, 놓치면 짧게 보고', () => {
  const big = `${'가'.repeat(5000)}needle${'나'.repeat(5000)}`;
  assert.match(big, /needle/); assert.doesNotMatch(big, /haystack/);
  assert.match('short needle', /needle/); assert.doesNotMatch('short', /needle/);
  assert.throws(() => assert.match(big, /haystack/), (e) => e instanceof assert.AssertionError && e.message.length < 600 && /10,006 chars/.test(e.message) && String(e.actual).length < 600);
  assert.throws(() => assert.doesNotMatch(big, /needle/), (e) => e instanceof assert.AssertionError && e.message.length < 600);
  assert.throws(() => assert.match('short', /needle/), assert.AssertionError);
});
