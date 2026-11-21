const { test, expect } = require('@playwright/test');
const { shopper, post, expectNoScriptError } = require('./skin-support');

// 1.10.390 N3-b 자연 구역 탐방선 (notes docs/n3-plan-20261120.md §4-2, 사용자 결정 37): the one flow -- SPACE by 배 타는 곳's float boards
// (free), the boat holds, crosses under the high 윤슬다리 and lets me off on 별마루섬 부두's float; 별마루섬 then has three, one goes back
// empty and it ends two and two. The crossing four times quicker in the tests (/api/test/boats). Rules: unit island-boat. PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');
test('탐방선: 배 타는 곳에서 타기 → 곧 출발 → 다리 밑으로 건너 → 별마루섬 부두에 내림 → 빈 배 하나 돌아가 2척 / 2척', async ({ browser, request }) => {
  test.setTimeout(240000);
  const a = await shopper(browser, request, '뱃손님', 0, 'female'); const { page, token } = a;
  expect((await post(request, '/api/test/boats', token, { scale: 4 })).status).toBe(200);
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().boats().state?.boats?.length || 0), { timeout: 30000 }).toBe(4);
  const shown = () => page.evaluate(() => window.PlazaDebug().boats());
  // the boats drawn at their berths: two at each dock
  await page.evaluate(() => window.PlazaDebug().teleport(0, 1.5)); await page.waitForTimeout(1500);
  { const s = await shown(); const near = s.shown.filter((b) => b.visible && Math.hypot(b.x, b.z - 4.85) < 6); expect(near.length).toBe(2); }
  // SPACE on the float: aboard, the hint 「내리기 · 곧 출발」
  await expect.poll(async () => { await page.evaluate(() => window.PlazaDebug().teleport(0, 1.5)); return page.locator('#plazaHint').textContent(); }, { timeout: 15000 }).toContain('타기');
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect.poll(async () => (await shown()).mine, { timeout: 15000 }).not.toBeNull();
  const mine = (await shown()).mine;
  // crossing: the boat leaves the dock and passes under the bridge; I sit on its seat
  let under = false; let far = 0; let sailed = 0;
  await expect.poll(async () => { const s = await page.evaluate(() => { const d = window.PlazaDebug(); return { ...d.boats(), me: { x: d.x, z: d.z } }; }); const b = s.shown.find((x) => x.id === mine.id); /* (one look: the boat and me in the same frame) */
    if (b?.x != null && s.mine) { if (Math.hypot(b.x - 59.35, b.z - 140) < 12) under = true; far = Math.max(far, Math.hypot(s.me.x - b.x, s.me.z - b.z)); if (s.state.boats.find((x) => x.id === mine.id)?.phase === 'sail') sailed += 1; }
    return s.mine; }, { timeout: 60000, intervals: [100] }).toBeNull();
  expect(sailed, 'seen crossing').toBeGreaterThan(3);
  expect(under, 'under the high bridge').toBe(true); expect(far, 'seated in it').toBeLessThan(2.5);
  // off on 별마루섬 부두's float
  await expect.poll(() => page.evaluate(() => { const d = window.PlazaDebug(); return Math.hypot(d.x - 223.6, d.z - 197) < 7; }), { timeout: 15000 }).toBe(true);
  // quiet: two and two again (the third at 별마루섬 went back empty)
  await expect.poll(async () => { const s = (await shown()).state; return ['dal', 'byeol'].map((d) => s.boats.filter((b) => b.at === d && b.phase === 'docked').length).join('/'); }, { timeout: 30000 }).toBe('2/2');
  await expectNoScriptError(page); await a.context.close();
});
