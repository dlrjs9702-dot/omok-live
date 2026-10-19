const { test, expect } = require('@playwright/test');
const { shopper, expectNoScriptError } = require('./skin-support');

// 달마루섬 개편 2단계 (gamecenter-notes docs/dalmaru-implementation-20261019.md 0. 원칙 — 단계마다 사용자 확인 대신 자동 검사):
// on the preview island with its walks and buildings, what is drawn blocks and what blocks is drawn, nothing floats or
// sinks, and every door, house and landmark (the cliff fronts, 이웃골, 초승등대, 달끝나루, 툇마루섬 over 윤슬다리, the ridge
// up its stairs) can be walked to from the first spot. Models on (MODELS=1) or the stand-ins (quicker). PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');
test('달마루섬 2단계: 보이는 것 = 막는 것, 뜨거나 묻힌 것 없음, 문·집·명소 모두 걸어서 닿음', async ({ browser, request }) => {
  test.setTimeout(300000);
  const who = await shopper(browser, request, '한바퀴', 0, 'male'); const { page } = who;
  await page.evaluate((models) => {
    localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.islandMap', 'dalmaru');
    if (!models) localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null]))));
  }, Boolean(process.env.MODELS));
  await page.route('**/api/island/map', (route) => route.fulfill({ json: { ok: true, map: 'dalmaru' } })); // (as for an administrator)
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 120000 }).toBe(true);
  expect(await page.evaluate(() => window.IslandTerrain.MAP)).toBe('dalmaru');
  await page.waitForTimeout(process.env.MODELS ? 20000 : 3000); // (the models in)
  const r = await page.evaluate(() => window.PlazaDebug().mapCheck());
  console.log(JSON.stringify(r));
  expect(r.unseen).toEqual([]);
  expect(r.unblocked).toEqual([]);
  expect(r.floating).toEqual([]);
  expect(r.sunk).toEqual([]);
  expect(r.unreachable).toEqual([]);
  expect(r.reachedCells).toBeGreaterThan(30000);
  await expectNoScriptError(page);
  await who.context.close();
});
