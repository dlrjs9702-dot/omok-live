const { test, expect } = require('@playwright/test');
const { shopper, get, intoMall, expectNoScriptError } = require('./skin-support');

// 3-1 꾸미기 창 (사용자 2026-10-19, gamecenter-notes docs/shop-tryon-20261019.md): the clothes shop, 성형외과 and the
// 변신 의상실 show my character in 3D beside their list from the moment they open; pointing at (or tapping) an item puts
// it on there; closing puts the preview away and leaves what I wear as it was. PC and phone.
test('꾸미기 창: 열자마자 내 모습, 항목을 가리키면 바로 입은 모습, 닫으면 정리', async ({ browser, request, isMobile }) => {
  test.setTimeout(240000);
  const who = await shopper(browser, request, '꾸미기손님', 1000000, 'female'); const { page } = who;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const point = async (el) => { if (isMobile) await el.tap(); else await el.hover(); };
  // the clothes shop: the 3D at once, then the pointed card's name on it
  let press = await intoMall(page, 'avatar', isMobile); await press();
  const shopView = page.locator('#skinShopTryOn');
  await expect(shopView.locator('canvas.dressCanvas')).toBeVisible({ timeout: 15000 });
  await expect(shopView.locator('.skinTryOnCap strong')).toHaveText('지금 내 모습');
  const card = page.locator('#skinShopBody .skinCard').nth(2); const cardName = (await card.locator('.skinName').textContent()).trim();
  await point(card.locator('.skinName'));
  await expect(shopView.locator('.skinTryOnCap strong')).toContainText(cardName);
  // picked: a green edge, the detail strip, the bar's 구매 = the card's own button; 착용 전 → 착용 후 beside the preview
  await card.locator('.skinName').click();
  await expect(card).toHaveClass(/selected/);
  await expect(page.locator('.skinShopDialog .dressDetail strong')).toHaveText(cardName);
  await expect(page.locator('.skinShopDialog .dressBuy')).toHaveText(await card.locator('button[data-skin]').textContent());
  await expect(shopView.locator('.dressCompare')).toBeVisible();
  // 선물하기 (사용자 2026-10-19 「선물 허용으로」「우체국으로 쪽지 오는걸로」): for another account -- theirs, a note in their 우체통, I pay
  const friendName = `받는이${Date.now() % 100000}`; const friend = await shopper(browser, request, friendName, 0, 'male');
  const before = (await get(request, '/api/points', who.token)).data.balance;
  await page.locator('.skinShopDialog .dressBar .dressGift').click();
  const form = page.locator('.skinShopDialog .dressGiftForm');
  await expect(form.locator('select option', { hasText: friendName })).toHaveCount(1);
  await form.locator('select').selectOption({ label: friendName });
  await form.locator('input').fill('생일 축하해!');
  page.once('dialog', (d) => d.accept());
  await form.getByRole('button', { name: '보내기' }).click();
  await expect(form).toBeHidden({ timeout: 15000 });
  const skinId = await card.locator('button[data-skin]').getAttribute('data-skin');
  await expect.poll(async () => (await get(request, '/api/skins', friend.token)).data.owned.includes(skinId)).toBe(true);
  const mail = (await get(request, '/api/island/mail', friend.token)).data.letters.find((l) => l.skinId === skinId);
  expect(mail.text).toBe('생일 축하해!'); expect(mail.skinName).toBe(cardName);
  expect((await get(request, '/api/points', who.token)).data.balance).toBeLessThan(before);
  await friend.context.close();
  for (let k = 0; k < 3; k += 1) await shopView.getByRole('button', { name: '다음 모습' }).click(); // 정면 → 옆 → 뒤 → 걷기
  await page.locator('#skinShopCloseBtn').click();
  await expect(shopView).toBeHidden();
  await expectNoScriptError(page);
  await who.context.close();
});

// (CI 2차 단축: on its own -- the whole was past four minutes on the phone run) 성형외과 and the 변신 의상실
test('꾸미기 창: 성형외과·변신 의상실도 열자마자 내 모습, 가리키면 입은 모습, 닫으면 아무것도 남지 않음', async ({ browser, request, isMobile }) => {
  test.setTimeout(240000);
  const who = await shopper(browser, request, '꾸미기둘', 1000000, 'female'); const { page } = who;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const point = async (el) => { if (isMobile) await el.tap(); else await el.hover(); };
  let press;
  // 성형외과: a face part on the face; 변신 의상실: the transformation on me
  // (bugs 10: the 변신 의상실 first, then 성형외과 -- whose window shows none of the other's list; closed, neither stays on the page)
  for (const [place, item] of [['transform', '#transformShop .tfRow strong'], ['faces', '.lookShop button[data-part]']]) {
    press = await intoMall(page, place, isMobile); await press();
    const view = page.locator('#plazaDialogBody .dressSide');
    await expect(view.locator('canvas.dressCanvas')).toBeVisible({ timeout: 15000 });
    const el = page.locator(item).nth(1); const label = (await el.textContent()).trim();
    await point(el);
    await expect(view.locator('.skinTryOnCap strong')).toContainText(label.replace(/ · 지금$/, ''));
    if (place === 'faces') await expect(page.locator('#plazaDialogBody #transformShop')).toHaveCount(0);
    await page.locator('#plazaCloseBtn').click(); await expect(view).toBeHidden();
    await expect(page.locator('.dressRoom:visible, .lookShop:visible, #transformShop:visible')).toHaveCount(0);
  }
  expect(await page.evaluate(() => window.PlazaDebug().transformation ?? null)).toBe(null); // (pointed at, never worn)
  await expectNoScriptError(page);
  await who.context.close();
});
