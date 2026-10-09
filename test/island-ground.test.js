const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/plaza/island-terrain');
const THREE = require('three');

test('길 높이: 경사·물길 시작점에서도 실제 지형 삼각형 표면과 일치한다', () => {
  const geometry = new THREE.PlaneGeometry(250, 250, 125, 125).rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) positions.setY(i, T.ground(positions.getX(i), positions.getZ(i)));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()); mesh.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  for (const [x, z] of [[10.2, 10.6], [14.2, 2.1], [22.7, 4.3], [-18.2, -8.7], [-25.4, 6.3], [2.7, 26.1]]) {
    ray.set(new THREE.Vector3(x, 50, z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(mesh)[0]; assert.ok(hit);
    assert.ok(Math.abs(T.meshGroundHeight(x, z) - hit.point.y) < 1e-6);
  }
  geometry.dispose(); mesh.material.dispose();
});

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
