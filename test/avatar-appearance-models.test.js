'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../public/plaza/asset-pipeline');
const { REGISTRY, wardrobeOf } = require('../public/plaza/island-assets');
const { SKINS, DYEABLE } = require('../lib/skins');
async function model(url) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  const buffer = fs.readFileSync(path.join(__dirname, '../public', url));
  return new Promise((resolve, reject) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '', resolve, reject));
}
test('판매 의상 전체: High/Low 실제 주색만 염색하고 장식·원본 재질을 보존한다', async () => {
  const THREE = await import('three');
  const outfits = SKINS.filter(s => s.family === 'avatar' && s.slot === 'outfit');
  assert.equal(outfits.length, 30);
  for (const item of outfits) {
    assert.ok(DYEABLE.has(item.id), item.id);
    const plain = wardrobeOf({ outfit: item.id });
    const plan = wardrobeOf({ outfit: item.id, dye: { [item.id]: '#eda3b8' } });
    const id = plan.parts.find(part => !plain.colors[part] && plan.colors[part]);
    assert.ok(id, item.id);
    const channels = Object.keys(plan.colors[id]);
    assert.deepEqual(channels, id === 'wear.outfit_hanbok' ? ['main', 'chima'] : id === 'wear.overalls' ? ['overalls'] : ['main'], item.id);
    const entry = REGISTRY[id];
    for (const url of [entry.url, entry.low?.url].filter(Boolean)) {
      const gltf = await model(url); const names = new Set();
      gltf.scene.traverse(mesh => {
        if (!mesh.isMesh) return;
        for (const source of [].concat(mesh.material)) {
          names.add(source.name); const original = source.color.getHexString();
          const material = P.tintMaterial(THREE, source, plan.colors[id][source.name]);
          assert.equal(material.color.getHexString(), channels.includes(source.name) ? 'eda3b8' : original, `${item.id}/${source.name}`);
          assert.equal(source.color.getHexString(), original); material.dispose();
        }
      });
      for (const channel of channels) assert.ok(names.has(channel), `${url}/${channel}`);
    }
    assert.deepEqual(wardrobeOf({ outfit: item.id }).colors, plain.colors);
  }
  assert.equal(DYEABLE.has('npc_outfit_suit'), false);
});
test('머리 염색: 실제 머리 메시 내부도 같은 색, 장식·다른 플레이어·원색 복구는 원본을 유지', async () => {
  const THREE = await import('three');
  for (const id of Object.keys(REGISTRY).filter(id => id.startsWith('wear.hair_') && (REGISTRY[id].dye === 'hair' || ['wear.hair_cap', 'wear.hair_long'].includes(id)))) {
    const entry = REGISTRY[id];
    for (const url of [entry.url, entry.low?.url].filter(Boolean)) {
      const gltf = await model(url); let hairs = 0;
      gltf.scene.traverse(mesh => {
        if (!mesh.isMesh) return;
        for (const source of [].concat(mesh.material)) {
          const original = source.color.getHexString(); const side = source.side;
          const dyed = P.tintMaterial(THREE, source, source.name === 'hair' ? '#eda3b8' : null);
          const other = P.tintMaterial(THREE, source, source.name === 'hair' ? '#34507e' : null);
          const restored = P.tintMaterial(THREE, source, null);
          if (source.name === 'hair') { hairs++; assert.equal(dyed.side, THREE.DoubleSide); assert.equal(dyed.color.getHexString(), 'eda3b8'); assert.equal(other.color.getHexString(), '34507e'); }
          else assert.equal(dyed.color.getHexString(), original);
          assert.equal(restored.color.getHexString(), original); assert.equal(restored.side, side);
          assert.equal(source.color.getHexString(), original); assert.equal(source.side, side);
          dyed.dispose(); other.dispose(); restored.dispose();
        }
      });
      assert.ok(hairs, url);
    }
  }
});
test('박쥐 실제 High/Low: 양쪽 날갯짓 32포즈가 다르고 인스턴스 채택 후 원본 자세를 복구한다', async () => {
  const THREE = await import('three'); const holder = new THREE.LOD(); holder.position.set(9, 4, -3); holder.rotation.y = 0.8;
  const entry = REGISTRY['halloween.bat']; const sources = [];
  for (const [i, url] of [entry.url, entry.low.url].entries()) {
    const gltf = await model(url); gltf.scene.animations = gltf.animations; holder.addLevel(gltf.scene, i * 60); sources.push(gltf.scene);
    assert.ok(gltf.animations.length, url);
  }
  const originals = new Map(); holder.traverse(o => originals.set(o, [...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray()]));
  const parts = P.sampleRigidPoses(THREE, holder, sources);
  for (const level of [0, 1]) {
    const batch = parts.filter(p => p.level === level); assert.ok(batch.length);
    assert.ok(batch.every(p => p.poses.length === 32));
    assert.ok(batch.some(p => p.poses.some(m => m.elements.some((n, i) => Math.abs(n - p.poses[0].elements[i]) > 0.01))), `level ${level} 날갯짓`);
  }
  holder.traverse(o => assert.deepEqual([...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray()], originals.get(o), o.name));
});
