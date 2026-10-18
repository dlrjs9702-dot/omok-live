const { test, expect } = require('@playwright/test');

// A3 G1 게임방 공통 틀 (gamecenter-notes docs/gamehall-fix-spec-20261018.md): while a hand is played the room is one
// screen -- the room's info behind ⓘ, no empty seats, the board and the actions within the screen, the turn's clock
// round the turn seat's card for both players, and on a narrow screen the 💬·🎮 buttons in the top bar off the board.
test.skip(({ isMobile }) => isMobile, '창 크기를 직접 바꿔 PC·휴대폰 크기를 모두 본다');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';
let n = 0;
const ip = () => { n += 1; return `192.0.${(process.pid + 7) % 250}.${(n + Math.floor(Math.random() * 200)) % 250 + 1}`; };
async function api(request, route, token, body) {
  const r = await request.post(route, { headers: { ...(token ? { 'X-Session-Token': token } : {}), 'X-Forwarded-For': ip() }, data: body ?? {} });
  return { status: r.status(), data: await r.json().catch(() => ({})) };
}
async function login(page) {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': ip() });
  await page.goto('/');
  await page.locator('#adminPassword').fill(adminPassword);
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/admin/login') && r.request().method() === 'POST'),
    page.getByRole('button', { name: '관리자로 입장' }).click(),
  ]);
  await expect(page.locator('#lobbyView')).toBeVisible();
  return (await res.json()).sessionToken;
}

for (const [w, h, game] of [[1920, 1080, 'omok'], [1366, 768, 'omok'], [393, 851, 'omok'], [375, 667, 'omok'], [1366, 768, 'yut'], [375, 667, 'yut']]) {
  test(`판 진행 중 한 화면 ${w}×${h}: ${game}`, async ({ page, request }) => {
    test.setTimeout(90_000);
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: w, height: h });
    const black = await login(page);
    await page.evaluate((game) => document.querySelector(`[data-game="${game}"]`).click(), game);
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/rooms') && r.request().method() === 'POST'),
      page.locator('#createRoomBtn').click(),
    ]);
    await expect(page.locator('#roomView')).toBeVisible();
    const code = (await res.json()).state.me.roomCode;
    await expect(page.locator('.roomInfoArea')).toBeVisible(); // before the hand: as it was
    const white = (await api(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
    expect((await api(request, '/api/rooms/join', white, { code })).status).toBe(200);
    expect((await api(request, '/api/room/choose-role', black, { choice: 'black' })).status).toBe(200);
    expect((await api(request, '/api/room/choose-role', white, { choice: 'white' })).status).toBe(200);
    await expect(page.locator('body')).toHaveClass(/roomPlaying/);
    await expect(page.locator('.roomInfoArea')).toBeHidden();
    await page.locator('#roomInfoBtn').click(); await expect(page.locator('.roomInfoArea')).toBeVisible();
    await page.locator('#roomInfoBtn').click(); await expect(page.locator('.roomInfoArea')).toBeHidden();
    if (game === 'yut') { // G1-3: the throw under the board, within the screen
      await expect(page.locator('.boardCard #yutThrowBtn')).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
      const t = await page.locator('#yutThrowBtn').boundingBox(); expect(t.y + t.height).toBeLessThanOrEqual(h + 1);
      await expect(page.locator('#blackPlayer .turnRing, .teamPlayer .turnRing')).toHaveCount(1);
      expect((await api(request, '/api/room/resign', white, {})).status).toBe(200);
      await expect(page.locator('#gameInfoPanel #gameActionsPanel')).toHaveCount(1); // back in the side panel
      return;
    }
    // my clock round my card (the black seat moves first), then the other's after my move
    await expect(page.locator('#blackPlayer .turnRing b')).toHaveText(/^\d:\d\d$/);
    expect((await api(request, '/api/room/move', black, { x: 7, y: 7 })).status).toBe(200);
    await expect(page.locator('#whitePlayer .turnRing')).toBeVisible();
    await expect(page.locator('#blackPlayer .turnRing')).toHaveCount(0);
    // the board within the screen (scrolled to the top), and the floating buttons off it
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
    const box = await page.locator('#canvasWrap').boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(h + 1);
    for (const id of ['chatFloatBtn', 'gameInfoFloatBtn']) {
      const b = await page.locator(`#${id}`).boundingBox();
      if (!b) continue; // hidden on a wide screen
      const overlap = b.x < box.x + box.width && b.x + b.width > box.x && b.y < box.y + box.height && b.y + b.height > box.y;
      expect(overlap, `${id}이 판을 가림`).toBe(false);
    }
    // G1-6 빠른 말: a set word, shown a moment on the name card
    await page.locator('#quickChat button', { hasText: '좋은 수!' }).click();
    await expect(page.locator('.seatBubble')).toHaveText('좋은 수!');
    expect((await api(request, '/api/room/resign', white, {})).status).toBe(200);
    await expect(page.locator('body')).not.toHaveClass(/roomPlaying/);
    // G1-7: the result on the board with the way on
    await expect(page.locator('#boardOverlay .resultActions button', { hasText: '게임관으로' })).toBeVisible();
    await expect(page.locator('#boardOverlay .resultPoints')).toContainText('P');
    expect(errors).toEqual([]);
  });
}
