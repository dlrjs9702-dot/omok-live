const { test, expect } = require('@playwright/test');
const yut = require('../../lib/games/yut');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.6.83 윷놀이 말 직접 선택: 실제 브라우저에서 canvas 좌표를 클릭해 검증한다. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

// Board coordinates (720×720 canvas space) -- the same table public/app.js yutNodePosition() uses.
const NODE = { 0: [630, 630], 1: [630, 518], 2: [630, 406], 3: [630, 294], 4: [630, 182], 5: [630, 70], 7: [406, 70], finishLine: [678, 678] };
const START = NODE[0];

// 5 admin logins per client IP per 15 minutes; give each login its own documentation-range IP so
// these multi-player scenarios never eat into the smoke tests' budget on 127.0.0.1.
let loginCounter = 0;
function uniqueClientIp() {
  loginCounter += 1;
  return `203.0.${process.pid % 250}.${(loginCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;
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

async function createYutRoom(page) {
  await page.locator('#gamePicker [data-game="yut"]').click();
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().endsWith('/api/rooms') && res.request().method() === 'POST'),
    page.locator('#createRoomBtn').click(),
  ]);
  await expect(page.locator('#roomView')).toBeVisible();
  return (await response.json()).state.me.roomCode;
}

async function boardClient(page, [x, y]) {
  const box = await page.locator('#board').boundingBox();
  return [box.x + x * box.width / 720, box.y + y * box.height / 720];
}

async function clickBoard(page, point, options) {
  const [cx, cy] = await boardClient(page, point);
  await page.mouse.click(cx, cy, options);
}

function trackMoves(page) {
  const sent = [];
  page.on('request', req => {
    if (req.url().endsWith('/api/room/move-yut') && req.method() === 'POST') sent.push(req.postDataJSON());
  });
  return sent;
}

test.describe('윷놀이 말 직접 선택', () => {
  test('실제 서버: 애니메이션 뒤 판 위 말 클릭으로 한 번만 이동하고 관전자·애니메이션 중 클릭은 무시한다', async ({ page, browser, request }) => {
    test.setTimeout(90_000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const sent = trackMoves(page);
    const blue = await browserLogin(page);
    const code = await createYutRoom(page);
    const red = await apiLogin(request);
    expect((await api(request, '/api/rooms/join', red, { code })).status).toBe(200);

    const spectatorContext = await browser.newContext();
    const spectatorPage = await spectatorContext.newPage();
    const spectatorSent = trackMoves(spectatorPage);
    await browserLogin(spectatorPage);
    await spectatorPage.locator('#roomPasswordInput').fill(code);
    await spectatorPage.locator('#roomPasswordInput').press('Enter');
    await expect(spectatorPage.locator('#roomView')).toBeVisible();
    await spectatorPage.locator('#chooseSpectatorBtn').click();

    expect((await api(request, '/api/room/choose-role', blue, { choice: 'black' })).status).toBe(200);
    expect((await api(request, '/api/room/choose-role', red, { choice: 'white' })).status).toBe(200);

    let moved = false;
    for (let attempt = 0; attempt < 12 && !moved; attempt += 1) {
      const current = await roomState(request, blue);
      if (current.game.turn === 'white') {
        // 상대 차례: 상대가 던지고 움직이는 동안 내 판 클릭은 아무 요청도 보내지 않는다.
        if (current.game.phase === 'throw') await api(request, '/api/room/throw-yut', red);
        const after = await roomState(request, red);
        if (after.game.turn === 'white' && after.game.phase === 'move') {
          await page.waitForTimeout(1200);
          await clickBoard(page, START);
          for (const move of after.game.legalMoves) {
            const piece = after.game.pieces.white.find(item => item.id === move.pieceId);
            if (piece?.status === 'board' && NODE[piece.position]) await clickBoard(page, NODE[piece.position]);
          }
          expect(sent).toHaveLength(0);
          await api(request, '/api/room/move-yut', red, { pieceId: after.game.legalMoves[0].pieceId });
        }
        continue;
      }
      if (current.game.phase !== 'throw') continue;

      const [thrownResponse] = await Promise.all([
        page.waitForResponse(res => res.url().endsWith('/api/room/throw-yut')),
        page.locator('#yutThrowBtn').click(),
      ]);
      const thrown = (await thrownResponse.json()).state.game;
      if (thrown.turn !== 'black' || thrown.phase !== 'move') continue; // 빽도 자동 패스 등

      // 윷 애니메이션(780ms) 중: 선택지가 아직 없고, 출발점 클릭은 무시된다.
      await clickBoard(page, START);
      await expect(page.locator('#yutMoveChoices .yutPieceChoice')).toHaveCount(0);
      expect(sent).toHaveLength(0);
      await clickBoard(spectatorPage, START);

      await expect(page.locator('#yutMoveChoices .yutPieceChoice').first()).toBeVisible();
      // 첫 이동은 모든 말이 집에 있으므로 출발점 토큰이 유일한 대상 → 가장 낮은 번호의 말.
      const expected = thrown.legalMoves
        .filter(move => thrown.pieces.black.find(item => item.id === move.pieceId)?.status === 'home')
        .map(move => move.pieceId).sort()[0];
      expect(expected).toBe('black-1');
      const [sx, sy] = await boardClient(page, START);
      await page.mouse.move(sx, sy);
      await expect(page.locator('#board')).toHaveCSS('cursor', 'pointer');

      // 더블 클릭 + 곧바로 이어지는 클릭(서버 응답·말 이동 애니메이션 중) → 요청은 정확히 한 번.
      await page.mouse.dblclick(sx, sy);
      await clickBoard(page, START);
      const destination = thrown.legalMoves.find(move => move.pieceId === expected).destination;
      if (NODE[destination.position]) await clickBoard(page, NODE[destination.position]);
      await page.waitForTimeout(900);
      await clickBoard(page, START);
      expect(sent).toEqual([{ pieceId: 'black-1' }]);

      const after = await roomState(request, blue);
      const piece = after.game.pieces.black.find(item => item.id === 'black-1');
      expect(piece.status).toBe('board');
      expect(piece.position).toBe(destination.position);
      moved = true;
    }
    expect(moved).toBe(true);
    expect(spectatorSent).toHaveLength(0);
    expect(errors).toEqual([]);
    await spectatorContext.close();
  });

  test('주입 상태: 업힌 말·빽도·완주 직전·완주를 서버 legalMoves 그대로 선택한다', async ({ page, request }) => {
    test.setTimeout(90_000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const sent = trackMoves(page);
    const blue = await browserLogin(page);

    // The client's room stream is served from `injected` once set (real snapshots before that);
    // every scenario's legalMoves / move result come from the real lib/games/yut.js engine.
    let injected = null;
    await page.route('**/api/room/events', async route => {
      const snapshot = injected || await roomState(request, blue).catch(() => null);
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store' },
        body: snapshot ? `event: roomState\ndata: ${JSON.stringify(snapshot)}\n\n` : ':\n\n',
      });
    });
    let respondWith = null;
    await page.route('**/api/room/move-yut', async route => {
      await new Promise(resolve => setTimeout(resolve, 450)); // 네트워크 지연 흉내
      const next = respondWith ? respondWith(route.request().postDataJSON()) : null;
      if (next) injected = next;
      await route.fulfill({ status: next ? 200 : 409, contentType: 'application/json', body: JSON.stringify(next ? { ok: true, state: next } : { error: 'no scenario' }) });
    });

    const code = await createYutRoom(page);
    const red = await apiLogin(request);
    expect((await api(request, '/api/rooms/join', red, { code })).status).toBe(200);
    expect((await api(request, '/api/room/choose-role', blue, { choice: 'black' })).status).toBe(200);
    expect((await api(request, '/api/room/choose-role', red, { choice: 'white' })).status).toBe(200);
    const base = await roomState(request, blue);
    expect(base.me.seat).toBe('black');

    let throwAt = 1000;
    function scenario({ turn = 'black', steps, black = {}, white = {} }) {
      const game = yut.create();
      yut.start(game);
      for (const [color, placed] of [['black', black], ['white', white]]) {
        for (const [id, position] of Object.entries(placed)) {
          const piece = game.pieces[color].find(item => item.id === `${color}-${id}`);
          if (position === 'finished') Object.assign(piece, { status: 'finished', position: null });
          else Object.assign(piece, { status: 'board', position, route: 'outer' });
        }
      }
      game.turn = turn;
      assert(yut.throwYut(game, turn, new Date(throwAt += 1000).toISOString(), steps === -1 ? 1 : steps === 5 ? 0 : steps, steps === -1).legal);
      return game;
    }
    function assert(value) { expect(value).toBeTruthy(); }
    const snapshotOf = game => ({ ...base, game: { ...base.game, ...yut.publicState(game) } });
    async function show(game) {
      injected = snapshotOf(game);
      const expectedButtons = game.turn === 'black' ? yut.legalMoves(game).length : 0;
      if (expectedButtons) await expect(page.locator('#yutMoveChoices .yutPieceChoice')).toHaveCount(expectedButtons, { timeout: 8000 });
      else await expect(page.locator('#yutMoveChoices .yutPieceChoice')).toHaveCount(0, { timeout: 8000 });
      await page.waitForTimeout(150);
    }
    const acceptMove = game => body => {
      const verdict = yut.applyMove(game, body.pieceId, 'black', new Date(throwAt += 1000).toISOString());
      return verdict.legal ? snapshotOf(game) : null;
    };

    // 1) 업힌 말(1·3번, 3번 칸) + 집 말 2개, 개(2칸): 묶음의 어느 쪽을 눌러도 같은 이동.
    let game = scenario({ steps: 2, black: { 1: 3, 3: 3 } });
    const stackMove = yut.legalMoves(game).find(move => move.carried.length === 2);
    expect(stackMove.carried.sort()).toEqual(['black-1', 'black-3']);
    await show(game);
    respondWith = acceptMove(game);
    await clickBoard(page, [NODE[3][0] + 13, NODE[3][1]]); // 오른쪽 말
    await clickBoard(page, [NODE[3][0] - 13, NODE[3][1]]); // 곧바로 왼쪽 말(요청 대기 중)
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]).toEqual({ pieceId: stackMove.pieceId });
    await page.waitForTimeout(700);
    expect(sent).toHaveLength(1);
    expect(game.pieces.black.filter(item => item.position === 5).map(item => item.id).sort()).toEqual(['black-1', 'black-3']);

    // 2) 빽도: 1번 칸 말 → 완주 직전 칸, 7번 칸 말 → 6번 칸. 집 말(출발점)은 대상이 아니다.
    sent.length = 0;
    game = scenario({ steps: -1, black: { 1: 1, 2: 7 } });
    expect(yut.legalMoves(game).map(move => [move.pieceId, move.destination.position])).toEqual([['black-1', 'finishLine'], ['black-2', 6]]);
    await show(game);
    respondWith = acceptMove(game);
    await clickBoard(page, START);
    await page.waitForTimeout(600);
    expect(sent).toHaveLength(0);
    await clickBoard(page, NODE[1]);
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]).toEqual({ pieceId: 'black-1' });
    await page.waitForTimeout(700);
    expect(game.pieces.black.find(item => item.id === 'black-1').position).toBe('finishLine');

    // 3) 완주 직전 칸의 말이 도(1칸)로 완주: 클릭 → 완주 처리, 이동 애니메이션 중 재클릭 무시.
    sent.length = 0;
    game = scenario({ steps: 1, black: { 1: 'finishLine' } });
    expect(yut.legalMoves(game).find(move => move.pieceId === 'black-1').destination.status).toBe('finished');
    await show(game);
    respondWith = acceptMove(game);
    await clickBoard(page, NODE.finishLine);
    await expect.poll(() => sent.length).toBe(1);
    await clickBoard(page, NODE.finishLine);
    await clickBoard(page, START);
    await page.waitForTimeout(700);
    expect(sent).toEqual([{ pieceId: 'black-1' }]);
    expect(game.pieces.black.find(item => item.id === 'black-1').status).toBe('finished');

    // 4) 상대 차례의 move 단계: 상대 말·출발점을 눌러도 요청이 없다.
    sent.length = 0;
    respondWith = null;
    game = scenario({ turn: 'white', steps: 3, white: { 1: 2 } });
    await show(game);
    await clickBoard(page, NODE[2]);
    await clickBoard(page, START);
    await page.waitForTimeout(600);
    expect(sent).toHaveLength(0);
    expect(errors).toEqual([]);
  });
});
