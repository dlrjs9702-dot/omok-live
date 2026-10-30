const { test, expect } = require('@playwright/test');
const { shopper, expectNoScriptError } = require('./skin-support');

// 사용자 제보 2026-10-26 「펫샵·가구점 점원이 계산대 뒤를 봄」: every keeper at a counter, desk or window -- the 잡화점's
// sectors, the pet shop, the 가구점, the 민원실's four windows, the warden, the island's attendance / stall / desk keepers --
// faces where its customer stands (within 30°), and its head turns from its real body yaw (home yaw). PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');
test('창구 점원: 모두 손님 서는 쪽을 본다(30° 안)', async ({ browser, request }) => {
  test.setTimeout(120000);
  const a = await shopper(browser, request, '창구손님'); const { page } = a;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running).catch(() => false), { timeout: 90000 }).toBe(true);
  const keepers = await page.evaluate(() => window.PlazaDebug().counterFacing());
  expect(keepers.map((k) => k.id)).toEqual(expect.arrayContaining(['petshop', 'furniture', 'fashion', 'store:store', 'townhall:civil', 'townhall:bank', 'jail:warden'] /* (v1.10.211 백화점 개편 A안: one counter a floor -- 2층 옷·꾸미기's too) */));
  expect(keepers.filter((k) => k.angle >= 30 || k.home > 3)).toEqual([]);
  await expectNoScriptError(page);
  await a.context.close();
});
