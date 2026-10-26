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
    await page.evaluate(() => document.querySelector('input[name="roomStakes"][value="1"]').click()); // (G-포인트: a 내기 room -- its result shows the points)
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
      // (G-틀①: the panel the sticks lived in is folded -- the throw shows over the board, then steps out of the way)
      await page.locator('#yutThrowBtn').click(); await expect(page.locator('#diceYutSection')).toHaveClass(/throwing/);
      expect(await page.evaluate(() => window.RoomSound.played())).toContain('yut'); // (G-틀③: the sticks falling)
      const sticks = await page.locator('#diceYutSection').boundingBox(); expect(sticks.y >= 0 && sticks.y + sticks.height <= h).toBe(true);
      await expect(page.locator('#diceYutSection')).not.toHaveClass(/throwing/, { timeout: 8000 });
      expect((await api(request, '/api/room/resign', white, {})).status).toBe(200);
      await expect(page.locator('#gameInfoPanel #gameActionsPanel')).toHaveCount(1); // back in the side panel
      return;
    }
    // G-틀① 몰입 화면: the side panels folded (the board takes the screen), 기권 in ☰, a thin bar, a new system line a moment
    // over the board (someone came in to watch)
    if (w > 880) { await expect(page.locator('.gameLayout')).toHaveClass(/sideCollapsed/); await expect(page.locator('#chatPanel')).toBeHidden(); }
    await expect(page.locator('#roomPointRule')).toBeHidden(); await expect(page.locator('#resignBtn')).toBeHidden();
    await page.locator('#roomMenuBtn').click(); await expect(page.locator('#menuResignBtn')).toBeVisible(); await page.locator('#gameMenuCloseBtn').click();
    const watcher = (await api(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
    expect((await api(request, '/api/rooms/join', watcher, { code })).status).toBe(200);
    await expect(page.locator('#boardNote')).toContainText('입장');
    // G-틀② 이름표 판 둘레: my card (black) under the board, the other's above it, the name first
    await expect(page.locator('#mySeatSpot #blackPlayer')).toHaveCount(1);
    const [them, board, me] = await Promise.all(['#whitePlayer', '#canvasWrap', '#blackPlayer'].map((s) => page.locator(s).boundingBox()));
    expect(them.y + them.height <= board.y + 1 && board.y + board.height <= me.y + 1, JSON.stringify([them, board, me])).toBe(true);
    await expect(page.locator('#whitePlayer strong')).not.toHaveText('백');
    // my clock round my card (the black seat moves first), then the other's after my move
    await expect(page.locator('#blackPlayer .turnRing b')).toHaveText(/^\d:\d\d$/);
    expect((await api(request, '/api/room/move', black, { x: 7, y: 7 })).status).toBe(200);
    await expect(page.locator('#whitePlayer .turnRing')).toBeVisible();
    await expect(page.locator('#blackPlayer .turnRing')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.RoomSound.played())).toContain('stone'); // (G-틀③: the stone set down)
    // (G-틀③: ☰ 게임 효과음 off -- the other's stone is quiet; on again)
    await page.locator('#roomMenuBtn').click(); await page.locator('#roomSoundToggle').uncheck(); await page.locator('#gameMenuCloseBtn').click();
    const heard = (await page.evaluate(() => window.RoomSound.played())).length;
    expect((await api(request, '/api/room/move', white, { x: 8, y: 8 })).status).toBe(200);
    await expect(page.locator('#blackPlayer .turnRing')).toBeVisible();
    expect((await page.evaluate(() => window.RoomSound.played())).length).toBe(heard);
    await page.locator('#roomMenuBtn').click(); await page.locator('#roomSoundToggle').check(); await page.locator('#gameMenuCloseBtn').click();
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
    if (w > 880) await expect(page.locator('#chatPanel')).toBeVisible(); // (G-틀①: the hand over, the panels back)
    await expect(page.locator('#standardPlayers #blackPlayer')).toHaveCount(1); // (G-틀②: and my card back in the row)
    await expect.poll(() => page.evaluate(() => window.RoomSound.played().at(-1))).toBe('win'); // (G-틀③: the other resigned -- my win)
    // G1-7: the result on the board with the way on
    await expect(page.locator('#boardOverlay .resultActions button', { hasText: '게임관으로' })).toBeVisible();
    await expect(page.locator('#boardOverlay .resultPoints')).toHaveText(/^\+[\d,]+P$/); // (G-틀④: one big figure, the breakdown on its title)
    await expect(page.locator('#blackPlayer')).toHaveClass(/seatWinner/); await expect(page.locator('#whitePlayer')).not.toHaveClass(/seatWinner/); // (the winner crowned)
    // (G-틀④ 검토: the card's 「한 판 더」 is the one -- 다음 판 준비 hidden; pressed, it says it waits; the bar stays thin)
    await expect(page.locator('#nextRoundBtn')).toBeHidden(); await expect(page.locator('#sideNextRoundBtn')).toBeHidden(); await expect(page.locator('#roomPointRule')).toBeHidden();
    // (C4 P2-1: the ask failing -- a phone's line down, a record not saved -- the card's button is on again)
    await page.route('**/api/room/next-round', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'RECORD_FAILED', message: '잠시 뒤 다시 눌러 주세요.' }) }), { times: 1 });
    await page.locator('#boardOverlay .resultActions button', { hasText: '한 판 더' }).click();
    await expect(page.locator('#boardOverlay .resultActions button.primary')).toHaveText('한 판 더'); await expect(page.locator('#boardOverlay .resultActions button.primary')).toBeEnabled();
    await page.locator('#boardOverlay .resultActions button', { hasText: '한 판 더' }).click();
    // (pressed, it waits for the other -- or, where every hand picks its seats again, the room is straight back at the choosing)
    await expect.poll(async () => (await page.locator('#boardOverlay .resultActions button').first().textContent({ timeout: 500 }).catch(() => null))
      || (await (await request.get('/api/room', { headers: { 'X-Session-Token': white } })).json()).state?.game?.status).toMatch(/^(준비 완료 · 기다리는 중|selecting)$/);
    expect(errors).toEqual([]);
  });
}

// G3-1 오목 터치 두 번 누르기: on a touch screen the first tap only shows the stone, the second on the same point places it
test('오목 터치: 첫 탭은 미리보기, 같은 자리 두 번째 탭에 착수', async ({ browser, request }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ viewport: { width: 393, height: 851 }, hasTouch: true });
  const page = await context.newPage();
  const black = await login(page);
  await page.evaluate(() => document.querySelector('[data-game="omok"]').click());
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/rooms') && r.request().method() === 'POST'),
    page.locator('#createRoomBtn').click(),
  ]);
  const code = (await res.json()).state.me.roomCode;
  const white = (await api(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
  await api(request, '/api/rooms/join', white, { code });
  await api(request, '/api/room/choose-role', black, { choice: 'black' });
  await api(request, '/api/room/choose-role', white, { choice: 'white' });
  await expect(page.locator('body')).toHaveClass(/roomPlaying/);
  const moves = async () => (await (await request.get('/api/room', { headers: { 'X-Session-Token': black } })).json()).state.game.moveCount ?? 0;
  const board = page.locator('#board'); const box = await board.boundingBox();
  const at = { x: box.width / 2, y: box.height / 2 };
  await board.tap({ position: at }); await page.waitForTimeout(800);
  expect(await moves()).toBe(0);
  await board.tap({ position: at });
  await expect.poll(moves).toBe(1);
  await context.close();
});
