const { test, expect } = require('@playwright/test');
const { shopper, expectNoScriptError } = require('./skin-support');
const T = require('../../public/plaza/island-terrain.js');

// v1.10.219 대화 자리 잡기 (총괄 218 검토): a tree on the talk camera's line -- the camera goes to the other side; an islander
// caught further off -- I walk up to the talking distance; the station's keeper (철이) faces the path where people come by.
// With SHOT_DIR: 물결·콩이 talked to (talk-facing-photo.spec.js has them too).
test('대화 자리 잡기: 나무 피하는 대화 카메라, 먼 주민에게 걸어가 서기, 역 철이 길 쪽', async ({ browser, request, isMobile }) => {
  test.setTimeout(240000);
  await request.post('/api/test/roster', { data: { on: true, day: '2026-11-13' } });
  const who = await shopper(browser, request, isMobile ? '자리잡기m' : '자리잡기', 0, 'female'); const { page } = who;
  try {
    await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); localStorage.setItem('gc.view.out', 'third'); });
    await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
    const d = (fn, ...a) => page.evaluate(([f, args]) => window.PlazaDebug()[f](...args), [fn, a]);
    // the camera: a tree halfway along its line from my right -- not that side
    const S = T.natureSolids(); const tree = S.find((o) => o.r > 0.6 && Math.hypot(o.x, o.z) > 30 && T.walkable(o.x - 2.1, o.z - 0.05) && T.walkable(o.x - 2.1, o.z + 1.55));
    const side = await d('talkSideAt', tree.x - 2.1, tree.z - 0.05, tree.x - 2.1, tree.z + 1.55);
    expect(side, `나무 ${JSON.stringify(tree)}`).not.toEqual([1, 1]);
    // the station's keeper or its story 철이: facing the way beside it
    await expect.poll(async () => (await d('residentPosts')).some((p) => p.id === 'station:keeper' || p.id === 'ev:quest_npc:queststationmaster'), { timeout: 30000 }).toBe(true);
    const st = (await d('residentPosts')).find((p) => p.id === 'station:keeper' || p.id === 'ev:quest_npc:queststationmaster');
    expect(T.walkDist(st.x + Math.sin(st.yaw) * 2, st.z + Math.cos(st.yaw) * 2), `철이 ${JSON.stringify(st)}`).toBeLessThan(0.5);
    if (process.env.SHOT_DIR) { /* (from the path, 3 m before it) */
      await page.evaluate((s) => { const g = window.PlazaDebug(); g.teleport(s.x + Math.sin(s.yaw) * 3, s.z + Math.cos(s.yaw) * 3); g.setCamYaw(s.yaw + 0.25); g.setCamPitch?.(0.05); }, st); await page.locator('#plazaStage').focus(); for (let k = 0; k < 4; k += 1) await page.keyboard.press('KeyQ');
      await page.waitForTimeout(1500); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-station.png` });
    }
    // a walker talked to from further off: I end at about the talking distance (1.6 m)
    const talking = () => page.evaluate(() => /talkMode/.test(document.getElementById('plazaDialog').className));
    let gaps = [];
    for (const n of [11, 14]) {
      await expect.poll(async () => { if (await talking()) return true; await d('talkResident', n); await page.waitForTimeout(1500); return talking(); }, { timeout: 30000 }).toBe(true);
      await expect.poll(async () => (await page.evaluate(() => window.PlazaDebug().talkView))?.gap ?? 9, { timeout: 8000 }).toBeLessThan(2.0);
      gaps.push((await page.evaluate(() => window.PlazaDebug().talkView)).gap);
      if (process.env.SHOT_DIR) { await page.waitForTimeout(1200); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-talk-${n}.png` }); }
      await page.keyboard.press('Escape'); await page.waitForTimeout(800);
    }
    expect(Math.min(...gaps)).toBeGreaterThan(1.0);
    await expectNoScriptError(page);
  } finally { await request.post('/api/test/roster', { data: { on: false } }); }
  await who.context.close();
});
