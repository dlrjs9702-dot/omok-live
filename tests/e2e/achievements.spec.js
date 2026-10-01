const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.7.17 업적: 미션 창의 「업적」 탭(달성 요약, 게임별 접기 목록)과 판 종료 뒤 방 안 알림·지급.
// 한 명은 실제 브라우저(새 게스트 계정), 상대는 API로 조작한다. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

let ipCounter = 0;
const uniqueIp = () => `100.69.${process.pid % 250}.${(++ipCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;

async function api(request, route, token, body) {
  const response = await request.post(route, { headers: { 'X-Forwarded-For': uniqueIp(), ...(token ? { 'X-Session-Token': token } : {}) }, data: body ?? {} });
  return { status: response.status(), data: await response.json().catch(() => ({})) };
}

async function issueKey(request, label) {
  const admin = (await api(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
  const response = await request.post('/api/admin/keys', { headers: { 'X-Forwarded-For': uniqueIp(), 'X-Session-Token': admin }, data: { label } });
  return (await response.json());
}

// 실제 브라우저로 게스트 입장(입장 파일 HTML을 열어 로비까지).
async function guestInBrowser(browser, request, label) {
  const issued = await issueKey(request, label);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(issued.html)]);
  const token = JSON.parse(await page.evaluate(() => sessionStorage.getItem('gameCenterGuestSession'))).token;
  return { context, page, token };
}

// API만으로 게스트 세션(브라우저 없음).
async function guestByApi(request, label) {
  const issued = await issueKey(request, label);
  const key = issued.html.match(/name="token" value="([^"]+)"/)[1];
  const entry = await request.post('/guest-entry', { headers: { 'X-Forwarded-For': uniqueIp() }, form: { token: key } });
  return (await entry.text()).match(/data-session="([^"]+)"/)[1];
}

test('업적 탭: 달성 요약과 게임별 접기 목록(여러 게임 그룹은 열림), 오늘 탭으로 돌아올 수 있다', async ({ browser, request }) => {
  const { context, page } = await guestInBrowser(browser, request, '업적탭');
  await page.locator('#missionBtn').click();
  await page.getByRole('tab', { name: '업적' }).click();
  await expect(page.getByRole('tab', { name: '업적' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#missionPanelToday')).toBeHidden();
  await expect(page.locator('#achievementSummary')).toHaveText('달성 0/70 · 받은 업적 보상 0P');
  const groups = page.locator('#achievementList .achGroup');
  await expect(groups).toHaveCount(18); // 17개 게임 + 여러 게임
  await expect(groups.first()).toHaveJSProperty('open', false);
  await expect(page.locator('#achievementList .achGroup[open] summary')).toContainText('여러 게임');
  await groups.filter({ hasText: '오델로' }).locator('summary').click();
  const rows = groups.filter({ hasText: '오델로' }).locator('.missionRow');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText('오델로 첫 정상 완료');
  await expect(rows.nth(0).locator('.reward')).toHaveText('+1,000P');
  await expect(rows.nth(0).locator('.count')).toHaveText('0/1');
  await expect(rows.nth(3)).toContainText('오델로 50판 완료');

  await page.getByRole('tab', { name: '오늘' }).click();
  await expect(page.locator('#missionPanelToday')).toBeVisible();
  await expect(page.locator('#missionPanelAchievements')).toBeHidden();
  await expect(page.locator('#missionList .missionRow')).toHaveCount(4);
  await context.close();
});

test('판이 끝나면 방 안에 업적 알림이 뜨고, 업적 탭에는 달성·받은 보상이 반영된다', async ({ browser, request }) => {
  const { context, page, token } = await guestInBrowser(browser, request, '업적알림');
  expect((await api(request, '/api/test/rewards', token, {})).status).toBe(200);
  await page.locator('#gamePicker [data-game="othello"]').click();
  const [created] = await Promise.all([
    page.waitForResponse(res => res.url().endsWith('/api/rooms') && res.request().method() === 'POST'),
    page.locator('#createRoomBtn').click(),
  ]);
  const code = (await created.json()).state.me.roomCode;
  await expect(page.locator('#roomView')).toBeVisible();
  const opponent = await guestByApi(request, '업적상대');
  expect((await api(request, '/api/rooms/join', opponent, { code })).status).toBe(200);
  expect((await api(request, '/api/room/choose-role', token, { choice: 'black' })).status).toBe(200);
  expect((await api(request, '/api/room/choose-role', opponent, { choice: 'white' })).status).toBe(200);
  expect((await api(request, '/api/room/resign', opponent, {})).status).toBe(200);

  const toast = page.locator('#toast');
  await expect(toast).toContainText('업적 달성 +1,000P · 오델로 첫 정상 완료', { timeout: 12000 });
  await expect(toast).toContainText('업적 달성 +2,000P · 오델로 첫 승리', { timeout: 12000 });

  await page.locator('#leaveRoomBtn').click();
  await expect(page.locator('#lobbyView')).toBeVisible();
  await page.locator('#missionBtn').click();
  await page.getByRole('tab', { name: '업적' }).click();
  await expect(page.locator('#achievementSummary')).toHaveText('달성 2/70 · 받은 업적 보상 3,000P');
  const group = page.locator('#achievementList .achGroup').filter({ hasText: '오델로' });
  await group.locator('summary').click();
  await expect(group.locator('.missionRow.done')).toHaveCount(2);
  await expect(group.locator('.missionRow.done').first()).toContainText('✓');
  await context.close();
});
