const { test, expect } = require('@playwright/test');
const { shopper, post, get } = require('./skin-support');

// 문제 기록 1103 4 (사용자 「공지로 주민이 많아져서 쓰레기가 많아졌다는 공지 접속할 때 한 번 띄우기」): the first time on the island
// a paper note; 「알겠어요」, and in again it does not come back (kept for the account on the server). PC and phone.
test('한 번 공지: 처음 섬에 오면 섬 소식, 알겠어요 → 다시 들어와도 안 뜸', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.CI ? 240000 : 150000);
  const who = await shopper(browser, request, isMobile ? '공지m' : '공지', 0, 'female'); const { page, token } = who;
  expect((await post(request, '/api/test/notices', token, { on: true })).status).toBe(200);
  try {
    await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); });
    await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
    const dialog = page.locator('#plazaDialog');
    await expect(dialog).toBeVisible({ timeout: 15000 }); await expect(page.locator('#plazaDialogTitle')).toHaveText('📢 섬 소식');
    await expect(dialog.locator('.islandNotice')).toContainText('쓰레기가 부쩍 많아졌어요');
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${isMobile ? 'phone' : 'pc'}-island-notice.png` });
    await dialog.getByRole('button', { name: '알겠어요' }).click(); await expect(dialog).toBeHidden();
    await expect.poll(async () => (await get(request, '/api/island/notices', token)).data.notices.length, { timeout: 10000 }).toBe(0); // (seen kept)
    await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
    await page.waitForTimeout(3500); await expect(dialog).toBeHidden(); // (seen: not again)
  } finally { await post(request, '/api/test/notices', token, { on: false }); await who.context.close(); }
});
