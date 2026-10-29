const { test, expect } = require('@playwright/test');
const { shopper, post, expectNoScriptError } = require('./skin-support');

// V1 총괄 검토 (gamecenter-notes docs/view-modes-20261029.md 「1인칭 대화 = 마주 보기」): a talk in the first framed by who
// they are -- at their eyes' height, far enough that head to shoulders is about half the screen (1.2 m at the least),
// their face in the upper third over the talk window, the whole head on screen; a soft light on them while we talk.
// 해송 (a big head), 가람 (small) -- and 바위 when the builder stands in the village. PC and phone.
test('1인칭 대화 구도: 눈높이·머리부터 어깨·얼굴은 위쪽 1/3, 대화 중 보조광', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.CI ? 300000 : 200000);
  const who = await shopper(browser, request, isMobile ? '마주봄m' : '마주봄', 0, 'female'); const { page } = who;
  await page.evaluate((shots) => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); localStorage.setItem('gc.view.out', 'first'); if (!shots) localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }, Boolean(process.env.SHOT_DIR));
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  expect((await page.evaluate(() => window.PlazaDebug().view())).mode).toBe('first');
  const dialog = page.locator('#plazaDialog'); const talking = async () => /talkMode/.test(await dialog.getAttribute('class') || '');
  const framed = async (name) => {
    await expect.poll(async () => { const a = await page.evaluate(() => window.PlazaDebug().talkAim()); return a && a.eyeY > 0.12 && a.eyeY < 0.6 && a.topY < 0.98 && Math.abs(a.x) < 0.2; }, { timeout: 15000 }).toBe(true);
    const a = await page.evaluate(() => window.PlazaDebug().talkAim()); expect(a.fill).toBeGreaterThan(0); expect(a.dist).toBeGreaterThan(1.1);
    if (process.env.SHOT_DIR) { await page.waitForTimeout(1200); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-talk-${name}.png` }); }
    await expect.poll(async () => { if (await talking()) await page.evaluate(() => document.getElementById('plazaDialog').close()); return talking(); }, { timeout: 15000 }).toBe(false); /* (CI: a late talk request opened it again -- closed again) */
    expect((await page.evaluate(() => window.PlazaDebug().talkAim()))).toBe(null); expect((await page.evaluate(() => window.PlazaDebug().view())).fov).toBe(75);
  };
  for (const [n, name] of [[1, 'haesong'], [9, 'garam']]) {
    await expect.poll(async () => {
      if (!await talking()) { await post(request, '/api/test/island/free-residents', who.token, {}); await page.evaluate(async (n) => { const w = window.PlazaDebug().wanderers.find((o) => o.n === n); if (w) { await window.PlazaWarp(w.x + 1.0, w.z); window.PlazaDebug().talkResident(n); } }, n); await page.waitForTimeout(900); }
      return talking();
    }, { timeout: 120000, intervals: [300] }).toBe(true);
    await framed(name);
  }
  // 바위 (the builder, a quest islander in the village) when he stands there this week
  const builder = await page.evaluate(() => Boolean(window.PlazaDebug().doors?.['ev:quest_npc:questbuilder'] || null));
  if (builder) {
    await expect.poll(async () => { if (!await talking()) { await page.evaluate(() => window.PlazaDebug().place('ev:quest_npc:questbuilder')); await page.waitForTimeout(500); if (isMobile) await page.locator('#plazaHint').click().catch(() => {}); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); } await page.waitForTimeout(900); } return talking(); }, { timeout: 60000 }).toBe(true);
    await framed('bawi');
  }
  await expectNoScriptError(page); await who.context.close();
});
