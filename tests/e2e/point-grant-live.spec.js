const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.7.6 관리자 지급이 접속 중인(로비에 있는) 사용자의 잔액·포인트 내역에 새로고침 없이 반영된다. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

let ipCounter = 0;
const uniqueIp = () => `100.67.${process.pid % 250}.${(++ipCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;

test('로비에 있는 사용자는 관리자 지급 즉시 잔액과 열린 포인트 내역이 갱신된다', async ({ browser, request }) => {
  const login = await request.post('/api/admin/login', { headers: { 'X-Forwarded-For': uniqueIp() }, data: { password: adminPassword } });
  const admin = (await login.json()).sessionToken;
  const issued = await (await request.post('/api/admin/keys', { headers: { 'X-Forwarded-For': uniqueIp(), 'X-Session-Token': admin }, data: { label: '수령' } })).json();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(issued.html)]);
  await expect(page.locator('#pointBalanceText')).toHaveText('보유 100,000P');
  await page.locator('#myInfoBtn').click(); // v1.9.7: 포인트 내역은 내 정보 안
  await page.locator('#pointHistoryBtn').click();
  const rows = page.locator('.pointHistoryRow');
  await expect(rows).toHaveCount(1);

  let pointsCalls = 0;
  page.on('request', req => { if (new URL(req.url()).pathname === '/api/points') pointsCalls += 1; });
  await page.waitForTimeout(500); // 로비 SSE 연결이 자리 잡은 뒤
  const granted = await request.post(`/api/admin/keys/${issued.key.id}/points`, {
    headers: { 'X-Forwarded-For': uniqueIp(), 'X-Session-Token': admin },
    data: { requestId: crypto.randomUUID(), amount: 30_000, category: 'event' },
  });
  expect(granted.status()).toBe(200);
  await expect(page.locator('#pointBalanceText')).toHaveText('보유 130,000P');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('+30,000P');
  await expect(rows.first()).toContainText('100,000P → 130,000P');
  expect(pointsCalls).toBe(1); // 이벤트 한 번에 한 번만 조회
  await context.close();
});
