const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain.js');
const X = require('../public/plaza/island-taxi.js');
const V = require('../public/plaza/island-vines.js');
const { compute } = require('../tools/vine-spots.js');

// v1.10.310 덩굴: the list the page draws is the one the ground gives now (a changed ground: node tools/vine-spots.js), hung off
// the taxi's road, the doors, 대청마당 and the stairs, 5 m apart, its top at the edge it hangs from
test('덩굴 자리: 지금 땅으로 다시 만든 목록과 같고, 택시 길·문 앞·대청마당·계단에서 떨어져 있음', { skip: T.MAP !== 'dalmaru' }, () => {
  assert.deepEqual(V.SPOTS, compute(T, X));
  assert.ok(V.SPOTS.length > 40, `${V.SPOTS.length}`);
  const doors = Object.values(T.SPOTS).map((s) => s.face || [s.x, s.z]);
  for (const [kind, x, y, z, yaw, tilt, s] of V.SPOTS) {
    assert.ok(['strands', 'drape'].includes(kind)); assert.ok(tilt >= 0 && tilt < 0.8 && s > 2 && s < 2.5 && Number.isFinite(yaw), `${tilt} ${s}`); /* (총괄 #460: down the face, x2.2) */
    assert.ok(!T.inPlaza(x, z) && !T.onStairs(x, z), `${x},${z}`);
    assert.ok(doors.every(([dx, dz]) => Math.hypot(x - dx, z - dz) > 5), `door ${x},${z}`);
    assert.ok(V.SPOTS.every((o) => o === V.SPOTS.find((p) => p[1] === x && p[3] === z) || Math.hypot(o[1] - x, o[3] - z) > 0.6), `apart ${x},${z}`); /* (side by side on a face: 1.1 m apart along its edge) */
    assert.ok(Number.isFinite(y));
  }
});
