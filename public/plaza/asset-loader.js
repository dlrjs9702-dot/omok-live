// v1.10.15 고품질 에셋 파이프라인 -- the Three.js side of the island's optional 3D models (the rules, the registry
// lookup and the lazy front are public/plaza/asset-pipeline.js). Imported only when the registry has a usable entry,
// so with nothing registered this file, GLTFLoader and SkeletonUtils are never downloaded.
// glTF 2.0 (.glb, or .gltf with .bin and PNG/JPEG/WebP/AVIF textures) through GLTFLoader. Draco, KTX2 and Meshopt need
// decoders (extra files, WebAssembly); they are not set up yet, so a model that needs one fails to load and its
// target simply stays procedural. Add the decoder here (loader.setDRACOLoader / setKTX2Loader / setMeshoptDecoder)
// in the patch that brings the first such model.
import * as THREE from '/vendor/three/three.module.js';
import { GLTFLoader } from '/vendor/three/addons/loaders/GLTFLoader.js';
import { clone as cloneObject } from '/vendor/three/addons/utils/SkeletonUtils.js';

const P = globalThis.AssetPipeline;

export function createIslandAssets({ registry, off = [], assetUrl = (path) => path, walkSpeed = 1, tier = 2, onError = () => {} }) {
  // A .gltf names its .bin and textures relative to itself; they are pack files as well, so they too get their
  // revision URL (and with it the resource cache). Already-versioned, data: and blob: URLs pass through.
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => (url.startsWith('/') && !url.includes('?') ? assetUrl(url) : url));
  const loader = new GLTFLoader(manager);
  const cache = P.createLoadCache((url) => loader.loadAsync(assetUrl(url)), (url, error) => onError(url, error));
  const lodBase = new Map(); // LOD level object -> its registered distance
  const lods = [];
  const shown = {}; // target id -> 'loading' | 'model' | 'procedural'
  let quality = tier; let disposed = false;

  // One placed copy of a loaded model. Geometry, materials and textures stay shared with the loaded file; SkeletonUtils'
  // clone also gives a skinned mesh its own skeleton (a plain clone() would leave every copy driving the same bones).
  function instance(gltf, entry) {
    const object = cloneObject(gltf.scene);
    object.scale.multiplyScalar(entry.scale ?? 1);
    object.rotation.y += entry.rotationY || 0;
    if (Array.isArray(entry.offset)) object.position.set(...entry.offset);
    if (entry.shadows !== false) object.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return object;
  }

  // A structure's model, with its LOD levels when registered: THREE.LOD switches by camera distance in the renderer
  // itself (no per-frame work here) and the quality tier scales the distances (setQuality). Only the main model is
  // required; a level that fails to load is left out.
  async function build(entry) {
    const levels = [{ url: entry.url, distance: 0 }, ...(Array.isArray(entry.lod) ? entry.lod : [])];
    const loaded = await Promise.all(levels.map((level) => cache.get(level.url)));
    if (!loaded[0]) return null;
    if (levels.length === 1) return instance(loaded[0], entry);
    const lod = new THREE.LOD();
    levels.forEach((level, i) => {
      if (!loaded[i]) return;
      const object = instance(loaded[i], entry); lodBase.set(object, level.distance);
      lod.addLevel(object, P.lodDistance(level.distance, quality), 0.1);
    });
    lods.push(lod);
    return lod;
  }

  // `holder` is the gameplay object (position, facing; its collision, door and sign are the scene's and stay as they
  // are); `procedural` is the code-built look inside it, hidden only once the model is actually there.
  function attach(ids, holder, procedural) {
    const hit = P.pick(registry, ids, off); if (!hit) return;
    shown[hit.id] = 'loading';
    build(hit.entry).then((object) => {
      if (disposed || !holder.parent) return;
      if (!object) { shown[hit.id] = 'procedural'; return; }
      holder.add(object); procedural.visible = false; shown[hit.id] = 'model';
    }).catch((error) => { shown[hit.id] = 'procedural'; onError(hit.id, error); });
  }

  // A character: the rigged model goes under c.root (the name tag and chat bubble stay), the procedural body is
  // hidden, and plaza-scene's animate() hands the drawn speed to c.anim (Idle/Walk/Run cross-fades) instead of
  // swinging the procedural joints. One model per character, no LOD (a rig's clips bind to one copy of the bones).
  function dress(ids, c) {
    const hit = P.pick(registry, ids, off); if (!hit) return;
    c.assetPending = hit.id; shown[hit.id] = 'loading';
    cache.get(hit.entry.url).then((gltf) => {
      if (disposed || c.assetPending !== hit.id || !c.root.parent) return;
      if (!gltf) { shown[hit.id] = 'procedural'; return; }
      const object = instance(gltf, hit.entry);
      const anim = P.createAnimator(THREE, object, gltf.animations, hit.entry.animations || {}, { walkSpeed, speeds: hit.entry.speeds });
      c.assetRoot = object; c.anim = anim; c.root.add(object); c.body.visible = false; shown[hit.id] = 'model';
    }).catch((error) => { shown[hit.id] = 'procedural'; onError(hit.id, error); });
  }

  // Before a character is thrown away: its copy goes, the shared geometry stays for the others.
  function release(c) {
    c.anim?.dispose(); if (c.assetRoot) c.root.remove(c.assetRoot);
    c.anim = null; c.assetRoot = null; c.assetPending = null;
  }

  function setQuality(next) {
    quality = next;
    for (const lod of lods) for (const level of lod.levels) level.distance = P.lodDistance(lodBase.get(level.object) || 0, quality);
  }

  function dispose() {
    disposed = true;
    cache.clear((gltf) => gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      for (const material of [].concat(o.material)) { for (const value of Object.values(material)) if (value?.isTexture) value.dispose(); material.dispose(); }
    }));
  }

  return { attach, dress, release, setQuality, dispose, debug: () => ({ shown: { ...shown }, files: cache.status(), lods: lods.length, quality }) };
}
