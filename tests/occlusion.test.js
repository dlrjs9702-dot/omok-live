const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const source = fs.readFileSync(require('node:path').join(__dirname, '../public/plaza/occlusion.js'), 'utf8')
  .replace("'/vendor/three/three.module.js'", JSON.stringify(pathToFileURL(require.resolve('three').replace(/three\.cjs$/, 'three.module.js')).href));
const THREE = require('three');
const loaded = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function fixture(material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide })) {
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 1, 10);
  const root = new THREE.Group(); root.userData.building = true;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), material); mesh.position.set(0, 1, 5); root.add(mesh);
  return { root, mesh, material, camera, player: new THREE.Vector3() };
}
test('가림: 삼각형 raycast 없이 세 높이 경계 검사, 안정 상태 캐시·재질 재사용과 부드러운 복귀', async () => {
  const { createOcclusion } = await loaded; const f = fixture(); const manager = createOcclusion(f.camera);
  f.mesh.raycast = () => assert.fail('triangle raycast must not run');
  for (let i = 1; i <= 10; i++) manager.update([f.root], f.player, i / 10);
  const ghost = f.mesh.material; assert.ok(Math.abs(ghost.opacity - 0.3) < 1e-12); assert.equal(ghost.forceSinglePass, true);
  const before = manager.debug();
  for (let i = 11; i <= 30; i++) manager.update([f.root], f.player, i / 10);
  assert.equal(manager.debug().builds, before.builds); assert.equal(manager.debug().updates, before.updates);
  assert.equal(manager.debug().materials, 1); assert.equal(f.mesh.material, ghost);
  f.camera.position.x = 20;
  manager.update([f.root], f.player, 3.1); assert.equal(f.mesh.material, ghost); // hold, no flicker
  for (let i = 32; i <= 42; i++) manager.update([f.root], f.player, i / 10);
  assert.equal(manager.debug().faded, 0); assert.equal(f.mesh.material, f.material);
  f.camera.position.x = 0;
  for (let i = 43; i <= 50; i++) manager.update([f.root], f.player, i / 10);
  assert.equal(f.mesh.material, ghost); manager.dispose(); assert.equal(f.mesh.material, f.material);
  assert.equal(manager.debug().materials, 0);
});
test('가림: 공유 원본 재질을 사용하는 두 루트의 opacity 격리·모델 교체·해제', async () => {
  const { createOcclusion } = await loaded; const a = fixture(); const b = fixture(a.material);
  b.mesh.position.x = 8; const manager = createOcclusion(a.camera);
  for (let i = 1; i <= 8; i++) manager.update([a.root, b.root], a.player, i / 10);
  assert.notEqual(a.mesh.material, a.material); assert.equal(b.mesh.material, a.material);
  assert.equal(a.material.transparent, false); assert.equal(a.material.opacity, 1);
  b.mesh.position.x = 0; b.root.userData.occlusionRevision = 1;
  manager.update([a.root, b.root], a.player, 0.9);
  assert.notEqual(a.mesh.material, b.mesh.material);
  assert.ok(a.mesh.material.opacity < b.mesh.material.opacity); // same source, independent fade progress
  const old = a.mesh; a.root.remove(old); const replacement = new THREE.Mesh(old.geometry, a.material);
  replacement.position.copy(old.position); a.root.add(replacement); a.root.userData.occlusionRevision = 1;
  manager.update([a.root, b.root], a.player, 1);
  assert.equal(old.material, a.material); assert.notEqual(replacement.material, a.material);
  assert.equal(manager.debug().materials, 2);
  manager.update([b.root], a.player, 1.1); assert.equal(replacement.material, a.material);
  assert.equal(manager.debug().materials, 1); manager.dispose(); assert.equal(manager.debug().materials, 0);
});
test('가림: 숨겨진 High/Low·빈 부위 사이·표지판은 가리지 않고 야간 emissive 갱신을 보존', async () => {
  const { createOcclusion } = await loaded; const f = fixture(); const manager = createOcclusion(f.camera);
  f.mesh.visible = false; manager.update([f.root], f.player, 0.1); assert.equal(manager.debug().faded, 0);
  f.mesh.visible = true; for (let i = 2; i <= 6; i++) manager.update([f.root], f.player, i / 10);
  f.material.emissive.setHex(0xabcdef); f.material.emissiveIntensity = 0.9;
  manager.update([f.root], f.player, 0.7); assert.equal(f.mesh.material.emissive.getHex(), 0xabcdef);
  assert.equal(f.mesh.material.emissiveIntensity, 0.9); manager.dispose();
  f.mesh.position.x = -5; const right = f.mesh.clone(); right.position.x = 5; f.root.add(right);
  const gap = createOcclusion(f.camera); gap.update([f.root], f.player, 0.1); assert.equal(gap.debug().faded, 0); gap.dispose();
});

test('가림: 실제 압축 High/Low 리그·동물 의상의 경계 캐시와 재질 복원', async () => {
  const { createOcclusion } = await loaded;
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  await MeshoptDecoder.ready;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const { REGISTRY } = require('../public/plaza/island-assets');
  for (const low of [false, true]) {
    const root = new THREE.Group(); root.position.set(0, 1.4, 5); root.scale.setScalar(2.6);
    for (const id of ['character.base', 'wear.animal_cat_outfit']) {
      const entry = REGISTRY[id]; const bytes = fs.readFileSync(require('node:path').join(__dirname, '../public', low ? entry.low.url : entry.url));
      const model = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), ''); root.add(model.scene);
    }
    const originals = new Map(); root.traverse(mesh => { if (mesh.isMesh) { originals.set(mesh, mesh.material); mesh.raycast = () => assert.fail('skinned triangle raycast'); } });
    root.updateMatrixWorld(true);
    const first = originals.keys().next().value; first.skeleton.update(); first.computeBoundingBox();
    const centre = first.boundingBox.clone().applyMatrix4(first.matrixWorld).getCenter(new THREE.Vector3());
    const f = fixture(); f.camera.position.copy(centre).add(new THREE.Vector3(0, 0, 5));
    f.player.copy(centre).add(new THREE.Vector3(0, -0.4, -5));
    const manager = createOcclusion(f.camera);
    for (let i = 1; i <= 10; i++) manager.update([root], f.player, i / 10);
    assert.equal(manager.debug().faded, 1); assert.equal(manager.debug().builds, 1);
    manager.dispose(); assert.equal(manager.debug().materials, 0);
    for (const [mesh, material] of originals) assert.equal(mesh.material, material);
  }
});
