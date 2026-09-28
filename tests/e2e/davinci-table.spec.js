const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.6.96 다빈치 코드 테이블: three real guests in separate browser contexts. PC only.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

let ipCounter = 0;
const uniqueIp = () => `100.73.${process.pid % 250}.${(++ipCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;

async function api(request, route, token, body, method = 'POST') {
  const options = { headers: { 'X-Forwarded-For': uniqueIp(), ...(token ? { 'X-Session-Token': token } : {}) } };
  const response = method === 'GET' ? await request.get(route, options) : await request.post(route, { ...options, data: body ?? {} });
  return { status: response.status(), data: await response.json().catch(() => ({})) };
}

async function guest(browser, request, admin, label) {
  const { data } = await api(request, '/api/admin/keys', admin, { label });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(data.html)]);
  await expect(page.locator('#lobbyView')).toBeVisible();
  return { context, page, errors, label, token: await page.evaluate(() => document.body.dataset.session) };
}

const roomState = async (request, token) => (await api(request, '/api/room', token, undefined, 'GET')).data.state;

test('다빈치 코드 테이블: 내 자리 아래·상대 둘러앉음·더미와 뽑은 타일·숫자판 추측·틀린 숫자 메모·비공개 유지', async ({ browser, request }, testInfo) => {
  test.setTimeout(120_000);
  const admin = (await api(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
  const views = [];
  for (const label of ['건', '지희', '민수']) views.push(await guest(browser, request, admin, label));
  const [a, b, c] = views;
  await a.page.locator('[data-game="davinci"]').click();
  const [created] = await Promise.all([
    a.page.waitForResponse(res => res.url().endsWith('/api/rooms') && res.request().method() === 'POST'),
    a.page.locator('#createRoomBtn').click(),
  ]);
  const code = (await created.json()).state.me.roomCode;
  for (const view of [b, c]) {
    await view.page.locator('#roomPasswordInput').fill(code);
    await view.page.locator('#roomPasswordInput').press('Enter');
    await expect(view.page.locator('#davinciPanel')).toBeVisible();
  }
  for (const [i, view] of views.entries()) await view.page.locator(`#teamRoleButtons [data-team-seat="${i + 1}"]`).click();
  await a.page.locator('#davinciStartBtn').click();
  await expect.poll(async () => (await roomState(request, a.token)).game.status).toBe('playing');

  // Seating: each player sees their own rack at the bottom and the other two at the sides.
  for (const [i, view] of views.entries()) {
    await expect(view.page.locator('#davinciHands.davinciTable .davinciHand.pos-bottom')).toHaveAttribute('data-owner', String(i + 1));
    await expect(view.page.locator('#davinciHands .davinciHand.pos-left')).toHaveCount(1);
    await expect(view.page.locator('#davinciHands .davinciHand.pos-right')).toHaveCount(1);
  }
  // Privacy: nobody's page carries another player's hidden numbers.
  const privateOf = {};
  for (const [i, view] of views.entries()) privateOf[i + 1] = (await roomState(request, view.token)).me.myDavinciTiles;
  for (const [i, view] of views.entries()) {
    for (const owner of Object.keys(privateOf)) {
      if (Number(owner) === i + 1) continue;
      const shown = await view.page.locator(`#davinciHands .davinciHand[data-owner="${owner}"] .davinciTile .davinciTileValue`).allTextContents();
      expect(shown.every(text => text === '?'), `${view.label}에게 ${owner}번 숫자 노출`).toBe(true);
    }
  }

  // Center: the draw pile count and this turn's drawn tile (number only for the drawer).
  let state = await roomState(request, a.token);
  const turn = state.game.turn;
  const actor = views[Number(turn) - 1];
  const others = views.filter(view => view !== actor);
  for (const view of views) await expect(view.page.locator('.davinciPileCount')).toHaveText(`더미 ${state.game.pileCount}장`);
  const drawn = (await roomState(request, actor.token)).me.myDavinciDrawn;
  await expect(actor.page.locator('.davinciDrawnSlot .davinciTileValue')).toHaveText(String(drawn.number));
  for (const view of others) {
    await expect(view.page.locator(`.davinciDrawnSlot .davinciTile.${drawn.color}`)).toHaveCount(1);
    await expect(view.page.locator('.davinciDrawnSlot .davinciTileValue')).toHaveText('?');
  }
  await actor.page.locator('#davinciPanel').screenshot({ path: testInfo.outputPath('01-table.png') });

  // Guess by clicking a tile and a number. First Esc closes the pad, then a deliberate wrong guess.
  const target = others[0];
  const targetSeat = String(views.indexOf(target) + 1);
  const targetTiles = (await roomState(request, target.token)).me.myDavinciTiles;
  const hidden = targetTiles.find(tile => !tile.revealed);
  await actor.page.locator(`#davinciHands .davinciHand[data-owner="${targetSeat}"] .davinciTile[data-tile-id="${hidden.id}"]`).click();
  await expect(actor.page.locator('.davinciPicker')).toBeVisible();
  for (const view of others) await expect(view.page.locator('.davinciPicker')).toHaveCount(0);
  // Numbers of the same colour I can already see are dimmed (my own tiles, my drawn tile).
  const myTiles = (await roomState(request, actor.token)).me.myDavinciTiles;
  for (const tile of [...myTiles, drawn].filter(t => t.color === hidden.color)) {
    await expect(actor.page.locator('.davinciPickNumber').nth(tile.number)).toHaveClass(/unlikely/);
  }
  await actor.page.screenshot({ path: testInfo.outputPath('02-picker.png') });
  await actor.page.keyboard.press('Escape');
  await expect(actor.page.locator('.davinciPicker')).toHaveCount(0);
  // Choosing another hidden tile opens the pad again.
  const other = targetTiles.find(tile => !tile.revealed && tile.id !== hidden.id);
  await actor.page.locator(`#davinciHands .davinciHand[data-owner="${targetSeat}"] .davinciTile[data-tile-id="${other.id}"]`).click();
  await expect(actor.page.locator('.davinciPicker')).toBeVisible();
  const wrong = [...Array(12).keys()].find(n => n !== other.number);
  const historyBefore = (await roomState(request, a.token)).game.history.length;
  await actor.page.locator('.davinciPickNumber').nth(wrong).click();
  await expect.poll(async () => (await roomState(request, a.token)).game.history.length).toBe(historyBefore + 1);
  state = await roomState(request, a.token);
  expect(state.game.history.at(-1)).toMatchObject({ seat: turn, target: targetSeat, id: other.id, number: wrong, correct: false });
  // Everyone's table now remembers the wrong number on that tile.
  for (const view of views) {
    await expect(view.page.locator(`#davinciHands .davinciTile[data-tile-id="${other.id}"] .davinciMemo`)).toContainText(`✗${wrong}`);
  }
  // A wrong guess reveals the drawn tile into the guesser's rack for everyone to see.
  for (const view of views) await expect(view.page.locator(`#davinciHands .davinciHand[data-owner="${turn}"] .davinciTile.revealed`)).toHaveCount(1);
  await b.page.locator('#davinciPanel').screenshot({ path: testInfo.outputPath('03-memo.png') });
  expect([...a.errors, ...b.errors, ...c.errors]).toEqual([]);
  for (const view of views) await view.context.close();
});
