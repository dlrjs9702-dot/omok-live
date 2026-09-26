const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';
const PREFIX = '● 내 차례! | ';

// v1.6.85 백그라운드 내 차례 알림. 탭 가시성(Page Visibility)과 Notification API는 브라우저 안에서
// 대체해 제어하고, 게임 상태는 실제 서버로 진행한다. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

let loginCounter = 0;
function uniqueClientIp() {
  loginCounter += 1;
  return `198.18.${process.pid % 250}.${(loginCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;
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

// Visibility is driven by the test (persisted across reloads via sessionStorage); Notification is a
// recording fake whose permission starts at 'default'.
async function installBrowserFakes(context) {
  await context.addInitScript(() => {
    let hidden = sessionStorage.getItem('__hidden') === '1';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    document.hasFocus = () => !hidden;
    window.__setHidden = value => {
      hidden = value;
      sessionStorage.setItem('__hidden', value ? '1' : '0');
      document.dispatchEvent(new Event('visibilitychange'));
    };
    window.__notes = [];
    window.__permissionRequests = 0;
    class FakeNotification {
      constructor(title, options = {}) {
        this.title = title;
        this.body = options.body;
        this.closed = false;
        window.__notes.push(this);
      }
      close() { this.closed = true; }
      static requestPermission() {
        window.__permissionRequests += 1;
        FakeNotification.permission = 'granted';
        return Promise.resolve('granted');
      }
    }
    FakeNotification.permission = sessionStorage.getItem('__granted') === '1' ? 'granted' : 'default';
    window.Notification = FakeNotification;
  });
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

const notes = page => page.evaluate(() => window.__notes.map(note => ({ title: note.title, body: note.body, closed: note.closed })));
const setHidden = (page, value) => page.evaluate(v => window.__setHidden(v), value);
const settle = page => page.waitForTimeout(700);

test.describe('백그라운드 내 차례 알림', () => {
  test('오델로: 상대 차례·중복·복귀·다음 차례·관전자·일시정지·종료', async ({ page, browser, request }) => {
    test.setTimeout(90_000);
    await installBrowserFakes(page.context());
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const white = await browserLogin(page);
    const code = await createRoom(page, 'othello');
    expect(await page.title()).toBe('오델로 · 게임센터');
    const black = await apiLogin(request);
    expect((await api(request, '/api/rooms/join', black, { code })).status).toBe(200);

    // 권한 팝업은 진입 시 자동으로 뜨지 않고, 버튼을 눌렀을 때만 요청된다.
    expect(await page.evaluate(() => window.__permissionRequests)).toBe(0);
    await expect(page.locator('#turnNotifyBtn')).toHaveText('내 차례 알림 · 꺼짐');
    await page.locator('#turnNotifyBtn').click();
    await expect(page.locator('#turnNotifyBtn')).toHaveText('내 차례 알림 · 켜짐');
    expect(await page.evaluate(() => window.__permissionRequests)).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem('turnNotifyPref'))).toBe('1');

    // 관전자(백그라운드)도 같은 방을 본다.
    const spectatorContext = await browser.newContext();
    await installBrowserFakes(spectatorContext);
    const spectator = await spectatorContext.newPage();
    await browserLogin(spectator);
    await spectator.locator('#roomPasswordInput').fill(code);
    await spectator.locator('#roomPasswordInput').press('Enter');
    await expect(spectator.locator('#roomView')).toBeVisible();
    await spectator.locator('#chooseSpectatorBtn').click();
    await setHidden(spectator, true);

    expect((await api(request, '/api/room/choose-role', white, { choice: 'white' })).status).toBe(200);
    await setHidden(page, true);
    const started = await api(request, '/api/room/choose-role', black, { choice: 'black' });
    expect(started.data.state.game.turn).toBe('black');

    // 1) 상대 차례: 알림 없음.
    await settle(page);
    expect(await page.title()).toBe('오델로 · 게임센터');
    expect(await notes(page)).toHaveLength(0);

    // 2) 숨김 상태에서 내 차례 시작 → 제목 변경 + 시스템 알림 1회(비공개 정보 없는 짧은 문구).
    let move = started.data.state.game.legalMoves[0];
    expect((await api(request, '/api/room/move', black, { x: move.x, y: move.y })).status).toBe(200);
    await expect(page).toHaveTitle(`${PREFIX}오델로 · 게임센터`);
    expect(await notes(page)).toEqual([{ title: '게임센터 · 내 차례', body: '오델로에서 착수할 차례입니다.', closed: false }]);

    // 4) 같은 차례 상태의 재수신(채팅 등): 중복 알림 없음.
    expect((await api(request, '/api/room/chat', black, { text: '안녕하세요' })).status).toBe(200);
    await settle(page);
    expect(await notes(page)).toHaveLength(1);
    await expect(page).toHaveTitle(`${PREFIX}오델로 · 게임센터`);

    // 3) 탭 복귀 → 원래 제목, 알림 닫힘. 다시 숨겨도 같은 차례로는 재알림하지 않는다.
    await setHidden(page, false);
    await expect(page).toHaveTitle('오델로 · 게임센터');
    expect((await notes(page))[0].closed).toBe(true);
    await setHidden(page, true);
    expect((await api(request, '/api/room/chat', black, { text: '다시' })).status).toBe(200);
    await settle(page);
    expect(await page.title()).toBe('오델로 · 게임센터');
    expect(await notes(page)).toHaveLength(1);

    // 5) 내가 두고 상대가 두면 다음 실제 차례 → 새 알림.
    let current = await roomState(request, white);
    move = current.game.legalMoves[0];
    expect((await api(request, '/api/room/move', white, { x: move.x, y: move.y })).status).toBe(200);
    current = await roomState(request, black);
    move = current.game.legalMoves[0];
    expect((await api(request, '/api/room/move', black, { x: move.x, y: move.y })).status).toBe(200);
    await expect(page).toHaveTitle(`${PREFIX}오델로 · 게임센터`);
    expect(await notes(page)).toHaveLength(2);

    // 7) 일시정지(상대 이탈): 알림 상태 해제, 일시정지 중에는 새 알림 없음.
    expect((await api(request, '/api/room/leave', black, {})).status).toBe(200);
    await expect(page).toHaveTitle('오델로 · 게임센터', { timeout: 15_000 });
    expect((await notes(page))[1].closed).toBe(true);
    expect(await notes(page)).toHaveLength(2);
    expect((await api(request, '/api/rooms/join', black, { code })).status).toBe(200);
    await settle(page);
    expect(await notes(page)).toHaveLength(2);

    // 8) 종료(기권): 알림 상태가 남지 않는다.
    expect((await api(request, '/api/room/resign', white, {})).status).toBe(200);
    await settle(page);
    expect(await page.title()).toBe('오델로 · 게임센터');

    // 6) 관전자: 어떤 차례에도 제목·시스템 알림 없음.
    expect(await spectator.title()).toBe('오델로 · 게임센터');
    expect(await notes(spectator)).toHaveLength(0);
    expect(await spectator.evaluate(() => window.__permissionRequests)).toBe(0);
    expect(errors).toEqual([]);
    await spectatorContext.close();
  });

  test('재접속: 숨김 상태로 다시 들어온 첫 상태는 새 차례로 오인하지 않는다', async ({ page, request }) => {
    test.setTimeout(60_000);
    await installBrowserFakes(page.context());
    const black = await browserLogin(page);
    const code = await createRoom(page, 'othello');
    const white = await apiLogin(request);
    expect((await api(request, '/api/rooms/join', white, { code })).status).toBe(200);
    expect((await api(request, '/api/room/choose-role', black, { choice: 'black' })).status).toBe(200);
    expect((await api(request, '/api/room/choose-role', white, { choice: 'white' })).status).toBe(200);
    await page.evaluate(() => { localStorage.setItem('turnNotifyPref', '1'); sessionStorage.setItem('__granted', '1'); });

    // 이미 내 차례인 방에 숨김 상태로 재접속(서버가 세션을 문서에 넣어 주는 경로와 동일).
    await page.evaluate(() => sessionStorage.setItem('__hidden', '1'));
    await page.route('**/', async route => {
      if (route.request().resourceType() !== 'document') return route.continue();
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace('data-session=""', `data-session="${black}"`) });
    });
    await page.reload();
    await expect(page.locator('#roomView')).toBeVisible();
    await expect(page.locator('#blackPlayer')).toHaveClass(/currentActor/);
    await settle(page);
    expect(await page.evaluate(() => document.visibilityState)).toBe('hidden');
    expect(await page.title()).toBe('오델로 · 게임센터');
    expect(await notes(page)).toHaveLength(0);
    expect(await page.evaluate(() => window.__permissionRequests)).toBe(0);
  });

  test('스무고개: 단계별 알림 문구에 비밀 정답이 들어가지 않는다', async ({ page, request }) => {
    test.setTimeout(60_000);
    await installBrowserFakes(page.context());
    const host = await browserLogin(page);
    const code = await createRoom(page, 'twentyquestions');
    const second = await apiLogin(request);
    expect((await api(request, '/api/rooms/join', second, { code })).status).toBe(200);
    expect((await api(request, '/api/room/choose-role', host, { choice: '1' })).status).toBe(200);
    expect((await api(request, '/api/room/choose-role', second, { choice: '2' })).status).toBe(200);
    await page.locator('#turnNotifyBtn').click();
    await expect(page.locator('#turnNotifyBtn')).toHaveText('내 차례 알림 · 켜짐');
    expect((await api(request, '/api/room/twenty-start', host, { mode: 'individual', totalRounds: 1 })).status).toBe(200);

    const tokenOf = { 1: host, 2: second };
    const drawer = (await roomState(request, host)).game.drawerSeat;
    const challenger = drawer === '1' ? '2' : '1';
    const secret = '비밀사과';
    // Hide only once the started round is on screen, so its first step was seen while visible.
    await expect(page.locator(`.teamPlayer[data-seat="${drawer}"]`)).toHaveClass(/currentActor/);
    await setHidden(page, true);
    expect((await api(request, '/api/room/twenty-secret', tokenOf[drawer], { secret })).status).toBe(200);
    if (drawer === '1') {
      // 나는 출제자: 도전자가 질문하면 「답변할 차례」.
      expect((await api(request, '/api/room/twenty-question', tokenOf[challenger], { question: '과일인가요?' })).status).toBe(200);
      await expect(page).toHaveTitle(new RegExp(`^${PREFIX.replace(/[|]/g, '\\|')}`));
      await expect.poll(async () => (await notes(page)).map(note => note.body)).toEqual(['스무고개에서 답변할 차례입니다.']);
    } else {
      // 나는 도전자: 출제자가 정답을 정하면 「질문할 차례」.
      await expect(page).toHaveTitle(new RegExp(`^${PREFIX.replace(/[|]/g, '\\|')}`));
      await expect.poll(async () => (await notes(page)).map(note => note.body)).toEqual(['스무고개에서 질문할 차례입니다.']);
    }
    const all = JSON.stringify(await notes(page));
    expect(all).not.toContain(secret);
  });
});
