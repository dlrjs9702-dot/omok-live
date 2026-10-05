// v1.10.15 고품질 에셋 파이프라인 -- the Three.js side of the island's optional 3D models (the rules, the registry
// lookup and the lazy front are public/plaza/asset-pipeline.js). Imported only when the registry has a usable entry,
// so with nothing registered this file, GLTFLoader and SkeletonUtils are never downloaded.
// glTF 2.0 (.glb, or .gltf with .bin and PNG/JPEG/WebP/AVIF textures) through GLTFLoader.
// v1.10.26: models come out of the build pipeline (tools/assets/) quantized (KHR_mesh_quantization) and Meshopt-
// compressed (EXT_meshopt_compression), so the Meshopt decoder is set up (WebAssembly, allowed by the page's CSP
// 'wasm-unsafe-eval'). Draco and KTX2 are not: a model that needs one fails to load and its target stays procedural.
import * as THREE from '/vendor/three/three.module.js';
import { GLTFLoader } from '/vendor/three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '/vendor/three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneObject } from '/vendor/three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from '/vendor/three/addons/utils/BufferGeometryUtils.js';

const P = globalThis.AssetPipeline;

export function createIslandAssets({ registry, off = [], assetUrl = (path) => path, walkSpeed = 1, tier = 2, season = null, onError = () => {} }) {
  // A .gltf names its .bin and textures relative to itself; they are pack files as well, so they too get their
  // revision URL (and with it the resource cache). Already-versioned, data: and blob: URLs pass through.
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => (url.startsWith('/') && !url.includes('?') ? assetUrl(url) : url));
  const loader = new GLTFLoader(manager);
  loader.setMeshoptDecoder(MeshoptDecoder);
  const cache = P.createLoadCache((url) => loader.loadAsync(assetUrl(url)), (url, error) => onError(url, error));
  const lodBase = new Map(); // LOD level object -> its registered distance
  const lods = [];
  const shown = {}; // target id -> 'loading' | 'model' | 'procedural'
  let quality = tier; let disposed = false;
  const attaches = []; const batches = []; const made = []; // made: geometries/materials this file created (flattened models)

  // One placed copy of a loaded model. Geometry, materials and textures stay shared with the loaded file; SkeletonUtils'
  // clone also gives a skinned mesh its own skeleton (a plain clone() would leave every copy driving the same bones).
  // v1.10.18: a still model of plain colours (a prop, a building) is one flattened mesh (partsOf) -- one draw call
  // instead of one per part; a rigged or textured one is cloned as before.
  function instance(gltf, entry) {
    const flat = !gltf.animations?.length && partsOf(gltf);
    if (flat && flat.length === 1 && flat[0].material.vertexColors) {
      const mesh = new THREE.Mesh(flat[0].geometry, flat[0].material);
      mesh.applyMatrix4(flat[0].matrix); // its place in the model (a quantized model's dequantizing scale too)
      const object = new THREE.Group(); object.add(mesh);
      object.scale.multiplyScalar(entry.scale ?? 1);
      object.rotation.y += entry.rotationY || 0;
      if (Array.isArray(entry.offset)) object.position.set(...entry.offset);
      if (entry.shadows !== false) { mesh.castShadow = true; mesh.receiveShadow = true; }
      return object;
    }
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
  // v1.10.17: kept as a record, so a change of season can swap the model (setSeason).
  function attach(ids, holder, procedural) { const rec = { ids, holder, procedural, url: null, object: null }; attaches.push(rec); applyAttach(rec); }
  function swapAttach(rec, object) {
    if (rec.object) { rec.holder.remove(rec.object); const i = lods.indexOf(rec.object); if (i >= 0) lods.splice(i, 1); }
    rec.object = object; if (object) rec.holder.add(object);
    rec.procedural.visible = !object;
  }
  function applyAttach(rec) {
    const hit = P.pick(registry, rec.ids, off, season); const url = hit?.entry.url || null;
    if (url === rec.url) return;
    rec.url = url;
    if (!hit) { swapAttach(rec, null); return; }
    shown[hit.id] = 'loading';
    build(hit.entry).then((object) => {
      if (disposed || rec.url !== url || !rec.holder.parent) return;
      swapAttach(rec, object); shown[hit.id] = object ? 'model' : 'procedural';
    }).catch((error) => { shown[hit.id] = 'procedural'; onError(hit.id, error); });
  }

  // v1.10.17 one model's parts for placing it many times: its meshes, each with its place in the model (`matrix`). A
  // model of plain-coloured materials (no textures, opaque -- the island's are) is flattened into one geometry with the
  // colours in its vertices and one shared material: one draw call per square of the island for all its copies.
  // v1.10.26: the place is kept as a matrix, never baked into the vertices -- a quantized model keeps its vertices in
  // small integers and its dequantizing scale/offset in that matrix, and baking metres into those integers wrecks it
  // (checked with a real quantized tree: it filled the screen). Meshes on one node (the pipeline's output: one mesh,
  // a primitive per colour) merge as they are and keep their index; meshes on different nodes are first turned into
  // plain floats and moved into the model's space. Worked out once per file.
  const partsCache = new WeakMap();
  const TEXTURE_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap'];
  const identity = new THREE.Matrix4();
  // every attribute as plain floats (quantized and normalized values read back as what they mean)
  function floats(geometry) {
    for (const [name, a] of Object.entries(geometry.attributes)) {
      if (a.array instanceof Float32Array && !a.normalized && !a.isInterleavedBufferAttribute) continue;
      const out = new Float32Array(a.count * a.itemSize); const get = [a.getX, a.getY, a.getZ, a.getW];
      for (let i = 0; i < a.count; i += 1) for (let c = 0; c < a.itemSize; c += 1) out[i * a.itemSize + c] = get[c].call(a, i);
      geometry.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
    }
    return geometry;
  }
  function partsOf(gltf) {
    if (partsCache.has(gltf)) return partsCache.get(gltf);
    gltf.scene.updateMatrixWorld(true);
    const meshes = []; gltf.scene.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) meshes.push(o); });
    const plain = meshes.every((m) => [].concat(m.material).length === 1 && m.material.isMeshStandardMaterial && !m.material.transparent && TEXTURE_SLOTS.every((slot) => !m.material[slot]));
    let parts;
    if (plain && meshes.length) {
      const shared = meshes.every((m) => m.matrixWorld.equals(meshes[0].matrixWorld));
      const indexed = meshes.every((m) => m.geometry.index);
      const colourOf = (m) => (g) => {
        if (!g.attributes.normal) g.computeVertexNormals();
        const count = g.attributes.position.count; const colour = new Float32Array(count * 3); const own = g.attributes.color;
        for (let i = 0; i < count; i += 1) {
          colour[i * 3] = m.material.color.r * (own ? own.getX(i) : 1); colour[i * 3 + 1] = m.material.color.g * (own ? own.getY(i) : 1); colour[i * 3 + 2] = m.material.color.b * (own ? own.getZ(i) : 1);
        }
        for (const name of Object.keys(g.attributes)) if (!['position', 'normal'].includes(name)) g.deleteAttribute(name);
        g.setAttribute('color', new THREE.BufferAttribute(colour, 3));
        return g;
      };
      const build = (bake) => meshes.map((m) => {
        let g = m.geometry.clone();
        if (bake) floats(g).applyMatrix4(m.matrixWorld);
        if (!indexed && g.index) { const flat = g.toNonIndexed(); g.dispose(); g = flat; }
        return colourOf(m)(g);
      });
      let geos = build(!shared);
      let geometry = mergeGeometries(geos); geos.forEach((g) => g.dispose());
      let matrix = shared ? meshes[0].matrixWorld.clone() : identity;
      if (!geometry) { // parts of different kinds (e.g. differently quantized): plain floats in the model's space
        geos = build(true).map(floats); geometry = mergeGeometries(geos); geos.forEach((g) => g.dispose()); matrix = identity;
      }
      const roughness = meshes.reduce((sum, m) => sum + m.material.roughness, 0) / meshes.length;
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0 });
      made.push(geometry, material);
      parts = [{ geometry, material, matrix }];
    } else {
      // shared with the loaded file (disposed with it), each with its place in the model
      parts = meshes.map((m) => ({ geometry: m.geometry, material: m.material, matrix: m.matrixWorld.clone() }));
    }
    partsCache.set(gltf, parts);
    return parts;
  }

  // v1.10.17 nature and props placed many times (island.js `instanced`). `cells`: one square of the island each,
  // { x, z (its centre), parent, procedural: [the square's InstancedMesh of this kind], matrices: [one per copy],
  // colors: [its tint per copy] | null, shadow }. Once the model is in, every square gets one InstancedMesh per part of
  // the model, placed with the very matrices the procedural copies had (place, turn, size -- so where things stand,
  // their collision and every game rule stay as they were).
  // v1.10.18: copy by copy, not square by square -- update() puts the copies near the player into the model's mesh and
  // the rest into the procedural one (each drawing only as many as it holds), so a detailed model costs triangles only
  // where one stands close. Nothing registered, a failed load or a switched-off id: the procedural copies stay.
  function batch(ids, cells) { const rec = { ids, cells, url: null, entry: null, placed: null }; batches.push(rec); applyBatch(rec); }
  // the copies `keep` (all, without a model) back in a square's procedural mesh, the rest drawn as the model
  function fill(p, near) {
    const { cell } = p; const proc = cell.procedural[0]; let a = 0; let b = 0;
    cell.matrices.forEach((m, i) => {
      if (near && near[i]) { for (const im of p.meshes) im.setMatrixAt(a, both.multiplyMatrices(m, local).multiply(im.userData.part)); a += 1; }
      else { proc.setMatrixAt(b, m); if (cell.colors) proc.setColorAt(b, cell.colors[i]); b += 1; }
    });
    for (const im of p.meshes) { im.count = a; im.visible = a > 0; im.instanceMatrix.needsUpdate = true; } // nothing to draw: not even a call
    proc.count = b; proc.visible = b > 0; proc.instanceMatrix.needsUpdate = true; if (proc.instanceColor) proc.instanceColor.needsUpdate = true;
    p.near = a;
  }
  function clearBatch(rec) {
    if (rec.placed) for (const p of rec.placed) { for (const im of p.meshes) { p.cell.parent.remove(im); im.dispose(); } p.meshes = []; fill(p, null); }
    rec.placed = null; rec.entry = null;
  }
  const local = new THREE.Matrix4(); const both = new THREE.Matrix4();
  function applyBatch(rec) {
    const hit = P.pick(registry, rec.ids, off, season); const url = hit?.entry.url || null;
    if (url === rec.url) return;
    rec.url = url;
    if (!hit) { clearBatch(rec); return; }
    shown[hit.id] = 'loading';
    cache.get(url).then((gltf) => {
      if (disposed || rec.url !== url) return;
      clearBatch(rec);
      if (!gltf) { shown[hit.id] = 'procedural'; return; }
      const parts = partsOf(gltf); const entry = hit.entry;
      local.compose(new THREE.Vector3(...(Array.isArray(entry.offset) ? entry.offset : [0, 0, 0])), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), entry.rotationY || 0), new THREE.Vector3().setScalar(entry.scale ?? 1));
      rec.placed = rec.cells.map((cell) => ({ cell, near: 0, meshes: parts.map(({ geometry, material, matrix }) => {
        const im = new THREE.InstancedMesh(geometry, material, cell.matrices.length);
        im.userData.part = matrix; // the part's place in the model, after the copy's own and the entry's
        cell.matrices.forEach((m, i) => im.setMatrixAt(i, both.multiplyMatrices(m, local).multiply(matrix)));
        im.computeBoundingSphere(); // over every copy, so culling never hides one the update brings in
        im.count = 0; im.visible = false; im.castShadow = cell.shadow && entry.shadows !== false; im.receiveShadow = true;
        cell.parent.add(im); return im;
      }) }));
      rec.entry = entry; shown[hit.id] = 'model'; lastX = NaN; // the next update() places them
    }).catch((error) => { shown[hit.id] = 'procedural'; onError(hit.id, error); });
  }
  // Copies within the entry's `near` of the player (shortened on lower quality tiers) show the model, the rest their
  // procedural look; worked out again only once the player has moved a unit, and only squares that can hold a near copy
  // are filled again.
  let lastX = NaN; let lastZ = NaN;
  function update(x, z) {
    if (Math.hypot(x - lastX, z - lastZ) < 1) return;
    lastX = x; lastZ = z;
    for (const rec of batches) {
      if (!rec.placed) continue;
      // the entry's transform for this batch, for fill()
      local.compose(new THREE.Vector3(...(Array.isArray(rec.entry.offset) ? rec.entry.offset : [0, 0, 0])), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rec.entry.rotationY || 0), new THREE.Vector3().setScalar(rec.entry.scale ?? 1));
      const near = P.lodDistance(rec.entry.near ?? 45, quality);
      for (const p of rec.placed) {
        const flags = p.cell.matrices.map((m) => Math.hypot(m.elements[12] - x, m.elements[14] - z) < near);
        const count = flags.filter(Boolean).length;
        if (count === 0 && p.near === 0) continue; // nothing near before or now: unchanged
        fill(p, flags);
      }
    }
  }

  // v1.10.17: the season the island shows; every structure and batch whose file depends on it is loaded again and
  // swapped once ready (a season without a file falls back to the entry's `url`, then to the procedural look)
  function setSeason(next) {
    if (next === season) return;
    season = next;
    for (const rec of attaches) applyAttach(rec);
    for (const rec of batches) applyBatch(rec);
  }

  // A character: the rigged model goes under c.root (the name tag and chat bubble stay), the procedural body is
  // hidden, and plaza-scene's animate() hands the drawn speed to c.anim (Idle/Walk/Run cross-fades) instead of
  // swinging the procedural joints. One model per character, no LOD (a rig's clips bind to one copy of the bones).
  function dress(ids, c) {
    const hit = P.pick(registry, ids, off, season); if (!hit) return;
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
    quality = next; lastX = NaN;
    for (const lod of lods) for (const level of lod.levels) level.distance = P.lodDistance(lodBase.get(level.object) || 0, quality);
  }

  function dispose() {
    disposed = true;
    for (const rec of batches) clearBatch(rec);
    for (const x of made) x.dispose();
    cache.clear((gltf) => gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      for (const material of [].concat(o.material)) { for (const value of Object.values(material)) if (value?.isTexture) value.dispose(); material.dispose(); }
    }));
  }

  const batchDebug = () => batches.map((rec) => ({ ids: [].concat(rec.ids), url: rec.url, copies: rec.cells.reduce((n, c) => n + c.matrices.length, 0), squares: rec.cells.length,
    placed: Boolean(rec.placed), near: rec.placed ? rec.placed.reduce((n, p) => n + p.near, 0) : 0, parts: rec.placed?.[0]?.meshes.length ?? 0,
    at: rec.cells[0]?.matrices[0] ? [rec.cells[0].matrices[0].elements[12], rec.cells[0].matrices[0].elements[14]] : null })); // one copy's place (tests)
  return { attach, dress, release, batch, update, setSeason, setQuality, dispose, debug: () => ({ shown: { ...shown }, files: cache.status(), lods: lods.length, quality, season, batches: batchDebug() }) };
}
