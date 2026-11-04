const { test, expect } = require('@playwright/test');
const { shopper, post, get, standAt, holdTool, pressFishArrows, expectNoScriptError } = require('./skin-support');
const T = require('../../public/plaza/island-terrain.js'); const DAL = T.MAP === 'dalmaru';

// V1 시점 (gamecenter-notes docs/view-modes-20261029.md, 사용자 「밖에선 3인칭이 기본에 1인칭을 선택할 수 있게. 집, 관공서
// 등 집 안에선 1인칭이 기본에 3인칭을 선택할 수 있게」): out on the island the third by default -- 「👁 시점」 / V the first
// (at my eyes, my body hidden, W walks where I look); indoors the first by default; the third chosen there is kept for
// indoors, the outside's choice for outside. PC and phone. (v1.10.237, B7: the one-time notice on this first island; the first
// person's fishing, PC)
test('시점: 밖 3인칭 기본 → 1인칭, 실내 1인칭 기본, 밖·안 따로 기억', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.CI ? 300000 : 180000);
  const who = await shopper(browser, request, isMobile ? '시점m' : '시점', 0, 'female'); const { page } = who;
  await page.evaluate((shots) => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); localStorage.removeItem('gc.view.out'); localStorage.removeItem('gc.view.in'); if (!shots) localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }, Boolean(process.env.SHOT_DIR));
  expect((await post(request, '/api/test/notices', who.token, { on: true })).status).toBe(200); // (문제 기록 1103 4: the one-time 섬 소식 -- its seen kept: unit island-notice-server)
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const view = () => page.evaluate(() => window.PlazaDebug().view());
  const shot = async (name) => { if (process.env.SHOT_DIR) { await page.waitForTimeout(1500); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-view-${name}.png` }); } };
  await expect(page.locator('#plazaDialogTitle')).toHaveText('📢 섬 소식', { timeout: 15000 }); await shot('notice');
  await page.locator('#plazaDialog').getByRole('button', { name: '알겠어요' }).click(); await expect(page.locator('#plazaDialog')).toBeHidden();
  const toggle = async () => { if (isMobile) await page.locator('#islandViewTab').click(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('KeyV'); } };
  // outside: the third, then the first -- at my eyes, my body hidden, 75°
  expect(await view()).toMatchObject({ mode: 'third', side: 'out', body: true });
  await shot('out-third');
  await toggle(); await expect.poll(async () => (await view()).mode).toBe('first');
  const fp = await view(); expect(fp.body).toBe(false); expect(fp.fov).toBe(70); expect(fp.eye).toBeGreaterThan(0.8); expect(fp.eye).toBeLessThan(2);
  await expect(page.locator('#toast')).toContainText('1인칭');
  await shot('out-first');
  if (!isMobile) { // (v1.10.210, as the third: the arrows walk -- ↑ where I look, → a side step, the look kept; W/A/S/D turn the look)
    const at = () => page.evaluate(() => [window.PlazaDebug().x, window.PlazaDebug().z]); const hold = async (key) => { await page.locator('#plazaStage').focus(); await page.keyboard.down(key); await page.waitForTimeout(700); await page.keyboard.up(key); await page.waitForTimeout(300); };
    let a = await at(); const { yaw } = await view(); await hold('KeyW');
    let b = await at(); let moved = Math.hypot(b[0] - a[0], b[1] - a[1]);
    expect(moved).toBeGreaterThan(0.3); expect(((b[0] - a[0]) * -Math.sin(yaw) + (b[1] - a[1]) * -Math.cos(yaw)) / moved).toBeGreaterThan(0.9);
    a = b; await hold('KeyD'); b = await at(); moved = Math.hypot(b[0] - a[0], b[1] - a[1]);
    expect(moved).toBeGreaterThan(0.3); expect(((b[0] - a[0]) * Math.cos(yaw) + (b[1] - a[1]) * -Math.sin(yaw)) / moved).toBeGreaterThan(0.9); expect(Math.abs((await view()).yaw - yaw)).toBeLessThan(0.02);
    a = b; await hold('ArrowRight'); b = await at();
    expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeLessThan(0.05); expect(Math.abs((await view()).yaw - yaw)).toBeGreaterThan(0.3); // (D: the look turns, I stay)
  }
  // a talk in the first: face to face -- the view turned to them (no talk camera), my body still hidden; closed, the first on
  const dialog = page.locator('#plazaDialog'); const talking = async () => /talkMode/.test(await dialog.getAttribute('class') || '');
  await expect.poll(async () => {
    if (!await talking()) { await post(request, '/api/test/island/free-residents', who.token, {}); await page.evaluate(async () => { const w = window.PlazaDebug().wanderers.find((o) => o.n === 1); if (w) { await window.PlazaWarp(w.x + 1.3, w.z); window.PlazaDebug().talkResident(w.n); } }); await page.waitForTimeout(900); }
    return talking();
  }, { timeout: 120000, intervals: [300] }).toBe(true);
  await expect.poll(async () => Math.abs((await page.evaluate(() => window.PlazaDebug().talkAim()))?.x ?? 9), { timeout: 10000 }).toBeLessThan(0.2); /* (their eyes in the middle of the screen -- the figure drawn, not the walker's reckoned spot: v1.10.210 local phone run, one held while walking drawn a step behind) */
  expect(await view()).toMatchObject({ mode: 'first', body: false, fov: 64 });
  await shot('talk-first');
  await page.evaluate(() => document.getElementById('plazaDialog').close()); await expect.poll(talking).toBe(false); expect(await view()).toMatchObject({ mode: 'first', fov: 70 });
  // (문제 기록 1103 3 「의자에 앉았을 때도 1인칭이 유지되게」) seated: the first kept, the eyes lower, the look held within ±100°
  // of the seat's way; stood up, the first still
  {
    const standEye = (await view()).eye;
    const seat = await page.evaluate(() => { const d = window.PlazaDebug(); const taken = d.takenSeats(); return d.seats.find((s) => !taken[s.id] && !s.anyDir && !s.counter && !String(s.id).includes(':') && !String(s.id).startsWith('pm-')); });
    await page.evaluate(([x, z, yaw]) => window.PlazaWarp(x + Math.sin(yaw) * 1.2, z + Math.cos(yaw) * 1.2), [seat.x, seat.z, seat.yaw]);
    await expect(page.locator('#plazaHint')).toContainText('앉기', { timeout: 10000 });
    if (isMobile) await page.locator('#plazaHint').click(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); }
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().act().sitting)).toBe(true);
    await expect.poll(async () => (await view()).eye, { timeout: 8000 }).toBeLessThan(standEye - 0.2); expect((await view()).mode).toBe('first');
    if (!isMobile) { await page.locator('#plazaStage').focus(); await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(2500); await page.keyboard.up('ArrowLeft'); await page.waitForTimeout(400); }
    else await page.evaluate(() => window.PlazaDebug().setYaw?.(window.PlazaDebug().view().yaw + Math.PI));
    const off = await page.evaluate((sy) => { const y = window.PlazaDebug().view().yaw; const c = sy - Math.PI; return Math.abs(Math.atan2(Math.sin(y - c), Math.cos(y - c))); }, seat.yaw);
    expect(off).toBeLessThanOrEqual((100 * Math.PI) / 180 + 0.02);
    await shot('sit-first');
    await page.locator('#plazaStage').focus(); await page.keyboard.press('KeyW'); await expect.poll(() => page.evaluate(() => window.PlazaDebug().act().sitting)).toBe(false);
    expect((await view()).mode).toBe('first');
  }
  // (문제 기록 1104 G 「1인칭 시점에서 낚시 시작하면 1인칭으로 낚시 계속 이어지게 해」, PC -- the phone's arrows tapped, the same
  // scene code) cast in the first: the first through the wait, the bite, the catch and after; the line from the rod in my hand
  if (!isMobile) {
    expect((await post(request, '/api/test/island/give', who.token, { itemId: 'fishing_rod', qty: 1 })).status).toBe(200);
    const pierAt = (k, side) => (DAL ? { x: T.PIER.x + T.PIER.ux * k - T.PIER.uz * side, z: T.PIER.z + T.PIER.uz * k + T.PIER.ux * side } : { x: T.PIER.x + side, z: T.PIER.z + k });
    const tourists = ((await get(request, '/api/test/island/events')).data.events || []).filter((e) => e.type === 'photo' && e.npc).map((e) => e.npc);
    const spots = DAL ? [[7, 0], [7, -1.3], [7, 1.3], [9, 0], [5, -1.3]].map(([k, s]) => pierAt(k, s)) : [pierAt(9, 0)];
    const fishAt = spots.find((p) => Math.min(99, ...tourists.map((t) => Math.hypot(t.x - p.x, t.z - p.z))) >= 4) || spots[0];
    await page.evaluate((p) => window.PlazaWarp(p.x, p.z), fishAt);
    await holdTool(page, 'fishing_rod');
    await expect(page.locator('#plazaHint')).toHaveText('SPACE · 낚시', { timeout: 15000 });
    await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().fishing()?.phase), { timeout: 10000 }).toMatch(/cast|wait/);
    expect((await view()).mode).toBe('first');
    expect(await page.evaluate(() => window.PlazaDebug().fpHeld().of)).toBe('rod'); // (the rod in my hand, the line from its tip)
    if (process.env.SHOT_DIR) { await page.waitForTimeout(2500); await shot('fishing-wait'); }
    await expect.poll(async () => {
      if (!(await page.evaluate(() => window.PlazaDebug().fishing()?.phase))) { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); return 'cast again'; }
      await page.evaluate(() => window.PlazaDebug().fishBiteNow(12)); return page.locator('#plazaHint').textContent();
    }, { timeout: 40000, intervals: [1500] }).toMatch(/^입질! 화살표/);
    expect((await view()).mode).toBe('first');
    expect((await post(request, '/api/test/fish/bite', who.token, { species: 'mackerel', slack: 20000 })).data.ok).toBe(true);
    await pressFishArrows(page, false);
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().fpHeld().of), { timeout: 8000, intervals: [100] }).toBe('catch'); // (the fish in my hand, held up as a tool is)
    if (process.env.SHOT_DIR) for (const k of [1, 2]) { await page.waitForTimeout(k === 1 ? 150 : 500); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-view-fishing-catch-${k}.png` }); }
    await expect.poll(async () => ((await get(request, '/api/island/bag', who.token)).data.items || []).find((e) => e.itemId === 'fish_mackerel')?.qty || 0, { timeout: 10000 }).toBe(1);
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().fishing()), { timeout: 10000 }).toBe(null);
    expect((await view()).mode).toBe('first');
  }
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
    { // (Codex 검토 5차 P3-6) the ceiling built again and again: its old pieces let go -- the GPU's count stays
      const geos = () => page.evaluate(() => window.PlazaDebug().render?.geometries);
      await page.evaluate(() => window.PlazaDebug().lid(3.6)); await page.waitForTimeout(500); const before = await geos();
      for (let k = 0; k < 6; k += 1) { await page.evaluate((h) => window.PlazaDebug().lid(h), k % 2 ? 3.6 : 4.0); await page.waitForTimeout(300); }
      await page.evaluate(() => window.PlazaDebug().lid(null)); await page.waitForTimeout(500); expect(await geos()).toBeLessThanOrEqual(before + 4);
    }
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
