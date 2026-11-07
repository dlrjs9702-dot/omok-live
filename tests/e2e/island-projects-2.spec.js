const { test, expect } = require('@playwright/test');
const { shopper, post, adminToken, expectNoScriptError, spaceOn, revealTalk } = require('./skin-support');
const P = require('../../public/plaza/island-projects.js');
test.skip(({ isMobile }) => isMobile, 'PC 실행이 같은 확인을 함 (v1.10.269 시험 정리: docs/test-audit-20261107.md)');

// v1.10.223 섬 가꾸기 2 (gamecenter-notes docs/spending-sinks-20261025.md ①): after the first two, the mayor at the 관공서 gate puts
// the next to a day's vote (one ballot each); the 민원 창구 takes a 기부 into the project too; 물가 거리 -- lamps and benches by
// 윤슬만 (sat on); 야경 조명 -- bulbs over the pier road and lights on the ground, lit at night only. PC and phone; SHOT_DIR photos.
test('섬 가꾸기 2: 마루 시장 투표, 민원 창구 보태기, 물가 거리 벤치, 야경 조명(밤만)', async ({ browser, request, isMobile }) => {
  test.setTimeout(300000);
  const a = await shopper(browser, request, isMobile ? '투표미m' : '투표미', 3000000, 'female'); const { page } = a;
  const again = async (fn) => { for (let k = 0; ; k += 1) { try { return await fn(); } catch (error) { if (k >= 2 || !/ECONNRESET|socket hang up/.test(String(error?.message))) throw error; } } }; // (an idle connection closed under a long walk: tried again -- island-projects-3)
  const tp = (body) => again(() => post(request, '/api/test/projects', a.token, body));
  const admin = await again(() => adminToken(request)); const time = (mode) => again(() => request.post('/api/admin/island/time', { headers: { 'X-Session-Token': admin }, data: { mode } }));
  await tp({ reset: true }); await tp({ open: ['fountain', 'flower_path'] });
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); localStorage.setItem('gc.view.out', 'third'); }); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  const shot = async (name, wait = 1500) => { if (!process.env.SHOT_DIR) return; await page.waitForTimeout(wait); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-${name}.png` }); };
  const scene = () => page.evaluate(() => window.PlazaDebug().projects());
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
  await expectNoScriptError(page); await a.context.close();
});
