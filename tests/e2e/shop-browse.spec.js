const { test, expect } = require('@playwright/test');
const { shopper, post, expectNoScriptError } = require('./skin-support');

// v1.10.89 상점·내 정보 분류 (사용자 2026-10-17): name search, 등급·시리즈·보유 chips, 부위 tabs in 내 정보, and the
// 파츠 미리보기 -- my character with that item on, in 3D from the island's parts. PC and phone.
test('상점·내 정보: 검색·등급·보유 분류와 파츠 미리보기', async ({ browser, request }) => {
  test.setTimeout(120000);
  const who = await shopper(browser, request, '분류', 500000, 'male');
  const { page, token } = who;
  for (const skinId of ['avatar_hair_6', 'avatar_hat_1']) expect((await post(request, '/api/skins/buy', token, { skinId })).status).toBe(200);
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 30000 }).toBe(true);

  // 잡화점 on the island (모자·장식 first)
  await page.evaluate(() => window.PlazaDebug().place('accessories'));
  await expect(page.locator('#plazaHint')).toContainText('잡화점');
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  const shop = page.locator('#skinShopDialog');
  await expect(shop.locator('#skinShopTitle')).toHaveText('잡화점');
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
  // 파츠 미리보기: 3D, the item worn
  await shop.locator('.skinCard').first().getByRole('button', { name: /미리보기$/ }).click();
  await expect(page.locator('#skinShopTryOn')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().tryOn()?.model), { timeout: 20000 }).toBe(true); // the 3D character came
  await page.locator('#skinShopTryOn').getByRole('button', { name: '미리보기 닫기' }).click();
  await expect(page.locator('#skinShopTryOn')).toBeHidden();
  await shop.locator('#skinShopCloseBtn').click();

  // 내 정보: 부위 tabs with counts, the bought ones only
  await page.keyboard.press('Escape'); await page.locator('#myInfoBtn').click(); // (in the Esc menu)
  const mine = page.locator('#myInfoSkinBody');
  await mine.locator('.skinTab[data-family="avatar"]').click();
  await expect(mine.locator('.skinSlotTabs [role=tab]').first()).toHaveText('전체 2');
  await expect(mine.locator('.skinCard')).toHaveCount(2);
  await mine.locator('.skinSlotTabs [role=tab]').filter({ hasText: '헤어' }).click();
  await expect(mine.locator('.skinCard')).toHaveCount(1);
  await mine.locator('.skinCard').getByRole('button', { name: /미리보기$/ }).click();
  await expect(page.locator('#myInfoTryOn canvas')).toBeVisible();
  const box = await page.locator('#myInfoDialog').boundingBox(); const vw = page.viewportSize().width;
  expect(box.x + box.width).toBeLessThanOrEqual(vw + 1); // fits a phone too
  await page.locator('#myInfoCloseBtn').click();
  await expect(page.locator('#myInfoTryOn')).toBeHidden();
  await expectNoScriptError(page);
  await who.context.close();
});
