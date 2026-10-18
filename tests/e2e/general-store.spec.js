const { test, expect } = require('@playwright/test');
const { shopper, get, expectNoScriptError } = require('./skin-support');

// v1.10.92 잡화점 (사용자 2026-10-18, IDEAS #future-general-store): in through its door, the goods standing on the shelves,
// SPACE at one opens it and buys 1·5·10 (paid and in the bag at once), out through the room's door. PC and phone.
test('잡화점: 들어가기 → 진열된 미끼 앞 SPACE → 사기 → 가방, 나가기', async ({ browser, request, isMobile }, testInfo) => {
  test.setTimeout(180000);
  const who = await shopper(browser, request, '장보기', 100000, 'female');
  const { page, token } = who;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const press = async () => { if (isMobile) await page.locator('#plazaHint').tap(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); } };
  await page.evaluate(() => window.PlazaDebug().place('store'));
  await expect(page.locator('#plazaHint')).toContainText('잡화점 들어가기', { timeout: 15000 });
  await press();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().space)).toBe('store');
  // the bait on the left shelf: stand in front of it
  await page.evaluate(() => { const S = window.IslandStore; const w = S.world(-3.4, -0.77); window.PlazaDebug().teleport(w.x, w.z); });
  await expect(page.locator('#plazaHint')).toContainText('낚시 미끼 · 300P', { timeout: 10000 });
  await page.screenshot({ path: testInfo.outputPath('store-inside.png') });
  await press();
  const card = page.locator('#goodCard');
  await expect(card).toContainText('낚시할 때 자동으로');
  const before = (await get(request, '/api/points', token)).data.balance;
  await card.getByRole('button', { name: /^5개/ }).click();
  await expect.poll(async () => ((await get(request, '/api/island/bag', token)).data.items || []).find((e) => e.itemId === 'bait')?.qty || 0).toBe(5);
  expect((await get(request, '/api/points', token)).data.balance).toBe(before - 1500);
  await page.keyboard.press('Escape');
  // seeds are shown, not sold yet
  await page.evaluate(() => { const w = window.IslandStore.world(-2.9, 2.6); window.PlazaDebug().teleport(w.x, w.z); });
  await expect(page.locator('#plazaHint')).toContainText('곧 판매', { timeout: 10000 });
  await page.evaluate(() => { const w = window.IslandStore.world(0, -3.3); window.PlazaDebug().teleport(w.x, w.z); });
  await expect(page.locator('#plazaHint')).toContainText('나가기', { timeout: 10000 });
  await press();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().space)).toBe('island');
  await expectNoScriptError(page);
  await who.context.close();
});
