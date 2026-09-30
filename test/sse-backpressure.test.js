'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { writeUnlessBacklogged } = require('../lib/sse-backpressure');

const fakeResponse = (extra = {}) => {
  const written = [];
  return { written, write(chunk) { written.push(chunk); return true; }, ...extra };
};

test('a ready connection gets the frame', () => {
  const res = fakeResponse();
  assert.equal(writeUnlessBacklogged(res, 'event: rpgTick\n\n'), true);
  assert.deepEqual(res.written, ['event: rpgTick\n\n']);
});

test('a connection whose buffer is full (writableNeedDrain) is skipped, not queued', () => {
  const res = fakeResponse({ writableNeedDrain: true });
  assert.equal(writeUnlessBacklogged(res, 'frame'), false);
  assert.deepEqual(res.written, [], 'nothing is written to a backed-up socket');
  res.writableNeedDrain = false; // it caught up: the next frame goes out again
  assert.equal(writeUnlessBacklogged(res, 'next'), true);
  assert.deepEqual(res.written, ['next']);
});

test('closed or failing connections are skipped without throwing', () => {
  assert.equal(writeUnlessBacklogged(fakeResponse({ destroyed: true }), 'frame'), false);
  assert.equal(writeUnlessBacklogged(fakeResponse({ writableEnded: true }), 'frame'), false);
  assert.equal(writeUnlessBacklogged({ write() { throw new Error('socket closed'); } }, 'frame'), false);
});
