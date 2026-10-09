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

// The town hall's first marble step overlaps the trim slab at the same height.
// Separate only the broad slab top; retain steps, collision origins and supplied files.
export function prepareTownhallSurfaces(gltf, url) {
  if (!/\/townhall_marble(?:_low)?\.glb$/.test(url) || gltf.scene.userData.townhallSurfacesReady) return gltf;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(mesh => {
    if (!mesh.isMesh || mesh.material?.name !== 'marble_trim') return;
    const p = mesh.geometry.attributes.position, index = mesh.geometry.index, selected = new Set();
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      const ids = [0, 1, 2].map(k => index ? index.getX(i + k) : i + k);
      const points = ids.map(k => mesh.position.clone().fromBufferAttribute(p, k).applyMatrix4(mesh.matrixWorld));
      const [a, b, c] = points;
      if (a.y < 0.45 || a.y > 0.55 || points.some(v => Math.abs(v.y - a.y) > 0.001)) continue;
      if (Math.max(...points.map(v => v.x)) - Math.min(...points.map(v => v.x)) < 14 || Math.max(...points.map(v => v.z)) - Math.min(...points.map(v => v.z)) < 10) continue;
      if (b.clone().sub(a).cross(c.clone().sub(a)).y <= 0) continue;
      for (const k of ids) selected.add(k);
    }
    if (!selected.size) return;
    mesh.geometry = mesh.geometry.clone();
    const own = mesh.geometry.attributes.position;
    for (const k of selected) {
      const world = mesh.position.clone().fromBufferAttribute(own, k).applyMatrix4(mesh.matrixWorld); world.y -= 0.02;
      const local = mesh.worldToLocal(world); own.setXYZ(k, local.x, local.y, local.z);
    }
    own.needsUpdate = true; mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
  });
  gltf.scene.userData.townhallSurfacesReady = true;
  return gltf;
}
