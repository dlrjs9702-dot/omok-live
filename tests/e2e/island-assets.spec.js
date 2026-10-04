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
const debug = (page) => page.evaluate(() => { const d = window.PlazaDebug(); return d && { running: d.running, assets: d.assets, doors: d.doors, x: d.x, z: d.z, near: d.near }; });

async function island(browser, request, label, registry, { failLoader = false } = {}) {
  const who = await shopper(browser, request, label);
  const { page, context } = who;
  const hits = {};
  await context.route('**/assets/island/__e2e/**', (route) => {
    const url = new URL(route.request().url()).pathname; hits[url] = (hits[url] || 0) + 1;
    if (url === BOX) return route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: staticGlb() });
    if (url === RIG) return route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: riggedGlb() });
    if (url.endsWith('broken.glb')) return route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: Buffer.from('glTF but not really') });
    return route.fulfill({ status: 404, body: 'not found' });
  });
  const code = [];
  page.on('request', (r) => { if (/asset-loader\.js|\/vendor\/three\/addons\//.test(r.url())) code.push(new URL(r.url()).pathname); });
  if (failLoader) await context.route('**/plaza/asset-loader.js*', (route) => route.fulfill({ status: 500, body: 'no' }));
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.evaluate((r) => { localStorage.removeItem('gc.testClassic'); if (r) localStorage.setItem('gc.testIslandAssets', JSON.stringify(r)); }, registry);
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

test('등록 없음(운영 기본): 로더를 받지 않고 모든 대상이 코드 생성형, 섬은 그대로 동작한다', async ({ browser, request }) => {
  const a = await island(browser, request, '에셋없음', null);
  const d = await debug(a.page);
  expect(d.assets).toEqual({ registered: [], loader: 'none' });
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
    .toEqual({ 'facility.townhall': 'model', cottage: 'model', 'character.player': 'model' });
  const d = await debug(page);
  expect(d.assets.loader).toBe('ready');
  expect(d.assets.files).toEqual({ [BOX]: 'loaded', [RIG]: 'loaded' });
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
    .toEqual({ 'facility.townhall': 'procedural', 'facility.shop': 'procedural', cottage: 'model' });
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
