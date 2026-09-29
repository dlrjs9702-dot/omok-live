const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.7.0 로비 포인트 내역. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

let ipCounter = 0;
function uniqueIp() {
  ipCounter += 1;
  return `100.65.${process.pid % 250}.${(ipCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;
}

async function issueGuestHtml(request, label) {
  const login = await request.post('/api/admin/login', { headers: { 'X-Forwarded-For': uniqueIp() }, data: { password: adminPassword } });
  const { sessionToken } = await login.json();
  const issued = await request.post('/api/admin/keys', { headers: { 'X-Forwarded-For': uniqueIp(), 'X-Session-Token': sessionToken }, data: { label } });
  expect(issued.status()).toBe(201);
  return (await issued.json()).html;
}

async function enterAsGuest(browser, html) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(html)]);
  await expect(page.locator('#lobbyView')).toBeVisible();
  return { context, page };
}

test.describe('로비 포인트 내역', () => {
  test('열기·신규 지급·출석 후 갱신·닫기/다시 열기, 열기만으로 /api/points 반복 조회 없음', async ({ browser, request }) => {
    const { context, page } = await enterAsGuest(browser, await issueGuestHtml(request, '내역'));
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await expect(page.locator('#pointBalanceText')).toHaveText('보유 100,000P');
    const panel = page.locator('#pointHistoryPanel');
    await expect(panel).toBeHidden();

    let pointsCalls = 0;
    let historyCalls = 0;
    page.on('request', req => {
      const url = new URL(req.url());
      if (url.pathname === '/api/points') pointsCalls += 1;
      if (url.pathname === '/api/points/history') historyCalls += 1;
    });

    await page.locator('#pointHistoryBtn').click();
    await expect(panel).toBeVisible();
    await expect(page.locator('#pointHistoryBtn')).toHaveAttribute('aria-expanded', 'true');
    const rows = page.locator('.pointHistoryRow');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('신규 계정 지급');
    await expect(rows.first()).toContainText('+100,000P');
    await expect(rows.first()).toContainText('0P → 100,000P');
    await expect(panel).not.toContainText(/initial_grant|guest:/);
    expect([historyCalls, pointsCalls]).toEqual([1, 0]);

    // 출석 → 잔액과 내역이 함께 최신화, 최신순.
    await page.locator('#attendanceBtn').click();
    await expect(page.locator('#pointBalanceText')).toHaveText('보유 150,000P');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('출석체크');
    await expect(rows.first()).toContainText('오늘');
    await expect(rows.first()).toContainText('+50,000P');
    await expect(rows.first()).toContainText('100,000P → 150,000P');
    await expect(rows.nth(1)).toContainText('신규 계정 지급');

    // 닫기 → 다시 열기: 같은 내용, 닫힌 동안에는 조회하지 않는다.
    await page.locator('#pointHistoryClose').click();
    await expect(panel).toBeHidden();
    await expect(page.locator('#pointHistoryBtn')).toHaveAttribute('aria-expanded', 'false');
    const callsWhileClosed = historyCalls;
    await page.waitForTimeout(500);
    expect(historyCalls).toBe(callsWhileClosed);
    await page.locator('#pointHistoryBtn').click();
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('출석체크');
    expect(errors).toEqual([]);
    await context.close();
  });

  test('더 보기: 30건 단위 이어 붙이기, 감소는 −로 표시(서버 응답을 흉내 낸 화면 검증)', async ({ browser, request }) => {
    const { context, page } = await enterAsGuest(browser, await issueGuestHtml(request, '더보기'));
    const item = (seq, delta, before) => ({ seq, at: new Date(Date.now() - seq * 60_000).toISOString(), delta, balanceBefore: before,
      balanceAfter: before + delta, reason: delta > 0 ? 'game_win' : 'game_loss', gameType: 'gostop', mode: seq % 2 ? 'matgo' : 'gostop', detail: null });
    const requests = [];
    await page.route('**/api/points/history*', async (route) => {
      const url = new URL(route.request().url());
      requests.push(url.search);
      const before = url.searchParams.get('before');
      const body = before
        ? { ok: true, items: [item(3, -3200, 150_000), item(2, 3200, 146_800)], hasMore: false, nextBefore: null }
        : { ok: true, items: Array.from({ length: 30 }, (_, i) => item(33 - i, i % 2 ? 3200 : -3200, 150_000)), hasMore: true, nextBefore: 4 };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.locator('#pointHistoryBtn').click();
    const rows = page.locator('.pointHistoryRow');
    await expect(rows).toHaveCount(30);
    await expect(page.locator('#pointHistoryMore')).toBeVisible();
    await expect(rows.first()).toContainText('맞고 정산');
    await expect(rows.first()).toContainText('-3,200P');
    await expect(rows.nth(1)).toContainText('+3,200P');
    await expect(rows.nth(1)).toContainText('고스톱 정산');
    await page.locator('#pointHistoryMore').click();
    await expect(rows).toHaveCount(32);
    await expect(page.locator('#pointHistoryMore')).toBeHidden();
    expect(requests).toEqual(['?limit=30', '?limit=30&before=4']);
    await context.close();
  });
});
