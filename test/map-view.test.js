'use strict';
// 1.10.370 전체 지도 (사용자 「M 으로 전체 지도 펼칠 수 있게. 확대해서 볼 수도 있게.」): the 안내 지도's middle may go anywhere in the drawn
// world -- 별마루섬 (out to x 530) too, where the old ±200 stopped it -- never so far that only sea shows past an edge
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../public/map-view.js');
const T = require('../public/plaza/island-terrain.js');

test('전체 지도 범위: 별마루섬까지 옮기고 확대할 수 있고, 가장자리 밖 바다만 보이게는 안 감', () => {
  const W = M.WORLD; assert.ok(W.x1 >= 520 && W.z1 >= 380 && W.x0 <= -200 && W.z0 <= -200, '두 섬과 다리가 다 들어감');
  // 별마루섬's far side, its peak and 별지기 느티 inside the world
  const I = T.dalmaru.NEW_ISLE; for (const [x, z] of [[I.peak.x, I.peak.z], [I.x + I.r * 0.9, I.z], [T.ANCIENT.x, T.ANCIENT.z]]) assert.ok(x > W.x0 && x < W.x1 && z > W.z0 && z < W.z1, `${x},${z}`);
  // zoomed in (a window 100 x 70 m): its middle on the peak stays there; past the east coast it stops 50 m in from the edge
  const near = M.clamp({ zoom: 6, x: I.peak.x, z: I.peak.z }, 50, 35); assert.deepEqual([near.x, near.z], [I.peak.x, I.peak.z]);
  const edge = M.clamp({ zoom: 6, x: 900, z: 900 }, 50, 35); assert.deepEqual([edge.x, edge.z], [W.x1 - 50, W.z1 - 35]);
  // the old rule's stop: x 200 at most -- now 별마루섬's middle is reachable at a middle zoom
  const mid = M.clamp({ zoom: 3, x: I.x, z: I.z }, 130, 95); assert.equal(mid.x, I.x); assert.ok(mid.x > 200);
  // zoomed out wider than the world: its middle
  const all = M.clamp({ zoom: 1, x: 400, z: -150 }, 500, 400); assert.deepEqual([all.x, all.z], [(W.x0 + W.x1) / 2, (W.z0 + W.z1) / 2]);
  // the zoom kept in 1..6; opened on me at the reading zoom
  assert.equal(M.clamp({ zoom: 20, x: 0, z: 0 }, 10, 10).zoom, M.ZOOM.MAX); assert.equal(M.clamp({ zoom: 0.2, x: 0, z: 0 }, 10, 10).zoom, M.ZOOM.MIN);
  assert.deepEqual(M.openOn({ x: 300, z: 250 }), { zoom: M.ZOOM.OPEN, x: 300, z: 250 });
});
