'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../public/plaza/asset-pipeline.js');
const { REGISTRY } = require('../public/plaza/island-assets.js');
const { staticGlb, riggedGlb } = require('../test-support/gltf-fixture.js');

// v1.10.15 고품질 에셋 파이프라인: the rules (registry, load-once cache, gait, LOD tiers, lazy loader) and the Three.js
// pieces the loader relies on (GLTFLoader, SkeletonUtils.clone, AnimationMixer) with generated glTF files.
const three = () => import('three');
async function parse(buffer) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().parse(ab, '', resolve, reject));
}

// v1.10.18: the first real models -- a few on purpose (one tree kind, the bushes, the plaza benches); every file is in
// public/assets/island (so in the game resource pack, with its content revision) and is a valid glTF binary
test('운영 등록부: 시험 연결한 모델 3종만 있고, 파일은 리소스 팩 폴더에 있으며 실제 GLB로 읽힌다', async () => {
  const fs = require('node:fs'); const path = require('node:path');
  const { buildAssetManifest } = require('../lib/asset-manifest');
  assert.deepEqual(Object.keys(REGISTRY).sort(), ['nature.bush', 'nature.tree.round', 'prop.bench']);
  assert.deepEqual(P.enabledIds(REGISTRY).sort(), ['nature.bush', 'nature.tree.round', 'prop.bench']);
  const pack = buildAssetManifest(path.join(__dirname, '..', 'public'), (ext) => ['.svg', '.png', '.glb'].includes(ext));
  for (const [id, entry] of Object.entries(REGISTRY)) {
    assert.match(entry.url, /^\/assets\/island\/seasonal-v2\/spring\//, id);
    const file = path.join(__dirname, '..', 'public', entry.url);
    assert.ok(fs.existsSync(file), `${id} 파일`);
    assert.ok(pack.assets.some((a) => a.url === entry.url), `${id} 리소스 팩`);
    const gltf = await parse(fs.readFileSync(file));
    let meshes = 0; gltf.scene.traverse((o) => { if (o.isMesh) meshes += 1; });
    assert.ok(meshes > 0, `${id} 메시`);
    assert.ok(entry.scale > 0.5 && entry.scale < 1.2, `${id} 크기 보정`);
  }
});

test('에셋 등록부 조회: 비활성·운영 차단·주소 없음은 쓰지 않고, 구체 id부터 고른다', () => {
  const registry = {
    'cottage': { url: '/assets/island/cottage.glb' },
    'cottage.3': { url: '/assets/island/cottage-3.glb' },
    'facility.shop': { url: '/assets/island/shop.glb', enabled: false },
    'facility.admin': { url: '' },
    'character.player': { url: '/assets/island/player.glb' },
  };
  assert.equal(P.pick(registry, ['cottage.3', 'cottage']).entry.url, '/assets/island/cottage-3.glb');
  assert.equal(P.pick(registry, ['cottage.5', 'cottage']).id, 'cottage');
  assert.equal(P.pick(registry, 'facility.shop'), null);
  assert.equal(P.pick(registry, 'facility.admin'), null);
  assert.equal(P.pick(registry, 'constructor'), null); // only own entries
  assert.equal(P.pick(registry, ['cottage.3', 'cottage'], ['cottage.3']).id, 'cottage');
  assert.equal(P.pick(registry, 'character.player', ['*']), null);
  assert.deepEqual(P.enabledIds(registry).sort(), ['character.player', 'cottage', 'cottage.3']);
});

test('같은 파일은 여러 대상이 동시에 요청해도 한 번만 받아 파싱하고, 실패는 한 번 기록한 뒤 null', async () => {
  const calls = []; const errors = [];
  const cache = P.createLoadCache(async (url) => { calls.push(url); if (url.includes('missing')) throw new Error('404'); return url.includes('empty') ? null : { url }; },
    (url, error) => errors.push([url, error.message]));
  const [a, b, c] = await Promise.all([cache.get('/a.glb'), cache.get('/a.glb'), cache.get('/a.glb')]);
  assert.equal(a, b); assert.equal(b, c); assert.deepEqual(a, { url: '/a.glb' });
  assert.equal(await cache.get('/missing.glb'), null);
  assert.equal(await cache.get('/missing.glb'), null);
  assert.equal(await cache.get('/empty.glb'), null);
  assert.deepEqual(calls, ['/a.glb', '/missing.glb', '/empty.glb']);
  assert.deepEqual(errors, [['/missing.glb', '404'], ['/empty.glb', 'empty asset']]);
  assert.deepEqual(cache.status(), { '/a.glb': 'loaded', '/missing.glb': 'failed: 404', '/empty.glb': 'failed: empty asset' });
  const freed = []; cache.clear((value) => freed.push(value.url));
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(freed, ['/a.glb']);
  await cache.get('/a.glb'); assert.equal(calls.length, 4, 'cleared: loads again');
});

test('걸음 상태: 속도로 Idle·Walk·Run을 고르고, 경계 근처에서 깜빡이지 않는다', () => {
  const W = 5.2;
  assert.equal(P.nextGait('idle', 0, W), 'idle');
  assert.equal(P.nextGait('idle', 0.3, W), 'idle');
  assert.equal(P.nextGait('idle', 0.5, W), 'walk');
  assert.equal(P.nextGait('walk', 0.3, W), 'walk'); // between walkOff and walkOn: stays
  assert.equal(P.nextGait('walk', 0.2, W), 'idle');
  assert.equal(P.nextGait('walk', W * 1.25, W), 'walk');
  assert.equal(P.nextGait('walk', W * 1.35, W), 'run');
  assert.equal(P.nextGait('run', W * 1.2, W), 'run'); // between runOff and runOn: stays
  assert.equal(P.nextGait('run', W * 1.1, W), 'walk');
  assert.equal(P.nextGait('run', 0.1, W), 'idle');
  assert.equal(P.nextGait('idle', W * 1.5, W), 'run');
  assert.equal(P.nextGait('wave', 0, W), 'idle');
});

test('LOD 품질 단계: 높음은 등록 거리 그대로, 낮을수록 더 가까이서 단순 모델로 바뀐다', () => {
  assert.equal(P.lodDistance(40, 2), 40);
  assert.equal(P.lodDistance(40, 1), 30);
  assert.equal(P.lodDistance(40, 0), 20);
  assert.equal(P.lodDistance(40, 7), 40);
});

test('실제 GLB: 정적 모델과 리깅 모델을 읽고, 복제본은 지오메트리를 공유하되 뼈대는 각자 갖는다', async () => {
  const { clone } = await import('three/addons/utils/SkeletonUtils.js');
  const box = await parse(staticGlb());
  assert.equal(box.scene.getObjectByName('Box').isMesh, true);
  const rig = await parse(riggedGlb());
  assert.deepEqual(rig.animations.map((a) => a.name), ['Idle', 'Walk', 'Run']);
  const skinned = (root) => { let found = null; root.traverse((o) => { if (o.isSkinnedMesh) found = o; }); return found; };
  const a = skinned(clone(rig.scene)); const b = skinned(clone(rig.scene));
  assert.equal(a.geometry, b.geometry);
  assert.notEqual(a.skeleton.bones[0], b.skeleton.bones[0]);
  assert.equal(a.skeleton.bones[0].name, 'Hip');
  await assert.rejects(parse(Buffer.from('not a model at all')));
});

test('AnimationMixer 계층: 속도에 따라 Idle→Walk→Run으로 교차 전환하고, 없는 클립은 가까운 것으로 대신한다', async () => {
  const THREE = await three();
  const rig = await parse(riggedGlb());
  const anim = P.createAnimator(THREE, rig.scene, rig.animations, { idle: 'Idle', walk: 'Walk', run: 'Run' }, { walkSpeed: 5.2, fade: 0.2 });
  assert.equal(anim.state, 'idle'); assert.equal(anim.clip, 'Idle');
  anim.update(0.016, 5.2);
  assert.equal(anim.state, 'walk'); assert.equal(anim.clip, 'Walk');
  anim.update(0.05, 5.2);
  anim.update(0.016, 9);
  assert.equal(anim.state, 'run'); assert.equal(anim.clip, 'Run');
  anim.update(0.016, 0);
  assert.equal(anim.state, 'idle'); assert.equal(anim.clip, 'Idle');
  assert.equal(anim.play('wave'), false);
  anim.dispose();

  const walkOnly = await parse(riggedGlb(['Idle', 'Walk']));
  const anim2 = P.createAnimator(THREE, walkOnly.scene, walkOnly.animations, { idle: 'Idle', walk: 'Walk', run: 'Run' }, { walkSpeed: 5.2 });
  anim2.update(0.016, 9);
  assert.equal(anim2.state, 'run'); assert.equal(anim2.clip, 'Walk'); // no Run clip: the walk, faster
  const noClips = P.createAnimator(THREE, (await parse(staticGlb())).scene, [], { idle: 'Idle' }, { walkSpeed: 5.2 });
  noClips.update(0.016, 5); assert.equal(noClips.clip, null); // a model without clips just stands
});

test('교차 전환 중에는 이전 클립과 새 클립이 함께 섞이고, 끝나면 새 클립만 남는다', async () => {
  const THREE = await three();
  const rig = await parse(riggedGlb());
  const anim = P.createAnimator(THREE, rig.scene, rig.animations, { idle: 'Idle', walk: 'Walk' }, { walkSpeed: 5.2, fade: 0.4 });
  anim.update(0.016, 0);
  assert.deepEqual(anim.weights(), { idle: 1, walk: 0 });
  anim.update(0.016, 5.2); // the fade Idle -> Walk starts
  anim.update(0.15, 5.2);
  const mid = anim.weights();
  assert.ok(mid.idle > 0.05 && mid.idle < 0.95 && mid.walk > 0.05 && mid.walk < 0.95, JSON.stringify(mid));
  anim.update(0.5, 5.2);
  assert.deepEqual(anim.weights(), { idle: 0, walk: 1 });
  anim.dispose();
});

test('지연 로더: 등록이 없으면 로더를 받지 않고, 있으면 한 번만 받아 그동안의 요청을 이어 실행하며, 로더가 실패해도 예외 없이 코드 생성형 유지', async () => {
  let imported = 0;
  const none = P.createLazyAssets({ registry: {}, importLoader: () => { imported += 1; return {}; } });
  none.attach('facility.shop', {}, {}); none.dress('character.player', {}); none.setQuality(1);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(imported, 0); assert.deepEqual(none.debug(), { registered: [], loader: 'none', season: null });

  const offAll = P.createLazyAssets({ registry: { 'facility.shop': { url: '/x.glb' } }, off: ['*'], importLoader: () => { imported += 1; return {}; } });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(imported, 0); assert.equal(offAll.debug().loader, 'none');

  const seen = [];
  const lazy = P.createLazyAssets({ registry: { 'facility.shop': { url: '/x.glb' } }, importLoader: async () => { imported += 1; return { createIslandAssets: (o) => {
    seen.push(['create', Object.keys(o.registry)]);
    return { attach: (...a) => seen.push(['attach', a[0]]), dress: (...a) => seen.push(['dress', a[0]]), setQuality: (t) => seen.push(['quality', t]), release() {}, dispose() {}, debug: () => ({ shown: {} }) };
  } }; } });
  lazy.attach('facility.shop', {}, {}); lazy.dress('character.player', {});
  await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0));
  lazy.setQuality(1);
  assert.equal(imported, 1);
  assert.deepEqual(seen, [['create', ['facility.shop']], ['attach', 'facility.shop'], ['dress', 'character.player'], ['quality', 1]]);
  assert.equal(lazy.debug().loader, 'ready');

  const errors = [];
  const broken = P.createLazyAssets({ registry: { 'facility.shop': { url: '/x.glb' } }, importLoader: async () => { throw new Error('decoder failed'); }, onError: (what, error) => errors.push([what, error.message]) });
  broken.attach('facility.shop', {}, {});
  await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0));
  broken.attach('facility.shop', {}, {}); broken.release({}); broken.dispose();
  assert.deepEqual(errors, [['loader', 'decoder failed']]);
  assert.equal(broken.debug().loader, 'failed');
});

// v1.10.17 nature/props and seasons
test('계절 파일: 그 계절 파일 → 기본 url → 없으면 코드 생성형, 꺼진 등록은 계절과 무관하게 코드 생성형', () => {
  const registry = {
    'nature.tree.round': { seasons: { spring: '/a/spring.glb', winter: '/a/winter.glb' } },
    'nature.tree': { url: '/a/any.glb', seasons: { autumn: '/a/autumn.glb' } },
    'nature.bush': { seasons: { summer: '/a/bush.glb' }, enabled: false },
  };
  assert.equal(P.pick(registry, ['nature.tree.round', 'nature.tree'], [], 'spring').entry.url, '/a/spring.glb');
  assert.equal(P.pick(registry, ['nature.tree.round', 'nature.tree'], [], 'winter').entry.url, '/a/winter.glb');
  const summer = P.pick(registry, ['nature.tree.round', 'nature.tree'], [], 'summer'); // round has no summer file: the general id
  assert.deepEqual([summer.id, summer.entry.url], ['nature.tree', '/a/any.glb']);
  assert.equal(P.pick(registry, 'nature.tree', [], 'autumn').entry.url, '/a/autumn.glb');
  assert.equal(P.pick(registry, 'nature.tree.round', [], 'summer'), null);
  assert.equal(P.pick(registry, 'nature.tree.round', [], null), null); // no season, no url
  assert.equal(P.pick(registry, 'nature.bush', [], 'summer'), null);
  assert.equal(registry['nature.tree'].url, '/a/any.glb', '등록부 원본은 그대로');
  assert.deepEqual(P.enabledIds(registry).sort(), ['nature.tree', 'nature.tree.round']);
  assert.deepEqual(P.SEASONS, ['spring', 'summer', 'autumn', 'winter']);
});

test('지연 로더: 자연물 묶음 요청(wants·batch)과 매 프레임 update·계절 변경을 로더에 넘기고, 등록이 없으면 아무것도 하지 않는다', async () => {
  const none = P.createLazyAssets({ registry: {}, importLoader: () => { throw new Error('not expected'); } });
  assert.equal(none.wants(['nature.tree.round', 'nature.tree']), false);
  none.batch('nature.tree', []); none.update(1, 2); none.setSeason('winter');
  assert.equal(none.debug().season, 'winter');

  const seen = [];
  const lazy = P.createLazyAssets({ registry: { 'nature.tree': { seasons: { winter: '/w.glb' } } }, options: { season: 'spring' }, importLoader: async () => ({ createIslandAssets: (o) => {
    seen.push(['create', o.season]);
    return { batch: (ids, cells) => seen.push(['batch', ids, cells.length]), update: (x, z) => seen.push(['update', x, z]), setSeason: (s) => seen.push(['season', s]), attach() {}, dress() {}, setQuality() {}, release() {}, dispose() {}, debug: () => ({}) };
  } }) });
  assert.equal(lazy.wants('nature.tree'), true); // a winter file: worth keeping apart even in spring
  assert.equal(lazy.wants('nature.bush'), false);
  lazy.batch('nature.tree', [{}, {}]); lazy.update(5, 6); // update before the loader is in: nothing to move yet
  await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0));
  lazy.update(7, 8); lazy.setSeason('winter');
  assert.deepEqual(seen, [['create', 'spring'], ['batch', 'nature.tree', 2], ['update', 7, 8], ['season', 'winter']]);
});
