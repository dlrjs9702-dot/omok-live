const { test, expect } = require('@playwright/test');
const { shopper, post, spaceOn, revealTalk } = require('./skin-support');

// v1.10.220 사진 (SHOT_DIR only; gamecenter-notes docs/resident-likes-letters-17-20261101.md): 반디·한솔 (walking on 2026-11-13)
// given what they like in a talk, 김우성 (always at the jail) through the talk's answer (GIFT lines); then each close enough
// to write -- their own letter in my 우체통
const tag = () => `${test.info().project.name}`;

test('사진: 반디·한솔·김우성 선물·편지', async ({ browser, request, isMobile }) => {
  test.skip(!process.env.SHOT_DIR, 'SHOT_DIR only');
  test.setTimeout(600000);
  await request.post('/api/test/roster', { data: { on: true, day: '2026-11-13' } });
  try {
    for (const [n, item, nm] of [[18, 'candy', '반디'], [25, 'berry', '한솔'], [22, 'herb', '김우성']]) {
      const who = await shopper(browser, request, `${nm}편지${isMobile ? 'm' : ''}`, 0, 'female'); const { page } = who;
      await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testRealView', '1'); localStorage.setItem('gc.view.out', 'third'); });
      await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true); await page.waitForTimeout(2000);
      expect((await post(request, '/api/test/island/give', who.token, { itemId: item, qty: 1 })).status).toBe(200);
      const talking = () => page.evaluate(() => /talkMode/.test(document.getElementById('plazaDialog').className));
      if (n !== 22) {
        await expect.poll(async () => { if (await talking()) return true; await page.evaluate((k) => window.PlazaDebug().talkResident(k), n); await page.waitForTimeout(1500); return talking(); }, { timeout: 30000 }).toBe(true);
        const choices = page.locator('#plazaDialog .talkChoices button'); await revealTalk(page); await expect(choices.first()).toBeVisible({ timeout: 15000 });
        if (await choices.filter({ hasText: '다음에요' }).count()) { /* (one of the day's askers: the errand first -- shot, then 다음에요) */
          await page.screenshot({ path: `${process.env.SHOT_DIR}/${tag()}-errand-${n}.png` }); await choices.filter({ hasText: '다음에요' }).click(); await revealTalk(page);
        }
        await choices.filter({ hasText: '⋯ 더 보기' }).click(); await choices.filter({ hasText: '선물해요' }).click(); await revealTalk(page); /* (v1.10.267: in 「더 보기」) */
        await expect(choices.first()).toHaveAttribute('data-topic', 'gift', { timeout: 10000 }); await choices.first().click();
        await page.waitForTimeout(1500); await revealTalk(page); await page.waitForTimeout(600);
        await page.screenshot({ path: `${process.env.SHOT_DIR}/${tag()}-gift-${n}.png` });
        await page.keyboard.press('Escape'); await page.waitForTimeout(800);
      } else {
        const r = await post(request, '/api/island/resident/talk', who.token, { n, topic: 'gift', itemId: item });
        console.log(`GIFT ${tag()} ${n} ${r.status} ${JSON.stringify(r.data?.say || r.data?.message)} ${JSON.stringify(r.data?.affinity || null)}`);
      }
      let st = null; for (let k = 0; k < 2; k += 1) { st = await post(request, '/api/test/affinity', who.token, { n, delta: 10 }); expect(st.status).toBe(200); } // (친한 사이: 15+, at most 10 a change)
      console.log(`STAGES ${tag()} ${n} ${JSON.stringify(st.data.stages)}`); /* (총괄 220: a 10~26 islander's level rewards -- the points, the title at 단짝 later) */
      await page.evaluate(() => window.PlazaDebug().place('mailbox')); await page.waitForTimeout(800);
      await spaceOn(page, '', isMobile); await page.waitForTimeout(2500);
      const letter = page.locator('#plazaDialog').getByText(nm).first(); if (await letter.isVisible().catch(() => false)) { await letter.click().catch(() => {}); await page.waitForTimeout(1200); }
      await page.screenshot({ path: `${process.env.SHOT_DIR}/${tag()}-letter-${n}.png` });
      await who.context.close();
    }
  } finally { await request.post('/api/test/roster', { data: { on: false } }); }
});
