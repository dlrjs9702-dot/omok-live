const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.7.8 게임 가시성: 상단에 「누가 · 무엇을」과 「방금」 한 줄, 내 차례 강조. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

let ipCounter = 0;
const uniqueIp = () => `100.78.${process.pid % 250}.${(++ipCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;

async function api(request, route, token, body, method = 'POST') {
  const options = { headers: { 'X-Forwarded-For': uniqueIp(), ...(token ? { 'X-Session-Token': token } : {}) } };
  const response = method === 'GET' ? await request.get(route, options) : await request.post(route, { ...options, data: body ?? {} });
  return { status: response.status(), data: await response.json().catch(() => ({})) };
}

async function guest(browser, request, admin, label) {
  const { data } = await api(request, '/api/admin/keys', admin, { label });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(data.html)]);
  await expect(page.locator('#lobbyView')).toBeVisible();
  return { context, page, errors, label, token: await page.evaluate(() => document.body.dataset.session) };
}

async function room(request, host, others, gameType) {
  const created = await api(request, '/api/rooms', host.token, { gameType });
  expect(created.status).toBe(201);
  const code = created.data.state.me.roomCode;
  for (const view of others) expect((await api(request, '/api/rooms/join', view.token, { code })).status).toBe(200);
  for (const view of [host, ...others]) {
    await view.page.reload();
    await expect(view.page.locator('#roomView')).toBeVisible();
  }
}

test('오목: 관전자는 누구 차례인지 이름으로, 방금 둔 사람을 한 줄로 보고, 차례인 사람은 내 차례 강조를 본다', async ({ browser, request }) => {
  test.setTimeout(90_000);
  const admin = (await api(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
  const [a, b, w] = [await guest(browser, request, admin, '흑돌이'), await guest(browser, request, admin, '백돌이'), await guest(browser, request, admin, '구경꾼')];
  await room(request, a, [b, w], 'omok');
  expect((await api(request, '/api/room/choose-role', w.token, { choice: 'spectator' })).status).toBe(200);
  expect((await api(request, '/api/room/choose-role', a.token, { choice: 'black' })).status).toBe(200);
  expect((await api(request, '/api/room/choose-role', b.token, { choice: 'white' })).status).toBe(200);

  const headline = view => view.page.locator('#statusText');
  const recent = view => view.page.locator('#recentActionLine');
  await expect(headline(w)).toContainText('흑돌이님 차례');
  await expect(recent(w)).toBeHidden();
  await expect(headline(a)).toHaveText(/^내 차례 · .*흑돌이님\(나\) 차례/);
  await expect(headline(a)).toHaveClass(/selfActHeadline/);
  await expect(headline(b)).not.toHaveClass(/selfActHeadline/);

  expect((await api(request, '/api/room/move', a.token, { x: 7, y: 7 })).status).toBe(200);
  await expect(headline(w)).toContainText('백돌이님 차례');
  await expect(recent(w)).toHaveText('방금흑돌이님이 돌을 놓았습니다');
  await expect(headline(b)).toHaveClass(/selfActHeadline/);
  await expect(headline(a)).not.toHaveClass(/selfActHeadline/);
  await expect(recent(a)).toHaveText('방금흑돌이님(나)이 돌을 놓았습니다');

  for (const view of [a, b, w]) expect(view.errors).toEqual([]);
  await Promise.all([a, b, w].map(view => view.context.close()));
});

test('스무고개: 단계는 한글로, 행동하는 사람 이름과 함께 보인다', async ({ browser, request }) => {
  test.setTimeout(90_000);
  const admin = (await api(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
  const [a, b] = [await guest(browser, request, admin, '출제자'), await guest(browser, request, admin, '도전자')];
  await room(request, a, [b], 'twentyquestions');
  expect((await api(request, '/api/room/choose-role', a.token, { choice: '1' })).status).toBe(200);
  expect((await api(request, '/api/room/choose-role', b.token, { choice: '2' })).status).toBe(200);
  expect((await api(request, '/api/room/twenty-start', a.token, { mode: 'individual', totalRounds: 1 })).status).toBe(200);
  const state = (await api(request, '/api/room', a.token, undefined, 'GET')).data.state;
  const [drawer, challenger] = state.game.drawerSeat === '1' ? [a, b] : [b, a];
  await expect(challenger.page.locator('#statusText')).toContainText(`${drawer.label}님 정답 정하는 중`);
  await expect(challenger.page.locator('#statusText')).not.toContainText('secret');
  expect((await api(request, '/api/room/twenty-secret', drawer.token, { secret: '사과' })).status).toBe(200);
  await expect(drawer.page.locator('#statusText')).toContainText(`${challenger.label}님 질문 차례`);
  await expect(challenger.page.locator('#statusText')).toHaveText(/^내 차례 · /);
  await expect(drawer.page.locator('#recentActionLine')).toContainText('정답을 설정');
  await expect(drawer.page.locator('#statusText')).not.toContainText('asking');

  for (const view of [a, b]) expect(view.errors).toEqual([]);
  await Promise.all([a, b].map(view => view.context.close()));
});
