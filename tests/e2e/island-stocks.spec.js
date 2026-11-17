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
    // (1.10.322) each row's line and its ▲▼ on one basis (today's first price to now), the columns named
    await expect(win.locator('.stocksCols')).toContainText('오늘');
    expect(await win.locator('.stocksRow:not([disabled])').evaluateAll((rows) => rows.every((r) => { const line = r.querySelector('.stockSpark polyline'); const ch = r.querySelector('.stocksChange'); return !line || [...ch.classList].includes(line.getAttribute('class')); }))).toBe(true);
    // a company: buy 3, the points down by price x 3 + the fee; sell 1
    const bal = async () => (await get(request, '/api/points', token)).data.balance; const before = await bal();
    await win.locator('.stocksRow:not([disabled])').first().click();
    const priceText = await win.locator('.stocksPrice.big').textContent(); const price = Number(priceText.replace(/[^0-9]/g, ''));
    await expect(win.locator('.stocksDetail')).toContainText('오늘'); await expect(win.locator('.stocksDetail')).toContainText('어제보다');
    await expect(win.locator('.stocksLabel').nth(1)).toHaveText(/^(상장 [1-6]일째|지난 7일)$/); /* (fewer than 7 days listed: 「상장 n일째」) */
    await win.locator('.stocksQtyInput').fill('3'); await expect(win.locator('.stocksNote')).toContainText('수수료 0.5%');
    await shot(page, 'exchange-company');
    await win.getByRole('button', { name: '사기', exact: true }).click();
    await expect.poll(bal, { timeout: 15000 }).toBe(before - price * 3 - Math.max(1, Math.ceil(price * 3 * 0.005)));
    await expect(page.locator('.stocksCard').locator('.lookMeta').filter({ hasText: '가진 주식 3주' })).toBeVisible({ timeout: 15000 });
    await page.locator('.stocksCard .stocksQtyInput').fill('1'); await page.locator('.stocksCard').getByRole('button', { name: '팔기', exact: true }).click();
    await expect(page.locator('.stocksCard').locator('.lookMeta').filter({ hasText: '가진 주식 2주' })).toBeVisible({ timeout: 15000 });
    // (1.10.351 주식 개편) ⑤ the card (업종 · 상장일), ③ my average line, ④ the star and an alert kept
    await expect(page.locator('.stocksCard .stocksInfo')).toContainText('상장'); await expect(page.locator('.stocksCard .stockAvgLine').first()).toBeAttached();
    await page.locator('.stocksCard').getByRole('button', { name: '☆ 관심 종목에 넣기' }).click(); await expect(page.locator('.stocksCard').getByRole('button', { name: '★ 관심 종목' })).toBeVisible({ timeout: 15000 });
    await page.locator('.stocksCard .stocksAlertAbove').fill(String(price * 3)); await page.locator('.stocksCard .stocksAlert').getByRole('button', { name: '저장' }).click();
    await expect(page.locator('.stocksCard .stocksAlertAbove')).toHaveValue(String(price * 3), { timeout: 15000 });
    await shot(page, 'exchange-company-card');
    // ④ starred first on the board; ② 거래 기록: the sale and the buy, the sums
    await page.locator('.stocksCard').getByRole('button', { name: '시세', exact: true }).click(); await expect(page.locator('.stocksCard .stocksRow').first()).toHaveClass(/starred/);
    await page.locator('.stocksCard').getByRole('button', { name: '거래 기록' }).click(); await expect(page.locator('.stocksCard .stocksLog')).toHaveCount(2); await expect(page.locator('.stocksCard .stocksLog').first()).toContainText('팔기 1주');
    await expect(page.locator('.stocksCard .stocksSums')).toContainText('이번 주'); await expect(page.locator('.stocksCard')).toContainText('이번 업데이트부터 기록돼요'); await shot(page, 'exchange-log');
    // ① 섬 소식: whole names (not cut, the phone too), pressed open
    await page.locator('.stocksCard').getByRole('button', { name: '섬 소식' }).click(); const newsRows = page.locator('.stocksCard .stocksNews');
    if (await newsRows.count()) { expect(await page.locator('.stocksCard .stocksNewsName').evaluateAll((els) => els.every((e) => e.scrollWidth <= e.clientWidth + 1))).toBe(true); await newsRows.first().click(); await expect(page.locator('.stocksCard .stocksNewsMore').first()).toBeVisible(); await expect(page.locator('.stocksCard .stocksNewsMore').first()).toContainText('그때 값'); await shot(page, 'exchange-news'); }
    // 내 주식, the ranking
    await page.locator('.stocksCard').getByRole('button', { name: '내 주식' }).click(); await expect(page.locator('.stocksCard .stocksRow')).toHaveCount(1);
    await shot(page, 'exchange-mine');
    await page.locator('.stocksCard').getByRole('button', { name: '이번 주 순위' }).click(); await expect(page.locator('.stocksCard .stocksRank.mine').first()).toBeVisible();
    await expect(page.locator('.stocksCard .stocksRank.mine').first()).toContainText(/[▲▼–] [\d,]+P/); /* (1.10.351 ⑥: the points beside) */
    await page.locator('.stocksCard').getByRole('button', { name: '닫기' }).click();
    // 테드 창
    await page.evaluate(([lx, lz]) => { const w = window.IslandExchange.world(lx, lz); window.PlazaDebug().teleport(w.x, w.z); }, [EX.TALK.lx, EX.TALK.lz - 0.2]);
    await expect.poll(() => spaceOn(page, 'exchange:clerk', isMobile), { timeout: 20000 }).toBe(true);
    await expect(page.locator('#plazaDialog .tedCard')).toBeVisible({ timeout: 15000 }); await shot(page, 'exchange-ted'); /* (1.10.341: his window -- chips and the word) */
    await page.evaluate(() => document.getElementById('plazaDialog').close());
    // out
    await page.evaluate(() => { const d = window.PlazaDebug(); const w = d.doors['exchange:exit']; d.teleport(w.x, w.z); });
    await expect.poll(() => spaceOn(page, 'exchange:exit', isMobile), { timeout: 20000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().space), { timeout: 20000 }).toBe('island');
    // 내 정보 「섬 주식」: the same window, my holdings first
    await page.evaluate(() => document.getElementById('myStocksBtn').click()); await expect(page.locator('.stocksCard .stocksRow')).toHaveCount(1, { timeout: 15000 });
    await expectNoScriptError(page);
  } finally { await post(request, '/api/test/stocks/clock', token, { at: 0 }).catch(() => {}); await a.context.close(); }
});
