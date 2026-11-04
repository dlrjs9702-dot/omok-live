const { test, expect } = require('@playwright/test');
const { shopper, post, expectNoScriptError } = require('./skin-support');

// v1.10.236 빠른 칸 (gamecenter-notes docs/quickbar-20261104.md, 사용자 「숫자에 아이템 빨리 장착」 「도구처럼 장착한 후에
// 상호작용키를 누르면 쓰는 걸로」): from the bag 「빠른 칸에」 then a slot (or a number); shut, a number holds that slot's;
// a 폭죽 in hand, SPACE uses one -- an islander before me, the talk first; kept through a reload; in a talk 1 is an answer.
// A phone: a tap holds, 상호작용 uses a 풍선, five slots of 44 px clear of the stick and the buttons at 360 px. SHOT_DIR photos.
test('빠른 칸: 가방에서 넣기 → 숫자로 들기 → SPACE로 폭죽 쓰기, 주민 앞은 대화 먼저, 새로고침 뒤에도 그대로', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.CI ? 300000 : 200000);
  const who = await shopper(browser, request, isMobile ? '빠른칸m' : '빠른칸', 0, 'female'); const { page, token } = who;
  for (const [itemId, qty] of [['bugnet', 1], ['firework', 3], ['balloon', 2]]) expect((await post(request, '/api/test/island/give', token, { itemId, qty })).status).toBe(200);
  await page.evaluate((shots) => { localStorage.removeItem('gc.testClassic'); if (shots) localStorage.setItem('gc.testRealView', '1'); else localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }, Boolean(process.env.SHOT_DIR));
  if (isMobile) await page.setViewportSize({ width: 360, height: 740 });
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  const shot = async (name) => { if (process.env.SHOT_DIR) { await page.waitForTimeout(1200); await page.screenshot({ path: `${process.env.SHOT_DIR}/${isMobile ? 'phone' : 'pc'}-quick-${name}.png` }); } };
  const bar = page.locator('#quickBar'); const slot = (k) => bar.locator(`.quickSlot[data-k="${k}"]`); const inBag = (k) => page.locator(`#quickInBag .quickSlot[data-k="${k}"]`);
  const tap = async (loc) => { if (isMobile) await loc.tap(); else await loc.click(); };
  await expect(bar).toBeHidden(); // (all five empty: only in the bag)
  // the bag: the five under the pouch; the 잠자리채 「빠른 칸에」 → 1번, the 폭죽 → 2 (the number), the 풍선 → 3번
  await tap(page.locator('#islandBagTab')); await expect(page.locator('#quickInBag .quickSlot')).toHaveCount(5); await shot('bag-empty');
  const toSlot = async (item, k, byKey = false) => {
    await tap(page.locator(`.islandBagSlot[data-item="${item}"]`)); await tap(page.locator(`.islandBagSlot[data-item="${item}"] .bagMenu [role="menuitem"]`, { hasText: '빠른 칸에' }));
    if (byKey) await page.keyboard.press(`Digit${k}`); else await tap(inBag(k));
    await expect(inBag(k)).not.toHaveClass(/empty/);
  };
  await toSlot('bugnet', 1); await toSlot('firework', 2, !isMobile); await toSlot('balloon', 3);
  await expect(page.locator('.islandBagSlot[data-item="firework"] .bagMenu')).toHaveCount(0);
  await tap(page.locator('.islandBagSlot[data-item="fishing_rod"], .islandBagSlot[data-item="firework"]').first());
  await expect(page.locator('.islandBagSlot[data-item="firework"] .bagMenu [role="menuitem"]')).toHaveText(['들기', '빠른 칸에']); // (사용자 「도구처럼」: no 「쓰기」)
  await shot('bag-set');
  await page.locator('#islandBagCloseBtn').click(); await expect(bar).toBeVisible();
  await expect(slot(2).locator('small')).toHaveText('3');
  // a number (a tap): in hand; another: changed; the same again: away
  const press = async (k) => { if (isMobile) await slot(k).tap(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press(`Digit${k}`); } };
  await press(1); await expect(slot(1)).toHaveClass(/inHand/);
  await press(isMobile ? 3 : 2); await expect(slot(isMobile ? 3 : 2)).toHaveClass(/inHand/); await expect(slot(1)).not.toHaveClass(/inHand/);
  await shot('held');
  // nothing before me: SPACE (상호작용) uses one
  const kind = isMobile ? '풍선' : '폭죽'; const k = isMobile ? 3 : 2; const left = isMobile ? '1' : '2';
  await expect.poll(async () => {
    if ((await page.locator('#plazaHint').textContent()).includes(`${kind} 쓰기`)) return true;
    await page.evaluate(() => { const d = window.PlazaDebug(); const p = d.doors.games || Object.values(d.doors)[0]; d.teleport(p.x + 9 * (Math.random() - 0.5), p.z + 9 + 4 * Math.random()); }); await page.waitForTimeout(700);
    return (await page.locator('#plazaHint').textContent()).includes(`${kind} 쓰기`);
  }, { timeout: 40000, intervals: [300] }).toBe(true);
  if (isMobile) await page.locator('#islandActBtn').tap(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); }
  await expect(slot(k).locator('small')).toHaveText(left, { timeout: 10000 }); await shot('used');
  // an islander before me: the talk first, the thing still in hand; in the talk 1 is the first answer, not a slot
  const dialog = page.locator('#plazaDialog'); const talking = async () => /talkMode/.test(await dialog.getAttribute('class') || '');
  await expect.poll(async () => {
    if (await talking()) return true;
    await post(request, '/api/test/island/free-residents', token, {});
    await page.evaluate(async () => { const w = window.PlazaDebug().wanderers.find((o) => o.n === 1); if (w) await window.PlazaWarp(w.x + 1.2, w.z); }); await page.waitForTimeout(500);
    if (isMobile) await page.locator('#islandActBtn').tap(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); }
    await page.waitForTimeout(900); return talking();
  }, { timeout: 90000, intervals: [300] }).toBe(true);
  await expect(slot(k).locator('small')).toHaveText(left); await expect(slot(k)).toHaveClass(/inHand/);
  if (!isMobile) { await page.keyboard.press('Digit1'); await expect(slot(1)).not.toHaveClass(/inHand/); }
  await page.evaluate(() => document.getElementById('plazaDialog').close());
  // the phone at 360 px: five of 44 px, clear of the stick and the buttons
  if (isMobile) {
    const box = await bar.boundingBox(); for (let n = 1; n <= 5; n += 1) expect((await slot(n).boundingBox()).width).toBeGreaterThanOrEqual(44);
    for (const id of ['#islandStick', '#islandActBtn', '#islandWalkBtn', '#islandRunBtn', '#islandBagTab']) { const o = await page.locator(id).boundingBox(); if (!o) continue; const apart = o.x >= box.x + box.width || o.x + o.width <= box.x || o.y >= box.y + box.height || o.y + o.height <= box.y; expect(apart, id).toBe(true); }
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(360);
  }
  // kept: the same five after a reload
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  await expect(bar).toBeVisible(); for (const n of [1, 2, 3]) await expect(slot(n)).not.toHaveClass(/empty/); await expect(slot(4)).toHaveClass(/empty/);
  await expectNoScriptError(page); await who.context.close();
});
