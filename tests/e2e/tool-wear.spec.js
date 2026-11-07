const { test, expect } = require('@playwright/test');
const { shopper, get, post, expectNoScriptError, spaceOn, intoMall } = require('./skin-support');
const T = require('../../public/plaza/island-terrain.js');
const S = require('../../public/plaza/island-store.js');
test.skip(({ isMobile }) => isMobile, 'PC 실행이 같은 확인을 함 (v1.10.269 시험 정리: docs/test-audit-20261107.md)');

// v1.10.221 도구 닳기 (gamecenter-notes docs/spending-sinks-20261025.md ③): a net's catches left -- a bar in its bag slot and,
// held, on the screen; a catch takes one from the most worn (5 left: 「많이 낡았어요」, 0: 「툭!」 splinters and it is gone, the
// next one in hand); the sturdy ones on the 잡화점's tool wall. PC and phone; with SHOT_DIR the photos.
test('도구 닳기: 가방 막대·든 도구 횟수, 5회 쪽지, 0이면 툭 부러짐, 잡화점 튼튼한 도구', async ({ browser, request, isMobile }) => {
  test.setTimeout(300000);
  const a = await shopper(browser, request, isMobile ? '닳는채m' : '닳는채', 200000, 'female'); const { page } = a;
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testHalloween', 'off'); }); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running).catch(() => false), { timeout: 90000 }).toBe(true);
  const shot = async (name, wait = 800) => { if (!process.env.SHOT_DIR) return; await page.waitForTimeout(wait); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-${name}.png` }); };
  expect((await post(request, '/api/test/island/give', a.token, { itemId: 'bugnet', qty: 1, meta: { uses: 6 } })).status).toBe(200);
  expect((await post(request, '/api/test/island/give', a.token, { itemId: 'bugnet_sturdy', qty: 1 })).status).toBe(200);
  // the bag: a bar on each (6/30 short and red-ish, the sturdy one full and ringed)
  await page.keyboard.press('KeyI');
  const net = page.locator('.islandBagSlot[data-item="bugnet"]'); await expect(net.locator('.toolUses')).toHaveCount(1);
  await expect(net).toHaveAttribute('aria-label', '잠자리채 남은 6회'); await expect(page.locator('.islandBagSlot[data-item="bugnet_sturdy"]')).toHaveClass(/sturdy/);
  await shot('bag');
  await net.click(); await page.locator('#islandBagGrid button', { hasText: '들기' }).first().click();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().heldTool())).toBe('bugnet');
  const gauge = page.locator('#toolGauge'); await expect(gauge).toBeVisible(); await expect(gauge).toContainText('6/30');
  // a catch: the most worn one -- 5 left, the note
  const by = (x0, z0, r) => { for (let k = 0; k < 12; k += 1) { const x = x0 + Math.cos(k / 2) * r; const z = z0 + Math.sin(k / 2) * r; if (T.walkable(x, z) && T.walkDist(x, z) > 0.5 && !T.natureSolids().some((s) => Math.hypot(s.x - x, s.z - z) < s.r + 0.3)) return { x, z }; } return null; };
  let tries = 0; let last = null;
  const catchOne = () => expect.poll(async () => {
    const slow = (b) => (/^dragonfly/.test(b.species) ? 2 : /^butterfly|firefly/.test(b.species) ? 1 : 0);
    const list = ((await get(request, '/api/island/insects', a.token)).data.list || []).filter((b) => by(b.x, b.z, 1.8)).sort((p, q) => slow(p) - slow(q)); if (!list.length) return (last = 'no insect');
    const t = list[tries++ % Math.min(4, list.length)]; const near = by(t.x, t.z, 1.8);
    await page.evaluate(([x, z]) => window.PlazaWarp(x, z), [near.x, near.z]); await page.waitForTimeout(500);
    const drawnAt = () => page.evaluate((id) => window.PlazaDebug().insectsDrawn().find((b) => b.id === id), t.id);
    let drawn = await drawnAt(); if (!drawn) return (last = 'not drawn');
    const at = by(drawn.x, drawn.z, 0.8) || near; await page.evaluate(([x, z]) => window.PlazaWarp(x, z), [at.x, at.z]);
    drawn = await drawnAt(); if (!drawn) return (last = 'flown off');
    await page.evaluate(([bx, bz]) => window.PlazaDebug().faceTo(bx, bz), [drawn.x, drawn.z]);
    const answer = page.waitForResponse((r) => r.url().includes('/api/island/insect/catch'), { timeout: 5000 }).catch(() => null);
    if (!(await spaceOn(page, 'tool:swing', isMobile))) return (last = 'no swing');
    const r = await answer; last = r ? `${r.status()}` : 'no answer'; return r?.status() ?? 'no answer';
  }, { timeout: 60000, intervals: [500] }).toBe(200).catch((error) => { error.message += `\nlast: ${last}`; throw error; });
  await catchOne();
  await expect(page.locator('#toast, .toast').filter({ hasText: '많이 낡았어요' }).first()).toBeVisible({ timeout: 5000 }); await expect(gauge).toContainText('5/30');
  await shot('worn', 300);
  // one more on its last catch (the most worn: used first) -- 툭!, splinters, gone; the 5-left one in hand after
  expect((await post(request, '/api/test/island/give', a.token, { itemId: 'bugnet', qty: 1, meta: { uses: 1 } })).status).toBe(200);
  await catchOne();
  await expect(page.locator('#toast, .toast').filter({ hasText: '툭!' }).first()).toBeVisible({ timeout: 5000 });
  await shot('broke', 150);
  const left = ((await get(request, '/api/island/bag', a.token)).data.items || []).filter((e) => e.tool === 'bugnet').map((e) => [e.itemId, e.uses]);
  expect(left).toEqual([['bugnet', 5], ['bugnet_sturdy', 80]]);
  expect(await page.evaluate(() => window.PlazaDebug().heldTool())).toBe('bugnet'); await expect(gauge).toContainText('5/30');
  // the 잡화점: the sturdy ones on the tool wall
  await page.evaluate(([x, z]) => window.PlazaWarp(x, z), [T.SPAWN.x, T.SPAWN.z]); await page.waitForTimeout(800);
  await intoMall(page, null, isMobile);
  const w = S.standFor('fishing_rod_sturdy'); await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [w.x, w.z]); await page.waitForTimeout(800);
  await expect(page.locator('#plazaHint')).toContainText('튼튼한 낚싯대', { timeout: 10000 });
  await shot('store-wall');
  await spaceOn(page, '', isMobile); await expect(page.locator('#plazaDialog')).toContainText('튼튼한 낚싯대', { timeout: 10000 });
  await shot('store-card');
  await expectNoScriptError(page); await a.context.close();
});
