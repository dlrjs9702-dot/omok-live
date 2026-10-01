const { test, expect } = require('@playwright/test');
const { post, get, shopper, expectNoScriptError } = require('./skin-support');

// v1.8.0 팬데믹: 3명이 시작하면 지도·손패 창이 뜨고, 내 차례 도시를 눌러 이동할 수 있고, 모두에게 같은 상태가 보인다. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

test('팬데믹: 시작 → 지도 표시 → 이동 → 다른 사람 화면 동기화', async ({ browser, request }) => {
  const people = [await shopper(browser, request, 'pd-a'), await shopper(browser, request, 'pd-b'), await shopper(browser, request, 'pd-c')];
  const [a, b, c] = people;
  const created = await post(request, '/api/rooms', a.token, { gameType: 'pandemic' });
  expect(created.status).toBe(201);
  const code = created.data.state.me.roomCode;
  for (const w of [b, c]) expect((await post(request, '/api/rooms/join', w.token, { code })).status).toBe(200);
  for (const [w, s] of [[a, '1'], [b, '2'], [c, '3']]) expect((await post(request, '/api/room/choose-role', w.token, { choice: s })).status).toBe(200);
  for (const w of people) { await w.page.reload(); await expect(w.page.locator('#roomView')).toBeVisible({ timeout: 20000 }); }

  await a.page.click('#pandemicStartBtn');
  for (const w of people) {
    await expect(w.page.locator('#pandemicMap .pdCity').first()).toBeVisible({ timeout: 10000 });
    await expectNoScriptError(w.page);
  }
  await expect(a.page.locator('#pandemicMap .pdCity')).toHaveCount(48);
  await expect(a.page.locator('#pandemicSetup')).toBeHidden();

  const seat = (await get(request, '/api/room', a.token)).data.state.game.turn;
  const mover = { 1: a, 2: b, 3: c }[seat];
  await mover.page.getByRole('button', { name: '이동', exact: true }).click();
  const targets = mover.page.locator('#pandemicMap .pdCity.target');
  expect(await targets.count()).toBeGreaterThan(0);
  const to = await targets.first().getAttribute('data-city');
  await targets.first().dispatchEvent('click');
  await expect.poll(async () => (await get(request, '/api/room', a.token)).data.state.game.pawns[seat]).toBe(to);
  const after = (await get(request, '/api/room', a.token)).data.state.game;
  expect(after.pawns[seat]).toBe(to);
  expect(after.actionsLeft).toBe(3);
  for (const w of people) await expectNoScriptError(w.page);
});
