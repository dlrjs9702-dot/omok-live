const { test, expect } = require('@playwright/test');
const { shopper, post, spaceOn, expectNoScriptError } = require('./skin-support');
test.skip(({ isMobile }) => isMobile, 'PC 실행이 같은 확인을 함 (v1.10.269 시험 정리: docs/test-audit-20261107.md)');

// v1.10.89 칭호 명예의 전당 (IDEAS #future-title-history): the plaza board keeps its notices first; the hall below it,
// folded, lists a title's holders from the first recorded week (1대 ...), the current one marked. PC and phone.
test('게시판: 공지 아래 칭호 명예의 전당 — 챔피언 1대·현재 표시', async ({ browser, request, isMobile }) => {
  test.setTimeout(120000);
  const who = await shopper(browser, request, '전당', 500000, 'male');
  const { page, token } = who;
  expect((await post(request, '/api/test/climb/record', token, { altitude: 3000, at: Date.now() - 7 * 24 * 60 * 60 * 1000 })).status).toBe(200);
  expect((await post(request, '/api/test/climb/settle', null, { reopen: true })).status).toBe(200);
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 30000 }).toBe(true);
  const dialog = page.locator('#plazaDialog');
  // (CI #389·#392 mobile-5: a Space pressed on a slow frame opened nothing and the card was waited for in vain -- the board stood
  // at and pressed again until its card shows (on the phone its hint tapped: spaceOn), as resident-roster does)
  await expect.poll(async () => { if (await dialog.locator('#announcementsCard').isVisible()) return true; await page.evaluate(() => window.PlazaDebug().place('board')); await page.waitForTimeout(600); await spaceOn(page, 'board', isMobile); await page.waitForTimeout(800); return dialog.locator('#announcementsCard').isVisible(); }, { timeout: 30000 }).toBe(true); // the notices first
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
