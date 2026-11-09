const { test, expect } = require('@playwright/test');
const { shopper, post, get, expectNoScriptError, spaceOn, adminToken } = require('./skin-support');
test.skip(({ isMobile }) => isMobile, 'PC 실행이 같은 확인을 함 (v1.10.269 시험 정리: docs/test-audit-20261107.md)');

// R4 구치소 반성문: one owing the tax comes onto the island in the cell, the warden's talk open; [시작] -- his sentence over
// his head -- typed into the island chat three times, the cell opens; walked out, the day's essays on the board. PC and phone.
test('구치소: 체납자는 철창 안에서 시작, 반성문 3문장을 채팅으로 쓰면 철창이 열리고 게시판에 남음', async ({ browser, request, isMobile }) => {
  test.setTimeout(240000);
  const who = await shopper(browser, request, isMobile ? '반성문m' : '반성문', 0, 'male'); const { page } = who;
  expect((await post(request, '/api/test/jail', who.token, { veteran: true, debt: 20000 })).status).toBe(200);
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().space), { timeout: 30000 }).toBe('jail');
  const inCell = () => page.evaluate(() => { const d = window.PlazaDebug(); return window.IslandJail.inCell(d.x, d.z); });
  expect(await inCell()).toBe(true);
  await expect(page.locator('#wardenCard')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#plazaDialog')).toContainText('세금은 나가서 관공서 세금 창구에서'); await expect(page.locator('#wardenCard button', { hasText: '세금' })).toHaveCount(0); /* (293: no paying from the cell) */
  await page.locator('#wardenCard button', { hasText: '시작' }).click();
  // each sentence: over the warden's head, typed into the island chat
  for (let k = 0; k < 3; k += 1) {
    const essay = (await get(request, '/api/island/jail', who.token)).data.essay;
    expect(essay.i).toBe(k);
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().jail().line), { timeout: 10000 }).toContain(essay.sentence);
    await page.evaluate((text) => { const input = document.getElementById('islandChatInput'); input.value = text; input.form.requestSubmit(); }, essay.sentence);
    if (k < 2) await expect.poll(async () => (await get(request, '/api/island/jail', who.token)).data.essay?.i, { timeout: 10000 }).toBe(k + 1);
  }
  await expect(page.locator('#toast')).toContainText('반성문 통과', { timeout: 10000 });
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().jail()), { timeout: 10000 }).toMatchObject({ inmate: 'free', door: 1.75 }); // (swung out, toward the room)
  if (process.env.ZZ_SHOT) await page.screenshot({ path: `${process.env.ZZ_SHOT}-${isMobile ? 'phone' : 'pc'}.png` });
  // the board: today's essays (mine among them)
  await expect.poll(async () => {
    if (await page.locator('#jailBoardCard').isVisible()) return true;
    await page.evaluate(() => { const d = window.PlazaDebug(); const b = d.doors['jail:board']; d.teleport(b.x, b.z); });
    await page.waitForTimeout(400); await spaceOn(page, 'jail:board', isMobile); await page.waitForTimeout(400);
    return page.locator('#jailBoardCard').isVisible();
  }, { timeout: 30000, intervals: [300] }).toBe(true);
  await expect(page.locator('#jailBoardCard li', { hasText: `${isMobile ? '반성문m' : '반성문'}:` })).toHaveCount(3); // (one server: others' too)
  await page.keyboard.press('Escape');
  // out at the room's door: back on the island by the 구치소
  await expect.poll(async () => {
    if (await page.evaluate(() => window.PlazaDebug().space) === 'island') return 'island';
    await page.evaluate(() => { const d = window.PlazaDebug(); const e = d.doors['jail:exit']; d.teleport(e.x, e.z); });
    await page.waitForTimeout(400); await spaceOn(page, 'jail:exit', isMobile); await page.waitForTimeout(800);
    return page.evaluate(() => window.PlazaDebug().space);
  }, { timeout: 30000, intervals: [300] }).toBe('island');
  // (293 관리자 구치소) the administrator sends me: in the cell at once, the reason in the warden's talk; let out: the cell opens
  const admin = await adminToken(request); const me = `guest:${(await get(request, '/api/admin/keys', admin)).data.keys.find((k) => k.label === (isMobile ? '반성문m' : '반성문')).id}`;
  await post(request, '/api/test/jail', who.token, { debt: 0, passedDay: '2000-01-01' }); /* (today's essay as not yet passed; no tax) */
  expect((await post(request, '/api/admin/jail', admin, { account: me, minutes: 60, reason: '시험 보냄' })).status).toBe(200);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().space), { timeout: 30000 }).toBe('jail');
  await expect(page.locator('#plazaDialog')).toContainText('관리자 판단으로 들어와 있어요 · 사유: 시험 보냄', { timeout: 15000 });
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/pc-jail-admin-notice.png` });
  expect((await post(request, '/api/admin/jail', admin, { account: me, release: true })).data.jailed.some((j) => j.account === me)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().jail().inmate), { timeout: 15000 }).toBe('free');
  await expectNoScriptError(page);
  await who.context.close();
});
