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

  // v1.10.63 게임 선택 탭 (사용자 2026-10-11): 멀티게임(대전/협동) / 싱글게임, each tab shows its games; remembered
  test('게임 선택: 멀티게임·대전게임으로 시작, 협동게임·싱글게임 전환, 새로고침 뒤에도 마지막 탭', async ({ page }, testInfo) => {
    // two admin logins here: from an address of its own, so the other tests' logins stay under the 5-per-15-minutes limit
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': `100.71.${testInfo.project.name.length % 250}.${process.pid % 250 + 1}` });
    await page.goto('/');
    await page.locator('#adminPassword').fill(adminPassword);
    await page.getByRole('button', { name: '관리자로 입장' }).click();
    await expect(page.locator('#lobbyView')).toBeVisible();

    await expect(page.locator('[data-game-mode="multi"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-game-kind="versus"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#gamePicker [data-game="omok"]')).toBeVisible();
    await expect(page.locator('#gamePicker [data-game="pandemic"]')).toBeHidden();

    await page.locator('[data-game-kind="coop"]').click(); // the selected 오목 is not there: its first game is chosen
    await expect(page.locator('#gamePicker [data-game="pandemic"]')).toBeVisible();
    await expect(page.locator('#gamePicker [data-game="omok"]')).toBeHidden();
    await expect(page.locator('#selectedGameText')).toHaveText('스무고개 방을 만듭니다.');

    await page.locator('[data-game-mode="single"]').click();
    await expect(page.locator('#soloMinesBtn')).toBeVisible();
    await expect(page.locator('#createRoomBtn')).toBeHidden();
    await expect(page.locator('#gamePicker')).toBeHidden();

    await page.reload(); // an admin's login lives only in the page: log in again
    await page.locator('#adminPassword').fill(adminPassword);
    await page.getByRole('button', { name: '관리자로 입장' }).click();
    await expect(page.locator('#lobbyView')).toBeVisible();
    await expect(page.locator('#soloMinesBtn')).toBeVisible();
    await page.locator('[data-game-mode="multi"]').click();
    await expect(page.locator('[data-game-kind="coop"]')).toHaveAttribute('aria-selected', 'true'); // its kind too
    await page.evaluate(() => localStorage.removeItem('gc.gameTab'));
  });

  test('헬스 엔드포인트는 게임 서버 준비 상태를 반환한다', async ({ request }) => {
    const response = await request.get('/health');

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(Object.keys(body).sort()).toEqual(['ok', 'version']);
    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
