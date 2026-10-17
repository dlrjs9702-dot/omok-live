const { test, expect } = require('@playwright/test');
const { shopper, post, expectNoScriptError } = require('./skin-support');

// v1.10.79 3인칭 동작·어깨 정비 (assets 36): Shift tapped switches 느리게/보통 걷기, held it runs (the clip follows: SlowWalk,
// Walk, Run); 운동복 is worn over the body made for it. PC 전용 (the phone's 걸음 button calls the same paceDown/paceUp).
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

test('이동 3단계(Shift 탭·홀드)와 운동복 전용 몸', async ({ browser, request }) => {
  test.setTimeout(120000);
  const who = await shopper(browser, request, '걸음', 500000, 'male');
  const { page, token } = who;
  // 운동복 bought in the classic lobby (the island asks to stand at the shop), then the island with it on
  for (const path of ['/api/skins/buy', '/api/skins/equip']) expect((await post(request, path, token, { skinId: 'avatar_outfit_15' })).status).toBe(200);
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await page.setViewportSize({ width: 1000, height: 700 });
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 30000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().bodyUrl), { timeout: 30000 }).toMatch(/body_sports\.glb$/); // its own body under it
  await page.locator('#plazaStage').focus();

  const walkFor = async (ms, shift = false) => {
    const a = await page.evaluate(() => ({ x: window.PlazaDebug().x, z: window.PlazaDebug().z }));
    if (shift) await page.keyboard.down('Shift');
    await page.keyboard.down('ArrowUp');
    let clip = null; await page.waitForTimeout(ms * 0.7); clip = await page.evaluate(() => window.PlazaDebug().gait);
    await page.waitForTimeout(ms * 0.3);
    await page.keyboard.up('ArrowUp'); if (shift) await page.keyboard.up('Shift');
    const b = await page.evaluate(() => ({ x: window.PlazaDebug().x, z: window.PlazaDebug().z }));
    await page.keyboard.press('ArrowDown'); // turn back so the next walk has room
    return { d: Math.hypot(b.x - a.x, b.z - a.z), clip };
  };
  expect(await page.evaluate(() => window.PlazaDebug().pace)).toBe('walk');
  const walk = await walkFor(800);
  expect(walk.clip).toBe('walk');
  await page.keyboard.press('Shift'); // a tap: 느리게
  expect(await page.evaluate(() => window.PlazaDebug().pace)).toBe('slow');
  const slow = await walkFor(800);
  expect(slow.clip).toBe('slow');
  expect(slow.d).toBeLessThan(walk.d * 0.5);
  const run = await walkFor(1200, true); // held: 뛰기, then back to 느리게
  expect(run.clip).toBe('run');
  expect(await page.evaluate(() => window.PlazaDebug().pace)).toBe('slow');

  await expectNoScriptError(page);
  await who.context.close();
});
