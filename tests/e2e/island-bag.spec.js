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
  { const [ox, wrap, fine] = await page.evaluate(() => { const s = getComputedStyle(document.getElementById('islandBagTabs')); return [s.overflowX, s.flexWrap, matchMedia('(pointer:fine)').matches]; }); expect([ox, wrap]).toEqual(fine ? ['visible', 'wrap'] : ['auto', 'nowrap']); } /* (1.10.426 U8 #3: a mouse's row wraps -- a touch screen's slides) */
  { const over = await page.evaluate(() => { const r = document.getElementById('islandBagTabs'); const d = document.getElementById('islandBagDialog').getBoundingClientRect(); return [...r.children].filter((b) => { const x = b.getBoundingClientRect(); return x.right > d.right + 1 || x.left < d.left - 1; }).length; }); if (!isMobile) expect(over).toBe(0); } /* (notes bag-tabs 끝: every tab seen on a PC) */
  await page.locator('.islandBagSlot[data-item="fish_goby"]').click(); await expect(page.locator('#islandBagInfo .bagDetailKind')).toHaveText('물고기'); await expect(page.locator('#islandBagInfo .bagDetailWords')).not.toBeEmpty();
  await expect(page.locator('.islandBagSlot[data-item="fish_goby"] .bagMenu [role="menuitem"]')).toContainText(['놓아주기']);
  // picked: its name below; bread does nothing; the net -- a bubble with 들기
  await open('etc'); await expect(page.locator('.islandBagSlot:not(.empty)')).toHaveCount(1); await page.locator('.islandBagSlot[data-item="bread"]').click(); await expect(page.locator('#islandBagInfo')).toContainText('빵'); await expect(page.locator('.bagMenu')).toHaveCount(0);
  await expect(page.locator('#islandBagGrow')).toHaveText('10칸 · 팔거나 쓰면 자리가 나요.');
  await open('tool'); await expect(page.locator('#islandBagCount')).toHaveText('4/8');
  await page.locator('.islandBagSlot[data-item="bugnet"]').click(); await expect(page.locator('.islandBagSlot[data-item="bugnet"] .bagMenu [role="menuitem"]')).toHaveText(['들기', '빠른 칸에']); // (v1.10.236 빠른 칸)
  // kept when the bag opens again; 가구: the list of pieces not put down
  await tab(); await expect(bag).toBeHidden(); await tab(); await expect(bag).toBeVisible(); await expect(page.locator('.bagTab.on')).toHaveAttribute('data-tab', 'tool');
  await open('furniture'); await expect(page.locator('#islandFurnList')).toBeVisible(); await expect(page.locator('#islandBagGrid')).toBeHidden(); await expect(page.locator('#islandFurnList')).toContainText('아직 놓지 않은 가구가 없어요');
  if (process.env.ZZ_SHOT) { await open('fish'); await page.locator('.islandBagSlot[data-item="fish_goby"]').click(); await page.waitForTimeout(400); await page.screenshot({ path: `${process.env.ZZ_SHOT}-bag-tabs-${isMobile ? 'phone' : 'pc'}.png` }); }
  // my order inside a tab (the tools): Shift+D (keys, 문제 기록 1103 10: W/A/S/D as the arrows) -- the first one a place on
  await open('tool'); await expect(page.locator('.islandBagSlot:not(.empty)')).toHaveCount(4);
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
  if (isMobile) { // (Codex 검토 5차 P3-1) one held by a finger as 정리 comes: let go -- its slot names another thing after
    await page.waitForTimeout(800); await page.locator('.islandBagSlot').nth(0).dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true });
    await expect(page.locator('.islandBagSlot.held')).toHaveCount(1, { timeout: 10000 }); /* (v1.10.240 3b: the 0.4 s hold reached before the finger lifts -- a slow runner's timer came after a fixed 0.6 s) */ await page.locator('.islandBagSlot').nth(0).dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true });
    await expect(page.locator('.islandBagSlot.held')).toHaveCount(1);
  }
  // 정리: asked once, then by kind -- the tools, the fish, 채집물, the rest
  const kinds = (list) => list.map((id) => (TOOLS.includes(id) ? 'tool' : id));
  await page.locator('#islandBagSort').click(); await expect(page.locator('#islandBagSort')).toHaveText('순서를 바꿀까요?');
  await page.locator('#islandBagSort').click(); await expect.poll(async () => kinds(await order())).toEqual(['tool', 'tool', 'tool', 'tool', 'fish_goby', 'weed', 'bread']);
  if (isMobile) { await expect(page.locator('.islandBagSlot.held')).toHaveCount(0); const before = await order(); await page.locator('.islandBagSlot').nth(3).click(); await page.waitForTimeout(800); expect(await order()).toEqual(before); } // (a tap after: nothing moved)
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
  await expect(page.locator('#islandBagCount')).toHaveText('1/100'); await expect(page.locator('.islandBagSlot[data-item="fish_mackerel"]')).toHaveCount(0);
  await expectNoScriptError(page);
  await who.context.close();
});
