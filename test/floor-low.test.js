'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const assets = require('../public/plaza/island-assets');

// 2회차 9·10 「가구점 바닥이 갑자기 꺼졌어」·「3층도 바닥이 항상 일정하지 않아」: the Low of a thin slab (a 6 cm plank floor, a
// rug) is squashed by the simplifier into one face that may look down -- from a camera far from the room's middle (LOD by
// the model's centre) the floor was gone, the dark under it showing. So no registered model swaps a wide floor (10 m2 and
// more facing up) for a Low that lost a third of it: such ones are registered without a Low.
test('Low로 바뀌어도 넓은 바닥이 사라지지 않는다 (가구점·펫샵·내 집 바닥·깔개)', { timeout: 120000 }, async () => {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  await MeshoptDecoder.ready;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const upArea = async (url) => {
    const b = fs.readFileSync(path.join(__dirname, '../public', url));
    const gltf = await loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); gltf.scene.updateMatrixWorld(true);
    let up = 0; const a = new THREE.Vector3(); const c = new THREE.Vector3(); const d = new THREE.Vector3(); const w = new THREE.Vector3();
    gltf.scene.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh) return; const pos = o.geometry.attributes.position; const idx = o.geometry.index;
      for (let t = 0; t < (idx ? idx.count : pos.count) / 3; t += 1) {
        const [i, j, k] = [0, 1, 2].map((n) => (idx ? idx.getX(t * 3 + n) : t * 3 + n));
        a.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(pos, j).applyMatrix4(o.matrixWorld); d.fromBufferAttribute(pos, k).applyMatrix4(o.matrixWorld);
        w.subVectors(c, a).cross(d.sub(a)); const area = w.length() / 2; if (area > 1e-8 && w.y / (2 * area) > 0.9) up += area;
      }
    });
    return up;
  };
  const lost = []; let wide = 0;
  for (const [id, entry] of Object.entries(assets.REGISTRY)) {
    if (typeof entry.url !== 'string' || typeof entry.low?.url !== 'string') continue;
    const high = await upArea(entry.url); if (high < 10) continue; wide += 1;
    const low = await upArea(entry.low.url); if (low < high * 0.67) lost.push(`${id} ${high.toFixed(0)}->${low.toFixed(0)}m2`);
  }
  assert.deepEqual(lost, []); assert.ok(wide > 5, `wide models checked: ${wide}`);
  for (const id of ['mall.floor2', 'petshop.floor3', 'shop.rug_zone__living', 'home.floor_tiles__mint', 'home.floor_boards_s3__oak']) assert.equal(assets.REGISTRY[id].low, null, id);
});
