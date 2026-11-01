const { test, expect } = require('@playwright/test');
const { shopper, post, expectNoScriptError } = require('./skin-support');

// v1.10.218 1인칭 다듬기 (gamecenter-notes docs/controls-fp-revamp-20261030.md B4~6): the first person's walk rises and falls a
// little (none standing, off in ☰), the tool in hand is drawn at the screen's lower right (it swings with the net), and the
// SPACE target is marked. With SHOT_DIR: the photos.
test('1인칭 다듬기: 걸음 흔들림·☰ 끄기, 든 도구가 화면에, SPACE 대상 표시', async ({ browser, request, isMobile }) => {
  test.setTimeout(240000);
  const who = await shopper(browser, request, isMobile ? '일인칭m' : '일인칭', 0, 'female'); const { page } = who;
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testHalloween', 'off'); localStorage.setItem('gc.testRealView', '1'); localStorage.setItem('gc.view.out', 'first'); localStorage.setItem('gc.view.in', 'first'); });
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  const shot = async (name, wait = 1200) => { if (!process.env.SHOT_DIR) return; await page.waitForTimeout(wait); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-${name}.png` }); };
  const d = (fn, arg) => page.evaluate(([f, a]) => window.PlazaDebug()[f](a), [fn, arg]);
  await expect.poll(async () => (await d('view')).mode, { timeout: 20000 }).toBe('first');
  // B4: standing still -- no bob; walking -- some; ☰ off -- none
  expect((await d('bob')).amp).toBe(0);
  if (!isMobile) {
    const walkAmp = async () => { await page.locator('#plazaStage').focus(); await page.keyboard.down('KeyW'); let most = 0; for (let k = 0; k < 12; k += 1) { await page.waitForTimeout(100); most = Math.max(most, (await d('bob')).amp); } await page.keyboard.up('KeyW'); return most; }; /* (the most in 1.2 s walking) */
    expect(await walkAmp()).toBeGreaterThan(0.01);
    await page.waitForTimeout(800); expect((await d('bob')).amp).toBe(0);
    await page.keyboard.press('Escape'); const box = page.locator('#walkBobToggle'); await expect(box).toBeChecked(); await box.uncheck(); await page.keyboard.press('Escape');
    expect((await d('bob')).on).toBe(false); expect(await walkAmp()).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('gc.walkBob'))).toBe('off');
  }
  // B5: the net in hand -- drawn in the first; out of the bag -- gone
  expect((await d('fpHand')).shown).toBe(false);
  expect((await post(request, '/api/test/island/give', who.token, { itemId: 'bugnet', qty: 1 })).status).toBe(200);
  await page.keyboard.press('KeyI');
  await page.locator('.islandBagSlot[data-item="bugnet"]').first().click(); await page.locator('#islandBagGrid button', { hasText: '들기' }).first().click();
  await expect.poll(() => d('heldTool')).toBe('bugnet');
  await page.evaluate(() => window.PlazaWarp(30, 0)); await page.evaluate(() => window.PlazaDebug().setCamPitch?.(0));
  await expect.poll(async () => (await d('fpHand')).tool, { timeout: 20000 }).toBe(true); console.log(JSON.stringify(await page.evaluate(() => new Promise((done) => { const out = []; const t0 = performance.now(); const tick = () => { out.push(window.PlazaDebug().fpHand().fist); if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else done(out); }; tick(); }))));
  await shot('fp-net'); console.log(JSON.stringify(await d('fpHand')));
  await page.evaluate(() => window.PlazaDebug().swingNow()); await shot('fp-net-swing', 300);
  // B6: the board 1.4 m before me -- a ring under it; standing on it -- none
  await page.evaluate(() => window.PlazaDebug().place('board')); await page.waitForTimeout(500);
  const b = await page.evaluate(() => [window.PlazaDebug().x, window.PlazaDebug().z]);
  await page.evaluate(([x, z]) => { const p = window.PlazaDebug(); p.teleport(x + 1.4, z); p.setCamYaw(Math.PI / 2); p.setCamPitch?.(0.35); }, b);
  await expect.poll(() => d('targetRing'), { timeout: 10000 }).toMatchObject({ id: 'board' });
  await shot('fp-target');
  await page.evaluate(() => window.PlazaDebug().place('board')); await expect.poll(() => d('targetRing'), { timeout: 10000 }).toBeNull();
  // B5 again: the rod in hand; then nothing held -- nothing drawn
  expect((await post(request, '/api/test/island/give', who.token, { itemId: 'fishing_rod', qty: 1 })).status).toBe(200);
  const hold = async (item) => { await page.keyboard.press('KeyI'); await page.locator(`.islandBagSlot[data-item="${item}"]`).first().click(); await page.locator('#islandBagGrid button', { hasText: /들기|넣기/ }).first().click(); };
  await hold('fishing_rod'); await expect.poll(() => d('heldTool')).toBe('fishing_rod');
  await page.evaluate(() => window.PlazaWarp(30, 0)); await page.evaluate(() => { window.PlazaDebug().setCamPitch?.(0); });
  await expect.poll(async () => (await d('fpHand')).tool, { timeout: 20000 }).toBe(true); await shot('fp-rod');
  await hold('fishing_rod'); await expect.poll(() => d('heldTool')).toBeNull(); expect((await d('fpHand')).shown).toBe(false);
  await expectNoScriptError(page); await who.context.close();
});
