const { test, expect } = require('@playwright/test');

const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';

// v1.7.5 스무고개 질문·답변 기록: 답변 대기 질문 상단 고정, Q+A 한 묶음, 최신순. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

let ipCounter = 0;
const uniqueIp = () => `100.75.${process.pid % 250}.${(++ipCounter + Math.floor(Math.random() * 200)) % 250 + 1}`;

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

test('스무고개 기록: 대기 질문 고정 → Q+A 한 묶음 → 최신순·5개 초과 접기·새로고침 복구·관전자 동일', async ({ browser, request }) => {
  test.setTimeout(120_000);
  const login = await api(request, '/api/admin/login', null, { password: adminPassword });
  const admin = login.data.sessionToken;
  const [a, b, w] = [await guest(browser, request, admin, '출제'), await guest(browser, request, admin, '도전'), await guest(browser, request, admin, '관전')];
  await a.page.locator('[data-game="twentyquestions"]').click();
  const [created] = await Promise.all([
    a.page.waitForResponse(res => res.url().endsWith('/api/rooms') && res.request().method() === 'POST'),
    a.page.locator('#createRoomBtn').click(),
  ]);
  const code = (await created.json()).state.me.roomCode;
  for (const view of [b, w]) {
    await view.page.locator('#roomPasswordInput').fill(code);
    await view.page.locator('#roomPasswordInput').press('Enter');
    await expect(view.page.locator('#twentyPanel')).toBeVisible();
  }
  expect((await api(request, '/api/room/choose-role', a.token, { choice: '1' })).status).toBe(200);
  expect((await api(request, '/api/room/choose-role', b.token, { choice: '2' })).status).toBe(200);
  expect((await api(request, '/api/room/choose-role', w.token, { choice: 'spectator' })).status).toBe(200);
  expect((await api(request, '/api/room/twenty-start', a.token, { mode: 'individual', totalRounds: 1 })).status).toBe(200);
  const start = await roomState(request, a.token);
  const [drawer, challenger] = start.game.drawerSeat === '1' ? [a, b] : [b, a];
  expect((await api(request, '/api/room/twenty-secret', drawer.token, { secret: '사과' })).status).toBe(200);
  await expect.poll(async () => (await roomState(request, challenger.token)).game.phase).toBe('asking');

  const pending = w.page.locator('#twentyPendingCard');
  const pairs = w.page.locator('#twentyQuestionLog .twentyPair');
  await expect(pending).toBeHidden();
  await expect(w.page.locator('#twentyQuestionLog')).toContainText('아직 질문이 없습니다');

  const ask = async text => expect((await api(request, '/api/room/twenty-question', challenger.token, { question: text })).status).toBe(200);
  const answer = async reply => expect((await api(request, '/api/room/twenty-answer', drawer.token, { reply })).status).toBe(200);

  // 1) 답변 대기 질문은 목록과 분리해 위에 고정되고, 답변 버튼은 출제자에게만 보인다.
  await ask('살아있는 건가요?');
  await expect(pending).toBeVisible();
  await expect(pending).toContainText('현재 답변 대기');
  await expect(pending).toContainText('살아있는 건가요?');
  await expect(w.page.locator('#twentyAnswerBox')).toBeHidden();
  await expect(challenger.page.locator('#twentyAnswerBox')).toBeHidden();
  await expect(drawer.page.locator('#twentyAnswerBox')).toBeVisible();
  await expect(drawer.page.locator('#twentyAnswerButtons button')).toHaveText(['예', '아니오', '비슷함', '애매함']);
  await expect(pairs).toHaveCount(0);
  const pendingBox = await pending.boundingBox();
  const logBox = await w.page.locator('#twentyQuestionLog').boundingBox();
  expect(pendingBox.y).toBeLessThan(logBox.y);

  // 2) 출제자가 화면 버튼으로 답하면 Q+A가 한 묶음으로 옮겨 가고 대기 카드는 사라진다.
  await drawer.page.locator('#twentyAnswerButtons [data-twenty-answer="예"]').click();
  await expect(pairs).toHaveCount(1);
  await expect(pending).toBeHidden();
  const only = pairs.first();
  await expect(only.locator('.twentyQ')).toContainText('살아있는 건가요?');
  await expect(only.locator('.twentyQ .twentyTag')).toHaveText('Q');
  await expect(only.locator('.twentyA .twentyTag')).toHaveText('A');
  await expect(only.locator('.twentyA')).toContainText('예');
  // 같은 li 안에 있어야 질문과 답변이 떨어져 보이지 않는다.
  expect(await only.locator('.twentyQ, .twentyA').count()).toBe(2);

  // 3) 모든 답변 종류가 정확히 표시되고 최신이 위에 온다.
  const script = [['음식인가요?', '아니오'], ['빨간가요?', '비슷함'], ['크기가 손바닥만 한가요?', '애매함'], ['나무에서 열리나요?', '예'], ['달콤한가요?', '예'], ['씨가 있나요?', '아니오']];
  for (const [question, reply] of script) { await ask(question); await answer(reply); }
  await expect(pairs).toHaveCount(5);
  const expected = [['씨가 있나요?', '아니오'], ['달콤한가요?', '예'], ['나무에서 열리나요?', '예'], ['크기가 손바닥만 한가요?', '애매함'], ['빨간가요?', '비슷함']];
  for (const [index, [question, reply]] of expected.entries()) {
    await expect(pairs.nth(index).locator('.twentyQ')).toContainText(question);
    await expect(pairs.nth(index).locator('.twentyA .twentyText')).toHaveText(reply);
  }
  await expect(pairs.first().locator('.twentyPairNo')).toHaveText('7번째');
  // 5개를 넘는 과거 기록은 접힌 상태로 아래에 있고, 펼치면 오래된 순서대로 이어진다.
  const older = w.page.locator('#twentyOlderLogBox');
  await expect(older).toBeVisible();
  await expect(w.page.locator('#twentyOlderSummary')).toHaveText('이전 질문 2개 펼치기');
  await expect(older).not.toHaveAttribute('open', '');
  await w.page.locator('#twentyOlderSummary').click();
  const olderPairs = w.page.locator('#twentyOlderLog .twentyPair');
  await expect(olderPairs).toHaveCount(2);
  await expect(olderPairs.nth(0).locator('.twentyQ')).toContainText('음식인가요?');
  await expect(olderPairs.nth(0).locator('.twentyA .twentyText')).toHaveText('아니오');
  await expect(olderPairs.nth(1).locator('.twentyQ')).toContainText('살아있는 건가요?');
  await expect(w.page.locator('#twentyOlderSummary')).toHaveText('이전 질문 2개 접기');

  // 4) 새 답변이 생겨도 페이지 위치를 강제로 옮기지 않고, 기록 영역은 자체 스크롤 없이 흐른다.
  await w.page.evaluate(() => window.scrollTo(0, 120));
  const scrollBefore = await w.page.evaluate(() => window.scrollY);
  await ask('먹을 수 있나요?');
  await expect(pending).toBeVisible();
  await answer('예');
  await expect(pairs.first().locator('.twentyQ')).toContainText('먹을 수 있나요?');
  const scrollAfter = await w.page.evaluate(() => window.scrollY);
  expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThan(400); // 맨 아래로 튀지 않는다
  const overflow = await w.page.locator('#twentyQuestionLog').evaluate(el => getComputedStyle(el).overflowY);
  expect(overflow).toBe('visible');

  // 5) 새로고침 후에도 같은 순서·상태. 접힘 상태는 라운드 기준으로 다시 접힌 채 시작한다.
  await w.page.reload();
  await expect(w.page.locator('#twentyPanel')).toBeVisible();
  await expect(pairs).toHaveCount(5);
  await expect(pairs.first().locator('.twentyQ')).toContainText('먹을 수 있나요?');
  await expect(pairs.first().locator('.twentyPairNo')).toHaveText('8번째');
  await expect(w.page.locator('#twentyOlderSummary')).toContainText('이전 질문 3개');
  for (const view of [a, b, w]) expect(view.errors).toEqual([]);
  for (const view of [a, b, w]) await view.context.close();
});
