const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.7.7 그림 맞히기 v2: 방장 설정 → 출제자 도구·제시어 → 카테고리·추측 기록 → 라운드 결과. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

let ipCounter = 0;
const uniqueIp = () => `100.77.${process.pid % 250}.${(++ipCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;

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

test('그림 맞히기 v2: 방장 설정·출제자 도구·카테고리·추측 기록·라운드 결과가 화면에 보인다', async ({ browser, request }) => {
  test.setTimeout(120_000);
  const login = await api(request, '/api/admin/login', null, { password: adminPassword });
  const admin = login.data.sessionToken;
  const [a, b, w] = [await guest(browser, request, admin, '그림방장'), await guest(browser, request, admin, '맞히기'), await guest(browser, request, admin, '구경')];
  await a.page.locator('[data-game="pictionary"]').click();
  const [created] = await Promise.all([
    a.page.waitForResponse(res => res.url().endsWith('/api/rooms') && res.request().method() === 'POST'),
    a.page.locator('#createRoomBtn').click(),
  ]);
  const code = (await created.json()).state.me.roomCode;
  for (const view of [b, w]) {
    await view.page.locator('#roomPasswordInput').fill(code);
    await view.page.locator('#roomPasswordInput').press('Enter');
    await expect(view.page.locator('#pictionaryPanel')).toBeVisible();
  }
  expect((await api(request, '/api/room/choose-role', a.token, { choice: '1' })).status).toBe(200);
  expect((await api(request, '/api/room/choose-role', b.token, { choice: '2' })).status).toBe(200);
  expect((await api(request, '/api/room/choose-role', w.token, { choice: 'spectator' })).status).toBe(200);

  // 1) 방장만 설정을 바꿀 수 있고, 모두가 같은 설정을 본다.
  await a.page.locator('#pictionaryConfig').getByLabel('120초').check();
  await a.page.locator('#pictionaryConfig').getByLabel('쉬움').check();
  await expect(w.page.locator('#pictionaryDrawerLabel')).toContainText('개인전 · 쉬움 · 120초');
  await expect(w.page.locator('#pictionaryConfig').getByLabel('120초')).toBeChecked();
  await expect(w.page.locator('#pictionaryConfig').getByLabel('120초')).toBeDisabled();

  // 2) 입장 순서대로 방장이 첫 출제자: 제시어·도구(되돌리기 포함)는 출제자에게만.
  await a.page.locator('#pictionaryStartBtn').click();
  await expect(a.page.locator('#pictionaryWordBox')).toBeVisible();
  await expect(a.page.locator('#pictionaryUndoBtn')).toBeVisible();
  await expect(a.page.locator('.pictionaryRuleNote')).toBeVisible();
  const word = (await a.page.locator('#pictionaryWord').textContent()).trim();
  for (const view of [b, w]) {
    await expect(view.page.locator('#pictionaryDrawerLabel')).toContainText('그림방장 님이 그리는 중');
    await expect(view.page.locator('#pictionaryWordBox')).toBeHidden();
    await expect(view.page.locator('#pictionaryDrawTools')).toBeHidden();
    await expect(view.page.locator('#pictionaryHints')).toContainText('카테고리');
  }
  await expect(w.page.locator('#pictionaryGuessForm')).toBeHidden();

  // 3) 그린 획을 되돌리면 모두의 그림판에서 빠진다.
  expect((await api(request, '/api/room/pictionary-stroke', a.token, { stroke: { points: [[0.2, 0.2], [0.8, 0.8]], color: '#1f2937', width: 6, tool: 'pen' } })).status).toBe(200);
  await expect.poll(async () => (await roomState(request, w.token)).game.strokes.length).toBe(1);
  await a.page.locator('#pictionaryUndoBtn').click();
  await expect.poll(async () => (await roomState(request, w.token)).game.strokes.length).toBe(0);

  // 4) 틀린 추측은 짧은 기록으로 모두에게 보이고, 정답 단어는 결과 전까지 드러나지 않는다.
  await b.page.locator('#pictionaryGuessInput').fill('전혀다른말');
  await b.page.locator('#pictionaryGuessForm button[type="submit"]').click();
  await expect(w.page.locator('#pictionaryGuessLog')).toContainText('맞히기: 전혀다른말');
  await expect(w.page.locator('#pictionaryPanel')).not.toContainText(word);
  await expect(b.page.locator('#pictionaryGuessInput')).toHaveValue('');

  // 5) 정답을 맞히면 라운드 결과에 정답·획득 점수·출제자 점수가 한눈에 나온다.
  await b.page.locator('#pictionaryGuessInput').fill(word);
  await b.page.locator('#pictionaryGuessForm button[type="submit"]').click();
  const result = w.page.locator('#pictionaryRoundResult');
  await expect(result).toBeVisible();
  await expect(result).toContainText(`정답 「${word}」`);
  await expect(result).toContainText('맞히기 +');
  await expect(result).toContainText('(첫 정답)');
  await expect(result).toContainText('출제자 그림방장 +');
  await expect(w.page.locator('#pictionaryTimer')).toContainText('다음 라운드');

  for (const view of [a, b, w]) expect(view.errors).toEqual([]);
  await Promise.all([a, b, w].map(view => view.context.close()));
});
