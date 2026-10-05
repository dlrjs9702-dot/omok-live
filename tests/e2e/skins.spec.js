const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.7.30 스킨 상점: 로비의 「상점」 카드(내 전적 카드 아래)에서 큰 별도 창을 열고, 두 번 눌러 구매·장착하면
// 방 안의 내 돌이 그 스킨으로 그려지고 상대 화면에서도 똑같이 보인다. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

let ipCounter = 0;
const uniqueIp = () => `100.71.${process.pid % 250}.${(++ipCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;

async function post(request, route, token, data) {
  const response = await request.post(route, { headers: { 'X-Forwarded-For': uniqueIp(), ...(token ? { 'X-Session-Token': token } : {}) }, data: data ?? {} });
  return { status: response.status(), data: await response.json().catch(() => ({})) };
}

async function issue(request, label) {
  const admin = (await post(request, '/api/admin/login', null, { password: adminPassword })).data.sessionToken;
  const issued = (await post(request, '/api/admin/keys', admin, { label })).data;
  return { admin, issued };
}

async function inBrowser(browser, html) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(html)]);
  const token = JSON.parse(await page.evaluate(() => sessionStorage.getItem('gameCenterGuestSession'))).token;
  // the game opens once the resource pack is ready (like skin-support shopper): with the whole island in it (v1.10.29,
  // over 200 files) a CI runner is still preparing when the lobby is looked at
  await page.locator('#lobbyView').waitFor({ state: 'visible', timeout: 60000 });
  return { context, page, token };
}

// The colour of the pixel at the board intersection (x, y) of the omok canvas (PAD 48, 15 lines, 720px).
const pixelAt = (page, x, y) => page.evaluate(([gx, gy]) => {
  const canvas = document.getElementById('board');
  const grid = (canvas.width - 96) / 14;
  const [r, g, b] = canvas.getContext('2d').getImageData(Math.round(48 + gx * grid), Math.round(48 + gy * grid), 1, 1).data;
  return { r, g, b };
}, [x, y]);

test('스킨 상점: 로비 카드→큰 창, 잔액 부족은 구매 불가, 두 번 눌러 구매·장착, 방 안 내 돌과 상대 화면이 같은 스킨', async ({ browser, request }) => {
  const { admin, issued } = await issue(request, '구매자');
  const a = await inBrowser(browser, issued.html);
  const guest = await issue(request, '상대');
  const b = await inBrowser(browser, guest.issued.html);
  const call = (who, route, data) => post(request, route, who.token, data);

  // 진입 카드: 내 전적 카드 아래(같은 오른쪽 열)에 있다.
  const records = await a.page.locator('#myRecordsCard').boundingBox();
  const card = await a.page.locator('#skinShopCard').boundingBox();
  expect(card.y).toBeGreaterThan(records.y + records.height - 1);
  expect(Math.abs(card.x - records.x)).toBeLessThan(2);
  // v1.7.32: 제목 없이 「상점 입장」 버튼 하나, 색은 방 입장 버튼과 같은 파란색.
  await expect(a.page.locator('#skinShopCard h2')).toHaveCount(0);
  await expect(a.page.locator('#skinShopBtn')).toHaveText('상점 입장');
  const joinBlue = await a.page.locator('#joinRoomForm button[type="submit"]').evaluate(el => getComputedStyle(el).backgroundColor);
  expect(await a.page.locator('#skinShopBtn').evaluate(el => getComputedStyle(el).backgroundColor)).toBe(joinBlue);
  expect(Math.abs((await a.page.locator('#skinShopBtn').boundingBox()).width - records.width)).toBeLessThan(2); // 카드 폭 전체

  // 창은 「다른 플레이어 조회」 창보다 크다.
  await a.page.locator('#otherRecordsBtn').click();
  const lookup = await a.page.locator('#recordsDialog').boundingBox();
  await a.page.locator('#recordsCloseBtn').click();
  await a.page.locator('#skinShopBtn').click();
  const dialog = a.page.locator('#skinShopDialog');
  await expect(dialog).toBeVisible();
  expect((await dialog.boundingBox()).width).toBeGreaterThan(lookup.width * 1.5);
  await expect(dialog.locator('.skinCard')).toHaveCount(17);
  await expect(dialog.locator('.skinCard canvas')).toHaveCount(17);

  // 100,000P뿐이라 살 수 없다(버튼 비활성).
  await expect(dialog.locator('.skinCard button').first()).toBeDisabled();
  await expect(dialog.locator('.skinCard button').first()).toContainText('포인트 부족');

  // 충전 후 다시 열기: 첫 클릭은 확인만, 두 번째 클릭에서 결제.
  expect((await post(request, `/api/admin/keys/${issued.key.id}/points`, admin, { requestId: crypto.randomUUID(), category: 'event', amount: 500_000 })).status).toBe(200);
  await dialog.getByRole('button', { name: '닫기' }).click();
  await a.page.locator('#skinShopBtn').click();
  const jade = dialog.locator('.skinCard', { hasText: '비취와 백옥' });
  await expect(jade.locator('button')).toContainText('구매 500,000P');
  await jade.locator('button').click();
  await expect(jade.locator('button')).toContainText('한 번 더 누르면 500,000P 결제');
  // 확인 클릭만으로는 차감이 없다.
  await expect(dialog.locator('#skinShopBalance')).toHaveText('보유 600,000P');
  await jade.locator('button').click();
  await expect(dialog.locator('#skinShopBalance')).toHaveText('보유 100,000P');
  await expect(jade.locator('button')).toHaveText('장착');
  await jade.locator('button').click();
  await expect(jade.locator('button')).toHaveText('장착 중 · 해제');
  await dialog.getByRole('button', { name: '닫기' }).click();

  // v1.9.7 내 정보: 상점과 달리 내가 보유한 스킨만 보이고 구매 버튼은 없으며 여기서 바로 장착을 바꾼다.
  await a.page.locator('#myInfoBtn').click();
  const myInfo = a.page.locator('#myInfoDialog');
  await expect(myInfo).toBeVisible();
  await expect(myInfo.locator('.skinCard')).toHaveCount(1);
  await expect(myInfo).toContainText('비취와 백옥');
  await expect(myInfo.getByRole('button', { name: /구매/ })).toHaveCount(0);
  const ownedButton = myInfo.locator('.skinCard button').first();
  await expect(ownedButton).toHaveText('장착 중 · 해제');
  await ownedButton.click();
  await expect(ownedButton).toHaveText('장착');
  await ownedButton.click();
  await expect(ownedButton).toHaveText('장착 중 · 해제');
  await a.page.locator('#myInfoCloseBtn').click();

  // 방: 내가 흑, 상대가 백. 첫 착수 뒤 내 흑돌은 비취색(초록 기운), 상대 화면에서도 같다.
  const created = await call(a, '/api/rooms', { gameType: 'omok' });
  expect(created.status).toBe(201);
  expect((await call(b, '/api/rooms/join', { code: created.data.state.me.roomCode })).status).toBe(200);
  expect((await call(a, '/api/room/choose-role', { choice: 'black' })).status).toBe(200);
  expect((await call(b, '/api/room/choose-role', { choice: 'white' })).status).toBe(200);
  await a.page.reload();
  await b.page.reload();
  for (const who of [a, b]) await expect(who.page.locator('#roomView')).toBeVisible({ timeout: 20000 });
  const moved = await call(a, '/api/room/move', { x: 7, y: 7 });
  expect(moved.status, JSON.stringify(moved.data)).toBe(200);
  for (const who of [a, b]) {
    await expect.poll(async () => {
      const px = await pixelAt(who.page, 7, 7);
      return px.g - px.r;
    }, { timeout: 8000 }).toBeGreaterThan(20); // 기본 흑돌은 무채색(g≈r)
  }
  for (const who of [a, b]) await who.context.close();
});
