const { test, expect } = require('@playwright/test');
const { shopper, post, get, intoMall, spaceOn, expectNoScriptError } = require('./skin-support');

// v1.10.195 가방 개편 (gamecenter-notes docs/bag-redesign-20261027.md): a cloud pouch of round slots (8 a row, a phone 5), a
// thing picked shows its name under it and its actions in a small bubble; my own order -- dragged (PC), held then tapped
// (a phone), Shift+arrows -- kept on the server; 정리; 가방 늘리기 at the 잡화점's keeper; the bag again or a click outside
// shuts it. PC and phone.
test('가방 개편: 동그라미 칸·이름 줄·말풍선 메뉴, 내 순서(끌기·꾹·Shift+방향키), 정리, 잡화점에서 24칸', async ({ browser, request, isMobile }) => {
  test.setTimeout(300000);
  const who = await shopper(browser, request, isMobile ? '주머니m' : '주머니', 200000, 'female'); const { page, token } = who;
  for (const itemId of ['bread', 'weed', 'bugnet', 'fish_goby']) expect((await post(request, '/api/test/island/give', token, { itemId, qty: 1 })).data.applied).toBe(true);
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); });
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  // (open, the pouch is a modal: the bag button behind its backdrop -- pressed where it is, the backdrop takes it and shuts it)
  const tab = async () => { const b = await page.locator('#islandBagTab').boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
  const order = async () => (await get(request, '/api/island/bag', token)).data.items.map((e) => e.itemId);
  await tab(); const bag = page.locator('#islandBagDialog'); await expect(bag).toBeVisible();
  // the pouch: 8 (5) a row, round, empty ones too; no 「닫기」 word
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('islandBagGrid')).gridTemplateColumns.split(' ').length)).toBe(isMobile ? 5 : 8);
  await expect(page.locator('.islandBagSlot')).toHaveCount(16); await expect(page.locator('.islandBagSlot.empty')).toHaveCount(12);
  expect(await page.locator('.islandBagSlot').first().evaluate((e) => getComputedStyle(e).borderRadius)).toBe('50%');
  await expect(page.locator('.islandBagSlot span')).toHaveCount(0); // (the picture and count only)
  // picked: its name below; the net -- a bubble with 들기
  await page.locator('.islandBagSlot[data-item="bread"]').click(); await expect(page.locator('#islandBagInfo')).toContainText('빵');
  await expect(page.locator('.bagMenu')).toHaveCount(0); // (bread does nothing in the bag)
  await page.locator('.islandBagSlot[data-item="bugnet"]').click(); await expect(page.locator('.islandBagSlot[data-item="bugnet"] .bagMenu [role="menuitem"]')).toHaveText(['들기']);
  // Shift+→ (keys): the first one a place on
  const first = await order();
  await page.locator('.islandBagSlot').first().focus(); await page.keyboard.press('Shift+ArrowRight');
  await expect.poll(order).toEqual([first[1], first[0], ...first.slice(2)]);
  if (!isMobile) { // dragged onto another: they swap
    const now = await order();
    await page.locator('.islandBagSlot').nth(0).dragTo(page.locator('.islandBagSlot').nth(3));
    await expect.poll(order).toEqual([now[3], now[1], now[2], now[0]]);
  } else { // held 0.4 s, then the slot tapped: onto an empty one -- to the end
    const now = await order(); await page.waitForTimeout(800); // (the last move's answer drawn first)
    await page.locator('.islandBagSlot').nth(0).dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true });
    await page.waitForTimeout(600); await expect(page.locator('.islandBagSlot.held')).toHaveCount(1);
    await page.locator('.islandBagSlot').nth(0).dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true });
    await page.locator('.islandBagSlot').nth(10).click();
    await expect.poll(order).toEqual([...now.slice(1), now[0]]);
  }
  // 정리: asked once, then tools, fish, materials, the rest
  await page.locator('#islandBagSort').click(); await expect(page.locator('#islandBagSort')).toHaveText('순서를 바꿀까요?');
  await page.locator('#islandBagSort').click(); await expect.poll(order).toEqual(['bugnet', 'fish_goby', 'weed', 'bread']);
  // the bag again: shut; a click outside: shut
  await tab(); await expect(bag).toBeHidden();
  await tab(); await expect(bag).toBeVisible(); await page.mouse.click(5, 5); await expect(bag).toBeHidden();
  if (process.env.ZZ_SHOT) { await tab(); await page.locator('.islandBagSlot[data-item="bugnet"]').click(); await page.waitForTimeout(500); await page.screenshot({ path: `${process.env.ZZ_SHOT}-bag-${isMobile ? 'phone' : 'pc'}.png` }); await tab(); }
  // 가방 늘리기 at the 잡화점's keeper: 24 slots
  await intoMall(page, null, isMobile);
  const talk = page.locator('#bagGrowBtn');
  await expect.poll(async () => { if (await talk.isVisible()) return true; await page.evaluate(() => { const S = window.IslandStore; const s = S.SECTORS?.find((x) => x.id === 'store') || null; const d = window.PlazaDebug(); const k = d.doors['mall:store']; if (k) d.teleport(k.x, k.z); else if (s) { const w = S.world(...s.interact); d.teleport(w.x, w.z); } }); await page.waitForTimeout(400); await spaceOn(page, 'mall:store', isMobile); await page.waitForTimeout(800); return talk.isVisible(); }, { timeout: 30000, intervals: [500] }).toBe(true);
  await expect(talk).toHaveText('가방 늘리기 · 24칸 50,000P');
  await talk.click(); await expect.poll(async () => (await get(request, '/api/island/bag', token)).data.slots).toBe(24);
  await tab(); await expect(page.locator('.islandBagSlot')).toHaveCount(24); await expect(page.locator('#islandBagCount')).toHaveText('4/24');
  await expectNoScriptError(page);
  await who.context.close();
});
