const { test, expect } = require('@playwright/test');
const { shopper, post, expectNoScriptError } = require('./skin-support');

// 1.10.392 N4-b 「택시 부르기」 (notes docs/n4-plan-20261120.md §5-2, 결정 40 A · 41-3 A): at 배 타는 곳's road stop -- its sign there (assets 163),
// SPACE: no car, 「택시 부르기」; called, the nearest car comes empty and stands at the curb; SPACE again: 「어디로 갈까요?」 every place with its
// fare by the road (500P the least). The ride itself: unit island-taxi-call. PC 전용 (the phone: the same window).
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');
test('택시 정류장: 표지 → 택시 부르기 → 빈 차가 와서 섬 → 어디로 갈까요(정류장·종점, 거리 요금)', async ({ browser, request }) => {
  test.setTimeout(180000);
  const a = await shopper(browser, request, '정류장손님', 0, 'female'); const { page, token } = a;
  expect((await post(request, '/api/test/taxi-run', token, { ms: 3000 })).status).toBe(200);
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const X = require('../../public/plaza/island-taxi.js'); const board = X.boardOf('dock');
  await expect.poll(() => page.evaluate(() => (window.PlazaDebug().taxiRoadSigns?.() || []).length), { timeout: 20000 }).toBe(Object.keys(X.ROADSTOPS).length);
  await expect.poll(async () => { await page.evaluate(([x, z]) => window.PlazaWarp(x, z), [board.x, board.z]); await page.waitForTimeout(400); return page.locator('#plazaHint').textContent(); }, { timeout: 30000 }).toContain('배 타는 곳');
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  const dialog = page.locator('#plazaDialog'); await expect(dialog.locator('#taxiCallBtn')).toBeVisible({ timeout: 15000 });
  await dialog.locator('#taxiCallBtn').click(); await expect(dialog.locator('.taxiStatus')).toContainText('택시 오는 중', { timeout: 10000 });
  await dialog.locator('#taxiCloseBtn').click(); await expect(dialog).toBeHidden();
  // the car at the curb
  await expect.poll(() => page.evaluate(([x, z]) => (window.PlazaDebug().taxiParked?.() || []).some((c) => Math.hypot(c.x - x, c.z - z) < 1), [X.curbOf('dock').x, X.curbOf('dock').z]), { timeout: 30000 }).toBe(true);
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect(dialog.locator('.taxiDest')).toHaveCount(X.PLACE_IDS().length - 1, { timeout: 15000 });
  await expect(dialog.locator('#taxiDest-museum')).toContainText(`${X.fareByRoad('dock', 'museum').toLocaleString('ko-KR')}P`);
  await dialog.locator('#taxiDest-museum').click(); await expect(dialog.locator('.taxiLine')).toHaveText('박물관·잔치마루까지 갈까요?'); await expect(dialog.locator('#taxiRideBtn')).toHaveText('한 번 타기 · 500P');
  await dialog.locator('#taxiCloseBtn').click();
  await expectNoScriptError(page); await a.context.close();
});
