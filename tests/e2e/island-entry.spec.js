const { test, expect } = require('@playwright/test');
const { post, adminToken, uniqueIp } = require('./skin-support');

// v1.9.10 첫 접속: opening the entry file again starts on Game Island, not in an old room nobody is waiting in (it used
// to drop people straight into an old omok room). A match that was still being played is still resumed. PC only.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

async function enter(browser, html) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueIp() });
  // A key whose tab was just closed stays 「이미 사용 중」 until the server lets the old session go (a moment; longer on a
  // slow CI runner): open the entry file again until it is free, like a person would.
  for (let tries = 0; ; tries += 1) {
    await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(html)]);
    const saved = await page.evaluate(() => sessionStorage.getItem('gameCenterGuestSession'));
    if (saved) return { context, page, token: JSON.parse(saved).token };
    if (tries >= 30) throw new Error('입장 파일이 계속 사용 중');
    await page.waitForTimeout(500);
  }
}
const leaveForGood = async (who) => { await who.page.close({ runBeforeUnload: true }); await who.context.close(); await new Promise((r) => setTimeout(r, 1800)); }; // the tab is closed

test('첫 접속: 아무도 없는 대기방을 두고 나갔다가 입장 파일을 다시 열면 게임 아일랜드에서 시작한다', async ({ browser, request }) => {
  const admin = await adminToken(request);
  const issued = (await post(request, '/api/admin/keys', admin, { label: '첫접속' })).data;
  const first = await enter(browser, issued.html);
  expect((await post(request, '/api/rooms', first.token, { gameType: 'omok' })).status).toBe(201);
  await first.page.reload();
  await expect(first.page.locator('#roomView')).toBeVisible(); // a refresh stays in the room (same tab, same session)
  await leaveForGood(first);
  const again = await enter(browser, issued.html);
  await expect(again.page.locator('#lobbyView')).toBeVisible();
  await expect(again.page.locator('#roomView')).toBeHidden();
  await again.context.close();
});

test('첫 접속: 진행 중이던 대국에서 끊겼다면 입장 파일을 다시 열어도 그 대국으로 돌아간다', async ({ browser, request }) => {
  const admin = await adminToken(request);
  const keys = [];
  for (const label of ['대국흑', '대국백']) keys.push((await post(request, '/api/admin/keys', admin, { label })).data);
  const black = await enter(browser, keys[0].html);
  const white = await enter(browser, keys[1].html);
  const created = await post(request, '/api/rooms', black.token, { gameType: 'omok' });
  expect((await post(request, '/api/rooms/join', white.token, { code: created.data.state.me.roomCode })).status).toBe(200);
  expect((await post(request, '/api/room/choose-role', black.token, { choice: 'black' })).status).toBe(200);
  expect((await post(request, '/api/room/choose-role', white.token, { choice: 'white' })).status).toBe(200);
  await leaveForGood(black);
  const back = await enter(browser, keys[0].html);
  await expect(back.page.locator('#roomView')).toBeVisible();
  for (const who of [back, white]) await who.context.close();
});
