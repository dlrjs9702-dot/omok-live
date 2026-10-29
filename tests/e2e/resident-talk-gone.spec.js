const { test, expect } = require('@playwright/test');
const { shopper, post, expectNoScriptError } = require('./skin-support');

// Q2 「대화 창 저절로 닫힘」: a talk is over only when I walked off or someone else talks to them now -- and the window says
// which as it closes (here: my hold let go and another player talking to them -- 「○○가 다른 일로 가 봐야 한대요」)
test('주민 대화: 남이 그 주민과 이야기하게 되면 까닭을 알리고 닫힘', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.CI ? 300000 : 150000);
  const who = await shopper(browser, request, isMobile ? '대화끝m' : '대화끝', 0, 'female'); const { page, token } = who;
  const b = await shopper(browser, request, isMobile ? '끼어들m' : '끼어들', 0, 'male');
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); });
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const dialog = page.locator('#plazaDialog'); const talking = async () => /talkMode/.test(await dialog.getAttribute('class') || '');
  const n = 2;
  await expect.poll(async () => {
    if (!await talking()) { await post(request, '/api/test/island/free-residents', token, {}); await page.evaluate(async (n) => { const w = window.PlazaDebug().wanderers.find((o) => o.n === n); if (w) await window.PlazaWarp(w.x + 1.1, w.z); window.PlazaDebug().talkResident(n); }, n); await page.waitForTimeout(800); }
    return talking();
  }, { timeout: 120000, intervals: [300] }).toBe(true);
  // my hold let go (as a late bye would) and the other player talking to them now
  await post(request, '/api/island/resident/bye', token, { n });
  await expect.poll(async () => { const at = await page.evaluate(() => [window.PlazaDebug().x, window.PlazaDebug().z]); await post(request, '/api/plaza/state', b.token, { x: at[0] + 0.8, z: at[1] + 0.8, yaw: 0, moving: false }); return (await post(request, '/api/island/resident/talk', b.token, { n })).status; }, { timeout: 30000 }).toBe(200);
  // (the reason either way: the renewal's 「다른 일로 가 봐야 한대요」, or -- CI #353 mobile-3, a slow phone -- my own talk request
  // reaching the server after theirs: 「지금은 ○○님과 이야기 중이에요」)
  await expect(page.locator('#toast')).toContainText(/다른 일로 가 봐야 한대요|님과 이야기 중이에요/, { timeout: 15000 });
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-talk-gone.png` });
  await expect.poll(talking, { timeout: 10000 }).toBe(false);
  await expectNoScriptError(page); await who.context.close(); await b.context.close();
});
