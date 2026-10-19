'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// v1.10.26 게임 아일랜드 GLB 예산: every island model is a build-pipeline output (tools/assets/build-island-models.js:
// quantized + Meshopt, meshes merged) within tools/assets/budgets.json, and the build config, the files and the
// registry agree. Read from the GLB JSON chunk only (counts are there even when the buffers are compressed).
const root = path.join(__dirname, '..');
const budgets = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'assets', 'budgets.json'), 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'assets', 'island-models.json'), 'utf8'));
const outDir = path.join(root, config.outDir);

function glbInfo(file) {
  const buffer = fs.readFileSync(file);
  assert.equal(buffer.toString('utf8', 0, 4), 'glTF', file);
  assert.equal(buffer.readUInt32LE(4), 2, `${file} glTF 2.0`);
  const json = JSON.parse(buffer.toString('utf8', 20, 20 + buffer.readUInt32LE(12)));
  let triangles = 0;
  for (const mesh of json.meshes || []) for (const p of mesh.primitives) {
    assert.ok(p.mode === undefined || p.mode === 4, `${file} triangles only`);
    triangles += (p.indices !== undefined ? json.accessors[p.indices].count : json.accessors[p.attributes.POSITION].count) / 3;
  }
  return { meshes: (json.meshes || []).length, nodes: (json.nodes || []).length, materials: (json.materials || []).length,
    textures: (json.textures || []).length + (json.images || []).length, triangles, extensions: json.extensionsUsed || [], animations: (json.animations || []).length,
    joints: (json.skins || []).map((skin) => skin.joints.map((i) => json.nodes[i].name)), rigNodes: (json.nodes || []).filter((n) => n.mesh === undefined).length };
}

const glbs = () => fs.readdirSync(outDir, { recursive: true }).map(String).filter((f) => f.endsWith('.glb')).map((f) => f.split(path.sep).join('/')).sort();

test('아일랜드 GLB 예산: 모든 모델이 파이프라인 출력(양자화+Meshopt)이고 메시·노드·재질·삼각형·텍스처 상한 안', () => {
  const files = glbs();
  assert.ok(files.length >= 32);
  for (const f of files) {
    const info = glbInfo(path.join(outDir, f));
    const unquantized = budgets.fileOverrides?.[f]?.unquantized; // v1.10.79 (budgets $motion36): only those exact bytes
    if (unquantized) assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(outDir, f))).digest('hex'), budgets.fileOverrides[f].sourceSha256, `${f}: unquantized only for the verified bytes`);
    for (const ext of budgets.requiredExtensions) assert.ok(info.extensions.includes(ext) || (unquantized && ext === 'KHR_mesh_quantization'), `${f}: ${ext} 필요(빌드 파이프라인 출력)`);
    for (const ext of info.extensions) assert.ok(budgets.allowedExtensions.includes(ext), `${f}: 허용되지 않은 확장 ${ext}`);
    // v1.10.30 a character body, a wardrobe part or a motion: the common 20-joint rig kept whole (no node or mesh
    // merging past it), every joint name in its order
    if (f.startsWith('characters/') && !f.startsWith('characters/props/')) { // (hand-held props are still models)
      if (f.startsWith('characters/motions/')) { assert.equal(info.meshes, 0, f); assert.equal(info.animations, 1, f); continue; }
      if (!unquantized) assert.equal(info.joints.length, 1, `${f}: one skin`); // (v1.10.79: the delivered bytes keep a mesh -- and its skin -- per material)
      const runtimeName = (n) => n.replace(/\./g, ''); // three.js drops the dots from node names (Shoulder.L -> ShoulderL)
      for (const joints of info.joints) assert.deepEqual(unquantized ? joints.map(runtimeName) : joints, unquantized ? budgets.rig.map(runtimeName) : budgets.rig, `${f}: 공통 20관절`);
      const exception=budgets.fileOverrides?.[f];
      const triangleLimit=exception?.triangles??budgets.character.triangles;
      if(triangleLimit>budgets.character.triangles){
        assert.match(exception.reason,/User-authorized transformation fidelity exception/,`${f}: scoped fidelity exception required`);
        const hash=require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(outDir,f))).digest('hex');
        assert.equal(hash,exception.sourceSha256,`${f}: exception applies only to the verified model bytes`);
      }
      assert.ok(info.meshes <= (unquantized ? info.materials : budgets.character.meshes) && info.materials <= budgets.max.materials && info.triangles <= triangleLimit, `${f}: ${JSON.stringify(info)}`);
      continue;
    }
    for (const [key, max] of Object.entries(budgets.max)) {
      const limit = budgets.fileOverrides?.[f]?.[key] ?? (f.startsWith('train-v1/train_carriage') && budgets.trainCarriage[key] ? budgets.trainCarriage[key] : info.animations && budgets.flapping[key] && f.startsWith('halloween-decor-v1/bat') ? budgets.flapping[key] : info.animations && budgets.pet[key] && f.startsWith('together-v1/pet_') ? budgets.pet[key] : key === 'nodes' && info.animations ? budgets.animatedNodes : key === 'triangles' && f.startsWith('halloween-v1/') ? budgets.landmark.triangles : max); // named, scoped exceptions; never relax the global budget
      assert.ok(info[key] <= limit, `${f}: ${key} ${info[key]} > ${limit}`);
    }
  }
});

test('아일랜드 GLB 빌드 설정: 설정·파일·등록부가 서로 맞는다', () => {
  const files = new Set(glbs());
  const configured = new Set();
  for (const entry of config.files) {
    assert.match(entry.sha256, /^[0-9a-f]{64}$/, entry.out);
    if (entry.lowSrc) assert.match(entry.lowSha256, /^[0-9a-f]{64}$/, entry.out);
    assert.ok(files.has(entry.out), `${entry.out} 빌드 결과 있음`);
    configured.add(entry.out);
    if (entry.low || entry.lowSrc) { // v1.10.29 lowSrc: a far model the artist made
      const low = entry.out.replace(/\.glb$/, '_low.glb');
      assert.ok(files.has(low), `${low} 빌드 결과 있음`);
      configured.add(low);
      const [lt, ht] = [glbInfo(path.join(outDir, low)).triangles, glbInfo(path.join(outDir, entry.out)).triangles];
      assert.ok(entry.lowSrc ? lt <= ht : lt < ht, `${low}: High보다 가벼움`); // an artist's Low of a tiny part (a 64-triangle eye) may already be the same
    }
  }
  for (const f of files) assert.ok(configured.has(f), `${f}: 빌드 설정에 없는 파일`);
  const { REGISTRY } = require('../public/plaza/island-assets.js');
  const base = `/${config.outDir.replace(/^public\//, '')}/`;
  for (const [id, entry] of Object.entries(REGISTRY)) {
    for (const url of [entry.url, ...Object.values(entry.seasons || {}), entry.low?.url, ...Object.values(entry.low?.seasons || {})].filter(Boolean)) {
      assert.ok(url.startsWith(base) && files.has(url.slice(base.length)), `${id}: ${url} 은 빌드 결과여야 함`);
    }
  }
});
