const { test, expect } = require('@playwright/test');

// v1.10.14 game resource cache (public/game-boot.js + public/sw.js): the pack is downloaded once, reused, updated per
// file, rebuilt after the cache is cleared, never half-used after a failed download; Edge is stopped at the door.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

const CACHE = 'gc-assets-v1';
const ready = page => page.evaluate(() => window.GameBoot.ready.then(() => true));
// the game has not started: GameBoot.ready (which runs app.js loadSession) is still pending
const pending = page => page.evaluate(() => Promise.race([window.GameBoot.ready.then(() => false), new Promise(r => setTimeout(() => r(true), 300))]));
// pack files this page load fetched from the network (the downloads; Service Worker hits are not page fetches)
const downloads = page => page.evaluate(() => performance.getEntriesByType('resource')
  .filter(e => e.initiatorType === 'fetch' && /[?&]rev=/.test(e.name)).map(e => new URL(e.name).pathname));
const manifestKeys = page => page.evaluate(() => window.GameBoot.manifest.assets.map(a => `${a.url}?rev=${a.rev}`).sort());
const cachedKeys = page => page.evaluate(async name => (await (await caches.open(name)).keys())
  .map(r => { const u = new URL(r.url); return u.pathname + u.search; }).sort(), CACHE);

test('첫 접속에 리소스를 모두 받고, 다시 접속하면 받지 않으며 Service Worker가 캐시에서 내준다', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const keys = await manifestKeys(page);
  expect(keys.length).toBeGreaterThan(40);
  expect((await downloads(page)).length).toBe(keys.length);
  expect(await cachedKeys(page)).toEqual(keys);
  await expect(page.locator('#bootView')).toBeHidden();

  await page.reload();
  await ready(page);
  expect(await downloads(page)).toEqual([]);

  await page.evaluate(() => navigator.serviceWorker.ready);
  const served = page.waitForResponse(r => r.url().includes('/hwatu/m01-gwang.svg?rev='));
  await page.evaluate(() => fetch(window.GameBoot.assetUrl('/hwatu/m01-gwang.svg')).then(r => r.text()));
  const response = await served;
  expect(response.fromServiceWorker()).toBe(true);
  expect(response.headers()['content-type']).toBe('image/svg+xml');
});

test('바뀐 파일만 새로 받고 목록에 없는 옛 파일은 지운다', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const keys = await manifestKeys(page);
  // as if the server had published a new revision of one card and removed another file since the last visit
  await page.evaluate(async name => {
    const cache = await caches.open(name);
    const key = (await cache.keys()).map(r => new URL(r.url)).find(u => u.pathname === '/hwatu/m01-gwang.svg');
    await cache.delete(key.pathname + key.search);
    await cache.put('/hwatu/m01-gwang.svg?rev=0000000000000000', new Response('old'));
    await cache.put('/assets/removed.svg?rev=1111111111111111', new Response('gone'));
  }, CACHE);

  await page.reload();
  await ready(page);
  expect(await downloads(page)).toEqual(['/hwatu/m01-gwang.svg']);
  expect(await cachedKeys(page)).toEqual(keys);
});

test('캐시를 지우면 다음 접속에 자동으로 다시 받는다', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const keys = await manifestKeys(page);
  await page.evaluate(async () => { for (const name of await caches.keys()) await caches.delete(name); });

  await page.reload();
  await ready(page);
  expect((await downloads(page)).length).toBe(keys.length);
  expect(await cachedKeys(page)).toEqual(keys);
});

test.describe('업데이트 실패', () => {
  test.use({ serviceWorkers: 'block' }); // so the route below sees the page's own downloads

  test('받다가 끊기면 게임을 시작하지 않고, 받아 둔 정상 파일은 지키며, 다시 시도로 마저 받는다', async ({ page }) => {
    let failing = true;
    await page.route(/\/hwatu\/m05-[a-z0-9]+\.svg\?rev=/, route => (failing ? route.abort('internetdisconnected') : route.continue()));
    await page.goto('/');
    await expect(page.locator('#bootTitle')).toHaveText('게임 리소스 준비 실패');
    await expect(page.locator('#bootRetry')).toBeVisible();
    expect(await pending(page)).toBe(true);
    const keys = await manifestKeys(page);
    const partial = await cachedKeys(page);
    expect(partial.some(k => k.startsWith('/hwatu/m05-'))).toBe(false); // nothing half-written for the failed files
    expect(partial.every(k => keys.includes(k))).toBe(true);

    failing = false;
    await page.locator('#bootRetry').click();
    await ready(page);
    expect(await cachedKeys(page)).toEqual(keys);
    await expect(page.locator('#bootView')).toBeHidden();
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
  await page.locator('#adminPassword').fill(process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password');
  await page.locator('#adminLoginForm button[type=submit]').click();
  await expect(page.locator('#lobbyView')).toBeVisible();
});
