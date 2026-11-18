const { test, expect } = require('@playwright/test');
const { shopper, get, post, expectNoScriptError } = require('./skin-support');

// A4 밤하늘 별똥별 (IDEAS 「함께하는 섬」): at a moment the server decides (the same for everyone) a star falls over the
// island; while it falls 「소원 빌기」 shows -- one wish a star -- and the next day the first look at the island brings a
// small gift (until the 우체통). The test moves the stars' clock (/api/test/island/star-now). PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

test('별똥별: 떨어지는 동안 소원 빌기 한 번, 다음 날 섬에 오면 별 조각', async ({ browser, request }) => {
  test.setTimeout(120000);
  const who = await shopper(browser, request, '소원', 100000, 'female');
  const { page, token } = who;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic'));
  const star = (await post(request, '/api/test/island/star-now', token, { plusMs: -20000 })).data.id; // (it falls in about 20 s: the page is up by then)
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 30000 }).toBe(true);
  const btn = page.locator('#starWishBtn');
  await expect(btn).toBeVisible({ timeout: 40000 });
  await expect(page.locator('#plazaStar')).toHaveClass(/fall/);
  await btn.click();
  await expect(page.locator('#toast')).toContainText('소원을 빌었어요');
  expect((await post(request, '/api/island/stars/wish', token, { id: star })).data.already).toBe(true); // one wish a star
  expect((await post(request, '/api/island/stars/wish', token, { id: 'star_1' })).status).toBe(409); // not falling now
  const before = (await get(request, '/api/points', token)).data.balance;
  await post(request, '/api/test/island/star-now', token, { plusMs: 86400000 }); // the next day
  /* (1.10.365 별 조각, notes star-wish-20261118: a wish made from this version on brings a star fragment -- now and then the shiny
     one -- not 300P (that only for a wish before it: unit star-fragments.test)) */
  const first = (await get(request, '/api/island/stars', token)).data; expect(first.gift).toBe(0); expect(first.fragments).toHaveLength(1); expect(first.fragments[0].n).toBe(1);
  expect((await get(request, '/api/island/stars', token)).data.fragments).toEqual([]); // once
  const bag = (await get(request, '/api/island/bag', token)).data.items || []; expect(bag.filter((e) => /^star_fragment/.test(e.itemId)).reduce((n, e) => n + e.qty, 0)).toBe(1);
  expect((await get(request, '/api/points', token)).data.balance).toBe(before);
  await post(request, '/api/test/island/star-now', token, { reset: true }); // (the real clock again for later tests)
  await expectNoScriptError(page);
  await who.context.close();
});
