const { test, expect } = require('@playwright/test');
const { shopper, post, get, expectNoScriptError } = require('./skin-support');

// v1.10.90 낚시 도감 21종 (IDEAS #future-fishing-dex): a stream's bank is a fishing spot too -- the float lands on the
// stream, a river fish comes in and goes to the bag (its new model in hand, its icon in the 도감). PC and phone.
test('강 낚시: 개울가에서 던지면 찌가 개울에, 강 물고기를 잡아 가방에', async ({ browser, request }) => {
  test.setTimeout(120000);
  const who = await shopper(browser, request, '강낚시', 500000, 'male');
  const { page, token } = who;
  expect((await post(request, '/api/test/island/give', token, { itemId: 'fishing_rod', qty: 1 })).status).toBe(200); // (낚싯대는 잡화점에서)
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 30000 }).toBe(true);
  const weeds = (await get(request, '/api/island/weeds', token)).data.weeds || [];
  const spot = await page.evaluate((weeds) => { // the river bank spot nearest the plaza with no weed in reach (a weed's prompt comes first)
    const T = window.IslandTerrain; let best = null;
    const R = T.dalmaru ? 170 : 70; const step = T.dalmaru ? 1 : 0.5; const PC = T.PLAZA_C || { x: 0, z: 0 }; /* (달마루섬: its rivers and lake are further out) */ for (let x = -R; x <= R; x += step) for (let z = -R; z <= R; z += step) if (T.fishWater(x, z) === 'river' && (!T.dalmaru || T.dalmaru.riverDist(x, z) < 3) && [[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]].every(([dx, dz]) => T.canFish(x + dx, z + dz)) && weeds.every(([, wx, wz]) => Math.hypot(wx - x, wz - z) > 4)) { const d = Math.hypot(x - PC.x, z - PC.z); if (!best || d < best.d) best = { x, z, d }; }
    return best;
  }, weeds);
  expect(spot).not.toBeNull();
  const warpAt = Date.now(); await page.evaluate(({ x, z }) => window.PlazaWarp(x, z), spot); const warpMs = Date.now() - warpAt;
  // (CI 3차: canFish false for 10 s after the warp on CI, twice -- the nearest 'river' spot was (0, -6), a strip of shallow
  // water by 윤슬만's beach (fishWater's last case), a push of a few cm off it (an islander walking by) and no fishing; now
  // a bank of a real river (riverDist < 3) with room round it, put back there if moved off, and where it was if that fails)
  let at = null;
  await expect.poll(async () => { const t0 = Date.now(); at = { pending: true }; try { const r = await page.evaluate((s) => { const d = window.PlazaDebug(); if (!d.canFish()) d.teleport(s.x, s.z); return { can: d.canFish(), x: d.x, z: d.z, space: d.space }; }, spot); at = { ...r, ms: Date.now() - t0 }; return r.can; } catch (e) { at = { error: String(e).slice(0, 200), ms: Date.now() - t0 }; return false; } }, { timeout: 10000 }).toBe(true).catch((error) => { error.message += `\nlast: ${JSON.stringify(at)} warp: ${warpMs} ms spot: ${JSON.stringify(spot)}`; throw error; }); // (pending: the page did not answer the call at all)
  await expect(page.locator('#plazaHint')).toHaveText(/낚시$/, { timeout: 10000 }) // (a phone shows no SPACE);
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().fishing()?.bobber), { timeout: 10000 }).toBe(true);
  expect(await page.evaluate(() => { const b = window.PlazaDebug().fishing().at; const T = window.IslandTerrain; return T.dalmaru ? T.dalmaru.isWater(b.x, b.z) && T.dalmaru.coastDist(b.x, b.z) >= 0 : T.streamDist(b.x, b.z) < T.STREAM_HALF; })).toBe(true); // (달마루섬: inland water -- a river, 거울호수 or a pool) the float is on the stream
  await page.evaluate(() => window.PlazaDebug().fishBiteNow(12)); // (a long bite on the page; the server's just before the pull -- see plaza.spec)
  await expect(page.locator('#plazaHint')).toHaveText(/당기기$/);
  expect((await post(request, '/api/test/fish/bite', token, { species: 'catfish' })).data.ok).toBe(true);
  await page.keyboard.press('Space');
  await expect.poll(async () => ((await get(request, '/api/island/bag', token)).data.items || []).find((e) => e.itemId === 'fish_catfish')?.qty || 0, { timeout: 10000 }).toBe(1);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().fishing()), { timeout: 10000 }).toBe(null); // the catch played out (the 13 new models: test/island-asset-pipeline)
  await expectNoScriptError(page);
  await who.context.close();
});
