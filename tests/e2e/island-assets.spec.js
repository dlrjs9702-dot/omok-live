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
  // 'none': as if nothing were registered (the registered entries are set to null); otherwise added to the registry
  await page.evaluate((r) => {
    localStorage.removeItem('gc.testClassic');
    const own = r === 'none' ? Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])) : r;
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
  expect(d.assets).toEqual({ registered: [], loader: 'none', season: null });
  expect(a.code).toEqual([]); // neither the loader module nor GLTFLoader was fetched
  proceduralDoors = d.doors;
  await stillPlays(a.page);
  expect(a.errors).toEqual([]);
  await expectNoScriptError(a.page);
  await a.context.close();
});

test('등록 + 성공: 같은 모델은 여러 대상이 써도 한 번만 받고, 구조물은 문·충돌을 그대로 두고, 캐릭터는 Idle/Walk/Run을 재생한다', async ({ browser, request }) => {
  const a = await island(browser, request, '에셋성공', {
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
test('자연물 묶음: 같은 모델 1회 다운로드로 수십 그루를 기존 자리·회전·크기에 배치하고, 가까운 칸만 모델, 실패한 종류는 코드 생성형, 소품도 교체된다', async ({ browser, request }) => {
  const a = await island(browser, request, '자연물', {
    'nature.tree.round': { url: BOX, scale: 1.5 },
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
  await expect.poll(async () => (await batches()).find((b) => b.ids[0] === 'nature.tree.round').near).toBeGreaterThan(0);
  expect(list.find((b) => b.ids[0] === 'nature.flower').placed).toBe(true);
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

test('계절 파일: 계절을 바꾸면 그 계절 파일로 교체하고, 그 계절 파일이 없으면 코드 생성형으로 돌아간다', async ({ browser, request }) => {
  const a = await island(browser, request, '계절', { 'nature.rock': { seasons: { spring: BOX, winter: BOX2 }, scale: 0.6 } });
  const { page } = a;
  const rock = async () => ((await debug(page)).assets.batches || []).find((b) => b.ids[0] === 'nature.rock');
  await expect.poll(async () => (await debug(page)).assets.loader, { timeout: 15000 }).toBe('ready');
  expect((await rock()).placed).toBe(false); // no season chosen yet: no file
  await page.evaluate(() => window.PlazaDebug().setSeason('spring'));
  await expect.poll(async () => (await rock())?.url).toBe(BOX);
  await expect.poll(async () => (await rock()).placed).toBe(true);
  await page.evaluate(() => window.PlazaDebug().setSeason('winter'));
  await expect.poll(async () => (await rock()).url).toBe(BOX2);
  await expect.poll(async () => (await rock()).placed).toBe(true);
  await page.evaluate(() => window.PlazaDebug().setSeason('summer')); // no summer file
  await expect.poll(async () => (await rock()).placed).toBe(false);
  expect(a.hits).toEqual({ [BOX]: 1, [BOX2]: 1 });
  await stillPlays(page);
  expect(a.errors).toEqual([]);
  await a.context.close();
});

// v1.10.18 the registered trial models, as players get them: from the game resource pack (Cache Storage), once each
test('운영 등록부: 시험 모델(봄 둥근 나무·관목·광장 벤치)이 리소스 팩에서 한 번씩 받아져 교체되고, 섬은 그대로 동작한다', async ({ browser, request }) => {
  const a = await island(browser, request, '시험모델', null);
  const { page } = a;
  const glbs = [];
  page.on('request', (r) => { if (r.url().includes('/assets/island/seasonal-v2/')) glbs.push(new URL(r.url()).pathname); });
  const ids = ['nature.tree.round', 'nature.bush', 'prop.bench'];
  await expect.poll(async () => { const s = (await debug(page)).assets.shown; return ids.map((id) => s[id]); }, { timeout: 20000 }).toEqual(['model', 'model', 'model']);
  const d = await debug(page);
  const files = Object.entries(d.assets.files).filter(([url]) => url.includes('/seasonal-v2/'));
  expect(files.map(([, state]) => state)).toEqual(['loaded', 'loaded', 'loaded']);
  // every model file is in the active pack of the resource cache
  const cached = await page.evaluate(async () => {
    const pointer = await caches.match('/active', { cacheName: 'gc-res:meta' }); const { cache } = await pointer.json();
    return (await (await caches.open(cache)).keys()).map((r) => new URL(r.url).pathname).filter((p) => p.includes('/seasonal-v2/'));
  });
  expect(cached.sort()).toEqual(files.map(([url]) => url).sort());
  const tree = d.assets.batches.find((b) => b.ids[0] === 'nature.tree.round');
  expect(tree.placed).toBe(true); expect(tree.parts).toBe(1);
  for (const b of d.assets.batches.filter((x) => x.ids[0].startsWith('nature.bush'))) expect(b.placed).toBe(true);
  if (proceduralDoors) expect(d.doors).toEqual(proceduralDoors);
  await stillPlays(page);
  expect(a.errors).toEqual([]);
  await a.context.close();
});
