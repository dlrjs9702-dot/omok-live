const { test, expect } = require('@playwright/test');
const { shopper, post, get } = require('./skin-support');

// G-게임별 도둑잡기 (gamecenter-notes docs/gamehall-audit-20261025.md 「다른 게임」): while a hand is played the seat cards are off the
// table and each seat's tag is the name plate with the island face (mine on my hand's heading); the other's hand is a fan,
// with 「한 장을 눌러 뽑아요」 over it when I draw; the status line and 「최근 행동」 folded; a draw with a pair heard.
test('도둑잡기 판: 자리 카드 비킴·이름표 얼굴·상대 부채꼴·뽑을 차례 쪽지·최근 행동 접힘·짝 소리', async ({ browser, request, isMobile }) => {
  test.setTimeout(120000);
  const a = await shopper(browser, request, isMobile ? '도둑판m' : '도둑판');
  const b = await shopper(browser, request, isMobile ? '도둑상대m' : '도둑상대');
  if (isMobile) for (const who of [a, b]) await who.page.setViewportSize({ width: 393, height: 851 }); // (shopper's pages are 1280 wide: a phone's size for the phone run)
  const call = (who, route, data) => post(request, route, who.token, data);
  const created = await call(a, '/api/rooms', { gameType: 'oldmaid' });
  expect((await call(b, '/api/rooms/join', { code: created.data.state.me.roomCode })).status).toBe(200);
  expect((await call(a, '/api/room/choose-role', { choice: '1' })).status).toBe(200);
  expect((await call(b, '/api/room/choose-role', { choice: '2' })).status).toBe(200);
  expect((await call(a, '/api/room/start-oldmaid', {})).status).toBe(200);
  for (const who of [a, b]) { await who.page.reload(); await expect(who.page.locator('#oldmaidSeats .oldmaidSeat').first()).toBeVisible({ timeout: 20000 }); }
  for (const who of [a, b]) {
    await expect(who.page.locator('body')).toHaveClass(/roomPlaying/);
    await expect(who.page.locator('#teamPlayers')).toBeHidden();
    await expect(who.page.locator('#oldmaidSeats .oldmaidSeatInfo .seatFace')).toHaveCount(1);
    await expect(who.page.locator('#oldmaidPanel .oldmaidMyHeader h3 .seatFace')).toHaveCount(1);
    await expect(who.page.locator('#oldmaidHistory')).toBeHidden();
    // the fan: each back turned by its place (the outer ones turned, the middle one straight or nearly)
    const turns = await who.page.locator('#oldmaidSeats .oldmaidSeatCards .oldmaidBack').evaluateAll((els) => els.map((el) => getComputedStyle(el).transform));
    expect(turns.length).toBeGreaterThan(2);
    expect(turns[0]).not.toBe(turns[turns.length - 1]);
  }
  const g = (await get(request, '/api/room', a.token)).data.state.game;
  const drawer = g.turn === '1' ? a : b; const other = drawer === a ? b : a;
  await expect(drawer.page.locator('#oldmaidSeats .oldmaidHint')).toHaveText('한 장을 눌러 뽑아요');
  await expect(other.page.locator('#oldmaidSeats .oldmaidHint')).toHaveCount(0);
  // a draw: the history grows; a pair thrown is heard (딩동) on the screens
  await drawer.page.locator('#oldmaidSeats .oldmaidBack.selectable').last().click(); // (the fan's top card: the others are under their neighbour's edge)
  await expect.poll(async () => ((await get(request, '/api/room', a.token)).data.state.game.history || []).length).toBe(1);
  const last = (await get(request, '/api/room', a.token)).data.state.game.history.at(-1);
  if (last.pairs > 0) await expect.poll(() => drawer.page.evaluate(() => window.RoomSound.played().includes('right'))).toBe(true);
  // my hand one row on the table (no wrapping), the phone's line short
  const tops = await a.page.locator('#oldmaidMyHand .oldmaidCard').evaluateAll((els) => [...new Set(els.map((el) => Math.round(el.getBoundingClientRect().top)))]);
  expect(tops.length).toBe(1);
  if (isMobile) await expect(a.page.locator('#statusText')).not.toContainText('님 차례 ·');
  // the last stand (two hands, three cards -- the joker among them): the table pulses, 「조커는 누구에게?」
  expect((await call(a, '/api/test/oldmaid-last-stand', {})).status).toBe(200);
  for (const who of [a, b]) await expect(who.page.locator('#oldmaidPanel')).toHaveClass(/lastStand/);
  if (process.env.ZZ_OUT) for (const [who, n] of [[a, 'me'], [b, 'other']]) { await who.page.waitForTimeout(700); await who.page.screenshot({ path: `${process.env.ZZ_OUT}/oldmaid-laststand-${isMobile ? 'phone' : 'pc'}-${n}.png` }); }
  for (const who of [a, b]) await who.context.close();
});
