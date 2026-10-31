const { test, expect } = require('@playwright/test');
const { shopper, adminToken, spaceOn, intoMall, liftTo, revealTalk, expectNoScriptError } = require('./skin-support');
const R = require('../../public/plaza/island-roster');
const Calendar = require('../../public/plaza/island-calendar');
const Assets = require('../../public/plaza/island-assets');
const Cast = require('../../public/plaza/island-cast');

// v1.10.215 주민 근무표 C1 (gamecenter-notes docs/resident-roster-c-plan-20261031.md): on a day the table puts 물결 at the 1st
// floor (his 부탁 open: the e2e server's 정원사·어부 week) -- every rotating post in that day's islander, a walker at a counter
// off the island, 물결's harbour spot empty; the board's 「오늘의 근무표」; the 출석 stand's helper with 「이야기해요」 (their
// talk); the 1st floor's counter: his hello and his 부탁 there; the 2nd floor's counter talks too; the 관공서's resting desk
// empty with its sign. The table is off on a tests' server -- on for this test, off again after. With SHOT_DIR: photos.
test('주민 근무표: 자리마다 그날 주민, 계산대에서 이야기·부탁, 게시판 근무표, 관공서 쉬는 창구', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.SHOT_DIR ? 600000 : 300000);
  let day = Calendar.dayOf(Date.now()); for (let k = 0; k < 200 && R.rosterOf(day).posts.mall1 !== 11; k += 1) day = Calendar.addDays(day, 1);
  const r = R.rosterOf(day); const name = (n) => Cast.RESIDENTS[n].name;
  expect((await request.post('/api/test/roster', { data: { on: true, day } })).ok()).toBe(true);
  const shot = async (page, what, wait = 1200) => { if (!process.env.SHOT_DIR) return; await page.waitForTimeout(wait); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-${what}.png` }); };
  const admin = await adminToken(request); const set = (what, mode) => request.post(`/api/admin/island/${what}`, { headers: { 'X-Session-Token': admin }, data: { mode } });
  try {
    if (process.env.SHOT_DIR) { await set('time', 'day'); await set('weather', 'clear'); }
    const who = await shopper(browser, request, isMobile ? '근무표구경m' : '근무표구경', 0, 'female'); const { page } = who;
    await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); localStorage.setItem('gc.view.out', 'third'); });
    await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => window.PlazaDebug().roster().day), { timeout: 30000 }).toBe(day);
    await page.evaluate(() => window.PlazaDebug().counterFacing()); // (every room built: each its keeper)
    // each rotating post its islander, the model on
    const want = Object.fromEntries(R.POSTS.map((p) => [p.id, Assets.lookOf(r.posts[p.id]).resident]));
    await expect.poll(async () => Object.fromEntries(Object.entries((await page.evaluate(() => window.PlazaDebug().roster())).posts).map(([p, v]) => [p, v.model ? v.resident : null])), { timeout: 60000 }).toEqual(want);
    // a walker at a counter: not on the island; 물결 at his counter: his harbour spot empty; the resting desk's clerk away
    const d = await page.evaluate(() => window.PlazaDebug().roster());
    const away = R.POSTS.map((p) => r.posts[p.id]).filter((n) => n < Cast.WALKERS.length).sort((a, b) => a - b);
    expect(d.walkersAway.slice().sort((a, b) => a - b)).toEqual(away); expect(d.shownAway).toBe(0);
    await expect.poll(async () => (await page.evaluate(() => window.PlazaDebug().roster())).quests.find((q) => q.id === 'questfisher'), { timeout: 30000 }).toEqual({ id: 'questfisher', post: 'mall1', shown: false });
    const { rest } = R.deskRest(day);
    expect(d.desks).toEqual(['civil', 'tax', 'bank'].map((k) => ({ desk: k, shown: k !== rest, sign: k === rest })));
    // the board: 「오늘의 근무표」 first
    const dialog = page.locator('#plazaDialog');
    const shut = () => expect.poll(async () => { if (await dialog.isVisible()) await page.keyboard.press('Escape'); await page.waitForTimeout(400); return dialog.isVisible(); }, { timeout: 20000 }).toBe(false); // (a talk shows no 닫기: Escape till it stays shut)
    await expect.poll(async () => { if (await dialog.locator('.rosterCard').isVisible()) return true; await page.evaluate(() => window.PlazaDebug().place('board')); await page.waitForTimeout(600); await spaceOn(page, 'board', isMobile); await page.waitForTimeout(800); return dialog.locator('.rosterCard').isVisible(); }, { timeout: 30000 }).toBe(true);
    for (const p of R.POSTS) await expect(dialog.locator('.rosterRow', { hasText: p.name })).toContainText(name(r.posts[p.id]));
    await expect(dialog.locator('.rosterRow', { hasText: '달마루역' })).toContainText(name(r.posts.station));
    await shot(page, 'board', 600);
    await shut();
    // the 출석 stand: the day's helper, 「이야기해요」 their talk
    await expect.poll(async () => { if (await dialog.locator('.postKeeperRow').isVisible()) return true; await page.evaluate(() => window.PlazaDebug().place('attendance')); await page.waitForTimeout(600); await spaceOn(page, 'attendance', isMobile); await page.waitForTimeout(800); return dialog.locator('.postKeeperRow').isVisible(); }, { timeout: 30000 }).toBe(true);
    await expect(dialog.locator('.postKeeperRow')).toContainText(name(r.posts.plaza));
    await shot(page, 'attendance', 600);
    await dialog.locator('.postKeeperRow .postTalkBtn').click();
    await expect(page.locator('#plazaDialogTitle')).toContainText(name(r.posts.plaza), { timeout: 30000 }); await revealTalk(page);
    await shot(page, 'attendance-talk');
    await shut();
    // the 1st floor's counter: 물결's hello, his 부탁 there
    await intoMall(page, null, isMobile);
    await expect.poll(async () => { if (await dialog.locator('.postTalkBtn').isVisible()) return true; await page.evaluate(() => { const p = window.PlazaDebug(); const k = p.doors['mall:store']; p.teleport(k.x, k.z); }); await page.waitForTimeout(600); await spaceOn(page, 'mall:store', isMobile); await page.waitForTimeout(800); return dialog.locator('.postTalkBtn').isVisible(); }, { timeout: 30000 }).toBe(true);
    await expect(page.locator('#plazaDialogTitle')).toContainText('물결 · 잡화·생활');
    await expect(page.locator('#bagGrowBtn')).toBeAttached(); // (the 잡화점's own 가방 늘리기 still there)
    await shot(page, 'mall1-hello');
    await dialog.locator('.postTalkBtn').click(); await revealTalk(page);
    await expect(dialog).toContainText('할게요', { timeout: 30000 }); // (his 부탁 offered, as at the harbour)
    await shot(page, 'mall1-quest');
    await shut();
    // the 2nd floor's counter talks too
    await liftTo(page, 2, isMobile);
    await expect.poll(async () => { if (await page.locator('#plazaDialogTitle').textContent().then((t) => t.includes('옷·꾸미기')) && await dialog.isVisible()) return true; await page.evaluate(() => { const F = window.IslandFashion; const w = F.world(...F.COUNTER.customer); window.PlazaDebug().teleport(w.x, w.z); }); await page.waitForTimeout(600); await spaceOn(page, 'fashion:counter', isMobile); await page.waitForTimeout(800); return false; }, { timeout: 30000 }).toBe(true);
    await expect(page.locator('#plazaDialogTitle')).toContainText(`${name(r.posts.mall2)} · 옷·꾸미기`);
    await shot(page, 'mall2-hello');
    await shut();
    // the 관공서: the resting desk empty, 「오늘은 쉬어요」 over it (photo)
    if (process.env.SHOT_DIR) {
      await liftTo(page, 1, isMobile);
      await expect.poll(async () => { await page.evaluate(() => { const p = window.PlazaDebug(); const k = p.doors['store:exit']; p.teleport(k.x, k.z); }); await page.waitForTimeout(600); await spaceOn(page, 'store:exit', isMobile); await page.waitForTimeout(900); return page.evaluate(() => window.PlazaDebug().space); }, { timeout: 40000 }).toBe('island');
      await expect.poll(async () => { await page.evaluate(() => window.PlazaDebug().place('townhall')); await page.waitForTimeout(700); await spaceOn(page, 'townhall', isMobile); await page.waitForTimeout(700); return page.evaluate(() => window.PlazaDebug().space); }, { timeout: 40000 }).toBe('townhall');
      await page.evaluate((rest) => { const T = window.IslandTerrain; const c = T.COUNTERS.find((x) => x.id === rest); const w = T.roomWorld(c.lx, c.lz + 4); const p = window.PlazaDebug(); p.teleport(w.x, w.z); p.setCamYaw?.(0); p.setCamPitch?.(0.12); }, rest);
      await shot(page, 'townhall-rest', 2500);
    }
    await expectNoScriptError(page); await who.context.close();
  } finally {
    await request.post('/api/test/roster', { data: { on: false } });
    if (process.env.SHOT_DIR) { await set('time', 'auto'); await set('weather', 'auto'); }
  }
});
