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

    // a game selected another way (as on coming back from a room) brings its tab along (Codex review)
    await page.evaluate(() => document.querySelector('#gamePicker [data-game="omok"]').click());
    await expect(page.locator('[data-game-kind="versus"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#gamePicker [data-game="omok"]')).toBeVisible();
    // a game in development stays selected across the tabs (it is always in sight under 멀티게임)
    await page.locator('[data-game="cityking"]').click();
    await page.locator('[data-game-mode="single"]').click();
    await page.locator('[data-game-mode="multi"]').click();
    await expect(page.locator('#selectedGameText')).toContainText('랜드킹');
    await page.locator('[data-game-kind="coop"]').click();

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

  // v1.10.63 게임 홀: room cards (game badge, status chip, players) and arrow keys among tabs, game cards and rooms
  test('게임 홀: 방 카드와 화살표 키 이동', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'PC 전용 검증');
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': `100.72.${testInfo.project.name.length % 250}.${process.pid % 250 + 1}` });
    const rooms = [
      { id: 'r1', gameType: 'omok', title: '한 판 해요', status: 'waiting', playerCount: 1, maxPlayers: 2, connectedCount: 1 },
      { id: 'r2', gameType: 'yut', title: '', host: '길동', status: 'playing', playerCount: 4, maxPlayers: 4, connectedCount: 5 },
    ];
    await page.route('**/api/rooms/public', route => route.fulfill({ json: { rooms } }));
    await page.route('**/api/lobby/events*', route => route.abort()); // its snapshot would replace the rooms above
    await page.goto('/');
    await page.locator('#adminPassword').fill(adminPassword);
    await page.getByRole('button', { name: '관리자로 입장' }).click();
    await expect(page.locator('#lobbyView')).toBeVisible();

    const cards = page.locator('#publicRoomList .publicRoomRow');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toHaveAttribute('data-status', 'waiting');
    await expect(cards.nth(0).locator('.publicRoomGame')).toHaveText('오목 · 1vs1');
    await expect(cards.nth(0).locator('.publicRoomStatus')).toHaveText('모집 중');
    await expect(cards.nth(0).locator('button')).toHaveText('바로 입장');
    await expect(cards.nth(1).locator('strong')).toHaveText('길동의 윷놀이방');
    await expect(cards.nth(1).locator('small')).toHaveText('선수 4/4 · 접속 5명');
    await expect(cards.nth(1).locator('button')).toHaveText('관전하기');

    await cards.nth(0).locator('button').focus();
    await page.keyboard.press('ArrowDown');
    await expect(cards.nth(1).locator('button')).toBeFocused();
    await page.keyboard.press('ArrowDown'); // wraps around
    await expect(cards.nth(0).locator('button')).toBeFocused();

    await page.locator('[data-game-mode="multi"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-game-mode="single"]')).toBeFocused();
    await page.locator('#gamePicker [data-game="omok"]').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.locator('#selectedGameText')).not.toHaveText('오목 방을 만듭니다.');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#gamePicker [data-game="omok"]')).toBeFocused();
  });

  // v1.10.63 게임방 공통 틀: the Esc menu in a room (로비로 돌아가기 on top), Enter to the room chat, Esc out of it
  test('게임방: Esc 메뉴와 Enter 채팅', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'PC 전용 검증');
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': `100.73.${testInfo.project.name.length % 250}.${process.pid % 250 + 1}` });
    await page.goto('/');
    await page.locator('#adminPassword').fill(adminPassword);
    await page.getByRole('button', { name: '관리자로 입장' }).click();
    await expect(page.locator('#lobbyView')).toBeVisible();
    await page.locator('#createRoomBtn').click();
    await expect(page.locator('#roomView')).toBeVisible();

    await page.locator('#statusText').click(); // nothing focused
    await page.keyboard.press('Enter');
    await expect(page.locator('#chatInput')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#chatInput')).not.toBeFocused();
    await expect(page.locator('#gameMenuDialog')).not.toHaveAttribute('open', '');

    await page.keyboard.press('Escape');
    await expect(page.locator('#gameMenuDialog')).toHaveAttribute('open', '');
    await expect(page.locator('#menuLeaveRoomBtn')).toBeVisible();
    await page.locator('#menuLeaveRoomBtn').click();
    await expect(page.locator('#lobbyView')).toBeVisible();
    await expect(page.locator('#gameMenuDialog')).not.toHaveAttribute('open', '');
    await page.keyboard.press('Escape');
    await expect(page.locator('#gameMenuDialog')).toHaveAttribute('open', '');
    await expect(page.locator('#menuLeaveRoomBtn')).toBeHidden(); // not in the lobby
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
