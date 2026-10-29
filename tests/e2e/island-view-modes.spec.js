const { test, expect } = require('@playwright/test');
const { shopper, post, get, standAt, expectNoScriptError } = require('./skin-support');

// V1 시점 (gamecenter-notes docs/view-modes-20261029.md, 사용자 「밖에선 3인칭이 기본에 1인칭을 선택할 수 있게. 집, 관공서
// 등 집 안에선 1인칭이 기본에 3인칭을 선택할 수 있게」): out on the island the third by default -- 「👁 시점」 / V the first
// (at my eyes, my body hidden, W walks where I look); indoors the first by default; the third chosen there is kept for
// indoors, the outside's choice for outside. PC and phone.
test('시점: 밖 3인칭 기본 → 1인칭, 실내 1인칭 기본, 밖·안 따로 기억', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.CI ? 300000 : 180000);
  const who = await shopper(browser, request, isMobile ? '시점m' : '시점', 0, 'female'); const { page } = who;
  await page.evaluate((shots) => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); localStorage.removeItem('gc.view.out'); localStorage.removeItem('gc.view.in'); if (!shots) localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }, Boolean(process.env.SHOT_DIR));
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const view = () => page.evaluate(() => window.PlazaDebug().view());
  const toggle = async () => { if (isMobile) await page.locator('#islandViewTab').click(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('KeyV'); } };
  const shot = async (name) => { if (process.env.SHOT_DIR) { await page.waitForTimeout(1500); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-view-${name}.png` }); } };
  // outside: the third, then the first -- at my eyes, my body hidden, 75°
  expect(await view()).toMatchObject({ mode: 'third', side: 'out', body: true });
  await shot('out-third');
  await toggle(); await expect.poll(async () => (await view()).mode).toBe('first');
  const fp = await view(); expect(fp.body).toBe(false); expect(fp.fov).toBe(75); expect(fp.eye).toBeGreaterThan(0.8); expect(fp.eye).toBeLessThan(2);
  await expect(page.locator('#toast')).toContainText('1인칭');
  await shot('out-first');
  if (!isMobile) { // (W walks where I look)
    const a = await page.evaluate(() => [window.PlazaDebug().x, window.PlazaDebug().z]); const { yaw } = await view();
    await page.locator('#plazaStage').focus(); await page.keyboard.down('KeyW'); await page.waitForTimeout(700); await page.keyboard.up('KeyW');
    const b = await page.evaluate(() => [window.PlazaDebug().x, window.PlazaDebug().z]); const moved = Math.hypot(b[0] - a[0], b[1] - a[1]);
    expect(moved).toBeGreaterThan(0.3); expect(((b[0] - a[0]) * -Math.sin(yaw) + (b[1] - a[1]) * -Math.cos(yaw)) / moved).toBeGreaterThan(0.9);
  }
  // a talk in the first: face to face -- the view turned to them (no talk camera), my body still hidden; closed, the first on
  const dialog = page.locator('#plazaDialog'); const talking = async () => /talkMode/.test(await dialog.getAttribute('class') || '');
  await expect.poll(async () => {
    if (!await talking()) { await post(request, '/api/test/island/free-residents', who.token, {}); await page.evaluate(async () => { const w = window.PlazaDebug().wanderers.find((o) => o.n === 1); if (w) { await window.PlazaWarp(w.x + 1.3, w.z); window.PlazaDebug().talkResident(w.n); } }); await page.waitForTimeout(900); }
    return talking();
  }, { timeout: 120000, intervals: [300] }).toBe(true);
  await expect.poll(async () => { const v = await view(); const at = await page.evaluate(() => { const d = window.PlazaDebug(); const w = d.wanderers.find((o) => o.n === 1); /* (the one talked to) */ return w && { dx: w.x - d.x, dz: w.z - d.z }; }); if (!at) return 9; const want = Math.atan2(-at.dx, -at.dz); return Math.abs(Math.atan2(Math.sin(v.yaw - want), Math.cos(v.yaw - want))); }, { timeout: 10000 }).toBeLessThan(0.2);
  expect(await view()).toMatchObject({ mode: 'first', body: false, fov: 64 });
  await shot('talk-first');
  await page.evaluate(() => document.getElementById('plazaDialog').close()); await expect.poll(talking).toBe(false); expect(await view()).toMatchObject({ mode: 'first', fov: 75 });
  // the 관공서: the third till V2 (「곧」); my house: the first by default, the third chosen there kept for indoors
  const th = await page.evaluate(() => window.PlazaDebug().doors.townhall); await standAt(request, who, th.x, th.z);
  const space = () => page.evaluate(() => window.PlazaDebug().space);
  const enter = async (door, want) => { // (pressed once, then waited for: inside, one stands by the way out -- a second press would leave)
    for (let tries = 0; tries < 8 && await space() !== want; tries += 1) {
      await page.evaluate((id) => { const d = window.PlazaDebug(); const w = d.doors[id]; if (w) d.teleport(w.x, w.z); }, door); await page.waitForTimeout(400);
      if (isMobile) await page.locator('#plazaHint').click().catch(() => {}); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); }
      await expect.poll(space, { timeout: 8000 }).toBe(want).catch(() => {});
    }
    expect(await space()).toBe(want);
  };
  await enter('townhall', 'townhall');
  expect(await view()).toMatchObject({ side: 'in', mode: 'third' });
  await toggle(); await expect(page.locator('#toast')).toContainText('곧 1인칭'); expect((await view()).mode).toBe('third');
  const lot = (await get(request, '/api/home', who.token)).data.lots.find((l) => l.owner === null).id;
  expect((await post(request, '/api/home/apply', who.token, { lot, roof: 'blue' })).status).toBe(200);
  try {
    await enter('room:exit', 'island');
    expect(await view()).toMatchObject({ side: 'out', mode: 'first' }); // (outside's own choice)
    await enter(`home:${lot}`, 'home');
    await expect.poll(async () => (await view())).toMatchObject({ side: 'in', mode: 'first', body: false });
    // (a desk with a snow globe, a coffee table with the radio -- in again: the room as the server has it)
    const [desk, globe, table, radio, box] = (await post(request, '/api/test/home/furniture', who.token, { ids: ['desk__oak', 'xmas_snow_globe__plain', 'coffee_table__oak', 'radio__red', 'insect_case__oak'] })).data.pieces.map((p) => p.uid);
    for (const [uid, x, z] of [[desk, -1.5, 2.5], [globe, -1.85, 2.5], [box, -1.3, 2.5], [table, 1.5, 2.5], [radio, 1.5, 2.5]]) /* (assets 86: the tabletop 곤충 상자 on the desk) */ expect((await post(request, '/api/home/place', who.token, { uid, x, z, rot: 0 })).status).toBe(200);
    await enter('home:exit', 'island'); await enter(`home:${lot}`, 'home');
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().lid()?.visible)).toBe(true); // (the ceiling, the walls up to it)
    await shot('home-first');
    if (process.env.SHOT_DIR) { await page.evaluate(() => window.PlazaDebug().setCamYaw?.(window.PlazaDebug().view().yaw)); for (const h of [3.6, 4.0]) { await page.evaluate((h) => window.PlazaDebug().lid(h), h); await page.evaluate(() => { const d = window.PlazaDebug(); d.setCamYaw(d.view().yaw); }); await shot(`home-ceil-${h}`); } await page.evaluate(() => window.PlazaDebug().lid(null)); }
    // 꾸미기: the room from above while it is open, the first again when closed
    await page.locator('#homeEditBtn').click(); await expect(page.locator('#homeEdit')).toBeVisible(); await expect.poll(async () => (await view()).mode).toBe('third');
    await page.evaluate(() => document.getElementById('plazaDialog').close()); await expect.poll(async () => (await view()).mode).toBe('first');
    await toggle(); await expect.poll(async () => (await view()).mode).toBe('third');
    expect(await page.evaluate(() => window.PlazaDebug().lid()?.visible)).toBe(false); // (the third as before)
    await shot('home-third');
    await enter('home:exit', 'island');
    expect(await view()).toMatchObject({ side: 'out', mode: 'first' });
    await toggle(); await expect.poll(async () => (await view()).mode).toBe('third');
    await enter(`home:${lot}`, 'home');
    expect(await view()).toMatchObject({ side: 'in', mode: 'third' }); // (indoors' own, kept)
    expect(await page.evaluate(() => [localStorage.getItem('gc.view.out'), localStorage.getItem('gc.view.in')])).toEqual(['third', 'third']);
  } finally { await post(request, '/api/test/home/release', who.token, {}); }
  await expectNoScriptError(page); await who.context.close();
});
