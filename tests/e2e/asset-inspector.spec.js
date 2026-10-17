const { test, expect } = require('@playwright/test');
const { uniqueIp } = require('./skin-support');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.10.91 에셋 점검실 (IDEAS #future-admin-console ③): the administrator sees every registered model by kind (turned in
// its own scene), plays a motion on the base body frame by frame, and leaves a note (status, memo, view) the server
// keeps; the 수정 요청 notes become a draft Codex order. PC 전용 (the same panel on a phone).
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

test('에셋 점검실: 모델·모션 미리보기, 메모 저장, 주문서 초안', async ({ page }) => {
  test.setTimeout(120000);
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  await page.goto('/');
  await page.locator('#adminPassword').fill(adminPassword);
  await page.getByRole('button', { name: '관리자로 입장' }).click();
  await expect(page.locator('#assetInspectorTab')).toBeVisible({ timeout: 20000 });
  await page.locator('#assetInspectorTab').click();
  await expect.poll(() => page.evaluate(() => Boolean(window.AssetInspector)), { timeout: 20000 }).toBe(true);
  await page.evaluate(() => window.AssetInspector.select('facility.townhall'));
  await expect.poll(() => page.evaluate(() => window.AssetInspector.debug().triangles), { timeout: 30000 }).toBeGreaterThan(100);
  await page.evaluate(() => window.AssetInspector.select('motion.GatherWeed'));
  await expect.poll(() => page.evaluate(() => window.AssetInspector.debug().motion?.length || 0), { timeout: 30000 }).toBeGreaterThan(1.3);
  await expect(page.locator('#assetInspectorHost')).toContainText('lift 0.62초');
  await page.locator('#assetInspectorHost select').filter({ hasText: '수정 요청' }).first().selectOption('fix');
  await page.locator('#assetInspectorHost textarea').fill('손이 잡초 위에서 살짝 뜸, 0.5초');
  await page.locator('#assetInspectorHost').getByRole('button', { name: '메모 저장' }).click();
  await expect(page.locator('#assetInspectorHost .inspectNotes')).toContainText('motion.GatherWeed');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#assetInspectorHost').getByRole('button', { name: /주문서 초안/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/^asset-fix-order-.*\.md$/);
  // clean: the note off again (status none, no memo)
  await page.locator('#assetInspectorHost select').filter({ hasText: '수정 요청' }).first().selectOption('');
  await page.locator('#assetInspectorHost textarea').fill('');
  await page.locator('#assetInspectorHost').getByRole('button', { name: '메모 저장' }).click();
  await expect(page.locator('#assetInspectorHost .inspectNotes')).not.toContainText('motion.GatherWeed');
});
