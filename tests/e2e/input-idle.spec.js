const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.10.35 무입력 로그아웃 (사용자 확정 2026-10-06): a key, the mouse or a click reaches the server at most once a minute;
// 30 minutes without one ends the session for everyone -- the page goes back to the entry screen and says why. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

let ipCounter = 0;
const uniqueIp = () => `100.68.${process.pid % 250}.${(++ipCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;

test('30분 동안 입력이 없으면 로그아웃되고 첫 화면으로, 입력은 1분에 한 번만 알린다, 관리자도 같다', async ({ browser, request }) => {
  const login = await request.post('/api/admin/login', { headers: { 'X-Forwarded-For': uniqueIp() }, data: { password: adminPassword } });
  const admin = (await login.json()).sessionToken;
  const issued = await (await request.post('/api/admin/keys', { headers: { 'X-Forwarded-For': uniqueIp(), 'X-Session-Token': admin }, data: { label: '자리비움' } })).json();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(issued.html)]);
  await expect(page.locator('#lobbyView')).toBeVisible();

  let reports = 0;
  page.on('request', (req) => { if (new URL(req.url()).pathname === '/api/session/input') reports += 1; });
  await page.mouse.move(200, 200); await page.mouse.move(300, 260); await page.keyboard.press('Shift'); await page.mouse.move(320, 300);
  await expect.poll(() => reports).toBe(1); // several inputs, one report a minute
  await page.waitForTimeout(300);
  expect(reports).toBe(1);

  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem('gameCenterGuestSession')).token);
  expect((await request.post('/api/test/input-idle', { headers: { 'X-Session-Token': token }, data: {} })).status()).toBe(200);
  await expect(page.locator('#gateView')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#toast')).toContainText('30분 동안 입력이 없어 로그아웃되었습니다');
  expect((await (await request.get('/api/session', { headers: { 'X-Session-Token': token } })).json()).authenticated).toBeFalsy();

  // an admin is no exception
  expect((await request.post('/api/test/input-idle', { headers: { 'X-Session-Token': admin }, data: {} })).status()).toBe(200);
  expect((await (await request.get('/api/session', { headers: { 'X-Session-Token': admin } })).json()).authenticated).toBeFalsy();
  await context.close();
});
