const { test, expect } = require('@playwright/test');
const { shopper, adminToken, spaceOn } = require('./skin-support');

// v1.10.218 사진 (SHOT_DIR only; 총괄 「대화 때 주민이 등을 보여요」 -- 가람·꽃님·물결·콩이·고은 walking on 2026-11-13, then 한들·
// 꽃님·물결·고은 at their quest spots): each talked to, seen by the talk's own camera (3인칭: beside me) and face to face (1인칭), with how much of the face
// the camera sees (FACE lines); BEFORE=1 against an older server
const tag = () => `${test.info().project.name}-${process.env.BEFORE ? 'before' : 'after'}`;

test('사진: 대화 중 주민 앞·옆 모습', async ({ browser, request, isMobile }) => {
  test.skip(!process.env.SHOT_DIR, 'SHOT_DIR only');
  test.setTimeout(600000);
  await request.post('/api/test/roster', { data: { on: true, day: '2026-11-13' } });
  const admin = await adminToken(request); const set = (what, mode) => request.post(`/api/admin/island/${what}`, { headers: { 'X-Session-Token': admin }, data: { mode } });
  const who = await shopper(browser, request, isMobile ? '대화얼굴m' : '대화얼굴', 0, 'female'); const { page } = who;
  const talking = () => page.evaluate(() => /talkMode/.test(document.getElementById('plazaDialog').className));
  try {
    await set('time', 'day'); await set('weather', 'clear');
    for (const view of ['third', 'first']) {
      await page.evaluate((v) => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); localStorage.setItem('gc.view.out', v); }, view);
      await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true); await page.waitForTimeout(3000);
      for (const n of [9, 10, 11, 14, 15, 'handeul', 'kkotnim', 'mulgyeol', 'goeun']) {
        const tryTalk = typeof n === 'string' /* (at their quest spots) */
          ? async () => { const p = (await page.evaluate(() => window.PlazaDebug().residentPosts())).find((x) => x.resident === n); if (!p) return; await page.evaluate((d) => { const g = window.PlazaDebug(); g.teleport(d.x + 0.9, d.z + 0.9); g.setCamYaw(Math.atan2(0.9, 0.9)); }, p); await page.waitForTimeout(600); await spaceOn(page, '', isMobile); }
          : () => page.evaluate((k) => window.PlazaDebug().talkResident(k), n);
        await expect.poll(async () => { if (await talking()) return true; await tryTalk(); await page.waitForTimeout(1500); return talking(); }, { timeout: 30000 }).toBe(true).catch(async () => console.log(`NOTALK ${tag()} ${view} ${n} ${JSON.stringify(await page.evaluate(() => window.PlazaDebug().residentPosts()))}`));
        await page.waitForTimeout(1500);
        console.log(`FACE ${tag()} ${view} ${n} ${JSON.stringify(await page.evaluate(() => window.PlazaDebug().faceSeen?.() ?? null))}`);
        await page.screenshot({ path: `${process.env.SHOT_DIR}/${tag()}-${view}-${n}.png` });
        await page.keyboard.press('Escape'); await page.waitForTimeout(800);
      }
    }
  } finally { await set('time', 'auto'); await set('weather', 'auto'); await request.post('/api/test/roster', { data: { on: false } }); }
  await who.context.close();
});
