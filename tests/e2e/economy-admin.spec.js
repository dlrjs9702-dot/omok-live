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
  await page.locator('#adminTabs [data-tab="economy"]').click(); /* (293: its tab) */ await page.locator('#economyBox summary').click();
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

// 368 (사용자 「판매 값 배수 중 대상이 잡초에서 다른걸로 변경이 안돼」): the island event's target picked stays picked -- 광석 shows the 보석 row and is
// what is sent; 물건 하나 shows the item row
test('섬 이벤트 관리: 판매 값 대상이 잡초에서 광석·물건 하나로 바뀌고, 그 줄이 보이고, 보내는 값도 그것', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  await page.goto('/');
  await page.locator('#adminPassword').fill(adminPassword);
  await page.getByRole('button', { name: '관리자로 입장' }).click();
  await page.locator('#adminTabs [data-tab="island"]').click(); await page.locator('#islandEventAdmin summary').click();
  await page.locator('#ieKind').selectOption('sell'); await expect(page.locator('#ieTarget option')).not.toHaveCount(0);
  await page.locator('#ieTarget').selectOption('ore'); await expect(page.locator('#ieTarget')).toHaveValue('ore'); await expect(page.locator('#ieGemsRow')).toBeVisible(); await expect(page.locator('#ieItemRow')).toBeHidden();
  await page.locator('#ieTarget').selectOption('item'); await expect(page.locator('#ieTarget')).toHaveValue('item'); await expect(page.locator('#ieItemRow')).toBeVisible(); await expect(page.locator('#ieGemsRow')).toBeHidden();
  await page.locator('#ieTarget').selectOption('ore');
  const [req] = await Promise.all([page.waitForRequest((r) => r.url().endsWith('/api/admin/island-events') && r.method() === 'POST'), page.locator('#islandEventForm').evaluate((f) => f.requestSubmit())]);
  expect(JSON.parse(req.postData())).toMatchObject({ kind: 'sell', target: 'ore' });
  await expect(page.locator('#ieStatus')).toContainText(/열었어요|예약했어요/);
  page.once('dialog', (d) => d.accept()); await page.locator('#ieList li', { hasText: '광석' }).first().getByRole('button', { name: '끝내기' }).click(); /* (the next tests' island free of it) */
  await expect(page.locator('#ieList li', { hasText: '광석' }).first()).toContainText('끝냄');
});
