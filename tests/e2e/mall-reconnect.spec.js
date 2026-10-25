const { test, expect } = require('@playwright/test');
const { shopper, get, post, intoMall, standInMall, spaceOn } = require('./skin-support');

// 문제 기록 (사용자 제보 2026-10-25, 휴대폰): 잡화점 물건이 안 사지고, 가구점 승강기에서 「승강기 앞에서 다시 시도해 주세요」만 --
// a phone's lobby stream drops and comes back by itself (the network, the screen off), and the server dropped my visit
// at the drop, forgetting I was in the 백화점 and on which floor. Inside, the stream cut for a few seconds: a good is
// still bought, and the lift still goes down. PC and phone.
test('백화점: 연결이 잠깐 끊겼다 돌아와도 물건이 사지고 승강기가 움직인다', async ({ browser, request, isMobile }) => {
  test.setTimeout(180000);
  const who = await shopper(browser, request, isMobile ? '끊김m' : '끊김', 100000, 'female'); const { page, token } = who;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const press = async () => { if (isMobile) await page.locator('#plazaHint').tap(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); } };
  // (the stream down from the server's side, the page reconnects; `visit`: the phone put away long enough that the server
  // dropped the visit too -- the next pose from inside puts me back on that floor)
  const cut = async (visit = false) => { expect((await post(request, '/api/test/lobby/drop', token, { visit })).data.dropped).toBeGreaterThan(0); await page.waitForTimeout(3000); };
  await intoMall(page, null, isMobile);
  await standInMall(page, 10.455, 6.5, '낚시 미끼 · 300P');
  await cut();
  await press(); await expect(page.locator('#goodCard')).toBeVisible();
  await page.locator('#goodCard').getByRole('button', { name: /^1개/ }).click();
  await expect.poll(async () => ((await get(request, '/api/island/bag', token)).data.items || []).find((e) => e.itemId === 'bait')?.qty || 0, { timeout: 10000 })
    .toBe(1).catch(async (error) => { error.message += `\ntoast: ${await page.locator('#toast').textContent().catch(() => '?')}`; throw error; });
  await page.keyboard.press('Escape').catch(() => {});
  // up to the 2nd floor, the stream cut there, then down again
  await expect.poll(async () => { if (await page.locator('#liftCard').isVisible()) return true; await page.evaluate(() => { const d = window.PlazaDebug(); const l = d.doors['lift:1']; d.teleport(l.x, l.z); }); await page.waitForTimeout(500); await spaceOn(page, 'lift:1', isMobile); await page.waitForTimeout(500); return page.locator('#liftCard').isVisible(); }, { timeout: 30000, intervals: [300] }).toBe(true);
  await page.locator('#liftCard button[data-floor="2"]').click();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().space), { timeout: 15000 }).toBe('furniture');
  await cut(true);
  await expect.poll(async () => { if (await page.locator('#liftCard').isVisible()) return true; await page.evaluate(() => { const d = window.PlazaDebug(); const l = d.doors['lift:2']; d.teleport(l.x, l.z); }); await page.waitForTimeout(500); await spaceOn(page, 'lift:2', isMobile); await page.waitForTimeout(500); return page.locator('#liftCard').isVisible(); }, { timeout: 30000, intervals: [300] }).toBe(true);
  await page.locator('#liftCard button[data-floor="1"]').click();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().space), { timeout: 15000 }).toBe('store')
    .catch(async (error) => { error.message += `\ntoast: ${await page.locator('#toast').textContent().catch(() => '?')}`; throw error; });
  await who.context.close();
});
