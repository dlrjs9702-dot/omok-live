const { test, expect } = require('@playwright/test');
const { shopper, post, expectNoScriptError } = require('./skin-support');

// v1.10.89 칭호 명예의 전당 (IDEAS #future-title-history): the plaza board keeps its notices first; the hall below it,
// folded, lists a title's holders from the first recorded week (1대 ...), the current one marked. PC and phone.
test('게시판: 공지 아래 칭호 명예의 전당 — 챔피언 1대·현재 표시', async ({ browser, request }) => {
  test.setTimeout(120000);
  const who = await shopper(browser, request, '전당', 500000, 'male');
  const { page, token } = who;
  expect((await post(request, '/api/test/climb/record', token, { altitude: 3000, at: Date.now() - 7 * 24 * 60 * 60 * 1000 })).status).toBe(200);
  expect((await post(request, '/api/test/climb/settle', null, { reopen: true })).status).toBe(200);
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 30000 }).toBe(true);
  await page.evaluate(() => window.PlazaDebug().place('board'));
  await expect(page.locator('#plazaHint')).toContainText('게시판');
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  const dialog = page.locator('#plazaDialog');
  await expect(dialog.locator('#announcementsCard')).toBeVisible(); // the notices first
  await expect(dialog.locator('#titleHallPanel')).toBeHidden(); // folded
  await dialog.locator('#titleHallTab').click();
  await expect(dialog.getByRole('tab', { name: '챔피언' })).toHaveAttribute('aria-selected', 'true');
  const current = dialog.locator('.titleHallRow.current');
  await expect(current).toContainText('전당');
  await expect(current).toContainText('현재');
  await expect(dialog.locator('.titleHallPanel')).toContainText('기록 시작:');
  await dialog.getByRole('tab', { name: '호구왕' }).click();
  await expect(dialog.locator('.titleHallPanel')).toContainText(/호구왕 · 주간/);
  await page.locator('#plazaCloseBtn').click();
  await expect(dialog).toBeHidden();
  await expectNoScriptError(page);
  await who.context.close();
});
