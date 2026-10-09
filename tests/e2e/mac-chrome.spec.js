const { test, expect } = require('@playwright/test');
const { post } = require('./skin-support');

// v1.10.23 Mac Chrome 구형 로비 노출 수정 (IDEAS 2026-10-05): Chrome on macOS gets the game island like Windows Chrome;
// the island's WebGL renderer is retried with safer settings; and if the island still cannot start, a regular user
// sees its short error with a retry -- never the classic lobby -- while the reason is kept for diagnosis. This runs in
// Playwright's Chromium with a macOS Chrome user agent and client hints; it is not a real Mac GPU check.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const MAC_HINTS = `Object.defineProperty(Navigator.prototype, 'userAgentData', { configurable: true,
  get: () => ({ brands: [{ brand: 'Google Chrome', version: '130' }, { brand: 'Chromium', version: '130' }, { brand: 'Not?A_Brand', version: '99' }], mobile: false, platform: 'macOS' }) });`;
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';
let ip = 0;
const nextIp = () => `100.73.${process.pid % 250}.${(++ip % 250) + 1}`;

// WebGL as a Mac might give it: `mode` (read per call from window.__gl) -- 'ok', 'none' (no WebGL at all), 'picky'
// (the island's preferred settings are refused, Chrome's defaults work) or 'refuse' (a probe works, every renderer
// context with settings is refused)
const GL_SWITCH = `(() => {
  const real = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    const mode = window.__gl || sessionStorage.getItem('gl') || 'ok';
    if (/webgl/.test(type)) {
      if (mode === 'none') return null;
      if (mode === 'picky' && attrs?.powerPreference === 'high-performance') return null;
      if (mode === 'refuse' && attrs) return null;
    }
    return real.call(this, type, attrs);
  };
})();`;

async function macUser(browser, request, label, gl = 'ok', omitMotionScript = false) {
  const admin = (await post(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
  const issued = (await post(request, '/api/admin/keys', admin, { label })).data;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: MAC_UA, deviceScaleFactor: 2 });
  await context.addInitScript(MAC_HINTS);
  await context.addInitScript(GL_SWITCH);
  if (omitMotionScript) await context.route(url => url.pathname === '/' || url.pathname === '/guest-entry', async route => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/<script\b[^>]*src="\/plaza\/remote-motion\.js[^"\n]*"[^>]*><\/script>/g, '');
    await route.fulfill({ response, body: html });
  });
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': nextIp() });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(issued.html)]);
  const token = JSON.parse(await page.evaluate(() => sessionStorage.getItem('gameCenterGuestSession'))).token;
  await post(request, '/api/avatar/gender', token, { gender: 'male' });
  await page.locator('#lobbyView').waitFor({ state: 'visible' });
  await page.evaluate((mode) => { localStorage.removeItem('gc.testClassic'); sessionStorage.setItem('gl', mode); }, gl);
  await page.reload();
  await expect(page.locator('#lobbyView')).toBeVisible();
  return { context, page, errors };
}
const classicShown = (page) => page.evaluate(() => !document.body.classList.contains('plazaMode'));

test('macOS Chrome: Chrome으로 판정되어 게임 아일랜드로 들어가고 기존 로비는 보이지 않는다', async ({ browser, request }) => {
  const { context, page, errors } = await macUser(browser, request, '맥크롬');
  expect(await page.evaluate(() => window.BrowserGate.classifyBrowser({ brands: navigator.userAgentData.brands, ua: navigator.userAgent, vendor: navigator.vendor }))).toBe('chrome');
  await expect(page.locator('#plazaStage canvas.plazaCanvas')).toBeVisible({ timeout: 15000 });
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running)).toBe(true);
  expect(await page.evaluate(() => window.PlazaDebug().webgl.attempt)).toBe(0); // the preferred settings worked
  expect(await classicShown(page)).toBe(false);
  await expect(page.locator('#plazaError')).toBeHidden();
  expect(errors).toEqual([]);
  await context.close();
});

test('렌더러가 선호 설정을 거부하면 기본 설정으로 다시 만들어 아일랜드에 들어간다', async ({ browser, request }) => {
  const { context, page } = await macUser(browser, request, '맥재시도', 'picky');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 15000 }).toBe(true);
  expect(await page.evaluate(() => window.PlazaDebug().webgl.attempt)).toBe(1);
  expect(await classicShown(page)).toBe(false);
  await context.close();
});

test('WebGL이 없으면 기존 로비가 아니라 오류 화면, 원인은 진단에 남는다', async ({ browser, request }) => {
  const { context, page } = await macUser(browser, request, '맥노GL', 'none');
  await expect(page.locator('#plazaError')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#plazaError')).toContainText('게임 아일랜드를 불러오지 못했습니다.');
  await expect(page.locator('#plazaRetry')).toBeVisible();
  expect(await classicShown(page)).toBe(false); // still the island's place, not the classic lobby
  await expect(page.locator('#publicRoomsCard')).toBeHidden();
  expect(await page.evaluate(() => window.PlazaDiagnostics.code)).toBe('webgl-unavailable');
  await context.close();
});

test('렌더러 컨텍스트를 끝내 못 만들면 오류 화면, 다시 시도로 아일랜드에 들어간다', async ({ browser, request }) => {
  const { context, page } = await macUser(browser, request, '맥컨텍스트', 'refuse');
  await expect(page.locator('#plazaError')).toBeVisible({ timeout: 15000 });
  expect(await page.evaluate(() => window.PlazaDiagnostics.code)).toBe('webgl-context');
  expect(await classicShown(page)).toBe(false);
  await page.evaluate(() => { window.__gl = 'ok'; }); // the GPU is back (e.g. after closing other tabs)
  await page.locator('#plazaRetry').click();
  await expect(page.locator('#plazaStage canvas.plazaCanvas')).toBeVisible({ timeout: 15000 });
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running)).toBe(true);
  await expect(page.locator('#plazaError')).toBeHidden();
  await context.close();
});

test('아일랜드 모듈 실패 뒤 다시 시도하면 새 문서로 복구하고 로그인·당일 위치 유지', async ({ browser, request }) => {
  const { context, page } = await macUser(browser, request, '맥모듈');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 15000 }).toBe(true);
  await page.evaluate(() => window.PlazaWarp(25, 4));
  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem('gameCenterGuestSession')).token);
  await expect.poll(async () => (await request.get('/api/plaza/spot', { headers: { 'X-Session-Token': token } })).json().then(data => data.spot)).toEqual({ x: 25, z: 4 });
  await context.route('**/plaza/plaza-scene.js*', (route) => route.fulfill({ status: 500, body: 'no' }));
  await page.reload();
  await expect(page.locator('#plazaError')).toBeVisible({ timeout: 15000 });
  expect(await page.evaluate(() => window.PlazaDiagnostics.code)).toBe('module');
  expect(await classicShown(page)).toBe(false);
  await context.unroute('**/plaza/plaza-scene.js*');
  await Promise.all([page.waitForEvent('load'), page.locator('#plazaRetry').click()]);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 15000 }).toBe(true);
  const restored = await page.evaluate(() => ({ spot: window.PlazaDebug(), token: JSON.parse(sessionStorage.getItem('gameCenterGuestSession')).token }));
  expect(restored.token).toBe(token);
  expect(Math.hypot(restored.spot.x - 25, restored.spot.z - 4)).toBeLessThan(0.6);
  await expect(page.locator('#plazaError')).toBeHidden();
  await context.close();
});

test('이동 의존성 스크립트가 없는 구페이지도 현재 아일랜드 모듈로 진입', async ({ browser, request }) => {
  const { context, page, errors } = await macUser(browser, request, '구페이지이동', 'ok', true);
  expect(await page.locator('script[src*="/plaza/remote-motion.js"]').count()).toBe(0);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 15000 }).toBe(true);
  expect(await page.evaluate(() => typeof window.RemoteMotion?.createTrack)).toBe('function');
  expect(await classicShown(page)).toBe(false);
  expect(errors).toEqual([]);
  await context.close();
});
