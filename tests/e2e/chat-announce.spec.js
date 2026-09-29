const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.7.2 채팅 낭독: 목록은 라이브 영역이 아니고, 숨김 상태 영역이 새 메시지만 알린다. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

let ipCounter = 0;
function uniqueIp() {
  ipCounter += 1;
  return `100.66.${process.pid % 250}.${(ipCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;
}

async function issueGuest(request, label) {
  const login = await request.post('/api/admin/login', { headers: { 'X-Forwarded-For': uniqueIp() }, data: { password: adminPassword } });
  const { sessionToken } = await login.json();
  const issued = await request.post('/api/admin/keys', { headers: { 'X-Forwarded-For': uniqueIp(), 'X-Session-Token': sessionToken }, data: { label } });
  return (await issued.json()).html;
}

async function enter(browser, html) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(html)]);
  await expect(page.locator('#lobbyView')).toBeVisible();
  const token = await page.evaluate(() => document.body.dataset.session);
  return { context, page, token };
}

test('대기방 채팅: 기록은 라이브 영역이 아니며 새 메시지 한 건만 알린다(첫 기록·내 메시지 제외)', async ({ browser, request }) => {
  const b = await enter(browser, await issueGuest(request, '상대'));
  const say = text => request.post('/api/lobby/chat', { headers: { 'X-Forwarded-For': uniqueIp(), 'X-Session-Token': b.token }, data: { text } });
  expect((await say('첫번째 기록')).status()).toBe(200);

  // 기록이 생긴 뒤 들어온 사람: 접속 직후 스냅샷은 알리지 않는다.
  const late = await enter(browser, await issueGuest(request, '늦은사람'));
  const list = late.page.locator('#lobbyChatMessages');
  await expect(list).toContainText('첫번째 기록');
  await expect(list).not.toHaveAttribute('aria-live', /.*/);
  await expect(list).not.toHaveAttribute('role', 'log');
  const announce = late.page.locator('#lobbyChatAnnounce');
  await expect(announce).toHaveAttribute('aria-live', 'polite');
  await expect(announce).toHaveText('');

  expect((await say('두번째 메시지')).status()).toBe(200);
  await expect(announce).toHaveText('상대: 두번째 메시지');
  await expect(announce).not.toContainText('첫번째 기록');

  await late.page.locator('#lobbyChatInput').fill('내가 보낸 말');
  await late.page.locator('#lobbyChatForm button[type="submit"], #lobbyChatForm button').first().click();
  await expect(list).toContainText('내가 보낸 말');
  await expect(announce).toHaveText('상대: 두번째 메시지');
  for (const view of [b, late]) await view.context.close();
});

test('방 채팅: 기록은 라이브 영역이 아니며 상대 새 메시지만 알린다', async ({ browser, request }) => {
  const a = await enter(browser, await issueGuest(request, '방장'));
  const b = await enter(browser, await issueGuest(request, '손님'));
  const call = (view, route, data) => request.post(route, { headers: { 'X-Forwarded-For': uniqueIp(), 'X-Session-Token': view.token }, data });
  const created = await (await call(a, '/api/rooms', { gameType: 'omok' })).json();
  expect((await call(b, '/api/rooms/join', { code: created.state.me.roomCode })).status()).toBe(200);
  await a.page.reload();
  await expect(a.page.locator('#roomView')).toBeVisible();
  const announce = a.page.locator('#chatAnnounce');
  await expect(a.page.locator('#chatMessages')).not.toHaveAttribute('aria-live', /.*/);
  await expect(announce).toHaveAttribute('aria-live', 'polite');
  expect((await call(b, '/api/room/chat', { text: '안녕하세요' })).status()).toBe(200);
  await expect(announce).toHaveText('손님: 안녕하세요');
  expect((await call(b, '/api/room/chat', { text: '한 번 더' })).status()).toBe(200);
  await expect(announce).toHaveText('손님: 한 번 더');
  for (const view of [a, b]) await view.context.close();
});
