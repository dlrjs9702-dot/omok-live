const { test, expect } = require('@playwright/test');
const { shopper, intoMall, liftTo, expectNoScriptError } = require('./skin-support');

// v1.10.211 백화점 개편 A안 (gamecenter-notes docs/mall-revamp-20261027.md, assets 82): the lift to all four floors -- 1
// 잡화·생활, 2 옷·꾸미기, 3 가구, 4 옥상 펫샵 -- each floor's counter keeper, the 2nd floor's 꾸미기 mirror (sat: hair, colour,
// face in one window), the game skins in the game hall's 「스킨」 tab; the first person in the floors under their ceilings,
// the roof under the sky. PC and phone.
test('백화점 4층: 승강기 네 층, 층마다 계산대, 2층 거울 앉으면 꾸미기 창, 게임관 스킨 탭, 1인칭 천장', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.CI ? 360000 : 240000);
  const who = await shopper(browser, request, isMobile ? '네층m' : '네층', 200000, 'female'); const { page } = who;
  await page.evaluate((shots) => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); localStorage.setItem('gc.view.in', 'third'); if (!shots) localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }, Boolean(process.env.SHOT_DIR));
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const shot = async (name) => { if (process.env.SHOT_DIR) { await page.waitForTimeout(1500); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-mall-${name}.png` }); } };
  const look = (R, lx, lz, yaw = 0) => page.evaluate(([R, lx, lz, yaw]) => { const w = window[R].world(lx, lz); const d = window.PlazaDebug(); d.teleport(w.x, w.z); d.setCamYaw(yaw); }, [R, lx, lz, yaw]);
  const first = async (on) => { if ((await page.evaluate(() => window.PlazaDebug().view().mode)) === (on ? 'first' : 'third')) return; if (isMobile) await page.locator('#islandViewTab').click(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('KeyV'); } await expect.poll(() => page.evaluate(() => window.PlazaDebug().view().mode)).toBe(on ? 'first' : 'third'); };
  await intoMall(page, null, isMobile);
  // each floor: its lift's hint names it, its keeper behind its counter
  const hint = page.locator('#plazaHint');
  for (const [n, R, space, name] of [[1, 'IslandStore', 'store', '잡화·생활'], [2, 'IslandFashion', 'fashion', '옷·꾸미기'], [3, 'IslandFurniture', 'furniture', '가구'], [4, 'IslandPetShop', 'petshop', '옥상 펫샵']]) {
    await liftTo(page, n, isMobile); expect(await page.evaluate(() => window.PlazaDebug().space)).toBe(space);
    await page.evaluate((n) => { const d = window.PlazaDebug(); const l = d.doors[`lift:${n}`]; d.teleport(l.x, l.z); }, n);
    await expect(hint).toContainText(`${n}층 ${name}`);
    await look(R, 0, -6.5); await shot(`f${n}`);
    if (n !== 4) { await first(true); await page.evaluate(() => window.PlazaDebug().setCamPitch?.(0.12)); await shot(`f${n}-first`); expect((await page.evaluate(() => window.PlazaDebug().view())).mode).toBe('first'); await first(false); }
  }
  // the 2nd floor's mirror: sat, the 꾸미기 window -- hair, colour and face
  await liftTo(page, 2, isMobile);
  const sit = await intoMall(page, 'hair', isMobile); // (the mirror's chair's prompt)
  await expect(hint).toContainText('앉아서 꾸미기');
  await (isMobile ? hint.tap() : (async () => { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); })());
  await expect(page.locator('.mirrorCard button')).toHaveText(['머리 모양', '염색', '얼굴']); await shot('mirror');
  await page.locator('.mirrorCard button', { hasText: '머리 모양' }).click();
  await expect(page.locator('#skinShopTitle')).toHaveText('미용실');
  await page.locator('#skinShopCloseBtn').click(); void sit;
  // the game skins: the game hall's 「스킨」 tab (out of the 백화점, at the game hall)
  await page.locator('#plazaStage').focus(); await page.keyboard.down('ArrowDown'); await page.waitForTimeout(300); await page.keyboard.up('ArrowDown'); /* (up from the chair: an arrow) */
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().act().sitting)).toBe(false);
  await liftTo(page, 1, isMobile);
  await require('./skin-support').outOfMall(page);
  await expect.poll(async () => { await page.evaluate(() => window.PlazaDebug().place('games')); await page.waitForTimeout(500); return hint.textContent(); }, { timeout: 20000 }).toContain('게임관');
  if (isMobile) await hint.tap(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); }
  await page.locator('.gamehallChip[data-cat="skins"]').click();
  await expect(page.locator('#skinShopDialog')).toBeVisible(); await expect(page.locator('#skinShopTitle')).toHaveText('게임 스킨 상점');
  await expectNoScriptError(page); await who.context.close();
});
