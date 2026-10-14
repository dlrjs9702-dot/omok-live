'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
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

test('실제 변신 로더: 운반 팔꿈치 자세·해제, 깨진 전신 모델은 일반 착용으로 복구', async () => {
  const THREE=await import('three');
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const {MeshoptDecoder}=await import('three/addons/libs/meshopt_decoder.module.js');
  const parser=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), original=GLTFLoader.prototype.loadAsync;
  const bad=transforms.characters.find(c=>c.id==='pikachu');
  GLTFLoader.prototype.loadAsync=async function(url){
    if(url===bad.url)return {scene:new THREE.Group(),animations:[]};
    const b=fs.readFileSync(path.join(__dirname,'../public',url));return parser.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
  };
  globalThis.AssetPipeline=require('../public/plaza/asset-pipeline');
  globalThis.CharacterTransformations=transforms;
  let code=fs.readFileSync(path.join(__dirname,'../public/plaza/asset-loader.js'),'utf8');
  code=code.replace(/from '(\/vendor\/three\/[^']+)'/g,(_,url)=>'from '+JSON.stringify(pathToFileURL(url.includes('addons/')?require.resolve('three/'+url.split('/vendor/three/')[1]):path.join(path.dirname(require.resolve('three')),'three.module.js')).href))
    .replace(/import \{ preparePlatformSurfaces, prepareTownhallSurfaces \} from '\.\/platform-surfaces.js';/,'const preparePlatformSurfaces=g=>g,prepareTownhallSurfaces=g=>g;');
  const {createIslandAssets}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const errors=[],layer=createIslandAssets({registry:assets.REGISTRY,onError:(id,error)=>errors.push({id,message:error.message})});
  const make=()=>{const root=new THREE.Group(),body=new THREE.Group();root.add(body);new THREE.Scene().add(root);return {root,body,player:true,transformation:null,nativeRig:null};};
  const wait=async c=>{for(let n=0;n<300&&!c.assetRoot;n++)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(c.assetRoot,'model installed');};
  try {
    const kuromi=transforms.characters.find(c=>c.id==='kuromi'),c=make();layer.wear(c,assets.wardrobeOf(kuromi.items));await wait(c);
    c.anim.update(.3,0);c.carrying=true;c.anim.update(.1,0);
    const carry=(await parser.loadAsync(assets.REGISTRY['character.base'].clips.CarryIdle)).animations[0];
    for(const track of carry.tracks.filter(t=>/^(Shoulder|UpperArm|LowerArm|Hand).*\.quaternion$/.test(t.name))){const bone=c.assetRoot.getObjectByName(track.name.replace(/\.quaternion$/,''));assert.ok(bone.quaternion.toArray().every((v,i)=>Math.abs(v-track.values[i])<1e-6),track.name);}
    c.carrying=false;c.anim.update(.1,0);assert.ok(c.assetRoot.getObjectByName('LowerArmL').quaternion.angleTo(new THREE.Quaternion().fromArray(carry.tracks.find(t=>t.name==='LowerArmL.quaternion').values))>.1,'release restores idle elbow');
    const fallback=make();layer.wear(fallback,assets.wardrobeOf(bad.items));await wait(fallback);
    assert.equal(fallback.transformation,null);assert.equal(fallback.nativeRig,null);assert.equal(fallback.root.children.length,2,'only procedural body and one ordinary model remain');
    assert.ok(errors.some(e=>e.id==='character.transform.pikachu'&&e.message.includes('no skinned meshes')));
  } finally {layer.dispose();GLTFLoader.prototype.loadAsync=original;}
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
      for (const track of clip.tracks) assert.ok(model.scene.getObjectByName(track.name.replace(/\.(position|quaternion|scale)$/, '')), `${c.id} ${clip.name}: animated node exists`);
      mixer.clipAction(clip).play();for(const fraction of [0,.5,1]) {mixer.setTime(clip.duration*fraction);model.scene.updateMatrixWorld(true);
        for(const m of meshes){m.skeleton.update();const p=m.geometry.attributes.position;for(let i=0;i<p.count;i+=Math.max(1,Math.floor(p.count/40))){const v=new THREE.Vector3().fromBufferAttribute(p,i);m.applyBoneTransform(i,v);assert.ok(Number.isFinite(v.length()),`${c.id} ${clip.name} ${fraction}`);}}
      }
      mixer.stopAllAction();mixer.uncacheRoot(model.scene);assert.deepEqual(Array.from(source.tracks[0].values),before,'shared source clip unchanged');
    }
  }
});
