const { test, expect } = require('@playwright/test');
const { shopper, intoMall, expectNoScriptError } = require('./skin-support');

// 묶음 2 가구점 (gamecenter-notes docs/furniture-shop-20261019.md): up the 백화점's lift to the 2nd floor, the day's pieces
// standing on their plinths with their prices, SPACE by one opens its window, bought it is sold for everyone (the
// 「팔렸어요」 box in its place) and in my 가구 창고, turned round in 3D. PC and phone.
test('가구점: 승강기로 2층, 진열된 가구 앞 SPACE로 사면 팔림 표시, 가구 창고에서 3D로', async ({ browser, request, isMobile }) => {
  test.setTimeout(240000);
  const who = await shopper(browser, request, '가구손님', 1000000, 'female'); const { page } = who;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const press = async () => { if (isMobile) await page.locator('#plazaHint').tap(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); } };
  await intoMall(page, null, isMobile);
  // the lift: SPACE in front of it, up
  await expect.poll(async () => { await page.evaluate(() => { const d = window.PlazaDebug(); const l = d.doors['lift:1']; d.teleport(l.x, l.z); }); await page.waitForTimeout(500); return page.locator('#plazaHint').textContent(); }, { timeout: 20000 }).toContain('승강기');
  await press(); await page.locator('#liftCard button[data-floor="2"]').click();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().space), { timeout: 15000 }).toBe('furniture');
  // the day's sixteen and the four always on sale, each on its place
  await expect.poll(() => page.evaluate(() => Object.keys(window.PlazaDebug().furniture() || {}).length), { timeout: 15000 }).toBe(20);
  // by a plinth (the living room's first, on the phone the kitchen's second): its name and price; bought, it is sold here and in the storage
  const slot = isMobile ? 'kitchen1' : 'living0'; // (one server for both runs: each its own piece)
  const W = await page.evaluate((id) => { const F = window.IslandFurniture; const s = F.SLOTS.find((x) => x.id === id); const w = F.world(s.lx, s.lz); return F.clamp(w.x, w.z); }, slot);
  await expect.poll(async () => { await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [W.x, W.z]); await page.waitForTimeout(500); return page.locator('#plazaHint').textContent(); }, { timeout: 20000 }).toMatch(/P$/);
  const label = (await page.locator('#plazaHint').textContent()).replace(/^SPACE · /, '');
  await press();
  await expect(page.locator('#furnitureCard')).toBeVisible();
  await page.locator('#furnitureCard button', { hasText: '사기' }).click();
  await expect(page.locator('#furnitureCard')).toBeHidden({ timeout: 15000 });
  await expect.poll(() => page.evaluate((id) => window.PlazaDebug().furniture()[id], slot), { timeout: 15000 }).toMatch(/:sold$/);
  await expect(page.locator('#plazaHint')).toContainText('팔렸어요');
  // 가구 창고 (the menu): the piece, in 3D
  if (isMobile) await page.locator('#gameMenuBtn').tap(); else await page.locator('#gameMenuBtn').click();
  await page.locator('#furnitureStorageBtn').click();
  await expect(page.locator('#furnitureStorage .furniturePiece')).toHaveCount(1);
  await expect(page.locator('#furnitureStorage .furniturePiece').first()).toHaveText(label.replace(/ · [\d,]+P$/, ''));
  await expect(page.locator('#furnitureStorage canvas.furnitureCanvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().tryOn?.())).not.toBe(null);
  await page.locator('#plazaCloseBtn').click();
  // down again
  await expect.poll(async () => { await page.evaluate(() => { const d = window.PlazaDebug(); const l = d.doors['lift:2']; d.teleport(l.x, l.z); }); await page.waitForTimeout(500); return page.locator('#plazaHint').textContent(); }, { timeout: 20000 }).toContain('승강기');
  await press(); await page.locator('#liftCard button[data-floor="1"]').click();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().space), { timeout: 15000 }).toBe('store');
  await expectNoScriptError(page);
  await who.context.close();
});
