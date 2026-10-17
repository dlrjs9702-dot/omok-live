const { test, expect } = require('@playwright/test');
const { shopper, expectNoScriptError } = require('./skin-support');

// v1.10.89 행동 중 이동 잠금 (IDEAS #future-action-move-lock): an emote holds me in place until its clip has played out,
// the arrow kept pressed moves me right after; a second emote meanwhile is not taken. PC 전용 (the phone's stick feeds the
// same step()).
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

test('이모트 도중엔 서 있고, 끝나면 누르고 있던 방향키로 바로 움직임', async ({ browser, request }) => {
  test.setTimeout(120000);
  const who = await shopper(browser, request, '잠금', 500000, 'male');
  const { page } = who;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 30000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().assets?.ready ?? true), { timeout: 30000 }).toBeTruthy();
  await page.locator('#plazaStage').focus();
  const at = () => page.evaluate(() => ({ x: window.PlazaDebug().x, z: window.PlazaDebug().z, locked: window.PlazaDebug().actLocked }));

  // (one evaluate: a PlazaDebug() call alone took over a second on a slow runner, longer than the lock itself)
  const first = await page.evaluate(() => { const d = window.PlazaDebug(); const wave = d.emote('wave'); const cheer = d.emote('cheer'); const n = window.PlazaDebug(); return { wave, cheer, x: n.x, z: n.z, locked: n.actLocked }; });
  expect([first.wave, first.cheer]).toEqual([true, false]); // not stacked on the first
  const a = first; expect(a.locked).toBe(true);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(250);
  const b = await at(); if (b.locked) expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(0.05); // held (while still locked when read)
  await expect.poll(async () => (await at()).locked, { timeout: 4000 }).toBe(false); // ends with the clip (3 s at most)
  await page.waitForTimeout(500);
  const c = await at(); await page.keyboard.up('ArrowUp');
  expect(Math.hypot(c.x - a.x, c.z - a.z)).toBeGreaterThan(0.3); // the same press moves me now

  await expectNoScriptError(page);
  await who.context.close();
});
