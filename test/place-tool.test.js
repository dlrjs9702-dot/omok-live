'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../public/plaza/island-home.js');
const Y = require('../public/plaza/island-yard.js');

// v1.10.232 배치 도구 (docs/place-tool-20261103.md): a floor point -> its step (the house 0.25 m, a top 0.05 m, the yard
// YARD.STEP); a wall piece near a wall turns its back to it and stands flush (what placeError takes); a point -> the piece there
test('배치 도구 계산: 칸 맞춤, 탁자 위, 벽 붙이기, 누른 자리의 가구', () => {
  const stage = 2; const st = H.stageOf(stage);
  const chair = H.aimAt({ uid: 'c', id: 'armchair__oak', rot: 0 }, 0.61, -0.38, stage, []);
  assert.deepEqual([chair.x, chair.z], [0.5, -0.5]); assert.equal(H.placeError(chair, [], stage), null);
  // a wall piece: by the back wall -> rot 0, flush; by the +x wall -> rot 1; far from walls -> as it was (red, its reason)
  for (const [lx, lz, rot] of [[1.13, st.hz - 0.3, 0], [st.hx - 0.2, 0.4, 1], [-st.hx + 0.5, -1.1, 3]]) {
    const f = H.aimAt({ uid: 'f', id: 'picture_frame__oak', rot: 0 }, lx, lz, stage, []);
    assert.equal(f.rot, rot, `${lx},${lz}`); assert.equal(H.placeError(f, [], stage), null, `${lx},${lz} ${JSON.stringify(f)}`);
  }
  const mid = H.aimAt({ uid: 'f', id: 'picture_frame__oak', rot: 0 }, 0, 0, stage, []); assert.ok(H.placeError(mid, [], stage), '벽에서 먼 자리는 못 놓음');
  // on a desk: 0.05 m steps, lifted to its top; off it: the floor's 0.25 m
  const desk = { uid: 'd', id: 'desk__oak', rot: 0, x: 0, z: 0 };
  const radio = H.aimAt({ uid: 'r', id: 'radio__oak', rot: 0 }, 0.12, 0.07, stage, [desk]);
  assert.deepEqual([radio.x, radio.z, H.liftOf(radio, [desk])], [0.1, 0.05, H.TOPS.desk]); assert.equal(H.placeError(radio, [desk], stage), null);
  const floorRadio = H.aimAt({ uid: 'r', id: 'radio__oak', rot: 0 }, 2.13, 2.07, stage, [desk]); assert.deepEqual([floorRadio.x, floorRadio.z, H.liftOf(floorRadio, [desk])], [2.25, 2, 0]);
  // the piece at a point: the thing on the desk before the desk, the desk round it, nothing elsewhere
  assert.equal(H.pieceAt([desk, radio], 0.1, 0.05).uid, 'r'); assert.equal(H.pieceAt([desk, radio], -0.4, 0.1).uid, 'd'); assert.equal(H.pieceAt([desk, radio], 3, 3), null);
  // the yard: its own step, the same calls
  const y = Y.aimAt({ uid: 'y', id: 'yard_bench__plain', rot: 1 }, 1.13, -2.4); assert.deepEqual([y.x, y.z, y.rot], [Y.snap(1.13), Y.snap(-2.4), 1]);
  assert.equal(Y.pieceAt([y], y.x + 0.1, y.z).uid, 'y'); assert.equal(Y.pieceAt([y], 6, 6), null);
});
