const { test, expect } = require('@playwright/test');
const { shopper, post, expectNoScriptError } = require('./skin-support');

// R2 ① 주민이 먼저 말 걸기: an islander I know (아는 사이 and on) says a line over their head as I pass by -- one I have not
// met yet says nothing. PC and phone.
test('주민이 먼저 말 걸기: 아는 사이 주민 곁을 지나면 머리 위 인사, 처음 본 주민은 조용', async ({ browser, request, isMobile }) => {
  test.setTimeout(180000);
  const who = await shopper(browser, request, isMobile ? '인사받기m' : '인사받기', 0, 'male'); const { page, token } = who;
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }); await page.reload(); // (the stand-ins: the greeting needs no models)
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  await post(request, '/api/test/island/free-residents', token, {});
  const known = 4; const stranger = 6;
  expect((await post(request, '/api/test/affinity', token, { n: known, delta: 6 })).data.points).toBe(6); // 아는 사이
  const { get } = require('./skin-support'); const mine = (await get(request, '/api/island/affinity', token)).data.residents;
  await page.evaluate((list) => window.PlazaDebug().setAffinity(list), mine); // (as the page hears it after a talk)
  // by the stranger: nothing; by the one I know: their greeting
  const passBy = (n) => expect.poll(async () => {
    await page.evaluate((list) => window.PlazaDebug().setAffinity(list), mine); // (the page's own first read may land after)
    await page.evaluate(async (n) => { const w = window.PlazaDebug().wanderers.find((o) => o.n === n); if (w) await window.PlazaWarp(w.x + 2, w.z); }, n);
    await page.waitForTimeout(700);
    return page.evaluate((n) => window.PlazaDebug().greeted().includes(n), n);
  }, { timeout: 40000, intervals: [1000] });
  await page.evaluate(async (n) => { const w = window.PlazaDebug().wanderers.find((o) => o.n === n); if (w) await window.PlazaWarp(w.x + 2, w.z); }, stranger);
  await page.waitForTimeout(1500);
  expect(await page.evaluate((n) => window.PlazaDebug().greeted().includes(n), stranger)).toBe(false);
  await passBy(known).toBe(true).catch(async (error) => { error.message += `\nstate: ${JSON.stringify(await page.evaluate((n) => window.PlazaDebug().greetState(n), known))}`; throw error; });
  expect(await page.evaluate((n) => window.PlazaDebug().residentBubble(n), known)).toBeTruthy();
  if (process.env.ZZ_SHOT) await page.screenshot({ path: `${process.env.ZZ_SHOT}-${isMobile ? 'phone' : 'pc'}.png` });
  await expectNoScriptError(page); await who.context.close();
});
