const { test, expect } = require('@playwright/test');
const { shopper, get, expectNoScriptError } = require('./skin-support');

// v1.10.92 잡화점 (사용자 2026-10-18, IDEAS #future-general-store): in through its door, the goods standing on the shelves,
// SPACE at one opens it and buys 1·5·10 (paid and in the bag at once), out through the room's door. PC and phone.
test('잡화점: 들어가기 → 진열된 미끼 앞 SPACE → 사기 → 가방, 나가기', async ({ browser, request, isMobile }, testInfo) => {
  test.setTimeout(180000);
  const who = await shopper(browser, request, '장보기', 100000, 'female');
  const { page, token } = who;
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const press = async () => { if (isMobile) await page.locator('#plazaHint').tap(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); } };
  await require('./skin-support').intoMall(page, null, isMobile);
  // the bait on the left shelf: stand in front of it
  await require('./skin-support').standInMall(page, 10.455, 6.5, '낚시 미끼 · 300P');
  await page.screenshot({ path: testInfo.outputPath('store-inside.png') });
  await press();
  const card = page.locator('#goodCard');
  await expect(card).toContainText('낚시할 때 자동으로');
  const before = (await get(request, '/api/points', token)).data.balance;
  await card.getByRole('button', { name: /^5개/ }).click();
  await expect.poll(async () => ((await get(request, '/api/island/bag', token)).data.items || []).find((e) => e.itemId === 'bait')?.qty || 0).toBe(5);
  expect((await get(request, '/api/points', token)).data.balance).toBe(before - 1500);
  await page.keyboard.press('Escape');
  // (B 45: the seeds are on sale now)
  await require('./skin-support').standInMall(page, 9.2, 6.5, '꽃씨');
  await require('./skin-support').standInMall(page, 0, -9.1, '나가기');
  await press();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().space)).toBe('island');
  await expectNoScriptError(page);
  await who.context.close();
});

// v1.10.92 놀이 물건과 선물: a firework used from the bag bursts over me and the other player sees it; with a gift wrap,
// one thing goes from my bag to theirs (PC: the two-player view)
test('잡화점 물건 쓰기: 폭죽은 둘 다 보이고, 포장지로 선물하면 상대 가방에', async ({ browser, request, isMobile }) => {
  test.skip(isMobile, 'PC 전용 검증');
  test.setTimeout(180000);
  const { post } = require('./skin-support');
  const a = await shopper(browser, request, '폭죽가', 100000, 'male');
  const b = await shopper(browser, request, '받는이', 100000, 'female');
  for (const w of [a, b]) { await w.page.evaluate(() => localStorage.removeItem('gc.testClassic')); await w.page.reload(); await expect.poll(() => w.page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true); }
  for (const [itemId, qty] of [['firework', 1], ['gift_wrap', 1], ['bread', 2]]) expect((await post(request, '/api/test/island/give', a.token, { itemId, qty })).status).toBe(200);
  await a.page.evaluate(() => window.PlazaWarp(4, 4)); await b.page.evaluate(() => window.PlazaWarp(5.2, 4));
  for (const w of [a, b]) await expect.poll(() => w.page.evaluate(() => window.PlazaDebug().others.length), { timeout: 20000 }).toBeGreaterThan(0);
  await b.page.evaluate(() => { window.__zzSeen = false; const d = window.PlazaDebug(); window.__zzWatch = setInterval(() => { if (d.othersActs().some((o) => o.act === 'show:firework')) window.__zzSeen = true; }, 100); }); // (CI: one PlazaDebug() takes ~2 s, the show 6 s -- watch with one debug object)
  await a.page.bringToFront(); // (a background page sends its acts late -- CI)
  await a.page.locator('#islandBagTab').click();
  await a.page.locator('.islandBagSlot[data-item="firework"]').getByRole('button', { name: '쓰기' }).click();
  await expect.poll(() => b.page.evaluate(() => window.__zzSeen), { timeout: 30000 }).toBe(true);
  await b.page.evaluate(() => clearInterval(window.__zzWatch));
  // the gift: by the other player, 선물하기, bread
  const id = await a.page.evaluate(() => window.PlazaDebug().others[0].id);
  await a.page.evaluate((id) => { const o = window.PlazaDebug().others.find((x) => x.id === id); window.PlazaDebug().teleport(o.x - 1, o.z); }, id);
  await expect(a.page.locator('#plazaHint')).toContainText('인사', { timeout: 10000 });
  await a.page.locator('#plazaStage').focus(); await a.page.keyboard.press('Space');
  await a.page.getByRole('button', { name: '선물하기' }).click();
  await a.page.locator('.giftList button', { hasText: '빵 봉투' }).click();
  await expect.poll(async () => ((await get(request, '/api/island/bag', b.token)).data.items || []).find((e) => e.itemId === 'bread')?.qty || 0).toBe(1);
  expect(((await get(request, '/api/island/bag', a.token)).data.items || []).find((e) => e.itemId === 'gift_wrap')).toBeUndefined();
  await expectNoScriptError(a.page);
  await a.context.close(); await b.context.close();
});
