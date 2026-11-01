const { test, expect } = require('@playwright/test');
const { shopper, post, adminToken, expectNoScriptError, spaceOn, holdTool } = require('./skin-support');
const P = require('../../public/plaza/island-projects.js');

// v1.10.224 섬 가꾸기 3 (gamecenter-notes docs/spending-sinks-20261025.md ①): 동쪽 강 새 다리 -- walked over the gorge to the east
// meadow; 능선 전망대 -- SPACE at its back step looks through the telescope at the glacier (Esc back); 야경 조명's lights throw
// a soft beam up the fountain and the lighthouse by night (총괄 223 검토). PC and phone; SHOT_DIR photos (night before/after).
test('섬 가꾸기 3: 새 다리 건너기, 전망대 망원경, 밤 투광등 빛', async ({ browser, request, isMobile }) => {
  test.setTimeout(300000);
  const a = await shopper(browser, request, isMobile ? '다리미m' : '다리미', 0, 'female'); const { page } = a;
  const tp = (body) => post(request, '/api/test/projects', a.token, body);
  const admin = await adminToken(request); const time = (mode) => request.post('/api/admin/island/time', { headers: { 'X-Session-Token': admin }, data: { mode } });
  await tp({ reset: true }); await tp({ open: ['fountain', 'flower_path', 'promenade', 'night_lights', 'bridge', 'lookout'] });
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); localStorage.setItem('gc.view.out', 'third'); }); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  const shot = async (name, wait = 1500) => { if (!process.env.SHOT_DIR) return; await page.waitForTimeout(wait); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-${name}.png` }); };
  const scene = () => page.evaluate(() => window.PlazaDebug().projects());
  try {
    await time('day');
    await expect.poll(async () => (await scene()).bits, { timeout: 20000 }).toContain('open:lookout'); expect((await scene()).bridge).toBe(true);
    // the bridge: on its middle, over the water -- up its arch
    const B = P.BRIDGE; await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [B.x, B.z]); await page.waitForTimeout(600);
    const on = await page.evaluate(() => ({ x: window.PlazaDebug().x, z: window.PlazaDebug().z, y: window.PlazaDebug().y ?? window.PlazaDebug().pose?.().y }));
    expect(Math.hypot(on.x - B.x, on.z - B.z)).toBeLessThan(0.6); expect(await page.evaluate(([x, z]) => window.IslandTerrain.walkable(x, z), [B.x, B.z])).toBe(true);
    const lookAt = (px, pz, tx, tz, pitch = 0.12) => page.evaluate(([px, pz, tx, tz, pitch]) => { const g = window.PlazaDebug(); g.teleport(px, pz); g.setCamYaw(Math.atan2(-(tx - px), -(tz - pz))); g.setCamPitch?.(pitch); }, [px, pz, tx, tz, pitch]);
    await page.evaluate(([yaw]) => window.PlazaDebug().setCamYaw(yaw), [B.yaw]); await shot('bridge-on'); // (on it, toward 강 어귀 낚시터 and the sea)
    await page.evaluate(([yaw]) => window.PlazaDebug().setCamYaw(yaw + Math.PI * 0.55), [B.yaw]); await shot('bridge-on-upriver'); // (from it, up 은하내)
    await lookAt(152.5, -5.5, B.x, B.z); await shot('bridge-side'); // (from the walk's end on the bank)
    if (process.env.SHOT_DIR) { await page.evaluate(([x, z]) => window.PlazaDebug().overview(true, [x, 34, z]), [B.x - 4, B.z + 2]); await shot('bridge-above', 2500); await page.evaluate(() => window.PlazaDebug().overview(false)); }
    // 강 어귀 낚시터: across it, the rod in hand -- SPACE fishes there (the map names it)
    expect((await post(request, '/api/test/island/give', a.token, { itemId: 'fishing_rod', qty: 1 })).status).toBe(200);
    await holdTool(page, 'fishing_rod');
    const S = P.FISHING_SPOT; await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [S.x, S.z]);
    await expect.poll(() => page.evaluate(() => Boolean(window.PlazaDebug().doors?.['fish:mouth'])), { timeout: 10000 }).toBe(true);
    await expect.poll(async () => { if (await page.evaluate(() => window.PlazaDebug().fishing())) return true; await spaceOn(page, 'fish:', isMobile); await page.waitForTimeout(1200); return Boolean(await page.evaluate(() => window.PlazaDebug().fishing())); }, { timeout: 20000 }).toBe(true);
    await shot('fishing', 1800);
    // (총괄 224 CI: the line still out when one walks off holds SPACE to it -- reeled in and the rod put away first)
    await expect.poll(async () => { if (!(await page.evaluate(() => window.PlazaDebug().fishing()))) return true; await spaceOn(page, 'fish:', isMobile); await page.waitForTimeout(1500); return !(await page.evaluate(() => window.PlazaDebug().fishing())); }, { timeout: 30000 }).toBe(true);
    await page.keyboard.press('KeyI'); await page.locator('.islandBagSlot[data-item="fishing_rod"]').first().click(); await page.locator('#islandBagGrid button', { hasText: '넣기' }).first().click(); await expect.poll(() => page.evaluate(() => window.PlazaDebug().heldTool()), { timeout: 10000 }).toBeNull();
    // the lookout: SPACE at its back step -- through the telescope; Esc back
    const L = P.LOOKOUT; await page.evaluate(([x, z]) => { const g = window.PlazaDebug(); g.teleport(x + 6, z + 4); g.setCamYaw(1.0); g.setCamPitch?.(0.15); }, [L.x, L.z]);
    await shot('lookout');
    await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x + 0.6, z), [L.door.x, L.door.z]);
    await expect.poll(() => spaceOn(page, 'lookout:scope', isMobile), { timeout: 10000 }).toBe(true);
    await expect.poll(async () => (await scene()).scope, { timeout: 5000 }).toBe(true); await shot('scope', 2500);
    if (isMobile) await page.locator('.scopeFrame button').click(); else await page.keyboard.press('Escape');
    await expect.poll(async () => (await scene()).scope, { timeout: 5000 }).toBe(false);
    // night: the beams at the fountain and the lighthouse (before: hidden for the photo; after: as they are)
    await time('night'); await expect.poll(async () => (await scene()).beams, { timeout: 30000 }).toBe(P.UPLIGHTS.length);
    const u = P.UPLIGHTS[0]; const H = P.UPLIGHTS[4];
    for (const [name, at, yaw] of [['fountain', [u.x, u.z + 8], 0.1], ['lighthouse', [H.x + 6, H.z + 9], 0.6]]) {
      await page.evaluate(([x, z, yw]) => { const g = window.PlazaDebug(); g.teleport(x, z); g.setCamYaw(yw); g.setCamPitch?.(0.25); }, [...at, yaw]);
      if (process.env.SHOT_DIR) { await page.evaluate(() => window.PlazaDebug().beams(false)); await shot(`night-${name}-before`, 2500); await page.evaluate(() => window.PlazaDebug().beams(true)); await shot(`night-${name}-after`, 800); }
    }
    await time('day'); await expect.poll(async () => (await scene()).beams, { timeout: 30000 }).toBe(0);
  } finally { await time('auto'); await tp({ reset: true }); }
  await expectNoScriptError(page); await a.context.close();
});
