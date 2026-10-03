const { test, expect } = require('@playwright/test');
const { post, shopper, expectNoScriptError } = require('./skin-support');

// v1.9.4 상시 등반 도전 (PC): the window, the climb screen with its fixed HUD, keyboard play, ending on a platform
// (record + daily points), leaving without a record and resuming after a reload, the plaza gate, and two climbers
// at once (they never collide). The record height comes from the server's simulation; the test hook only places
// the climber on a platform so a test does not have to climb 300 m by hand.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');
test.describe.configure({ mode: 'default' }); // the plaza part shares one square

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
  await post(request, '/api/test/climb/place', a.token, { y: 900 });
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
  for (const who of [a, b]) await post(request, '/api/test/climb/place', who.token, { y: 120, x: 12 });
  for (const who of [a, b]) await who.page.keyboard.press('ArrowRight');
  await expect.poll(() => debug(a.page).then((d) => d.others), { timeout: 5000 }).toBe(1);
  await expect.poll(() => debug(b.page).then((d) => d.others), { timeout: 5000 }).toBe(1);
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

test('광장 등반 입구: Space와 클릭이 등반 창을 열고, 창이 열린 동안 멈췄다가 닫으면 다시 걷는다', async ({ browser, request }) => {
  test.setTimeout(60000);
  const a = await shopper(browser, request, '입구');
  const { page } = a;
  await page.locator('#lobbyModeBtn').click();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 15000 }).toBe(true);
  await page.evaluate(() => window.PlazaDebug().place('climb'));
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 등반 도전');
  await page.keyboard.press('Space');
  await expect(page.locator('#climbDialog')).toBeVisible();
  const before = await page.evaluate(() => { const d = window.PlazaDebug(); return { x: d.x, z: d.z }; });
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(300); await page.keyboard.up('ArrowLeft');
  const during = await page.evaluate(() => { const d = window.PlazaDebug(); return { x: d.x, z: d.z }; });
  expect(Math.hypot(during.x - before.x, during.z - before.z)).toBeLessThan(0.01);
  await page.keyboard.press('Escape');
  await expect(page.locator('#climbDialog')).toBeHidden();
  await page.keyboard.down('ArrowDown');
  await expect.poll(async () => { const d = await page.evaluate(() => window.PlazaDebug()); return Math.hypot(d.x - during.x, d.z - during.z); }, { timeout: 10000 }).toBeGreaterThan(0.2);
  await page.keyboard.up('ArrowDown');
  // a click on the gate does the same
  await page.evaluate(() => window.PlazaDebug().place('climb'));
  await page.waitForTimeout(300);
  const gate = await page.evaluate(() => window.PlazaDebug().screenOf('climb'));
  await page.mouse.click(gate.x, gate.y);
  await expect(page.locator('#climbDialog')).toBeVisible();
  await page.locator('#climbStartBtn').click();
  await expect(page.locator('#climbView')).toBeVisible();
  await expectNoScriptError(page);
  await a.context.close();
});
