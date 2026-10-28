const { test, expect } = require('@playwright/test');
const { shopper, post, adminToken, expectNoScriptError } = require('./skin-support');

// v1.10.202 79 소품 맞춤: the refitted pendant hangs 0.14~0.17 in front of the body, so over a thick outfit (the sailor
// collar, 65 mm) only a push-out from -0.13 brings it out in front of the cloth; the refitted boots bend at the ankle
test('79 소품 맞춤: 두꺼운 옷 위 펜던트 밀어내기, 맞춘 신발', async ({ browser, request }) => {
  test.setTimeout(180000);
  const who = await shopper(browser, request, '소품맞춤', 5_000_000, 'female');
  const { page, token } = who;
  for (const id of ['avatar_outfit_8', 'avatar_necklace_2', 'avatar_shoes_2']) {
    expect((await post(request, '/api/skins/buy', token, { skinId: id })).status).toBe(200);
    expect((await post(request, '/api/skins/equip', token, { skinId: id })).status).toBe(200);
  }
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 30000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => (window.PlazaDebug().wardrobe || []).filter((p) => /outfit|necklace|shoes/.test(p)).sort()), { timeout: 90000 })
    .toEqual(['wear.necklace_star', 'wear.outfit_sailor', 'wear.shoes_boots']);
  const mine = await page.evaluate(() => window.PlazaDebug().assets.wearing.find((w) => w.parts.includes('wear.necklace_star')));
  expect(mine.fitted['wear.necklace_star']).toEqual(['shift']);
  if (process.env.SHOT_DIR) { // by day, the front, then running toward the camera (the boots' shafts)
    const admin = await adminToken(request);
    await request.post('/api/admin/island/time', { headers: { 'X-Session-Token': admin }, data: { mode: 'day' } });
    await page.evaluate(async () => { const d = window.PlazaDebug(); d.halloween.set(false); await window.PlazaWarp(-26, -58); /* (대청마당, open paving) */ });
    await page.waitForTimeout(4000);
    await page.evaluate(() => { const d = window.PlazaDebug(); d.faceTo(d.x, d.z + 5); d.setCamYaw(0); });
    await page.locator('#plazaStage').focus(); for (let i = 0; i < 3; i++) await page.keyboard.press('KeyQ');
    await page.waitForTimeout(1500);
    const tag = test.info().project.name; const box = await page.locator('#plazaStage canvas.plazaCanvas').boundingBox();
    const clip = { x: box.x + box.width / 2 - 200, y: box.y + box.height / 2 - 140, width: 400, height: 480 };
    await page.screenshot({ path: `${process.env.SHOT_DIR}/${tag}-front.png`, clip });
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyS'); await page.waitForTimeout(900);
    await page.screenshot({ path: `${process.env.SHOT_DIR}/${tag}-run.png`, clip });
    await page.keyboard.up('KeyS'); await page.keyboard.up('ShiftLeft');
    await request.post('/api/admin/island/time', { headers: { 'X-Session-Token': admin }, data: { mode: 'auto' } });
  }
  await expectNoScriptError(page);
  await who.context.close();
});
