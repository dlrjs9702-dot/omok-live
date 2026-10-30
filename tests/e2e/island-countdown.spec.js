const { test, expect } = require('@playwright/test');
const { shopper, adminToken, expectNoScriptError } = require('./skin-support');
const C = require('../../public/plaza/island-calendar.js');

// X2 카운트다운 (gamecenter-notes docs/asset-proposal-christmas-20261027.md 「X2 행사 결정」): the board on 대청마당 at 23:00 with
// minutes and seconds, the last ten seconds big (the test's clock running on from 23:59:50), at midnight the fireworks and,
// round the board, the title 「해피 뉴 이어」 by itself. The first person sees the board and the fireworks too. PC and phone.
test('카운트다운: 23시 판 분:초 → 마지막 10초 → 0시 불꽃·칭호(둘레), 1인칭에서도', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.CI ? 300000 : 200000);
  const clock = (s, tick = false) => request.post('/api/test/festival/clock', { data: { at: s ? Date.parse(`${s}+09:00`) : 0, tick } });
  const who = await shopper(browser, request, isMobile ? '새해m' : '새해', 0, 'female'); const { page } = who;
  const admin = process.env.SHOT_DIR ? await adminToken(request) : null; const night = (mode) => admin && request.post('/api/admin/island/time', { headers: { 'X-Session-Token': admin }, data: { mode } }); // (the photos: the island at night, as on the real midnight)
  await night('night');
  try {
    await page.evaluate((shots) => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); localStorage.setItem('gc.view.out', 'third'); if (!shots) localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }, Boolean(process.env.SHOT_DIR));
    const B = C.PLACES.board; const shot = async (name) => { if (process.env.SHOT_DIR) { await page.waitForTimeout(800); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-countdown-${name}.png` }); } };
    const cd = () => page.evaluate(() => window.PlazaDebug().countdown());
    const look = async () => page.evaluate((b) => { const d = window.PlazaDebug(); d.teleport(b.x + 5, b.z + 10); d.faceTo?.(b.x, b.z); d.setCamYaw(Math.atan2(5, 10)); }, B); // (on the disc's side, the board ahead)
    // 23:00: the board up, minutes and seconds
    await clock('2026-12-31T23:00:00');
    await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
    await look(); await expect.poll(async () => (await cd())?.phase, { timeout: 30000 }).toBe('clock');
    expect((await cd()).text).toMatch(/^clock:(60:00|59:[0-5]\d)$/); /* (the page's clock runs on from the server's 23:00) */ await shot('2300');
    // 23:59:50 running on: the last ten seconds big, then the new year -- fireworks, and round the board the title
    await clock('2026-12-31T23:59:50', true);
    await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
    await look(); await expect.poll(async () => (await cd())?.phase, { timeout: 15000 }).toBe('last');
    await shot('last');
    await expect.poll(async () => (await cd())?.phase, { timeout: 20000 }).toBe('new');
    if (process.env.SHOT_DIR) { await page.waitForTimeout(2400); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-countdown-fireworks.png` }); } // (0:00:02~3 -- the volley bursting)
    await expect.poll(async () => (await cd())?.sparks || 0, { timeout: 10000 }).toBeGreaterThan(0);
    const st = await cd(); expect(st.sparks).toBeLessThanOrEqual(st.cap); expect(st.cap).toBe(isMobile ? 200 : 600); expect(st.near).toBe(true);
    await expect(page.locator('#toast')).toContainText('해피 뉴 이어', { timeout: 15000 });
    // the first person: the board and the sparks in my eyes
    if (isMobile) await page.locator('#islandViewTab').click(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('KeyV'); }
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().view().mode)).toBe('first');
    await page.evaluate(() => { const d = window.PlazaDebug(); d.setCamYaw(Math.atan2(5, 10)); d.setCamPitch(-0.5); }); await page.waitForTimeout(400); /* (looking up, as the midnight did) */
    expect((await cd()).sparks).toBeGreaterThan(0); await shot('fireworks-first');
    await expectNoScriptError(page);
  } finally { await clock(null); await night('auto'); await who.context.close(); }
});
