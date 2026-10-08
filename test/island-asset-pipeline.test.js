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
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js'); // v1.10.26 pipeline output
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(ab, '', resolve, reject));
}

// v1.10.18/19: the real models -- every file is in public/assets/island (so in the game resource pack, with its
// content revision), in all four seasons, and is a valid glTF binary
// v1.10.29: plus the 2026-10-05 additions (additions-v1): the last tree kinds, the second bush, a flower per colour,
// houses, facilities, the lamp, and the v2 bridge, fence and tall stump; High and Low files alike.
test('운영 등록부: 연결한 모델은 (계절 대상은 사계절) 파일이 모두 리소스 팩 폴더에 있고 실제 GLB로 읽힌다', async () => {
  const fs = require('node:fs'); const path = require('node:path');
  const { buildAssetManifest } = require('../lib/asset-manifest');
  const FACILITIES = ['games', 'climb', 'shop', 'avatar', 'records', 'admin', 'townhall', 'board', 'missions', 'map', 'donate', 'attendance', 'trader', 'naming'];
  assert.deepEqual(Object.keys(REGISTRY).sort(), ['facility.chat', 'nature.bush', 'nature.bush.1', 'nature.rock.0', 'nature.rock.1', 'nature.rock.2', 'nature.tree.blossom', 'nature.tree.fruit', 'nature.tree.pine', 'nature.tree.round', 'nature.tree.sapling', 'nature.tree.stump', 'nature.tree.stump.1',
    'nature.tree.tall', 'nature.tree.tiered', 'prop.bench', 'prop.bridge', 'prop.fence', 'prop.lamp', 'prop.planter',
    ...[0, 1, 2, 3, 4].map((c) => `nature.flower.${c}`), ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `cottage.${i}`), ...FACILITIES.map((f) => `facility.${f}`),
    // v1.10.29 gap assets (gaps-v1)
    'deco.layer.sparse', 'deco.layer.cluster', 'deco.layer.edge', 'deco.foundation', 'prop.mailbox.0', 'prop.mailbox.1', 'prop.steppingStone', 'prop.pierDeck', 'prop.pierPost',
    'fx.petal', 'fx.leaf', 'fx.snow', 'sea.coastLong', 'sea.coastCove', 'sea.ridgeSoft', 'sea.ridgeRugged', 'sea.peak', 'sea.glacier', 'sea.floe', 'sea.whale', 'sea.splash',
    // v1.10.30 the specialist shops, the common-rig body and its wardrobe (face, hair, clothes, shoes, hats, faces)
    'facility.faces', 'facility.hair', 'facility.accessories', 'facility.dye', 'character.base', ...Object.keys(REGISTRY).filter((id) => id.startsWith('wear.')),
    // v1.10.31 the weed (standing, pulled) and the finds' props
    'nature.grass', 'prop.weedRooted', ...['trash_can', 'trash_bottle', 'paper_litter', 'herb', 'berry', 'mushroom', 'coin', 'wallet', 'lost_item', 'camera'].map((k) => `prop.event.${k}`),
    // v1.10.32 the pouch, the fruit and the basket; the snowcaps, the shore and bank stones; the boat, the gull, the dolphin
    'prop.event.lost_pouch', 'prop.event.fruit', 'prop.event.basket', 'struct.snowcap.flat', 'struct.snowcap.gable', 'struct.snowcap.round', 'nature.shoreStones', 'nature.riverBank',
    'sea.boat', 'sea.gull', 'sea.dolphin',
    // v1.10.36 10월 할로윈: the plaza landmark (pedestal and jack-o'-lantern)
    'landmark.halloween.pedestal', 'landmark.halloween.lantern',
    'halloween.pumpkinA', 'halloween.pumpkinB', 'halloween.stack', 'halloween.hay', 'halloween.scarecrow', 'halloween.cauldron', 'halloween.broom',
    'halloween.bunting', 'halloween.lights', 'halloween.bat', 'halloween.candyBag', 'halloween.candyBasket',
    'townhall.wall', 'townhall.post', 'townhall.corner', 'townhall.gatePillar', 'townhall.planter', 'townhall.lampA', 'townhall.lampB',
    ...['spring', 'summer', 'autumn', 'winter'].flatMap((s) => [`tree.harvest.${s}`, `tree.fruitLayer.${s}`]), 'prop.harvest.fruit',
    ...['flowerbed_empty', 'flowerbed_bloom', 'photo_frame', 'fishing_rod', 'watering_can', 'camera_bag'].map((s) => `quest.${s}`),
    'train.car', 'train.platform', 'fishing.rod', 'fishing.bobber', ...['anchovy', 'mackerel', 'goby', 'cutlassfish', 'pufferfish', 'octopus', 'stingray', 'giant_tuna'].map((f) => `fish.${f}`)].sort());
  // v1.10.32: the base (9: face, two hairs, four clothes, shoes, overalls), every avatar item's part (hair 12, clothes 14, hats 12 with the cat ears, capes, tails,
  // shoes, necklaces 10 each) and the 30 face designs
  assert.equal(Object.keys(REGISTRY).filter((id) => id.startsWith('wear.')).length, 9 + 12 + 14 + 12 + 40 + 30 + 27 + 1 + 50); // v1.10.36: + the 27 Halloween parts; v1.10.41 + the mayor's suit
  const pack = buildAssetManifest(path.join(__dirname, '..', 'public'), (ext) => ['.svg', '.png', '.glb'].includes(ext));
  const parsed = new Map();
  const check = async (id, url, what) => {
    assert.ok(pack.assets.some((a) => a.url === url), `${id} ${what} 리소스 팩`);
    if (!parsed.has(url)) {
      const gltf = await parse(fs.readFileSync(path.join(__dirname, '..', 'public', url)));
      let meshes = 0; gltf.scene.traverse((o) => { if (o.isMesh) meshes += 1; });
      parsed.set(url, meshes);
    }
    assert.ok(parsed.get(url) > 0, `${id} ${what} 메시`);
  };
  for (const [id, entry] of Object.entries(REGISTRY)) {
    for (const url of Object.values(entry.clips || {})) { // v1.10.30 the motions: one clip each, no mesh
      assert.ok(pack.assets.some((a) => a.url === url), `${id} ${url} 리소스 팩`);
      const gltf = await parse(fs.readFileSync(path.join(__dirname, '..', 'public', url)));
      assert.equal(gltf.animations.length, 1, url); parsed.set(url, 0);
    }
    const scale = entry.scale ?? 1;
    if (id.startsWith('sea.') && entry.haze) assert.ok(scale >= 2 && scale <= 4 && entry.haze > 0 && entry.haze < 1, `${id} 원경 크기·대기색`); // far landmarks at sea
    else assert.ok(scale > 0.5 && scale < 1.5, `${id} 크기 보정`);
    if (!entry.seasons) { // the same in every season
      assert.match(entry.url, /^\/assets\/island\/(seasonal-v2\/common|additions-v1\/(houses|facilities|props)|gaps-v1\/(props|sea|structure)|characters|additions-v1\/common|finish-v1\/sea|halloween-v1|halloween-decor-v1|townhall-v2|fishing-v1|train-v1|life-v1)\//, id); // v1.10.32 + snowcaps, the sea sights
      for (const season of P.SEASONS) assert.equal(P.entryOf(REGISTRY, id, [], season).url, entry.url);
      await check(id, entry.url, 'High');
      if (entry.low) await check(id, entry.low.url, 'Low');
      continue;
    }
    assert.deepEqual(Object.keys(entry.seasons), P.SEASONS, `${id} 사계절`);
    for (const season of P.SEASONS) {
      const e = P.entryOf(REGISTRY, id, [], season);
      assert.match(e.url, new RegExp(`^/assets/island/(seasonal-v2|additions-v1|gaps-v1)/${season}/`), `${id} ${season}`);
      await check(id, e.url, season);
      if (entry.low) { assert.ok(e.lowUrl.includes(`/${season}/`), `${id} ${season} Low`); await check(id, e.lowUrl, `${season} Low`); }
    }
    assert.equal(P.entryOf(REGISTRY, id, [], null), null, `${id}: 계절 없이 쓰는 파일은 없음`);
  }
  const config = require('../tools/assets/island-models.json');
  assert.equal(parsed.size, config.files.length + config.files.filter((f) => f.low || f.lowSrc).length); // every file built (tools/assets/island-models.json) is used
  // the clips the game plays: the falling flakes loop, the whale and the splash once
  for (const [id, clip] of [['fx.petal', 'PetalFallLoop'], ['fx.leaf', 'LeafFallLoop'], ['fx.snow', 'SnowflakeFallLoop'], ['sea.whale', 'BreachOnce'], ['sea.splash', 'SplashOnce']]) {
    const gltf = await parse(fs.readFileSync(path.join(__dirname, '..', 'public', REGISTRY[id].url)));
    assert.deepEqual(gltf.animations.map((a) => a.name), [clip], id);
    assert.ok(gltf.animations[0].duration > 1, id);
  }
});

// v1.10.27 게임 아일랜드 4계절 동시 존재·일일 회전 (사용자 결정 2026-10-05; the v1.10.19 monthly whole-island season
// is gone): four zones always show the four seasons, the central plaza is neutral, at 00:00 Asia/Seoul every season
// moves one zone clockwise and the arrangement comes back every 4 days; only the seasons move, never places.
test('게임 아일랜드 계절 구역: 중앙광장 중립, 섬은 네 구역으로 고르게 나뉘고 경계는 직선이 아니다', () => {
  const T = require('../public/plaza/island-terrain.js');
  assert.equal(T.seasonZoneAt(0, 0), -1);
  for (const id of ['board', 'attendance', 'map', 'donate']) assert.equal(T.seasonZoneAt(T.SPOTS[id].x, T.SPOTS[id].z), -1, `${id}: 광장 중립`);
  for (const [x, z] of [[0, 10], [12, -12], [-15, 15]]) assert.equal(T.seasonZoneAt(x, z), -1);
  // far from the edges: north, east, south, west are zones 0..3 (clockwise seen from above, north = -z)
  assert.equal(T.seasonZoneAt(0, -70), 0); assert.equal(T.seasonZoneAt(70, 0), 1); assert.equal(T.seasonZoneAt(0, 70), 2); assert.equal(T.seasonZoneAt(-70, 0), 3);
  const counts = [0, 0, 0, 0]; let land = 0;
  for (let x = -130; x <= 130; x += 2) for (let z = -130; z <= 130; z += 2) {
    if (!T.walkable(x, z)) continue;
    land += 1; const zone = T.seasonZoneAt(x, z); if (zone >= 0) counts[zone] += 1;
  }
  for (const n of counts) assert.ok(n > land * 0.18 && n < land * 0.32, `구역 크기 ${counts}`);
  // an edge is not one straight line: along the north-east diagonal the zone changes back and forth with distance
  const along = []; for (let r = 30; r <= 110; r += 4) along.push(T.seasonZoneAt(r * Math.SQRT1_2, -r * Math.SQRT1_2));
  assert.ok(new Set(along).size === 2 && along.some((zone, i) => i > 0 && zone !== along[i - 1]), along.join(''));
  // a place's zone never changes (the day only moves the seasons)
  assert.equal(T.seasonZoneAt(40, -50), T.seasonZoneAt(40, -50));
});

test('게임 아일랜드 계절 회전: 날마다 네 계절이 모두 있고 서울 00:00에 시계방향으로 한 구역, 4일마다 원래대로', () => {
  const T = require('../public/plaza/island-terrain.js');
  const kst = (y, m, d, h = 0, min = 0) => Date.UTC(y, m - 1, d, h - 9, min); // Seoul wall time -> ms
  const day = T.seasonDay(kst(2026, 10, 5, 12));
  for (let d = day; d < day + 8; d += 1) {
    const seasons = [0, 1, 2, 3].map((zone) => T.zoneSeason(zone, d));
    assert.deepEqual([...seasons].sort(), ['autumn', 'spring', 'summer', 'winter']); // all four, every day
    for (let zone = 0; zone < 4; zone += 1) {
      assert.equal(T.zoneSeason((zone + 1) % 4, d + 1), T.zoneSeason(zone, d)); // a season moves one zone clockwise
      assert.equal(T.zoneSeason(zone, d + 4), T.zoneSeason(zone, d)); // back every 4 days
    }
    assert.equal(T.zoneSeason(-1, d), null); // the plaza has none
  }
  // the day turns at 00:00 Seoul, not at the viewer's or UTC midnight
  assert.equal(T.seasonDay(kst(2026, 10, 5, 23, 59)), T.seasonDay(kst(2026, 10, 5, 0, 0)));
  assert.equal(T.seasonDay(kst(2026, 10, 6, 0, 0)), T.seasonDay(kst(2026, 10, 5, 23, 59)) + 1);
  assert.equal(T.seasonDay(Date.UTC(2026, 9, 5, 15, 0)), T.seasonDay(kst(2026, 10, 6, 0, 0))); // 15:00 UTC = 00:00 KST
  assert.equal(T.seasonAt(0, -70, kst(2026, 10, 5, 12)), T.zoneSeason(0, day));
  assert.equal(T.seasonAt(0, 0, kst(2026, 10, 5, 12)), null);
  // month ends and years do not matter any more: only the count of days
  assert.equal(T.seasonDay(kst(2027, 1, 1)) - T.seasonDay(kst(2026, 12, 31)), 1);
  assert.equal(P.NEUTRAL_LOOK, 'summer'); // the plaza's seasonal props show the plain green files
  assert.equal(P.seasonOf, undefined); // the monthly rule is gone
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
  assert.equal(imported, 0); assert.deepEqual(none.debug(), { registered: [], loader: 'none', day: null });

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
  none.batch('nature.tree', []); none.update(1, 2); none.setDay(3);
  assert.equal(none.debug().day, 3);

  const seen = [];
  const lazy = P.createLazyAssets({ registry: { 'nature.tree': { seasons: { winter: '/w.glb' } } }, options: { day: 1 }, importLoader: async () => ({ createIslandAssets: (o) => {
    seen.push(['create', o.day]);
    return { batch: (ids, cells) => seen.push(['batch', ids, cells.length]), update: (x, z) => seen.push(['update', x, z]), setDay: (d) => seen.push(['day', d]), attach() {}, dress() {}, setQuality() {}, release() {}, dispose() {}, debug: () => ({}) };
  } }) });
  assert.equal(lazy.wants('nature.tree'), true); // a winter file: worth keeping apart even in spring
  assert.equal(lazy.wants('nature.bush'), false);
  lazy.batch('nature.tree', [{}, {}]); lazy.update(5, 6); // update before the loader is in: nothing to move yet
  await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0));
  lazy.update(7, 8); lazy.setDay(3);
  assert.deepEqual(seen, [['create', 1], ['batch', 'nature.tree', 2], ['update', 7, 8], ['day', 3]]);
});

// v1.10.28 섬 전체 High/Low LOD: a target's far copies use the entry's `low` file of the same season (never the
// procedural look), and the High/Low switch has a band so standing at the edge does not flicker
test('High/Low LOD: low 파일은 계절별로 해석되고, 전환에는 히스테리시스가 있다', () => {
  const P = require('../public/plaza/asset-pipeline.js');
  const reg = { t: { seasons: { spring: '/a/s.glb', winter: '/a/w.glb' }, low: { seasons: { spring: '/a/s_low.glb' }, url: '/a/any_low.glb' } }, r: { url: '/a/rock.glb' } };
  assert.equal(P.entryOf(reg, 't', [], 'spring').lowUrl, '/a/s_low.glb');
  assert.equal(P.entryOf(reg, 't', [], 'winter').lowUrl, '/a/any_low.glb');
  assert.equal(P.entryOf(reg, 'r', [], 'spring').lowUrl, null); // no low file: the full model at every distance
  assert.equal(P.HIGH_BAND, 1.1);
  assert.equal(P.highState(false, 34.9, 35), true);
  assert.equal(P.highState(false, 35.5, 35), false);
  assert.equal(P.highState(true, 37, 35), true); // inside the band: stays High
  assert.equal(P.highState(true, 38.6, 35), false);
  // walking back and forth across the edge: one switch each way, not one per step
  let high = false; let switches = 0;
  for (const d of [36, 35.2, 34.8, 35.3, 36, 37.5, 38, 38.4, 38.6, 38.2, 37]) { const next = P.highState(high, d, 35); if (next !== high) switches += 1; high = next; }
  assert.equal(switches, 2);
  // v1.10.29: flowers too are drawn at every distance (their colours are what makes the island look colourful from
  // afar); their Low is the pipeline's own simplification of the same model, lighter than the artist's
  const { REGISTRY: R } = require('../public/plaza/island-assets.js');
  const config = require('../tools/assets/island-models.json');
  for (const c of [0, 1, 2, 3, 4]) {
    assert.equal(R[`nature.flower.${c}`].far, undefined, `flower ${c}`);
    for (const f of config.files.filter((x) => x.out.includes(`/flower_${c}_`))) { assert.ok(f.low > 0 && f.low < 0.2, f.out); assert.equal(f.lowSrc, undefined, f.out); }
  }
});

test('운영 등록부: 나무·관목은 사계절 Low 파일이 있고 High보다 가볍다', () => {
  const fs = require('node:fs'); const path = require('node:path');
  const P = require('../public/plaza/asset-pipeline.js');
  const { REGISTRY } = require('../public/plaza/island-assets.js');
  for (const id of ['nature.tree.round', 'nature.tree.tiered', 'nature.tree.blossom', 'nature.tree.tall', 'nature.bush']) {
    for (const season of P.SEASONS) {
      const e = P.entryOf(REGISTRY, id, [], season);
      assert.ok(e.lowUrl && e.lowUrl.endsWith('_low.glb') && e.lowUrl.includes(`/${season}/`), `${id} ${season}`);
      assert.ok(fs.statSync(path.join(__dirname, '..', 'public', e.lowUrl)).size < fs.statSync(path.join(__dirname, '..', 'public', e.url)).size);
    }
  }
  for (const id of ['nature.rock.0', 'nature.tree.stump']) assert.equal(P.entryOf(REGISTRY, id, [], 'spring').lowUrl, null);
});

// v1.10.32 캐릭터 조합 맞춤 (asset-pipeline fitWardrobe / applyFit): worked out from the parts' own shapes in the rig's
// rest space -- a hat's brim line hides the hair faces under its crown, a pendant comes out over the clothes' chest,
// a cape hangs behind the clothes' back band by band (never coming back in lower down), a tail caught in the cape's
// cloth comes out behind it, and a part's own piece gives way to a worn slot
test('조합 맞춤: 모자 덮기·펜던트·망토 드리우기·꼬리·내장 조각 숨김, 겹치지 않으면 손대지 않는다', () => {
  const P = require('../public/plaza/asset-pipeline.js');
  const tri = (...pts) => pts.flat();
  const hair = { id: 'hair', fit: { slot: 'hair' }, pos: tri([0, 1.7, 0], [0.3, 2.05, 0], [-0.3, 2.05, 0], [0.4, 2.1, 0], [0, 2.12, 0.1], [-0.4, 2.1, 0]) };
  const hat = { id: 'hat', fit: { slot: 'hat', cover: 2.0 }, pos: [0, 2.1, 0] };
  const robe = { id: 'robe', fit: { slot: 'outfit' }, pos: tri([0, 0.95, -0.27], [0, 0.6, 0.36], [0, 0.95, 0.24]) };
  const pendant = { id: 'neck', fit: { slot: 'necklace' }, pos: tri([0, 1.07, -0.19], [0, 0.99, -0.255], [0, 0.97, -0.235]) };
  const cape = { id: 'cape', fit: { slot: 'cape' }, pos: tri([0, 1.07, 0.28], [0, 0.95, 0.28], [0, 0.6, 0.28], [0, 0.45, 0.28]) };
  const tail = { id: 'tail', fit: { slot: 'tail' }, pos: tri([0, 0.6, 0.2], [0, 0.6, 0.38], [0, 0.6, 0.6]) };
  const royal = { id: 'royal', fit: { slot: 'outfit', hideWith: { cape: ['cape_main'] } }, pos: [0, 1, 0] };
  const fit = P.fitWardrobe([hair, hat, robe, pendant, cape, tail, royal]);
  assert.deepEqual(fit.hair.ops, [{ kind: 'cover', above: 2.0 }]);
  assert.deepEqual(P.applyFit(hair.pos, [0, 1, 2, 3, 4, 5], fit.hair.ops).index, [0, 1, 2]); // the face above the brim line goes
  const neck = P.applyFit(pendant.pos, null, fit.neck.ops).pos;
  assert.ok(neck[5] < -0.27 - 0.01 && Math.abs(neck[2] - -0.19) < 1e-6, '펜던트만 앞으로(끈은 그대로)');
  const draped = P.applyFit(cape.pos, null, fit.cape.ops).pos;
  assert.ok(draped[8] > 0.36, '치마 높이에서 망토가 뒤로'); assert.ok(draped[11] >= draped[8] - 1e-6, '아래로 갈수록 다시 들어오지 않음'); assert.ok(Math.abs(draped[2] - 0.28) < 1e-6, '어깨는 그대로');
  const tailed = P.applyFit(tail.pos, null, fit.tail.ops).pos;
  assert.ok(Math.abs(tailed[2] - 0.2) < 1e-6 && tailed[5] > draped[8] && Math.abs(tailed[8] - 0.6) < 1e-6, '망토 천 안의 꼬리 점만 그 뒤로(몸 쪽·바깥은 그대로)');
  assert.deepEqual(fit.royal.hide, ['cape_main']);
  // nothing meets: nothing changes
  const plain = P.fitWardrobe([{ id: 'h', fit: { slot: 'hair' }, pos: hair.pos }, { id: 'o', fit: { slot: 'outfit' }, pos: [0, 1, 0] }]);
  assert.deepEqual([plain.h.ops, plain.o.ops, plain.o.hide], [[], [], []]);
});

// v1.10.40 모자 쓰는 깊이: a hat with `sink`/`widen` comes down onto the head and wider round its axis, the hair's cover
// line coming down with it; and every made hat's rim ends up at or below the forehead line, its crown round the head
test('모자 쓰는 깊이: 내려 쓰고 넓혀 머리를 감싸며, 머리카락 덮기 선도 같이 내려간다', () => {
  const P = require('../public/plaza/asset-pipeline.js');
  const { REGISTRY } = require('../public/plaza/island-assets.js');
  const hair = { id: 'hair', fit: { slot: 'hair' }, pos: [0, 1.7, 0, 0.3, 2.05, 0, -0.3, 2.05, 0] };
  const hat = { id: 'hat', fit: { slot: 'hat', cover: 2.04, sink: 0.12, widen: 1.15 }, pos: [0.3, 2.07, 0, 0, 2.3, 0.3] };
  const fit = P.fitWardrobe([hair, hat]);
  assert.deepEqual(fit.hair.ops, [{ kind: 'cover', above: 2.04 - 0.12 }]);
  const seated = P.applyFit(hat.pos, null, fit.hat.ops).pos;
  for (const [i, v] of [[0, 0.345], [1, 1.95], [4, 2.18], [5, 0.345]]) assert.ok(Math.abs(seated[i] - v) < 1e-6, `${i}: ${seated[i]}`);
  for (const id of ['wear.hat_straw', 'wear.hat_fedora', 'wear.hat_wizard', 'wear.hat_hw_witch', 'wear.hat_crown']) {
    const f = REGISTRY[id].fit; assert.ok(f.sink >= 0.1 && f.widen >= 1 && f.widen <= 1.2, id);
  }
  for (const id of ['wear.hat_beanie', 'wear.hat_cap', 'wear.hat_halo']) assert.equal(REGISTRY[id].fit.sink, undefined, `${id}: 그대로`);
});

// v1.10.32 겨울 지붕 눈 (asset-pipeline roofShape / drapeSnow): a roof read from its faces -- flat, gable (which way its
// ridge runs) or round -- and a snowcap laid over it, every point on the roof (never inside it), within its extent
test('지붕 눈: 지붕 모양 판별과 눈 덮개를 지붕 위에 맞춰 덮기', () => {
  const P = require('../public/plaza/asset-pipeline.js');
  const quads = (...qs) => Float32Array.from(qs.flatMap(([a, b, c, d]) => [...a, ...b, ...c, ...a, ...c, ...d]));
  const gableZ = quads([[-2, 2, -1.5], [0, 3, -1.5], [0, 3, 1.5], [-2, 2, 1.5]], [[0, 3, -1.5], [2, 2, -1.5], [2, 2, 1.5], [0, 3, 1.5]]);
  const gableX = quads([[-2, 2, -1.5], [2, 2, -1.5], [2, 3, 0], [-2, 3, 0]], [[-2, 3, 0], [2, 3, 0], [2, 2, 1.5], [-2, 2, 1.5]]);
  const pyramid = Float32Array.from([[[-2, 2, -2], [2, 2, -2]], [[2, 2, -2], [2, 2, 2]], [[2, 2, 2], [-2, 2, 2]], [[-2, 2, 2], [-2, 2, -2]]].flatMap(([a, b]) => [...a, ...b, 0, 4, 0]));
  const flat = quads([[-1, 2.5, -1], [1, 2.5, -1], [1, 2.5, 1], [-1, 2.5, 1]]);
  assert.deepEqual([gableZ, gableX, pyramid, flat].map((t) => { const r = P.roofShape(t); return [r.kind, r.ridge]; }), [['gable', 'z'], ['gable', 'x'], ['round', null], ['flat', null]]);
  const roof = P.roofShape(gableX);
  const cap = [-1, 0.1, -1, 1, 0.1, -1, 1, 0.1, 1, -1, 0.1, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1];
  const d = P.drapeSnow(cap, [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6], roof);
  assert.ok(d.index.length / 3 === 4 * 4 * 4, '두 번 나눠 지붕을 따라감');
  for (let i = 0; i < d.pos.length; i += 3) {
    assert.ok(d.pos[i + 1] >= roof.height(d.pos[i], d.pos[i + 2]) + 0.029, '지붕 위');
    assert.ok(Math.abs(d.pos[i]) <= 2 && Math.abs(d.pos[i + 2]) <= 1.5, '지붕 범위 안');
  }
});

// v1.10.46: seated, a tail sweeps up close to the back -- the longest (0.92 behind the hips) ends short of the bench's
// back 0.40 behind; the part at the body (z0 and in front) does not move
test('앉은 꼬리: 등받이(엉덩이 뒤 0.40) 앞에서 끝나고 몸에 붙은 쪽은 그대로', () => {
  const pos = new Float32Array([0, 0.5, 0.1, 0, 0.57, 0.92, 0, 0.22, 0.91]);
  const out = P.applyFit(pos, null, [P.TAIL_TUCK]).pos;
  assert.deepEqual(Array.from(out.slice(0, 3)).map((v) => +v.toFixed(3)), [0, 0.5, 0.1]);
  for (const i of [3, 6]) { assert.ok(out[i + 2] < 0.4, `z ${out[i + 2]}`); assert.ok(out[i + 1] > pos[i + 1], '위로 올라감'); }
});
