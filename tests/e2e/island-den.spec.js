// 1.10.341 지하 도박장 (notes underground-den-20261116): the note on its bench (SPACE: the paper and its word) → the exchange,
// 테드's window: the word (the bookcase opens), chips → down the stairs → the dice table (the window, a play, the dice on the table)
// → a raid: on the island 마루 and the clerks walking and the 「잠시 자리 비움」; they come down -- the cell. A phone: the table's
// window fits the screen.
const { test, expect } = require('@playwright/test');
const { shopper, post, spaceOn } = require('./skin-support');

test('지하 도박장: 쪽지 → 테드에게 암호·칩 → 지하 주사위 → 단속(걷는 넷·팻말) → 구치소', async ({ browser, request, isMobile }) => {
  test.setTimeout(300000);
  const a = await shopper(browser, request, isMobile ? '지하손님m' : '지하손님', 100000, 'female'); const { page } = a;
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.view.out', 'third'); localStorage.setItem('gc.view.in', 'third'); }); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  const day = (await post(request, '/api/test/den', a.token, {})).data; expect(day.word).toBeTruthy();
  const space = () => page.evaluate(() => window.PlazaDebug().space);
  const at = async (door, want) => { await expect.poll(async () => { await page.evaluate((id) => { const d = window.PlazaDebug(); const w = d.doors[id]; if (w) d.teleport(w.x, w.z); }, door); await page.waitForTimeout(500); return page.evaluate(() => window.PlazaDebug().near); }, { timeout: 30000 }).toBe(want ?? door); };
  const press = async (id) => { await at(id); await spaceOn(page, id, isMobile); };
  const through = async (door, want) => { for (let k = 0; k < 6 && await space() !== want; k += 1) { await press(door); await expect.poll(space, { timeout: 8000 }).toBe(want).catch(() => {}); } expect(await space()).toBe(want); };
  // the note: its paper and the word
  await expect.poll(() => page.evaluate(() => Boolean(window.PlazaDebug().den().note)), { timeout: 20000 }).toBe(true);
  await press('den:note'); await expect(page.locator('#plazaDialog .denPaperWord')).toHaveText(day.word, { timeout: 15000 });
  if (isMobile) { const fit = await page.evaluate(() => { const r = document.querySelector('#plazaDialog .denPaper').getBoundingClientRect(); return r.right <= window.innerWidth + 1 && r.left >= -1; }); expect(fit).toBe(true); await a.context.close(); return; }
  await page.evaluate(() => document.getElementById('plazaDialog').close());
  // the exchange, 테드: the word, chips
  await through('stocks', 'exchange');
  await press('exchange:clerk'); await expect(page.locator('#plazaDialog .tedCard')).toBeVisible({ timeout: 15000 });
  await page.locator('#plazaDialog .tedWord').fill(day.word); await page.locator('#plazaDialog button', { hasText: '작게 말하기' }).click();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().den().open), { timeout: 10000 }).toBe(true);
  await press('exchange:clerk'); await expect(page.locator('#plazaDialog .tedCard')).toBeVisible({ timeout: 15000 });
  await page.locator('#plazaDialog .tedAmount').fill('1000'); await page.locator('#plazaDialog button', { hasText: '포인트 → 칩' }).click();
  await expect(page.locator('#plazaDialog .tedCard .stocksHead')).toContainText('가진 칩 1,000개', { timeout: 10000 });
  await page.evaluate(() => document.getElementById('plazaDialog').close());
  // down the stairs, the dice
  await through('den:door', 'den');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().den().built)).toBe(true);
  await press('den:table:0'); await expect(page.locator('#plazaDialog .denCard')).toBeVisible({ timeout: 15000 });
  await page.locator('#plazaDialog .denBet').fill('100'); await page.locator('#plazaDialog .denPicks button', { hasText: '크다' }).click();
  await expect(page.locator('#plazaDialog .denOut')).toContainText('주사위', { timeout: 10000 });
  await page.evaluate(() => document.getElementById('plazaDialog').close());
  // a raid: another screen on the island sees the four walk and the sign; then they come down -- the cell
  const b = await shopper(browser, request, '단속구경꾼', 0, 'male'); await b.page.evaluate(() => { localStorage.removeItem('gc.testClassic'); }); await b.page.reload();
  await expect.poll(() => b.page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
    await post(request, '/api/test/den', a.token, { raid: true, walkM: 60 });
  await expect.poll(() => page.evaluate(() => Boolean(window.PlazaDebug().den().raid)), { timeout: 15000 }).toBe(true);
  await b.page.evaluate(() => { const d = window.PlazaDebug(); const w = window.IslandTerrain.facilityDoor('townhall'); d.teleport(w.x + 3, w.z + 3); });
  await expect.poll(() => b.page.evaluate(() => { const d = window.PlazaDebug().den(); return d.crew > 0 && d.sign; }), { timeout: 20000 }).toBe(true);
  await post(request, '/api/test/den', a.token, { tick: true });
  await expect.poll(space, { timeout: 20000 }).toBe('jail');
  await post(request, '/api/test/den', a.token, { end: true });
  await b.context.close(); await a.context.close();
});
