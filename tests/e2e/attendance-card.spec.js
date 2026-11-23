const { test, expect } = require('@playwright/test');
const { shopper, get, spaceOn, expectNoScriptError } = require('./skin-support');

// 창 2단계 출석 (gamecenter-notes docs/dialogue-box-redesign-20261025.md): at the island's 출석 spot a stamp card -- this
// month's days, today's space waiting; the button stamps it (and pays the day's points once), then it is done. PC and phone.
test('출석 도장 카드: 이번 달 칸, 오늘 출석하면 도장이 찍히고 포인트는 한 번', async ({ browser, request, isMobile }) => {
  test.setTimeout(150000);
  const who = await shopper(browser, request, '도장', 0, 'female'); const { page, token } = who;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  await expect.poll(async () => { await page.evaluate(() => window.PlazaDebug().place('attendance')); await page.waitForTimeout(700); return spaceOn(page, 'attendance', isMobile); }, { timeout: 30000 }).toBe(true);
  const card = page.locator('#plazaDialog #stampCard');
  await expect(card.locator('.stampDay')).toHaveCount((await get(request, '/api/points/attendance/month', token)).data.length);
  await expect(card.locator('.stampDay.today')).toHaveCount(1); await expect(card.locator('.stampDay.stamped')).toHaveCount(0);
  const before = (await get(request, '/api/points', token)).data.balance;
  await card.locator('.stampBtn').click();
  await expect(card.locator('.stampDay.today.stamped .stampInk')).toBeVisible();
  await expect(card.locator('.stampBtn')).toBeDisabled(); await expect(card.locator('.stampCount')).toContainText('1일');
  if (process.env.ZZ_OUT) await page.screenshot({ path: `${process.env.ZZ_OUT}-${isMobile ? 'm' : 'p'}-attendance-stamped.png` });
  expect((await get(request, '/api/points', token)).data.balance - before).toBe(30000); // (경제 점검 ⑥-C: the day's 30,000 -- a first day, no streak)
  await expect(card.locator('.stampStreak')).toContainText('연속 1일');
  const box = await page.locator('#plazaDialog').boundingBox(); const vp = page.viewportSize(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(vp.width); // (fits a phone)
  // (1.10.423 문제: a month with a big stamp (.stampDay.big, 7 days running) widened the grid past the window -- a sideways scroll. One made big here: the grid still fits)
  await page.route('**/api/points/attendance/month', async (route) => { const r = await route.fetch(); const j = await r.json(); j.days = Array.from({ length: j.today }, (_, i) => i + 1); j.big = j.days.filter((x) => x % 7 === 0 || x === j.today); await route.fulfill({ response: r, json: j }); }); /* (the month as the server sends it with 7-day runs) */
  await page.locator('#plazaCloseBtn').click(); await expect(card).toBeHidden();
  await expect.poll(async () => { await page.evaluate(() => window.PlazaDebug().place('attendance')); await page.waitForTimeout(700); return spaceOn(page, 'attendance', isMobile); }, { timeout: 30000 }).toBe(true);
  await expect(card.locator('.stampDay.big').first()).toBeVisible();
  const fit = await card.evaluate((c) => { const g = c.querySelector('.stampGrid'); const d = document.getElementById('plazaDialog'); return { grid: [g.scrollWidth, g.clientWidth], dialog: [d.scrollWidth, d.clientWidth], cols: getComputedStyle(g).gridTemplateColumns }; });
  await page.unroute('**/api/points/attendance/month');
  expect(fit.grid[0], JSON.stringify(fit)).toBeLessThanOrEqual(fit.grid[1] + 6); /* (the big stamp's own 1.08 scale past an edge column -- a few px drawn, no track wider) */ expect(fit.dialog[0], JSON.stringify(fit)).toBeLessThanOrEqual(fit.dialog[1]); /* (no sideways scroll -- was 485 in 438) */
  await expectNoScriptError(page);
  await who.context.close();
});
