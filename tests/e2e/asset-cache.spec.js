const { test, expect } = require('@playwright/test');

// v1.10.14 game resource cache (public/game-boot.js + public/sw.js): each pack version in its own cache, built in
// staging and switched only when complete; pre-flight (quota margin, test write) before any download; failures keep
// the active pack and block entry with a retry; the off switch and a rollback deploy remove the worker and only the
// gc-res:* caches and fall back to plain server loading; Edge is stopped at the door.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');
test.describe.configure({ mode: 'serial' }); // the off switch is server-wide

const STORAGE_FAILED = '게임 리소스를 저장할 수 없습니다';
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';
const ready = page => page.evaluate(() => window.GameBoot.ready.then(() => true));
// the game has not started: GameBoot.ready (which runs app.js loadSession) is still pending
const pending = page => page.evaluate(() => Promise.race([window.GameBoot.ready.then(() => false), new Promise(r => setTimeout(() => r(true), 300))]));
// pack files this page load fetched from the network (Service Worker hits and local copies are not page fetches)
const downloads = page => page.evaluate(() => performance.getEntriesByType('resource')
  .filter(e => e.initiatorType === 'fetch' && /[?&]rev=/.test(e.name)).map(e => new URL(e.name).pathname));
const manifestKeys = page => page.evaluate(() => window.GameBoot.manifest.assets.map(a => `${a.url}?rev=${a.rev}`).sort());
const ourCaches = page => page.evaluate(async () => (await caches.keys()).filter(n => n.startsWith('gc-res:')).sort());
const packCaches = async page => (await ourCaches(page)).filter(n => n.startsWith('gc-res:pack:'));
const active = page => page.evaluate(async () => { const r = await caches.match('/active', { cacheName: 'gc-res:meta' }); return r ? r.json() : null; });
const packKeys = (page, name) => page.evaluate(async n => (await (await caches.open(n)).keys())
  .map(r => { const u = new URL(r.url); return u.pathname + u.search; }).sort(), name);
const setCache = (request, enabled) => request.post('/api/test/asset-cache', { data: { enabled } });
const workers = page => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
async function enterAsAdmin(page) {
  await page.locator('#adminPassword').fill(ADMIN_PASSWORD);
  await page.locator('#adminLoginForm button[type=submit]').click();
  await expect(page.locator('#lobbyView')).toBeVisible();
}
// As if a new version had been published since the last visit: the stored pack is marked older, the files matching
// `pattern` are missing from it (the ones the new version changed) and it holds a file the new version dropped.
function agePack(page, pattern) {
  return page.evaluate(async source => {
    const drop = new RegExp(source);
    const meta = await caches.open('gc-res:meta');
    const pointer = await (await meta.match('/active')).json();
    const pack = await caches.open(pointer.cache);
    for (const request of await pack.keys()) if (drop.test(new URL(request.url).pathname)) await pack.delete(request);
    await pack.put('/assets/removed.svg?rev=1111111111111111', new Response('gone'));
    await meta.put('/active', new Response(JSON.stringify({ ...pointer, version: 'older' })));
    return { cache: pointer.cache, keys: (await pack.keys()).map(r => { const u = new URL(r.url); return u.pathname + u.search; }).sort() };
  }, pattern.source);
}

test.afterEach(async ({ request }) => { await setCache(request, true); });

test('정상 활성화: 첫 접속에 모두 받아 팩을 활성화하고, 다시 접속하면 받지 않으며 Service Worker가 활성 팩에서 내준다', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const keys = await manifestKeys(page);
  expect(keys.length).toBeGreaterThan(40);
  expect((await downloads(page)).length).toBe(keys.length);
  const pointer = await active(page);
  expect(pointer.version).toBe(await page.evaluate(() => window.GameBoot.manifest.version));
  expect(await packKeys(page, pointer.cache)).toEqual(keys);
  expect(await ourCaches(page)).toEqual(['gc-res:meta', pointer.cache].sort()); // one pack; the pre-flight probe is gone
  await expect(page.locator('#bootView')).toBeHidden();

  await page.reload();
  await ready(page);
  expect(await downloads(page)).toEqual([]);
  expect((await active(page)).cache).toBe(pointer.cache);

  await page.evaluate(() => navigator.serviceWorker.ready);
  const served = page.waitForResponse(r => r.url().includes('/hwatu/m01-gwang.svg?rev='));
  await page.evaluate(() => fetch(window.GameBoot.assetUrl('/hwatu/m01-gwang.svg')).then(r => r.text()));
  const response = await served;
  expect(response.fromServiceWorker()).toBe(true);
  expect(response.headers()['content-type']).toBe('image/svg+xml');
});

test('업데이트: 바뀐 파일만 받아 새 버전 캐시를 만들고, 완성된 뒤에만 전환해 옛 버전 캐시를 지운다', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const keys = await manifestKeys(page);
  const old = await agePack(page, /^\/hwatu\/m01-gwang\.svg$/);

  await page.reload();
  await ready(page);
  expect(await downloads(page)).toEqual(['/hwatu/m01-gwang.svg']); // the rest were copied locally
  const pointer = await active(page);
  expect(pointer.cache).not.toBe(old.cache);
  expect(await packCaches(page)).toEqual([pointer.cache]);
  expect(await packKeys(page, pointer.cache)).toEqual(keys); // the dropped file is not carried over
});

test('캐시를 지우면 다음 접속에 자동으로 다시 받는다', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const keys = await manifestKeys(page);
  await page.evaluate(async () => { for (const name of await caches.keys()) await caches.delete(name); });

  await page.reload();
  await ready(page);
  expect((await downloads(page)).length).toBe(keys.length);
  expect(await packKeys(page, (await active(page)).cache)).toEqual(keys);
});

test.describe('업데이트 실패', () => {
  test.use({ serviceWorkers: 'block' }); // so the route below sees the page's own downloads

  test('받다가 끊기면 새 캐시를 버리고 기존 활성 캐시를 그대로 두며, 게임은 시작하지 않고 다시 시도로 마저 받는다', async ({ page }) => {
    let failing = false;
    await page.route(/\/hwatu\/m05-[a-z0-9]+\.svg\?rev=/, route => (failing ? route.abort('internetdisconnected') : route.continue()));
    await page.goto('/');
    await ready(page);
    const keys = await manifestKeys(page);
    const old = await agePack(page, /^\/hwatu\/m0[45]-/);

    failing = true;
    await page.reload();
    await expect(page.locator('#bootTitle')).toHaveText('게임 리소스 준비 실패');
    await expect(page.locator('#bootRetry')).toBeVisible();
    expect(await pending(page)).toBe(true);
    expect(await active(page)).toEqual({ version: 'older', cache: old.cache }); // still the old pack
    expect(await packKeys(page, old.cache)).toEqual(old.keys); // untouched
    expect(await packCaches(page)).toEqual([old.cache]); // the staging cache is gone

    failing = false;
    await page.locator('#bootRetry').click();
    await ready(page);
    const pointer = await active(page);
    expect(await packKeys(page, pointer.cache)).toEqual(keys);
    expect(await packCaches(page)).toEqual([pointer.cache]);
    await expect(page.locator('#bootView')).toBeHidden();
  });
});

test.describe('사전검사', () => {
  test('남은 공간이 받을 양에 여유를 더한 만큼 없으면 하나도 받지 않고, 다시 시도해도 같으면 받지 않는다', async ({ page }) => {
    // 4 MB free: more than the pack itself (about 2.8 MB) but not the pack plus the safety margin
    await page.addInitScript(() => { StorageManager.prototype.estimate = async () => ({ quota: 4 * 1024 * 1024, usage: 0 }); });
    await page.goto('/');
    await expect(page.locator('#bootTitle')).toHaveText(STORAGE_FAILED);
    await expect(page.locator('#bootRetry')).toBeVisible();
    expect(await pending(page)).toBe(true);
    expect(await downloads(page)).toEqual([]);
    expect(await ourCaches(page)).toEqual([]);
    await page.locator('#bootRetry').click();
    await expect(page.locator('#bootTitle')).toHaveText(STORAGE_FAILED);
    await page.waitForTimeout(500);
    expect(await downloads(page)).toEqual([]); // nothing downloads or retries by itself
  });

  test('저장소 쓰기 시험이 거부되면 받지 않고 기존 활성 캐시를 지킨다', async ({ page }) => {
    await page.addInitScript(() => {
      const put = Cache.prototype.put;
      Cache.prototype.put = function (...args) {
        if (sessionStorage.getItem('denyWrites')) return Promise.reject(new DOMException('denied', 'QuotaExceededError'));
        return put.apply(this, args);
      };
    });
    await page.goto('/');
    await ready(page);
    const old = await agePack(page, /^\/hwatu\/m01-gwang\.svg$/);
    await page.evaluate(() => sessionStorage.setItem('denyWrites', '1'));

    await page.reload();
    await expect(page.locator('#bootTitle')).toHaveText(STORAGE_FAILED);
    expect(await pending(page)).toBe(true);
    expect(await downloads(page)).toEqual([]);
    expect(await active(page)).toEqual({ version: 'older', cache: old.cache });
    expect(await packKeys(page, old.cache)).toEqual(old.keys);
    expect(await ourCaches(page)).toEqual(['gc-res:meta', old.cache].sort()); // no staging, no probe left
  });
});

test.describe('롤백', () => {
  test('긴급 비활성화: 실패하던 업데이트도 끄면 받지 않고, 워커와 게임 전용 캐시만 지운 뒤 서버에서 받는 방식으로 입장한다', async ({ page, context, request }) => {
    await page.goto('/');
    await ready(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await agePack(page, /^\/hwatu\/m05-/);
    // the worker is in control here, so the route goes on the context (it also sees the worker's requests)
    await context.route(/\/hwatu\/m05-[a-z0-9]+\.svg\?rev=/, route => route.abort('internetdisconnected'));
    await page.reload();
    await expect(page.locator('#bootTitle')).toHaveText('게임 리소스 준비 실패');
    await page.evaluate(() => { localStorage.setItem('keep.me', '1'); sessionStorage.setItem('keep.me', '1'); });

    expect((await setCache(request, false)).ok()).toBe(true);
    expect(await (await request.get('/asset-cache.json')).json()).toEqual({ enabled: false, version: '' });
    await page.reload();
    await ready(page);
    expect(await downloads(page)).toEqual([]);
    await expect.poll(() => workers(page)).toBe(0);
    expect(await ourCaches(page)).toEqual([]);
    expect(await page.evaluate(() => [localStorage.getItem('keep.me'), sessionStorage.getItem('keep.me'), localStorage.getItem('gc.testClassic')]))
      .toEqual(['1', '1', '1']); // other site data is left alone
    expect(await page.evaluate(() => window.GameBoot.assetUrl('/hwatu/m01-gwang.svg'))).toBe('/hwatu/m01-gwang.svg');
    await enterAsAdmin(page);

    // switched back on: the next load builds the cache again from scratch
    await setCache(request, true);
    await context.unrouteAll();
    await page.reload();
    await ready(page);
    expect((await downloads(page)).length).toBe((await manifestKeys(page)).length);
  });

  test('이전 버전 재배포: 서버에 /asset-cache.json이 없으면 남아 있던 워커가 게임 전용 캐시를 지우고 스스로 해제된다', async ({ page, context }) => {
    await page.goto('/');
    await ready(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    expect((await packCaches(page)).length).toBe(1);
    // the older deploy has no such endpoint (the worker's own request goes through the context)
    await context.route('**/asset-cache.json', route => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"NOT_FOUND"}' }));
    await page.goto('/health'); // any page load under the worker; older code never asks for ?rev= URLs
    await expect.poll(() => workers(page), { timeout: 10_000 }).toBe(0);
    expect(await ourCaches(page)).toEqual([]);
  });
});

const brands = list => `Object.defineProperty(Navigator.prototype, 'userAgentData', { configurable: true,
  get: () => ({ brands: ${JSON.stringify(list.map(brand => ({ brand, version: '130' })))}, mobile: false, platform: 'Windows' }) });`;

test('Microsoft Edge는 게임에 들어가지 못하고 Chrome 안내만 본다', async ({ page }) => {
  await page.addInitScript(brands(['Microsoft Edge', 'Chromium', 'Not?A_Brand']));
  await page.goto('/');
  await expect(page.locator('#bootTitle')).toHaveText('Google Chrome으로 접속해 주세요');
  await expect(page.locator('#bootRetry')).toBeHidden();
  await expect(page.locator('#bootPercent')).toBeHidden();
  expect(await pending(page)).toBe(true);
  expect(await downloads(page)).toEqual([]);
});

test('Google Chrome은 그대로 게임에 들어간다', async ({ page }) => {
  await page.addInitScript(brands(['Google Chrome', 'Chromium', 'Not?A_Brand']));
  await page.goto('/');
  await ready(page);
  await expect(page.locator('#bootView')).toBeHidden();
  await enterAsAdmin(page);
});
