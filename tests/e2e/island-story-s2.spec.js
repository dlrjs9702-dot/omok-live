const { test, expect } = require('@playwright/test');
const { shopper, post, adminToken, spaceOn, expectNoScriptError } = require('./skin-support');

// S2 섬 이야기 장면 (notes story/residents-20261027.md 「S2 정함」): the 기록관's 「섬 일지」 (pages read as opened), the little
// door under 초승등대 -- 「살펴보기」: locked, the box at its foot gives the missing page (piece 7); 오 탐정's 「결론 듣기」 (the
// board full, 노을 할머니 단짝): six papers paged through, the door opening with the second; the board stamped. PC and phone.
// (ZZ_SHOT: the island's own models, and the lighthouse at night)
test('섬 이야기 장면: 섬 일지 → 등대 아래 문 살펴보기(빠진 쪽) → 결론 듣기(쪽지 여섯·문 열림) → 수사판 도장', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.CI ? 600000 : 400000);
  const who = await shopper(browser, request, isMobile ? '등대폰' : '등대손', 200000, 'female'); const { page, token } = who;
  const done = Object.fromEntries([...Array(10).keys()].map((n) => [String(n), 3]));
  await post(request, '/api/test/story', token, { doc: { chapters: done, read: [] } });
  await page.evaluate((real) => { localStorage.removeItem('gc.testClassic'); if (!real) localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }, Boolean(process.env.ZZ_SHOT));
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  const shot = async (name) => { if (process.env.ZZ_SHOT) { await page.waitForTimeout(800); await page.screenshot({ path: `${process.env.ZZ_SHOT}-${name}-${isMobile ? 'phone' : 'pc'}.png` }); } };
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().storyDebug?.().hatch), { timeout: 30000 }).toBe(true); // (가람's 3장: the door seen)
  // 기록관: 「섬 일지」 -- three blank, eight pages, each read as opened
  await expect.poll(async () => { await page.evaluate(() => { const d = window.PlazaDebug(); const r = d.doors.records; d.teleport(r.x, r.z); }); await page.waitForTimeout(500); await spaceOn(page, 'records', isMobile); await page.waitForTimeout(600); return page.locator('#plazaDialog .storyShelf').isVisible(); }, { timeout: 30000, intervals: [500] }).toBe(true);
  await page.locator('#plazaDialog .storyShelf button', { hasText: '섬 일지' }).click();
  const book = page.locator('#storyBookDialog'); await expect(book).toBeVisible(); await expect(page.locator('#storyBookTitle')).toHaveText('섬 일지');
  await expect(book.locator('.storyLogBlank')).toHaveCount(3); await expect(book.locator('.storyLogPage')).toHaveCount(8); await expect(book.locator('.storyLogPage.locked')).toHaveCount(0);
  for (let k = 0; k < 8; k += 1) await book.locator('.storyLogPage summary').nth(k).click();
  await expect.poll(async () => (await post(request, '/api/test/story', token, {})).data.doc.read.length).toBe(8);
  await shot('1log');
  await book.locator('#storyBookClose').click();
  // the little door: locked, the box at its foot -- the missing page
  const atDoor = () => page.evaluate(async () => { const L = window.IslandTerrain.dalmaru.PLACES.lighthouse; await window.PlazaWarp(L.x + 1, L.z - 6.5); window.PlazaDebug().faceTo(L.x, L.z); });
  const viewDoor = () => page.evaluate(async () => { const L = window.IslandTerrain.dalmaru.PLACES.lighthouse; await window.PlazaWarp(L.x + 2, L.z - 15); window.PlazaDebug().faceTo(L.x, L.z - 3); window.PlazaDebug().setCamYaw(Math.PI); }); // (a step back: the door at the tower's foot in sight)
  if (process.env.ZZ_SHOT) { await viewDoor(); await expect.poll(() => page.evaluate(() => window.PlazaDebug().storyDebug().door), { timeout: 60000 }).not.toBeNull(); await shot('2door'); } // (the model in)
  await atDoor();
  const inspect = page.locator('#storyInspectBtn'); await expect(inspect).toBeVisible({ timeout: 20000 });
  await inspect.click();
  const note = page.locator('#storyNoteDialog'); await expect(note).toBeVisible(); await expect(note.locator('h3')).toContainText('빠진 쪽');
  await expect(note.locator('.storyPiece')).toContainText('조각 7');
  await shot('3missing');
  await note.locator('#storyNoteClose').click();
  const shut = await page.evaluate(() => window.PlazaDebug().storyDebug().door);
  // 오 탐정: 「결론 듣기」 (노을 할머니 단짝) -- six papers; the door opens with the second
  for (let k = 0; k < 3; k += 1) await post(request, '/api/test/affinity', token, { n: 4, delta: 10 });
  const dialog = page.locator('#plazaDialog'); const talking = async () => /talkMode/.test(await dialog.getAttribute('class') || '');
  await expect.poll(async () => {
    if (!await talking()) { await post(request, '/api/test/island/free-residents', token, {}); await page.evaluate(async () => { const w = window.PlazaDebug().wanderers.find((o) => o.n === 5); if (w) await window.PlazaWarp(w.x + 1.1, w.z); window.PlazaDebug().talkResident(5); }); await page.waitForTimeout(700); }
    return talking();
  }, { timeout: 120000, intervals: [300] }).toBe(true);
  for (let k = 0; k < 8 && await page.locator('.lostRequestLine.talkPending, .lostRequestLine.typing').count(); k += 1) await page.keyboard.press('Space');
  const choices = page.locator('#plazaDialog .talkChoices button');
  if (await page.locator('#plazaDialog .questNote', { hasText: '오늘 안에' }).count()) await choices.filter({ hasText: '다음에요' }).click(); // (a day's errand asked first)
  await expect(choices.first()).toHaveText('결론 듣기'); await expect(choices.filter({ hasText: '수사판 보기' })).toHaveCount(1);
  await choices.first().click();
  await expect(note).toBeVisible(); await expect(note.locator('h3')).toHaveText('마지막 장 · 수사판의 결론');
  await note.locator('.storyNext').click(); await expect(note.locator('h3')).toHaveText('마지막 장 · 등대 아래 문');
  if (shut !== null) await expect.poll(() => page.evaluate(() => window.PlazaDebug().storyDebug().door)).not.toBe(shut);
  await note.locator('.storyNext').click(); await expect(note.locator('h3')).toHaveText('마지막 장 · 다음 이웃에게');
  await expect(note.locator('p').first()).toHaveText('새 이웃이 왔구나. 어서 오렴.');
  await shot('4letter');
  for (const title of ['등불을 맡기며', '하람의 헌사', '그날 밤']) { await note.locator('.storyNext').click(); await expect(note.locator('h3')).toHaveText(`마지막 장 · ${title}`); }
  await expect(note.locator('.storyNext')).toHaveCount(0); await expect(note.locator('.storyWord').first()).toContainText('이솔');
  const box = await note.boundingBox(); expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height + 1);
  await note.locator('#storyNoteClose').click();
  // the board: eight cells, each stamped
  await expect(dialog).toBeHidden(); // (the talk ended with the papers)
  await page.locator('#islandBagTab').click(); await page.locator('#islandStoryBtn').click();
  await book.locator('[data-tab="lighthouse"]').click();
  await expect(book.locator('.storyPieceCell.found')).toHaveCount(8); await expect(book.locator('.storyStamp')).toHaveCount(8);
  await expect(book.locator('.storyBookBody')).toContainText('마지막 장 · 초승 등불');
  await shot('5board');
  await book.locator('#storyBookClose').click();
  if (process.env.ZZ_SHOT) { await viewDoor(); await shot('6dooropen'); }
  if (process.env.ZZ_SHOT) { // (the lighthouse at night: the lamp's beat)
    const admin = await adminToken(request); const set = (mode) => request.post('/api/admin/island/time', { headers: { 'X-Session-Token': admin }, data: { mode } });
    await set('night'); await page.waitForTimeout(4000);
    await page.evaluate(async () => { const L = window.IslandTerrain.dalmaru.PLACES.lighthouse; await window.PlazaWarp(L.x, L.z - 34); window.PlazaDebug().faceTo(L.x, L.z); window.PlazaDebug().setCamYaw(Math.PI); });
    const lamp = new Set(); for (let k = 0; k < 12; k += 1) { lamp.add(await page.evaluate(() => window.PlazaDebug().storyDebug().lamp)); await page.waitForTimeout(250); }
    expect([...lamp].sort()).toEqual([0.15, 2.4]); // (its beat: on and off at night)
    await shot('7night'); await set('auto');
  }
  await expectNoScriptError(page);
  await who.context.close();
});
