const { test, expect } = require('@playwright/test');
const { post, shopper, expectNoScriptError } = require('./skin-support');

// v1.9.4 상시 등반 도전 (PC): the window, the climb screen with its fixed HUD, keyboard play, ending on a platform
// (record + daily points), leaving without a record and resuming after a reload, and two climbers
// at once (they never collide). The record height comes from the server's simulation; the test hook only places
// the climber on a platform so a test does not have to climb 300 m by hand.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

const debug = (page) => page.evaluate(() => window.ClimbDebug());

async function startClimb(page) {
  await page.evaluate(() => document.getElementById('climbBtn').click());
  await expect(page.locator('#climbDialog')).toBeVisible();
  await page.locator('#climbStartBtn').click();
  await expect(page.locator('#climbView')).toBeVisible();
  await expect.poll(() => debug(page).then((d) => d?.running), { timeout: 10000 }).toBe(true);
}

test('등반: 창에서 시작, 키로 이동·점프, 고정 HUD, 발판에서 끝내면 기록과 일일 포인트', async ({ browser, request }) => {
  test.setTimeout(60000);
  const a = await shopper(browser, request, '등반가');
  const { page } = a;
  await startClimb(page);
  await expect(page.locator('#climbHud')).toHaveText('현재 0m');
  const start = await debug(page);
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await debug(page)).x - start.x, { timeout: 5000 }).toBeGreaterThan(1);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Space'); // a quick tap still jumps
  await expect.poll(async () => (await debug(page)).y, { timeout: 3000 }).toBeGreaterThan(0.3);
  // the HUD stays at the top of the stage whatever the camera does
  const hudBox = await page.locator('#climbHud').boundingBox(); const stageBox = await page.locator('.climbStage').boundingBox();
  expect(hudBox.y - stageBox.y).toBeLessThan(30);

  expect((await post(request, '/api/test/climb/place', a.token, { y: 300 })).status).toBe(200);
  await page.keyboard.press('ArrowLeft'); // the next answer brings the server's position
  await expect(page.locator('#climbHud')).toHaveText('현재 300m', { timeout: 5000 });
  await expect(page.locator('#climbEndBtn')).toBeEnabled();
  await page.locator('#climbEndBtn').click();
  await expect(page.locator('#climbResultTitle')).toHaveText('300m 기록');
  await expect(page.locator('#climbResultDetail')).toContainText('+1,000P');
  await page.locator('#climbLobbyBtn').click();
  await expect(page.locator('#lobbyView')).toBeVisible();
  await page.evaluate(() => document.getElementById('climbBtn').click());
  await expect(page.locator('#climbTodayBest')).toHaveText('300m');
  await expect(page.locator('#climbRanking .climbRankRow.me')).toContainText('300m');
  await expectNoScriptError(page);
  await a.context.close();
});

test('등반: 끝내지 않고 나가거나 새로고침하면 기록되지 않고, 이어서 하거나 처음부터 할 수 있다', async ({ browser, request }) => {
  test.setTimeout(60000);
  const a = await shopper(browser, request, '중단');
  const { page } = a;
  await startClimb(page);
  await post(request, '/api/test/climb/place', a.token, { y: 950 }); // the nearest real step at or below 950 m (no 100 m shelves since v1.10.4)
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#climbHud')).toHaveText(/현재 9\d\dm/, { timeout: 5000 });
  await page.locator('#climbLeaveBtn').click();
  await expect(page.locator('#lobbyView')).toBeVisible();
  await page.reload();
  await expect(page.locator('#lobbyView')).toBeVisible();
  await page.evaluate(() => document.getElementById('climbBtn').click());
  await expect(page.locator('#climbTodayBest')).toHaveText('0m'); // 900 m was never recorded
  await expect(page.locator('#climbStartBtn')).toHaveText(/이어서 도전 · 9\d\dm/);
  await page.locator('#climbRestartBtn').click();
  await expect(page.locator('#climbView')).toBeVisible();
  await expect(page.locator('#climbHud')).toHaveText('현재 0m', { timeout: 5000 });
  await expectNoScriptError(page);
  await a.context.close();
});

test('등반: 두 사람이 동시에 올라도 서로 막지 않고, 같은 자리를 함께 지난다', async ({ browser, request }) => {
  test.setTimeout(60000);
  const a = await shopper(browser, request, '하나');
  const b = await shopper(browser, request, '둘');
  await startClimb(a.page);
  await startClimb(b.page);
  for (const who of [a, b]) await post(request, '/api/test/climb/place', who.token, { y: 0, x: 12 }); // the full-width ground
  for (const who of [a, b]) await who.page.keyboard.press('ArrowRight');
  await expect.poll(() => debug(a.page).then((d) => d.others), { timeout: 5000 }).toBeGreaterThanOrEqual(1); // climbers of other tests may stand on the ground too
  await expect.poll(() => debug(b.page).then((d) => d.others), { timeout: 5000 }).toBeGreaterThanOrEqual(1);
  // both walk right through the same spot: neither is pushed or stopped by the other
  for (const who of [a, b]) await who.page.keyboard.down('ArrowRight');
  await a.page.waitForTimeout(600);
  for (const who of [a, b]) await who.page.keyboard.up('ArrowRight');
  const [da, db] = [await debug(a.page), await debug(b.page)];
  expect(Math.abs(da.x - db.x)).toBeLessThan(1.5);
  expect(da.x).toBeGreaterThan(12.5);
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});

// PR #117 리뷰(P2): 끝내기 직전 입력 전송이 실패해도 무한 재시도하지 않고 버튼을 돌려준다.
test('등반: 끝내기 직전 입력 전송이 실패하면 멈추지 않고 다시 누를 수 있다', async ({ browser, request }) => {
  test.setTimeout(60000);
  const a = await shopper(browser, request, '끊김');
  const { page } = a;
  await startClimb(page);
  let inputCalls = 0;
  await page.route('**/api/climb/input', (route) => { inputCalls += 1; return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"DOWN","message":"잠시 오류"}' }); });
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(300); await page.keyboard.up('ArrowRight'); // leaves inputs unsent
  await expect(page.locator('#climbEndBtn')).toBeEnabled({ timeout: 5000 });
  await page.locator('#climbEndBtn').click();
  await expect(page.locator('#climbStatus')).not.toHaveText('', { timeout: 5000 });
  const calls = inputCalls; await page.waitForTimeout(1000);
  expect(inputCalls - calls).toBeLessThan(15); // not a tight retry loop
  await page.unroute('**/api/climb/input');
  await page.waitForTimeout(500);
  await expect(page.locator('#climbEndBtn')).toBeEnabled({ timeout: 5000 });
  await page.locator('#climbEndBtn').click();
  await expect(page.locator('#climbResult')).toBeVisible({ timeout: 8000 }); // works again once the network is back
  await a.context.close();
});
