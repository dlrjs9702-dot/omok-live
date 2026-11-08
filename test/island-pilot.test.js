const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain.js');
const P = require('../public/plaza/island-pilot.js');

// v1.10.275 그래픽 시범: the patch is laid out the same on every screen, in the patch, west of the path, off the plaza and
// clear of every tree and rock (nothing in it is solid -- so nothing may stand in a solid one)
test('그래픽 시범 구역: 같은 배치, 구역 안·길 서쪽·광장 밖, 나무·바위와 떨어짐, 종류마다 정한 수', { skip: T.MAP !== 'dalmaru' }, () => {
  const a = P.plants(T); assert.deepEqual(P.plants(T), a);
  const solids = [...T.natureSolids(), ...T.structureSolids(), ...T.villageSolids()];
  for (const [id, [n, gap]] of Object.entries(P.KINDS)) {
    const mine = a.filter((p) => p.id === id); assert.equal(mine.length, n, id); assert.ok(P.IDS.includes(id), id);
    for (const p of mine) {
      assert.ok(P.inZone(p.x, p.z) && p.x <= P.PATH_X && !T.inPlaza(p.x, p.z), `${id} ${p.x},${p.z}`);
      for (const s of solids) assert.ok(Math.hypot(p.x - s.x, p.z - s.z) > (s.r || 0.5) + gap - 0.01, `${id} ${p.x},${p.z} on a solid`);
    }
  }
  assert.equal(P.IDS.length, 24);
  const b = P.blades(T, 3000); assert.equal(b.length, 3000);
  for (const g of b) assert.ok(P.inZone(g.x, g.z) && g.x <= P.PATH_X && solids.every((s) => Math.hypot(g.x - s.x, g.z - s.z) > (s.r || 0.5)), `blade ${g.x},${g.z}`);
});
