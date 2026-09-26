const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

test.describe('게임센터 입장과 로비', () => {
  test('일반 주소는 관리자 입장 화면을 제공한다', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('게임센터');
    await expect(page.locator('#gateView')).toBeVisible();
    await expect(page.locator('#adminLoginForm')).toBeVisible();
    await expect(page.locator('#adminPassword')).toHaveAttribute('type', 'password');
    await expect(page.locator('#lobbyView')).toBeHidden();
  });

  test('관리자는 로비에 들어가 게임을 선택할 수 있다', async ({ page }) => {
    await page.goto('/');
    await page.locator('#adminPassword').fill(adminPassword);
    await page.getByRole('button', { name: '관리자로 입장' }).click();

    await expect(page.locator('#lobbyView')).toBeVisible();
    await expect(page.locator('#gateView')).toBeHidden();
    await expect(page.locator('#gamePicker')).toBeVisible();

    await page.getByRole('button', { name: '다빈치 코드' }).click();
    await expect(page.locator('#selectedGameText')).toHaveText('다빈치 코드 방을 만듭니다.');
  });

  test('헬스 엔드포인트는 게임 서버 준비 상태를 반환한다', async ({ request }) => {
    const response = await request.get('/health');

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.games).toContain('omok');
    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
