const { test, expect } = require('@playwright/test');
const { shopper, buyAndEquip, get, post, expectNoScriptError } = require('./skin-support');

// 내 정보에서 변신 켜기·끄기 (사용자 2026-10-20, gamecenter-notes shop-tryon-20261019.md): the transformations I own are on
// and off in 내 정보 as well; what else I wear stays saved under one -- a hat changed while transformed shows once it is
// off -- and on again it is the transformation. Kept by the server (another page, a new visit: the same).
test('내 정보 변신: 켬 → 모자 바꿈 → 끔(새 모자) → 다시 켬, 서버에 저장', async ({ browser, request, isMobile }) => {
  test.setTimeout(240000);
  const who = await shopper(browser, request, '변신스위치', 2000000, 'female'); const { page } = who;
  await buyAndEquip(request, who, ['avatar_hat_1', 'avatar_hat_2', 'avatar_tf_animal_cat']);
  await buyAndEquip(request, who, ['avatar_hat_1']); // (on now: hat 1; and the cat over it)
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const state = async () => (await get(request, '/api/skins', who.token)).data.equipped?.avatar || {};
  expect(await state()).toMatchObject({ hat: 'avatar_hat_1', transform: 'avatar_tf_animal_cat' });
  const open = async () => {
    if (isMobile) await page.locator('#gameMenuBtn').tap(); else await page.locator('#gameMenuBtn').click();
    await page.locator('#myInfoBtn').click();
    await expect(page.locator('#myTransforms .myTransformLine')).toBeVisible({ timeout: 15000 });
  };
  await open();
  await expect(page.locator('#myTransforms .myTransformLine')).toContainText('변신 중');
  // a hat changed while transformed: saved (the cat stays on)
  expect((await post(request, '/api/skins/equip', who.token, { skinId: 'avatar_hat_2' })).status).toBe(200);
  // off from 내 정보: the new hat, untransformed
  await page.locator('#myTransforms .myTransformLine button', { hasText: '풀기' }).click();
  await expect.poll(state).toMatchObject({ hat: 'avatar_hat_2' });
  expect((await state()).transform).toBeUndefined();
  await expect(page.locator('#myTransforms .myTransformLine')).toContainText('변신 안 함');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().transformation ?? null), { timeout: 15000 }).toBe(null);
  // on again: the cat
  await page.locator('#myTransforms .myTransformRow button', { hasText: '변신하기' }).first().click();
  await expect.poll(state).toMatchObject({ hat: 'avatar_hat_2', transform: 'avatar_tf_animal_cat' });
  await expect(page.locator('#myTransforms .myTransformLine')).toContainText('변신 중');
  await expectNoScriptError(page);
  await who.context.close();
});
