const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.6.92~v1.6.93 고스톱·맞고 UX + 규칙·정산: 서로 다른 browser context의 실제 게스트 계정으로 3인 고스톱 고→스톱·패자별 정산,
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

async function setGostopFixture(request, view, fixture) {
  const result = await api(request, '/api/test/gostop-fixture', view.token, { fixture });
  expect(result.status, JSON.stringify(result.data)).toBe(200);
  await expect.poll(async () => (await roomState(request, view.token)).game.phase).toBe(fixture);
}

test.describe('고스톱·맞고 UX·규칙·정산 (v1.6.92~v1.6.93)', () => {
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
        await expect(decider.page.getByRole('button', { name: '고 · 계속하기' })).toBeVisible();
        for (const view of [...players.filter(view => view !== decider), watcher]) await expect(view.page.getByRole('button', { name: '고 · 계속하기' })).toHaveCount(0);
        // 재접속(새로고침) 중에도 결정 단계와 내 손패가 복원된다.
        const handBefore = (await roomState(request, decider.token)).me.myGostopHand.map(card => card.id);
        await reopen(decider);
        await expect(decider.page.getByRole('button', { name: '고 · 계속하기' })).toBeVisible();
        await expect(decider.page.locator('#gostopHand .hwatu')).toHaveCount(handBefore.length);
        await decider.page.getByRole('button', { name: '고 · 계속하기' }).click();
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
          await next.page.getByRole('button', { name: '스톱 · 현재 정산' }).click();
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
    // v1.7.3: 실제 이동액의 10%는 소각되므로 총량은 줄기만 한다(포인트가 새로 생기지 않음).
    expect(end.reduce((x, y) => x + y, 0)).toBeLessThanOrEqual(startBalances.reduce((x, y) => x + y, 0));
    if (g.result.kind === 'win') {
      const credited = g.settlement.transfers.reduce((sum, item) => sum + item.credited, 0);
      expect(g.settlement.balances[g.result.winner] - g.settlement.balancesBefore[g.result.winner]).toBe(credited);
      for (const item of g.settlement.transfers) expect(item.credited).toBe(Math.floor(item.paid * 90 / 100));
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

  test('맞고 나가리: 승패 정산 없음·기지급 뻑 보너스 유지·다음 판 ×2·잔액 한도 표시', async ({ browser, request }) => {
    test.setTimeout(240_000);
    const admin = await adminToken(request);
    const a = await guest(browser, request, admin, '가람');
    const b = await guest(browser, request, admin, '나래');
    const tokenOf = { get 1() { return a.token; }, get 2() { return b.token; } };
    await openRoom(a, [b], request);
    const before = await Promise.all([a, b].map(view => balance(request, view.token)));
    // Existing test-only hand reaches a genuine draw through legal moves and two paid bonuses.
    // Random repeated deals could bankrupt a participant before drawing, or skip this check entirely.
    expect((await api(request, '/api/test/gostop-fixture', a.token, { fixture: 'first-ppeok' })).status).toBe(200);
    for (const [seat, cardId] of [['1', 'm05-pi1'], ['2', 'm08-pi1'], ['1', 'm06-pi1'],
      ['2', 'm09-pi1'], ['1', 'm05-ribbon'], ['1', 'm04-pi2']]) {
      const played = await api(request, '/api/room/gostop-play', tokenOf[seat], { cardId });
      expect(played.status, JSON.stringify(played.data)).toBe(200);
    }
    const nagari = await roomState(request, a.token);
    expect(nagari.game.status).toBe('draw');
    expect(nagari.game.nagariStreak).toBe(1);
    expect(nagari.game.bonusAwards.map(award => award.paid)).toEqual([700, 1400]);
    await expect(a.page.locator('#gostopResult')).toContainText('나가리');
    await expect(a.page.locator('#gostopResult')).toContainText('다음 판 ×2');
    // v1.7.3: 받는 사람은 이동액의 90%, 내는 사람은 100%.
    const net = { 1: 0, 2: 0 };
    for (const award of nagari.game.bonusAwards || []) {
      const payer = award.seat === '1' ? '2' : '1';
      net[award.seat] += award.credited ?? award.paid;
      net[payer] -= award.paid;
    }
    expect(await Promise.all([a, b].map(view => balance(request, view.token)))).toEqual([before[0] + net[1], before[1] + net[2]]);
    // 재접속만으로는 배수가 초기화되지 않는다.
    await reopen(b);
    await a.page.locator('#nextRoundBtn:visible, #sideNextRoundBtn:visible').first().click();
    await expect(a.page.locator('#gostopSetupNote')).toContainText('나가리 ×2 이월');
    await a.page.locator('#gostopStartBtn').click();
    await expect.poll(async () => (await roomState(request, a.token)).game.status).not.toBe('selecting');
    const started = await roomState(request, a.token);
    // A legal initial 총통 may finish the freshly dealt hand immediately; its actual payment still uses ×2.
    if (started.game.status === 'finished') {
      expect(started.game.result.losers.length).toBeGreaterThan(0);
      for (const loser of started.game.result.losers) {
        expect(loser.factors).toContainEqual({ key: 'nagari', multiplier: 2, count: 1 });
      }
      await expect(a.page.locator('#gostopResult')).toContainText('나가리 ×2');
    } else {
      expect(started.game.status).toBe('playing');
      expect(started.game.nagariMultiplier).toBe(2);
      await expect(a.page.locator('#gostopMeta')).toContainText('나가리 ×2', { timeout: 15_000 });
    }

    // 잔액 한도: 서버가 한도를 적용한 정산 결과(계산액 → 실제 지급액)를 그대로 보여준다(표시 검증: 같은 렌더 함수에 결과만 바꿔 전달).
    const current = await roomState(request, a.token);
    await a.page.evaluate((state) => {
      Object.assign(state.game, { status: 'finished', phase: 'done', winner: '1',
        result: { kind: 'win', winner: '1', reason: 'stop', base: 8, goCount: 0, score: 8, items: [{ key: 'pi', points: 8 }], pointsPerScore: 100,
          losers: [{ seat: '2', baks: ['pibak'], factors: [{ key: 'pibak', multiplier: 2, count: 1 }], multiplier: 2, amount: 1600, score: 8, pointsPerScore: 100 }] },
        settlement: { status: 'done', kind: 'win', transfers: [{ fromSeat: '2', toSeat: '1', requested: 1600, paid: 700, capped: true }],
          balancesBefore: { 1: 100000, 2: 700 }, balances: { 1: 100700, 2: 0 } } });
      window.GostopUI.render(state);
    }, current);
    await expect(a.page.locator('#gostopResult')).toContainText('보유 포인트 한도 적용');
    await expect(a.page.locator('#gostopResult')).toContainText('-700P');
    await expect(a.page.locator('#gostopResult')).toContainText('1,600P');
    await expect(a.page.locator('#gostopResult')).toContainText('+700P');
    for (const view of [a, b]) await view.context.close();
  });

  test('v1.6.93 시작 전 판돈·참가자 포인트와 최근 정산은 본인 기준으로 표시한다', async ({ browser, request }) => {
    const admin = await adminToken(request);
    const a = await guest(browser, request, admin, '가온');
    const b = await guest(browser, request, admin, '나온');
    const watcher = await guest(browser, request, admin, '관전93');
    await openRoom(a, [b], request, [watcher]);
    await Promise.all([a, b].map(view => api(request, '/api/points', view.token, undefined, 'GET')));
    expect((await api(request, '/api/room/set-gostop-stake', a.token, { pointsPerScore: 100 })).status).toBe(200);

    await expect(a.page.locator('#gostopStartBtn')).toHaveText('맞고 시작 (2인)');
    await expect(a.page.locator('#gostopSetupNote')).toContainText('맞고 · 점당 100P');
    await expect(a.page.locator('#gostopSetupNote')).toContainText('실제 손실은 보유 포인트 한도 내에서 정산');
    await expect(a.page.locator('#gostopSetupPlayers')).toContainText('가온');
    await expect(a.page.locator('#gostopSetupPlayers')).toContainText('나온');
    await expect(a.page.locator('#gostopSetupPlayers')).toContainText('보유 100,000P');
    await expect(a.page.locator('#gostopSetupPlayers')).toContainText('참가 가능');

    const normal = await roomState(request, a.token);
    await a.page.evaluate((state) => {
      state.game.lobbyPoints['2'] = { balance: 0, eligible: false };
      window.GostopUI.render(state);
    }, normal);
    await expect(a.page.locator('#gostopStartBtn')).toBeDisabled();
    await expect(a.page.locator('#gostopSetupPlayers')).toContainText('참가 불가 · 0P');

    await setGostopFixture(request, a, 'go-stop');
    await expect(a.page.getByRole('button', { name: '스톱 · 현재 정산' })).toBeVisible();
    await a.page.getByRole('button', { name: '스톱 · 현재 정산' }).click();
    await expect.poll(async () => (await roomState(request, a.token)).game.status).toBe('finished');

    const pa = (await api(request, '/api/points', a.token, undefined, 'GET')).data;
    const pb = (await api(request, '/api/points', b.token, undefined, 'GET')).data;
    const pw = (await api(request, '/api/points', watcher.token, undefined, 'GET')).data;
    expect(pa.recentGostopSettlements[0].mode).toBe('matgo');
    expect(pa.recentGostopSettlements[0].delta).toBeGreaterThan(0);
    expect(pb.recentGostopSettlements[0].delta).toBeLessThan(0);
    expect(pa.recentGostopSettlements[0].delta).toBe(Math.floor(-pb.recentGostopSettlements[0].delta * 90 / 100)); // v1.7.3: 승자 90%
    expect(pw.recentGostopSettlements).toEqual([]);
    expect(JSON.stringify(pa.recentGostopSettlements)).not.toContain('guest:');

    // The other player did not send the finish request; their open page must refresh from SSE.
    await expect(b.page.locator('#pointBalanceText')).toHaveText(`보유 ${pb.balance.toLocaleString('ko-KR')}P`);
    await b.page.locator('#gostopPointHistory summary').click();
    await expect(b.page.locator('#gostopPointHistoryList')).toContainText(
      `${pb.recentGostopSettlements[0].delta.toLocaleString('ko-KR')}P`);

    await reopen(a);
    await a.page.locator('#gostopPointHistory summary').click();
    await expect(a.page.locator('#gostopPointHistoryList')).toContainText('맞고');
    await expect(a.page.locator('#gostopPointHistoryList')).toContainText('+' + pa.recentGostopSettlements[0].delta.toLocaleString('ko-KR') + 'P');
    for (const view of [a, b, watcher]) await view.context.close();
  });

  test('v1.6.95 첫뻑 즉시 지급은 상대·본인 SSE 화면과 본인 원장에 반영된다', async ({ browser, request }) => {
    const admin = await adminToken(request);
    const a = await guest(browser, request, admin, '첫뻑A');
    const b = await guest(browser, request, admin, '첫뻑B');
    const watcher = await guest(browser, request, admin, '첫뻑관전');
    await openRoom(a, [b], request, [watcher]);
    const fixture = await api(request, '/api/test/gostop-fixture', a.token, { fixture: 'first-ppeok' });
    expect(fixture.status).toBe(200);
    expect((await api(request, '/api/room/gostop-play', a.token, { cardId: 'm05-pi1' })).status).toBe(200);
    await expect(b.page.locator('#pointBalanceText')).toHaveText('보유 99,300P');
    await expect(a.page.locator('#pointBalanceText')).toHaveText('보유 100,630P'); // v1.7.3: 700P 중 10% 소각
    await expect(watcher.page.locator('#gostopEvent')).toContainText('첫뻑 보너스');
    expect((await api(request, '/api/points', watcher.token, undefined, 'GET')).data.recentGostopSettlements).toEqual([]);
    await b.page.locator('#gostopPointHistory summary').click();
    await expect(b.page.locator('#gostopPointHistoryList')).toContainText('-700P');
    for (const view of [a, b, watcher]) await view.context.close();
  });

  test('v1.6.93 획득패 4분류·피 계산 장수와 공개 카드 1~12월을 카드 자체에서 확인한다', async ({ browser, request }) => {
    const admin = await adminToken(request);
    const a = await guest(browser, request, admin, '월표시A');
    const b = await guest(browser, request, admin, '월표시B');
    await openRoom(a, [b], request);
    await setGostopFixture(request, a, 'go-stop');
    const state = await roomState(request, a.token);

    await a.page.evaluate((view) => {
      view.game.status = 'playing';
      view.game.phase = 'play';
      view.game.turn = '2';
      view.game.floor = [
        'm01-pi1','m02-pi1','m03-gwang','m03-ribbon','m04-pi1','m05-pi1','m06-pi1',
        'm07-pi1','m08-pi1','m09-pi1','m10-pi1','m11-pi1','m12-ribbon'
      ];
      view.game.floorBonus = {};
      view.game.choice = null;
      view.game.lastEvent = null;
      view.game.seats['1'].captured = ['m01-gwang','m02-animal','m01-ribbon','m11-ssangpi','m12-ssangpi','bonus-3'];
      view.game.seats['1'].counts.pi = 7;
      view.game.seats['2'].handCount = 4;
      view.me.myGostopHand = [{ id: 'm10-pi2', legal: false, shake: false, bomb: false, kong: false }];
      window.GostopUI.render(view);
    }, state);

    const months = await a.page.locator('#gostopFloor .hwatuMonth').allTextContents();
    for (let month = 1; month <= 12; month += 1) expect(months).toContain(month + '월');
    await expect(a.page.locator('#gostopFloor .month-3 .hwatuMonth')).toHaveCount(2);
    await expect(a.page.locator('#gostopMine .pile-gwang > small')).toHaveText('광 1');
    await expect(a.page.locator('#gostopMine .pile-animal > small')).toHaveText('열끗 1');
    await expect(a.page.locator('#gostopMine .pile-ribbon > small')).toHaveText('띠 1');
    await expect(a.page.locator('#gostopMine .pile-pi > small')).toHaveText('피 7 · 카드 3장');
    await expect(a.page.locator('#gostopMine .pile-pi .hwatu')).toHaveCount(3);
    expect(await a.page.locator('#gostopOpponents .hwatuBack .hwatuMonth').count()).toBe(0);
    expect(await a.page.locator('#gostopOpponents .hwatuBack').evaluateAll(els => els.some(el => /월/.test(el.textContent || '')))).toBe(false);
    for (const view of [a, b]) await view.context.close();
  });

  test('v1.6.93 짝패·고/스톱·국진 선택은 재접속 뒤 서버 상태 그대로 복구되고 실제 선택으로 이어진다', async ({ browser, request }) => {
    const admin = await adminToken(request);
    const a = await guest(browser, request, admin, '복구A');
    const b = await guest(browser, request, admin, '복구B');
    await openRoom(a, [b], request);

    await setGostopFixture(request, a, 'choose-floor');
    let before = await roomState(request, a.token);
    expect(before.game.choice.options).toHaveLength(2);
    await reopen(a);
    await expect(a.page.locator('#gostopFloor button.gostopChoiceTarget')).toHaveCount(2);
    const restored = await roomState(request, a.token);
    expect(restored.game.choice.options).toEqual(before.game.choice.options);
    await a.page.locator('#gostopFloor button.gostopChoiceTarget').first().click();
    await expect.poll(async () => {
      const view = await roomState(request, a.token);
      return view.game.phase + ':' + view.game.turn;
    }).toBe('play:2');
    await expect(a.page.locator('#gostopFloor button.gostopChoiceTarget')).toHaveCount(0);
    await expect.poll(() => a.page.evaluate(() => window.GostopUI.fxBusy()), { timeout: 5000 }).toBe(false);

    await setGostopFixture(request, a, 'go-stop');
    before = await roomState(request, a.token);
    const score = before.game.stopPreview.score;
    await reopen(a);
    await expect(a.page.locator('.gostopDecisionPanel')).toContainText('현재 ' + score + '점');
    await expect(a.page.getByRole('button', { name: '고 · 계속하기' })).toBeVisible();
    await expect(a.page.getByRole('button', { name: '스톱 · 현재 정산' })).toBeVisible();
    await a.page.getByRole('button', { name: '고 · 계속하기' }).click();
    await expect.poll(async () => {
      const view = await roomState(request, a.token);
      return [view.game.phase, view.game.turn, view.game.seats['1'].goCount];
    }).toEqual(['play', '2', 1]);

    await setGostopFixture(request, a, 'gukjin');
    await reopen(a);
    await expect(a.page.getByRole('button', { name: '열끗으로' })).toBeVisible();
    await expect(a.page.getByRole('button', { name: '쌍피로' })).toBeVisible();
    await a.page.getByRole('button', { name: '쌍피로' }).click();
    await expect.poll(async () => {
      const view = await roomState(request, a.token);
      return [view.game.phase, view.game.turn, view.game.seats['1'].gukjin];
    }).toEqual(['play', '2', 'pi']);

    for (const view of [a, b]) await view.context.close();
  });

});
