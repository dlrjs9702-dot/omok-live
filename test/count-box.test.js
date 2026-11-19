'use strict';
// 1.10.370 개수 칸 (사용자 「개수 딱 내가 몇개인지 쓸 수 있는 칸 추가해.」): what is typed into the box -> the count, kept in 1..max;
// 0 or empty takes the row away; what is not a number keeps the count it had
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/count-box.js');

test('개수 칸: 1~최대로 맞추고, 0이나 빈 칸은 빼기, 숫자가 아니면 그대로', () => {
  assert.equal(C.parse('37', 823), 37); assert.equal(C.parse(' 3 7 ', 823), 37); assert.equal(C.parse('1,000', 823), 823, '최대로');
  assert.equal(C.parse('900', 823), 823); assert.equal(C.parse('1', 1), 1);
  assert.equal(C.parse('', 10), 0, '빈 칸은 빼기'); assert.equal(C.parse('0', 10), 0); assert.equal(C.parse('000', 10), 0);
  assert.equal(C.parse('abc', 10, 4), 4, '숫자가 아니면 그대로'); assert.equal(C.parse('-3', 10, 4), 4); assert.equal(C.parse('2.5', 10, 4), 4);
  assert.equal(C.parse('３７', 99), 37, '전각 숫자'); assert.equal(C.parse('5', 0), 1, '최대가 없으면 1');
});
