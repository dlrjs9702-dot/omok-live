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
  for (const [kind, x, y, z] of V.SPOTS) {
    assert.ok(['strands', 'drape'].includes(kind));
    assert.ok(!T.inPlaza(x, z) && !T.onStairs(x, z), `${x},${z}`);
    assert.ok(doors.every(([dx, dz]) => Math.hypot(x - dx, z - dz) > 5), `door ${x},${z}`);
    assert.ok(V.SPOTS.every((o) => o[1] === x && o[3] === z || Math.hypot(o[1] - x, o[3] - z) > 4), `apart ${x},${z}`);
    assert.ok(Number.isFinite(y));
  }
});
