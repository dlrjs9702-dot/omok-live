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
    // (v1.10.246 G1: out of a hand the top buttons are the HUD's round ones)
    for (const id of ['leaveRoomBtn', 'roomMenuBtn']) { const r = await page.locator(`.roomBar #${id}`).evaluate((b) => { const s = getComputedStyle(b); return { w: b.offsetWidth, h: b.offsetHeight, radius: s.borderRadius }; }); expect(r.w === 40 && r.h === 40 && r.radius === '50%', `${id} ${JSON.stringify(r)}`).toBe(true); }
    const white = (await api(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
    expect((await api(request, '/api/rooms/join', white, { code })).status).toBe(200);
    expect((await api(request, '/api/room/choose-role', black, { choice: 'black' })).status).toBe(200);
    expect((await api(request, '/api/room/choose-role', white, { choice: 'white' })).status).toBe(200);
    await expect(page.locator('body')).toHaveClass(/roomPlaying/);
    await expect(page.locator('.roomInfoArea')).toBeHidden();
    // (v1.10.244 U2: ⓘ in ☰ -- it closes ☰ and opens the room's info)
    for (const shown of [true, false]) { await page.locator('#roomMenuBtn').click(); await page.locator('#gameMenuDialog #roomInfoBtn').click(); await expect(page.locator('#gameMenuDialog')).not.toHaveAttribute('open', ''); await expect(page.locator('.roomInfoArea')).toBeVisible({ visible: shown }); }
    if (game === 'yut') { // G1-3: the throw under the board, within the screen
      await expect(page.locator('.boardCard #yutThrowBtn')).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
      const t = await page.locator('#yutThrowBtn').boundingBox(); expect(t.y + t.height).toBeLessThanOrEqual(h + 1);
      await expect(page.locator('#blackPlayer .turnRing, .teamPlayer .turnRing')).toHaveCount(1);
      // (G-틀①: the panel the sticks lived in is folded -- the throw shows over the board, then steps out of the way)
      // (G-게임별 윷: the sticks on a straw mat beside the board -- a phone's under it --, the 「최근 결과」 box folded)
      await expect(page.locator('#boardScroll > #diceYutSection')).toBeVisible(); await expect(page.locator('#yutControls')).toBeHidden();
      const [mat, wrapBox] = await Promise.all([page.locator('#diceYutSection').boundingBox(), page.locator('#canvasWrap').boundingBox()]);
      expect(w > 640 ? mat.x >= wrapBox.x + wrapBox.width - 1 : mat.y >= wrapBox.y + wrapBox.height - 1, JSON.stringify([mat, wrapBox])).toBe(true);
      await page.locator('#yutThrowBtn').click(); await expect(page.locator('#diceYutSection')).toHaveClass(/throwing/);
      await expect(page.locator('#canvasWrap .yutCall b')).toHaveText(/^(도|개|걸|윷|모|빽도)!$/, { timeout: 8000 }); // (the throw's name big on the board)
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
    // G1-6 빠른 말: a set word, shown a moment on the name card (v1.10.244 U2: in 💬, in the HUD)
    await page.locator('#roomHud #chatFloatBtn').click();
    await page.locator('#chatPanel #quickChat button', { hasText: '좋은 수!' }).click();
    await expect(page.locator('.seatBubble')).toHaveText('좋은 수!');
    expect((await api(request, '/api/room/resign', white, {})).status).toBe(200);
    await expect(page.locator('body')).not.toHaveClass(/roomPlaying/);
    if (w > 880) await expect(page.locator('#chatPanel')).toBeVisible(); // (G-틀①: the hand over, the panels back)
    await expect(page.locator('#standardPlayers #blackPlayer')).toHaveCount(1); // (G-틀②: and my card back in the row)
    await expect.poll(() => page.evaluate(() => window.RoomSound.played().at(-1))).toBe('win'); // (G-틀③: the other resigned -- my win)
    // G1-7: the result on the board with the way on
    await expect(page.locator('#boardOverlay .resultActions button', { hasText: '게임관으로' })).toBeVisible();
    await expect(page.locator('#boardOverlay .resultPoints')).toHaveText(/^\+[\d,]+P$/); // (G-틀④: one big figure, the breakdown on its title)
    // (v1.10.245 U3: the result is one panel -- its pill, three stats, no emoji card over it, both buttons 50px or more)
    await expect(page.locator('.hpPanel:visible')).toHaveCount(1); await expect(page.locator('#boardOverlay .hpPanelPill')).toHaveText('승리');
    await expect(page.locator('#boardOverlay .hpPanelNote')).toContainText('참가 포인트 정산'); /* (G1: the settlement a line in the panel, not a note over the board) */
    await expect(page.locator('#boardOverlay .hpStats > span')).toHaveCount(3); await expect(page.locator('#boardOverlay .hpStats > span').nth(1).locator('b')).toHaveText(/^\d+:\d\d$/); /* (the hand's time, seen from its start) */ await page.waitForTimeout(300); await expect(page.locator('#resultEffect')).toBeHidden();
    for (const b of await page.locator('#boardOverlay .resultActions button').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(50);
    if (process.env.SHOT_DIR) { await page.locator('#boardOverlay').scrollIntoViewIfNeeded(); await page.waitForTimeout(500); await page.screenshot({ path: `${process.env.SHOT_DIR}/u3-omok-${w}x${h}.png` });
      await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; }); await page.waitForTimeout(500); await page.screenshot({ path: `${process.env.SHOT_DIR}/u3-omok-${w}x${h}-light.png` }); await page.evaluate(() => { delete document.documentElement.dataset.theme; }); }
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

// v1.10.244 U2 HUD 한 줄 (gamecenter-notes docs/gamehall-unify-hanpan-20261104.md U2): in every room game, while a hand is
// played -- the old bar and status row hidden, one HUD, at most one name pill lit (the turn's), the board within the screen
async function guestToken(request, admin, label) { // (a guest file entered by its form, the session read off the page)
  const { data } = await api(request, '/api/admin/keys', admin, { label });
  const r = await request.post('/guest-entry', { headers: { 'X-Forwarded-For': ip() }, form: { token: /name="token" value="([^"]+)"/.exec(data.html)[1] } });
  return /data-session="([^"]+)"/.exec(await r.text())[1];
}
const SEATS2 = ['1', '2']; const BW = ['black', 'white'];
const OWN_SEATS = new Set(['gostop', 'oldmaid', 'davinci', 'pictionary', 'liar', 'twentyquestions', 'pandemic']); // (their own seat plates while a hand is played: G2·G3)
const ROOM_GAMES = [
  ['omok', BW], ['othello', BW], ['connect4', BW], ['dots', BW], ['yut', BW], ['omok2v2', ['1', '2', '3', '4']],
  ['baseball', BW, async (call) => { await call(0, '/api/room/set-secret', { secret: '123' }); await call(1, '/api/room/set-secret', { secret: '456' }); }],
  ['gostop', SEATS2, 'start-gostop'], ['oldmaid', SEATS2, 'start-oldmaid'], ['davinci', SEATS2, 'start-davinci'], ['halligalli', SEATS2, 'start-halligalli'],
  ['bingo', SEATS2, 'start-bingo'], ['pictionary', SEATS2, 'start-pictionary'], ['liar', ['1', '2', '3'], 'start-liar'],
  ['twentyquestions', SEATS2, async (call) => { await call(0, '/api/room/twenty-start', { mode: 'individual', totalRounds: 1 }); }],
  ['cityking', SEATS2, 'start-city'], ['pandemic', SEATS2, 'start-pandemic'],
];
for (const [w, h] of [[1366, 768], [393, 851]]) {
  test(`U2 HUD 한 줄 ${w}×${h}: 방 게임 ${ROOM_GAMES.length}개`, async ({ page, request }) => {
    test.setTimeout(240_000);
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: w, height: h });
    const host = (await api(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken; const seen = {}; let bannersSeen = 0;
    // (the page opens straight into each new room: the session put in the page, as the server does -- turn-alert.spec.js)
    await page.route('**/', async (route) => { if (route.request().resourceType() !== 'document') return route.continue(); const response = await route.fetch(); await route.fulfill({ response, body: (await response.text()).replace('data-session=""', `data-session="${host}"`) }); });
    for (const [game, seats, start] of ROOM_GAMES) {
      const tokens = [host]; for (let i = 1; i < seats.length; i += 1) tokens.push(await guestToken(request, host, `U2 ${game} ${i}`)); // (one point account a seat)
      const call = async (i, route, body) => { const r = await api(request, route, tokens[i], body); expect(r.status, `${game} ${route} ${JSON.stringify(r.data)}`).toBe(200); return r; };
      const created = await api(request, '/api/rooms', host, { gameType: game }); expect(created.status, game).toBe(201);
      for (let i = 1; i < seats.length; i += 1) await call(i, '/api/rooms/join', { code: created.data.state.me.roomCode });
      for (let i = 0; i < seats.length; i += 1) await call(i, '/api/room/choose-role', { choice: seats[i] });
      if (typeof start === 'string') await call(0, `/api/room/${start}`, {}); else if (start) await start(call);
      await page.goto('/'); await expect(page.locator('body'), game).toHaveClass(/roomPlaying/, { timeout: 15_000 }); await page.waitForTimeout(600);
      // (검토 #391: the banner -- 「내 차례예요」 or a system line -- never over the HUD or a name plate while it shows)
      const banner = await page.evaluate(() => { const n = document.querySelector('#boardNote'); if (!n || n.classList.contains('hidden') || !n.getBoundingClientRect().height) return null; const b = n.getBoundingClientRect();
        return [...document.querySelectorAll('#roomHud, #roomView :is(.player,.teamPlayer)')].filter((el) => el.getBoundingClientRect().height).filter((el) => { const r = el.getBoundingClientRect(); return b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top; }).map((el) => el.id || el.className).concat(b.height > 48 ? [`두 줄 ${Math.round(b.height)}px`] : []); }); /* (총괄 #396: and one line) */
      if (banner) { expect(banner, `${game} 배너가 가림`).toEqual([]); bannersSeen += 1; }
      await expect(page.locator('.roomBar'), game).toBeHidden(); await expect(page.locator('.boardCard > .statusRow'), game).toBeHidden();
      await expect(page.locator('.roomHud:visible'), game).toHaveCount(1);
      await expect(page.locator('#roomHud #roomMenuBtn'), game).toBeVisible();
      const lit = await page.locator(':is(.player,.teamPlayer).on:visible').count(); expect(lit, `${game} 켜진 이름표`).toBe(OWN_SEATS.has(game) ? 0 : 1);
      const board = await page.evaluate(() => { const b = document.querySelector('#canvasWrap'); window.scrollTo(0, 0); return b?.offsetParent && !b.classList.contains('cityBoard') ? Math.round(b.getBoundingClientRect().bottom) : null; });
      if (board !== null) expect(board, `${game} 판 아래`).toBeLessThanOrEqual(h + 1);
      seen[game] = { lit, board, hud: await page.locator('#roomHud').innerText(), plates: await page.locator('.davinciPlate.on:visible').count() };
      if (process.env.SHOT_DIR) {
        await page.screenshot({ path: `${process.env.SHOT_DIR}/u2-${game}-${w < 640 ? 'phone' : 'pc'}.png` });
        if (['omok', 'othello', 'gostop'].includes(game)) { await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; }); await page.waitForTimeout(500);
          console.log(game, 'light HUD button', await page.locator('#roomHud #chatFloatBtn').evaluate((b) => getComputedStyle(b).backgroundColor)); await page.screenshot({ path: `${process.env.SHOT_DIR}/u2-${game}-${w < 640 ? 'phone' : 'pc'}-light.png` }); await page.evaluate(() => { delete document.documentElement.dataset.theme; }); }
      }
      for (const t of tokens) await api(request, '/api/room/leave', t, {});
    }
    console.log(JSON.stringify(seen, null, 1));
    expect(bannersSeen, '배너를 본 게임 수').toBeGreaterThanOrEqual(5);
    // (검토 #391: the turn line short -- no player names, 「내 차례 · 흑」)
    expect(seen.omok.hud).toContain('내 차례 · 흑'); expect(seen.omok.hud).not.toContain('관리자님');
    expect(seen.othello.hud).toContain('2 : 2'); expect(seen.dots.hud).toContain('상자 0 : 0'); // (G1: the counts in the HUD's pill)
    expect(seen.davinci.hud).toMatch(/더미 \d+장/); expect(seen.davinci.plates).toBe(1); // (G2: 다빈치's pile in the HUD, its rack plates the turn pills -- one lit)
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
  // (v1.10.247 G2: a phone's 전송 keeps the chat box focused -- the keypad stays -- and empties it)
  await page.locator('#roomHud #chatFloatBtn').tap(); await page.locator('#chatInput').fill('키패드 그대로');
  await page.locator('#chatSendBtn').tap(); await expect(page.locator('#chatMessages')).toContainText('키패드 그대로');
  await expect.poll(() => page.evaluate(() => [document.activeElement?.id, document.getElementById('chatInput').value])).toEqual(['chatInput', '']);
  // (총괄: Enter pressed again and again while it sends -- the line goes once)
  await page.locator('#chatInput').fill('한 번만'); for (let k = 0; k < 4; k += 1) await page.locator('#chatInput').press('Enter');
  await expect(page.locator('#chatMessages .chatMessage.mine', { hasText: '한 번만' })).toHaveCount(1); await page.waitForTimeout(1200);
  await expect(page.locator('#chatMessages .chatMessage.mine', { hasText: '한 번만' })).toHaveCount(1);
  // (총괄: a phone's bar has no points line -- ☰'s top has it)
  await page.evaluate(() => document.getElementById('roomMenuBtn').click()); /* (the chat panel open over the HUD on a phone) */ await expect(page.locator('#gameMenuDialog #menuPointLine')).toHaveText(/^내 포인트 [\d,]+P$/);
  await context.close();
});
