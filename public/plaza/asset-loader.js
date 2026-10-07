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

export function createIslandAssets({ registry, off = [], assetUrl = (path) => path, walkSpeed = 1, tier = 2, day = null, fogColor = 0xd7efff, onError = () => {} }) {
  // v1.10.27: a thing's season is its zone's today (island-terrain.js); the neutral plaza shows NEUTRAL_LOOK. Without
  // a day (or the terrain) every target uses its plain `url`.
  const T = globalThis.IslandTerrain;
  const lookOf = (zone) => (day === null || !T ? null : T.zoneSeason(zone, day) || P.NEUTRAL_LOOK);
  const placeOf = new THREE.Vector3();
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
  // v1.10.29 원경 `haze` (0..1): a landmark far out at sea stands past the scene fog's end, so it is drawn without the
  // fog and mixed toward the fog colour by this much instead -- a pale silhouette on the horizon (one material per file)
  const hazedOf = new Map();
  function hazed(material, h) {
    const key = `${material.uuid}|${h}`;
    if (!hazedOf.has(key)) {
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: material.roughness, metalness: 0, fog: false, color: new THREE.Color().setScalar(1 - h), emissive: new THREE.Color(fogColor).multiplyScalar(h) });
      hazedOf.set(key, m); made.push(m);
    }
    return hazedOf.get(key);
  }
  function instance(gltf, entry) {
    const flat = !gltf.animations?.length && partsOf(gltf);
    if (flat && flat.length === 1 && flat[0].material.vertexColors) {
      const mesh = new THREE.Mesh(flat[0].geometry, entry.haze ? hazed(flat[0].material, entry.haze) : flat[0].material);
      mesh.applyMatrix4(flat[0].matrix); // its place in the model (a quantized model's dequantizing scale too)
      const object = new THREE.Group(); object.add(mesh);
      object.scale.multiplyScalar(entry.scale ?? 1);
      object.rotation.y += entry.rotationY || 0;
      if (Array.isArray(entry.offset)) object.position.set(...entry.offset);
      if (entry.shadows !== false) { mesh.castShadow = true; mesh.receiveShadow = true; }
      return object;
    }
    const object = cloneObject(gltf.scene);
    object.animations = gltf.animations || []; // v1.10.38: a looping prop (the Halloween bats' Flap) plays its own clip
    object.scale.multiplyScalar(entry.scale ?? 1);
    object.rotation.y += entry.rotationY || 0;
    if (Array.isArray(entry.offset)) object.position.set(...entry.offset);
    if (entry.shadows !== false) object.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return object;
  }

  // A structure's model, with its LOD levels when registered: THREE.LOD switches by camera distance in the renderer
  // itself (no per-frame work here) and the quality tier scales the distances (setQuality). Only the main model is
  // required; a level that fails to load is left out.
  // v1.10.29: an entry's `low` file (its season's) is the far level past `near` -- the same High/Low pair the nature
  // batches use, here through THREE.LOD (the renderer picks per frame; no hysteresis needed for a single object).
  async function build(entry) {
    const levels = [{ url: entry.url, distance: 0 }, ...(entry.lowUrl ? [{ url: entry.lowUrl, distance: entry.near ?? 60 }] : []), ...(Array.isArray(entry.lod) ? entry.lod : [])];
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
  // v1.10.17: kept as a record, so a change of season can swap the model (setDay).
  // v1.10.29 `onSwap(entry | null)`: told when the model comes in (its registry entry) or goes (null), for game parts
  // that sit on the look (the map board's picture moves onto the model's panel).
  function attach(ids, holder, procedural, onSwap = null) { const rec = { ids, holder, procedural, onSwap, url: null, object: null }; attaches.push(rec); applyAttach(rec); }
  // v1.10.36 10월 할로윈: at night every model's window glass glows warm (the materials are shared by a file's copies,
  // so each is set once; those that load later take the current state)
  const glassMats = new Set(); let night = false;
  const lightGlass = (m) => { m.emissive?.set(0xffc46b); m.emissiveIntensity = night ? 0.9 : 0; };
  // a flattened model (one vertex-coloured mesh) lights its window vertices (`glow`) by one shared value: no extra draw
  const nightGlow = { value: 0 }; let flatGlass = 0;
  function flatMaterial(roughness) {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0 });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.nightGlow = nightGlow;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float nightGlow;\nvarying float vGlow;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.77, 0.42) * vGlow * nightGlow;');
    };
    return material;
  }
  function noteGlass(object) { object?.traverse((o) => { for (const m of [].concat(o.material || [])) if (m.name === 'glass' && !glassMats.has(m)) { glassMats.add(m); lightGlass(m); } }); }
  function setNight(on) { night = Boolean(on); nightGlow.value = night ? 0.9 : 0; for (const m of glassMats) lightGlass(m); }
  function swapAttach(rec, object, entry = null) {
    noteGlass(object);
    if (rec.object) { rec.holder.remove(rec.object); const i = lods.indexOf(rec.object); if (i >= 0) lods.splice(i, 1); for (const g of fittedOwn.get(rec.object) || []) g.dispose(); }
    rec.object = object; if (object) rec.holder.add(object);
    rec.procedural.visible = !object;
    rec.onSwap?.(object ? entry : null);
    rec.snowEntry = object && entry?.snow ? entry : null; rec.snow = null; applySnow(rec);
  }

  // v1.10.32 겨울 지붕 눈 (IDEAS 섬 계절: four zones, the seasons one zone clockwise each day): a building with `snow`
  // in a zone whose season today is winter wears snow on its roof -- the made snowcap (04 pack: flat, gable, round) of
  // its roof's kind, laid over the roof's own faces (asset-pipeline roofShape / drapeSnow), worked out once per model
  // file and shared by its copies; shown or hidden as the day turns its zone's season.
  const roofOf = new Map(); // building url -> Promise<{ geometry, material } | null>
  const isRoof = (name) => /roof/i.test(name || '');
  function roofSnow(entry) {
    if (!roofOf.has(entry.url)) {
      roofOf.set(entry.url, cache.get(entry.url).then(async (gltf) => {
        if (!gltf) return null;
        gltf.scene.updateMatrixWorld(true);
        const tris = []; const v = new THREE.Vector3();
        gltf.scene.traverse((o) => {
          if (!o.isMesh || !isRoof([].concat(o.material)[0]?.name)) return;
          const g = o.geometry; const P = g.attributes.position; const idx = g.index;
          const n = idx ? idx.count : P.count;
          for (let i = 0; i < n; i += 1) { v.fromBufferAttribute(P, idx ? idx.getX(i) : i).applyMatrix4(o.matrixWorld); tris.push(v.x, v.y, v.z); }
        });
        if (!tris.length) return null;
        const roof = P.roofShape(Float32Array.from(tris));
        const cap = await cache.get(registry[`struct.snowcap.${roof.kind}`]?.url);
        let capMesh = null; cap?.scene.updateMatrixWorld(true); cap?.scene.traverse((o) => { if (o.isMesh && !capMesh) capMesh = o; });
        if (!capMesh) return null;
        const cp = capMesh.geometry.attributes.position; const pos = new Float32Array(cp.count * 3);
        for (let i = 0; i < cp.count; i += 1) { v.fromBufferAttribute(cp, i).applyMatrix4(capMesh.matrixWorld); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; }
        const draped = P.drapeSnow(pos, capMesh.geometry.index ? Array.from(capMesh.geometry.index.array) : null, roof);
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(draped.pos, 3)); geometry.setIndex(draped.index);
        geometry.computeVertexNormals(); geometry.computeBoundingSphere(); made.push(geometry);
        return { geometry, material: capMesh.material, kind: roof.kind };
      }));
    }
    return roofOf.get(entry.url);
  }
  function applySnow(rec) {
    const winter = Boolean(rec.snowEntry) && lookOf(rec.zone) === 'winter';
    if (rec.snow) rec.snow.visible = winter;
    if (!winter || rec.snow || rec.snowPending === rec.object) return;
    const object = rec.object; const entry = rec.snowEntry; rec.snowPending = object;
    roofSnow(entry).then((snow) => {
      if (disposed || !snow || rec.object !== object) return;
      const group = new THREE.Group(); group.name = 'roofSnow'; group.userData.kind = snow.kind;
      const mesh = new THREE.Mesh(snow.geometry, snow.material); mesh.receiveShadow = true; group.add(mesh);
      if (object.isLOD) place(group, entry); // a LOD's levels carry the entry's scale and turn; a single model carries them itself
      object.add(group); rec.snow = group; group.visible = lookOf(rec.zone) === 'winter';
    }).catch((error) => onError(entry.url, error));
  }
  function applyAttach(rec) {
    rec.holder.getWorldPosition(placeOf);
    rec.zone = T ? T.seasonZoneAt(placeOf.x, placeOf.z) : -1; // v1.10.27: the season of the zone it stands in
    const hit = P.pick(registry, rec.ids, off, lookOf(rec.zone)); const url = hit?.entry.url || null;
    if (url === rec.url) return;
    rec.url = url;
    if (!hit) { swapAttach(rec, null); return; }
    shown[hit.id] = 'loading';
    build(hit.entry).then((object) => {
      if (disposed || rec.url !== url || !rec.holder.parent) return;
      if (object && rec.holder.userData.fit) object = fitted(object, rec.holder.userData.fit);
      swapAttach(rec, object, hit.entry); shown[hit.id] = object ? 'model' : 'procedural';
    }).catch((error) => { shown[hit.id] = 'procedural'; onError(hit.id, error); });
  }

  // v1.10.29 a holder with `userData.fit(v)` (a bridge: island.js) gets the model reshaped to the game's own walking
  // surface: every vertex, in the holder's space after the entry's scale/turn/offset, goes through fit(v) into a
  // geometry of its own (flat-shaded, it is low-poly). Disposed when the holder's model changes (fittedOwn).
  const fittedOwn = new WeakMap();
  function fitted(object, fit) {
    object.updateMatrixWorld(true);
    const out = new THREE.Group(); const own = [];
    const inv = new THREE.Matrix4().copy(object.parent ? object.parent.matrixWorld : new THREE.Matrix4()).invert(); const v = new THREE.Vector3();
    object.traverse((o) => {
      if (!o.isMesh) return;
      const g = floats(o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      const P = g.attributes.position;
      for (let i = 0; i < P.count; i += 1) { fit(v.fromBufferAttribute(P, i)); P.setXYZ(i, v.x, v.y, v.z); }
      g.deleteAttribute('normal'); g.computeVertexNormals(); g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, o.material); mesh.castShadow = o.castShadow; mesh.receiveShadow = o.receiveShadow;
      out.add(mesh); own.push(g);
    });
    fittedOwn.set(out, own);
    return out;
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
    // v1.10.36: a model that glows (an emissive material, the jack-o'-lantern's inside) keeps its own materials
    const plain = meshes.every((m) => [].concat(m.material).length === 1 && m.material.isMeshStandardMaterial && !m.material.transparent && TEXTURE_SLOTS.every((slot) => !m.material[slot]) && m.material.emissive.getHex() === 0);
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
        g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(count).fill(m.material.name === 'glass' ? 1 : 0), 1)); // v1.10.36: a window, lit at night
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
      const material = flatMaterial(roughness);
      if (meshes.some((m) => m.material.name === 'glass')) flatGlass += 1;
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
  // colors: [its tint per copy] | null, shadow }. Every copy is drawn with the very matrix the procedural copy had
  // (place, turn, size -- so where things stand, their collision and every game rule stay as they were).
  // v1.10.27 4계절 동시 존재: each copy shows the season of the zone its place is in (fixed per copy), today's season of
  // each zone comes from the day -- so a square holds one group per zone it touches, with that zone's seasonal model;
  // the copies are not multiplied. A new day rebuilds the groups with the moved seasons.
  // v1.10.28 섬 전체 High/Low LOD (사용자 결정 2026-10-05): with a model, a copy shows it at every distance -- the full
  // (High) model near the player, the same design simplified (Low, the entry's `low` file of that season, made by the
  // build pipeline) farther away -- so the island keeps one art style everywhere and never turns procedural with
  // distance. Each zone group has one InstancedMesh per model part for High and one for Low, sharing the loaded
  // geometry and material (disposed with the file, never per copy). A copy turns High inside `near` and back to Low
  // only past `near` x HIGH_BAND (hysteresis, asset-pipeline `highState`); only squares where a copy changed side are
  // filled again. Only High casts shadows (the shadow camera covers about 30 around the player anyway). Without a Low
  // file (rocks, the stump: already light) the High model is used at every distance. The procedural copies are only
  // the fallback: a season with no model (nothing registered, a failed file, switched off).
  function batch(ids, cells) { const rec = { ids, cells, key: null, entry: null, placed: null }; batches.push(rec); applyBatch(rec); }
  // each copy's zone, worked out once (places never move)
  const zonesOf = (cell) => (cell.zones ||= cell.matrices.map((m) => (T ? T.seasonZoneAt(m.elements[12], m.elements[14]) : -1)));
  // the copies into their zone group's High or Low meshes (by p.flags), the ones without a model in the procedural mesh
  // v1.10.29: a cell may have several procedural meshes placed with the same matrices (a lamp's pole and its bulb);
  // each shows the copies without a model.
  function fill(p) {
    const { cell } = p; let b = 0;
    for (const g of p.groups.values()) { g.a = 0; g.b = 0; }
    cell.matrices.forEach((m, i) => {
      const g = p.groups.get(p.zones[i]);
      if (!g) { for (const proc of cell.procedural) { proc.setMatrixAt(b, m); if (cell.colors) proc.setColorAt(b, cell.colors[i]); } b += 1; return; }
      const high = p.flags[i] === 1 || !g.low; // no Low file: High everywhere
      for (const im of (high ? g.high : g.low)) im.setMatrixAt(high ? g.a : g.b, both.multiplyMatrices(m, local).multiply(im.userData.part));
      if (high) g.a += 1; else g.b += 1;
    });
    const set = (meshes, n) => { for (const im of meshes) { im.count = n; im.visible = n > 0; im.instanceMatrix.needsUpdate = true; } }; // none: not even a call
    p.near = 0; p.far = 0;
    for (const g of p.groups.values()) { set(g.high, g.a); if (g.low) set(g.low, g.b); p.near += g.a; p.far += g.b; }
    for (const proc of cell.procedural) { proc.count = b; proc.visible = b > 0; proc.instanceMatrix.needsUpdate = true; if (proc.instanceColor) proc.instanceColor.needsUpdate = true; }
    p.procedural = b;
  }
  function restoreProcedural(cell) {
    for (const proc of cell.procedural) {
      cell.matrices.forEach((m, i) => { proc.setMatrixAt(i, m); if (cell.colors) proc.setColorAt(i, cell.colors[i]); });
      proc.count = cell.matrices.length; proc.visible = proc.count > 0;
      proc.instanceMatrix.needsUpdate = true; if (proc.instanceColor) proc.instanceColor.needsUpdate = true;
    }
  }
  function clearBatch(rec) {
    if (rec.placed) {
      for (const p of rec.placed) {
        for (const g of p.groups.values()) for (const im of [...g.high, ...(g.low || [])]) { p.cell.parent.remove(im); im.dispose(); } // the instance buffers; geometry and material stay the file's
        p.groups.clear(); restoreProcedural(p.cell);
      }
    }
    rec.placed = null; rec.entry = null;
  }
  const local = new THREE.Matrix4(); const both = new THREE.Matrix4();
  const entryMatrix = (entry, out) => out.compose(new THREE.Vector3(...(Array.isArray(entry.offset) ? entry.offset : [0, 0, 0])), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), entry.rotationY || 0), new THREE.Vector3().setScalar(entry.scale ?? 1));
  function applyBatch(rec) {
    // the model (and its Low file) of each zone today (zones -1..3; -1 = the neutral plaza)
    const zones = new Set(rec.cells.flatMap((cell) => zonesOf(cell)));
    const hits = new Map([...zones].map((zone) => [zone, P.pick(registry, rec.ids, off, lookOf(zone))]));
    const key = `${day}|${[...hits].map(([zone, hit]) => `${zone}:${hit?.entry.url || ''}:${hit?.entry.lowUrl || ''}`).sort().join(',')}`;
    if (key === rec.key) return;
    rec.key = key;
    const any = [...hits.values()].find(Boolean);
    if (!any) { clearBatch(rec); return; }
    const urls = [...new Set([...hits.values()].filter(Boolean).flatMap((hit) => [hit.entry.url, hit.entry.lowUrl].filter(Boolean)))];
    for (const hit of hits.values()) if (hit) shown[hit.id] = 'loading';
    Promise.all(urls.map((url) => cache.get(url))).then((loaded) => {
      if (disposed || rec.key !== key) return;
      clearBatch(rec);
      const models = new Map(urls.map((url, i) => [url, loaded[i]]));
      if (![...hits.values()].some((hit) => hit && models.get(hit.entry.url))) { for (const hit of hits.values()) if (hit) shown[hit.id] = 'procedural'; return; } // every file failed
      const entry = any.entry; entryMatrix(entry, local);
      rec.zoneUrls = Object.fromEntries([...hits].map(([zone, hit]) => [zone, hit && models.get(hit.entry.url) ? hit.entry.url : null]));
      rec.zoneLowUrls = Object.fromEntries([...hits].map(([zone, hit]) => [zone, hit?.entry.lowUrl && models.get(hit.entry.lowUrl) && models.get(hit.entry.url) ? hit.entry.lowUrl : null]));
      rec.placed = rec.cells.map((cell) => {
        const p = { cell, near: 0, far: 0, procedural: 0, zones: zonesOf(cell), flags: new Uint8Array(cell.matrices.length), groups: new Map() };
        const counts = new Map(); for (const zone of p.zones) counts.set(zone, (counts.get(zone) || 0) + 1);
        for (const [zone, count] of counts) {
          const hit = hits.get(zone); const gltf = hit && models.get(hit.entry.url);
          if (!gltf) continue; // this zone's season has no model: its copies stay procedural
          const lowGltf = hit.entry.lowUrl ? models.get(hit.entry.lowUrl) : null;
          const meshesOf = (model, shadow) => partsOf(model).map(({ geometry, material, matrix }) => {
            const im = new THREE.InstancedMesh(geometry, material, count);
            im.userData.part = matrix; // the part's place in the model, after the copy's own and the entry's
            let k = 0; cell.matrices.forEach((m, i) => { if (p.zones[i] === zone) im.setMatrixAt(k++, both.multiplyMatrices(m, local).multiply(matrix)); });
            im.computeBoundingSphere(); // over every copy of the group, so culling never hides one the update brings in
            im.count = 0; im.visible = false; im.castShadow = shadow; im.receiveShadow = true;
            cell.parent.add(im); return im;
          });
          p.groups.set(zone, { high: meshesOf(gltf, cell.shadow && entry.shadows !== false), low: lowGltf ? meshesOf(lowGltf, false) : null, a: 0, b: 0 });
        }
        fill(p); // every copy Low (or High without a Low file) until the next update() works out the near ones
        return p;
      });
      for (const hit of hits.values()) if (hit) shown[hit.id] = models.get(hit.entry.url) ? 'model' : 'procedural';
      rec.entry = entry; lastX = NaN;
    }).catch((error) => { shown[any.id] = 'procedural'; onError(any.id, error); });
  }
  // v1.10.31: a copy of a square changed (a pulled weed's matrix set to nothing) -- the square is drawn again; and a
  // whole batch taken away (the weeds laid out anew on a new day; the caller drops its procedural meshes)
  function refill(cell) {
    for (const rec of batches) {
      if (!rec.cells.includes(cell)) continue;
      const p = rec.placed?.find((q) => q.cell === cell);
      if (p) fill(p); else restoreProcedural(cell);
    }
  }
  function unbatch(cells) { const i = batches.findIndex((rec) => rec.cells === cells); if (i < 0) return; clearBatch(batches[i]); batches.splice(i, 1); }
  // v1.10.31: a model in a character's right hand for a moment (a weed pulled out with its roots)
  // A thing in a character's hands: a moment (`ms`), or kept (`ms` null) under `key` until letGo -- v1.10.32 운반: carried
  // in front of the chest (`bone` Chest, `at` there; `proc` on a procedural character) -- and handed over to another
  // character's right hand (handOver: a lost thing given back). One held thing per key; a character thrown away drops it.
  const boneOf = (c, pattern) => { let hit = null; c.assetRoot?.traverse((o) => { if (o.isBone && pattern.test(o.name)) hit = o; }); return hit; };
  function seat(c, rec) {
    const bone = rec.bone === 'Chest' ? boneOf(c, /^Chest$/) : boneOf(c, /^Hand\.?R$/);
    if (bone) { bone.add(rec.object); rec.object.position.set(...(rec.at || [0, 0, 0])); if (rec.rot) rec.object.rotation.set(...rec.rot); } // v1.10.42 rot: a fish held side-on
    else if (rec.bone === 'Chest') { c.root.add(rec.object); rec.object.position.set(...(rec.proc || [0, 0.65, 0.38])); }
    else { (c.armR || c.root).add(rec.object); rec.object.position.set(0, -0.5, 0.1); } // the procedural arm's end
  }
  function hold(c, ids, ms = 900, { key = null, bone = 'Hand.R', at = null, rot = null, proc = null, stand = null } = {}) {
    const hit = P.pick(registry, ids, off, null); if (!hit) return;
    const token = {}; if (key) { letGo(c, key); (c.holding ||= {})[key] = { token, object: null }; }
    cache.get(hit.entry.url).then((gltf) => {
      if (disposed || !gltf || !c.root.parent || (key && c.holding?.[key]?.token !== token)) return;
      const rec = { token, object: instance(gltf, hit.entry), bone, at, rot, proc };
      seat(c, rec); stand?.removeFromParent(); // the procedural stand-in gives way
      if (key) c.holding[key] = rec; else setTimeout(() => rec.object.removeFromParent(), ms);
    }).catch((error) => onError(hit.id, error));
  }
  function letGo(c, key) { const rec = c.holding?.[key]; if (!rec) return; rec.object?.removeFromParent(); delete c.holding[key]; }
  function handOver(from, to, key) {
    const rec = from.holding?.[key]; if (!rec?.object) return false;
    delete from.holding[key]; letGo(to, key);
    const given = { ...rec, bone: 'Hand.R', at: [0, -0.12, -0.05] }; (to.holding ||= {})[key] = given; seat(to, given);
    return true;
  }

  // Which copies are near enough for High, worked out again once the player has moved a unit; a square is filled again
  // only when one of its copies changed side.
  let lastX = NaN; let lastZ = NaN;
  function update(x, z) {
    if (Math.hypot(x - lastX, z - lastZ) < 1) return;
    lastX = x; lastZ = z;
    for (const rec of batches) {
      if (!rec.placed) continue;
      entryMatrix(rec.entry, local);
      const near = P.lodDistance(rec.entry.near ?? 45, quality);
      for (const p of rec.placed) {
        let changed = false;
        p.cell.matrices.forEach((m, i) => {
          const high = P.highState(p.flags[i] === 1, Math.hypot(m.elements[12] - x, m.elements[14] - z), near);
          if (high !== (p.flags[i] === 1)) { p.flags[i] = high ? 1 : 0; changed = true; }
        });
        if (changed) fill(p);
      }
    }
  }

  // v1.10.27: a new day (00:00 KST) -- every season moves one zone clockwise; every structure and batch whose zone's
  // season changed swaps to that season's model (their files are already in the resource cache)
  function setDay(next) {
    if (next === day) return;
    day = next;
    for (const rec of attaches) { applyAttach(rec); applySnow(rec); }
    for (const rec of batches) applyBatch(rec);
  }

  // v1.10.29 한 번 재생(고래 브리칭·물보라): a model with a clip of its own (root motion) is placed under a new holder
  // ({ parent, x, y, z, ry }), plays its first clip once (LoopOnce) and is taken away when it ends. `onCross(world)`:
  // each time the moving root passes the holder's level (the sea surface), going up or down. Driven by tick().
  const playing = []; const played = {}; const at = new THREE.Vector3();
  const place = (object, entry) => { object.scale.multiplyScalar(entry.scale ?? 1); object.rotation.y += entry.rotationY || 0; if (Array.isArray(entry.offset)) object.position.set(...entry.offset); };
  function once(ids, { parent, x = 0, y = 0, z = 0, ry = 0 }, { onCross = null } = {}) {
    const hit = P.pick(registry, ids, off, null); if (!hit) return;
    cache.get(hit.entry.url).then((gltf) => {
      if (disposed || !gltf?.animations?.length) return;
      const holder = new THREE.Group(); holder.position.set(x, y, z); holder.rotation.y = ry; parent.add(holder);
      const object = cloneObject(gltf.scene); place(object, hit.entry); holder.add(object);
      object.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
      const mixer = new THREE.AnimationMixer(object); const clip = gltf.animations[0];
      const action = mixer.clipAction(clip); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
      const root = object.getObjectByName(clip.tracks[0]?.name.split('.')[0]) || object;
      playing.push({ holder, object, mixer, root, t: 0, dur: clip.duration, below: null, onCross });
      played[hit.id] = (played[hit.id] || 0) + 1;
    }).catch((error) => onError(hit.id, error));
  }

  // v1.10.29 계절 낙하 입자: a few falling petals (spring), leaves (autumn) or snowflakes (winter) around the player,
  // each from a ground emitter whose zone's season today picks the kind (summer and the neutral plaza: none). One
  // model each (fx.petal / fx.leaf / fx.snow: a single flake with its FallLoop clip); every emitter is a copy in one
  // InstancedMesh per kind, its clip sampled at its own phase -- no mixer per flake. A flake starts again elsewhere
  // round the player when its loop ends (the clip hides the seam at scale 0). None on the lowest quality tier.
  const AMBIENT = { spring: 'fx.petal', autumn: 'fx.leaf', winter: 'fx.snow' }; const AMBIENT_R = 16; const AMBIENT_N = [0, 18, 36];
  let ambientState = null;
  function ambient(parent) {
    if (ambientState) return;
    ambientState = { kinds: {}, emitters: [], time: 0, counts: {} };
    for (const [season, id] of Object.entries(AMBIENT)) {
      const hit = P.pick(registry, id, off, null); if (!hit) continue;
      cache.get(hit.entry.url).then((gltf) => {
        if (disposed || !gltf?.animations?.length) return;
        let mesh = null; gltf.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; }); if (!mesh) return;
        const clip = gltf.animations[0];
        const track = (end) => clip.tracks.find((t) => t.name.endsWith(end))?.createInterpolant() || null;
        const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, AMBIENT_N[2]); im.count = 0; im.frustumCulled = false; im.castShadow = false; parent.add(im);
        const k = hit.entry.scale ?? 1;
        ambientState.kinds[season] = { im, k, local: mesh.matrix.clone(), dur: clip.duration, pos: track('.position'), rot: track('.quaternion'), scl: track('.scale') };
        shown[hit.id] = 'model';
      }).catch((error) => onError(hit.id, error));
    }
  }
  const fq = new THREE.Quaternion(); const fp = new THREE.Vector3(); const fs = new THREE.Vector3(); const fm = new THREE.Matrix4(); const fw = new THREE.Matrix4();
  function respawn(e, x, z) {
    const a = Math.random() * Math.PI * 2; const r = 2 + Math.random() * AMBIENT_R;
    e.x = x + Math.cos(a) * r; e.z = z + Math.sin(a) * r; e.y = T ? T.heightAt(e.x, e.z) : 0; e.ry = Math.random() * Math.PI * 2;
    e.season = T ? lookOf(T.seasonZoneAt(e.x, e.z)) : null; e.phase = Math.random() * 10; e.last = -1; e.born = ambientState.time;
  }
  function tickAmbient(dt, x, z) {
    const st = ambientState; if (!st) return;
    st.time += dt;
    const n = AMBIENT_N[quality] ?? AMBIENT_N[2];
    while (st.emitters.length < n) { const e = {}; respawn(e, x, z); st.emitters.push(e); }
    const counts = {};
    for (const k of Object.values(st.kinds)) k.im.count = 0;
    for (let i = 0; i < n; i += 1) {
      const e = st.emitters[i]; const k = st.kinds[e.season];
      if (!k) { if (st.time - e.born > 4) respawn(e, x, z); continue; } // nothing falls here: look again in a while
      const t = (st.time + e.phase) % k.dur;
      if (t < e.last || Math.hypot(e.x - x, e.z - z) > AMBIENT_R * 1.4) { respawn(e, x, z); continue; }
      e.last = t;
      if (k.pos) fp.fromArray(k.pos.evaluate(t)); else fp.set(0, 0, 0);
      if (k.rot) fq.fromArray(k.rot.evaluate(t)); else fq.identity();
      if (k.scl) fs.fromArray(k.scl.evaluate(t)); else fs.set(1, 1, 1);
      fw.makeTranslation(e.x, e.y, e.z).multiply(fm.makeRotationY(e.ry)).multiply(fm.makeScale(k.k, k.k, k.k)).multiply(fm.compose(fp, fq, fs)).multiply(k.local);
      k.im.setMatrixAt(k.im.count, fw); k.im.count += 1; counts[e.season] = (counts[e.season] || 0) + 1;
    }
    for (const k of Object.values(st.kinds)) k.im.instanceMatrix.needsUpdate = true;
    st.counts = counts;
  }
  // each frame: the one-off clips and the falling flakes
  function tick(dt, x, z) {
    for (let i = playing.length - 1; i >= 0; i -= 1) {
      const p = playing[i]; p.t += dt; p.mixer.update(dt);
      p.root.getWorldPosition(at); const below = at.y < p.holder.position.y;
      if (p.below !== null && below !== p.below) p.onCross?.(at.clone());
      p.below = below;
      if (p.t >= p.dur) { p.mixer.stopAllAction(); p.mixer.uncacheRoot(p.object); p.holder.parent?.remove(p.holder); playing.splice(i, 1); }
    }
    tickAmbient(dt, x, z);
    wearLod(x, z);
  }

  // A character: the rigged model goes under c.root (the name tag and chat bubble stay), the procedural body is
  // hidden, and plaza-scene's animate() hands the drawn speed to c.anim (Idle/Walk/Run cross-fades) instead of
  // swinging the procedural joints. One model per character, no LOD (a rig's clips bind to one copy of the bones).
  function dress(ids, c) {
    const hit = P.pick(registry, ids, off, null); if (!hit) return; // characters have no season
    c.assetPending = hit.id; shown[hit.id] = 'loading';
    cache.get(hit.entry.url).then((gltf) => {
      if (disposed || c.assetPending !== hit.id || !c.root.parent) return;
      if (!gltf) { shown[hit.id] = 'procedural'; return; }
      const object = instance(gltf, hit.entry);
      const anim = P.createAnimator(THREE, object, gltf.animations, hit.entry.animations || {}, { walkSpeed, speeds: hit.entry.speeds });
      c.assetRoot = object; c.anim = anim; c.root.add(object); c.body.visible = false; shown[hit.id] = 'model';
    }).catch((error) => { shown[hit.id] = 'procedural'; onError(hit.id, error); });
  }

  // v1.10.30 공통 캐릭터: a character put together from the common-rig body (`character.base`) and wardrobe parts
  // (`plan` from island-assets wardrobeOf: { parts: [ids], colors: { id: { material: colour } }, tint: { material: colour } }).
  // The body is cloned with its own skeleton (SkeletonUtils); every part's skinned meshes -- High and Low files alike --
  // are bound to that same skeleton by joint name (each keeps its own inverse binds and bind matrix), so one
  // AnimationMixer moves everything and a High/Low switch keeps the motion, the sockets and what is worn. Materials are
  // cloned per character before any colour goes on (a dye or a keeper's colours never reach anyone else); a part's
  // dye goes on its dye material only. The clips come from the motion files (one clip each, the same rig).
  // v1.10.32: a material is shared by every character that wears it in the same colours (only a dye or a keeper's own
  // colours make a copy of its own), counted, and freed with the last one; the geometry of a part is shared as loaded,
  // or -- when a combination asks a part to give way (P.fitWardrobe) -- one fitted copy per file and combination.
  const wearMats = new Map(); // key -> { key, material, refs }
  // v1.10.37 원거리 플레이어 가시성: a player's own materials are not faded by the fog (`clear`), so someone walking far
  // off shows from a high or open place; what stands in front still hides them (depth), the islanders fade as before
  function wearMaterial(source, want, clear = false) {
    const key = `${source.uuid}|${want || ''}|${clear ? 'clear' : ''}`;
    let rec = wearMats.get(key);
    if (!rec) { const material = source.clone(); if (want) material.color.set(want); if (clear) material.fog = false; made.push(material); rec = { key, material, refs: 0 }; wearMats.set(key, rec); }
    rec.refs += 1; return rec;
  }
  function dropMaterial(rec) {
    rec.refs -= 1; if (rec.refs > 0) return;
    wearMats.delete(rec.key); rec.material.dispose(); const k = made.indexOf(rec.material); if (k >= 0) made.splice(k, 1);
  }
  // a skinned mesh's vertices in the rig's rest space (its file's own pose: the bones as loaded, its inverse binds and
  // bind matrix -- a quantized file's dequantizing scale is in there too), and back
  const restMatrix = (mesh) => new THREE.Matrix4().multiplyMatrices(mesh.skeleton.bones[0].matrixWorld, mesh.skeleton.boneInverses[0]).multiply(mesh.bindMatrix);
  const restCache = new Map(); // geometry uuid -> rest positions
  function restOf(mesh) {
    const key = mesh.geometry.uuid;
    if (!restCache.has(key)) {
      const attr = mesh.geometry.attributes.position; const M = restMatrix(mesh); const v = new THREE.Vector3(); const out = new Float32Array(attr.count * 3);
      for (let i = 0; i < attr.count; i += 1) { v.fromBufferAttribute(attr, i).applyMatrix4(M); out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z; }
      restCache.set(key, out);
    }
    return restCache.get(key);
  }
  const fittedOf = new Map(); // `${geometry uuid}|${ops}` -> geometry
  function fittedGeometry(mesh, ops) {
    const key = `${mesh.geometry.uuid}|${JSON.stringify(ops)}`;
    if (!fittedOf.has(key)) {
      const g = mesh.geometry; const index = g.index ? Array.from(g.index.array) : null;
      const done = P.applyFit(restOf(mesh), index, ops);
      const out = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(g.attributes)) out.setAttribute(name, attr); // shared, but for a moved position
      if (done.pos) {
        const back = restMatrix(mesh).invert(); const v = new THREE.Vector3(); const arr = new Float32Array(done.pos.length);
        for (let i = 0; i < arr.length; i += 3) { v.set(done.pos[i], done.pos[i + 1], done.pos[i + 2]).applyMatrix4(back); arr[i] = v.x; arr[i + 1] = v.y; arr[i + 2] = v.z; }
        out.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      }
      if (done.index || index) out.setIndex(done.index || index);
      made.push(out); fittedOf.set(key, out);
    }
    return fittedOf.get(key);
  }
  const wearing = []; // characters with a High/Low pair: { c, high: [meshes], low: [meshes], isHigh }
  function wear(c, plan) {
    const base = P.pick(registry, 'character.base', off, null); if (!base || !plan) return;
    const parts = plan.parts.map((id) => P.pick(registry, id, off, null));
    if (parts.some((p) => !p)) return; // a part switched off: the procedural character stays
    const token = {}; c.assetPending = token; shown['character.base'] = 'loading';
    const urls = [base.entry.url, base.entry.lowUrl, ...parts.flatMap((p) => [p.entry.url, p.entry.lowUrl])].filter(Boolean);
    const clipUrls = Object.values(base.entry.clips || {});
    Promise.all([...urls, ...clipUrls].map((url) => cache.get(url))).then((loaded) => {
      if (disposed || c.assetPending !== token || !c.root.parent) return;
      const byUrl = new Map([...urls, ...clipUrls].map((url, i) => [url, loaded[i]]));
      if (urls.some((url) => !byUrl.get(url))) { console.warn('wear: missing', urls.filter((url) => !byUrl.get(url))); shown['character.base'] = 'procedural'; return; } // a file failed: procedural
      const object = cloneObject(byUrl.get(base.entry.url).scene);
      place(object, base.entry);
      const bones = new Map(); let rootBone = null;
      object.traverse((o) => { if (o.isBone) { bones.set(o.name, o); if (!o.parent?.isBone) rootBone = o; } });
      const high = []; const low = []; const mats = [];
      const worn = {}; // material name -> the colour put on it (tests)
      const own = (m, colors) => { // the shared material in the colours this character wants on it
        const list = [].concat(m.material).map((x) => { const want = colors?.[x.name] || plan.tint?.[x.name]; if (want) worn[x.name] = want; const rec = wearMaterial(x, want, c.player); mats.push(rec); return rec.material; });
        m.material = Array.isArray(m.material) ? list : list[0];
      };
      const meshesOf = (gltf) => { const copy = cloneObject(gltf.scene); copy.updateMatrixWorld(true); const list = []; copy.traverse((o) => { if (o.isSkinnedMesh) list.push(o); }); return list; };
      // what each part gives way to in this combination (asset-pipeline fitWardrobe), worked out on the High files
      const fits = P.fitWardrobe(parts.map((p, i) => ({ id: plan.parts[i], fit: p.entry.fit || null, pos: meshesOf(byUrl.get(p.entry.url)).flatMap((m) => Array.from(restOf(m))) })));
      const adopt = (gltf, colors, into, fit) => {
        for (const m of meshesOf(gltf)) {
          if (fit?.hide.some((name) => [].concat(m.material).some((x) => x.name === name))) continue; // given way to a worn part
          if (fit?.ops.length) m.geometry = fittedGeometry(m, fit.ops);
          const skeleton = new THREE.Skeleton(m.skeleton.bones.map((b) => bones.get(b.name)), m.skeleton.boneInverses.map((x) => x.clone()));
          if (skeleton.bones.some((b) => !b)) throw new Error(`rig mismatch: ${m.name}`);
          const bindMatrix = m.bindMatrix.clone(); m.removeFromParent(); rootBone.parent.add(m); m.bind(skeleton, bindMatrix);
          m.frustumCulled = false; m.castShadow = true; own(m, colors); into.push(m);
        }
      };
      object.traverse((o) => { if (o.isSkinnedMesh) { o.frustumCulled = false; o.castShadow = true; own(o, null); high.push(o); } });
      const lowBody = base.entry.lowUrl ? byUrl.get(base.entry.lowUrl) : null;
      if (lowBody) adopt(lowBody, null, low, null);
      parts.forEach((p, i) => {
        const colors = plan.colors?.[plan.parts[i]]; const fit = fits[plan.parts[i]];
        adopt(byUrl.get(p.entry.url), colors, p.entry.lowUrl ? high : [], fit); // a part without a Low file shows at every distance
        if (p.entry.lowUrl) adopt(byUrl.get(p.entry.lowUrl), colors, low, fit);
      });
      c.wearMats = mats; c.wornColors = worn; c.fitted = Object.fromEntries(Object.entries(fits).filter(([, f]) => f.ops.length || f.hide.length).map(([id, f]) => [id, f.ops.map((op) => op.kind).concat(f.hide.length ? ['hide'] : [])]));
      const clips = clipUrls.map((url) => byUrl.get(url)?.animations?.[0]).filter(Boolean);
      const anim = P.createAnimator(THREE, object, clips, { ...(base.entry.animations || {}), ...(c.animNames || {}) }, { walkSpeed, speeds: base.entry.speeds }); // v1.10.41 c.animNames: a character's own idle (the mayor's GuardIdle)
      // the clips hold the upper arms about 43° out from the body (it read as a gorilla's stance on the island): after
      // the mixer each upper arm is turned `armTuck` down toward the body, in its parent's space -- about 20° out in every
      // clip, the clips and joints untouched. The turn of the frame before is taken off first: a clip without an arm
      // track (Idle) does not set the arm again, and the turn must not pile up.
      const tuck = [[bones.get('UpperArmL') || bones.get('UpperArm.L'), 1], [bones.get('UpperArmR') || bones.get('UpperArm.R'), -1]].filter(([b]) => b)
        .map(([bone, side]) => { const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), side * (base.entry.armTuck ?? 0)); return [bone, q, q.clone().invert()]; });
      // v1.10.32 운반: while `c.carrying`, the arms hold the thing in front -- CarryIdle's arms over whatever the legs do
      // (Idle, Walk, Run): after the frame's pose the shoulders, arms and hands take that clip's (it holds still); the
      // next frame first puts back what they had, so the tuck and the mixer go on as if nothing had been laid over them
      const carryClip = clips.find((clip) => clip.name === base.entry.animations?.carry);
      const carryArms = (carryClip?.tracks || []).filter((t) => /^(Shoulder|UpperArm|LowerArm|Hand)\.?[LR]\.quaternion$/.test(t.name))
        .map((t) => [bones.get(t.name.replace(/\.quaternion$/, '')), t.createInterpolant(), new THREE.Quaternion()]).filter(([bone]) => bone);
      const play = anim.update.bind(anim); let tucked = false; let laid = false;
      anim.update = (dt, speed) => {
        if (laid) { for (const [bone, , kept] of carryArms) bone.quaternion.copy(kept); laid = false; }
        if (tucked) for (const [bone, , undo] of tuck) bone.quaternion.premultiply(undo);
        play(dt, speed);
        tucked = !c.noTuck; // v1.10.41/42: not over clips that pose the arms themselves (the mayor's, fishing)
        if (tucked) for (const [bone, q] of tuck) bone.quaternion.premultiply(q);
        if (c.carrying && carryArms.length) { for (const [bone, held, kept] of carryArms) { kept.copy(bone.quaternion); bone.quaternion.fromArray(held.evaluate(0)); } laid = true; }
      };
      c.assetRoot = object; c.anim = anim; c.root.add(object); c.body.visible = false; shown['character.base'] = 'model';
      c.wardrobe = plan.parts.slice();
      // v1.10.35: how tall it stands with what it wears (the bind pose, a hat counted), for the name tag over its head
      c.root.updateMatrixWorld(true); const toRoot = c.root.matrixWorld.clone().invert(); const top = new THREE.Box3();
      for (const m of high) { m.skeleton.update(); m.computeBoundingBox(); top.union(m.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, m.matrixWorld))); }
      if (Number.isFinite(top.max.y) && top.max.y > 0.5) { c.headTop = top.max.y; c.onWorn?.(); }
      for (const key of Object.keys(c.holding || {})) if (c.holding[key].object) seat(c, c.holding[key]); // a thing held before the model came: into its hands
      const rec = { c, high, low, isHigh: true }; if (low.length) { for (const m of low) m.visible = false; wearing.push(rec); }
    }).catch((error) => { shown['character.base'] = 'procedural'; onError('character.base', error); });
  }
  // High near the player, Low farther (the body's `near`, the same band as the nature), the mixer untouched
  const wpos = new THREE.Vector3();
  function wearLod(x, z) {
    const near = P.lodDistance(registry['character.base']?.near ?? 22, quality);
    for (let i = wearing.length - 1; i >= 0; i -= 1) {
      const w = wearing[i]; if (!w.c.root.parent || w.c.assetRoot === null) { wearing.splice(i, 1); continue; }
      w.c.root.getWorldPosition(wpos);
      const high = P.highState(w.isHigh, Math.hypot(wpos.x - x, wpos.z - z), near);
      if (high !== w.isHigh) { w.isHigh = high; for (const m of w.high) m.visible = high; for (const m of w.low) m.visible = !high; }
    }
  }

  // Before a character is thrown away: its copy goes, the shared geometry stays for the others.
  function release(c) {
    c.anim?.dispose(); if (c.assetRoot) c.root.remove(c.assetRoot);
    for (const rec of c.wearMats || []) dropMaterial(rec);
    for (const key of Object.keys(c.holding || {})) letGo(c, key);
    c.anim = null; c.assetRoot = null; c.assetPending = null; c.wardrobe = null; c.wearMats = null; c.fitted = null;
  }

  function setQuality(next) {
    quality = next; lastX = NaN;
    for (const lod of lods) for (const level of lod.levels) level.distance = P.lodDistance(lodBase.get(level.object) || 0, quality);
  }

  function dispose() {
    disposed = true;
    for (const p of playing.splice(0)) { p.mixer.stopAllAction(); p.holder.parent?.remove(p.holder); }
    for (const k of Object.values(ambientState?.kinds || {})) { k.im.parent?.remove(k.im); k.im.dispose(); }
    for (const rec of batches) clearBatch(rec);
    for (const rec of attaches) for (const g of (rec.object && fittedOwn.get(rec.object)) || []) g.dispose();
    for (const x of made) x.dispose();
    cache.clear((gltf) => gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      for (const material of [].concat(o.material)) { for (const value of Object.values(material)) if (value?.isTexture) value.dispose(); material.dispose(); }
    }));
  }

  // v1.10.27: url = the model of the first copy's zone; zones = per zone (-1 the plaza) its season today, its file and
  // how many copies stand in it
  // v1.10.27/28: url = the model of the first copy's zone; zones = per zone (-1 the plaza) its season today, its High
  // and Low files and how many copies stand in it; near / far / procedural = copies drawn High / Low / procedural;
  // first = how the first copy (at) is drawn
  const batchDebug = () => batches.map((rec) => {
    const zones = {};
    for (const cell of rec.cells) zonesOf(cell).forEach((zone) => { zones[zone] ||= { look: lookOf(zone), url: rec.zoneUrls?.[zone] ?? null, low: rec.zoneLowUrls?.[zone] ?? null, copies: 0 }; zones[zone].copies += 1; });
    const p0 = rec.placed?.[0]; const firstZone = rec.cells[0] ? zonesOf(rec.cells[0])[0] : null; const g0 = p0?.groups.get(firstZone);
    const sum = (key) => (rec.placed ? rec.placed.reduce((n, p) => n + p[key], 0) : 0);
    return { ids: [].concat(rec.ids), url: rec.placed ? rec.zoneUrls?.[firstZone] ?? null : null, low: rec.placed ? rec.zoneLowUrls?.[firstZone] ?? null : null, zones,
      copies: rec.cells.reduce((n, c) => n + c.matrices.length, 0), squares: rec.cells.length, placed: Boolean(rec.placed),
      near: sum('near'), far: sum('far'), procedural: rec.placed ? sum('procedural') : rec.cells.reduce((n, c) => n + c.matrices.length, 0),
      parts: rec.placed ? [...(rec.placed.find((p) => p.groups.size)?.groups.values() || [])][0]?.high.length ?? 0 : 0,
      first: !g0 ? 'procedural' : p0.flags[0] === 1 || !g0.low ? 'high' : 'low',
      at: rec.cells[0]?.matrices[0] ? [rec.cells[0].matrices[0].elements[12], rec.cells[0].matrices[0].elements[14]] : null }; // one copy's place (tests)
  });
  const attachDebug = () => attaches.map((rec) => ({ ids: [].concat(rec.ids), zone: rec.zone, look: lookOf(rec.zone), url: rec.url, ...(rec.snowEntry ? { snow: rec.snow ? (rec.snow.visible ? rec.snow.userData.kind : 'hidden') : 'none' } : {}) }));
  return { attach, dress, wear, release, batch, refill, unbatch, hold, letGo, handOver, update, setDay, setNight, setQuality, once, ambient, tick, dispose, debug: () => ({ glass: { materials: glassMats.size, flat: flatGlass, lit: [...glassMats].filter((m) => m.emissiveIntensity > 0).length + (nightGlow.value > 0 ? flatGlass : 0) }, shown: { ...shown }, files: cache.status(), lods: lods.length, quality, day, batches: batchDebug(), attaches: attachDebug(), played: { ...played }, playing: playing.length, wearing: wearing.map((w) => ({ high: w.isHigh, parts: w.c.wardrobe, fitted: w.c.fitted || {}, meshes: { high: w.high.length, low: w.low.length } })), ambient: ambientState ? { kinds: Object.keys(ambientState.kinds), drawn: { ...ambientState.counts } } : null }) };
}
