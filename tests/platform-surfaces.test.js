const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const THREE = require('three');
const R = require('../public/plaza/island-train');
const source = fs.readFileSync(path.join(__dirname, '../public/plaza/platform-surfaces.js'), 'utf8');
const loaded = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('관공서: 실제 High/Low 기단·첫 계단 겹침 분리, 다른 부위·원점·재처리 보존', async () => {
  const { prepareTownhallSurfaces } = await loaded;
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  await MeshoptDecoder.ready;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  for (const low of [false, true]) {
    const url = '/assets/island/townhall-v2/townhall_marble' + (low ? '_low' : '') + '.glb';
    const bytes = fs.readFileSync(path.join(__dirname, '../public', url));
    const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    gltf.scene.updateMatrixWorld(true); const meshes = [];
    gltf.scene.traverse(m => { if (m.isMesh) meshes.push(m); });
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 2, 6.1), new THREE.Vector3(0, -1, 0));
    const top = name => ray.intersectObjects(meshes.filter(m => m.material.name === name))[0]?.point.y;
    const step = top('marble'), slab = top('marble_trim');
    assert.ok(Math.abs(step - slab) < 0.001, '현재 원본의 실제 겹침 재현');
    const snapshot = meshes.filter(m => m.material.name !== 'marble_trim').map(m => [m, m.geometry, m.matrixWorld.clone()]);
    prepareTownhallSurfaces(gltf, '/unrelated.glb'); assert.equal(top('marble_trim'), slab);
    prepareTownhallSurfaces(gltf, url);
    assert.equal(top('marble'), step, '첫 계단 높이 보존');
    assert.ok(step - top('marble_trim') > 0.019 && step - top('marble_trim') < 0.022, '기단 윗면만2cm 아래');
    for (const [m, geometry, matrix] of snapshot) { assert.equal(m.geometry, geometry); assert.ok(m.matrixWorld.equals(matrix)); }
    const lowered = top('marble_trim'); prepareTownhallSurfaces(gltf, url); assert.equal(top('marble_trim'), lowered);
  }
});

test('승강장: 두 역 연결로는 긴 쪽 바닥 모서리에서 끝나며 내부에 겹치지 않는다', () => {
  for (const p of R.PLATFORMS) {
    const lift = R.liftOf(p.station); const distance = Math.hypot(lift.x - p.x, lift.z - p.z);
    const edge = R.platformEdgeDistance(p, lift.x, lift.z);
    assert.ok(Math.abs(edge - 2.7) < 1e-8);
    const reach = distance - edge;
    assert.ok(reach > 1.2, 'lift to deck has a positive walkway');
    const k = reach / distance;
    const x = lift.x + (p.x - lift.x) * k; const z = lift.z + (p.z - lift.z) * k;
    const c = Math.cos(p.yaw); const s = Math.sin(p.yaw);
    assert.ok(Math.abs(Math.abs((x - p.x) * s + (z - p.z) * c) - 2.7) < 1e-8);
    assert.ok(Math.abs((x - p.x) * c - (z - p.z) * s) < 1e-8);
  }
  const p = { x: 0, z: 0, yaw: 0 };
  assert.equal(R.platformEdgeDistance(p, 5, 0), 1.7);
  assert.ok(Math.abs(R.platformEdgeDistance(p, 5, 5) - 1.7 * Math.SQRT2) < 1e-8);
});

test('승강장: 실제 압축 High/Low 기단·바닥 동일 높이를 분리하고 표식·원점·재처리를 보존', async () => {
  const { preparePlatformSurfaces } = await loaded;
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  await MeshoptDecoder.ready;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  for (const low of [false, true]) {
    const url = '/assets/island/train-v1/train_platform' + (low ? '_low' : '') + '.glb';
    const bytes = fs.readFileSync(path.join(__dirname, '../public', url));
    const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    gltf.scene.updateMatrixWorld(true); const meshes = new Map();
    gltf.scene.traverse(mesh => { if (mesh.isMesh) meshes.set(mesh.material.name, mesh); });
    const top = mesh => { mesh.geometry.computeBoundingBox(); return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld).max.y; };
    const stone = meshes.get('stone'); const cream = meshes.get('train_cream');
    const oldStone = top(stone); const creamTop = top(cream);
    assert.ok(Math.abs(oldStone - creamTop) < 1e-6, 'supplied model reproduces coplanar deck faces');
    const unchanged = [...meshes.values()].filter(m => m !== stone).map(m => [m, m.matrixWorld.clone()]);
    preparePlatformSurfaces(gltf, '/unrelated.glb'); assert.equal(top(stone), oldStone);
    preparePlatformSurfaces(gltf, url); assert.ok(Math.abs(creamTop - top(stone) - 0.02) < 1e-6);
    assert.equal(top(cream), creamTop); assert.deepEqual(gltf.scene.position.toArray(), [0, 0, 0]);
    for (const [mesh, matrix] of unchanged) assert.ok(mesh.matrixWorld.equals(matrix), mesh.material.name);
    const fixed = top(stone); preparePlatformSurfaces(gltf, url); assert.equal(top(stone), fixed);
  }
});
