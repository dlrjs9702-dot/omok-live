const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.7.3 관리자 포인트 지급: 계정 목록의 「포인트 지급」 → 금액·사유 → 대상·금액 확인 → 지급,
// 연타해도 1회, 사용자 로비 포인트 내역에 「관리자 지급 · 사유」로 보인다. 일반 게임 참가·보상 내역도 확인. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

let ipCounter = 0;
const uniqueIp = () => `100.76.${process.pid % 250}.${(++ipCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;

async function api(request, route, token, body, method = 'POST') {
  const options = { headers: { 'X-Forwarded-For': uniqueIp(), ...(token ? { 'X-Session-Token': token } : {}) } };
  const response = method === 'GET' ? await request.get(route, options) : await request.post(route, { ...options, data: body ?? {} });
  return { status: response.status(), data: await response.json().catch(() => ({})) };
}

async function guest(browser, request, admin, label) {
  const { data } = await api(request, '/api/admin/keys', admin, { label });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(data.html)]);
  await expect(page.locator('#lobbyView')).toBeVisible();
  return { context, page, label, keyId: data.key.id, token: await page.evaluate(() => document.body.dataset.session) };
}

test('관리자 포인트 지급 대화상자 → 확인 → 1회 지급, 사용자 내역에 사유·게임 참가/보상이 보인다', async ({ page, browser, request }) => {
  test.setTimeout(90_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  await page.goto('/');
  await page.locator('#adminPassword').fill(adminPassword);
  const [login] = await Promise.all([
    page.waitForResponse(res => res.url().endsWith('/api/admin/login')),
    page.getByRole('button', { name: '관리자로 입장' }).click(),
  ]);
  const admin = (await login.json()).sessionToken;
  const target = await guest(browser, request, admin, `지급대상${Date.now() % 10000}`);
  const rival = await guest(browser, request, admin, `상대${Date.now() % 10000}`);
  await page.reload().catch(() => {});
  if (!(await page.locator('#lobbyView').isVisible())) {
    await page.locator('#adminPassword').fill(adminPassword);
    await page.getByRole('button', { name: '관리자로 입장' }).click();
  }

  const grantButton = page.getByRole('button', { name: `${target.label} 포인트 지급` });
  await expect(grantButton).toBeVisible();
  await grantButton.click();
  const dialog = page.locator('#pointGrantDialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#pointGrantTarget')).toContainText(target.label);
  // 10,000P 단위가 아니면 다음 단계로 가지 않는다.
  await page.locator('#pointGrantAmount').fill('15000');
  await page.locator('#pointGrantNextBtn').click();
  await expect(page.locator('#pointGrantError')).toContainText('10,000P 단위');
  await dialog.getByRole('button', { name: '+50,000P' }).click();
  await page.locator('#pointGrantCategory').selectOption('correction');
  await page.locator('#pointGrantNextBtn').click();
  await expect(page.locator('#pointGrantConfirm')).toHaveText(`${target.label}에게 50,000P를 지급합니다. · 사유: 운영 보정`);
  await expect(page.locator('#pointGrantNextBtn')).toHaveText('지급 확정');
  const grants = [];
  page.on('request', req => { if (req.url().includes('/points') && req.url().includes('/api/admin/keys/') && req.method() === 'POST') grants.push(req.postDataJSON().requestId); });
  await page.locator('#pointGrantNextBtn').dblclick();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#toast')).toContainText('50,000P 지급 완료');
  expect(new Set(grants).size).toBe(1);
  expect((await api(request, '/api/points', target.token, undefined, 'GET')).data.balance).toBe(150_000);

  // 일반 게임 한 판(참가 1,000P → 승리 보상 1,600P)도 같은 내역에 보인다.
  const created = await api(request, '/api/rooms', target.token, { gameType: 'othello' });
  await api(request, '/api/rooms/join', rival.token, { code: created.data.state.me.roomCode });
  await api(request, '/api/room/choose-role', target.token, { choice: 'black' });
  await api(request, '/api/room/choose-role', rival.token, { choice: 'white' });
  await api(request, '/api/room/resign', rival.token, {});
  await api(request, '/api/room', target.token, undefined, 'GET');
  await api(request, '/api/room/leave', target.token, {});
  await target.page.reload();
  await expect(target.page.locator('#lobbyView')).toBeVisible();
  await target.page.locator('#pointHistoryBtn').click();
  const rows = target.page.locator('#pointHistoryList .pointHistoryRow');
  await expect(rows.nth(0)).toContainText('오델로 승리 보상');
  await expect(rows.nth(0)).toContainText('+1,600P');
  await expect(rows.nth(1)).toContainText('오델로 참가');
  await expect(rows.nth(1)).toContainText('-1,000P');
  await expect(rows.nth(2)).toContainText('관리자 지급 · 운영 보정');
  await expect(rows.nth(2)).toContainText('+50,000P');
  await expect(rows.nth(2)).toContainText('100,000P → 150,000P');
  await target.page.locator('#pointHistoryPanel').screenshot({ path: test.info().outputPath('history.png') });
  expect(errors).toEqual([]);
  for (const view of [target, rival]) await view.context.close();
});
