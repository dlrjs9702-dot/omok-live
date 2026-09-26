const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.6.84 현재 행동 주체 강조: 실제 서버 상태를 바꿔 가며 브라우저 DOM/CSS를 확인한다. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

// 5 admin logins per client IP per 15 minutes; each login gets its own documentation-range address
// so these multi-player scenarios never eat into the smoke tests' budget on 127.0.0.1.
let loginCounter = 0;
function uniqueClientIp() {
  loginCounter += 1;
  return `192.0.${process.pid % 250}.${(loginCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;
}

async function api(request, route, token, body, extraHeaders = {}) {
  const response = await request.post(route, {
    headers: { ...(token ? { 'X-Session-Token': token } : {}), ...extraHeaders },
    data: body ?? {},
  });
  return { status: response.status(), data: await response.json().catch(() => ({})) };
}

async function apiLogin(request) {
  const { status, data } = await api(request, '/api/admin/login', null, { password: adminPassword }, { 'X-Forwarded-For': uniqueClientIp() });
  expect(status).toBe(200);
  return data.sessionToken;
}

async function roomState(request, token) {
  const response = await request.get('/api/room', { headers: { 'X-Session-Token': token } });
  return (await response.json()).state;
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

async function createRoom(page, gameType) {
  await page.evaluate(type => document.querySelector(`[data-game="${type}"]`).click(), gameType);
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().endsWith('/api/rooms') && res.request().method() === 'POST'),
    page.locator('#createRoomBtn').click(),
  ]);
  await expect(page.locator('#roomView')).toBeVisible();
  return (await response.json()).state.me.roomCode;
}

async function joinAsSpectator(browser, code) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await browserLogin(page);
  await page.locator('#roomPasswordInput').fill(code);
  await page.locator('#roomPasswordInput').press('Enter');
  await expect(page.locator('#roomView')).toBeVisible();
  // Two-seat games use #chooseSpectatorBtn, numbered-seat games #teamSpectatorBtn; either way the
  // viewer ends up without a seat.
  await page.locator('#chooseSpectatorBtn:visible, #teamSpectatorBtn:visible').first().click({ timeout: 5000 });
  return { context, page };
}

const seatCard = (page, seat) => page.locator(`.teamPlayer[data-seat="${seat}"]`);
const allActors = page => page.locator('.currentActor, .currentActorPaused');

test.describe('현재 행동 주체 강조', () => {
  test('오델로: 현재 차례만 표시·턴 이동·관전자·일시정지·새로고침 복구·종료 시 제거', async ({ page, browser, request }) => {
    test.setTimeout(90_000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const black = await browserLogin(page);
    const code = await createRoom(page, 'othello');
    const white = await apiLogin(request);
    expect((await api(request, '/api/rooms/join', white, { code })).status).toBe(200);
    const spectator = await joinAsSpectator(browser, code);

    expect((await api(request, '/api/room/choose-role', black, { choice: 'black' })).status).toBe(200);
    const started = await api(request, '/api/room/choose-role', white, { choice: 'white' });
    expect(started.data.state.game.turn).toBe('black');

    for (const view of [page, spectator.page]) {
      await expect(view.locator('#blackPlayer')).toHaveClass(/currentActor/);
      await expect(view.locator('#whitePlayer')).not.toHaveClass(/currentActor/);
      await expect(allActors(view)).toHaveCount(1);
    }
    // 내 좌석 윤곽(mySeat)과 현재 행동 주체 표시가 함께 유지되고, 실제 CSS 표시가 적용된다.
    await expect(page.locator('#blackPlayer')).toHaveClass(/mySeat/);
    const dot = await page.locator('#blackPlayer strong').evaluate(el => getComputedStyle(el, '::after').backgroundColor);
    expect(dot).toBe('rgb(56, 189, 248)');

    // 턴이 넘어가면 표시가 이동한다.
    const move = started.data.state.game.legalMoves[0];
    expect((await api(request, '/api/room/move', black, { x: move.x, y: move.y })).status).toBe(200);
    for (const view of [page, spectator.page]) {
      await expect(view.locator('#whitePlayer')).toHaveClass(/currentActor/);
      await expect(view.locator('#blackPlayer')).not.toHaveClass(/currentActor/);
    }

    // 일시정지(상대가 방을 떠남): 강한 표시는 사라지고 약한 표시만 남는다.
    expect((await api(request, '/api/room/leave', white, {})).status).toBe(200);
    await expect(page.locator('#whitePlayer')).toHaveClass(/currentActorPaused/, { timeout: 15_000 });
    await expect(page.locator('.currentActor')).toHaveCount(0);
    const pausedDot = await page.locator('#whitePlayer strong').evaluate(el => getComputedStyle(el, '::after').backgroundColor);
    expect(pausedDot).toBe('rgba(0, 0, 0, 0)');

    // 복귀하면 다시 현재 행동 주체로 표시된다.
    expect((await api(request, '/api/rooms/join', white, { code })).status).toBe(200);
    await expect(page.locator('#whitePlayer')).toHaveClass(/(^|\s)currentActor(\s|$)/, { timeout: 15_000 });

    // 새로고침(서버가 세션을 문서에 넣어 주는 재접속 경로와 동일) 직후 현재 상태로 바로 복구.
    await page.route('**/', async route => {
      if (route.request().resourceType() !== 'document') return route.continue();
      const response = await route.fetch();
      const html = (await response.text()).replace('data-session=""', `data-session="${black}"`);
      await route.fulfill({ response, body: html });
    });
    await page.reload();
    await expect(page.locator('#roomView')).toBeVisible();
    await expect(page.locator('#whitePlayer')).toHaveClass(/currentActor/);
    await expect(allActors(page)).toHaveCount(1);

    // 종료(기권): 승자를 포함해 누구도 현재 행동 주체가 아니다.
    expect((await api(request, '/api/room/resign', white, {})).status).toBe(200);
    for (const view of [page, spectator.page]) await expect(allActors(view)).toHaveCount(0);
    expect(errors).toEqual([]);
    await spectator.context.close();
  });

  test('스무고개: 비밀 정답·질문·답변·판정 단계마다 실제 행동 담당자로 이동한다', async ({ page, browser, request }) => {
    test.setTimeout(90_000);
    const host = await browserLogin(page);
    const code = await createRoom(page, 'twentyquestions');
    const second = await apiLogin(request);
    expect((await api(request, '/api/rooms/join', second, { code })).status).toBe(200);
    const spectator = await joinAsSpectator(browser, code);
    expect((await api(request, '/api/room/choose-role', host, { choice: '1' })).status).toBe(200);
    expect((await api(request, '/api/room/choose-role', second, { choice: '2' })).status).toBe(200);
    await expect(allActors(page)).toHaveCount(0); // 시작 전(방장 설정 단계)에는 없음
    const started = await api(request, '/api/room/twenty-start', host, { mode: 'individual', totalRounds: 1 });
    expect(started.status).toBe(200);

    const tokenOf = { 1: host, 2: second };
    const expectActor = async (seat, phase) => {
      const current = await roomState(request, host);
      expect(current.game.phase).toBe(phase);
      for (const view of [page, spectator.page]) {
        await expect(seatCard(view, seat)).toHaveClass(/currentActor/);
        await expect(allActors(view)).toHaveCount(1);
      }
      return current;
    };

    let current = await roomState(request, host);
    const drawer = current.game.drawerSeat;
    const challenger = drawer === '1' ? '2' : '1';
    await expectActor(drawer, 'secret');
    expect((await api(request, '/api/room/twenty-secret', tokenOf[drawer], { secret: '사과' })).status).toBe(200);
    current = await expectActor(challenger, 'asking');
    expect(current.game.turnSeat).toBe(challenger);
    expect((await api(request, '/api/room/twenty-question', tokenOf[challenger], { question: '과일인가요?' })).status).toBe(200);
    await expectActor(drawer, 'answering');
    expect((await api(request, '/api/room/twenty-answer', tokenOf[drawer], { reply: '예' })).status).toBe(200);
    await expectActor(challenger, 'asking');
    expect((await api(request, '/api/room/twenty-guess', tokenOf[challenger], { guess: '사과' })).status).toBe(200);
    await expectActor(drawer, 'judging');
    expect((await api(request, '/api/room/twenty-judge', tokenOf[drawer], { correct: true })).status).toBe(200);
    // 판정 이후 결과/라운드 종료 단계에는 행동 주체가 없다.
    for (const view of [page, spectator.page]) await expect(allActors(view)).toHaveCount(0);
    await spectator.context.close();
  });

  test('할리갈리: 카드 뒤집을 차례만 표시하고 종을 칠 수 있는 참가자 전체는 표시하지 않는다', async ({ page, request }) => {
    test.setTimeout(60_000);
    const host = await browserLogin(page);
    const code = await createRoom(page, 'halligalli');
    const second = await apiLogin(request);
    expect((await api(request, '/api/rooms/join', second, { code })).status).toBe(200);
    expect((await api(request, '/api/room/choose-role', host, { choice: '1' })).status).toBe(200);
    expect((await api(request, '/api/room/choose-role', second, { choice: '2' })).status).toBe(200);
    expect((await api(request, '/api/room/start-halligalli', host, {})).status).toBe(200);

    const tokenOf = { 1: host, 2: second };
    // The server may auto-flip after a few idle seconds, so always compare against its live turn.
    const actorMatchesServer = async () => {
      const turn = (await roomState(request, host)).game.turn;
      const cls = (await seatCard(page, turn).getAttribute('class')) || '';
      return /(^|\s)currentActor(\s|$)/.test(cls) && (await allActors(page).count()) === 1 ? turn : null;
    };
    // 두 참가자 모두 종을 칠 수 있는 상태지만 표시는 뒤집을 사람 한 명뿐.
    await expect(page.locator('#halliBellBtn')).toBeEnabled();
    await expect.poll(actorMatchesServer, { timeout: 8000 }).not.toBeNull();
    const before = await roomState(request, host);
    await api(request, '/api/room/flip-halligalli', tokenOf[before.game.turn], { expectedRevision: before.game.revision });
    const after = await roomState(request, host);
    expect(after.game.turn).not.toBe(before.game.turn);
    await expect.poll(actorMatchesServer, { timeout: 8000 }).not.toBeNull();
  });
});
