const { test, expect } = require('@playwright/test');
const { shopper, get, expectNoScriptError } = require('./skin-support');

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
  // 3단계 영웅마루: the donors' 1st and 2nd and the contest's winner carved into the niches -- one stone each
  const N = await page.evaluate(() => window.IslandTerrain.NICHES);
  await page.evaluate(() => window.PlazaDebug().carveStatues([{ rank: 1, name: '일등', look: {} }, { rank: 2, name: '이등', look: {} }, { contest: true, name: '우승', look: {} }], '2026-W42'));
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().carveStatues().map((s) => s.stone)), { timeout: 30000 }).toEqual([true, true, true]);
  const at = await page.evaluate(() => window.PlazaDebug().carveStatues());
  at.forEach((s, k) => expect(Math.hypot(s.x - N[k].x, s.z - N[k].z)).toBeLessThan(1));
  // (5단계) the two waterfalls, their water running
  const fall = () => page.evaluate(() => window.PlazaDebug().environment.water);
  expect((await fall()).falls).toBe(2);
  const f0 = (await fall()).fall; await expect.poll(async () => (await fall()).fall).not.toBe(f0);
  // N1 새 섬 (notes island-expansion §8): far off it, out; walked over 새 섬다리 (no rail or solid in the way), all of it in; on its
  // far side (x 480) the server keeps where one is (ISLAND_RADIUS 540); back over, out again
  const isle = () => page.evaluate(() => window.PlazaDebug().isle2());
  await page.evaluate(() => window.PlazaDebug().teleport(0, 236)); await expect.poll(async () => (await isle()).state).toBe('none');
  await page.evaluate(() => { const d = window.PlazaDebug(); d.teleport(163, 226); d.setCamYaw(-Math.PI / 2); }); await page.waitForTimeout(600);
  /* (run, Shift: CI's ~3 frames a second walked 40 m of the 70 in 40 s) */
  await page.locator('#plazaStage').focus(); await page.keyboard.down('Shift'); await page.keyboard.down('KeyW'); await expect.poll(() => page.evaluate(() => window.PlazaDebug().x), { timeout: 90000 }).toBeGreaterThan(230); await page.keyboard.up('KeyW'); await page.keyboard.up('Shift');
  expect(await page.evaluate(() => Math.abs(window.PlazaDebug().z - 226))).toBeLessThan(2); /* (straight over -- nothing turned it aside) */
  await expect.poll(async () => (await isle()).state).toBe('full'); expect((await isle()).shown).toBeGreaterThan(5);
  await page.evaluate(() => window.PlazaDebug().teleport(480, 230)); await page.waitForTimeout(2500);
  await expect.poll(async () => (await get(request, '/api/test/plaza-snapshot', who.token)).data.players?.find((p) => p.name === '한바퀴')?.x ?? 0, { timeout: 15000 }).toBeGreaterThan(470);
  await page.evaluate(() => window.PlazaDebug().teleport(0, 236)); await expect.poll(async () => (await isle()).state).toBe('none');
  await expectNoScriptError(page);
  await who.context.close();
});
