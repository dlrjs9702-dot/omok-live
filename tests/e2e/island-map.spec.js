const { test, expect } = require('@playwright/test');
const { shopper, expectNoScriptError } = require('./skin-support');

// 문제 기록 3회차 14 「안내 지도가 너무 지저분해. 크게 확대해서 볼 수 있게」: the map board opens the map as wide as the
// screen, drawn at its own size; the wheel (PC) or a pinch (phone) brings it closer, a drag moves it
test('안내 지도: 화면 가득, 휠·핀치 확대, 끌어 이동', async ({ browser, request }) => {
  test.setTimeout(120000);
  const who = await shopper(browser, request, '지도확대', 0, 'male'); const { page } = who;
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testHalloween', 'off'); }); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running).catch(() => false), { timeout: 90000 }).toBe(true);
  await page.evaluate(async () => { const d = window.IslandTerrain.facilityDoor('map'); await window.PlazaWarp(d.x, d.z); });
  await expect(page.locator('#plazaHint')).toContainText('안내 지도', { timeout: 15000 });
  if (test.info().project.name.includes('mobile')) await page.locator('#plazaHint').click(); else await page.keyboard.press('Space');
  const canvas = page.locator('#islandMapCanvas'); await expect(canvas).toBeVisible();
  const view = page.viewportSize(); const box = await canvas.boundingBox();
  expect(box.width).toBeGreaterThan(view.width * 0.85); // as wide as the screen
  await expect.poll(() => canvas.evaluate((c) => c.width / c.getBoundingClientRect().width)).toBeGreaterThanOrEqual(1); // drawn at its own size
  const shot = () => canvas.evaluate((c) => c.toDataURL());
  const first = await shot();
  // the wheel: closer round the point under it
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5); await page.mouse.wheel(0, -300);
  const zoomed = await shot(); expect(zoomed).not.toBe(first);
  // a drag moves it
  await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6, { steps: 4 }); await page.mouse.up();
  expect(await shot()).not.toBe(zoomed);
  // a pinch (two touches drawn apart) brings it closer still; drawn back out at the window's next opening
  const pinched = await canvas.evaluate((c) => {
    const r = c.getBoundingClientRect(); const cx = r.left + r.width / 2; const cy = r.top + r.height / 2; const before = c.toDataURL();
    const ev = (type, id, x) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: cy, pointerType: 'touch', bubbles: true }));
    ev('pointerdown', 11, cx - 40); ev('pointerdown', 12, cx + 40);
    for (let k = 1; k <= 4; k += 1) { ev('pointermove', 11, cx - 40 - k * 25); ev('pointermove', 12, cx + 40 + k * 25); }
    ev('pointerup', 11, cx - 140); ev('pointerup', 12, cx + 140);
    return c.toDataURL() !== before;
  });
  expect(pinched).toBe(true);
  await expectNoScriptError(page); await who.context.close();
});
