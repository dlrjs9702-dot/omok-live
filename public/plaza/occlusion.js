import * as THREE from '/vendor/three/three.module.js';

// Buildings and frozen landmark characters need sight bounds, not a triangle/skinning raycast
// on each frame. Cache one local box per mesh; asset swaps and frozen poses invalidate it.
export function createOcclusion(camera) {
  const records = new Map();
  const ray = new THREE.Ray(); const direction = new THREE.Vector3();
  const localRay = new THREE.Ray(); const hit = new THREE.Vector3();
  const inverse = new THREE.Matrix4();
  const stats = { builds: 0, boxTests: 0, materials: 0, updates: 0 };
  let last = 0;
  const visible = (mesh, root) => {
    for (let o = mesh; o; o = o.parent) { if (!o.visible) return false; if (o === root) return true; }
    return false;
  };
  function restore(rec) {
    for (const item of rec.meshes) if (item.original) { item.mesh.material = item.original; item.original = null; }
    for (const material of rec.ghosts.values()) { material.dispose(); stats.materials -= 1; }
    rec.ghosts.clear();
  }
  function remove(root) {
    const rec = records.get(root); if (rec) restore(rec);
    records.delete(root);
  }
  function build(root) {
    remove(root); root.updateWorldMatrix(true, true);
    const rec = { revision: root.userData.occlusionRevision || 0, meshes: [], box: new THREE.Box3(), ghosts: new Map(), prepared: false, a: 0, seen: -Infinity, opacity: null };
    root.traverse((mesh) => {
      if (!mesh.isMesh) return;
      if (mesh.isSkinnedMesh) { mesh.skeleton.update(); mesh.computeBoundingBox(); }
      else if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const box = (mesh.isSkinnedMesh ? mesh.boundingBox : mesh.geometry.boundingBox)?.clone();
      if (box && !box.isEmpty()) {
        rec.meshes.push({ mesh, box, inverse: mesh.matrixWorld.clone().invert(), original: null });
        rec.box.union(box.clone().applyMatrix4(mesh.matrixWorld));
      }
    });
    records.set(root, rec); stats.builds += 1;
    return rec;
  }
  function apply(rec, opacity) {
    if (!rec.prepared) for (const item of rec.meshes) {
      if (!item.original) {
        item.original = item.mesh.material;
        const ghost = (source) => {
          let material = rec.ghosts.get(source);
          if (!material) {
            material = source.clone(); material.transparent = true; material.depthWrite = false;
            // Three's default transparent DoubleSide renders two passes. A landmark needs
            // one blended pass, preserving both sides without doubling its draw calls.
            material.forceSinglePass = true;
            rec.ghosts.set(source, material); stats.materials += 1;
          }
          return material;
        };
        item.mesh.material = Array.isArray(item.original) ? item.original.map(ghost) : ghost(item.original);
      }
    }
    rec.prepared = true;
    for (const [source, material] of rec.ghosts) {
      if (source.emissive && material.emissive) material.emissive.copy(source.emissive);
      material.emissiveIntensity = source.emissiveIntensity;
    }
    if (rec.opacity !== opacity) {
      for (const material of rec.ghosts.values()) material.opacity = opacity;
      rec.opacity = opacity; stats.updates += 1;
    }
  }
  function update(roots, p, clock) {
    const dt = Math.max(0, Math.min(0.1, clock - last)); last = clock;
    const live = new Set(roots);
    for (const root of records.keys()) if (!live.has(root)) remove(root);
    for (const root of roots) {
      let rec = records.get(root);
      if (root.position.distanceToSquared(p) >= 900 && !rec?.a) continue;
      if (!rec || rec.revision !== (root.userData.occlusionRevision || 0)) {
        const a = rec?.a || 0; const seen = rec?.seen ?? -Infinity;
        rec = build(root); rec.a = a; rec.seen = seen;
      }
      let blocked = false;
      for (const height of [0.4, 1, 1.6]) {
        direction.set(p.x, p.y + height, p.z).sub(camera.position);
        const far = direction.length(); ray.set(camera.position, direction.normalize());
        stats.boxTests += 1;
        if (!ray.intersectBox(rec.box, hit) || hit.distanceToSquared(camera.position) >= far * far) continue;
        for (const item of rec.meshes) {
          if (!visible(item.mesh, root)) continue;
          // Local boxes retain each mesh's rotation; gaps between separate parts stay open.
          inverse.copy(item.inverse); localRay.copy(ray).applyMatrix4(inverse); stats.boxTests += 1;
          if (localRay.intersectBox(item.box, hit) && hit.applyMatrix4(item.mesh.matrixWorld).distanceToSquared(camera.position) < far * far) { blocked = true; break; }
        }
        if (blocked) break;
      }
      if (blocked) rec.seen = clock;
      rec.a = Math.max(0, Math.min(1, rec.a + (clock - rec.seen <= 0.4 ? 1 : -1) * dt / 0.25));
      if (rec.a > 0) apply(rec, 1 - 0.7 * rec.a);
      else if (rec.opacity !== null) {
        // Keep clones for the next crossing, but restore source materials immediately.
        for (const item of rec.meshes) if (item.original) { item.mesh.material = item.original; item.original = null; }
        rec.opacity = null; rec.prepared = false;
      }
    }
  }
  return { update, remove, dispose: () => { for (const root of [...records.keys()]) remove(root); },
    debug: () => ({ ...stats, roots: records.size, faded: [...records.values()].filter((r) => r.a > 0).length,
      active: [...records].filter(([, r]) => r.a > 0).map(([root, r]) => ({ x: root.position.x, z: root.position.z, alpha: r.a })) }) };
}
