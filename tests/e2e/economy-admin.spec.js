const { test, expect } = require('@playwright/test');
const { uniqueIp } = require('./skin-support');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.10.91 경제 값 관리 (IDEAS #future-admin-console ②): the administrator changes a value in the table (a confirm lists
// it), the history shows before → after, and 되돌리기 puts it back. PC 전용 (the same panel on a phone).
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

test('경제 값 관리: 바꾸기 확인창, 변경 이력, 되돌리기', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  await page.goto('/');
  await page.locator('#adminPassword').fill(adminPassword);
  await page.getByRole('button', { name: '관리자로 입장' }).click();
  await page.locator('#economyBox summary').click();
  const weed = page.locator('#economyTable input[data-key="item:weed"]');
  await expect(weed).toHaveAttribute('placeholder', '310');
  await weed.fill('99999');
  await page.locator('#economySave').click();
  await expect(page.locator('body')).toContainText(/사이로 적어 주세요/);
  await weed.fill('420');
  const confirms = [];
  page.on('dialog', (d) => { confirms.push(d.message()); d.accept(); });
  await page.locator('#economySave').click();
  await expect(page.locator('#economyHistory li').first()).toContainText('잡초: 310 → 420');
  expect(confirms[0]).toContain('잡초: 310 → 420');
  await page.locator('#economyHistory li').first().getByRole('button', { name: '되돌리기' }).click();
  await expect(page.locator('#economyHistory li').first()).toContainText('잡초: 420 → 310');
  await expect(weed).toHaveValue('');
});
