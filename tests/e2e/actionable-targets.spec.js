const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.6.82 "현재 행동 가능한 대상" 강조: 한 명은 실제 브라우저, 나머지 참가자는 API로 조작한다.
// PC 우선 기능이므로 데스크톱 Chromium에서만 실행한다.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

// The server allows 5 admin logins per client IP per 15 minutes (and trusts X-Forwarded-For
// behind Render's proxy). Each login here uses its own documentation-range address so these
// multi-player scenarios never eat into the budget of the entry/lobby smoke tests on 127.0.0.1.
let loginCounter = 0;
function uniqueClientIp() {
  loginCounter += 1;
  return `198.51.${process.pid % 250}.${(loginCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;
}

async function api(request, route, token, body, extraHeaders = {}) {
  const response = await request.post(route, {
    headers: { ...(token ? { 'X-Session-Token': token } : {}), ...extraHeaders },
    data: body ?? {},
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status(), data };
}

async function apiLogin(request) {
  const { status, data } = await api(request, '/api/admin/login', null, { password: adminPassword }, { 'X-Forwarded-For': uniqueClientIp() });
  expect(status).toBe(200);
  return data.sessionToken;
}

async function browserLogin(page) {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueClientIp() });
  await page.goto('/');
  await page.locator('#adminPassword').fill(adminPassword);
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().endsWith('/api/admin/login') && res.request().method() === 'POST'),
    page.getByRole('button', { name: '관리자로 입장' }).click(),
  ]);
  await expect(page.locator('#lobbyView')).toBeVisible();
  return (await response.json()).sessionToken;
}

async function createRoomInBrowser(page, gameType) {
  await page.locator(`#gamePicker [data-game="${gameType}"]`).click();
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().endsWith('/api/rooms') && res.request().method() === 'POST'),
    page.locator('#createRoomBtn').click(),
  ]);
  const data = await response.json();
  await expect(page.locator('#roomView')).toBeVisible();
  return data.state.me.roomCode;
}

async function joinInBrowser(page, code) {
  await page.locator('#roomPasswordInput').fill(code);
  await page.locator('#roomPasswordInput').press('Enter');
  await expect(page.locator('#roomView')).toBeVisible();
}

// Canvas pixel at (x, y) in the board's own 720-wide coordinate space.
async function boardPixel(page, x, y) {
  return page.locator('#board').evaluate((canvas, [px, py]) => {
    const [r, g, b] = canvas.getContext('2d').getImageData(Math.round(px), Math.round(py), 1, 1).data;
    return { r, g, b };
  }, [x, y]);
}

test.describe('현재 행동 가능한 대상 강조', () => {
  test('오델로: 내 차례에만 서버 합법 수를 표시하고 최근 행동 링과 구분한다', async ({ page, browser, request }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const blackToken = await browserLogin(page);
    const code = await createRoomInBrowser(page, 'othello');
    const whiteToken = await apiLogin(request);
    expect((await api(request, '/api/rooms/join', whiteToken, { code })).status).toBe(200);

    // 관전자 브라우저: 같은 방을 보지만 강조가 전혀 없어야 한다.
    const spectatorContext = await browser.newContext();
    const spectatorPage = await spectatorContext.newPage();
    await browserLogin(spectatorPage);
    await joinInBrowser(spectatorPage, code);
    await spectatorPage.locator('#chooseSpectatorBtn').click();

    expect((await api(request, '/api/room/choose-role', blackToken, { choice: 'black' })).status).toBe(200);
    const started = await api(request, '/api/room/choose-role', whiteToken, { choice: 'white' });
    expect(started.status).toBe(200);
    expect(started.data.state.game.status).toBe('playing');

    const wrap = page.locator('#canvasWrap');
    await expect(wrap).toHaveClass(/actionableBoard/);
    await expect(spectatorPage.locator('#canvasWrap')).not.toHaveClass(/actionableBoard/);

    const cell = 90;
    const legal = started.data.state.game.legalMoves;
    expect(legal.length).toBeGreaterThan(0);
    const legalKeys = new Set(legal.map(({ x, y }) => `${x},${y}`));
    const legalRing = await boardPixel(page, (legal[0].x + .5) * cell + cell * .3, (legal[0].y + .5) * cell);
    expect(legalRing.r).toBeGreaterThan(90); // 민트 링이 초록 판(#18794e) 위에 그려짐
    // 합법 수가 아닌 빈 칸(0,0)에는 표시가 없다.
    expect(legalKeys.has('0,0')).toBe(false);
    const plainCell = await boardPixel(page, .5 * cell + cell * .3, .5 * cell);
    expect(plainCell.r).toBeLessThan(60);
    const spectatorRing = await boardPixel(spectatorPage, (legal[0].x + .5) * cell + cell * .3, (legal[0].y + .5) * cell);
    expect(spectatorRing.r).toBeLessThan(60);

    // 착수 후: 내 강조는 사라지고, 최근 행동(호박색) 링이 착수점에 남는다.
    const moved = await api(request, '/api/room/move', blackToken, { x: legal[0].x, y: legal[0].y });
    expect(moved.status).toBe(200);
    await expect(wrap).not.toHaveClass(/actionableBoard/);
    await expect.poll(async () => {
      const pixel = await boardPixel(page, (legal[0].x + .5) * cell + cell * .43, (legal[0].y + .5) * cell);
      return pixel.r > 150 && pixel.b < 100; // 호박색(250,204,21) 링이 초록 판 위에 반투명으로 그려짐
    }).toBe(true);
    const staleMint = await boardPixel(page, (legal[0].x + .5) * cell + cell * .3, (legal[0].y + .5) * cell);
    expect(staleMint.g - staleMint.r).toBeLessThan(80);

    // 기권으로 종료되면 강조가 남지 않는다.
    expect((await api(request, '/api/room/resign', whiteToken, {})).status).toBe(200);
    await expect(wrap).not.toHaveClass(/actionableBoard/);
    expect(errors).toEqual([]);
    await spectatorContext.close();
  });

  test('점과 상자: 게임판이 오류 없이 그려지고 남은 선만 내 차례에 강조된다', async ({ page, request }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const blueToken = await browserLogin(page);
    const code = await createRoomInBrowser(page, 'dots');
    const redToken = await apiLogin(request);
    expect((await api(request, '/api/rooms/join', redToken, { code })).status).toBe(200);
    expect((await api(request, '/api/room/choose-role', blueToken, { choice: 'black' })).status).toBe(200);
    const started = await api(request, '/api/room/choose-role', redToken, { choice: 'white' });
    expect(started.data.state.game.status).toBe('playing');

    const wrap = page.locator('#canvasWrap');
    await expect(wrap).toHaveClass(/actionableBoard/);
    const moved = await api(request, '/api/room/move', blueToken, { x: 0, y: 0 });
    expect(moved.status).toBe(200);
    await expect(wrap).not.toHaveClass(/actionableBoard/);
    // v1.6.80 회귀: 점과 상자 그리기 중 오델로 변수 참조로 ReferenceError가 나던 문제.
    expect(errors).toEqual([]);
  });

  test('빙고: 내 선택 차례에 선택 가능한 숫자만 강조하고 선택 후 해제된다', async ({ page, request }) => {
    const hostToken = await browserLogin(page);
    const code = await createRoomInBrowser(page, 'bingo');
    const secondToken = await apiLogin(request);
    expect((await api(request, '/api/rooms/join', secondToken, { code })).status).toBe(200);
    expect((await api(request, '/api/room/choose-role', hostToken, { choice: '1' })).status).toBe(200);
    expect((await api(request, '/api/room/choose-role', secondToken, { choice: '2' })).status).toBe(200);
    const started = await api(request, '/api/room/start-bingo', hostToken, {});
    expect(started.status).toBe(200);

    const game = started.data.state.game;
    const myTurn = game.turn === '1';
    const firstToken = myTurn ? hostToken : secondToken;
    const boardOf = async token => {
      const response = await request.get('/api/room', { headers: { 'X-Session-Token': token } });
      return (await response.json()).state.me.myBingoBoard;
    };
    const hostBoard = await boardOf(hostToken);
    const secondBoard = new Set(await boardOf(secondToken));
    const total = hostBoard.length;
    await expect(page.locator('.bingoCell')).toHaveCount(total);
    // 내 차례면 선택 가능한 모든 숫자, 상대 차례면 하나도 강조하지 않는다.
    await expect(page.locator('.bingoCell.actionableTarget')).toHaveCount(myTurn ? total : 0);

    // 두 판에 모두 있는 숫자를 첫 선택자가 고르면 차례가 넘어가 강조가 바뀐다.
    const number = hostBoard.find(value => secondBoard.has(value));
    expect(number).toBeDefined();
    const selected = await api(request, '/api/room/select-bingo', firstToken, { number, expectedMoveCount: game.moveCount || 0 });
    expect(selected.status).toBe(200);
    const nowMine = selected.data.state.game.turn === '1';
    await expect(page.locator('.bingoCell.actionableTarget')).toHaveCount(nowMine ? total - 1 : 0);
    // 선택된 숫자는 최근 행동 표시만 받고 행동 가능 표시는 받지 않는다.
    const picked = page.locator('.bingoCell.selected');
    await expect(picked).toHaveCount(1);
    await expect(picked).toHaveClass(/recentActionTarget/);
    await expect(picked).not.toHaveClass(/actionableTarget/);
  });
});
