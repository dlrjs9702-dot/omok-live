'use strict';
// v1.10.274 사진 부탁은 주민이 (docs/photo-request-residents-20261108.md 3, notes story/photo-request-lines-20261108.json): each of
// the 27 has two asks, a thanks and a 「not in it」, filled with my name and the spot with nothing left over, and a pose that is
// one of the 263 feelings
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/plaza/island-cast.js');
const E = require('../public/plaza/island-emotes.js');

test('주민 사진 부탁 대사: 27명 × 부탁 2·성공·틀 밖, 빈칸 다 채움, 포즈는 감정 16개 안', () => {
  assert.equal(C.RESIDENTS.length, 27);
  for (let n = 0; n < C.RESIDENTS.length; n += 1) {
    assert.ok(E.BY[C.photoPose(n)], `${n} pose ${C.photoPose(n)}`);
    assert.equal(C.PHOTO_LINES[n].ask.length, 2, `${n}`);
    for (const kind of ['ask', 'ok', 'miss']) for (let k = 0; k < C.PHOTO_LINES[n][kind].length; k += 1) {
      const line = C.photoLine(n, kind, '달빛', () => k / 2 + 0.01, '정자');
      assert.ok(line && !/[{}]/.test(line), `${n} ${kind} ${line}`); assert.ok(!/달빛님님|달빛 님님/.test(line), `${n} ${line}`);
    }
  }
});
