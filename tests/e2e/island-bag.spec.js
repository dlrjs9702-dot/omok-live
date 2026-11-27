const { test, expect } = require('@playwright/test');
const { shopper, post, get, intoMall, spaceOn, expectNoScriptError } = require('./skin-support');

// v1.10.195 가방 개편 (gamecenter-notes docs/bag-redesign-20261027.md): a cloud pouch of round slots (8 a row, a phone 4), a
// thing picked shows its name under it and its actions in a small bubble; my own order -- dragged (PC), held then tapped
// (a phone), Shift+arrows -- kept on the server; 정리; the bag again or a click outside shuts it. PC and phone.
// 1.10.430 인벤토리 2차 (notes docs/bag-tabs-20261117.md 결정 1A 2A 3A, 결정 88): each kind its own room -- eight tabs and no 「전체」, each
// 「n/room」 with its empty places, a full one marked; it opens on the tab seen last; the fish and insect boxes are their tabs now (놓아주기
// in the bubble); a kind's container bought at the 잡화점's keeper or, on the 백화점 1층, from the line under its tab
test('가방 개편: 동그라미 칸·이름 줄·말풍선 메뉴, 내 순서(끌기·꾹·Shift+방향키), 정리, 종류별 탭 · 잡화점에서 물고기 통', async ({ browser, request, isMobile }) => {
  test.setTimeout(300000);
  const who = await shopper(browser, request, isMobile ? '주머니m' : '주머니', 200000, 'female'); const { page, token } = who;
  const TOOLS = ['bugnet', 'fishing_rod', 'pickaxe', 'bugnet_sturdy'];
  for (const itemId of ['bread', 'weed', ...TOOLS, 'fish_goby']) expect((await post(request, '/api/test/island/give', token, { itemId, qty: 1 })).data.applied).toBe(true);
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.removeItem('gc.bagTab'); localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); });
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  // (open, the pouch is a modal: the bag button behind its backdrop -- pressed where it is, the backdrop takes it and shuts it)
  const tab = async () => { const b = await page.locator('#islandBagTab').boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
  const order = async () => (await get(request, '/api/island/bag', token)).data.items.map((e) => e.itemId);
  const open = (k) => page.locator(`.bagTab[data-tab="${k}"]`).click();
  await tab(); const bag = page.locator('#islandBagDialog'); await expect(bag).toBeVisible();
  // the first time: the first tab, 물고기 -- the goby and nine empty places, 「1/10」, where its room grows
  const tabs = page.locator('#islandBagTabs .bagTab'); await expect(tabs).toHaveCount(8); await expect(page.locator('.bagTab.on')).toHaveAttribute('data-tab', 'fish');
  await expect(page.locator('.bagTab[data-tab="all"]')).toHaveCount(0);
  await expect(page.locator('.islandBagSlot')).toHaveCount(10); await expect(page.locator('.islandBagSlot.empty')).toHaveCount(9); await expect(page.locator('#islandBagCount')).toHaveText('1/10');
  await expect(page.locator('#islandBagGrow')).toHaveText('물고기 통(으)로 늘리기: 백화점 1층 잡화점 · 50칸 300,000P');
  // the pouch: 8 (4) a row, round
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('islandBagGrid')).gridTemplateColumns.split(' ').length)).toBe(isMobile ? 4 : 8);
  expect(await page.locator('.islandBagSlot').first().evaluate((e) => getComputedStyle(e).borderRadius)).toBe('50%');
  await expect(page.locator('.islandBagSlot span')).toHaveCount(0); // (the picture and count only)
  await expect(page.locator('.bagTab[data-tab="fish"] i')).toHaveText('1/10'); await expect(page.locator('.bagTab[data-tab="tool"] i')).toHaveText('4/8'); await expect(page.locator('.bagTab[data-tab="material"]')).toHaveClass(/none/);
  await expect(page.locator('.bagTab[data-tab="material"]')).toHaveText('광석·재료0/10');
  /* (1.10.431, 총괄 · 사용자 「pc에서 봤어」: a touch-capable PC said coarse and its row was cut after 광석·재료 with no way on -- the tabs wrap on
     every screen: nothing wider than the row, the last tab inside the window; a mouse and a touch pointer alike) */
  const tabsFit = () => page.evaluate(() => { const r = document.getElementById('islandBagTabs'); const s = getComputedStyle(r); const d = document.getElementById('islandBagDialog').getBoundingClientRect(); const last = r.lastElementChild.getBoundingClientRect();
    return { wrap: s.flexWrap, over: r.scrollWidth - r.clientWidth, lastIn: last.right <= d.right + 1 && last.left >= d.left - 1 && last.width > 0, outside: [...r.children].filter((b) => { const x = b.getBoundingClientRect(); return x.right > d.right + 1 || x.left < d.left - 1; }).length }; });
  expect(await tabsFit()).toEqual({ wrap: 'wrap', over: 0, lastIn: true, outside: 0 });
  if (!isMobile) { /* (the PC as a touch screen says it: a coarse pointer) */
    const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); /* (its media then (pointer:coarse), the window still 1280 wide) */
    expect(await page.evaluate(() => [matchMedia('(pointer:coarse)').matches, matchMedia('(any-pointer:fine)').matches])).toEqual([true, false]); expect(await tabsFit()).toEqual({ wrap: 'wrap', over: 0, lastIn: true, outside: 0 });
    expect(await page.evaluate(() => { const g = document.querySelector('.recordTowerGames'); return g ? getComputedStyle(g).flexWrap : 'wrap'; })).toBe('wrap'); /* (the tower's chips: a wide window wraps them too) */
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false }); await cdp.detach();
  }
  await page.locator('.islandBagSlot[data-item="fish_goby"]').click(); await expect(page.locator('#islandBagInfo .bagDetailKind')).toHaveText('물고기'); await expect(page.locator('#islandBagInfo .bagDetailWords')).not.toBeEmpty();
  await expect(page.locator('.islandBagSlot[data-item="fish_goby"] .bagMenu [role="menuitem"]')).toContainText(['놓아주기']);
  // picked: its name below; bread does nothing; the net -- a bubble with 들기
  await open('etc'); await expect(page.locator('.islandBagSlot:not(.empty)')).toHaveCount(1); await page.locator('.islandBagSlot[data-item="bread"]').click(); await expect(page.locator('#islandBagInfo')).toContainText('빵'); await expect(page.locator('.islandBagSlot[data-item="bread"] .bagMenu [role="menuitem"]')).toHaveText(['버리기']); /* (1.10.432: only 버리기) */
  await expect(page.locator('#islandBagGrow')).toHaveText('10칸 · 팔거나 쓰면 자리가 나요.');
  await open('tool'); await expect(page.locator('#islandBagCount')).toHaveText('4/8');
  await page.locator('.islandBagSlot[data-item="bugnet"]').click(); await expect(page.locator('.islandBagSlot[data-item="bugnet"] .bagMenu [role="menuitem"]')).toHaveText(['들기', '빠른 칸에', '버리기']); // (v1.10.236 빠른 칸 -- 1.10.432 버리기 last)
  // kept when the bag opens again; 가구: the list of pieces not put down
  await tab(); await expect(bag).toBeHidden(); await tab(); await expect(bag).toBeVisible(); await expect(page.locator('.bagTab.on')).toHaveAttribute('data-tab', 'tool');
  await open('furniture'); await expect(page.locator('#islandFurnList')).toBeVisible(); await expect(page.locator('#islandBagGrid')).toBeHidden(); await expect(page.locator('#islandFurnList')).toContainText('아직 놓지 않은 가구가 없어요');
  if (process.env.ZZ_SHOT) { await open('fish'); await page.locator('.islandBagSlot[data-item="fish_goby"]').click(); await page.waitForTimeout(400); await page.screenshot({ path: `${process.env.ZZ_SHOT}-bag-tabs-${isMobile ? 'phone' : 'pc'}.png` }); }
  /* (1.10.431 자동 정리, 사용자 결정 91: on the first time -- the tab shows its things sorted (rod, net, the sturdy net, pickaxe: sub-kind, then
     name), nothing moved by hand and the kept order untouched; the switch off: my own order back, moved by hand as before) */
  await open('tool'); await expect(page.locator('.islandBagSlot:not(.empty)')).toHaveCount(4);
  const sortBtn = page.locator('#islandBagSort'); const shownIds = () => page.locator('.islandBagSlot:not(.empty)').evaluateAll((els) => els.map((e) => e.dataset.item));
  await expect(sortBtn).toHaveText('자동 정리 켬'); await expect(sortBtn).toHaveAttribute('aria-pressed', 'true');
  expect(await shownIds()).toEqual(['fishing_rod', 'bugnet', 'bugnet_sturdy', 'pickaxe']);
  { const kept = await order(); await page.locator('.islandBagSlot').first().focus(); await page.keyboard.press('Shift+KeyD'); await page.waitForTimeout(600); expect(await order()).toEqual(kept); expect(await shownIds()).toEqual(['fishing_rod', 'bugnet', 'bugnet_sturdy', 'pickaxe']); }
  await sortBtn.click(); await expect(sortBtn).toHaveText('자동 정리 끔'); await expect(sortBtn).toHaveAttribute('aria-pressed', 'false');
  expect(await shownIds()).toEqual(TOOLS); /* (the order they were given in -- the bag's own) */
  // my order inside a tab (the tools): Shift+D (keys, 문제 기록 1103 10: W/A/S/D as the arrows) -- the first one a place on
  const toolsAt = (list) => list.map((id, i) => (TOOLS.includes(id) ? i : -1)).filter((i) => i >= 0);
  const swapped = (list, a, b) => { const l = list.slice(); [l[a], l[b]] = [l[b], l[a]]; return l; };
  { const first = await order(); const t = toolsAt(first); await page.locator('.islandBagSlot').first().focus(); await page.keyboard.press('Shift+KeyD'); await expect.poll(order).toEqual(swapped(first, t[0], t[1])); }
  { // dragged onto another (PC) -- or held 0.4 s, then another tapped (a phone): they swap
    const now = await order(); const t = toolsAt(now);
    if (!isMobile) await page.locator('.islandBagSlot').nth(0).dragTo(page.locator('.islandBagSlot').nth(3));
    else {
      await page.waitForTimeout(800); // (the last move's answer drawn first)
      await page.locator('.islandBagSlot').nth(0).dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true });
      await page.waitForTimeout(600); await expect(page.locator('.islandBagSlot.held')).toHaveCount(1);
      await page.locator('.islandBagSlot').nth(0).dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true });
      await page.locator('.islandBagSlot').nth(0).dispatchEvent('click'); // (C5 Codex 4차 P2-2: the finger lifted -- its own click; still held)
      await expect(page.locator('.islandBagSlot.held')).toHaveCount(1);
      await page.locator('.islandBagSlot').nth(3).click();
    }
    await expect.poll(order).toEqual(swapped(now, t[0], t[3]));
  }
  if (isMobile) { // (Codex 검토 5차 P3-1) one held by a finger as 자동 정리 comes on: let go -- its slot names another thing after
    await page.waitForTimeout(800); await page.locator('.islandBagSlot').nth(0).dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true });
    await expect(page.locator('.islandBagSlot.held')).toHaveCount(1, { timeout: 10000 }); /* (v1.10.240 3b: the 0.4 s hold reached before the finger lifts -- a slow runner's timer came after a fixed 0.6 s) */ await page.locator('.islandBagSlot').nth(0).dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true });
    await expect(page.locator('.islandBagSlot.held')).toHaveCount(1);
  }
  // 자동 정리 on again: sorted in the tab, my kept order not rewritten; kept on the server (a reload still on); a thing coming in takes its place
  const mine = await order(); await sortBtn.click(); await expect(sortBtn).toHaveText('자동 정리 켬');
  expect(await shownIds()).toEqual(['fishing_rod', 'bugnet', 'bugnet_sturdy', 'pickaxe']); expect(await order()).toEqual(mine);
  if (isMobile) { await expect(page.locator('.islandBagSlot.held')).toHaveCount(0); await page.locator('.islandBagSlot').nth(3).click(); await page.waitForTimeout(800); expect(await order()).toEqual(mine); } // (a tap after: nothing moved)
  expect((await get(request, '/api/island/bag', token)).data.autoSort).toBe(true);
  expect((await post(request, '/api/test/island/give', token, { itemId: 'fishing_rod_sturdy', qty: 1 })).data.applied).toBe(true);
  await tab(); await expect(bag).toBeHidden(); await tab(); await open('tool'); await expect.poll(shownIds).toEqual(['fishing_rod', 'fishing_rod_sturdy', 'bugnet', 'bugnet_sturdy', 'pickaxe']);
  // the bag again: shut; a click outside: shut
  await tab(); await expect(bag).toBeHidden();
  await tab(); await expect(bag).toBeVisible(); await page.mouse.click(5, 5); await expect(bag).toBeHidden();
  if (process.env.ZZ_SHOT) { await tab(); await page.locator('.islandBagSlot[data-item="bugnet"]').click(); await page.waitForTimeout(500); await page.screenshot({ path: `${process.env.ZZ_SHOT}-bag-${isMobile ? 'phone' : 'pc'}.png` }); await tab(); }
  // 물고기 통 at the 잡화점's keeper (362: 50 → 100 → 200; 430: 채집 바구니 · 재료 상자 beside it, the old 「가방 늘리기」 gone -- 결정 88 5A)
  await post(request, '/api/test/points-credit', token, { amount: 1500000 });
  await intoMall(page, null, isMobile);
  const buy = page.locator('#boxGrowBtn-fish');
  await expect.poll(async () => { if (await buy.isVisible()) return true; await page.evaluate(() => { const S = window.IslandStore; const s = S.SECTORS?.find((x) => x.id === 'store') || null; const d = window.PlazaDebug(); const k = d.doors['mall:store']; if (k) d.teleport(k.x, k.z); else if (s) { const w = S.world(...s.interact); d.teleport(w.x, w.z); } }); await page.waitForTimeout(400); await spaceOn(page, 'mall:store', isMobile); await page.waitForTimeout(800); return buy.isVisible(); }, { timeout: 30000, intervals: [500] }).toBe(true);
  await expect(page.locator('#oreShopBtn')).toBeVisible(); /* (362 광석 값: the keeper sells the ores too -- its list in the next window) */
  await expect(page.locator('#bagGrowBtn')).toBeHidden(); await expect(page.locator('#boxGrowBtn-gather')).toHaveText('채집 바구니 사기 · 50칸 300,000P'); await expect(page.locator('#boxGrowBtn-material')).toHaveText('재료 상자 사기 · 50칸 300,000P');
  await expect(buy).toHaveText('물고기 통 사기 · 50칸 300,000P'); await buy.click();
  await expect.poll(async () => (await get(request, '/api/island/bag', token)).data.sections.fish.slots).toBe(50);
  expect((await post(request, '/api/test/island/give', token, { itemId: 'fish_mackerel', qty: 1 })).data.applied).toBe(true);
  // the fish tab: both fish, its room 50; on the 백화점 1층 the line under it is the next step's button; 놓아주기 from the bubble
  await tab(); await open('fish'); await expect(page.locator('#islandBagCount')).toHaveText('2/50'); await expect(page.locator('.islandBagSlot')).toHaveCount(50);
  await expect(page.locator('#islandFishBoxBtn')).toBeHidden(); /* (the old box page) */
  await expect(page.locator('.islandBagSlot[data-item="fish_goby"] small')).toHaveText(/^\d+(\.\d+)?cm$/); /* (362 사용자 3A: a fish one a slot, its size) */
  const here = page.locator('#bagGrowHereBtn'); await expect(here).toHaveText('물고기 통 100칸 · 800,000P');
  if (process.env.ZZ_SHOT) await page.screenshot({ path: `${process.env.ZZ_SHOT}-bag-grow-${isMobile ? 'phone' : 'pc'}.png` });
  await here.click(); await expect(page.locator('#islandBagCount')).toHaveText('2/100'); await expect(page.locator('#bagGrowHereBtn')).toHaveText('물고기 통 200칸 · 2,000,000P');
  await page.locator('.islandBagSlot[data-item="fish_mackerel"]').click(); await page.locator('.islandBagSlot[data-item="fish_mackerel"] .bagMenu [role="menuitem"]', { hasText: '놓아주기' }).click();
  await expect(page.locator('#discardDialog')).toBeVisible(); await expect(page.locator('#discardTitle')).toHaveText('놓아주기'); await page.locator('#discardOk').click(); await expect(page.locator('#discardDialog')).toBeHidden();
  await expect(page.locator('#islandBagCount')).toHaveText('1/100'); await expect(page.locator('.islandBagSlot[data-item="fish_mackerel"]')).toHaveCount(0);
  await expect(page.locator('#islandBagInfo .discardUndo')).toContainText(/놓아줬어요 · \d+초/);
  /* 1.10.433 Codex P1-3: insect stack release asks qty (never wipes whole 20-stack in one click) and supports 10 s 되돌리기 */
  expect((await post(request, '/api/test/island/give', token, { itemId: 'insect_ladybird', qty: 10 })).data.applied).toBe(true);
  await tab(); await expect(bag).toBeHidden(); await tab(); await open('insect');
  await page.locator('.islandBagSlot[data-item="insect_ladybird"]').click(); await page.locator('.islandBagSlot[data-item="insect_ladybird"] .bagMenu [role="menuitem"]', { hasText: '놓아주기' }).click();
  await expect(page.locator('#discardDialog')).toBeVisible(); await expect(page.locator('#discardQty')).toBeVisible();
  await page.locator('#discardCount').fill('3'); await page.locator('#discardOk').click(); await expect(page.locator('#discardDialog')).toBeHidden();
  await expect.poll(async () => (await get(request, '/api/island/bag', token)).data.items.filter((e) => e.itemId === 'insect_ladybird').reduce((n, e) => n + e.qty, 0)).toBe(7);
  await page.locator('#discardUndoBtn').click();
  await expect.poll(async () => (await get(request, '/api/island/bag', token)).data.items.filter((e) => e.itemId === 'insect_ladybird').reduce((n, e) => n + e.qty, 0)).toBe(10);
  /* 1.10.432 가방 버리기 (사용자 결정 92 전부 A): 버리기 last in the bubble; a stack asks how many (1개 · 전부 · a number), gone for good; a line
     「…버렸어요 · n초」 with 되돌리기 for 10 s (once: the server judges it); a lost thing greyed with why; a tool in hand and in a 빠른 칸 --
     out of both when none of it is left */
  for (const [itemId, qty] of [['herb', 7], ['lost', 1]]) expect((await post(request, '/api/test/island/give', token, { itemId, qty })).data.applied).toBe(true);
  const have = async (id) => (await get(request, '/api/island/bag', token)).data.items.filter((e) => e.itemId === id).reduce((n, e) => n + e.qty, 0);
  const menuOf = (id) => page.locator(`.islandBagSlot[data-item="${id}"] .bagMenu [role="menuitem"]`); const dlg = page.locator('#discardDialog');
  await tab(); await expect(bag).toBeHidden(); await tab(); await open('gather');
  await page.locator('.islandBagSlot[data-item="herb"]').click(); await menuOf('herb').filter({ hasText: '버리기' }).click();
  await expect(dlg).toBeVisible(); await expect(page.locator('#discardText')).toContainText('7개'); await expect(page.locator('#discardQty')).toBeVisible();
  await page.locator('#discardQty [data-n="all"]').click(); await expect(page.locator('#discardCount')).toHaveValue('7');
  await page.locator('#discardQty [data-n="1"]').click(); await expect(page.locator('#discardCount')).toHaveValue('1');
  await page.locator('#discardCount').fill('3'); await page.locator('#discardOk').click(); await expect(dlg).toBeHidden();
  await expect.poll(() => have('herb')).toBe(4); await expect(page.locator('#islandBagInfo .discardUndo')).toContainText(/버렸어요 · \d+초/);
  if (process.env.ZZ_SHOT) await page.screenshot({ path: `${process.env.ZZ_SHOT}-bag-discard-undo-${isMobile ? 'phone' : 'pc'}.png` });
  await page.locator('#discardUndoBtn').click(); await expect.poll(() => have('herb')).toBe(7); await expect(page.locator('#islandBagInfo .discardUndo')).toHaveCount(0);
  expect((await post(request, '/api/island/bag/discard/undo', token, { undo: 'not-a-token' })).status).toBe(409);
  await open('etc'); await page.locator('.islandBagSlot[data-item="lost"]').click();
  await expect(menuOf('lost').filter({ hasText: '버리기' })).toBeDisabled(); await expect(page.locator('.islandBagSlot[data-item="lost"] .bagMenuWhy')).toHaveText('분실물은 주인이나 관공서에 가져다줘요.');
  { const b = (await get(request, '/api/island/bag', token)).data; const lost = b.items.find((e) => e.itemId === 'lost'); /* (the server too) */
    const r = await post(request, '/api/island/bag/discard', token, { requestId: 'e2e-lost-0001', entryId: lost.entryId, qty: 1 }); expect([r.status, r.data.error]).toEqual([409, 'KEEP']); }
  // the pickaxe in hand and in the first 빠른 칸: 버리기 (one -- no count asked) takes it out of both
  expect((await post(request, '/api/island/quick', token, { slots: ['pickaxe', null, null, null, null] })).status).toBe(200);
  await open('tool'); await page.locator('.islandBagSlot[data-item="pickaxe"]').click(); await menuOf('pickaxe').filter({ hasText: '들기' }).click(); await expect(bag).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().heldTool())).toBe('pickaxe');
  await tab(); await open('tool'); await page.locator('.islandBagSlot[data-item="pickaxe"]').click(); await menuOf('pickaxe').filter({ hasText: '버리기' }).click();
  await expect(page.locator('#discardQty')).toBeHidden(); await page.locator('#discardOk').click(); await expect(dlg).toBeHidden();
  await expect.poll(() => have('pickaxe')).toBe(0); await expect(page.locator('.islandBagSlot[data-item="pickaxe"]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().heldTool())).toBeNull();
  expect((await get(request, '/api/island/quick', token)).data.slots[0]).toBeNull();
  await expectNoScriptError(page);
  await who.context.close();
});
