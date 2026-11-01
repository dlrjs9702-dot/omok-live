const { test, expect } = require('@playwright/test');
const { shopper, post, get, standAt } = require('./skin-support');

// v1.10.217 사진 (SHOT_DIR only): the first person before a desk in my house (the eyes by the head -- BEFORE=1 against an older
// server: the old eyes). (The islanders refit by assets 89·90: resident-looks.spec.js's photos)
const stamp = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
const tag = () => `${test.info().project.name}-${process.env.BEFORE ? 'before' : 'after'}`;

test('사진: 1인칭 집 책상 앞 눈높이', async ({ browser, request, isMobile }) => {
  test.skip(!process.env.SHOT_DIR, 'SHOT_DIR only');
  test.setTimeout(300000);
  const a = await shopper(browser, request, isMobile ? '책상m' : '책상', 3000000, 'female'); const { page } = a;
  expect((await post(request, '/api/test/login-id', null, { keyId: a.id, loginId: `desk_${stamp()}`.slice(0, 20) })).status).toBe(200);
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); localStorage.setItem('gc.view.in', 'first'); });
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  const press = async () => { if (isMobile) await page.locator('#plazaHint').tap(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); } };
  const through = async (door, space) => {
    for (let tries = 0; tries < 6 && await page.evaluate(() => window.PlazaDebug().space) !== space; tries += 1) {
      if (await page.locator('#plazaDialog').isVisible()) await page.keyboard.press('Escape');
      await page.evaluate((id) => { const d = window.PlazaDebug(); const w = d.doors[id]; if (w) d.teleport(w.x, w.z); else d.place(id); }, door); await page.waitForTimeout(800);
      await press(); await expect.poll(() => page.evaluate(() => window.PlazaDebug().space), { timeout: 10000 }).toBe(space).catch(() => {});
    }
    expect(await page.evaluate(() => window.PlazaDebug().space)).toBe(space);
  };
  { const th = await page.evaluate(() => window.PlazaDebug().doors.townhall); await standAt(request, a, th.x, th.z); }
  await through('townhall', 'townhall');
  const lot = (await get(request, '/api/home', a.token)).data.lots.find((l) => l.owner === null).id;
  expect((await post(request, '/api/home/apply', a.token, { lot, roof: 'green' })).status).toBe(200);
  try {
    const [desk, chair] = (await post(request, '/api/test/home/furniture', a.token, { ids: ['desk__oak', 'chair__oak'] })).data.pieces.map((p) => p.uid);
    await through('room:exit', 'island');
    await through(`home:${lot}`, 'home');
    expect((await post(request, '/api/home/place', a.token, { uid: desk, x: 0, z: 2, rot: 0 })).status).toBe(200);
    if (chair) await post(request, '/api/home/place', a.token, { uid: chair, x: 1.4, z: 1.2, rot: 0 });
    await page.evaluate((lot) => { const H = window.IslandHome; const d = window.PlazaDebug(); const o = H.lotById(lot); const w = H.world(o, 0, 0.5); const c = H.world(o, 0, 2); d.teleport(w.x, w.z); d.faceTo(c.x, c.z); d.setCamYaw(Math.atan2(-(c.x - w.x), -(c.z - w.z))); d.setCamPitch?.(0.15); }, lot); // (the first person looks by the camera's yaw)
    const shown = () => page.evaluate((uid) => window.PlazaDebug().home()?.pieces.includes(uid), desk);
    if (!(await expect.poll(shown, { timeout: 20000 }).toBe(true).then(() => true, () => false))) { await through('home:exit', 'island'); await through(`home:${lot}`, 'home'); } // (placed from outside the page: drawn on coming in)
    await expect.poll(shown, { timeout: 20000 }).toBe(true);
    await page.evaluate((lot) => { const H = window.IslandHome; const d = window.PlazaDebug(); const o = H.lotById(lot); const w = H.world(o, 0, 0.5); const c = H.world(o, 0, 2); d.teleport(w.x, w.z); d.faceTo(c.x, c.z); d.setCamYaw(Math.atan2(-(c.x - w.x), -(c.z - w.z))); d.setCamPitch?.(0.15); }, lot);
    await page.waitForTimeout(6000); await page.screenshot({ path: `${process.env.SHOT_DIR}/${tag()}-home-desk.png` });
  } finally { await post(request, '/api/home/leave', a.token, {}).catch(() => {}); await post(request, '/api/test/home/release', a.token, { lot }).catch(() => {}); }
});
