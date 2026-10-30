const { test, expect } = require('@playwright/test');
const { shopper, intoMall, expectNoScriptError, spaceOn } = require('./skin-support');

// 묶음 2-2 펫샵 (gamecenter-notes docs/pet-shop-20261020.md): the lift to the 3rd floor, eight pets walking in the yard, by
// one SPACE opens its window -- named and taken, it walks with me in its coat and is gone from the yard; my pets in the
// bag's 「반려동물」. PC and phone.
test('펫샵: 승강기 3층, 돌아다니는 반려동물 곁에서 SPACE → 이름 → 데려가기, 따라다님, 내 반려동물', async ({ browser, request, isMobile }) => {
  test.setTimeout(240000);
  const who = await shopper(browser, request, '펫손님', 100000, 'male'); const { page } = who;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  await intoMall(page, null, isMobile);
  // (CI 3차: the lift and the pet read and pressed at once -- the PC parts holding this spec failed 8 of 43 times on 10/20~21;
  // a pet walks off between a read prompt and a press)
  await expect.poll(async () => { if (await page.locator('#liftCard').isVisible()) return true; await page.evaluate(() => { const d = window.PlazaDebug(); const l = d.doors['lift:1']; d.teleport(l.x, l.z); }); await page.waitForTimeout(500); await spaceOn(page, 'lift:1', isMobile); await page.waitForTimeout(500); return page.locator('#liftCard').isVisible(); }, { timeout: 30000, intervals: [300] }).toBe(true);
  await page.locator('#liftCard button[data-floor="4"]').click();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().space), { timeout: 15000 }).toBe('petshop');
  await expect.poll(() => page.evaluate(() => (window.PlazaDebug().petshop() || []).length), { timeout: 15000 }).toBeGreaterThanOrEqual(7); // (8 a day; the other run on this server may have taken one)
  const before = await page.evaluate(() => window.PlazaDebug().petshop().length);
  // stand by a pet (the phone run another than the PC's: one server for both)
  const slot = isMobile ? 'pet5' : 'pet1';
  await expect.poll(async () => {
    if (await page.locator('#adoptCard').isVisible()) return true;
    await page.evaluate((slot) => { const P = window.IslandPetShop; const d = window.PlazaDebug(); const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); const q = P.petAt(day, slot, Date.now()); d.teleport(q.x + 0.5, q.z); }, slot);
    await page.waitForTimeout(300); await spaceOn(page, 'adopt:', isMobile); await page.waitForTimeout(500);
    return page.locator('#adoptCard').isVisible();
  }, { timeout: 30000, intervals: [300] }).toBe(true);
  const label = (await page.locator('#adoptCard strong').textContent()).replace(/ · [\d,]+P$/, '');
  await page.locator('#adoptCard input.adoptName').fill('몽이');
  await page.locator('#adoptCard button', { hasText: '데려가기' }).click();
  await expect(page.locator('#adoptCard')).toBeHidden({ timeout: 15000 });
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().petshop().length), { timeout: 15000 }).toBe(before - 1);
  // my pets: it, walking
  if (isMobile) await page.locator('#islandBagTab').tap(); else await page.locator('#islandBagTab').click();
  await page.locator('#myPetsBtn').click();
  await expect(page.locator('#myPets .myPetRow.walking')).toContainText(`몽이 · ${label}`);
  // 문제 기록 2회차 10: its name over it as the players', and changed here later (the nickname rule)
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().pets().find((p) => p.key === 'me')?.tag)).toBe(true);
  // (v1.10.192: asked on paper -- the face before it, 「함께 다니는 중」 on it)
  await expect(page.locator('#myPets .myPetRow.walking .petFace')).toBeVisible(); await expect(page.locator('#myPets .myPetRow.walking .walkingTag')).toHaveText('함께 다니는 중');
  const rename = async (name) => { await page.locator('#myPets .myPetRow.walking button', { hasText: '이름 바꾸기' }).click(); await expect(page.locator('#nameAskDialog')).toBeVisible(); await page.locator('#nameAskInput').fill(name); await page.locator('#nameAskOk').click(); await expect(page.locator('#nameAskDialog')).toBeHidden(); };
  await rename('bad!name');
  await expect.poll(() => page.locator('#myPets .myPetRow.walking').textContent()).toContain('몽이');
  await rename('구름이');
  await expect(page.locator('#myPets .myPetRow.walking')).toContainText(`구름이 · ${label}`);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().pets().find((p) => p.key === 'me')?.name)).toBe('구름이');
  await page.locator('#plazaCloseBtn').click();
  await expectNoScriptError(page);
  await who.context.close();
});
