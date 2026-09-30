const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// IDEAS 백로그 8: 종료 액션을 직접 하지 않은 참가자의 화면도 참가비·정산 결과를 새로고침 없이 바로 반영한다(일반 게임).
// 오목 2인: 시작하면 1,000P씩 차감, 한쪽이 기권하면 참가비 총액의 80%가 승자에게. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

let ipCounter = 0;
const uniqueIp = () => `100.69.${process.pid % 250}.${(++ipCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;

async function api(request, route, token, body, method = 'POST') {
  const options = { headers: { 'X-Forwarded-For': uniqueIp(), ...(token ? { 'X-Session-Token': token } : {}) } };
  const response = method === 'GET' ? await request.get(route, options) : await request.post(route, { ...options, data: body ?? {} });
  return { status: response.status(), data: await response.json().catch(() => ({})) };
}

async function guest(browser, request, admin, label) {
  const { data } = await api(request, '/api/admin/keys', admin, { label });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(data.html)]);
  await expect(page.locator('#lobbyView')).toBeVisible();
  return { context, page, token: await page.evaluate(() => document.body.dataset.session) };
}

test('상대가 기권해 판이 끝나면, 직접 조작하지 않은 사람의 참가비 차감과 승리 정산이 새로고침 없이 반영된다', async ({ browser, request }) => {
  const admin = (await api(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
  const a = await guest(browser, request, admin, '보는 사람');
  const b = await guest(browser, request, admin, '기권하는 사람');
  const balance = async view => (await api(request, '/api/points', view.token, undefined, 'GET')).data.balance;
  const start = await balance(a);

  await a.page.locator('[data-game="omok"]').click();
  const [created] = await Promise.all([
    a.page.waitForResponse(res => res.url().endsWith('/api/rooms') && res.request().method() === 'POST'),
    a.page.locator('#createRoomBtn').click(),
  ]);
  const code = (await created.json()).state.me.roomCode;
  await expect(a.page.locator('#roomView')).toBeVisible();
  await expect(a.page.locator('#roomPointBadge')).toHaveText(`내 포인트 ${start.toLocaleString('ko-KR')}P`);

  // b는 API로만 움직인다(a의 화면은 아무것도 하지 않는다).
  expect((await api(request, '/api/rooms/join', b.token, { code })).status).toBe(200);
  expect((await api(request, '/api/room/choose-role', a.token, { choice: 'black' })).status).toBe(200);
  expect((await api(request, '/api/room/choose-role', b.token, { choice: 'white' })).status).toBe(200);
  // 시작: 참가비 1,000P 차감이 a의 화면에 바로 나타난다.
  await expect(a.page.locator('#roomPointBadge')).toHaveText(`내 포인트 ${(start - 1000).toLocaleString('ko-KR')}P`);

  expect((await api(request, '/api/room/resign', b.token, {})).status).toBe(200);
  // 승자 a: 참가비 총액 2,000P의 80%(1,600P)를 새로고침 없이 받는다.
  await expect(a.page.locator('#roomPointBadge')).toHaveText(`내 포인트 ${(start - 1000 + 1600).toLocaleString('ko-KR')}P`);
  expect(await balance(a)).toBe(start - 1000 + 1600);
  expect(await balance(b)).toBe(start - 1000);
  await a.context.close(); await b.context.close();
});
