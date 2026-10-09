'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { poseTime } = require('../lib/plaza-pose-time');
test('보간 시각: 고르지 않은 전달 지연에도 전송 간격을 유지하고 잘못된 시각은 서버 시각으로 복구', () => {
  const a = poseTime(10000, 0, 10040);
  const b = poseTime(10125, a, 10420);
  const c = poseTime(10250, b, 10470);
  assert.deepEqual([b - a, c - b], [125, 125]);
  for (const value of [undefined, null, '10125', Infinity, NaN, 1, 99999]) {
    assert.equal(poseTime(value, c, 10500), 10500);
  }
  assert.equal(poseTime(10550, c, 10500), 10500, '미래 시각은 수신 시각까지만');
  assert.equal(poseTime(10200, c, 10500), c + 1, '시계 보정 뒤에도 보간 축은 뒤로 가지 않는다');
});
