const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.7.16 오늘의 미션: 로비 `미션 N/3` 버튼과 별도 창(오늘 탭만 동작), 방 안에서는 짧은 토스트만.
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

test('로비: 미션 버튼과 별도 창(오늘 탭, 미션 3개+첫 승리 보너스, 진행바·보상), 이벤트 탭은 진행 중 이벤트 목록', async ({ browser, request }) => {
  const { context, page } = await guestInBrowser(browser, request, '미션창');
  const button = page.locator('#missionBtn');
  await expect(button).toBeVisible();
  await expect(button).toHaveText('미션 0/3');

  await button.click();
  const dialog = page.locator('#missionDialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#missionTabToday')).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.getByRole('tab', { name: '이벤트' })).toBeEnabled(); // v1.8.9: lists the open events
  for (const name of ['주간', '업적']) await expect(dialog.getByRole('tab', { name })).toBeEnabled();
  const rows = page.locator('#missionList .missionRow');
  await expect(rows).toHaveCount(4); // 미션 3개 + 첫 승리 보너스
  await expect(page.locator('#missionList .missionRow[role="listitem"]')).toHaveCount(4);
  await expect(page.locator('#missionList [role="progressbar"]')).toHaveCount(3);
  for (const index of [0, 1, 2]) {
    await expect(rows.nth(index).locator('.count')).toHaveText(/^0\/\d+$/);
    await expect(rows.nth(index).locator('.reward')).toHaveText(/^\+[\d,]+P$/);
  }
  await expect(rows.nth(3)).toContainText('첫 승리 보너스');
  await expect(rows.nth(3).locator('.reward')).toHaveText('+5,000P');
  await expect(page.locator('#missionSummary')).toContainText('오늘 더 받을 수 있는 포인트');

  await page.locator('#missionCloseBtn').click();
  await expect(dialog).toBeHidden();
  await context.close();
});

test('게임방: 판이 끝나면 짧은 토스트(진행도·미션 완료·첫 승리)가 뜨고, 로비 창에서는 완료 미션이 아래로 정리된다', async ({ browser, request }) => {
  const { context, page, token } = await guestInBrowser(browser, request, '토스트');
  expect((await api(request, '/api/test/missions', token, { ids: ['play3', 'win1', 'variety2'] })).status).toBe(200);
  await page.reload(); // 새 미션 배정을 로비에서 다시 읽는다
  await expect(page.locator('#lobbyView')).toBeVisible();
  await expect(page.locator('#missionBtn')).toHaveText('미션 0/3');

  await page.locator('#gamePicker [data-game="othello"]').click();
  const [created] = await Promise.all([
    page.waitForResponse(res => res.url().endsWith('/api/rooms') && res.request().method() === 'POST'),
    page.locator('#createRoomBtn').click(),
  ]);
  const code = (await created.json()).state.me.roomCode;
  await expect(page.locator('#roomView')).toBeVisible();
  const opponent = await guestByApi(request, '상대');
  expect((await api(request, '/api/rooms/join', opponent, { code })).status).toBe(200);
  expect((await api(request, '/api/room/choose-role', token, { choice: 'black' })).status).toBe(200);
  expect((await api(request, '/api/room/choose-role', opponent, { choice: 'white' })).status).toBe(200);

  expect((await api(request, '/api/room/resign', opponent, {})).status).toBe(200); // 상대가 기권 → 내가 승리
  const toast = page.locator('#toast');
  await expect(toast).toContainText('게임 3판 1/3', { timeout: 8000 });
  await expect(toast).toContainText('미션 완료 +3,000P', { timeout: 8000 });
  await expect(toast).toContainText('첫 승리 보너스 +5,000P', { timeout: 10000 });
  await expect(page.locator('#missionBtn')).toHaveText('미션 1/3'); // 창을 열지 않아도 버튼 숫자는 갱신

  await page.locator('#leaveRoomBtn').click();
  await expect(page.locator('#lobbyView')).toBeVisible();
  await expect(page.locator('#missionBtn')).toHaveText('미션 1/3');
  await page.locator('#missionBtn').click();
  const rows = page.locator('#missionList .missionRow');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).not.toHaveClass(/done/);
  await expect(rows.nth(1)).not.toHaveClass(/done/);
  await expect(rows.nth(2)).toHaveClass(/done/); // 완료(1승)는 아래쪽
  await expect(rows.nth(2)).toContainText('오늘 1승');
  await expect(rows.nth(3)).toContainText('오늘 받았습니다');
  await expect(page.locator('#missionSummary')).toContainText('오늘 더 받을 수 있는 포인트');
  await context.close();
});

test('주간 탭: 초기화 안내, 미션 3개(20판·10승·5종)와 모두 완료 보너스, 오늘 탭으로 돌아올 수 있다', async ({ browser, request }) => {
  const { context, page } = await guestInBrowser(browser, request, '주간탭');
  await page.locator('#missionBtn').click();
  await page.getByRole('tab', { name: '주간' }).click();
  await expect(page.getByRole('tab', { name: '주간' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#missionPanelToday')).toBeHidden();
  await expect(page.locator('#weeklySummary')).toHaveText(/^\d+월 \d+일\(월\) 0시에 새로 시작 · 이번 주 더 받을 수 있는 포인트 30,000P$/);
  const rows = page.locator('#weeklyList .missionRow');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText('주간 20판 정상 완료');
  await expect(rows.nth(0).locator('.count')).toHaveText('0/20');
  await expect(rows.nth(0).locator('.reward')).toHaveText('+9,000P');
  await expect(rows.nth(1)).toContainText('주간 10승');
  await expect(rows.nth(2)).toContainText('주간 서로 다른 게임 5종 플레이');
  await expect(rows.nth(2).locator('.count')).toHaveText('0/5');
  await expect(rows.nth(3)).toContainText('주간 미션 모두 완료');
  await expect(rows.nth(3).locator('.reward')).toHaveText('+5,000P');
  await expect(rows.nth(3).locator('.count')).toHaveText('0/3');
  await expect(page.locator('#weeklyList [role="progressbar"]')).toHaveCount(4);

  await page.getByRole('tab', { name: '오늘' }).click();
  await expect(page.locator('#missionPanelToday')).toBeVisible();
  await expect(page.locator('#missionPanelWeekly')).toBeHidden();
  await context.close();
});
