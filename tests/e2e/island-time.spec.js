const { test, expect } = require('@playwright/test');
const { shopper, adminToken, expectNoScriptError } = require('./skin-support');

// v1.10.90 섬 시간대 (IDEAS #future-admin-console ①): the administrator holds the island at a time of day and everyone's
// island follows at once; Halloween's decorations stay with October (only its purple tints the night). PC 전용 (the
// same scene on a phone).
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

test('섬 시간대: 관리자가 밤·낮으로 정하면 섬이 바로 따라 바뀌고, 자동으로 되돌림', async ({ browser, request }) => {
  test.setTimeout(120000);
  const who = await shopper(browser, request, '시간대', 500000, 'male');
  const { page } = who;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 30000 }).toBe(true);
  const admin = await adminToken(request);
  const set = (mode) => request.post('/api/admin/island/time', { headers: { 'X-Session-Token': admin }, data: { mode } });
  expect((await request.post('/api/admin/island/time', { data: { mode: 'night' } })).status()).toBe(401); // the administrator only
  try {
    expect((await set('night')).status()).toBe(200);
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().time().phase), { timeout: 15000 }).toBe('night');
    expect(await page.evaluate(() => window.PlazaDebug().halloween.on())).toBe(true);
    expect((await set('day')).status()).toBe(200);
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().time().phase), { timeout: 15000 }).toBe('day');
    expect(await page.evaluate(() => [window.PlazaDebug().halloween.on(), window.PlazaDebug().halloween.background()])).toEqual([false, 0xbfe6ff]);
    expect((await set('evening')).status()).toBe(200);
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().halloween.background()), { timeout: 15000 }).toBe(0xf29a73);
  } finally { await set('auto'); }
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().time().mode), { timeout: 15000 }).toBe('auto');
  await expectNoScriptError(page);
  await who.context.close();
});
