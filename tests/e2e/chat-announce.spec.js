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
  // The lobby chat is shared by every test and run, so this run's lines carry their own tag and the checks look
  // only at them (another run's message may legitimately be announced in between).
  const tag = Math.random().toString(36).slice(2, 7);
  const b = await enter(browser, await issueGuest(request, `상대${tag}`));
  const say = text => request.post('/api/lobby/chat', { headers: { 'X-Forwarded-For': uniqueIp(), 'X-Session-Token': b.token }, data: { text } });
  expect((await say(`첫번째 기록 ${tag}`)).status()).toBe(200);

  // 기록이 생긴 뒤 들어온 사람: 접속 직후 스냅샷은 알리지 않는다.
  const late = await enter(browser, await issueGuest(request, `늦은사람${tag}`));
  const list = late.page.locator('#lobbyChatMessages');
  await expect(list).toContainText(`첫번째 기록 ${tag}`);
  await expect(list).not.toHaveAttribute('aria-live', /.*/);
  await expect(list).not.toHaveAttribute('role', 'log');
  const announce = late.page.locator('#lobbyChatAnnounce');
  await expect(announce).toHaveAttribute('aria-live', 'polite');
  await expect(announce).not.toContainText(`첫번째 기록 ${tag}`);

  expect((await say(`두번째 메시지 ${tag}`)).status()).toBe(200);
  await expect(announce).toHaveText(`상대${tag}: 두번째 메시지 ${tag}`);

  await late.page.locator('#lobbyChatInput').fill(`내가 보낸 말 ${tag}`);
  await late.page.locator('#lobbyChatForm button[type="submit"], #lobbyChatForm button').first().click();
  await expect(list).toContainText(`내가 보낸 말 ${tag}`);
  await late.page.waitForTimeout(500);
  await expect(announce).not.toContainText(`내가 보낸 말 ${tag}`);
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

test('닉네임이 같은 두 사람: 내 메시지만 내 것으로 표시하고 상대 메시지는 낭독하며, 발신자 묶음도 ID로 구분한다', async ({ browser, request }) => {
  const a = await enter(browser, await issueGuest(request, '똑같은이름'));
  const b = await enter(browser, await issueGuest(request, '똑같은이름'));
  const call = (view, route, data) => request.post(route, { headers: { 'X-Forwarded-For': uniqueIp(), 'X-Session-Token': view.token }, data });
  const created = await (await call(a, '/api/rooms', { gameType: 'omok' })).json();
  expect((await call(b, '/api/rooms/join', { code: created.state.me.roomCode })).status()).toBe(200);
  await a.page.reload();
  await expect(a.page.locator('#roomView')).toBeVisible();
  const announce = a.page.locator('#chatAnnounce');
  await expect(announce).toHaveText('');

  expect((await call(b, '/api/room/chat', { text: '같은 이름의 상대' })).status()).toBe(200);
  await expect(announce).toHaveText('똑같은이름: 같은 이름의 상대'); // 닉네임이 같아도 내 메시지가 아니므로 낭독된다
  await a.page.locator('#chatInput').fill('내가 보낸 말');
  await a.page.locator('#chatForm button').first().click();
  const list = a.page.locator('#chatMessages');
  await expect(list).toContainText('내가 보낸 말');
  const rows = list.locator('.chatMessage:not(.system)');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).not.toHaveClass(/mine/); // 상대(같은 닉네임)
  await expect(rows.nth(1)).toHaveClass(/mine/);
  await expect(rows.nth(1).locator('.chatMessageHead')).toHaveCount(0);
  await expect(rows.nth(0).locator('.chatMessageHead')).toHaveCount(1);

  // 같은 닉네임이 번갈아 말해도 발신자 이름 줄이 서로 다른 사람으로 다시 나온다.
  expect((await call(b, '/api/room/chat', { text: '상대 두번째' })).status()).toBe(200);
  await expect(announce).toHaveText('똑같은이름: 상대 두번째');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(2).locator('.chatMessageHead')).toHaveCount(1);
  for (const view of [a, b]) await view.context.close();
});

test('채팅 패널을 접어도 새 메시지는 낭독 영역에 들어가고, 낭독 영역은 접힌 패널과 무관하게 화면 낭독기에 노출된다(v1.7.29)', async ({ browser, request }) => {
  const a = await enter(browser, await issueGuest(request, '방장'));
  const b = await enter(browser, await issueGuest(request, '손님'));
  const call = (view, route, data) => request.post(route, { headers: { 'X-Forwarded-For': uniqueIp(), 'X-Session-Token': view.token }, data });
  const created = await (await call(a, '/api/rooms', { gameType: 'omok' })).json();
  expect((await call(b, '/api/rooms/join', { code: created.state.me.roomCode })).status()).toBe(200);
  await a.page.reload();
  await expect(a.page.locator('#roomView')).toBeVisible();
  const announce = a.page.locator('#chatAnnounce');
  expect(await announce.evaluate(el => el.closest('#chatPanel'))).toBeNull(); // 접히는 패널 밖에 있다

  await a.page.locator('#chatCollapseBtn').click();
  await expect(a.page.locator('#chatPanel')).toHaveClass(/collapsedDocked/);
  await expect(a.page.locator('#chatPanel')).toBeHidden(); // 패널은 display:none
  expect(await announce.evaluate(el => el.checkVisibility())).toBe(true); // 그래도 낭독 영역은 접근성 트리에 남는다
  expect((await call(b, '/api/room/chat', { text: '접은 상태의 메시지' })).status()).toBe(200);
  await expect(announce).toHaveText('손님: 접은 상태의 메시지');
  for (const view of [a, b]) await view.context.close();
});

test('새 채팅 메시지가 와도 이미 그려진 메시지 요소는 그대로 두고 새 것만 덧붙인다(v1.7.29)', async ({ browser, request }) => {
  const a = await enter(browser, await issueGuest(request, '방장'));
  const b = await enter(browser, await issueGuest(request, '손님'));
  const call = (view, route, data) => request.post(route, { headers: { 'X-Forwarded-For': uniqueIp(), 'X-Session-Token': view.token }, data });
  const created = await (await call(a, '/api/rooms', { gameType: 'omok' })).json();
  expect((await call(b, '/api/rooms/join', { code: created.state.me.roomCode })).status()).toBe(200);
  await a.page.reload();
  await expect(a.page.locator('#roomView')).toBeVisible();
  const list = a.page.locator('#chatMessages');
  expect((await call(b, '/api/room/chat', { text: '첫 메시지' })).status()).toBe(200);
  await expect(list).toContainText('첫 메시지');
  await list.locator('.chatMessage').first().evaluate(el => { el.dataset.drawnBefore = 'yes'; el.__mark = 'kept'; });
  const before = await list.locator('.chatMessage:not(.system)').count();

  expect((await call(b, '/api/room/chat', { text: '두번째 메시지' })).status()).toBe(200);
  await expect(list).toContainText('두번째 메시지');
  expect(await list.locator('.chatMessage:not(.system)').count()).toBe(before + 1);
  expect(await list.locator('.chatMessage').first().evaluate(el => el.__mark)).toBe('kept'); // 기존 요소가 다시 만들어지지 않았다
  await expect(list.locator('.chatMessage[data-drawn-before="yes"]')).toHaveCount(1);
  for (const view of [a, b]) await view.context.close();
});
