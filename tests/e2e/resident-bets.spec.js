const { test, expect } = require('@playwright/test');
const { shopper, post, get, expectNoScriptError } = require('./skin-support');
const B = require('../../public/plaza/island-bets.js');
const R = require('../../public/plaza/island-roster.js');
test.skip(({ isMobile }) => isMobile && !process.env.SHOT_DIR, 'PC 흐름 하나(폰은 사진만 -- SHOT_DIR)');

// v1.10.278 주민 내기 (gamecenter-notes docs/resident-bets-design-20261025.md, the 2026-11-08 part's one flow): an islander's own
// ask (a wave, a bubble) -> 「🎲 내기해요」 in their talk -> 1,000P on their score game -> left before its end: lost (their words, the
// stake gone) -> another's match bet: an AI room 「○○와 내기」 with them in its seat. A won round's 2x: unit island-bets.
test('주민 내기: 제안 말풍선 → 「내기해요」 → 점수 내기 한 판(나가면 짐) → 결과 대사·포인트·감정 → 대국 내기 방 열림', async ({ browser, request }) => {
  test.setTimeout(240000);
  const who = await shopper(browser, request, '내기꾼', 50000, 'female'); const { page, token } = who;
  const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); const fixed = new Set(Object.values(R.FIXED));
  const walkers = [...Array(10).keys()].filter((n) => !fixed.has(n)); // (the ten who walk with the roster off -- the tests' server)
  const sn = walkers.find((n) => B.kindOf(B.gameOf(n, day)) === 'score'); const mn = walkers.find((n) => B.kindOf(B.gameOf(n, day)) === 'match');
  for (const n of [sn, mn]) expect((await post(request, '/api/test/affinity', token, { n, delta: 5 })).status).toBe(200); // (아는 사이)
  await post(request, '/api/test/bet', token, { reset: true });
  await page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testBetOffer', '1'); }); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const shot = async (name) => { if (process.env.SHOT_DIR) { await page.waitForTimeout(800); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name === 'chromium' ? 'pc' : 'phone'}-bet-${name}.png` }); } };
  // their own ask: standing by them -- a bubble with their words
  await expect.poll(async () => {
    const said = await page.evaluate((n) => window.PlazaDebug().residentBubble(n), sn); if (typeof said === 'string' && said.length > 4) return said;
    await post(request, '/api/test/island/free-residents', token, {}); await page.evaluate(async (n) => { const w = window.PlazaDebug().wanderers.find((o) => o.n === n); if (w) await window.PlazaWarp(w.x + 1.2, w.z); }, sn); await page.waitForTimeout(2600); return null;
  }, { timeout: 60000, intervals: [300] }).not.toBeNull();
  await shot('offer');
  // 「🎲 내기해요」 in their talk: their words, the stakes (a score game: up to 5,000)
  const dialog = page.locator('#plazaDialog'); const talking = async () => /talkMode/.test(await dialog.getAttribute('class') || '');
  await expect.poll(async () => { if (!await talking()) { await post(request, '/api/test/island/free-residents', token, {}); await page.evaluate(async (n) => { const w = window.PlazaDebug().wanderers.find((o) => o.n === n); if (w) await window.PlazaWarp(w.x + 1.1, w.z); window.PlazaDebug().talkResident(n); }, sn); await page.waitForTimeout(800); } return talking(); }, { timeout: 90000, intervals: [300] }).toBe(true);
  await require('./skin-support').revealTalk(page);
  const betBtn = dialog.locator('[data-topic="bet"]'); await expect(betBtn).toBeVisible({ timeout: 10000 }); await betBtn.click();
  await expect(dialog.locator('[data-topic="stake"]')).toHaveText(['1,000P 걸기', '5,000P 걸기']); await expect(dialog.locator('.betNote')).toContainText(B.NAMES[B.gameOf(sn, day)]);
  await shot('stakes');
  const before = (await get(request, '/api/points', token)).data.balance;
  await dialog.locator('[data-topic="stake"]', { hasText: '1,000P' }).click();
  await expect.poll(async () => (await get(request, '/api/points', token)).data.balance, { timeout: 10000 }).toBe(before - 1000); // (the stake first)
  // their game opens; left before its end -- lost: their words, the stake gone, their face
  await expect(page.locator('#reflexView, .reflexFrame, #hud').first()).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(1500); await shot('game');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  const back = page.locator('button', { hasText: '섬으로' }).first(); if (await back.isVisible().catch(() => false)) await back.click();
  const result = page.locator('.betResult'); await expect(result).toBeVisible({ timeout: 30000 }); await expect(result).toHaveAttribute('data-result', 'lose'); await expect(result).toContainText('-1,000P');
  await expect(dialog).toContainText('「'); await shot('result');
  expect((await get(request, '/api/points', token)).data.balance).toBe(before - 1000);
  await page.keyboard.press('Escape');
  // another's match bet: an AI room 「○○와 내기」, them in its seat
  await post(request, '/api/test/island/free-residents', token, {}); /* (an event -- or another run's bet -- may hold them) */
  const go = (await post(request, '/api/island/bet/start', token, { n: mn, stake: 1000 })).data; expect(go.kind, JSON.stringify(go)).toBe('match');
  const room = await post(request, '/api/rooms', token, { gameType: go.game, visibility: 'private', title: go.title, ai: go.level, bet: go.id });
  expect(room.status, JSON.stringify(room.data)).toBe(201); expect(room.data.state.room?.title || room.data.state.title || go.title).toContain('와 내기');
  expect(JSON.stringify(room.data.state)).toContain(go.name); // (their name in the AI's seat)
  expect((await post(request, '/api/rooms', token, { gameType: go.game, visibility: 'private', title: go.title, ai: go.level, bet: go.id })).data.error).toBe('BET_GONE'); // (one room a bet)
  await expectNoScriptError(page); await who.context.close();
});
