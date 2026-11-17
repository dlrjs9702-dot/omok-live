// 1.10.339 섬 벼룩시장 (notes island-auction 49A·135B·138A): SPACE before the board in 대청마당 opens its window; 팔기 puts a thing
// from the bag up at a price; someone else buys it -- a gold 「받을 돈」 over the board; 내 물건 「받기」 pays it (less 5 %) and the mark
// goes. A phone: the window fits the screen.
const { test, expect } = require('@playwright/test');
const { shopper, post, get, spaceOn } = require('./skin-support');

test('섬 벼룩시장: 게시판 SPACE → 팔기로 올리기 → 다른 사람이 사면 받을 돈 표시 → 받기', async ({ browser, request, isMobile }) => {
  test.setTimeout(240000);
  const a = await shopper(browser, request, isMobile ? '벼룩파는이m' : '벼룩파는이', 0, 'female'); const { page } = a;
  await post(request, '/api/test/island/give', a.token, { itemId: 'herb', qty: 3 });
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.view.out', 'third'); }); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  const door = await page.evaluate(() => window.PlazaDebug().flea().door); expect(door).toBeTruthy();
  const open = async () => {
    await expect.poll(async () => { if (await page.locator('#plazaDialog .fleaCard').isVisible()) return true; await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [door.x, door.z]); await page.waitForTimeout(500); await spaceOn(page, 'board:flea', isMobile); await page.waitForTimeout(800); return page.locator('#plazaDialog .fleaCard').isVisible(); }, { timeout: 45000 }).toBe(true);
  };
  await open(); await expect(page.locator('#plazaDialog')).toContainText('섬 벼룩시장');
  if (isMobile) { /* (a phone: the window inside the screen, its tabs and list readable) */
    const fit = await page.evaluate(() => { const r = document.querySelector('#plazaDialog .fleaCard').getBoundingClientRect(); return r.left >= -1 && r.right <= window.innerWidth + 1; }); expect(fit).toBe(true);
    await page.locator('#plazaDialog .stocksTabs button', { hasText: '팔기' }).click(); await expect(page.locator('#plazaDialog .fleaPick')).toBeVisible();
    const fit2 = await page.evaluate(() => document.querySelector('#plazaDialog .fleaCard').scrollWidth <= document.querySelector('#plazaDialog .fleaCard').clientWidth + 1); expect(fit2).toBe(true);
    await a.context.close(); return;
  }
  // 팔기: the herbs, two of them, 4,000P a piece (1.10.347: things alike go up as a bundle, priced a piece)
  await page.locator('#plazaDialog .stocksTabs button', { hasText: '팔기' }).click();
  const pick = page.locator('#plazaDialog .fleaPick'); await expect(pick).toBeVisible();
  const herbKey = await pick.evaluate((s) => [...s.options].find((o) => o.textContent.includes('희귀 약재')).value); await pick.selectOption(herbKey);
  await page.locator('#plazaDialog .fleaQty').fill('2'); await page.locator('#plazaDialog .fleaPrice').fill('4000');
  await expect(page.locator('#plazaDialog .stocksNote')).toContainText('2개가 다 팔리면 7,600P');
  await page.locator('#plazaDialog button', { hasText: '올리기' }).click();
  await expect(page.locator('#plazaDialog .fleaRow')).toContainText('희귀 약재 ×2'); /* (내 물건) */
  // someone else buys it: the seller's board shows money waiting
  const b = await shopper(browser, request, '벼룩사는이', 100000, 'male');
  const list = (await get(request, '/api/island/flea', b.token)).data.list; const up = list.find((x) => x.name === '희귀 약재' && x.seller === '벼룩파는이'); expect(up).toBeTruthy();
  expect((await post(request, '/api/island/flea/buy', b.token, { id: up.id })).status).toBe(200);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().flea().badge), { timeout: 20000 }).toBe(true);
  // 받기
  await page.evaluate(() => document.getElementById('plazaDialog').close()); await open();
  await page.locator('#plazaDialog .stocksTabs button', { hasText: '내 물건' }).click();
  await expect(page.locator('#plazaDialog .fleaOwed')).toContainText('받을 돈 7,600P');
  await page.locator('#plazaDialog .fleaOwed button', { hasText: '받기' }).click();
  await expect(page.locator('#plazaDialog .fleaOwed')).toContainText('받을 돈이 없어요');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().flea().badge)).toBe(false);
  await b.context.close(); await a.context.close();
});
