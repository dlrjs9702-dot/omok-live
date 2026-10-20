const { test, expect } = require('@playwright/test');
const { shopper } = require('./skin-support');

// 문제 기록 9 (gamecenter-notes docs/issue-log-review-20261021.md): Q brings the camera nearer, E takes it further -- the
// wheel's step, kept the same way (gc.islandZoom). PC 전용 (the phone pinches).
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

test('Q·E 확대·축소: Q는 가까이, E는 멀리, 휠과 같은 저장', async ({ browser, request }) => {
  test.setTimeout(120000);
  const a = await shopper(browser, request, '확대축소', 0, 'male'); const { page } = a;
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); localStorage.removeItem('gc.islandZoom'); });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const zoom = () => page.evaluate(() => window.PlazaDebug().zoom);
  const start = await zoom();
  await page.locator('#plazaStage').focus();
  await page.keyboard.press('KeyQ'); await page.keyboard.press('KeyQ');
  await expect.poll(zoom).toBeLessThan(start);
  const near = await zoom();
  expect(Number(await page.evaluate(() => localStorage.getItem('gc.islandZoom')))).toBeCloseTo(near, 1);
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('KeyE');
  await expect.poll(zoom).toBeGreaterThan(start);
  await a.context.close();
});
