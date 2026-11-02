const { test, expect } = require('@playwright/test');
const { shopper, post, get, intoMall, standAt, spaceOn, expectNoScriptError } = require('./skin-support');
const S = require('../../lib/skins.js');
const F = require('../../public/plaza/island-furniture.js');

// v1.10.227 주간 신상 (gamecenter-notes docs/weekly-new-20261102.md): the week held (week 0) -- the 옷가게's 「이번 주 신상」
// row of ten, the hidden ones not in its list; one bought; the week moved on: the row changes, the bought one still mine and
// worn; the 3층's 「이번 주 신상」 shelf; the board's note. The giant tuna in a big and a pillar tank (6). The 전적관 on the
// island's paper (7). PC and phone; SHOT_DIR photos (the real models only then).
const prep = async (who) => { const real = Boolean(process.env.SHOT_DIR); await who.page.evaluate((real) => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.view.out', 'third'); if (real) localStorage.setItem('gc.testRealView', '1'); else localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }, real); await who.page.reload(); await expect.poll(() => who.page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true); };
const shotOf = (test) => async (page, name, wait = 1200) => { if (!process.env.SHOT_DIR) return; await page.waitForTimeout(wait); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-${name}.png` }); };
const pressOf = (page, isMobile) => async () => { if (isMobile) await page.locator('#plazaHint').tap(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); } };

test('주간 신상: 옷가게 신상 10칸에서 사기, 숨긴 것 없음 → 주 넘김 → 줄이 바뀌고 산 것은 그대로 → 3층 신상 진열대 → 게시판 쪽지', async ({ browser, request, isMobile }) => {
  test.setTimeout(600000);
  expect((await request.post('/api/test/new-week', { data: { week: 0 } })).ok()).toBe(true);
  try {
    const a = await shopper(browser, request, isMobile ? '신상m' : '신상p', 3000000, 'female'); const { page } = a; await prep(a);
    const shot = shotOf(test); const press = pressOf(page, isMobile);
    // the 옷가게 (2층): the week's ten first; a hidden outfit nowhere in the list
    await intoMall(page, 'avatar', isMobile); const shop = page.locator('#skinShopDialog');
    await expect.poll(async () => { if (await shop.isVisible()) return true; await spaceOn(page, 'avatar', isMobile); await page.waitForTimeout(800); return shop.isVisible(); }, { timeout: 30000, intervals: [500] }).toBe(true);
    const row = shop.locator('.weeklyNew'); await expect(row.locator('.skinCard')).toHaveCount(10); await expect(row.locator('h3')).toContainText('이번 주 신상');
    const hiddenOutfit = S.WEEKLY_POOL.map((id) => S.skinById(id)).find((s) => s.slot === 'outfit' && !S.weeklySkins(0).includes(s.id));
    await expect(shop.locator('.skinCard .skinName', { hasText: hiddenOutfit.name })).toHaveCount(0);
    await shot(page, 'weekly-row', 1500);
    const pick = S.skinById(S.weeklySkins(0)[0]); const card = row.locator('.skinCard').filter({ hasText: pick.name }).first();
    await card.locator('button[data-action="buy"]').click(); await card.locator('button[data-action="buy"]').click(); // (armed, then paid)
    await expect.poll(async () => (await get(request, '/api/skins', a.token)).data.owned.includes(pick.id), { timeout: 15000 }).toBe(true);
    await shop.locator('#skinShopCloseBtn').click();
    // the next week: another ten; mine still mine and worn
    await request.post('/api/test/new-week', { data: { week: 1 } });
    await expect.poll(async () => { if (await shop.isVisible()) return true; await spaceOn(page, 'avatar', isMobile); await page.waitForTimeout(800); return shop.isVisible(); }, { timeout: 30000, intervals: [500] }).toBe(true);
    await expect(row.locator('.skinCard').first()).toContainText(S.skinById(S.weeklySkins(1)[0]).name);
    await expect(row.locator('.skinCard', { hasText: pick.name })).toHaveCount(0);
    expect((await post(request, '/api/skins/equip', a.token, { skinId: pick.id })).status).toBe(200);
    await shop.locator('#skinShopCloseBtn').click();
    // the 3층: the week's shelf, one bought
    await expect.poll(async () => { await page.evaluate(() => { const d = window.PlazaDebug(); const l = d.doors['lift:2'] || d.doors['lift:1']; d.teleport(l.x, l.z); }); await page.waitForTimeout(500); return page.locator('#plazaHint').textContent(); }, { timeout: 20000 }).toContain('승강기');
    await press(); await page.locator('#liftCard button[data-floor="3"]').click();
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().space), { timeout: 15000 }).toBe('furniture');
    const good = F.good(F.weeklyOf(1)[0]);
    const W = await page.evaluate(() => { const F = window.IslandFurniture; const s = F.WEEK_SLOTS[0]; const w = F.world(s.lx, s.lz - 1.6); return F.clamp(w.x, w.z); });
    await expect.poll(async () => { await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [W.x, W.z]); await page.waitForTimeout(500); return page.locator('#plazaHint').textContent(); }, { timeout: 20000 }).toContain(good.name.split(' ')[0]);
    if (process.env.SHOT_DIR) { // (the six and the plaque from their front corner, from above: the third-person view for it)
      await page.locator('#islandViewTab').click(); await expect.poll(() => page.evaluate(() => window.PlazaDebug().view().mode)).toBe('third');
      await page.evaluate(() => { const F = window.IslandFurniture; const d = window.PlazaDebug(); const at = F.world(8.6, 1.0); const to = F.world(12.0, 4.6); d.teleport(at.x, at.z); d.faceTo(to.x, to.z); d.setCamYaw(Math.atan2(at.x - to.x, at.z - to.z)); d.setCamPitch(0.26); }); await shot(page, 'weekly-shelf', 2500);
      await page.evaluate(() => window.PlazaDebug().setCamPitch(0)); await page.locator('#islandViewTab').click(); // (the plaque up close, first person)
      await page.evaluate(() => { const F = window.IslandFurniture; const d = window.PlazaDebug(); const at = F.world(9.0, -1.6); const to = F.world(9.0, 0.6); d.teleport(at.x, at.z); d.faceTo(to.x, to.z); d.setCamYaw(Math.atan2(at.x - to.x, at.z - to.z)); d.setCamPitch(0.2); }); await shot(page, 'weekly-plaque', 2000);
      await page.evaluate(([x, z]) => { const d = window.PlazaDebug(); d.setCamPitch(0); d.teleport(x, z); }, [W.x, W.z]); await page.waitForTimeout(600);
    }
    await press(); await expect(page.locator('#furnitureCard')).toContainText('이번 주 신상');
    await page.locator('#furnitureCard button', { hasText: '사기' }).click(); await expect(page.locator('#furnitureCard')).toBeHidden({ timeout: 15000 });
    expect((await get(request, '/api/island/furniture/mine', a.token)).data.pieces.some((p) => p.id === good.id)).toBe(true);
    // the board: the week's note
    const notes = (await get(request, '/api/announcements', a.token)).data.items.filter((n) => n.title.startsWith('[이번 주 신상]'));
    expect(notes.length).toBeGreaterThan(0);
    await expectNoScriptError(page); await a.context.close();
  } finally { await request.post('/api/test/new-week', { data: { week: null } }).catch(() => {}); }
});

test('참치: 큰 수조·원기둥 수조에 한 마리씩(유리 밖으로 안 나옴), 둘째는 거절', async ({ browser, request, isMobile }) => {
  test.setTimeout(400000);
  const a = await shopper(browser, request, isMobile ? '참치m' : '참치p', 500000, 'male'); const { page } = a; await prep(a);
  const shot = shotOf(test); const press = pressOf(page, isMobile);
  let lot = null;
  try {
    { const th = await page.evaluate(() => window.PlazaDebug().doors.townhall); await standAt(request, a, th.x, th.z); }
    await expect.poll(async () => { if (await page.evaluate(() => window.PlazaDebug().space) === 'townhall') return true; await spaceOn(page, 'townhall', isMobile); await page.waitForTimeout(800); return page.evaluate(() => window.PlazaDebug().space === 'townhall'); }, { timeout: 40000 }).toBe(true);
    lot = (await get(request, '/api/home', a.token)).data.lots.find((l) => l.owner === null).id; expect((await post(request, '/api/home/apply', a.token, { lot, roof: 'blue' })).status).toBe(200);
    for (let n = 0; n < 2; n += 1) { await post(request, '/api/home/upgrade', a.token, {}); await post(request, '/api/test/home/next-day', a.token, {}); } // (the 큰 집: room for both)
    await expect.poll(async () => { if (await page.evaluate(() => window.PlazaDebug().space) === 'island') return true; await spaceOn(page, 'room:exit', isMobile); await page.waitForTimeout(800); return page.evaluate(() => window.PlazaDebug().space === 'island'); }, { timeout: 40000 }).toBe(true);
    const [big, pillar] = (await post(request, '/api/test/home/furniture', a.token, { ids: ['aquarium_big__oak', 'aquarium_pillar__white'] })).data.pieces;
    await post(request, '/api/test/island/give', a.token, { itemId: 'fish_giant_tuna', qty: 3 }); await post(request, '/api/test/island/give', a.token, { itemId: 'fish_goby', qty: 3 });
    await expect.poll(async () => { if (await page.evaluate(() => window.PlazaDebug().space) === 'home') return true; await page.evaluate((id) => { const d = window.PlazaDebug(); const w = d.doors[`home:${id}`]; d.teleport(w.x, w.z); }, lot); await page.waitForTimeout(600); await press(); await page.waitForTimeout(800); return page.evaluate(() => window.PlazaDebug().space === 'home'); }, { timeout: 40000 }).toBe(true);
    for (const [uid, x] of [[big.uid, -2], [pillar.uid, 1.0]]) { const r = await post(request, '/api/home/place', a.token, { uid, x, z: 0, rot: 0 }); expect(r.status, JSON.stringify(r.data)).toBe(200); }
    const tank = (uid, put, k) => post(request, '/api/home/tank', a.token, { tank: uid, put, requestId: `tuna-${uid.slice(0, 8)}-${k}` });
    expect((await tank(big.uid, 'fish_giant_tuna', 1)).status).toBe(200); expect((await tank(big.uid, 'fish_goby', 2)).status).toBe(200); expect((await tank(big.uid, 'fish_goby', 3)).status).toBe(200);
    expect((await tank(big.uid, 'fish_goby', 4)).data.message).toContain('참치는 자리를 많이 차지해서');
    expect((await tank(pillar.uid, 'fish_giant_tuna', 5)).status).toBe(200); expect((await tank(pillar.uid, 'fish_giant_tuna', 6)).data.message).toContain('참치는 자리를 많이 차지해서');
    // in again: the room drawn as it is now -- the tanks' fish
    await expect.poll(async () => { if (await page.evaluate(() => window.PlazaDebug().space) === 'island') return true; await page.evaluate(() => { const d = window.PlazaDebug(); const w = d.doors['home:exit']; d.teleport(w.x, w.z); }); await page.waitForTimeout(600); await press(); await page.waitForTimeout(800); return page.evaluate(() => window.PlazaDebug().space === 'island'); }, { timeout: 40000 }).toBe(true);
    await expect.poll(async () => { if (await page.evaluate(() => window.PlazaDebug().space) === 'home') return true; await page.evaluate((id) => { const d = window.PlazaDebug(); const w = d.doors[`home:${id}`]; d.teleport(w.x, w.z); }, lot); await page.waitForTimeout(600); await press(); await page.waitForTimeout(800); return page.evaluate(() => window.PlazaDebug().space === 'home'); }, { timeout: 40000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().home()?.fish), { timeout: 15000 }).toBe(4);
    for (const [name, x, back] of [['tuna-big', -2, 3.2], ['tuna-pillar', 1.0, 2.6]]) { // (each tank from before it, the whole glass in sight -- the pillar clear of the inner wall)
      await page.evaluate(([x, back]) => { const H = window.IslandHome; const d = window.PlazaDebug(); const lot = H.lotById(d.home().lot); const w = H.world(lot, x, -back); const to = H.world(lot, x, 0); d.teleport(w.x, w.z); d.faceTo(to.x, to.z); }, [x, back]);
      await shot(page, name, 4000);
    }
  } finally { if (lot) await post(request, '/api/test/home/release', a.token, {}).catch(() => {}); }
  await expectNoScriptError(page); await a.context.close();
});

test('전적관 창: 섬에서는 전적 카드·랭킹·다른 플레이어 조회가 섬 종이, 로비는 그대로', async ({ browser, request, isMobile }) => {
  test.setTimeout(240000);
  const a = await shopper(browser, request, isMobile ? '전적m' : '전적p', 0, 'female'); const { page } = a; await prep(a);
  const shot = shotOf(test);
  await expect.poll(async () => { if (await page.locator('#plazaDialog #myRecordsCard').isVisible()) return true; await spaceOn(page, 'records', isMobile).catch(() => {}); await page.evaluate(() => window.PlazaDebug().place('records')); await page.waitForTimeout(800); await spaceOn(page, 'records', isMobile).catch(() => {}); return page.locator('#plazaDialog #myRecordsCard').isVisible(); }, { timeout: 40000 }).toBe(true);
  const card = page.locator('#plazaDialog #myRecordsCard');
  expect(await card.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 246, 227)'); // (--isle-paper)
  expect(await page.locator('#plazaDialog .storyShelf button').first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 250, 240)');
  await shot(page, 'records-island');
  await card.locator('#rankingBtn').click(); await expect(page.locator('#rankingDialog')).toBeVisible();
  const weeks = page.locator('#rankingDialog .rankingWeeks button'); // (the chosen one the island's brown, the other paper)
  expect(await weeks.nth(0).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(156, 95, 20)'); expect(await weeks.nth(1).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 250, 240)');
  expect(await page.locator('#rankingGame').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 253, 246)');
  await shot(page, 'records-ranking'); await page.locator('#rankingCloseBtn').click();
  await card.locator('#otherRecordsBtn').click(); await expect(page.locator('#recordsDialog')).toBeVisible();
  expect(await page.locator('#recordsDialog').evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgb(17, 24, 39)'); // (the lobby's dark)
  await shot(page, 'records-lookup'); await page.locator('#recordsCloseBtn').click();
  if (process.env.SHOT_DIR) { // the board's week note (a week held for it)
    await request.post('/api/test/new-week', { data: { week: 0 } });
    try {
      await page.locator('#plazaCloseBtn').click();
      await expect.poll(async () => { if (await page.locator('#plazaDialog #announcementsCard').isVisible()) return true; await page.evaluate(() => window.PlazaDebug().place('board')); await page.waitForTimeout(800); await spaceOn(page, 'board', isMobile).catch(() => {}); return page.locator('#plazaDialog #announcementsCard').isVisible(); }, { timeout: 40000 }).toBe(true);
      const note = page.locator('#plazaDialog #announcementsCard').getByText('[이번 주 신상]').first(); await expect(note).toBeVisible({ timeout: 15000 }); await page.locator('#plazaDialog #announcementsCard .announcementDetails summary').first().click();
      await shot(page, 'board-weekly');
    } finally { await request.post('/api/test/new-week', { data: { week: null } }).catch(() => {}); }
  }
  // the lobby keeps its own card
  await page.evaluate(() => localStorage.setItem('gc.testClassic', '1')); await page.reload();
  const lobbyCard = page.locator('#lobbyHighlights #myRecordsCard'); await expect(lobbyCard).toBeVisible({ timeout: 60000 });
  expect(await lobbyCard.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgb(255, 246, 227)');
  await shot(page, 'records-lobby');
  await expectNoScriptError(page); await a.context.close();
});
