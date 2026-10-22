const { test, expect } = require('@playwright/test');
const { shopper, post, expectNoScriptError, spaceOn } = require('./skin-support');

// v1.10.89 상점·내 정보 분류 (사용자 2026-10-17): name search, 등급·시리즈·보유 chips, 부위 tabs in 내 정보, and the
// 파츠 미리보기 -- my character with that item on, in 3D from the island's parts. PC and phone.
test('상점·내 정보: 검색·등급·보유 분류와 파츠 미리보기', async ({ browser, request, isMobile }) => {
  test.setTimeout(240000); // (a phone profile on CI: about twice the local minute)
  const who = await shopper(browser, request, '분류', 500000, 'male');
  const { page, token } = who;
  for (const skinId of ['avatar_hair_6', 'avatar_hat_1']) expect((await post(request, '/api/skins/buy', token, { skinId })).status).toBe(200);
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 30000 }).toBe(true);

  // 잡화점 on the island (모자·장식 first)
  await require('./skin-support').intoMall(page, 'accessories', isMobile); // v1.10.92 백화점
  const shop = page.locator('#skinShopDialog');
  // (CI 3차: the sector's prompt read and pressed at once, again until the window is open -- PC parts holding this spec
  // failed 13 of 54 times on 10/20~21)
  await expect.poll(async () => { if (await shop.isVisible()) return true; await spaceOn(page, 'accessories', isMobile); await page.waitForTimeout(800); return shop.isVisible(); }, { timeout: 30000, intervals: [500] }).toBe(true);
  await expect(shop.locator('#skinShopTitle')).toHaveText('소품 가게');
  await expect(shop.locator('.skinCard').first()).toBeVisible(); const all = await shop.locator('.skinCard').count();
  await shop.getByRole('group', { name: '보유' }).getByRole('button', { name: '산 것', exact: true }).click();
  await expect(shop.locator('.skinCount')).toHaveText('1개'); // the hat (the hair is the 미용실's)
  await shop.getByRole('group', { name: '보유' }).getByRole('button', { name: '보유 전체', exact: true }).click();
  await expect(shop.locator('.skinCard')).toHaveCount(all);
  const first = await shop.locator('.skinCard .skinName').first().textContent();
  await shop.locator('input.skinSearch').fill(first.slice(0, 3));
  await expect(shop.locator('.skinCard').first()).toContainText(first.slice(0, 3));
  expect(await shop.locator('.skinCard').count()).toBeLessThan(all);
  await shop.locator('input.skinSearch').fill('없는이름xyz');
  await expect(shop.locator('.skinResults')).toContainText('조건에 맞는 스킨이 없습니다');
  await shop.locator('input.skinSearch').fill('');
  // 파츠 미리보기 (3-1 꾸미기 창): the 3D beside the list from the start, a card pressed is worn there; gone with the window
  await expect(page.locator('#skinShopTryOn')).toBeVisible();
  await shop.locator('.skinCard').first().locator('.skinName').click();
  await expect(page.locator('#skinShopTryOn .dressName')).toContainText((await shop.locator('.skinCard').first().locator('.skinName').textContent()).trim());
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().tryOn()?.model), { timeout: 20000 }).toBe(true); // the 3D character came
  await shop.locator('#skinShopCloseBtn').click();
  await expect(page.locator('#skinShopTryOn')).toBeHidden();

  // 내 정보: 부위 tabs with counts, the bought ones only
  await page.keyboard.press('Escape'); await page.locator('#myInfoBtn').click(); // (in the Esc menu)
  const mine = page.locator('#myInfoSkinBody');
  await mine.locator('.skinTab[data-family="avatar"]').click();
  await expect(mine.locator('.skinSlotTabs [role=tab]').first()).toHaveText('전체 2');
  await expect(mine.locator('.skinCard')).toHaveCount(2);
  await mine.locator('.skinSlotTabs [role=tab]').filter({ hasText: '헤어' }).click();
  await expect(mine.locator('.skinCard')).toHaveCount(1);
  await mine.locator('.skinCard .skinName').click();
  await expect(page.locator('#myInfoTryOn canvas')).toBeVisible();
  const box = await page.locator('#myInfoDialog').boundingBox(); const vw = page.viewportSize().width;
  expect(box.x + box.width).toBeLessThanOrEqual(vw + 1); // fits a phone too
  await page.locator('#myInfoCloseBtn').click();
  await expect(page.locator('#myInfoTryOn')).toBeHidden();
  await expectNoScriptError(page);
  await who.context.close();
});
