const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.7.22: 잿빛 원정은 키보드 전용이라 터치 전용 기기(휴대폰)에서는 고를 수 없고, PC(마우스 있음)에서는 그대로 열려 있다.
test('잿빛 원정 버튼: 터치 전용 기기에서는 비활성, PC에서는 활성', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.locator('#adminPassword').fill(adminPassword);
  await page.getByRole('button', { name: '관리자로 입장' }).click();
  await expect(page.locator('#gamePicker')).toBeVisible();

  const rpg = page.locator('.gameChoice[data-game="rpg"]');
  if (isMobile) {
    await expect(rpg).toBeDisabled();
    await expect(rpg).toHaveAttribute('title', /PC에서만/);
    await expect(rpg).toHaveAttribute('aria-disabled', 'true');
    await page.locator('#gamePicker [data-game="omok"]').click(); // 다른 게임은 그대로 고를 수 있다
    await expect(page.locator('#selectedGameText')).toContainText('오목');
  } else {
    await expect(rpg).toBeEnabled();
  }
});
