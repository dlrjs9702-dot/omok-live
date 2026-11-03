const { test, expect } = require('@playwright/test');
const { shopper, post } = require('./skin-support');
const F = require('../../lib/island-fishing');

// v1.10.233 도감 (사용자): 바다 · 민물 · 곤충 · 기념 -- each its found/all (the fish by the tables' water), 「찾은 것만」, the
// cells scroll inside the window to their end (the head and the tabs stay), the tab kept; 「정리」 the bag's only -- on the
// 도감's page hidden and its count the 도감's, back in the bag both the bag's. PC and phone; SHOT_DIR photos.
test('도감 탭: 바다·민물·곤충·기념, 찾은 것만, 창 안 스크롤 끝까지, 탭 기억, 정리 단추는 가방에서만', async ({ browser, request, isMobile }) => {
  test.setTimeout(180000);
  const who = await shopper(browser, request, isMobile ? '도감탭m' : '도감탭', 0, 'female'); const { page } = who;
  for (const itemId of ['fish_mackerel', 'fish_anchovy', 'fish_carp', 'insect_ladybird']) expect((await post(request, '/api/test/island/give', who.token, { itemId, qty: 1, dex: true })).status).toBe(200);
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.removeItem('gc.dexTab'); localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); });
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  const shot = async (name) => { if (process.env.SHOT_DIR) { await page.waitForTimeout(500); await page.screenshot({ path: `${process.env.SHOT_DIR}/${isMobile ? 'phone' : 'pc'}-${name}.png` }); } };
  const sea = Object.values(F.WATER_OF).filter((w) => w === 'sea').length; const fresh = Object.values(F.WATER_OF).length - sea;
  await page.locator('#islandBagTab').click(); await expect(page.locator('#islandBagSort')).toBeVisible();
  await expect(page.locator('#islandBagCount')).toHaveText(/^4\/\d+$/); const bagCount = await page.locator('#islandBagCount').textContent(); // (the bag drawn first)
  await page.locator('#islandDexBtn').click();
  const tabs = page.locator('#islandDexTabs .islandDexTab'); await expect(tabs).toHaveText([`바다 2/${sea}`, `민물 1/${fresh}`, /^곤충 1\/\d+$/, /^기념 0\/\d+$/]);
  await expect(page.locator('#islandBagSort')).toBeHidden(); await expect(page.locator('#islandBagCount')).toHaveText(/^4\/\d+$/);
  const cells = page.locator('#islandDexGrid .islandDexCell'); await expect(cells).toHaveCount(sea); await shot('dex-sea');
  // the cells scroll inside the window, to their end; the head and the tabs stay where they were
  const tabTop = await tabs.first().evaluate((el) => el.getBoundingClientRect().top);
  const scroll = await page.locator('#islandDexGrid').evaluate((el) => { el.scrollTop = el.scrollHeight; return { over: el.scrollHeight > el.clientHeight, end: Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 2 }; });
  expect(scroll.end).toBe(true); expect(await tabs.first().evaluate((el) => el.getBoundingClientRect().top)).toBeCloseTo(tabTop, 0);
  await expect(cells.last()).toBeInViewport(); await shot('dex-sea-end');
  const dialog = await page.locator('#islandBagDialog').boundingBox(); const grid = await page.locator('#islandDexGrid').boundingBox();
  expect(grid.y + grid.height).toBeLessThanOrEqual(dialog.y + dialog.height + 1); // (in the window, not past it)
  for (const [k, name] of [[1, 'dex-fresh'], [2, 'dex-insect'], [3, 'dex-keep']]) { await tabs.nth(k).click(); await expect(tabs.nth(k)).toHaveAttribute('aria-selected', 'true'); await shot(name); }
  await tabs.nth(1).click(); await expect(cells).toHaveCount(fresh);
  await page.locator('#islandDexFoundOnly').check(); await expect(cells).toHaveCount(1); await expect(cells.first()).toContainText('잉어'); await shot('dex-found-only');
  await page.locator('#islandDexFoundOnly').uncheck(); await expect(cells).toHaveCount(fresh);
  // back to the bag: 정리 and its count; again the 도감: its tab kept
  await page.locator('#islandDexBtn').click(); await expect(page.locator('#islandBagSort')).toBeVisible(); await expect(page.locator('#islandDexTabs')).toBeHidden(); await expect(page.locator('#islandBagCount')).toHaveText(bagCount);
  await page.locator('#islandDexBtn').click(); await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true'); await expect(page.locator('#islandBagSort')).toBeHidden();
  await who.context.close();
});
