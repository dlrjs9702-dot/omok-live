const { test, expect } = require('@playwright/test');
const { shopper, get, post, expectNoScriptError } = require('./skin-support');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// 관리자 「문제 기록」 (사용자 2026-10-18, docs/admin-issue-log-20261018.md): from the menu over whatever is on screen, the
// words and a kind with the screen, place, device, frame rate, recent errors and a picture; the 관리자 창's card lists,
// changes state and removes them. Not for other accounts. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

test('문제 기록: 관리자 메뉴에서 적으면 화면 정보·사진과 저장, 관리자 창에서 상태 바꾸기·지우기, 다른 계정은 없음', async ({ browser, request }) => {
  test.setTimeout(150000);
  const guest = await shopper(browser, request, '일반계정', 0, 'male');
  expect((await get(request, '/api/admin/issues', guest.token)).status).toBe(403);
  await guest.page.keyboard.press('Escape'); await expect(guest.page.locator('#gameMenuDialog')).toBeVisible();
  await expect(guest.page.locator('#issueLogBtn')).toBeHidden();
  await guest.context.close();

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await context.newPage();
  await page.goto('/'); await page.locator('#adminPassword').fill(adminPassword);
  const [login] = await Promise.all([page.waitForResponse((r) => r.url().endsWith('/api/admin/login')), page.getByRole('button', { name: '관리자로 입장' }).click()]);
  const admin = (await login.json()).sessionToken;
  await post(request, '/api/avatar/gender', admin, { gender: 'female' }); await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload(); // (the island, its first-visit choice made)
  if (!(await page.locator('#lobbyView').isVisible().catch(() => false))) { await page.locator('#adminPassword').fill(adminPassword).catch(() => {}); await page.getByRole('button', { name: '관리자로 입장' }).click().catch(() => {}); }
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  // written over the island: Ctrl+Enter saves
  await page.keyboard.press('Escape'); await page.locator('#issueLogBtn').click();
  await expect(page.locator('#issueDialog')).toBeVisible(); await expect(page.locator('#issueShot')).toBeVisible();
  await page.locator('#issueText').fill('광장 벤치가 공중에 떠 있음'); await page.locator('#issueKind').selectOption('odd');
  await page.locator('#issueText').press('Control+Enter');
  await expect(page.locator('#issueDialog')).toBeHidden();
  const all = (await get(request, '/api/admin/issues?shots=1', admin)).data.issues; const mine = all.find((i) => i.text === '광장 벤치가 공중에 떠 있음');
  expect(mine).toMatchObject({ kind: 'odd', status: 'open', version: expect.stringMatching(/^1\.10\./), ctx: { screen: 'island', island: { space: 'island' }, device: { touch: false } } });
  expect(mine.shot).toMatch(/^data:image\/jpeg;base64,/); expect(mine.shot.length).toBeLessThanOrEqual(60000);
  expect((await get(request, '/api/admin/issues', admin)).data.issues.find((i) => i.id === mine.id)).toMatchObject({ hasShot: true }); // (no picture without ?shots=1)
  // the card: listed, its state changed, removed
  await page.keyboard.press('Escape'); await page.locator('#adminWindowBtn').click();
  await page.locator('#issueCard summary').first().click();
  const row = page.locator('.issueItem', { hasText: '광장 벤치가 공중에 떠 있음' });
  await expect(row).toBeVisible(); await row.locator('summary').click();
  await expect(row.locator('img.issueShot')).toBeVisible();
  await row.locator('select').selectOption('doing');
  await expect.poll(async () => (await get(request, '/api/admin/issues', admin)).data.issues.find((i) => i.id === mine.id)?.status).toBe('doing');
  await page.locator('#issueFilter').selectOption('doing');
  page.once('dialog', (d) => d.accept());
  await page.locator('.issueItem', { hasText: '광장 벤치가 공중에 떠 있음' }).locator('summary').click();
  await page.locator('.issueItem', { hasText: '광장 벤치가 공중에 떠 있음' }).getByRole('button', { name: '지우기' }).click();
  await expect.poll(async () => (await get(request, '/api/admin/issues', admin)).data.issues.some((i) => i.id === mine.id)).toBe(false);
  await expectNoScriptError(page);
  await context.close();
});
