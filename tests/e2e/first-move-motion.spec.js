const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// IDEAS 백로그 9: 방에 들어온 뒤 그 방의 첫 게임의 첫 수도 실물 모션(놓이는 돌·떨어지는 원판)으로 재생되어야 한다.
// 첫 수가 '기준선'으로만 처리되어 모션이 빠지는 것은 '빈 판을 본 적 있는가'(PieceMotionDebug)로 확인한다. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

let ipCounter = 0;
const uniqueIp = () => `100.70.${process.pid % 250}.${(++ipCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;

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

const GAMES = [
  { name: '오목', type: 'omok', roles: ['black', 'white'], move: { x: 7, y: 7 }, keyPrefix: /^omok:1:/ },
  { name: '커넥트4', type: 'connect4', roles: ['black', 'white'], move: { x: 3, y: 0 }, keyPrefix: /^c4:1:/ },
];

for (const game of GAMES) {
  test(`${game.name}: 방에 들어와 처음 두는 수도 기준선으로 삼켜지지 않고 모션이 재생된다`, async ({ browser, request }) => {
    const admin = (await api(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
    const a = await guest(browser, request, admin, '보는 사람');
    const b = await guest(browser, request, admin, '상대');
    await a.page.locator(`[data-game="${game.type}"]`).click();
    const [created] = await Promise.all([
      a.page.waitForResponse(res => res.url().endsWith('/api/rooms') && res.request().method() === 'POST'),
      a.page.locator('#createRoomBtn').click(),
    ]);
    const code = (await created.json()).state.me.roomCode;
    await expect(a.page.locator('#roomView')).toBeVisible();
    expect((await api(request, '/api/rooms/join', b.token, { code })).status).toBe(200);
    expect((await api(request, '/api/room/choose-role', a.token, { choice: game.roles[0] })).status).toBe(200);
    expect((await api(request, '/api/room/choose-role', b.token, { choice: game.roles[1] })).status).toBe(200);
    await expect.poll(async () => (await api(request, '/api/room', a.token, undefined, 'GET')).data.state.game.status).toBe('playing');

    // 빈 판도 '본 상태'로 등록되어 있어야(null이 아니라 '') 첫 수가 기준선으로 삼켜지지 않고 모션이 재생된다.
    await expect.poll(() => a.page.evaluate(() => window.PieceMotionDebug()), { message: '빈 판의 모션 기준' }).toBe('');
    expect((await api(request, '/api/room/move', a.token, game.move)).status).toBe(200);
    await expect.poll(() => a.page.evaluate(() => window.PieceMotionDebug())).toMatch(game.keyPrefix);
    await a.context.close(); await b.context.close();
  });
}
