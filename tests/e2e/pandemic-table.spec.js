const { test, expect } = require('@playwright/test');
const { shopper, post, expectNoScriptError } = require('./skin-support');

// v1.10.199 팬데믹 공통 틀 (gamecenter-notes docs/gamehall-audit-20261025.md, 총괄 검토): while a game is played the seat cards are
// off the table; one row of plates over the map (face, name, role, cards in hand, the turn lit); 확산·감염률·치료제 always on
// the strip, the piles·discards·cubes folded behind 「더미 · 큐브」 and opened by a tap. Three people. PC and phone.
test('팬데믹 판: 자리 카드 비킴·지도 위 얼굴 이름표·상태 띠(늘 보임 / 접힘)', async ({ browser, request, isMobile }) => {
  test.setTimeout(180000);
  const people = [];
  for (const [k, label] of ['가', '나', '다'].entries()) { const p = await shopper(browser, request, `${isMobile ? '팬판m' : '팬판'}${label}`); p.seat = String(k + 1); people.push(p); }
  if (isMobile) for (const p of people) await p.page.setViewportSize({ width: 393, height: 851 });
  const call = (who, route, data) => post(request, route, who.token, data);
  const created = await call(people[0], '/api/rooms', { gameType: 'pandemic' }); const code = created.data.state.me.roomCode;
  for (const p of people.slice(1)) expect((await call(p, '/api/rooms/join', { code })).status).toBe(200);
  for (const p of people) expect((await call(p, '/api/room/choose-role', { choice: p.seat })).status).toBe(200);
  const a = people[0]; await a.page.reload(); await expect(a.page.locator('#pandemicStartBtn')).toBeVisible({ timeout: 20000 });
  if (isMobile) { // (a phone: 난이도 · 팬데믹 시작 at the thumb, within the screen)
    const box = await a.page.locator('#pandemicStartBtn').boundingBox(); expect(box.y + box.height).toBeLessThanOrEqual(a.page.viewportSize().height + 1);
    if (process.env.SHOT_DIR) await a.page.screenshot({ path: `${process.env.SHOT_DIR}/room-before-start-phone.png` }); /* (v1.10.246: the top bar in one row before a hand) */
  }
  await a.page.locator('#pandemicStartBtn').click();
  await expect(a.page.locator('#pandemicMap .pdCity').first()).toBeVisible({ timeout: 15000 });
  await expect(a.page.locator('#teamPlayers')).toBeHidden();
  await expect(a.page.locator('#pandemicSeats .pdSeat')).toHaveCount(3);
  await expect(a.page.locator('#pandemicSeats .pdSeat .seatFace')).toHaveCount(3);
  await expect(a.page.locator('#pandemicSeats .pdSeat.turn')).toHaveCount(1);
  await expect(a.page.locator('#pandemicSeats .pdSeat').first()).toContainText(/\d장/);
  // 게임관 1차 (notes docs/gamehall-screen-audit-20261110.md 6.4): P1 my role told as the hand starts, a plate tapped says what
  // a role does; P5 the title; P3 what to do now; P7 the cure dots and the map's legend; P8 a button not usable says why
  await expect(a.page.locator('#pandemicMapWrap .pdRoleCard')).toContainText('당신은');
  if (process.env.SHOT_DIR) await a.page.screenshot({ path: `${process.env.SHOT_DIR}/pandemic-role-${isMobile ? 'phone' : 'pc'}.png` });
  await a.page.locator('#pandemicSeats .pdSeat').first().click(); await expect(a.page.locator('#pandemicMenu')).toBeVisible(); await a.page.locator('#pandemicMenu button', { hasText: '닫기' }).click();
  await expect(a.page.locator('#roomHudLabel')).toContainText('함께하기 3명');
  await expect(a.page.locator('#pandemicHud .pdCure')).toHaveCount(4); for (const c of await a.page.locator('#pandemicHud .pdCure').all()) await expect(c).toHaveText('');
  await a.page.locator('#pandemicHud button.pdChip', { hasText: '?' }).click(); await expect(a.page.locator('#pandemicMenu')).toContainText('지도 보는 법'); await a.page.locator('#pandemicMenu button', { hasText: '닫기' }).click();
  const turn = await a.page.evaluate(() => window.PandemicUI.state.game.turn); const t = people.find((p) => p.seat === String(turn));
  if (t !== a) { await expect(a.page.locator('#pandemicNow')).toContainText(`${t.label || ''}`); await expect(a.page.locator('#pandemicNow')).toContainText('행동하는 중'); await t.page.reload(); await expect(t.page.locator('#pandemicMap .pdCity').first()).toBeVisible({ timeout: 20000 }); if (isMobile) await t.page.setViewportSize({ width: 393, height: 851 }); }
  await expect(t.page.locator('#pandemicNow')).toContainText('행동 4번 남음 — 이동하거나 치료하세요');
  const cure = t.page.locator('#pandemicActions .pdBtn', { hasText: '치료제 개발' }); await expect(cure).toHaveClass(/why/); await cure.click({ force: true }); /* (aria-disabled: Playwright waits for enabled -- a person's tap goes through) */
  await expect(t.page.locator('#pandemicMenu')).toContainText(/연구소가 있는 도시에서만|같은 색 카드 [45]장이 필요해요 \(지금 \d장\)/);
  if (process.env.SHOT_DIR) await t.page.screenshot({ path: `${process.env.SHOT_DIR}/pandemic-now-why-${isMobile ? 'phone' : 'pc'}.png` });
  if (isMobile) { // (검토: the map at least half the screen, the plates one row, the small map a quarter of it, the cards under it)
    const box = async (sel) => a.page.locator(sel).boundingBox();
    const map = await box('#pandemicMap'); const mini = await box('#pandemicMini'); const dock = await box('#pandemicCardDock');
    expect(map.height).toBeGreaterThanOrEqual(a.page.viewportSize().height * 0.5);
    expect(mini.width).toBeLessThanOrEqual(map.width * 0.3);
    expect(dock.y).toBeGreaterThanOrEqual(map.y + map.height - 1);
    const tops = await a.page.locator('#pandemicSeats .pdSeat').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
  }
  // always: 확산·감염률·치료제; folded: the piles -- opened by a tap
  for (const word of ['확산', '감염률', '치료제']) await expect(a.page.locator('#pandemicHud > .pdTrack', { hasText: word })).toBeVisible();
  const more = a.page.locator('#pandemicHud .pdMore');
  await expect(more.locator('.pdChip', { hasText: '큐브 공급' })).toBeHidden();
  await more.locator('summary').click();
  await expect(more.locator('.pdChip', { hasText: '큐브 공급' })).toBeVisible();
  await expect(more.locator('button.pdChip', { hasText: '감염 버림' })).toBeVisible();
  await expectNoScriptError(a.page);
  for (const p of people) await p.context.close();
});
