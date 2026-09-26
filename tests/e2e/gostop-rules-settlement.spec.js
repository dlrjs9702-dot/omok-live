const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.6.87 고스톱·맞고 규칙·정산: 서로 다른 browser context의 실제 게스트 계정으로 3인 고스톱 고→스톱·패자별 정산,
// 재접속 복원, 관전자 비공개, 나가리 다음 판 배수, 잔액 한도 표시를 확인한다. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

let ipCounter = 0;
function uniqueIp() {
  ipCounter += 1;
  return `100.65.${process.pid % 250}.${(ipCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;
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

async function guest(browser, request, admin, label) {
  const { data } = await api(request, '/api/admin/keys', admin, { label });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(data.html)]);
  await expect(page.locator('#lobbyView')).toBeVisible();
  return { context, page, token: await page.evaluate(() => document.body.dataset.session), label, keyId: data.key.id, admin, request };
}

// Reconnect as a guest does: leaving the page ends its session, and opening the (reissued) entry
// file again starts a new one that the server puts back into the same seat.
async function reopen(view) {
  const { data } = await api(view.request, `/api/admin/keys/${view.keyId}/reissue`, view.admin, {});
  await view.page.goto('about:blank'); // the entry file runs from a blank page (the game page's CSP blocks it)
  await Promise.all([view.page.waitForURL(/\/guest-entry$/), view.page.setContent(data.html)]);
  view.token = await view.page.evaluate(() => document.body.dataset.session);
}

const roomState = async (request, token) => (await api(request, '/api/room', token, undefined, 'GET')).data.state;
const balance = async (request, token) => (await api(request, '/api/points', token, undefined, 'GET')).data.balance;

// Plays legal moves through the API (the players' own tokens) until `stopWhen` or a decision.
async function playUntil(request, tokenOf, stopWhen, maxSteps = 250) {
  for (let step = 0; step < maxSteps; step += 1) {
    const state = await roomState(request, Object.values(tokenOf)[0]);
    const g = state.game;
    if (g.status !== 'playing' || stopWhen(g)) return state;
    const token = tokenOf[g.turn];
    const mine = await roomState(request, token);
    let result;
    if (g.phase === 'play') {
      const hand = mine.me.myGostopHand;
      result = hand.length ? await api(request, '/api/room/gostop-play', token, { cardId: hand[0].id }) : await api(request, '/api/room/gostop-flip', token, {});
    } else if (g.phase === 'choose-floor' || g.phase === 'choose-flip') result = await api(request, '/api/room/gostop-choose', token, { cardId: g.choice.options[0] });
    else if (g.phase === 'gukjin') result = await api(request, '/api/room/gostop-gukjin', token, { asPi: false });
    else return state; // go-stop: the caller decides
    expect(result.status, JSON.stringify(result.data)).toBe(200);
  }
  return roomState(request, Object.values(tokenOf)[0]);
}

async function openRoom(host, others, request, spectators = []) {
  await host.page.locator('[data-game="gostop"]').click();
  const [created] = await Promise.all([
    host.page.waitForResponse(res => res.url().endsWith('/api/rooms') && res.request().method() === 'POST'),
    host.page.locator('#createRoomBtn').click(),
  ]);
  const code = (await created.json()).state.me.roomCode;
  // Everyone else joins from their own lobby page with the room code (a page left mid-lobby would
  // end that guest's session, so no reloads here).
  for (const view of [...others, ...spectators]) {
    await view.page.locator('#roomPasswordInput').fill(code);
    await view.page.locator('#roomPasswordInput').press('Enter');
    await expect(view.page.locator('#gostopPanel')).toBeVisible();
  }
  for (const [index, view] of [host, ...others].entries()) expect((await api(request, '/api/room/choose-role', view.token, { choice: String(index + 1) })).status).toBe(200);
  for (const view of spectators) expect((await api(request, '/api/room/choose-role', view.token, { choice: 'spectator' })).status).toBe(200);
  for (const view of [host, ...others, ...spectators]) await expect(view.page.locator('#gostopPanel')).toBeVisible();
  await expect.poll(async () => {
    const players = (await roomState(request, host.token)).players;
    return [host, ...others].map((_, index) => players[String(index + 1)]?.connected);
  }).toEqual([host, ...others].map(() => true));
}

test.describe('고스톱·맞고 규칙·정산 (v1.6.87)', () => {
  test('3인 고스톱: 고 → 스톱, 패자별 박·정산, 재접속 복원, 관전자 비공개', async ({ browser, request }) => {
    test.setTimeout(180_000);
    const admin = await adminToken(request);
    const players = [];
    for (const label of ['하나', '둘', '셋']) players.push(await guest(browser, request, admin, label));
    const watcher = await guest(browser, request, admin, '관전');
    const errors = [];
    for (const view of [...players, watcher]) view.page.on('pageerror', error => errors.push(error.message));
    const [a, b, c] = players;
    const tokenOf = { get 1() { return a.token; }, get 2() { return b.token; }, get 3() { return c.token; } };
    const viewOf = { 1: a, 2: b, 3: c };
    await openRoom(a, [b, c], request, [watcher]);
    const startBalances = await Promise.all(players.map(view => balance(request, view.token)));

    let decided = null;
    for (let round = 0; round < 6 && !decided; round += 1) {
      await expect(a.page.locator('#gostopStartBtn')).toHaveText('고스톱 시작 (3인)');
      await a.page.locator('#gostopStartBtn').click();
      await expect.poll(async () => (await roomState(request, a.token)).game.status).not.toBe('selecting');
      let state = await playUntil(request, tokenOf, g => g.phase === 'go-stop');
      if (state.game.phase === 'go-stop' && state.game.status === 'playing') {
        const seat = state.game.turn;
        const decider = viewOf[seat];
        // 고/스톱 버튼은 결정할 사람에게만.
        await expect(decider.page.getByRole('button', { name: /^고 \(1고\)$/ })).toBeVisible();
        for (const view of [...players.filter(view => view !== decider), watcher]) await expect(view.page.getByRole('button', { name: /^고 \(/ })).toHaveCount(0);
        // 재접속(새로고침) 중에도 결정 단계와 내 손패가 복원된다.
        const handBefore = (await roomState(request, decider.token)).me.myGostopHand.map(card => card.id);
        await reopen(decider);
        await expect(decider.page.getByRole('button', { name: /^고 \(1고\)$/ })).toBeVisible();
        await expect(decider.page.locator('#gostopHand .hwatu')).toHaveCount(handBefore.length);
        await decider.page.getByRole('button', { name: /^고 \(1고\)$/ }).click();
        await expect.poll(async () => (await roomState(request, a.token)).game.seats[seat].goCount).toBe(1);
        await expect(watcher.page.locator('#gostopOpponents')).toContainText('1고');
        // 관전자 DOM에는 공개 카드(바닥·먹은 패)만 앞면으로 있다.
        state = await roomState(request, watcher.token);
        const faces = await watcher.page.locator('#gostopPanel .hwatu:not(.hwatuBack)').count();
        expect(faces).toBe(state.game.floor.length + Object.values(state.game.seats).reduce((n, s) => n + s.captured.length, 0) + (state.game.lastEvent?.revealed?.length ? 0 : 0));
        const html = await watcher.page.content();
        for (const view of players) for (const card of (await roomState(request, view.token)).me.myGostopHand || []) expect(html).not.toContain(card.id);
        // 다음 결정까지 진행 → 스톱(누구든 결정하는 사람이 화면에서 스톱).
        state = await playUntil(request, tokenOf, g => g.phase === 'go-stop');
        if (state.game.phase === 'go-stop' && state.game.status === 'playing') {
          const next = viewOf[state.game.turn];
          await next.page.getByRole('button', { name: '스톱' }).click();
        }
        await expect.poll(async () => (await roomState(request, a.token)).game.status, { timeout: 20_000 }).not.toBe('playing');
        decided = await roomState(request, a.token);
        break;
      }
      await a.page.locator('#nextRoundBtn:visible, #sideNextRoundBtn:visible').first().click();
    }
    expect(decided, '고/스톱 판을 만들지 못함').toBeTruthy();
    const g = decided.game;
    expect(g.settlement.status).toBe('done');
    const end = await Promise.all(players.map(view => balance(request, view.token)));
    expect(end.reduce((x, y) => x + y, 0)).toBe(startBalances.reduce((x, y) => x + y, 0));
    if (g.result.kind === 'win') {
      expect(g.result.losers).toHaveLength(2);
      for (const loser of g.result.losers) {
        const transfer = g.settlement.transfers.find(item => item.fromSeat === loser.seat);
        expect(transfer.requested).toBe(loser.amount);
        expect(loser.amount).toBe(g.result.score * loser.multiplier * g.result.pointsPerScore);
        // 결과 화면에 패자별 계산과 박이 표시된다.
        const line = a.page.locator('#gostopResult p', { hasText: `${viewOf[loser.seat].label} →` });
        await expect(line).toContainText(`${transfer.paid.toLocaleString('ko-KR')}P`);
        for (const bak of loser.baks) await expect(line).toContainText({ pibak: '피박', gwangbak: '광박', meongbak: '멍박', gobak: '고박' }[bak]);
      }
      // 먼저 고한 사람이 지면 고박은 그 패자에게만.
      for (const loser of g.result.losers) expect(loser.baks.includes('gobak')).toBe((g.seats[loser.seat].goCount || 0) > 0);
    }
    expect(errors).toEqual([]);
    for (const view of [...players, watcher]) await view.context.close();
  });

  test('맞고 나가리: 포인트 이동 없음·다음 판 ×2 표시·배수 이월, 잔액 한도 결과 표시', async ({ browser, request }) => {
    test.setTimeout(240_000);
    const admin = await adminToken(request);
    const a = await guest(browser, request, admin, '가람');
    const b = await guest(browser, request, admin, '나래');
    const tokenOf = { get 1() { return a.token; }, get 2() { return b.token; } };
    await openRoom(a, [b], request);
    const before = await Promise.all([a, b].map(view => balance(request, view.token)));
    // 항상 '고'를 부르면 끝까지 더 나지 않는 판이 나가리로 끝나기 쉽다.
    let nagari = null;
    for (let round = 0; round < 15 && !nagari; round += 1) {
      await a.page.locator('#gostopStartBtn').click();
      await expect.poll(async () => (await roomState(request, a.token)).game.status).not.toBe('selecting');
      let state;
      for (let guard = 0; guard < 40; guard += 1) {
        state = await playUntil(request, tokenOf, g => g.phase === 'go-stop');
        if (state.game.status !== 'playing') break;
        expect((await api(request, '/api/room/gostop-decide', tokenOf[state.game.turn], { choice: 'go' })).status).toBe(200);
      }
      state = await roomState(request, a.token);
      if (state.game.status === 'draw') { nagari = state; break; }
      await a.page.locator('#nextRoundBtn:visible, #sideNextRoundBtn:visible').first().click();
      await expect(a.page.locator('#gostopStartBtn')).toBeVisible();
      before.splice(0, 2, ...await Promise.all([a, b].map(view => balance(request, view.token))));
    }
    test.skip(!nagari, '15판 안에 나가리가 나오지 않음(무작위 분배)');
    await expect(a.page.locator('#gostopResult')).toContainText('나가리');
    await expect(a.page.locator('#gostopResult')).toContainText('다음 판 ×2');
    expect(await Promise.all([a, b].map(view => balance(request, view.token)))).toEqual(before);
    // 재접속만으로는 배수가 초기화되지 않는다.
    await reopen(b);
    await a.page.locator('#nextRoundBtn:visible, #sideNextRoundBtn:visible').first().click();
    await expect(a.page.locator('#gostopSetupNote')).toContainText('나가리 ×2 이월');
    await a.page.locator('#gostopStartBtn').click();
    await expect(a.page.locator('#gostopMeta')).toContainText('나가리 ×2');
    expect((await roomState(request, a.token)).game.nagariMultiplier).toBe(2);

    // 잔액 한도: 서버가 한도를 적용한 정산 결과(계산액 → 실제 지급액)를 그대로 보여준다(표시 검증: 같은 렌더 함수에 결과만 바꿔 전달).
    const current = await roomState(request, a.token);
    await a.page.evaluate((state) => {
      Object.assign(state.game, { status: 'finished', phase: 'done', winner: '1',
        result: { kind: 'win', winner: '1', reason: 'stop', base: 8, goCount: 0, score: 8, items: [{ key: 'pi', points: 8 }], pointsPerScore: 100,
          losers: [{ seat: '2', baks: ['pibak'], factors: [{ key: 'pibak', multiplier: 2, count: 1 }], multiplier: 2, amount: 1600, score: 8, pointsPerScore: 100 }] },
        settlement: { status: 'done', kind: 'win', transfers: [{ fromSeat: '2', toSeat: '1', requested: 1600, paid: 700, capped: true }] } });
      window.GostopUI.render(state);
    }, current);
    await expect(a.page.locator('#gostopResult')).toContainText('보유 포인트 한도 적용');
    await expect(a.page.locator('#gostopResult')).toContainText('-700P');
    await expect(a.page.locator('#gostopResult')).toContainText('1,600P');
    await expect(a.page.locator('#gostopResult')).toContainText('+700P');
    for (const view of [a, b]) await view.context.close();
  });
});
