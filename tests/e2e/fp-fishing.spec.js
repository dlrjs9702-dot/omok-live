const { test, expect } = require('@playwright/test');
const { shopper, post, get, holdTool, pressFishArrows, expectNoScriptError } = require('./skin-support');
const T = require('../../public/plaza/island-terrain.js'); const DAL = T.MAP === 'dalmaru';

// 문제 기록 1104 G (사용자 「1인칭 시점에서 낚시 시작하면 1인칭으로 낚시 계속 이어지게 해」): cast in the first person, the first
// stays -- the wait, the bite's arrows, the catch -- and after it; the view turned to the water. PC (the phone's arrows are
// tapped: the same scene code). SHOT_DIR the wait and the catch.
test('1인칭 낚시: 1인칭에서 던지면 기다림·입질·잡기까지 1인칭, 잡은 뒤에도 1인칭', async ({ browser, request, isMobile }) => {
  test.skip(isMobile, 'PC 전용 검증');
  test.setTimeout(process.env.CI ? 240000 : 150000);
  const who = await shopper(browser, request, '1인칭낚시', 0, 'female'); const { page, token } = who;
  expect((await post(request, '/api/test/island/give', token, { itemId: 'fishing_rod', qty: 1 })).status).toBe(200);
  await page.evaluate((shots) => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.view.out', 'first'); if (shots) localStorage.setItem('gc.testRealView', '1'); else localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }, Boolean(process.env.SHOT_DIR));
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  const view = () => page.evaluate(() => window.PlazaDebug().view().mode);
  await expect.poll(view).toBe('first');
  const pierAt = (k, side) => (DAL ? { x: T.PIER.x + T.PIER.ux * k - T.PIER.uz * side, z: T.PIER.z + T.PIER.uz * k + T.PIER.ux * side } : { x: T.PIER.x + side, z: T.PIER.z + k });
  const tourists = ((await get(request, '/api/test/island/events')).data.events || []).filter((e) => e.type === 'photo' && e.npc).map((e) => e.npc);
  const spots = DAL ? [[7, 0], [7, -1.3], [7, 1.3], [9, 0], [5, -1.3]].map(([k, s]) => pierAt(k, s)) : [pierAt(9, 0)];
  const fishAt = spots.find((p) => Math.min(99, ...tourists.map((t) => Math.hypot(t.x - p.x, t.z - p.z))) >= 4) || spots[0];
  await page.evaluate((p) => window.PlazaWarp(p.x, p.z), fishAt);
  await holdTool(page, 'fishing_rod');
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 낚시', { timeout: 15000 });
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().fishing()?.phase), { timeout: 10000 }).toMatch(/cast|wait/);
  expect(await view()).toBe('first'); // (the cast: still the first)
  if (process.env.SHOT_DIR) { await page.waitForTimeout(2500); await page.screenshot({ path: `${process.env.SHOT_DIR}/pc-fp-fishing-wait.png` }); }
  await expect.poll(async () => {
    if (!(await page.evaluate(() => window.PlazaDebug().fishing()?.phase))) { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); return 'cast again'; }
    await page.evaluate(() => window.PlazaDebug().fishBiteNow(12)); return page.locator('#plazaHint').textContent();
  }, { timeout: 40000, intervals: [1500] }).toMatch(/^입질! 화살표/);
  expect(await view()).toBe('first'); // (the bite)
  expect((await post(request, '/api/test/fish/bite', token, { species: 'mackerel', slack: 20000 })).data.ok).toBe(true);
  await pressFishArrows(page, false);
  if (process.env.SHOT_DIR) { await page.waitForTimeout(700); await page.screenshot({ path: `${process.env.SHOT_DIR}/pc-fp-fishing-catch.png` }); }
  await expect.poll(async () => ((await get(request, '/api/island/bag', token)).data.items || []).find((e) => e.itemId === 'fish_mackerel')?.qty || 0, { timeout: 10000 }).toBe(1);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().fishing()), { timeout: 10000 }).toBe(null);
  expect(await view()).toBe('first'); // (after it: the first still)
  await expectNoScriptError(page); await who.context.close();
});
