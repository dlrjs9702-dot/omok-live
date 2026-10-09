const { test, expect } = require('@playwright/test');

// v1.10.14 game resource cache (public/game-boot.js + public/sw.js), v1.10.22 캐시 구조 v2: one cache of
// content-addressed files (gc-res:files, `url?rev=`), only new or changed files downloaded, the pointer written once a
// version is complete and unused keys dropped after it; one tab at a time (Web Lock); the page must be controlled by
// the worker; pre-flight (quota margin, test write) before any download; failures keep what was there and block entry
// with a retry; the off switch and a rollback deploy remove the worker and only the gc-res:* caches and fall back to
// plain server loading; Edge is stopped at the door.
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
// v1.10.25: the files prepared before the game starts -- the required groups (core and the whole island)
const manifestKeys = page => page.evaluate(() => { const m = window.GameBoot.manifest; return m.assets.filter(a => m.required.includes(a.group)).map(a => `${a.url}?rev=${a.rev}`).sort(); });
const groupKeys = (page, group) => page.evaluate(g => window.GameBoot.manifest.assets.filter(a => a.group === g).map(a => `${a.url}?rev=${a.rev}`).sort(), group);
const ROCK = '/assets/island/seasonal-v2/common/rock_v1_round.glb';
const FILES = 'gc-res:files';
const ourCaches = page => page.evaluate(async () => (await caches.keys()).filter(n => n.startsWith('gc-res:')).sort());
const active = page => page.evaluate(async () => { const r = await caches.match('/active', { cacheName: 'gc-res:meta' }); return r ? r.json() : null; });
const packKeys = (page, name) => page.evaluate(async n => (await (await caches.open(n)).keys())
  .map(r => { const u = new URL(r.url); return u.pathname + u.search; }).sort(), name);
const setCache = (request, enabled) => request.post('/api/test/asset-cache', { data: { enabled } });
const workers = page => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
const controlled = page => page.evaluate(() => Boolean(navigator.serviceWorker.controller));
async function enterAsAdmin(page) {
  await page.locator('#adminPassword').fill(ADMIN_PASSWORD);
  await page.locator('#adminLoginForm button[type=submit]').click();
  await expect(page.locator('#lobbyView')).toBeVisible();
}
// As if a new version had been published since the last visit: the pointer is marked older, the files matching
// `pattern` are missing (the ones the new version changed) and a file the new version dropped is still stored.
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
// v1.10.29: the island alone is now over 200 files -- past the browser's default resource-timing buffer (250 entries),
// which `downloads` reads; a bigger buffer counts every download
test.beforeEach(async ({ context }) => { await context.addInitScript(() => performance.setResourceTimingBufferSize(5000)); });

test('정상 활성화: 첫 접속에 모두 받아 팩을 활성화하고, 다시 접속하면 받지 않으며 Service Worker가 활성 팩에서 내준다', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const keys = await manifestKeys(page);
  expect(keys.length).toBeGreaterThanOrEqual(32); // v1.10.25: the required groups (the island files)
  expect((await downloads(page)).length).toBe(keys.length);
  const pointer = await active(page);
  expect(pointer).toEqual({ version: await page.evaluate(() => window.GameBoot.manifest.version), cache: FILES });
  expect(await packKeys(page, FILES)).toEqual(keys);
  expect(await ourCaches(page)).toEqual([FILES, 'gc-res:meta']); // one file cache; the pre-flight probe is gone
  expect(await controlled(page)).toBe(true); // the game starts only in a page the worker controls
  await expect(page.locator('#bootView')).toBeHidden();

  await page.reload();
  await ready(page);
  expect(await downloads(page)).toEqual([]);
  expect(await active(page)).toEqual(pointer);
  expect(await controlled(page)).toBe(true);

  await page.evaluate(() => navigator.serviceWorker.ready);
  const served = page.waitForResponse(r => r.url().includes(`${ROCK}?rev=`));
  await page.evaluate(url => fetch(window.GameBoot.assetUrl(url)).then(r => r.arrayBuffer()), ROCK);
  const response = await served;
  expect(response.fromServiceWorker()).toBe(true);
  expect(response.headers()['content-type']).toBe('model/gltf-binary');
});

test('업데이트: 바뀐 파일만 같은 캐시에 받고(복사 없음), 완성된 뒤에 버전을 가리키고 안 쓰는 파일을 지운다', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const keys = await manifestKeys(page);
  await agePack(page, /^\/assets\/island\/seasonal-v2\/common\/rock_v1_round\.glb$/);

  await page.reload();
  await ready(page);
  expect(await downloads(page)).toEqual([ROCK]); // the rest stay where they are
  expect(await active(page)).toEqual({ version: await page.evaluate(() => window.GameBoot.manifest.version), cache: FILES });
  expect(await ourCaches(page)).toEqual([FILES, 'gc-res:meta']);
  expect(await packKeys(page, FILES)).toEqual(keys); // the dropped file is gone
});

// v1.10.25 manifest groups: the island (all four seasons) is required; a game's files are not downloaded before the
// game starts but in its room (GameBoot.prefetch) or by the worker the first time one is asked for, into the same cache
test('필수 그룹(core·아일랜드 4계절)만 입장 전에 받고, 게임 리소스는 쓸 때 같은 캐시에 받아 둔다', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const required = await manifestKeys(page);
  expect(await page.evaluate(() => window.GameBoot.manifest.required)).toEqual(['core', 'island']);
  for (const season of ['spring', 'summer', 'autumn', 'winter', 'common']) expect(required.some(key => key.includes(`/seasonal-v2/${season}/`))).toBe(true);
  expect(await downloads(page)).toHaveLength(required.length);
  expect(await packKeys(page, FILES)).toEqual(required);
  const cards = await groupKeys(page, 'game.gostop');
  expect(cards.length).toBe(48);

  // a game's room prepares its group in the background
  await page.evaluate(() => window.GameBoot.prefetch('game.gostop'));
  expect(await packKeys(page, FILES)).toEqual([...required, ...cards].sort());
  // a file asked for directly is fetched by the worker and kept once its content matches its revision
  const [plum] = (await groupKeys(page, 'game.halligalli')).filter(key => key.startsWith('/assets/halli/plum.svg'));
  const deliveredRev = await page.evaluate(async url => {
    const body = await (await fetch(url)).arrayBuffer();
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', body));
    return Array.from(digest.slice(0, 8), b => b.toString(16).padStart(2, '0')).join('');
  }, plum);
  expect(deliveredRev).toBe(new URL(plum, 'http://localhost').searchParams.get('rev'));
  await expect.poll(async () => (await packKeys(page, FILES)).includes(plum)).toBe(true);
  // An old page's revision must not deliver the latest server bytes, nor keep them under the wrong key.
  const wrong = await page.evaluate(() => fetch('/assets/halli/lime.svg?rev=0000000000000000')
    .then(async r => ({ delivered: true, body: await r.text() })).catch(() => ({ delivered: false })));
  expect(wrong).toEqual({ delivered: false });
  expect((await packKeys(page, FILES)).some(key => key.includes('0000000000000000'))).toBe(false);
  expect(await page.evaluate(() => fetch('/assets/halli/__missing.svg?rev=0000000000000000').then(r => r.status))).toBe(404);

  // kept across loads (still in the manifest), nothing downloaded again
  await page.reload();
  await ready(page);
  expect(await downloads(page)).toEqual([]);
  expect((await packKeys(page, FILES)).filter(key => cards.includes(key) || key === plum)).toHaveLength(cards.length + 1);
});

test('이전 구조(v1.10.14~21)의 팩은 내려받지 않고 한 번 옮긴 뒤 지운다', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const keys = await manifestKeys(page);
  await page.evaluate(async () => { // the files as a v1.10.21 pack cache, the pointer at it
    const files = await caches.open('gc-res:files');
    const pack = await caches.open('gc-res:pack:older:1');
    for (const request of await files.keys()) await pack.put(request, await files.match(request));
    await caches.delete('gc-res:files');
    await (await caches.open('gc-res:meta')).put('/active', new Response(JSON.stringify({ version: 'older', cache: 'gc-res:pack:older:1' })));
  });
  await page.reload();
  await ready(page);
  expect(await downloads(page)).toEqual([]);
  expect(await ourCaches(page)).toEqual([FILES, 'gc-res:meta']);
  expect(await packKeys(page, FILES)).toEqual(keys);
  expect((await active(page)).cache).toBe(FILES);
});

test('같은 프로필의 두 탭이 동시에 준비해도 한 번만 받고 둘 다 들어간다', async ({ page, context }) => {
  await page.goto('/');
  await ready(page);
  const keys = await manifestKeys(page);
  await page.evaluate(async () => { for (const name of await caches.keys()) await caches.delete(name); });
  const other = await context.newPage();
  await Promise.all([page.reload(), other.goto('/')]);
  await Promise.all([ready(page), ready(other)]);
  const fetched = [...await downloads(page), ...await downloads(other)];
  expect(fetched.length).toBe(keys.length); // the tab that waited for the lock found every file there
  expect(await packKeys(page, FILES)).toEqual(keys);
  expect(await controlled(other)).toBe(true);
});

test('강력 새로고침(워커를 거치지 않은 로드)도 워커의 제어를 받은 뒤 들어간다', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const cdp = await page.context().newCDPSession(page);
  await Promise.all([page.waitForEvent('load'), cdp.send('Page.reload', { ignoreCache: true })]);
  await ready(page);
  expect(await controlled(page)).toBe(true);
  expect(await downloads(page)).toEqual([]);
});

test('캐시를 지우면 다음 접속에 자동으로 다시 받는다', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const keys = await manifestKeys(page);
  await page.evaluate(async () => { for (const name of await caches.keys()) await caches.delete(name); });

  await page.reload();
  await ready(page);
  expect((await downloads(page)).length).toBe(keys.length);
  expect(await packKeys(page, FILES)).toEqual(keys);
});

test.describe('업데이트 실패', () => {
  test('받다가 끊기면 이전 버전 파일과 포인터를 그대로 두고, 게임은 시작하지 않으며 다시 시도로 마저 받는다', async ({ page, context }) => {
    test.setTimeout(180_000); // the whole island prepared twice over on a slow runner
    let failing = false;
    // on the context: the downloads go through the worker once it controls the page
    await context.route(/\/assets\/island\/seasonal-v2\/winter\/[^?]+\?rev=/, route => (failing ? route.abort('internetdisconnected') : route.continue()));
    await page.goto('/');
    await ready(page);
    const keys = await manifestKeys(page);
    const old = await agePack(page, /^\/assets\/island\/seasonal-v2\/(autumn|winter)\//);

    failing = true;
    await page.reload();
    await expect(page.locator('#bootTitle')).toHaveText('게임 리소스 준비 실패', { timeout: 90_000 }); // the winter files come late among the island's ~240 (v1.10.29): a slow runner needs well over 5 s to reach them
    await expect(page.locator('#bootRetry')).toBeVisible();
    expect(await pending(page)).toBe(true);
    expect(await active(page)).toEqual({ version: 'older', cache: FILES }); // not pointed at the new version
    const stored = await packKeys(page, FILES);
    expect(old.keys.every(key => stored.includes(key))).toBe(true); // nothing the previous version used was removed

    failing = false;
    await page.locator('#bootRetry').click();
    await ready(page);
    expect(await packKeys(page, FILES)).toEqual(keys);
    expect(await ourCaches(page)).toEqual([FILES, 'gc-res:meta']);
    await expect(page.locator('#bootView')).toBeHidden();
  });
});

test.describe('워커 차단', () => {
  test.use({ serviceWorkers: 'block' });
  test('Service Worker가 페이지를 제어하지 못하면 서버에서 따로 받지 않고 입장을 막고 다시 시도만 보인다', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#bootTitle')).toHaveText('게임 리소스 준비 실패', { timeout: 20_000 });
    await expect(page.locator('#bootRetry')).toBeVisible();
    expect(await pending(page)).toBe(true);
    expect(await controlled(page)).toBe(false);
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
    expect((await ourCaches(page)).filter(name => name !== FILES)).toEqual([]);
    expect(await packKeys(page, FILES)).toEqual([]); // nothing stored
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
    const old = await agePack(page, /^\/assets\/island\/seasonal-v2\/common\/rock_v1_round\.glb$/);
    await page.evaluate(() => sessionStorage.setItem('denyWrites', '1'));

    await page.reload();
    await expect(page.locator('#bootTitle')).toHaveText(STORAGE_FAILED);
    expect(await pending(page)).toBe(true);
    expect(await downloads(page)).toEqual([]);
    expect(await active(page)).toEqual({ version: 'older', cache: FILES });
    expect(await packKeys(page, FILES)).toEqual(old.keys);
    expect(await ourCaches(page)).toEqual([FILES, 'gc-res:meta']); // no probe left
  });
});

test.describe('롤백', () => {
  test('긴급 비활성화: 실패하던 업데이트도 끄면 받지 않고, 워커와 게임 전용 캐시만 지운 뒤 서버에서 받는 방식으로 입장한다', async ({ page, context, request }) => {
    await page.goto('/');
    await ready(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await agePack(page, /^\/assets\/island\/seasonal-v2\/winter\//);
    // the worker is in control here, so the route goes on the context (it also sees the worker's requests)
    await context.route(/\/assets\/island\/seasonal-v2\/winter\/[^?]+\?rev=/, route => route.abort('internetdisconnected'));
    await page.reload();
    await expect(page.locator('#bootTitle')).toHaveText('게임 리소스 준비 실패', { timeout: 20_000 });
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
    expect(await page.evaluate(url => window.GameBoot.assetUrl(url), ROCK)).toBe(ROCK);
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
    expect(await ourCaches(page)).toEqual([FILES, 'gc-res:meta']);
    // the older deploy has no such endpoint (the worker's own request goes through the context)
    await context.route('**/asset-cache.json', route => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"NOT_FOUND"}' }));
    await page.goto('/health'); // any page load under the worker; older code never asks for ?rev= URLs
    await expect.poll(() => workers(page), { timeout: 10_000 }).toBe(0);
    expect(await ourCaches(page)).toEqual([]);
  });
});

// v1.10.24 코드 해시 전달: the page's code comes by content-hash URL with a long immutable cache, outside the resource
// cache, and the inline import map passes the CSP (no violation, the island's modules load through it)
test('코드는 해시 주소로 받아 HTTP 캐시에 오래 두고, 리소스 캐시에는 넣지 않는다', async ({ page }) => {
  const code = [];
  const violations = [];
  page.on('console', msg => { if (/Content Security Policy/i.test(msg.text())) violations.push(msg.text()); });
  page.on('response', r => { const u = new URL(r.url()); if (/\.(js|css)$/.test(u.pathname) && u.pathname !== '/sw.js') code.push([u.pathname + u.search, r.headers()['cache-control']]); });
  await page.goto('/');
  await ready(page);
  expect(code.length).toBeGreaterThan(30);
  for (const [url, cache] of code) {
    expect(url).toMatch(/\?h=[0-9a-f]{16}$/);
    expect(cache).toBe('public, max-age=31536000, immutable');
  }
  expect(await page.evaluate(() => JSON.parse(document.querySelector('script[type=importmap]').textContent).imports.three)).toMatch(/^\/vendor\/three\/three\.module\.js\?h=/);
  expect((await packKeys(page, FILES)).some(key => /\.(js|css)\?/.test(key))).toBe(false);
  expect(violations).toEqual([]);
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
