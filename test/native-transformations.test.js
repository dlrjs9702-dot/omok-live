'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const transforms = require('../public/plaza/character-transformations');
const assets = require('../public/plaza/island-assets');
const normalize = name => name.replace(/[. _]/g, '');

test('완전 변신: 21종의 모든 필수 슬롯, 하나 해제/다른 캐릭터 혼합, 원래 성별·염색 유지', () => {
  assert.equal(transforms.characters.length, 21);
  for (const c of transforms.characters) {
    const look = { gender:'female', skinColor:'#713f26', hairColor:'#e991bd', eyeColor:'#3179ad', dye:{unused:'#126f4e'}, ...c.items };
    const saved = JSON.stringify(look);
    assert.equal(transforms.match(look).id, c.id);
    assert.equal(assets.wardrobeOf(look).transformation, 'character.transform.' + c.id);
    for (const slot of Object.keys(c.items)) {
      const partial = { ...look }; delete partial[slot];
      assert.equal(transforms.match(partial), null);
      assert.equal(assets.wardrobeOf(partial).transformation, undefined);
      assert.equal(transforms.match({ ...look, [slot]:'avatar_ip_other_'+slot }), null);
    }
    assert.equal(JSON.stringify(look), saved);
  }
});

test('실제 전신 42 GLB: 고유 rest/inverse bind, High/Low 관절, 기존 28동작 위치 전이·스킨 좌표', async () => {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const load = async url => { const b=fs.readFileSync(path.join(__dirname,'../public',url));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''); };
  const motionUrls = Object.values(assets.REGISTRY['character.base'].clips);
  const clips = await Promise.all(motionUrls.map(async url => (await load(url)).animations[0]));
  for (const c of transforms.characters) for (const url of [c.url,c.lowUrl]) {
    const model=await load(url);model.scene.updateMatrixWorld(true);const meshes=[];model.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
    assert.ok(meshes.length>0,url);
    for (const m of meshes) {
      assert.deepEqual(m.skeleton.bones.map(b=>normalize(b.name)),c.rig.joints.map(j=>normalize(j.name)),url);
      for (let i=0;i<m.skeleton.bones.length;i++) {
        const rest=m.skeleton.bones[i].getWorldPosition(new THREE.Vector3());
        assert.ok(rest.distanceTo(new THREE.Vector3(...c.rig.joints[i].worldRest))<1e-5,`${c.id} ${i} native rest`);
      }
      m.skeleton.update();const p=m.geometry.attributes.position;
      for(let i=0;i<p.count;i+=Math.max(1,Math.floor(p.count/80))){const v=new THREE.Vector3().fromBufferAttribute(p,i),rest=v.clone();m.applyBoneTransform(i,v);assert.ok(v.distanceTo(rest)<1e-4,`${c.id} inverse bind`);}
    }
    for (const source of clips) {
      const before=Array.from(source.tracks[0].values),clip=transforms.retargetClip(source,c.rig),mixer=new THREE.AnimationMixer(model.scene);
      mixer.clipAction(clip).play();for(const fraction of [0,.5,1]) {mixer.setTime(clip.duration*fraction);model.scene.updateMatrixWorld(true);
        for(const m of meshes){m.skeleton.update();const p=m.geometry.attributes.position;for(let i=0;i<p.count;i+=Math.max(1,Math.floor(p.count/40))){const v=new THREE.Vector3().fromBufferAttribute(p,i);m.applyBoneTransform(i,v);assert.ok(Number.isFinite(v.length()),`${c.id} ${clip.name} ${fraction}`);}}
      }
      mixer.stopAllAction();mixer.uncacheRoot(model.scene);assert.deepEqual(Array.from(source.tracks[0].values),before,'shared source clip unchanged');
    }
  }
});
