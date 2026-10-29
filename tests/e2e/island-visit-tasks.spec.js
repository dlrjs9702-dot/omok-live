const { test, expect } = require('@playwright/test');
const { shopper, post, expectNoScriptError } = require('./skin-support');

// 206 구경 C안 (gamecenter-notes docs/interact-quests-20261029.md 2-1, 사용자 「c 안으로 가자」): a visit is a small task
// where it is, not walking in -- the flowers (the colour asked, on the card too; a wrong one 「다시 볼까요?」), the mural's
// three in turn (the middle first 「다시 볼까요?」), the pier (the boat out of sight). The things there only while asked
// (✨). PC and phone. (The crossing and the train's minutes: their stories are not in the tests' week -- units cover them.)
test('구경 C안: 꽃 색 찾기·벽화 차례로·부두 배웅, 걸어 들어가기만으론 안 끝남', async ({ browser, request, isMobile }) => {
  test.setTimeout(process.env.CI ? 300000 : 180000);
  const who = await shopper(browser, request, isMobile ? '구경할일m' : '구경할일', 0, 'female'); const { page, token } = who;
  const track = (await post(request, '/api/test/quest/take', token, { stories: ['granny', 'painter', 'fisher'], visit: true })).data.track;
  const task = (id) => track.find((t) => t.story === id).task;
  await page.evaluate((shots) => { localStorage.removeItem('gc.testClassic'); if (!shots) localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null])))); }, Boolean(process.env.SHOT_DIR)); /* (the photos: the real models) */
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.running), { timeout: 60000 }).toBe(true);
  const hint = page.locator('#plazaHint'); const toast = page.locator('#toast'); const card = page.locator('#questTracker');
  const press = async () => { if (isMobile) await hint.click(); else { await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); } };
  const goTo = async (p, name) => { await page.evaluate((q) => window.PlazaWarp(q.x, q.z), p); await expect(hint).toContainText(name, { timeout: 10000 }); };
  const line = (who) => card.locator('.questLine', { hasText: who });
  // the flowers: the colour on the card; the wrong clump not, the asked one -- done
  const KO = { red: '빨간', yellow: '노란', white: '하얀', pink: '분홍', purple: '보라' }; const fl = task('granny');
  const asked = Object.values(KO).find((k) => track.find((t) => t.story === 'granny').label.includes(k));
  const right = fl.options.findIndex((c) => KO[c] === asked); expect(right).toBeGreaterThanOrEqual(0);
  await expect(line('꽃님')).toContainText(`강가 ${asked} 꽃`, { timeout: 30000 });
  const wrong = (right + 1) % fl.spots.length;
  await goTo(fl.spots[wrong], `${KO[fl.options[wrong]]} 꽃`); await press(); await expect(toast).toHaveText('다시 볼까요?');
  await goTo(fl.spots[right], `${asked} 꽃`);
  if (process.env.SHOT_DIR) { const c = { x: fl.spots.reduce((n, p) => n + p.x, 0) / 3, z: fl.spots.reduce((n, p) => n + p.z, 0) / 3 }; await page.evaluate((q) => { const d = window.PlazaDebug(); d.teleport(q.x + 4.5, q.z); d.setCamYaw(Math.PI / 2); }, c); await page.waitForTimeout(2500); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-visit-flowers.png` }); await goTo(fl.spots[right], `${asked} 꽃`); }
  await press(); await expect(toast).toContainText('✓ 돌아가 말해요'); await expect(line('꽃님')).toContainText('✓ 돌아가 말해요');
  // the mural: the middle first is not it; left to right is
  const mu = task('painter');
  await goTo(mu.spots[1], '벽화'); await press(); await expect(toast).toHaveText('다시 볼까요?');
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-visit-mural.png` });
  for (const p of mu.spots) { await goTo(p, '벽화'); await page.waitForTimeout(300); await press(); await page.waitForTimeout(500); }
  await expect(line(track.find((t) => t.story === 'painter').name)).toContainText('✓ 돌아가 말해요', { timeout: 10000 });
  // the pier: standing there is not it; the wave until the boat is out -- then done
  const pi = task('fisher');
  await goTo(pi.at, '배웅하기'); await page.waitForTimeout(1500); await expect(card.locator('.questLine', { hasText: '배웅' })).toHaveCount(1);
  await press(); await expect(toast).toContainText('손 흔들어요');
  if (process.env.SHOT_DIR) { await page.waitForTimeout(2500); await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-visit-pier.png` }); }
  await expect(toast).toContainText('✓ 돌아가 말해요', { timeout: 15000 });
  await expect(card.locator('.questLine', { hasText: '배웅' })).toHaveCount(0);
  await expectNoScriptError(page); await who.context.close();
});
