'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain.js');
const P = require('../public/plaza/island-npcs.js');
const { createIslandEvents } = require('../lib/island-events');

// v1.10.13 환경 비주얼: the cottages stand level on standable ground clear of the walks and streams; trees keep out of
// their yards; events and the islanders' walks keep clear of them like any building.
test('주택: 평탄한 땅·길과 물에서 떨어짐, 마당에 나무 없음, 이벤트·주민 경로가 피한다', () => {
  assert.ok(T.COTTAGES.length >= 6);
  for (const c of T.COTTAGES) {
    let lo = Infinity; let hi = -Infinity;
    for (let dx = -2; dx <= 2; dx += 0.5) for (let dz = -2; dz <= 2; dz += 0.5) { const h = T.heightAt(c.x + dx, c.z + dz); lo = Math.min(lo, h); hi = Math.max(hi, h); assert.ok(T.walkable(c.x + dx, c.z + dz)); }
    assert.ok(hi - lo < 0.05, `수평 바닥 ${hi - lo}`);
    assert.ok(T.walkDist(c.x, c.z) > 3.5, '길 위가 아님');
    assert.ok(T.streamDist(c.x, c.z) > 6, '물길에서 떨어짐');
    for (const t of T.nature().trees) assert.ok(Math.hypot(t.x - c.x, t.z - c.z) >= 7, '마당에 나무 없음');
    assert.ok(!P.free(c.x, c.z), '주민 경로가 피한다');
  }
  const ev = createIslandEvents();
  for (const e of ev.events.values()) for (const c of T.COTTAGES) assert.ok(Math.hypot(e.x - c.x, e.z - c.z) >= 7, '이벤트가 주택 위에 생기지 않음');
});
