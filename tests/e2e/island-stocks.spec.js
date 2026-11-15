// v1.10.320 섬 주식 (gamecenter-notes docs/island-stocks-20261114.md): the 증권거래소 on 대청마당 (사용자 22A) -- in at its door,
// the board's SPACE opens the trade window (thirty companies), a company bought and sold (points out and in), 내 주식 and the
// week's ranking, 테드 창's one dry line, out again. The market's clock set to its hours (/api/test/stocks/clock).
const { test, expect } = require('@playwright/test');
const path = require('path');
const { shopper, post, get, standAt, spaceOn, expectNoScriptError } = require('./skin-support');
const S = require('../../lib/island-stocks');
const T = require('../../public/plaza/island-terrain.js');
const EX = require('../../public/plaza/island-exchange.js');
const shot = async (page, name) => { if (process.env.SHOT_DIR) { await page.waitForTimeout(1500); await page.screenshot({ path: path.join(process.env.SHOT_DIR, `${test.info().project.name}-${name}.png`) }); } };

test('섬 증권거래소: 문으로 들어가 보드 SPACE → 시세 30종 → 사기·팔기(포인트) → 내 주식·순위 → 테드 창 한마디 → 나가기', async ({ browser, request, isMobile }) => {
  test.setTimeout(180000);
  const a = await shopper(browser, request, isMobile ? '주식손님m' : '주식손님', 300000, 'male'); const { page, token } = a;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  await post(request, '/api/test/stocks/clock', token, { at: S.tickTime(2 * S.PER_DAY + 1) + 20 * 60000 }); // (the third day, 10:20)
  try {
    // in at the door
    const door = T.facilityDoor('stocks'); await standAt(request, a, door.x, door.z);
    if (process.env.SHOT_DIR) { await standAt(request, a, door.x, door.z - 9); await page.evaluate(() => { const d = window.PlazaDebug(); d.setTime('day'); d.setCamYaw(Math.PI); d.setCamPitch(0.32); }); await shot(page, 'exchange-outside'); await standAt(request, a, door.x, door.z); }
    await expect.poll(() => spaceOn(page, 'stocks', isMobile), { timeout: 20000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().space), { timeout: 20000 }).toBe('exchange');
    await shot(page, 'exchange-room');
    // the board
    await page.evaluate(([lx, lz]) => { const w = window.IslandExchange.world(lx, lz); window.PlazaDebug().teleport(w.x, w.z); }, [EX.BOARD.lx, EX.BOARD.lz - 0.6]);
    await expect.poll(() => spaceOn(page, 'exchange:board', isMobile), { timeout: 20000 }).toBe(true);
    const win = page.locator('.stocksCard'); await expect(win).toBeVisible({ timeout: 15000 });
    await expect(win.locator('.stocksHead')).toContainText('장 열림'); await expect(win.locator('.stocksRow')).toHaveCount(30);
    await shot(page, 'exchange-board');
    // a company: buy 3, the points down by price x 3 + the fee; sell 1
    const bal = async () => (await get(request, '/api/points', token)).data.balance; const before = await bal();
    await win.locator('.stocksRow:not([disabled])').first().click();
    const priceText = await win.locator('.stocksPrice.big').textContent(); const price = Number(priceText.replace(/[^0-9]/g, ''));
    await win.locator('.stocksQtyInput').fill('3'); await expect(win.locator('.stocksNote')).toContainText('수수료 0.5%');
    await shot(page, 'exchange-company');
    await win.getByRole('button', { name: '사기', exact: true }).click();
    await expect.poll(bal, { timeout: 15000 }).toBe(before - price * 3 - Math.max(1, Math.ceil(price * 3 * 0.005)));
    await expect(page.locator('.stocksCard').locator('.lookMeta').filter({ hasText: '가진 주식 3주' })).toBeVisible({ timeout: 15000 });
    await page.locator('.stocksCard .stocksQtyInput').fill('1'); await page.locator('.stocksCard').getByRole('button', { name: '팔기', exact: true }).click();
    await expect(page.locator('.stocksCard').locator('.lookMeta').filter({ hasText: '가진 주식 2주' })).toBeVisible({ timeout: 15000 });
    // 내 주식, the ranking
    await page.locator('.stocksCard').getByRole('button', { name: '내 주식' }).click(); await expect(page.locator('.stocksCard .stocksRow')).toHaveCount(1);
    await shot(page, 'exchange-mine');
    await page.locator('.stocksCard').getByRole('button', { name: '이번 주 순위' }).click(); await expect(page.locator('.stocksCard .stocksRank.mine').first()).toBeVisible();
    await page.locator('.stocksCard').getByRole('button', { name: '닫기' }).click();
    // 테드 창
    await page.evaluate(([lx, lz]) => { const w = window.IslandExchange.world(lx, lz); window.PlazaDebug().teleport(w.x, w.z); }, [EX.TALK.lx, EX.TALK.lz - 0.2]);
    await expect.poll(() => spaceOn(page, 'exchange:clerk', isMobile), { timeout: 20000 }).toBe(true);
    await shot(page, 'exchange-ted');
    // out
    await page.evaluate(() => { const d = window.PlazaDebug(); const w = d.doors['exchange:exit']; d.teleport(w.x, w.z); });
    await expect.poll(() => spaceOn(page, 'exchange:exit', isMobile), { timeout: 20000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().space), { timeout: 20000 }).toBe('island');
    // 내 정보 「섬 주식」: the same window, my holdings first
    await page.evaluate(() => document.getElementById('myStocksBtn').click()); await expect(page.locator('.stocksCard .stocksRow')).toHaveCount(1, { timeout: 15000 });
    await expectNoScriptError(page);
  } finally { await post(request, '/api/test/stocks/clock', token, { at: 0 }).catch(() => {}); await a.context.close(); }
});
