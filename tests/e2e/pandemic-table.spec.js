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
  }
  await a.page.locator('#pandemicStartBtn').click();
  await expect(a.page.locator('#pandemicMap .pdCity').first()).toBeVisible({ timeout: 15000 });
  await expect(a.page.locator('#teamPlayers')).toBeHidden();
  await expect(a.page.locator('#pandemicSeats .pdSeat')).toHaveCount(3);
  await expect(a.page.locator('#pandemicSeats .pdSeat .seatFace')).toHaveCount(3);
  await expect(a.page.locator('#pandemicSeats .pdSeat.turn')).toHaveCount(1);
  await expect(a.page.locator('#pandemicSeats .pdSeat').first()).toContainText(/\d장/);
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
