const { test, expect } = require('@playwright/test');
const { shopper, post } = require('./skin-support');
// A-7 (사용자 2026-10-19 「시장님이 길 비켜 줄 때 엄청나게 떨면서 비켜」): with the real models his 1.6 m/s steps are the
// slow-walk gait, which the yard once took for a motion in progress -- he stopped, idled, went on, every other frame. The
// island test spec's stand-in characters have no gaits, so this one runs with the models: a few changes of gait at most.
test('관공서 시장: 허락 뒤 비켜설 때 걸음이 끊기지 않는다(모델)', async ({ browser, request }) => {
  test.setTimeout(240000);
  const a = await shopper(browser, request, '시장걸음', 0, 'male'); const { page } = a;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  expect((await post(request, '/api/test/townhall-strict', a.token, {})).status).toBe(200);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().townhall().pass), { timeout: 15000 }).toBe(false);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().townhall().gait), { timeout: 60000 }).not.toBe(null);
  await page.evaluate(() => window.PlazaDebug().place('townhall'));
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 말 걸기', { timeout: 20000 });
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect(page.locator('#plazaDialog')).toHaveClass(/talkMode/); await page.keyboard.press('Space');
  // every frame, while he goes out and aside
  const gaits = await page.evaluate(() => new Promise((done) => { const out = []; const t0 = performance.now(); const f = () => { const t = window.PlazaDebug().townhall(); out.push(`${t.gait}@${t.mayorAt.x},${t.mayorAt.z}`); if (performance.now() - t0 < 15000) requestAnimationFrame(f); else done(out); }; requestAnimationFrame(f); }));
  let flips = 0; for (let i = 1; i < gaits.length; i += 1) if (gaits[i].split('@')[0] !== gaits[i - 1].split('@')[0]) flips += 1;
  expect(flips).toBeLessThan(8);
  await a.context.close(); // (CI #330: a page left open draws the island for the rest of the worker's run)
});
