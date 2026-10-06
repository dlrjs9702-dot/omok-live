const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.7.15 포인트 이벤트: 로비 진입 시 서버가 준 이벤트로 중앙 모달이 자동으로 뜨고, 닫아도 지급되지 않으며,
// 받기 버튼을 누르면 서버 응답 뒤에만 폭죽·+100,000P가 나오고 잔액·내역이 갱신된다. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

let ipCounter = 0;
const uniqueIp = () => `100.68.${process.pid % 250}.${(++ipCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;
let eventCounter = 0;

// 새 입장 파일·전용 이벤트를 만들고(다른 테스트의 로비에는 보이지 않는다) 로비까지 들어간다.
async function enterLobby({ browser, request }, { onPage, eventFields = {} } = {}) {
  const login = await request.post('/api/admin/login', { headers: { 'X-Forwarded-For': uniqueIp() }, data: { password: adminPassword } });
  const admin = (await login.json()).sessionToken;
  const issued = await (await request.post('/api/admin/keys', { headers: { 'X-Forwarded-For': uniqueIp(), 'X-Session-Token': admin }, data: { label: '이벤트' } })).json();
  const now = Date.now();
  const event = {
    id: `e2e_event_${process.pid}_${Date.now()}_${++eventCounter}`, title: '관리자 연가 기념 이벤트', headline: '오늘은 관리자가 연가입니다!',
    message: '연가 기념으로 모든 이용자에게 100,000P를 드립니다.', rewardPoints: 100_000,
    startAt: new Date(now - 3_600_000).toISOString(), endAt: new Date(now + 3_600_000).toISOString(),
    buttonLabel: '100,000P 받기', note: '오늘 하루 · 계정당 1회', successMessage: '연가 기념 포인트를 받았습니다!', teaser: '님들은 일하심? ㅋㅋ', active: true,
    ...eventFields,
  };
  const registered = await request.post('/api/test/events', {
    headers: { 'X-Forwarded-For': uniqueIp(), 'X-Session-Token': admin }, data: { event, audienceKeyId: issued.key.id },
  });
  expect(registered.status()).toBe(200);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  await onPage?.(page); // 입장 전에 걸어 두는 네트워크 조작(응답 지연 등)
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(issued.html)]);
  return { context, page, event };
}

test('미수령 사용자는 로비 진입 시 이벤트 모달이 자동으로 뜨고, 닫아도 지급되지 않는다', async ({ browser, request }) => {
  const { context, page, event } = await enterLobby({ browser, request });
  const dialog = page.locator('#eventDialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#eventDialogTitle')).toHaveText('🎉 관리자 연가 기념 이벤트 🎉');
  await expect(page.locator('#eventDialogHeadline')).toHaveText('오늘은 관리자가 연가입니다!');
  await expect(page.locator('#eventDialogMessage')).toContainText('모든 이용자에게 100,000P를 드립니다.');
  await expect(page.locator('#eventDialogReward')).toHaveText('+100,000P');
  await expect(page.locator('#eventDialogNote')).toHaveText('오늘 하루 · 계정당 1회');
  await expect(page.locator('#eventDialogClaimBtn')).toHaveText('100,000P 받기');
  await expect(page.locator('#eventDialogTeaser')).toHaveText('님들은 일하심? ㅋㅋ'); // 서버 이벤트 데이터의 강조 문구
  const sizes = await page.evaluate(() => ['eventDialogMessage', 'eventDialogTeaser', 'eventDialogHeadline'].map(id => parseFloat(getComputedStyle(document.getElementById(id)).fontSize)));
  expect(sizes[1]).toBeGreaterThan(sizes[0] * 1.8); // 안내문보다 훨씬 크게
  expect(sizes[1]).toBeGreaterThanOrEqual(sizes[2]); // 제목 줄보다 작지 않게

  await page.locator('#eventDialogCloseBtn').click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#pointBalanceText')).toHaveText('보유 100,000P'); // 닫기 ≠ 수령
  await expect(page.locator('#resultEffect')).toBeHidden();

  // 아직 미수령이므로 다시 들어오면(새로고침) 서버 기준으로 다시 뜬다.
  await page.reload();
  await expect(dialog).toBeVisible();
  expect(event.rewardPoints).toBe(100_000);
  await context.close();
});

test('받기: 연타해도 요청 1회, 서버 성공 뒤 폭죽·+100,000P, 잔액·내역 갱신, 재입장 시 배너는 다시 뜨되 받기는 비활성', async ({ browser, request }) => {
  const { context, page, event } = await enterLobby({ browser, request });
  await expect(page.locator('#eventDialog')).toBeVisible();
  const claims = [];
  page.on('request', req => { if (req.method() === 'POST' && req.url().endsWith(`/api/events/${event.id}/claim`)) claims.push(req.url()); });

  await page.locator('#eventDialogClaimBtn').dblclick(); // 버튼 연타
  const effect = page.locator('#resultEffect');
  await expect(effect).toBeVisible();
  await expect(page.locator('#eventDialog')).toBeHidden();
  await expect(page.locator('#resultTitle')).toHaveText('+100,000P');
  await expect(page.locator('#resultMessage')).toHaveText('연가 기념 포인트를 받았습니다!');
  await expect(page.locator('#resultParticles b')).toHaveCount(6); // 여러 곳의 폭죽
  expect(await page.locator('#resultParticles b span').count()).toBeGreaterThanOrEqual(60);
  await expect(page.locator('#pointBalanceText')).toHaveText('보유 200,000P');
  expect(claims.length).toBe(1);

  await expect(effect).toBeHidden({ timeout: 6000 }); // 약 3초 뒤 사라진다
  await page.evaluate(() => document.getElementById('pointHistoryBtn').click()); // 내 정보 내부 내역 로직 확인
  const first = page.locator('.pointHistoryRow').first();
  await expect(first).toContainText('관리자 연가 기념 이벤트');
  await expect(first).toContainText('+100,000P');
  await expect(first).toContainText('100,000P → 200,000P');

  const eventsChecked = page.waitForResponse(res => new URL(res.url()).pathname === '/api/events');
  await page.reload();
  await eventsChecked;
  await expect(page.locator('#pointBalanceText')).toHaveText('보유 200,000P');
  // v1.7.21: 수령 뒤에도 입장마다 배너는 열리고, 받기 버튼만 비활성이다(재수령 불가).
  await expect(page.locator('#eventDialog')).toBeVisible();
  await expect(page.locator('#eventDialogClaimBtn')).toBeDisabled();
  await expect(page.locator('#eventDialogClaimBtn')).toHaveText('이미 받았습니다');
  await context.close();
});

test('오늘 하루 보지 않음: 오른쪽 아래 버튼 → 문구를 정확히 입력해야만 숨겨지고, 새로고침해도 이 계정에는 다시 안 뜬다', async ({ browser, request }) => {
  const { context, page } = await enterLobby({ browser, request });
  const dialog = page.locator('#eventDialog');
  await expect(dialog).toBeVisible();
  const dismiss = page.locator('#eventDismissBtn');
  await expect(dismiss).toHaveText('오늘 하루 보지 않음');
  const [box, dialogBox] = await Promise.all([dismiss.boundingBox(), dialog.boundingBox()]);
  expect(box.x + box.width).toBeGreaterThan(dialogBox.x + dialogBox.width * 0.75); // 오른쪽
  expect(box.y).toBeGreaterThan(dialogBox.y + dialogBox.height * 0.7); // 맨 아래
  await expect(page.locator('#eventDismissForm')).toBeHidden(); // 누르기 전에는 입력창 없음

  await dismiss.click();
  const input = page.locator('#eventDismissInput');
  await expect(input).toBeFocused();
  await input.fill('오늘 하루 안 봄');
  await page.locator('#eventDismissConfirmBtn').click();
  await expect(page.locator('#eventDismissError')).toContainText('정확히 입력');
  await expect(dialog).toBeVisible(); // 틀리면 그대로

  await input.fill('오늘 하루 보지 않음');
  await input.press('Enter');
  await expect(dialog).toBeHidden();

  const eventsChecked = page.waitForResponse(res => new URL(res.url()).pathname === '/api/events');
  await page.reload();
  await eventsChecked;
  await expect(page.locator('#lobbyView')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(dialog).toBeHidden(); // 이 계정에서는 오늘 다시 안 뜬다
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('eventHide:')).length)).toBe(1);
  await context.close();
});

test('동작 줄이기: 폭죽 없이도 +100,000P와 문구는 보이고 지급은 같다', async ({ browser, request }) => {
  const { context, page } = await enterLobby({ browser, request });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#eventDialogClaimBtn').click();
  await expect(page.locator('#resultTitle')).toBeVisible();
  await expect(page.locator('#resultTitle')).toHaveText('+100,000P');
  await expect(page.locator('#resultMessage')).toBeVisible();
  await expect(page.locator('#resultParticles')).toBeHidden(); // 대량 파티클 생략
  await expect(page.locator('#pointBalanceText')).toHaveText('보유 200,000P');
  await context.close();
});

test('서버 오류면 성공 연출 없이 오류를 알리고 다시 시도할 수 있다', async ({ browser, request }) => {
  const { context, page } = await enterLobby({ browser, request });
  await expect(page.locator('#eventDialog')).toBeVisible();
  await page.route('**/api/events/*/claim', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' }) }));
  await page.locator('#eventDialogClaimBtn').click();
  await expect(page.locator('#eventDialogError')).toHaveText('서버 오류가 발생했습니다.');
  await expect(page.locator('#eventDialog')).toBeVisible();
  await expect(page.locator('#eventDialogClaimBtn')).toBeEnabled();
  await expect(page.locator('#resultEffect')).toBeHidden(); // 폭죽은 실제 성공 응답 뒤에만
  await expect(page.locator('#pointBalanceText')).toHaveText('보유 100,000P');

  await page.unroute('**/api/events/*/claim'); // 복구되면 같은 창에서 정상 수령
  await page.locator('#eventDialogClaimBtn').click();
  await expect(page.locator('#resultTitle')).toHaveText('+100,000P');
  await expect(page.locator('#pointBalanceText')).toHaveText('보유 200,000P');
  await context.close();
});

test('이벤트 응답이 늦게 와도 이미 게임방에 들어갔다면 팝업을 띄우지 않고, 로비로 돌아오면 다시 뜬다', async ({ browser, request }) => {
  const slowEvents = page => page.route('**/api/events', async (route) => {
    if (route.request().method() === 'GET') await new Promise(resolve => setTimeout(resolve, 1800));
    await route.continue();
  });
  const { context, page } = await enterLobby({ browser, request }, { onPage: slowEvents });
  await expect(page.locator('#lobbyView')).toBeVisible();
  await page.locator('#gamePicker [data-game="omok"]').click(); // 이벤트 응답(1.8초 지연)이 오기 전에 방으로 이동
  await page.locator('#createRoomBtn').click();
  await expect(page.locator('#roomView')).toBeVisible();
  await page.waitForTimeout(2600); // 지연된 응답이 도착하고도 남는 시간
  await expect(page.locator('#eventDialog')).toBeHidden(); // 게임방 위에는 뜨지 않는다
  await expect(page.locator('#roomView')).toBeVisible();

  await page.locator('#leaveRoomBtn').click(); // 로비로 돌아오면 아직 미수령이므로 다시 확인한다
  await expect(page.locator('#eventDialog')).toBeVisible({ timeout: 6000 });
  await context.close();
});

// v1.7.31 (IDEAS 백로그 22 남은 두 건)
test('이미 받은 이벤트가 목록 앞에 있어도 미수령 이벤트가 먼저 열린다', async ({ browser, request }) => {
  const { context, page, event: claimed } = await enterLobby({ browser, request });
  await expect(page.locator('#eventDialog')).toBeVisible();
  await page.locator('#eventDialogClaimBtn').click(); // 첫 이벤트는 받는다
  await expect(page.locator('#resultTitle')).toHaveText('+100,000P');
  // 같은 계정에만 보이는 두 번째(미수령) 이벤트를 목록 뒤에 등록한다.
  const token = await page.evaluate(() => document.body.dataset.session);
  const login = await request.post('/api/admin/login', { headers: { 'X-Forwarded-For': uniqueIp() }, data: { password: adminPassword } });
  const admin = (await login.json()).sessionToken;
  const keyId = (await (await request.get('/api/events', { headers: { 'X-Session-Token': token } })).json()).account.replace(/^guest:/, '');
  const now = Date.now();
  const second = { ...claimed, id: `${claimed.id}_2`, title: '두 번째 이벤트', buttonLabel: '두 번째 받기', startAt: new Date(now - 3_600_000).toISOString(), endAt: new Date(now + 3_600_000).toISOString() };
  expect((await request.post('/api/test/events', { headers: { 'X-Forwarded-For': uniqueIp(), 'X-Session-Token': admin }, data: { event: second, audienceKeyId: keyId } })).status()).toBe(200);
  const listed = (await (await request.get('/api/events', { headers: { 'X-Session-Token': token } })).json()).events;
  expect(listed.map(item => [item.id, item.claimed])).toEqual([[claimed.id, true], [second.id, false]]); // 받은 것이 앞
  await page.reload();
  await expect(page.locator('#eventDialog')).toBeVisible();
  await expect(page.locator('#eventDialogClaimBtn')).toHaveText('두 번째 받기'); // 미수령이 먼저
  await context.close();
});

test('방 만들기 응답을 기다리는 사이 열린 이벤트 창은 방에 들어가면 닫히고, 로비로 돌아오면 다시 열린다', async ({ browser, request }) => {
  const slow = async (page) => {
    await page.route('**/api/events', async (route) => { if (route.request().method() === 'GET') await new Promise(r => setTimeout(r, 700)); await route.continue(); });
    await page.route('**/api/rooms', async (route) => { if (route.request().method() === 'POST') await new Promise(r => setTimeout(r, 1800)); await route.continue(); });
  };
  const { context, page } = await enterLobby({ browser, request }, { onPage: slow });
  await expect(page.locator('#lobbyView')).toBeVisible();
  await page.locator('#gamePicker [data-game="omok"]').click();
  await page.locator('#createRoomBtn').click(); // 응답은 1.8초 뒤, 이벤트 응답(0.7초)이 먼저 와서 로비 위에 창이 열린다
  await expect(page.locator('#eventDialog')).toBeVisible({ timeout: 3000 });
  await expect(page.locator('#roomView')).toBeVisible({ timeout: 6000 });
  await expect(page.locator('#eventDialog')).toBeHidden(); // 방에 들어가면 닫힌다
  await page.locator('#leaveRoomBtn').click();
  await expect(page.locator('#eventDialog')).toBeVisible({ timeout: 6000 }); // 받지 않았으니 로비에서 다시
  await context.close();
});

// v1.10.33 안내(보상 없음): 로비 진입 시 같은 창으로 열리고, 포인트·받기 없이 「확인」 하나로 닫히며 잔액은 그대로다
test('안내 이벤트: 접속하면 열리고 포인트 표시 없이 확인으로 닫히며, 지급은 없다', async ({ browser, request }) => {
  const { context, page } = await enterLobby({ browser, request }, { eventFields: {
    notice: true, rewardPoints: 0, title: '섬 제초 요청', headline: '섬에 풀이 너무 많이 자랐습니다!', message: '뽑은 잡초를 관공서로 가져와 주세요.', buttonLabel: '확인', note: '오늘 하루 · 잡초 개당 900P', teaser: undefined } });
  const dialog = page.locator('#eventDialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#eventDialogTitle')).toHaveText('📢 섬 제초 요청');
  await expect(page.locator('#eventDialogReward')).toBeHidden();
  await expect(page.locator('#eventDialogCloseBtn')).toBeHidden();
  await page.locator('#eventDialogClaimBtn').click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#pointBalanceText')).toHaveText('보유 100,000P');
  await expect(page.locator('#resultEffect')).toBeHidden();
  await context.close();
});
