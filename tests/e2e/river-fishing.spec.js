const { test, expect } = require('@playwright/test');
const { shopper, post, get, expectNoScriptError } = require('./skin-support');

// v1.10.90 낚시 도감 21종 (IDEAS #future-fishing-dex): a stream's bank is a fishing spot too -- the float lands on the
// stream, a river fish comes in and goes to the bag (its new model in hand, its icon in the 도감). PC and phone.
test('강 낚시: 개울가에서 던지면 찌가 개울에, 강 물고기를 잡아 가방에', async ({ browser, request }) => {
  test.setTimeout(120000);
  const who = await shopper(browser, request, '강낚시', 500000, 'male');
  const { page, token } = who;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 30000 }).toBe(true);
  const weeds = (await get(request, '/api/island/weeds', token)).data.weeds || [];
  const spot = await page.evaluate((weeds) => { // the river bank spot nearest the plaza with no weed in reach (a weed's prompt comes first)
    const T = window.IslandTerrain; let best = null;
    for (let x = -70; x <= 70; x += .5) for (let z = -70; z <= 70; z += .5) if (T.fishWater(x, z) === 'river' && weeds.every(([, wx, wz]) => Math.hypot(wx - x, wz - z) > 4)) { const d = Math.hypot(x, z); if (!best || d < best.d) best = { x, z, d }; }
    return best;
  }, weeds);
  expect(spot).not.toBeNull();
  await page.evaluate(({ x, z }) => window.PlazaWarp(x, z), spot);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().canFish()), { timeout: 10000 }).toBe(true);
  await expect(page.locator('#plazaHint')).toHaveText(/낚시$/, { timeout: 10000 }) // (a phone shows no SPACE);
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().fishing()?.bobber), { timeout: 10000 }).toBe(true);
  expect(await page.evaluate(() => { const b = window.PlazaDebug().fishing().at; return window.IslandTerrain.streamDist(b.x, b.z) < window.IslandTerrain.STREAM_HALF; })).toBe(true); // the float is on the stream
  expect((await post(request, '/api/test/fish/bite', token, { species: 'catfish' })).data.ok).toBe(true);
  await page.evaluate(() => window.PlazaDebug().fishBiteNow());
  await expect(page.locator('#plazaHint')).toHaveText(/당기기$/);
  await page.keyboard.press('Space');
  await expect.poll(async () => ((await get(request, '/api/island/bag', token)).data.items || []).find((e) => e.itemId === 'fish_catfish')?.qty || 0, { timeout: 10000 }).toBe(1);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().fishing()?.held), { timeout: 5000 }).toBe(true); // the new model in hand
  await expectNoScriptError(page);
  await who.context.close();
});
