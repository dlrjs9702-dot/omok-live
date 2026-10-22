const { test, expect } = require('@playwright/test');
const { shopper, post, adminToken, uniqueIp, intoMall, expectNoScriptError } = require('./skin-support');

// 자전거 (gamecenter-notes docs/bicycle-20261020.md, assets 61): one in the bag rides by B (the phone's 🚲 button, shown
// only with a bike); the others see it, in its colour; it gets off by itself indoors, on stairs (not bridges, 2026-10-21), and among
// people. PC and phone.
async function apiGuest(request, label) { // a player without a browser (for a crowd)
  const issued = (await post(request, '/api/admin/keys', await adminToken(request), { label })).data;
  const key = issued.html.match(/name="token" value="([^"]+)"/)[1];
  const res = await request.post('/guest-entry', { headers: { 'X-Forwarded-For': uniqueIp(), 'Content-Type': 'application/x-www-form-urlencoded' }, data: `token=${encodeURIComponent(key)}` });
  return (await res.text()).match(/data-session="([^"]+)"/)[1];
}
test('자전거: B·🚲 단추로 타고 내리기, 다른 사람에게 보임, 실내·계단·사람 많은 곳에서 저절로 내림', async ({ browser, request, isMobile }) => {
  test.setTimeout(300000);
  const a = await shopper(browser, request, '자전거A', 0, 'female'); const b = await shopper(browser, request, '자전거B', 0, 'male');
  const ready = async (who) => { await who.page.evaluate(() => localStorage.removeItem('gc.testClassic')); await who.page.reload(); await expect.poll(() => who.page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true); };
  // no bike: no button, B does nothing but say so
  await ready(a);
  if (isMobile) await expect(a.page.locator('#islandBikeBtn')).toBeHidden();
  await post(request, '/api/test/island/give', a.token, { itemId: 'bike_red', qty: 1 });
  await ready(a); await ready(b);
  const { page } = a;
  const toggle = async () => { if (isMobile) await page.locator('#islandBikeBtn').tap(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('KeyB'); } };
  const spot = await page.evaluate(() => { const T = window.IslandTerrain; return { x: T.PLAZA_C.x + 12, z: T.PLAZA_C.z + 12 }; });
  for (const who of [a, b]) await who.page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [spot.x + (who === b ? 3 : 0), spot.z]);
  if (isMobile) await expect(page.locator('#islandBikeBtn')).toBeVisible({ timeout: 15000 });
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().bikes()), { timeout: 15000 }).toEqual(['red']);
  // on: mine, and the other screen sees me on a red one
  await toggle();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().cycling)).toBe('red');
  const myId = await page.evaluate(() => window.PlazaDebug().myId);
  await expect.poll(() => b.page.evaluate((id) => window.PlazaDebug().othersBikes()[id] ?? null, myId), { timeout: 20000 }).toBe('red');
  // 9 m/s, 12 while Shift is held (the phone: the 뛰기 button) -- 사용자 2026-10-21
  expect(await page.evaluate(() => window.PlazaDebug().speedNow())).toBe(9);
  if (isMobile) { await page.locator('#islandRunBtn').dispatchEvent('pointerdown'); } else { await page.locator('#plazaStage').focus(); await page.keyboard.down('Shift'); }
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().speedNow())).toBe(12);
  if (isMobile) { await page.locator('#islandRunBtn').dispatchEvent('pointerup'); } else await page.keyboard.up('Shift');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().speedNow())).toBe(9);
  expect(await page.evaluate(() => window.PlazaDebug().pace)).toBe('walk'); // (Shift on a bike only speeds up)
  // on a slope both wheels stay on the ground, whichever way it faces (문제 기록 2회차 2: the front wheel went into it)
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    await page.evaluate(async (yaw) => { await window.PlazaWarp(0.8, -33.9); window.PlazaDebug().faceYaw(yaw); }, yaw);
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().bikeWheels()?.every((g) => Math.abs(g) < 0.06)), { message: String(yaw) }).toBe(true);
  }
  // on a bridge it rides on (문제 기록 2회차 6)
  await page.evaluate(() => { const b = window.IslandTerrain.bridges[0]; return window.PlazaWarp(b.x, b.z); });
  expect(await page.evaluate(() => { const d = window.PlazaDebug(); return Boolean(window.IslandTerrain.onBridge(d.x, d.z)); })).toBe(true);
  await page.waitForTimeout(800); expect(await page.evaluate(() => window.PlazaDebug().cycling)).toBe('red');
  await page.evaluate(([x, z]) => window.PlazaWarp(x, z), [spot.x, spot.z]);
  // off, and seen off
  await toggle();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().cycling)).toBe(null);
  await expect.poll(() => b.page.evaluate((id) => window.PlazaDebug().othersBikes()[id] ?? null, myId), { timeout: 20000 }).toBe(null);
  // off by itself: on the ridge's stairs -- off at once when put there (teleport's bikeCheck), so read in the same call as the
  // warp. (CI 3차: the poll that read it after timed out on CI, #267·#268 chromium-4 and mobile-2 -- the page was off the bike
  // all along, but loading the ridge's models then kept it busy past 10 s and the poll's own call could not run.)
  await toggle(); await expect.poll(() => page.evaluate(() => window.PlazaDebug().cycling)).toBe('red');
  const onStairs = await page.evaluate(async () => {
    const S = window.IslandTerrain.STAIRS; await window.PlazaWarp(S.x + S.ux * (S.len / 2) + S.nx * 1.7, S.z + S.uz * (S.len / 2) + S.nz * 1.7);
    const d = window.PlazaDebug(); return { onStairs: Boolean(window.IslandTerrain.onStairs(d.x, d.z)), cycling: d.cycling };
  });
  expect(onStairs).toEqual({ onStairs: true, cycling: null });
  expect(await page.evaluate(() => window.PlazaDebug().cycling)).toBe(null); // (and still off once the page is free again)
  // ... among people: three standing within 5 m
  await page.evaluate(([x, z]) => window.PlazaWarp(x, z), [spot.x, spot.z]); await page.waitForTimeout(500);
  await toggle(); await expect.poll(() => page.evaluate(() => window.PlazaDebug().cycling)).toBe('red');
  const crowd = await Promise.all([1, 2, 3].map((i) => apiGuest(request, `구경꾼${i}`)));
  const at = await page.evaluate(() => { const d = window.PlazaDebug(); return { x: d.x, z: d.z }; });
  await expect.poll(async () => { for (const [i, t] of crowd.entries()) await post(request, '/api/plaza/state', t, { x: at.x + 1.5 + i, z: at.z + 1, yaw: 0, moving: false }); return page.evaluate(() => window.PlazaDebug().cycling); }, { timeout: 20000 }).toBe(null);
  for (const t of crowd) await post(request, '/api/plaza/leave', t, {});
  // ... indoors: into the 백화점
  await page.waitForTimeout(1500); await toggle(); await expect.poll(() => page.evaluate(() => window.PlazaDebug().cycling), { timeout: 10000 }).toBe('red');
  await intoMall(page, null, isMobile);
  expect(await page.evaluate(() => window.PlazaDebug().cycling)).toBe(null);
  await toggle(); expect(await page.evaluate(() => window.PlazaDebug().cycling)).toBe(null); // (not inside)
  for (const who of [a, b]) await expectNoScriptError(who.page);
  for (const who of [a, b]) await who.context.close();
});
