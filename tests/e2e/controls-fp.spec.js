const { test, expect } = require('@playwright/test');
const { shopper, adminToken, intoMall, liftTo, expectNoScriptError } = require('./skin-support');

// v1.10.217 조작·1인칭 개편 (gamecenter-notes docs/controls-fp-revamp-20261030.md A·B1~3): W/A/S/D walk, the arrows turn the
// view and walk nowhere; the mouse looks (a locked pointer -- headless has none, so PlazaDebug().lookBy plays its movement) at
// the ☰ 감도; a window open lets the lock go; the first person at 70°, the eyes by the head (not the hat), up 75° · down 70°.
// With SHOT_DIR: the first person at the plaza, the 백화점 1층 counter and the 3층 tables (BEFORE=1 against an older server:
// the photos only).
test('조작·1인칭: W/A/S/D 걷기·방향키 시점·마우스 보기·감도·창 열면 풀림, 1인칭 70°·눈높이', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.SHOT_DIR ? 400000 : 240000);
  const who = await shopper(browser, request, isMobile ? '조작구경m' : '조작구경', 0, 'female'); const { page } = who;
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); localStorage.setItem('gc.view.out', 'first'); localStorage.setItem('gc.view.in', 'first'); });
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  const admin = await adminToken(request); const set = (what, mode) => request.post(`/api/admin/island/${what}`, { headers: { 'X-Session-Token': admin }, data: { mode } });
  const shot = async (name, wait = 1500) => { if (!process.env.SHOT_DIR) return; await page.waitForTimeout(wait); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-${process.env.BEFORE ? 'before' : 'after'}-${name}.png` }); };
  const view = () => page.evaluate(() => window.PlazaDebug().view());
  const at = () => page.evaluate(() => [window.PlazaDebug().x, window.PlazaDebug().z]);
  try {
    if (process.env.SHOT_DIR) { await set('time', 'day'); await set('weather', 'clear'); }
    await expect.poll(async () => (await view()).mode, { timeout: 20000 }).toBe('first');
    const v = await view();
    if (!process.env.BEFORE) {
      expect(v.fov).toBe(70); expect(v.eye).toBeGreaterThan(0.6); expect(v.eye).toBeLessThan(1.6); // (the eyes by the head: a person's about 1.0~1.3 m)
      if (!isMobile) {
        const hold = async (key, ms = 700) => { await page.locator('#plazaStage').focus(); await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(300); };
        // W walks where I look; the arrows turn the look and walk nowhere
        let a = await at(); await hold('KeyW'); let b = await at(); expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeGreaterThan(0.3);
        a = b; const yaw = (await view()).yaw; await hold('ArrowLeft'); b = await at();
        expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeLessThan(0.05); expect(Math.abs((await view()).yaw - yaw)).toBeGreaterThan(0.3);
        // the mouse looks (as locked): right turns right, up looks up; the ☰ 감도 doubles it
        const y0 = (await view()).yaw; await page.evaluate(() => window.PlazaDebug().lookBy(100, 0)); await page.waitForTimeout(500); const turned = y0 - (await view()).yaw; expect(turned).toBeGreaterThan(0.15);
        const p0 = (await view()).pitch; await page.evaluate(() => window.PlazaDebug().lookBy(0, -400)); await page.waitForTimeout(500); expect((await view()).pitch).toBeLessThan(p0 - 0.5);
        await page.evaluate(() => window.PlazaDebug().lookBy(0, -4000)); await page.waitForTimeout(600); expect((await view()).pitch).toBeGreaterThan(-1.32); // (up 75° at most)
        await page.evaluate(() => window.PlazaDebug().lookBy(0, 8000)); await page.waitForTimeout(600); expect((await view()).pitch).toBeLessThan(1.23); // (down 70°)
        await page.evaluate(() => window.PlazaDebug().lookBy(0, -2700)); await page.waitForTimeout(300); // (back near level)
        await page.keyboard.press('Escape'); await expect(page.locator('#gameMenu, #menuDialog').first()).toBeVisible({ timeout: 10000 }).catch(() => {});
        const sens = page.locator('#mouseSensInput'); await expect(sens).toBeAttached();
        await sens.evaluate((el) => { el.value = '2'; el.dispatchEvent(new Event('input', { bubbles: true })); });
        expect((await page.evaluate(() => window.PlazaDebug().pointerLock())).sens).toBe(2);
        expect((await page.evaluate(() => window.PlazaDebug().pointerLock())).ok).toBe(false); // (a window open: no lock)
        await page.keyboard.press('Escape'); await expect.poll(() => page.evaluate(() => window.PlazaDebug().pointerLock().ok), { timeout: 10000 }).toBe(true);
        const y1 = (await view()).yaw; await page.evaluate(() => window.PlazaDebug().lookBy(100, 0)); await page.waitForTimeout(500); expect(y1 - (await view()).yaw).toBeGreaterThan(turned * 1.6);
      }
    }
    await page.evaluate(() => { const p = window.PlazaDebug(); p.place('board'); p.setCamPitch?.(0); }); await shot('plaza');
    await intoMall(page, null, isMobile);
    await page.evaluate(() => { const S = window.IslandStore; const s = S.SECTORS.find((x) => x.keeper); const c = S.world(s.interact[0], s.interact[1]); const k = S.world(s.keeper[0], s.keeper[1]); const p = window.PlazaDebug(); const w = { x: c.x + (c.x - k.x) * 0.6, z: c.z + (c.z - k.z) * 0.6 }; p.teleport(w.x, w.z); p.faceTo?.(k.x, k.z); p.setCamYaw(Math.atan2(-(k.x - w.x), -(k.z - w.z))); p.setCamPitch?.(0); }); await shot('mall1'); // (the customer's side, the counter and its keeper ahead)
    await liftTo(page, 3, isMobile);
    await page.evaluate(() => { const F = window.IslandFurniture; const s = F.SLOTS.find((x) => x.kind === 'floor') || F.SLOTS[0]; const w = F.world(s.lx, s.lz - 2.6); const p = window.PlazaDebug(); p.teleport(w.x, w.z); const t = F.world(s.lx, s.lz); p.faceTo?.(t.x, t.z); p.setCamYaw(Math.atan2(-(t.x - w.x), -(t.z - w.z))); p.setCamPitch?.(0); }); await shot('mall3');
    await expectNoScriptError(page); await who.context.close();
  } finally {
    if (process.env.SHOT_DIR) { await set('time', 'auto'); await set('weather', 'auto'); }
  }
});
