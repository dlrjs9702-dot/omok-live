const { test, expect } = require('@playwright/test');
const { shopper, post, expectNoScriptError } = require('./skin-support');
const T = require('../../public/plaza/island-terrain.js');
const Train = require('../../public/plaza/island-train.js');

// v1.10.233 (문제 기록 11-03, 총괄): 철이's 2단계 「초승역 다음 열차 세기」 -- its place was the station lift's door, whose
// prompt (2.6 m) always took the 이름판's (2.4 m): the step could never be done. Now 3.6 m off it: by the 이름판 its prompt,
// the minutes written and the step done; at the lift's door the lift's prompt as before. PC and phone; SHOT_DIR a photo.
test('철이 2단계: 초승역 이름판 앞에서 「다음 열차 세기」가 뜨고 답을 붙이면 통과, 승강기 안내는 그대로', async ({ browser, request, isMobile }) => {
  test.setTimeout(240000);
  test.skip(!T.dalmaru, '달마루섬');
  const who = await shopper(browser, request, isMobile ? '시간표m' : '시간표', 0, 'male'); const { page } = who;
  await page.evaluate((real) => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.view.out', 'third'); if (real) localStorage.setItem('gc.testRealView', '1'); else localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }, Boolean(process.env.SHOT_DIR));
  const took = await post(request, '/api/test/quest/take', who.token, { stories: ['stationmaster'], visit: true, open: true }); expect(took.status).toBe(200); // (철이 is not in the tests' week: opened for this test; before the island loads, its 부탁 drawn from the start)
  try {
  expect(took.data.track.some((t) => t.story === 'stationmaster')).toBe(true);
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 90000 }).toBe(true);
  const spot = T.dalmaru.PLACES.quests.station; const entry = Train.STATIONS.W.entry;
  expect(Math.hypot(spot.x - entry[0], spot.z - entry[1])).toBeGreaterThan(3.2);
  const hintAt = async (x, z, text) => expect.poll(async () => { await page.evaluate(([x, z]) => window.PlazaWarp(x, z), [x, z]); await page.waitForTimeout(1200); return page.locator('#plazaHint').textContent(); }, { timeout: 60000, intervals: [1000] }).toContain(text);
  await hintAt(spot.x, spot.z, '역 이름판 · 다음 열차 세기');
  if (process.env.SHOT_DIR) { await page.waitForTimeout(1500); await page.screenshot({ path: `${process.env.SHOT_DIR}/${isMobile ? 'phone' : 'pc'}-station-board.png` }); }
  if (isMobile) await page.locator('#plazaHint').tap(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); }
  const input = page.locator('input.visitMinutes'); await expect(input).toBeVisible({ timeout: 10000 });
  const minutes = await page.evaluate(() => { const soon = Object.values(window.IslandTrain.nextAt('W', Date.now())).filter((v) => v != null); return soon.length ? Math.ceil(Math.min(...soon) / 60) : 0; });
  await input.fill(String(minutes)); await page.locator('.visitChoices button', { hasText: '붙이기' }).click();
  await expect(page.locator('#toast')).toContainText('시간표가 잘 붙었어요', { timeout: 10000 });
  // the lift's prompt at its door, as before
  await hintAt(entry[0], entry[1], '승강기');
  await expectNoScriptError(page);
  } finally { await post(request, '/api/test/quest/take', who.token, { stories: ['stationmaster'], open: false }); await who.context.close(); }
});
