const { test, expect } = require('@playwright/test');
const { shopper, intoMall, expectNoScriptError, spaceOn } = require('./skin-support');

// 문제 기록 3회차 21 + 메타몽: at the 펫샵's counter SPACE opens the catalog -- each transformation small and 메타몽 -- one
// taken (named) walks with me; a transformation one is that transformation's own model at pet size. PC and phone.
test('펫샵 카운터: 변신 펫·메타몽 목록, 데려가면 그 모습 그대로 작게 따라다님', async ({ browser, request, isMobile }) => {
  test.setTimeout(240000);
  const who = await shopper(browser, request, isMobile ? '변신펫m' : '변신펫', 100000, 'male'); const { page } = who;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  await intoMall(page, null, isMobile);
  await expect.poll(async () => { if (await page.locator('#liftCard').isVisible()) return true; await page.evaluate(() => { const d = window.PlazaDebug(); const l = d.doors['lift:1']; d.teleport(l.x, l.z); }); await page.waitForTimeout(500); await spaceOn(page, 'lift:1', isMobile); await page.waitForTimeout(500); return page.locator('#liftCard').isVisible(); }, { timeout: 30000, intervals: [300] }).toBe(true);
  await page.locator('#liftCard button[data-floor="3"]').click();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().space), { timeout: 15000 }).toBe('petshop');
  // the counter: SPACE (the phone: the hint) -- the catalog
  await expect.poll(async () => {
    if (await page.locator('#petCatalog').isVisible()) return true;
    await page.evaluate(() => { const P = window.IslandPetShop; const w = P.world(P.COUNTER_KEEPER[0], P.COUNTER_KEEPER[1] - 1.6); window.PlazaDebug().teleport(w.x, w.z); });
    await page.waitForTimeout(300); await spaceOn(page, 'petshop:counter', isMobile); await page.waitForTimeout(500);
    return page.locator('#petCatalog').isVisible();
  }, { timeout: 30000, intervals: [300] }).toBe(true);
  const rows = page.locator('#petCatalog .myPetRow'); expect(await rows.count()).toBeGreaterThanOrEqual(20);
  await expect(page.locator('#petCatalog .myPetRow[data-kind="ditto"]')).toContainText('메타몽 · 캐릭터 · 12,000P');
  // one taken: a transformation small walks with me (the phone another than the PC's: one server for both)
  const kind = isMobile ? 'tf_animal-panda' : 'tf_pikachu';
  page.once('dialog', (d) => d.accept('꼬마'));
  await page.locator(`#petCatalog .myPetRow[data-kind="${kind}"] button`).click();
  await expect(page.locator('#petCatalog')).toBeHidden({ timeout: 15000 });
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().pets().find((p) => p.key === 'me')), { timeout: 15000 }).toMatchObject({ kind, name: '꼬마', tag: true });
  // walking off: it comes along (its own model, small)
  const at = await page.evaluate(() => { const d = window.PlazaDebug(); return { x: d.x, z: d.z }; });
  await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x - 3, z), [at.x, at.z]);
  await expect.poll(() => page.evaluate(() => { const d = window.PlazaDebug(); const p = d.pets().find((q) => q.key === 'me'); return Math.hypot(p.x - d.x, p.z - d.z) < 2; }), { timeout: 10000 }).toBe(true);
  if (process.env.ZZ_SHOT) await page.screenshot({ path: `${process.env.ZZ_SHOT}-${isMobile ? 'phone' : 'pc'}.png` });
  await expectNoScriptError(page);
  await who.context.close();
});
