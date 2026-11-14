const { test, expect } = require('@playwright/test');
const { shopper, adminToken, spaceOn, intoMall, liftTo, revealTalk, expectNoScriptError } = require('./skin-support');
const R = require('../../public/plaza/island-roster');
const Calendar = require('../../public/plaza/island-calendar');
const Assets = require('../../public/plaza/island-assets');
const Cast = require('../../public/plaza/island-cast');
const Errands = require('../../lib/island-errands');

// v1.10.215 주민 근무표 C1 (gamecenter-notes docs/resident-roster-c-plan-20261031.md): on a day the table puts 물결 at the 1st
// floor (his 부탁 open: the e2e server's 정원사·어부 week) -- every rotating post in that day's islander, a walker at a counter
// off the island, 물결's harbour spot empty; the board's 「오늘의 근무표」; the 출석 stand's helper with 「이야기해요」 (their
// talk); the 1st floor's counter: his hello and his 부탁 there; the 2nd floor's counter talks too; the 관공서's resting desk
// empty with its sign. C2 (v1.10.216): that day's walkers out (the 17 in their day-off look), 꽃님 walking with her 부탁's
// mark over her and her 부탁 from her talk, 철이 at the station of a weekday. The table is off on a tests' server -- on for
// this test, off again after. With SHOT_DIR: photos. (v1.10.237, 문제 기록 1103 9 「일하는 자리는 모두 근무표 주민이」: the guide's
// work at the 출석대 -- its 「섬 안내」 under the keeper's name; 느티 at the 정자 every day; the 박물관's 관장 the day's)
test('주민 근무표: 자리마다 그날 주민, 계산대에서 이야기·부탁, 게시판 근무표, 관공서 쉬는 창구', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.SHOT_DIR ? 600000 : 300000);
  // (CI #389·#392: the day's errands go by the pinned day too now (server errandDay) -- a day 꽃님 asks or is sought in one is skipped:
  // her talk would open with the errand's offer, not her 부탁)
  const fits = (d) => R.rosterOf(d).posts.mall1 === 11 && R.walks(10, d) && new Date(`${d}T00:00:00Z`).getUTCDay() !== 0 // (물결 at the 1st floor, 꽃님 walking, a weekday)
    && !Errands.errandsOf(d, (n) => R.walks(n, d, true)).some((e) => e.from === 10 || e.to === 10);
  let day = Calendar.dayOf(Date.now()); for (let k = 0; k < 200 && !fits(day); k += 1) day = Calendar.addDays(day, 1);
  const r = R.rosterOf(day); const name = (n) => Cast.RESIDENTS[n].name;
  expect((await request.post('/api/test/roster', { data: { on: true, day } })).ok()).toBe(true);
  // (local 3× run at 14:00 KST: the day's contest live -- 가락 at its tent, not walking (plaza-scene walksNow), and the walkers' list
  // short of him for 30 minutes a day; the contest's clock moved past its tent for this test, back after)
  expect((await request.post('/api/test/contest/clock', { data: { to: 'after' } })).ok()).toBe(true);
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
    const want = { ...Object.fromEntries(R.POSTS.filter((p) => p.id !== 'museum').map((p) => [p.id, Assets.lookOf(r.posts[p.id]).resident])), station: Assets.lookOf(r.posts.station).resident, pavilion: Assets.lookOf(r.posts.pavilion).resident }; // (C2: the station's keeper too; 237: the 정자's every day, the 박물관's built inside it -- by name there, below)
    await expect.poll(async () => Object.fromEntries(Object.entries((await page.evaluate(() => window.PlazaDebug().roster())).posts).map(([p, v]) => [p, v.model ? v.resident : null])), { timeout: 60000 }).toEqual(want);
    // a walker at a counter: not on the island; 물결 at his counter: his harbour spot empty; the resting desk's clerk away
    const d = await page.evaluate(() => window.PlazaDebug().roster());
    const away = R.POSTS.map((p) => r.posts[p.id]).filter((n) => n < Cast.WALKERS.length || Cast.RESIDENTS[n]?.reg === 'garak').sort((a, b) => a - b); /* (대회 순위: 가락 made a walker for his walk to the 대회 천막 -- hidden again at his counter) */
    // (a walker at a counter is made and hidden when the walkers come out before the day's table, or not made at all when the
    // table came first -- either way none of them on the island: CI #375, the order turned with the page's start)
    const held = (await page.evaluate(() => window.PlazaDebug().wanderers)).filter((w) => w.held).map((w) => w.n); /* (314 CI 14:12: in the 대회's hours 가락 is sent from his counter to the tent, held on that walk -- shown on the island then; every run 13:35~15:00) */
    expect(d.walkersAway.every((n) => away.includes(n)), JSON.stringify(d.walkersAway)).toBe(true); expect(d.shownAway).toBeLessThanOrEqual(d.walkersAway.filter((n) => held.includes(n)).length); /* (none but one so held: at the tent he is hidden again) */
    expect(away.some((n) => d.walking.includes(n) && !held.includes(n)), 'a counter walker walking').toBe(false);
    await expect.poll(async () => (await page.evaluate(() => window.PlazaDebug().roster())).quests.find((q) => q.id === 'questfisher'), { timeout: 30000 }).toEqual({ id: 'questfisher', post: 'mall1', walker: null, shown: false });
    const { rest } = R.deskRest(day);
    expect(d.desks).toEqual(['civil', 'tax', 'bank', 'rename'].map((k) => ({ desk: k, shown: k !== rest, sign: k === rest }))); /* (v1.10.288: 다래 at 개명, four in turn) */
    // C2: that day's walkers out (no one at a post), 꽃님 walking with her mark, 철이 at the station
    const walking = Array.from({ length: Cast.RESIDENTS.length }, (_, n) => n).filter((n) => R.walks(n, day));
    await expect.poll(async () => (await page.evaluate(() => window.PlazaDebug().roster())).walking, { timeout: 30000 }).toEqual(walking); /* (the contest clock past its tent above: #395 23a2f63d -- one fix kept, 0cc0cdeb's allowance taken out) */
    await expect.poll(async () => (await page.evaluate(() => window.PlazaDebug().roster())).quests.find((q) => q.id === 'questgranny'), { timeout: 30000 }).toEqual({ id: 'questgranny', post: null, walker: 10, shown: false });
    await expect.poll(async () => (await page.evaluate(() => window.PlazaDebug().roster())).marks.some((m) => m.n === 10), { timeout: 30000 }).toBe(true);
    await expect.poll(async () => (await page.evaluate(() => window.PlazaDebug().roster())).station, { timeout: 30000 }).toEqual({ shown: true, resident: 'cheori' });
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
    await request.post('/api/test/island/free-residents', { headers: { 'X-Session-Token': who.token }, data: {} }); // (an islander's event may hold the stand's walker: RESIDENT_BUSY, no talk -- 237 local run)
    await dialog.locator('.postKeeperRow .postTalkBtn').click();
    await expect(page.locator('#plazaDialogTitle')).toContainText(name(r.posts.plaza), { timeout: 30000 }); await revealTalk(page);
    await shot(page, 'attendance-talk');
    await shut();
    await expect.poll(async () => { if (await dialog.getByRole('button', { name: '섬 안내' }).isVisible()) return true; await page.evaluate(() => window.PlazaDebug().place('attendance')); await page.waitForTimeout(600); await spaceOn(page, 'attendance', isMobile); await page.waitForTimeout(800); return dialog.getByRole('button', { name: '섬 안내' }).isVisible(); }, { timeout: 30000 }).toBe(true);
    await shot(page, 'attendance-guide-btn', 300);
    await dialog.getByRole('button', { name: '섬 안내' }).click();
    await expect(page.locator('#plazaDialogTitle')).toHaveText(`출석·안내 · ${name(r.posts.plaza)}`);
    await expect(page.getByRole('button', { name: '처음부터 다시 배우기' })).toBeVisible();
    await shot(page, 'attendance-guide', 600);
    await shut();
    // C2: 꽃님 walking -- her talk, her 부탁 in it (as at her garden)
    // (CI #389·#392: no errand of hers on `day` (fits) -- her talk opens on its choices; an islander's event may hold her
    // (RESIDENT_BUSY): let go before each try, as resident-talk does)
    await expect.poll(async () => { if (await dialog.locator('[data-topic="quest"]').isVisible()) return true; if (await page.evaluate(() => Boolean(document.querySelector('.lostRequest.talkWaiting') || document.querySelector('#plazaDialog[open].talkMode')))) { await revealTalk(page); return dialog.locator('[data-topic="quest"]').isVisible(); } /* (a talk on its way or open: not stood by them again -- a second teleport put me 6.1 m off where the server held her, the first keep closed it: 검토 docs/resident-roster-87-20261111.md) */ await request.post('/api/test/island/free-residents', { headers: { 'X-Session-Token': who.token }, data: {} }); await page.evaluate(() => window.PlazaDebug().talkResident(10)); await page.waitForTimeout(1500); await revealTalk(page); return dialog.locator('[data-topic="quest"]').isVisible(); }, { timeout: 90000 }).toBe(true);
    await expect(page.locator('#plazaDialogTitle')).toContainText('꽃님');
    await shot(page, 'walk-kkotnim');
    await dialog.locator('[data-topic="quest"]').click(); await revealTalk(page);
    await expect(dialog).toContainText('할게요', { timeout: 30000 });
    await shot(page, 'walk-quest');
    await shut();
    // C2 (photo): one of the 17 out walking in their day-off look -- the resting clerk
    if (process.env.SHOT_DIR) {
      const rest = r.resting; const w = (await page.evaluate(() => window.PlazaDebug().wanderersAt(true))).find((o) => o.n === rest);
      if (w) { await page.evaluate((w) => { const p = window.PlazaDebug(); p.teleport(w.x + 2.6, w.z + 3.4); p.setCamYaw(Math.atan2(2.6, 3.4) - 0.3); }, w); await shot(page, 'walk-off', 2500); }
    }
    // C2: 철이 at the station (a weekday, his 부탁 not this week) -- talked to there
    await expect.poll(async () => { if (await page.locator('#plazaDialogTitle').textContent().then((t) => t.includes('철이 · 달마루역')) && await dialog.isVisible()) return true; await page.evaluate(() => { const at = window.IslandTerrain.VILLAGE.stationmaster; window.PlazaDebug().teleport(at.x + 1.2, at.z + 1.2); }); await page.waitForTimeout(700); await spaceOn(page, 'station:keeper', isMobile); await page.waitForTimeout(900); return false; }, { timeout: 40000 }).toBe(true);
    await shot(page, 'station');
    await shut();
    // 느티 at the 정자 (the tests' 부탁 week not his: the day keeper)
    const G = await page.evaluate(() => window.IslandTerrain.VILLAGE.grandpa);
    await expect.poll(async () => { await page.evaluate(([x, z]) => { const p = window.PlazaDebug(); p.teleport(x, z); p.setCamYaw?.(Math.PI / 2); }, [G.x + 1.1, G.z]); await page.waitForTimeout(700); return page.locator('#plazaHint').textContent(); }, { timeout: 30000, intervals: [500] }).toContain(name(r.posts.pavilion));
    if (process.env.SHOT_DIR) { await page.evaluate(([x, z]) => { const p = window.PlazaDebug(); p.teleport(x + 3, z + 1.6); p.setCamYaw?.(Math.atan2(3, 1.6) + 0.45); }, [G.x, G.z]); await shot(page, 'pavilion', 2000); } // (stood off: my figure not before his)
    // the 박물관: its 관장 the day's, by name
    for (let k = 0; k < 6 && await page.evaluate(() => window.PlazaDebug().space) !== 'museum'; k += 1) { await page.evaluate(() => { const d = window.PlazaDebug(); const w = d.doors.museum; if (w) d.teleport(w.x, w.z); else d.place('museum'); }); await page.waitForTimeout(700); await spaceOn(page, 'museum', isMobile); await page.waitForTimeout(1500); }
    expect(await page.evaluate(() => window.PlazaDebug().space)).toBe('museum');
    await expect.poll(async () => { await page.evaluate(() => { const M = window.IslandMuseum; const t = M.world(M.TALK.lx, M.TALK.lz); const c = M.world(M.CURATOR.lx, M.CURATOR.lz); const p = window.PlazaDebug(); p.teleport(t.x, t.z); p.setCamYaw?.(Math.atan2(t.x - c.x, t.z - c.z)); const g = document.getElementById('plazaDialog'); if (g.open) g.close(); }); /* (the 안내판 opens on the walk in) */ await page.waitForTimeout(700); return page.locator('#plazaHint').textContent(); }, { timeout: 30000, intervals: [500] }).toContain(`박물관 · ${name(r.posts.museum)} · 말 걸기`);
    await shot(page, 'museum-curator');
    await expect.poll(async () => { await page.evaluate(() => { const g = document.getElementById('plazaDialog'); if (g.open) g.close(); const p = window.PlazaDebug(); const k = p.doors['museum:exit']; p.teleport(k.x, k.z); }); /* (the 안내판 by the way out opens on the walk there) */ await page.waitForTimeout(600); await spaceOn(page, 'museum:exit', isMobile); await page.waitForTimeout(900); return page.evaluate(() => window.PlazaDebug().space); }, { timeout: 40000 }).toBe('island');
    // the 1st floor's counter: 물결's hello, his 부탁 there
    await intoMall(page, null, isMobile);
    await expect.poll(async () => { if (await dialog.locator('.postTalkBtn').isVisible()) return true; await page.evaluate(() => { const p = window.PlazaDebug(); const k = p.doors['mall:store']; p.teleport(k.x, k.z); }); await page.waitForTimeout(600); await spaceOn(page, 'mall:store', isMobile); await page.waitForTimeout(800); return dialog.locator('.postTalkBtn').isVisible(); }, { timeout: 30000 }).toBe(true);
    await expect(page.locator('#plazaDialogTitle')).toContainText('물결 · 잡화·생활');
    await expect(page.locator('#bagGrowBtn')).toBeAttached(); // (the 잡화점's own 가방 늘리기 still there)
    await shot(page, 'mall1-hello');
    await dialog.locator('.postTalkBtn').click(); await revealTalk(page); // (C2: his own talk, the 부탁 in it)
    await expect(page.locator('#plazaDialogTitle')).toContainText('물결', { timeout: 30000 });
    await dialog.locator('[data-topic="quest"]').click(); await revealTalk(page);
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
    await request.post('/api/test/roster', { data: { on: false } }); await request.post('/api/test/contest/clock', { data: { to: 'reset' } });
    if (process.env.SHOT_DIR) { await set('time', 'auto'); await set('weather', 'auto'); }
  }
});
