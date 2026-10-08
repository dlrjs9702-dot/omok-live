// The supplied High/Low platforms put the stone base and cream inset at the same deck height.
// Lower only the stone base 2cm before flattening; retain the inset, markings and walkable origin.
export function preparePlatformSurfaces(gltf, url) {
  if (!/\/train_platform(?:_low)?\.glb$/.test(url) || gltf.scene.userData.platformSurfacesReady) return gltf;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(mesh => {
    if (mesh.isMesh && mesh.material?.name === 'stone') {
      const at = mesh.getWorldPosition(mesh.position.clone()); at.y -= 0.02;
      mesh.position.copy(mesh.parent.worldToLocal(at)); // parent may carry the quantization scale
      mesh.updateMatrix(); // quantized GLBs can have matrixAutoUpdate=false
    }
  });
  gltf.scene.userData.platformSurfacesReady = true;
  gltf.scene.updateMatrixWorld(true);
  return gltf;
}
