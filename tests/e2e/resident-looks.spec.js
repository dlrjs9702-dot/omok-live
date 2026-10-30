const { test, expect } = require('@playwright/test');
const { shopper, adminToken, spaceOn, expectNoScriptError } = require('./skin-support');

// v1.10.213 주민 근무표 A (assets 84·83·88): every post in its islander's own model -- the story islanders where their
// stories stand, the mayor at the 관공서 gate, the 관공서's three desks, the jail's warden -- and the ten walking ones in
// their new legs and hands. With SHOT_DIR: each one standing, talked to up close, the walkers walking (in daylight,
// no rain -- put back after). PC and phone.
test('주민 모습: 자리마다 그 주민 모델, 서 있기·대화 가까이·걷기', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.SHOT_DIR ? 600000 : 240000);
  const who = await shopper(browser, request, isMobile ? '주민구경m' : '주민구경', 0, 'female'); const { page } = who;
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); localStorage.setItem('gc.view.out', 'third'); });
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  // the posts (the rooms built too): each its islander, the model on
  await page.evaluate(() => window.PlazaDebug().counterFacing());
  await expect.poll(async () => (await page.evaluate(() => window.PlazaDebug().residentPosts())).filter((p) => !p.model).map((p) => p.resident), { timeout: 60000 }).toEqual([]);
  const posts = await page.evaluate(() => window.PlazaDebug().residentPosts());
  expect(posts.map((p) => p.resident)).toEqual(expect.arrayContaining(['maru', 'danbi', 'hansol', 'saerom', 'useong']));
  expect(posts.length).toBeGreaterThanOrEqual(10); // (the story islanders this week, besides the five always there)
  // talked to: they whole from head to waist, my head off to the side (v1.10.213 총괄 검토 「내 머리가 주민을 가려요」)
  const talking = () => page.evaluate(() => /talkMode/.test(document.getElementById('plazaDialog').className));
  const talkTo = (d) => expect.poll(async () => {
    if (await talking()) return true;
    await page.evaluate((d) => window.PlazaDebug().teleport(d.x + 0.9, d.z + 0.9), d); await page.waitForTimeout(600);
    await spaceOn(page, '', isMobile); await page.waitForTimeout(1200); return talking();
  }, { timeout: 20000 }).toBe(true).then(() => true, () => false);
  const framed = async (who) => {
    const off = (f) => !f ? [] : [f.head.y < 0.95 || '머리', f.waist.y > -0.1 || '허리 (대화 카드 위)', Math.abs(f.waist.x) < 0.6 || '가운데', Math.abs(f.myHead.x - f.waist.x) > 0.3 || '내 머리 옆으로'].filter((x) => x !== true);
    await expect.poll(async () => off(await page.evaluate(() => window.PlazaDebug().talkFrame3())), { message: who, timeout: 8000 }).toEqual([]); // (the camera eased into the talk's place)
  };
  if (!process.env.SHOT_DIR) {
    const near = posts.filter((p) => p.z > -300); let done = false;
    for (const d of near) { if (await talkTo(d)) { await framed(d.resident); done = true; break; } }
    expect(done).toBe(true);
    await expectNoScriptError(page); await who.context.close(); return;
  }
  const admin = await adminToken(request); const set = (what, mode) => request.post(`/api/admin/island/${what}`, { headers: { 'X-Session-Token': admin }, data: { mode } });
  const shot = async (name, wait = 1200) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-${name}.png` }); };
  try {
    await set('time', 'day'); await set('weather', 'clear'); await page.waitForTimeout(2000);
    // the story islanders and the mayor (on the island -- the rooms' posts are far off): standing from the side and in
    // front, the player off the line; then talked to up close, the talk's own camera
    const doors = posts.filter((p) => p.z > -300);
    for (const d of doors) {
      await page.evaluate((d) => { const p = window.PlazaDebug(); p.teleport(d.x + 3.2, d.z + 4.2); p.setCamYaw(Math.atan2(3.2, 4.2) - 0.32); p.setCamPitch?.(0.08); /* (turned a little: the islander beside me, not behind my head) */ }, d);
      await shot(`stand-${d.resident}`);
      if (await talkTo(d)) await framed(d.resident);
      await shot(`talk-${d.resident}`);
      await page.evaluate(() => document.getElementById('plazaDialog')?.close()); await page.waitForTimeout(500);
    }
    // the ten walking: each followed for a moment, the camera drawn in (Q); three talked to up close
    await page.locator('#plazaStage').focus(); for (let k = 0; k < 4; k += 1) await page.keyboard.press('KeyQ');
    for (const n of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      // (turned well off our line: they beside me, not behind my head -- the other side, or further round, if a tree or a wall is in the way)
      let seen = false; // (shot the moment they are seen -- walking on, they leave the picture in a second)
      for (const turn of [-0.6, 0.6, -0.3, 0.3, -1.0, 1.0, 0]) {
        await page.evaluate(([n, turn]) => { const d = window.PlazaDebug(); const w = d.wanderers.find((o) => o.n === n); if (w) { d.teleport(w.x + 1.8, w.z + 1.8); d.setCamYaw(Math.atan2(1.8, 1.8) + turn); d.setCamPitch?.(0.05); } }, [n, turn]);
        await page.waitForTimeout(1500); seen = await page.evaluate((n) => window.PlazaDebug().seesWalker(n), n); if (seen === true) break; console.log(`SEE ${test.info().project.name} walk-${n} ${turn} ${seen}`);
      }
      await shot(`walk-${n}`, seen === true ? 0 : 1200);
      if ([4, 5, 9].includes(n)) { // (노을 할머니, 오 탐정, 가람)
        await expect.poll(async () => { if (await talking()) return true; await page.evaluate((n) => window.PlazaDebug().talkResident(n), n); await page.waitForTimeout(1500); return talking(); }, { timeout: 20000 }).toBe(true).then(() => framed(`walk-${n}`), () => {});
        await shot(`walktalk-${n}`); await page.evaluate(() => document.getElementById('plazaDialog')?.close()); await page.waitForTimeout(500);
      }
    }
  } finally { await set('time', 'auto'); await set('weather', 'auto'); }
  await expectNoScriptError(page); await who.context.close();
});
