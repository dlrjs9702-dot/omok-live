const { test, expect } = require('@playwright/test');
const { shopper, get, post, spaceOn, expectNoScriptError } = require('./skin-support');

// 주민세 고지서 (gamecenter-notes docs/tax-bill-design-20261025.md, 사용자 「고지서 + 창구 납부」): the day's bill comes to the
// 우체통 as a letter from the 관공서 (nothing taken); at the 세금 창구 the unpaid bills, 「모두 내기」 pays them; at the 예금
// 창구 자동이체 is off until turned on. PC and phone.
test('주민세 고지서: 우체통 편지, 세금 창구 「모두 내기」, 예금 창구 자동이체', async ({ browser, request, isMobile }) => {
  test.setTimeout(240000);
  const who = await shopper(browser, request, isMobile ? '고지서m' : '고지서', 500000, 'female'); const { page, token } = who;
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const before = (await get(request, '/api/points', token)).data.balance;
  expect((await post(request, '/api/test/tax', token, { day: today })).status).toBe(200);
  expect((await get(request, '/api/points', token)).data.balance).toBe(before); // (nothing taken)
  const bill = (await get(request, '/api/island/tax', token)).data.bills.find((b) => b.day === today); expect(bill.amount).toBeGreaterThanOrEqual(20000);
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  // the 우체통: a letter from the 관공서, its own stamp
  await expect.poll(async () => { await page.evaluate(() => window.PlazaDebug().place('mailbox')); await page.waitForTimeout(700); return spaceOn(page, 'mailbox', isMobile); }, { timeout: 30000 }).toBe(true);
  const letter = page.locator('#plazaDialog .mailLetter', { hasText: '주민세 고지서' });
  await expect(letter).toContainText('관공서'); await expect(letter.locator('.mailStamp')).toHaveText('관공서'); await expect(letter.locator('button', { hasText: '답장' })).toBeHidden();
  if (process.env.ZZ_OUT) await page.screenshot({ path: `${process.env.ZZ_OUT}-${isMobile ? 'm' : 'p'}-mail.png` });
  await page.locator('#plazaCloseBtn').click();
  // the 관공서's windows: seated at each
  await expect.poll(async () => { await page.evaluate(() => window.PlazaDebug().place('townhall')); await page.waitForTimeout(700); await spaceOn(page, 'townhall', isMobile); await page.waitForTimeout(700); return page.evaluate(() => window.PlazaDebug().space); }, { timeout: 40000 }).toBe('townhall');
  const sitAt = async (door, dialog) => expect.poll(async () => {
    if (await page.locator(dialog).isVisible()) return true;
    await page.evaluate((door) => { const c = window.IslandTerrain.plazaProps().seats.find((x) => x.door === door); window.PlazaDebug().teleport(c.x, c.z + 1.1); }, door);
    await page.waitForTimeout(600); await spaceOn(page, '', isMobile); await page.waitForTimeout(900); return page.locator(dialog).isVisible();
  }, { timeout: 40000, intervals: [300] }).toBe(true);
  await sitAt('room:tax', '#taxDialog');
  await expect(page.locator('#taxBillList .taxBill')).toHaveCount(1); await expect(page.locator('#taxBillList')).toContainText(`${bill.amount.toLocaleString('ko-KR')}P`);
  if (process.env.ZZ_OUT) await page.screenshot({ path: `${process.env.ZZ_OUT}-${isMobile ? 'm' : 'p'}-tax.png` });
  await page.locator('#islandTaxPay').click();
  await expect(page.locator('#taxStatus')).toContainText('냈어요'); await expect(page.locator('#taxBillList .taxBill')).toHaveCount(0);
  expect((await get(request, '/api/points', token)).data.balance).toBe(before - bill.amount);
  await page.keyboard.press('Escape'); await expect(page.locator('#taxDialog')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().actLocked), { timeout: 10000 }).toBe(false);
  // 자동이체: off, turned on
  await sitAt('room:bank', '#bankDialog');
  const auto = page.locator('#bankTaxAuto'); await expect(auto).not.toBeChecked();
  await auto.check(); await expect(page.locator('#bankStatus')).toContainText('자동이체를 켰어요');
  expect((await get(request, '/api/island/tax', token)).data.auto).toBe(true);
  if (process.env.ZZ_OUT) await page.screenshot({ path: `${process.env.ZZ_OUT}-${isMobile ? 'm' : 'p'}-bank.png` });
  await expectNoScriptError(page); await who.context.close();
});
