const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.6.86 포인트·출석·고스톱/맞고. 실제 게스트 계정(입장파일)을 서로 다른 브라우저 context로 사용한다. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

let ipCounter = 0;
function uniqueIp() {
  ipCounter += 1;
  return `100.64.${process.pid % 250}.${(ipCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;
}

async function api(request, route, token, body, method = 'POST') {
  const options = { headers: { 'X-Forwarded-For': uniqueIp(), ...(token ? { 'X-Session-Token': token } : {}) } };
  const response = method === 'GET' ? await request.get(route, options) : await request.post(route, { ...options, data: body ?? {} });
  return { status: response.status(), data: await response.json().catch(() => ({})) };
}

async function adminToken(request) {
  const { status, data } = await api(request, '/api/admin/login', null, { password: adminPassword });
  expect(status).toBe(200);
  return data.sessionToken;
}

async function issueGuest(request, admin, label) {
  const { status, data } = await api(request, '/api/admin/keys', admin, { label });
  expect(status).toBe(201);
  return data.html;
}

async function enterAsGuest(browser, html) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  // Open the entry file from a blank page (as a downloaded file would be); it auto-submits its
  // form to /guest-entry. The game center page's own CSP would block that inline script.
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(html)]);
  await expect(page.locator('#lobbyView')).toBeVisible();
  const token = await page.evaluate(() => document.body.dataset.session);
  return { context, page, token };
}

async function roomState(request, token) {
  return (await api(request, '/api/room', token, undefined, 'GET')).data.state;
}

async function playUntil(request, tokenOf, stopWhen, maxSteps = 200) {
  for (let step = 0; step < maxSteps; step += 1) {
    const anyToken = Object.values(tokenOf)[0];
    const state = await roomState(request, anyToken);
    const g = state.game;
    if (stopWhen(g) || g.status !== 'playing') return state;
    const token = tokenOf[g.turn];
    const mine = await roomState(request, token);
    let result;
    if (g.phase === 'play') {
      const hand = mine.me.myGostopHand;
      result = hand.length ? await api(request, '/api/room/gostop-play', token, { cardId: hand[0].id }) : await api(request, '/api/room/gostop-flip', token, {});
    } else if (g.phase === 'choose-floor' || g.phase === 'choose-flip') result = await api(request, '/api/room/gostop-choose', token, { cardId: g.choice.options[0] });
    else if (g.phase === 'gukjin') result = await api(request, '/api/room/gostop-gukjin', token, { asPi: false });
    else if (g.phase === 'go-stop') return state;
    expect(result.status, JSON.stringify(result.data)).toBe(200);
  }
  return roomState(request, Object.values(tokenOf)[0]);
}

test.describe('포인트와 고스톱·맞고', () => {
  test('로비 포인트·출석·2인 맞고 한 판(직접 클릭·행동 가능/주체 표시·스톱·정산)·다음 판·관전자 비공개', async ({ browser, request }) => {
    test.setTimeout(120_000);
    const admin = await adminToken(request);
    const a = await enterAsGuest(browser, await issueGuest(request, admin, '건'));
    const b = await enterAsGuest(browser, await issueGuest(request, admin, '지희'));
    const c = await enterAsGuest(browser, await issueGuest(request, admin, '관전'));
    const errors = [];
    for (const view of [a, b, c]) view.page.on('pageerror', error => errors.push(error.message));

    // 1~3) 로비 포인트·출석·중복 차단.
    await expect(a.page.locator('#pointBalanceText')).toHaveText('보유 100,000P');
    await expect(a.page.locator('#attendanceBtn')).toHaveText('오늘 출석 +50,000P');
    await a.page.locator('#attendanceBtn').click();
    await expect(a.page.locator('#pointBalanceText')).toHaveText('보유 150,000P');
    await expect(a.page.locator('#attendanceBtn')).toHaveText('오늘 출석 완료');
    await expect(a.page.locator('#attendanceBtn')).toBeDisabled();
    expect((await api(request, '/api/points/attendance', a.token, {})).data.granted).toBe(false);
    expect((await api(request, '/api/points', a.token, undefined, 'GET')).data.balance).toBe(150_000);

    // 4~5) 2인 맞고 방 생성 + 점당 포인트 선택(생성 시 50P, 방에서 10P로 변경).
    await a.page.locator('[data-game="gostop"]').click();
    await expect(a.page.locator('#gostopStakeChoices')).toBeVisible();
    await a.page.locator('input[name="gostopStake"][value="50"]').check();
    const [created] = await Promise.all([
      a.page.waitForResponse(res => res.url().endsWith('/api/rooms') && res.request().method() === 'POST'),
      a.page.locator('#createRoomBtn').click(),
    ]);
    const code = (await created.json()).state.me.roomCode;
    await expect(a.page.locator('#gostopPanel')).toBeVisible();
    await expect(a.page.locator('#gostopStakeSelect')).toHaveValue('50');
    await a.page.locator('#gostopStakeSelect').selectOption('10');
    await expect.poll(async () => (await roomState(request, a.token)).game.pointsPerScore).toBe(10);
    for (const view of [b, c]) {
      await view.page.locator('#roomPasswordInput').fill(code);
      await view.page.locator('#roomPasswordInput').press('Enter');
      await expect(view.page.locator('#gostopPanel')).toBeVisible();
    }
    await expect(b.page.locator('#gostopStakeSelect')).toBeDisabled();
    await a.page.locator('#teamRoleButtons [data-team-seat="1"]').click();
    await b.page.locator('#teamRoleButtons [data-team-seat="2"]').click();
    await c.page.locator('#teamSpectatorBtn').click();
    await expect(a.page.locator('#gostopStartBtn')).toHaveText('맞고 시작 (2인)');
    await a.page.locator('#gostopStartBtn').click();

    // 6~7) 분배와 비공개: 내 손패만 보이고, 관전자는 손패가 전혀 없다.
    const tokenOf = { 1: a.token, 2: b.token };
    let state = await roomState(request, a.token);
    expect(state.game.mode).toBe('matgo');
    expect(state.game.pointsPerScore).toBe(10);
    const handA = state.me.myGostopHand.map(card => card.id);
    const handB = (await roomState(request, b.token)).me.myGostopHand.map(card => card.id);
    await expect(a.page.locator('#gostopHand .hwatu')).toHaveCount(handA.length);
    await expect(b.page.locator('#gostopHand .hwatu')).toHaveCount(handB.length);
    await expect(a.page.locator('#gostopOpponents .gostopBacks .hwatuBack')).toHaveCount(handB.length);
    await expect(c.page.locator('#gostopHand .hwatu')).toHaveCount(0);
    const spectatorJson = JSON.stringify(await roomState(request, c.token));
    for (const id of [...handA, ...handB]) expect(spectatorJson.includes(`"${id}"`)).toBe(false);
    const opponentJson = JSON.stringify(await roomState(request, b.token));
    for (const id of handA) expect(opponentJson.includes(`"${id}"`)).toBe(false);
    // Hidden DOM: the spectator page has only public (floor/captured) faces plus plain backs.
    const shownFaces = await c.page.locator('#gostopPanel .hwatu:not(.hwatuBack)').count();
    expect(shownFaces).toBe(state.game.floor.length + Object.values(state.game.seats).reduce((n, s) => n + s.captured.length, 0));
    for (const id of handA) expect(await c.page.content()).not.toContain(id);

    // 8~10) 차례인 사람: 손패 직접 클릭·행동 가능(민트)·현재 행동 주체(하늘색).
    const turn = state.game.turn;
    const actor = turn === '1' ? a : b;
    const waiter = turn === '1' ? b : a;
    await expect(actor.page.locator('#gostopHand .hwatu.actionableTarget').first()).toBeVisible();
    await expect(waiter.page.locator('#gostopHand .hwatu.actionableTarget')).toHaveCount(0);
    for (const view of [a, b, c]) await expect(view.page.locator(`.teamPlayer[data-seat="${turn}"]`)).toHaveClass(/currentActor/);
    const before = state.game.seats[turn].handCount;
    await actor.page.locator('#gostopHand .hwatu.actionableTarget').first().click();
    const special = actor.page.getByRole('button', { name: '그냥 내기' });
    if (await special.isVisible().catch(() => false)) await special.click();
    await expect.poll(async () => {
      const g = (await roomState(request, a.token)).game;
      if (g.phase === 'choose-floor' && g.turn === turn) {
        await actor.page.locator('#gostopFloor .hwatu.actionableTarget').first().click().catch(() => {});
      }
      return g.seats[turn].handCount < before || g.turn !== turn || g.status !== 'playing';
    }, { timeout: 10_000 }).toBe(true);

    // 11~13) 고/스톱이 나오는 판까지 진행 → 해당 사용자가 화면에서 스톱 → 결과·정산·잔액.
    let settledRound = null;
    for (let round = 0; round < 8 && !settledRound; round += 1) {
      state = await playUntil(request, tokenOf, g => g.phase === 'go-stop');
      if (state.game.status === 'playing' && state.game.phase === 'go-stop') {
        const decider = state.game.turn === '1' ? a : b;
        const other = state.game.turn === '1' ? b : a;
        await expect(decider.page.getByRole('button', { name: '스톱' })).toBeVisible();
        await expect(other.page.getByRole('button', { name: '스톱' })).toHaveCount(0);
        await expect(c.page.getByRole('button', { name: '스톱' })).toHaveCount(0);
        await decider.page.getByRole('button', { name: '스톱' }).click();
        await expect(decider.page.locator('#gostopResult')).toContainText('승리');
        settledRound = await roomState(request, a.token);
        break;
      }
      // 나가리 등으로 끝났으면 다음 판을 열고 다시 시작한다.
      await a.page.locator('#nextRoundBtn:visible, #sideNextRoundBtn:visible').first().click();
      await a.page.locator('#gostopStartBtn').click();
    }
    expect(settledRound, '고/스톱이 나오는 판을 만들지 못함').toBeTruthy();
    const g = settledRound.game;
    expect(g.settlement.status).toBe('done');
    const [balanceA, balanceB] = await Promise.all([a, b].map(async view => (await api(request, '/api/points', view.token, undefined, 'GET')).data.balance));
    expect(balanceA + balanceB).toBe(250_000);
    const paid = g.settlement.transfers.reduce((sum, item) => sum + item.paid, 0);
    expect(paid).toBeGreaterThan(0);
    await expect(a.page.locator('#gostopResult')).toContainText(`${paid.toLocaleString('ko-KR')}P`);
    await expect(a.page.locator('#roomPointBadge')).toHaveText(`내 포인트 ${balanceA.toLocaleString('ko-KR')}P`);

    // 14) 다음 판: 준비 → 다시 시작, 정산은 반복되지 않는다.
    await a.page.locator('#nextRoundBtn:visible, #sideNextRoundBtn:visible').first().click();
    await expect(a.page.locator('#gostopStartBtn')).toBeVisible();
    await a.page.locator('#gostopStartBtn').click();
    await expect.poll(async () => (await roomState(request, a.token)).game.status).toBe('playing');
    expect((await api(request, '/api/points', a.token, undefined, 'GET')).data.balance).toBe(balanceA);
    expect(errors).toEqual([]);
    for (const view of [a, b, c]) await view.context.close();
  });

  test('3인 고스톱 기본 흐름: 7장·바닥 6장, 차례 이동, 관전 없이도 손패 비공개', async ({ browser, request }) => {
    test.setTimeout(90_000);
    const admin = await adminToken(request);
    const a = await enterAsGuest(browser, await issueGuest(request, admin, '하나'));
    const b = await enterAsGuest(browser, await issueGuest(request, admin, '둘'));
    const c = await enterAsGuest(browser, await issueGuest(request, admin, '셋'));
    await a.page.locator('[data-game="gostop"]').click();
    const [created] = await Promise.all([
      a.page.waitForResponse(res => res.url().endsWith('/api/rooms') && res.request().method() === 'POST'),
      a.page.locator('#createRoomBtn').click(),
    ]);
    const code = (await created.json()).state.me.roomCode;
    for (const view of [b, c]) expect((await api(request, '/api/rooms/join', view.token, { code })).status).toBe(200);
    for (const [view, seat] of [[a, '1'], [b, '2'], [c, '3']]) expect((await api(request, '/api/room/choose-role', view.token, { choice: seat })).status).toBe(200);
    await expect(a.page.locator('#gostopPanel')).toBeVisible();
    await expect(a.page.locator('#gostopStartBtn')).toHaveText('고스톱 시작 (3인)');
    await a.page.locator('#gostopStartBtn').click();
    const tokenOf = { 1: a.token, 2: b.token, 3: c.token };
    let state = await roomState(request, a.token);
    expect(state.game.mode).toBe('gostop');
    expect(state.game.floor.length + (state.game.seats[state.game.firstSeat].captured.length)).toBeGreaterThanOrEqual(6);
    for (const seat of ['1', '2', '3']) expect(state.game.seats[seat].handCount).toBe(7);
    await expect(a.page.locator('#gostopHand .hwatu')).toHaveCount(7);
    await expect(a.page.locator('#gostopOpponents .gostopSeat')).toHaveCount(2);
    await expect(a.page.locator('#gostopTitle')).toHaveText('고스톱');
    const firstTurn = state.game.turn;
    state = await playUntil(request, tokenOf, g => g.turn !== firstTurn || g.phase === 'go-stop');
    if (state.game.status === 'playing' && state.game.phase !== 'go-stop') {
      await expect(a.page.locator(`.teamPlayer[data-seat="${state.game.turn}"]`)).toHaveClass(/currentActor/);
    }
    const views = await Promise.all(['1', '2', '3'].map(seat => roomState(request, tokenOf[seat])));
    for (const [index, view] of views.entries()) {
      const own = view.me.myGostopHand.map(card => card.id);
      for (const [otherIndex, other] of views.entries()) {
        if (otherIndex === index) continue;
        const text = JSON.stringify(other);
        for (const id of own) expect(text.includes(`"${id}"`)).toBe(false);
      }
    }
    for (const view of [a, b, c]) await view.context.close();
  });
});
