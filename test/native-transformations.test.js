'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const transforms = require('../public/plaza/character-transformations');
const assets = require('../public/plaza/island-assets');
const normalize = name => name.replace(/[. _]/g, '');

test('완전 변신: 22종(v1.10.92 포차코)의 모든 필수 슬롯, 하나 해제/다른 캐릭터 혼합, 원래 성별·염색 유지', () => {
  assert.equal(transforms.characters.length, 22);
  for (const c of transforms.characters) {
    const look = { gender:'female', skinColor:'#713f26', hairColor:'#e991bd', eyeColor:'#3179ad', dye:{unused:'#126f4e'}, ...c.items, transform:c.id }; // v1.10.91: the chosen transformation
    const saved = JSON.stringify(look);
    assert.equal(transforms.match(look).id, c.id);
    assert.equal(assets.wardrobeOf(look).transformation, `character.transform.${c.id}.${c.defaultVariant}`);
    assert.equal(transforms.find(c.id), c);
    assert.deepEqual(Object.keys(c.variants), c.human ? ['current'] : ['current', 'native']);
    for (const mode of Object.keys(c.variants)) {
      const choice = { ...look, transformationModes: { [c.id]: mode } };
      assert.equal(transforms.modeOf(c, choice), mode);
      assert.equal(transforms.selected(c, choice), c.variants[mode]);
      assert.equal(assets.wardrobeOf(choice).transformation, `character.transform.${c.id}.${mode}`);
    }
    assert.equal(transforms.modeOf(c, { transformationModes: { [c.id]: 'unknown' } }), c.defaultVariant);
    if (c.human) assert.equal(transforms.modeOf(c, { transformationModes: { [c.id]: 'native' } }), 'current');
    // v1.10.91 (사용자 2026-10-18 A안): the parts alone never transform; the chosen transformation does, parts or not
    const parts = { ...look }; delete parts.transform;
    assert.equal(transforms.match(parts), null);
    assert.equal(assets.wardrobeOf(parts).transformation, undefined);
    for (const slot of Object.keys(c.items)) { const partial = { ...look }; delete partial[slot]; assert.equal(transforms.match(partial).id, c.id); }
    assert.equal(JSON.stringify(look), saved);
  }
});

test('실제 변신 로더: 두 체형·LOD·운반·좌석·소켓, 해제와 깨진 전신의 일반 착용 복구', async () => {
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
    const kuromi=transforms.find('kuromi');
    for (const mode of ['current', 'native']) {
    const c=make(),choice={...kuromi.items,transform:kuromi.id,transformationModes:{kuromi:mode}};
    layer.wear(c,assets.wardrobeOf(choice));await wait(c);
    assert.equal(c.transformationMode,mode);assert.equal(c.nativeRig,kuromi.variants[mode].rig.id);
    assert.equal(c.body.visible,false,'ordinary face/body hidden');assert.equal(c.root.children.length,2,'complete exterior alone under root');
    const meshes=[];c.assetRoot.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
    assert.equal(meshes.length,2);assert.ok(meshes[0].skeleton.bones.every((b,i)=>b===meshes[1].skeleton.bones[i]),'Low uses this copy of High bones');
    layer.tick(0,100,100);assert.equal(meshes.filter(m=>m.visible).length,1);assert.equal(layer.debug().wearing.at(-1).high,false);
    layer.tick(0,0,0);assert.equal(layer.debug().wearing.at(-1).high,true);
    c.anim.update(.3,0);c.carrying=true;c.anim.update(.1,0);
    const carry=(await parser.loadAsync(assets.REGISTRY['character.base'].clips.CarryIdle)).animations[0];
    for(const track of carry.tracks.filter(t=>/^(Shoulder|UpperArm|LowerArm|Hand).*\.quaternion$/.test(t.name))){const bone=c.assetRoot.getObjectByName(track.name.replace(/\.quaternion$/,''));assert.ok(bone.quaternion.toArray().every((v,i)=>Math.abs(v-track.values[i])<1e-6),track.name);}
    c.carrying=false;c.anim.update(.1,0);assert.ok(c.assetRoot.getObjectByName('LowerArmL').quaternion.angleTo(new THREE.Quaternion().fromArray(carry.tracks.find(t=>t.name==='LowerArmL.quaternion').values))>.1,'release restores idle elbow');
    c.anim.loop('sitIdle');c.tuckTail(true);c.anim.update(.3,0);c.assetRoot.updateMatrixWorld(true);
    const hip=c.assetRoot.getObjectByName('Hips').getWorldPosition(new THREE.Vector3());
    const sourceSit=(await parser.loadAsync(assets.REGISTRY['character.base'].clips.SitIdle)).animations[0];
    const expected=sourceSit.tracks.find(t=>t.name==='Hips.position').createInterpolant().evaluate(.3)[1];
    assert.ok(Math.abs(hip.y-expected)<1e-5,`${mode} hips reach common seat`);
    c.tuckTail(false);assert.equal(c.assetRoot.position.y,0,'standing restores model origin');
    layer.hold(c,'prop.event.lost_item',null,{key:'probe'});
    for(let n=0;n<100&&!c.holding?.probe?.object;n++)await new Promise(resolve=>setTimeout(resolve,10));
    assert.equal(normalize(c.holding.probe.object.parent.name),'SocketHandR','held item uses authored right hand socket');
    layer.release(c);assert.equal(c.body.visible,true);assert.equal(c.transformation,null);assert.equal(c.transformationMode,null);assert.equal(c.transformationRig,null);
    layer.wear(c,assets.wardrobeOf({gender:'female'}));await wait(c);assert.equal(c.transformation,null,'ordinary wardrobe restores');
    layer.release(c);
    }
    const fallback=make();layer.wear(fallback,assets.wardrobeOf({...bad.items,transform:bad.id}));await wait(fallback);
    assert.equal(fallback.transformation,null);assert.equal(fallback.nativeRig,null);assert.equal(fallback.root.children.length,2,'only procedural body and one ordinary model remain');
    assert.ok(errors.some(e=>e.id==='character.transform.pikachu.native'&&e.message.includes('no skinned meshes')));
    const disabled=createIslandAssets({registry:assets.REGISTRY,off:['character.transform.kuromi']}),ordinary=make();
    disabled.wear(ordinary,assets.wardrobeOf({...kuromi.items,transform:kuromi.id,transformationModes:{kuromi:'current'}}));await wait(ordinary);
    assert.equal(ordinary.transformation,null,'legacy emergency id disables every body choice');disabled.release(ordinary);disabled.dispose();
  } finally {layer.dispose();GLTFLoader.prototype.loadAsync=original;}
});

test('실제 전신 78 GLB: 현재/고유 rest·inverse bind·High/Low 관절과 28동작 전이', async () => {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const load = async url => { const b=fs.readFileSync(path.join(__dirname,'../public',url));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''); };
  const motionUrls = Object.values(assets.REGISTRY['character.base'].clips);
  const clips = await Promise.all(motionUrls.map(async url => (await load(url)).animations[0]));
  let files=0;
  for (const c of transforms.characters) for(const [mode,variant] of Object.entries(c.variants)) for (const url of [variant.url,variant.lowUrl]) {
    files++;
    const model=await load(url);model.scene.updateMatrixWorld(true);const meshes=[];model.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
    assert.ok(meshes.length>0,url);
    for (const m of meshes) {
      assert.deepEqual(m.skeleton.bones.map(b=>normalize(b.name)),variant.rig.joints.map(j=>normalize(j.name)),url);
      for (let i=0;i<m.skeleton.bones.length;i++) {
        const rest=m.skeleton.bones[i].getWorldPosition(new THREE.Vector3());
        assert.ok(rest.distanceTo(new THREE.Vector3(...variant.rig.joints[i].worldRest))<1e-5,`${c.id} ${mode} ${i} rest`);
        if(mode==='current') assert.deepEqual(variant.rig.joints[i],transforms.commonRig.joints[i],'current common rest preserved');
      }
      m.skeleton.update();const p=m.geometry.attributes.position;
      for(let i=0;i<p.count;i+=Math.max(1,Math.floor(p.count/80))){const v=new THREE.Vector3().fromBufferAttribute(p,i),rest=v.clone();m.applyBoneTransform(i,v);assert.ok(v.distanceTo(rest)<(c.id==='pochacco'?2.5e-3:1e-4),`${c.id} inverse bind`);} /* v1.10.92: assets 42 quantized bind drifts 1.4-1.8 mm at rest (unseen); ponytail: a re-export brings it under 0.1 mm */
    }
    for (const source of clips) {
      const before=source.tracks.map(t=>({name:t.name,values:Array.from(t.values)})),clip=transforms.retargetClip(source,variant.rig),mixer=new THREE.AnimationMixer(model.scene);
      for (const track of clip.tracks) assert.ok(model.scene.getObjectByName(track.name.replace(/\.(position|quaternion|scale)$/, '')), `${c.id} ${clip.name}: animated node exists`);
      mixer.clipAction(clip).play();for(const fraction of [0,.5,1]) {mixer.setTime(clip.duration*fraction);model.scene.updateMatrixWorld(true);
        for(const m of meshes){m.skeleton.update();const p=m.geometry.attributes.position;for(let i=0;i<p.count;i+=Math.max(1,Math.floor(p.count/40))){const v=new THREE.Vector3().fromBufferAttribute(p,i);m.applyBoneTransform(i,v);assert.ok(Number.isFinite(v.length()),`${c.id} ${clip.name} ${fraction}`);}}
      }
      mixer.stopAllAction();mixer.uncacheRoot(model.scene);assert.deepEqual(source.tracks.map(t=>({name:t.name,values:Array.from(t.values)})),before,'shared source clip unchanged');
    }
  }
  assert.equal(files,78); // v1.10.92 + 포차코 두 체형 High/Low
});

test('위치 전이: 서로 다른 관절별 축 배율과 실제 뼈 이름, 좌석은 같은 높이', async () => {
  const THREE=await import('three'),rig=transforms.find('kuromi').variants.native.rig;
  const source=new THREE.AnimationClip('Probe',1,[new THREE.VectorKeyframeTrack('LowerArm.L.position',[0,1],[-.15,-.19,0,-.12,-.10,.03]),new THREE.QuaternionKeyframeTrack('Head.quaternion',[0],[0,0,0,1])]);
  const bones=new Map([['LowerArmL',{name:'LowerArm.L'}],['Head',{name:'Head'}]]);
  const clip=transforms.retargetClip(source,rig,undefined,bones);
  assert.equal(clip.tracks[0].name,'LowerArm.L.position');
  const joint=rig.joints.find(j=>j.name==='LowerArm.L'),parent=rig.joints[joint.parent],scale=rig.positionScales[joint.name];
  for(let k=0;k<3;k++)assert.ok(Math.abs(clip.tracks[0].values[3+k]-(joint.worldRest[k]-parent.worldRest[k]+[.03,.09,.03][k]*scale[k]))<1e-6);
  assert.deepEqual(Array.from(clip.tracks[1].values),[0,0,0,1]);assert.equal(source.tracks[0].name,'LowerArm.L.position');
  for(const character of transforms.characters)for(const variant of Object.values(character.variants)){
    const r=variant.rig,hips=r.joints[1].worldRest[1],s=r.positionScales?.Hips?.[1]??1;
    const nativeY=hips+(.38-.62)*s;
    assert.ok(Math.abs(nativeY+transforms.seatOffset(r,nativeY)-.38)<1e-9);
  }
});
