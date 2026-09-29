const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.6.99 새로고침·재접속 복구: 실제 게스트 브라우저에서 page.reload()로 새로고침한 뒤 같은 방·좌석·
// 판·선택 단계·차례 시계로 돌아오는지 확인한다. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

let ipCounter = 0;
const uniqueIp = () => `100.74.${process.pid % 250}.${(++ipCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;

async function api(request, route, token, body, method = 'POST') {
  const options = { headers: { 'X-Forwarded-For': uniqueIp(), ...(token ? { 'X-Session-Token': token } : {}) } };
  const response = method === 'GET' ? await request.get(route, options) : await request.post(route, { ...options, data: body ?? {} });
  return { status: response.status(), data: await response.json().catch(() => ({})) };
}

const roomState = async (request, token) => (await api(request, '/api/room', token, undefined, 'GET')).data.state;

async function guest(browser, request, admin, label) {
  const { data } = await api(request, '/api/admin/keys', admin, { label });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(data.html)]);
  await expect(page.locator('#lobbyView')).toBeVisible();
  return { context, page, errors, label, token: await page.evaluate(() => document.body.dataset.session) };
}

// A real browser refresh: the page lands on "/" and resumes the same session from sessionStorage.
async function refresh(view, panel) {
  await view.page.reload();
  await expect(view.page.locator('#roomView')).toBeVisible();
  if (panel) await expect(view.page.locator(panel)).toBeVisible();
  await expect(view.page.locator('#connectionBadge')).toHaveText('온라인');
  expect(await view.page.evaluate(() => document.body.dataset.session)).toBe(view.token);
}

async function openRoom(views, gameType, panel, seats) {
  const [host, ...others] = views;
  await host.page.locator(`[data-game="${gameType}"]`).click();
  const [created] = await Promise.all([
    host.page.waitForResponse(res => res.url().endsWith('/api/rooms') && res.request().method() === 'POST'),
    host.page.locator('#createRoomBtn').click(),
  ]);
  const code = (await created.json()).state.me.roomCode;
  for (const view of others) {
    await view.page.locator('#roomPasswordInput').fill(code);
    await view.page.locator('#roomPasswordInput').press('Enter');
    if (panel) await expect(view.page.locator(panel)).toBeVisible();
    else await expect(view.page.locator('#roomView')).toBeVisible();
  }
  return code;
}

async function adminToken(request) {
  const { status, data } = await api(request, '/api/admin/login', null, { password: adminPassword });
  expect(status).toBe(200);
  return data.sessionToken;
}

test('오델로: 새로고침 뒤 같은 좌석·판·차례, 관전자 유지, 종료 후 새로고침·재대결', async ({ browser, request }) => {
  test.setTimeout(90_000);
  const admin = await adminToken(request);
  const [a, b, watcher] = [await guest(browser, request, admin, '흑돌'), await guest(browser, request, admin, '백돌'), await guest(browser, request, admin, '구경')];
  await openRoom([a, b, watcher], 'othello');
  expect((await api(request, '/api/room/choose-role', watcher.token, { choice: 'spectator' })).status).toBe(200);
  expect((await api(request, '/api/room/choose-role', a.token, { choice: 'black' })).status).toBe(200);
  expect((await api(request, '/api/room/choose-role', b.token, { choice: 'white' })).status).toBe(200);
  let state = await roomState(request, a.token);
  expect(state.game.status).toBe('playing');
  const firstMove = state.game.legalMoves?.[0] || { x: 2, y: 3 };
  expect((await api(request, '/api/room/move', a.token, firstMove)).status).toBe(200);
  const before = await roomState(request, b.token);

  await refresh(b);
  state = await roomState(request, b.token);
  expect(state.me.seat).toBe('white');
  expect(state.game.board).toEqual(before.game.board);
  expect(state.game.turn).toBe('white');
  await expect(b.page.locator('#myActionTimer')).toBeVisible(); // 내 차례 시계가 복구됨
  await expect.poll(async () => (await roomState(request, a.token)).game.paused).toBe(false);
  // The refreshed page keeps getting live updates and can act.
  const reply = state.game.legalMoves?.[0];
  if (reply) {
    expect((await api(request, '/api/room/move', b.token, reply)).status).toBe(200);
    await expect.poll(async () => (await roomState(request, a.token)).game.turn).toBe('black');
  }

  await refresh(watcher);
  state = await roomState(request, watcher.token);
  expect(state.me.choice).toBe('spectator');
  expect(state.me.seat).toBe(null);
  expect(Object.values(state.players).map(p => p?.label)).toEqual(['흑돌', '백돌']);

  expect((await api(request, '/api/room/resign', a.token, {})).status).toBe(200);
  await expect.poll(async () => (await roomState(request, b.token)).game.status).toBe('finished');
  await refresh(b);
  state = await roomState(request, b.token);
  expect(state.game.status).toBe('finished');
  expect(state.me.seat).toBe('white');
  await expect(b.page.locator('#sideNextRoundBtn')).toBeVisible(); // 데스크톱 재대결 버튼
  await b.page.locator('#sideNextRoundBtn').click();
  await expect.poll(async () => (await roomState(request, a.token)).game.status).toBe('selecting');
  await expect(b.page.locator('#myActionTimer')).toBeHidden();
  for (const view of [a, b, watcher]) expect(view.errors).toEqual([]);
  for (const view of [a, b, watcher]) await view.context.close();
});

test('다빈치 코드: 추측 대상 선택·오답 뒤 새로고침해도 선택·숫자판·메모가 복구되고 비공개 숫자는 새지 않는다', async ({ browser, request }) => {
  test.setTimeout(90_000);
  const admin = await adminToken(request);
  const views = [await guest(browser, request, admin, '가'), await guest(browser, request, admin, '나'), await guest(browser, request, admin, '보기')];
  const [a, b, watcher] = views;
  await openRoom(views, 'davinci', '#davinciPanel');
  expect((await api(request, '/api/room/choose-role', a.token, { choice: '1' })).status).toBe(200);
  expect((await api(request, '/api/room/choose-role', b.token, { choice: '2' })).status).toBe(200);
  expect((await api(request, '/api/room/choose-role', watcher.token, { choice: 'spectator' })).status).toBe(200);
  expect((await api(request, '/api/room/start-davinci', a.token, {})).status).toBe(200);
  let state = await roomState(request, a.token);
  const actor = state.game.turn === '1' ? a : b;
  const target = actor === a ? b : a;
  const targetSeat = actor === a ? '2' : '1';
  const hidden = (await roomState(request, target.token)).me.myDavinciTiles.find(tile => !tile.revealed);
  expect((await api(request, '/api/room/select-davinci', actor.token, { targetSeat, tileId: hidden.id, expectedRevision: state.game.revision })).status).toBe(200);

  await refresh(actor, '#davinciPanel');
  await expect(actor.page.locator(`.davinciTile[data-tile-id="${hidden.id}"]`)).toHaveClass(/selected-target/);
  await expect(actor.page.locator('.davinciPicker')).toBeVisible();
  await expect(actor.page.locator('.davinciPickNumber')).toHaveCount(12);
  const wrong = (hidden.number + 1) % 12;
  await actor.page.locator('.davinciPickNumber').nth(wrong).click();
  await expect.poll(async () => (await roomState(request, a.token)).game.history.at(-1)).toMatchObject({ id: hidden.id, number: wrong, correct: false });

  for (const view of [actor, watcher]) {
    await refresh(view, '#davinciPanel');
    await expect(view.page.locator(`.davinciTile[data-tile-id="${hidden.id}"] .davinciMemo`)).toContainText(`✗${wrong}`);
  }
  // Privacy after a refresh: the spectator and the other player still only see "?" for hidden tiles.
  const secretOf = (await roomState(request, target.token)).me.myDavinciTiles;
  for (const tile of secretOf.filter(t => !t.revealed)) {
    await expect(watcher.page.locator(`.davinciTile[data-tile-id="${tile.id}"] .davinciTileValue`)).toHaveText('?');
    await expect(actor.page.locator(`.davinciTile[data-tile-id="${tile.id}"] .davinciTileValue`)).toHaveText('?');
  }
  expect((await roomState(request, watcher.token)).me.myDavinciTiles ?? null).toBe(null);
  for (const view of views) expect(view.errors).toEqual([]);
  for (const view of views) await view.context.close();
});

test('윷놀이: 윷을 던진 뒤 새로고침해도 같은 말 선택지(legalMoves)로 이어서 움직인다', async ({ browser, request }) => {
  test.setTimeout(90_000);
  const admin = await adminToken(request);
  const [a, b] = [await guest(browser, request, admin, '파랑'), await guest(browser, request, admin, '빨강')];
  await openRoom([a, b], 'yut');
  expect((await api(request, '/api/room/choose-role', a.token, { choice: 'black' })).status).toBe(200);
  expect((await api(request, '/api/room/choose-role', b.token, { choice: 'white' })).status).toBe(200);
  const tokenOf = { black: a, white: b };
  let thrown = null;
  for (let attempt = 0; attempt < 12 && !thrown; attempt += 1) {
    const g = (await roomState(request, a.token)).game;
    const mover = tokenOf[g.turn];
    if (g.phase === 'throw') {
      const result = await api(request, '/api/room/throw-yut', mover.token, {});
      expect(result.status).toBe(200);
    }
    const after = (await roomState(request, mover.token)).game;
    if (after.phase === 'move' && after.legalMoves?.length) thrown = { view: mover, game: after };
  }
  expect(thrown).not.toBe(null);
  const { view, game } = thrown;
  await refresh(view);
  const restored = (await roomState(request, view.token)).game;
  expect(restored.legalMoves).toEqual(game.legalMoves);
  await expect(view.page.locator('#yutMoveChoices .yutPieceChoice').first()).toBeVisible();
  const choices = await view.page.locator('#yutMoveChoices .yutPieceChoice').count();
  expect(choices).toBeGreaterThan(0);
  await view.page.locator('#yutMoveChoices .yutPieceChoice').first().click();
  await expect.poll(async () => JSON.stringify((await roomState(request, a.token)).game.pieces)).not.toBe(JSON.stringify(game.pieces));
  for (const v of [a, b]) expect(v.errors).toEqual([]);
  for (const v of [a, b]) await v.context.close();
});

test('스무고개: 질문 차례에 새로고침해도 입력 단계와 원래 마감 시각이 유지된다', async ({ browser, request }) => {
  test.setTimeout(90_000);
  const admin = await adminToken(request);
  const [a, b] = [await guest(browser, request, admin, '출제'), await guest(browser, request, admin, '도전')];
  await openRoom([a, b], 'twentyquestions', '#twentyPanel');
  expect((await api(request, '/api/room/choose-role', a.token, { choice: '1' })).status).toBe(200);
  expect((await api(request, '/api/room/choose-role', b.token, { choice: '2' })).status).toBe(200);
  expect((await api(request, '/api/room/twenty-start', a.token, { mode: 'individual', totalRounds: 1 })).status).toBe(200);
  let state = await roomState(request, a.token);
  const tokenOf = { 1: a, 2: b };
  const drawer = tokenOf[state.game.drawerSeat];
  const challenger = drawer === a ? b : a;
  expect((await api(request, '/api/room/twenty-secret', drawer.token, { secret: '사과' })).status).toBe(200);
  await expect.poll(async () => (await roomState(request, challenger.token)).me.actionTimer?.phase).toBe('asking');
  const before = (await roomState(request, challenger.token)).me.actionTimer;
  await challenger.page.waitForTimeout(2500); // some of the turn is used before the refresh

  await refresh(challenger, '#twentyPanel');
  await expect(challenger.page.locator('#twentyQuestionForm')).toBeVisible();
  await expect(challenger.page.locator('#myActionTimer')).toBeVisible();
  state = await roomState(request, challenger.token);
  expect(state.game.phase).toBe('asking');
  // Same server deadline, not a fresh 60 seconds from the reconnect.
  expect(Math.abs(state.me.actionTimer.deadlineAt - before.deadlineAt)).toBeLessThan(300);
  await challenger.page.locator('#twentyQuestionInput').fill('과일인가요?');
  await challenger.page.locator('#twentyQuestionInput').press('Enter');
  await expect.poll(async () => (await roomState(request, drawer.token)).game.phase).toBe('answering');
  for (const v of [a, b]) expect(v.errors).toEqual([]);
  for (const v of [a, b]) await v.context.close();
});

test('고스톱: 짝패·고/스톱·국진 선택 중 새로고침해도 같은 선택 화면으로 돌아와 이어서 고른다', async ({ browser, request }) => {
  test.setTimeout(120_000);
  const admin = await adminToken(request);
  const [a, b] = [await guest(browser, request, admin, '복구A'), await guest(browser, request, admin, '복구B')];
  await openRoom([a, b], 'gostop', '#gostopPanel');
  for (const [index, view] of [a, b].entries()) expect((await api(request, '/api/room/choose-role', view.token, { choice: String(index + 1) })).status).toBe(200);
  const fixture = async name => {
    const result = await api(request, '/api/test/gostop-fixture', a.token, { fixture: name });
    expect(result.status, JSON.stringify(result.data)).toBe(200);
    await expect.poll(async () => (await roomState(request, a.token)).game.phase).toBe(name);
  };

  await fixture('choose-floor');
  const options = (await roomState(request, a.token)).game.choice.options;
  await refresh(a, '#gostopPanel');
  await expect(a.page.locator('#gostopFloor button.gostopChoiceTarget')).toHaveCount(options.length);
  await a.page.locator('#gostopFloor button.gostopChoiceTarget').first().click();
  await expect.poll(async () => { const g = (await roomState(request, a.token)).game; return `${g.phase}:${g.turn}`; }).toBe('play:2');

  await fixture('go-stop');
  const score = (await roomState(request, a.token)).game.stopPreview.score;
  await refresh(a, '#gostopPanel');
  await expect(a.page.locator('.gostopDecisionPanel')).toContainText(`현재 ${score}점`);
  await a.page.getByRole('button', { name: '고 · 계속하기' }).click();
  await expect.poll(async () => { const g = (await roomState(request, a.token)).game; return [g.phase, g.seats['1'].goCount]; }).toEqual(['play', 1]);

  await fixture('gukjin');
  await refresh(a, '#gostopPanel');
  await a.page.getByRole('button', { name: '쌍피로' }).click();
  await expect.poll(async () => (await roomState(request, a.token)).game.seats['1'].gukjin).toBe('pi');
  for (const v of [a, b]) expect(v.errors).toEqual([]);
  for (const v of [a, b]) await v.context.close();
});
