const { test, expect } = require('@playwright/test');
const { shopper, get, post, adminToken, expectNoScriptError, spaceOn, revealTalk, holdTool } = require('./skin-support');
const P = require('../../public/plaza/island-projects.js');
test.skip(({ isMobile }) => isMobile, 'PC 실행이 같은 확인을 함 (v1.10.269 시험 정리: docs/test-audit-20261107.md)');

// v1.10.277 시험 정리 2차 (docs/test-audit-20261107.md §6): 섬 가꾸기 1·2·3 one player, one page -- each part sets the
// projects it needs (reset, open) and reloads, as its own spec did.
// v1.10.222 섬 가꾸기 사업 (gamecenter-notes docs/spending-sinks-20261025.md ①): the 기부함 shows the project filling (mine, the
// savings); filled -- its works that day (the fence round the fountain, the sign, 바위 by it to talk to: the roster on); the next
// day open -- the new fountain in the old one's place, a sign before it, SPACE: who gave; then the flower path. PC and phone;
// with SHOT_DIR the photos (the fountain's works and open, the flower path from above too).
// v1.10.223 섬 가꾸기 2 (gamecenter-notes docs/spending-sinks-20261025.md ①): after the first two, the mayor at the 관공서 gate puts
// the next to a day's vote (one ballot each); the 민원 창구 takes a 기부 into the project too; 물가 거리 -- lamps and benches by
// 윤슬만 (sat on); 야경 조명 -- bulbs over the pier road and lights on the ground, lit at night only. PC and phone; SHOT_DIR photos.
// v1.10.224 섬 가꾸기 3 (gamecenter-notes docs/spending-sinks-20261025.md ①): 동쪽 강 새 다리 -- walked over the gorge to the east
// meadow; 능선 전망대 -- SPACE at its back step looks through the telescope at the glacier (Esc back); 야경 조명's lights throw
// a soft beam up the fountain and the lighthouse by night (총괄 223 검토). PC and phone; SHOT_DIR photos (night before/after).
test('섬 가꾸기 1·2·3: 기부함·공사·열림·꽃길, 시장 투표·민원 창구·물가 거리·야경, 새 다리·낚시터·전망대·밤 투광등', async ({ browser, request, isMobile }) => {
  test.setTimeout(600000);
  const a = await shopper(browser, request, isMobile ? '섬가꿈m' : '섬가꿈', 3000000, 'female'); const { page } = a;
  // (CI: a long walk between two calls -- the server had closed the idle connection the next one was sent on, ECONNRESET, and the
  // island stayed at night for the tests after: each call tried again on that)
  const again = async (fn) => { for (let k = 0; ; k += 1) { try { return await fn(); } catch (error) { if (k >= 2 || !/ECONNRESET|socket hang up/.test(String(error?.message))) throw error; } } };
  const tp = (body) => again(() => post(request, '/api/test/projects', a.token, body));
  const admin = await again(() => adminToken(request)); const time = (mode) => again(() => request.post('/api/admin/island/time', { headers: { 'X-Session-Token': admin }, data: { mode } }));
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); localStorage.setItem('gc.view.out', 'third'); });
  const shot = async (name, wait = 1500) => { if (!process.env.SHOT_DIR) return; await page.waitForTimeout(wait); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-${name}.png` }); };
  const scene = () => page.evaluate(() => window.PlazaDebug().projects());
  { // 1 (v1.10.222)
    expect((await tp({ reset: true })).status).toBe(200);
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
    
    await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
    const shot = async (name, wait = 1500) => { if (!process.env.SHOT_DIR) return; await page.waitForTimeout(wait); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-${name}.png` }); };
    const scene = () => page.evaluate(() => window.PlazaDebug().projects());
    // the 기부함 (its own box: the server takes a 기부 there only): 400,000 -- the bar and mine
    const atBox = async () => { await page.evaluate(async () => { const d = window.PlazaDebug().doors.donate; await window.PlazaWarp(d.x, d.z); window.PlazaDebug().place('donate'); }); await spaceOn(page, '', isMobile); await expect(page.locator('#donationDialog')).toBeVisible(); };
    const give = async (amount) => { await page.locator('#donationAmount').fill(String(amount)); await page.locator('#donationSubmit').click(); const done = page.waitForResponse((r) => r.url().endsWith('/api/donation') && r.request().method() === 'POST'); await page.locator('#donationSubmit').click(); expect((await done).status()).toBe(200); };
    await atBox(); await give(400000);
    const bar = page.locator('#donationProject'); await expect(bar).toContainText('대청마당 분수 새 단장'); await expect(bar).toContainText('400,000P / 1,000,000P'); await expect(bar).toContainText('내가 보탠 400,000P');
    await shot('donation-bar', 600);
    // filled (and 100,000 over: saved) -- the works today
    await give(700000);
    await expect(bar).toContainText('공사 중'); await expect(bar).toContainText('적립 100,000P');
    await page.locator('#donationCloseBtn').click();
    const day = (await tp({})).data.day; await request.post('/api/test/roster', { data: { on: true, day } });
    await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
    try {
      await expect.poll(async () => (await scene()).bits, { timeout: 20000 }).toEqual(['works:fountain']);
      await expect.poll(async () => (await scene()).keeper, { timeout: 20000 }).toBe(true);
      const k = P.SITES.fountain.keeper; await page.evaluate(([x, z]) => { const g = window.PlazaDebug(); g.teleport(x + 0.3, z + 0.9); g.setCamYaw(0.25); g.setCamPitch?.(0.12); }, [k.x, k.z]);
      await shot('works');
      // (CI #397: 「SPACE · 말 걸기」 took the hint -- 검토: 분수 옆 사진 행사 NPC, 1.28 m; at 0.95 m from 바위 its door (atDoor) wins)
      await expect.poll(async () => { if ((await page.locator('#plazaHint').textContent())?.includes('바위')) return true; await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x + 0.3, z + 0.9), [k.x, k.z]); await page.waitForTimeout(600); return (await page.locator('#plazaHint').textContent())?.includes('바위'); }, { timeout: 30000 }).toBe(true); await expect.poll(() => spaceOn(page, 'works:keeper', isMobile), { timeout: 10000 }).toBe(true); await revealTalk(page);
      await expect(page.locator('#plazaDialog')).toContainText('내일이면 분수가 열려요'); await expect(page.locator('#plazaDialog')).not.toContainText('둘러볼게요'); await expect(page.locator('#plazaDialog')).not.toContainText('{me}'); /* (총괄 222 검토 1: their own talk, no shop) */ await shot('works-talk', 600);
      await page.keyboard.press('Escape');
    } finally { await request.post('/api/test/roster', { data: { on: false } }); }
    // the next day: open -- the new fountain, its sign; SPACE at it: who gave
    expect((await tp({ nextDay: true })).data.state.open.map((o) => o.id)).toEqual(['fountain']);
    await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
    await expect.poll(async () => (await scene()).bits, { timeout: 20000 }).toEqual(['open:fountain']); expect((await scene()).dropTop).toBeGreaterThan(2.5);
    const q = P.SITES.fountain.plaque; await page.evaluate(([x, z]) => { const g = window.PlazaDebug(); g.teleport(x + 1.2, z + 3.4); g.setCamYaw(0.3); g.setCamPitch?.(0.15); }, [q.x, q.z]);
    await shot('fountain-open');
    await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z + 1), [q.x, q.z]); await expect.poll(() => spaceOn(page, 'plaque:fountain', isMobile), { timeout: 10000 }).toBe(true); await revealTalk(page);
    await expect(page.locator('#plazaDialog')).toContainText(isMobile ? '섬가꿈m' : '섬가꿈'); await shot('plaque', 600); await page.keyboard.press('Escape');
    // the flower path: filled from the savings and a 기부, works, open
    const v = (await get(request, '/api/island/projects', a.token)).data; expect([v.cur.id, v.cur.raised]).toEqual(['flower_path', 100000]);
    await atBox(); await give(1400000); await page.locator('#donationCloseBtn').click();
    expect((await tp({ nextDay: true })).data.state.open.map((o) => o.id)).toEqual(['fountain', 'flower_path']);
    await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
    await expect.poll(async () => (await scene()).bits, { timeout: 20000 }).toEqual(['open:flower_path', 'open:fountain']);
    const s = P.PLANTERS[0]; await page.evaluate(([x, z]) => { const g = window.PlazaDebug(); g.teleport(x - 3, z + 4); g.setCamYaw(2.2); g.setCamPitch?.(0.2); }, [s.x, s.z]);
    await shot('flower-path', 2500);
    if (process.env.SHOT_DIR) { await page.evaluate(([x, z]) => window.PlazaDebug().overview(true, [x, 45, z]), [(P.PLANTERS[0].x + P.PLANTERS[P.PLANTERS.length - 1].x) / 2, (P.PLANTERS[0].z + P.PLANTERS[P.PLANTERS.length - 1].z) / 2]); await shot('flower-path-above', 2500); await page.evaluate(() => window.PlazaDebug().overview(false)); }
    await tp({ reset: true });
  }
  { // 2 (v1.10.223)
    await tp({ reset: true }); await tp({ open: ['fountain', 'flower_path'] });
    await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
    try {
      await time('day');
      // the mayor: today's vote -- a ballot, then changed
      await page.evaluate(() => window.PlazaDebug().place('mayor')); await expect.poll(() => spaceOn(page, 'mayor', isMobile), { timeout: 10000 }).toBe(true); await revealTalk(page);
      const choices = page.locator('#plazaDialog .voteChoice'); await expect(choices).toHaveCount(3); /* (224: 새 다리 on it too) */
      await choices.filter({ hasText: '물가 거리' }).click(); await expect(choices.filter({ hasText: '물가 거리' })).toHaveClass(/mine/); await expect(choices.filter({ hasText: '물가 거리' })).toContainText('1표');
      await shot('vote', 600);
      await page.locator('#plazaDialog button', { hasText: '용무가 있습니다' }).click(); // (the gate's pass: in to the 민원 창구)
      // the 민원 창구: given there -- into the vote day's savings
      await expect(page.locator('#plazaDialog')).toBeHidden({ timeout: 10000 });
      await expect.poll(async () => { const at = await page.evaluate(() => window.PlazaDebug().space); if (at === 'townhall') return at; await page.evaluate(() => window.PlazaDebug().place('townhall')); await page.waitForTimeout(400); await spaceOn(page, 'townhall', isMobile); await page.waitForTimeout(1500); return page.evaluate(() => window.PlazaDebug().space); }, { timeout: 30000 }).toBe('townhall');
      await page.evaluate(() => { const c = window.IslandTerrain.plazaProps().seats.find((x) => x.id === 'c-civil'); window.PlazaDebug().teleport(c.x, c.z + 1.1); });
      await expect.poll(() => spaceOn(page, 'seat:c-civil', isMobile), { timeout: 10000 }).toBe(true);
      const give = page.locator('#projectGive'); await expect(give).toBeVisible({ timeout: 10000 }); await expect(give).toContainText('다음 사업');
      await page.locator('#projectGiveAmount').fill('50000'); await page.locator('#projectGiveBtn').click();
      await expect(page.locator('#islandPlaceStatus')).toContainText('50,000P 보탰어요'); await expect(give).toContainText('적립 50,000P');
      await shot('desk-give', 600);
      await page.keyboard.press('Escape');
      await expect.poll(async () => { const at = await page.evaluate(() => window.PlazaDebug().space); if (at === 'island') return at; await page.keyboard.press('Escape').catch(() => {}); await page.evaluate(() => window.PlazaDebug().place('room:exit')); await page.waitForTimeout(400); await spaceOn(page, 'room:exit', isMobile); await page.waitForTimeout(1500); return page.evaluate(() => window.PlazaDebug().space); }, { timeout: 30000 }).toBe('island'); // (out again)
      // 물가 거리 and 야경 조명 open: a bench sat on; the lights dark by day, lit at night
      await tp({ open: ['promenade', 'night_lights'] }); await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
      await expect.poll(async () => (await scene()).bits, { timeout: 20000 }).toEqual(['open:flower_path', 'open:fountain', 'open:night_lights', 'open:promenade']);
      expect((await scene()).seats).toBe(P.PROMENADE_SEATS.length);
      const u = P.PROMENADE[2]; await page.evaluate(([x, z, yaw]) => { const g = window.PlazaDebug(); g.teleport(x + Math.sin(yaw) * 2.6, z + Math.cos(yaw) * 2.6); g.setCamYaw(yaw + 0.5); g.setCamPitch?.(0.1); }, [u.x, u.z, u.yaw]);
      await shot('promenade');
      const s = P.PROMENADE_SEATS[2]; await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [s.x, s.z]); await expect.poll(() => spaceOn(page, `seat:${s.id}`, isMobile), { timeout: 10000 }).toBe(true);
      await expect.poll(() => page.evaluate(() => window.PlazaDebug().act().sitting), { timeout: 10000 }).toBeTruthy();
      await shot('promenade-sit');
      expect(await page.evaluate(() => window.IslandAssets.REGISTRY['project.string_lights'].nightGlow)).toBe(true); // (lit by the loader at night, as windows)
      await time('night'); await expect.poll(async () => (await scene()).night, { timeout: 30000 }).toBe(true);
      const st = P.STRINGS[1]; await page.evaluate(([x, z]) => { const g = window.PlazaDebug(); g.teleport(x + 3, z + 6); g.setCamYaw(0.4); g.setCamPitch?.(0.15); }, [st.x, st.z]);
      await shot('night-lights', 2500);
      await page.evaluate(() => { const g = window.PlazaDebug(); g.place('mayor'); }); await page.evaluate(([x, z]) => { const g = window.PlazaDebug(); g.teleport(x, z + 7); g.setCamYaw(0.2); g.setCamPitch?.(0.2); }, [P.UPLIGHTS[0].x, P.UPLIGHTS[0].z]);
      await shot('night-fountain', 2500);
    } finally { await time('auto'); await tp({ reset: true }); }
  }
  { // 3 (v1.10.224)
    await tp({ reset: true }); await tp({ open: ['fountain', 'flower_path', 'promenade', 'night_lights', 'bridge', 'lookout'] });
    await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
    try {
      await time('day');
      await expect.poll(async () => (await scene()).bits, { timeout: 20000 }).toContain('open:lookout'); expect((await scene()).bridge).toBe(true);
      // the bridge: on its middle, over the water -- up its arch
      const B = P.BRIDGE; await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [B.x, B.z]); await page.waitForTimeout(600);
      const on = await page.evaluate(() => ({ x: window.PlazaDebug().x, z: window.PlazaDebug().z, y: window.PlazaDebug().y ?? window.PlazaDebug().pose?.().y }));
      expect(Math.hypot(on.x - B.x, on.z - B.z)).toBeLessThan(0.6); expect(await page.evaluate(([x, z]) => window.IslandTerrain.walkable(x, z), [B.x, B.z])).toBe(true);
      const lookAt = (px, pz, tx, tz, pitch = 0.12) => page.evaluate(([px, pz, tx, tz, pitch]) => { const g = window.PlazaDebug(); g.teleport(px, pz); g.setCamYaw(Math.atan2(-(tx - px), -(tz - pz))); g.setCamPitch?.(pitch); }, [px, pz, tx, tz, pitch]);
      await page.evaluate(([yaw]) => window.PlazaDebug().setCamYaw(yaw), [B.yaw]); await shot('bridge-on'); // (on it, toward 강 어귀 낚시터 and the sea)
      await page.evaluate(([yaw]) => window.PlazaDebug().setCamYaw(yaw + Math.PI * 0.55), [B.yaw]); await shot('bridge-on-upriver'); // (from it, up 은하내)
      await lookAt(152.5, -5.5, B.x, B.z); await shot('bridge-side'); // (from the walk's end on the bank)
      if (process.env.SHOT_DIR) { await page.evaluate(([x, z]) => window.PlazaDebug().overview(true, [x, 34, z]), [B.x - 4, B.z + 2]); await shot('bridge-above', 2500); await page.evaluate(() => window.PlazaDebug().overview(false)); }
      // 강 어귀 낚시터: across it, the rod in hand -- SPACE fishes there (the map names it)
      expect((await post(request, '/api/test/island/give', a.token, { itemId: 'fishing_rod', qty: 1 })).status).toBe(200);
      await holdTool(page, 'fishing_rod');
      const S = P.FISHING_SPOT; await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x, z), [S.x, S.z]);
      await expect.poll(() => page.evaluate(() => Boolean(window.PlazaDebug().doors?.['fish:mouth'])), { timeout: 10000 }).toBe(true);
      await expect.poll(async () => { if (await page.evaluate(() => window.PlazaDebug().fishing())) return true; await spaceOn(page, 'fish:', isMobile); await page.waitForTimeout(1200); return Boolean(await page.evaluate(() => window.PlazaDebug().fishing())); }, { timeout: 20000 }).toBe(true);
      await shot('fishing', 1800);
      // (총괄 224 CI: the line still out when one walks off holds SPACE to it -- reeled in and the rod put away first)
      await expect.poll(async () => { if (!(await page.evaluate(() => window.PlazaDebug().fishing()))) return true; await spaceOn(page, 'fish:', isMobile); await page.waitForTimeout(1500); return !(await page.evaluate(() => window.PlazaDebug().fishing())); }, { timeout: 30000 }).toBe(true);
      await page.keyboard.press('KeyI'); await page.locator('.islandBagSlot[data-item="fishing_rod"]').first().click(); await page.locator('#islandBagGrid button', { hasText: '넣기' }).first().click(); await expect.poll(() => page.evaluate(() => window.PlazaDebug().heldTool()), { timeout: 10000 }).toBeNull();
      // the lookout: SPACE at its back step -- through the telescope; Esc back
      const L = P.LOOKOUT; await page.evaluate(([x, z]) => { const g = window.PlazaDebug(); g.teleport(x + 6, z + 4); g.setCamYaw(1.0); g.setCamPitch?.(0.15); }, [L.x, L.z]);
      await shot('lookout');
      await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x + 0.6, z), [L.door.x, L.door.z]);
      await expect.poll(() => spaceOn(page, 'lookout:scope', isMobile), { timeout: 10000 }).toBe(true);
      await expect.poll(async () => (await scene()).scope, { timeout: 5000 }).toBe(true); await shot('scope', 2500);
      if (isMobile) await page.locator('.scopeFrame button').click(); else await page.keyboard.press('Escape');
      await expect.poll(async () => (await scene()).scope, { timeout: 5000 }).toBe(false);
      // night: the beams at the fountain and the lighthouse (before: hidden for the photo; after: as they are)
      await time('night'); await expect.poll(async () => (await scene()).beams, { timeout: 30000 }).toBe(P.UPLIGHTS.length);
      const u = P.UPLIGHTS[0]; const H = P.UPLIGHTS[4];
      for (const [name, at, yaw] of [['fountain', [u.x, u.z + 8], 0.1], ['lighthouse', [H.x + 6, H.z + 9], 0.6]]) {
        await page.evaluate(([x, z, yw]) => { const g = window.PlazaDebug(); g.teleport(x, z); g.setCamYaw(yw); g.setCamPitch?.(0.25); }, [...at, yaw]);
        if (process.env.SHOT_DIR) { await page.evaluate(() => window.PlazaDebug().beams(false)); await shot(`night-${name}-before`, 2500); await page.evaluate(() => window.PlazaDebug().beams(true)); await shot(`night-${name}-after`, 800); }
      }
      await time('day'); await expect.poll(async () => (await scene()).beams, { timeout: 30000 }).toBe(0);
    } finally { await time('auto'); await tp({ reset: true }); }
  }
  await expectNoScriptError(page); await a.context.close();
});
