const { test, expect } = require('@playwright/test');
const { shopper, post, get, expectNoScriptError, spaceOn, holdTool } = require('./skin-support');

// 1.10.355 캐기 미니게임 다듬기 (gamecenter-notes docs/island-expansion-20261115.md 「캐기 미니게임 다듬기」), the phone's part -- the
// quarry's PC flow is plaza.spec's (PC only): on a phone the big 「⛏ 캐기」 presses the crack that is lit, the three pips over the
// rock, the other prompts away while it runs; two hits and the ore at once (the server's own timed hits), the stick back after
test('채석장 폰: 큰 「캐기」 단추로 빛나는 금을 눌러 두 번 맞히면 바로 광석, 바위 위 세 칸', async ({ browser, request, isMobile }) => {
  test.skip(!isMobile, '폰 전용 (PC는 plaza.spec 채석장)'); test.setTimeout(150000);
  const Q = require('../../public/plaza/island-quarry.js'); const Items = require('../../lib/island-items');
  const { page, token } = await shopper(browser, request, '채석장폰광부', 0, 'female');
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); }); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const rock = Q.ROCKS[3 + test.info().retry]; const s = Q.standOf(rock, 'full', 0); /* (a retry: its own full rock) */
  await post(request, '/api/test/island/give', token, { itemId: 'pickaxe', qty: 1 });
  await post(request, '/api/test/quarry/plan', token, { plan: [{ spot: 1, at: 400 }, { spot: 3, at: 400 }, { spot: 2, at: 400 }], draw: 0.1 });
  await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [s.x, s.z]);
  await holdTool(page, 'pickaxe');
  await expect.poll(() => spaceOn(page, `quarry:${rock.id}:0`, true), { timeout: 20000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => Boolean(window.PlazaDebug().mine())), { timeout: 15000 }).toBe(true);
  const game = await page.evaluate(() => window.PlazaDebug().mine()); expect(game.pad).toBe(true); expect(game.pips).toBe('○○○');
  await expect(page.locator('.mineDig')).toBeVisible(); await expect(page.locator('#islandStick')).toBeHidden(); await expect(page.locator('#plazaHint')).toBeHidden();
  // the button at the first chance while each light is on (by the game's own clock, as the scene judges it -- not a slow frame's drawing). (384
  // 총괄 #534: one timer at the light's middle fired 1~2 s late on CI's phone at a few frames a second -- past the light; looked at every 25 ms instead)
  await page.evaluate(() => { const g = window.PlazaDebug().mine(); const Q = window.IslandQuarry; const pad = document.querySelector('.mineDig'); const done = g.plan.map(() => false);
    const tick = setInterval(() => { const ms = performance.now() - g.t0; const k = Math.floor(ms / Q.ROUND_MS); const r = g.plan[k]; if (!r || !document.contains(pad)) { clearInterval(tick); return; } const local = ms - k * Q.ROUND_MS;
      if (!done[k] && local >= r.at + 40 && local <= r.at + r.light + Q.GRACE_MS - 60) { done[k] = true; pad.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch' })); } }, 25); });
  const name = Items.ITEMS[`ore_${rock.ore}`].name; await expect(page.locator('#toast')).toContainText(`${name} +1`, { timeout: 20000 }); /* (379: no day's count in it; the piece drawn from every grade now. 384: the ore's name -- 「작은 돌 +1」 of a missed set is not it) */
  expect(await page.evaluate(() => window.IslandFeel.shown().filter((w) => w.text === '쨍!' || w.text === '완벽!').length)).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.mineDig')).toHaveCount(0); await expect(page.locator('#islandStick')).toBeVisible(); /* (the game gone, the stick back) */
  const bag = (await get(request, '/api/island/bag', token)).data; expect((bag.items || []).filter((e) => e.itemId === `ore_${rock.ore}`).reduce((n, e) => n + e.qty, 0)).toBe(1);
  await expectNoScriptError(page);
});
