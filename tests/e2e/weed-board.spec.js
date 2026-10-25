const { test, expect } = require('@playwright/test');
const { shopper, expectNoScriptError, spaceOn } = require('./skin-support');

// v1.10.90 잡초 게시판 (IDEAS #future-weed-board): a board by the town hall's gate opens today's pull / hand-in rankings,
// yesterday's island count and today's weeds, the week's hand-ins and last week's 제초왕. PC and phone.
test('잡초 게시판: 관공서 앞 게시판에서 순위·섬 잡초 수·제초왕 안내', async ({ browser, request }) => {
  test.setTimeout(120000);
  const who = await shopper(browser, request, '게시판', 500000, 'male');
  const { page } = who;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 30000 }).toBe(true);
  const spot = await page.evaluate(() => { const T = window.IslandTerrain; const p = T.townhallWorld(-5, T.TOWNHALL.yard.z1 + 2.5); const yaw = Math.atan2(p.x, p.z); return { x: p.x - Math.sin(yaw) * 1.6, z: p.z - Math.cos(yaw) * 1.6 }; });
  await page.evaluate(({ x, z }) => window.PlazaWarp(x, z), spot);
  await expect(page.locator('#plazaHint')).toHaveText(/잡초 게시판$/, { timeout: 10000 });
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  const card = page.locator('#weedBoardCard');
  await expect(card).toContainText('오늘 잡초');
  await expect(card).toContainText('오늘 뽑은 순위');
  await expect(card).toContainText('오늘 납품 순위');
  await expect(card).toContainText('지난주 제초왕');
  await page.locator('#plazaCloseBtn').click();
  await expectNoScriptError(page);
  await who.context.close();
});

// 6회차 7 「게시판을 읽을 수 있게 해」: the farm's sign, read before its face -- this week's field, its helpers, what to do
test('밭 안내판: 울타리 안 안내판 앞에서 SPACE로 이번 주 밭·도와준 사람·수확 안내', async ({ browser, request, isMobile }) => {
  test.setTimeout(120000);
  const who = await shopper(browser, request, isMobile ? '밭판m' : '밭판', 0, 'female'); const { page } = who;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 30000 }).toBe(true);
  const F = await page.evaluate(() => window.IslandTerrain.FARM.sign);
  await page.evaluate(([x, z]) => window.PlazaWarp(x, z - 1.2), [F.x, F.z]);
  expect(await spaceOn(page, 'farm:board', isMobile)).toBeTruthy();
  const card = page.locator('#farmBoardCard');
  await expect(card.locator('h3')).toContainText('이번 주 밭');
  await expect(card).toContainText('농부를 도와줄 때마다');
  await expectNoScriptError(page);
  await who.context.close();
});
