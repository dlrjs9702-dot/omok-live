const { test, expect } = require('@playwright/test');
const { shopper, expectNoScriptError } = require('./skin-support');
const { staticGlb, riggedGlb } = require('../../test-support/gltf-fixture.js');

// v1.10.15 고품질 에셋 파이프라인 in the real island: with nothing registered nothing extra is loaded and everything
// stays procedural; a registered model is fetched once however many targets use it and swapped in (structures keep
// their doors and collision, characters play Idle/Walk/Run); a missing or broken model, a disabled entry or a loader
// that cannot load leaves only that target procedural and the island playable. Test entries come from localStorage
// gc.testIslandAssets (automated browsers only); the model files are generated and served by the route below.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');
test.describe.configure({ mode: 'default' }); // 3D pages one after another, like plaza.spec

const BOX = '/assets/island/__e2e/box.glb';
const RIG = '/assets/island/__e2e/rig.glb';
const BOX2 = '/assets/island/__e2e/box-winter.glb';
const debug = (page) => page.evaluate(() => { const d = window.PlazaDebug(); return d && { running: d.running, assets: d.assets, doors: d.doors, x: d.x, z: d.z, near: d.near }; });

async function island(browser, request, label, registry, { failLoader = false } = {}) {
  const who = await shopper(browser, request, label);
  const { page, context } = who;
  const hits = {};
  await context.route('**/assets/island/__e2e/**', (route) => {
    const url = new URL(route.request().url()).pathname; hits[url] = (hits[url] || 0) + 1;
    if (url === BOX) return route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: staticGlb() });
    if (url === RIG) return route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: riggedGlb() });
    if (url === BOX2) return route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: staticGlb() });
    if (url.endsWith('broken.glb')) return route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: Buffer.from('glTF but not really') });
    return route.fulfill({ status: 404, body: 'not found' });
  });
  const code = [];
  page.on('request', (r) => { if (/asset-loader\.js|\/vendor\/three\/addons\//.test(r.url())) code.push(new URL(r.url()).pathname); });
  if (failLoader) await context.route('**/plaza/asset-loader.js*', (route) => route.fulfill({ status: 500, body: 'no' }));
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  // 'none': as if nothing were registered (the registered entries are set to null); otherwise added to the registry;
  // v1.10.29 `__only`: only these entries (every registered one off) -- a test of the general ids (`cottage`,
  // `nature.flower`) that the real, more specific ones (`cottage.3`, `nature.flower.2`) would otherwise take over
  await page.evaluate((r) => {
    localStorage.removeItem('gc.testClassic');
    const nulls = Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null]));
    const own = r === 'none' ? nulls : r?.__only ? (({ __only, ...rest }) => ({ ...nulls, ...rest }))(r) : r;
    if (own) localStorage.setItem('gc.testIslandAssets', JSON.stringify(own));
  }, registry);
  await page.reload();
  await expect(page.locator('#plazaStage canvas.plazaCanvas')).toBeVisible({ timeout: 15000 });
  await expect.poll(() => debug(page).then((d) => d?.running), { timeout: 10000 }).toBe(true);
  return { ...who, hits, code, errors };
}

// the island still plays: walking, a facility hint, Space opens its window
async function stillPlays(page) {
  const before = await debug(page);
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => before.z - (await debug(page)).z, { timeout: 10000 }).toBeGreaterThan(0.3);
  await page.keyboard.up('ArrowUp');
  await page.evaluate(() => window.PlazaDebug().place('shop'));
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 게임 스킨 상점');
  await page.keyboard.press('Space');
  await expect(page.locator('#skinShopDialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#skinShopDialog')).toBeHidden();
}

let proceduralDoors = null;

test('등록 없음: 로더를 받지 않고 모든 대상이 코드 생성형, 섬은 그대로 동작한다', async ({ browser, request }) => {
  const a = await island(browser, request, '에셋없음', 'none');
  const d = await debug(a.page);
  expect(d.assets).toMatchObject({ registered: [], loader: 'none' });
  expect(a.code).toEqual([]); // neither the loader module nor GLTFLoader was fetched
  proceduralDoors = d.doors;
  await stillPlays(a.page);
  expect(a.errors).toEqual([]);
  await expectNoScriptError(a.page);
  await a.context.close();
});

test('등록 + 성공: 같은 모델은 여러 대상이 써도 한 번만 받고, 구조물은 문·충돌을 그대로 두고, 캐릭터는 Idle/Walk/Run을 재생한다', async ({ browser, request }) => {
  const a = await island(browser, request, '에셋성공', {
    __only: true,
    'facility.townhall': { url: BOX, scale: 2 },
    'cottage': { url: BOX, lod: [{ url: BOX, distance: 40 }] },
    'character.player': { url: RIG, animations: { idle: 'Idle', walk: 'Walk', run: 'Run' } },
  });
  const { page } = a;
  await expect.poll(async () => (await debug(page)).assets.shown, { timeout: 10000 })
    .toMatchObject({ 'facility.townhall': 'model', cottage: 'model', 'character.player': 'model' });
  const d = await debug(page);
  expect(d.assets.loader).toBe('ready');
  expect(d.assets.files).toMatchObject({ [BOX]: 'loaded', [RIG]: 'loaded' });
  expect(a.hits).toEqual({ [BOX]: 1, [RIG]: 1 }); // one download each: the town hall, nine cottages (two LOD levels) and me
  expect(d.assets.lods).toBe(9);
  expect(a.code).toEqual(expect.arrayContaining(['/plaza/asset-loader.js', '/vendor/three/addons/loaders/GLTFLoader.js', '/vendor/three/addons/utils/SkeletonUtils.js']));
  if (proceduralDoors) expect(d.doors).toEqual(proceduralDoors); // doors (and with them interaction) are the game's, not the model's

  // my character: Idle standing, Walk while the arrow is held, back to Idle -- through the mixer, cross-faded
  const gait = () => page.evaluate(() => window.PlazaDebug().gait);
  await expect.poll(gait).toBe('idle');
  await page.keyboard.down('ArrowUp');
  await expect.poll(gait).toBe('walk');
  await page.keyboard.up('ArrowUp');
  await expect.poll(gait).toBe('idle');
  await stillPlays(page);
  expect(a.errors).toEqual([]);
  await expectNoScriptError(page);
  await a.context.close();
});

test('실패·비활성화: 없는 파일·손상된 파일·꺼진 등록은 그 대상만 코드 생성형으로 남고 섬은 계속 동작한다', async ({ browser, request }) => {
  const a = await island(browser, request, '에셋실패', {
    __only: true,
    'facility.townhall': { url: '/assets/island/__e2e/missing.glb' },
    'facility.shop': { url: '/assets/island/__e2e/broken.glb' },
    'facility.records': { url: BOX, enabled: false },
    'cottage': { url: BOX },
  });
  const { page } = a;
  await expect.poll(async () => (await debug(page)).assets.shown, { timeout: 10000 })
    .toMatchObject({ 'facility.townhall': 'procedural', 'facility.shop': 'procedural', cottage: 'model' });
  const files = (await debug(page)).assets.files;
  expect(files[BOX]).toBe('loaded');
  expect(files['/assets/island/__e2e/missing.glb']).toMatch(/^failed/);
  expect(files['/assets/island/__e2e/broken.glb']).toMatch(/^failed/);
  expect(a.hits['/assets/island/__e2e/missing.glb']).toBe(1); // tried once, not again and again
  await stillPlays(page);
  expect(a.errors).toEqual([]);
  await a.context.close();
});

test('로더 자체를 받지 못해도 모든 대상이 코드 생성형으로 남고 섬은 계속 동작한다', async ({ browser, request }) => {
  const a = await island(browser, request, '로더실패', { 'facility.townhall': { url: BOX } }, { failLoader: true });
  await expect.poll(async () => (await debug(a.page)).assets.loader, { timeout: 10000 }).toBe('failed');
  expect(a.hits).toEqual({});
  await stillPlays(a.page);
  await a.context.close();
});

// v1.10.17 nature and plaza props
// v1.10.28: with a model, every copy at every distance is the model (no procedural copies left); without a Low file
// (here it is missing) the full model is used far away too
test('자연물 묶음: 같은 모델 1회 다운로드로 수십 그루를 기존 자리·회전·크기에 배치하고, 모든 거리에서 모델(Low 없으면 High), 실패한 종류는 코드 생성형, 소품도 교체된다', async ({ browser, request }) => {
  const a = await island(browser, request, '자연물', {
    __only: true,
    'nature.tree.round': { url: BOX, scale: 1.5, low: { url: '/assets/island/__e2e/missing-low.glb' } },
    'nature.flower': { url: BOX, scale: 0.2 },
    'nature.bush': { url: '/assets/island/__e2e/missing-bush.glb' },
    'prop.bench': { url: BOX },
  });
  const { page } = a;
  const batches = async () => (await debug(page)).assets.batches || [];
  await expect.poll(async () => (await batches()).filter((b) => b.placed).length, { timeout: 15000 }).toBeGreaterThanOrEqual(2);
  const list = await batches();
  const tree = list.find((b) => b.ids[0] === 'nature.tree.round');
  expect(tree.placed).toBe(true);
  expect(tree.copies).toBeGreaterThan(20); // every round tree on the island
  expect(tree.parts).toBe(1); // a plain-coloured model: flattened into one part, one draw call per square
  expect(tree.procedural).toBe(0); // no copy is drawn procedural, near or far
  expect(tree.low).toBe(null); // the Low file failed: High everywhere
  // next to one of them (the model distance shrinks on a slow machine's lower quality tiers)
  await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x + 1.5, z + 1.5), tree.at);
  await expect.poll(async () => (await batches()).find((b) => b.ids[0] === 'nature.tree.round').near).toBeGreaterThan(0);
  const flowers = list.filter((b) => b.ids.includes('nature.flower')); // v1.10.29: one list per colour, all on the general entry here
  expect(flowers.length).toBe(5);
  for (const f of flowers) expect(f.placed).toBe(true);
  for (const bush of list.filter((b) => b.ids[0].startsWith('nature.bush'))) expect(bush.placed).toBe(false); // missing file: procedural
  const shown = (await debug(page)).assets.shown;
  expect(shown['nature.bush']).toBe('procedural');
  expect(shown['prop.bench']).toBe('model');
  expect(a.hits[BOX]).toBe(1); // trees, flowers and the four benches share one download
  if (proceduralDoors) expect((await debug(page)).doors).toEqual(proceduralDoors);
  await stillPlays(page);
  expect(a.errors).toEqual([]);
  await a.context.close();
});

// v1.10.27 게임 아일랜드 4계절 동시 존재·일일 회전: every copy shows its zone's season today; the next day every season
// is one zone further clockwise (the files stay the same, each fetched once); a season without a file leaves that
// zone's copies procedural; back to automatic, the day is the server clock's
test('계절 구역: 구역마다 그날의 계절 파일, 다음 날은 시계방향으로 한 구역씩 이동, 파일 없는 계절은 코드 생성형', async ({ browser, request }) => {
  const a = await island(browser, request, '계절', { 'nature.rock.0': { seasons: { spring: BOX, winter: BOX2 }, scale: 0.6 } }); // over the registered round-rock model
  const { page } = a;
  const rock = async () => ((await debug(page)).assets.batches || []).find((b) => b.ids[0] === 'nature.rock.0');
  await expect.poll(async () => (await debug(page)).assets.loader, { timeout: 15000 }).toBe('ready');
  const expectDay = async (day) => {
    await page.evaluate((d) => window.PlazaDebug().setSeasonDay(d), day);
    await expect.poll(async () => (await debug(page)).assets.day).toBe(day);
    await expect.poll(async () => (await rock())?.placed).toBe(true);
    const zones = (await rock()).zones;
    const looks = await page.evaluate((d) => [-1, 0, 1, 2, 3].map((zone) => window.IslandTerrain.zoneSeason(zone, d) || window.AssetPipeline.NEUTRAL_LOOK), day);
    expect(Object.keys(zones).length).toBeGreaterThanOrEqual(3); // rocks all round the island
    for (const [zone, z] of Object.entries(zones)) {
      expect(z.look).toBe(looks[Number(zone) + 1]);
      expect(z.url).toBe(z.look === 'spring' ? BOX : z.look === 'winter' ? BOX2 : null); // no file: procedural
    }
    return zones;
  };
  const day0 = 20736; // any day: 20736 % 4 === 0, zone k shows season k (north spring, east summer, south autumn, west winter)
  const first = await expectDay(day0);
  if (first[0]) expect(first[0].look).toBe('spring');
  const next = await expectDay(day0 + 1);
  for (const zone of [0, 1, 2, 3]) if (first[zone] && next[(zone + 1) % 4]) expect(next[(zone + 1) % 4].look).toBe(first[zone].look); // one zone clockwise
  const cycle = await expectDay(day0 + 4); // back where it started
  for (const zone of Object.keys(first)) expect(cycle[zone].look).toBe(first[zone].look);
  expect(a.hits[BOX]).toBe(1); expect(a.hits[BOX2]).toBe(1); // each file once, however often the day changes
  // back to the automatic day: the server clock's Seoul date
  await page.evaluate(() => window.PlazaDebug().setSeasonDay(null));
  const today = await page.evaluate(() => window.PlazaDebug().seasonDay());
  await expect.poll(async () => (await debug(page)).assets.day).toBe(today);
  await stillPlays(page);
  expect(a.errors).toEqual([]);
  await a.context.close();
});

// v1.10.18/19 the registered models, as players get them, from the game resource pack (Cache Storage), once each.
// v1.10.27: all four seasons are on the island at once -- the trees and shrubs of every season are loaded, the gazebo
// shows its zone's season, the plaza's benches and flower beds (neutral) the plain summer files
test('운영 등록부: 사계절 나무·관목이 모두 쓰이고, 정자는 그 구역의 계절, 광장 소품은 중립(여름) 파일, 섬은 그대로 동작한다', async ({ browser, request }) => {
  test.setTimeout(240000); // every island model (all four seasons, High and Low) on a software renderer, then a whale's breach
  const a = await island(browser, request, '운영모델', null);
  const { page } = a;
  const ids = (await page.evaluate(() => Object.keys(window.IslandAssets.REGISTRY))).filter((id) => id !== 'facility.admin' && !['sea.whale', 'sea.splash'].includes(id)); // 관리실: admins only; the whale only now and then (below)
  await expect.poll(async () => { const s = (await debug(page)).assets.shown; return ids.map((id) => s[id]); }, { timeout: 60000 }).toEqual(ids.map(() => 'model'));
  const d = await debug(page);
  expect(d.assets.day).toBe(await page.evaluate(() => window.PlazaDebug().seasonDay()));
  const files = Object.entries(d.assets.files).filter(([url]) => url.startsWith('/assets/island/'));
  for (const [, state] of files) expect(state).toBe('loaded');
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    for (const kind of ['tree_v1', 'tree_v2', 'tree_v3', 'shrub']) {
      expect(files.some(([url]) => url.includes(`/${season}/nature/${kind}_${season}.glb`)), `${season} ${kind}`).toBe(true);
      expect(files.some(([url]) => url.includes(`/${season}/nature/${kind}_${season}_low.glb`)), `${season} ${kind} low`).toBe(true); // v1.10.28
    }
  }
  const gazebo = d.assets.attaches.find((x) => x.ids.includes('facility.chat'));
  expect(gazebo.zone).toBeGreaterThanOrEqual(0);
  expect(gazebo.url).toContain(`/${gazebo.look}/gazebo_${gazebo.look}_v1.glb`);
  for (const prop of d.assets.attaches.filter((x) => x.ids.includes('prop.bench') || x.ids.includes('prop.planter'))) {
    expect(prop.zone).toBe(-1); expect(prop.look).toBe('summer'); // the neutral plaza
  }
  // v1.10.29: each flower colour its own model in every season; the bridges and yard fences take their zone's season
  for (const season of ['spring', 'summer', 'autumn', 'winter']) for (const c of [0, 1, 2, 3, 4]) {
    expect(files.some(([url]) => url.endsWith(`/additions-v1/${season}/flower_${c}_${season}.glb`)), `${season} flower ${c}`).toBe(true);
    expect(files.some(([url]) => url.endsWith(`/additions-v1/${season}/flower_${c}_${season}_low.glb`)), `${season} flower ${c} low`).toBe(true); // far flowers keep their colour
  }
  const bridges = d.assets.attaches.filter((x) => x.ids.includes('prop.bridge'));
  expect(bridges.length).toBe(4);
  for (const b of bridges) expect(b.url).toContain(`/${b.look}/bridge_${b.look}_v1.glb`);
  expect(d.assets.attaches.filter((x) => x.ids.includes('prop.fence')).length).toBeGreaterThanOrEqual(18); // two runs per cottage
  // every model file of every season is in the active pack of the resource cache
  const cached = await page.evaluate(async () => {
    const pointer = await caches.match('/active', { cacheName: 'gc-res:meta' }); const { cache } = await pointer.json();
    return (await (await caches.open(cache)).keys()).map((r) => new URL(r.url).pathname).filter((p) => p.startsWith('/assets/island/'));
  });
  const config = require('../../tools/assets/island-models.json');
  expect(cached.length).toBe(config.files.length + config.files.filter((f) => f.low || f.lowSrc).length); // v1.10.29: every island model (High and Low, all four seasons) is in the pack before entry
  for (const [url] of files) expect(cached).toContain(url);
  for (const b of d.assets.batches) {
    expect(b.placed).toBe(true); expect(b.parts).toBe(1);
    expect(b.procedural).toBe(0); // the island never turns procedural with distance
    expect(b.near + b.far).toBe(b.copies); // every copy drawn exactly once (High or Low), no doubles
  }
  if (proceduralDoors) expect(d.doors).toEqual(proceduralDoors);
  // v1.10.29: the falling flakes are ready for every season that has them, and a whale breaches once (LoopOnce) with a
  // splash where it breaks the surface and where it falls back, then is gone
  expect(d.assets.ambient.kinds.sort()).toEqual(['autumn', 'spring', 'winter']);
  await page.evaluate(() => { const p = window.PlazaDebug(); p.teleport(-70, 75); p.setCamYaw(Math.PI * 0.75); });
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().whale()), { timeout: 5000 }).toBe(true);
  // the clip runs on the scene's clock (a frame counts at most 0.05 s), so on a slow software-rendered runner its 6 s take longer
  await expect.poll(async () => (await debug(page)).assets.played, { timeout: 90000 }).toEqual({ 'sea.whale': 1, 'sea.splash': 2 });
  await expect.poll(async () => (await debug(page)).assets.playing, { timeout: 30000 }).toBe(0);
  await page.evaluate(() => window.PlazaDebug().setCamYaw(0)); // the arrows walk screen-relative
  await stillPlays(page);
  expect(a.errors).toEqual([]);
  await a.context.close();
});

// v1.10.28 섬 전체 High/Low LOD (사용자 결정 2026-10-05): the registered models as players get them -- near the player a
// tree is the full model, far away the same design simplified (never the procedural look), and the switch has a band
test('High/Low LOD: 가까운 나무는 High, 먼 나무는 같은 디자인의 Low, 경계에는 히스테리시스, 생성형으로 돌아가지 않는다', async ({ browser, request }) => {
  const a = await island(browser, request, 'LOD', null);
  const { page } = a;
  const tree = async () => ((await debug(page)).assets.batches || []).find((b) => b.ids[0] === 'nature.tree.round');
  await expect.poll(async () => (await tree())?.placed, { timeout: 30000 }).toBe(true);
  const t = await tree();
  expect(t.low).toMatch(/tree_v1_[a-z]+_low\.glb$/);
  await page.evaluate(() => window.PlazaDebug().holdQuality(2)); // a slow test machine must not change the distances mid-way
  const near = async () => page.evaluate(() => { const d = window.PlazaDebug(); return 35 * window.AssetPipeline.LOD_SCALE[d.quality]; });
  // the player stands `dist` east of the first round tree
  const standAt = async (dist) => { await page.evaluate(([x, z, dd]) => window.PlazaDebug().teleport(x + dd, z), [...t.at, dist]); await page.waitForTimeout(250); };
  await standAt(2);
  await expect.poll(async () => (await tree()).first).toBe('high');
  await standAt((await near()) + 1.5); // past `near` but inside the band: stays High
  await expect.poll(async () => (await tree()).first).toBe('high');
  await standAt((await near()) * 1.1 + 3); // past the band: Low
  await expect.poll(async () => (await tree()).first).toBe('low');
  await standAt((await near()) + 1.5); // back inside the band from far: stays Low
  await expect.poll(async () => (await tree()).first).toBe('low');
  await standAt((await near()) - 2); // inside `near`: High again
  await expect.poll(async () => (await tree()).first).toBe('high');
  // across the island everything stays the model (High near, Low far), never procedural, never drawn twice
  for (const b of (await debug(page)).assets.batches) {
    expect(b.procedural).toBe(0);
    expect(b.near + b.far).toBe(b.copies);
  }
  const all = await tree();
  expect(all.far).toBeGreaterThan(0); expect(all.near).toBeGreaterThan(0);
  expect(a.errors).toEqual([]);
  await a.context.close();
});
