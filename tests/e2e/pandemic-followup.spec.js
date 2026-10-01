const { test, expect } = require('@playwright/test');
const { post, get, shopper, expectNoScriptError } = require('./skin-support');
const { launch } = require('../support/pandemic-server.cjs');

test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

test('팬데믹 4인+관전: 예측·버리기·공중 수송 재접속과 결과·재대결 동기화', async ({ browser, playwright }, testInfo) => {
  test.setTimeout(120000);
  const server = await launch();
  const request = await playwright.request.newContext({ baseURL: server.baseURL });
  const people = [];
  try {
    for (let i = 0; i < 5; i++) people.push(await shopper(browser, request, `pd-followup-${i}`, 10000));
    const [a, b, c, d, watcher] = people;
    const code = (await post(request, '/api/rooms', a.token, { gameType: 'pandemic' })).data.state.me.roomCode;
    for (const w of people.slice(1)) expect((await post(request, '/api/rooms/join', w.token, { code })).status).toBe(200);
    for (let i = 0; i < people.length; i++) expect((await post(request, '/api/room/choose-role', people[i].token, { choice: i < 4 ? String(i + 1) : 'spectator' })).status).toBe(200);
    for (const w of people) { await w.page.reload(); await expect(w.page.locator('#roomView')).toBeVisible(); }
    await a.page.locator('#pandemicStartBtn').click();
    const current = async () => (await get(request, '/api/room', a.token)).data.state;
    const sync = async () => {
      const expected = (await current()).game;
      for (const w of people) {
        await expect.poll(() => w.page.evaluate(() => window.PandemicUI.state?.game)).toEqual(expected);
        await expectNoScriptError(w.page);
      }
    };
    await sync();
    await expect(watcher.page.locator('#pandemicMap .pdPawn')).toHaveCount(4);
    await expect(a.page.locator('#pandemicHud')).toContainText('큐브 공급');
    // Inspect someone else's cards, then reach the hand limit: the owner tab must open.
    await a.page.locator('.pdDockHead').click();
    await a.page.locator('.pdDockTab').nth(1).click();
    await a.page.getByRole('button', { name: '차례 넘기기', exact: true }).click();
    await expect(a.page.locator('.pdDockTab.on')).toContainText('과학자');
    await expect(a.page.locator('#pandemicHud')).toContainText('카드 획득');
    await a.page.reload();
    await expect(a.page.locator('.pdWarn')).toHaveText('버릴 카드를 누르세요.');
    await a.page.locator('#pandemicActions').getByRole('button', { name: '⚡ 예측', exact: true }).click();
    await expect(a.page.locator('.pdForecastRow')).toHaveCount(6);
    await a.context.setOffline(true); await a.context.setOffline(false); await a.page.reload();
    await expect(a.page.locator('#pandemicMenu')).toBeVisible();
    await expect(a.page.locator('.pdForecastRow')).toHaveCount(6);
    await expect(watcher.page.locator('.pdForecastRow')).toHaveCount(0);
    await a.page.screenshot({ path: testInfo.outputPath('pandemic-forecast.png') });
    await expect(c.page.getByRole('button', { name: '⚡ 조용한 하룻밤', exact: true })).toHaveCount(0);
    await a.page.getByRole('button', { name: '이 순서로 되돌리기' }).click();
    await expect(a.page.locator('.pdWarn')).toBeVisible();
    // Six stations: select the destination, then one of the existing stations to relocate.
    await a.page.locator('#pandemicActions').getByRole('button', { name: '⚡ 정부 보조금', exact: true }).click();
    await a.page.locator('.pdCity.target[data-city="sydney"]').dispatchEvent('click');
    await expect(a.page.locator('.pdCity.target')).toHaveCount(6);
    await a.page.locator('.pdCity.target[data-city="essen"]').dispatchEvent('click');
    await expect.poll(async () => (await current()).game.stations).toEqual(['atlanta', 'chicago', 'paris', 'london', 'madrid', 'sydney']);
    // Airlift waits for another player; their refresh restores the consent buttons.
    await a.page.locator('#pandemicActions').getByRole('button', { name: '⚡ 공중 수송', exact: true }).click();
    await a.page.locator('#pandemicMenu .pdMenuRow button').nth(1).click();
    await a.page.locator('.pdCity.target[data-city="tokyo"]').dispatchEvent('click');
    await expect(b.page.getByRole('button', { name: '동의', exact: true })).toBeVisible();
    await b.page.reload();
    await expect(b.page.locator('.teamPlayer.currentActor')).toHaveAttribute('data-seat', '2');
    await b.page.getByRole('button', { name: '동의', exact: true }).click();
    await expect.poll(async () => (await current()).game.pawns['2']).toBe('tokyo');
    await sync();
    await expect(a.page.getByRole('button', { name: '계속 (도시 감염 단계)', exact: true })).toBeVisible();
    // Quitting a cooperative game must show the same loss for all four players.
    expect((await post(request, '/api/room/resign', b.token, {})).status).toBe(200);
    await sync();
    for (const w of people) await expect(w.page.locator('#pandemicHud')).toContainText('함께 패배');
    await a.page.reload(); await expect(a.page.locator('#pandemicHud')).toContainText('함께 패배');
    expect((await post(request, '/api/room/rematch', a.token, {})).status).toBe(200);
    for (const w of people) { await expect(w.page.locator('#pandemicSetup')).toBeVisible(); await expect(w.page.locator('#pandemicMenu')).toBeHidden(); }
  } finally {
    for (const w of people) await w.context.close();
    await request.dispose(); await server.close();
  }
});
