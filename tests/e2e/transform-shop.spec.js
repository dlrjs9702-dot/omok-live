const { test, expect } = require('@playwright/test');
const { shopper, get, expectNoScriptError } = require('./skin-support');

// v1.10.91 변신 의상실 (사용자 2026-10-18, IDEAS #future-transform-npc A안): the transformation is bought and chosen at
// its own place on the island, apart from the parts; choosing it turns me, 변신 풀기 turns me back. PC and phone.
test('변신 의상실: 사기(확인창) → 변신하기 → 변신 풀기', async ({ browser, request, isMobile }) => {
  test.setTimeout(180000);
  const who = await shopper(browser, request, '변신손님', 1000000, 'male');
  const { page, token } = who;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  await page.evaluate(() => window.PlazaDebug().place('transform'));
  await expect(page.locator('#plazaHint')).toContainText('변신 의상실', { timeout: 15000 });
  if (isMobile) await page.locator('#plazaHint').tap(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); }
  const shop = page.locator('#transformShop');
  await expect(shop.locator('.tfRow')).toHaveCount(22);
  const cat = shop.locator('.tfRow[data-character="animal-cat"]');
  await expect(cat).toContainText('350,000P');
  const before = (await get(request, '/api/points', token)).data.balance;
  page.once('dialog', (d) => d.accept());
  await cat.getByRole('button', { name: '사기' }).click();
  await expect(cat.getByRole('button', { name: '변신하기' })).toBeVisible();
  expect((await get(request, '/api/points', token)).data.balance).toBe(before - 350000);
  await cat.getByRole('button', { name: '변신하기' }).click();
  await expect(cat).toContainText('변신 중');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().transformation), { timeout: 60000 }).toBe('animal-cat');
  await cat.getByRole('button', { name: '변신 풀기' }).click();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().transformation), { timeout: 30000 }).toBe(null);
  await expectNoScriptError(page);
  await who.context.close();
});
