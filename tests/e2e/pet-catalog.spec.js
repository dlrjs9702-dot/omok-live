const { test, expect } = require('@playwright/test');
const { shopper, intoMall, expectNoScriptError, spaceOn } = require('./skin-support');

// 문제 기록 3회차 21 + 메타몽, v1.10.191 (docs/petshop-yard-unify-20261027.md): the special pets -- each transformation small
// and 메타몽 -- walk the yard with the others, four a day, each with its name over it; the counter's keeper sells none
// and tells where they are and today's specials. One taken (named) is that transformation's own model at pet size. PC and phone.
test('펫샵 특별 펫: 점원은 마당을 안내, 마당의 특별 펫을 데려가면 그 모습 그대로 작게 따라다님', async ({ browser, request, isMobile }) => {
  test.setTimeout(240000);
  const who = await shopper(browser, request, isMobile ? '변신펫m' : '변신펫', 100000, 'male'); const { page } = who;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  await intoMall(page, null, isMobile);
  await expect.poll(async () => { if (await page.locator('#liftCard').isVisible()) return true; await page.evaluate(() => { const d = window.PlazaDebug(); const l = d.doors['lift:1']; d.teleport(l.x, l.z); }); await page.waitForTimeout(500); await spaceOn(page, 'lift:1', isMobile); await page.waitForTimeout(500); return page.locator('#liftCard').isVisible(); }, { timeout: 30000, intervals: [300] }).toBe(true);
  await page.locator('#liftCard button[data-floor="3"]').click();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().space), { timeout: 15000 }).toBe('petshop');
  // ten in the yard (the other run on this server may have taken some), every one its name over it
  await expect.poll(() => page.evaluate(() => (window.PlazaDebug().petshopTags() || []).length), { timeout: 15000 }).toBeGreaterThanOrEqual(8);
  expect(await page.evaluate(() => window.PlazaDebug().petshopTags().every((p) => p.tag && p.shown))).toBe(true);
  // (총괄 검토: only the nearest three within 3.5 m show theirs) -- by the yard's middle, some lit and never more than three
  await page.evaluate(() => { const P = window.IslandPetShop; const w = P.world(P.PEN.lx, P.PEN.lz); window.PlazaDebug().teleport(w.x, w.z); });
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().petshopTags().filter((p) => p.lit).length), { timeout: 10000 }).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.PlazaDebug().petshopTags().filter((p) => p.lit).length)).toBeLessThanOrEqual(3);
  const specials = await page.evaluate(() => { const P = window.IslandPetShop; const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); return P.displayOf(day).filter((p) => P.catalogOf(p.kind)).map((p) => ({ slot: p.slot, kind: p.kind, name: P.nameOf(p.kind) })); });
  expect(specials.length).toBe(4);
  // the counter: SPACE (the phone: the hint) -- the keeper's word, today's specials named; nothing on sale
  const talk = page.locator('.lostRequest');
  await expect.poll(async () => {
    if (await talk.isVisible()) return true;
    await page.evaluate(() => { const P = window.IslandPetShop; const w = P.world(P.COUNTER_KEEPER[0], P.COUNTER_KEEPER[1] - 1.6); window.PlazaDebug().teleport(w.x, w.z); });
    await page.waitForTimeout(300); await spaceOn(page, 'petshop:counter', isMobile); await page.waitForTimeout(500);
    return talk.isVisible();
  }, { timeout: 30000, intervals: [300] }).toBe(true);
  await expect(talk).toContainText('오늘 아이들은 마당에 있어요');
  await expect.poll(() => talk.textContent(), { timeout: 10000 }).toContain(specials[0].name);
  if (process.env.ZZ_SHOT) await page.screenshot({ path: `${process.env.ZZ_SHOT}-counter-${isMobile ? 'phone' : 'pc'}.png` });
  await page.locator('.lostRequest button', { hasText: '둘러볼게요' }).click();
  await expect(talk).toBeHidden();
  // one special taken from the yard (the phone another than the PC's: one server for both)
  const sp = specials[isMobile ? 1 : 0];
  await expect.poll(async () => {
    if (await page.locator('#adoptCard').isVisible()) { if ((await page.locator('#adoptCard strong').textContent()).startsWith(sp.name)) return true; await page.locator('#adoptCard button', { hasText: '그만두기' }).click(); } // (another one by it: again)
    await page.evaluate((slot) => { const P = window.IslandPetShop; const d = window.PlazaDebug(); const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); const q = P.petAt(day, slot, Date.now()); d.teleport(q.x + 0.5, q.z); }, sp.slot);
    await page.waitForTimeout(300); await spaceOn(page, 'adopt:', isMobile); await page.waitForTimeout(500);
    return page.locator('#adoptCard').isVisible();
  }, { timeout: 30000, intervals: [300] }).toBe(true);
  const { kind } = sp;
  await page.locator('#adoptCard input.adoptName').fill('꼬마');
  await page.locator('#adoptCard button', { hasText: '데려가기' }).click();
  await expect(page.locator('#adoptCard')).toBeHidden({ timeout: 15000 });
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().pets().find((p) => p.key === 'me')), { timeout: 15000 }).toMatchObject({ kind, name: '꼬마', tag: true });
  // walking off: it comes along (its own model, small)
  const at = await page.evaluate(() => { const d = window.PlazaDebug(); return { x: d.x, z: d.z }; });
  await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x - 3, z), [at.x, at.z]);
  await expect.poll(() => page.evaluate(() => { const d = window.PlazaDebug(); const p = d.pets().find((q) => q.key === 'me'); return Math.hypot(p.x - d.x, p.z - d.z) < 2; }), { timeout: 10000 }).toBe(true);
  if (process.env.ZZ_SHOT) await page.screenshot({ path: `${process.env.ZZ_SHOT}-${isMobile ? 'phone' : 'pc'}.png` });
  await expectNoScriptError(page);
  await who.context.close();
});
