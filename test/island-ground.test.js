const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain');

test('광장 네 물길: 가장자리에서 급단차 없이 내려가며 물은 얕은 바닥 위·둑 아래에 있다', () => {
  for (const degree of [45, 135, 225, 315]) {
    const angle = degree * Math.PI / 180, x = Math.cos(angle), z = Math.sin(angle);
    for (let r = 14; r < 26; r += 0.05) {
      const slope = Math.abs(T.ground(x * r, z * r) - T.ground(x * (r + 0.05), z * (r + 0.05))) / 0.05;
      assert.ok(slope < 0.4, `${degree}도 ${r.toFixed(2)}m 경사 ${slope}`);
    }
  }
  for (const stream of T.streamCurves) for (const [x, z] of stream) {
    if (T.coastDist(x, z) < 5) continue;
    assert.ok(T.streamWaterHeight(x, z) > T.ground(x, z), '수면이 물길 바닥 위');
    assert.ok(T.streamWaterHeight(x, z) < T.land(x, z), '수면이 둑보다 낮음');
  }
  assert.equal(T.streamDepth(60, 0), 1, '광장 밖 기존 깊이 유지');
  assert.equal(T.heightAt(0, 8), T.PLAZA_H, '시작 위치 유지');
});
