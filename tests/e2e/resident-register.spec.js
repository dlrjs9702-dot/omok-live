const { test, expect } = require('@playwright/test');
const { shopper, post, adminToken, revealTalk, expectNoScriptError } = require('./skin-support');

// B v1.10.214 주민 말씨 (gamecenter-notes story/voices-20261029 「이야기해요 말투 어긋남」): 「섬 소문 있어요?」 and 「이야기
// 나눠요」 in the islander's own register -- 가람 (꼬마 반말), 노을 할머니 (할머니 말), 오 탐정 (하게체 ~란 말이지) say the
// rumor and ask the day's question each with their own ending, not one 해요체 for all. PC and phone.
test('이야기해요 말씨: 가람·노을 할머니·오 탐정, 소문과 오늘의 질문이 서로 다른 어미', async ({ browser, request }) => {
  test.setTimeout(process.env.CI ? 400000 : 240000);
  const who = await shopper(browser, request, '말씨듣기', 0, 'female'); const { page, token } = who;
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }); // (the stand-ins: the talk needs no models)
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const talking = async () => /talkMode/.test(await page.locator('#plazaDialog').getAttribute('class') || '');
  // (as resident-talk: a warp by them, then the talk -- held for me, so the topics below reach them)
  const talkTo = (n) => expect.poll(async () => {
    if (!await talking()) { await post(request, '/api/test/island/free-residents', token, {}); await page.evaluate(async (n) => { const w = window.PlazaDebug().wanderers.find((o) => o.n === n); if (w) await window.PlazaWarp(w.x + 1.1, w.z); window.PlazaDebug().talkResident(n); }, n); await page.waitForTimeout(1500); }
    return talking();
  }, { timeout: 120000, intervals: [300] }).toBe(true);
  const close = () => expect.poll(async () => { if (await talking()) await page.keyboard.press('Escape'); await page.waitForTimeout(400); return talking(); }, { timeout: 20000 }).toBe(false);
  const said = {};
  const admin = process.env.SHOT_DIR ? await adminToken(request) : null; const world = (what, mode) => request.post(`/api/admin/island/${what}`, { headers: { 'X-Session-Token': admin }, data: { mode } });
  if (admin) { await world('time', 'day'); await world('weather', 'clear'); } // (the photos by day, no rain -- put back after)
  for (const n of [9, 4, 5]) { // 가람, 노을 할머니, 오 탐정
    await talkTo(n);
    if (admin) { // (the photos: 이야기해요 → 섬 소문 있어요? in the talk window)
      const choice = (text) => page.locator('#plazaDialog .talkChoices button', { hasText: text });
      await revealTalk(page); if (await page.locator('#plazaDialog .questNote', { hasText: '오늘 안에' }).count()) { await choice('다음에요').click(); await revealTalk(page); } // (an errand asked first: later)
      await choice('이야기해요').click(); await page.waitForTimeout(400);
      await Promise.all([page.waitForResponse((r) => r.url().includes('/api/island/resident/talk')), choice('섬 소문 있어요?').click()]); await revealTalk(page); await page.waitForTimeout(600);
      await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-rumor-${n}.png` });
    }
    const rumor = await post(request, '/api/island/resident/talk', token, { n, topic: 'rumor' }); expect(rumor.status).toBe(200);
    const ask = await post(request, '/api/island/resident/talk', token, { n, topic: 'ask' }); expect(ask.status).toBe(200);
    said[n] = { rumor: rumor.data.say.join(' '), ask: ask.data.say[0] };
    await close();
  }
  if (admin) { await world('time', 'auto'); await world('weather', 'auto'); }
  const ends = (s) => s.replace(/[\s.!?~…]+$/, '').slice(-3);
  for (const k of ['rumor', 'ask']) expect(new Set([9, 4, 5].map((n) => ends(said[n][k]))).size, JSON.stringify(said)).toBe(3);
  expect(said[9].ask).not.toMatch(/요\?$/); expect(said[4].ask).toMatch(/니\?|니$/); expect(said[5].ask).toMatch(/[가나]\?|말이지\.$|일세\.$/); // (꼬마 반말, 할머니 ~니?, 하게체)
  await expectNoScriptError(page); await who.context.close();
});
