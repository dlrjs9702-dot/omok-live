const { test, expect } = require('@playwright/test');

// 문제 기록 3회차 1 곤충 크기 (사용자 2026-10-23 「주먹의 1.5배」): every insect out on the island is 0.3 m on its longest side
// -- each model as loaded (its file) times its registry scale. One page (the files are the same on a phone).
test('곤충 크기: 섬의 곤충 12종 모두 가장 긴 쪽 0.3 m', async ({ page, isMobile }) => {
  test.skip(isMobile);
  await page.goto('/');
  const sizes = await page.evaluate(async () => {
    const THREE = await import('/vendor/three/three.module.js');
    const { GLTFLoader } = await import('/vendor/three/addons/loaders/GLTFLoader.js');
    const { MeshoptDecoder } = await import('/vendor/three/addons/libs/meshopt_decoder.module.js');
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    const out = {};
    for (const [id, entry] of Object.entries(window.IslandAssets.REGISTRY).filter(([id]) => id.startsWith('insect.'))) {
      const g = await loader.loadAsync(entry.url); g.scene.scale.multiplyScalar(entry.scale ?? 1); g.scene.updateMatrixWorld(true);
      const v = new THREE.Box3().setFromObject(g.scene).getSize(new THREE.Vector3()); out[id] = Math.round(Math.max(v.x, v.y, v.z) * 1000) / 1000;
    }
    return out;
  });
  expect(Object.keys(sizes)).toHaveLength(12);
  for (const [id, long] of Object.entries(sizes)) expect(Math.abs(long - 0.3), `${id} ${long}`).toBeLessThan(0.006);
});
