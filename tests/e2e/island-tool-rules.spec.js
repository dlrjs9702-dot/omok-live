const { test, expect } = require('@playwright/test');
const { shopper, post, get, holdTool, expectNoScriptError } = require('./skin-support');
const T = require('../../public/plaza/island-terrain.js');

// 206 Q2 5 (gamecenter-notes docs/interact-quests-20261029.md 5, 사용자 「낚시대만 있으면 물가에서 바로 낚시를 시작할 수 있는데
// 낚시대를 장착해야 할 수 있게. 장착한 동안은 다른 상호작용(잡초채집, 열매채집 등)이 안되게」): by the water without the rod in
// hand, how; in hand, a cast. A tool in hand: a weed or a fruit not picked (how), put away: picked. In hand an islander and a
// door still are. PC and phone.
test('도구 들기 규칙: 낚싯대를 들어야 낚시, 든 동안 잡초·열매는 안 주움, 주민·문은 됨', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.CI ? 300000 : 180000);
  const who = await shopper(browser, request, isMobile ? '도구규칙m' : '도구규칙', 0, 'female'); const { page, token } = who;
  expect((await post(request, '/api/test/island/give', token, { itemId: 'fishing_rod', qty: 1 })).status).toBe(200);
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); });
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const hint = page.locator('#plazaHint');
  const stow = async () => { await page.keyboard.press('KeyI'); await page.locator('.islandBagSlot.inHand').click(); await page.locator('#islandBagGrid button', { hasText: '넣기' }).first().click(); await expect.poll(() => page.evaluate(() => window.PlazaDebug().heldTool())).toBe(null); };
  // by the water: not in hand -- how; in hand -- a cast
  const pier = { x: T.PIER.x + T.PIER.ux * 7, z: T.PIER.z + T.PIER.uz * 7 };
  await page.evaluate((p) => window.PlazaWarp(p.x, p.z), pier); await expect.poll(() => page.evaluate(() => window.PlazaDebug().canFish())).toBe(true);
  await expect(hint).toHaveText('가방에서 낚싯대를 들면 낚시할 수 있어요', { timeout: 10000 });
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.PlazaDebug().fishing())).toBe(null);
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-rod-hint.png` });
  await holdTool(page, 'fishing_rod'); await expect(hint).toHaveText(/낚시$/, { timeout: 10000 });
  if (isMobile) await hint.click(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); }
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().fishing()?.phase), { timeout: 10000 }).toMatch(/cast|wait/);
  if (isMobile) await hint.click(); else await page.keyboard.press('Space'); // (stopped before a bite)
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().fishing()), { timeout: 10000 }).toBe(null);
  // a weed with the rod in hand: not pulled -- how; put away: pulled as before
  const weeds = (await get(request, '/api/island/weeds', token)).data.weeds || [];
  const free = weeds.map(([, x, z]) => ({ x, z })).find((w) => T.walkable(w.x + 0.6, w.z) && T.walkDist(w.x, w.z) > 1.5) || { x: weeds[0][1], z: weeds[0][2] };
  await page.evaluate((w) => window.PlazaWarp(w.x + 0.6, w.z), free);
  await expect(hint).toHaveText('도구를 넣으면 주울 수 있어요', { timeout: 10000 });
  expect(await page.evaluate(() => new Promise((ok) => { const h = document.getElementById('plazaHint'); let off = 0; let n = 0; const t = setInterval(() => { if (h.classList.contains('hidden') || !h.textContent.includes('도구를 넣으면')) off += 1; if (++n >= 30) { clearInterval(t); ok(off); } }, 25); }))).toBe(0); // (206 총괄 검토: it stays up -- it flickered off every other frame)
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-stow-hint.png` });
  const berry = ((await get(request, '/api/test/island/events', token)).data.events || []).find((e) => e.type === 'berry' && e.state === 'open'); // (a fruit tree: the same)
  if (berry) { await page.evaluate((p) => window.PlazaWarp(p.x, p.z), berry); await expect(hint).toHaveText('도구를 넣으면 주울 수 있어요', { timeout: 10000 }); await page.evaluate((w) => window.PlazaWarp(w.x + 0.6, w.z), free); }
  await stow(); await expect(hint).toHaveText(/잡초/, { timeout: 10000 });
  // in hand by an islander and at a door: still a talk, still the door
  await holdTool(page, 'fishing_rod');
  await post(request, '/api/test/island/free-residents', token, {});
  await expect.poll(async () => { await page.evaluate(async () => { const w = window.PlazaDebug().wanderers[0]; if (w) await window.PlazaWarp(w.x + 1.1, w.z); }); await page.waitForTimeout(400); return hint.textContent(); }, { timeout: 30000 }).toMatch(/말 걸기/);
  const th = await page.evaluate(() => window.PlazaDebug().doors.townhall); await page.evaluate((d) => window.PlazaWarp(d.x, d.z), th);
  await expect(hint).toContainText('관공서', { timeout: 10000 });
  await expectNoScriptError(page); await who.context.close();
});
